-- Rolling chat-history compaction: everything before `summarized_count`
-- messages (in created_at order) has been folded into history_summary, so
-- only the raw tail after that watermark needs sending to the model on
-- every turn -- this is what keeps prompt size (and cost) bounded as a
-- project's chat grows, instead of resending the whole history forever.
alter table public.chat_sessions
  add column history_summary text,
  add column summarized_count integer not null default 0;
