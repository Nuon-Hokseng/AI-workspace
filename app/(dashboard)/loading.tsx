import { Skeleton } from "@/components/ui/skeleton";

// Shown automatically while layout.tsx's own server-side project fetch is
// in flight -- before the sidebar/chat/tools shell even mounts.
export default function DashboardLoading() {
  return (
    <div className="flex h-svh">
      <div className="w-56 shrink-0 space-y-2 border-r p-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
      <div className="flex-1 space-y-2 p-4">
        <Skeleton className="ml-auto h-10 w-2/3" />
        <Skeleton className="h-10 w-2/3" />
      </div>
    </div>
  );
}
