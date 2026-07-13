"use client";

import { useRef, useState, useTransition } from "react";
import { CalendarDays, Paperclip, Pencil, Trash2, VenetianMask } from "lucide-react";

import {
  createNote,
  deleteNote,
  getNotes,
  updateNote,
  type NoteRow,
} from "@/app/(dashboard)/notes-actions";
import { uploadDocument } from "@/app/(dashboard)/documents-actions";
import { runBackgroundExtraction, runTeamAnalysis } from "@/lib/extract-client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MonthCalendar } from "@/components/ui/month-calendar";
import { Textarea } from "@/components/ui/textarea";
import { ListSkeleton } from "@/components/dashboard/list-skeleton";
import { QueryError } from "@/components/dashboard/query-error";
import { useProjectQuery } from "@/lib/hooks/use-project-query";
import { useDisguiseStore } from "@/lib/store/disguise-store";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function NotesPanel({ projectId }: { projectId: string | null }) {
  const { state, refetch } = useProjectQuery(projectId, getNotes);
  const setDisguised = useDisguiseStore((s) => s.setDisguised);
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [meetingDate, setMeetingDate] = useState(todayIsoDate());
  const [content, setContent] = useState("");
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [digestingIds, setDigestingIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fire-and-forget digestion, but tracked: the badge shows "Digesting…"
  // while the pass runs, then refetch picks up the digested_at stamp (or
  // its absence, if the pass was skipped/failed).
  function digestInBackground(noteId: string, noteContent: string) {
    setDigestingIds((prev) => new Set(prev).add(noteId));
    void runBackgroundExtraction(projectId!, noteContent, noteId)
      .finally(() => {
        setDigestingIds((prev) => {
          const next = new Set(prev);
          next.delete(noteId);
          return next;
        });
        refetch();
      })
      // Fresh logs/notes are new evidence -- silently refresh the Team
      // Performance scores too (no-ops when no members or AI is off).
      .then(() => runTeamAnalysis(projectId!));
  }

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
    const savedContent = content;
    startTransition(async () => {
      let noteId: string | null;
      if (editingId) {
        await updateNote(editingId, projectId, meetingDate, content);
        noteId = editingId;
      } else {
        noteId = await createNote(projectId, meetingDate, content);
      }
      resetEditor();
      refetch();
      // Background AI pass (links -> Links tab, progress -> Log tab).
      // Deliberately not awaited: the note is already saved, and this
      // never surfaces errors to the user.
      if (noteId) digestInBackground(noteId, savedContent);
    });
  }

  function handleUpload(file: File | null) {
    if (!projectId || !file) return;
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      await uploadDocument(projectId, formData);
      setUploadedName(file.name);
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
    <div className="flex max-h-[60%] min-h-0 flex-col border-t p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Notes</h3>
        <Button
          size="icon"
          variant="ghost"
          className="size-6 text-muted-foreground"
          title="Disguise as a plain notepad"
          onClick={() => setDisguised(true)}
        >
          <VenetianMask className="size-3.5" />
        </Button>
      </div>

      <div className="space-y-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-start gap-2">
              <CalendarDays className="size-3.5" />
              {meetingDate}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="p-0">
            <MonthCalendar value={meetingDate} onSelect={setMeetingDate} />
          </DropdownMenuContent>
        </DropdownMenu>
        <Textarea
          placeholder="Meeting notes…"
          rows={4}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <Button size="sm" disabled={isPending || !content.trim()} onClick={handleSave}>
            {editingId ? "Update note" : "Save note"}
          </Button>
          {editingId && (
            <Button size="sm" variant="ghost" onClick={resetEditor}>
              Cancel
            </Button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              handleUpload(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
          <Button
            size="sm"
            variant="ghost"
            disabled={isPending}
            title="Attach a file — it's saved to this project's Documents"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="size-3.5" />
          </Button>
        </div>
        {uploadedName && (
          <p className="text-xs text-muted-foreground">
            Saved “{uploadedName}” to this project&apos;s Documents.
          </p>
        )}
      </div>

      <div className="mt-4 h-100 min-h-0 flex-1 space-y-1 overflow-y-auto">
        {state.status === "loading" && <ListSkeleton />}

        {state.status === "error" && <QueryError onRetry={refetch} error={state.error} />}

        {state.status === "ready" && state.data.length === 0 && (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        )}

        {state.status === "ready" &&
          state.data.map((note) => (
            <div
              key={note.id}
              className="rounded-md border p-2 text-sm animate-in fade-in duration-300"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {note.meeting_date ?? "No date"}
                </p>
                <div className="flex items-center gap-1">
                  {digestingIds.has(note.id) ? (
                    <span className="animate-pulse rounded-full border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      Digesting…
                    </span>
                  ) : note.digested_at ? (
                    <span
                      className="rounded-full border border-green-600/40 bg-green-600/10 px-1.5 py-0.5 text-[10px] text-green-600 animate-in zoom-in duration-300 dark:text-green-500"
                      title="AI digested this note — links and progress were filed to the Links/Log tabs and saved to project memory"
                    >
                      ✓ Digested
                    </span>
                  ) : (
                    <span
                      className="rounded-full border px-1.5 py-0.5 text-[10px] text-muted-foreground"
                      title="Not digested yet — edit and re-save this note to run the background AI pass"
                    >
                      Not digested
                    </span>
                  )}
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
