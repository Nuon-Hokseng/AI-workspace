"use server";

import { sql } from "@/lib/db";
import { ingestDocument } from "@/app/(dashboard)/extract-actions";

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

  // Extraction, indexing, and link harvesting are side effects -- a
  // malformed file or missing key never fails the upload itself.
  await ingestDocument(projectId, doc.id, buffer, file.type || null);
}

export async function deleteDocument(id: string) {
  await sql`delete from project_documents where id = ${id}`;
}
