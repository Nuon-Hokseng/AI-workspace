-- Requires the pgvector extension to actually be installed in this
-- Postgres instance (not just enabled via SQL) -- if this fails on
-- Railway, the database needs to be provisioned from a pgvector-enabled
-- Postgres template.
create extension if not exists vector;

-- No RLS: this app has no auth (no auth.uid()), so -- same as every other
-- table here -- project scoping happens via WHERE project_id = ... in
-- application code, not Postgres policies.
create table public.memory_embeddings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  source_type text not null check (source_type in ('chat', 'document', 'note', 'log')),
  source_id uuid not null,
  content_chunk text not null,
  embedding vector(1536) not null,
  tokens_used integer,
  created_at timestamptz not null default now()
);

-- Narrows the search to one project's rows before the vector sort runs.
-- No ANN index (ivfflat/hnsw) -- at the row counts a single project's
-- memory will realistically hold, a sequential scan over the pre-filtered
-- rows is simpler and plenty fast. Add one if a project's embedding count
-- ever gets large enough for it to matter.
create index memory_embeddings_project_id_idx on public.memory_embeddings (project_id);

alter table public.chat_messages add column tokens_used integer;
