"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// Wraps the dashboard's page content only -- the sidebar/header chrome
// from layout.tsx stays mounted, so a failure here doesn't take the whole
// shell down with it.
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
      <h2 className="text-sm font-semibold">This section failed to load</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        {error.message || "An unexpected error occurred."}
      </p>
      <Button size="sm" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
