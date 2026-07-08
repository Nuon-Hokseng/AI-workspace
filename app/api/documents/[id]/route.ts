import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const [doc] = await sql<
    { name: string; file_type: string | null; file_data: Buffer | null }[]
  >`
    select name, file_type, file_data
    from project_documents
    where id = ${id}
  `;

  if (!doc || !doc.file_data) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(doc.file_data), {
    headers: {
      "Content-Type": doc.file_type || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.name)}"`,
    },
  });
}
