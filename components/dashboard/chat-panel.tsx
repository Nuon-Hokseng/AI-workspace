"use client";

import { getOrCreateSession } from "@/app/(dashboard)/chat-actions";
import { ChatSession } from "@/components/dashboard/chat-session";
import { QueryError } from "@/components/dashboard/query-error";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjectQuery } from "@/lib/hooks/use-project-query";
import { useProjectStore } from "@/lib/store/project-store";

// One chat per project -- no session selector, no "New Chat": switching
// projects just loads (or creates) that project's one session.
export function ChatPanel() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const { state, refetch } = useProjectQuery(activeProjectId, getOrCreateSession);

  if (!activeProjectId) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Select a project to start chatting.
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <QueryError onRetry={refetch} error={state.error} />
      </div>
    );
  }

  if (state.status !== "ready") {
    return (
      <div className="flex h-full flex-col gap-2 p-4">
        <Skeleton className="ml-auto h-10 w-2/3" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="ml-auto h-10 w-1/2" />
      </div>
    );
  }

  return (
    <ChatSession key={state.data.id} projectId={activeProjectId} session={state.data} />
  );
}
