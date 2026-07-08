"use server";

import { sql } from "@/lib/db";
import { indexContent } from "@/lib/rag";

export type NoteRow = {
  id: string;
  meeting_date: string | null;
  content: string;
  updated_at: Date;
};

export async function getNotes(projectId: string): Promise<NoteRow[]> {
  return sql<NoteRow[]>`
    select id, meeting_date::text as meeting_date, content, updated_at
    from project_notes
    where project_id = ${projectId}
    order by meeting_date desc nulls last, created_at desc
  `;
}

export async function createNote(
  projectId: string,
  meetingDate: string,
  content: string,
) {
  const trimmed = content.trim();
  if (!trimmed) return;
  const [note] = await sql<{ id: string }[]>`
    insert into project_notes (project_id, meeting_date, content)
    values (${projectId}, ${meetingDate || null}, ${trimmed})
    returning id
  `;
  await indexNoteSafely(projectId, note.id, trimmed);
}

export async function updateNote(
  id: string,
  projectId: string,
  meetingDate: string,
  content: string,
) {
  const trimmed = content.trim();
  if (!trimmed) return;
  await sql`
    update project_notes
    set meeting_date = ${meetingDate || null}, content = ${trimmed}
    where id = ${id}
  `;
  await indexNoteSafely(projectId, id, trimmed);
}

// Notes get re-saved in place (unlike documents/chat, which are
// append-only), so re-indexing has to clear this note's old chunks first
// -- otherwise every edit would pile on more stale embeddings forever.
async function indexNoteSafely(projectId: string, noteId: string, content: string) {
  try {
    await sql`
      delete from memory_embeddings where source_type = 'note' and source_id = ${noteId}
    `;
    await indexContent({ projectId, sourceType: "note", sourceId: noteId, text: content });
  } catch (err) {
    console.error("Note indexing failed (non-fatal):", err);
  }
}

export async function deleteNote(id: string) {
  await sql`delete from project_notes where id = ${id}`;
}
