-- Tracks whether the background AI has digested a note (extracted its
-- links/logs and indexed it). Null = not digested yet; set only when an
-- extraction pass actually completes, cleared when the note is edited.
alter table public.project_notes
  add column digested_at timestamptz;
