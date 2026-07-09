"use client";

import { useState, useTransition } from "react";
import { ExternalLink, Trash2 } from "lucide-react";

import { createLink, deleteLink, getLinks } from "@/app/(dashboard)/links-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListSkeleton } from "@/components/dashboard/list-skeleton";
import { QueryError } from "@/components/dashboard/query-error";
import { useProjectQuery } from "@/lib/hooks/use-project-query";

export function LinksTab({ projectId }: { projectId: string | null }) {
  const { state, refetch } = useProjectQuery(projectId, getLinks);
  const [isPending, startTransition] = useTransition();
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");

  function handleAdd() {
    if (!projectId || !url.trim()) return;
    startTransition(async () => {
      await createLink(projectId, url, label);
      setUrl("");
      setLabel("");
      refetch();
    });
  }

  if (!projectId) {
    return <p className="text-sm text-muted-foreground">Select a project to see its links.</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="shrink-0 space-y-2">
        <Input
          placeholder="https://…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Input
          placeholder="Label (optional)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <Button size="sm" disabled={isPending || !url.trim()} onClick={handleAdd}>
          Add link
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
      {state.status === "loading" && <ListSkeleton />}

      {state.status === "error" && <QueryError onRetry={refetch} error={state.error} />}

      {state.status === "ready" && state.data.length === 0 && (
        <p className="text-sm text-muted-foreground">No links yet.</p>
      )}

      {state.status === "ready" && state.data.length > 0 && (
        <ul className="space-y-1">
          {state.data.map((link) => (
            <li
              key={link.id}
              className="flex items-center gap-2 rounded-md border p-2 text-sm"
            >
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 flex-1 items-center gap-1 truncate underline underline-offset-4"
              >
                <ExternalLink className="size-3.5 shrink-0" />
                <span className="truncate">{link.label || link.url}</span>
              </a>
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                onClick={() =>
                  startTransition(async () => {
                    await deleteLink(link.id);
                    refetch();
                  })
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      </div>
    </div>
  );
}
