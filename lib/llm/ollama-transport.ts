import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  convertToModelMessages,
  isTextUIPart,
  streamText,
  type ChatTransport,
  type ModelMessage,
  type UIMessage,
} from "ai";
import { getRelevantContext, saveOllamaExchange } from "@/app/(dashboard)/chat-actions";
import { formatStreamError } from "@/lib/llm/format-error";
import { OLLAMA_BASE_URL } from "@/lib/store/ollama-store";

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

  return {
    async sendMessages({ messages }) {
      const lastMessage = messages[messages.length - 1];
      const userText = lastMessage.parts.filter(isTextUIPart).map((p) => p.text).join("\n");

      const relevantChunks = await getRelevantContext(context.projectId, userText);
      const modelMessages: ModelMessage[] = [
        ...(relevantChunks.length > 0
          ? [
              {
                role: "system" as const,
                content: `Relevant context from this project's memory:\n\n${relevantChunks.join("\n\n---\n\n")}`,
              },
            ]
          : []),
        ...(await convertToModelMessages(messages)),
      ];

      const result = streamText({
        model: ollama(modelId),
        messages: modelMessages,
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
        },
      });
      return result.toUIMessageStream({ onError: formatStreamError });
    },
    async reconnectToStream() {
      return null;
    },
  };
}
