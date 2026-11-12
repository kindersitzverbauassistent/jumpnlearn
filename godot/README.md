# Wortwelten 2.5D – Prototyp

Dies ist eine eigenständige Godot-4.3-Version als früher Prototyp, keine vollständige Übertragung der Browser-Version. Die Browser-Version bleibt unverändert.

Der Prototyp enthält gemeinsame Vokabeln, lokale Spielerprofile, einfache CSV-Importe, persönliche Lernstatistik und Highscores, drei Level und Bosskämpfe. Die Spielfigur läuft über ansteigendes und abfallendes Gelände und kann für die obere Antwort auf eine Brücke springen oder für die untere Antwort unten bleiben. Die Brücke folgt dem Gelände und lässt darunter Platz für die Figur; ihre Sprunghöhe ist darauf abgestimmt. Erst nach der Wegwahl werden die Fallen sichtbar. Eine falsche Antwort löst die jeweilige Falle aus und kostet ein Leben; danach geht der Lauf weiter. Die zwölf Fallen der Browser-Version sind als vereinfachte 3D-Modelle und Animationen umgesetzt. Gespeichert wird getrennt von den Browserdaten in Godots Benutzerverzeichnis (`%APPDATA%\Godot\app_userdata\Wortwelten 2.5D`). Die vorhandenen Browserprofile werden nicht automatisch übernommen.

Steuerung: Im Lauf mit Leertaste oder Pfeil hoch auf die Brücke springen, mit Pfeil runter vor der Entscheidung wieder hinunter. Die Wahl erfolgt am Schild; danach bleibt sie bis zur Falle gesperrt. Im Bosskampf mit Pfeil links/rechts bewegen, mit Pfeil hoch springen und mit Leertaste geradeaus schießen.

Noch nicht übernommen sind die Vokabelbearbeitung und detaillierte Statistikansicht, Musik, Soundeffekte und Sprachausgabe sowie der vollständige CSV-Import mit Anführungszeichen. Die 3D-Grafik verwendet stilisierte, prozedural erzeugte Modelle und Animationen.

Zum Bauen Godot 4.3 mit Windows-Exportvorlagen installieren, das Projekt in diesem Verzeichnis öffnen und das Exportprofil „Windows“ verwenden.

Die Regressionstests laufen im Projektverzeichnis mit `godot --path . --script res://tests/visual_regression.gd` und `godot --path . --script res://tests/terrain_traps.gd`. Für Tests ein separates `APPDATA`-Verzeichnis verwenden, damit die normalen Spielerdaten unangetastet bleiben.
