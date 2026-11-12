"use strict";

function testLastChance() {
  const saved = {
    appData, saveAppData, playSound, speakEnglish, random: Math.random,
    state, score, index, correctCount, playerName, lifeQuarters, lastChancesRemaining,
    rescueWord, rescueBossQuestionAnswered, endlessStartSpeed, endlessElapsed, musicMode,
    audioContext, musicEnabled, nextNoteTime, musicStep, createTone,
    worldLevel, levelStartScore, speedStartScore, speedEndScore, speed, slowdownRemaining,
    defeatedBosses, segments, nextSegmentNumber, lastWordId, recentWordIds, fallingSegment,
    impactStarted, impactY, impactHazard, respawnStarted, animationTime, toastTime, levelToastTime,
    player: { ...player }, controls: { ...controls }, boss: { ...boss },
    hidden: [...document.querySelectorAll("[id]")].map(element => [element, element.hidden])
  };
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const submit = value => {
    lastChanceAnswer.value = value;
    lastChanceForm.requestSubmit();
  };
  const start = () => startGame({
    name: "Test", index: 0, score: 0, correctCount: 0, lifeQuarters: 12, lastWordId: null
  });
  try {
    check(englishAnswerMatches("I'm", "I'm (= I am)") && englishAnswerMatches("I am", "I'm (= I am)") &&
      englishAnswerMatches("okay", "OK / okay") && englishAnswerMatches("Goodbye", "Bye., Goodbye.") &&
      englishAnswerMatches("welcome", "welcome (to)") && englishAnswerMatches("welcome to", "welcome (to)") &&
      !englishAnswerMatches("cat", "dog"), "Gültige Varianten müssen auch ohne Erläuterung oder Satzzeichen erkannt werden.");
    appData = {
      name: "Test",
      words: [
        { id: "a", german: "der Apfel", english: "apple", right: 0, wrong: 0 },
        { id: "b", german: "die Katze", english: "cat", right: 0, wrong: 0 }
      ],
      profiles: [{ name: "Test", stats: [] }], highscores: [], learningStatsVersion: 1
    };
    saveAppData = next => { appData = next; return true; };
    playSound = () => {};
    speakEnglish = () => {};
    Math.random = () => 0;
    start();
    lifeQuarters = 4;
    const pit = activeSegment();
    pit.resolved = true;
    index = 1;
    ensureSegments();
    player.x = pit.base + trapOffset + 5;
    fallingSegment = pit;
    loseLife();
    recordAnswer(pit.word.id, false, { name: playerName, index, score, correctCount, lifeQuarters, lastWordId });
    state = "falling";
    player.y = (canvas.height - viewOffsetY) / viewScale + 31;
    update(.01);
    check(state === "lastChance" && !lastChance.hidden && musicMode === "lastChance",
      "Nach dem Sturz muss die letzte Chance mit dramatischer Musik erscheinen.");
    check(appData.highscores.length === 1, "Der Highscore muss schon beim Verlust aller Leben gesichert werden.");
    const pausedX = player.x;
    const pausedTime = animationTime;
    update(3);
    check(player.x === pausedX && animationTime === pausedTime && slowdownRemaining === slowdownDuration,
      "Während der letzten Chance müssen Spiel und Verlangsamung pausieren.");
    submit("  ");
    check(lastChancesRemaining === 3, "Eine leere Eingabe darf keine Chance verbrauchen.");
    submit("falsch");
    check(lastChancesRemaining === 2 && state === "lastChance" && lastChanceStatus.textContent.includes("Richtig war"),
      "Eine falsche Eingabe muss eine Chance verbrauchen und die Lösung anzeigen.");
    const answer = rescueWord.english;
    submit(`  ${answer.toUpperCase()}  `);
    check(state === "respawning" && lifeQuarters === 4 && lastChancesRemaining === 1 &&
      player.x >= pit.base + trapOffset + pitWidth + player.width && musicMode === "normal",
      "Eine richtige Eingabe muss ein Leben zurückgeben und sicher hinter der Falle wiederbeleben.");
    check(appData.profiles[0].stats.some(item => item.right === 1) &&
      appData.profiles[0].stats.reduce((total, item) => total + item.wrong, 0) === 2,
      "Die Eingaben müssen im Lernstand erfasst werden.");
    lifeQuarters = 0;
    endGame();
    submit(rescueWord.english);
    check(state === "respawning" && lastChancesRemaining === 0 && lifeQuarters === 4,
      "Auch die dritte Chance muss bei richtiger Antwort noch retten.");
    lifeQuarters = 0;
    endGame();
    check(state === "gameover" && lastChance.hidden, "Nach Verbrauch aller Chancen endet der nächste Verlust sofort.");

    appData = { ...appData, highscores: [] };
    start();
    score = 432;
    lifeQuarters = 0;
    recordAnswer("a", false, { name: playerName, index, score, correctCount, lifeQuarters, lastWordId });
    endGame();
    check(appData.highscores.length === 1 && appData.highscores[0].score === 432,
      "Der Highscore muss auch während der letzten Chance erhalten bleiben.");
    submit("falsch");
    submit("falsch");
    submit("falsch");
    check(state === "gameover" && lastChancesRemaining === 0 && lastChance.hidden &&
      appData.highscores.length === 1 && appData.highscores[0].score === 432 && messageText.textContent.includes("letzte Lösung"),
      "Nach drei falschen Eingaben muss das Spiel enden und der Highscore gespeichert werden.");

    start();
    startBoss();
    beginBossFight();
    lifeQuarters = 4;
    const answeredQuestion = boss.question;
    const wrong = answeredQuestion.answers.findIndex(item => item !== answeredQuestion.correctAnswer);
    resolveBossArrow(wrong);
    check(state === "lastChance" && boss.active, "Auch ein falsches Boss-Schild muss eine letzte Chance öffnen.");
    submit(rescueWord.english);
    check(state === "boss" && lifeQuarters === 4 && boss.question !== answeredQuestion && boss.invulnerable > 0,
      "Nach der Rettung muss der Bosskampf mit einer neuen Frage und Trefferschutz weitergehen.");
    const currentQuestion = boss.question;
    lifeQuarters = 4;
    boss.invulnerable = 0;
    boss.fireballs = [{ x: boss.playerX + 18, y: boss.playerY - 30, vx: 0, vy: 0 }];
    boss.nextFire = 100;
    updateBoss(.01);
    check(state === "lastChance", "Auch ein tödliches Boss-Geschoss muss eine letzte Chance öffnen.");
    submit(rescueWord.english);
    check(state === "boss" && boss.question === currentQuestion && boss.fireballs.length === 0,
      "Nach einem Geschoss muss die unbeantwortete Bossfrage erhalten bleiben.");

    start();
    defeatedBosses[levels.length - 1] = true;
    endlessStartSpeed = 410;
    endlessElapsed = 0;
    segments = [];
    for (let i = 0; i < 20; i++) update(.05);
    check(Math.abs(speedForScore(score) - 411) < .001, "Das Tempo muss ohne neue Punkte kontinuierlich steigen.");
    endlessElapsed = 1000;
    check(speedForScore(score) > baseSpeed * 2, "Das Endlostempo darf nicht bei der alten Grenze stehen bleiben.");
    lifeQuarters = 4;
    loseLife();
    check(Math.abs(speed - speedForScore(score) * .65) < .001, "Auch im Endloslauf muss ein Treffer verlangsamen.");
    for (let i = 0; i < 81; i++) update(.05);
    check(slowdownRemaining === 0 && Math.abs(speedForScore(score) - speed) < .1,
      "Nach der Erholung muss wieder das gestiegene Endlostempo erreicht werden.");

    let instruments = [];
    audioContext = { currentTime: 0, state: "running" };
    musicEnabled = true;
    createTone = (bus, frequency, startTime, duration, volume, type) => { instruments.push(type); };
    setMusicMode("lastChance");
    check(instruments.includes("sawtooth"), "Die letzte Chance muss eine eigene dramatische MIDI-Notenmelodie verwenden.");
    instruments = [];
    setMusicMode("normal");
    check(instruments.includes("triangle"), "Nach der letzten Chance muss die normale Musik zurückkehren.");
    return "Letzte Chancen und Endlosgeschwindigkeit: alle Tests bestanden";
  } finally {
    appData = saved.appData;
    saveAppData = saved.saveAppData;
    playSound = saved.playSound;
    speakEnglish = saved.speakEnglish;
    Math.random = saved.random;
    state = saved.state;
    score = saved.score;
    index = saved.index;
    correctCount = saved.correctCount;
    playerName = saved.playerName;
    lifeQuarters = saved.lifeQuarters;
    lastChancesRemaining = saved.lastChancesRemaining;
    rescueWord = saved.rescueWord;
    rescueBossQuestionAnswered = saved.rescueBossQuestionAnswered;
    endlessStartSpeed = saved.endlessStartSpeed;
    endlessElapsed = saved.endlessElapsed;
    musicEnabled = saved.musicEnabled;
    audioContext = saved.audioContext;
    nextNoteTime = saved.nextNoteTime;
    musicStep = saved.musicStep;
    createTone = saved.createTone;
    musicMode = saved.musicMode;
    worldLevel = saved.worldLevel;
    levelStartScore = saved.levelStartScore;
    speedStartScore = saved.speedStartScore;
    speedEndScore = saved.speedEndScore;
    speed = saved.speed;
    slowdownRemaining = saved.slowdownRemaining;
    defeatedBosses = saved.defeatedBosses;
    segments = saved.segments;
    nextSegmentNumber = saved.nextSegmentNumber;
    lastWordId = saved.lastWordId;
    recentWordIds = saved.recentWordIds;
    fallingSegment = saved.fallingSegment;
    impactStarted = saved.impactStarted;
    impactY = saved.impactY;
    impactHazard = saved.impactHazard;
    respawnStarted = saved.respawnStarted;
    animationTime = saved.animationTime;
    toastTime = saved.toastTime;
    levelToastTime = saved.levelToastTime;
    Object.assign(player, saved.player);
    Object.assign(controls, saved.controls);
    Object.assign(boss, saved.boss);
    saved.hidden.forEach(([element, hidden]) => { element.hidden = hidden; });
  }
}
