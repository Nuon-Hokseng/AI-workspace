// Rough estimate (~4 chars/token for English text) -- fine for sizing
// chunks, not used for anything billing-accurate.
const CHARS_PER_TOKEN = 4;
const CHUNK_TOKENS = 500;
const CHUNK_CHARS = CHUNK_TOKENS * CHARS_PER_TOKEN;

export function chunkText(text: string, chunkChars = CHUNK_CHARS): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const chunks: string[] = [];
  for (let i = 0; i < trimmed.length; i += chunkChars) {
    chunks.push(trimmed.slice(i, i + chunkChars));
  }
  return chunks;
}
