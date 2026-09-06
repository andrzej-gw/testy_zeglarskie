(() => {
  'use strict';

  const questions = Array.isArray(window.QUESTIONS)
    ? [...window.QUESTIONS].sort((a, b) => Number(a.id) - Number(b.id))
    : [];

  const byId = new Map(questions.map((q, index) => [Number(q.id), index]));

  const config = window.JSM_ADMIN_CONFIG || {};
  const supabaseUrl = String(config.supabaseUrl || '').replace(/\/+$/, '');
  const supabaseKey = String(config.supabaseAnonKey || '');
  const tableName = 'jsm_question_reviews';

  const els = {
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    jumpInput: document.getElementById('jumpInput'),
    jumpBtn: document.getElementById('jumpBtn'),
    positionText: document.getElementById('positionText'),
    reviewCountBadge: document.getElementById('reviewCountBadge'),
    questionTitle: document.getElementById('questionTitle'),
    metadata: document.getElementById('metadata'),
    questionImageWrap: document.getElementById('questionImageWrap'),
    questionImage: document.getElementById('questionImage'),
    imagePath: document.getElementById('imagePath'),
    questionText: document.getElementById('questionText'),
    answersList: document.getElementById('answersList'),
    explanationText: document.getElementById('explanationText'),
    reviewForm: document.getElementById('reviewForm'),
    reviewerName: document.getElementById('reviewerName'),
    contact: document.getElementById('contact'),
    changesSection: document.getElementById('changesSection'),
    saveReviewBtn: document.getElementById('saveReviewBtn'),
    saveStatus: document.getElementById('saveStatus'),
    reviewStats: document.getElementById('reviewStats'),
    reviewsList: document.getElementById('reviewsList'),
    refreshReviewsBtn: document.getElementById('refreshReviewsBtn'),
    setupError: document.getElementById('setupError'),
  };

  let currentIndex = 0;
  let summary = {};

  function hasConfig() {
    return (
      /^https:\/\/.+\.supabase\.co$/i.test(supabaseUrl) &&
      supabaseKey.length > 20 &&
      !supabaseUrl.includes('TWOJ-PROJEKT') &&
      !supabaseKey.includes('WKLEJ_TUTAJ')
    );
  }

  function showSetupError(message) {
    els.setupError.hidden = false;
    els.setupError.innerHTML = `
      <strong>Panel nie jest jeszcze połączony z bazą komentarzy.</strong>
      <p>${escapeHtml(message)}</p>
      <p>Uzupełnij <code>admin/config.js</code> i uruchom
      <code>supabase_schema.sql</code> w SQL Editor projektu Supabase.</p>
    `;
    els.saveReviewBtn.disabled = true;
  }

  function currentQuestion() {
    return questions[currentIndex];
  }

  function resolveImage(src) {
    if (!src) return '';
    if (/^(?:https?:|data:|\/)/i.test(src)) return src;
    return `../${src}`;
  }

  function statusLabel(status) {
    return {
      approved: 'Zatwierdzam',
      needs_changes: 'Do poprawy',
      delete: 'Do usunięcia',
    }[status] || '—';
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function pluralReviews(n) {
    if (n === 1) return '1 opinia';
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) {
      return `${n} opinie`;
    }
    return `${n} opinii`;
  }

  function supabaseHeaders(extra = {}) {
    return {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      ...extra,
    };
  }

  async function supabaseGet(query) {
    if (!hasConfig()) throw new Error('Brak konfiguracji Supabase.');

    const response = await fetch(
      `${supabaseUrl}/rest/v1/${tableName}?${query}`,
      {
        method: 'GET',
        headers: supabaseHeaders({
          Accept: 'application/json',
        }),
        cache: 'no-store',
      }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const message = data?.message || data?.hint || `HTTP ${response.status}`;
      throw new Error(message);
    }

    return Array.isArray(data) ? data : [];
  }

  async function supabaseInsert(payload) {
    if (!hasConfig()) throw new Error('Brak konfiguracji Supabase.');

    const response = await fetch(
      `${supabaseUrl}/rest/v1/${tableName}`,
      {
        method: 'POST',
        headers: supabaseHeaders({
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        }),
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const message = data?.message || data?.hint || `HTTP ${response.status}`;
      throw new Error(message);
    }

    return Array.isArray(data) ? data : [];
  }

  function renderQuestion() {
    const q = currentQuestion();
    if (!q) return;

    document.title = `JSM • pytanie ${q.id}`;
    els.questionTitle.textContent = `Pytanie nr ${q.id}`;
    els.positionText.textContent = `${currentIndex + 1} / ${questions.length}`;
    els.jumpInput.value = q.id;
    els.prevBtn.disabled = currentIndex === 0;
    els.nextBtn.disabled = currentIndex === questions.length - 1;

    const metaRows = [
      ['Numer / ID', q.id],
      ['Autor', q.author ?? '—'],
      ['Kategoria', q.category ?? '—'],
      ['Trudność', q.difficulty ?? '—'],
      [
        'Poprawna odpowiedź',
        Number.isInteger(q.correct)
          ? String.fromCharCode(65 + q.correct)
          : '—'
      ],
      ['Obrazek', q.image ?? 'brak'],
    ];

    els.metadata.innerHTML = metaRows
      .map(([key, value]) => `
        <div>
          <dt>${escapeHtml(key)}</dt>
          <dd>${escapeHtml(value)}</dd>
        </div>
      `)
      .join('');

    els.questionText.textContent = q.question ?? '';
    els.explanationText.textContent = q.explanation || 'Brak wyjaśnienia.';

    if (q.image) {
      els.questionImage.src = resolveImage(q.image);
      els.questionImage.alt = `Ilustracja do pytania ${q.id}`;
      els.imagePath.textContent = q.image;
      els.questionImageWrap.hidden = false;
    } else {
      els.questionImage.removeAttribute('src');
      els.imagePath.textContent = '';
      els.questionImageWrap.hidden = true;
    }

    els.answersList.innerHTML = (q.answers || []).map((answer, index) => {
      const correct = index === Number(q.correct);
      return `
        <div class="answer-row ${correct ? 'is-correct' : ''}">
          <span class="answer-letter">${String.fromCharCode(65 + index)}</span>
          <span>${escapeHtml(answer)}</span>
          ${correct ? '<span class="correct-chip">poprawna</span>' : ''}
        </div>
      `;
    }).join('');

    updateSummaryBadge();
    resetPerQuestionForm();

    if (hasConfig()) {
      loadReviews();
    } else {
      els.reviewStats.innerHTML = '';
      els.reviewsList.innerHTML =
        '<div class="empty-state">Połącz panel z Supabase, aby zobaczyć wspólne opinie.</div>';
    }

    history.replaceState(null, '', `#q=${encodeURIComponent(q.id)}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetPerQuestionForm() {
    const name = els.reviewerName.value;
    const contact = els.contact.value;

    els.reviewForm.reset();

    els.reviewerName.value = name;
    els.contact.value = contact;
    els.changesSection.hidden = true;
  }

  function goToIndex(index) {
    if (index < 0 || index >= questions.length) return;
    currentIndex = index;
    renderQuestion();
  }

  function jumpToId() {
    const id = Number(els.jumpInput.value);

    if (!byId.has(id)) {
      setStatus(
        `Nie ma pytania o ID ${Number.isFinite(id) ? id : '—'}.`,
        'error'
      );
      els.jumpInput.focus();
      return;
    }

    setStatus('', '');
    goToIndex(byId.get(id));
  }

  async function loadSummary() {
    if (!hasConfig()) return;

    try {
      const rows = await supabaseGet(
        'select=question_id,status,coolness&order=question_id.asc'
      );

      const nextSummary = {};

      for (const row of rows) {
        const id = Number(row.question_id);
        if (!Number.isFinite(id)) continue;

        if (!nextSummary[id]) {
          nextSummary[id] = {
            count: 0,
            approved: 0,
            needs_changes: 0,
            delete: 0,
            coolnessSum: 0,
          };
        }

        const item = nextSummary[id];
        item.count += 1;

        if (['approved', 'needs_changes', 'delete'].includes(row.status)) {
          item[row.status] += 1;
        }

        item.coolnessSum += Number(row.coolness || 0);
      }

      summary = nextSummary;
      updateSummaryBadge();
    } catch (error) {
      setStatus(`Nie udało się wczytać podsumowania: ${error.message}`, 'error');
    }
  }

  function updateSummaryBadge() {
    const q = currentQuestion();
    const count = Number(summary?.[q?.id]?.count || 0);
    els.reviewCountBadge.textContent = pluralReviews(count);
  }

  async function loadReviews() {
    const q = currentQuestion();
    if (!q || !hasConfig()) return;

    els.reviewsList.innerHTML =
      '<p class="muted">Ładowanie opinii…</p>';

    try {
      const rows = await supabaseGet(
        [
          'select=id,question_id,reviewer_name,contact,status,coolness,changes,change_details,general_comment,created_at',
          `question_id=eq.${encodeURIComponent(q.id)}`,
          'order=created_at.desc',
        ].join('&')
      );

      renderReviews(rows);

      summary[q.id] = summary[q.id] || {};
      summary[q.id].count = rows.length;
      updateSummaryBadge();
    } catch (error) {
      els.reviewsList.innerHTML =
        `<p class="error-text">${escapeHtml(error.message)}</p>`;
      els.reviewStats.innerHTML = '';
    }
  }

  function renderReviews(reviews) {
    if (!reviews.length) {
      els.reviewStats.innerHTML = '';
      els.reviewsList.innerHTML =
        '<div class="empty-state">To pytanie nie ma jeszcze żadnej opinii.</div>';
      return;
    }

    const approved = reviews.filter(r => r.status === 'approved').length;
    const needsChanges = reviews.filter(r => r.status === 'needs_changes').length;
    const toDelete = reviews.filter(r => r.status === 'delete').length;

    const avg = reviews.reduce(
      (sum, review) => sum + Number(review.coolness || 0),
      0
    ) / reviews.length;

    els.reviewStats.innerHTML = `
      <div><strong>${reviews.length}</strong><span>opinii</span></div>
      <div><strong>${approved}</strong><span>zatwierdza</span></div>
      <div><strong>${needsChanges}</strong><span>do poprawy</span></div>
      <div><strong>${toDelete}</strong><span>do usunięcia</span></div>
      <div><strong>${avg.toFixed(1)}</strong><span>średnia ★</span></div>
    `;

    const changeLabels = {
      text: 'tekst pytania',
      image: 'obrazek',
      answer_a: 'odp. A',
      answer_b: 'odp. B',
      answer_c: 'odp. C',
      difficulty: 'trudność',
      category: 'kategoria',
      explanation: 'wyjaśnienie',
    };

    els.reviewsList.innerHTML = reviews.map(review => {
      const selectedChanges = Object.entries(review.changes || {})
        .filter(([, value]) => Boolean(value))
        .map(([key]) => changeLabels[key] || key);

      const date = review.created_at
        ? new Date(review.created_at).toLocaleString('pl-PL')
        : '—';

      const statusClass =
        review.status === 'approved'
          ? 'good'
          : review.status === 'delete'
            ? 'bad'
            : 'warn';

      return `
        <article class="review-entry">
          <header>
            <div>
              <strong>${escapeHtml(review.reviewer_name)}</strong>
              ${review.contact
                ? `<span>${escapeHtml(review.contact)}</span>`
                : ''}
            </div>
            <time>${escapeHtml(date)}</time>
          </header>

          <div class="review-chips">
            <span class="chip ${statusClass}">
              Status: ${escapeHtml(statusLabel(review.status))}
            </span>
            <span class="chip">
              Fajność: ${escapeHtml(review.coolness)}/5
            </span>
          </div>

          ${selectedChanges.length
            ? `<p><strong>Do zmiany:</strong> ${escapeHtml(selectedChanges.join(', '))}</p>`
            : ''}

          ${review.change_details
            ? `
              <div class="comment-block">
                <strong>Co zmienić</strong>
                <p>${escapeHtml(review.change_details)}</p>
              </div>
            `
            : ''}

          ${review.general_comment
            ? `
              <div class="comment-block">
                <strong>Komentarz</strong>
                <p>${escapeHtml(review.general_comment)}</p>
              </div>
            `
            : ''}
        </article>
      `;
    }).join('');
  }

  function selectedRadio(name) {
    return els.reviewForm
      .querySelector(`input[name="${name}"]:checked`)
      ?.value;
  }

  function checked(name) {
    return Boolean(
      els.reviewForm.querySelector(`input[name="${name}"]`)?.checked
    );
  }

  async function submitReview(event) {
    event.preventDefault();

    if (!hasConfig()) {
      showSetupError('Brakuje poprawnych danych w config.js.');
      return;
    }

    if (!els.reviewForm.reportValidity()) return;

    const q = currentQuestion();
    const formData = new FormData(els.reviewForm);
    const status = selectedRadio('status');

    const changes = status === 'needs_changes'
      ? {
          text: checked('change_text'),
          image: checked('change_image'),
          answer_a: checked('change_answer_a'),
          answer_b: checked('change_answer_b'),
          answer_c: checked('change_answer_c'),
          difficulty: checked('change_difficulty'),
          category: checked('change_category'),
          explanation: checked('change_explanation'),
        }
      : {};

    const payload = {
      question_id: Number(q.id),
      reviewer_name: els.reviewerName.value.trim(),
      contact: els.contact.value.trim() || null,
      status,
      coolness: Number(selectedRadio('coolness')),
      changes,
      change_details:
        status === 'needs_changes'
          ? String(formData.get('change_details') || '').trim() || null
          : null,
      general_comment:
        String(formData.get('general_comment') || '').trim() || null,
    };

    els.saveReviewBtn.disabled = true;
    setStatus('Zapisywanie…', 'working');

    try {
      await supabaseInsert(payload);

      setStatus('Opinia zapisana ✓', 'success');
      resetPerQuestionForm();

      await Promise.all([
        loadReviews(),
        loadSummary(),
      ]);
    } catch (error) {
      setStatus(`Nie zapisano: ${error.message}`, 'error');
    } finally {
      els.saveReviewBtn.disabled = false;
    }
  }

  function setStatus(message, type) {
    els.saveStatus.textContent = message;
    els.saveStatus.className = `save-status ${type || ''}`;
  }

  function loadIdentity() {
    els.reviewerName.value =
      localStorage.getItem('jsmAdminReviewerName') || '';

    els.contact.value =
      localStorage.getItem('jsmAdminContact') || '';

    els.reviewerName.addEventListener('input', () => {
      localStorage.setItem(
        'jsmAdminReviewerName',
        els.reviewerName.value
      );
    });

    els.contact.addEventListener('input', () => {
      localStorage.setItem(
        'jsmAdminContact',
        els.contact.value
      );
    });
  }

  function bindEvents() {
    els.prevBtn.addEventListener(
      'click',
      () => goToIndex(currentIndex - 1)
    );

    els.nextBtn.addEventListener(
      'click',
      () => goToIndex(currentIndex + 1)
    );

    els.jumpBtn.addEventListener('click', jumpToId);

    els.jumpInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        jumpToId();
      }
    });

    els.refreshReviewsBtn.addEventListener('click', async () => {
      await Promise.all([
        loadReviews(),
        loadSummary(),
      ]);
    });

    els.reviewForm.addEventListener('submit', submitReview);

    els.reviewForm
      .querySelectorAll('input[name="status"]')
      .forEach(radio => {
        radio.addEventListener('change', () => {
          const selectedStatus = selectedRadio('status');
          const showChanges = selectedStatus === 'needs_changes';

          els.changesSection.hidden = !showChanges;

          if (!showChanges) {
            els.changesSection
              .querySelectorAll('input[type="checkbox"]')
              .forEach(input => {
                input.checked = false;
              });

            els.changesSection
              .querySelectorAll('textarea')
              .forEach(textarea => {
                textarea.value = '';
              });
          }
        });
      });

    document.addEventListener('keydown', event => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (event.altKey && event.key === 'ArrowLeft') {
        goToIndex(currentIndex - 1);
      }

      if (event.altKey && event.key === 'ArrowRight') {
        goToIndex(currentIndex + 1);
      }
    });
  }

  function initialIndexFromHash() {
    const match = location.hash.match(/q=(\d+)/);

    if (match && byId.has(Number(match[1]))) {
      return byId.get(Number(match[1]));
    }

    return 0;
  }

  if (!questions.length) {
    document.body.innerHTML = `
      <main class="fatal">
        <h1>Nie znaleziono bazy pytań</h1>
        <p>Panel oczekuje pliku <code>../questions.js</code>.</p>
      </main>
    `;
    return;
  }

  loadIdentity();
  bindEvents();

  currentIndex = initialIndexFromHash();
  renderQuestion();

  if (!hasConfig()) {
    showSetupError(
      'W pliku config.js są jeszcze wartości przykładowe.'
    );
  } else {
    loadSummary();
  }
})();
