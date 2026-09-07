(() => {
  'use strict';

  const config = window.JSM_ADMIN_CONFIG || {};
  const supabaseUrl = String(config.supabaseUrl || '').replace(/\/+$/, '');
  const supabaseKey = String(config.supabaseAnonKey || '');
  const tableName = 'jsm_question_reports';

  const form = document.getElementById('reportForm');
  const questionId = document.getElementById('questionId');
  const message = document.getElementById('message');
  const contact = document.getElementById('contact');
  const submitBtn = document.getElementById('submitBtn');
  const status = document.getElementById('status');
  const setupWarning = document.getElementById('setupWarning');
  const backToTestLink = document.getElementById('backToTestLink');

  const params = new URLSearchParams(location.search);
  const idFromUrl = Number(params.get('question'));

  if (Number.isInteger(idFromUrl) && idFromUrl > 0) {
    questionId.value = idFromUrl;

    if (backToTestLink) {
      backToTestLink.textContent = `← Wróć do pytania ${idFromUrl}`;
    }
  }

  function configured() {
    return (
      /^https:\/\/.+\.supabase\.co$/i.test(supabaseUrl) &&
      supabaseKey.length > 20 &&
      !supabaseUrl.includes('TWOJ-PROJEKT') &&
      !supabaseKey.includes('WKLEJ_TUTAJ')
    );
  }

  function setStatus(text, type = '') {
    status.textContent = text;
    status.className = `status ${type}`;
  }

  if (!configured()) {
    setupWarning.hidden = false;
    setupWarning.textContent =
      'Formularz nie jest jeszcze połączony z bazą zgłoszeń.';
    submitBtn.disabled = true;
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();

    if (!configured() || !form.reportValidity()) return;

    const payload = {
      question_id: Number(questionId.value),
      message: message.value.trim(),
      contact: contact.value.trim() || null,
    };

    submitBtn.disabled = true;
    setStatus('Wysyłanie…');

    try {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/${tableName}`,
        {
          method: 'POST',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.message || data?.hint || `HTTP ${response.status}`
        );
      }

      const preservedId = questionId.value;
      form.reset();
      questionId.value = preservedId;

      setStatus(
        'Dziękujemy. Zgłoszenie zostało zapisane.',
        'success'
      );
    } catch (error) {
      setStatus(
        `Nie udało się wysłać zgłoszenia: ${error.message}`,
        'error'
      );
    } finally {
      submitBtn.disabled = false;
    }
  });
})();
