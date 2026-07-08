// Best-effort text extraction for RAG indexing. Returns null for types we
// can't get text out of cheaply (images -- that would need OCR, well
// beyond "lightweight").
export async function extractText(buffer: Buffer, fileType: string | null): Promise<string | null> {
  if (!fileType) return null;

  if (fileType.startsWith("text/")) {
    return buffer.toString("utf-8");
  }

  if (fileType === "application/pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const { text } = await pdfParse(buffer);
    return text;
  }

  return null;
}
