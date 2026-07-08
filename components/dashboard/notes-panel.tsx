"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";

import {
  createNote,
  deleteNote,
  getNotes,
  updateNote,
  type NoteRow,
} from "@/app/(dashboard)/notes-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ListSkeleton } from "@/components/dashboard/list-skeleton";
import { QueryError } from "@/components/dashboard/query-error";
import { useProjectQuery } from "@/lib/hooks/use-project-query";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function NotesPanel({ projectId }: { projectId: string | null }) {
  const { state, refetch } = useProjectQuery(projectId, getNotes);
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [meetingDate, setMeetingDate] = useState(todayIsoDate());
  const [content, setContent] = useState("");

  function resetEditor() {
    setEditingId(null);
    setMeetingDate(todayIsoDate());
    setContent("");
  }

  function startEdit(note: NoteRow) {
    setEditingId(note.id);
    setMeetingDate(note.meeting_date ?? todayIsoDate());
    setContent(note.content);
  }

  function handleSave() {
    if (!projectId || !content.trim()) return;
    startTransition(async () => {
      if (editingId) {
        await updateNote(editingId, projectId, meetingDate, content);
      } else {
        await createNote(projectId, meetingDate, content);
      }
      resetEditor();
      refetch();
    });
  }

  if (!projectId) {
    return (
      <div className="border-t p-3">
        <h3 className="mb-2 text-sm font-semibold">Notes</h3>
        <p className="text-sm text-muted-foreground">
          Select a project to see its meeting notes.
        </p>
      </div>
    );
  }

  return (
    <div className="border-t p-3">
      <h3 className="mb-2 text-sm font-semibold">Notes</h3>

      <div className="space-y-2">
        <Input
          type="date"
          value={meetingDate}
          onChange={(e) => setMeetingDate(e.target.value)}
        />
        <Textarea
          placeholder="Meeting notes…"
          rows={4}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <div className="flex gap-2">
          <Button size="sm" disabled={isPending || !content.trim()} onClick={handleSave}>
            {editingId ? "Update note" : "Save note"}
          </Button>
          {editingId && (
            <Button size="sm" variant="ghost" onClick={resetEditor}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-1">
        {state.status === "loading" && <ListSkeleton />}

        {state.status === "error" && <QueryError onRetry={refetch} error={state.error} />}

        {state.status === "ready" && state.data.length === 0 && (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        )}

        {state.status === "ready" &&
          state.data.map((note) => (
            <div key={note.id} className="rounded-md border p-2 text-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {note.meeting_date ?? "No date"}
                </p>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-6"
                    onClick={() => startEdit(note)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-6"
                    onClick={() =>
                      startTransition(async () => {
                        await deleteNote(note.id);
                        if (editingId === note.id) resetEditor();
                        refetch();
                      })
                    }
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
              <p className="whitespace-pre-wrap break-words">{note.content}</p>
            </div>
          ))}
      </div>
    </div>
  );
}
