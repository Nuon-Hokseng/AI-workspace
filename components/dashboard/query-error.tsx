"use client";

import { AlertCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

function errorMessage(error: unknown): string | null {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return null;
}

// Shown instead of a fetch's data on failure -- never falls back to
// rendering stale/previous data, and never silently shows nothing. Surfaces
// the actual error text (single-tenant app, no other user's data to worry
// about leaking) rather than a generic message that can't be debugged from.
export function QueryError({ onRetry, error }: { onRetry: () => void; error?: unknown }) {
  const detail = errorMessage(error);
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-center text-sm">
      <AlertCircle className="size-5 text-destructive" />
      <p className="text-destructive">Couldn&apos;t load this.</p>
      {detail && <p className="font-mono text-xs text-muted-foreground">{detail}</p>}
      <Button size="sm" variant="outline" onClick={onRetry}>
        <RefreshCw className="size-3.5" />
        Retry
      </Button>
    </div>
  );
}
