"use server";

import { sql } from "@/lib/db";
import { scrapeAndIndexLink } from "@/app/(dashboard)/extract-actions";

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
  const [link] = await sql<{ id: string }[]>`
    insert into project_links (project_id, url, label)
    values (${projectId}, ${trimmedUrl}, ${label.trim() || null})
    returning id
  `;
  // Pull the page's content into project memory (non-fatal on failure).
  await scrapeAndIndexLink(projectId, link.id, trimmedUrl);
}

export async function deleteLink(id: string) {
  await sql`delete from project_links where id = ${id}`;
}
