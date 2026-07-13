import type { LanguageModel } from "ai";
import { generateText } from "ai";

// Once the un-summarized tail exceeds this many messages, fold everything
// except the most recent KEEP_RAW_COUNT into the running summary. Keeping
// the trigger well above the keep count means this only fires roughly once
// every (TRIGGER - KEEP) messages, not on every turn.
export const SUMMARY_TRIGGER_COUNT = 20;
export const KEEP_RAW_COUNT = 10;

export type HistoryMessage = { role: "user" | "assistant"; content: string };

// Pure split logic, shared by both chat paths (cloud route.ts and the
// Ollama transport) so the fold boundary can't drift between them, and so
// the off-by-one-prone slicing has one place to get right and test.
export function planCompaction<T>(
  tail: T[],
): { toFold: T[]; rawTail: T[] } {
  if (tail.length <= SUMMARY_TRIGGER_COUNT) return { toFold: [], rawTail: tail };
  return {
    toFold: tail.slice(0, tail.length - KEEP_RAW_COUNT),
    rawTail: tail.slice(tail.length - KEEP_RAW_COUNT),
  };
}

function buildSummaryPrompt(previousSummary: string | null, toFold: HistoryMessage[]): string {
  const transcript = toFold.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n\n");
  return `You maintain a running summary of an ongoing project chat, so older context can be dropped from the prompt without losing it.

${previousSummary ? `EXISTING SUMMARY:\n${previousSummary}\n\n` : ""}NEW MESSAGES TO FOLD IN:
${transcript}

Write an updated summary that replaces the existing one entirely (do not say "as mentioned before" -- just state the facts). Keep it dense and factual: decisions made, tasks done or planned, names, numbers, open questions. Drop small talk and anything superseded by later messages. Target a few short paragraphs -- this must stay compact even as more gets folded in over time.`;
}

// Runs the fold using whichever model the caller passes in (the cloud chat
// route reuses its own already-resolved model; the Ollama transport reuses
// its own local model) -- summarization piggybacks on a model the user is
// already using, rather than depending on a separate setting that could be
// off and silently disable compaction too.
export async function summarizeHistory(
  model: LanguageModel,
  previousSummary: string | null,
  toFold: HistoryMessage[],
): Promise<string> {
  const { text } = await generateText({
    model,
    prompt: buildSummaryPrompt(previousSummary, toFold),
  });
  return text.trim();
}
