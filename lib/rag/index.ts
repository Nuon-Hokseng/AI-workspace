import { createOpenAI } from "@ai-sdk/openai";
import { embed } from "ai";
import { sql } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";
import { chunkText } from "@/lib/rag/chunk";

const EMBEDDING_MODEL = "text-embedding-3-small";

// Same key store as the chat providers -- there's no separate "embeddings"
// key. If the user hasn't saved an OpenAI key, RAG quietly does nothing
// (no indexing, no retrieval) rather than blocking uploads/notes/chat.
async function getOpenAIApiKey(): Promise<string | null> {
  const [row] = await sql<{ encrypted_key: string }[]>`
    select encrypted_key from api_keys where provider = 'openai'
  `;
  return row ? decrypt(row.encrypted_key) : null;
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
    const apiKey = await getOpenAIApiKey();
    if (!apiKey) return;

    const chunks = chunkText(params.text);
    if (chunks.length === 0) return;

    const openai = createOpenAI({ apiKey });
    const model = openai.textEmbeddingModel(EMBEDDING_MODEL);

    for (const chunk of chunks) {
      // Embed the plaintext chunk (the embedding call needs real text);
      // only the copy stored in the DB is encrypted.
      const { embedding, usage } = await embed({ model, value: chunk });
      await sql`
        insert into memory_embeddings
          (project_id, source_type, source_id, content_chunk, embedding, tokens_used)
        values (
          ${params.projectId},
          ${params.sourceType},
          ${params.sourceId},
          ${encrypt(chunk)},
          ${toVectorLiteral(embedding)}::vector,
          ${usage.tokens}
        )
      `;
    }
  } catch (err) {
    console.error("RAG indexing failed (non-fatal):", err);
  }
}

const MATCH_LIMIT = 5;

// Top matches for a query, scoped to one project. Returns [] (not an
// error) whenever RAG isn't usable right now -- no key, embedding call
// failed, whatever -- since this is a context-enrichment step, not a
// required part of sending a chat message.
export async function searchMemory(projectId: string, queryText: string): Promise<string[]> {
  try {
    const apiKey = await getOpenAIApiKey();
    if (!apiKey || !queryText.trim()) return [];

    const openai = createOpenAI({ apiKey });
    const model = openai.textEmbeddingModel(EMBEDDING_MODEL);
    const { embedding } = await embed({ model, value: queryText });

    const rows = await sql<{ content_chunk: string }[]>`
      select content_chunk
      from memory_embeddings
      where project_id = ${projectId}
      order by embedding <-> ${toVectorLiteral(embedding)}::vector
      limit ${MATCH_LIMIT}
    `;
    return rows.map((r) => decrypt(r.content_chunk));
  } catch (err) {
    console.error("RAG retrieval failed (non-fatal):", err);
    return [];
  }
}
