"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  isFileUIPart,
  isTextUIPart,
  type ChatTransport,
  type UIMessage,
} from "ai";
import { Paperclip, Search as SearchIcon, Send, Square } from "lucide-react";

import {
  getMessages,
  type ChatMessageRow,
  type ChatSessionRow,
} from "@/app/(dashboard)/chat-actions";
import { QueryError } from "@/components/dashboard/query-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useProjectQuery } from "@/lib/hooks/use-project-query";
import {
  DEFAULT_MODEL,
  DEFAULT_PROVIDER,
  OLLAMA_PROVIDER_ID,
  OLLAMA_PROVIDER_LABEL,
  PROVIDERS,
  type ProviderId,
} from "@/lib/llm/models";
import { createOllamaTransport } from "@/lib/llm/ollama-transport";
import { embedQueryClientSide, indexClientSide } from "@/lib/embed-client";
import { useChatModelStore } from "@/lib/store/chat-model-store";
import { useOllamaStore } from "@/lib/store/ollama-store";
import { cn } from "@/lib/utils";

// Below this, an exchange isn't worth spending an embedding call on --
// mirrors the same threshold the server side (route.ts) and the Ollama
// transport use for their own indexing.
const MIN_CHARS_TO_INDEX = 400;

function messageText(message: UIMessage): string {
  return message.parts.filter(isTextUIPart).map((p) => p.text).join("\n");
}

function rowsToMessages(rows: ChatMessageRow[]): UIMessage[] {
  return rows.map((row) => ({
    id: row.id,
    role: row.role,
    parts: [
      { type: "text" as const, text: row.content },
      ...(row.document_id
        ? [
            {
              type: "file" as const,
              mediaType: row.document_file_type ?? "application/octet-stream",
              filename: row.document_name ?? "attachment",
              url: `/api/documents/${row.document_id}`,
            },
          ]
        : []),
    ],
  }));
}

// Loads this session's history (scoped by session_id + project_id) before
// mounting the live chat, so useChat is never seeded with another
// session's messages.
export function ChatSession({
  projectId,
  session,
}: {
  projectId: string;
  session: ChatSessionRow;
}) {
  const { state, refetch } = useProjectQuery(session.id, (id) =>
    getMessages(id, projectId),
  );

  if (state.status === "error") {
    return (
      <div className="p-3">
        <QueryError onRetry={refetch} error={state.error} />
      </div>
    );
  }

  if (state.status !== "ready") {
    return (
      <div className="flex flex-col gap-2 p-3">
        <Skeleton className="ml-auto h-10 w-2/3" />
        <Skeleton className="h-10 w-2/3" />
      </div>
    );
  }

  return (
    <ActiveChat
      projectId={projectId}
      session={session}
      initialMessages={rowsToMessages(state.data)}
    />
  );
}

function ActiveChat({
  projectId,
  session,
  initialMessages,
}: {
  projectId: string;
  session: ChatSessionRow;
  initialMessages: UIMessage[];
}) {
  const sessionId = session.id;
  // Cached pick wins over the DB's last-saved value: the cache updates the
  // instant you change the dropdown, while chat_sessions.provider/model
  // only updates after a message finishes streaming.
  const cachedChoice = useChatModelStore((s) => s.bySession[sessionId]);
  const setCachedChoice = useChatModelStore((s) => s.setChoice);
  const [provider, setProviderState] = useState<ProviderId>(
    cachedChoice?.provider ?? session.provider ?? DEFAULT_PROVIDER,
  );
  const [model, setModelState] = useState(cachedChoice?.model ?? session.model ?? DEFAULT_MODEL);

  function selectModel(nextProvider: ProviderId, nextModel: string) {
    setProviderState(nextProvider);
    setModelState(nextModel);
    setCachedChoice(sessionId, { provider: nextProvider, model: nextModel });
  }

  const ollamaModels = useOllamaStore((s) => s.models);
  const isOllama = provider === OLLAMA_PROVIDER_ID;

  // Captures the just-sent user text for the cloud path's onFinish below
  // (a ref, not the `messages` state, to sidestep any stale-closure
  // question about which render's `messages` onFinish would otherwise see).
  const lastSentTextRef = useRef("");

  // Cloud providers proxy through /api/chat, which persists the exchange
  // itself after streamText's onFinish. Ollama never touches our server at
  // all -- its transport (created fresh per model/project/session) does
  // its own RAG retrieval and persistence internally (see
  // ollama-transport.ts) via streamText's own onFinish, same shape as the
  // cloud path.
  const transport: ChatTransport<UIMessage> = useMemo(
    () =>
      isOllama
        ? createOllamaTransport(model, { projectId, sessionId })
        : new DefaultChatTransport({
            api: "/api/chat",
            prepareSendMessagesRequest: async ({ messages }) => {
              // Precompute the query embedding here (browser -> localhost)
              // when no cloud embedding key exists -- this app's server
              // can't reach the user's local Ollama itself. Cheap no-op
              // when a cloud key already covers embeddings.
              const lastMessage = messages[messages.length - 1];
              const precomputed = lastMessage
                ? await embedQueryClientSide(messageText(lastMessage))
                : null;
              return {
                body: {
                  projectId,
                  sessionId,
                  messages,
                  provider,
                  model,
                  queryEmbedding: precomputed?.embedding,
                  queryEmbeddingTag: precomputed?.tag,
                },
              };
            },
          }),
    [isOllama, provider, model, projectId, sessionId],
  );

  const { messages, sendMessage, stop, status, error } = useChat({
    id: sessionId,
    messages: initialMessages,
    transport,
    onFinish: ({ message }) => {
      // Ollama chat handles its own memory indexing internally (see
      // ollama-transport.ts) since it never touches this server at all.
      // For cloud providers, the exchange is generated server-side, so
      // this is the one place the browser learns it finished -- the spot
      // to also embed it via Ollama, when that's configured and no cloud
      // embedding key exists (purely additive; the server already tried
      // its own cloud-key embedding attempt in route.ts's onFinish).
      if (isOllama || !lastSentTextRef.current) return;
      const exchangeText = `${lastSentTextRef.current}\n\n${messageText(message)}`;
      if (exchangeText.length >= MIN_CHARS_TO_INDEX) {
        void indexClientSide(projectId, "chat", crypto.randomUUID(), exchangeText);
      }
    },
  });

  const [input, setInput] = useState("");
  const [pendingFiles, setPendingFiles] = useState<FileList | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Message search: the full decrypted history already lives in `messages`,
  // so this is a plain client-side filter -- no server round trip.
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const query = searchQuery.trim().toLowerCase();
  const searchResults =
    searchOpen && query.length >= 2
      ? messages.filter((m) => messageText(m).toLowerCase().includes(query))
      : [];

  function snippet(message: UIMessage) {
    const text = messageText(message);
    const at = text.toLowerCase().indexOf(query);
    const start = Math.max(0, at - 30);
    return `${start > 0 ? "…" : ""}${text.slice(start, at + query.length + 60)}`;
  }

  function jumpToMessage(id: string) {
    document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightId(id);
    setTimeout(() => setHighlightId(null), 1600);
  }

  // Jump to the latest message on open, and keep pinned to bottom as new
  // messages arrive (sent, streamed in, or loaded from history).
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function handleSend() {
    if (!input.trim() && !pendingFiles?.length) return;
    lastSentTextRef.current = input;
    // Fire-and-forget: real failures are already surfaced via useChat's own
    // `error` state (rendered below). The returned promise only rejects for
    // internal signal bookkeeping -- most notably when Stop aborts this
    // exact request -- which isn't a second failure to report, and left
    // uncaught it's an unhandled rejection Next's dev overlay flags.
    void sendMessage({ text: input, files: pendingFiles ?? undefined }).catch(() => {});
    setInput("");
    setPendingFiles(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const busy = status === "streaming" || status === "submitted";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b p-2">
        <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
        {searchOpen ? (
          <>
            <Input
              autoFocus
              placeholder="Search messages in this project…"
              className="h-8 text-xs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setSearchOpen(false)}
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSearchOpen(false);
                setSearchQuery("");
              }}
            >
              Close
            </Button>
          </>
        ) : (
          <button
            className="flex-1 text-left text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setSearchOpen(true)}
          >
            Search messages…
          </button>
        )}
      </div>

      {searchOpen && query.length >= 2 && (
        <div className="max-h-48 overflow-y-auto border-b p-2 text-xs animate-in fade-in duration-200">
          <p className="mb-1 text-muted-foreground">
            {searchResults.length} result{searchResults.length === 1 ? "" : "s"}
          </p>
          {searchResults.map((m) => (
            <button
              key={m.id}
              onClick={() => jumpToMessage(m.id)}
              className="block w-full rounded-md p-1.5 text-left hover:bg-accent"
            >
              <span className={cn(
                "mr-1 font-semibold",
                m.role === "user" ? "text-primary" : "text-muted-foreground",
              )}>
                {m.role === "user" ? "You:" : "AI:"}
              </span>
              <span className="break-words">{snippet(m)}</span>
            </button>
          ))}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No messages yet. Say something.
          </p>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            id={`msg-${message.id}`}
            className={cn(
              "flex animate-in fade-in slide-in-from-bottom-2 duration-300",
              message.role === "user" ? "justify-end" : "justify-start",
            )}>
            <div
              className={cn(
                "max-w-[80%] rounded-lg px-3 py-2 text-sm transition-shadow duration-300",
                message.role === "user"
                  ? "bg-primary text-white"
                  : "bg-muted text-white",
                highlightId === message.id && "ring-2 ring-primary ring-offset-2 ring-offset-background",
              )}>
              {message.parts.map((part, i) => {
                if (isTextUIPart(part)) {
                  return (
                    <p key={i} className="whitespace-pre-wrap break-words">
                      {part.text}
                    </p>
                  );
                }
                if (isFileUIPart(part)) {
                  return (
                    <a
                      key={i}
                      href={part.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block text-xs underline underline-offset-4">
                      📎 {part.filename || "attachment"}
                    </a>
                  );
                }
                return null;
              })}
            </div>
          </div>
        ))}
        {status === "submitted" && (
          <p className="animate-pulse text-xs text-muted-foreground">Thinking…</p>
        )}
        {error && (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
            {error.message}
          </p>
        )}
      </div>

      <div className="border-t p-2">
        <Select
          value={`${provider}:${model}`}
          onValueChange={(value) => {
            // Split on the FIRST colon only -- Ollama model ids are
            // themselves "name:tag" (e.g. "qwen2.5-coder:latest"), so a
            // blind value.split(":") truncates the tag off.
            const separatorIndex = value.indexOf(":");
            const nextProvider = value.slice(0, separatorIndex) as ProviderId;
            const nextModel = value.slice(separatorIndex + 1);
            selectModel(nextProvider, nextModel);
          }}>
          <SelectTrigger className="mb-2 h-8 w-56 text-xs">
            <SelectValue placeholder="Model" />
          </SelectTrigger>
          <SelectContent>
            {PROVIDERS.map((p) => (
              <SelectGroup key={p.id}>
                <SelectLabel>{p.label}</SelectLabel>
                {p.models.map((m) => (
                  <SelectItem key={m.id} value={`${p.id}:${m.id}`}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
            {ollamaModels.length > 0 && (
              <SelectGroup>
                <SelectLabel>{OLLAMA_PROVIDER_LABEL}</SelectLabel>
                {ollamaModels.map((m) => (
                  <SelectItem key={m} value={`${OLLAMA_PROVIDER_ID}:${m}`}>
                    {m}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
        {pendingFiles && pendingFiles.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {Array.from(pendingFiles).map((file, i) => (
              <span key={i} className="rounded-md border px-1.5 py-0.5 text-xs">
                {file.name}
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => setPendingFiles(e.target.files)}
          />
          <Button
            size="icon"
            variant="outline"
            disabled={busy || isOllama}
            title={
              isOllama
                ? "Attachments aren't saved to Documents for local models yet"
                : undefined
            }
            onClick={() => fileInputRef.current?.click()}>
            <Paperclip className="size-4" />
          </Button>
          <Textarea
            rows={1}
            placeholder="Message…"
            value={input}
            disabled={busy}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            className="min-h-9 resize-none"
          />
          {busy ? (
            <Button
              size="icon"
              variant="destructive"
              title="Stop generating"
              // Aborting makes stop()'s own promise reject with AbortError --
              // that's the expected outcome of cancelling, not an error.
              onClick={() => void Promise.resolve(stop()).catch(() => {})}
            >
              <Square className="size-4" />
            </Button>
          ) : (
            <Button size="icon" onClick={handleSend}>
              <Send className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
