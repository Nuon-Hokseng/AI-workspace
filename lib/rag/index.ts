import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { embed } from "ai";
import { sql } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";
import { chunkText } from "@/lib/rag/chunk";

// Same key store as the chat providers -- there's no separate "embeddings"
// key. Embeddings work with whichever capable key is saved: OpenAI first,
// else Gemini. (Anthropic/xAI/Moonshot offer no embedding API, and Ollama
// isn't reachable from the server -- chat works with any model, but
// semantic memory needs one of these two keys. With neither, retrieval
// falls back to keyword search and indexing quietly does nothing.)
//
// The tag is stored on every row and filtered on at query time: vectors
// from different models live in different spaces and must never be
// compared, so rows embedded under a previous provider go dormant until
// that key comes back (keyword fallback still sees notes/logs meanwhile).
async function getEmbedder() {
  const rows = await sql<{ provider: "openai" | "google"; encrypted_key: string }[]>`
    select provider, encrypted_key from api_keys where provider in ('openai', 'google')
  `;
  const keys = new Map(rows.map((r) => [r.provider, decrypt(r.encrypted_key)]));

  const openaiKey = keys.get("openai");
  if (openaiKey) {
    return {
      model: createOpenAI({ apiKey: openaiKey }).embedding("text-embedding-3-small"),
      tag: "openai:text-embedding-3-small",
    };
  }
  const googleKey = keys.get("google");
  if (googleKey) {
    return {
      model: createGoogleGenerativeAI({ apiKey: googleKey }).embedding("gemini-embedding-001"),
      tag: "google:gemini-embedding-001",
    };
  }
  return null;
}

type Embedder = NonNullable<Awaited<ReturnType<typeof getEmbedder>>>;

function embedText(embedder: Embedder, value: string) {
  return embed({
    model: embedder.model,
    value,
    // Gemini defaults to 3072 dims; the column is vector(1536). Ignored
    // by the OpenAI model.
    providerOptions: { google: { outputDimensionality: 1536 } },
  });
}

// pgvector's input format for a vector column: "[0.1,0.2,...]" cast via
// ::vector in the query. postgres.js has no native vector type, so this
// is passed through as a plain string parameter.
function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

type SourceType = "chat" | "document" | "note" | "log";

// Best-effort and non-blocking: chunks text, embeds each chunk, and stores
// it tagged to the project/source. Failures (no key, API error) are
// logged and swallowed -- indexing is a side effect, never the reason an
// upload, note save, or chat message fails.
export async function indexContent(params: {
  projectId: string;
  sourceType: SourceType;
  sourceId: string;
  text: string;
}): Promise<void> {
  try {
    const embedder = await getEmbedder();
    if (!embedder) return;

    const chunks = chunkText(params.text);
    if (chunks.length === 0) return;

    for (const chunk of chunks) {
      // Embed the plaintext chunk (the embedding call needs real text);
      // only the copy stored in the DB is encrypted.
      const { embedding, usage } = await embedText(embedder, chunk);
      await sql`
        insert into memory_embeddings
          (project_id, source_type, source_id, content_chunk, embedding, embedding_model, tokens_used)
        values (
          ${params.projectId},
          ${params.sourceType},
          ${params.sourceId},
          ${encrypt(chunk)},
          ${toVectorLiteral(embedding)}::vector,
          ${embedder.tag},
          ${Number.isFinite(usage.tokens) ? usage.tokens : null}
        )
      `;
    }
  } catch (err) {
    console.error("RAG indexing failed (non-fatal):", err);
  }
}

const MATCH_LIMIT = 5;

// No-embedding-key fallback: full-text search straight over the plaintext
// notes/logs tables, so a fully local setup (Ollama, no cloud keys) still
// has memory. Reads source tables directly, so it also covers content
// saved before any key existed. Chat/documents can't join in -- their
// stored copies are encrypted -- so semantic memory over those still
// needs an OpenAI or Gemini key.
async function keywordSearchMemory(projectId: string, queryText: string): Promise<string[]> {
  const words = [...new Set(queryText.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [])].slice(0, 12);
  if (words.length === 0) return [];
  // Sanitized to alphanumerics above, so joining into a tsquery is safe.
  const tsQuery = words.join(" | ");

  const rows = await sql<{ content: string }[]>`
    select content from (
      select content, created_at from project_notes where project_id = ${projectId}
      union all
      select entry as content, created_at from project_logs where project_id = ${projectId}
    ) as sources
    where to_tsvector('english', content) @@ to_tsquery('english', ${tsQuery})
    order by
      ts_rank(to_tsvector('english', content), to_tsquery('english', ${tsQuery})) desc,
      created_at desc
    limit ${MATCH_LIMIT}
  `;
  return rows.map((r) => r.content);
}

// Top matches for a query, scoped to one project. Returns [] (not an
// error) whenever RAG isn't usable right now -- no key, embedding call
// failed, whatever -- since this is a context-enrichment step, not a
// required part of sending a chat message.
export async function searchMemory(projectId: string, queryText: string): Promise<string[]> {
  try {
    if (!queryText.trim()) return [];
    const embedder = await getEmbedder();
    if (!embedder) return keywordSearchMemory(projectId, queryText);

    const { embedding } = await embedText(embedder, queryText);

    // Only rows embedded by the same model are comparable -- others go
    // dormant until their provider's key is saved again.
    const rows = await sql<{ content_chunk: string }[]>`
      select content_chunk
      from memory_embeddings
      where project_id = ${projectId} and embedding_model = ${embedder.tag}
      order by embedding <-> ${toVectorLiteral(embedding)}::vector
      limit ${MATCH_LIMIT}
    `;
    if (rows.length === 0) return keywordSearchMemory(projectId, queryText);
    return rows.map((r) => decrypt(r.content_chunk));
  } catch (err) {
    // A broken vector path (bad key, missing column, API outage) should
    // degrade to keyword memory, not to amnesia.
    console.error("RAG retrieval failed (non-fatal):", err);
    try {
      return await keywordSearchMemory(projectId, queryText);
    } catch {
      return [];
    }
  }
}
