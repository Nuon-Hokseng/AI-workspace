"use client";

import { DocumentsTab } from "@/components/dashboard/documents-tab";
import { LinksTab } from "@/components/dashboard/links-tab";
import { LogTab } from "@/components/dashboard/log-tab";
import { NotesPanel } from "@/components/dashboard/notes-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProjectStore } from "@/lib/store/project-store";

export function ToolsPanel() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);

  return (
    <aside className="flex h-full flex-col overflow-y-auto">
      <div className="flex-1 p-3">
        <Tabs defaultValue="documents">
          <TabsList className="w-full">
            <TabsTrigger className="flex-1" value="documents">
              Documents
            </TabsTrigger>
            <TabsTrigger className="flex-1" value="links">
              Links
            </TabsTrigger>
            <TabsTrigger className="flex-1" value="log">
              Log
            </TabsTrigger>
          </TabsList>
          <TabsContent value="documents">
            <DocumentsTab projectId={activeProjectId} />
          </TabsContent>
          <TabsContent value="links">
            <LinksTab projectId={activeProjectId} />
          </TabsContent>
          <TabsContent value="log">
            <LogTab projectId={activeProjectId} />
          </TabsContent>
        </Tabs>
      </div>
      <NotesPanel projectId={activeProjectId} />
    </aside>
  );
}
