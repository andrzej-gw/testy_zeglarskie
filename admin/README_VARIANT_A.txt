JSM ADMIN - WARIANT A
=====================

CO ROBI TA WERSJA
-----------------
1. Obecne pytania nadal są przechowywane w ../questions.js.
2. Nowe pytania są zapisywane do tabeli Supabase jsm_questions.
3. Panel pokazuje razem:
   - pytania z questions.js,
   - robocze pytania z Supabase.
4. Pytanie z Supabase może mieć status:
   - draft       = Szkic
   - review      = Do oceny
   - published   = Opublikowane
   - archived    = Zarchiwizowane
5. Tylko pytania "published" trafiają do wygenerowanego questions.js.
6. Obrazki można wrzucać bezpośrednio z panelu do Supabase Storage.

PODMIANA PLIKÓW
---------------
W jsm_test/admin/ podmień:
  index.html
  admin.js
  admin.css

config.js zostaje bez zmian.

SUPABASE
--------
W Supabase -> SQL Editor uruchom cały:
  supabase_schema_variant_a.sql

Skrypt tworzy/aktualizuje:
  public.jsm_question_reviews
  public.jsm_questions
  bucket jsm-question-images

DODAWANIE PYTANIA
-----------------
Kliknij:
  + Nowe pytanie

Możesz:
  Zapisz szkic
  Wyślij do oceny
  Opublikuj

Numer ID jest nadawany przez bazę automatycznie.
Tabela startuje od 211, aby nie kolidować z istniejącymi 210 pytaniami.

EDYCJA
------
Pytania pochodzące z Supabase mają przycisk "Edytuj".
Pytania pochodzące tylko z questions.js pozostają w panelu tylko do odczytu
i oceny.

OBRAZKI
-------
W edytorze można:
  - wpisać istniejącą ścieżkę/URL,
  - albo wybrać plik z dysku.

Nowy plik trafi do:
  Supabase Storage -> jsm-question-images/<id-pytania>/...

Maksymalny rozmiar ustawiony w SQL: 5 MB.

EKSPORT
-------
Kliknij:
  Eksport questions.js

Panel:
  1. bierze aktualny ../questions.js,
  2. nakłada na niego pytania Supabase ze statusem published,
  3. pomija nowe szkice i pytania "Do oceny",
  4. usuwa z eksportu pytania Supabase oznaczone jako archived,
  5. pobiera gotowy plik questions.js.

Ten pobrany plik ręcznie podmieniasz na serwerze.

Jeżeli pytanie zostało wcześniej wyeksportowane, a później edytujesz je
w Supabase, ponowny eksport zastąpi starą wersję tym samym ID.

Jeżeli istniejące, wcześniej wyeksportowane pytanie zostanie ponownie
przesunięte do "Szkicu" lub "Do oceny", dotychczasowa wersja z questions.js
pozostaje w eksporcie. Dopiero "Zarchiwizowane" usuwa je z następnego eksportu.

BEZPIECZEŃSTWO
--------------
Obecny wariant nadal nie ma logowania adminów.
Klucz publishable/anon jest kluczem frontendowym, ale polityki RLS w tej wersji
pozwalają na INSERT i UPDATE roboczej tabeli pytań.

Czyli osoba mająca dostęp do panelu może zmieniać roboczą bazę.
Przed szerszym udostępnieniem panelu sensownym kolejnym krokiem jest
Supabase Auth.
