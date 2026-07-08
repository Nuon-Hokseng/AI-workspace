-- One chat session per project. Drop any extras first (keeping the oldest;
-- ties broken by id) so the constraint can actually be added to existing
-- data -- their messages cascade-delete along with the session.
delete from public.chat_sessions a
using public.chat_sessions b
where a.project_id = b.project_id
  and (a.created_at, a.id) > (b.created_at, b.id);

alter table public.chat_sessions
  add constraint chat_sessions_project_id_key unique (project_id);
