"use strict";

const storageKey = "wortwelten-dungeon-v1";
const defaultWords = [
  ["willkommen (bei / in)","welcome (to)"],
  ["Hallo.","Hello."],
  ["ich bin","I\u0027m (= I am)"],
  ["Wie heißt du?","What\u0027s your name?"],
  ["Hi, Hallo","Hi"],
  ["Mein Name ist ... / Ich heiße ...","My name is ..."],
  ["Wie geht es dir?","How are you?"],
  ["Mir geht es gut.","I\u0027m fine."],
  ["okay","OK / okay"],
  ["Danke.","Thank you. / Thanks."],
  ["Und du?","And you?"],
  ["Es ist Zeit zu gehen.","It\u0027s time to go."],
  ["Auf Wiedersehen., Tschüss!","Bye., Goodbye."],
  ["ja","yes"],
  ["die (auch Pl.); der; das","the"],
  ["Fledermaus","bat"],
  ["Schön, dich kennen zu lernen.","Nice to meet you."],
  ["Ich mag Englisch.","I like English."],
  ["blau","blue"],
  ["rot","red"],
  ["weiß","white"],
  ["grün","green"],
  ["braun","brown"],
  ["grau","grey"],
  ["pink; rosa","pink"],
  ["gelb","yellow"],
  ["orange","orange"],
  ["im Park","in a park"],
  ["Farbe","colour"],
  ["Haustier","pet"],
  ["Hund","dog"],
  ["Zahl; Nummer","number"],
  ["Leute; Menschen","people"],
  ["Jungen; Buben","boys"],
  ["Essen; Lebensmittel","food"],
  ["Pommes frites","chips"],
  ["Ich sehe was, was du nicht siehst und das ist ...","I spy with my little eye, something ..."],
  ["Skateboard","skateboard"],
  ["Ich kann Fahrrad fahren.","I can ride a bike."],
  ["spielen","to play"],
  ["aus; von","from"],
  ["das; dies","this"],
  ["cool, super","cool"],
  ["Fußball","football"],
  ["Fan","fan"],
  ["elf","eleven"],
  ["Wie alt bist du?","How old are you?"],
  ["alt","old"],
  ["Woher kommst du?","Where are you from?"],
  ["sie sind","they\u0027re (= they are)"],
  ["zwölf","twelve"],
  ["Foto","photo"],
  ["Deutschland","Germany"],
  ["ihr","her"],
  ["Familie","family"],
  ["wir sind","we\u0027re (= we are)"],
  ["Garten","garden"],
  ["hier","here"],
  ["sie ist","she\u0027s (= she is)"],
  ["Schwester","sister"],
  ["ich habe; ich besitze","I have"],
  ["keine Brüder","no brothers"],
  ["Bruder","brother"],
  ["hier: ich","me"],
  ["unser","our"],
  ["Vater","father"],
  ["er ist","he\u0027s (= he is)"],
  ["Mutter","mother"],
  ["auch","too"],
  ["Papa; Vati","dad"],
  ["Freund; Freundin","friend"],
  ["Mama; Mutti","mum"],
  ["das ist","that\u0027s (= that is)"],
  ["England","England"],
  ["von","of"],
  ["sein","to be"],
  ["du bist; ihr seid; Sie sind","you\u0027re (= you are)"],
  ["Grill; Grillfest","barbecue"],
  ["Box; Kiste; Schachtel","box"],
  ["Tisch","table"],
  ["Telefon","phone"],
  ["Ball","ball"],
  ["Helm","helmet"],
  ["Buch; Heft","book"],
  ["Stuhl","chair"],
  ["Baum","tree"],
  ["Leiter","ladder"],
  ["hinter","behind"],
  ["Haus","house"],
  ["da ist, dort ist; es gibt","there\u0027s (= there is)"],
  ["neben","next to"],
  ["Teddybär","teddy"],
  ["auf; an; am","on"],
  ["unter","under"],
  ["da sind; es gibt","there are"],
  ["richtig, korrekt","right"],
  ["falsch","wrong"],
  ["zu Hause; Heim","home"],
  ["zu Hause; daheim","at home"],
  ["Wohnung","flat"],
  ["Balkon","balcony"],
  ["wer","who"],
  ["Bist du bereit?","Are you ready?"],
  ["nein","no"],
  ["ich kann ... nicht finden","I can\u0027t find ..."],
  ["Welche Farbe hat ...?","What colour is ...?"],
  ["Tasche; Tüte; Sack","bag"],
  ["Durcheinander; Unordnung","mess"],
  ["wer ist","who\u0027s (= who is)"],
  ["Herr (Anrede)","Mr"],
  ["Frau (Anrede)","Mrs"],
  ["Nachbar, Nachbarin","neighbour"],
  ["Samstag","Saturday"],
  ["Holz","wood"],
  ["beschäftigt","busy"],
  ["später","later"],
  ["dann, danach","then"],
  ["Nacht","night"],
  ["merkwürdig, komisch, lustig","funny"],
  ["Geräusch","noise"],
  ["niemand","no one"],
  ["Wind","wind"],
  ["Bild","picture"]
];
const startScreen = document.getElementById("start-screen");
const gameShell = document.getElementById("game-shell");
const belowGame = document.getElementById("below-game");
const startForm = document.getElementById("start-form");
const startButton = document.getElementById("start-button");
const profileForm = document.getElementById("profile-form");
const profileCreate = document.getElementById("profile-create");
const profileSelect = document.getElementById("player-select");
const profileStatus = document.getElementById("profile-status");
const nameInput = document.getElementById("player-name");
const wordForm = document.getElementById("word-form");
const germanInput = document.getElementById("word-german");
const englishInput = document.getElementById("word-english");
const wordStatus = document.getElementById("word-status");
const statsProfile = document.getElementById("stats-profile");
const wordEditor = document.getElementById("word-editor");
const wordList = document.getElementById("word-list");
const csvImportButton = document.getElementById("csv-import-button");
const csvFile = document.getElementById("csv-file");
const highscoreList = document.getElementById("highscore-list");
const highscoreEmpty = document.getElementById("highscore-empty");
const storageStatus = document.getElementById("storage-status");
let dataWritable = true;
let appData = {
  name: "",
  words: defaultWords.map(([german, english], i) => ({ id: `starter-${i}`, german, english, right: 0, wrong: 0 })),
  highscores: [],
  profiles: [],
  learningStatsVersion: 1,
  starterVocabularyVersion: 1
};

function nameKey(name) {
  return name.trim().toLocaleLowerCase();
}

function validRun(run) {
  return run == null || (typeof run.name === "string" && run.name.trim() &&
    Number.isSafeInteger(run.index) && run.index >= 0 &&
    Number.isSafeInteger(run.correctCount) && run.correctCount >= 0 && run.correctCount <= run.index &&
    Number.isSafeInteger(run.score) && run.score >= 0 &&
    Number.isSafeInteger(run.lifeQuarters) && run.lifeQuarters > 0 &&
    (run.lastWordId === null || typeof run.lastWordId === "string"));
}

function validStats(stats) {
  return Array.isArray(stats) && stats.every(item => item && typeof item.id === "string" &&
    Number.isSafeInteger(item.right) && item.right >= 0 &&
    Number.isSafeInteger(item.wrong) && item.wrong >= 0 &&
    (item.category === undefined || ["nochNicht", "soLala", "sicher"].includes(item.category)) &&
    (item.correctStreak === undefined || (Number.isSafeInteger(item.correctStreak) && item.correctStreak >= 0 && item.correctStreak <= 2))) &&
    new Set(stats.map(item => item.id)).size === stats.length;
}

function showStorageError(error) {
  dataWritable = false;
  startButton.disabled = true;
  profileCreate.disabled = true;
  profileSelect.disabled = true;
  wordEditor.disabled = true;
  storageStatus.textContent = `Speichern nicht möglich: ${error instanceof Error ? error.message : String(error)}. Bitte Browser-Speicher prüfen; deine Daten werden nicht überschrieben.`;
  storageStatus.hidden = false;
}

function validAppData(data) {
  return data && typeof data.name === "string" && Array.isArray(data.words) && data.words.length >= 2 &&
    data.words.every(word => typeof word.id === "string" && typeof word.german === "string" && word.german.trim() &&
      typeof word.english === "string" && word.english.trim() && Number.isSafeInteger(word.right) && word.right >= 0 &&
      Number.isSafeInteger(word.wrong) && word.wrong >= 0) &&
    new Set(data.words.map(word => word.id)).size === data.words.length &&
    new Set(data.words.map(word => word.english.trim().toLocaleLowerCase())).size === data.words.length &&
    Array.isArray(data.highscores) && data.highscores.every(entry => typeof entry.name === "string" &&
      Number.isSafeInteger(entry.score) && entry.score >= 0 && typeof entry.date === "string" && !Number.isNaN(Date.parse(entry.date))) &&
    (data.learningStatsVersion === undefined || data.learningStatsVersion === 1) &&
    (data.starterVocabularyVersion === undefined || data.starterVocabularyVersion === 1) &&
    (data.linkedVocabulary == null || typeof data.linkedVocabulary === "boolean") &&
    (!data.linkedVocabulary || typeof data.fileLinkId === "string") &&
    (data.vocabularyArchive == null || (Array.isArray(data.vocabularyArchive) &&
      data.vocabularyArchive.every(word => word && typeof word.id === "string" &&
        Number.isSafeInteger(word.right) && word.right >= 0 && Number.isSafeInteger(word.wrong) && word.wrong >= 0))) &&
    validRun(data.run) &&
    (data.profiles === undefined || (Array.isArray(data.profiles) &&
      data.profiles.every(profile => profile && typeof profile.name === "string" && nameKey(profile.name) &&
        validStats(profile.stats) && validRun(profile.run) &&
        (!profile.run || nameKey(profile.run.name) === nameKey(profile.name))) &&
      new Set(data.profiles.map(profile => nameKey(profile.name))).size === data.profiles.length));
}

try {
  const saved = localStorage.getItem(storageKey);
  if (saved !== null) {
    const parsed = JSON.parse(saved);
    if (!validAppData(parsed)) throw new Error("Die gespeicherten Daten haben ein ungültiges Format");
    appData = parsed;
  }
} catch (error) {
  showStorageError(error);
}

function saveAppData(next) {
  if (!dataWritable) return false;
  try {
    localStorage.setItem(storageKey, JSON.stringify(next));
    appData = next;
    return true;
  } catch (error) {
    showStorageError(error);
    return false;
  }
}

if (dataWritable && appData.profiles === undefined) {
  const owner = appData.run ? appData.run.name.trim() : appData.name.trim();
  const previous = new Map((appData.vocabularyArchive || []).map(word => [word.id, word]));
  for (const word of appData.words) previous.set(word.id, word);
  const stats = [...previous.values()].map(({ id, right, wrong }) => ({ id, right, wrong }));
  const profiles = owner ? [{ name: owner, stats, run: appData.run || null }] : [];
  const migrated = { ...appData, name: owner || appData.name, profiles };
  const saved = saveAppData(migrated);
  if (!saved) appData = migrated;
  if (saved && !owner && stats.some(item => item.right || item.wrong)) {
    wordStatus.textContent = "Frühere Statistiken ohne zugeordneten Namen bleiben in den gespeicherten Browserdaten erhalten.";
  }
}

function resetLearningStatistics(data) {
  const reset = {
    ...data,
    learningStatsVersion: 1,
    words: data.words.map(word => ({ ...word, right: 0, wrong: 0 })),
    profiles: data.profiles.map(profile => ({ ...profile, stats: [] }))
  };
  if (data.vocabularyArchive) {
    reset.vocabularyArchive = data.vocabularyArchive.map(word => ({ ...word, right: 0, wrong: 0 }));
  }
  return reset;
}

if (dataWritable && appData.learningStatsVersion === undefined) {
  if (saveAppData(resetLearningStatistics(appData))) {
    wordStatus.textContent = "Die Vokabelstatistiken wurden einmalig zurückgesetzt.";
  }
}

if (dataWritable && appData.linkedVocabulary) {
  if (saveAppData({ ...appData, linkedVocabulary: false })) {
    wordStatus.textContent = "Die zuletzt im Browser gespeicherten Vokabeln werden verwendet. Die Textdatei wird nicht mehr synchronisiert.";
  }
}

function addStarterVocabulary(data) {
  const words = [...data.words];
  const translations = new Set(words.map(word => word.english.trim().toLocaleLowerCase()));
  const ids = new Set(words.map(word => word.id));
  defaultWords.forEach(([german, english], index) => {
    const key = english.trim().toLocaleLowerCase();
    if (translations.has(key)) return;
    let id = `starter-${index}`;
    while (ids.has(id)) id += "-1";
    ids.add(id);
    translations.add(key);
    words.push({ id, german, english, right: 0, wrong: 0 });
  });
  return { ...data, words, starterVocabularyVersion: 1 };
}

if (dataWritable && appData.starterVocabularyVersion === undefined) {
  const updated = addStarterVocabulary(appData);
  const added = updated.words.length - appData.words.length;
  if (saveAppData(updated) && added) {
    wordStatus.textContent = `${added} neue Startvokabeln wurden ergänzt. Deine bisherigen Vokabeln und Lernstände bleiben erhalten.`;
  }
}

function setFileBusy(busy) {
  const unavailable = busy || !dataWritable;
  startButton.disabled = unavailable || !profileForName(selectedName);
  profileCreate.disabled = profileSelect.disabled = unavailable;
  wordEditor.disabled = unavailable;
}

function saveVocabulary(words) {
  const remaining = new Set(words.map(word => word.id));
  const removed = new Set(appData.words.filter(word => !remaining.has(word.id)).map(word => word.id));
  const profiles = appData.profiles.map(profile => ({
    ...profile,
    stats: profile.stats.filter(item => !removed.has(item.id))
  }));
  return saveAppData({ ...appData, words, profiles });
}

function validateWord(german, english, id = null) {
  if (!german || !english) return "Bitte beide Übersetzungen eingeben.";
  if (appData.words.some(word => word.id !== id && word.english.trim().toLocaleLowerCase() === english.toLocaleLowerCase())) {
    return "Diese englische Übersetzung ist bereits vorhanden.";
  }
  return "";
}

function wordCategory(word) {
  if (word.category !== undefined) return word.category;
  const attempts = word.right + word.wrong;
  if (attempts === 0 || word.right <= word.wrong) return "nochNicht";
  if (word.right >= 3 && word.right / attempts >= 0.8) return "sicher";
  return "soLala";
}

function profileForName(name) {
  const key = nameKey(name);
  return appData.profiles.find(profile => nameKey(profile.name) === key);
}

function wordsForPlayer(name) {
  const profile = profileForName(name);
  const stats = new Map(profile ? profile.stats.map(item => [item.id, item]) : []);
  return appData.words.map(word => {
    const item = stats.get(word.id);
    return { ...word, right: item ? item.right : 0, wrong: item ? item.wrong : 0, category: item && item.category };
  });
}

let selectedName = (profileForName(appData.name) || { name: "" }).name;

function renderMenu() {
  profileSelect.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Profil auswählen";
  profileSelect.append(placeholder);
  for (const item of appData.profiles) {
    const option = document.createElement("option");
    option.value = item.name;
    option.textContent = item.name;
    profileSelect.append(option);
  }
  profileSelect.value = selectedName;
  statsProfile.textContent = selectedName ? `Lernstand: ${selectedName}` : "Wähle ein Profil, um seinen Lernstand zu sehen.";
  setFileBusy(false);
  highscoreList.replaceChildren();
  const ranked = [...appData.highscores].sort((a, b) => b.score - a.score || a.date.localeCompare(b.date));
  highscoreEmpty.hidden = ranked.length > 0;
  ranked.forEach(entry => {
    const row = document.createElement("li");
    const name = document.createElement("span");
    const score = document.createElement("strong");
    name.textContent = entry.name;
    score.textContent = `${entry.score} ✦`;
    row.append(name, score);
    highscoreList.append(row);
  });
  wordList.replaceChildren();
  const words = wordsForPlayer(selectedName);
  const categories = [["nochNicht", "Neu"], ["soLala", "Geht so lala"], ["sicher", "Geht super"]];
  categories.forEach(([key, label]) => {
    const section = document.createElement("section");
    const heading = document.createElement("h3");
    heading.className = "word-group-heading";
    heading.textContent = label;
    section.append(heading);
    const group = words.filter(word => wordCategory(word) === key);
    if (!group.length) {
      const empty = document.createElement("p");
      empty.className = "empty-note";
      empty.textContent = "Keine Vokabeln.";
      section.append(empty);
    }
    group.forEach(word => {
      const row = document.createElement("form");
      row.className = "word-row";
      const fields = document.createElement("div");
      fields.className = "word-fields";
      const german = document.createElement("input");
      german.value = word.german;
      german.maxLength = 60;
      german.required = true;
      german.setAttribute("aria-label", `Deutsch: ${word.german}`);
      const english = document.createElement("input");
      english.value = word.english;
      english.maxLength = 60;
      english.required = true;
      english.setAttribute("aria-label", `Englisch: ${word.english}`);
      fields.append(german, english);
      const stats = document.createElement("span");
      stats.className = "word-counts";
      stats.textContent = `${label} · ✓ ${word.right} / ✕ ${word.wrong}`;
      stats.setAttribute("aria-label", `${label}: ${word.right} richtig, ${word.wrong} falsch`);
      const actions = document.createElement("div");
      actions.className = "word-actions";
      const save = document.createElement("button");
      save.type = "submit";
      save.textContent = "SPEICHERN";
      save.setAttribute("aria-label", `${word.german} speichern`);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "✕";
      remove.setAttribute("aria-label", `${word.german} entfernen`);
      actions.append(save, remove);
      row.append(fields, stats, actions);
      row.addEventListener("submit", async event => {
        event.preventDefault();
        const newGerman = german.value.trim();
        const newEnglish = english.value.trim();
        const error = validateWord(newGerman, newEnglish, word.id);
        if (error) { wordStatus.textContent = error; return; }
        const words = appData.words.map(item => item.id === word.id ? { ...item, german: newGerman, english: newEnglish } : item);
        if (await saveVocabulary(words)) { wordStatus.textContent = "Vokabel gespeichert."; renderMenu(); }
      });
      remove.addEventListener("click", async () => {
        if (appData.words.length <= 2) { wordStatus.textContent = "Mindestens zwei Vokabeln werden für die Antwortauswahl benötigt."; return; }
        if (!window.confirm(`„${word.german}“ und ihre Statistiken für alle Benutzer wirklich entfernen?`)) return;
        if (await saveVocabulary(appData.words.filter(item => item.id !== word.id))) {
          wordStatus.textContent = "Vokabel entfernt.";
          renderMenu();
        }
      });
      section.append(row);
    });
    wordList.append(section);
  });
}

wordForm.addEventListener("submit", async event => {
  event.preventDefault();
  const german = germanInput.value.trim();
  const english = englishInput.value.trim();
  const error = validateWord(german, english);
  if (error) { wordStatus.textContent = error; return; }
  const word = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, german, english, right: 0, wrong: 0 };
  if (await saveVocabulary([...appData.words, word])) {
    wordForm.reset();
    wordStatus.textContent = "Vokabel hinzugefügt.";
    renderMenu();
  }
});

function csvDelimiter(text) {
  let quoted = false;
  let commas = 0;
  let semicolons = 0;
  let content = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      content = true;
      if (quoted && text[i + 1] === '"') i++;
      else quoted = !quoted;
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (content) break;
    } else if (!quoted && char === ",") {
      commas++;
      content = true;
    } else if (!quoted && char === ";") {
      semicolons++;
      content = true;
    } else if (!/\s/.test(char)) {
      content = true;
    }
  }
  if (commas === semicolons) throw new Error("Bitte zwei Spalten mit Semikolon oder Komma trennen.");
  return commas > semicolons ? "," : ";";
}

function parseVocabularyCsv(text) {
  text = text.replace(/^\uFEFF/, "");
  const delimiter = csvDelimiter(text);
  const rows = [];
  let fields = [];
  let value = "";
  let quoted = false;
  let closed = false;
  let line = 1;
  let rowLine = 1;

  function finishRow() {
    fields.push(value);
    if (fields.length !== 1 || fields[0].trim()) rows.push({ line: rowLine, fields });
    fields = [];
    value = "";
    closed = false;
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted && char === '"') {
      if (text[i + 1] === '"') { value += '"'; i++; }
      else { quoted = false; closed = true; }
    } else if (!quoted && char === delimiter) {
      fields.push(value);
      value = "";
      closed = false;
    } else if (char === "\r" || char === "\n") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      if (quoted) value += "\n";
      else finishRow();
      line++;
      if (!quoted) rowLine = line;
    } else if (!quoted && char === '"') {
      if (closed || value.trim()) throw new Error(`Zeile ${line}: Anführungszeichen an unerwarteter Stelle.`);
      value = "";
      quoted = true;
    } else if (closed) {
      if (!/\s/.test(char)) throw new Error(`Zeile ${line}: Unerwartetes Zeichen nach Anführungszeichen.`);
    } else {
      value += char;
    }
  }
  if (quoted) throw new Error(`Zeile ${rowLine}: Anführungszeichen nicht geschlossen.`);
  if (fields.length || value || closed) finishRow();

  if (rows.length && rows[0].fields.length === 2) {
    const header = rows[0].fields.map(field => field.trim().toLocaleLowerCase());
    if (["deutsch", "german", "de"].includes(header[0]) && ["englisch", "english", "en"].includes(header[1])) rows.shift();
  }
  if (!rows.length) throw new Error("Die Datei enthält keine Vokabeln.");
  return rows;
}

csvImportButton.addEventListener("click", () => csvFile.click());
csvFile.addEventListener("change", async () => {
  const file = csvFile.files[0];
  if (!file) return;
  csvFile.value = "";
  setFileBusy(true);
  wordStatus.textContent = "CSV-Datei wird geprüft …";
  try {
    const bytes = await file.arrayBuffer();
    let text;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch (error) {
      if (error instanceof TypeError) throw new Error("Die Datei muss UTF-8-kodiert sein.");
      throw error;
    }
    const rows = parseVocabularyCsv(text);
    const translations = new Set(appData.words.map(word => word.english.trim().toLocaleLowerCase()));
    const ids = new Set(appData.words.map(word => word.id));
    const imported = rows.map((row, index) => {
      if (row.fields.length !== 2) throw new Error(`Zeile ${row.line}: Genau zwei Spalten sind erforderlich.`);
      const [german, english] = row.fields.map(field => field.trim());
      if (!german || !english) throw new Error(`Zeile ${row.line}: Beide Übersetzungen sind erforderlich.`);
      if (german.length > 60 || english.length > 60 || german.includes("\n") || english.includes("\n")) {
        throw new Error(`Zeile ${row.line}: Übersetzungen müssen einzeilig und höchstens 60 Zeichen lang sein.`);
      }
      const key = english.toLocaleLowerCase();
      if (translations.has(key)) throw new Error(`Zeile ${row.line}: Die englische Übersetzung „${english}“ ist bereits vorhanden.`);
      translations.add(key);
      let id = `csv-${Date.now()}-${index}`;
      while (ids.has(id)) id += "-1";
      ids.add(id);
      return { id, german, english, right: 0, wrong: 0 };
    });
    if (await saveVocabulary([...appData.words, ...imported])) {
      wordStatus.textContent = `${imported.length} Vokabel${imported.length === 1 ? "" : "n"} importiert.`;
      renderMenu();
    } else {
      wordStatus.textContent = "CSV-Import nicht gespeichert. Bitte die Speichermeldung prüfen.";
    }
  } catch (error) {
    wordStatus.textContent = `CSV-Import fehlgeschlagen: ${error instanceof Error ? error.message : String(error)} Keine Vokabeln wurden importiert.`;
  } finally {
    setFileBusy(false);
  }
});

function recordAnswer(id, correct, run) {
  const profile = profileForName(run.name);
  if (!profile) {
    showStorageError(new Error("Das Spielerprofil wurde nicht gefunden"));
    return false;
  }
  const current = profile.stats.find(item => item.id === id) || { id, right: 0, wrong: 0 };
  const stages = ["nochNicht", "soLala", "sicher"];
  const streak = correct ? (current.correctStreak || 0) + 1 : 0;
  const change = correct ? (streak === 3 ? 1 : 0) : -1;
  const nextStage = Math.max(0, Math.min(stages.length - 1, stages.indexOf(wordCategory(current)) + change));
  const stats = [...profile.stats.filter(item => item.id !== id), {
    ...current, right: current.right + (correct ? 1 : 0), wrong: current.wrong + (correct ? 0 : 1),
    category: stages[nextStage], correctStreak: streak === 3 ? 0 : streak
  }];
  const profiles = appData.profiles.map(item => item === profile
    ? { ...profile, stats }
    : item);
  const highscores = run.lifeQuarters === 0 ? highscoreEntries(run.name, run.score) : appData.highscores;
  return saveAppData({ ...appData, profiles, highscores });
}

function highscoreEntries(name, score) {
  const existing = appData.highscores.find(entry => entry.name.toLocaleLowerCase() === name.toLocaleLowerCase());
  if (existing && existing.score >= score) return appData.highscores;
  const highscores = appData.highscores.filter(entry => entry !== existing);
  highscores.push({ name, score, date: new Date().toISOString() });
  return highscores;
}

profileForm.addEventListener("submit", event => {
  event.preventDefault();
  const name = nameInput.value.trim();
  if (!dataWritable) return;
  if (!name) { profileStatus.textContent = "Bitte gib einen Namen ein."; return; }
  if (profileForName(name)) {
    profileStatus.textContent = "Ein Profil mit diesem Namen gibt es bereits.";
    return;
  }
  const profiles = [...appData.profiles, { name, stats: [] }];
  if (!saveAppData({ ...appData, name, profiles })) return;
  selectedName = name;
  nameInput.value = "";
  profileStatus.textContent = `Profil „${name}“ wurde angelegt und ausgewählt.`;
  renderMenu();
});

profileSelect.addEventListener("change", () => {
  const profile = profileForName(profileSelect.value);
  const name = profile ? profile.name : "";
  if (!saveAppData({ ...appData, name })) {
    profileSelect.value = selectedName;
    return;
  }
  selectedName = name;
  profileStatus.textContent = name ? `Profil „${name}“ ist ausgewählt.` : "Bitte ein Profil auswählen.";
  renderMenu();
});

startForm.addEventListener("submit", event => {
  event.preventDefault();
  const profile = profileForName(selectedName);
  if (!dataWritable || !profile) return;
  const name = profile.name;
  const run = { name, index: 0, score: 0, correctCount: 0, lifeQuarters: 12, lastWordId: null };
  const profiles = appData.profiles.map(item => item === profile ? { ...item, run: null } : item);
  if (!saveAppData({ ...appData, name, profiles })) return;
  startScreen.hidden = true;
  gameShell.hidden = false;
  belowGame.hidden = false;
  startGame(run);
  startMusicOnInteraction();
});

function showMenu() {
  startScreen.hidden = false;
  gameShell.hidden = true;
  belowGame.hidden = true;
  renderMenu();
  profileSelect.focus();
}

renderMenu();
