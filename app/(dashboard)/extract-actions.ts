"use server";

import { generateText } from "ai";
import { sql } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { buildExtractionPrompt, findUrls, parseExtraction, type Extraction } from "@/lib/extract";
import { getModel } from "@/lib/llm/providers";
import { indexContent } from "@/lib/rag";

// Cheap and fast — background extraction never needs a frontier model.
const EXTRACTION_MODEL = "gemini-2.0-flash";

// Insert-if-new links, scoped to one project. No unique constraint:
// ponytail: not-exists check races under concurrent writes; single-user
// app, worst case is a duplicate link row.
async function saveLinks(projectId: string, links: Extraction["links"]) {
  for (const link of links) {
    await sql`
      insert into project_links (project_id, url, label)
      select ${projectId}, ${link.url}, ${link.label}
      where not exists (
        select 1 from project_links
        where project_id = ${projectId} and url = ${link.url}
      )
    `;
  }
}

// Persist what a background extractor found: links to the Links tab, log
// entries to the Log tab, and each log entry into this project's memory
// (memory_embeddings is scoped by project_id — nothing crosses projects).
// When the source was a note, stamp it digested — this only runs after a
// successful extraction pass, so the stamp never lies.
export async function saveNoteExtraction(
  projectId: string,
  extraction: Extraction,
  noteId?: string,
) {
  await saveLinks(projectId, extraction.links);
  for (const entry of extraction.logs) {
    const [log] = await sql<{ id: string }[]>`
      insert into project_logs (project_id, entry)
      values (${projectId}, ${entry})
      returning id
    `;
    await indexContent({ projectId, sourceType: "log", sourceId: log.id, text: entry });
  }
  if (noteId) {
    await sql`
      update project_notes set digested_at = now()
      where id = ${noteId} and project_id = ${projectId}
    `;
  }
}

// Gemini background pass over a saved note. Silent by design: no key, a
// failed call, or unparseable output all just mean "nothing extracted".
export async function runCloudExtraction(
  projectId: string,
  noteText: string,
  noteId?: string,
) {
  try {
    const [savedKey] = await sql<{ encrypted_key: string }[]>`
      select encrypted_key from api_keys where provider = 'google'
    `;
    if (!savedKey) return;

    const { text } = await generateText({
      model: getModel("google", EXTRACTION_MODEL, decrypt(savedKey.encrypted_key)),
      prompt: buildExtractionPrompt(noteText),
    });
    await saveNoteExtraction(projectId, parseExtraction(text), noteId);
  } catch (err) {
    console.error("Background extraction failed (non-fatal):", err);
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
