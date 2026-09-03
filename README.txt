TEST JSM — BAZA 200 PYTAŃ
===========================

Pliki:
- index.html — strona testu
- style.css — wygląd
- app.js — logika aplikacji
- questions.js — baza 200 pytań

Aplikacja losuje 75 różnych pytań z całej bazy przy każdym rozpoczęciu testu.
Wielkość testu ustawia stała TEST_SIZE w app.js.

DODAWANIE PYTAŃ
----------------
W questions.js każde pytanie ma pola:
- id — unikalny numer
- category — kategoria
- difficulty — łatwe / średnie / trudne
- question — treść
- answers — dokładnie 3 odpowiedzi
- correct — 0=A, 1=B, 2=C
- explanation — komentarz po odpowiedzi

UWAGA
-----
Baza jest autorskim materiałem treningowym przygotowanym według zakresu JSM.
Nie jest oficjalnym bankiem pytań egzaminacyjnych PZŻ.


PYTANIA ZE ZDJĘCIAMI / GRAFIKAMI
--------------------------------
Pytanie może opcjonalnie zawierać pole:

  "image": "images/q201.svg"

Plik graficzny umieść w katalogu images/.
Jeśli pole image nie występuje, pytanie jest wyświetlane jak dotychczas.
W tej wersji baza zawiera 210 pytań, w tym 10 z grafiką. Test losuje 75 pytań bez powtórzeń.

WERSJA MOBILNA
--------------
Interfejs jest responsywny i na telefonie działa w widoku pełnoekranowym.
Przycisk przejścia do następnego pytania pozostaje w dolnej części ekranu.
Przy wyjątkowo długim pytaniu przewijana jest tylko treść karty, a nie cała strona.
Obsługiwane są safe-area na urządzeniach z wcięciem ekranu oraz dynamiczna wysokość 100dvh.
