"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEmbeddingStore } from "@/lib/store/embedding-store";
import { useOllamaStore } from "@/lib/store/ollama-store";

export function EmbeddingSection() {
  const { ollamaModel, setOllamaModel } = useEmbeddingStore();
  const ollamaModels = useOllamaStore((s) => s.models);

  return (
    <div className="space-y-3 rounded-md border p-3">
      <p className="text-xs text-muted-foreground">
        Project memory (semantic search over notes, logs, documents, links, and chat)
        needs an embedding model. OpenAI or Google keys above are used automatically if
        saved. Without either, pick a local Ollama <strong>embedding</strong> model here
        (not a chat model -- e.g. <code className="rounded bg-muted px-1">nomic-embed-text</code>,
        pulled separately with <code className="rounded bg-muted px-1">ollama pull nomic-embed-text</code>).
        Anthropic, xAI, and Moonshot don&apos;t offer an embeddings API, so they can&apos;t
        power memory directly regardless of this setting.
      </p>

      <div className="flex items-center justify-between gap-2">
        <span className="text-sm">Ollama embedding model</span>
        {ollamaModels.length > 0 ? (
          <Select value={ollamaModel} onValueChange={setOllamaModel}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="None selected" />
            </SelectTrigger>
            <SelectContent>
              {ollamaModels.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs text-muted-foreground">
            Scan for local models in the Ollama section below first.
          </span>
        )}
      </div>
    </div>
  );
}
