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

  if (
    fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    fileType === "application/msword"
  ) {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  }

  if (
    fileType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    fileType === "application/vnd.ms-excel" ||
    fileType === "application/vnd.oasis.opendocument.spreadsheet"
  ) {
    // xlsx (SheetJS) reads xlsx/xls/ods uniformly -- installed from
    // SheetJS's own CDN, not the npm registry: the npm-published 0.18.5
    // has an unpatched prototype-pollution/ReDoS advisory, which matters
    // here since this parses untrusted user-uploaded files.
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer" });
    return workbook.SheetNames.map(
      (name) => `Sheet: ${name}\n${XLSX.utils.sheet_to_csv(workbook.Sheets[name])}`,
    ).join("\n\n");
  }

  return null;
}
