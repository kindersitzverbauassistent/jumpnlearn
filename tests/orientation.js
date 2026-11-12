"use strict";

function testOrientation() {
  const saved = {
    state, orientationPaused, player: { ...player }, controls: { ...controls },
    animationTime, slowdownRemaining, toastTime, levelToastTime, updateBoss,
    toastHidden: toast.hidden, levelToastHidden: levelToast.hidden,
    promptHidden: orientationPrompt.hidden, chanceHidden: lastChance.hidden,
    lastChancesRemaining, answer: lastChanceAnswer.value,
    matches: Object.getOwnPropertyDescriptor(portraitTouch, "matches")
  };
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const rotate = portrait => {
    Object.defineProperty(portraitTouch, "matches", { configurable: true, value: portrait });
    portraitTouch.dispatchEvent(new Event("change"));
  };
  try {
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
    lastChancesRemaining = 3;
    lastChanceAnswer.value = "test";
    lastChanceForm.requestSubmit();
    check(lastChancesRemaining === 3, "Im Hochformat darf keine Rettungsfrage beantwortet werden.");
    rotate(false);
    check(!orientationPaused && orientationPrompt.hidden && document.activeElement === lastChanceAnswer,
      "Im Querformat muss die Aufforderung verschwinden und die Eingabe wieder den Fokus erhalten.");
    state = "boss";
    update(.01);
    check(bossUpdates === 1, "Im Querformat muss der Bosskampf weiterlaufen.");
    state = "menu";
    rotate(true);
    check(orientationPrompt.hidden && !orientationPaused, "Das Menü muss im Hochformat nutzbar bleiben.");
    return "Querformat und Pause: alle Tests bestanden";
  } finally {
    if (saved.matches) Object.defineProperty(portraitTouch, "matches", saved.matches);
    else delete portraitTouch.matches;
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
  const rightBar = document.querySelector(".game-bottom").getBoundingClientRect();
  const activeControls = boss.active ? bossControls : runControls;
  const controlsBox = activeControls.getBoundingClientRect();
  const buttons = [...activeControls.querySelectorAll("button")];
  const availableWidth = innerWidth - status.width - rightBar.width - 2;
  const maxWidth = Math.min(availableWidth, (innerHeight - 2) * 1000 / 490);
  check(status.right <= area.left && area.right <= audio.left && area.right <= controlsBox.left,
    "Status und Steuerung müssen links und rechts neben dem Spielfeld stehen.");
  check(area.width >= maxWidth - 4 && area.top >= 0 && area.bottom <= innerHeight,
    "Das Spielfeld muss den verfügbaren Platz im Querformat ausschöpfen.");
  check(buttons.length === (boss.active ? 4 : 2) && audio.bottom <= controlsBox.top && buttons.every(button => {
    const rect = button.getBoundingClientRect();
    return rect.width >= 44 && rect.height >= 44 && rect.left >= 0 && rect.right <= innerWidth &&
      rect.top >= 0 && rect.bottom <= innerHeight;
  }), "Alle sichtbaren Tasten müssen erreichbar und mindestens 44 Pixel groß sein.");
  return "Mobiles Layout: alle Tests bestanden";
}
