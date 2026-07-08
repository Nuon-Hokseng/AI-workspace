"use server";

import { sql } from "@/lib/db";
import { extractText } from "@/lib/rag/extract-text";
import { indexContent } from "@/lib/rag";

export type DocumentRow = {
  id: string;
  name: string;
  file_type: string | null;
  created_at: Date;
};

export async function getDocuments(projectId: string): Promise<DocumentRow[]> {
  return sql<DocumentRow[]>`
    select id, name, file_type, created_at
    from project_documents
    where project_id = ${projectId}
    order by created_at desc
  `;
}

export async function uploadDocument(projectId: string, formData: FormData) {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return;

  const buffer = Buffer.from(await file.arrayBuffer());

  const [doc] = await sql<{ id: string }[]>`
    insert into project_documents (project_id, name, file_type, file_data)
    values (${projectId}, ${file.name}, ${file.type || null}, ${buffer})
    returning id
  `;

  // Text extraction/indexing is a side effect -- a malformed PDF or a
  // missing OpenAI key should never fail the upload itself.
  try {
    const text = await extractText(buffer, file.type || null);
    if (text) {
      await indexContent({
        projectId,
        sourceType: "document",
        sourceId: doc.id,
        text,
      });
    }
  } catch (err) {
    console.error("Document text extraction failed (non-fatal):", err);
  }
}

export async function deleteDocument(id: string) {
  await sql`delete from project_documents where id = ${id}`;
}
