"use client";

import { useState } from "react";

import { DocumentsTab } from "@/components/dashboard/documents-tab";
import { LinksTab } from "@/components/dashboard/links-tab";
import { LogTab } from "@/components/dashboard/log-tab";
import { TeamTab } from "@/components/dashboard/team-tab";
import { NotesPanel } from "@/components/dashboard/notes-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProjectStore } from "@/lib/store/project-store";

export function ToolsPanel() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  // Controlled so TeamTab can refetch when its tab is opened -- background
  // analyses update the DB while the tab sits mounted-but-hidden.
  const [tab, setTab] = useState("documents");

  return (
    <aside className="flex h-full flex-col">
      {/* The tab bar stays pinned; each tab's content scrolls on its own,
          and Notes stays visible at the bottom regardless of list length. */}
      <div className="flex min-h-0 flex-1 flex-col p-3">
        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
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
            <TabsTrigger className="flex-1" value="team">
              Team Performance
            </TabsTrigger>
          </TabsList>
          {/* Every tab pins its controls and scrolls only its list.
              data-[state=active]:flex (not a plain `flex`) because inactive
              panels stay mounted with the `hidden` attribute -- an
              unconditional display class overrides hidden and the empty
              inactive panels eat the layout. */}
          <TabsContent
            value="documents"
            className="hidden min-h-0 flex-1 flex-col overflow-hidden data-[state=active]:flex"
          >
            <DocumentsTab projectId={activeProjectId} />
          </TabsContent>
          <TabsContent
            value="links"
            className="hidden min-h-0 flex-1 flex-col overflow-hidden data-[state=active]:flex"
          >
            <LinksTab projectId={activeProjectId} />
          </TabsContent>
          <TabsContent
            value="log"
            className="hidden min-h-0 flex-1 flex-col overflow-hidden data-[state=active]:flex"
          >
            <LogTab projectId={activeProjectId} />
          </TabsContent>
          <TabsContent
            value="team"
            className="hidden min-h-0 flex-1 flex-col overflow-hidden data-[state=active]:flex"
          >
            <TeamTab projectId={activeProjectId} active={tab === "team"} />
          </TabsContent>
        </Tabs>
      </div>
      <NotesPanel projectId={activeProjectId} />
    </aside>
  );
}
