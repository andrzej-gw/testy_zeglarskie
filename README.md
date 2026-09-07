# Testy żeglarskie

Prosta, statyczna aplikacja webowa do nauki do polskich egzaminów żeglarskich i motorowodnych.

Obsługiwane egzaminy:

- **ŻJ** — Żeglarz Jachtowy
- **JSM** — Jachtowy Sternik Morski
- **SM** — Sternik Motorowodny
- **MSM** — Motorowodny Sternik Morski

Aplikacja jest napisana w czystym HTML/CSS/JavaScript i może być hostowana na zwykłym serwerze statycznym. Do panelu administracyjnego, roboczej bazy nowych pytań i zgłoszeń użytkowników używany jest **Supabase**.

---

## Główne funkcje

### Test

Po wejściu na stronę użytkownik najpierw wybiera egzamin: **ŻJ, JSM, SM albo MSM**.

Następnie aplikacja:

- losuje **75 unikalnych pytań** pasujących do wybranego egzaminu,
- pokazuje po każdej odpowiedzi informację, czy była poprawna,
- wyświetla wyjaśnienie,
- obsługuje pytania z ilustracjami,
- pokazuje dyskretne **ID pytania**,
- pozwala zgłosić problem z konkretnym pytaniem,
- pozwala zakończyć test wcześniej,
- na końcu pokazuje wynik i podsumowanie odpowiedzi.

Stan rozpoczętego testu jest przechowywany w `sessionStorage`. Dzięki temu po przejściu do formularza zgłoszenia i powrocie użytkownik wraca do tego samego zestawu, tego samego pytania i zachowuje dotychczasowe odpowiedzi.

### Zakres egzaminacyjny pytań

Każde pytanie może należeć do jednego lub kilku egzaminów:

```js
{
  "zj": true,
  "jsm": true,
  "sm": false,
  "msm": false
}
```

Znaczenie pól:

| Pole | Egzamin |
|---|---|
| `zj` | Żeglarz Jachtowy |
| `jsm` | Jachtowy Sternik Morski |
| `sm` | Sternik Motorowodny |
| `msm` | Motorowodny Sternik Morski |

`true` oznacza, że temat pytania pasuje do zakresu danego egzaminu.

---

## Baza pytań

Produkcyjna baza pytań znajduje się w:

```text
questions.js
```

i jest udostępniana jako:

```js
window.QUESTIONS = [
  // ...
];
```

Obecna baza zawiera **540 pytań**.

Pytania `1–210` są autorskimi pytaniami treningowymi. Pytania `211–540` pochodzą z archiwalnego arkusza PZŻ JSM z 2016 r.

> **Uwaga dotycząca pytań PZŻ:** źródłowy arkusz nie zawierał oficjalnego klucza odpowiedzi. Pola `correct` i `explanation` dla tej części bazy są rekonstrukcją pomocniczą i nie należy traktować ich jako oficjalnego klucza PZŻ.

Przykładowy rekord:

```js
{
  "id": 123,
  "author": "ChatGPT",
  "category": "Meteorologia",
  "difficulty": "średnie",

  "zj": true,
  "jsm": true,
  "sm": true,
  "msm": true,

  "question": "Treść pytania?",
  "answers": [
    "Odpowiedź A",
    "Odpowiedź B",
    "Odpowiedź C"
  ],
  "correct": 1,
  "explanation": "Wyjaśnienie odpowiedzi.",
  "image": "images/q123.png"
}
```

Pole `image` jest opcjonalne.

`correct` używa indeksowania od zera:

```text
0 = A
1 = B
2 = C
```

---

## Panel administratora

Panel znajduje się pod:

```text
/admin/
```

Umożliwia m.in.:

- przeglądanie całej bazy,
- przechodzenie do pytania po ID,
- ocenianie pytań,
- dodawanie komentarzy administracyjnych,
- oznaczenie pytania jako:
  - `Zatwierdzam`,
  - `Do poprawy`,
  - `Do usunięcia`,
- wskazanie, co wymaga poprawy,
- proponowanie zmian zakresu egzaminacyjnego ŻJ/JSM/SM/MSM,
- tworzenie nowych pytań,
- edycję pytań zapisanych w Supabase,
- dodawanie ilustracji,
- publikowanie i archiwizowanie pytań,
- eksport aktualnego `questions.js`.

Nowe pytanie musi mieć przypisany co najmniej jeden zakres egzaminacyjny.

### Statusy roboczych pytań

Pytania tworzone w panelu mają status:

```text
draft
review
published
archived
```

Znaczenie:

- `draft` — szkic,
- `review` — gotowe do oceny,
- `published` — ma trafić do produkcyjnego `questions.js`,
- `archived` — nie powinno znaleźć się w eksporcie.

### Nadawanie ID

ID nowego pytania nie jest ustawione na stałe.

Panel sprawdza:

1. najwyższe ID w `questions.js`,
2. najwyższe ID pytań zapisanych w Supabase,

a następnie nadaje:

```text
max(ID) + 1
```

Zapobiega to nadpisywaniu istniejących pytań.

---

## Zgłaszanie błędów przez użytkowników

Przy każdym pytaniu w teście znajduje się niewielki przycisk:

```text
Zgłoś pytanie
```

Prowadzi on do:

```text
/report/?question=<ID>
```

Formularz pozwala podać:

- numer pytania,
- treść uwagi,
- opcjonalny kontakt.

Zgłoszenia są zapisywane w Supabase w tabeli:

```text
jsm_question_reports
```

Po wysłaniu zgłoszenia użytkownik może wrócić do dokładnie tego miejsca testu, z którego przyszedł.

---

## Podgląd zgłoszeń

Widok zgłoszeń administratora znajduje się pod:

```text
/reports/
```

Pozwala:

- czytać zgłoszenia użytkowników,
- filtrować po ID pytania,
- wyszukiwać w treści,
- sortować zgłoszenia,
- przejść bezpośrednio z konkretnego zgłoszenia do odpowiedniego pytania w panelu admina.

---

## Supabase

Supabase jest używany do:

- roboczej bazy nowych i edytowanych pytań,
- opinii administratorów,
- zgłoszeń użytkowników,
- przechowywania obrazków dodawanych z panelu.

Konfiguracja frontendu znajduje się w:

```text
admin/config.js
```

Przykład:

```js
window.JSM_ADMIN_CONFIG = {
  supabaseUrl: "https://YOUR-PROJECT.supabase.co",
  supabaseAnonKey: "YOUR_PUBLISHABLE_KEY"
};
```

W frontendzie wolno używać wyłącznie **publishable/anon key**.

**Nigdy nie umieszczaj w repozytorium ani w kodzie przeglądarkowym `service_role` / secret key.**

### SQL

Repozytorium zawiera skrypty SQL używane do konfiguracji m.in.:

- `jsm_questions`,
- `jsm_question_reviews`,
- `jsm_question_reports`,
- pól `zj`, `jsm`, `sm`, `msm`,
- Supabase Storage dla ilustracji.

Po zmianach schematu należy uruchamiać odpowiednie migracje w:

```text
Supabase → SQL Editor
```

---

## Ważne: bezpieczeństwo panelu

Aktualna wersja panelu nie ma jeszcze właściwego logowania administratorów przez Supabase Auth.

Publishable key nie jest sekretem. Bez dodatkowego uwierzytelniania i odpowiednich polityk RLS nie należy traktować `/admin/` ani `/reports/` jako prywatnych tylko dlatego, że ich adres nie jest podlinkowany publicznie.

Przed szerszym udostępnieniem aplikacji warto dodać:

- Supabase Auth,
- dostęp do zapisu pytań tylko dla zalogowanych administratorów,
- dostęp do odczytu zgłoszeń tylko dla administratorów.

---

## Struktura projektu

Najważniejsze pliki i katalogi:

```text
testy_zeglarskie/
├── index.html
├── app.js
├── style.css
├── questions.js
│
├── images/
│   └── ...
│
├── report/
│   ├── index.html
│   ├── report.js
│   └── report.css
│
├── reports/
│   ├── index.html
│   ├── reports.js
│   └── reports.css
│
└── admin/
    ├── index.html
    ├── admin.js
    ├── admin.css
    ├── config.js
    └── ...
```

---

## Uruchomienie lokalne

Aplikacja nie wymaga Node.js, frameworka ani procesu budowania.

W katalogu projektu można uruchomić prosty serwer HTTP, np.:

```bash
python3 -m http.server 8000
```

i wejść na:

```text
http://localhost:8000/
```

Można również użyć:

```bash
php -S localhost:8000
```

PHP nie jest jednak wymagane przez aplikację.

Nie zaleca się otwierania `index.html` bezpośrednio przez `file://`, ponieważ część zachowania przeglądarki może różnić się od normalnego hostingu HTTP.

---

## Publikowanie zmian w pytaniach

`questions.js` jest produkcyjną bazą używaną przez test.

Typowy workflow:

```text
nowe pytanie
    ↓
Supabase / draft
    ↓
review
    ↓
published
    ↓
Eksport questions.js z panelu
    ↓
podmiana questions.js w repozytorium
    ↓
commit + deploy
```

Panel podczas eksportu:

- zachowuje istniejące pytania z `questions.js`,
- dodaje pytania Supabase o statusie `published`,
- nadpisuje rekord o tym samym ID jego nowszą wersją z Supabase,
- pomija nowe pytania `draft` i `review`,
- usuwa z eksportu pytania oznaczone jako `archived`,
- zachowuje pola `zj`, `jsm`, `sm`, `msm`.

---

## Git

Po zmianie nazwy projektu repozytorium powinno nazywać się:

```text
testy_zeglarskie
```

Sprawdzenie skonfigurowanego zdalnego repozytorium:

```bash
git remote -v
```

Zmiana adresu `origin`, jeśli repozytorium zostało przemianowane na GitHubie:

```bash
git remote set-url origin git@github.com:TWOJ_LOGIN/testy_zeglarskie.git
```

lub przez HTTPS:

```bash
git remote set-url origin https://github.com/TWOJ_LOGIN/testy_zeglarskie.git
```

---

## Cel projektu

Projekt służy do nauki i treningu przed egzaminami.

Nie jest oficjalnym systemem egzaminacyjnym PZŻ ani oficjalną bazą egzaminacyjną. Zakresy pytań, odpowiedzi, wyjaśnienia oraz przypisanie pytań do konkretnych egzaminów należy traktować jako materiał edukacyjny i w razie wątpliwości weryfikować z aktualnymi przepisami oraz materiałami szkoleniowymi.
