-- Files are stored directly in Postgres for now (no object storage wired
-- up yet). file_url is kept for a possible future external-link use case
-- but is no longer required; file_data holds the actual bytes.
alter table public.project_documents
  alter column file_url drop not null,
  add column file_data bytea;
