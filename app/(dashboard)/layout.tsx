import { ResizableShell } from "@/components/dashboard/resizable-shell";
import { sql } from "@/lib/db";
import type { Project } from "@/types/project";

// Project list is live DB data mutated by server actions -- never prerender.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const projects = await sql<Project[]>`
    select id, name from projects order by created_at desc
  `;

  return <ResizableShell projects={projects}>{children}</ResizableShell>;
}
