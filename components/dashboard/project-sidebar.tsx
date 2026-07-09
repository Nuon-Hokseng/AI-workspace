"use client";

import { useEffect, useState, useTransition } from "react";
import { MoreHorizontal, Plus } from "lucide-react";

import { createProject, deleteProject, renameProject } from "@/app/(dashboard)/actions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useProjectStore } from "@/lib/store/project-store";
import { cn } from "@/lib/utils";
import type { Project } from "@/types/project";

export function ProjectSidebar({
  projects,
  collapsed = false,
}: {
  projects: Project[];
  collapsed?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [renaming, setRenaming] = useState<Project | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleting, setDeleting] = useState<Project | null>(null);

  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const clearActiveProject = useProjectStore((s) => s.clearActiveProject);

  // activeProjectId is persisted to localStorage, so it can outlive the
  // project it points to -- deleted from another session, wiped from the
  // DB directly, etc. Every child that reads it from the store (chat,
  // tools panel) would otherwise keep trying to operate on a project that
  // no longer exists (e.g. chat_sessions' FK violating on insert).
  // Syncing persisted client state against the server's authoritative
  // project list is exactly what an effect is for.
  useEffect(() => {
    if (activeProjectId && !projects.some((p) => p.id === activeProjectId)) {
      clearActiveProject();
    }
  }, [activeProjectId, projects, clearActiveProject]);

  function handleCreate() {
    const name = newProjectName.trim();
    if (!name) return;
    startTransition(async () => {
      await createProject(name);
      setNewProjectName("");
      setNewProjectOpen(false);
    });
  }

  function handleRename() {
    if (!renaming) return;
    const name = renameValue.trim();
    if (!name) return;
    startTransition(async () => {
      await renameProject(renaming.id, name);
      if (activeProjectId === renaming.id) {
        setActiveProject(renaming.id, name);
      }
      setRenaming(null);
    });
  }

  function handleDelete() {
    if (!deleting) return;
    const deletedId = deleting.id;
    startTransition(async () => {
      await deleteProject(deletedId);
      if (activeProjectId === deletedId) {
        clearActiveProject();
      }
      setDeleting(null);
    });
  }

  // Collapsed keeps the sidebar usable at icon width: the New Project
  // button plus one initial-letter tile per project (full name on hover),
  // so switching projects doesn't require re-expanding the panel.
  if (collapsed) {
    return (
      <div className="flex h-full flex-col items-center gap-1 overflow-y-auto overflow-x-hidden p-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="New Project"
          title="New Project"
          onClick={() => setNewProjectOpen(true)}
        >
          <Plus className="size-4" />
        </Button>
        {projects.map((project) => (
          <button
            key={project.id}
            title={project.name}
            aria-label={project.name}
            onClick={() => setActiveProject(project.id, project.name)}
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-md border text-sm font-semibold hover:bg-accent hover:text-accent-foreground",
              activeProjectId === project.id && "bg-accent text-accent-foreground",
            )}
          >
            {project.name.trim().charAt(0).toUpperCase()}
          </button>
        ))}
        <Dialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New project</DialogTitle>
            </DialogHeader>
            <Input
              autoFocus
              placeholder="Project name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <DialogFooter>
              <Button onClick={handleCreate} disabled={isPending || !newProjectName.trim()}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full flex-col overflow-hidden">
        <div className="p-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => setNewProjectOpen(true)}
          >
            <Plus className="size-4 shrink-0" />
            <span className="truncate">New Project</span>
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 pt-0">
          <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">
            Projects
          </p>
          {projects.length === 0 && (
            <p className="px-2 text-sm text-muted-foreground">No projects yet</p>
          )}
          <div className="space-y-0.5">
            {projects.map((project) => (
              <div key={project.id} className="group/item relative">
                <button
                  onClick={() => setActiveProject(project.id, project.name)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md p-2 pr-8 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                    activeProjectId === project.id &&
                      "bg-accent font-medium text-accent-foreground",
                  )}
                >
                  <span className="truncate">{project.name}</span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="absolute right-1 top-1.5 flex size-5 items-center justify-center rounded-md opacity-0 hover:bg-sidebar-accent group-hover/item:opacity-100 focus-visible:opacity-100"
                      aria-label="Project actions"
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="start">
                    <DropdownMenuItem
                      onClick={() => {
                        setRenaming(project);
                        setRenameValue(project.name);
                      }}
                    >
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setDeleting(project)}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Dialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Project name"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <DialogFooter>
            <Button onClick={handleCreate} disabled={isPending || !newProjectName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renaming !== null} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Project name"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
          />
          <DialogFooter>
            <Button onClick={handleRename} disabled={isPending || !renameValue.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{deleting?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the project and everything in it -- documents, links,
              logs, notes, and chats. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isPending}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
