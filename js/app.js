
(() => {
  "use strict";

  const questions = window.QUIZ_QUESTIONS;
  if (!Array.isArray(questions) || questions.length !== 10) {
    throw new Error("Die zehn Fragen konnten nicht geladen werden.");
  }

  const $ = (id) => document.getElementById(id);
  const stage = $("stage");
  const introScreen = $("introScreen");
  const quizScreen = $("quizScreen");
  const startButton = $("startButton");
  const nextButton = $("nextButton");
  const chapterLabel = $("chapterLabel");
  const questionCounter = $("questionCounter");
  const progressBar = $("progressBar");
  const progressFill = $("progressFill");
  const questionTheme = $("questionTheme");
  const questionText = $("questionText");
  const answerList = $("answerList");
  const answerHint = $("answerHint");
  const quizBody = $("quizBody");
  const finale = $("finale");
  const finalTitle = $("finalTitle");

  let index = 0;
  let currentChoice = null;
  let phase = "intro";
  let transitioning = false;
  const answers = Array(questions.length).fill(null);
  const letters = ["A", "B", "C"];

  function formatNumber(value) {
    return String(value).padStart(2, "0");
  }

  function showQuestion() {
    const question = questions[index];
    currentChoice = answers[index];

    chapterLabel.textContent = `${question.chapterNumber}. ${question.chapter}`;
    questionCounter.textContent = `${formatNumber(index + 1)} / ${formatNumber(questions.length)}`;
    progressBar.setAttribute("aria-valuenow", String(index + 1));
    progressFill.style.width = `${((index + 1) / questions.length) * 100}%`;
    questionTheme.textContent = question.theme;
    questionText.textContent = question.question;

    answerList.replaceChildren();
    question.answers.forEach((text, answerIndex) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "answer-option";
      button.dataset.answer = letters[answerIndex];
      button.setAttribute("aria-pressed", String(answerIndex === currentChoice));

      const letter = document.createElement("span");
      letter.className = "answer-option__letter";
      letter.setAttribute("aria-hidden", "true");
      letter.textContent = letters[answerIndex];

      const body = document.createElement("span");
      body.className = "answer-option__text";
      body.textContent = text;

      button.append(letter, body);
      button.addEventListener("click", () => selectAnswer(answerIndex));
      answerList.append(button);
    });

    nextButton.hidden = currentChoice === null;
    answerHint.textContent = currentChoice === null
      ? "Wähle die Antwort, die dir am nächsten kommt."
      : "Du kannst deine Antwort noch ändern.";
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function selectAnswer(answerIndex) {
    if (phase !== "quiz" || transitioning) return;

    currentChoice = answerIndex;
    answers[index] = answerIndex;
    answerList.querySelectorAll(".answer-option").forEach((button, i) => {
      const selected = i === answerIndex;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });

    nextButton.hidden = false;
    answerHint.textContent = "Du kannst deine Antwort noch ändern.";
  }

  function beginQuiz() {
    if (phase !== "intro") return;
    phase = "quiz";
    introScreen.hidden = true;
    quizScreen.hidden = false;
    showQuestion();
    questionText.setAttribute("tabindex", "-1");
    questionText.focus({ preventScroll: true });
  }

  function advance() {
    if (phase !== "quiz" || currentChoice === null || transitioning) return;
    answers[index] = currentChoice;

    // Kein Ergebnis: Die Antworten dienen ausschließlich dem Nachdenken.
    if (index === questions.length - 1) {
      showFinale();
      return;
    }

    transitioning = true;
    nextButton.hidden = true;
    quizBody.classList.add("is-changing");
    window.setTimeout(() => {
      index++;
      showQuestion();
      quizBody.classList.remove("is-changing");
      transitioning = false;
      questionText.focus({ preventScroll: true });
    }, 220);
  }

  function showFinale() {
    phase = "finale";
    
    stage.hidden = true;
    finale.hidden = false;
    document.body.classList.add("finale-active");
    window.scrollTo({ top: 0, behavior: "instant" });
    finalTitle.focus({ preventScroll: true });

  }

  startButton.addEventListener("click", beginQuiz);
  nextButton.addEventListener("click", advance);
})();
