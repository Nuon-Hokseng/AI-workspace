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
          {/* min-w-0 + truncate so four tabs degrade gracefully on narrow
              (half-laptop) widths instead of overlapping. */}
          <TabsList className="w-full">
            <TabsTrigger className="min-w-0 flex-1 truncate px-2" value="documents">
              Documents
            </TabsTrigger>
            <TabsTrigger className="min-w-0 flex-1 truncate px-2" value="links">
              Links
            </TabsTrigger>
            <TabsTrigger className="min-w-0 flex-1 truncate px-2" value="log">
              Log
            </TabsTrigger>
            <TabsTrigger className="min-w-0 flex-1 truncate px-2" value="team" title="Team Performance">
              Team
            </TabsTrigger>
          </TabsList>
          {/* Every tab pins its controls and scrolls only its list.
              data-[state=active]:flex (not a plain `flex`) because inactive
              panels stay mounted with the `hidden` attribute -- an
              unconditional display class overrides hidden and the empty
              inactive panels eat the layout. */}
          <TabsContent
            value="documents"
            className="hidden min-h-0 flex-1 flex-col overflow-hidden data-[state=active]:flex data-[state=active]:animate-in data-[state=active]:fade-in data-[state=active]:slide-in-from-bottom-1 data-[state=active]:duration-200"
          >
            <DocumentsTab projectId={activeProjectId} />
          </TabsContent>
          <TabsContent
            value="links"
            className="hidden min-h-0 flex-1 flex-col overflow-hidden data-[state=active]:flex data-[state=active]:animate-in data-[state=active]:fade-in data-[state=active]:slide-in-from-bottom-1 data-[state=active]:duration-200"
          >
            <LinksTab projectId={activeProjectId} />
          </TabsContent>
          <TabsContent
            value="log"
            className="hidden min-h-0 flex-1 flex-col overflow-hidden data-[state=active]:flex data-[state=active]:animate-in data-[state=active]:fade-in data-[state=active]:slide-in-from-bottom-1 data-[state=active]:duration-200"
          >
            <LogTab projectId={activeProjectId} />
          </TabsContent>
          <TabsContent
            value="team"
            className="hidden min-h-0 flex-1 flex-col overflow-hidden data-[state=active]:flex data-[state=active]:animate-in data-[state=active]:fade-in data-[state=active]:slide-in-from-bottom-1 data-[state=active]:duration-200"
          >
            <TeamTab projectId={activeProjectId} active={tab === "team"} />
          </TabsContent>
        </Tabs>
      </div>
      <NotesPanel projectId={activeProjectId} />
    </aside>
  );
}
