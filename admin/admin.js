(() => {
  'use strict';

  const staticQuestions = Array.isArray(window.QUESTIONS)
    ? window.QUESTIONS.map(q => ({ ...q, __source: 'static', status: 'published' }))
    : [];

  let databaseQuestions = [];
  let questions = [];
  let byId = new Map();
  let currentIndex = 0;
  let summary = {};
  let editingQuestionId = null;
  let editorPreviewObjectUrl = null;

  const config = window.JSM_ADMIN_CONFIG || {};
  const supabaseUrl = String(config.supabaseUrl || '').replace(/\/+$/, '');
  const supabaseKey = String(config.supabaseAnonKey || '');
  const reviewsTable = 'jsm_question_reviews';
  const questionsTable = 'jsm_questions';
  const imageBucket = 'jsm-question-images';

  const els = {
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    jumpInput: document.getElementById('jumpInput'),
    jumpBtn: document.getElementById('jumpBtn'),
    positionText: document.getElementById('positionText'),
    reviewCountBadge: document.getElementById('reviewCountBadge'),
    questionTitle: document.getElementById('questionTitle'),
    questionBadges: document.getElementById('questionBadges'),
    metadata: document.getElementById('metadata'),
    questionImageWrap: document.getElementById('questionImageWrap'),
    questionImage: document.getElementById('questionImage'),
    imagePath: document.getElementById('imagePath'),
    questionText: document.getElementById('questionText'),
    answersList: document.getElementById('answersList'),
    explanationText: document.getElementById('explanationText'),
    editQuestionBtn: document.getElementById('editQuestionBtn'),

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

    newQuestionBtn: document.getElementById('newQuestionBtn'),
    exportQuestionsBtn: document.getElementById('exportQuestionsBtn'),

    editor: document.getElementById('questionEditor'),
    editorForm: document.getElementById('questionEditorForm'),
    editorTitle: document.getElementById('editorTitle'),
    editorQuestionId: document.getElementById('editorQuestionId'),
    closeEditorBtn: document.getElementById('closeEditorBtn'),
    qAuthor: document.getElementById('qAuthor'),
    qCategory: document.getElementById('qCategory'),
    categoryOptions: document.getElementById('categoryOptions'),
    qDifficulty: document.getElementById('qDifficulty'),
    qStatusDisplay: document.getElementById('qStatusDisplay'),
    qQuestion: document.getElementById('qQuestion'),
    qImageUrl: document.getElementById('qImageUrl'),
    qImageFile: document.getElementById('qImageFile'),
    editorImagePreviewWrap: document.getElementById('editorImagePreviewWrap'),
    editorImagePreview: document.getElementById('editorImagePreview'),
    qAnswerA: document.getElementById('qAnswerA'),
    qAnswerB: document.getElementById('qAnswerB'),
    qAnswerC: document.getElementById('qAnswerC'),
    qExplanation: document.getElementById('qExplanation'),
    editorValidation: document.getElementById('editorValidation'),
    testPreview: document.getElementById('testPreview'),
    testPreviewImageWrap: document.getElementById('testPreviewImageWrap'),
    testPreviewImage: document.getElementById('testPreviewImage'),
    testPreviewQuestion: document.getElementById('testPreviewQuestion'),
    testPreviewAnswers: document.getElementById('testPreviewAnswers'),
    previewQuestionBtn: document.getElementById('previewQuestionBtn'),
    saveDraftBtn: document.getElementById('saveDraftBtn'),
    sendReviewBtn: document.getElementById('sendReviewBtn'),
    publishQuestionBtn: document.getElementById('publishQuestionBtn'),
    archiveQuestionBtn: document.getElementById('archiveQuestionBtn'),
  };

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
      <strong>Panel nie jest jeszcze w pełni połączony z Supabase.</strong>
      <p>${escapeHtml(message)}</p>
      <p>Uzupełnij <code>admin/config.js</code> i uruchom
      <code>supabase_schema_variant_a.sql</code> w SQL Editor projektu Supabase.</p>
    `;
    els.saveReviewBtn.disabled = true;
    els.newQuestionBtn.disabled = true;
    els.exportQuestionsBtn.disabled = true;
  }

  function clearSetupError() {
    els.setupError.hidden = true;
    els.saveReviewBtn.disabled = false;
    els.newQuestionBtn.disabled = false;
    els.exportQuestionsBtn.disabled = false;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function statusLabel(status) {
    return {
      approved: 'Zatwierdzam',
      needs_changes: 'Do poprawy',
      delete: 'Do usunięcia',
      draft: 'Szkic',
      review: 'Do oceny',
      published: 'Opublikowane',
      archived: 'Zarchiwizowane',
    }[status] || '—';
  }

  function questionStatusClass(status) {
    return {
      draft: 'neutral',
      review: 'warn',
      published: 'good',
      archived: 'bad',
    }[status] || 'neutral';
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

  async function restGet(table, query) {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/${table}?${query}`,
      {
        method: 'GET',
        headers: supabaseHeaders({ Accept: 'application/json' }),
        cache: 'no-store',
      }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(data?.message || data?.hint || `HTTP ${response.status}`);
    }

    return Array.isArray(data) ? data : [];
  }

  async function restInsert(table, payload) {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/${table}`,
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
      throw new Error(data?.message || data?.hint || `HTTP ${response.status}`);
    }

    return Array.isArray(data) ? data : [];
  }

  async function restUpdate(table, filter, payload) {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/${table}?${filter}`,
      {
        method: 'PATCH',
        headers: supabaseHeaders({
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        }),
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(data?.message || data?.hint || `HTTP ${response.status}`);
    }

    return Array.isArray(data) ? data : [];
  }

  function databaseRowToQuestion(row) {
    return {
      id: Number(row.id),
      author: row.author || '',
      category: row.category || '',
      difficulty: row.difficulty || '',
      question: row.question || '',
      answers: [
        row.answer_a || '',
        row.answer_b || '',
        row.answer_c || '',
      ],
      correct: Number.isInteger(row.correct) ? row.correct : Number(row.correct),
      explanation: row.explanation || '',
      ...(row.image_url ? { image: row.image_url } : {}),
      status: row.status || 'draft',
      created_at: row.created_at,
      updated_at: row.updated_at,
      __source: 'supabase',
    };
  }

  function getNextQuestionId() {
    const ids = [
      ...staticQuestions.map(q => Number(q.id)),
      ...databaseQuestions.map(q => Number(q.id)),
    ].filter(Number.isFinite);

    return ids.length ? Math.max(...ids) + 1 : 1;
  }

  function rebuildQuestionList() {
    const merged = new Map();

    for (const q of staticQuestions) {
      merged.set(Number(q.id), { ...q, __source: 'static', status: 'published' });
    }

    // Rekord z Supabase ma pierwszeństwo w panelu. Dzięki temu pytanie
    // pozostaje edytowalne także po wcześniejszym eksporcie do questions.js.
    for (const q of databaseQuestions) {
      merged.set(Number(q.id), q);
    }

    questions = [...merged.values()]
      .filter(q => q.status !== 'archived')
      .sort((a, b) => Number(a.id) - Number(b.id));

    byId = new Map(questions.map((q, index) => [Number(q.id), index]));
    refreshCategoryOptions();
  }

  function refreshCategoryOptions() {
    const categories = [...new Set(
      [...staticQuestions, ...databaseQuestions]
        .map(q => String(q.category || '').trim())
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, 'pl'));

    els.categoryOptions.innerHTML = categories
      .map(category => `<option value="${escapeHtml(category)}"></option>`)
      .join('');
  }

  async function loadDatabaseQuestions() {
    const rows = await restGet(
      questionsTable,
      'select=id,author,category,difficulty,question,answer_a,answer_b,answer_c,correct,explanation,image_url,status,created_at,updated_at&order=id.asc'
    );

    databaseQuestions = rows.map(databaseRowToQuestion);
    rebuildQuestionList();
  }

  function currentQuestion() {
    return questions[currentIndex];
  }

  function resolveImage(src) {
    if (!src) return '';
    if (/^(?:https?:|data:|blob:|\/)/i.test(src)) return src;
    return `../${src}`;
  }

  function renderQuestion() {
    const q = currentQuestion();
    if (!q) {
      els.questionTitle.textContent = 'Brak pytań';
      return;
    }

    document.title = `JSM • pytanie ${q.id}`;
    els.questionTitle.textContent = `Pytanie nr ${q.id}`;
    els.positionText.textContent = `${currentIndex + 1} / ${questions.length}`;
    els.jumpInput.value = q.id;
    els.prevBtn.disabled = currentIndex === 0;
    els.nextBtn.disabled = currentIndex === questions.length - 1;

    els.questionBadges.innerHTML = `
      <span class="source-badge ${q.__source === 'supabase' ? 'database' : 'static'}">
        ${q.__source === 'supabase' ? 'Supabase' : 'questions.js'}
      </span>
      <span class="source-badge ${questionStatusClass(q.status)}">
        ${escapeHtml(statusLabel(q.status))}
      </span>
    `;

    els.editQuestionBtn.hidden = q.__source !== 'supabase';

    const metaRows = [
      ['Numer / ID', q.id],
      ['Autor', q.author ?? '—'],
      ['Kategoria', q.category ?? '—'],
      ['Trudność', q.difficulty ?? '—'],
      [
        'Poprawna odpowiedź',
        Number.isInteger(q.correct) && q.correct >= 0 && q.correct <= 2
          ? String.fromCharCode(65 + q.correct)
          : '—'
      ],
      ['Obrazek', q.image ?? 'brak'],
    ];

    els.metadata.innerHTML = metaRows.map(([key, value]) => `
      <div>
        <dt>${escapeHtml(key)}</dt>
        <dd>${escapeHtml(value)}</dd>
      </div>
    `).join('');

    els.questionText.textContent = q.question || '(brak treści)';
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

    els.answersList.innerHTML = (q.answers || ['', '', '']).map((answer, index) => {
      const correct = index === Number(q.correct);
      return `
        <div class="answer-row ${correct ? 'is-correct' : ''}">
          <span class="answer-letter">${String.fromCharCode(65 + index)}</span>
          <span>${escapeHtml(answer || '(brak odpowiedzi)')}</span>
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

  function goToQuestionId(id) {
    if (!byId.has(Number(id))) return false;
    goToIndex(byId.get(Number(id)));
    return true;
  }

  function jumpToId() {
    const id = Number(els.jumpInput.value);

    if (!goToQuestionId(id)) {
      setStatus(
        `Nie ma aktywnego pytania o ID ${Number.isFinite(id) ? id : '—'}.`,
        'error'
      );
      els.jumpInput.focus();
      return;
    }

    setStatus('', '');
  }

  async function loadSummary() {
    if (!hasConfig()) return;

    try {
      const rows = await restGet(
        reviewsTable,
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

    els.reviewsList.innerHTML = '<p class="muted">Ładowanie opinii…</p>';

    try {
      const rows = await restGet(
        reviewsTable,
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
              ${review.contact ? `<span>${escapeHtml(review.contact)}</span>` : ''}
            </div>
            <time>${escapeHtml(date)}</time>
          </header>

          <div class="review-chips">
            <span class="chip ${statusClass}">
              Status: ${escapeHtml(statusLabel(review.status))}
            </span>
            <span class="chip">Fajność: ${escapeHtml(review.coolness)}/5</span>
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

  function selectedRadio(name, root = els.reviewForm) {
    return root.querySelector(`input[name="${name}"]:checked`)?.value;
  }

  function checked(name) {
    return Boolean(els.reviewForm.querySelector(`input[name="${name}"]`)?.checked);
  }

  async function submitReview(event) {
    event.preventDefault();

    if (!hasConfig()) return;

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
    setStatus('Zapisywanie opinii…', 'working');

    try {
      await restInsert(reviewsTable, payload);
      setStatus('Opinia zapisana ✓', 'success');
      resetPerQuestionForm();
      await Promise.all([loadReviews(), loadSummary()]);
    } catch (error) {
      setStatus(`Nie zapisano opinii: ${error.message}`, 'error');
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
      localStorage.setItem('jsmAdminReviewerName', els.reviewerName.value);
    });

    els.contact.addEventListener('input', () => {
      localStorage.setItem('jsmAdminContact', els.contact.value);
    });
  }

  function editorCorrectValue() {
    const value = selectedRadio('qCorrect', els.editorForm);
    return value === undefined ? null : Number(value);
  }

  function editorData() {
    return {
      author: els.qAuthor.value.trim(),
      category: els.qCategory.value.trim(),
      difficulty: els.qDifficulty.value,
      question: els.qQuestion.value.trim(),
      answer_a: els.qAnswerA.value.trim(),
      answer_b: els.qAnswerB.value.trim(),
      answer_c: els.qAnswerC.value.trim(),
      correct: editorCorrectValue(),
      explanation: els.qExplanation.value.trim(),
      image_url: els.qImageUrl.value.trim() || null,
    };
  }

  function validateQuestion(data, strict) {
    const errors = [];

    if (!strict) {
      if (!data.author) errors.push('Wpisz autora.');
      return errors;
    }

    if (!data.author) errors.push('Wpisz autora.');
    if (!data.category) errors.push('Wybierz lub wpisz kategorię.');
    if (!data.difficulty) errors.push('Wybierz trudność.');
    if (!data.question) errors.push('Wpisz treść pytania.');
    if (!data.answer_a) errors.push('Wpisz odpowiedź A.');
    if (!data.answer_b) errors.push('Wpisz odpowiedź B.');
    if (!data.answer_c) errors.push('Wpisz odpowiedź C.');

    const nonemptyAnswers = [data.answer_a, data.answer_b, data.answer_c]
      .map(value => value.trim().toLocaleLowerCase('pl'));

    if (nonemptyAnswers.filter(Boolean).length === 3 &&
        new Set(nonemptyAnswers).size !== 3) {
      errors.push('Odpowiedzi A, B i C muszą być różne.');
    }

    if (![0, 1, 2].includes(data.correct)) {
      errors.push('Wskaż poprawną odpowiedź A, B lub C.');
    }

    if (!data.explanation) errors.push('Dodaj wyjaśnienie poprawnej odpowiedzi.');

    return errors;
  }

  function showEditorErrors(errors) {
    if (!errors.length) {
      els.editorValidation.hidden = true;
      els.editorValidation.innerHTML = '';
      return;
    }

    els.editorValidation.hidden = false;
    els.editorValidation.innerHTML = `
      <strong>Uzupełnij przed zapisaniem:</strong>
      <ul>${errors.map(error => `<li>${escapeHtml(error)}</li>`).join('')}</ul>
    `;
  }

  function clearEditorObjectUrl() {
    if (editorPreviewObjectUrl) {
      URL.revokeObjectURL(editorPreviewObjectUrl);
      editorPreviewObjectUrl = null;
    }
  }

  function updateEditorImagePreview() {
    clearEditorObjectUrl();

    const file = els.qImageFile.files?.[0];
    let src = '';

    if (file) {
      editorPreviewObjectUrl = URL.createObjectURL(file);
      src = editorPreviewObjectUrl;
    } else if (els.qImageUrl.value.trim()) {
      src = resolveImage(els.qImageUrl.value.trim());
    }

    if (src) {
      els.editorImagePreview.src = src;
      els.editorImagePreviewWrap.hidden = false;
    } else {
      els.editorImagePreview.removeAttribute('src');
      els.editorImagePreviewWrap.hidden = true;
    }
  }

  function openNewQuestionEditor() {
    if (!hasConfig()) return;

    editingQuestionId = null;
    els.editorForm.reset();

    const nextId = getNextQuestionId();

    els.editorTitle.textContent = `Nowe pytanie ${nextId}`;
    els.editorQuestionId.textContent =
      `Planowane ID ${nextId} • wyliczone jako najwyższe istniejące ID + 1`;
    els.qStatusDisplay.value = 'Nowy szkic';
    els.qAuthor.value =
      localStorage.getItem('jsmQuestionAuthor') ||
      els.reviewerName.value.trim() ||
      'ChatGPT';

    els.archiveQuestionBtn.hidden = true;
    els.testPreview.hidden = true;
    showEditorErrors([]);
    updateEditorImagePreview();
    els.editor.showModal();
  }

  function openEditQuestionEditor(question) {
    if (!question || question.__source !== 'supabase') return;

    editingQuestionId = Number(question.id);
    els.editorForm.reset();
    els.editorTitle.textContent = `Edytuj pytanie ${question.id}`;
    els.editorQuestionId.textContent = `ID ${question.id} • rekord w Supabase`;
    els.qAuthor.value = question.author || '';
    els.qCategory.value = question.category || '';
    els.qDifficulty.value = question.difficulty || '';
    els.qStatusDisplay.value = statusLabel(question.status);
    els.qQuestion.value = question.question || '';
    els.qImageUrl.value = question.image || '';
    els.qAnswerA.value = question.answers?.[0] || '';
    els.qAnswerB.value = question.answers?.[1] || '';
    els.qAnswerC.value = question.answers?.[2] || '';
    els.qExplanation.value = question.explanation || '';

    const correctRadio = els.editorForm.querySelector(
      `input[name="qCorrect"][value="${Number(question.correct)}"]`
    );
    if (correctRadio) correctRadio.checked = true;

    els.archiveQuestionBtn.hidden = question.status === 'archived';
    els.testPreview.hidden = true;
    showEditorErrors([]);
    updateEditorImagePreview();
    els.editor.showModal();
  }

  function renderTestPreview() {
    const data = editorData();

    els.testPreviewQuestion.textContent = data.question || '(brak treści)';
    els.testPreviewAnswers.innerHTML = [
      data.answer_a,
      data.answer_b,
      data.answer_c,
    ].map((answer, index) => `
      <div class="answer-row ${index === data.correct ? 'is-correct' : ''}">
        <span class="answer-letter">${String.fromCharCode(65 + index)}</span>
        <span>${escapeHtml(answer || '(brak odpowiedzi)')}</span>
      </div>
    `).join('');

    const file = els.qImageFile.files?.[0];
    const imageSrc = file && editorPreviewObjectUrl
      ? editorPreviewObjectUrl
      : (data.image_url ? resolveImage(data.image_url) : '');

    if (imageSrc) {
      els.testPreviewImage.src = imageSrc;
      els.testPreviewImageWrap.hidden = false;
    } else {
      els.testPreviewImage.removeAttribute('src');
      els.testPreviewImageWrap.hidden = true;
    }

    els.testPreview.hidden = !els.testPreview.hidden;

    if (!els.testPreview.hidden) {
      els.testPreview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function slugifyFilename(name) {
    const dot = name.lastIndexOf('.');
    const base = dot >= 0 ? name.slice(0, dot) : name;
    const ext = dot >= 0 ? name.slice(dot).toLowerCase() : '';

    const safe = base
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'image';

    return safe + ext;
  }

  async function uploadQuestionImage(questionId, file) {
    const path = `${questionId}/${Date.now()}-${slugifyFilename(file.name)}`;
    const encodedPath = path.split('/').map(encodeURIComponent).join('/');

    const response = await fetch(
      `${supabaseUrl}/storage/v1/object/${imageBucket}/${encodedPath}`,
      {
        method: 'POST',
        headers: supabaseHeaders({
          'Content-Type': file.type || 'application/octet-stream',
          'x-upsert': 'false',
        }),
        body: file,
      }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        data?.message ||
        data?.error ||
        `Nie udało się wgrać obrazka (HTTP ${response.status}).`
      );
    }

    return `${supabaseUrl}/storage/v1/object/public/${imageBucket}/${encodedPath}`;
  }

  async function saveEditorQuestion(targetStatus) {
    if (!hasConfig()) return;

    const data = editorData();
    const strict = targetStatus !== 'draft';
    const errors = validateQuestion(data, strict);

    showEditorErrors(errors);
    if (errors.length) return;

    localStorage.setItem('jsmQuestionAuthor', data.author);

    const buttons = [
      els.saveDraftBtn,
      els.sendReviewBtn,
      els.publishQuestionBtn,
      els.archiveQuestionBtn,
    ];
    buttons.forEach(button => button.disabled = true);

    setStatus('Zapisywanie pytania…', 'working');

    try {
      let savedRow;

      if (editingQuestionId === null) {
        // ID uwzględnia zarówno aktualny questions.js, jak i pytania
        // robocze zapisane już w Supabase.
        let newId = getNextQuestionId();
        let inserted = null;

        // Jeśli dwóch adminów spróbuje dodać pytanie równocześnie,
        // konflikt ID powoduje odświeżenie bazy i ponowną próbę.
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            inserted = await restInsert(questionsTable, {
              id: newId,
              ...data,
              status: targetStatus,
            });
            break;
          } catch (error) {
            const message = String(error?.message || '');

            if (
              !message.toLowerCase().includes('duplicate') &&
              !message.toLowerCase().includes('unique') &&
              !message.includes('23505')
            ) {
              throw error;
            }

            await loadDatabaseQuestions();
            newId = getNextQuestionId();
          }
        }

        if (!inserted?.[0]) {
          throw new Error(
            'Nie udało się nadać wolnego ID pytania. Odśwież panel i spróbuj ponownie.'
          );
        }

        savedRow = inserted[0];
        editingQuestionId = Number(savedRow.id);
      } else {
        const updated = await restUpdate(
          questionsTable,
          `id=eq.${encodeURIComponent(editingQuestionId)}`,
          {
            ...data,
            status: targetStatus,
          }
        );

        if (!updated[0]) {
          throw new Error('Nie znaleziono pytania do aktualizacji.');
        }

        savedRow = updated[0];
      }

      const file = els.qImageFile.files?.[0];

      if (file) {
        setStatus('Wgrywanie obrazka…', 'working');
        const imageUrl = await uploadQuestionImage(editingQuestionId, file);

        const updated = await restUpdate(
          questionsTable,
          `id=eq.${encodeURIComponent(editingQuestionId)}`,
          { image_url: imageUrl }
        );

        savedRow = updated[0] || { ...savedRow, image_url: imageUrl };
      }

      await loadDatabaseQuestions();

      const savedId = Number(savedRow.id);
      els.editor.close();
      clearEditorObjectUrl();

      goToQuestionId(savedId);
      setStatus(
        `Pytanie ${savedId} zapisane jako „${statusLabel(targetStatus)}” ✓`,
        'success'
      );
    } catch (error) {
      setStatus(`Nie zapisano pytania: ${error.message}`, 'error');
    } finally {
      buttons.forEach(button => button.disabled = false);
    }
  }

  async function archiveEditingQuestion() {
    if (editingQuestionId === null) return;

    const confirmed = window.confirm(
      `Zarchiwizować pytanie ${editingQuestionId}? Nie trafi do kolejnego eksportu.`
    );

    if (!confirmed) return;

    await saveEditorQuestion('archived');
  }

  function exportableQuestion(q) {
    const result = {
      id: Number(q.id),
      author: q.author || '',
      category: q.category || '',
      difficulty: q.difficulty || '',
      question: q.question || '',
      answers: [
        q.answers?.[0] || '',
        q.answers?.[1] || '',
        q.answers?.[2] || '',
      ],
      correct: Number(q.correct),
      explanation: q.explanation || '',
    };

    if (q.image) result.image = q.image;

    return result;
  }

  function exportQuestionsJs() {
    if (!hasConfig()) return;

    const merged = new Map(
      staticQuestions.map(q => [Number(q.id), exportableQuestion(q)])
    );

    for (const q of databaseQuestions) {
      const id = Number(q.id);

      if (q.status === 'published') {
        merged.set(id, exportableQuestion(q));
      } else if (q.status === 'archived') {
        // Jeśli pytanie było już kiedyś wyeksportowane, archiwizacja usuwa je
        // z następnej generowanej wersji questions.js.
        merged.delete(id);
      }
      // draft / review nie trafiają do testu. Jeżeli istnieje ich starsza
      // wersja w static questions.js, zostawiamy tę opublikowaną wersję.
    }

    const exported = [...merged.values()]
      .sort((a, b) => Number(a.id) - Number(b.id));

    const header = `/*
  BAZA PYTAŃ JSM
  Wygenerowano z panelu administracyjnego: ${new Date().toLocaleString('pl-PL')}

  Pytania ze statusem "Opublikowane" z Supabase zostały połączone
  z aktualną bazą questions.js. Szkice i pytania "Do oceny" nie są eksportowane.
*/

window.QUESTIONS = `;

    const content = `${header}${JSON.stringify(exported, null, 2)};\n`;
    const blob = new Blob([content], {
      type: 'text/javascript;charset=utf-8'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'questions.js';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    setStatus(
      `Wyeksportowano ${exported.length} pytań do questions.js ✓`,
      'success'
    );
  }

  function bindEvents() {
    els.prevBtn.addEventListener('click', () => goToIndex(currentIndex - 1));
    els.nextBtn.addEventListener('click', () => goToIndex(currentIndex + 1));
    els.jumpBtn.addEventListener('click', jumpToId);

    els.jumpInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        jumpToId();
      }
    });

    els.refreshReviewsBtn.addEventListener('click', async () => {
      await Promise.all([loadReviews(), loadSummary()]);
    });

    els.reviewForm.addEventListener('submit', submitReview);

    els.reviewForm
      .querySelectorAll('input[name="status"]')
      .forEach(radio => {
        radio.addEventListener('change', () => {
          const showChanges = selectedRadio('status') === 'needs_changes';
          els.changesSection.hidden = !showChanges;

          if (!showChanges) {
            els.changesSection
              .querySelectorAll('input[type="checkbox"]')
              .forEach(input => input.checked = false);

            els.changesSection
              .querySelectorAll('textarea')
              .forEach(textarea => textarea.value = '');
          }
        });
      });

    els.newQuestionBtn.addEventListener('click', openNewQuestionEditor);
    els.exportQuestionsBtn.addEventListener('click', exportQuestionsJs);
    els.editQuestionBtn.addEventListener(
      'click',
      () => openEditQuestionEditor(currentQuestion())
    );

    els.closeEditorBtn.addEventListener('click', () => els.editor.close());

    els.editor.addEventListener('close', () => {
      clearEditorObjectUrl();
      els.qImageFile.value = '';
    });

    els.qImageUrl.addEventListener('input', updateEditorImagePreview);
    els.qImageFile.addEventListener('change', updateEditorImagePreview);

    els.previewQuestionBtn.addEventListener('click', renderTestPreview);
    els.saveDraftBtn.addEventListener('click', () => saveEditorQuestion('draft'));
    els.sendReviewBtn.addEventListener('click', () => saveEditorQuestion('review'));
    els.publishQuestionBtn.addEventListener('click', () => saveEditorQuestion('published'));
    els.archiveQuestionBtn.addEventListener('click', archiveEditingQuestion);

    document.addEventListener('keydown', event => {
      if (els.editor.open) return;

      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) return;

      if (event.altKey && event.key === 'ArrowLeft') {
        goToIndex(currentIndex - 1);
      }

      if (event.altKey && event.key === 'ArrowRight') {
        goToIndex(currentIndex + 1);
      }
    });
  }

  function initialQuestionIdFromHash() {
    const match = location.hash.match(/q=(\d+)/);
    return match ? Number(match[1]) : null;
  }

  async function init() {
    if (!staticQuestions.length) {
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

    if (!hasConfig()) {
      databaseQuestions = [];
      rebuildQuestionList();
      currentIndex = 0;
      renderQuestion();
      showSetupError('W pliku config.js są jeszcze wartości przykładowe.');
      return;
    }

    clearSetupError();
    setStatus('Ładowanie bazy roboczej…', 'working');

    try {
      await Promise.all([
        loadDatabaseQuestions(),
        loadSummary(),
      ]);

      const requestedId = initialQuestionIdFromHash();
      currentIndex = requestedId && byId.has(requestedId)
        ? byId.get(requestedId)
        : 0;

      renderQuestion();
      setStatus('', '');
    } catch (error) {
      databaseQuestions = [];
      rebuildQuestionList();
      currentIndex = 0;
      renderQuestion();

      showSetupError(
        `Nie udało się odczytać nowych tabel: ${error.message}`
      );
      setStatus('', '');
    }
  }

  init();
})();
