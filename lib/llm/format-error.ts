// toUIMessageStream(Response)'s onError defaults to masking every error as
// "An error occurred." -- sensible for a multi-tenant app where you don't
// want to leak internals to other users, but this app has no such
// boundary (single-tenant, no auth), so hiding the real reason (quota
// exceeded, model not found, ...) from the person debugging it just makes
// their own errors harder to self-diagnose.
export function formatStreamError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "An unexpected error occurred.";
}
