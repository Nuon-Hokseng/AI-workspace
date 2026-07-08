"use server";

import { sql } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";
import { DEFAULT_MODEL, DEFAULT_PROVIDER, OLLAMA_PROVIDER_ID, type ProviderId } from "@/lib/llm/models";
import { indexContent, searchMemory } from "@/lib/rag";

const MIN_CHARS_TO_INDEX = 400;

// Ollama runs the model call client-side, but the vector search and the
// OpenAI embedding key both have to stay server-side -- this is the Server
// Action lib/llm/ollama-transport.ts calls before it builds the message
// list to send to Ollama.
export async function getRelevantContext(projectId: string, queryText: string): Promise<string[]> {
  return searchMemory(projectId, queryText);
}

export type ChatSessionRow = {
  id: string;
  title: string | null;
  provider: ProviderId | null;
  model: string | null;
  created_at: Date;
};

// One session per project (enforced by a unique constraint on project_id).
// Race-safe: the no-op update on conflict always returns exactly one row,
// whether this call created it or a concurrent one beat it here.
export async function getOrCreateSession(projectId: string): Promise<ChatSessionRow> {
  const [session] = await sql<ChatSessionRow[]>`
    insert into chat_sessions (project_id, title, provider, model)
    values (${projectId}, 'Chat', ${DEFAULT_PROVIDER}, ${DEFAULT_MODEL})
    on conflict (project_id) do update set project_id = excluded.project_id
    returning id, title, provider, model, created_at
  `;
  return session;
}

// Ollama's model call happens client-side (see lib/llm/ollama-transport.ts),
// so unlike cloud providers -- whose exchanges are saved server-side in
// /api/chat's onFinish -- this is called from the client after the stream
// finishes. Mirrors that same save shape so history/model_used stay
// consistent regardless of which path a message came through.
export async function saveOllamaExchange(
  sessionId: string,
  projectId: string,
  userText: string,
  assistantText: string,
  model: string,
  tokensUsed: number | null,
) {
  await sql`
    insert into chat_messages (session_id, project_id, role, content)
    values (${sessionId}, ${projectId}, 'user', ${encrypt(userText)})
  `;
  const [assistantMessage] = await sql<{ id: string }[]>`
    insert into chat_messages (session_id, project_id, role, content, model_used, tokens_used)
    values (${sessionId}, ${projectId}, 'assistant', ${encrypt(assistantText)}, ${`${OLLAMA_PROVIDER_ID}:${model}`}, ${tokensUsed})
    returning id
  `;
  await sql`
    update chat_sessions
    set provider = ${OLLAMA_PROVIDER_ID}, model = ${model}
    where id = ${sessionId} and project_id = ${projectId}
  `;

  const exchangeText = `${userText}\n\n${assistantText}`;
  if (exchangeText.length >= MIN_CHARS_TO_INDEX) {
    try {
      await indexContent({
        projectId,
        sourceType: "chat",
        sourceId: assistantMessage.id,
        text: exchangeText,
      });
    } catch (err) {
      console.error("Chat indexing failed (non-fatal):", err);
    }
  }
}

export type ChatMessageRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  document_id: string | null;
  document_name: string | null;
  document_file_type: string | null;
  created_at: Date;
};

// Scoped by BOTH session_id and project_id -- a session id alone is never
// enough to trust, since a session only ever belongs to one project.
export async function getMessages(
  sessionId: string,
  projectId: string,
): Promise<ChatMessageRow[]> {
  const rows = await sql<ChatMessageRow[]>`
    select
      m.id,
      m.role,
      m.content,
      m.document_id,
      d.name as document_name,
      d.file_type as document_file_type,
      m.created_at
    from chat_messages m
    left join project_documents d on d.id = m.document_id
    where m.session_id = ${sessionId} and m.project_id = ${projectId}
    order by m.created_at asc
  `;
  return rows.map((row) => ({ ...row, content: decrypt(row.content) }));
}
