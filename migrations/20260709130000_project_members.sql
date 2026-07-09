-- Team members per project, for the Team Performance tab. `skills` holds
-- the latest AI assessment as jsonb: { overall, summary, skills: {name: pct} }.
-- Null until the first analysis runs.
create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  skills jsonb,
  analyzed_at timestamptz,
  created_at timestamptz not null default now()
);

create index project_members_project_id_idx on public.project_members (project_id);
