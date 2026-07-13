"use client";

import { runCloudExtraction, saveNoteExtraction, type LogRow } from "@/app/(dashboard)/extract-actions";
import { indexClientSide } from "@/lib/embed-client";
import {
  analyzeTeamCloud,
  getMembers,
  getPerformanceCorpus,
  saveTeamAnalysis,
} from "@/app/(dashboard)/team-actions";
import {
  buildExtractionPrompt,
  buildTeamPrompt,
  parseExtraction,
  parseTeamAnalysis,
} from "@/lib/extract";
import { useBackgroundAiStore } from "@/lib/store/background-ai-store";
import { OLLAMA_BASE_URL } from "@/lib/store/ollama-store";

// Non-streaming one-shot completion against local Ollama, shared by the
// note-digestion and team-analysis paths below.
async function ollamaComplete(model: string, prompt: string): Promise<string | null> {
  const res = await fetch(`${OLLAMA_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], stream: false }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? null;
}

// Fire-and-forget background pass over a just-saved note, routed by the
// Background AI setting. Never throws and never blocks the save — the
// note is already persisted before this runs. Returns the log rows the
// extraction created (regardless of which path produced them) so the
// caller can also embed the NOTE and those LOGS via Ollama, if configured
// -- that's orthogonal to which model did the extraction itself.
export async function runBackgroundExtraction(
  projectId: string,
  noteText: string,
  noteId?: string,
): Promise<LogRow[]> {
  const { provider, model } = useBackgroundAiStore.getState();
  let logRows: LogRow[] = [];

  if (provider !== "off" && model && noteText.trim()) {
    try {
      if (provider === "ollama") {
        // Ollama: same browser-to-localhost path as chat (the server can't
        // reach the user's machine), then persist via server action.
        const raw = await ollamaComplete(model, buildExtractionPrompt(noteText));
        if (raw !== null) {
          logRows = await saveNoteExtraction(projectId, parseExtraction(raw), noteId);
        }
      } else {
        logRows = await runCloudExtraction(projectId, noteText, noteId, provider, model);
      }
    } catch (err) {
      console.error("Background extraction failed (non-fatal):", err);
    }
  }

  // Ollama memory embedding is a separate concern from which model did the
  // extraction -- runs whenever no cloud embedding key exists and a local
  // embedding model is configured, regardless of the branch above.
  if (noteId) void indexClientSide(projectId, "note", noteId, noteText);
  for (const log of logRows) {
    void indexClientSide(projectId, "log", log.id, log.entry);
  }

  return logRows;
}

// Team Performance analysis, routed by the same Background AI setting.
// Returns true when an analysis actually ran (so the tab knows whether to
// explain why nothing changed).
export async function runTeamAnalysis(projectId: string): Promise<boolean> {
  const { provider, model } = useBackgroundAiStore.getState();
  if (provider === "off" || !model) return false;

  try {
    if (provider === "ollama") {
      const [members, corpus] = await Promise.all([
        getMembers(projectId),
        getPerformanceCorpus(projectId),
      ]);
      if (members.length === 0) return false;
      const raw = await ollamaComplete(model, buildTeamPrompt(members.map((m) => m.name), corpus));
      if (raw === null) return false;
      await saveTeamAnalysis(projectId, parseTeamAnalysis(raw));
      return true;
    }
    await analyzeTeamCloud(projectId, provider, model);
    return true;
  } catch (err) {
    console.error("Team analysis failed (non-fatal):", err);
    return false;
  }
}
