"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";

import { createNote, getNotes, updateNote } from "@/app/(dashboard)/notes-actions";
import { runBackgroundExtraction } from "@/lib/extract-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useProjectQuery } from "@/lib/hooks/use-project-query";
import { useDisguiseStore } from "@/lib/store/disguise-store";
import { useProjectStore } from "@/lib/store/project-store";
import { cn } from "@/lib/utils";
import type { Project } from "@/types/project";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

// A full takeover, not just a re-skinned widget: real notepad apps don't
// have a chat panel or a Documents/Links/Log/Team tab strip, so anything
// less than replacing the whole screen would still read as "this is a
// complex app" to anyone glancing over. Styled with the dashboard's own
// dark theme (not a foreign light skin) so nothing looks different in the
// instant you switch into or out of it -- a sudden color flip is itself
// the kind of thing that draws a second look.
//
// Everything here still goes through the exact same createNote/updateNote/
// runBackgroundExtraction calls the normal Notes panel uses -- a different
// face on the same advanced system, not a separate throwaway scratchpad.
// No digestion badges, no calendar, no attach button: hidden, not removed.
export function DisguiseNotepad({ projects }: { projects: Project[] }) {
  const setDisguised = useDisguiseStore((s) => s.setDisguised);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const [isPending, startTransition] = useTransition();
  const [content, setContent] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  const projectId = activeProjectId ?? projects[0]?.id ?? null;
  const { state, refetch } = useProjectQuery(projectId, getNotes);
  const notes = state.status === "ready" ? state.data : [];
  const selectedNote = notes.find((n) => n.id === selectedNoteId) ?? null;

  // Default to this project's most recent note once its data arrives --
  // fires once per project switch, not on every refetch (tracked
  // separately from the content sync below so a same-project save/refetch
  // doesn't re-trigger it and stomp the user's selection).
  const [appliedProjectId, setAppliedProjectId] = useState<string | null>(null);
  if (state.status === "ready" && projectId !== appliedProjectId) {
    setAppliedProjectId(projectId);
    setSelectedNoteId(notes[0]?.id ?? null);
  }

  // Loads the selected note's content into the textarea -- reset
  // synchronously during render (React's recommended alternative to an
  // effect for "adjust state when a prop/data change settles":
  // https://react.dev/learn/you-might-not-need-an-effect). Guarded by
  // `canApply` so a just-created note (selected before the refetch that
  // will include it has resolved) doesn't get its content blanked out by
  // a stale, not-yet-caught-up notes list.
  const contentKey = `${projectId}:${selectedNoteId ?? "new"}`;
  const canApply = selectedNoteId === null || selectedNote !== null;
  const [appliedContentKey, setAppliedContentKey] = useState<string | null>(null);
  if (canApply && contentKey !== appliedContentKey) {
    setAppliedContentKey(contentKey);
    setContent(selectedNote?.content ?? "");
  }

  function handleSave() {
    if (!projectId || !content.trim()) return;
    const savedContent = content;
    startTransition(async () => {
      let noteId: string | null;
      if (selectedNoteId) {
        await updateNote(selectedNoteId, projectId, selectedNote?.meeting_date ?? todayIsoDate(), content);
        noteId = selectedNoteId;
      } else {
        noteId = await createNote(projectId, todayIsoDate(), content);
        if (noteId) setSelectedNoteId(noteId);
      }
      refetch();
      if (noteId) void runBackgroundExtraction(projectId, savedContent, noteId);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground">
      <div className="flex items-center gap-1 overflow-x-auto border-b p-2">
        {projects.map((p) => (
          <button
            key={p.id}
            onClick={() => setActiveProject(p.id, p.name)}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground",
              p.id === projectId && "bg-accent font-medium text-accent-foreground",
            )}
          >
            {p.name}
          </button>
        ))}
        <div className="ml-auto flex shrink-0 items-center gap-2 pl-2">
          {savedFlash && <span className="text-xs text-muted-foreground">Saved</span>}
          <Button size="icon" variant="ghost" className="size-7" title="Exit" onClick={() => setDisguised(false)}>
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex w-48 shrink-0 flex-col overflow-y-auto border-r p-2">
          <Button
            size="sm"
            variant="ghost"
            className="mb-1 justify-start gap-2"
            onClick={() => setSelectedNoteId(null)}
          >
            <Plus className="size-3.5" /> New
          </Button>
          {notes.map((note) => (
            <button
              key={note.id}
              onClick={() => setSelectedNoteId(note.id)}
              className={cn(
                "truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                note.id === selectedNoteId && "bg-accent font-medium text-accent-foreground",
              )}
            >
              {note.meeting_date ?? "No date"}
            </button>
          ))}
          {notes.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">No notes yet.</p>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col p-3">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Start typing..."
            className="flex-1 resize-none"
          />
          <div className="mt-2">
            <Button size="sm" disabled={isPending || !content.trim()} onClick={handleSave}>
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
