-- ============================================================================
-- project-cookbook — full consolidated schema (all migrations folded in)
-- ============================================================================
-- Run once against a FRESH database. Works on both Railway Postgres and
-- Supabase. Single-tenant by design: no auth, no RLS -- project scoping is
-- enforced in application code (WHERE project_id = ...), and the app connects
-- over a direct Postgres connection (DATABASE_URL), not PostgREST.
--
-- Supabase note: enable the "vector" extension (Dashboard → Database →
-- Extensions) or let the CREATE EXTENSION below do it. Railway note: the
-- database must be provisioned from a pgvector-enabled Postgres image.
-- ============================================================================

create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- Core project tree
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  -- file_url kept for a possible future external-storage use case; bytes
  -- currently live in file_data. source tags where the upload came from.
  file_url text,
  file_type text,
  file_data bytea,
  source text not null default 'manual' check (source in ('manual', 'chat')),
  created_at timestamptz not null default now()
);

create index project_documents_project_id_idx on public.project_documents (project_id);

create table public.project_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  url text not null,
  label text,
  created_at timestamptz not null default now()
);

create index project_links_project_id_idx on public.project_links (project_id);

create table public.project_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  entry text not null,
  created_at timestamptz not null default now()
);

create index project_logs_project_id_idx on public.project_logs (project_id);

create table public.project_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  meeting_date date,
  content text not null,
  -- Null until the background AI has digested this note; cleared on edit.
  digested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index project_notes_project_id_idx on public.project_notes (project_id);

-- ---------------------------------------------------------------------------
-- Chat (one session per project)
-- ---------------------------------------------------------------------------
create table public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text,
  model text,
  provider text,
  -- Rolling compaction: everything before summarized_count messages (in
  -- created_at order) is folded into history_summary, so only the raw tail
  -- needs sending to the model each turn -- keeps prompt size bounded as
  -- the chat grows instead of resending the whole history forever.
  history_summary text,
  summarized_count integer not null default 0,
  created_at timestamptz not null default now(),
  constraint chat_sessions_project_id_key unique (project_id)
);

create index chat_sessions_project_id_idx on public.chat_sessions (project_id);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  model_used text,
  -- The document this message uploaded, if any (attachments in chat).
  document_id uuid references public.project_documents (id) on delete set null,
  tokens_used integer,
  created_at timestamptz not null default now()
);

create index chat_messages_session_id_idx on public.chat_messages (session_id);
create index chat_messages_project_id_idx on public.chat_messages (project_id);

-- Keep project_notes.updated_at current on every UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger project_notes_set_updated_at
  before update on public.project_notes
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- API keys (one per provider, app-wide, encrypted at rest)
-- ---------------------------------------------------------------------------
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique,
  encrypted_key text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RAG memory (per-project vector store)
-- ---------------------------------------------------------------------------
create table public.memory_embeddings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  source_type text not null check (source_type in ('chat', 'document', 'note', 'log', 'link')),
  source_id uuid not null,
  content_chunk text not null,
  embedding vector(1536) not null,
  -- Which model produced this vector; search only compares same-model rows.
  embedding_model text not null default 'openai:text-embedding-3-small',
  tokens_used integer,
  created_at timestamptz not null default now()
);

create index memory_embeddings_project_id_idx on public.memory_embeddings (project_id);

-- ---------------------------------------------------------------------------
-- Team Performance
-- ---------------------------------------------------------------------------
create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  -- Latest AI assessment: { overall, summary, skills: {name: pct} }.
  skills jsonb,
  analyzed_at timestamptz,
  created_at timestamptz not null default now()
);

create index project_members_project_id_idx on public.project_members (project_id);
