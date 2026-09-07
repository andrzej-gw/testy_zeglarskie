const TEST_SIZE = 75;
const TEST_STATE_KEY = "jsmTestState";

let testQuestions = [];
let current = 0;
let score = 0;
let answered = false;
let userAnswers = [];

const questionMeta = document.getElementById("questionMeta");
const questionNumber = document.getElementById("questionNumber");
const questionText = document.getElementById("questionText");
const questionScroll = document.getElementById("questionScroll");
const questionImageContainer = document.getElementById("questionImageContainer");
const questionImage = document.getElementById("questionImage");
const answers = document.getElementById("answers");
const feedback = document.getElementById("feedback");
const nextBtn = document.getElementById("nextBtn");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const quizArea = document.getElementById("quizArea");
const resultArea = document.getElementById("resultArea");
const scoreEl = document.getElementById("score");
const resultMessage = document.getElementById("resultMessage");
const restartBtn = document.getElementById("restartBtn");
const review = document.getElementById("review");


function saveTestState() {
  try {
    sessionStorage.setItem(TEST_STATE_KEY, JSON.stringify({
      questionIds: testQuestions.map(q => q.id),
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
    const raw = sessionStorage.getItem(TEST_STATE_KEY);
    if (!raw) return false;

    const saved = JSON.parse(raw);

    if (
      !saved ||
      !Array.isArray(saved.questionIds) ||
      !Number.isInteger(saved.current) ||
      !Number.isInteger(saved.score) ||
      !Array.isArray(saved.userAnswers)
    ) {
      return false;
    }

    const questionMap = new Map(
      window.QUESTIONS.map(q => [Number(q.id), q])
    );

    const restoredQuestions = saved.questionIds
      .map(id => questionMap.get(Number(id)))
      .filter(Boolean);

    if (
      restoredQuestions.length !== saved.questionIds.length ||
      restoredQuestions.length === 0
    ) {
      return false;
    }

    testQuestions = restoredQuestions;
    current = Math.min(
      Math.max(saved.current, 0),
      testQuestions.length - 1
    );
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
    sessionStorage.removeItem(TEST_STATE_KEY);
  } catch (error) {
    console.warn("Nie udało się wyczyścić stanu testu:", error);
  }
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

function createNewTest() {
  validateQuestionBank();
  clearTestState();

  const size = Math.min(TEST_SIZE, window.QUESTIONS.length);
  testQuestions = shuffle(window.QUESTIONS).slice(0, size);

  current = 0;
  score = 0;
  answered = false;
  userAnswers = [];

  document.body.classList.add("quiz-mode");
  document.body.classList.remove("result-mode");
  resultArea.style.display = "none";
  quizArea.style.display = "grid";

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
    `Wynik: ${score} pkt • Baza: ${window.QUESTIONS.length} pytań`;

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
    `Wynik: ${score} pkt • Baza: ${window.QUESTIONS.length} pytań`;

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

function showResult() {
  clearTestState();
  document.body.classList.remove("quiz-mode");
  document.body.classList.add("result-mode");
  quizArea.style.display = "none";
  resultArea.style.display = "block";

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

    review.appendChild(item);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

restartBtn.addEventListener("click", () => {
  createNewTest();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

validateQuestionBank();

if (restoreTestState()) {
  document.body.classList.add("quiz-mode");
  document.body.classList.remove("result-mode");
  resultArea.style.display = "none";
  quizArea.style.display = "grid";
  renderQuestion();
} else {
  createNewTest();
}
