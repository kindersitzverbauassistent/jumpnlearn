"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const questionBubble = document.getElementById("question-bubble");
const question = document.getElementById("question");
const questionLabel = document.getElementById("question-label");
const questionNumber = document.getElementById("question-number");
const runCorrect = document.getElementById("run-correct");
const runWrong = document.getElementById("run-wrong");
const scoreText = document.getElementById("score");
const worldNumber = document.getElementById("world-number");
const worldName = document.getElementById("world-name");
const livesText = document.getElementById("lives");
const toast = document.getElementById("result-toast");
const levelToast = document.getElementById("level-toast");
const message = document.getElementById("message");
const messageIcon = document.getElementById("message-icon");
const messageTitle = document.getElementById("message-title");
const messageText = document.getElementById("message-text");
const restartButton = document.getElementById("restart-button");
const lastChance = document.getElementById("last-chance");
const lastChanceForm = document.getElementById("last-chance-form");
const lastChanceCount = document.getElementById("last-chance-count");
const lastChanceWord = document.getElementById("last-chance-word");
const lastChanceAnswer = document.getElementById("last-chance-answer");
const lastChanceStatus = document.getElementById("last-chance-status");
const orientationPrompt = document.getElementById("orientation-prompt");
const orientationDescription = document.getElementById("orientation-description");
const coarseTouch = window.matchMedia("(pointer: coarse)");
const portraitTouch = window.matchMedia("(orientation: portrait) and (pointer: coarse)");
let orientationPaused = false;

const ground = 392;
const upperGap = 132;
const segmentWidth = 1500;
const decisionOffset = 850;
const trapOffset = 1060;
const threeChoiceBridgeStart = 260;
const threeChoiceDecisionOffset = 980;
const pitWidth = 180;
const baseSpeed = 205;
const pointsPerLevel = 1000;
const threeChoiceLevel = 5;
const maxLifeQuarters = 20;
const slowdownDuration = 4;
const slowdownFactor = 0.65;
const endlessAcceleration = 1;
const maxLastChances = 3;
let speed = baseSpeed;
let slowdownRemaining = 0;
const gravity = 1700;
const viewScale = 0.78;
const viewOffsetY = 86;
const floorOffsets = [0, -65, 0, -80, -15, -90, -10, -70];
const player = { x: 110, y: ground - 58, width: 35, height: 58, vy: 0, grounded: true };
const controls = { jump: false, down: false, left: false, right: false, shoot: false };
let segments = [];
let nextSegmentNumber = 0;
let lastWordId = null;
let recentWordIds = [];
let playerName = "";
let index = 0;
let lifeQuarters = 12;
let score = 0;
let correctCount = 0;
let state = "menu";
let fallingSegment = null;
let impactStarted = 0;
let impactY = 0;
let impactHazard = "";
let respawnStarted = 0;
let animationTime = 0;
let toastTime = 0;
let levelToastTime = 0;
let lastTime = 0;
let worldLevel = 0;
let levelStartScore = 0;
let speedStartScore = 0;
let speedEndScore = pointsPerLevel;
let defeatedBosses = [];
let endlessElapsed = 0;
let endlessStartSpeed = baseSpeed;
let lastChancesRemaining = maxLastChances;
let rescueWord = null;
let rescueBossQuestionAnswered = false;

const levels = [
  { name: "Der versunkene Dungeon" },
  { name: "Wüste & Oasen" },
  { name: "Dschungel & Tiger" },
  { name: "Weltraum & Sterne" },
  { name: "Unterwasserwelt" },
  { name: "Orientalischer Basar" },
  { name: "Einhornland" },
  { name: "Bayerische Berge" },
  { name: "New York" },
  { name: "London" },
  { name: "Die magische Bibliothek" },
  { name: "Das Reich der Zauberei" }
];
function speedForScore(points) {
  if (defeatedBosses[levels.length - 1]) return endlessStartSpeed + endlessAcceleration * endlessElapsed;
  const progress = Math.max(0, Math.min(1, (points - speedStartScore) / (speedEndScore - speedStartScore)));
  return baseSpeed * (1 + progress);
}

function resetSpeed() {
  speedStartScore = score;
  const levelEndScore = levelStartScore + pointsPerLevel;
  speedEndScore = score < levelEndScore ? levelEndScore : score + pointsPerLevel;
  slowdownRemaining = 0;
  speed = baseSpeed;
}

function movementFactor() {
  return 1 - (1 - slowdownFactor) * slowdownRemaining / slowdownDuration;
}

function loseLife() {
  lifeQuarters = Math.max(0, lifeQuarters - 4);
  slowdownRemaining = slowdownDuration;
  speed = speedForScore(score) * movementFactor();
}

function resetControls() {
  for (const control of Object.keys(controls)) controls[control] = false;
}

function updateOrientation() {
  const paused = state !== "menu" && state !== "gameover" && coarseTouch.matches &&
    (state === "lastChance" ? !portraitTouch.matches : portraitTouch.matches);
  if (paused) {
    orientationDescription.textContent = state === "lastChance"
      ? "Drehe dein Gerät für die letzte Chance ins Hochformat. Falls nötig, schalte die Drehsperre aus."
      : "Drehe dein Gerät ins Querformat. Das Spiel pausiert, bis du weiterspielen kannst. Falls nötig, schalte die Drehsperre aus.";
  }
  if (paused === orientationPaused) return;
  orientationPaused = paused;
  orientationPrompt.hidden = !paused;
  if (paused) {
    resetControls();
    orientationPrompt.focus({ preventScroll: true });
  } else if (state === "lastChance") {
    if (coarseTouch.matches) lastChance.focus({ preventScroll: true });
    else lastChanceAnswer.focus({ preventScroll: true });
  } else if (state === "bossIntro") {
    bossStartButton.focus({ preventScroll: true });
  } else if (state !== "menu" && state !== "gameover") {
    canvas.focus({ preventScroll: true });
  }
}

if (portraitTouch.addEventListener) portraitTouch.addEventListener("change", updateOrientation);
else portraitTouch.addListener(updateOrientation);
if (coarseTouch.addEventListener) coarseTouch.addEventListener("change", updateOrientation);
else coarseTouch.addListener(updateOrientation);
orientationPrompt.addEventListener("keydown", event => {
  if (event.key === "Tab") event.preventDefault();
});

function enterLevel(level) {
  worldLevel = level;
  levelStartScore = score;
  resetSpeed();
  levelToast.textContent = `✦ LEVEL ${level + 1} · ${levels[level].name} ✦`;
  levelToast.hidden = false;
  levelToastTime = 4;
  playSound("level");
}

function floorAt(x) {
  const section = Math.max(0, Math.floor(x / segmentWidth));
  const previous = floorOffsets[Math.max(0, section - 1) % floorOffsets.length];
  const current = floorOffsets[section % floorOffsets.length];
  const progress = Math.max(0, Math.min(1, (x - section * segmentWidth - 30) / 370));
  return ground + previous + (current - previous) * progress;
}

function bridgeHeight(segment) {
  return floorAt(segment.base + 700) - upperGap;
}

function nextWord() {
  const categories = [
    { weight: lifeQuarters <= 8 ? 65 : 70, words: [] },
    { weight: lifeQuarters <= 8 ? 25 : 30, words: [] },
    { weight: lifeQuarters <= 8 ? 10 : 0, words: [] }
  ];
  const categoryIndex = { nochNicht: 0, soLala: 1, sicher: 2 };
  const words = wordsForPlayer(playerName);
  const cooldown = Math.min(5, words.length - 1);
  const recent = new Set(cooldown > 0 ? recentWordIds.slice(-cooldown) : []);
  for (const word of words) {
    const category = categories[categoryIndex[wordCategory(word)]];
    if (!recent.has(word.id)) category.words.push(word);
  }
  let available = categories.filter(category => category.words.length && category.weight > 0);
  if (!available.length) {
    categories[2].weight = 1;
    available = [categories[2]];
  }
  let choice = Math.random() * available.reduce((sum, category) =>
    sum + category.weight * Math.min(1, category.words.length / 3), 0);
  let selected = available[available.length - 1];
  for (const category of available) {
    choice -= category.weight * Math.min(1, category.words.length / 3);
    if (choice < 0) { selected = category; break; }
  }
  const word = selected.words[Math.floor(Math.random() * selected.words.length)];
  lastWordId = word.id;
  recentWordIds.push(word.id);
  if (recentWordIds.length > 5) recentWordIds.shift();
  return word;
}

function makeSegment(number) {
  const word = nextWord();
  const distinctAlternatives = key => {
    const seen = new Set([word[key].trim().toLocaleLowerCase()]);
    return appData.words.filter(item => {
      const answer = item[key].trim().toLocaleLowerCase();
      if (seen.has(answer)) return false;
      seen.add(answer);
      return true;
    });
  };
  const germanAlternatives = distinctAlternatives("german");
  const englishAlternatives = distinctAlternatives("english");
  const wantsThree = worldLevel >= threeChoiceLevel && englishAlternatives.length >= 2;
  const englishQuestion = germanAlternatives.length > 0 && (!wantsThree || germanAlternatives.length >= 2) && Math.random() < 0.5;
  const alternatives = (englishQuestion ? germanAlternatives : englishAlternatives).slice();
  const answerKey = englishQuestion ? "german" : "english";
  const correctAnswer = word[answerKey];
  for (let i = alternatives.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [alternatives[i], alternatives[j]] = [alternatives[j], alternatives[i]];
  }
  const answers = [correctAnswer, ...alternatives.slice(0, wantsThree ? 2 : 1).map(item => item[answerKey])];
  for (let i = answers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [answers[i], answers[j]] = [answers[j], answers[i]];
  }
  return {
    number,
    base: number * segmentWidth,
    word,
    prompt: englishQuestion ? word.english : word.german,
    answerLanguage: englishQuestion ? "Deutsche" : "Englische",
    correctAnswer,
    answers,
    upperHazard: ["bridge", "dog", "pendulum", "ceiling", "sand", "lightning"][number % 6],
    lowerHazard: ["trapdoor", "boulder", "flame", "net", "wave", "vortex"][number % 6],
    choice: null,
    correct: false,
    resolved: false,
    choiceTime: null,
    activatedAt: null
  };
}

function pointsForAnswer(word, answerCount) {
  const points = { nochNicht: 100, soLala: 50, sicher: 10 }[wordCategory(word)];
  return points * (worldLevel >= threeChoiceLevel && answerCount === 3 ? 2 : 1);
}

function segmentHazard(segment) {
  return segment.choice === 2 ? "lightning" : segment.choice === 0 ? segment.upperHazard : segment.lowerHazard;
}

function ensureSegments() {
  const camera = Math.max(0, player.x - 330);
  segments = segments.filter(segment => segment.base + segmentWidth >= camera);
  while (nextSegmentNumber <= index) {
    segments.push(makeSegment(nextSegmentNumber));
    nextSegmentNumber++;
  }
}

function activeSegment() {
  return segments.find(segment => segment.number === index);
}

function updateHud() {
  const level = worldLevel;
  worldNumber.textContent = `LEVEL ${String(level + 1).padStart(2, "0")}`;
  worldName.textContent = levels[level].name;
  runCorrect.textContent = correctCount;
  runWrong.textContent = index - correctCount;
  scoreText.textContent = score;
  const fraction = ["", "¼", "½", "¾"][lifeQuarters % 4];
  livesText.textContent = `♥ ${Math.floor(lifeQuarters / 4)}${fraction}`;
  livesText.setAttribute("aria-label", `${(lifeQuarters / 4).toLocaleString("de-DE")} Leben`);
  const currentQuestion = boss.active ? boss.question : activeSegment();
  if (!boss.active) {
    runInstructions.hidden = currentQuestion.answers.length === 3;
    runThreeInstructions.hidden = currentQuestion.answers.length !== 3;
  }
  question.textContent = currentQuestion.prompt;
  questionLabel.textContent = `ÜBERSETZE INS ${currentQuestion.answerLanguage.toLocaleUpperCase()}`;
  questionNumber.textContent = `#${index + 1}`;
}

function showQuestion() {
  const segment = boss.active ? boss.question : activeSegment();
  questionBubble.hidden = false;
  if (segment.answerLanguage === "Deutsche") speakEnglish(segment.word.english);
}

function startGame(run) {
  playerName = run.name;
  segments = [];
  nextSegmentNumber = run.index;
  lastWordId = run.lastWordId;
  recentWordIds = lastWordId === null ? [] : [lastWordId];
  index = run.index;
  lifeQuarters = run.lifeQuarters;
  score = run.score;
  worldLevel = 0;
  levelStartScore = 0;
  defeatedBosses = levels.map(() => false);
  endlessElapsed = 0;
  endlessStartSpeed = baseSpeed;
  lastChancesRemaining = maxLastChances;
  rescueWord = null;
  lastChance.hidden = true;
  setMusicMode("normal");
  resetSpeed();
  resetBoss();
  correctCount = run.correctCount;
  state = "running";
  document.body.classList.add("playing");
  fallingSegment = null;
  impactStarted = 0;
  impactHazard = "";
  respawnStarted = 0;
  player.x = index * segmentWidth + 110;
  player.y = floorAt(player.x + player.width / 2) - player.height;
  player.vy = 0;
  player.grounded = true;
  resetControls();
  toast.hidden = true;
  toastTime = 0;
  levelToast.hidden = true;
  levelToastTime = 0;
  message.hidden = true;
  ensureSegments();
  updateHud();
  showQuestion();
  draw();
  updateOrientation();
}

function resolveChoice(segment, correct) {
  segment.resolved = true;
  index++;
  const previousLifeQuarters = lifeQuarters;
  const points = correct ? pointsForAnswer(segment.word, segment.answers.length) : 0;
  if (correct) { score += points; correctCount++; lifeQuarters = Math.min(maxLifeQuarters, lifeQuarters + 1); }
  else loseLife();
  recordAnswer(segment.word.id, correct, { name: playerName, index, score, correctCount, lifeQuarters, lastWordId });
  const hazard = segmentHazard(segment);
  playSound(correct ? "correct" : hazard);
  if (!correct) playSound("death");
  const hazardNames = { bridge: "DIE BRÜCKE BRICHT!", trapdoor: "DIE FALLTÜR ÖFFNET SICH!", dog: "DER WÄCHTERHUND!", boulder: "EIN ROLLSTEIN!", pendulum: "DAS PENDEL SCHWINGT!", flame: "DIE FEUERFALLE!", ceiling: "DIE DECKE SENKT SICH!", net: "EIN FANGNETZ!", sand: "EIN SANDSTURM!", lightning: "EIN BLITZ!", wave: "EINE WASSERWELLE!", vortex: "EIN MAGISCHER WIRBEL!" };
  toast.textContent = correct
    ? `✦ RICHTIG · +${points} ${points === 1 ? "PUNKT" : "PUNKTE"} · ${lifeQuarters > previousLifeQuarters ? "+¼ LEBEN" : "LEBEN VOLL"}  ·  ${segment.word.german} = ${segment.word.english}`
    : `✹ ${hazardNames[hazard]} · −1 LEBEN  ·  ${segment.word.german} = ${segment.word.english}`;
  toast.hidden = false;
  toastTime = 3.5;
  if (!correct) questionBubble.hidden = true;
  if (correct && !defeatedBosses[worldLevel] && score - levelStartScore >= pointsPerLevel) {
    startBoss();
    return;
  }
  ensureSegments();
  updateHud();
  if (correct) showQuestion();
}

function endGame(bossQuestionAnswered = false) {
  if (lastChancesRemaining > 0) {
    rescueBossQuestionAnswered = bossQuestionAnswered;
    state = "lastChance";
    resetControls();
    questionBubble.hidden = true;
    lastChanceStatus.textContent = "";
    nextRescueQuestion();
    lastChance.hidden = false;
    setMusicMode("lastChance");
    updateOrientation();
    if (!orientationPaused) {
      if (coarseTouch.matches) lastChance.focus({ preventScroll: true });
      else lastChanceAnswer.focus({ preventScroll: true });
    }
    return;
  }
  finishGame();
}

function nextRescueQuestion() {
  rescueWord = nextWord();
  lastChanceCount.textContent = `Noch ${lastChancesRemaining} ${lastChancesRemaining === 1 ? "Versuch" : "Versuche"} in diesem Abenteuer.`;
  lastChanceWord.textContent = rescueWord.german;
  lastChanceAnswer.value = "";
}

function englishAnswerMatches(answer, expected) {
  const normalize = value => value.normalize("NFC").trim().replace(/\s+/g, " ")
    .replace(/\u2019/g, "'").replace(/[.!?…]+$/, "").trim().toLocaleLowerCase();
  const accepted = [expected];
  for (const variant of expected.split(/\s+\/\s+|,\s+(?=[A-Z])/)) {
    accepted.push(variant);
    const explanation = variant.match(/^(.*?)\s*\(=\s*(.*?)\)$/);
    const optional = variant.match(/^(.*?)\s*\(([^=][^()]*)\)$/);
    if (explanation) accepted.push(explanation[1], explanation[2]);
    else if (optional) accepted.push(optional[1], `${optional[1]} ${optional[2]}`);
  }
  const normalized = normalize(answer);
  return normalized !== "" && accepted.some(value => normalize(value) === normalized);
}

lastChanceForm.addEventListener("submit", event => {
  event.preventDefault();
  if (state !== "lastChance" || orientationPaused) return;
  if (!lastChanceAnswer.value.trim()) {
    lastChanceStatus.textContent = "Bitte gib eine englische Übersetzung ein.";
    return;
  }
  lastChancesRemaining--;
  const correct = englishAnswerMatches(lastChanceAnswer.value, rescueWord.english);
  if (correct) lifeQuarters = 4;
  recordAnswer(rescueWord.id, correct, { name: playerName, index, score, correctCount, lifeQuarters, lastWordId });
  if (correct) {
    lastChance.hidden = true;
    setMusicMode("normal");
    playSound("correct");
    if (boss.active) {
      state = "boss";
      boss.fireballs = [];
      boss.arrow = null;
      boss.invulnerable = 1.5;
      boss.nextFire = Math.max(boss.nextFire, 2);
      resetControls();
      if (rescueBossQuestionAnswered) nextBossQuestion();
      else { updateHud(); showQuestion(); }
    } else {
      if (fallingSegment) player.x = Math.max(player.x, fallingSegment.base + trapOffset + pitWidth + player.width);
      beginRespawn();
      updateHud();
    }
    updateOrientation();
    if (!orientationPaused) canvas.focus({ preventScroll: true });
  } else if (lastChancesRemaining > 0) {
    lastChanceStatus.textContent = `Leider falsch. Richtig war: ${rescueWord.english}.`;
    nextRescueQuestion();
    lastChanceAnswer.focus({ preventScroll: true });
  } else {
    lastChance.hidden = true;
    finishGame(rescueWord.english);
  }
});

lastChance.addEventListener("keydown", event => {
  if (event.key !== "Tab") return;
  const submit = lastChanceForm.querySelector("button");
  if (event.shiftKey && document.activeElement === lastChanceAnswer) {
    event.preventDefault();
    submit.focus();
  } else if (!event.shiftKey && document.activeElement === submit) {
    event.preventDefault();
    lastChanceAnswer.focus();
  }
});

function finishGame(solution = "") {
  state = "gameover";
  updateOrientation();
  setMusicMode("normal");
  const saved = saveAppData({ ...appData, highscores: highscoreEntries(playerName, score) });
  playSound("gameover");
  messageIcon.textContent = "♥";
  messageTitle.textContent = "Das Abenteuer endet hier";
  messageText.textContent = `${playerName}: ${score} Punkte, ${correctCount} richtig, ${index - correctCount} falsch. ${solution ? `Die letzte Lösung war: ${solution}. ` : ""}${saved ? "Dein bester Lauf steht auf der Startseite." : "Der Highscore konnte nicht gespeichert werden."}`;
  message.hidden = false;
  restartButton.focus();
}

function beginRespawn() {
  state = "respawning";
  respawnStarted = animationTime;
  player.y = floorAt(player.x + player.width / 2) - player.height;
  player.vy = 0;
  player.grounded = true;
  fallingSegment = null;
  impactHazard = "";
  playSound("respawn");
}

restartButton.addEventListener("click", () => { state = "menu"; showMenu(); });

function setControl(control, pressed) {
  if (orientationPaused || state === "bossIntro" || state === "lastChance" || state === "gameover") return;
  if (state === "boss") {
    bossControl(control, pressed);
    return;
  }
  if (pressed && !controls[control] && state === "running") {
    const active = activeSegment();
    const locked = active && active.choice !== null && !active.resolved;
    if (!locked && control === "jump" && player.grounded) {
      player.vy = -830;
      player.grounded = false;
      playSound("jump");
    } else if (!locked && control === "down" && player.grounded && segments.some(segment =>
      player.x + player.width > segment.base + (segment.answers.length === 3 ? threeChoiceBridgeStart : 620) &&
      player.x < segment.base + 1330 &&
      [bridgeHeight(segment), ...(segment.answers.length === 3 ? [bridgeHeight(segment) - upperGap] : [])]
        .some(y => Math.abs(player.y + player.height - y) < 0.01))) {
      player.y += 1;
      player.grounded = false;
      playSound("drop");
    }
  }
  controls[control] = pressed;
}

const keyMap = { ArrowUp: "jump", w: "jump", W: "jump", " ": "jump", ArrowDown: "down", s: "down", S: "down", ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" };
window.addEventListener("keydown", event => {
  const control = keyMap[event.key];
  if (!control || (state !== "running" && state !== "falling" && state !== "hit" && state !== "respawning" && state !== "boss")) return;
  if (event.target instanceof HTMLButtonElement) {
    if (event.key === " ") return;
    canvas.focus({ preventScroll: true });
  }
  event.preventDefault();
  startMusicOnInteraction();
  setControl(control, true);
});
window.addEventListener("keyup", event => {
  const control = keyMap[event.key];
  if (control) setControl(control, false);
});
window.addEventListener("blur", resetControls);
document.querySelectorAll(".audio-controls button").forEach(button => {
  button.addEventListener("click", event => {
    if (event.detail > 0 && (state === "running" || state === "boss")) canvas.focus({ preventScroll: true });
  });
});
document.querySelectorAll("[data-control]").forEach(button => {
  const control = button.dataset.control;
  button.addEventListener("pointerdown", event => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    startMusicOnInteraction();
    setControl(control, true);
  });
  for (const eventName of ["pointerup", "pointercancel", "lostpointercapture"]) {
    button.addEventListener(eventName, () => setControl(control, false));
  }
});

function update(dt) {
  if (orientationPaused || state === "bossIntro" || state === "lastChance") return;
  animationTime += dt;
  if (levelToastTime > 0) {
    levelToastTime -= dt;
    if (levelToastTime <= 0) levelToast.hidden = true;
  }
  if (toastTime > 0) {
    toastTime -= dt;
    if (toastTime <= 0) toast.hidden = true;
  }
  const factor = movementFactor();
  if ((state === "running" || state === "boss") && slowdownRemaining > 0) {
    slowdownRemaining = Math.max(0, slowdownRemaining - dt);
  }
  if (state === "running" && defeatedBosses[levels.length - 1]) endlessElapsed += dt;
  if (state === "boss" || state === "bossVictory") {
    updateBoss(dt, factor);
    return;
  }
  if (state !== "running" && state !== "falling" && state !== "hit" && state !== "respawning") return;
  speed = speedForScore(score) * factor;
  const previousX = player.x;
  const previousBottom = player.y + player.height;
  const wasOnGround = player.grounded && Math.abs(previousBottom - floorAt(previousX + player.width / 2)) < 0.01;
  player.x += speed * dt;

  if (state === "respawning") {
    player.y = floorAt(player.x + player.width / 2) - player.height;
    if (animationTime - respawnStarted >= 1.2) {
      state = "running";
      showQuestion();
    }
    return;
  }

  if (state === "hit") {
    const elapsed = Math.min(animationTime - impactStarted, 1.1);
    const impulse = { dog: -220, boulder: -250, pendulum: -310, flame: -350, ceiling: -80, net: -130, sand: -260, lightning: -200, wave: -280, vortex: -300 }[impactHazard];
    player.y = Math.min(impactY + impulse * elapsed + gravity * elapsed * elapsed / 2,
      floorAt(player.x + player.width / 2) - player.height);
    if (elapsed >= 1.1) {
      if (lifeQuarters === 0) {
        endGame();
      } else {
        beginRespawn();
      }
    }
    return;
  }

  if (state === "falling") {
    player.vy += gravity * dt;
    player.y += player.vy * dt;
    const belowScreen = (canvas.height - viewOffsetY) / viewScale + 30;
    if (player.y > belowScreen && lifeQuarters === 0) {
      endGame();
    } else if (player.y > belowScreen && player.x >= fallingSegment.base + trapOffset + pitWidth + player.width) {
      beginRespawn();
    }
    return;
  }

  const floor = floorAt(player.x + player.width / 2);
  if (wasOnGround) {
    player.y = floor - player.height;
    player.vy = 0;
  } else {
    player.vy += gravity * dt;
    player.y += player.vy * dt;
    player.grounded = false;
  }
  if (!wasOnGround && player.vy >= 0) {
    const upper = segments.find(segment => player.x + player.width > segment.base + (segment.answers.length === 3 ? threeChoiceBridgeStart : 620) &&
      player.x < segment.base + 1330);
    const upperY = upper ? bridgeHeight(upper) : 0;
    const topY = upperY - upperGap;
    const middleBroken = upper && upper.activatedAt !== null && upper.choice === 0 &&
      upper.upperHazard === "bridge" && player.x >= upper.base + trapOffset;
    if (upper && upper.answers.length === 3 && previousBottom <= topY && player.y + player.height >= topY) {
      player.y = topY - player.height;
      player.vy = 0;
      player.grounded = true;
    } else if (upper && !middleBroken && previousBottom <= upperY && player.y + player.height >= upperY) {
      player.y = upperY - player.height;
      player.vy = 0;
      player.grounded = true;
    } else if (player.y + player.height >= floor) {
      player.y = floor - player.height;
      player.vy = 0;
      player.grounded = true;
    }
  }

  const segment = activeSegment();
  if (segment && segment.choice === null && player.grounded &&
    player.x + player.width / 2 >= segment.base + (segment.answers.length === 3 ? threeChoiceDecisionOffset : decisionOffset)) {
    const bottom = player.y + player.height;
    segment.choice = segment.answers.length === 3 && Math.abs(bottom - (bridgeHeight(segment) - upperGap)) < 0.01
      ? 2 : Math.abs(bottom - bridgeHeight(segment)) < 0.01 ? 0 : 1;
    segment.correct = segment.answers[segment.choice] === segment.correctAnswer;
    segment.choiceTime = animationTime;
    if (segment.correct && segment.answerLanguage === "Englische") speakEnglish(segment.word.english);
  }
  if (segment && segment.choice !== null && !segment.resolved) {
    if (!segment.correct && player.x + player.width / 2 >= segment.base + trapOffset) {
      const hazard = segmentHazard(segment);
      segment.activatedAt = animationTime;
      player.vy = 0;
      player.grounded = false;
      if (hazard === "bridge" || hazard === "trapdoor") {
        state = "falling";
        impactHazard = "";
        fallingSegment = segment;
      } else {
        state = "hit";
        impactStarted = animationTime;
        impactY = player.y;
        impactHazard = hazard;
      }
      resolveChoice(segment, false);
    } else if (segment.correct && player.x >= segment.base + trapOffset + pitWidth) {
      resolveChoice(segment, true);
    }
  }
}

function drawBackground(camera) {
  const level = worldLevel;
  if (level === 1) { drawDesertBackground(camera); return; }
  if (level === 2) { drawJungleBackground(camera); return; }
  if (level === 3) { drawSpaceBackground(camera); return; }
  if (level === 4) { drawUnderwaterBackground(camera); return; }
  if (level === 5) { drawBazaarBackground(camera); return; }
  if (level === 6) { drawUnicornBackground(camera); return; }
  if (level === 7) { drawAlpsBackground(camera); return; }
  if (level === 8) { drawNewYorkBackground(camera); return; }
  if (level === 9) { drawLondonBackground(camera); return; }
  if (level === 10) { drawLibraryBackground(camera); return; }
  if (level === 11) { drawMagicBackground(camera); return; }
  const wall = ctx.createLinearGradient(0, 0, 0, 490);
  wall.addColorStop(0, "#181824");
  wall.addColorStop(.55, "#39303a");
  wall.addColorStop(1, "#4e393b");
  ctx.fillStyle = wall; ctx.fillRect(0, 0, 1000, 490);
  ctx.save();
  ctx.translate(-(camera * viewScale * .38 % 330), 0);
  ctx.strokeStyle = "#51434a"; ctx.lineWidth = 2;
  for (let y = 62; y < 470; y += 38) {
    ctx.beginPath(); ctx.moveTo(-330, y); ctx.lineTo(1400, y); ctx.stroke();
    for (let x = -330 + (Math.floor(y / 38) % 2) * 55; x < 1400; x += 110) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 38); ctx.stroke();
    }
  }
  for (let x = -330; x < 1400; x += 330) {
    ctx.fillStyle = "#25242f";
    ctx.beginPath(); ctx.moveTo(x + 46, 440); ctx.lineTo(x + 46, 180); ctx.quadraticCurveTo(x + 135, 62, x + 224, 180); ctx.lineTo(x + 224, 440); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#6b5451"; ctx.lineWidth = 8; ctx.stroke();
    ctx.fillStyle = "#36303a"; ctx.fillRect(x + 68, 210, 135, 230);
    ctx.strokeStyle = "#54434a"; ctx.lineWidth = 4;
    for (let px = x + 82; px < x + 203; px += 25) {
      ctx.beginPath(); ctx.moveTo(px, 210); ctx.lineTo(px, 440); ctx.stroke();
    }
  }
  ctx.restore();
  ctx.fillStyle = "#1c1b27";
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1000, 0); ctx.lineTo(1000, 44);
  for (let x = 1000; x >= 0; x -= 80) ctx.lineTo(x, 35 + (x % 240 === 0 ? 34 : 5));
  ctx.closePath(); ctx.fill();
}

function drawPalm(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = "#815536"; ctx.lineWidth = 12; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(8, -50, -3, -96); ctx.stroke();
  ctx.strokeStyle = "#3e7454"; ctx.lineWidth = 7;
  for (const direction of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(-3, -96); ctx.quadraticCurveTo(direction * 35, -120, direction * 62, -78); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-3, -96); ctx.quadraticCurveTo(direction * 25, -108, direction * 42, -55); ctx.stroke();
  }
  ctx.restore();
}

function drawDesertBackground(camera) {
  const sky = ctx.createLinearGradient(0, 0, 0, 490);
  sky.addColorStop(0, "#75b6c1"); sky.addColorStop(.55, "#f5d399"); sky.addColorStop(1, "#d59860");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 1000, 490);
  ctx.fillStyle = "#fff0bc"; ctx.beginPath(); ctx.arc(805, 80, 42, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(-(camera * viewScale * .18 % 480), 0);
  ctx.fillStyle = "#d5a26d"; ctx.beginPath(); ctx.moveTo(-480, 320);
  for (let x = -480; x < 1500; x += 240) ctx.quadraticCurveTo(x + 120, 155, x + 240, 320);
  ctx.lineTo(1500, 490); ctx.lineTo(-480, 490); ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(-(camera * viewScale * .35 % 600), 0);
  ctx.fillStyle = "#e9bc7a"; ctx.beginPath(); ctx.moveTo(-600, 350);
  for (let x = -600; x < 1600; x += 300) ctx.quadraticCurveTo(x + 150, 265, x + 300, 350);
  ctx.lineTo(1600, 490); ctx.lineTo(-600, 490); ctx.fill();
  for (let x = -600; x < 1600; x += 600) {
    ctx.fillStyle = "#78bdba"; ctx.beginPath(); ctx.ellipse(x + 300, 354, 115, 18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#d5f1dc"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x + 300, 354, 76, 8, 0, 0, Math.PI * 2); ctx.stroke();
    drawPalm(x + 195, 357, .85);
    drawPalm(x + 395, 355, .65);
  }
  ctx.restore();
}

function drawTiger(x, y) {
  ctx.save(); ctx.translate(x, y);
  ctx.strokeStyle = "#382c26"; ctx.lineWidth = 6; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(25, -16); ctx.quadraticCurveTo(53, -8, 48, -35); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-20, -14); ctx.lineTo(-22, 0); ctx.moveTo(16, -14); ctx.lineTo(18, 0); ctx.stroke();
  ctx.fillStyle = "#dd964f"; ctx.beginPath(); ctx.ellipse(0, -22, 32, 18, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(-28, -29, 15, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(-37, -41, 5, 0, Math.PI * 2); ctx.arc(-20, -42, 5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#382c26"; ctx.lineWidth = 4;
  for (const stripe of [-15, 0, 15]) {
    ctx.beginPath(); ctx.moveTo(stripe, -38); ctx.lineTo(stripe + 6, -23); ctx.stroke();
  }
  ctx.fillStyle = "#f4dbb8"; ctx.beginPath(); ctx.ellipse(-35, -23, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#302a27"; ctx.fillRect(-36, -34, 3, 3); ctx.fillRect(-43, -25, 4, 3);
  ctx.restore();
}

function drawJungleBackground(camera) {
  const sky = ctx.createLinearGradient(0, 0, 0, 490);
  sky.addColorStop(0, "#87b8a0"); sky.addColorStop(.55, "#527d61"); sky.addColorStop(1, "#304d3c");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 1000, 490);
  ctx.save();
  ctx.translate(-(camera * viewScale * .2 % 280), 0);
  for (let x = -280; x < 1400; x += 140) {
    ctx.fillStyle = "#315c49"; ctx.fillRect(x + 45, 80, 28, 330);
    ctx.fillStyle = "#386e50";
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.arc(x + i * 42, 85 + (i % 2) * 28, 65, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
  ctx.save();
  ctx.translate(-(camera * viewScale * .38 % 560), 0);
  for (let x = -560; x < 1600; x += 280) {
    ctx.fillStyle = "#264b36"; ctx.beginPath(); ctx.ellipse(x + 80, 358, 125, 45, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#7ba26c"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x + 22, 0); ctx.bezierCurveTo(x - 15, 100, x + 80, 145, x + 40, 205); ctx.stroke();
  }
  for (let x = -560; x < 1600; x += 560) drawTiger(x + 360, 358);
  ctx.restore();
}

function drawSpaceBackground(camera) {
  const sky = ctx.createLinearGradient(0, 0, 0, 490);
  sky.addColorStop(0, "#11132f"); sky.addColorStop(.6, "#252b56"); sky.addColorStop(1, "#49436b");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 1000, 490);
  ctx.save();
  ctx.translate(-(camera * viewScale * .12 % 500), 0);
  for (let x = -500; x < 1500; x += 500) {
    for (let i = 0; i < 32; i++) {
      const sx = x + (i * 137 % 500);
      const sy = 25 + (i * 83 % 300);
      ctx.fillStyle = i % 4 === 0 ? "#a5dded" : "#f2e9dc";
      const radius = i % 5 === 0 ? 2 : 1;
      ctx.beginPath(); ctx.arc(sx, sy, radius, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = "#b88da8";
    ctx.beginPath(); ctx.arc(x + 350, 115, 44, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#dec5c1"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(x + 350, 115, 66, 14, -.25, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  ctx.translate(-(camera * viewScale * .3 % 700), 0);
  ctx.fillStyle = "#343958";
  ctx.beginPath(); ctx.moveTo(-700, 375);
  for (let x = -700; x < 1700; x += 175) {
    ctx.lineTo(x + 70, 315 + (Math.abs(x / 175) % 3) * 12); ctx.lineTo(x + 175, 375);
  }
  ctx.lineTo(1700, 490); ctx.lineTo(-700, 490); ctx.fill();
  for (let x = -700; x < 1700; x += 700) {
    ctx.strokeStyle = "#7687a5"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(x + 100, 370); ctx.lineTo(x + 100, 285); ctx.lineTo(x + 135, 255); ctx.stroke();
    ctx.fillStyle = "#7de0e4"; ctx.beginPath(); ctx.arc(x + 135, 255, 7, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawUnderwaterBackground(camera) {
  const sea = ctx.createLinearGradient(0, 0, 0, 490);
  sea.addColorStop(0, "#367f98"); sea.addColorStop(.55, "#15546d"); sea.addColorStop(1, "#10394f");
  ctx.fillStyle = sea; ctx.fillRect(0, 0, 1000, 490);
  ctx.save();
  ctx.translate(-(camera * viewScale * .18 % 480), 0);
  for (let x = -480; x < 1500; x += 480) {
    ctx.fillStyle = "#b1e7d51a";
    ctx.beginPath(); ctx.moveTo(x + 110, 0); ctx.lineTo(x + 200, 0); ctx.lineTo(x + 390, 385); ctx.lineTo(x + 260, 385); ctx.fill();
    for (let i = 0; i < 13; i++) {
      ctx.strokeStyle = "#b4e7e6a0"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x + 20 + i * 36, 45 + (i * 73 % 300), 3 + i % 4, 0, Math.PI * 2); ctx.stroke();
    }
    for (let i = 0; i < 4; i++) {
      const fx = x + 80 + i * 100;
      const fy = 130 + (i * 67 % 170);
      ctx.fillStyle = i % 2 ? "#f1b176" : "#8ed1ca";
      ctx.beginPath(); ctx.ellipse(fx, fy, 15, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(fx - 12, fy); ctx.lineTo(fx - 23, fy - 8); ctx.lineTo(fx - 23, fy + 8); ctx.fill();
      ctx.fillStyle = "#173b4d"; ctx.beginPath(); ctx.arc(fx + 8, fy - 2, 1.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
  ctx.save();
  ctx.translate(-(camera * viewScale * .38 % 420), 0);
  for (let x = -420; x < 1500; x += 140) {
    ctx.strokeStyle = x % 280 === 0 ? "#70aa80" : "#cf8d88"; ctx.lineWidth = 7; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x + 45, 380); ctx.bezierCurveTo(x + 20, 345, x + 70, 315, x + 45, 275); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 46, 338); ctx.lineTo(x + 15, 310); ctx.moveTo(x + 48, 320); ctx.lineTo(x + 76, 294); ctx.stroke();
  }
  ctx.restore();
}

function drawBazaarBackground(camera) {
  const sky = ctx.createLinearGradient(0, 0, 0, 490);
  sky.addColorStop(0, "#d69277"); sky.addColorStop(.55, "#f5c990"); sky.addColorStop(1, "#bb8165");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 1000, 490);
  ctx.save();
  ctx.translate(-(camera * viewScale * .18 % 360), 0);
  for (let x = -360; x < 1500; x += 360) {
    ctx.fillStyle = "#b16e60"; ctx.fillRect(x + 30, 190, 270, 230);
    ctx.beginPath(); ctx.ellipse(x + 165, 190, 90, 62, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = "#8c5a55"; ctx.fillRect(x + 305, 125, 30, 295);
    ctx.beginPath(); ctx.moveTo(x + 300, 125); ctx.lineTo(x + 320, 86); ctx.lineTo(x + 340, 125); ctx.fill();
    ctx.strokeStyle = "#e7bb8d"; ctx.lineWidth = 3;
    for (let j = 0; j < 3; j++) {
      const wx = x + 65 + j * 85;
      ctx.beginPath(); ctx.moveTo(wx, 300); ctx.lineTo(wx, 240); ctx.quadraticCurveTo(wx + 18, 210, wx + 36, 240); ctx.lineTo(wx + 36, 300); ctx.stroke();
    }
  }
  ctx.restore();
  ctx.save();
  ctx.translate(-(camera * viewScale * .38 % 400), 0);
  for (let x = -400; x < 1500; x += 400) {
    ctx.fillStyle = "#8e5948"; ctx.fillRect(x + 20, 265, 150, 115);
    ctx.fillStyle = "#e5ba85"; ctx.fillRect(x + 30, 305, 130, 45);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 ? "#e5bb8b" : "#a85d55";
      ctx.fillRect(x + 10 + i * 34, 250, 34, 22);
    }
    ctx.strokeStyle = "#754e46"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x + 10, 250); ctx.lineTo(x + 180, 250); ctx.stroke();
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = ["#9a695c", "#e0ab76", "#6e8d7c"][i];
      ctx.beginPath(); ctx.ellipse(x + 55 + i * 38, 315, 14, 11, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = "#f4d18c";
    ctx.fillRect(x + 255, 188, 3, 70);
    ctx.beginPath(); ctx.ellipse(x + 256, 268, 12, 17, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawUnicornBackground(camera) {
  const sky = ctx.createLinearGradient(0, 0, 0, 490);
  sky.addColorStop(0, "#a7c7ef"); sky.addColorStop(.55, "#f5c7e0"); sky.addColorStop(1, "#f7e6bf");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 1000, 490);
  ctx.save();
  ctx.translate(-(camera * viewScale * .12 % 800), 0);
  for (let x = -800; x < 1800; x += 800) {
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = ["#ed91aa", "#f7c37a", "#f6e5a0", "#a9d8bd", "#a6bdea"][i];
      ctx.lineWidth = 12;
      ctx.beginPath(); ctx.arc(x + 350, 325, 210 - i * 12, Math.PI, 0); ctx.stroke();
    }
    ctx.fillStyle = "#fff8fa";
    for (const [cx, cy, r] of [[95, 88, 30], [130, 77, 42], [170, 94, 29], [600, 125, 31], [640, 110, 40], [685, 128, 28]]) {
      ctx.beginPath(); ctx.arc(x + cx, cy, r, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
  ctx.save();
  ctx.translate(-(camera * viewScale * .32 % 500), 0);
  for (let x = -500; x < 1500; x += 500) {
    ctx.fillStyle = "#a9d2b1";
    ctx.beginPath(); ctx.moveTo(x, 390); ctx.quadraticCurveTo(x + 125, 245, x + 250, 360);
    ctx.quadraticCurveTo(x + 375, 270, x + 500, 390); ctx.lineTo(x + 500, 490); ctx.lineTo(x, 490); ctx.fill();
    ctx.fillStyle = "#f8f2f3";
    ctx.beginPath(); ctx.ellipse(x + 250, 330, 42, 22, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(x + 221, 335, 9, 31); ctx.fillRect(x + 267, 335, 9, 31);
    ctx.beginPath(); ctx.ellipse(x + 216, 310, 18, 24, -.35, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e7bb67";
    ctx.beginPath(); ctx.moveTo(x + 208, 291); ctx.lineTo(x + 204, 266); ctx.lineTo(x + 219, 291); ctx.fill();
    ctx.strokeStyle = "#d693bf"; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(x + 227, 292); ctx.quadraticCurveTo(x + 244, 310, x + 231, 329); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 290, 319); ctx.quadraticCurveTo(x + 320, 320, x + 308, 345); ctx.stroke();
  }
  ctx.restore();
}

function drawAlpsBackground(camera) {
  const sky = ctx.createLinearGradient(0, 0, 0, 490);
  sky.addColorStop(0, "#7cb6d2"); sky.addColorStop(1, "#dce9d3");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 1000, 490);
  ctx.save();
  ctx.translate(-(camera * viewScale * .16 % 440), 0);
  for (let x = -440; x < 1500; x += 440) {
    ctx.fillStyle = "#718f9c";
    ctx.beginPath(); ctx.moveTo(x, 370); ctx.lineTo(x + 155, 95); ctx.lineTo(x + 310, 370); ctx.fill();
    ctx.fillStyle = "#f1f3eb";
    ctx.beginPath(); ctx.moveTo(x + 105, 185); ctx.lineTo(x + 155, 95); ctx.lineTo(x + 208, 190);
    ctx.lineTo(x + 177, 175); ctx.lineTo(x + 155, 195); ctx.lineTo(x + 133, 174); ctx.fill();
    ctx.fillStyle = "#8ea99c";
    ctx.beginPath(); ctx.moveTo(x + 195, 370); ctx.lineTo(x + 340, 170); ctx.lineTo(x + 470, 370); ctx.fill();
  }
  ctx.restore();
  ctx.save();
  ctx.translate(-(camera * viewScale * .36 % 480), 0);
  for (let x = -480; x < 1500; x += 480) {
    ctx.fillStyle = "#719875"; ctx.beginPath(); ctx.ellipse(x + 240, 392, 290, 70, 0, 0, Math.PI * 2); ctx.fill();
    for (const tx of [40, 100, 390, 450]) {
      ctx.fillStyle = "#49684c"; ctx.fillRect(x + tx - 4, 310, 8, 70);
      ctx.beginPath(); ctx.moveTo(x + tx, 265); ctx.lineTo(x + tx - 28, 335); ctx.lineTo(x + tx + 28, 335); ctx.fill();
    }
    ctx.fillStyle = "#d5b894"; ctx.fillRect(x + 180, 310, 130, 65);
    ctx.fillStyle = "#694c41"; ctx.beginPath(); ctx.moveTo(x + 165, 312); ctx.lineTo(x + 245, 270); ctx.lineTo(x + 325, 312); ctx.fill();
    ctx.fillStyle = "#6b4a3e"; ctx.fillRect(x + 195, 325, 27, 24); ctx.fillRect(x + 270, 325, 27, 24); ctx.fillRect(x + 235, 337, 21, 38);
  }
  ctx.restore();
}

function drawNewYorkBackground(camera) {
  const sky = ctx.createLinearGradient(0, 0, 0, 490);
  sky.addColorStop(0, "#667a9e"); sky.addColorStop(.6, "#e1a09a"); sky.addColorStop(1, "#f3c8a4");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 1000, 490);
  ctx.save();
  ctx.translate(-(camera * viewScale * .23 % 600), 0);
  for (let x = -600; x < 1600; x += 600) {
    for (let i = 0; i < 7; i++) {
      const bx = x + i * 86;
      const height = [135, 205, 155, 255, 170, 215, 130][i];
      ctx.fillStyle = i % 2 ? "#52546b" : "#6b6576";
      ctx.fillRect(bx, 375 - height, 78, height);
      if (i === 3) {
        ctx.fillRect(bx + 20, 92, 38, 28); ctx.fillRect(bx + 36, 55, 6, 40);
      }
      ctx.fillStyle = "#f6d5aa";
      for (let wy = 390 - height; wy < 355; wy += 28) {
        for (let wx = bx + 12; wx < bx + 70; wx += 20) ctx.fillRect(wx, wy, 7, 11);
      }
    }
  }
  ctx.restore();
  ctx.fillStyle = "#718798"; ctx.fillRect(0, 365, 1000, 25);
  ctx.strokeStyle = "#d7d1c6"; ctx.lineWidth = 2;
  for (let x = 0; x < 1000; x += 80) { ctx.beginPath(); ctx.moveTo(x, 376); ctx.lineTo(x + 40, 376); ctx.stroke(); }
}

function drawLondonBackground(camera) {
  const sky = ctx.createLinearGradient(0, 0, 0, 490);
  sky.addColorStop(0, "#8faab4"); sky.addColorStop(1, "#dfd4bd");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 1000, 490);
  ctx.save();
  ctx.translate(-(camera * viewScale * .2 % 700), 0);
  for (let x = -700; x < 1700; x += 700) {
    ctx.fillStyle = "#958982"; ctx.fillRect(x + 50, 230, 300, 150);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = "#7a706e"; ctx.beginPath(); ctx.moveTo(x + 50 + i * 50, 230);
      ctx.lineTo(x + 75 + i * 50, 200); ctx.lineTo(x + 100 + i * 50, 230); ctx.fill();
    }
    ctx.fillStyle = "#b9a489"; ctx.fillRect(x + 370, 125, 70, 255);
    ctx.fillStyle = "#655e60"; ctx.beginPath(); ctx.moveTo(x + 364, 125); ctx.lineTo(x + 405, 62); ctx.lineTo(x + 446, 125); ctx.fill();
    ctx.fillStyle = "#f2e6c6"; ctx.beginPath(); ctx.arc(x + 405, 163, 23, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#655e60"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x + 405, 148); ctx.lineTo(x + 405, 163); ctx.lineTo(x + 416, 169); ctx.stroke();
    ctx.fillStyle = "#a69a8b"; ctx.fillRect(x + 510, 210, 45, 170); ctx.fillRect(x + 615, 210, 45, 170);
    ctx.fillStyle = "#706f73"; ctx.beginPath(); ctx.moveTo(x + 505, 210); ctx.lineTo(x + 532, 174); ctx.lineTo(x + 560, 210);
    ctx.moveTo(x + 610, 210); ctx.lineTo(x + 637, 174); ctx.lineTo(x + 665, 210); ctx.fill();
    ctx.fillRect(x + 545, 265, 85, 15);
  }
  ctx.restore();
  ctx.fillStyle = "#7f9ca4"; ctx.fillRect(0, 367, 1000, 23);
  ctx.save();
  ctx.translate(-(camera * viewScale * .4 % 650), 0);
  for (let x = -650; x < 1500; x += 650) {
    ctx.fillStyle = "#aa4b48"; ctx.fillRect(x + 210, 318, 105, 54);
    ctx.fillStyle = "#d8d0c0";
    for (let i = 0; i < 4; i++) { ctx.fillRect(x + 218 + i * 23, 324, 16, 13); ctx.fillRect(x + 218 + i * 23, 343, 16, 12); }
    ctx.fillStyle = "#45454b"; ctx.beginPath(); ctx.arc(x + 230, 373, 9, 0, Math.PI * 2); ctx.arc(x + 296, 373, 9, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawLibraryBackground(camera) {
  const wall = ctx.createLinearGradient(0, 0, 0, 490);
  wall.addColorStop(0, "#302635"); wall.addColorStop(.6, "#665044"); wall.addColorStop(1, "#8d6a4e");
  ctx.fillStyle = wall; ctx.fillRect(0, 0, 1000, 490);
  ctx.save();
  ctx.translate(-(camera * viewScale * .18 % 420), 0);
  for (let x = -420; x < 1500; x += 420) {
    ctx.fillStyle = "#49363a";
    ctx.beginPath(); ctx.moveTo(x + 40, 390); ctx.lineTo(x + 40, 150);
    ctx.quadraticCurveTo(x + 210, 0, x + 380, 150); ctx.lineTo(x + 380, 390); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#a88262"; ctx.lineWidth = 9; ctx.stroke();
    ctx.fillStyle = "#352d36"; ctx.fillRect(x + 58, 145, 304, 235);
    for (let shelf = 0; shelf < 3; shelf++) {
      const bottom = 219 + shelf * 75;
      ctx.fillStyle = "#a87b53"; ctx.fillRect(x + 55, bottom, 310, 9);
      for (let i = 0; i < 13; i++) {
        const height = 37 + (i * 13 + shelf * 7) % 25;
        const bx = x + 65 + i * 22;
        ctx.fillStyle = ["#9b6158", "#668079", "#a48758", "#715c79", "#b0755b"][(i + shelf) % 5];
        ctx.fillRect(bx, bottom - height, 17, height);
        ctx.fillStyle = "#e0bd85"; ctx.fillRect(bx + 2, bottom - height + 7, 13, 2);
      }
    }
  }
  ctx.restore();
  ctx.save();
  ctx.translate(-(camera * viewScale * .4 % 650), 0);
  for (let x = -650; x < 1700; x += 650) {
    ctx.fillStyle = "#704c3e"; ctx.fillRect(x + 60, 328, 120, 53);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = ["#8b4e50", "#54716a", "#b58b5e"][i];
      ctx.fillRect(x + 70 + i * 6, 315 - i * 15, 98, 13);
      ctx.fillStyle = "#ead7b3"; ctx.fillRect(x + 77 + i * 6, 317 - i * 15, 83, 8);
    }
    ctx.fillStyle = "#f4dfb6";
    ctx.beginPath(); ctx.moveTo(x + 353, 120); ctx.quadraticCurveTo(x + 378, 109, x + 402, 125);
    ctx.lineTo(x + 402, 155); ctx.quadraticCurveTo(x + 378, 140, x + 353, 151); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + 402, 125); ctx.quadraticCurveTo(x + 427, 109, x + 452, 120);
    ctx.lineTo(x + 452, 151); ctx.quadraticCurveTo(x + 427, 140, x + 402, 155); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#af8a65"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + 402, 125); ctx.lineTo(x + 402, 155); ctx.stroke();
    ctx.fillStyle = "#f5d686";
    for (const [sx, sy] of [[320, 95], [478, 180], [390, 195]]) {
      ctx.fillRect(x + sx - 1, sy - 6, 2, 12); ctx.fillRect(x + sx - 6, sy - 1, 12, 2);
    }
  }
  ctx.restore();
}

function drawMagicBackground(camera) {
  const sky = ctx.createLinearGradient(0, 0, 0, 490);
  sky.addColorStop(0, "#181b3f"); sky.addColorStop(.6, "#514477"); sky.addColorStop(1, "#9a7193");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 1000, 490);
  ctx.save();
  ctx.translate(-(camera * viewScale * .12 % 600), 0);
  for (let x = -600; x < 1600; x += 600) {
    ctx.fillStyle = "#f4e3bf"; ctx.beginPath(); ctx.arc(x + 410, 85, 38, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#29254c"; ctx.beginPath(); ctx.arc(x + 425, 72, 33, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 28; i++) {
      const sx = x + (i * 137 % 600);
      const sy = 20 + (i * 71 % 260);
      ctx.fillStyle = i % 3 === 0 ? "#b6e8df" : "#f4dfa8";
      ctx.fillRect(sx - 1, sy - 3, 2, 6);
      ctx.fillRect(sx - 3, sy - 1, 6, 2);
    }
    ctx.fillStyle = "#343053";
    ctx.beginPath(); ctx.moveTo(x, 370); ctx.lineTo(x + 100, 235); ctx.lineTo(x + 240, 370);
    ctx.lineTo(x + 390, 220); ctx.lineTo(x + 600, 370); ctx.lineTo(x + 600, 490); ctx.lineTo(x, 490); ctx.fill();
  }
  ctx.restore();
  ctx.save();
  ctx.translate(-(camera * viewScale * .35 % 550), 0);
  for (let x = -550; x < 1600; x += 550) {
    ctx.fillStyle = "#49405e"; ctx.fillRect(x + 150, 195, 115, 190); ctx.fillRect(x + 285, 250, 85, 135);
    ctx.fillStyle = "#30283f";
    ctx.beginPath(); ctx.moveTo(x + 140, 195); ctx.lineTo(x + 207, 100); ctx.lineTo(x + 275, 195); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + 275, 250); ctx.lineTo(x + 327, 180); ctx.lineTo(x + 380, 250); ctx.fill();
    ctx.fillStyle = "#f6d990";
    for (const [wx, wy] of [[175, 220], [225, 220], [175, 290], [225, 290], [310, 280]]) {
      ctx.beginPath(); ctx.arc(x + wx, wy, 11, Math.PI, 0); ctx.lineTo(x + wx + 11, wy + 20); ctx.lineTo(x + wx - 11, wy + 20); ctx.fill();
    }
    ctx.fillStyle = "#30283f"; ctx.fillRect(x + 198, 332, 22, 53);
    ctx.fillStyle = "#674c6c"; ctx.fillRect(x + 70, 330, 53, 50);
    ctx.fillStyle = "#80d9bc"; ctx.beginPath(); ctx.ellipse(x + 96, 330, 32, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#b9f4d2"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x + 85, 315); ctx.bezierCurveTo(x + 65, 295, x + 110, 283, x + 92, 262); ctx.stroke();
  }
  ctx.restore();
}

function drawGround(camera) {
  const start = Math.max(0, Math.floor(camera / 25) * 25);
  const end = camera + canvas.width / viewScale + 25;
  const level = worldLevel;
  ctx.fillStyle = ["#40333a", "#b98150", "#3c5941", "#41465e", "#8a8771", "#a2745c", "#ad8d94", "#6b8060", "#565461", "#6f6863", "#61483e", "#4b395a"][level];
  ctx.beginPath(); ctx.moveTo(start, 600);
  for (let x = start; x <= end; x += 25) ctx.lineTo(x, floorAt(x));
  ctx.lineTo(end, 600); ctx.closePath(); ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = ["#5f4948", "#cf9c64", "#557456", "#59657d", "#a29b7e", "#c29370", "#c9a9ae", "#819473", "#777180", "#91857a", "#816151", "#6c557a"][level]; ctx.lineWidth = 2;
  for (let y = 330; y < 600; y += 30) {
    ctx.beginPath(); ctx.moveTo(start, y); ctx.lineTo(end, y); ctx.stroke();
    const offset = (Math.floor((y - 330) / 30) % 2) * 50;
    for (let x = Math.floor((start - offset) / 100) * 100 + offset; x <= end; x += 100) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 30); ctx.stroke();
    }
  }
  ctx.restore();
  ctx.strokeStyle = ["#a7806e", "#f0ca88", "#9cad6d", "#9abac9", "#d0c598", "#f0c58f", "#e7c7c9", "#c5d5a5", "#a9a4ac", "#c5b4a4", "#d5b583", "#c4a4c6"][level]; ctx.lineWidth = 8;
  ctx.beginPath();
  for (let x = start; x <= end; x += 25) {
    if (x === start) ctx.moveTo(x, floorAt(x));
    else ctx.lineTo(x, floorAt(x));
  }
  ctx.stroke();
}

function drawPit(x) {
  const floor = floorAt(x);
  ctx.fillStyle = "#171824"; ctx.fillRect(x, floor - 4, pitWidth, 600 - floor);
  ctx.fillStyle = "#5f3438";
  for (let px = x + 4; px < x + pitWidth - 10; px += 24) {
    ctx.beginPath(); ctx.moveTo(px, floor + 110); ctx.lineTo(px + 11, floor + 84); ctx.lineTo(px + 22, floor + 110); ctx.fill();
  }
  ctx.fillStyle = "#c18d71"; ctx.fillRect(x - 5, floor, 5, 15); ctx.fillRect(x + pitWidth, floor, 5, 15);
}

function drawPillar(x) {
  const floor = floorAt(x);
  ctx.save(); ctx.translate(x, floor - ground);
  ctx.fillStyle = "#705457"; ctx.fillRect(0, 190, 36, 202);
  ctx.fillStyle = "#a47b6a"; ctx.fillRect(4, 195, 28, 197);
  ctx.fillStyle = "#c59678"; ctx.fillRect(-5, 182, 46, 12); ctx.fillRect(-5, 381, 46, 11);
  ctx.fillStyle = "#8c6962"; ctx.fillRect(9, 199, 3, 180); ctx.fillRect(24, 199, 3, 180);
  ctx.fillStyle = "#49363d"; ctx.fillRect(12, 267, 12, 18);
  if (worldLevel === 3 || worldLevel === 4) {
    ctx.fillStyle = worldLevel === 3 ? "#96f1f0" : "#b2e8de";
    ctx.beginPath(); ctx.arc(18, 260, 8, 0, Math.PI * 2); ctx.fill();
  } else {
    const flicker = Math.sin(animationTime * 9 + x) * 3;
    ctx.fillStyle = "#e19655"; ctx.beginPath(); ctx.moveTo(11, 268); ctx.quadraticCurveTo(8, 253, 19 + flicker, 242); ctx.quadraticCurveTo(27, 258, 25, 268); ctx.fill();
    ctx.fillStyle = "#f6d590"; ctx.beginPath(); ctx.moveTo(16, 268); ctx.quadraticCurveTo(13, 259, 19, 253); ctx.quadraticCurveTo(23, 260, 22, 268); ctx.fill();
  }
  ctx.restore();
}

function drawBridge(segment, top = false) {
  const x = segment.base + (segment.answers.length === 3 ? threeChoiceBridgeStart : 620);
  const end = segment.base + 1330;
  const upperY = bridgeHeight(segment) - (top ? upperGap : 0);
  const broken = !top && segment.upperHazard === "bridge" && segment.choice === 0 && segment.activatedAt !== null;
  const gap = segment.base + trapOffset;
  const spans = broken ? [[x, gap], [gap + pitWidth, end]] : [[x, end]];
  for (const [start, finish] of spans) {
    ctx.fillStyle = "#604747"; ctx.fillRect(start, upperY, finish - start, 20);
    ctx.fillStyle = "#be9073"; ctx.fillRect(start, upperY, finish - start, 6);
    ctx.strokeStyle = "#8b6960"; ctx.lineWidth = 2;
    for (let px = start + 35; px < finish; px += 35) {
      ctx.beginPath(); ctx.moveTo(px, upperY + 6); ctx.lineTo(px, upperY + 20); ctx.stroke();
    }
  }
  if (!top && segment.upperHazard === "bridge") {
    const elapsed = broken ? Math.min(animationTime - segment.activatedAt, 1.4) : 0;
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.translate(gap + 15 + i * 30, upperY + 6 + elapsed * elapsed * (55 + i * 12));
      ctx.rotate(elapsed * (i % 2 ? 1.4 : -1.1));
      ctx.fillStyle = "#9c6e51"; ctx.fillRect(-14, 0, 27, 11);
      ctx.strokeStyle = "#d1a283"; ctx.lineWidth = 1; ctx.strokeRect(-14, 0, 27, 11);
      ctx.restore();
    }
  }
}

function drawTrapdoor(segment) {
  const x = segment.base + trapOffset;
  const y = floorAt(x);
  const opened = segment.choice === 1 && segment.activatedAt !== null;
  const angle = opened ? Math.min((animationTime - segment.activatedAt) * 5, 1.35) : 0;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side === -1 ? x : x + pitWidth, y);
    ctx.rotate(side === -1 ? angle : -angle);
    ctx.fillStyle = "#6b493d"; ctx.fillRect(side === -1 ? 0 : -pitWidth / 2, -5, pitWidth / 2, 12);
    ctx.strokeStyle = "#c69b75"; ctx.lineWidth = 2;
    ctx.strokeRect(side === -1 ? 0 : -pitWidth / 2, -5, pitWidth / 2, 12);
    ctx.fillStyle = "#d7b18b"; ctx.fillRect(side === -1 ? 4 : -8, -2, 4, 4);
    ctx.restore();
  }
}

function drawDog(segment) {
  const x = segment.base + trapOffset + 70;
  const y = bridgeHeight(segment);
  const chosen = segment.choice === 0;
  const safe = chosen && segment.correct;
  const moving = safe || (chosen && segment.activatedAt !== null);
  const motion = safe ? Math.min(125, (animationTime - segment.choiceTime) * 100)
    : segment.activatedAt !== null && chosen ? -Math.min(80, (animationTime - segment.activatedAt) * 240) : 0;
  const stride = moving ? Math.sin(animationTime * 15) * 5 : 0;
  ctx.save(); ctx.translate(x + motion, y);
  ctx.strokeStyle = "#3e2d2b"; ctx.lineWidth = 6; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-20, -18); ctx.lineTo(-22 + stride, -2); ctx.moveTo(12, -18); ctx.lineTo(15 - stride, -2); ctx.moveTo(22, -30); ctx.lineTo(37, -42 + Math.sin(animationTime * 7) * 4); ctx.stroke();
  ctx.fillStyle = "#90674e"; ctx.beginPath(); ctx.ellipse(0, -28, 29, 16, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#a47d5e"; ctx.beginPath(); ctx.ellipse(-25, -36, 16, 15, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#553d34"; ctx.beginPath(); ctx.moveTo(-35, -47); ctx.lineTo(-22, -48); ctx.lineTo(-22, -32); ctx.closePath(); ctx.fill();
  ctx.fillRect(-43, -34, 14, 8);
  ctx.fillStyle = "#e7d4a9"; ctx.fillRect(-32, -40, 4, 4);
  ctx.fillStyle = "#302a2b"; ctx.fillRect(-31, -39, 2, 2); ctx.fillRect(-44, -33, 4, 4);
  ctx.fillStyle = "#b65848"; ctx.fillRect(-15, -42, 4, 23);
  ctx.restore();
}

function drawBoulder(segment) {
  const x = segment.base + trapOffset + 70;
  const floor = floorAt(x);
  const triggered = segment.choice === 1 && segment.activatedAt !== null;
  const elapsed = triggered ? animationTime - segment.activatedAt : 0;
  const drop = Math.min(elapsed * 260, 70);
  const roll = triggered ? (elapsed < .3 ? -elapsed * 220 : -66 + (elapsed - .3) * speed) : 0;
  ctx.save();
  if (!triggered) {
    ctx.strokeStyle = "#89715c"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, floor - 210); ctx.lineTo(x, floor - 128); ctx.stroke();
  }
  ctx.translate(x + roll, floor - 102 + drop);
  ctx.rotate(triggered ? elapsed * 4 : 0);
  ctx.fillStyle = "#79685f"; ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#b39a81"; ctx.lineWidth = 3; ctx.stroke();
  ctx.strokeStyle = "#51464a"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-18, -12); ctx.lineTo(-6, -5); ctx.lineTo(-10, 8); ctx.lineTo(4, 18); ctx.moveTo(8, -22); ctx.lineTo(14, -8); ctx.lineTo(24, -4); ctx.stroke();
  ctx.restore();
}

function drawPendulum(segment) {
  const x = segment.base + trapOffset + 70;
  const y = bridgeHeight(segment);
  const safe = segment.choice === 0 && segment.correct;
  const triggered = segment.choice === 0 && segment.activatedAt !== null;
  const elapsed = triggered ? animationTime - segment.activatedAt : 0;
  const length = safe ? Math.max(50, 125 - (animationTime - segment.choiceTime) * 100) : 125;
  const angle = triggered ? Math.sin(Math.min(elapsed * 5, Math.PI)) * -.7 : Math.sin(animationTime * 2) * .1;
  ctx.save();
  ctx.translate(x, y - 150);
  ctx.rotate(angle);
  ctx.strokeStyle = "#b29a82"; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, length); ctx.stroke();
  ctx.fillStyle = "#61565b"; ctx.beginPath(); ctx.arc(0, length, 21, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#c8aa8a"; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = "#aa8f78"; ctx.beginPath(); ctx.arc(-6, length - 6, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawFlameTrap(segment) {
  const x = segment.base + trapOffset;
  const y = floorAt(x);
  const triggered = segment.choice === 1 && segment.activatedAt !== null;
  ctx.fillStyle = "#5b4947"; ctx.fillRect(x, y - 5, pitWidth, 10);
  ctx.strokeStyle = "#c59b75"; ctx.lineWidth = 2; ctx.strokeRect(x, y - 5, pitWidth, 10);
  for (let i = 0; i < 7; i++) {
    const px = x + 12 + i * 25;
    ctx.fillStyle = "#241f29"; ctx.fillRect(px, y - 2, 12, 4);
    if (triggered) {
      const age = animationTime - segment.activatedAt;
      const height = Math.min(1, age * 5) * (65 + Math.sin(animationTime * 18 + i * 2) * 12);
      ctx.fillStyle = "#d46f36"; ctx.beginPath(); ctx.moveTo(px - 3, y); ctx.quadraticCurveTo(px - 4, y - height * .45, px + 6, y - height); ctx.quadraticCurveTo(px + 18, y - height * .4, px + 15, y); ctx.fill();
      ctx.fillStyle = "#f4c778"; ctx.beginPath(); ctx.moveTo(px + 1, y); ctx.quadraticCurveTo(px + 1, y - height * .25, px + 6, y - height * .55); ctx.quadraticCurveTo(px + 12, y - height * .25, px + 11, y); ctx.fill();
    }
  }
}

function drawCeilingTrap(segment) {
  const x = segment.base + trapOffset + 70;
  const y = bridgeHeight(segment);
  const triggered = segment.choice === 0 && segment.activatedAt !== null;
  const elapsed = triggered ? animationTime - segment.activatedAt : 0;
  const drop = Math.min(elapsed * 480, 105);
  ctx.save();
  ctx.translate(x, y - 180 + drop);
  ctx.fillStyle = "#62545a"; ctx.fillRect(-48, -30, 96, 46);
  ctx.strokeStyle = "#b69b83"; ctx.lineWidth = 3; ctx.strokeRect(-48, -30, 96, 46);
  ctx.strokeStyle = "#3e3540"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-48, -8); ctx.lineTo(48, -8); ctx.moveTo(0, -30); ctx.lineTo(0, -8); ctx.stroke();
  ctx.fillStyle = "#b69b83"; ctx.fillRect(-36, -22, 5, 5); ctx.fillRect(31, -22, 5, 5);
  ctx.restore();
}

function drawNetTrap(segment) {
  const x = segment.base + trapOffset + 55;
  const y = floorAt(x);
  const triggered = segment.choice === 1 && segment.activatedAt !== null;
  const elapsed = triggered ? animationTime - segment.activatedAt : 0;
  const drop = Math.min(elapsed * 420, 115);
  ctx.save();
  ctx.translate(x + (triggered ? Math.max(0, elapsed - .2) * speed : 0), y - 190 + drop);
  ctx.strokeStyle = "#c5a77f"; ctx.lineWidth = 3;
  ctx.strokeRect(-48, -25, 96, 70);
  ctx.lineWidth = 1.5;
  for (let dx = -32; dx < 48; dx += 16) {
    ctx.beginPath(); ctx.moveTo(dx, -25); ctx.lineTo(dx, 45); ctx.stroke();
  }
  for (let dy = -10; dy < 45; dy += 15) {
    ctx.beginPath(); ctx.moveTo(-48, dy); ctx.lineTo(48, dy); ctx.stroke();
  }
  ctx.restore();
}

function drawSandTrap(segment) {
  const x = segment.base + trapOffset + 70;
  const y = bridgeHeight(segment);
  const triggered = segment.choice === 0 && segment.activatedAt !== null;
  ctx.fillStyle = "#806a5b"; ctx.fillRect(x - 24, y - 10, 48, 10);
  ctx.strokeStyle = "#d1b28e"; ctx.lineWidth = 2; ctx.strokeRect(x - 24, y - 10, 48, 10);
  if (!triggered) return;
  const age = animationTime - segment.activatedAt;
  ctx.save();
  ctx.translate(x + Math.max(0, age - .25) * speed, y);
  ctx.strokeStyle = "#d7b785"; ctx.lineWidth = 5;
  for (let i = 0; i < 4; i++) {
    const height = 15 + i * 22;
    ctx.beginPath(); ctx.ellipse(Math.sin(age * 8 + i) * 8, -height, 20 + i * 6, 8, 0, 0, Math.PI * 1.65); ctx.stroke();
  }
  ctx.restore();
}

function drawLightningTrap(segment, top = false) {
  const x = segment.base + trapOffset + 35;
  const y = bridgeHeight(segment) - (top ? upperGap : 0);
  const triggered = segment.choice === (top ? 2 : 0) && segment.activatedAt !== null;
  ctx.fillStyle = "#756783"; ctx.fillRect(x - 22, y - 165, 44, 16);
  ctx.fillStyle = "#c5b7df"; ctx.beginPath(); ctx.arc(x, y - 150, 8, 0, Math.PI * 2); ctx.fill();
  if (!triggered) return;
  const age = animationTime - segment.activatedAt;
  if (age > .8 || Math.floor(age * 20) % 3 === 2) return;
  ctx.strokeStyle = "#d8d1ff"; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(x, y - 145); ctx.lineTo(x + 16, y - 110);
  ctx.lineTo(x - 12, y - 80); ctx.lineTo(x + 12, y - 45); ctx.lineTo(x - 5, y); ctx.stroke();
  ctx.strokeStyle = "#fff6df"; ctx.lineWidth = 2; ctx.stroke();
}

function drawWaveTrap(segment) {
  const x = segment.base + trapOffset + 125;
  const y = floorAt(x);
  const triggered = segment.choice === 1 && segment.activatedAt !== null;
  const raised = segment.choice === 1 && segment.correct ? Math.min((animationTime - segment.choiceTime) * 150, 125) : 0;
  ctx.fillStyle = "#53656b"; ctx.fillRect(x - 30, y - 115 - raised, 60, 115);
  ctx.strokeStyle = "#92a9a8"; ctx.lineWidth = 4; ctx.strokeRect(x - 30, y - 115 - raised, 60, 115);
  for (let i = -20; i <= 20; i += 20) {
    ctx.beginPath(); ctx.moveTo(x + i, y - 110 - raised); ctx.lineTo(x + i, y - raised); ctx.stroke();
  }
  if (!triggered) return;
  const age = animationTime - segment.activatedAt;
  const front = x - Math.min(age * 270, 110) + Math.max(0, age - .4) * speed;
  ctx.fillStyle = "#6395a8"; ctx.beginPath(); ctx.moveTo(front - 50, y);
  ctx.quadraticCurveTo(front - 55, y - 68, front - 16, y - 78);
  ctx.quadraticCurveTo(front + 12, y - 84, front + 26, y - 37);
  ctx.lineTo(front + 60, y); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#c6e2df"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(front - 50, y); ctx.quadraticCurveTo(front - 55, y - 68, front - 16, y - 78); ctx.quadraticCurveTo(front + 12, y - 84, front + 26, y - 37); ctx.stroke();
}

function drawVortexTrap(segment) {
  const x = segment.base + trapOffset + 55;
  const y = floorAt(x);
  const triggered = segment.choice === 1 && segment.activatedAt !== null;
  const age = triggered ? animationTime - segment.activatedAt : 0;
  ctx.save();
  ctx.translate(x + (triggered ? Math.max(0, age - .2) * speed : 0), y - (triggered ? 38 : 8));
  ctx.strokeStyle = "#a89bd0"; ctx.lineWidth = triggered ? 4 : 2;
  for (let i = 0; i < (triggered ? 4 : 2); i++) {
    ctx.beginPath(); ctx.ellipse(0, 0, 18 + i * 12, 6 + i * 8, animationTime * 2 + i, 0, Math.PI * 1.6); ctx.stroke();
  }
  ctx.restore();
}

function drawSign(x, y, label, top, phase, direction = top ? "↑ OBEN" : "↓ UNTEN") {
  ctx.save();
  ctx.translate(x + 75, y);
  ctx.rotate(Math.sin(animationTime * 2 + phase) * .045);
  ctx.strokeStyle = "#47313a"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-50, -19); ctx.lineTo(-50, 0); ctx.moveTo(50, -19); ctx.lineTo(50, 0); ctx.stroke();
  ctx.fillStyle = "#483039"; ctx.fillRect(-79, 2, 158, 42);
  ctx.fillStyle = top ? "#c2946c" : "#b57f62"; ctx.fillRect(-76, 0, 152, 40);
  ctx.strokeStyle = "#e3b58a"; ctx.lineWidth = 1; ctx.strokeRect(-72, 4, 144, 32);
  ctx.fillStyle = "#402d31"; ctx.font = "bold 20px Georgia, serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(label, 0, 20, 130);
  ctx.fillStyle = "#e5bf98"; ctx.fillRect(-68, 9, 3, 3); ctx.fillRect(65, 9, 3, 3);
  ctx.restore();
  ctx.fillStyle = worldLevel === 1 ? "#503526" : "#f1d0a6"; ctx.font = "bold 12px Arial, sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
  ctx.fillText(direction, x - 10, y + 20);
}

function drawPlayer(grounded = player.grounded) {
  const respawnAge = animationTime - respawnStarted;
  if (state === "respawning" && respawnAge < .3) return;
  const airborne = !grounded;
  const stride = airborne ? 0 : Math.sin(animationTime * 13);
  const bob = airborne ? 0 : Math.abs(stride) * 2;
  ctx.save(); ctx.translate(player.x, player.y - bob);
  if (state === "respawning") ctx.globalAlpha = Math.min(1, (respawnAge - .3) / .7);
  if (state === "hit" || (state === "gameover" && impactHazard)) {
    ctx.translate(player.width / 2, player.height / 2);
    const elapsed = animationTime - impactStarted;
    ctx.rotate(Math.min(1, elapsed / .6) * (impactHazard === "vortex" ? -2.4 : -1.25));
    ctx.translate(-player.width / 2, -player.height / 2);
  }
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.strokeStyle = "#352b37"; ctx.lineWidth = 9;
  ctx.beginPath(); ctx.moveTo(13, 39); ctx.lineTo(11 - stride * 7, 53); ctx.moveTo(22, 39); ctx.lineTo(24 + stride * 7, 53); ctx.stroke();
  ctx.strokeStyle = "#e5d1b3"; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(13, 39); ctx.lineTo(11 - stride * 7, 51); ctx.moveTo(22, 39); ctx.lineTo(24 + stride * 7, 51); ctx.stroke();
  ctx.fillStyle = "#49303a"; ctx.fillRect(7 - stride * 7, 52, 11, 5); ctx.fillRect(21 + stride * 7, 52, 11, 5);
  ctx.strokeStyle = "#382d38"; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(10, 25); ctx.lineTo(airborne ? 3 : 7 - stride * 5, airborne ? 15 : 36); ctx.moveTo(25, 25); ctx.lineTo(airborne ? 32 : 29 + stride * 5, airborne ? 15 : 36); ctx.stroke();
  ctx.strokeStyle = "#dcae89"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(10, 25); ctx.lineTo(airborne ? 3 : 7 - stride * 5, airborne ? 15 : 36); ctx.moveTo(25, 25); ctx.lineTo(airborne ? 32 : 29 + stride * 5, airborne ? 15 : 36); ctx.stroke();
  ctx.fillStyle = "#372e3a"; ctx.fillRect(8, 21, 20, 21);
  ctx.fillStyle = "#e1ceac"; ctx.fillRect(10, 22, 16, 17);
  ctx.fillStyle = "#a4463b"; ctx.fillRect(9, 36, 19, 5);
  ctx.fillStyle = "#bf8c6e"; ctx.fillRect(12, 3, 18, 19);
  ctx.fillStyle = "#392d37"; ctx.fillRect(10, 2, 19, 6); ctx.fillRect(10, 5, 5, 11);
  ctx.fillStyle = "#382d38"; ctx.fillRect(25, 10, 2, 2);
  ctx.fillStyle = "#d5a07b"; ctx.fillRect(27, 14, 5, 3);
  ctx.restore();
}

function drawRespawn() {
  if (state !== "respawning") return;
  const age = animationTime - respawnStarted;
  ctx.save();
  ctx.translate(player.x + player.width / 2, player.y + player.height);
  ctx.globalAlpha = Math.min(1, age * 5, (1.2 - age) * 3);
  ctx.strokeStyle = "#efd59a"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(0, 0, 38, 10, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = "#b5dce1"; ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const angle = animationTime * 4 + i * Math.PI / 4;
    const x = Math.cos(angle) * (20 + i % 2 * 12);
    const y = -((age * 80 + i * 13) % 90);
    ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y);
    ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4); ctx.stroke();
  }
  ctx.restore();
}

function positionQuestionBubble(camera) {
  const scale = canvas.clientWidth / canvas.width;
  const playerX = boss.active ? (boss.playerX + 18) * scale : (player.x + player.width / 2 - camera) * viewScale * scale;
  const playerY = boss.active ? (boss.playerY - 58) * scale : (viewOffsetY + player.y * viewScale) * scale;
  const width = questionBubble.offsetWidth;
  const height = questionBubble.offsetHeight;
  const left = Math.max(4, Math.min(canvas.clientWidth - width - 4, playerX - width / 2));
  const top = Math.max(4, Math.min(canvas.clientHeight - height - 12, playerY - height - 12));
  questionBubble.style.left = `${left}px`;
  questionBubble.style.top = `${top}px`;
  questionBubble.style.setProperty("--tail-x", `${Math.max(10, Math.min(width - 10, playerX - left))}px`);
}

function draw() {
  if (boss.active) {
    drawBoss();
    positionQuestionBubble(0);
    return;
  }
  const camera = Math.max(0, player.x - 330);
  drawBackground(camera);
  ctx.save();
  ctx.translate(0, viewOffsetY);
  ctx.scale(viewScale, viewScale);
  ctx.translate(-camera, 0);
  drawGround(camera);
  for (const segment of segments) {
    if (segment.base + segmentWidth < camera || segment.base > camera + canvas.width / viewScale) continue;
    const opened = segment.activatedAt !== null &&
      ((segment.choice === 0 && segment.upperHazard === "bridge") || (segment.choice === 1 && segment.lowerHazard === "trapdoor"));
    if (opened) drawPit(segment.base + trapOffset);
    drawPillar(segment.base + 365);
    drawPillar(segment.base + 1370);
    drawBridge(segment);
    if (segment.answers.length === 3) {
      drawBridge(segment, true);
      drawLightningTrap(segment, true);
    }
    if (segment.lowerHazard === "trapdoor" && !(opened && segment.choice === 0)) drawTrapdoor(segment);
    if (segment.upperHazard === "dog") drawDog(segment);
    if (segment.upperHazard === "pendulum") drawPendulum(segment);
    if (segment.upperHazard === "ceiling") drawCeilingTrap(segment);
    if (segment.upperHazard === "sand") drawSandTrap(segment);
    if (segment.upperHazard === "lightning") drawLightningTrap(segment);
    if (segment.lowerHazard === "boulder") drawBoulder(segment);
    if (segment.lowerHazard === "flame") drawFlameTrap(segment);
    if (segment.lowerHazard === "net") drawNetTrap(segment);
    if (segment.lowerHazard === "wave") drawWaveTrap(segment);
    if (segment.lowerHazard === "vortex") drawVortexTrap(segment);
    const floor = floorAt(segment.base + 700);
    drawSign(segment.base + 680, floor - upperGap - 56, segment.answers[0], true, segment.base,
      segment.answers.length === 3 ? "↑ MITTE" : "↑ OBEN");
    drawSign(segment.base + 680, floor - 70, segment.answers[1], false, segment.base + 1);
    if (segment.answers.length === 3) {
      drawSign(segment.base + 680, floor - upperGap * 2 - 56, segment.answers[2], true, segment.base + 2, "↑↑ OBEN");
    }
  }
  drawRespawn();
  drawPlayer();
  ctx.restore();
  positionQuestionBubble(camera);
}

function frame(time) {
  if (lastTime) {
    const dt = Math.min((time - lastTime) / 1000, .03);
    const steps = state === "running" ? Math.max(1, Math.ceil(speed * dt / 20)) : 1;
    for (let i = 0; i < steps; i++) update(dt / steps);
  }
  lastTime = time;
  if (state !== "menu") draw();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
