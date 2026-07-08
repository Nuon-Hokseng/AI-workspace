"use client";

import { useRef, useState, useTransition } from "react";
import { File, FileText, Image as ImageIcon, Trash2, Upload } from "lucide-react";

import {
  deleteDocument,
  getDocuments,
  uploadDocument,
} from "@/app/(dashboard)/documents-actions";
import { Button } from "@/components/ui/button";
import { ListSkeleton } from "@/components/dashboard/list-skeleton";
import { QueryError } from "@/components/dashboard/query-error";
import { useProjectQuery } from "@/lib/hooks/use-project-query";
import { cn } from "@/lib/utils";

function DocumentIcon({ fileType }: { fileType: string | null }) {
  if (fileType?.startsWith("image/")) return <ImageIcon className="size-4 shrink-0" />;
  if (fileType === "application/pdf" || fileType?.startsWith("text/"))
    return <FileText className="size-4 shrink-0" />;
  return <File className="size-4 shrink-0" />;
}

export function DocumentsTab({ projectId }: { projectId: string | null }) {
  const { state, refetch } = useProjectQuery(projectId, getDocuments);
  const [isPending, startTransition] = useTransition();
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0 || !projectId) return;
    const formDataList = Array.from(files).map((file) => {
      const fd = new FormData();
      fd.set("file", file);
      return fd;
    });
    startTransition(async () => {
      for (const fd of formDataList) {
        await uploadDocument(projectId, fd);
      }
      refetch();
    });
  }

  if (!projectId) {
    return <p className="text-sm text-muted-foreground">Select a project to see its documents.</p>;
  }

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground",
          isDragging && "border-primary bg-accent",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          uploadFiles(e.dataTransfer.files);
        }}
      >
        <Upload className="size-5" />
        <p>Drag files here, or</p>
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          Choose file
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {state.status === "loading" && <ListSkeleton />}

      {state.status === "error" && <QueryError onRetry={refetch} error={state.error} />}

      {state.status === "ready" && state.data.length === 0 && (
        <p className="text-sm text-muted-foreground">No documents yet.</p>
      )}

      {state.status === "ready" && state.data.length > 0 && (
        <ul className="space-y-1">
          {state.data.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center gap-2 rounded-md border p-2 text-sm"
            >
              <DocumentIcon fileType={doc.file_type} />
              <div className="min-w-0 flex-1">
                <p className="truncate">{doc.name}</p>
                <p className="text-xs text-muted-foreground">
                  {doc.created_at.toLocaleDateString()}
                </p>
              </div>
              <a
                href={`/api/documents/${doc.id}`}
                download
                className="text-xs underline underline-offset-4"
              >
                Download
              </a>
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                onClick={() =>
                  startTransition(async () => {
                    await deleteDocument(doc.id);
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
