import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ApiKeysManager } from "@/components/settings/api-keys-manager";
import { BackgroundAiSection } from "@/components/settings/background-ai-section";
import { OllamaSection } from "@/components/settings/ollama-section";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-xl font-semibold">Settings</h1>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Appearance</h2>
        <div className="flex items-center justify-between rounded-md border p-3">
          <span className="text-sm">Theme</span>
          <ThemeToggle />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">API Keys</h2>
        <p className="text-xs text-muted-foreground">
          Keys are encrypted at rest and never shown in full once saved.
        </p>
        <ApiKeysManager />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Background AI</h2>
        <BackgroundAiSection />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Ollama (Local Models)</h2>
        <OllamaSection />
      </section>
    </div>
  );
}
