-- Single-tenant: no user_id, no RLS. One key per provider, app-wide,
-- matching how the app has no auth/login anywhere else.
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique,
  encrypted_key text not null,
  created_at timestamptz not null default now()
);
