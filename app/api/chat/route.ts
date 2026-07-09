import {
  getTextFromDataUrl,
  isFileUIPart,
  isTextUIPart,
  streamText,
  type ModelMessage,
  type UIMessage,
} from "ai";
import { sql } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";
import { formatStreamError } from "@/lib/llm/format-error";
import { isKnownProvider, PROVIDERS } from "@/lib/llm/models";
import { getModel } from "@/lib/llm/providers";
import { indexContent, searchMemory } from "@/lib/rag";
import { harvestChatLinks } from "@/app/(dashboard)/extract-actions";
import { buildMemorySystemPrompt } from "@/lib/llm/memory-prompt";

// Below this, an exchange isn't worth spending an embedding call on.
const MIN_CHARS_TO_INDEX = 400;

export const maxDuration = 60;

export async function POST(req: Request) {
  const { projectId, sessionId, messages, provider, model } = (await req.json()) as {
    projectId?: string;
    sessionId?: string;
    messages?: UIMessage[];
    provider?: string;
    model?: string;
  };

  if (!projectId || !sessionId || !messages?.length || !provider || !model) {
    return new Response(
      "projectId, sessionId, messages, provider, and model are required",
      { status: 400 },
    );
  }

  if (!isKnownProvider(provider)) {
    return new Response(`Unknown provider: ${provider}`, { status: 400 });
  }

  const [savedKey] = await sql<{ encrypted_key: string }[]>`
    select encrypted_key from api_keys where provider = ${provider}
  `;
  if (!savedKey) {
    const providerLabel = PROVIDERS.find((p) => p.id === provider)?.label ?? provider;
    return new Response(
      `No API key set for ${providerLabel} — add one in Settings`,
      { status: 400 },
    );
  }
  const apiKey = decrypt(savedKey.encrypted_key);

  // The one guard standing between "chat scoped to a project" and another
  // project's history leaking into context: a session only ever belongs to
  // one project, so this must hold before anything else happens.
  const [session] = await sql<{ id: string }[]>`
    select id from chat_sessions
    where id = ${sessionId} and project_id = ${projectId}
  `;
  if (!session) {
    return new Response("Session not found for this project", { status: 404 });
  }

  // Prior context is always rebuilt from the DB, scoped by BOTH ids -- the
  // client-sent `messages` array is only ever used below for the newest
  // turn's content, never trusted as a source of history.
  const historyRows = await sql<{ role: "user" | "assistant"; content: string }[]>`
    select role, content
    from chat_messages
    where session_id = ${sessionId} and project_id = ${projectId}
    order by created_at asc
  `;
  // content is encrypted at rest -- decrypted only in memory, for this request.
  const history = historyRows.map((m) => ({ role: m.role, content: decrypt(m.content) }));

  const lastMessage = messages[messages.length - 1];
  const userText = lastMessage.parts.filter(isTextUIPart).map((p) => p.text).join("\n");
  const filePart = lastMessage.parts.find(isFileUIPart);

  let attachment: { mediaType: string; base64: string } | null = null;
  if (filePart) {
    attachment = {
      mediaType: filePart.mediaType,
      base64: getTextFromDataUrl(filePart.url),
    };
  }

  const currentMessage: ModelMessage = attachment
    ? {
        role: "user",
        content: [
          { type: "text", text: userText },
          {
            type: "file",
            mediaType: attachment.mediaType,
            filename: filePart?.filename,
            data: attachment.base64,
          },
        ],
      }
    : { role: "user", content: userText };

  // Per-project memory: top matches for the current message, prepended as
  // context. searchMemory returns [] whenever RAG isn't usable (no OpenAI
  // key saved, embedding call failed, etc) rather than throwing -- this is
  // an enrichment step, not a requirement for sending a message.
  const relevantChunks = await searchMemory(projectId, userText);

  const modelMessages: ModelMessage[] = [
    ...history.map((m): ModelMessage => ({ role: m.role, content: m.content })),
    currentMessage,
  ];

  // Store the attachment alongside the Documents tool's own uploads, just
  // tagged by source, so it shows up in both places.
  let documentId: string | null = null;
  if (attachment) {
    const buffer = Buffer.from(attachment.base64, "base64");
    const [doc] = await sql<{ id: string }[]>`
      insert into project_documents (project_id, name, file_type, file_data, source)
      values (${projectId}, ${filePart?.filename ?? "upload"}, ${attachment.mediaType}, ${buffer}, 'chat')
      returning id
    `;
    documentId = doc.id;
  }

  const modelUsed = `${provider}:${model}`;

  const result = streamText({
    model: getModel(provider, model, apiKey),
    // AI SDK v7: system text must go in `instructions`, not a system
    // message (same as the Ollama transport).
    instructions: buildMemorySystemPrompt(relevantChunks),
    messages: modelMessages,
    onFinish: async ({ text, usage }) => {
      await sql`
        insert into chat_messages (session_id, project_id, role, content, document_id)
        values (${sessionId}, ${projectId}, 'user', ${encrypt(userText)}, ${documentId})
      `;
      const [assistantMessage] = await sql<{ id: string }[]>`
        insert into chat_messages (session_id, project_id, role, content, model_used, tokens_used)
        values (${sessionId}, ${projectId}, 'assistant', ${encrypt(text)}, ${modelUsed}, ${usage.totalTokens ?? null})
        returning id
      `;
      await sql`
        update chat_sessions
        set provider = ${provider}, model = ${model}
        where id = ${sessionId} and project_id = ${projectId}
      `;

      // URLs the user shared land in the Links tab automatically.
      await harvestChatLinks(projectId, userText);

      const exchangeText = `${userText}\n\n${text}`;
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
    },
  });

  return result.toUIMessageStreamResponse({ onError: formatStreamError });
}
