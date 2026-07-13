import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  convertToModelMessages,
  isTextUIPart,
  streamText,
  type ChatTransport,
  type ModelMessage,
  type UIMessage,
} from "ai";
import {
  getRelevantContext,
  getSessionSummaryState,
  saveOllamaExchange,
  updateSessionSummary,
} from "@/app/(dashboard)/chat-actions";
import { embedQueryClientSide, indexClientSide } from "@/lib/embed-client";
import { formatStreamError } from "@/lib/llm/format-error";
import { planCompaction, summarizeHistory } from "@/lib/llm/history-compact";
import { buildMemorySystemPrompt } from "@/lib/llm/memory-prompt";
import { OLLAMA_BASE_URL } from "@/lib/store/ollama-store";

const MIN_CHARS_TO_INDEX = 400;

function uiMessageText(message: UIMessage): string {
  return message.parts.filter(isTextUIPart).map((p) => p.text).join("\n");
}

// Ollama runs on the user's own machine. Our server (Railway) has no way
// to reach someone's localhost:11434 -- there's no tunnel, no shared
// network. So unlike every other provider, this transport never calls
// /api/chat at all: it runs entirely in the browser, using the same AI SDK
// primitives our server would, just talking to Ollama's OpenAI-compatible
// endpoint directly over the user's own local network.
//
// The vector search and the OpenAI embedding key both have to stay
// server-side though, so RAG retrieval and message persistence happen via
// Server Actions (getRelevantContext, saveOllamaExchange) called from
// here -- inside streamText's own onFinish, same as /api/chat does, so
// `usage` (for tokens_used) is available in the same place `text` is.
export function createOllamaTransport(
  modelId: string,
  context: { projectId: string; sessionId: string },
): ChatTransport<UIMessage> {
  const ollama = createOpenAICompatible({
    name: "ollama",
    baseURL: `${OLLAMA_BASE_URL}/v1`,
    // Ollama doesn't check this, but the OpenAI-compatible client requires
    // some value to be set.
    apiKey: "ollama",
  });

  const model = ollama(modelId);

  return {
    async sendMessages({ messages, abortSignal }) {
      const lastMessage = messages[messages.length - 1];
      const userText = uiMessageText(lastMessage);

      // Same unbounded-history problem as the cloud path, same fix: only
      // the tail since the compaction watermark is sent raw, older turns
      // live in a running summary. `messages` here already mirrors the DB
      // (every prior exchange was persisted), so no extra fetch is needed
      // for the raw side -- just the watermark itself.
      const priorMessages = messages.slice(0, -1);
      const { summary: savedSummary, summarizedCount } = await getSessionSummaryState(
        context.sessionId,
        context.projectId,
      );
      const tail = priorMessages.slice(summarizedCount);

      let rawTail = tail;
      let historySummary = savedSummary;
      const { toFold, rawTail: keptTail } = planCompaction(tail);
      if (toFold.length > 0) {
        try {
          const newSummary = await summarizeHistory(
            model,
            savedSummary,
            toFold.map((m) => ({ role: m.role as "user" | "assistant", content: uiMessageText(m) })),
          );
          await updateSessionSummary(context.sessionId, context.projectId, newSummary, summarizedCount + toFold.length);
          historySummary = newSummary;
          rawTail = keptTail;
        } catch (err) {
          console.error("History compaction failed (non-fatal):", err);
        }
      }

      // Precompute the query embedding here (browser -> localhost) when no
      // cloud embedding key exists -- the server side of this project
      // can't reach Ollama itself, only the browser can. Cheap no-op when
      // a cloud key already covers embeddings.
      const precomputed = await embedQueryClientSide(userText);
      const relevantChunks = await getRelevantContext(context.projectId, userText, precomputed ?? undefined);
      const modelMessages: ModelMessage[] = await convertToModelMessages([...rawTail, lastMessage]);

      const result = streamText({
        model,
        // AI SDK v7: system text must go in `instructions`, not a system message
        instructions: buildMemorySystemPrompt(relevantChunks, historySummary),
        messages: modelMessages,
        // Without this, the Stop button only stops rendering -- Ollama
        // would keep generating on the user's machine until done.
        abortSignal,
        onFinish: async ({ text, usage }) => {
          if (!text.trim()) return;
          await saveOllamaExchange(
            context.sessionId,
            context.projectId,
            userText,
            text,
            modelId,
            usage.totalTokens ?? null,
          );

          const exchangeText = `${userText}\n\n${text}`;
          if (exchangeText.length >= MIN_CHARS_TO_INDEX) {
            void indexClientSide(context.projectId, "chat", crypto.randomUUID(), exchangeText);
          }
        },
      });
      return result.toUIMessageStream({ onError: formatStreamError });
    },
    async reconnectToStream() {
      return null;
    },
  };
}
