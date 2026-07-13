"use server";

import { generateText } from "ai";
import { sql } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { buildExtractionPrompt, findUrls, parseExtraction, type Extraction } from "@/lib/extract";
import { getModel } from "@/lib/llm/providers";
import { indexContent } from "@/lib/rag";

import { isKnownProvider } from "@/lib/llm/models";

const SCRAPE_TIMEOUT_MS = 10000;
const SCRAPE_CHAR_CAP = 20000;

// Fetch a link's page and index its readable text into project memory.
// Plain HTML-strip, no headless browser: good enough for docs/articles,
// silently yields nothing for JS-only pages.
export async function scrapeAndIndexLink(projectId: string, linkId: string, url: string) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
      headers: { "User-Agent": "Mozilla/5.0 (project-cookbook link indexer)" },
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("text/html")) return;

    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, SCRAPE_CHAR_CAP);
    if (!text) return;

    // Re-scrapes replace this link's old chunks instead of piling on.
    await sql`
      delete from memory_embeddings where source_type = 'link' and source_id = ${linkId}
    `;
    await indexContent({
      projectId,
      sourceType: "link",
      sourceId: linkId,
      text: `Content of ${url}:\n${text}`,
    });
  } catch (err) {
    console.error("Link scraping failed (non-fatal):", err);
  }
}

// Insert-if-new links, scoped to one project; every NEW link's page is
// scraped into memory. No unique constraint:
// ponytail: not-exists check races under concurrent writes; single-user
// app, worst case is a duplicate link row.
export async function saveLinks(projectId: string, links: Extraction["links"]) {
  for (const link of links) {
    const [inserted] = await sql<{ id: string }[]>`
      insert into project_links (project_id, url, label)
      select ${projectId}, ${link.url}, ${link.label}
      where not exists (
        select 1 from project_links
        where project_id = ${projectId} and url = ${link.url}
      )
      returning id
    `;
    if (inserted) {
      await scrapeAndIndexLink(projectId, inserted.id, link.url);
    }
  }
}

// One pipeline for every uploaded file, wherever it came from (Documents
// tab, notes attach, chat attachment): extract the full text (txt/pdf/docx),
// index all of it into project memory, and harvest any URLs inside the
// document into the Links tab (which scrapes them into memory too).
export async function ingestDocument(
  projectId: string,
  documentId: string,
  buffer: Buffer,
  fileType: string | null,
) {
  try {
    const { extractText } = await import("@/lib/rag/extract-text");
    const text = await extractText(buffer, fileType);
    if (!text) return;

    await indexContent({ projectId, sourceType: "document", sourceId: documentId, text });

    const urls = findUrls(text);
    if (urls.length > 0) {
      await saveLinks(projectId, urls.map((url) => ({ url, label: null })));
    }
  } catch (err) {
    console.error("Document ingestion failed (non-fatal):", err);
  }
}

export type LogRow = { id: string; entry: string };

// Persist what a background extractor found: links to the Links tab, log
// entries to the Log tab, and each log entry into this project's memory
// (memory_embeddings is scoped by project_id — nothing crosses projects).
// When the source was a note, stamp it digested — this only runs after a
// successful extraction pass, so the stamp never lies. Returns the created
// log rows so a client caller can also embed them via Ollama, if that's
// configured (see lib/embed-client.ts) -- the cloud embedder attempt above
// already ran server-side and safely no-ops without a cloud key.
export async function saveNoteExtraction(
  projectId: string,
  extraction: Extraction,
  noteId?: string,
): Promise<LogRow[]> {
  await saveLinks(projectId, extraction.links);
  const logRows: LogRow[] = [];
  for (const entry of extraction.logs) {
    const [log] = await sql<{ id: string }[]>`
      insert into project_logs (project_id, entry)
      values (${projectId}, ${entry})
      returning id
    `;
    await indexContent({ projectId, sourceType: "log", sourceId: log.id, text: entry });
    logRows.push({ id: log.id, entry });
  }
  if (noteId) {
    await sql`
      update project_notes set digested_at = now()
      where id = ${noteId} and project_id = ${projectId}
    `;
  }
  return logRows;
}

// Cloud background pass over a saved note, using whichever provider/model
// the Background AI setting picked. Silent by design: no key, a failed
// call, or unparseable output all just mean "nothing extracted".
export async function runCloudExtraction(
  projectId: string,
  noteText: string,
  noteId: string | undefined,
  provider: string,
  model: string,
): Promise<LogRow[]> {
  try {
    if (!isKnownProvider(provider)) return [];
    const [savedKey] = await sql<{ encrypted_key: string }[]>`
      select encrypted_key from api_keys where provider = ${provider}
    `;
    if (!savedKey) return [];

    const { text } = await generateText({
      model: getModel(provider, model, decrypt(savedKey.encrypted_key)),
      prompt: buildExtractionPrompt(noteText),
    });
    return await saveNoteExtraction(projectId, parseExtraction(text), noteId);
  } catch (err) {
    console.error("Background extraction failed (non-fatal):", err);
    return [];
  }
}

// URLs shared in chat land in the Links tab automatically — regex, no LLM.
export async function harvestChatLinks(projectId: string, text: string) {
  try {
    const urls = findUrls(text);
    if (urls.length > 0) {
      await saveLinks(projectId, urls.map((url) => ({ url, label: null })));
    }
  } catch (err) {
    console.error("Link harvesting failed (non-fatal):", err);
  }
}
