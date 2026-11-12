"use strict";

function testProgression() {
  const saved = { appData, saveAppData, playerName, score, levelStartScore, speedStartScore,
    speedEndScore, speed, slowdownRemaining, lifeQuarters, worldLevel, state, random: Math.random,
    playSound, segments, nextSegmentNumber, index, recentWordIds, lastWordId, defeatedBosses,
    correctCount, animationTime, endlessElapsed, endlessStartSpeed,
    player: { ...player }, controls: { ...controls }, boss: { ...boss } };
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  try {
    appData = {
      name: "Test", words: [
        { id: "a", german: "eins", english: "one", right: 0, wrong: 0 },
        { id: "b", german: "zwei", english: "two", right: 0, wrong: 0 }
      ],
      highscores: [{ name: "Test", score: 100, date: "2025-01-01T00:00:00.000Z" }],
      vocabularyArchive: [{ id: "removed", right: 2, wrong: 1 }],
      profiles: [
        { name: "Test", stats: [{ id: "a", right: 4, wrong: 1 }] },
        { name: "Anderer", stats: [{ id: "a", right: 1, wrong: 1 }] }
      ]
    };
    saveAppData = next => { appData = next; return true; };
    const existing = {
      ...appData,
      words: [
        { id: "starter-0", german: "eigenes Haus", english: "HOUSE", right: 3, wrong: 1 },
        { id: "custom", german: "eigenes Wort", english: "custom word", right: 0, wrong: 0 }
      ]
    };
    const migratedWords = addStarterVocabulary(existing);
    check(migratedWords.words.length === existing.words.length + defaultWords.length - 1 &&
      migratedWords.words[0] === existing.words[0] && migratedWords.profiles === existing.profiles &&
      migratedWords.highscores === existing.highscores && migratedWords.starterVocabularyVersion === 1 &&
      new Set(migratedWords.words.map(word => word.id)).size === migratedWords.words.length &&
      validAppData(migratedWords),
      "Neue Startvokabeln müssen ohne Duplikate oder Verlust bestehender Daten ergänzt werden.");
    const run = { name: "Test", score: 0, lifeQuarters: 12 };
    check(wordCategory(wordsForPlayer("Test")[0]) === "sicher", "Alte Statistik muss ihre bisherige Kategorie behalten.");
    appData.words[0].right = 5;
    appData = resetLearningStatistics(appData);
    check(appData.learningStatsVersion === 1 && appData.profiles.every(profile => profile.stats.length === 0) &&
      appData.words[0].right === 0 && appData.vocabularyArchive[0].right === 0 &&
      appData.vocabularyArchive[0].wrong === 0 && appData.highscores.length === 1,
      "Der einmalige Reset muss Lernstatistiken löschen und Wörter, Profile und Highscores erhalten.");
    check(validAppData(appData), "Zurückgesetzte Daten müssen gültig sein.");
    recordAnswer("a", true, run);
    recordAnswer("b", false, run);
    recordAnswer("a", true, run);
    check(wordCategory(wordsForPlayer("Test")[0]) === "nochNicht", "Zwei richtige Antworten dürfen noch nicht aufstufen.");
    appData = JSON.parse(JSON.stringify(appData));
    recordAnswer("a", true, run);
    check(wordCategory(wordsForPlayer("Test")[0]) === "soLala", "Drei richtige Antworten müssen aufstufen, auch nach erneutem Laden.");
    recordAnswer("a", true, run);
    recordAnswer("a", true, run);
    recordAnswer("a", false, run);
    check(wordCategory(wordsForPlayer("Test")[0]) === "nochNicht" &&
      appData.profiles[0].stats.find(item => item.id === "a").correctStreak === 0, "Falsch muss sofort abstufen und die Serie beenden.");
    for (let i = 0; i < 6; i++) recordAnswer("a", true, run);
    check(wordCategory(wordsForPlayer("Test")[0]) === "sicher", "Zweimal drei richtige Antworten müssen bis Geht super aufstufen.");
    recordAnswer("a", true, run);
    check(wordCategory(wordsForPlayer("Test")[0]) === "sicher", "Geht super ist die obere Grenze.");
    check(wordCategory(wordsForPlayer("Anderer")[0]) === "nochNicht", "Andere Profile dürfen sich nicht ändern.");
    recordAnswer("a", false, run);
    check(wordCategory(wordsForPlayer("Test")[0]) === "soLala", "Falsch muss auch von Geht super sofort abstufen.");
    check(validAppData(appData), "Die neuen Kategorien müssen speicherbar sein.");
    appData = JSON.parse(JSON.stringify(appData));
    check(wordCategory(wordsForPlayer("Test")[0]) === "soLala", "Die Kategorie muss nach erneutem Laden erhalten bleiben.");
    const invalid = structuredClone(appData);
    invalid.profiles[0].stats[0].category = "unbekannt";
    check(!validAppData(invalid), "Ungültige Kategorien dürfen nicht akzeptiert werden.");
    invalid.profiles[0].stats[0].category = "soLala";
    invalid.profiles[0].stats[0].correctStreak = 3;
    check(!validAppData(invalid), "Ungültige Serien dürfen nicht akzeptiert werden.");

    levelStartScore = 0;
    score = 500;
    resetSpeed();
    speedStartScore = 0;
    speedEndScore = 1000;
    lifeQuarters = 12;
    const target = speedForScore(score);
    loseLife();
    check(lifeQuarters === 8 && Math.abs(speed - target * .65) < .001, "Lebensverlust muss kurz verlangsamen.");
    slowdownRemaining = 2;
    check(Math.abs(movementFactor() - .825) < .001, "Die Geschwindigkeit muss allmählich zunehmen.");
    slowdownRemaining = 0;
    check(speedForScore(score) === target && movementFactor() === 1, "Die ursprüngliche Geschwindigkeit muss zurückkehren.");
    check(speedStartScore === 0 && speedEndScore === 1000, "Lebensverlust darf den Levelfortschritt nicht zurücksetzen.");

    playSound = () => {};
    Math.random = () => 0;
    playerName = "Test";
    state = "running";
    segments = [];
    player.x = 110;
    player.y = floorAt(player.x + player.width / 2) - player.height;
    player.grounded = true;
    loseLife();
    update(.05);
    check(Math.abs(speed - target * .65) < .001, "Die Verlangsamung muss im Lauf angewandt werden.");
    for (let i = 0; i < 80; i++) update(.05);
    check(slowdownRemaining === 0 && Math.abs(speed - target) < .001, "Nach vier Sekunden muss das normale Tempo zurück sein.");

    worldLevel = 2;
    score = 3000;
    index = 20;
    recentWordIds = [];
    lastWordId = null;
    defeatedBosses = levels.map(() => false);
    boss.active = true;
    finishBoss();
    check(worldLevel === 3 && levels[3].name.includes("Weltraum"), "Der Tigerboss muss ins Weltraumlevel führen.");
    check(activeSegment() && state === "running", "Im Weltraum muss ein Lauf mit Vokabel weitergehen.");
    for (let level = 3; level < levels.length; level++) {
      check(worldLevel === level && state === "running", "Nach einem Boss muss das nächste Level beginnen.");
      draw();
      score = levelStartScore + 900;
      activeSegment().word.category = "nochNicht";
      resolveChoice(activeSegment(), true);
      check(state === "bossIntro" && !bossIntro.hidden && !boss.active,
        "Vor jedem Boss muss die Anleitung erscheinen und das Spiel pausieren.");
      const pausedX = player.x;
      const pausedTime = animationTime;
      const pausedSlowdown = slowdownRemaining;
      setControl("jump", true);
      update(5);
      check(player.x === pausedX && animationTime === pausedTime && slowdownRemaining === pausedSlowdown && !controls.jump,
        "Während der Anleitung dürfen Bewegung, Steuerung und Timer nicht weiterlaufen.");
      bossStartButton.click();
      check(state === "boss" && bossIntro.hidden, "Der Startknopf muss den Bosskampf fortsetzen.");
      check(boss.active && bossTypes[level], "Jedes neue Level muss einen eigenen Boss haben.");
      if (level === 3) {
        lifeQuarters = 20;
        controls.right = true;
        loseLife();
        const oldX = boss.playerX;
        update(.05);
        check(Math.abs(boss.playerX - oldX - 240 * .65 * .05) < .001, "Auch im Bosskampf muss ein Treffer kurz verlangsamen.");
        controls.right = false;
      }
      drawBoss();
      for (let hit = 0; hit < 5; hit++) {
        const answer = boss.question.answers.indexOf(boss.question.correctAnswer);
        resolveBossArrow(answer);
      }
      check(state === "bossVictory", "Fünf richtige Antworten müssen den Boss besiegen.");
      finishBoss();
      check(defeatedBosses[level], "Besiegte Bosse müssen gespeichert werden.");
    }
    check(levels.slice(6).map(level => level.name).join("|") === "Einhornland|Bayerische Berge|New York|London|Die magische Bibliothek|Das Reich der Zauberei",
      "Nach London müssen die Bibliothek und die Zauberwelt folgen.");
    check(bossTypes.slice(6).every(type => type.name && type.projectile), "Jede neue Welt braucht einen eigenen Boss.");
    check(bossTypes[10].name === "Bücherwächter" && bossTypes[11].name === "Schattenmagier",
      "Bibliothek und Zauberwelt brauchen passende Bosse.");
    check(worldLevel === 11 && state === "running", "Nach dem letzten Boss muss die Zauberwelt endlos weitergehen.");
    check(worldNumber.textContent === "LEVEL 12", "Die Levelnummer muss auch zweistellig korrekt angezeigt werden.");
    return "Lernstufen, Geschwindigkeit und Level: alle Tests bestanden";
  } finally {
    appData = saved.appData;
    saveAppData = saved.saveAppData;
    playerName = saved.playerName;
    score = saved.score;
    levelStartScore = saved.levelStartScore;
    speedStartScore = saved.speedStartScore;
    speedEndScore = saved.speedEndScore;
    speed = saved.speed;
    slowdownRemaining = saved.slowdownRemaining;
    lifeQuarters = saved.lifeQuarters;
    worldLevel = saved.worldLevel;
    state = saved.state;
    Math.random = saved.random;
    playSound = saved.playSound;
    segments = saved.segments;
    nextSegmentNumber = saved.nextSegmentNumber;
    index = saved.index;
    recentWordIds = saved.recentWordIds;
    lastWordId = saved.lastWordId;
    defeatedBosses = saved.defeatedBosses;
    correctCount = saved.correctCount;
    animationTime = saved.animationTime;
    endlessElapsed = saved.endlessElapsed;
    endlessStartSpeed = saved.endlessStartSpeed;
    Object.assign(player, saved.player);
    Object.assign(controls, saved.controls);
    Object.assign(boss, saved.boss);
  }
}
