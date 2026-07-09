"use client";

import { runCloudExtraction, saveNoteExtraction } from "@/app/(dashboard)/extract-actions";
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
// note is already persisted before this runs.
export async function runBackgroundExtraction(
  projectId: string,
  noteText: string,
  noteId?: string,
) {
  const { provider, ollamaModel } = useBackgroundAiStore.getState();
  if (provider === "off" || !noteText.trim()) return;

  try {
    if (provider === "google") {
      await runCloudExtraction(projectId, noteText, noteId);
      return;
    }

    // Ollama: same browser-to-localhost path as chat (the server can't
    // reach the user's machine), then persist via server action.
    if (!ollamaModel) return;
    const raw = await ollamaComplete(ollamaModel, buildExtractionPrompt(noteText));
    if (raw === null) return;
    await saveNoteExtraction(projectId, parseExtraction(raw), noteId);
  } catch (err) {
    console.error("Background extraction failed (non-fatal):", err);
  }
}

// Team Performance analysis, routed by the same Background AI setting.
// Returns true when an analysis actually ran (so the tab knows whether to
// explain why nothing changed).
export async function runTeamAnalysis(projectId: string): Promise<boolean> {
  const { provider, ollamaModel } = useBackgroundAiStore.getState();
  if (provider === "off") return false;

  try {
    if (provider === "google") {
      await analyzeTeamCloud(projectId);
      return true;
    }

    if (!ollamaModel) return false;
    const [members, corpus] = await Promise.all([
      getMembers(projectId),
      getPerformanceCorpus(projectId),
    ]);
    if (members.length === 0) return false;
    const raw = await ollamaComplete(ollamaModel, buildTeamPrompt(members.map((m) => m.name), corpus));
    if (raw === null) return false;
    await saveTeamAnalysis(projectId, parseTeamAnalysis(raw));
    return true;
  } catch (err) {
    console.error("Team analysis failed (non-fatal):", err);
    return false;
  }
}
