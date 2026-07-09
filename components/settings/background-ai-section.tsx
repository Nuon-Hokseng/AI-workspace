"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useBackgroundAiStore,
  type BackgroundAiProvider,
} from "@/lib/store/background-ai-store";
import { useOllamaStore } from "@/lib/store/ollama-store";

export function BackgroundAiSection() {
  const { provider, ollamaModel, setProvider, setOllamaModel } = useBackgroundAiStore();
  const ollamaModels = useOllamaStore((s) => s.models);

  return (
    <div className="space-y-3 rounded-md border p-3">
      <p className="text-xs text-muted-foreground">
        When you save a note, this model silently scans it and files what it finds:
        links go to the Links tab, work progress goes to the Log tab, and everything
        is remembered in that project&apos;s memory only. Gemini uses the API key saved
        above; Ollama runs locally with no key.
      </p>

      <div className="flex items-center justify-between gap-2">
        <span className="text-sm">Provider</span>
        <Select
          value={provider}
          onValueChange={(v) => setProvider(v as BackgroundAiProvider)}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="google">Gemini (cloud)</SelectItem>
            <SelectItem value="ollama">Ollama (local)</SelectItem>
            <SelectItem value="off">Off</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {provider === "ollama" && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm">Local model</span>
          {ollamaModels.length > 0 ? (
            <Select value={ollamaModel} onValueChange={setOllamaModel}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Pick a model" />
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
      )}
    </div>
  );
}
