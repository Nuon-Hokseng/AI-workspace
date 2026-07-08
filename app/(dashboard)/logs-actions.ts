"use server";

import { sql } from "@/lib/db";

export type LogRow = {
  id: string;
  entry: string;
  created_at: Date;
};

export async function getLogs(projectId: string): Promise<LogRow[]> {
  return sql<LogRow[]>`
    select id, entry, created_at
    from project_logs
    where project_id = ${projectId}
    order by created_at desc
  `;
}

export async function createLog(projectId: string, entry: string) {
  const trimmed = entry.trim();
  if (!trimmed) return;
  await sql`insert into project_logs (project_id, entry) values (${projectId}, ${trimmed})`;
}

export async function deleteLog(id: string) {
  await sql`delete from project_logs where id = ${id}`;
}
