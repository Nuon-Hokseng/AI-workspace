"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";

export async function createProject(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  await sql`insert into projects (name) values (${trimmed})`;
  revalidatePath("/dashboard");
}

export async function renameProject(id: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  await sql`update projects set name = ${trimmed} where id = ${id}`;
  revalidatePath("/dashboard");
}

export async function deleteProject(id: string) {
  await sql`delete from projects where id = ${id}`;
  revalidatePath("/dashboard");
}
