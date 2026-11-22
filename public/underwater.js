"use strict";

window.UnderwaterGame = (() => {
  const canvas = document.getElementById("uw-canvas");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  const screens = {
    start: document.getElementById("uw-overlay-start"),
    lastchance: document.getElementById("uw-overlay-lastchance"),
    life: document.getElementById("uw-overlay-life"),
    gameover: document.getElementById("uw-overlay-gameover"),
  };
  const startBtn = document.getElementById("uw-start-btn");
  const restartBtn = document.getElementById("uw-restart-btn");
  const backBtn = document.getElementById("uw-back-button");
  const overlayHomeBtn = document.getElementById("uw-overlay-home-btn");
  const gameoverHomeBtn = document.getElementById("uw-gameover-home-btn");
  const musicBtn = document.getElementById("uw-music-toggle");
  const playerNameEl = document.getElementById("uw-player-name");
  const finalLine = screens.gameover.querySelector(".uw-final");

  const revealLines = {
    lastchance: screens.lastchance.querySelector(".uw-reveal"),
    life: screens.life.querySelector(".uw-reveal"),
    gameover: screens.gameover.querySelector(".uw-reveal"),
  };

  let lcQuestion = screens.lastchance.querySelector(".uw-q");
  let lcHint = screens.lastchance.querySelector(".uw-hint");
  let lcAnswers = screens.lastchance.querySelector(".uw-answers");

  function showScreen(name) {
    for (const k in screens) screens[k].classList.toggle("active", k === name);
  }
  function hideAllScreens() {
    for (const k in screens) screens[k].classList.remove("active");
  }

  /* ---------- Helpers ---------- */
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function circleRect(cx, cy, r, rx, ry, rw, rh) {
    const nx = Math.max(rx, Math.min(cx, rx + rw));
    const ny = Math.max(ry, Math.min(cy, ry + rh));
    return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
  }

  /* ---------- Shared Vocabulary Integration (from menu.js) ---------- */
  const LABEL_OK = /^[A-Za-zÄÖÜäöüß'’ -]+$/;
  const TYPABLE = /^[A-Za-zÄÖÜäöüß]+$/;
  let active = false;
  let playerName = "";
  let recentWordIds = [];

  function primaryTerm(text) {
    return String(text || "").split(";")[0].trim();
  }

  function mappedWords() {
    const list = typeof wordsForPlayer === "function" ? wordsForPlayer(playerName) : [];
    return list.map((w) => ({
      id: w.id,
      de: primaryTerm(w.german),
      en: primaryTerm(w.english),
      rawGerman: w.german,
      rawEnglish: w.english,
      right: w.right || 0,
      wrong: w.wrong || 0,
      category: w.category,
    }));
  }

  function getPlayableVocab() {
    const all = mappedWords();
    const clean = all.filter(
      (p) =>
        LABEL_OK.test(p.de) &&
        LABEL_OK.test(p.en) &&
        p.de.length <= 16 &&
        p.en.length <= 16 &&
        p.de.toLowerCase() !== p.en.toLowerCase()
    );
    if (clean.length >= 3) return clean;
    const distinct = all.filter((p) => p.de && p.en && p.de.toLowerCase() !== p.en.toLowerCase());
    return distinct.length >= 2 ? distinct : all;
  }

  function getTypableVocab() {
    const playable = getPlayableVocab();
    const singleWord = playable.filter((p) => TYPABLE.test(p.de) && TYPABLE.test(p.en));
    return singleWord.length > 0 ? singleWord : playable;
  }

  function pickWeightedWord(pool) {
    if (!pool.length) return null;
    const categoryFn = typeof wordCategory === "function" ? wordCategory : () => "nochNicht";
    const categories = [
      { weight: lives <= 2 ? 65 : 70, words: [] },
      { weight: lives <= 2 ? 25 : 30, words: [] },
      { weight: lives <= 2 ? 10 : 0, words: [] },
    ];
    const categoryIndex = { nochNicht: 0, soLala: 1, sicher: 2 };
    const cooldown = Math.min(5, pool.length - 1);
    const recent = new Set(cooldown > 0 ? recentWordIds.slice(-cooldown) : []);

    for (const word of pool) {
      const cat = categories[categoryIndex[categoryFn(word)] ?? 0];
      if (!recent.has(word.id)) cat.words.push(word);
    }

    let available = categories.filter((c) => c.words.length > 0 && c.weight > 0);
    if (!available.length) {
      for (const word of pool) {
        const cat = categories[categoryIndex[categoryFn(word)] ?? 0];
        cat.words.push(word);
      }
      categories[2].weight = 1;
      available = categories.filter((c) => c.words.length > 0);
    }

    let choice = Math.random() * available.reduce((sum, c) => sum + c.weight * Math.min(1, c.words.length / 3), 0);
    let selected = available[available.length - 1];
    for (const cat of available) {
      choice -= cat.weight * Math.min(1, cat.words.length / 3);
      if (choice < 0) {
        selected = cat;
        break;
      }
    }
    const chosen = selected.words[Math.floor(Math.random() * selected.words.length)];
    recentWordIds.push(chosen.id);
    if (recentWordIds.length > 5) recentWordIds.shift();
    return chosen;
  }

  let prompt = null; // { id, src, tgt, lang }

  function newPrompt() {
    const pool = getPlayableVocab();
    const p = pickWeightedWord(pool) || { id: "fallback", de: "Hund", en: "dog" };
    const lang = Math.random() < 0.5 ? "en" : "de";
    prompt = {
      id: p.id,
      src: lang === "en" ? p.de : p.en,
      tgt: lang === "en" ? p.en : p.de,
      lang,
    };
  }

  function wrongLabels(exclude) {
    const pool = getPlayableVocab();
    const excludeLower = exclude.toLowerCase();
    const seen = new Set([excludeLower]);
    const candidates = [];
    for (const p of shuffle(pool)) {
      const candidate = prompt.lang === "en" ? p.en : p.de;
      const key = candidate.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        candidates.push(candidate);
      }
      if (candidates.length === 2) break;
    }
    return candidates;
  }

  function recordSharedAnswer(wordId, correct) {
    if (!wordId || wordId === "fallback" || typeof recordAnswer !== "function" || !playerName) return;
    recordAnswer(wordId, correct, { name: playerName, lifeQuarters: 1, score: 0 });
  }

  /* ---------- Audio (Web Audio API, no external files) ---------- */
  let AC = null;
  const SFX_TABLE = {
    shoot: [[880, 0.08, "square", 0, 0.12], [660, 0.06, "square", 0.05, 0.1]],
    boom: [[160, 0.25, "sawtooth", 0, 0.25], [90, 0.3, "sawtooth", 0.05, 0.2]],
    coin: [[980, 0.06, "square", 0, 0.12], [1470, 0.08, "square", 0.06, 0.12]],
    correct: [[660, 0.09, "square", 0, 0.15], [990, 0.09, "square", 0.09, 0.15], [1320, 0.14, "square", 0.18, 0.18]],
    wrong: [[330, 0.15, "square", 0, 0.18], [220, 0.2, "square", 0.12, 0.18]],
    hurt: [[200, 0.12, "sawtooth", 0, 0.22], [140, 0.15, "sawtooth", 0.08, 0.22]],
    start: [[520, 0.09, "square", 0, 0.15], [780, 0.09, "square", 0.09, 0.15], [1040, 0.14, "square", 0.18, 0.18]],
  };

  function ensureAudioContext() {
    if (!AC) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      try {
        AC = new AudioCtx();
      } catch (e) {
        return null;
      }
    }
    if (AC.state === "suspended") {
      AC.resume().catch(() => {});
    }
    return AC;
  }

  function sfx(name) {
    if (!ensureAudioContext()) return;
    const t0 = AC.currentTime;
    for (const [f, d, type, delay, vol] of SFX_TABLE[name]) {
      const o = AC.createOscillator();
      const g = AC.createGain();
      o.type = type;
      o.frequency.value = f;
      g.gain.setValueAtTime(vol, t0 + delay);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + delay + d);
      o.connect(g);
      g.connect(AC.destination);
      o.start(t0 + delay);
      o.stop(t0 + delay + d + 0.02);
    }
  }

  /* ---------- Background music: MIDI-style sequencer ---------- */
  const SEMI = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  function hz(name) {
    const m = /^([A-G])([#b♯♭]?)(-?\d)$/.exec(name);
    if (!m) return 0;
    let deg = SEMI[m[1].toLowerCase()];
    if (m[2] === "#" || m[2] === "♯") deg += 1;
    if (m[2] === "b" || m[2] === "♭") deg -= 1;
    const midi = (parseInt(m[3], 10) + 1) * 12 + deg;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  const BGM_BEAT = 0.625;
  const BGM_LOOP = 8 * BGM_BEAT;
  const BGM_MELODY = [
    [0, 0.5, "A4", "lead"], [0.5, 0.5, "C5", "lead"], [1, 1, "F5", "lead"],
    [2, 0.5, "E5", "lead"], [2.5, 0.5, "C5", "lead"], [3, 1, "A4", "lead"],
    [4, 0.5, "C5", "lead"], [4.5, 0.5, "D5", "lead"], [5, 1, "F5", "lead"],
    [6, 0.5, "A5", "lead"], [6.5, 0.5, "F5", "lead"], [7, 1, "C5", "lead"],
  ];
  const BGM_CHORDS = [
    [0, ["F3", "A3", "C4"]], [1.5, ["F3", "A3", "C4"]], [2.5, ["F3", "A3", "C4"]], [3.5, ["F3", "A3", "C4"]],
    [4, ["C3", "E3", "G3"]], [5.5, ["C3", "E3", "G3"]], [6.5, ["C3", "E3", "G3"]], [7.5, ["C3", "E3", "G3"]],
  ];
  const BGM_BASS = [[0, "F2"], [1, "C3"], [2, "F2"], [3, "A2"], [4, "C3"], [5, "G3"], [6, "C3"], [7, "E3"]];
  const BGM_PERC = [
    [0, "boom"], [2, "boom"], [4, "boom"], [6, "boom"],
    [1.5, "bongo"], [2.5, "bongo"], [3.5, "bongo"], [5.5, "bongo"], [6.5, "bongo"], [7.5, "bongo"],
    [0.5, "shaker"], [1.5, "shaker"], [2.5, "shaker"], [3.5, "shaker"],
    [4.5, "shaker"], [5.5, "shaker"], [6.5, "shaker"], [7.5, "shaker"],
  ];
  const BGM_INSTR = {
    lead: { type: "triangle", vol: 0.13, decay: 0.9, pitch: 1.0 },
    chord: { type: "square", vol: 0.055, decay: 0.35, pitch: 1.0 },
    bass: { type: "triangle", vol: 0.17, decay: 0.8, pitch: 1.0 },
    bongo: { type: "sawtooth", vol: 0.09, decay: 0.22, pitch: 1.6 },
    boom: { type: "sawtooth", vol: 0.16, decay: 0.5, pitch: 0.16 },
    shaker: { type: "square", vol: 0.035, decay: 0.12, pitch: 3.4 },
  };

  let bgmGain = null;
  let bgmNext = 0;
  let bgmOn = false;
  let bgmMuted = false;

  function updateMusicButton() {
    if (!musicBtn) return;
    musicBtn.textContent = `♫ Musik: ${bgmMuted ? "Aus" : "An"}`;
    musicBtn.setAttribute("aria-pressed", String(!bgmMuted));
  }

  function toneAt(freq, t0, dur, type, vol, dest) {
    if (freq <= 0 || dur <= 0) return;
    if (t0 < AC.currentTime) t0 = AC.currentTime + 0.005;
    const o = AC.createOscillator();
    const g = AC.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    o.connect(g);
    g.connect(dest || AC.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  function bgmNote(inst, notes, beat, durBeats) {
    if (!bgmGain) return;
    const spec = BGM_INSTR[inst];
    const t0 = bgmNext + beat * BGM_BEAT;
    const dur = durBeats * BGM_BEAT * spec.decay;
    for (const n of notes) {
      const base = hz(n);
      if (!base) continue;
      const freq = base * spec.pitch;
      toneAt(freq, t0, dur, spec.type, spec.vol, bgmGain);
      if (inst === "lead") toneAt(freq * 1.004, t0, dur * 0.7, "triangle", spec.vol * 0.35, bgmGain);
    }
  }

  function bgmScheduleLoop() {
    for (const m of BGM_MELODY) bgmNote(m[3], [m[2]], m[0], m[1]);
    for (const c of BGM_CHORDS) for (const n of c[1]) bgmNote("chord", [n], c[0], 0.45);
    for (const b of BGM_BASS) bgmNote("bass", [b[1]], b[0], 0.8);
    for (const p of BGM_PERC) bgmNote(p[1], ["x"], p[0], 0.3);
    bgmNext += BGM_LOOP;
  }

  function startBgm() {
    if (!ensureAudioContext() || bgmGain) return;
    bgmGain = AC.createGain();
    bgmGain.gain.value = bgmMuted ? 0 : 0.55;
    bgmGain.connect(AC.destination);
    bgmOn = true;
    bgmNext = AC.currentTime + 0.15;
    bgmScheduleLoop();
  }

  function stopBgm() {
    bgmOn = false;
    if (bgmGain) {
      try {
        bgmGain.disconnect();
      } catch (e) {
        /* already gone */
      }
      bgmGain = null;
    }
  }

  function bgmToggleMute() {
    bgmMuted = !bgmMuted;
    if (bgmGain) bgmGain.gain.value = bgmMuted ? 0 : 0.55;
    updateMusicButton();
  }

  function speakWord(word) {
    if (bgmMuted || !window.speechSynthesis) return;
    try {
      if (window.speechSynthesis.speaking) return;
      const u = new SpeechSynthesisUtterance(word);
      u.lang = "en";
      u.rate = 0.95;
      u.pitch = 1.1;
      u.volume = 0.9;
      window.speechSynthesis.speak(u);
    } catch (e) {
      /* speech is best-effort */
    }
  }

  function explodeAt(x, y) {
    for (let k = 0; k < 14; k++) {
      parts.push({
        x,
        y,
        vx: rnd(-130, 130),
        vy: rnd(-130, 130),
        life: rnd(0.25, 0.6),
        c: pick(["#ff3860", "#ff8c42", "#ffd23e"]),
      });
    }
  }

  /* ---------- State ---------- */
  const COLW = 16;
  const MAX_LIVES = 5;
  const AIR_MAX = 100;
  const AIR_DRAIN = 1.6;
  const AIR_REFILL = 22;
  const AIR_PENALTY = 25;
  const AIR_WARN = 10;
  const LIFE_FISH_EVERY = 12;
  const INVULN = 2;
  const QUIZ_GRACE = 5;
  const TORP_SPEED = 210;
  const TORP_TURN = 6.5;
  const TORP_MAX_SPEED = 300;

  let mode = "idle";
  let score = 0;
  let lives = 3;
  let elapsed = 0;
  let invuln = 0;
  let cool = 0;
  let air = AIR_MAX;
  let airWarn = 0;
  let high = 0;

  const player = { x: 140, y: H / 2, r: 16, speed: 200 };
  let enemies = [];
  let fish = [];
  let torps = [];
  let parts = [];
  let lifeTimer = LIFE_FISH_EVERY * 0.6;
  let colTop = [];
  let colBot = [];
  let scroll = 0;
  let enemyTimer = 2;
  let fishTimer = 1;

  const bubbles = [];
  for (let i = 0; i < 26; i++) {
    bubbles.push({ x: rnd(0, W), y: rnd(0, H), r: rnd(1.5, 4), spd: rnd(12, 34) });
  }
  const fishBubbles = [];

  function stepFishBubbles(dt) {
    for (let i = fishBubbles.length - 1; i >= 0; i--) {
      const b = fishBubbles[i];
      b.ph += dt * 4;
      b.y -= b.spd * dt;
      b.x += Math.sin(b.ph) * 9 * dt;
      b.life -= dt;
      const ci = Math.floor((b.x + scroll) / COLW);
      const stuck = ci >= 0 && ci < colTop.length && b.y < colTop[ci];
      if (b.life <= 0 || stuck || b.y < -8 || b.x < -8 || b.x > W + 8) fishBubbles.splice(i, 1);
    }
  }

  function caveBounds(xWorld, margin) {
    const i = Math.max(0, Math.floor(xWorld / COLW));
    ensureCols(i);
    let top = colTop[i] + margin;
    let bot = colBot[i] - margin;
    if (bot <= top) {
      const mid = (colTop[i] + colBot[i]) / 2;
      top = mid;
      bot = mid;
    }
    return { top, bot };
  }

  function ensureCols(upto) {
    while (colTop.length <= upto) {
      const i = colTop.length;
      if (i === 0) {
        colTop.push(H * 0.22);
        colBot.push(H * 0.78);
      } else {
        const t = Math.max(24, Math.min(H * 0.36, colTop[i - 1] + rnd(-18, 18)));
        const b = Math.max(H * 0.6, Math.min(H - 24, colBot[i - 1] + rnd(-18, 18)));
        colTop.push(t);
        colBot.push(b);
      }
    }
  }

  /* ---------- Input ---------- */
  const keys = new Set();
  window.addEventListener("keydown", (e) => {
    if (!active) return;
    if (mode === "lastchance" || mode === "life") {
      if (e.key === "Backspace" || e.key === "Enter" || e.key === "Escape") e.preventDefault();
      typeLetter(e);
      return;
    }
    if (mode === "play") {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
        e.preventDefault();
      }
      if (e.code === "KeyM" && !e.repeat) bgmToggleMute();
      keys.add(e.code);
    }
  });
  window.addEventListener("keyup", (e) => {
    keys.delete(e.code);
  });
  window.addEventListener("blur", () => keys.clear());

  function canvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (W / rect.width),
      y: (e.clientY - rect.top) * (H / rect.height),
    };
  }

  const aim = { x: W * 0.7, y: H / 2 };
  const mouse = { x: -999, y: -999 };
  canvas.addEventListener("mousemove", (e) => {
    if (!active) return;
    const p = canvasCoords(e);
    aim.x = p.x;
    aim.y = p.y;
    mouse.x = p.x;
    mouse.y = p.y;
  });
  canvas.addEventListener("click", (e) => {
    if (!active || mode !== "play") return;
    const p = canvasCoords(e);
    aim.x = p.x;
    aim.y = p.y;
    if (cool <= 0) {
      cool = 0.3;
      const dx = p.x - player.x;
      const dy = p.y - player.y;
      const len = Math.hypot(dx, dy) || 1;
      torps.push({
        x: player.x,
        y: player.y,
        vx: (dx / len) * TORP_SPEED,
        vy: (dy / len) * TORP_SPEED,
        speed: TORP_SPEED,
        life: 2.4,
      });
      sfx("shoot");
    }
  });

  /* ---------- State transitions ---------- */
  function startGame() {
    score = 0;
    lives = 3;
    elapsed = 0;
    invuln = 1;
    cool = 0;
    air = AIR_MAX;
    airWarn = 0;
    lifeTimer = LIFE_FISH_EVERY * 0.6;
    enemies = [];
    fish = [];
    torps = [];
    parts = [];
    fishBubbles.length = 0;
    recentWordIds = [];
    lcWordId = null;
    lcSrc = "";
    lcTarget = "";
    lcDone = false;
    revealTimer = 0;
    colTop = [];
    colBot = [];
    scroll = 0;
    enemyTimer = 2;
    fishTimer = 1;
    player.x = 140;
    player.y = H / 2;
    high = typeof topUnderwaterHighscore === "function" ? topUnderwaterHighscore() : 0;
    newPrompt();
    hideAllScreens();
    mode = "play";
    canvas.focus({ preventScroll: true });
    startBgm();
    sfx("start");
  }

  let lcWordId = null;
  let lcTarget = "";
  let lcTyped = "";
  let lcKind = "lastchance";
  let lcSrc = "";
  let lcDone = false;
  let revealTimer = 0;

  function lcRenderTyped() {
    lcAnswers.textContent = lcTyped.length ? lcTyped : "_";
  }

  function lcCheck() {
    if (lcDone) return;
    const typed = lcTyped.trim().toLowerCase();
    const target = lcTarget.toLowerCase();
    if (!typed) return;
    answerTyping(typed === target);
  }

  function typeLetter(e) {
    if (lcDone || e.repeat) return;
    if (e.key === "Escape") {
      if (lcKind === "life") skipLifeQuestion();
      return;
    }
    if (e.key === "Backspace") {
      lcTyped = lcTyped.slice(0, -1);
      lcRenderTyped();
      return;
    }
    if (e.key === "Enter") {
      lcCheck();
      return;
    }
    if (!/^[a-zäöüß -]$/i.test(e.key)) return;
    lcTyped += e.key;
    lcRenderTyped();
  }

  function openTypingScreen(kind) {
    lcKind = kind;
    mode = kind;
    const scr = screens[kind];
    lcQuestion = scr.querySelector(".uw-q");
    lcHint = scr.querySelector(".uw-hint");
    lcAnswers = scr.querySelector(".uw-answers");
    const p = pickWeightedWord(getTypableVocab()) || { id: "fallback", de: "Hund", en: "dog" };
    const lang = Math.random() < 0.5 ? "en" : "de";
    const src = lang === "en" ? p.de : p.en;
    lcWordId = p.id;
    lcSrc = src;
    lcTarget = lang === "en" ? p.en : p.de;
    lcTyped = "";
    lcDone = false;
    if (revealLines[kind]) revealLines[kind].textContent = "";
    lcQuestion.textContent = `Tippe die Übersetzung von "${src}" mit der Tastatur`;
    if (lcHint) {
      lcHint.textContent =
        kind === "life"
          ? "Nur Buchstaben - Backspace zum Korrigieren - Enter zum Absenden - Esc zum Überspringen"
          : "Nur Buchstaben - Backspace zum Korrigieren - Enter zum Absenden";
    }
    lcAnswers.innerHTML = "";
    lcRenderTyped();
    showScreen(kind);
    sfx("start");
  }

  function triggerLastChance() {
    openTypingScreen("lastchance");
  }
  function triggerLifeQuestion() {
    openTypingScreen("life");
  }

  function skipLifeQuestion() {
    lcDone = false;
    hideAllScreens();
    sfx("coin");
    invuln = QUIZ_GRACE;
    mode = "play";
  }

  function showReveal(kind) {
    const line = revealLines[kind];
    if (line) line.textContent = `Richtige Antwort: "${lcSrc}" -> "${lcTarget}"`;
    showScreen(kind);
    revealTimer = 2.6;
  }

  function tickReveal(dt) {
    revealTimer -= dt;
    if (revealTimer > 0) return;
    lcDone = false;
    hideAllScreens();
    mode = "play";
    invuln = QUIZ_GRACE;
  }

  function answerTyping(correct) {
    hideAllScreens();
    recordSharedAnswer(lcWordId, correct);
    if (lcKind === "life") {
      if (correct) {
        sfx("correct");
        lives = Math.min(MAX_LIVES, lives + 1);
        air = Math.min(AIR_MAX, air + AIR_REFILL);
      } else {
        sfx("wrong");
        air = Math.max(0, air - AIR_PENALTY);
        armAir();
        lcDone = true;
        showReveal("life");
        return;
      }
      mode = "play";
      invuln = QUIZ_GRACE;
      return;
    }
    if (correct) {
      sfx("correct");
      lives = 3;
      invuln = QUIZ_GRACE;
      enemies = [];
      air = AIR_MAX;
      airWarn = 0;
      mode = "play";
    } else {
      sfx("wrong");
      gameOver();
    }
  }

  function gameOver() {
    mode = "gameover";
    stopBgm();
    if (typeof saveUnderwaterHighscore === "function") {
      saveUnderwaterHighscore(playerName, score);
    }
    if (typeof topUnderwaterHighscore === "function") {
      high = Math.max(high, topUnderwaterHighscore());
    } else if (score > high) {
      high = score;
    }
    finalLine.textContent = `${playerName}: Punktestand ${score}`;
    const rv = revealLines.gameover;
    if (rv) rv.textContent = lcTarget ? `Richtige Antwort: "${lcSrc}" -> "${lcTarget}"` : "";
    showScreen("gameover");
  }

  function open(name) {
    playerName = name;
    active = true;
    mode = "start";
    keys.clear();
    colTop = [];
    colBot = [];
    scroll = 0;
    enemies = [];
    fish = [];
    torps = [];
    parts = [];
    fishBubbles.length = 0;
    high = typeof topUnderwaterHighscore === "function" ? topUnderwaterHighscore() : 0;
    playerNameEl.textContent = playerName;
    updateMusicButton();
    showScreen("start");
    ensureCols(Math.ceil(W / COLW) + 2);
    draw();
    startBtn.focus({ preventScroll: true });
  }

  function close() {
    active = false;
    mode = "idle";
    keys.clear();
    stopBgm();
    if (window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {
        /* ignore */
      }
    }
    if (typeof showMenu === "function") showMenu();
  }

  startBtn.addEventListener("click", startGame);
  restartBtn.addEventListener("click", startGame);
  backBtn.addEventListener("click", close);
  overlayHomeBtn.addEventListener("click", close);
  gameoverHomeBtn.addEventListener("click", close);
  musicBtn.addEventListener("click", () => {
    bgmToggleMute();
    if (mode === "play") canvas.focus({ preventScroll: true });
  });

  /* ---------- Update ---------- */
  function damage() {
    if (invuln > 0) return;
    lives--;
    invuln = INVULN;
    sfx("hurt");
    if (lives <= 0) triggerLastChance();
  }

  function armAir() {
    if (air <= 0 && airWarn <= 0) airWarn = AIR_WARN;
  }

  function airOut() {
    air = AIR_MAX;
    airWarn = 0;
    if (invuln > 0) return;
    lives--;
    invuln = INVULN;
    sfx("hurt");
    if (lives <= 0) triggerLastChance();
  }

  function update(dt) {
    elapsed += dt;
    cool -= dt;
    invuln -= dt;

    if (air > 0) {
      air = Math.max(0, air - AIR_DRAIN * dt);
      armAir();
    } else if (airWarn > 0) {
      airWarn -= dt;
      if (airWarn <= 0) airOut();
    } else {
      armAir();
    }

    const scrollSpeed = 90 + Math.min(120, elapsed * 3);
    scroll += scrollSpeed * dt;

    let dx = 0;
    let dy = 0;
    if (keys.has("ArrowLeft") || keys.has("KeyA")) dx -= 1;
    if (keys.has("ArrowRight") || keys.has("KeyD")) dx += 1;
    if (keys.has("ArrowUp") || keys.has("KeyW")) dy -= 1;
    if (keys.has("ArrowDown") || keys.has("KeyS")) dy += 1;
    if (dx && dy) {
      dx *= 0.7071;
      dy *= 0.7071;
    }
    player.x = Math.max(40, Math.min(W - 40, player.x + dx * player.speed * dt));
    player.y = Math.max(40, Math.min(H - 40, player.y + dy * player.speed * dt));

    const i0 = Math.max(0, Math.floor((player.x - player.r + scroll) / COLW));
    const i1 = Math.floor((player.x + player.r + scroll) / COLW);
    ensureCols(i1 + 2);
    for (let i = i0; i <= i1; i++) {
      const x0 = i * COLW - scroll;
      if (circleRect(player.x, player.y, player.r, x0, -60, COLW, colTop[i] + 60)) {
        damage();
        player.y = colTop[i] + player.r + 2;
        break;
      }
      if (circleRect(player.x, player.y, player.r, x0, colBot[i], COLW, H - colBot[i] + 60)) {
        damage();
        player.y = colBot[i] - player.r - 2;
        break;
      }
    }

    enemyTimer -= dt;
    if (enemyTimer <= 0) {
      enemyTimer = Math.max(0.9, 2.4 - elapsed * 0.02);
      const y = rnd(H * 0.28, H * 0.72);
      enemies.push({
        x: W + 30,
        y,
        baseY: y,
        vx: rnd(60, 110) + elapsed * 2,
        amp: rnd(10, 30),
        ph: rnd(0, 6.28),
        col: pick(["#ff3860", "#b04ae0", "#ff8c42"]),
      });
    }

    fishTimer -= dt;
    if (fishTimer <= 0) {
      fishTimer = 5;
      const labels = shuffle([prompt.tgt, ...wrongLabels(prompt.tgt)]);
      labels.forEach((label, i) => {
        const x = W + 40 + i * 150;
        const b = caveBounds(x + scroll, 26);
        fish.push({
          x,
          y: rnd(b.top, b.bot),
          label,
          wordId: prompt.id,
          correct: label === prompt.tgt,
          vx: rnd(35, 55),
          ph: rnd(0, 6.28),
          lang: prompt.lang,
          spoke: false,
          hovered: false,
          bt: rnd(0.1, 0.7),
        });
      });
    }

    lifeTimer -= dt;
    if (lifeTimer <= 0) {
      lifeTimer = LIFE_FISH_EVERY;
      const x = W + 90;
      const b = caveBounds(x + scroll, 26);
      fish.push({
        x,
        y: rnd(b.top, b.bot),
        label: "",
        kind: "life",
        correct: false,
        vx: rnd(30, 45),
        ph: rnd(0, 6.28),
        lang: "",
        spoke: true,
        hovered: false,
        bt: rnd(0.1, 0.7),
      });
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      e.x -= (e.vx + scrollSpeed * 0.2) * dt;
      e.ph += dt * 3;
      e.y = e.baseY + Math.sin(e.ph) * e.amp;
      if (e.x < -40) {
        enemies.splice(i, 1);
        continue;
      }
      if (invuln <= 0 && circleRect(player.x, player.y, player.r, e.x - 11, e.y - 7, 22, 14)) {
        enemies.splice(i, 1);
        damage();
      }
    }

    for (let i = torps.length - 1; i >= 0; i--) {
      const t = torps[i];
      const toAim = Math.hypot(aim.x - t.x, aim.y - t.y);
      if (toAim > 4) {
        const want = Math.atan2(aim.y - t.y, aim.x - t.x);
        const have = Math.atan2(t.vy, t.vx);
        let diff = want - have;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const maxTurn = TORP_TURN * dt;
        const turn = Math.max(-maxTurn, Math.min(maxTurn, diff));
        const ang = have + turn;
        t.speed = Math.min(TORP_MAX_SPEED, t.speed + 40 * dt);
        t.vx = Math.cos(ang) * t.speed;
        t.vy = Math.sin(ang) * t.speed;
      }
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.life -= dt;
      if (Math.floor(t.life * 12) % 2 === 0) {
        parts.push({ x: t.x, y: t.y, vx: rnd(-8, 8), vy: rnd(-8, 8), life: rnd(0.12, 0.25), c: "#7defff" });
      }
      let dead = t.life <= 0 || t.x < -20 || t.x > W + 20 || t.y < -20 || t.y > H + 20;
      if (!dead) {
        const ci = Math.floor((t.x + scroll) / COLW);
        if (ci >= 0 && ci < colTop.length && (t.y < colTop[ci] || t.y > colBot[ci])) dead = true;
      }
      if (!dead) {
        for (let j = enemies.length - 1; j >= 0; j--) {
          const e = enemies[j];
          if (circleRect(t.x, t.y, 5, e.x - 11, e.y - 7, 22, 14)) {
            enemies.splice(j, 1);
            score += 50;
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (let j = fish.length - 1; j >= 0; j--) {
          const f = fish[j];
          if (circleRect(t.x, t.y, 5, f.x - 10, f.y - 7, 20, 14)) {
            if (f.kind === "life") {
              score += 25;
              sfx("coin");
            } else if (f.correct) {
              score += 100;
              air = Math.min(AIR_MAX, air + AIR_REFILL);
              if (f.lang === "en") speakWord(f.label);
              recordSharedAnswer(f.wordId, true);
              sfx("correct");
              newPrompt();
            } else {
              score += 10;
              air = Math.max(0, air - AIR_PENALTY);
              if (f.lang === "en") speakWord(f.label);
              recordSharedAnswer(f.wordId, false);
              explodeAt(f.x, f.y);
              sfx("wrong");
            }
            fish.splice(j, 1);
            dead = true;
            break;
          }
        }
      }
      if (dead) {
        for (let k = 0; k < 10; k++) {
          parts.push({
            x: t.x,
            y: t.y,
            vx: rnd(-90, 90),
            vy: rnd(-90, 90),
            life: rnd(0.2, 0.5),
            c: pick(["#ffd23e", "#ff8c42", "#39e8ff"]),
          });
        }
        if (!(t.life <= 0.001 || t.x < -20 || t.x > W + 20 || t.y < -20 || t.y > H + 20)) {
          sfx("boom");
        }
        torps.splice(i, 1);
      }
    }

    for (let i = fish.length - 1; i >= 0; i--) {
      const f = fish[i];
      f.x -= (f.vx + scrollSpeed * 0.2) * dt;
      f.ph += dt * 2;
      f.y += Math.sin(f.ph) * 0.3;
      const fb = caveBounds(f.x + scroll, 20);
      f.y = Math.max(fb.top, Math.min(fb.bot, f.y));
      if (f.lang === "en" && f.label) {
        const over = Math.hypot(mouse.x - f.x, mouse.y - f.y) < 22;
        if (over && !f.hovered) {
          f.hovered = true;
          speakWord(f.label);
        } else if (!over) {
          f.hovered = false;
        }
      }
      f.bt -= dt;
      if (f.bt <= 0) {
        f.bt = rnd(0.35, 0.8);
        fishBubbles.push({
          x: f.x - 9,
          y: f.y - 2,
          r: rnd(1.2, 2.6),
          spd: rnd(26, 48),
          ph: rnd(0, 6.28),
          life: rnd(1.4, 2.6),
        });
      }
      if (f.x < -60) {
        fish.splice(i, 1);
        continue;
      }
      if (Math.hypot(player.x - f.x, player.y - f.y) < player.r + 12) {
        if (f.kind === "life") {
          score += 50;
          sfx("start");
          triggerLifeQuestion();
        } else if (f.correct) {
          score += 100;
          air = Math.min(AIR_MAX, air + AIR_REFILL);
          if (f.lang === "en" && !f.spoke) speakWord(f.label);
          recordSharedAnswer(f.wordId, true);
          sfx("correct");
          newPrompt();
        } else {
          score += 10;
          air = Math.max(0, air - AIR_PENALTY);
          if (f.lang === "en" && !f.spoke) speakWord(f.label);
          recordSharedAnswer(f.wordId, false);
          explodeAt(f.x, f.y);
          sfx("wrong");
          armAir();
        }
        fish.splice(i, 1);
      }
    }

    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) parts.splice(i, 1);
    }

    for (const b of bubbles) {
      b.y -= b.spd * dt;
      if (b.y < -10) {
        b.y = H + 10;
        b.x = rnd(0, W);
      }
    }
    stepFishBubbles(dt);
  }

  /* ---------- Draw ---------- */
  function px(x, y, w, h, c) {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  }

  function drawSub(x, y) {
    const bob = Math.round(Math.sin(elapsed * 2.2) * 1.5);
    y += bob;
    px(x - 28, y - 14, 56, 28, "#1b2a3a");
    px(x - 26, y - 12, 52, 24, "#f8b400");
    px(x - 26, y - 12, 52, 5, "#ffd23e");
    px(x - 26, y + 7, 52, 5, "#c98a00");
    for (let k = 0; k < 5; k++) px(x - 22 + k * 10, y - 7, 2, 12, "#c98a00");
    px(x - 6, y - 20, 12, 8, "#f8b400");
    px(x - 6, y - 20, 12, 2, "#ffd23e");
    px(x - 2, y - 26, 4, 6, "#c98a00");
    px(x - 2, y - 26, 6, 2, "#c98a00");
    px(x + 2, y - 6, 10, 12, "#7defff");
    px(x + 4, y - 4, 6, 8, "#0a2438");
    px(x + 3, y - 5, 2, 2, "#d9f6ff");
    px(x - 16, y - 6, 8, 10, "#7defff");
    px(x - 14, y - 4, 4, 6, "#0a2438");
    px(x - 30, y - 4, 4, 8, "#c98a00");
    px(x - 34, y - 2 + Math.round(Math.sin(elapsed * 14) * 3), 4, 4, "#8a6a00");
    px(x - 30, y + 10, 10, 3, "#1b2a3a");
  }

  function drawEnemyFish(e) {
    const c = e.col;
    const tail = Math.round(Math.sin(e.ph) * 2);
    px(e.x - 10, e.y - 6, 20, 12, c);
    px(e.x - 10, e.y - 6, 20, 3, "#ffffff");
    px(e.x - 10, e.y + 3, 20, 3, "#00000022");
    for (let k = 0; k < 3; k++) px(e.x - 4 + k * 5, e.y - 3, 2, 8, "#00000033");
    px(e.x + 8, e.y - 5 + tail, 6, 10, c);
    px(e.x + 10, e.y - 3 + tail, 4, 6, "#ffffff");
    px(e.x - 2, e.y - 8, 6, 3, c);
    px(e.x - 8, e.y - 4, 3, 3, "#ffffff");
    px(e.x - 7, e.y - 3, 2, 2, "#02121f");
    px(e.x - 11, e.y + 1, 3, 2, "#ffffff");
  }

  function drawLabelFish(f) {
    if (f.kind === "life") {
      px(f.x - 8, f.y - 5, 16, 10, "#3ee86a");
      px(f.x + 8, f.y - 4, 5, 8, "#3ee86a");
      px(f.x - 6, f.y - 3, 3, 3, "#02121f");
      drawHeart(f.x - 3, f.y - 14);
      ctx.textAlign = "left";
      return;
    }
    px(f.x - 8, f.y - 5, 16, 10, "#3ec9ff");
    px(f.x + 8, f.y - 4, 5, 8, "#3ec9ff");
    px(f.x - 6, f.y - 3, 3, 3, "#02121f");
    ctx.font = '13px "Courier New", monospace';
    ctx.textAlign = "center";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#02121f";
    ctx.fillStyle = "#d9f6ff";
    ctx.strokeText(f.label, f.x, f.y - 16);
    ctx.fillText(f.label, f.x, f.y - 16);
    ctx.textAlign = "left";
  }

  function drawHeart(x, y) {
    px(x + 1, y, 2, 1, "#ff3860");
    px(x + 4, y, 2, 1, "#ff3860");
    px(x, y + 1, 7, 2, "#ff3860");
    px(x + 1, y + 3, 5, 1, "#ff3860");
    px(x + 2, y + 4, 3, 1, "#ff3860");
    px(x + 3, y + 5, 1, 1, "#ff3860");
  }

  function draw() {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#04263e");
    grad.addColorStop(1, "#020a14");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(57,232,255,0.05)";
    for (let k = 0; k < 3; k++) {
      const bx = ((k * 340 - scroll * 0.3) % (W + 400)) - 200;
      ctx.beginPath();
      ctx.moveTo(bx, 0);
      ctx.lineTo(bx + 60, 0);
      ctx.lineTo(bx + 160, H);
      ctx.lineTo(bx + 60, H);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(125,239,255,0.25)";
    for (const b of bubbles) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, 6.283);
      ctx.fill();
    }

    const i0 = Math.max(0, Math.floor(scroll / COLW) - 1);
    const i1 = Math.floor((scroll + W) / COLW) + 1;
    ensureCols(i1);
    for (let i = i0; i <= i1; i++) {
      const x = Math.round(i * COLW - scroll);
      const t = colTop[i];
      const b = colBot[i];
      const s1 = (i * 7919) % 97;
      const s2 = (i * 104729) % 89;
      px(x - 1, 0, COLW + 2, t, "#0e2f45");
      px(x - 1, 0, COLW + 2, Math.round(t * 0.55), "#123a52");
      px(x - 1, t - 8, COLW + 2, 3, "#26688f");
      px(x - 1, t - 5, COLW + 2, 5, "#1d5578");
      px(x - 1, b, COLW + 2, H - b + 1, "#0e2f45");
      px(x - 1, b + Math.round((H - b) * 0.55), COLW + 2, H - b, "#123a52");
      px(x - 1, b, COLW + 2, 5, "#1d5578");
      px(x - 1, b + 5, COLW + 2, 3, "#26688f");
      px(x + (s1 % COLW), Math.max(2, t - 12 - (s1 % 10)), 3, 3, "#1d5578");
      px(x + (s2 % COLW), Math.min(H - 4, b + 9 + (s2 % 10)), 3, 3, "#1d5578");
      px(x + ((s1 + s2) % COLW), Math.max(4, t - 22 - (s2 % 12)), 2, 2, "#26688f");
      px(x + ((s1 * 3 + s2) % COLW), Math.min(H - 6, b + 18 + (s1 % 14)), 2, 2, "#26688f");
      if (s1 % 5 === 0) {
        px(x + 3, t, 7, 4 + (s1 % 6), "#123a52");
        px(x + 4, t + 4, 5, 3 + (s1 % 5), "#0e2f45");
      }
      if (s2 % 5 === 0) {
        px(x + 4, b - 5 - (s2 % 6), 7, 5 + (s2 % 6), "#123a52");
      }
      if (s1 % 9 === 0) {
        const h = 26 + (s1 % 5) * 8;
        for (let k = 0; k < h; k += 6) {
          const sway = Math.round(Math.sin(elapsed * 1.4 + k * 0.2 + i) * 2);
          px(x + 6 + sway, t + 2 + k, 3, 6, k % 12 === 0 ? "#1f7a4a" : "#16603c");
        }
      }
      if (s2 % 8 === 0) {
        const cc = ["#c94f6d", "#e07a5f", "#8e4a9e"][s2 % 3];
        px(x + 5, b - 10, 3, 10, cc);
        px(x + 2, b - 8, 3, 3, cc);
        px(x + 8, b - 7, 3, 7, cc);
        px(x + 10, b - 5, 3, 5, cc);
      }
    }

    for (const f of fish) drawLabelFish(f);

    for (const b of fishBubbles) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, 6.283);
      ctx.strokeStyle = "rgba(180,240,255,0.75)";
      ctx.lineWidth = 1;
      ctx.stroke();
      px(b.x - b.r * 0.4, b.y - b.r * 0.4, 1, 1, "#e8faff");
    }

    for (const e of enemies) drawEnemyFish(e);

    for (const t of torps) {
      ctx.save();
      ctx.translate(Math.round(t.x), Math.round(t.y));
      ctx.rotate(Math.atan2(t.vy, t.vx));
      px(-6, -2, 10, 4, "#ffd23e");
      px(4, -1, 3, 2, "#ff8c42");
      px(-7, -1, 2, 2, "#c98a00");
      ctx.restore();
    }

    if (mode === "play") {
      const ax = Math.round(aim.x);
      const ay = Math.round(aim.y);
      ctx.strokeStyle = "rgba(57,232,255,0.85)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ax - 11, ay);
      ctx.lineTo(ax - 4, ay);
      ctx.moveTo(ax + 4, ay);
      ctx.lineTo(ax + 11, ay);
      ctx.moveTo(ax, ay - 11);
      ctx.lineTo(ax, ay - 4);
      ctx.moveTo(ax, ay + 4);
      ctx.lineTo(ax, ay + 11);
      ctx.arc(ax, ay, 9, 0, 6.283);
      ctx.stroke();
      px(ax - 1, ay - 1, 2, 2, "#ffd23e");
    }

    if (mode === "play" || mode === "lastchance" || mode === "life") {
      const blink = invuln > 0 && Math.floor(performance.now() / 120) % 2 === 0;
      if (!blink) drawSub(player.x, player.y);
    }

    for (const p of parts) {
      ctx.globalAlpha = Math.max(0, p.life * 2);
      px(p.x, p.y, 3, 3, p.c);
      ctx.globalAlpha = 1;
    }

    if (mode === "play") {
      ctx.font = '16px "Courier New", monospace';
      ctx.fillStyle = "#d9f6ff";
      ctx.fillText(`Punkte: ${score}`, 12, 24);
      ctx.textAlign = "right";
      ctx.fillText(`Highscore: ${high}`, W - 12, 24);
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffd23e";
      ctx.fillText(`Übersetzung: ${prompt.src}`, W / 2, 24);
      ctx.textAlign = "left";
      const gw = 90;
      const gx = W - 12 - gw;
      const gy = H - 22;
      const empty = air <= 0;
      const flash = empty && airWarn > 0 && Math.floor(performance.now() / 250) % 2 === 0;
      px(gx - 2, gy - 2, gw + 4, 14, "#0a2438");
      px(gx, gy, gw, 10, flash ? "#ff3860" : "#123a52");
      const fill = Math.max(0, Math.min(1, air / AIR_MAX));
      px(gx, gy, Math.round(gw * fill), 10, "#39e8ff");
      if (empty) px(gx, gy, gw, 10, flash ? "#ff8c42" : "#ff3860");
      px(gx + gw + 4, gy + 2, 4, 6, "#c98a00");
      ctx.font = '10px "Courier New", monospace';
      ctx.fillStyle = empty && airWarn > 0 ? "#ff3860" : "#d9f6ff";
      ctx.fillText(empty ? `Atemluft! ${Math.ceil(airWarn)}s` : "Atemluft", gx, gy - 8);
      ctx.font = '16px "Courier New", monospace';
      for (let i = 0; i < lives; i++) drawHeart(12 + i * 12, H - 20);
    }
  }

  /* ---------- Loop ---------- */
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (active) {
      if (mode === "play") {
        update(dt);
      } else {
        for (const b of bubbles) {
          b.y -= b.spd * dt;
          if (b.y < -10) {
            b.y = H + 10;
            b.x = rnd(0, W);
          }
        }
      }
      if (bgmOn && AC) {
        if (!bgmGain) startBgm();
        let guard = 0;
        while (bgmNext < AC.currentTime + 1.0 && guard++ < 8) bgmScheduleLoop();
      }
      if (mode === "life" && lcDone) tickReveal(dt);
      draw();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return { open, close };
})();
