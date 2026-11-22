# ⚓ Testy żeglarskie

Statyczna aplikacja do ćwiczenia pytań przed egzaminami **ŻJ** (Żeglarz Jachtowy), **JSM** (Jachtowy Sternik Morski), **SM** (Sternik Motorowodny) i **MSM** (Motorowodny Sternik Morski). Frontend działa w HTML, CSS i JavaScript, bez frameworka i budowania. **Supabase** obsługuje zgłoszenia oraz zaplecze administracyjne.

## Testy i zapisywanie postępu

- Po wyborze egzaminu aplikacja losuje maksymalnie **75 różnych pytań** z przypisanego zakresu.
- Opcja **„Nauka poszczególnych działów”** pozwala wybrać dział i rozwiązać test ze wszystkich przypisanych do niego pytań w losowej kolejności.
- Po odpowiedzi pokazuje poprawne rozwiązanie i wyjaśnienie; obsługuje również ilustracje.
- Wynik, odpowiedzi, kolejność pytań i bieżąca pozycja są zapisywane w **`localStorage`**. Po ponownym otwarciu strony można **kontynuować test** lub **rozpocząć nowy**.
- Przy aktualizacji starszy zapis z `sessionStorage` jest przenoszony do `localStorage`, jeśli nie istnieje już nowszy zapis.
- Test można zakończyć wcześniej; podsumowanie zawiera udzielone odpowiedzi i wynik.

Zapis jest lokalny dla danej przeglądarki, urządzenia i adresu strony: **nie synchronizuje się między urządzeniami** i znika po wyczyszczeniu danych witryny. Rozpoczęcie nowego testu lub zakończenie bieżącego usuwa zapis trwającego testu.

## Zgłaszanie problemów z pytaniami

Przy pytaniu oraz przy pytaniach w podsumowaniu znajduje się link **„Zgłoś pytanie”**. Otwiera on formularz pod adresem:

```text
/report/?question=487
```

Formularz ma edytowalne pole **„ID pytania”**, treść uwagi i opcjonalny kontakt. ID jest wstępnie uzupełniane z linku i weryfikowane względem `questions.js`; to **ID w bazie**, a nie numer pytania w wylosowanym teście. Dane trafiają do tabeli Supabase `jsm_question_reports`.

Po udanym wysłaniu formularz zastępuje **ekran podziękowania** z przyciskiem powrotu. Przy błędzie formularz pozostaje na stronie, zachowując wpisane dane i umożliwiając ponowienie próby. Powrót ze zgłoszenia prowadzi bezpośrednio do bieżącego pytania lub podsumowania, bez dodatkowego pytania o wznowienie.

## Baza pytań i panel administratora

- **`questions.js`** zawiera bazę wykorzystywaną przez test (`window.QUESTIONS`). W dostarczonej wersji opisano **540 pytań**, w tym pytania autorskie i archiwalne PZŻ.
- Pytanie ma unikalne `id`, treść `question`, tablicę `answers`, indeks prawidłowej odpowiedzi `correct` (**0 = A, 1 = B, 2 = C**), wyjaśnienie `explanation` oraz opcjonalny obrazek `image`.
- Pola logiczne `zj`, `jsm`, `sm`, `msm` określają, do których egzaminów należy pytanie. Jedno pytanie może występować w kilku zakresach.
- **`/admin/`** służy do przeglądania, oceniania i edycji pytań, dodawania nowych, zarządzania ilustracjami oraz eksportu `questions.js`.
- **`/reports/`** umożliwia przeglądanie i filtrowanie zgłoszeń użytkowników.

Pytania w panelu mają statusy `draft` (szkic), `review` (do oceny), `published` (do eksportu) i `archived` (pomijane w eksporcie). **Zmiana w Supabase nie aktualizuje automatycznie testu**: po publikacji należy wyeksportować `questions.js` z panelu i wdrożyć nowy plik na stronie.

> **Ważne:** aplikacja jest materiałem edukacyjnym, a nie oficjalną bazą egzaminacyjną PZŻ. Odpowiedzi i wyjaśnienia do archiwalnych pytań PZŻ nie są oficjalnym kluczem.

## Uruchomienie

W katalogu projektu wykonaj:

```bash
python3 -m http.server 8000
```

Otwórz `http://localhost:8000/`. Nie potrzeba Node.js ani procesu kompilacji; korzystaj z serwera HTTP zamiast otwierać plik przez `file://`.

Połączenie z Supabase konfiguruje się w **`admin/config.js`** przez `supabaseUrl` i `supabaseAnonKey`. Odpowiednie tabele, polityki i Storage tworzy się za pomocą skryptów SQL z repozytorium, uruchamianych w **Supabase → SQL Editor**.

**Bezpieczeństwo:** w kodzie przeglądarkowym wolno umieszczać wyłącznie klucz publiczny (`anon` / publishable), nigdy `service_role` ani secret key. Panel administracyjny i odczyt zgłoszeń wymagają ograniczenia dostępu przez Supabase Auth i właściwe polityki RLS. Sam niepodlinkowany adres `/admin/` czy `/reports/` nie stanowi zabezpieczenia.

## Najważniejsze pliki

```text
testy_zeglarskie/
├── index.html, app.js, style.css  # interfejs i logika testu
├── questions.js                   # pytania wykorzystywane w teście
├── images/                        # ilustracje
├── report/                        # formularz zgłoszenia + potwierdzenie
├── reports/                       # lista zgłoszeń
├── admin/                         # panel administracyjny, config.js, SQL
└── README.md
```
