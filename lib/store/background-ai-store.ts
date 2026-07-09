import { create } from "zustand";
import { persist } from "zustand/middleware";

// Which model silently digests saved notes in the background (extracting
// links + work-progress log entries). Mirrors the chat split: Gemini runs
// server-side with the saved API key, Ollama runs from the browser.
export type BackgroundAiProvider = "google" | "ollama" | "off";

type BackgroundAiStore = {
  provider: BackgroundAiProvider;
  ollamaModel: string;
  setProvider: (provider: BackgroundAiProvider) => void;
  setOllamaModel: (model: string) => void;
};

export const useBackgroundAiStore = create<BackgroundAiStore>()(
  persist(
    (set) => ({
      provider: "google",
      ollamaModel: "",
      setProvider: (provider) => set({ provider }),
      setOllamaModel: (ollamaModel) => set({ ollamaModel }),
    }),
    { name: "background-ai-store" },
  ),
);
