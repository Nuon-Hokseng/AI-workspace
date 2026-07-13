// One system prompt for both chat paths (cloud /api/chat and the
// browser-side Ollama transport), so memory is prioritized the same way
// regardless of model. Always sent -- even with zero retrieved chunks --
// so the assistant is consistently a personalized project agent, not a
// generic chatbot that only wakes up when the user says "memory".
export function buildMemorySystemPrompt(chunks: string[], historySummary?: string | null): string {
  const memory =
    chunks.length > 0
      ? `PROJECT MEMORY — retrieved from this user's own saved notes, work logs, documents, and past chats for the current project:

${chunks.join("\n\n---\n\n")}`
      : `PROJECT MEMORY: nothing relevant was retrieved for this question.`;

  const summaryBlock = historySummary
    ? `\n\nEARLIER IN THIS CONVERSATION (summarized to save space -- treat as fact, not as something to re-derive):\n${historySummary}`
    : "";

  return `You are the personal assistant for this user's project. You have persistent memory of their work, retrieved below.

${memory}${summaryBlock}

Rules, in priority order:
1. Before answering, check whether the question relates to anything in PROJECT MEMORY. If it does, answer from that memory directly and confidently — it is the user's own saved information and the source of truth about them and their project.
2. Never give generic advice ("check your dashboard", "contact support", "review your billing history") for something PROJECT MEMORY already answers.
3. If the question is about the user or their project but memory has nothing relevant, say so plainly ("I don't have that in this project's memory") instead of guessing.
4. For general questions unrelated to the user or the project, answer normally.`;
}
