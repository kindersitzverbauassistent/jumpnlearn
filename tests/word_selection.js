"use strict";

function testWordSelection() {
  const saved = {
    appData, playerName, recentWordIds, lastWordId, random: Math.random,
    startBoss, recordAnswer, playSound, score, index, correctCount, lifeQuarters,
    worldLevel, levelStartScore, defeatedBosses, segments, nextSegmentNumber,
    updateHud, updateBossStatus, showQuestion, bossQuestion: boss.question
  };
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const setup = categories => {
    appData = {
      words: categories.map((category, i) => ({ id: String(i), german: `Deutsch ${i}`, english: `English ${i}` })),
      profiles: [{
        name: "Test",
        stats: categories.map((category, i) => ({
          id: String(i), right: category === "sicher" ? 3 : category === "soLala" ? 1 : 0, wrong: 0,
          category
        }))
      }]
    };
    playerName = "Test";
    recentWordIds = [];
    lastWordId = null;
  };
  try {
    setup(["nochNicht", "soLala"]);
    for (let i = 0; i < 20; i++) {
      const previous = lastWordId;
      check(nextWord().id !== previous, "Zwei Wörter müssen sich abwechseln.");
    }

    setup(["nochNicht", "nochNicht", "nochNicht", "nochNicht", "nochNicht", "nochNicht", "soLala", "sicher"]);
    let history = [];
    for (let i = 0; i < 200; i++) {
      const id = nextWord().id;
      check(!history.slice(-5).includes(id), "Ein Wort wurde innerhalb von fünf Fragen wiederholt.");
      history.push(id);
    }

    setup(["nochNicht", "nochNicht", "nochNicht", "soLala", "soLala", "soLala", "sicher", "sicher", "sicher"]);
    const categoryCounts = life => {
      lifeQuarters = life;
      const counts = { nochNicht: 0, soLala: 0, sicher: 0 };
      for (let i = 0; i < 1000; i++) {
        recentWordIds = [];
        Math.random = () => (i + .5) / 1000;
        counts[wordCategory(nextWord())]++;
      }
      return counts;
    };
    const healthy = categoryCounts(9);
    check(healthy.nochNicht === 700 && healthy.soLala === 300 && healthy.sicher === 0,
      "Bei mehr als zwei Leben müssen Neu und Geht so lala bevorzugt werden.");
    const low = categoryCounts(8);
    check(low.nochNicht === 650 && low.soLala === 250 && low.sicher === 100,
      "Bei höchstens zwei Leben müssen auch sichere Wörter vorkommen.");

    setup(["nochNicht", "soLala", "soLala", "soLala"]);
    lifeQuarters = 12;
    Math.random = () => .5;
    check(wordCategory(nextWord()) === "soLala", "Kleine Kategorien müssen anteilig weniger Gewicht erhalten.");

    setup(["nochNicht", "sicher", "sicher"]);
    lifeQuarters = 12;
    recentWordIds = ["0", "1"];
    check(nextWord().id === "2", "Sichere Wörter müssen einspringen, wenn andere Wörter gesperrt sind.");
    setup(["sicher", "sicher"]);
    check(wordCategory(nextWord()) === "sicher", "Ein rein sicherer Wortschatz muss spielbar bleiben.");

    setup(["nochNicht", "nochNicht", "nochNicht", "soLala", "soLala", "soLala", "sicher", "sicher", "sicher"]);
    updateHud = () => {};
    updateBossStatus = () => {};
    showQuestion = () => {};
    Math.random = () => .99;
    lifeQuarters = 9;
    nextBossQuestion();
    check(wordCategory(boss.question.word) === "soLala", "Im Bosskampf gilt die Auswahl bei mehr als zwei Leben.");
    recentWordIds = [];
    lifeQuarters = 8;
    nextBossQuestion();
    check(wordCategory(boss.question.word) === "sicher", "Im Bosskampf sind bei wenig Leben sichere Wörter möglich.");

    setup(["nochNicht", "nochNicht", "nochNicht", "nochNicht", "nochNicht", "soLala"]);
    Math.random = () => 0;
    const first = nextWord().id;
    appData.profiles[0].stats.find(item => item.id === first).category = "sicher";
    for (let i = 0; i < 5; i++) {
      check(nextWord().id !== first, "Ein Kategorienwechsel darf die Sperre nicht aufheben.");
    }

    setup(["nochNicht", "nochNicht", "nochNicht", "nochNicht", "nochNicht", "nochNicht", "soLala", "sicher"]);
    Math.random = () => 0;
    const initial = makeSegment(0);
    score = 900;
    index = 0;
    correctCount = 0;
    lifeQuarters = 12;
    worldLevel = 0;
    levelStartScore = 0;
    defeatedBosses = [false, false, false];
    segments = [initial];
    nextSegmentNumber = 1;
    recordAnswer = () => {};
    playSound = () => {};
    let bossWord;
    startBoss = () => { bossWord = makeSegment(index).word.id; };
    resolveChoice(initial, true);
    check(recentWordIds.length === 2 && recentWordIds[1] === bossWord,
      "Beim Bossübergang darf keine ungestellte Frage die Sperre belegen.");
    check(bossWord !== initial.word.id, "Die Bossfrage darf das vorige Wort nicht wiederholen.");

    setup(["nochNicht", "nochNicht", "nochNicht", "nochNicht", "nochNicht", "nochNicht", "soLala", "sicher"]);
    const runWord = makeSegment(0).word.id;
    updateHud = () => {};
    updateBossStatus = () => {};
    showQuestion = () => {};
    nextBossQuestion();
    const realBossWord = boss.question.word.id;
    const returnWord = makeSegment(1).word.id;
    check(new Set([runWord, realBossWord, returnWord]).size === 3,
      "Die Sperre muss für Fragen vor, während und nach dem Bosskampf gelten.");
    return "Wortauswahl: alle Tests bestanden";
  } finally {
    appData = saved.appData;
    playerName = saved.playerName;
    recentWordIds = saved.recentWordIds;
    lastWordId = saved.lastWordId;
    Math.random = saved.random;
    startBoss = saved.startBoss;
    recordAnswer = saved.recordAnswer;
    playSound = saved.playSound;
    score = saved.score;
    index = saved.index;
    correctCount = saved.correctCount;
    lifeQuarters = saved.lifeQuarters;
    worldLevel = saved.worldLevel;
    levelStartScore = saved.levelStartScore;
    defeatedBosses = saved.defeatedBosses;
    segments = saved.segments;
    nextSegmentNumber = saved.nextSegmentNumber;
    updateHud = saved.updateHud;
    updateBossStatus = saved.updateBossStatus;
    showQuestion = saved.showQuestion;
    boss.question = saved.bossQuestion;
  }
}
