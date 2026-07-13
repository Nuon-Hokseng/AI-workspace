import { create } from "zustand";
import { persist } from "zustand/middleware";

// Which locally-pulled Ollama model to use for embeddings, when no cloud
// embedding key (OpenAI/Google) is saved. Anthropic/xAI/Moonshot have no
// embeddings API at all -- Ollama is the only non-cloud option that does.
type EmbeddingStore = {
  ollamaModel: string;
  setOllamaModel: (model: string) => void;
};

export const useEmbeddingStore = create<EmbeddingStore>()(
  persist(
    (set) => ({
      ollamaModel: "",
      setOllamaModel: (ollamaModel) => set({ ollamaModel }),
    }),
    { name: "embedding-store" },
  ),
);
