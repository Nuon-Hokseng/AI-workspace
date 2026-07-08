"use server";

import { sql } from "@/lib/db";

export type LinkRow = {
  id: string;
  url: string;
  label: string | null;
  created_at: Date;
};

export async function getLinks(projectId: string): Promise<LinkRow[]> {
  return sql<LinkRow[]>`
    select id, url, label, created_at
    from project_links
    where project_id = ${projectId}
    order by created_at desc
  `;
}

export async function createLink(projectId: string, url: string, label: string) {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) return;
  await sql`
    insert into project_links (project_id, url, label)
    values (${projectId}, ${trimmedUrl}, ${label.trim() || null})
  `;
}

export async function deleteLink(id: string) {
  await sql`delete from project_links where id = ${id}`;
}
