// Shared between the server (Gemini path) and the browser (Ollama path),
// so both background extractors speak the same prompt and JSON shape.

export type Extraction = {
  links: { url: string; label: string | null }[];
  logs: string[];
};

export function buildExtractionPrompt(noteText: string): string {
  return `You extract structured project info from meeting notes.
Respond with ONLY a JSON object (no prose, no markdown fences) in this exact shape:
{"links":[{"url":"https://...","label":"short description"}],"logs":["short work-progress entry"]}

Rules:
- "links": every URL mentioned in the text, with a short label from context (or null).
- "logs": concrete work-progress items — things done or actively being worked on (e.g. "Set up development environment", "Learning NestJS"). Rephrase each as one short, clear entry. Exclude vague ideas, questions, and untouched todos.
- Use empty arrays when nothing qualifies.

NOTES:
${noteText}`;
}

// Tolerant of models that wrap JSON in fences or prose: grab the outermost
// object and coerce every field defensively — a garbled response must
// yield an empty extraction, never a throw (this runs silently).
export function parseExtraction(raw: string): Extraction {
  const empty: Extraction = { links: [], logs: [] };
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return empty;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as {
      links?: { url?: unknown; label?: unknown }[];
      logs?: unknown[];
    };
    return {
      links: (Array.isArray(parsed.links) ? parsed.links : [])
        .filter((l) => typeof l?.url === "string" && l.url.trim())
        .map((l) => ({
          url: (l.url as string).trim(),
          label: typeof l.label === "string" && l.label.trim() ? l.label.trim() : null,
        })),
      logs: (Array.isArray(parsed.logs) ? parsed.logs : [])
        .filter((e): e is string => typeof e === "string" && e.trim().length > 0)
        .map((e) => e.trim()),
    };
  } catch {
    return empty;
  }
}

// ---- Team performance analysis (Team Performance tab) ----

export type MemberAssessment = {
  name: string;
  overall: number;
  summary: string | null;
  skills: Record<string, number>;
};

export function buildTeamPrompt(memberNames: string[], corpus: string): string {
  return `You assess team member performance from a project's own records.
Given the member names and the records below (work logs, meeting notes, chat messages), estimate each member's demonstrated skill levels as percentages (0-100).
Respond with ONLY a JSON object (no prose, no markdown fences) in this exact shape:
{"members":[{"name":"<exact member name>","overall":72,"summary":"one short sentence of what they did","skills":{"frontend":80,"backend":60,"database":50,"algorithms":40}}]}

Rules:
- Include every given member exactly once, names spelled exactly as given: ${memberNames.join(", ")}
- Be strictly evidence-based and calibrated — you are an auditor, not a cheerleader. Do NOT inflate scores or default to "good" numbers. Never invent work that isn't in the records.
- Score ONLY what the records show for that specific member. Negative evidence (bugs, delays, incomplete or reworked tasks) must lower the score. Praise in the records without concrete delivered work counts for little.
- A member with no mentions scores 0-10. Barely mentioned or vague mentions: 10-30. Solid evidence of routine work: 40-60. Reserve 70+ for clear, repeated evidence of strong delivery; 90+ should be rare.
- "skills": pick 3-6 relevant areas per member (e.g. frontend, backend, database, algorithms, devops, writing). Only areas the records actually show them working in.
- "overall" is your holistic 0-100 judgement, not necessarily the average.
- The "summary" must cite what the records actually say, including weaknesses.

PROJECT RECORDS:
${corpus}`;
}

// Same tolerance rules as parseExtraction: garbled output degrades to an
// empty list, never a throw.
export function parseTeamAnalysis(raw: string): MemberAssessment[] {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return [];
  const pct = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : 0;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as {
      members?: { name?: unknown; overall?: unknown; summary?: unknown; skills?: unknown }[];
    };
    return (Array.isArray(parsed.members) ? parsed.members : [])
      .filter((m) => typeof m?.name === "string" && m.name.trim())
      .map((m) => ({
        name: (m.name as string).trim(),
        overall: pct(m.overall),
        summary: typeof m.summary === "string" && m.summary.trim() ? m.summary.trim() : null,
        skills: Object.fromEntries(
          Object.entries(
            m.skills && typeof m.skills === "object" ? (m.skills as Record<string, unknown>) : {},
          ).map(([k, v]) => [k, pct(v)]),
        ),
      }));
  } catch {
    return [];
  }
}

// Plain URL harvesting for chat messages — no LLM call needed there.
export function findUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"')\]]+/g) ?? [];
  return [...new Set(matches.map((u) => u.replace(/[.,;:]+$/, "")))];
}
