const TEST_SIZE = 75;
const TEST_STATE_KEY = "jsmTestState";
const RETURN_CONTEXT_KEY = "jsmReturnToResult";
const RETURN_TO_QUIZ_KEY = "jsmReturnToQuiz";

const EXAMS = {
  zj: {
    short: "ŻJ",
    name: "Żeglarz Jachtowy",
  },
  jsm: {
    short: "JSM",
    name: "Jachtowy Sternik Morski",
  },
  sm: {
    short: "SM",
    name: "Sternik Motorowodny",
  },
  msm: {
    short: "MSM",
    name: "Motorowodny Sternik Morski",
  },
};

let testQuestions = [];
let current = 0;
let score = 0;
let answered = false;
let userAnswers = [];
let selectedExam = null;
let selectedCategory = null;

const questionMeta = document.getElementById("questionMeta");
const questionNumber = document.getElementById("questionNumber");
const questionText = document.getElementById("questionText");
const questionScroll = document.getElementById("questionScroll");
const questionImageContainer = document.getElementById("questionImageContainer");
const questionImage = document.getElementById("questionImage");
const answers = document.getElementById("answers");
const feedback = document.getElementById("feedback");
const nextBtn = document.getElementById("nextBtn");
const finishExamBtn = document.getElementById("finishExamBtn");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const quizArea = document.getElementById("quizArea");
const resultArea = document.getElementById("resultArea");
const scoreEl = document.getElementById("score");
const resultMessage = document.getElementById("resultMessage");
const restartBtn = document.getElementById("restartBtn");
const review = document.getElementById("review");
const startArea = document.getElementById("startArea");
const startError = document.getElementById("startError");
const startKicker = document.getElementById("startKicker");
const startHeading = document.getElementById("startHeading");
const startDescription = document.getElementById("startDescription");
const subtitle = document.getElementById("subtitle");
const mainTitle = document.getElementById("mainTitle");
const resultTitle = document.getElementById("resultTitle");
const changeExamBtn = document.getElementById("changeExamBtn");
const examChoiceButtons = [...document.querySelectorAll(".exam-choice")];
const sectionLearningBtn = document.getElementById("sectionLearningBtn");
const sectionSelector = document.getElementById("sectionSelector");
const sectionGrid = document.getElementById("sectionGrid");
const backToExamsBtn = document.getElementById("backToExamsBtn");
const examGrid = document.querySelector(".exam-grid");
const resumeArea = document.getElementById("resumeArea");
const resumeText = document.getElementById("resumeText");
const resumeBtn = document.getElementById("resumeBtn");
const discardBtn = document.getElementById("discardBtn");


// Przechowujemy test trwale w tej przeglądarce. Dane z poprzedniej wersji
// (sessionStorage) są jednorazowo migrowane do localStorage.
function readSavedTestState() {
  try {
    const currentState = localStorage.getItem(TEST_STATE_KEY);
    if (currentState) return JSON.parse(currentState);

    const legacy = sessionStorage.getItem(TEST_STATE_KEY);
    if (!legacy) return null;
    const parsed = JSON.parse(legacy);
    localStorage.setItem(TEST_STATE_KEY, legacy);
    sessionStorage.removeItem(TEST_STATE_KEY);
    return parsed;
  } catch (error) {
    console.warn("Nie udało się odczytać zapisanego testu:", error);
    return null;
  }
}

function saveTestState() {
  try {
    localStorage.setItem(TEST_STATE_KEY, JSON.stringify({
      exam: selectedExam,
      category: selectedCategory,
      questionIds: testQuestions.map(q => q.id),
      answerOrders: testQuestions.map(q => q.answerOrder),
      current,
      score,
      answered,
      userAnswers
    }));
  } catch (error) {
    console.warn("Nie udało się zapisać stanu testu:", error);
  }
}

function restoreTestState() {
  try {
    const saved = readSavedTestState();
    const savedCategory = typeof saved?.category === "string" && saved.category
      ? saved.category
      : null;
    const validExam = Boolean(saved && EXAMS[saved.exam] && !savedCategory);
    const validCategory = Boolean(savedCategory && !saved.exam &&
      window.QUESTIONS.some(q => q.category === savedCategory));
    if (!saved || (!validExam && !validCategory) ||
        !Array.isArray(saved.questionIds) || !saved.questionIds.length ||
        !Number.isInteger(saved.current) ||
        saved.current < 0 || saved.current >= saved.questionIds.length ||
        !Number.isInteger(saved.score) || saved.score < 0 ||
        !Array.isArray(saved.userAnswers) ||
        saved.userAnswers.length > saved.questionIds.length) return false;

    const questionMap = new Map(window.QUESTIONS.map(q => [Number(q.id), q]));
    const restoredQuestions = saved.questionIds.map(id => questionMap.get(Number(id)));
    if (restoredQuestions.some(q => !q ||
        (validExam ? q[saved.exam] !== true : q.category !== savedCategory))) return false;

    // Poprzednie wersje zapisu nie miały kolejności odpowiedzi.
    // Odtwarzamy je w pierwotnym układzie zamiast losować ponownie.
    if (saved.answerOrders !== undefined &&
        (!Array.isArray(saved.answerOrders) ||
         saved.answerOrders.length !== restoredQuestions.length)) return false;

    selectedExam = validExam ? saved.exam : null;
    selectedCategory = validCategory ? savedCategory : null;
    testQuestions = restoredQuestions.map((q, index) =>
      prepareQuestionForTest(
        q,
        saved.answerOrders === undefined
          ? q.answers.map((_, i) => i)
          : saved.answerOrders[index]
      )
    );
    current = saved.current;
    score = saved.score;
    userAnswers = saved.userAnswers;
    answered = Boolean(saved.answered);
    return true;
  } catch (error) {
    console.warn("Nie udało się odtworzyć stanu testu:", error);
    return false;
  }
}

function clearTestState() {
  try {
    localStorage.removeItem(TEST_STATE_KEY);
    sessionStorage.removeItem(TEST_STATE_KEY);
    sessionStorage.removeItem(RETURN_TO_QUIZ_KEY);
    sessionStorage.removeItem(RETURN_CONTEXT_KEY);
  } catch (error) {
    console.warn("Nie udało się wyczyścić stanu testu:", error);
  }
}

function showRestoredQuiz() {
  document.body.classList.remove("start-mode", "result-mode");
  document.body.classList.add("quiz-mode");
  startArea.style.display = "none";
  resultArea.style.display = "none";
  quizArea.style.display = "grid";
  setExamHeader();
  renderQuestion();
}

function showResumeChoice() {
  const saved = readSavedTestState();
  if (!saved || !restoreTestState()) {
    // Nie usuwamy niepoprawnego zapisu bez wiedzy użytkownika.
    showExamSelector(true);
    if (saved) startError.textContent =
      "Nie udało się odtworzyć poprzedniego testu (być może zmieniono bazę pytań). Możesz rozpocząć nowy.";
    return;
  }

  const examName = selectedCategory
    ? `Dział: ${selectedCategory}`
    : EXAMS[selectedExam].short;
  const count = testQuestions.length;
  const progress = Math.min(userAnswers.length, count);
  showExamSelector(true);
  resumeText.textContent = `${examName} • ${progress} z ${count} odpowiedzi. ` +
    `Ostatnie pytanie: ${current + 1} z ${count}.`;
  resumeArea.hidden = false;
}

function restoreAnsweredQuestionUI() {
  if (!answered) return;

  const q = testQuestions[current];
  const currentAnswer = userAnswers[current];

  if (!q || !currentAnswer) {
    answered = false;
    return;
  }

  const buttons = [...answers.querySelectorAll(".answer")];

  buttons.forEach((button, index) => {
    button.disabled = true;

    if (index === q.correct) {
      button.classList.add("correct");
    }

    if (index === currentAnswer.selected && !currentAnswer.correct) {
      button.classList.add("wrong");
    }
  });

  if (currentAnswer.correct) {
    feedback.className = "feedback correct";
    feedback.innerHTML =
      `<strong>✓ Dobrze!</strong><br>${q.explanation || ""}`;
  } else {
    feedback.className = "feedback wrong";
    feedback.innerHTML =
      `<strong>✗ Niepoprawnie.</strong><br>${q.explanation || ""}`;
  }

  nextBtn.textContent =
    current === testQuestions.length - 1
      ? "Zobacz wynik"
      : "Następne pytanie →";

  nextBtn.style.display = "inline-block";
}

function setExamHeader() {
  if (selectedCategory) {
    mainTitle.textContent = "⚓ Nauka działów";
    subtitle.textContent = selectedCategory;
  } else if (selectedExam && EXAMS[selectedExam]) {
    mainTitle.textContent = `⚓ ${EXAMS[selectedExam].short}`;
    subtitle.textContent = EXAMS[selectedExam].name;
  } else {
    mainTitle.textContent = "⚓ Testy żeglarskie";
    subtitle.textContent = "Wybierz egzamin";
  }
}

function showExamSelector(preserveSaved = false) {
  if (!preserveSaved) clearTestState();
  selectedExam = null;
  selectedCategory = null;
  testQuestions = [];
  current = 0;
  score = 0;
  answered = false;
  userAnswers = [];

  document.body.classList.remove("quiz-mode", "result-mode");
  document.body.classList.add("start-mode");

  startArea.style.display = "block";
  quizArea.style.display = "none";
  resultArea.style.display = "none";
  startError.textContent = "";
  resumeArea.hidden = true;
  examGrid.hidden = false;
  sectionLearningBtn.hidden = false;
  sectionSelector.hidden = true;
  startKicker.textContent = "Wybierz zakres";
  startHeading.textContent = "Do jakiego egzaminu chcesz się przygotowywać?";
  startDescription.textContent = "Wylosuję 75 pytań przypisanych do wybranego egzaminu.";
  setExamHeader();
}

function questionsForExam(exam) {
  return window.QUESTIONS.filter(q => q[exam] === true);
}

function questionsForCategory(category) {
  return window.QUESTIONS.filter(q => q.category === category);
}

function showSectionSelector() {
  startError.textContent = "";
  examGrid.hidden = true;
  sectionLearningBtn.hidden = true;
  sectionSelector.hidden = false;
  startKicker.textContent = "Nauka działów";
  startHeading.textContent = "Wybierz dział do nauki";
  startDescription.textContent =
    "Rozwiąż test obejmujący wszystkie pytania z wybranego działu.";
  sectionGrid.innerHTML = "";

  const categoryCounts = new Map();
  window.QUESTIONS.forEach(q => {
    if (q.category) {
      categoryCounts.set(q.category, (categoryCounts.get(q.category) || 0) + 1);
    }
  });

  [...categoryCounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "pl"))
    .forEach(([category, count]) => {
      const button = document.createElement("button");
      button.className = "section-choice";
      button.type = "button";
      button.innerHTML = `<strong></strong><span></span>`;
      button.querySelector("strong").textContent = category;
      button.querySelector("span").textContent = `${count} ${count === 1 ? "pytanie" : count < 5 ? "pytania" : "pytań"}`;
      button.addEventListener("click", () => startCategory(category));
      sectionGrid.appendChild(button);
    });
}

function startExam(exam) {
  if (!EXAMS[exam]) return;

  selectedExam = exam;
  selectedCategory = null;
  createNewTest();
}

function startCategory(category) {
  if (!questionsForCategory(category).length) return;

  selectedExam = null;
  selectedCategory = category;
  createNewTest();
}

function validateQuestionBank() {
  if (!Array.isArray(window.QUESTIONS)) {
    throw new Error("Nie znaleziono bazy QUESTIONS.");
  }

  const ids = new Set();

  for (const q of window.QUESTIONS) {
    if (ids.has(q.id)) {
      throw new Error(`Powtórzone ID pytania: ${q.id}`);
    }
    ids.add(q.id);

    if (!q.question || !Array.isArray(q.answers) || q.answers.length < 2) {
      throw new Error(`Niepoprawna struktura pytania ID ${q.id}`);
    }

    if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct >= q.answers.length) {
      throw new Error(`Niepoprawne pole "correct" w pytaniu ID ${q.id}`);
    }

    if (q.shuffleAnswers !== undefined && typeof q.shuffleAnswers !== "boolean") {
      throw new Error(`Niepoprawne pole "shuffleAnswers" w pytaniu ID ${q.id}`);
    }

    for (const exam of Object.keys(EXAMS)) {
      if (q[exam] !== undefined && typeof q[exam] !== "boolean") {
        throw new Error(`Niepoprawne pole "${exam}" w pytaniu ID ${q.id}`);
      }
    }
  }
}

function shuffle(array) {
  const result = [...array];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

// Odpowiedzi i indeks poprawnej odpowiedzi zmieniamy tylko w kopii pytania.
// answerOrder przechowuje indeksy odpowiedzi z oryginalnej bazy pytań.
function prepareQuestionForTest(q, savedOrder) {
  const indices = q.answers.map((_, i) => i);
  let order;

  if (savedOrder !== undefined) {
    if (!Array.isArray(savedOrder) ||
        savedOrder.length !== indices.length ||
        savedOrder.some(i => !Number.isInteger(i) || i < 0 || i >= indices.length) ||
        new Set(savedOrder).size !== indices.length) {
      throw new Error(`Nieprawidłowa kolejność odpowiedzi w pytaniu ${q.id}`);
    }
    order = [...savedOrder];
  } else {
    // Brak flagi oznacza zezwolenie na losowanie.
    order = q.shuffleAnswers === false ? indices : shuffle(indices);
  }

  return {
    ...q,
    answers: order.map(i => q.answers[i]),
    correct: order.indexOf(q.correct),
    answerOrder: order,
  };
}

function createNewTest() {
  validateQuestionBank();

  if ((!selectedExam || !EXAMS[selectedExam]) && !selectedCategory) {
    showExamSelector();
    return;
  }

  const pool = selectedCategory
    ? questionsForCategory(selectedCategory)
    : questionsForExam(selectedExam);

  if (pool.length === 0) {
    const emptyPoolMessage = selectedCategory
      ? `Brak pytań przypisanych do działu „${selectedCategory}”.`
      : `Brak pytań przypisanych do egzaminu ${EXAMS[selectedExam]?.short || ""}.`;
    showExamSelector();
    startError.textContent = emptyPoolMessage;
    return;
  }

  clearTestState();

  const size = selectedCategory ? pool.length : Math.min(TEST_SIZE, pool.length);
  testQuestions = shuffle(pool).slice(0, size)
    .map(q => prepareQuestionForTest(q));

  current = 0;
  score = 0;
  answered = false;
  userAnswers = [];

  document.body.classList.remove("start-mode", "result-mode");
  document.body.classList.add("quiz-mode");

  startArea.style.display = "none";
  resultArea.style.display = "none";
  quizArea.style.display = "grid";
  setExamHeader();

  renderQuestion();
  saveTestState();
}

function renderQuestion() {
  if (questionScroll) questionScroll.scrollTop = 0;
  nextBtn.style.display = "none";
  feedback.className = "feedback";
  feedback.textContent = "";

  const q = testQuestions[current];

  questionMeta.textContent =
    [q.category, q.difficulty].filter(Boolean).join(" • ");

  questionNumber.innerHTML =
    `Pytanie ${current + 1} z ${testQuestions.length}` +
    ` <span class="question-id">ID ${q.id}</span>` +
    ` <a class="report-question-link" href="report/?question=${encodeURIComponent(q.id)}">Zgłoś pytanie</a>`;

  questionNumber.querySelector(".report-question-link").addEventListener("click", () => {
    saveTestState();
    sessionStorage.setItem(RETURN_TO_QUIZ_KEY, "1");
  });

  questionText.textContent = q.question;

  if (q.image) {
    questionImage.src = q.image;
    questionImage.alt = `Ilustracja do pytania ${q.id}`;
    questionImageContainer.style.display = "block";
  } else {
    questionImage.removeAttribute("src");
    questionImageContainer.style.display = "none";
  }

  answers.innerHTML = "";

  q.answers.forEach((answer, index) => {
    const button = document.createElement("button");
    button.className = "answer";
    button.textContent =
      `${String.fromCharCode(65 + index)}. ${answer}`;

    button.addEventListener("click", () => selectAnswer(index));
    answers.appendChild(button);
  });

  const progress = (current / testQuestions.length) * 100;
  progressBar.style.width = `${progress}%`;
  progressText.textContent =
    `Wynik: ${score} pkt`;

  restoreAnsweredQuestionUI();
  saveTestState();
}

function selectAnswer(selected) {
  if (answered) return;
  answered = true;

  const q = testQuestions[current];
  const buttons = [...answers.querySelectorAll(".answer")];
  const correct = selected === q.correct;

  userAnswers.push({
    questionId: q.id,
    selected,
    correct
  });

  buttons.forEach((button, index) => {
    button.disabled = true;

    if (index === q.correct) {
      button.classList.add("correct");
    }

    if (index === selected && !correct) {
      button.classList.add("wrong");
    }
  });

  if (correct) {
    score++;
    feedback.className = "feedback correct";
    feedback.innerHTML =
      `<strong>✓ Dobrze!</strong><br>${q.explanation || ""}`;
  } else {
    feedback.className = "feedback wrong";
    feedback.innerHTML =
      `<strong>✗ Niepoprawnie.</strong><br>${q.explanation || ""}`;
  }

  progressText.textContent =
    `Wynik: ${score} pkt`;

  nextBtn.textContent =
    current === testQuestions.length - 1
      ? "Zobacz wynik"
      : "Następne pytanie →";

  nextBtn.style.display = "inline-block";

  // Na małym ekranie pokaż feedback bez przewijania całej strony.
  if (questionScroll) {
    requestAnimationFrame(() => {
      feedback.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  saveTestState();
}

finishExamBtn.addEventListener("click", () => {
  const confirmed = window.confirm(
    "Czy na pewno chcesz zakończyć egzamin i przejść do podsumowania?"
  );

  if (!confirmed) return;

  showResult(true);
});

nextBtn.addEventListener("click", () => {
  if (!answered) return;

  if (current < testQuestions.length - 1) {
    current++;
    answered = false;
    renderQuestion();
  } else {
    showResult();
  }
});

function showResult(endedEarly = false) {
  clearTestState();
  document.body.classList.remove("quiz-mode", "start-mode");
  document.body.classList.add("result-mode");
  startArea.style.display = "none";
  quizArea.style.display = "none";
  resultArea.style.display = "block";

  const resultScope = selectedCategory
    ? `Dział: ${selectedCategory}`
    : EXAMS[selectedExam]?.short;
  resultTitle.textContent = resultScope
    ? endedEarly
      ? `${resultScope} • zakończono wcześniej`
      : `${resultScope} • test ukończony`
    : endedEarly
      ? "Test zakończony wcześniej"
      : "Test ukończony";
  setExamHeader();

  const answeredCount = userAnswers.length;

  if (endedEarly) {
    const answeredPercent =
      answeredCount > 0
        ? Math.round((score / answeredCount) * 100)
        : 0;

    scoreEl.textContent =
      answeredCount > 0
        ? `${score} / ${answeredCount} poprawnych (${answeredPercent}%)`
        : "Brak udzielonych odpowiedzi";

    resultMessage.textContent =
      `Odpowiedziano na ${answeredCount} z ${testQuestions.length} pytań.`;
  } else {
    const percent =
      Math.round((score / testQuestions.length) * 100);

    scoreEl.textContent =
      `${score} / ${testQuestions.length} (${percent}%)`;

    if (percent >= 90) {
      resultMessage.textContent =
        "Bardzo mocny wynik. ⚓";
    } else if (percent >= 75) {
      resultMessage.textContent =
        "Dobry wynik. Kilka tematów warto jeszcze doszlifować.";
    } else if (percent >= 60) {
      resultMessage.textContent =
        "Solidna baza, ale przyda się jeszcze jedna runda.";
    } else {
      resultMessage.textContent =
        "Warto powtórzyć materiał i wylosować kolejny zestaw.";
    }
  }

  review.innerHTML = "<h3>Podsumowanie odpowiedzi</h3>";

  userAnswers.forEach((ua, index) => {
    const q = testQuestions[index];
    const item = document.createElement("div");
    item.className = "review-item";

    const selectedText = q.answers[ua.selected];
    const correctText = q.answers[q.correct];

    const reviewImage = q.image
      ? `
        <div class="review-image-container">
          <img
            class="review-image"
            src="${q.image}"
            alt="Ilustracja do pytania ${q.id}"
            loading="lazy"
          >
        </div>
      `
      : "";

    item.innerHTML = `
      <strong>${index + 1}. ${q.question}</strong>
      ${reviewImage}
      <div class="review-answer">
        ${
          ua.correct
            ? '<span class="review-good">✓ poprawnie</span>'
            : '<span class="review-bad">✗ błędnie</span>'
        }
        <br>
        Twoja odpowiedź:
        ${String.fromCharCode(65 + ua.selected)}. ${selectedText}
        ${
          ua.correct
            ? ""
            : `<br>Poprawna:
               ${String.fromCharCode(65 + q.correct)}. ${correctText}`
        }
      </div>
    `;

    // Zgłoszenie można wysłać także po zakończeniu testu.
    const reportLink = document.createElement("a");
    reportLink.className = "report-question-link review-report-link";
    reportLink.href = `report/?question=${encodeURIComponent(q.id)}`;
    reportLink.textContent = "Zgłoś pytanie";
    reportLink.addEventListener("click", () => {
      // Przy powrocie z formularza odtwórz podsumowanie zamiast nowego testu.
      saveTestState();
      sessionStorage.setItem(RETURN_CONTEXT_KEY, endedEarly ? "early" : "complete");
    });
    item.appendChild(reportLink);
    review.appendChild(item);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

restartBtn.addEventListener("click", () => {
  createNewTest();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

changeExamBtn.addEventListener("click", () => {
  const wasCategoryTest = Boolean(selectedCategory);
  showExamSelector();
  if (wasCategoryTest) showSectionSelector();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

examChoiceButtons.forEach(button => {
  button.addEventListener("click", () => {
    startExam(button.dataset.exam);
  });
});

sectionLearningBtn.addEventListener("click", showSectionSelector);
backToExamsBtn.addEventListener("click", showExamSelector);

resumeBtn.addEventListener("click", () => {
  if (restoreTestState()) {
    showRestoredQuiz();
  } else {
    showResumeChoice();
  }
});

discardBtn.addEventListener("click", () => {
  showExamSelector();
});

validateQuestionBank();

// Powrót z formularza to nawigacja w obrębie tego samego testu,
// więc nie pokazujemy wtedy ekranu wznowienia.
const resultReturn = sessionStorage.getItem(RETURN_CONTEXT_KEY);
const quizReturn = sessionStorage.getItem(RETURN_TO_QUIZ_KEY);
if ((resultReturn || quizReturn) && restoreTestState()) {
  sessionStorage.removeItem(RETURN_CONTEXT_KEY);
  sessionStorage.removeItem(RETURN_TO_QUIZ_KEY);
  if (resultReturn === "early" || resultReturn === "complete") {
    showRestoredQuiz();
    showResult(resultReturn === "early");
  } else {
    showRestoredQuiz();
  }
} else {
  sessionStorage.removeItem(RETURN_CONTEXT_KEY);
  sessionStorage.removeItem(RETURN_TO_QUIZ_KEY);
  showResumeChoice();
}
