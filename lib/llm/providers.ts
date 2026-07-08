import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createXai } from "@ai-sdk/xai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import type { CloudProviderId } from "@/lib/llm/models";

// Cloud providers only -- Ollama never reaches the server, so it never
// reaches this function either (see lib/llm/ollama-transport.ts).
// Pure and key-agnostic on purpose: the caller resolves which API key to
// use (decrypted from the api_keys table) and passes it in here.
export function getModel(
  provider: CloudProviderId,
  modelId: string,
  apiKey: string,
): LanguageModel {
  switch (provider) {
    case "anthropic":
      return createAnthropic({ apiKey })(modelId);
    case "openai":
      return createOpenAI({ apiKey })(modelId);
    case "google":
      return createGoogleGenerativeAI({ apiKey })(modelId);
    case "xai":
      return createXai({ apiKey })(modelId);
    case "moonshot":
      return createOpenAICompatible({
        name: "moonshot",
        baseURL: "https://api.moonshot.cn/v1",
        apiKey,
      })(modelId);
    default:
      provider satisfies never;
      throw new Error(`Unknown provider: ${provider}`);
  }
}
