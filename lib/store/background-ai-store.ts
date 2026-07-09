import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ProviderId } from "@/lib/llm/models";

// Which model silently digests saved notes and runs team analysis in the
// background. Any chat provider works (cloud ones use the API key saved in
// Settings; Ollama runs from the browser), or "off" to disable.
export type BackgroundAiProvider = ProviderId | "off";

type BackgroundAiStore = {
  provider: BackgroundAiProvider;
  model: string;
  setChoice: (provider: BackgroundAiProvider, model: string) => void;
};

export const useBackgroundAiStore = create<BackgroundAiStore>()(
  persist(
    (set) => ({
      provider: "google",
      model: "gemini-2.0-flash",
      setChoice: (provider, model) => set({ provider, model }),
    }),
    {
      name: "background-ai-store",
      version: 1,
      // v0 stored { provider: "google" | "ollama" | "off", ollamaModel }.
      migrate: (persisted) => {
        const old = persisted as { provider?: string; ollamaModel?: string; model?: string };
        if (old?.model !== undefined) return old as BackgroundAiStore;
        return {
          provider: (old?.provider ?? "google") as BackgroundAiProvider,
          model: old?.provider === "ollama" ? (old.ollamaModel ?? "") : "gemini-2.0-flash",
        } as BackgroundAiStore;
      },
    },
  ),
);
