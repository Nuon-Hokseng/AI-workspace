"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

import { createLog, deleteLog, getLogs } from "@/app/(dashboard)/logs-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListSkeleton } from "@/components/dashboard/list-skeleton";
import { QueryError } from "@/components/dashboard/query-error";
import { useProjectQuery } from "@/lib/hooks/use-project-query";

export function LogTab({ projectId }: { projectId: string | null }) {
  const { state, refetch } = useProjectQuery(projectId, getLogs);
  const [isPending, startTransition] = useTransition();
  const [entry, setEntry] = useState("");

  function handleAdd() {
    if (!projectId || !entry.trim()) return;
    startTransition(async () => {
      await createLog(projectId, entry);
      setEntry("");
      refetch();
    });
  }

  if (!projectId) {
    return <p className="text-sm text-muted-foreground">Select a project to see its log.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          placeholder="Log entry"
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <Button size="sm" disabled={isPending || !entry.trim()} onClick={handleAdd}>
          Add entry
        </Button>
      </div>

      {state.status === "loading" && <ListSkeleton />}

      {state.status === "error" && <QueryError onRetry={refetch} error={state.error} />}

      {state.status === "ready" && state.data.length === 0 && (
        <p className="text-sm text-muted-foreground">No entries yet.</p>
      )}

      {state.status === "ready" && state.data.length > 0 && (
        <ul className="space-y-1">
          {state.data.map((log) => (
            <li
              key={log.id}
              className="flex items-start gap-2 rounded-md border p-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">
                  {log.created_at.toLocaleString()}
                </p>
                <p className="break-words">{log.entry}</p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                onClick={() =>
                  startTransition(async () => {
                    await deleteLog(log.id);
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
  );
}
