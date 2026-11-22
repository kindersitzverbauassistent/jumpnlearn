# Project Specification: Franzo's Underwater Adventure

## 1. Concept & Goal
- **Genre:Side-scroller and vocabulary trainer.** 
- **Game Objective:*Navigate a submarine through an underwater labyrinth while avoiding cave walls and hostile sea creatures. Collect fish labeled with vocabulary words; collecting the fish with the correct vocabulary translation awards bonus points and extra lives.* 
- **Game-Over Condition:Running out of lives, featuring a "Last Chance" mechanic triggered via a final vocabulary quiz.** 

## 2. Tech Stack & Architecture
- **Technologies:** Pure HTML5 (`<canvas>`), CSS3, and Vanilla JavaScript (ES6+). No external frameworks or bundlers.
- **File Structure:**
  - `index.html` (Canvas container, UI overlays for Start / Game Over / Last Chance quiz)
  - `style.css` (Centered layout, dark background, retro font)
  - `game.js` (Game loop using `requestAnimationFrame`, game logic, collision detection, vocabulary logic)
- **Art Style:** Retro gaming, inspired by *Xenon 2* (pixel-art / detailed 16-bit style drawn via Canvas — no external image files required).

## 3. Gameplay Mechanics & Controls
- **Controls:** Arrow keys / WASD to move the submarine; fire torpedoes using the mouse (click to shoot).
- **Player Properties:** Submarine with defined movement speed, lives/health points, and a hitbox.
- **Enemies & Obstacles:** Underwater cave walls as labyrinth boundaries; enemies swim into the screen from the right.

## 4. UI & Audio
- **HUD (in-game):** Current score (top left), Highscore saved via `localStorage` (top right), plus current target vocabulary prompt and remaining lives.
- **Screens:** Start screen with a "Start" button, "Last Chance" vocabulary prompt overlay, and Game-Over screen displaying the final score and a "Restart" button.
- **Audio:** Simple retro sound effects generated via the Web Audio API (no external MP3 files).

## 5. Development Steps (Instructions for the AI)
Please implement the project step-by-step:
1. Create `index.html` and `style.css` for the basic structure.
2. Implement the canvas, game loop, and submarine controls (including torpedo firing) in `game.js`.
3. Add cave walls, swimming enemies, vocabulary-labeled fish, collision detection, and the scoring/lives system.
4. Add Start, Last Chance, and Game-Over screens along with Web Audio API sound effects.
