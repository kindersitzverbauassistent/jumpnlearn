"use strict";

function testBossAim() {
  const saved = {
    state, boss: { ...boss }, controls: { ...controls }, playSound, startMusicOnInteraction, resolveBossArrow,
    shellHidden: document.getElementById("game-shell").hidden,
    toastHidden: toast.hidden, toastText: toast.textContent, toastTime
  };
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  try {
    document.getElementById("game-shell").hidden = false;
    state = "boss";
    boss.playerX = 120;
    boss.playerY = 390;
    boss.playerVy = 0;
    boss.question = { answers: ["eins", "zwei", "drei"] };
    boss.fireballs = [];
    boss.nextFire = Infinity;
    boss.arrow = null;
    boss.aim = null;
    playSound = () => {};
    startMusicOnInteraction = () => {};
    let hit = -1;
    resolveBossArrow = target => { hit = target; };
    const rect = canvas.getBoundingClientRect();
    const pointer = (type, x, y, button = 0, pointerType = "mouse", isPrimary = true) => {
      canvas.dispatchEvent(new PointerEvent(type, {
        bubbles: true, isPrimary, button, pointerType,
        clientX: rect.left + x * rect.width / canvas.width,
        clientY: rect.top + y * rect.height / canvas.height
      }));
    };
    for (let i = 0; i < 3; i++) {
      hit = -1;
      pointer("pointermove", 790, bossShieldY(i) + 24);
      check(Math.abs(boss.aim.x - 790) < .01, "Mauskoordinaten müssen zur Canvas-Skalierung passen.");
      pointer("pointerdown", 790, bossShieldY(i) + 24);
      check(boss.arrow && boss.arrow.vx > 0, "Linksklick muss einen Pfeil abfeuern.");
      updateBoss(1);
      check(hit === i && boss.arrow === null, "Der Pfeil muss das anvisierte Schild treffen.");
    }
    hit = -1;
    pointer("pointerdown", 790, bossShieldY(0) + 24, 2);
    check(boss.arrow === null, "Rechtsklick darf nicht schießen.");
    pointer("pointerdown", 790, 100);
    updateBoss(1);
    check(hit === -1 && boss.arrow === null, "Ein Fehlschuss darf kein Schild treffen.");
    pointer("pointerdown", 790, bossShieldY(1) + 24, 0, "touch");
    updateBoss(1);
    check(hit === 1, "Ein Tippen auf dem Touchscreen muss zielen und schießen.");
    hit = -1;
    pointer("pointerdown", 790, bossShieldY(2) + 24, 0, "touch", false);
    updateBoss(1);
    check(hit === 2, "Auch ein zweiter Finger muss beim gleichzeitigen Bewegen schießen können.");
    check(arrowShieldIntersection(700, 190, 200, 100, 201) !== null,
      "Auch ein großer Bewegungsschritt muss einen Schildtreffer erkennen.");
    boss.playerY = 390;
    boss.playerVy = 0;
    controls.jump = false;
    window.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    window.dispatchEvent(new KeyboardEvent("keyup", { key: " ", bubbles: true }));
    check(boss.playerVy < 0 && boss.arrow === null, "Leertaste muss im Bosskampf springen statt schießen.");
    return "Bosssteuerung: alle Tests bestanden";
  } finally {
    state = saved.state;
    Object.assign(boss, saved.boss);
    Object.assign(controls, saved.controls);
    playSound = saved.playSound;
    startMusicOnInteraction = saved.startMusicOnInteraction;
    resolveBossArrow = saved.resolveBossArrow;
    document.getElementById("game-shell").hidden = saved.shellHidden;
    toast.hidden = saved.toastHidden;
    toast.textContent = saved.toastText;
    toastTime = saved.toastTime;
  }
}
