(() => {
  'use strict';

  const questions = Array.isArray(window.QUESTIONS)
    ? [...window.QUESTIONS].sort((a, b) => Number(a.id) - Number(b.id))
    : [];

  const byId = new Map(questions.map((q, index) => [Number(q.id), index]));
  const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';

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
  };

  let currentIndex = 0;
  let summary = {};

  function currentQuestion() {
    return questions[currentIndex];
  }

  function resolveImage(src) {
    if (!src) return '';
    if (/^(?:https?:|data:|\/)/i.test(src)) return src;
    return `../${src}`;
  }

  function reviewStatus(review) {
    return ['approved', 'needs_changes', 'delete'].includes(review?.status)
      ? review.status
      : '';
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
    const mod10 = n % 10, mod100 = n % 100;
    if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return `${n} opinie`;
    return `${n} opinii`;
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
      ['Poprawna odpowiedź', Number.isInteger(q.correct) ? String.fromCharCode(65 + q.correct) : '—'],
      ['Obrazek', q.image ?? 'brak'],
    ];
    els.metadata.innerHTML = metaRows.map(([k, v]) =>
      `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`
    ).join('');

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

    els.answersList.innerHTML = (q.answers || []).map((answer, i) => {
      const correct = i === Number(q.correct);
      return `<div class="answer-row ${correct ? 'is-correct' : ''}">
        <span class="answer-letter">${String.fromCharCode(65 + i)}</span>
        <span>${escapeHtml(answer)}</span>
        ${correct ? '<span class="correct-chip">poprawna</span>' : ''}
      </div>`;
    }).join('');

    updateSummaryBadge();
    resetPerQuestionForm();
    loadReviews();
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
      setStatus(`Nie ma pytania o ID ${Number.isFinite(id) ? id : '—'}.`, 'error');
      els.jumpInput.focus();
      return;
    }
    setStatus('', '');
    goToIndex(byId.get(id));
  }

  async function apiGet(url) {
    const res = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || `Błąd HTTP ${res.status}`);
    return data;
  }

  async function loadSummary() {
    try {
      const data = await apiGet('api.php?action=summary');
      summary = data.summary || {};
      updateSummaryBadge();
    } catch (err) {
      setStatus(`Nie udało się wczytać podsumowania opinii: ${err.message}`, 'error');
    }
  }

  function updateSummaryBadge() {
    const q = currentQuestion();
    const count = Number(summary?.[q?.id]?.count || 0);
    els.reviewCountBadge.textContent = pluralReviews(count);
  }

  async function loadReviews() {
    const q = currentQuestion();
    if (!q) return;
    els.reviewsList.innerHTML = '<p class="muted">Ładowanie opinii…</p>';
    try {
      const data = await apiGet(`api.php?action=reviews&question_id=${encodeURIComponent(q.id)}`);
      renderReviews(data.reviews || []);
      summary[q.id] = summary[q.id] || {};
      summary[q.id].count = data.reviews?.length || 0;
      updateSummaryBadge();
    } catch (err) {
      els.reviewsList.innerHTML = `<p class="error-text">${escapeHtml(err.message)}</p>`;
      els.reviewStats.innerHTML = '';
    }
  }

  function renderReviews(reviews) {
    if (!reviews.length) {
      els.reviewStats.innerHTML = '';
      els.reviewsList.innerHTML = '<div class="empty-state">To pytanie nie ma jeszcze żadnej opinii.</div>';
      return;
    }

    const approved = reviews.filter(r => reviewStatus(r) === 'approved').length;
    const needsChanges = reviews.filter(r => reviewStatus(r) === 'needs_changes').length;
    const toDelete = reviews.filter(r => reviewStatus(r) === 'delete').length;
    const avg = reviews.reduce((sum, r) => sum + Number(r.coolness || 0), 0) / reviews.length;

    els.reviewStats.innerHTML = `
      <div><strong>${reviews.length}</strong><span>opinii</span></div>
      <div><strong>${approved}</strong><span>zatwierdza</span></div>
      <div><strong>${needsChanges}</strong><span>do poprawy</span></div>
      <div><strong>${toDelete}</strong><span>do usunięcia</span></div>
      <div><strong>${avg.toFixed(1)}</strong><span>średnia ★</span></div>
    `;

    const changeLabels = {
      text: 'tekst pytania', image: 'obrazek', answer_a: 'odp. A', answer_b: 'odp. B',
      answer_c: 'odp. C', difficulty: 'trudność', category: 'kategoria', explanation: 'wyjaśnienie'
    };

    els.reviewsList.innerHTML = reviews.map(r => {
      const selectedChanges = Object.entries(r.changes || {})
        .filter(([, value]) => Boolean(value))
        .map(([key]) => changeLabels[key] || key);
      const date = r.created_at ? new Date(r.created_at).toLocaleString('pl-PL') : '—';
      const status = reviewStatus(r);
      const statusClass = status === 'approved' ? 'good' : (status === 'delete' ? 'bad' : 'warn');
      return `<article class="review-entry">
        <header>
          <div><strong>${escapeHtml(r.reviewer_name)}</strong>${r.contact ? `<span>${escapeHtml(r.contact)}</span>` : ''}</div>
          <time>${escapeHtml(date)}</time>
        </header>
        <div class="review-chips">
          <span class="chip ${statusClass}">Status: ${escapeHtml(statusLabel(status))}</span>
          <span class="chip">Fajność: ${escapeHtml(r.coolness)}/5</span>
        </div>
        ${selectedChanges.length ? `<p><strong>Do zmiany:</strong> ${escapeHtml(selectedChanges.join(', '))}</p>` : ''}
        ${r.change_details ? `<div class="comment-block"><strong>Co zmienić</strong><p>${escapeHtml(r.change_details)}</p></div>` : ''}
        ${r.general_comment ? `<div class="comment-block"><strong>Komentarz</strong><p>${escapeHtml(r.general_comment)}</p></div>` : ''}
      </article>`;
    }).join('');
  }

  function selectedRadio(name) {
    return els.reviewForm.querySelector(`input[name="${name}"]:checked`)?.value;
  }

  function checked(name) {
    return Boolean(els.reviewForm.querySelector(`input[name="${name}"]`)?.checked);
  }

  async function submitReview(event) {
    event.preventDefault();
    if (!els.reviewForm.reportValidity()) return;
    const q = currentQuestion();
    const formData = new FormData(els.reviewForm);

    const payload = {
      question_id: q.id,
      reviewer_name: els.reviewerName.value.trim(),
      contact: els.contact.value.trim(),
      status: selectedRadio('status'),
      coolness: selectedRadio('coolness'),
      changes: {
        text: checked('change_text'),
        image: checked('change_image'),
        answer_a: checked('change_answer_a'),
        answer_b: checked('change_answer_b'),
        answer_c: checked('change_answer_c'),
        difficulty: checked('change_difficulty'),
        category: checked('change_category'),
        explanation: checked('change_explanation'),
      },
      change_details: String(formData.get('change_details') || ''),
      general_comment: String(formData.get('general_comment') || ''),
    };

    els.saveReviewBtn.disabled = true;
    setStatus('Zapisywanie…', 'working');
    try {
      const res = await fetch('api.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || `Błąd HTTP ${res.status}`);
      setStatus('Opinia zapisana ✓', 'success');
      resetPerQuestionForm();
      await loadReviews();
      await loadSummary();
    } catch (err) {
      setStatus(`Nie zapisano: ${err.message}`, 'error');
    } finally {
      els.saveReviewBtn.disabled = false;
    }
  }

  function setStatus(message, type) {
    els.saveStatus.textContent = message;
    els.saveStatus.className = `save-status ${type || ''}`;
  }

  function loadIdentity() {
    els.reviewerName.value = localStorage.getItem('jsmAdminReviewerName') || '';
    els.contact.value = localStorage.getItem('jsmAdminContact') || '';
    els.reviewerName.addEventListener('input', () => localStorage.setItem('jsmAdminReviewerName', els.reviewerName.value));
    els.contact.addEventListener('input', () => localStorage.setItem('jsmAdminContact', els.contact.value));
  }

  function bindEvents() {
    els.prevBtn.addEventListener('click', () => goToIndex(currentIndex - 1));
    els.nextBtn.addEventListener('click', () => goToIndex(currentIndex + 1));
    els.jumpBtn.addEventListener('click', jumpToId);
    els.jumpInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); jumpToId(); } });
    els.refreshReviewsBtn.addEventListener('click', loadReviews);
    els.reviewForm.addEventListener('submit', submitReview);

    els.reviewForm.querySelectorAll('input[name="status"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const showChanges = radio.checked && radio.value === 'needs_changes';
        els.changesSection.hidden = !showChanges;

        if (!showChanges) {
          els.changesSection.querySelectorAll('input[type="checkbox"]').forEach(input => {
            input.checked = false;
          });
          els.changesSection.querySelectorAll('textarea').forEach(textarea => {
            textarea.value = '';
          });
        }
      });
    });

    document.addEventListener('keydown', e => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.altKey && e.key === 'ArrowLeft') goToIndex(currentIndex - 1);
      if (e.altKey && e.key === 'ArrowRight') goToIndex(currentIndex + 1);
    });
  }

  function initialIndexFromHash() {
    const match = location.hash.match(/q=(\d+)/);
    if (match && byId.has(Number(match[1]))) return byId.get(Number(match[1]));
    return 0;
  }

  if (!questions.length) {
    document.body.innerHTML = '<main class="fatal"><h1>Nie znaleziono bazy pytań</h1><p>Panel oczekuje pliku <code>../questions.js</code>.</p></main>';
    return;
  }

  loadIdentity();
  bindEvents();
  currentIndex = initialIndexFromHash();
  renderQuestion();
  loadSummary();
})();
