"use server";

import { sql } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { hasCloudEmbedder as checkCloudEmbedder, toVectorLiteral } from "@/lib/rag";

// Client code can't import lib/rag/index.ts directly (it pulls in
// server-only deps like postgres/node:crypto) -- this thin wrapper is what
// makes the check callable from the browser as a Server Action.
export async function hasCloudEmbedder(): Promise<boolean> {
  return checkCloudEmbedder();
}

// Stores chunks embedded in the BROWSER (via Ollama, since the server has
// no way to reach the user's local Ollama instance itself -- see
// lib/embed-client.ts). Always deletes any prior rows for this exact
// source first: a source only ever carries ONE tag's worth of memory at a
// time, so re-indexing (a note edit, a fresh chat exchange id) replaces
// rather than accumulates. Safe as a no-op for sources that never had
// prior rows (new notes, chat/log entries with a freshly generated id).
export async function storeEmbeddedChunks(
  projectId: string,
  sourceType: "chat" | "document" | "note" | "log" | "link",
  sourceId: string,
  tag: string,
  chunks: string[],
  embeddings: number[][],
) {
  await sql`
    delete from memory_embeddings where source_type = ${sourceType} and source_id = ${sourceId}
  `;
  for (let i = 0; i < chunks.length; i++) {
    await sql`
      insert into memory_embeddings
        (project_id, source_type, source_id, content_chunk, embedding, embedding_model)
      values (
        ${projectId}, ${sourceType}, ${sourceId},
        ${encrypt(chunks[i])}, ${toVectorLiteral(embeddings[i])}::vector, ${tag}
      )
    `;
  }
}
