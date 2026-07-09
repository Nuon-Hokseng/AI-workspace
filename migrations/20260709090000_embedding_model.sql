-- Memory embeddings can now come from more than one provider (OpenAI or
-- Gemini, whichever key is saved). Vectors from different models live in
-- different spaces and must never be compared, so each row records which
-- model produced it and search filters to the active one.
-- Every existing row was embedded with the old hardcoded OpenAI model, so
-- the default backfills them correctly.
alter table public.memory_embeddings
  add column embedding_model text not null default 'openai:text-embedding-3-small';
