"use client";

import { useEffect, useState, useTransition } from "react";
import { Sparkles, Trash2 } from "lucide-react";

import {
  addMember,
  deleteMember,
  getMembers,
  type MemberRow,
} from "@/app/(dashboard)/team-actions";
import { runTeamAnalysis } from "@/lib/extract-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ListSkeleton } from "@/components/dashboard/list-skeleton";
import { QueryError } from "@/components/dashboard/query-error";
import { useProjectQuery } from "@/lib/hooks/use-project-query";
import { cn } from "@/lib/utils";

function SkillBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-0.5 flex justify-between text-sm">
        <span className="capitalize">{label}</span>
        <span className="text-muted-foreground">{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div
          className="skill-bar-fill h-full rounded-full bg-primary"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function OverallBadge({ overall }: { overall: number }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-xs font-semibold",
        overall >= 60
          ? "border-green-600/40 text-green-600 dark:text-green-500"
          : "text-muted-foreground",
      )}
    >
      {overall}%
    </span>
  );
}

export function TeamTab({
  projectId,
  active = false,
}: {
  projectId: string | null;
  active?: boolean;
}) {
  const { state, refetch } = useProjectQuery(projectId, getMembers);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisNote, setAnalysisNote] = useState<string | null>(null);
  const [detailMember, setDetailMember] = useState<MemberRow | null>(null);

  // Background analyses (after note digestion) update the DB while this
  // tab sits mounted-but-hidden -- pull fresh scores whenever it opens.
  useEffect(() => {
    if (active) refetch();
  }, [active, refetch]);

  if (!projectId) {
    return <p className="text-sm text-muted-foreground">Select a project to see its team.</p>;
  }

  function handleAdd() {
    if (!projectId || !name.trim()) return;
    startTransition(async () => {
      await addMember(projectId, name);
      setName("");
      refetch();
    });
  }

  function handleAnalyze() {
    if (!projectId || analyzing) return;
    setAnalyzing(true);
    setAnalysisNote(null);
    void runTeamAnalysis(projectId)
      .then((ran) => {
        if (!ran) {
          setAnalysisNote(
            "Analysis didn't run — check the Background AI setting in Settings (provider and, for Ollama, a model).",
          );
        }
        refetch();
      })
      .finally(() => setAnalyzing(false));
  }

  const members = state.status === "ready" ? state.data : [];

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="shrink-0 space-y-2">
        <div className="flex gap-2">
          <Input
            placeholder="Member name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <Button size="sm" disabled={isPending || !name.trim()} onClick={handleAdd}>
            Add
          </Button>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          disabled={analyzing || members.length === 0}
          onClick={handleAnalyze}
        >
          <Sparkles className={cn("size-3.5", analyzing && "animate-pulse")} />
          {analyzing ? "Analyzing from logs, notes & chat…" : "Analyze now"}
        </Button>
        {analysisNote && <p className="text-xs text-destructive">{analysisNote}</p>}
        <p className="text-xs text-muted-foreground">
          Scores refresh automatically when notes are digested. They&apos;re AI estimates
          from this project&apos;s logs, notes, and chat — mention members by name for
          better results.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        {state.status === "loading" && <ListSkeleton />}
        {state.status === "error" && <QueryError onRetry={refetch} error={state.error} />}
        {state.status === "ready" && members.length === 0 && (
          <p className="text-sm text-muted-foreground">No members yet — add your team above.</p>
        )}
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center gap-1 rounded-md border animate-in fade-in duration-300"
          >
            <button
              onClick={() => setDetailMember(member)}
              className="flex min-w-0 flex-1 items-center gap-2 p-2 text-left text-sm hover:bg-accent/50"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{member.name}</p>
                <p className="text-xs text-muted-foreground">
                  {member.skills ? `Overall ${member.skills.overall}%` : "Not analyzed yet"}
                </p>
              </div>
              {member.skills && <OverallBadge overall={member.skills.overall} />}
            </button>
            <Button
              size="icon"
              variant="ghost"
              className="mr-1 size-7 shrink-0"
              aria-label={`Remove ${member.name}`}
              onClick={() =>
                startTransition(async () => {
                  await deleteMember(member.id);
                  refetch();
                })
              }
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={detailMember !== null} onOpenChange={(open) => !open && setDetailMember(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detailMember?.name}
              {detailMember?.skills && <OverallBadge overall={detailMember.skills.overall} />}
            </DialogTitle>
          </DialogHeader>
          {detailMember?.skills ? (
            <div className="space-y-3">
              {detailMember.skills.summary && (
                <p className="text-sm text-muted-foreground">{detailMember.skills.summary}</p>
              )}
              <div className="space-y-2">
                {Object.entries(detailMember.skills.skills).map(([skill, value]) => (
                  <SkillBar key={skill} label={skill} value={value} />
                ))}
              </div>
              {detailMember.analyzed_at && (
                <p className="text-xs text-muted-foreground">
                  Last analyzed {detailMember.analyzed_at.toLocaleString()}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Not analyzed yet — save a note or click &quot;Analyze now&quot; to score this member.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
