Status: needs-triage
Type: fix
Blocked by: None

## Description

Der Versions-Bump schreibt die neue Version nur nach `package.json`. Die
Lockfile `package-lock.json` fuehrt die Version an zwei Stellen ebenfalls und
bleibt dabei stehen. Beide laufen ab dem ersten Bump auseinander und bleiben es,
bis irgendwann ein `npm install` die Lockfile stillschweigend korrigiert.

Beobachtet in dieser Sitzung: `package.json` stand auf `1.9.0`, die Lockfile auf
`1.8.2` — die Drift hatte also mindestens einen Minor- und einen Patch-Bump
ueberdauert. Sie fiel nur auf, weil ein `npm install` in einer frischen
Arbeitskopie die Lockfile veraenderte und damit eine ungewollte Aenderung in den
Arbeitsbaum brachte.

Zwei Folgen, beide unangenehm:

1. **Ungewollte Aenderungen im Arbeitsbaum.** Wer in einer frischen Arbeitskopie
   die Abhaengigkeiten installiert, bekommt eine geaenderte Lockfile, die nichts
   mit seiner Arbeit zu tun hat. Das verrauscht jeden Commit und jedes Review.
2. **Die Lockfile luegt ueber die Version des Pakets.** Sie ist die
   reproduzierbare Beschreibung des Abhaengigkeitsstands; ein falsches
   Versionsfeld darin ist ein Widerspruch zum Zweck der Datei.

Der eigentliche Abgleich der Versionsfelder ist auf diesem Branch bereits
erfolgt (ein Commit, nur die beiden Versionsfelder). Dieses Issue behebt die
Ursache, damit die Drift nicht beim naechsten Bump neu entsteht.

Beruehrt den in `CLAUDE.md` beschriebenen Release-Ablauf: der Bump vor dem Merge
eines `feature`/`fix`-Main-Issues muss danach beide Dateien in denselben Commit
bringen, sonst traegt der Squash-Merge weiter nur die halbe Wahrheit nach `main`.

## Acceptance Criteria
- [ ] Ein Versions-Bump aktualisiert die Version in `package.json` und in `package-lock.json` gemeinsam.
- [ ] Nach einem Bump veraendert ein Installieren der Abhaengigkeiten die Lockfile nicht mehr.
- [ ] Ein Test haelt fest, dass beide Dateien nach einem Bump dieselbe Version nennen.
- [ ] Die Beschreibung des Release-Ablaufs nennt beide Dateien, sofern sie heute nur eine nennt.

## Decisions
- `[po]` Gefunden, weil ein npm install eines Recherche-Subagenten package-lock.json von 1.8.2 auf die in package.json stehende 1.9.0 zog — eine ungewollte Aenderung im Arbeitsbaum. Quelle des Befunds: scripts/release.js erwaehnt package-lock.json nirgends. Der reine Abgleich der Versionsfelder ist auf diesem Branch als trivialer Change (eine Datei, .json) erledigt und vom Praedikat bestaetigt; dieses Issue traegt die Ursache. Neues Main-Issue auf needs-triage, weil es keinem Akzeptanzkriterium des laufenden Main-Issues 81 dient.

## Comments
