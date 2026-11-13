"use strict";

function testOrientation() {
  const saved = {
    state, orientationPaused, player: { ...player }, controls: { ...controls },
    animationTime, slowdownRemaining, toastTime, levelToastTime, updateBoss,
    toastHidden: toast.hidden, levelToastHidden: levelToast.hidden,
    promptHidden: orientationPrompt.hidden, chanceHidden: lastChance.hidden,
    lastChancesRemaining, answer: lastChanceAnswer.value,
    description: orientationDescription.textContent,
    matches: Object.getOwnPropertyDescriptor(portraitTouch, "matches"),
    coarseMatches: Object.getOwnPropertyDescriptor(coarseTouch, "matches")
  };
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const rotate = portrait => {
    Object.defineProperty(portraitTouch, "matches", { configurable: true, value: portrait });
    portraitTouch.dispatchEvent(new Event("change"));
  };
  try {
    Object.defineProperty(coarseTouch, "matches", { configurable: true, value: true });
    state = "running";
    orientationPaused = false;
    controls.jump = true;
    controls.right = true;
    slowdownRemaining = 3;
    const x = player.x;
    const time = animationTime;
    rotate(true);
    check(orientationPaused && !orientationPrompt.hidden && Object.values(controls).every(value => !value),
      "Im Hochformat muss die Drehaufforderung erscheinen und die Steuerung losgelassen werden.");
    setControl("jump", true);
    update(1);
    check(player.x === x && animationTime === time && slowdownRemaining === 3 && !controls.jump,
      "Im Hochformat müssen Bewegung, Steuerung und Timer pausieren.");
    let bossUpdates = 0;
    updateBoss = () => { bossUpdates++; };
    state = "boss";
    update(1);
    check(bossUpdates === 0, "Auch der Bosskampf muss im Hochformat pausieren.");

    state = "lastChance";
    lastChance.hidden = false;
    updateOrientation();
    check(!orientationPaused && orientationPrompt.hidden && document.activeElement === lastChance,
      "Die letzte Chance muss im Hochformat ohne automatische Tastatur nutzbar sein.");
    rotate(false);
    check(orientationPaused && !orientationPrompt.hidden && orientationDescription.textContent.includes("Hochformat"),
      "Die letzte Chance muss im Querformat zum Hochformat auffordern.");
    lastChancesRemaining = 3;
    lastChanceAnswer.value = "test";
    lastChanceForm.requestSubmit();
    check(lastChancesRemaining === 3, "Im Querformat darf keine Rettungsfrage beantwortet werden.");
    rotate(true);
    check(!orientationPaused && orientationPrompt.hidden, "Im Hochformat muss die Rettungsfrage freigegeben werden.");
    state = "boss";
    updateOrientation();
    check(orientationPaused && orientationDescription.textContent.includes("Querformat"),
      "Nach der Rettung muss das Spiel erneut auf das Querformat warten.");
    rotate(false);
    update(.01);
    check(bossUpdates === 1, "Im Querformat muss der Bosskampf weiterlaufen.");
    Object.defineProperty(coarseTouch, "matches", { configurable: true, value: false });
    state = "lastChance";
    updateOrientation();
    check(!orientationPaused, "Auf dem Desktop darf die letzte Chance nicht von der Ausrichtung abhängen.");
    state = "menu";
    rotate(true);
    check(orientationPrompt.hidden && !orientationPaused, "Das Menü muss im Hochformat nutzbar bleiben.");
    return "Querformat und Pause: alle Tests bestanden";
  } finally {
    if (saved.matches) Object.defineProperty(portraitTouch, "matches", saved.matches);
    else delete portraitTouch.matches;
    if (saved.coarseMatches) Object.defineProperty(coarseTouch, "matches", saved.coarseMatches);
    else delete coarseTouch.matches;
    state = saved.state;
    orientationPaused = saved.orientationPaused;
    Object.assign(player, saved.player);
    Object.assign(controls, saved.controls);
    animationTime = saved.animationTime;
    slowdownRemaining = saved.slowdownRemaining;
    toastTime = saved.toastTime;
    levelToastTime = saved.levelToastTime;
    toast.hidden = saved.toastHidden;
    levelToast.hidden = saved.levelToastHidden;
    updateBoss = saved.updateBoss;
    orientationPrompt.hidden = saved.promptHidden;
    orientationDescription.textContent = saved.description;
    lastChance.hidden = saved.chanceHidden;
    lastChancesRemaining = saved.lastChancesRemaining;
    lastChanceAnswer.value = saved.answer;
  }
}

function testMobileLayout() {
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  check(matchMedia("(orientation: landscape) and (pointer: coarse) and (max-height: 600px)").matches &&
    document.body.classList.contains("playing") && !gameShell.hidden,
    "Diesen Test während eines Spiels im mobilen Querformat ausführen.");
  const status = document.querySelector(".game-top").getBoundingClientRect();
  const audio = document.querySelector(".audio-controls").getBoundingClientRect();
  const area = canvas.getBoundingClientRect();
  const leftBar = document.querySelector(".below-game").getBoundingClientRect();
  const activeControls = boss.active ? bossControls : runControls;
  const controlsBox = activeControls.getBoundingClientRect();
  const buttons = [...activeControls.querySelectorAll("button")];
  const availableWidth = innerWidth - leftBar.width - status.width - 2;
  const maxWidth = Math.min(availableWidth, (innerHeight - 2) * 1000 / 490);
  check(controlsBox.right <= area.left && area.right <= status.left && area.right <= audio.left &&
    status.bottom <= audio.top, "Die Steuerung muss links, Status und Audio rechts stehen.");
  check(area.width >= maxWidth - 4 && area.top >= 0 && area.bottom <= innerHeight,
    "Das Spielfeld muss den verfügbaren Platz im Querformat ausschöpfen.");
  check(buttons.length === (boss.active ? 4 : 2) && buttons.every(button => {
    const rect = button.getBoundingClientRect();
    return rect.width >= 44 && rect.height >= 44 && rect.left >= 0 && rect.right <= innerWidth &&
      rect.top >= 0 && rect.bottom <= innerHeight;
  }), "Alle sichtbaren Tasten müssen erreichbar und mindestens 44 Pixel groß sein.");
  const jump = activeControls.querySelector('[data-control="jump"]').getBoundingClientRect();
  if (boss.active) {
    const left = activeControls.querySelector('[data-control="left"]').getBoundingClientRect();
    const right = activeControls.querySelector('[data-control="right"]').getBoundingClientRect();
    check(jump.bottom <= left.top && left.right <= right.left && left.top === right.top,
      "Die Bosssteuerung muss wie ein Steuerkreuz angeordnet sein.");
  } else {
    const down = activeControls.querySelector('[data-control="down"]').getBoundingClientRect();
    check(jump.bottom <= down.top, "Springen muss über Hinunter angeordnet sein.");
  }
  return "Mobiles Layout: alle Tests bestanden";
}
