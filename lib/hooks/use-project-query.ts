"use client";

import { useCallback, useEffect, useState } from "react";

type Result<T> = { status: "ready"; projectId: string; version: number; data: T };
type ErrorResult = { status: "error"; projectId: string; version: number; error: unknown };
type QueryState<T> = { status: "empty" } | { status: "loading" } | Result<T> | ErrorResult;

// Refetches whenever projectId changes. Loading/empty/error are all
// derived during render (not set via effect) so a response for a
// projectId the user has already switched away from can never flash
// stale -- or stale-error -- data on screen.
export function useProjectQuery<T>(
  projectId: string | null,
  fetcher: (projectId: string) => Promise<T>,
) {
  const [result, setResult] = useState<Result<T> | ErrorResult | null>(null);
  const [version, setVersion] = useState(0);

  const refetch = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!projectId) return;

    let cancelled = false;

    fetcher(projectId).then(
      (data) => {
        if (!cancelled) setResult({ status: "ready", projectId, version, data });
      },
      (error) => {
        if (!cancelled) setResult({ status: "error", projectId, version, error });
      },
    );

    return () => {
      cancelled = true;
    };
    // fetcher is expected to be a stable server-action reference, not
    // re-created per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, version]);

  const state: QueryState<T> = !projectId
    ? { status: "empty" }
    : result && result.projectId === projectId && result.version === version
      ? result
      : { status: "loading" };

  return { state, refetch };
}
