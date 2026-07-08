-- Core schema for project-tracking app. Single-tenant, no auth: anything
-- with a DB/app connection can read and write everything.

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  file_url text not null,
  file_type text,
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index project_notes_project_id_idx on public.project_notes (project_id);

create table public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text,
  model text,
  created_at timestamptz not null default now()
);

create index chat_sessions_project_id_idx on public.chat_sessions (project_id);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  model_used text,
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
