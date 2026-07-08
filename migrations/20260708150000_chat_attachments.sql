-- Tag project_documents by where they came from, and let a chat message
-- reference the document it uploaded (if any).
alter table public.project_documents
  add column source text not null default 'manual' check (source in ('manual', 'chat'));

alter table public.chat_messages
  add column document_id uuid references public.project_documents (id) on delete set null;
