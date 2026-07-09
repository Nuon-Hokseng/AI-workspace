"use server";

import { generateText } from "ai";
import { sql } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import {
  buildTeamPrompt,
  parseTeamAnalysis,
  type MemberAssessment,
} from "@/lib/extract";
import { getModel } from "@/lib/llm/providers";

export type MemberSkills = {
  overall: number;
  summary: string | null;
  skills: Record<string, number>;
};

export type MemberRow = {
  id: string;
  name: string;
  skills: MemberSkills | null;
  analyzed_at: Date | null;
};

export async function getMembers(projectId: string): Promise<MemberRow[]> {
  return sql<MemberRow[]>`
    select id, name, skills, analyzed_at
    from project_members
    where project_id = ${projectId}
    order by created_at asc
  `;
}

export async function addMember(projectId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  await sql`
    insert into project_members (project_id, name) values (${projectId}, ${trimmed})
  `;
}

export async function deleteMember(id: string) {
  await sql`delete from project_members where id = ${id}`;
}

// Everything the analysis judges from: recent logs, notes, and the user's
// own chat messages (decrypted in memory only). Capped so the prompt stays
// a sane size regardless of project age.
const CORPUS_CHAR_CAP = 12000;

export async function getPerformanceCorpus(projectId: string): Promise<string> {
  const logs = await sql<{ entry: string }[]>`
    select entry from project_logs
    where project_id = ${projectId} order by created_at desc limit 100
  `;
  const notes = await sql<{ content: string }[]>`
    select content from project_notes
    where project_id = ${projectId} order by created_at desc limit 30
  `;
  const chats = await sql<{ content: string }[]>`
    select content from chat_messages
    where project_id = ${projectId} and role = 'user'
    order by created_at desc limit 100
  `;

  const corpus = [
    "WORK LOGS:",
    ...logs.map((l) => `- ${l.entry}`),
    "\nMEETING NOTES:",
    ...notes.map((n) => `- ${n.content}`),
    "\nCHAT MESSAGES:",
    ...chats.map((c) => `- ${decrypt(c.content)}`),
  ].join("\n");

  return corpus.slice(0, CORPUS_CHAR_CAP);
}

// Write one assessment per member, matched by name (case-insensitive).
// Called by both the Gemini path below and the browser-side Ollama path.
export async function saveTeamAnalysis(projectId: string, assessments: MemberAssessment[]) {
  for (const a of assessments) {
    const skills: MemberSkills = { overall: a.overall, summary: a.summary, skills: a.skills };
    await sql`
      update project_members
      set skills = ${sql.json(skills)}, analyzed_at = now()
      where project_id = ${projectId} and lower(name) = ${a.name.toLowerCase()}
    `;
  }
}

// Same model and silence rules as note extraction: no key or a bad
// response just means nothing gets updated.
const ANALYSIS_MODEL = "gemini-2.0-flash";

export async function analyzeTeamCloud(projectId: string) {
  try {
    const members = await getMembers(projectId);
    if (members.length === 0) return;

    const [savedKey] = await sql<{ encrypted_key: string }[]>`
      select encrypted_key from api_keys where provider = 'google'
    `;
    if (!savedKey) return;

    const corpus = await getPerformanceCorpus(projectId);
    const { text } = await generateText({
      model: getModel("google", ANALYSIS_MODEL, decrypt(savedKey.encrypted_key)),
      prompt: buildTeamPrompt(members.map((m) => m.name), corpus),
    });
    await saveTeamAnalysis(projectId, parseTeamAnalysis(text));
  } catch (err) {
    console.error("Team analysis failed (non-fatal):", err);
  }
}
