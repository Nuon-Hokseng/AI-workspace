-- Link pages are now scraped and indexed into project memory, so the
-- source_type check needs a 'link' variant.
alter table public.memory_embeddings
  drop constraint memory_embeddings_source_type_check;
alter table public.memory_embeddings
  add constraint memory_embeddings_source_type_check
  check (source_type in ('chat', 'document', 'note', 'log', 'link'));
