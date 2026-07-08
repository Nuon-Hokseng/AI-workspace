import { create } from "zustand";
import { persist } from "zustand/middleware";

export const OLLAMA_BASE_URL = "http://localhost:11434";

type ScanStatus = "idle" | "scanning" | "success" | "error";

type OllamaStore = {
  models: string[];
  status: ScanStatus;
  error: string | null;
  scan: () => Promise<void>;
};

// Persisted so the chat model picker still shows last-known local models
// without forcing a re-scan every time the app loads.
export const useOllamaStore = create<OllamaStore>()(
  persist(
    (set) => ({
      models: [],
      status: "idle",
      error: null,
      scan: async () => {
        set({ status: "scanning", error: null });
        try {
          const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
          if (!res.ok) throw new Error(`Ollama responded with ${res.status}`);
          const data = (await res.json()) as { models?: { name: string }[] };
          set({
            status: "success",
            models: (data.models ?? []).map((m) => m.name),
            error: null,
          });
        } catch {
          // Almost always either Ollama isn't running, or it's running but
          // rejecting cross-origin requests from this app's origin.
          set({
            status: "error",
            error:
              "Couldn't reach Ollama at localhost:11434. Make sure it's running and allows requests from this app's origin (see below).",
          });
        }
      },
    }),
    { name: "ollama-store", partialize: (state) => ({ models: state.models }) },
  ),
);
