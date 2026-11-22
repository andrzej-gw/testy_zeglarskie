-- Uruchom w Supabase -> SQL Editor.
-- Dodaje pola rozpatrzenia oraz pozwala na ich aktualizację w widoku /reports.

alter table public.jsm_question_reports
  add column if not exists resolved boolean not null default false;

alter table public.jsm_question_reports
  add column if not exists resolved_at timestamptz;

update public.jsm_question_reports
set resolved_at = null
where resolved = false and resolved_at is not null;

drop policy if exists "JSM reports: update resolved"
  on public.jsm_question_reports;

create policy "JSM reports: update resolved"
  on public.jsm_question_reports
  for update
  to anon, authenticated
  using (true)
  with check (
    resolved is not null
    and (resolved = false or resolved_at is not null)
  );

grant update (resolved, resolved_at)
  on table public.jsm_question_reports
  to anon, authenticated;
