-- Uruchom w Supabase -> SQL Editor, jeśli tabela jsm_questions już istnieje.
alter table public.jsm_questions
  add column if not exists shuffle_answers boolean not null default true;
