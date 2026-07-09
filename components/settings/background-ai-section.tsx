"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  OLLAMA_PROVIDER_ID,
  OLLAMA_PROVIDER_LABEL,
  PROVIDERS,
} from "@/lib/llm/models";
import {
  useBackgroundAiStore,
  type BackgroundAiProvider,
} from "@/lib/store/background-ai-store";
import { useOllamaStore } from "@/lib/store/ollama-store";

export function BackgroundAiSection() {
  const { provider, model, setChoice } = useBackgroundAiStore();
  const ollamaModels = useOllamaStore((s) => s.models);

  return (
    <div className="space-y-3 rounded-md border p-3">
      <p className="text-xs text-muted-foreground">
        This model silently digests saved notes (links → Links tab, progress → Log tab,
        everything into that project&apos;s memory) and scores Team Performance. Cloud
        models use the matching API key saved above; Ollama runs locally with no key.
      </p>

      <div className="flex items-center justify-between gap-2">
        <span className="text-sm">Model</span>
        <Select
          value={provider === "off" ? "off" : `${provider}:${model}`}
          onValueChange={(value) => {
            if (value === "off") {
              setChoice("off", "");
              return;
            }
            // First colon only -- Ollama model ids are themselves "name:tag".
            const i = value.indexOf(":");
            setChoice(value.slice(0, i) as BackgroundAiProvider, value.slice(i + 1));
          }}
        >
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Pick a model" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="off">Off (no background AI)</SelectItem>
            {PROVIDERS.map((p) => (
              <SelectGroup key={p.id}>
                <SelectLabel>{p.label}</SelectLabel>
                {p.models.map((m) => (
                  <SelectItem key={m.id} value={`${p.id}:${m.id}`}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
            {ollamaModels.length > 0 && (
              <SelectGroup>
                <SelectLabel>{OLLAMA_PROVIDER_LABEL}</SelectLabel>
                {ollamaModels.map((m) => (
                  <SelectItem key={m} value={`${OLLAMA_PROVIDER_ID}:${m}`}>
                    {m}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
      </div>

      {ollamaModels.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Local models missing? Scan for them in the Ollama section below and they&apos;ll
          appear in this list.
        </p>
      )}
    </div>
  );
}
