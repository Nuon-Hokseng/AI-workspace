"use client";

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { OLLAMA_BASE_URL, useOllamaStore } from "@/lib/store/ollama-store";

export function OllamaSection() {
  const { models, status, error, scan } = useOllamaStore();

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Local models run entirely on your machine.</p>
          <p className="text-xs text-muted-foreground">
            No API key needed -- this app talks to Ollama at {OLLAMA_BASE_URL} from your browser.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => scan()}
          disabled={status === "scanning"}
        >
          <RefreshCw className={status === "scanning" ? "size-4 animate-spin" : "size-4"} />
          Scan for local models
        </Button>
      </div>

      {status === "success" && models.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Ollama is running, but no models are installed. Try{" "}
          <code className="rounded bg-muted px-1">ollama pull llama3.2</code>.
        </p>
      )}

      {status === "success" && models.length > 0 && (
        <ul className="space-y-1">
          {models.map((model) => (
            <li key={model} className="rounded-md border px-2 py-1 text-sm">
              {model}
            </li>
          ))}
        </ul>
      )}

      {status === "error" && (
        <div className="space-y-2 rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
          <p>{error}</p>
          <p>
            Ollama runs on <strong>your own machine</strong> and blocks requests from other
            origins by default. Allow this app&apos;s origin, then restart Ollama:
          </p>
          <pre className="overflow-x-auto rounded bg-background/50 p-2 text-foreground">
            {typeof window !== "undefined"
              ? `OLLAMA_ORIGINS=${window.location.origin} ollama serve`
              : "OLLAMA_ORIGINS=<this app's URL> ollama serve"}
          </pre>
          <p>
            On Windows, set it permanently instead (then quit Ollama from the system tray and
            reopen it):
          </p>
          <pre className="overflow-x-auto rounded bg-background/50 p-2 text-foreground">
            {typeof window !== "undefined"
              ? `setx OLLAMA_ORIGINS "${window.location.origin}"`
              : `setx OLLAMA_ORIGINS "<this app's URL>"`}
          </pre>
          <p>
            Ollama must be installed on the device you&apos;re browsing from — a hosted app can
            only reach the Ollama sitting next to the browser, never one on another machine.{" "}
            <a
              href="https://github.com/ollama/ollama/blob/main/docs/faq.md#how-do-i-configure-ollama-server"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
            >
              Ollama docs
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
