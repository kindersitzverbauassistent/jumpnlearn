"use strict";

const musicToggle = document.getElementById("music-toggle");
const soundToggle = document.getElementById("sound-toggle");
const speechToggle = document.getElementById("speech-toggle");
const audioStatus = document.getElementById("audio-status");
const speechStatus = document.getElementById("speech-status");
const AudioContextClass = window.AudioContext || window.webkitAudioContext;
let audioContext;
let musicBus;
let soundBus;
let musicEnabled = false;
let soundEnabled = false;
let speechEnabled = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
let musicAutoStartPending = true;
let musicTimer;
let nextNoteTime = 0;
let musicStep = 0;
let musicMode = "normal";

const melody = [
  57, 0, 58, 61, 64, 0, 62, 61,
  58, 57, 55, 57, 0, 0, 61, 62,
  64, 0, 65, 64, 62, 61, 58, 0,
  61, 62, 58, 57, 0, 55, 57, 0
];
const bass = [45, 45, 50, 50, 43, 43, 45, 45];
const lastChanceMelody = [
  57, 0, 60, 59, 57, 0, 56, 0,
  53, 0, 56, 57, 60, 59, 57, 0
];
const lastChanceBass = [33, 33, 38, 37];

function midiFrequency(note) {
  return 440 * 2 ** ((note - 69) / 12);
}

function createTone(bus, frequency, start, duration, volume, type = "triangle", endFrequency = frequency) {
  const oscillator = audioContext.createOscillator();
  const envelope = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(envelope);
  envelope.connect(bus);
  oscillator.addEventListener("ended", () => { oscillator.disconnect(); envelope.disconnect(); });
  oscillator.start(start);
  oscillator.stop(start + duration);
}

function scheduleMusic() {
  if (nextNoteTime < audioContext.currentTime - 0.2) nextNoteTime = audioContext.currentTime + 0.03;
  while (nextNoteTime < audioContext.currentTime + 0.15) {
    const dramatic = musicMode === "lastChance";
    const notes = dramatic ? lastChanceMelody : melody;
    const bassNotes = dramatic ? lastChanceBass : bass;
    const note = notes[musicStep % notes.length];
    if (note) {
      createTone(musicBus, midiFrequency(note), nextNoteTime, 0.32, 0.15, dramatic ? "sawtooth" : "triangle");
      createTone(musicBus, midiFrequency(note + 12), nextNoteTime, 0.12, 0.025, "sine");
    }
    if (musicStep % 4 === 0) createTone(musicBus, midiFrequency(bassNotes[Math.floor(musicStep / 4) % bassNotes.length]), nextNoteTime, 0.65, 0.13, "sine");
    nextNoteTime += dramatic ? 0.2 : 0.24;
    musicStep = (musicStep + 1) % notes.length;
  }
}

function setMusicMode(mode) {
  if (musicMode === mode) return;
  musicMode = mode;
  musicStep = 0;
  if (musicEnabled && audioContext && audioContext.state === "running") {
    nextNoteTime = audioContext.currentTime + 0.03;
    scheduleMusic();
  }
}

function playSound(effect) {
  if (!soundEnabled || !audioContext || audioContext.state !== "running") return;
  const now = audioContext.currentTime;
  if (effect === "jump") {
    createTone(soundBus, 280, now, 0.16, 0.16, "triangle", 560);
  } else if (effect === "drop") {
    createTone(soundBus, 340, now, 0.13, 0.12, "triangle", 180);
  } else if (effect === "correct") {
    [523.25, 659.25, 783.99, 1046.5].forEach((note, i) =>
      createTone(soundBus, note, now + i * 0.11, i === 3 ? 0.35 : 0.16, 0.15));
  } else if (effect === "level") {
    [392, 392, 392, 523.25, 659.25, 783.99].forEach((note, i) =>
      createTone(soundBus, note, now + i * 0.14, i === 5 ? 0.6 : 0.12, 0.16, "triangle"));
  } else if (effect === "boss") {
    createTone(soundBus, 120, now, 0.6, 0.18, "sawtooth", 75);
  } else if (effect === "arrow") {
    createTone(soundBus, 500, now, 0.15, 0.1, "triangle", 220);
  } else if (effect === "fireball") {
    createTone(soundBus, 180, now, 0.25, 0.1, "sawtooth", 300);
  } else if (effect === "bossDefeat") {
    createTone(soundBus, 160, now, 0.8, 0.2, "sawtooth", 45);
  } else if (effect === "death") {
    createTone(soundBus, 260, now, 0.55, 0.14, "triangle", 85);
    createTone(soundBus, 180, now + 0.12, 0.45, 0.08, "sine", 65);
  } else if (effect === "bridge" || effect === "trapdoor") {
    createTone(soundBus, 180, now, 0.35, 0.19, "sawtooth", 55);
  } else if (effect === "dog") {
    createTone(soundBus, 220, now, 0.13, 0.16, "square", 125);
    createTone(soundBus, 250, now + 0.17, 0.13, 0.16, "square", 130);
  } else if (effect === "boulder") {
    createTone(soundBus, 110, now, 0.5, 0.18, "sawtooth", 48);
  } else if (effect === "pendulum") {
    createTone(soundBus, 540, now, 0.24, 0.13, "triangle", 130);
  } else if (effect === "flame") {
    createTone(soundBus, 120, now, 0.35, 0.12, "sawtooth", 260);
  } else if (effect === "ceiling") {
    createTone(soundBus, 145, now, 0.38, 0.18, "sawtooth", 45);
  } else if (effect === "net") {
    createTone(soundBus, 420, now, 0.22, 0.13, "triangle", 160);
  } else if (effect === "sand") {
    createTone(soundBus, 310, now, 0.48, 0.12, "sawtooth", 95);
  } else if (effect === "lightning") {
    createTone(soundBus, 900, now, 0.18, 0.14, "sawtooth", 110);
  } else if (effect === "wave") {
    createTone(soundBus, 170, now, 0.48, 0.15, "triangle", 65);
  } else if (effect === "vortex") {
    createTone(soundBus, 180, now, 0.5, 0.13, "sine", 620);
  } else if (effect === "respawn") {
    createTone(soundBus, 330, now, 0.5, 0.12, "sine", 660);
    createTone(soundBus, 494, now + 0.15, 0.5, 0.08, "triangle", 988);
  } else if (effect === "win") {
    [392, 493.88, 587.33, 783.99].forEach((note, i) => createTone(soundBus, note, now + i * 0.13, 0.28, 0.13));
  } else if (effect === "gameover") {
    [293.66, 246.94, 196].forEach((note, i) => createTone(soundBus, note, now + i * 0.18, 0.3, 0.13));
  }
}

function speakEnglish(text) {
  if (!speechEnabled) return;
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.9;
    const voice = window.speechSynthesis.getVoices().find(item => item.lang.toLowerCase().startsWith("en"));
    if (voice) utterance.voice = voice;
    utterance.onerror = event => {
      if (event.error === "interrupted" || event.error === "canceled") return;
      speechStatus.textContent = `Sprachausgabe nicht möglich: ${event.error}. Bitte eine englische Stimme im Browser oder Betriebssystem aktivieren.`;
      speechStatus.hidden = false;
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  } catch (error) {
    speechStatus.textContent = `Sprachausgabe nicht möglich: ${error instanceof Error ? error.message : String(error)}`;
    speechStatus.hidden = false;
  }
}

if (!speechEnabled) {
  speechToggle.textContent = "◖ Sprache: Nicht verfügbar";
  speechToggle.setAttribute("aria-pressed", "false");
  speechToggle.disabled = true;
  speechStatus.textContent = "Dieser Browser unterstützt keine Sprachausgabe.";
  speechStatus.hidden = false;
}
speechToggle.addEventListener("click", () => {
  speechEnabled = !speechEnabled;
  speechToggle.textContent = `◖ Sprache: ${speechEnabled ? "An" : "Aus"}`;
  speechToggle.setAttribute("aria-pressed", String(speechEnabled));
  if (!speechEnabled) window.speechSynthesis.cancel();
});

async function enableAudio() {
  if (!AudioContextClass) throw new Error("Dein Browser unterstützt keine Audioausgabe.");
  if (!audioContext) {
    audioContext = new AudioContextClass();
    musicBus = audioContext.createGain();
    soundBus = audioContext.createGain();
    musicBus.gain.value = 0;
    soundBus.gain.value = 0;
    musicBus.connect(audioContext.destination);
    soundBus.connect(audioContext.destination);
  }
  if (audioContext.state !== "running") await audioContext.resume();
  if (audioContext.state !== "running") throw new Error("Die Audioausgabe konnte nicht gestartet werden.");
}

function updateAudioButtons() {
  musicToggle.textContent = `♫ Musik: ${musicEnabled ? "An" : "Aus"}`;
  soundToggle.textContent = `♪ Sound: ${soundEnabled ? "An" : "Aus"}`;
  musicToggle.setAttribute("aria-pressed", String(musicEnabled));
  soundToggle.setAttribute("aria-pressed", String(soundEnabled));
}

async function toggleAudio(kind) {
  musicToggle.disabled = soundToggle.disabled = true;
  try {
    await enableAudio();
    audioStatus.hidden = true;
    if (kind === "music" || kind === "start") {
      musicEnabled = kind === "start" || !musicEnabled;
      musicBus.gain.setValueAtTime(musicEnabled ? 0.28 : 0, audioContext.currentTime);
      if (musicEnabled) {
        nextNoteTime = audioContext.currentTime + 0.03;
        scheduleMusic();
        musicTimer = window.setInterval(scheduleMusic, 100);
      } else {
        window.clearInterval(musicTimer);
      }
    }
    if (kind === "sound" || kind === "start") {
      soundEnabled = kind === "start" || !soundEnabled;
      soundBus.gain.setValueAtTime(soundEnabled ? 0.35 : 0, audioContext.currentTime);
      if (kind === "sound" && soundEnabled) playSound("correct");
    }
    updateAudioButtons();
  } catch (error) {
    audioStatus.textContent = `Audiofehler: ${error instanceof Error ? error.message : String(error)}`;
    audioStatus.hidden = false;
  } finally {
    musicToggle.disabled = soundToggle.disabled = false;
  }
}

function startMusicOnInteraction() {
  if (!musicAutoStartPending || musicToggle.disabled) return;
  musicAutoStartPending = false;
  toggleAudio("start");
}

musicToggle.addEventListener("click", () => {
  musicAutoStartPending = false;
  toggleAudio("music");
});
soundToggle.addEventListener("click", () => toggleAudio("sound"));
