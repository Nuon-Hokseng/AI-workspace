"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { PanelLeft, Settings } from "lucide-react";
import type { ImperativePanelHandle } from "react-resizable-panels";

import { ProjectSidebar } from "@/components/dashboard/project-sidebar";
import { ToolsPanel } from "@/components/dashboard/tools-panel";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { cn } from "@/lib/utils";
import type { Project } from "@/types/project";

export function ResizableShell({
  projects,
  children,
}: {
  projects: Project[];
  children: React.ReactNode;
}) {
  const leftPanelRef = useRef<ImperativePanelHandle>(null);
  // minSize is a *percentage* of the whole group, so it's not a real floor
  // on narrow windows -- pixel min-width below is the actual guard. It's
  // dropped while collapsed so the collapse button can still shrink the
  // panel all the way down.
  const [leftCollapsed, setLeftCollapsed] = useState(false);

  return (
    <div className="flex h-svh flex-col">
      <header className="flex items-center gap-2 border-b p-4">
        <Button
          variant="outline"
          size="icon"
          aria-label="Toggle project panel"
          onClick={() => {
            const panel = leftPanelRef.current;
            if (!panel) return;
            if (panel.isCollapsed()) panel.expand();
            else panel.collapse();
          }}
        >
          <PanelLeft className="size-4" />
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Button variant="outline" size="icon" asChild>
            <Link href="/settings">
              <Settings className="size-4" />
            </Link>
          </Button>
        </div>
      </header>

      <ResizablePanelGroup direction="horizontal" className="flex-1 overflow-hidden">
        <ResizablePanel
          ref={leftPanelRef}
          collapsible
          collapsedSize={4}
          minSize={20}
          maxSize={35}
          defaultSize={20}
          onCollapse={() => setLeftCollapsed(true)}
          onExpand={() => setLeftCollapsed(false)}
          className={cn(!leftCollapsed && "min-w-[120px]")}
        >
          <ProjectSidebar projects={projects} collapsed={leftCollapsed} />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel minSize={40} defaultSize={50} className="min-w-[240px]">
          <main className="h-full overflow-y-auto p-4">{children}</main>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel minSize={25} maxSize={40} defaultSize={30} className="min-w-[120px]">
          <ToolsPanel />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
