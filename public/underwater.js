"use strict";

window.UnderwaterGame = (() => {
  const canvas = document.getElementById("uw-canvas");
  const ctx = canvas.getContext("2d");
  const W = 960;
  const H = 540;
  let uwScale = 2;
  function syncUwResolution() {
    const dpr = window.devicePixelRatio || 1;
    const scale = Math.min(3, Math.max(2, dpr * 1.25));
    const rw = Math.round(W * scale);
    const rh = Math.round(H * scale);
    if (canvas.width !== rw || canvas.height !== rh) {
      canvas.width = rw;
      canvas.height = rh;
    }
    uwScale = scale;
  }
  syncUwResolution();
  window.addEventListener("resize", syncUwResolution);

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

  function spawnPopup(x, y, text, color = "#ffd23e") {
    popups.push({ x, y, text, color, life: 1.0, maxLife: 1.0, tilt: rnd(-0.12, 0.12) });
  }

  function explodeAt(x, y) {
    for (let k = 0; k < 16; k++) {
      parts.push({
        x,
        y,
        vx: rnd(-145, 145),
        vy: rnd(-145, 145),
        r: rnd(3.5, 7),
        life: rnd(0.28, 0.65),
        c: pick(["#ff4b6e", "#ff9e44", "#ffe156", "#ffffff"]),
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

  const player = { x: 140, y: H / 2, r: 16, speed: 200, tilt: 0, wakeTimer: 0 };
  let enemies = [];
  let fish = [];
  let torps = [];
  let parts = [];
  let popups = [];
  let lifeTimer = LIFE_FISH_EVERY * 0.6;
  let colTop = [];
  let colBot = [];
  let scroll = 0;
  let enemyTimer = 2;
  let fishTimer = 1;

  const bubbles = [];
  for (let i = 0; i < 28; i++) {
    bubbles.push({ x: rnd(0, W), y: rnd(0, H), r: rnd(1.8, 5), spd: rnd(14, 38) });
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
    popups = [];
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
    player.tilt = 0;
    player.wakeTimer = 0;
    syncUwResolution();
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
    explodeAt(player.x, player.y);
    spawnPopup(player.x, player.y - 24, "AUTSCH!", "#ff6b81");
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
    player.tilt += (dy * 0.22 - player.tilt) * Math.min(1, dt * 10);
    player.wakeTimer -= dt;
    if (player.wakeTimer <= 0) {
      player.wakeTimer = 0.08;
      fishBubbles.push({
        x: player.x - 36,
        y: player.y + rnd(-4, 4),
        r: rnd(1.5, 3.6),
        spd: rnd(20, 42),
        ph: rnd(0, 6.28),
        life: rnd(0.8, 1.5),
      });
    }

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
            spawnPopup(e.x, e.y - 16, "+50 BOOM!", "#ffd23e");
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
              spawnPopup(f.x, f.y - 18, "+25", "#7effb2");
              sfx("coin");
            } else if (f.correct) {
              score += 100;
              air = Math.min(AIR_MAX, air + AIR_REFILL);
              if (f.lang === "en") speakWord(f.label);
              recordSharedAnswer(f.wordId, true);
              spawnPopup(f.x, f.y - 18, "+100 & LUFT!", "#7effb2");
              sfx("correct");
              newPrompt();
            } else {
              score += 10;
              air = Math.max(0, air - AIR_PENALTY);
              if (f.lang === "en") speakWord(f.label);
              recordSharedAnswer(f.wordId, false);
              explodeAt(f.x, f.y);
              spawnPopup(f.x, f.y - 18, "FALSCH!", "#ff6b81");
              sfx("wrong");
            }
            fish.splice(j, 1);
            dead = true;
            break;
          }
        }
      }
      if (dead) {
        for (let k = 0; k < 12; k++) {
          parts.push({
            x: t.x,
            y: t.y,
            vx: rnd(-100, 100),
            vy: rnd(-100, 100),
            r: rnd(3, 6),
            life: rnd(0.22, 0.52),
            c: pick(["#ffd23e", "#ff8c42", "#39e8ff", "#ffffff"]),
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
          spawnPopup(f.x, f.y - 20, "EXTRA LEBEN?", "#7effb2");
          sfx("start");
          triggerLifeQuestion();
        } else if (f.correct) {
          score += 100;
          air = Math.min(AIR_MAX, air + AIR_REFILL);
          if (f.lang === "en" && !f.spoke) speakWord(f.label);
          recordSharedAnswer(f.wordId, true);
          spawnPopup(f.x, f.y - 20, "+100 & LUFT!", "#7effb2");
          sfx("correct");
          newPrompt();
        } else {
          score += 10;
          air = Math.max(0, air - AIR_PENALTY);
          if (f.lang === "en" && !f.spoke) speakWord(f.label);
          recordSharedAnswer(f.wordId, false);
          explodeAt(f.x, f.y);
          spawnPopup(f.x, f.y - 20, "AUTSCH!", "#ff6b81");
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

    for (let i = popups.length - 1; i >= 0; i--) {
      const pop = popups[i];
      pop.y -= 38 * dt;
      pop.life -= dt;
      if (pop.life <= 0) popups.splice(i, 1);
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

  /* ---------- Draw (HiDPI Comic Vector Style) ---------- */
  const INK = "#071726";
  const FISH_PALETTES = [
    { body: "#2cd4ff", shade: "#0d8dc4", fin: "#ffd23e" },
    { body: "#ff9b42", shade: "#d95b26", fin: "#ffe375" },
    { body: "#a77bff", shade: "#6d42cc", fin: "#5df2d6" },
    { body: "#45e6b0", shade: "#149c75", fin: "#ffdf6b" },
  ];

  function drawSub(x, y) {
    const bob = Math.sin(elapsed * 2.6) * 2.5;
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.rotate(player.tilt || 0);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // Soft underwater headlight cone
    const cone = ctx.createLinearGradient(26, 0, 220, 0);
    cone.addColorStop(0, "rgba(180, 248, 255, 0.24)");
    cone.addColorStop(1, "rgba(180, 248, 255, 0)");
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(26, -6);
    ctx.lineTo(220, -58);
    ctx.lineTo(220, 58);
    ctx.lineTo(26, 6);
    ctx.closePath();
    ctx.fill();

    // Spinning brass propeller
    const propSpin = Math.sin(elapsed * 20);
    ctx.fillStyle = "#d99216";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(-36, 0, 4.5, Math.max(3, Math.abs(propSpin) * 11), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Tail fin & rudder
    ctx.fillStyle = "#e08700";
    ctx.beginPath();
    ctx.moveTo(-22, -7);
    ctx.lineTo(-34, -14);
    ctx.lineTo(-32, 14);
    ctx.lineTo(-22, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Periscope & conning tower
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-1, -20);
    ctx.lineTo(-1, -28);
    ctx.lineTo(7, -28);
    ctx.stroke();
    ctx.strokeStyle = "#f2a900";
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.fillStyle = "#7ef2ff";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(8, -28, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#f8b400";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.roundRect(-10, -22, 18, 12, [6, 6, 0, 0]);
    ctx.fill();
    ctx.stroke();

    // Main comic submarine hull
    const hullGrad = ctx.createLinearGradient(0, -16, 0, 16);
    hullGrad.addColorStop(0, "#ffe45e");
    hullGrad.addColorStop(0.55, "#f8b400");
    hullGrad.addColorStop(1, "#c77800");
    ctx.fillStyle = hullGrad;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.roundRect(-29, -15, 58, 30, 15);
    ctx.fill();
    ctx.stroke();

    // Top comic gloss streak & center riveted stripe
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    ctx.beginPath();
    ctx.roundRect(-20, -12, 38, 4.5, 3);
    ctx.fill();
    ctx.strokeStyle = "#b86b00";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-26, 2);
    ctx.lineTo(26, 2);
    ctx.stroke();

    // Side small porthole
    ctx.fillStyle = "#0e2f47";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-14, -2, 5.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#8ceeff";
    ctx.beginPath();
    ctx.arc(-15.5, -3.5, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Main front porthole with Franzo peeking inside
    ctx.fillStyle = "#0b2438";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(8, -1, 8.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Little captain Franzo face + diving goggles
    ctx.fillStyle = "#f2c19b";
    ctx.beginPath();
    ctx.arc(8, 0.5, 5.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#39e8ff";
    ctx.fillRect(5, -2.2, 6.5, 3);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(6.5, -4, 4, Math.PI * 1.1, Math.PI * 1.65);
    ctx.stroke();

    // Front headlight bulb
    ctx.fillStyle = "#fff6b8";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(28, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  function drawEnemyFish(e) {
    const tailWag = Math.sin(e.ph * 2.2) * 4;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // Dorsal & tail fins
    ctx.fillStyle = e.col;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(20, -8 + tailWag * 0.6);
    ctx.lineTo(17, tailWag * 0.3);
    ctx.lineTo(20, 8 + tailWag * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Spiky top fin
    ctx.beginPath();
    ctx.moveTo(-4, -8);
    ctx.lineTo(0, -15);
    ctx.lineTo(5, -8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Plump angry comic body
    const bodyGrad = ctx.createLinearGradient(0, -10, 0, 10);
    bodyGrad.addColorStop(0, "#ffffff44");
    bodyGrad.addColorStop(0.25, e.col);
    bodyGrad.addColorStop(1, "#38122b");
    ctx.fillStyle = e.col;
    ctx.beginPath();
    ctx.ellipse(0, 0, 13.5, 9.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.stroke();

    // Belly stripes
    ctx.strokeStyle = "rgba(10, 18, 32, 0.35)";
    ctx.lineWidth = 2;
    for (let k = -3; k <= 5; k += 4) {
      ctx.beginPath();
      ctx.moveTo(k, -6);
      ctx.lineTo(k + 1, 6);
      ctx.stroke();
    }

    // Angry comic eye + furrowed brow
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(-6, -2, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(-7, -1.8, 1.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-10, -6.5);
    ctx.lineTo(-3, -4);
    ctx.stroke();

    // Little toothy frown
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(-12, 3);
    ctx.lineTo(-9, 1);
    ctx.lineTo(-7, 4);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function drawLabelFish(f) {
    const wag = Math.sin(f.ph * 3.4) * 3.5;
    const isLife = f.kind === "life";
    let palIdx = 0;
    if (!isLife && f.label) {
      for (let i = 0; i < f.label.length; i++) palIdx += f.label.charCodeAt(i);
    }
    const pal = isLife
      ? { body: "#4df585", shade: "#1aa34a", fin: "#ffe156" }
      : FISH_PALETTES[palIdx % FISH_PALETTES.length];

    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // Tail fin
    ctx.fillStyle = pal.fin;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(18, -7 + wag * 0.7);
    ctx.quadraticCurveTo(14, wag * 0.3, 18, 7 + wag * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cute dorsal fin
    ctx.beginPath();
    ctx.moveTo(-3, -7);
    ctx.quadraticCurveTo(2, -14, 7, -6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Plump comic fish body
    const grad = ctx.createLinearGradient(0, -9, 0, 9);
    grad.addColorStop(0, pal.body);
    grad.addColorStop(1, pal.shade);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 8.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Specular highlight
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    ctx.beginPath();
    ctx.ellipse(-2, -4, 6, 2.2, -0.1, 0, Math.PI * 2);
    ctx.fill();

    // Side flapping fin
    ctx.fillStyle = pal.fin;
    ctx.beginPath();
    ctx.ellipse(1, 2, 4, 2.4, Math.sin(f.ph * 5) * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Big cheerful cartoon eye
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(-5.5, -1.5, 3.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(-6.3, -1.5, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-6.8, -2.5, 1, 1);

    ctx.restore();

    if (isLife) {
      drawHeart(f.x, f.y - 21, 1.15);
      return;
    }

    // Crisp comic label banner above vocab fish
    ctx.save();
    ctx.font = '800 13px "Plus Jakarta Sans", system-ui, sans-serif';
    const textW = ctx.measureText(f.label).width;
    const bw = Math.max(46, textW + 16);
    const bh = 22;
    const bx = f.x - bw / 2;
    const by = f.y - 35;

    ctx.fillStyle = "rgba(4, 15, 28, 0.92)";
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 7);
    ctx.fill();

    ctx.strokeStyle = f.hovered ? "#ffe156" : "#4ee2ff";
    ctx.lineWidth = f.hovered ? 2.4 : 1.8;
    ctx.stroke();

    ctx.fillStyle = f.hovered ? "#fff5b8" : "#ebfbff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(f.label, f.x, by + bh / 2 + 0.5);
    ctx.restore();
  }

  function drawHeart(cx, cy, scale = 1) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.fillStyle = "#ff456e";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.bezierCurveTo(-8, 0, -9, -7, -4, -7);
    ctx.bezierCurveTo(-1.5, -7, 0, -4.5, 0, -3.5);
    ctx.bezierCurveTo(0, -4.5, 1.5, -7, 4, -7);
    ctx.bezierCurveTo(9, -7, 8, 0, 0, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    ctx.beginPath();
    ctx.arc(-3.2, -3.8, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function draw() {
    syncUwResolution();
    ctx.setTransform(uwScale, 0, 0, uwScale, 0, 0);

    // Rich comic deep-sea gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#08446b");
    grad.addColorStop(0.5, "#04233d");
    grad.addColorStop(1, "#020e1c");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Parallax underwater cliff silhouettes in deep background
    ctx.save();
    const bgShift = (scroll * 0.22) % 320;
    ctx.fillStyle = "rgba(8, 55, 84, 0.5)";
    ctx.beginPath();
    ctx.moveTo(-320, H);
    for (let x = -320 - bgShift; x <= W + 320; x += 160) {
      ctx.quadraticCurveTo(x + 80, H * 0.55 + Math.sin(x * 0.02) * 36, x + 160, H * 0.72);
    }
    ctx.lineTo(W + 320, H);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Volumetric sun shafts
    ctx.fillStyle = "rgba(89, 232, 255, 0.065)";
    for (let k = 0; k < 4; k++) {
      const bx = ((k * 310 - scroll * 0.3) % (W + 400)) - 180;
      ctx.beginPath();
      ctx.moveTo(bx, 0);
      ctx.lineTo(bx + 70, 0);
      ctx.lineTo(bx + 185, H);
      ctx.lineTo(bx + 70, H);
      ctx.closePath();
      ctx.fill();
    }

    // Crisp ambient bubbles with highlight dot
    for (const b of bubbles) {
      ctx.strokeStyle = "rgba(155, 244, 255, 0.45)";
      ctx.fillStyle = "rgba(125, 239, 255, 0.14)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, Math.max(0.8, b.r * 0.28), 0, Math.PI * 2);
      ctx.fill();
    }

    // Smooth comic cave rock ceiling and floor matching colTop / colBot
    const i0 = Math.max(0, Math.floor(scroll / COLW) - 2);
    const i1 = Math.floor((scroll + W) / COLW) + 2;
    ensureCols(i1);

    // Top cave rock mass
    const topGrad = ctx.createLinearGradient(0, 0, 0, H * 0.42);
    topGrad.addColorStop(0, "#0c2b40");
    topGrad.addColorStop(1, "#164e70");
    ctx.fillStyle = topGrad;
    ctx.beginPath();
    ctx.moveTo((i0 - 1) * COLW - scroll, -10);
    for (let i = i0; i <= i1; i++) {
      ctx.lineTo(i * COLW - scroll + COLW * 0.5, colTop[i]);
    }
    ctx.lineTo((i1 + 1) * COLW - scroll, -10);
    ctx.closePath();
    ctx.fill();

    // Top cave comic water-rim + ink outline
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = "#2b89b8";
    ctx.lineWidth = 6;
    ctx.beginPath();
    for (let i = i0; i <= i1; i++) {
      const px0 = i * COLW - scroll + COLW * 0.5;
      if (i === i0) ctx.moveTo(px0, colTop[i]);
      else ctx.lineTo(px0, colTop[i]);
    }
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.8;
    ctx.stroke();

    // Bottom cave rock mass
    const botGrad = ctx.createLinearGradient(0, H * 0.58, 0, H);
    botGrad.addColorStop(0, "#164e70");
    botGrad.addColorStop(1, "#0b2538");
    ctx.fillStyle = botGrad;
    ctx.beginPath();
    ctx.moveTo((i0 - 1) * COLW - scroll, H + 10);
    for (let i = i0; i <= i1; i++) {
      ctx.lineTo(i * COLW - scroll + COLW * 0.5, colBot[i]);
    }
    ctx.lineTo((i1 + 1) * COLW - scroll, H + 10);
    ctx.closePath();
    ctx.fill();

    // Bottom cave comic water-rim + ink outline
    ctx.strokeStyle = "#2b89b8";
    ctx.lineWidth = 6;
    ctx.beginPath();
    for (let i = i0; i <= i1; i++) {
      const px0 = i * COLW - scroll + COLW * 0.5;
      if (i === i0) ctx.moveTo(px0, colBot[i]);
      else ctx.lineTo(px0, colBot[i]);
    }
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.8;
    ctx.stroke();

    // Swaying comic kelp & vibrant reef corals along cave walls
    for (let i = i0; i <= i1; i++) {
      const x = i * COLW - scroll + COLW * 0.5;
      const t = colTop[i];
      const b = colBot[i];
      const s1 = (i * 7919) % 97;
      const s2 = (i * 104729) % 89;
      if (s1 % 9 === 0) {
        const h = 30 + (s1 % 5) * 8;
        const sway = Math.sin(elapsed * 1.8 + i) * 7;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(x, t);
        ctx.quadraticCurveTo(x + sway * 0.5, t + h * 0.5, x + sway, t + h);
        ctx.stroke();
        ctx.strokeStyle = "#22a866";
        ctx.lineWidth = 3.2;
        ctx.stroke();
      }
      if (s2 % 8 === 0) {
        const cc = ["#ff5c8a", "#ff8e5e", "#b56eff"][s2 % 3];
        ctx.strokeStyle = INK;
        ctx.lineWidth = 6.5;
        ctx.beginPath();
        ctx.moveTo(x, b + 2);
        ctx.lineTo(x - 4, b - 15);
        ctx.moveTo(x, b - 6);
        ctx.lineTo(x + 7, b - 14);
        ctx.stroke();
        ctx.strokeStyle = cc;
        ctx.lineWidth = 3.4;
        ctx.stroke();
      }
    }

    for (const f of fish) drawLabelFish(f);

    for (const b of fishBubbles) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(180, 244, 255, 0.25)";
      ctx.fill();
      ctx.strokeStyle = "rgba(180, 244, 255, 0.85)";
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, Math.max(0.7, b.r * 0.25), 0, Math.PI * 2);
      ctx.fill();
    }

    for (const e of enemies) drawEnemyFish(e);

    // Comic torpedoes
    for (const t of torps) {
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(Math.atan2(t.vy, t.vx));
      ctx.fillStyle = "#ffe156";
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-8, -3.5, 14, 7, 3.5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ff456e";
      ctx.beginPath();
      ctx.arc(6, 0, 3.2, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    if (mode === "play") {
      const ax = aim.x;
      const ay = aim.y;
      ctx.save();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(ax, ay, 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "#39e8ff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ax - 15, ay);
      ctx.lineTo(ax - 5, ay);
      ctx.moveTo(ax + 5, ay);
      ctx.lineTo(ax + 15, ay);
      ctx.moveTo(ax, ay - 15);
      ctx.lineTo(ax, ay - 5);
      ctx.moveTo(ax, ay + 5);
      ctx.lineTo(ax, ay + 15);
      ctx.arc(ax, ay, 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#ffd23e";
      ctx.beginPath();
      ctx.arc(ax, ay, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (mode === "play" || mode === "lastchance" || mode === "life") {
      const blink = invuln > 0 && Math.floor(performance.now() / 120) % 2 === 0;
      if (!blink) drawSub(player.x, player.y);
    }

    // Ink-ringed comic explosion / splash particles
    for (const p of parts) {
      const alpha = Math.max(0, Math.min(1, p.life * 2));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.c;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (p.r || 4) * (0.5 + 0.5 * alpha), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Floating comic popups
    for (const pop of popups) {
      const alpha = Math.max(0, Math.min(1, pop.life / 0.35));
      const sc = 1 + Math.sin(Math.min(1, (pop.maxLife - pop.life) * 6) * Math.PI * 0.5) * 0.16;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(pop.x, pop.y);
      ctx.rotate(pop.tilt);
      ctx.scale(sc, sc);
      ctx.font = '900 18px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.lineWidth = 5;
      ctx.strokeStyle = INK;
      ctx.strokeText(pop.text, 0, 0);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, 0, 0);
      ctx.restore();
    }

    if (mode === "play") {
      // Crisp comic HUD badges
      ctx.save();
      ctx.font = '800 15px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillStyle = "rgba(4, 16, 30, 0.78)";
      ctx.strokeStyle = "rgba(57, 232, 255, 0.55)";
      ctx.lineWidth = 1.8;

      // Score pill
      ctx.beginPath();
      ctx.roundRect(10, 8, 136, 30, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#e6faff";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(`Punkte: ${score}`, 22, 23.5);

      // Prompt center banner
      const promptText = `Übersetzung: ${prompt.src}`;
      const pw = Math.max(210, ctx.measureText(promptText).width + 36);
      ctx.fillStyle = "rgba(4, 16, 30, 0.86)";
      ctx.strokeStyle = "#ffd23e";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(W / 2 - pw / 2, 7, pw, 32, 9);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ffe478";
      ctx.textAlign = "center";
      ctx.fillText(promptText, W / 2, 23.5);

      // Highscore pill
      ctx.fillStyle = "rgba(4, 16, 30, 0.78)";
      ctx.strokeStyle = "rgba(57, 232, 255, 0.55)";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.roundRect(W - 166, 8, 156, 30, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#e6faff";
      ctx.textAlign = "right";
      ctx.fillText(`Highscore: ${high}`, W - 20, 23.5);

      // Glossy Atemluft tank bottom right
      const gw = 114;
      const gx = W - 18 - gw;
      const gy = H - 27;
      const empty = air <= 0;
      const flash = empty && airWarn > 0 && Math.floor(performance.now() / 250) % 2 === 0;
      ctx.fillStyle = "rgba(4, 16, 30, 0.85)";
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.roundRect(gx - 3, gy - 3, gw + 6, 18, 7);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = flash ? "#ff3860" : "#123a52";
      ctx.beginPath();
      ctx.roundRect(gx, gy, gw, 12, 5);
      ctx.fill();
      const fill = Math.max(0, Math.min(1, air / AIR_MAX));
      if (fill > 0) {
        const airGrad = ctx.createLinearGradient(gx, gy, gx + gw, gy);
        airGrad.addColorStop(0, "#1cc8ff");
        airGrad.addColorStop(1, "#7efaff");
        ctx.fillStyle = airGrad;
        ctx.beginPath();
        ctx.roundRect(gx, gy, Math.max(6, Math.round(gw * fill)), 12, 5);
        ctx.fill();
      } else {
        ctx.fillStyle = flash ? "#ff8c42" : "#ff3860";
        ctx.beginPath();
        ctx.roundRect(gx, gy, gw, 12, 5);
        ctx.fill();
      }
      ctx.font = '800 11px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillStyle = empty && airWarn > 0 ? "#ff6b81" : "#e6faff";
      ctx.textAlign = "right";
      ctx.lineWidth = 3;
      ctx.strokeStyle = INK;
      const airLabel = empty ? `Atemluft! ${Math.ceil(airWarn)}s` : "Atemluft";
      ctx.strokeText(airLabel, gx + gw, gy - 9);
      ctx.fillText(airLabel, gx + gw, gy - 9);
      ctx.restore();

      for (let i = 0; i < lives; i++) drawHeart(22 + i * 22, H - 22, 1.35);
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
