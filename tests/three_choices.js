"use strict";

function testThreeChoices() {
  const saved = {
    appData, playerName, worldLevel, state, score, index, correctCount, lifeQuarters,
    speed, speedStartScore, speedEndScore, levelStartScore, slowdownRemaining, animationTime,
    recentWordIds, lastWordId, segments, nextSegmentNumber, defeatedBosses,
    fallingSegment, impactHazard, impactStarted, impactY, respawnStarted,
    player: { ...player }, controls: { ...controls }, boss: { ...boss }, random: Math.random,
    playSound, recordAnswer, speakEnglish, updateHud, showQuestion,
    toastHidden: toast.hidden, toastText: toast.textContent, toastTime,
    questionHidden: questionBubble.hidden
  };
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const setup = number => {
    index = number;
    recentWordIds = [];
    lastWordId = null;
    state = "running";
    score = 0;
    speedStartScore = 0;
    speedEndScore = 1000;
    levelStartScore = 0;
    slowdownRemaining = 0;
    lifeQuarters = 12;
    resetControls();
    defeatedBosses = levels.map(() => true);
    defeatedBosses[levels.length - 1] = false;
    const segment = makeSegment(number);
    segments = [segment];
    nextSegmentNumber = number + 1;
    return segment;
  };
  const jump = () => {
    setControl("jump", true);
    setControl("jump", false);
  };
  const drop = () => {
    setControl("down", true);
    setControl("down", false);
  };
  const advanceUntil = condition => {
    for (let i = 0; i < 250 && !condition(); i++) update(.03);
    check(condition(), "Die Spielfigur hat den erwarteten Weg nicht erreicht.");
  };
  try {
    appData = {
      words: ["eins", "zwei", "drei", "vier"].map((german, i) => ({
        id: String(i), german, english: `english ${i}`, right: 0, wrong: 0
      })),
      profiles: [{ name: "Test", stats: [] }], highscores: []
    };
    playerName = "Test";
    Math.random = () => .1;
    playSound = () => {};
    recordAnswer = () => {};
    speakEnglish = () => {};
    updateHud = () => {};
    showQuestion = () => {};

    worldLevel = 4;
    check(setup(0).answers.length === 2, "Vor Level 6 muss es zwei Wege geben.");
    worldLevel = 5;
    let segment = setup(0);
    check(segment.answers.length === 3 && new Set(segment.answers).size === 3,
      "Ab Level 6 müssen drei unterschiedliche Antworten möglich sein.");
    const allWords = appData.words;
    appData.words = allWords.slice(0, 2);
    check(setup(0).answers.length === 2, "Mit nur zwei Wörtern müssen zwei Wege spielbar bleiben.");
    appData.words = allWords.map(word => ({ ...word, german: "gleich" }));
    segment = setup(0);
    check(segment.answers.length === 3 && segment.answerLanguage === "Englische" && new Set(segment.answers).size === 3,
      "Bei gleichen deutschen Übersetzungen muss für drei Antworten Englisch gewählt werden.");
    appData.words = allWords;

    for (const points of [0, 1000]) {
      segment = setup(1);
      score = points;
      segment.correctAnswer = segment.answers[2];
      player.x = segment.base + 400;
      player.y = floorAt(player.x + player.width / 2) - player.height;
      player.vy = 0;
      player.grounded = true;
      jump();
      advanceUntil(() => player.grounded && Math.abs(player.y + player.height - bridgeHeight(segment)) < .01);
      jump();
      advanceUntil(() => segment.choice !== null);
      check(segment.choice === 2 && segment.correct, "Der oberste Weg muss auch bei doppeltem Tempo erreichbar sein.");
      advanceUntil(() => segment.resolved);
      check(score === points + 200 && lifeQuarters === 13, "Ein richtiger Drei-Wege-Lauf muss doppelte Punkte geben.");
    }

    segment = setup(1);
    player.x = segment.base + 500;
    player.y = bridgeHeight(segment) - upperGap - player.height;
    player.vy = 0;
    player.grounded = true;
    drop();
    advanceUntil(() => player.grounded && Math.abs(player.y + player.height - bridgeHeight(segment)) < .01);
    drop();
    advanceUntil(() => player.grounded && Math.abs(player.y + player.height - floorAt(player.x + player.width / 2)) < .01);
    check(segment.choice === null, "Der Abstieg muss vor der Entscheidung beide Ebenen erlauben.");

    segment = setup(0);
    index = 1;
    player.x = segment.base + 1245;
    ensureSegments();
    player.y = bridgeHeight(segment) - player.height;
    player.vy = 0;
    player.grounded = true;
    drop();
    check(!player.grounded, "Der Abstieg muss auch nach der Entscheidung auf der alten Brücke funktionieren.");

    for (const choice of [0, 1, 2]) {
      segment = setup(1);
      segment.upperHazard = "dog";
      segment.lowerHazard = "flame";
      segment.correctAnswer = segment.answers[(choice + 1) % 3];
      player.x = segment.base + 975;
      player.y = (choice === 1 ? floorAt(player.x + player.width / 2) :
        bridgeHeight(segment) - (choice === 2 ? upperGap : 0)) - player.height;
      player.vy = 0;
      player.grounded = true;
      advanceUntil(() => segment.choice !== null);
      check(segment.choice === choice && !segment.correct, "Jede Ebene muss ihrer eigenen Antwort entsprechen.");
      advanceUntil(() => segment.resolved);
      check(lifeQuarters === 8 && score === 0 && state === "hit",
        "Eine falsche Antwort auf jeder Ebene muss ein Leben kosten.");
    }

    worldLevel = 5;
    segment = setup(0);
    state = "boss";
    boss.active = true;
    boss.health = 5;
    boss.question = { ...segment, answers: ["a", "b", "c"], correctAnswer: "a" };
    resolveBossArrow(0);
    check(score === 200, "Ein richtiger Boss-Treffer mit drei Antworten muss doppelte Punkte geben.");
    return "Drei Wege und Bonuspunkte: alle Tests bestanden";
  } finally {
    appData = saved.appData;
    playerName = saved.playerName;
    worldLevel = saved.worldLevel;
    state = saved.state;
    score = saved.score;
    index = saved.index;
    correctCount = saved.correctCount;
    lifeQuarters = saved.lifeQuarters;
    speed = saved.speed;
    speedStartScore = saved.speedStartScore;
    speedEndScore = saved.speedEndScore;
    levelStartScore = saved.levelStartScore;
    slowdownRemaining = saved.slowdownRemaining;
    animationTime = saved.animationTime;
    recentWordIds = saved.recentWordIds;
    lastWordId = saved.lastWordId;
    segments = saved.segments;
    nextSegmentNumber = saved.nextSegmentNumber;
    defeatedBosses = saved.defeatedBosses;
    fallingSegment = saved.fallingSegment;
    impactHazard = saved.impactHazard;
    impactStarted = saved.impactStarted;
    impactY = saved.impactY;
    respawnStarted = saved.respawnStarted;
    Object.assign(player, saved.player);
    Object.assign(controls, saved.controls);
    Object.assign(boss, saved.boss);
    Math.random = saved.random;
    playSound = saved.playSound;
    recordAnswer = saved.recordAnswer;
    speakEnglish = saved.speakEnglish;
    updateHud = saved.updateHud;
    showQuestion = saved.showQuestion;
    toast.hidden = saved.toastHidden;
    toast.textContent = saved.toastText;
    toastTime = saved.toastTime;
    questionBubble.hidden = saved.questionHidden;
  }
}
