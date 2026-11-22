-- ODCZYT ZGŁOSZEŃ W /reports
-- Uruchom w Supabase -> SQL Editor.
--
-- UWAGA:
-- Bez logowania adminów ta polityka pozwala na odczyt zgłoszeń
-- każdemu klientowi posiadającemu publishable/anon key projektu.
-- Oznacza to również możliwość odczytu pola contact przez API.
--
-- Jeśli /reports ma być naprawdę prywatne, kolejnym krokiem
-- powinno być Supabase Auth i polityka SELECT tylko dla authenticated.

drop policy if exists "JSM reports: read"
  on public.jsm_question_reports;

create policy "JSM reports: read"
  on public.jsm_question_reports
  for select
  to anon, authenticated
  using (true);

grant select on table public.jsm_question_reports
  to anon, authenticated;

-- Zapisanie statusu rozpatrzenia przez /reports.
-- To nie zastępuje logowania adminów i RLS; w tej wersji endpoint jest dostępny
-- dla każdej sesji posiadającej anon/publishable key.
alter table public.jsm_question_reports
  add column if not exists resolved boolean not null default false;

alter table public.jsm_question_reports
  add column if not exists resolved_at timestamptz;

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
