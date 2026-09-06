JSM ADMIN + SUPABASE
====================

Ta wersja panelu NIE używa PHP.
Może działać jako zwykła strona statyczna na students.mimuw.edu.pl.

1. CO PODMIENIĆ
---------------

W katalogu:

  jsm_test/admin/

dodaj/podmień:

  index.html
  admin.js
  config.js

Zachowaj istniejący:

  admin.css

Usuń albo przenieś poza public_html stare:

  index.php
  api.php
  data/reviews.json

Panel nadal korzysta z:

  ../questions.js
  ../images/

2. UTWÓRZ SUPABASE
------------------

Załóż projekt na:

  https://supabase.com/

W panelu projektu wejdź do SQL Editor i uruchom cały plik:

  supabase_schema.sql

Utworzy on tabelę:

  public.jsm_question_reviews

oraz polityki RLS pozwalające przeglądarce na:
- odczyt komentarzy,
- dodawanie komentarzy,
- bez możliwości ich edycji i kasowania.

3. CONFIG.JS
------------

W Supabase znajdź dane API projektu:
- Project URL
- anon / publishable key

Wstaw je do:

  admin/config.js

Przykład:

window.JSM_ADMIN_CONFIG = {
  supabaseUrl: "https://abcdefgh.supabase.co",
  supabaseAnonKey: "sb_publishable_..."
};

Nie używaj klucza service_role / secret.
Taki klucz NIGDY nie powinien znaleźć się na stronie WWW.

4. TEST LOKALNY
---------------

Z katalogu zawierającego jsm_test uruchom:

  php -S localhost:8000

PHP służy tu wyłącznie jako prosty lokalny serwer plików.
Panel sam nie korzysta z PHP.

Otwórz:

  http://localhost:8000/jsm_test/admin/

5. TEST WSPÓLNEJ BAZY
---------------------

Otwórz panel w dwóch przeglądarkach.

W pierwszej:
- wpisz imię,
- dodaj opinię do pytania.

W drugiej:
- przejdź do tego samego pytania,
- kliknij odświeżanie opinii.

Komentarz powinien być widoczny w obu.

Imię i kontakt są przechowywane w localStorage,
czyli osobno dla każdej przeglądarki/urządzenia.

6. WAŻNE O BEZPIECZEŃSTWIE
---------------------------

Ta wersja nie ma logowania użytkowników.
Polityki RLS pozwalają na odczyt i dodawanie opinii każdemu,
kto zna adres Supabase / panelu.

Klucz anon/publishable NIE jest sekretem i może być widoczny
w kodzie przeglądarki. To normalne w Supabase.

Jeżeli panel ma być dostępny wyłącznie dla określonych osób,
kolejnym krokiem powinno być:
- zabezpieczenie katalogu admin po stronie hostingu, albo
- dodanie Supabase Auth i polityk RLS dla zalogowanych adminów.
