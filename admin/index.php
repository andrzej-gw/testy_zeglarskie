<?php
session_start();
if (empty($_SESSION['jsm_admin_csrf'])) {
    $_SESSION['jsm_admin_csrf'] = bin2hex(random_bytes(32));
}
$csrf = $_SESSION['jsm_admin_csrf'];

// Ustal bazowy URL katalogu admin niezależnie od tego,
// czy użytkownik wszedł przez /admin czy /admin/.
$scriptName = $_SERVER['SCRIPT_NAME'] ?? '/admin/index.php';
$adminBase = rtrim(str_replace('\\', '/', dirname($scriptName)), '/') . '/';
?>
<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <base href="<?= htmlspecialchars($adminBase, ENT_QUOTES, 'UTF-8') ?>">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="csrf-token" content="<?= htmlspecialchars($csrf, ENT_QUOTES, 'UTF-8') ?>">
  <title>JSM • Panel oceny pytań</title>
  <link rel="stylesheet" href="admin.css">
</head>
<body>
  <header class="topbar">
    <div class="brand">⚓ JSM <span>panel admina</span></div>
    <div id="saveStatus" class="save-status" aria-live="polite"></div>
  </header>

  <main class="app-shell">
    <nav class="question-nav" aria-label="Nawigacja między pytaniami">
      <button id="prevBtn" class="nav-btn" type="button">← Poprzednie</button>

      <div class="jump-wrap">
        <label for="jumpInput">Skocz do pytania nr</label>
        <div class="jump-controls">
          <input id="jumpInput" type="number" min="1" inputmode="numeric" placeholder="np. 37">
          <button id="jumpBtn" class="secondary-btn" type="button">Skocz</button>
        </div>
      </div>

      <div class="position">
        <strong id="positionText">—</strong>
        <span id="reviewCountBadge" class="count-badge">0 opinii</span>
      </div>

      <button id="nextBtn" class="nav-btn" type="button">Następne →</button>
    </nav>

    <section class="workspace">
      <article class="question-card">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Podgląd pytania</p>
            <h1 id="questionTitle">Ładowanie…</h1>
          </div>
        </div>

        <dl id="metadata" class="metadata"></dl>

        <div id="questionImageWrap" class="question-image-wrap" hidden>
          <img id="questionImage" alt="Ilustracja do pytania">
          <code id="imagePath"></code>
        </div>

        <section class="question-content">
          <h2>Treść</h2>
          <p id="questionText" class="question-text"></p>
        </section>

        <section>
          <h2>Odpowiedzi</h2>
          <div id="answersList" class="answers-list"></div>
        </section>

        <section class="explanation-box">
          <h2>Wyjaśnienie</h2>
          <p id="explanationText"></p>
        </section>
      </article>

      <aside class="review-column">
        <form id="reviewForm" class="review-card" autocomplete="on">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Nowa opinia</p>
              <h2>Oceń pytanie</h2>
            </div>
          </div>

          <div class="two-col">
            <label class="field">
              <span>Imię / podpis</span>
              <input id="reviewerName" name="reviewer_name" type="text" required maxlength="120" placeholder="np. Andrzej">
            </label>
            <label class="field">
              <span>Kontakt</span>
              <input id="contact" name="contact" type="text" maxlength="180" placeholder="mail / telefon / Slack">
            </label>
          </div>
          <p class="field-note">Imię i kontakt są zapamiętywane w tej przeglądarce i nie zerują się przy zmianie pytania.</p>

          <fieldset>
            <legend>Status pytania</legend>
            <div class="segmented status-segmented">
              <label><input type="radio" name="status" value="approved" required><span>Zatwierdzam</span></label>
              <label><input type="radio" name="status" value="needs_changes"><span>Do poprawy</span></label>
              <label><input type="radio" name="status" value="delete"><span>Do usunięcia</span></label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Ocena fajności pytania</legend>
            <div class="rating" id="ratingGroup" aria-label="Ocena od 1 do 5">
              <label><input type="radio" name="coolness" value="1" required><span>1</span></label>
              <label><input type="radio" name="coolness" value="2"><span>2</span></label>
              <label><input type="radio" name="coolness" value="3"><span>3</span></label>
              <label><input type="radio" name="coolness" value="4"><span>4</span></label>
              <label><input type="radio" name="coolness" value="5"><span>5</span></label>
            </div>
          </fieldset>

          <div id="changesSection" class="changes-section" hidden>
            <fieldset>
              <legend>Co trzeba poprawić?</legend>
              <div class="change-grid">
                <label><input type="checkbox" name="change_text"><span>Tekst pytania</span></label>
                <label><input type="checkbox" name="change_image"><span>Obrazek</span></label>
                <label><input type="checkbox" name="change_answer_a"><span>Odpowiedź A</span></label>
                <label><input type="checkbox" name="change_answer_b"><span>Odpowiedź B</span></label>
                <label><input type="checkbox" name="change_answer_c"><span>Odpowiedź C</span></label>
                <label><input type="checkbox" name="change_difficulty"><span>Trudność</span></label>
                <label><input type="checkbox" name="change_category"><span>Kategorię</span></label>
                <label><input type="checkbox" name="change_explanation"><span>Wyjaśnienie</span></label>
              </div>
            </fieldset>

            <label class="field">
              <span>Co dokładnie zmienić?</span>
              <textarea name="change_details" rows="4" maxlength="4000" placeholder="Np. odpowiedź B jest niejednoznaczna; zmienić ją na…"></textarea>
            </label>
          </div>

          <label class="field">
            <span>Ogólny komentarz</span>
            <textarea name="general_comment" rows="5" maxlength="6000" placeholder="Dodatkowe uwagi do pytania"></textarea>
          </label>

          <button id="saveReviewBtn" class="primary-btn" type="submit">Zapisz opinię</button>
        </form>

        <section class="reviews-card">
          <div class="section-heading history-heading">
            <div>
              <p class="eyebrow">Wspólna baza</p>
              <h2>Opinie adminów</h2>
            </div>
            <button id="refreshReviewsBtn" class="icon-btn" type="button" title="Odśwież opinie">↻</button>
          </div>

          <div id="reviewStats" class="review-stats"></div>
          <div id="reviewsList" class="reviews-list"></div>
        </section>
      </aside>
    </section>
  </main>

  <script src="../questions.js"></script>
  <script src="admin.js"></script>
</body>
</html>
