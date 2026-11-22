# Projekt-Spezifikation: [Franzos Unterwasserabenteuer]

## 1. Konzept & Ziel
- **Genre:sidecroller und vokalbeltrainer** [z. B. Endless Runner, Top-Down Shooter, Puzzle, Clicker]
- **Spielziel:in einem Unterwasserlabyrint mit einem Uboot navigieren und höhlenwänden und unterwassertieren ausweichen, es gibt bonuspunte und extraleben beim Einsammeln von fischen. Fische sollen mit vokablen beschriftet sein, wenn man den fisch mit der richtigen vokabel einsammelt gibt es punkte und leben:** [Was muss der Spieler tun, um zu gewinnen oder Punkte zu sammeln?]
- **Game-Over-Bedingung:keine leben mehr, letzte chance mechanik mit vokalbelabfrage** [Wann verliert der Spieler?]

## 2. Tech-Stack & Architektur
- **html** Reines HTML5 (`<canvas>`), CSS3 und Vanilla JavaScript (ES6+). Keine externen Frameworks oder Bundler.
- **Dateistruktur:**
  - `index.html` (Canvas-Container, UI-Overlays für Start/Game Over)
  - `style.css` (Zentriertes Layout, dunkler Hintergrund, Retro-Font)
  - `game.js` (Game-Loop mit `requestAnimationFrame`, Spiellogik, Kollisionsabfrage)
- **Grafik-Stil: retrogaming, xenon2 stil** [z. B. Minimalistische geometrische Formen mit Neon-Farben / Pixel-Art via Canvas-Zeichnung – keine externen Bilddateien nötig]

## 3. Spielmechanik & Steuerung
- **Steuerung:Pfeiltasten / WASD zum Bewegen, topedes mit maus abfeuern** [z. B. Pfeiltasten / WASD zum Bewegen, Leertaste zum Springen/Schießen]
- **Spieler-Eigenschaften:** [z. B. Geschwindigkeit, Lebenspunkte, Hitbox]
- **Gegener schwimmen ein** [Wie spawnen sie? Wie bewegen sie sich? Wird das Spiel mit der Zeit schneller?]

## 4. UI & Audio
- **HUD Aktueller Punktestand (oben links), Highscore aus `localStorage` (oben rechts)** Aktueller Punktestand (oben links), Highscore aus `localStorage` (oben rechts).
- **Screens:Startbildschirm mit "Start"-Button, Game-Over-Screen mit Endpunktzahl und "Neustart"-Button.** Startbildschirm mit "Start"-Button, Game-Over-Screen mit Endpunktzahl und "Neustart"-Button.
- **Sound:Einfache Retro-Soundeffekte über die Web Audio API** Einfache Retro-Soundeffekte über die Web Audio API (keine externen MP3s).

## 5. Entwicklungs-Schritte (Anweisung an die KI)
Bitte setze das Projekt schrittweise um:
1. Erstelle `index.html` und `style.css` für das Grundgerüst.
2. Implementiere in `game.js` den Canvas, den Game-Loop und die Spielersteuerung.
3. Füge Hindernisse, Kollisionserkennung und das Punktesystem hinzu.
4. Ergänze Start-/Game-Over-Screens und Web-Audio-Sounds.
