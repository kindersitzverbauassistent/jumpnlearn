"use strict";

const bossStatus = document.getElementById("boss-status");
const bossHint = document.getElementById("boss-hint");
const runHint = document.getElementById("run-hint");
const runTip = document.getElementById("run-tip");
const bossControls = document.getElementById("boss-controls");
const runControls = document.getElementById("run-controls");
const bossInstructions = document.getElementById("boss-instructions");
const bossInstructionsTitle = document.getElementById("boss-instructions-title");
const runInstructions = document.getElementById("run-instructions");
const runThreeInstructions = document.getElementById("run-three-instructions");
const bossIntro = document.getElementById("boss-intro");
const bossIntroTitle = document.getElementById("boss-intro-title");
const bossStartButton = document.getElementById("boss-start-button");
const bossTypes = [
  { name: "Dungeon-Wächter", title: "DER DUNGEON-WÄCHTER", projectile: "FEUERBALL" },
  { name: "Wüstenskorpion", title: "DER WÜSTENSKORPION", projectile: "SANDKUGEL" },
  { name: "Dschungeltiger", title: "DER DSCHUNGELTIGER", projectile: "DORNENKUGEL" },
  { name: "Sternenwächter", title: "DER STERNENWÄCHTER", projectile: "PLASMAKUGEL" },
  { name: "Tintenkrake", title: "DIE TINTENKRAKE", projectile: "TINTENKUGEL" },
  { name: "Basar-Dschinn", title: "DER BASAR-DSCHINN", projectile: "ZAUBERKUGEL" },
  { name: "Schatteneinhorn", title: "DAS SCHATTENEINHORN", projectile: "STERNENZAUBER" },
  { name: "Berggeist", title: "DER BERGGEIST", projectile: "STEINKUGEL" },
  { name: "Wolkenkratzer-Gargoyle", title: "DER WOLKENKRATZER-GARGOYLE", projectile: "BLITZKUGEL" },
  { name: "Uhrwerk-Wächter", title: "DER UHRWERK-WÄCHTER", projectile: "ZAHNRAD" },
  { name: "Bücherwächter", title: "DER BÜCHERWÄCHTER", projectile: "TINTENKUGEL" },
  { name: "Schattenmagier", title: "DER SCHATTENMAGIER", projectile: "ZAUBERKUGEL" }
];
const bossShieldX = 710;
const bossShieldWidth = 160;
const bossShieldHeight = 48;
const boss = {
  active: false,
  health: 5,
  question: null,
  playerX: 120,
  playerY: 390,
  playerVy: 0,
  fireballs: [],
  nextFire: 2,
  arrow: null,
  aim: null,
  invulnerable: 0,
  hitFlash: 0,
  victoryTime: 0
};

function showBossControls(show) {
  bossHint.hidden = bossControls.hidden = bossStatus.hidden = !show;
  runHint.hidden = runTip.hidden = runControls.hidden = show;
  bossInstructions.hidden = !show;
  const threeAnswers = !show && activeSegment() && activeSegment().answers.length === 3;
  runInstructions.hidden = show || threeAnswers;
  runThreeInstructions.hidden = show || !threeAnswers;
  canvas.classList.toggle("boss-aim", show);
  canvas.setAttribute("aria-label", show
    ? "Bosskampf: Bewege dich mit der Tastatur. Ziele mit der Maus und schieße mit der linken Maustaste auf das richtige Antwortschild."
    : "Die Figur läuft automatisch. Springe für die obere Antwort oder bleibe für die untere Antwort unten.");
}

function resetBoss() {
  bossIntro.hidden = true;
  boss.active = false;
  boss.question = null;
  boss.fireballs = [];
  boss.arrow = null;
  boss.aim = null;
  showBossControls(false);
}

function updateBossStatus() {
  bossStatus.textContent = `${bossTypes[worldLevel].name}: ${boss.health} von 5 Leben`;
}

function bossShieldY(index) {
  return 201 + index * (boss.question.answers.length === 2 ? 118 : 59);
}

function nextBossQuestion() {
  const next = makeSegment(index);
  const key = next.answerLanguage === "Deutsche" ? "german" : "english";
  const answers = [next.correctAnswer];
  const seen = new Set([next.correctAnswer.trim().toLocaleLowerCase()]);
  const candidates = appData.words.filter(word => word.id !== next.word.id);
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  for (const word of candidates) {
    const answer = word[key];
    const normalized = answer.trim().toLocaleLowerCase();
    if (!seen.has(normalized)) {
      answers.push(answer);
      seen.add(normalized);
    }
    if (answers.length === 3) break;
  }
  for (let i = answers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [answers[i], answers[j]] = [answers[j], answers[i]];
  }
  next.answers = answers;
  boss.question = next;
  updateBossStatus();
  updateHud();
  showQuestion();
}

function startBoss() {
  resetControls();
  state = "bossIntro";
  questionBubble.hidden = true;
  toast.hidden = true;
  toastTime = 0;
  levelToast.hidden = true;
  levelToastTime = 0;
  bossIntroTitle.textContent = `Gleich kämpfst du gegen ${bossTypes[worldLevel].name}!`;
  bossIntro.hidden = false;
  bossStartButton.focus({ preventScroll: true });
}

function beginBossFight() {
  if (state !== "bossIntro" || orientationPaused) return;
  bossIntro.hidden = true;
  boss.active = true;
  boss.health = 5;
  boss.playerX = 120;
  boss.playerY = 390;
  boss.playerVy = 0;
  boss.fireballs = [];
  boss.nextFire = 2.5;
  boss.arrow = null;
  boss.aim = null;
  boss.invulnerable = 0;
  boss.victoryTime = 0;
  resetControls();
  state = "boss";
  showBossControls(true);
  canvas.focus({ preventScroll: true });
  toast.hidden = true;
  toastTime = 0;
  bossInstructionsTitle.textContent = `Besiege ${bossTypes[worldLevel].name}!`;
  levelToast.textContent = `✦ ${bossTypes[worldLevel].title} ✦`;
  levelToast.hidden = false;
  levelToastTime = 4;
  playSound("boss");
  nextBossQuestion();
}

bossStartButton.addEventListener("click", beginBossFight);
bossIntro.addEventListener("keydown", event => {
  if (event.key === "Tab") {
    event.preventDefault();
    bossStartButton.focus();
  }
});

function bossControl(control, pressed) {
  if (pressed && !controls[control]) {
    if (control === "jump" && boss.playerY >= 390) {
      boss.playerVy = -650;
      playSound("jump");
    } else if (control === "shoot") shootBossArrow();
  }
  controls[control] = pressed;
}

function aimBossAt(event) {
  const rect = canvas.getBoundingClientRect();
  boss.aim = {
    x: (event.clientX - rect.left) * LOGICAL_W / rect.width,
    y: (event.clientY - rect.top) * LOGICAL_H / rect.height
  };
}

function shootBossArrow() {
  if (state !== "boss" || boss.arrow) return;
  const x = boss.playerX + 30;
  const y = boss.playerY - 38;
  const dx = boss.aim ? boss.aim.x - x : 1;
  const dy = boss.aim ? boss.aim.y - y : 0;
  const length = Math.hypot(dx, dy);
  if (length === 0) return;
  boss.arrow = { x, y, vx: dx / length * 1000, vy: dy / length * 1000 };
  playSound("arrow");
}

canvas.addEventListener("pointermove", event => {
  if (state === "boss") aimBossAt(event);
});
canvas.addEventListener("pointerdown", event => {
  if (state !== "boss" || (event.pointerType !== "touch" && !event.isPrimary) || event.button !== 0) return;
  event.preventDefault();
  canvas.focus({ preventScroll: true });
  aimBossAt(event);
  startMusicOnInteraction();
  shootBossArrow();
});

function arrowShieldIntersection(x, y, dx, dy, shieldY) {
  let start = 0;
  let end = 1;
  for (const [position, delta, min, max] of [
    [x, dx, bossShieldX, bossShieldX + bossShieldWidth],
    [y, dy, shieldY, shieldY + bossShieldHeight]
  ]) {
    if (delta === 0) {
      if (position < min || position > max) return null;
    } else {
      const a = (min - position) / delta;
      const b = (max - position) / delta;
      start = Math.max(start, Math.min(a, b));
      end = Math.min(end, Math.max(a, b));
      if (start > end) return null;
    }
  }
  return start;
}

function resolveBossArrow(target) {
  const current = boss.question;
  const correct = current.answers[target] === current.correctAnswer;
  const points = correct ? pointsForAnswer(current.word, current.answers.length) : 0;
  const previousLifeQuarters = lifeQuarters;
  index++;
  if (correct) {
    score += points;
    correctCount++;
    lifeQuarters = Math.min(maxLifeQuarters, lifeQuarters + 1);
    boss.health--;
    boss.hitFlash = 0.28;
    if (typeof spawnDungeonParticles === "function") {
      spawnDungeonParticles(790, bossShieldY(target) + 24, 16, ["#ffe478", "#5df2b5", "#fff4cc", "#ff9e5e"], 190, 6, false);
      spawnComicPopup(790, bossShieldY(target) - 6, `TREFFER +${points}!`, "#7effb2", false);
    }
    if (current.answerLanguage === "Englische") speakEnglish(current.word.english);
    playSound("correct");
  } else {
    loseLife();
    boss.invulnerable = 1.5;
    if (typeof spawnDungeonParticles === "function") {
      spawnDungeonParticles(790, bossShieldY(target) + 24, 14, ["#ff6a4d", "#ffd266", "#ffffff"], 180, 5.5, false);
      spawnComicPopup(boss.playerX + 18, boss.playerY - 66, "FALSCH!", "#ff7e6b", false);
    }
    playSound("death");
  }
  recordAnswer(current.word.id, correct, { name: playerName, index, score, correctCount, lifeQuarters, lastWordId });
  toast.textContent = correct
    ? `✦ TREFFER · +${points} PUNKTE · ${lifeQuarters > previousLifeQuarters ? "+¼ LEBEN" : "LEBEN VOLL"}`
    : "✹ FALSCHES SCHILD · −1 LEBEN";
  toast.hidden = false;
  toastTime = 3.5;
  if (lifeQuarters === 0) {
    questionBubble.hidden = true;
    updateHud();
    endGame(true);
    return;
  }
  if (boss.health === 0) {
    state = "bossVictory";
    boss.victoryTime = 0;
    boss.fireballs = [];
    questionBubble.hidden = true;
    bossStatus.textContent = `${bossTypes[worldLevel].name} ist besiegt!`;
    updateHud();
    playSound("bossDefeat");
    return;
  }
  nextBossQuestion();
}

function finishBoss() {
  if (worldLevel === levels.length - 1) {
    endlessStartSpeed = speedForScore(score);
    endlessElapsed = 0;
  }
  defeatedBosses[worldLevel] = true;
  resetBoss();
  resetControls();
  state = "running";
  segments = [];
  nextSegmentNumber = index;
  player.x = index * segmentWidth + 110;
  player.y = floorAt(player.x + player.width / 2) - player.height;
  player.vy = 0;
  player.grounded = true;
  if (worldLevel < levels.length - 1) {
    enterLevel(worldLevel + 1);
  } else {
    levelToast.textContent = `✦ ${bossTypes[worldLevel].title} BESIEGT ✦`;
    levelToast.hidden = false;
    levelToastTime = 4;
    playSound("level");
  }
  ensureSegments();
  updateHud();
  showQuestion();
}

function updateBoss(dt, movementSpeedFactor = 1) {
  if (state === "bossVictory") {
    boss.victoryTime += dt;
    if (boss.victoryTime >= 2) finishBoss();
    return;
  }
  boss.invulnerable = Math.max(0, boss.invulnerable - dt);
  boss.hitFlash = Math.max(0, (boss.hitFlash || 0) - dt);
  boss.playerX = Math.max(35, Math.min(465, boss.playerX + ((controls.right ? 1 : 0) - (controls.left ? 1 : 0)) * 240 * movementSpeedFactor * dt));
  boss.playerVy += 1500 * dt;
  boss.playerY = Math.min(390, boss.playerY + boss.playerVy * dt);
  if (boss.playerY === 390) boss.playerVy = 0;

  if (boss.arrow) {
    const arrow = boss.arrow;
    const dx = arrow.vx * dt;
    const dy = arrow.vy * dt;
    let target = -1;
    let firstIntersection = Infinity;
    boss.question.answers.forEach((answer, i) => {
      const intersection = arrowShieldIntersection(arrow.x, arrow.y, dx, dy, bossShieldY(i));
      if (intersection !== null && intersection < firstIntersection) {
        target = i;
        firstIntersection = intersection;
      }
    });
    arrow.x += dx;
    arrow.y += dy;
    if (target >= 0) {
      boss.arrow = null;
      resolveBossArrow(target);
      if (state !== "boss") return;
    } else if (arrow.x < 0 || arrow.x > LOGICAL_W || arrow.y < 0 || arrow.y > LOGICAL_H) {
      boss.arrow = null;
      toast.textContent = "✹ VERFEHLT · VERSUCHE ES NOCH EINMAL";
      toast.hidden = false;
      toastTime = 2;
    }
  }

  boss.nextFire -= dt;
  if (boss.nextFire <= 0) {
    const dx = boss.playerX + 18 - 675;
    const dy = boss.playerY - 30 - 310;
    const length = Math.hypot(dx, dy);
    boss.fireballs.push({ x: 675, y: 310, vx: dx / length * 270, vy: dy / length * 270 });
    boss.nextFire += 2.8;
    playSound("fireball");
  }
  for (const fireball of boss.fireballs) {
    fireball.x += fireball.vx * dt;
    fireball.y += fireball.vy * dt;
    if (boss.invulnerable === 0 && fireball.x + 12 >= boss.playerX && fireball.x - 12 <= boss.playerX + 35 &&
        fireball.y + 12 >= boss.playerY - 58 && fireball.y - 12 <= boss.playerY) {
      fireball.hit = true;
      boss.invulnerable = 1.5;
      loseLife();
      toast.textContent = `✹ ${bossTypes[worldLevel].projectile} · −1 LEBEN`;
      toast.hidden = false;
      toastTime = 2;
      playSound("death");
      updateHud();
      if (lifeQuarters === 0) {
        saveAppData({ ...appData, highscores: highscoreEntries(playerName, score) });
        questionBubble.hidden = true;
        endGame();
        return;
      }
    }
  }
  boss.fireballs = boss.fireballs.filter(ball => !ball.hit && ball.x > -30 && ball.y > -30 && ball.y < 520);
}

function drawBossFigure() {
  ctx.save();
  const breath = Math.sin(animationTime * 3.4) * 4;
  const hitShake = boss.hitFlash > 0 ? Math.sin(animationTime * 55) * 6 * (boss.hitFlash / 0.28) : 0;
  ctx.translate(hitShake, breath);
  ctx.lineJoin = "round";
  if (worldLevel === 0) {
    ctx.fillStyle = "#201c29";
    ctx.beginPath(); ctx.moveTo(728, 115); ctx.lineTo(688, 38); ctx.lineTo(753, 80);
    ctx.lineTo(827, 80); ctx.lineTo(892, 38); ctx.lineTo(852, 115); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#36303c";
    ctx.beginPath(); ctx.moveTo(695, 155); ctx.lineTo(656, 130); ctx.lineTo(666, 190);
    ctx.lineTo(650, 310); ctx.lineTo(688, 344); ctx.lineTo(703, 315); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(885, 155); ctx.lineTo(924, 130); ctx.lineTo(914, 190);
    ctx.lineTo(930, 310); ctx.lineTo(892, 344); ctx.lineTo(877, 315); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#51464a"; ctx.fillRect(695, 140, 190, 235);
    ctx.strokeStyle = "#b58b70"; ctx.lineWidth = 6; ctx.strokeRect(695, 140, 190, 235);
    ctx.fillStyle = "#544a50"; ctx.beginPath(); ctx.moveTo(735, 80); ctx.lineTo(790, 58);
    ctx.lineTo(845, 80); ctx.lineTo(838, 138); ctx.lineTo(790, 151); ctx.lineTo(742, 138); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#f36a43";
    ctx.beginPath(); ctx.moveTo(750, 103); ctx.lineTo(780, 112); ctx.lineTo(758, 119); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(830, 103); ctx.lineTo(800, 112); ctx.lineTo(822, 119); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#e5ccb0";
    for (let x = 766; x < 820; x += 12) {
      ctx.beginPath(); ctx.moveTo(x, 130); ctx.lineTo(x + 5, 139); ctx.lineTo(x + 10, 130); ctx.fill();
    }
  } else if (worldLevel === 1) {
    ctx.strokeStyle = "#68462f"; ctx.lineWidth = 16; ctx.lineCap = "round";
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(705, 255 + i * 32); ctx.lineTo(655 - i * 9, 280 + i * 30); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(875, 255 + i * 32); ctx.lineTo(925 + i * 9, 280 + i * 30); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(866, 190); ctx.bezierCurveTo(965, 175, 970, 66, 892, 55); ctx.stroke();
    ctx.fillStyle = "#4e3430"; ctx.beginPath(); ctx.moveTo(892, 55); ctx.lineTo(875, 30); ctx.lineTo(859, 72); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#9c6a37";
    ctx.beginPath(); ctx.ellipse(667, 205, 38, 29, -.4, 0, Math.PI * 2); ctx.ellipse(913, 205, 38, 29, .4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#4e3430";
    ctx.beginPath(); ctx.moveTo(631, 200); ctx.lineTo(651, 205); ctx.lineTo(629, 215); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(949, 200); ctx.lineTo(929, 205); ctx.lineTo(951, 215); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#bd8950"; ctx.beginPath(); ctx.ellipse(790, 245, 110, 142, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#62442f"; ctx.lineWidth = 6; ctx.stroke();
    ctx.fillStyle = "#80502e"; ctx.beginPath(); ctx.ellipse(790, 115, 64, 42, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f6d57e";
    ctx.beginPath(); ctx.moveTo(748, 99); ctx.lineTo(777, 110); ctx.lineTo(756, 115); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(832, 99); ctx.lineTo(803, 110); ctx.lineTo(824, 115); ctx.closePath(); ctx.fill();
  } else if (worldLevel === 2) {
    ctx.strokeStyle = "#523c2d"; ctx.lineWidth = 17; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(875, 335); ctx.bezierCurveTo(970, 380, 976, 250, 925, 252); ctx.stroke();
    ctx.fillStyle = "#9b6b3b"; ctx.fillRect(670, 155, 240, 216);
    ctx.fillStyle = "#53683f"; ctx.fillRect(695, 140, 190, 235);
    ctx.strokeStyle = "#a9b477"; ctx.lineWidth = 6; ctx.strokeRect(695, 140, 190, 235);
    ctx.fillStyle = "#c98c48";
    ctx.beginPath(); ctx.moveTo(730, 95); ctx.lineTo(720, 42); ctx.lineTo(760, 70);
    ctx.lineTo(820, 70); ctx.lineTo(860, 42); ctx.lineTo(850, 95); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(790, 105, 65, 50, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#332b25"; ctx.lineWidth = 7;
    for (const x of [758, 777, 796, 815]) {
      ctx.beginPath(); ctx.moveTo(x, 65); ctx.lineTo(x + 8, 84); ctx.stroke();
    }
    ctx.fillStyle = "#f4d99e"; ctx.beginPath(); ctx.ellipse(790, 127, 32, 17, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#302a27"; ctx.fillRect(782, 116, 16, 8);
    ctx.fillStyle = "#f1e7d2";
    ctx.beginPath(); ctx.moveTo(765, 130); ctx.lineTo(771, 148); ctx.lineTo(777, 130);
    ctx.moveTo(803, 130); ctx.lineTo(809, 148); ctx.lineTo(815, 130); ctx.fill();
    ctx.fillStyle = "#f5d960";
    ctx.beginPath(); ctx.moveTo(747, 95); ctx.lineTo(773, 103); ctx.lineTo(753, 108); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(833, 95); ctx.lineTo(807, 103); ctx.lineTo(827, 108); ctx.closePath(); ctx.fill();
  } else if (worldLevel === 3) {
    ctx.strokeStyle = "#647e99"; ctx.lineWidth = 17; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(706, 185); ctx.lineTo(663, 238); ctx.lineTo(680, 318); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(874, 185); ctx.lineTo(917, 238); ctx.lineTo(900, 318); ctx.stroke();
    ctx.fillStyle = "#384e6e";
    ctx.beginPath(); ctx.moveTo(710, 145); ctx.lineTo(870, 145); ctx.lineTo(900, 200);
    ctx.lineTo(875, 375); ctx.lineTo(705, 375); ctx.lineTo(680, 200); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#9ec3cf"; ctx.lineWidth = 6; ctx.stroke();
    ctx.fillStyle = "#5b7792"; ctx.beginPath(); ctx.ellipse(790, 106, 72, 58, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#a9dce1"; ctx.lineWidth = 5; ctx.stroke();
    ctx.fillStyle = "#202c50"; ctx.beginPath(); ctx.ellipse(790, 102, 55, 30, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffb875";
    ctx.beginPath(); ctx.moveTo(748, 90); ctx.lineTo(780, 103); ctx.lineTo(755, 109); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(832, 90); ctx.lineTo(800, 103); ctx.lineTo(825, 109); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#a9dce1"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(790, 48); ctx.lineTo(790, 27); ctx.stroke();
    ctx.fillStyle = "#ffe6a4"; ctx.beginPath(); ctx.arc(790, 24, 7, 0, Math.PI * 2); ctx.fill();
  } else if (worldLevel === 4) {
    ctx.strokeStyle = "#9c607e"; ctx.lineWidth = 19; ctx.lineCap = "round";
    for (let i = 0; i < 4; i++) {
      const direction = i < 2 ? -1 : 1;
      const y = 205 + i % 2 * 80;
      ctx.beginPath(); ctx.moveTo(790 + direction * 80, y);
      ctx.bezierCurveTo(790 + direction * 145, y - 45, 790 + direction * 160, y + 100, 790 + direction * 125, y + 110); ctx.stroke();
    }
    ctx.fillStyle = "#ad728f"; ctx.beginPath(); ctx.ellipse(790, 245, 110, 142, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#e3b2bb"; ctx.lineWidth = 6; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(790, 104, 65, 50, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f4d781";
    ctx.beginPath(); ctx.ellipse(765, 100, 15, 11, -.25, 0, Math.PI * 2); ctx.ellipse(815, 100, 15, 11, .25, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#27374a"; ctx.fillRect(765, 96, 5, 10); ctx.fillRect(810, 96, 5, 10);
  } else if (worldLevel === 5) {
    ctx.fillStyle = "#d4a866";
    ctx.beginPath(); ctx.moveTo(696, 153); ctx.quadraticCurveTo(680, 200, 690, 345);
    ctx.quadraticCurveTo(790, 410, 890, 345); ctx.quadraticCurveTo(900, 200, 884, 153); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#6b536d"; ctx.lineWidth = 6; ctx.stroke();
    ctx.fillStyle = "#6b738d"; ctx.beginPath(); ctx.ellipse(790, 108, 65, 52, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#80556e"; ctx.beginPath(); ctx.ellipse(790, 70, 72, 26, 0, Math.PI, 0); ctx.lineTo(862, 83); ctx.lineTo(718, 83); ctx.fill();
    ctx.fillStyle = "#f5ca7a"; ctx.beginPath(); ctx.arc(790, 75, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffe2a0";
    ctx.beginPath(); ctx.moveTo(748, 99); ctx.lineTo(779, 108); ctx.lineTo(755, 115); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(832, 99); ctx.lineTo(801, 108); ctx.lineTo(825, 115); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#f1cf90"; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(695, 220); ctx.quadraticCurveTo(640, 205, 650, 290); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(885, 220); ctx.quadraticCurveTo(940, 205, 930, 290); ctx.stroke();
  } else if (worldLevel === 6) {
    ctx.fillStyle = "#66547b";
    ctx.beginPath(); ctx.moveTo(708, 170); ctx.quadraticCurveTo(645, 155, 663, 340);
    ctx.lineTo(710, 365); ctx.lineTo(870, 365); ctx.quadraticCurveTo(933, 320, 900, 165); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#b49bbd"; ctx.beginPath(); ctx.ellipse(790, 252, 100, 125, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#eee0e5"; ctx.lineWidth = 6; ctx.stroke();
    ctx.fillStyle = "#d4bfd6"; ctx.beginPath(); ctx.ellipse(790, 105, 65, 50, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(733, 80); ctx.lineTo(723, 40); ctx.lineTo(760, 67);
    ctx.moveTo(847, 80); ctx.lineTo(857, 40); ctx.lineTo(820, 67); ctx.fill();
    ctx.fillStyle = "#e9c67a"; ctx.beginPath(); ctx.moveTo(780, 63); ctx.lineTo(790, 15); ctx.lineTo(803, 63); ctx.fill();
    ctx.fillStyle = "#f4a8cc";
    ctx.beginPath(); ctx.moveTo(746, 95); ctx.lineTo(778, 105); ctx.lineTo(754, 113);
    ctx.moveTo(834, 95); ctx.lineTo(802, 105); ctx.lineTo(826, 113); ctx.fill();
  } else if (worldLevel === 7) {
    ctx.fillStyle = "#5e6f67";
    ctx.beginPath(); ctx.moveTo(695, 165); ctx.lineTo(660, 205); ctx.lineTo(670, 345); ctx.lineTo(705, 375);
    ctx.lineTo(875, 375); ctx.lineTo(910, 345); ctx.lineTo(920, 205); ctx.lineTo(885, 165); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#a9b5a2"; ctx.lineWidth = 7; ctx.stroke();
    ctx.fillStyle = "#899889";
    ctx.beginPath(); ctx.moveTo(728, 145); ctx.lineTo(720, 90); ctx.lineTo(760, 55); ctx.lineTo(820, 55);
    ctx.lineTo(860, 90); ctx.lineTo(852, 145); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#e6ede1";
    ctx.beginPath(); ctx.moveTo(720, 90); ctx.lineTo(760, 55); ctx.lineTo(820, 55); ctx.lineTo(860, 90);
    ctx.lineTo(830, 80); ctx.lineTo(807, 96); ctx.lineTo(780, 80); ctx.lineTo(753, 95); ctx.fill();
    ctx.fillStyle = "#f0d788"; ctx.fillRect(748, 105, 26, 10); ctx.fillRect(806, 105, 26, 10);
    ctx.strokeStyle = "#44564c"; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(760, 135); ctx.lineTo(820, 135); ctx.stroke();
  } else if (worldLevel === 8) {
    ctx.fillStyle = "#444b5e";
    ctx.beginPath(); ctx.moveTo(710, 160); ctx.lineTo(620, 100); ctx.lineTo(655, 245); ctx.lineTo(700, 290);
    ctx.moveTo(870, 160); ctx.lineTo(960, 100); ctx.lineTo(925, 245); ctx.lineTo(880, 290); ctx.fill();
    ctx.fillStyle = "#6b6b78"; ctx.fillRect(695, 145, 190, 230);
    ctx.strokeStyle = "#a9a0a4"; ctx.lineWidth = 6; ctx.strokeRect(695, 145, 190, 230);
    ctx.fillStyle = "#626673";
    ctx.beginPath(); ctx.moveTo(733, 90); ctx.lineTo(720, 44); ctx.lineTo(760, 68); ctx.lineTo(820, 68);
    ctx.lineTo(860, 44); ctx.lineTo(847, 90); ctx.lineTo(840, 135); ctx.lineTo(740, 135); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#f4a66f"; ctx.fillRect(749, 96, 27, 9); ctx.fillRect(804, 96, 27, 9);
    ctx.fillStyle = "#e5d6c6";
    ctx.beginPath(); ctx.moveTo(762, 124); ctx.lineTo(769, 142); ctx.lineTo(776, 124);
    ctx.moveTo(804, 124); ctx.lineTo(811, 142); ctx.lineTo(818, 124); ctx.fill();
  } else if (worldLevel === 9) {
    ctx.fillStyle = "#706052"; ctx.fillRect(690, 145, 200, 230);
    ctx.strokeStyle = "#e0bc7e"; ctx.lineWidth = 7; ctx.strokeRect(690, 145, 200, 230);
    ctx.fillStyle = "#a88761"; ctx.beginPath(); ctx.moveTo(720, 145); ctx.lineTo(720, 72);
    ctx.lineTo(790, 24); ctx.lineTo(860, 72); ctx.lineTo(860, 145); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#f0dfb8"; ctx.beginPath(); ctx.arc(790, 94, 40, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#59483e"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(790, 66); ctx.lineTo(790, 94); ctx.lineTo(810, 105); ctx.stroke();
    ctx.fillStyle = "#9c5145"; ctx.fillRect(746, 99, 22, 7); ctx.fillRect(812, 99, 22, 7);
    ctx.strokeStyle = "#a88761"; ctx.lineWidth = 18;
    ctx.beginPath(); ctx.moveTo(690, 195); ctx.lineTo(654, 300); ctx.moveTo(890, 195); ctx.lineTo(926, 300); ctx.stroke();
  } else if (worldLevel === 10) {
    ctx.fillStyle = "#513a47";
    ctx.beginPath(); ctx.moveTo(670, 145); ctx.quadraticCurveTo(740, 120, 790, 155);
    ctx.quadraticCurveTo(840, 120, 910, 145); ctx.lineTo(910, 370);
    ctx.quadraticCurveTo(840, 350, 790, 385); ctx.quadraticCurveTo(740, 350, 670, 370); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#c39761"; ctx.lineWidth = 7; ctx.stroke();
    ctx.fillStyle = "#dec9a3";
    ctx.beginPath(); ctx.moveTo(682, 157); ctx.quadraticCurveTo(745, 140, 790, 170);
    ctx.quadraticCurveTo(835, 140, 898, 157); ctx.lineTo(898, 357);
    ctx.quadraticCurveTo(835, 342, 790, 372); ctx.quadraticCurveTo(745, 342, 682, 357); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#a67f5c"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(790, 170); ctx.lineTo(790, 372); ctx.stroke();
    ctx.fillStyle = "#73566b";
    ctx.beginPath(); ctx.moveTo(720, 105); ctx.lineTo(732, 45); ctx.lineTo(764, 70);
    ctx.lineTo(816, 70); ctx.lineTo(848, 45); ctx.lineTo(860, 105); ctx.lineTo(842, 145); ctx.lineTo(738, 145); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#efc16e";
    ctx.beginPath(); ctx.moveTo(744, 94); ctx.lineTo(776, 105); ctx.lineTo(752, 113);
    ctx.moveTo(836, 94); ctx.lineTo(804, 105); ctx.lineTo(828, 113); ctx.fill();
  } else {
    ctx.fillStyle = "#3e304f";
    ctx.beginPath(); ctx.moveTo(720, 140); ctx.lineTo(860, 140); ctx.lineTo(915, 370);
    ctx.lineTo(665, 370); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#b08cbd"; ctx.lineWidth = 6; ctx.stroke();
    ctx.fillStyle = "#756288"; ctx.beginPath(); ctx.ellipse(790, 104, 57, 48, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#30243f";
    ctx.beginPath(); ctx.moveTo(714, 79); ctx.lineTo(789, 11); ctx.lineTo(853, 79);
    ctx.lineTo(870, 91); ctx.lineTo(710, 91); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#e3c179"; ctx.fillRect(739, 79, 102, 8);
    ctx.fillStyle = "#abe7d1";
    ctx.beginPath(); ctx.moveTo(750, 103); ctx.lineTo(779, 111); ctx.lineTo(755, 117);
    ctx.moveTo(830, 103); ctx.lineTo(801, 111); ctx.lineTo(825, 117); ctx.fill();
    ctx.strokeStyle = "#a8879c"; ctx.lineWidth = 12;
    ctx.beginPath(); ctx.moveTo(704, 205); ctx.lineTo(661, 275); ctx.moveTo(876, 205); ctx.lineTo(920, 275); ctx.stroke();
    ctx.fillStyle = "#8ee4c5"; ctx.beginPath(); ctx.arc(650, 276, 17, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawBoss() {
  drawBackground(0);
  if (typeof drawWorldAmbience === "function") drawWorldAmbience();
  ctx.fillStyle = ["#40333a", "#b98150", "#3c5941", "#41465e", "#8a8771", "#a2745c", "#ad8d94", "#6b8060", "#565461", "#6f6863", "#61483e", "#4b395a"][worldLevel]; ctx.fillRect(0, 390, LOGICAL_W, 100);
  ctx.fillStyle = "#1b1423"; ctx.fillRect(0, 386, LOGICAL_W, 4);
  ctx.fillStyle = ["#b88c75", "#f7d491", "#a7be75", "#a3c6d8", "#dcd1a1", "#f4ca92", "#f0cfd2", "#cfe0ad", "#b4aeb8", "#d0beae", "#dfbe89", "#ccaad0"][worldLevel]; ctx.fillRect(0, 388, LOGICAL_W, 7);

  if (state === "bossVictory") {
    const radius = 32 + boss.victoryTime * 115;
    ctx.save();
    ctx.fillStyle = "#f3a448"; ctx.strokeStyle = "#1b1423"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(790, 245, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#ffe89e"; ctx.beginPath(); ctx.arc(790, 245, radius * .58, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 8; i++) {
      const ang = animationTime * 3 + i * Math.PI / 4;
      const sx = 790 + Math.cos(ang) * (radius * 0.85);
      const sy = 245 + Math.sin(ang) * (radius * 0.85);
      ctx.fillStyle = "#fff8d6";
      ctx.beginPath(); ctx.arc(sx, sy, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.font = '900 30px "Plus Jakarta Sans", Arial, sans-serif';
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.lineWidth = 6; ctx.strokeStyle = "#1b1423";
    ctx.strokeText("BESIEGT!", 790, 245);
    ctx.fillStyle = "#ffe885";
    ctx.fillText("BESIEGT!", 790, 245);
    ctx.restore();
  } else {
    drawBossFigure();
    boss.question.answers.forEach((answer, i) => {
      const y = bossShieldY(i);
      const hovered = boss.aim && boss.aim.x >= bossShieldX && boss.aim.x <= bossShieldX + bossShieldWidth &&
        boss.aim.y >= y && boss.aim.y <= y + bossShieldHeight;
      ctx.save();
      ctx.fillStyle = "rgba(18, 12, 24, 0.5)";
      ctx.beginPath(); ctx.roundRect(bossShieldX + 3, y + 4, bossShieldWidth, bossShieldHeight, 9); ctx.fill();
      ctx.fillStyle = hovered ? "#efd09e" : "#d4a679";
      ctx.beginPath(); ctx.roundRect(bossShieldX, y, bossShieldWidth, bossShieldHeight, 9); ctx.fill();
      ctx.fillStyle = hovered ? "#fff0ca" : "#e9c49b";
      ctx.beginPath(); ctx.roundRect(bossShieldX + 3, y + 3, bossShieldWidth - 6, 12, 5); ctx.fill();
      ctx.strokeStyle = hovered ? "#ffe28a" : "#1b1423";
      ctx.lineWidth = hovered ? 3.5 : 3;
      ctx.beginPath(); ctx.roundRect(bossShieldX, y, bossShieldWidth, bossShieldHeight, 9); ctx.stroke();
      ctx.fillStyle = "#ffe29a";
      ctx.beginPath(); ctx.arc(bossShieldX + 9, y + 9, 2.3, 0, Math.PI * 2); ctx.arc(bossShieldX + bossShieldWidth - 9, y + 9, 2.3, 0, Math.PI * 2); ctx.fill();
      ctx.font = '800 17px "Plus Jakarta Sans", Georgia, serif'; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.lineWidth = 3; ctx.strokeStyle = "rgba(255, 246, 224, 0.65)";
      ctx.strokeText(answer, 790, y + 25, 145);
      ctx.fillStyle = "#2b1c22";
      ctx.fillText(answer, 790, y + 25, 145);
      ctx.restore();
    });
    ctx.save();
    ctx.fillStyle = "#1d1726";
    ctx.beginPath(); ctx.roundRect(630, 5, 320, 32, 8); ctx.fill();
    ctx.strokeStyle = "#d9a96c"; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = "#ffe0a3"; ctx.font = '800 16px "Plus Jakarta Sans", Arial, sans-serif';
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(`${bossTypes[worldLevel].name.toLocaleUpperCase()}  ${"♥".repeat(boss.health)}${"♡".repeat(5 - boss.health)}`, 790, 21.5, 300);
    ctx.restore();
  }

  for (const ball of boss.fireballs) {
    ctx.save();
    const outer = ["#d75b2e", "#c99044", "#467d42", "#4b8ac4", "#654d83", "#aa6e92", "#c06ca2", "#718476", "#747c9e", "#a67c4e", "#565070", "#659d91"][worldLevel];
    const inner = ["#ffd077", "#f5d88d", "#c3e780", "#b5f7ff", "#c6c1ee", "#ffdda6", "#ffe4f2", "#e5e9d8", "#f8e6ab", "#f5d79a", "#cfb3d5", "#c3ffe0"][worldLevel];
    ctx.fillStyle = outer;
    ctx.strokeStyle = "#1b1423"; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(ball.x, ball.y, 13.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = inner;
    ctx.beginPath(); ctx.arc(ball.x - 2, ball.y - 2, 7.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(ball.x - 4, ball.y - 4, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  if (state === "boss") {
    ctx.save();
    ctx.strokeStyle = "#ffe8b899"; ctx.lineWidth = 1.8; ctx.setLineDash([7, 7]);
    const aim = boss.aim || { x: bossShieldX, y: boss.playerY - 38 };
    ctx.beginPath(); ctx.moveTo(boss.playerX + 30, boss.playerY - 38); ctx.lineTo(aim.x, aim.y); ctx.stroke();
    if (boss.aim) {
      ctx.setLineDash([]);
      ctx.strokeStyle = "#1b1423"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(aim.x, aim.y, 10, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = "#ffe08a"; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(aim.x, aim.y, 10, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#ffe08a"; ctx.beginPath(); ctx.arc(aim.x, aim.y, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  if (boss.arrow) {
    const { x, y, vx, vy } = boss.arrow;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.atan2(vy, vx));
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = "#ffffff66"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-42, 0); ctx.lineTo(-26, 0); ctx.stroke();
    ctx.strokeStyle = "#1b1423"; ctx.lineWidth = 5.5;
    ctx.beginPath(); ctx.moveTo(-28, 0); ctx.lineTo(2, 0); ctx.stroke();
    ctx.strokeStyle = "#f4dfb6"; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(-28, 0); ctx.lineTo(0, 0); ctx.stroke();
    ctx.fillStyle = "#e8f2f5"; ctx.strokeStyle = "#1b1423"; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(-7, -5); ctx.lineTo(-5, 0); ctx.lineTo(-7, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#d94b3d";
    ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(-32, -4); ctx.lineTo(-29, 0); ctx.lineTo(-32, 4); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  if (boss.invulnerable < 1.2 && (boss.invulnerable === 0 || Math.floor(boss.invulnerable * 8) % 2 === 0)) {
    ctx.save();
    ctx.translate(boss.playerX - player.x, boss.playerY - 58 - player.y);
    drawPlayer(boss.playerY >= 390);
    ctx.restore();
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1b1423"; ctx.lineWidth = 6.5;
    ctx.beginPath(); ctx.arc(boss.playerX + 32, boss.playerY - 35, 19, -1.18, 1.18); ctx.stroke();
    ctx.strokeStyle = "#dfa86e"; ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.arc(boss.playerX + 32, boss.playerY - 35, 19, -1.18, 1.18); ctx.stroke();
    ctx.restore();
  }
  if (boss.invulnerable > 0) {
    ctx.strokeStyle = "#efd59a"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(boss.playerX + 18, boss.playerY, 28, 8, 0, 0, Math.PI * 2); ctx.stroke();
  }
}
