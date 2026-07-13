"use client";

import { hasCloudEmbedder, storeEmbeddedChunks } from "@/app/(dashboard)/embed-actions";
import { chunkText } from "@/lib/rag/chunk";
import { useEmbeddingStore } from "@/lib/store/embedding-store";
import { OLLAMA_BASE_URL } from "@/lib/store/ollama-store";

function ollamaTag(model: string) {
  return `ollama:${model}`;
}

// Ollama's OpenAI-compatible endpoint accepts a batch (`input` as an
// array), so a whole document's chunks -- or several -- go out as one
// request instead of one round-trip per chunk.
async function embedBatch(model: string, inputs: string[]): Promise<number[][] | null> {
  const res = await fetch(`${OLLAMA_BASE_URL}/v1/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: inputs }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { data?: { embedding?: number[] }[] };
  const embeddings = data.data?.map((d) => d.embedding).filter((e): e is number[] => !!e);
  return embeddings && embeddings.length === inputs.length ? embeddings : null;
}

// Resolves to null when Ollama embedding shouldn't run right now: a cloud
// key already covers it (OpenAI/Google stay the priority path, unchanged),
// or no local embedding model has been picked in Settings.
async function resolveOllamaModel(): Promise<string | null> {
  const { ollamaModel } = useEmbeddingStore.getState();
  if (!ollamaModel) return null;
  if (await hasCloudEmbedder()) return null;
  return ollamaModel;
}

// Embeds the user's chat question in the browser (the server can't reach
// localhost Ollama), for use as a precomputed query vector against
// Ollama-tagged memory. Cheap no-op (single fast check) in the common case
// where a cloud embedding key is already saved.
export async function embedQueryClientSide(
  text: string,
): Promise<{ embedding: number[]; tag: string } | null> {
  if (!text.trim()) return null;
  const model = await resolveOllamaModel();
  if (!model) return null;
  const [embedding] = (await embedBatch(model, [text])) ?? [];
  return embedding ? { embedding, tag: ollamaTag(model) } : null;
}

// Chunks + embeds + stores one piece of content (a note, a log entry, a
// chat exchange) via Ollama. Purely additive alongside the existing
// server-side indexContent() call for the same content: that one already
// no-ops safely when no cloud key exists, so there's no double-write risk
// -- at most one of {cloud, ollama} ever actually produces rows, since this
// only runs when hasCloudEmbedder() is false.
export async function indexClientSide(
  projectId: string,
  sourceType: "chat" | "document" | "note" | "log" | "link",
  sourceId: string,
  text: string,
): Promise<void> {
  try {
    const model = await resolveOllamaModel();
    if (!model) return;

    const chunks = chunkText(text);
    if (chunks.length === 0) return;

    const embeddings = await embedBatch(model, chunks);
    if (!embeddings) return;

    await storeEmbeddedChunks(projectId, sourceType, sourceId, ollamaTag(model), chunks, embeddings);
  } catch (err) {
    console.error("Ollama embedding failed (non-fatal):", err);
  }
}
