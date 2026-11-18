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
  const questionIdError = document.getElementById('questionIdError');
  const status = document.getElementById('status');
  const setupWarning = document.getElementById('setupWarning');
  const backToTestLink = document.getElementById('backToTestLink');
  const formHeader = document.getElementById('formHeader');
  const successScreen = document.getElementById('successScreen');
  const successTitle = document.getElementById('successTitle');
  const successBackLink = document.getElementById('successBackLink');

  const params = new URLSearchParams(location.search);
  const idFromUrl = Number(params.get('question'));

  let testPosition = null;

  // Numer w teście pobieramy z zapisanego stanu, aby nie pomylić go z ID w bazie.
  try {
    const saved = JSON.parse(sessionStorage.getItem('jsmTestState') || 'null');
    if (saved && Array.isArray(saved.questionIds) &&
        Number(saved.questionIds[saved.current]) === idFromUrl) {
      testPosition = {
        number: saved.current + 1,
        total: saved.questionIds.length,
      };
    }
  } catch (error) {
    console.warn('Nie udało się odczytać pozycji pytania w teście:', error);
  }

  if (Number.isInteger(idFromUrl) && idFromUrl > 0) {
    questionId.value = idFromUrl;

    if (testPosition) {
      backToTestLink.textContent = `← Wróć do pytania ${testPosition.number}`;
      successBackLink.textContent = `← Wróć do pytania ${testPosition.number}`;
    }
  }

  const validQuestionIds = new Set(
    Array.isArray(window.QUESTIONS)
      ? window.QUESTIONS.map(q => Number(q.id))
      : []
  );

  function validateQuestionId() {
    const value = Number(questionId.value);
    const valid = Number.isSafeInteger(value) && value > 0 &&
      validQuestionIds.has(value);
    questionIdError.hidden = valid || !questionId.value.trim();
    questionIdError.textContent = valid ? '' :
      'Nie znaleziono pytania o takim ID w bazie. Sprawdź numer.';
    questionId.setCustomValidity(valid ? '' : 'Podaj ID istniejącego pytania.');
    return valid;
  }

  questionId.addEventListener('input', validateQuestionId);
  validateQuestionId();

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

  function showSuccess() {
    form.hidden = true;
    formHeader.hidden = true;
    setupWarning.hidden = true;
    successScreen.hidden = false;
    successTitle.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (!configured()) {
    setupWarning.hidden = false;
    setupWarning.textContent =
      'Formularz nie jest jeszcze połączony z bazą zgłoszeń.';
    submitBtn.disabled = true;
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();

    if (!configured() || !validateQuestionId() || !form.reportValidity()) {
      if (configured()) form.reportValidity();
      return;
    }

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

      showSuccess();
    } catch (error) {
      console.error('Błąd wysyłania zgłoszenia:', error);
      setStatus(
        'Nie udało się potwierdzić wysłania zgłoszenia. Twoja treść została zachowana. Sprawdź połączenie i spróbuj ponownie. Jeśli problem się powtórzy, wróć do testu i spróbuj później.',
        'error'
      );
      submitBtn.textContent = 'Spróbuj ponownie';
    } finally {
      submitBtn.disabled = false;
    }
  });
})();
