# Task Specification: Supabase Backend Integration (Vocabulary & Highscores)

## 1. Context & Goal
We already have a working browser game (*Franzo's Underwater Adventure*, hosted on GitHub Pages) built with Vanilla HTML/CSS/JS. 
Your task is to connect the existing game to **Supabase** so that:
1. Vocabulary pairs are loaded dynamically from a Supabase database (replacing or extending the existing hardcoded vocabulary list).
2. Global Top 10 Highscores are saved to and loaded from Supabase on the Start and Game-Over screens.

**Important Constraint:** Do NOT rewrite or alter the core gameplay, rendering, or physics. Only add the database layer and hook it into the existing vocabulary loading and Game-Over score logic.

## 2. Architecture & Files to Create/Modify
1. **Create `config.js`:**
   - Define `const SUPABASE_URL = "YOUR_SUPABASE_URL";` and `const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";`.
2. **Create `db.js`:**
   - Initialize the Supabase client using the global `supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)`.
   - Export/expose clean async helper functions on a global `window.GameDB` object:
     - `GameDB.fetchVocabulary()`: Fetches all rows (`de`, `en`, `category`) from the `vocabulary` table. If Supabase is offline or unconfigured (`YOUR_SUPABASE_URL`), gracefully fall back to the game's existing local vocabulary array.
     - `GameDB.fetchTopHighscores(limit = 10)`: Fetches the top 10 rows from `highscores` ordered by `score` descending.
     - `GameDB.submitHighscore(playerName, score)`: Validates input (non-empty string, max 12 chars, score > 0) and inserts `{ player_name: playerName, score: score }` into `highscores`.
3. **Modify `index.html`:**
   - Add the Supabase JS CDN script before `config.js`, `db.js`, and the main game script:
     `<script src="https://jsdelivr.net"></script>`
   - Add a Top 10 Global Leaderboard container (`<div id="leaderboard">`) to the Start and/or Game-Over overlay.
   - Add a player name input (`<input id="player-name" maxlength="12">`) and a "Save Score" button (`<button id="save-score-btn">`) to the Game-Over screen (prevent duplicate submissions per run).
4. **Modify existing `game.js` (minimal hooks only):**
   - On startup, await `GameDB.fetchVocabulary()` to populate the active vocabulary list before starting a round.
   - On Game Over, display the current leaderboard and wire up the "Save Score" button to call `GameDB.submitHighscore()` and refresh the leaderboard list.

## 3. Supabase Database Schema (Reference)
The tables are already set up in Supabase with public read (`SELECT`) and highscore insert (`INSERT`) RLS policies:
- Table `vocabulary`: `id` (int8), `de` (text), `en` (text), `category` (text)
- Table `highscores`: `id` (int8), `player_name` (text), `score` (int4), `created_at` (timestamptz)

## 4. Execution Instructions for the AI
1. First, inspect my existing `index.html` and JavaScript files to see how vocabulary arrays and Game-Over screens are currently structured.
2. Briefly explain your integration plan and list the exact lines you will change in my existing files.
3. Create `config.js` and `db.js`, and apply the minimal hooks to `index.html`, `style.css`, and `game.js`.
