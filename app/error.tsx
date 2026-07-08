"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// Root-level boundary. Next's error.tsx wraps a segment's children, not
// the layout it's defined alongside -- so this is the one that actually
// catches app/(dashboard)/layout.tsx's own data fetch failing (e.g. the
// database being unreachable), not app/(dashboard)/error.tsx.
export default function GlobalError({
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
    <html>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            {error.message || "An unexpected error occurred."}
          </p>
          <Button onClick={reset}>Try again</Button>
        </div>
      </body>
    </html>
  );
}
