(() => {
  'use strict';

  const config = window.JSM_ADMIN_CONFIG || {};
  const supabaseUrl = String(config.supabaseUrl || '').replace(/\/+$/, '');
  const supabaseKey = String(config.supabaseAnonKey || '');
  const tableName = 'jsm_question_reports';

  const els = {
    refreshBtn: document.getElementById('refreshBtn'),
    questionFilter: document.getElementById('questionFilter'),
    textFilter: document.getElementById('textFilter'),
    sortSelect: document.getElementById('sortSelect'),
    resolvedFilter: document.getElementById('resolvedFilter'),
    stats: document.getElementById('stats'),
    status: document.getElementById('status'),
    reportsList: document.getElementById('reportsList'),
    emptyTemplate: document.getElementById('emptyTemplate'),
  };

  let allReports = [];

  function configured() {
    return (
      /^https:\/\/.+\.supabase\.co$/i.test(supabaseUrl) &&
      supabaseKey.length > 20 &&
      !supabaseUrl.includes('TWOJ-PROJEKT') &&
      !supabaseKey.includes('WKLEJ_TUTAJ')
    );
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function setStatus(text, type = '') {
    els.status.textContent = text;
    els.status.className = `status ${type}`;
  }

  async function fetchReports() {
    if (!configured()) {
      setStatus('Brak poprawnej konfiguracji Supabase w ../admin/config.js.', 'error');
      return;
    }

    els.refreshBtn.disabled = true;
    setStatus('Ładowanie zgłoszeń…');

    try {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/${tableName}` +
        '?select=id,question_id,message,contact,created_at,resolved,resolved_at&order=created_at.desc',
        {
          method: 'GET',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            Accept: 'application/json',
          },
          cache: 'no-store',
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.message || data?.hint || `HTTP ${response.status}`
        );
      }

      allReports = Array.isArray(data) ? data : [];
      render();
      setStatus('');
    } catch (error) {
      allReports = [];
      render();
      setStatus(`Nie udało się pobrać zgłoszeń: ${error.message}`, 'error');
    } finally {
      els.refreshBtn.disabled = false;
    }
  }

  function filteredReports() {
    const questionId = Number(els.questionFilter.value);
    const hasQuestionId = Number.isInteger(questionId) && questionId > 0;
    const search = els.textFilter.value.trim().toLocaleLowerCase('pl');
    const resolvedFilter = els.resolvedFilter.value;

    let items = allReports.filter(report => {
      if (hasQuestionId && Number(report.question_id) !== questionId) {
        return false;
      }

      if (resolvedFilter === 'open' && report.resolved === true) {
        return false;
      }

      if (resolvedFilter === 'resolved' && report.resolved !== true) {
        return false;
      }

      if (search) {
        const haystack = [
          report.message,
          report.contact,
          report.question_id,
        ].join(' ').toLocaleLowerCase('pl');

        if (!haystack.includes(search)) return false;
      }

      return true;
    });

    const sort = els.sortSelect.value;

    if (sort === 'oldest') {
      items = [...items].sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
      );
    } else if (sort === 'question') {
      items = [...items].sort(
        (a, b) =>
          Number(a.question_id) - Number(b.question_id) ||
          new Date(b.created_at) - new Date(a.created_at)
      );
    } else {
      items = [...items].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );
    }

    return items;
  }

  function renderStats(items) {
    const uniqueQuestions = new Set(
      items.map(report => Number(report.question_id))
    );

    const withContact = items.filter(
      report => String(report.contact || '').trim()
    ).length;
    const resolved = items.filter(report => report.resolved === true).length;

    els.stats.innerHTML = `
      <span class="stat-chip">${items.length} zgłoszeń</span>
      <span class="stat-chip">${uniqueQuestions.size} pytań</span>
      <span class="stat-chip">${withContact} z kontaktem</span>
      <span class="stat-chip">${resolved} rozpatrzonych</span>
    `;
  }

  async function setReportResolved(report, resolved) {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/${tableName}?id=eq.${encodeURIComponent(report.id)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          resolved,
          resolved_at: resolved ? new Date().toISOString() : null,
        }),
      }
    );

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.message || data?.hint || `HTTP ${response.status}`);
    }
  }

  function render() {
    const items = filteredReports();
    renderStats(items);

    if (!items.length) {
      els.reportsList.innerHTML = '';
      els.reportsList.appendChild(
        els.emptyTemplate.content.cloneNode(true)
      );
      return;
    }

    els.reportsList.innerHTML = items.map(report => {
      const id = Number(report.question_id);
      const date = report.created_at
        ? new Date(report.created_at).toLocaleString('pl-PL')
        : '—';
      const resolved = report.resolved === true;
      const resolvedDate = report.resolved_at
        ? new Date(report.resolved_at).toLocaleString('pl-PL')
        : '';

      return `
        <article class="report-card ${resolved ? 'is-resolved' : ''}" data-report-id="${escapeHtml(report.id)}">
          <header class="report-header">
            <div class="report-question">
              <span class="question-id">Pytanie ID ${escapeHtml(id)}</span>
              <a class="admin-link" href="../admin/#q=${encodeURIComponent(id)}">
                otwórz w panelu admina ↗
              </a>
            </div>
            <div class="report-header-right">
              <time>${escapeHtml(date)}</time>
              <label class="resolved-toggle">
                <input
                  type="checkbox"
                  class="resolved-checkbox"
                  ${resolved ? 'checked' : ''}
                >
                <span>Rozpatrzone</span>
              </label>
              ${resolvedDate ? `<small class="resolved-date">Rozpatrzono: ${escapeHtml(resolvedDate)}</small>` : ''}
            </div>
          </header>

          <p class="message">${escapeHtml(report.message)}</p>

          ${
            report.contact
              ? `
                <div class="contact">
                  <strong>Kontakt:</strong>
                  ${escapeHtml(report.contact)}
                </div>
              `
              : ''
          }
        </article>
      `;
    }).join('');
  }

  els.refreshBtn.addEventListener('click', fetchReports);
  els.questionFilter.addEventListener('input', render);
  els.textFilter.addEventListener('input', render);
  els.sortSelect.addEventListener('change', render);
  els.resolvedFilter.addEventListener('change', render);

  els.reportsList.addEventListener('change', async event => {
    const checkbox = event.target.closest('.resolved-checkbox');
    if (!checkbox) return;

    const card = checkbox.closest('.report-card');
    const reportId = Number(card?.dataset.reportId);
    const report = allReports.find(item => Number(item.id) === reportId);
    if (!report) return;

    checkbox.disabled = true;
    setStatus(checkbox.checked ? 'Zaznaczanie zgłoszenia jako rozpatrzone…' : 'Oznaczanie zgłoszenia jako nierozpatrzone…');

    try {
      await setReportResolved(report, checkbox.checked);
      report.resolved = checkbox.checked;
      report.resolved_at = checkbox.checked ? new Date().toISOString() : null;
      setStatus('');
      render();
    } catch (error) {
      checkbox.checked = !checkbox.checked;
      setStatus(`Nie udało się zmienić statusu zgłoszenia: ${error.message}`, 'error');
    } finally {
      checkbox.disabled = false;
    }
  });

  fetchReports();
})();
