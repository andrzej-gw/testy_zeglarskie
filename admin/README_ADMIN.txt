JSM — PANEL ADMINISTRACYJNY
==========================

GDZIE WGRAC
-----------
Wgraj cały katalog "admin" do istniejącego katalogu jsm_test:

jsm_test/
  questions.js
  images/
  ...
  admin/
    index.php
    api.php
    admin.js
    admin.css
    data/

Panel będzie wtedy dostępny pod:
https://twoja-domena/.../jsm_test/admin/

Nie trzeba kopiować ani modyfikować questions.js. Panel czyta istniejącą bazę
z ../questions.js.

WSPÓLNE KOMENTARZE
------------------
Komentarze są przechowywane niezależnie od bazy pytań w:
admin/data/reviews.json

Plik tworzy się automatycznie przy pierwszym użyciu. Wszyscy admini korzystający
z tej samej instalacji widzą te same komentarze.

Katalog admin/data musi być zapisywalny przez PHP. Najczęściej wystarczy, aby
właścicielem katalogu był użytkownik procesu WWW lub aby hosting pozwalał PHP
zapisywać pliki w katalogu aplikacji.

Plik .htaccess blokuje bezpośredni dostęp do danych na Apache. Jeśli używasz
Nginx, zablokuj publiczny dostęp do /jsm_test/admin/data/ w konfiguracji serwera.

Możesz też ustawić zmienną środowiskową JSM_REVIEW_DB na ścieżkę poza webrootem,
np. /var/lib/jsm/reviews.json. To jest najlepsza opcja produkcyjna.

DANE AUTORA OPINII
------------------
Imię i kontakt są zapisywane lokalnie w localStorage przeglądarki. Dzięki temu
nie znikają przy przechodzeniu do kolejnych pytań ani po odświeżeniu strony.
Dane te trafiają również do każdej zapisanej opinii.

BEZPIECZENSTWO
--------------
Panel nie zawiera własnego logowania. Ponieważ jest przeznaczony dla adminów,
zabezpiecz katalog /jsm_test/admin/ logowaniem hostingu, HTTP Basic Auth,
Cloudflare Access albo istniejącym systemem logowania strony.

API używa tokenu sesji CSRF i blokad pliku flock przy zapisie, więc równoległe
zapisy kilku adminów nie powinny nadpisywać się wzajemnie.

SKROTY
------
Alt + strzałka w lewo  — poprzednie pytanie
Alt + strzałka w prawo — następne pytanie
