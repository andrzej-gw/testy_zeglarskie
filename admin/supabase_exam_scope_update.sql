-- ================================================================
-- JSM: zakres egzaminacyjny pytania
-- ŻJ / JSM / SM / MSM
-- ================================================================
-- Uruchom CAŁY plik w Supabase -> SQL Editor.
--
-- Kolumny są celowo nullable dla już istniejących rekordów.
-- Panel:
--   * dla starego rekordu z NULL użyje wartości z aktualnego questions.js,
--   * przy nowym pytaniu lub ponownym zapisie zapisze jawne true/false.
-- Dzięki temu migracja nie nadpisze istniejącego zakresu pytania fałszywym
-- "false" tylko dlatego, że rekord powstał przed dodaniem tej funkcji.
-- ================================================================

alter table public.jsm_questions
  add column if not exists zj boolean;

alter table public.jsm_questions
  add column if not exists jsm boolean;

alter table public.jsm_questions
  add column if not exists sm boolean;

alter table public.jsm_questions
  add column if not exists msm boolean;

comment on column public.jsm_questions.zj
  is 'Czy temat pytania pasuje do egzaminu na Żeglarza Jachtowego';

comment on column public.jsm_questions.jsm
  is 'Czy temat pytania pasuje do egzaminu na Jachtowego Sternika Morskiego';

comment on column public.jsm_questions.sm
  is 'Czy temat pytania pasuje do egzaminu na Sternika Motorowodnego';

comment on column public.jsm_questions.msm
  is 'Czy temat pytania pasuje do egzaminu na Motorowodnego Sternika Morskiego';

-- Odświeżenie cache schematu PostgREST/Supabase.
notify pgrst, 'reload schema';
