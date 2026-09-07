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
