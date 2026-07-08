// Cloud providers (server-held encrypted keys, routed through /api/chat)
// plus "ollama" (local, no key, calls the model directly from the
// browser -- see lib/llm/ollama-transport.ts).
export type CloudProviderId = "anthropic" | "openai" | "google" | "xai" | "moonshot";
export type ProviderId = CloudProviderId | "ollama";

export const OLLAMA_PROVIDER_ID = "ollama" as const;
export const OLLAMA_PROVIDER_LABEL = "Ollama (Local)";

export type ModelOption = {
  id: string;
  label: string;
};

export type ProviderOption = {
  id: CloudProviderId;
  label: string;
  models: ModelOption[];
};

// Hardcoded for now -- swap for a per-user configurable list once
// user-provided API keys land.
export const PROVIDERS: ProviderOption[] = [
  {
    id: "anthropic",
    label: "Claude",
    models: [
      { id: "claude-sonnet-5", label: "Sonnet" },
      { id: "claude-opus-4-8", label: "Opus" },
      { id: "claude-haiku-4-5-20251001", label: "Haiku" },
    ],
  },
  {
    id: "openai",
    label: "OpenAI",
    models: [
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-4o-mini", label: "GPT-4o mini" },
    ],
  },
  {
    id: "google",
    label: "Gemini",
    models: [
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
      { id: "gemini-2.0-pro", label: "Gemini 2.0 Pro" },
    ],
  },
  {
    id: "xai",
    label: "Grok",
    models: [{ id: "grok-2", label: "Grok 2" }],
  },
  {
    id: "moonshot",
    label: "Kimi",
    models: [{ id: "moonshot-v1-8k", label: "Moonshot v1 8k" }],
  },
];

export const DEFAULT_PROVIDER: ProviderId = "anthropic";
export const DEFAULT_MODEL = "claude-sonnet-5";

export function isKnownProvider(value: string): value is CloudProviderId {
  return PROVIDERS.some((p) => p.id === value);
}
