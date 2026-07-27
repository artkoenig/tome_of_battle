Status: needs-triage
Type: fix
Blocked by: None

## Description

Die Anwendung und die neue Auswertungs-Engine beschreiben das Kostenbudget eines
Rosters unterschiedlich. Das ist kein Schoenheitsfehler, sondern eine Naht, die
beim Cutover auf die neue Engine bricht.

**Die Engine erwartet eine Zuordnung Kostenart → Grenzwert**, also beliebig viele
Grenzen nebeneinander: `src/evaluator/evaluator.js:82` dokumentiert
`costLimits: Array<{ costTypeId, value }>`, und `evaluator.js:97` baut daraus das
Budget. Das entspricht dem Datenformat, das einen `<costLimits>`-Block mit
mehreren Eintraegen kennt.

**Die Anwendung fuehrt genau eine Grenze**, zerlegt in zwei nebeneinander
liegende Einzelwerte: `roster.costLimit` (Zahl) und `roster.costLimitType`
(Kostenart-Id), angelegt in `src/utils/createRoster.js:33-34`. Beim Schreiben
entsteht daraus ein einzelnes `<costLimit>`-Element
(`src/utils/rosterSerialization.js:100-106`) — ein Roster mit zwei Kostenarten
verliert die zweite Grenze.

Die beiden Werte gehoeren fachlich zusammen, reisen ueberall gemeinsam und werden
nie getrennt benutzt. Sie sind ein Begriff, der als zwei Grundwerte gefuehrt wird.
Der davon abgeleitete Ausdruck fuer die aktuellen Punkte ist ausserdem in vier
Oberflaechen-Dateien wortgleich wiederholt statt einmal hergeleitet
(`RosterEditor.jsx:68-69`, `RosterDashboard.jsx:165,202`,
`editor/RosterSidebar.jsx:89`, `editor/UnitSelectionCard.jsx:198`).

Gefunden bei der Standards-Pruefung zu Main-Issue 79.

## Acceptance Criteria
- [ ] Das Kostenbudget eines Rosters ist ein Begriff, nicht zwei nebeneinander gefuehrte Grundwerte.
- [ ] Ein Roster kann eine Grenze je Kostenart tragen; beim Schreiben und Lesen geht keine davon verloren.
- [ ] Die Form, die die Anwendung fuehrt, ist die, die die Auswertungs-Engine erwartet — der Cutover braucht dafuer keinen Uebersetzer.
- [ ] Die Herleitung der aktuellen Punkte steht an einer Stelle, nicht in vier Oberflaechen-Dateien wiederholt.
- [ ] Bestehende gespeicherte Roster bleiben lesbar.
- [ ] Die Testsuite bleibt gruen; jede geaenderte Erwartung ist einzeln begruendet.

## Comments
- Belegt bei der PO-Sichtung: evaluator.js:82 dokumentiert costLimits als Array<{costTypeId, value}>, createRoster.js:33-34 legt costLimit/costLimitType als zwei Einzelwerte an, rosterSerialization.js:100-106 schreibt genau ein <costLimit>-Element.
- Beruehrt Issue 84 (fehlende Standard-Kostengrenze wird als null statt als unbegrenzt gelesen): beide betreffen die Frage, wie eine Kostengrenze entsteht und was ihr Fehlen bedeutet. Wer beide anfasst, sollte sie zusammen betrachten.
