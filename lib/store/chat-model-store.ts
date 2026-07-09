import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ProviderId } from "@/lib/llm/models";

type ChatModelChoice = { provider: ProviderId; model: string };

type ChatModelStore = {
  // Keyed by chat session id -- there's one session per project, so this
  // remembers each project's last-picked model independently.
  bySession: Record<string, ChatModelChoice>;
  setChoice: (sessionId: string, choice: ChatModelChoice) => void;
};

// Persists the model/provider dropdown immediately on every change, so a
// pick sticks across reloads even before a message is ever sent (unlike
// chat_sessions.provider/model in the DB, which only updates after the
// first exchange completes).
export const useChatModelStore = create<ChatModelStore>()(
  persist(
    (set) => ({
      bySession: {},
      setChoice: (sessionId, choice) =>
        set((state) => ({ bySession: { ...state.bySession, [sessionId]: choice } })),
    }),
    { name: "chat-model-store" },
  ),
);
