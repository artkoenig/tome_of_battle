# UI-Verfügbarkeit im Aushebe-Dialog leitet sich aus dem Validator ab

- **Status:** Accepted
- **Datum:** 2026-07-20
- **Beteiligte:** Chronist des Folianten
- **Zugehörige ADRs (falls vorhanden):** Ergänzt ADR-0003 (Battlescribe Domain Rules) und ADR-0005 (React Lifecycle and Performance)

## Kontext und Problemstellung

Der Aushebe-Dialog (`CategoryUnitAdder`) entscheidet pro Katalog-Eintrag, ob er
legal gewählt werden kann. Bisher tat er das über eine **eigene, nachgebaute
Teilprüfung**: er betrachtete genau **einen** `max`-Constraint des Eintrags
(Scope `roster`/`force`/`undefined`). Diese Nachbildung ignorierte alles andere,
was der echte Validator (`validateRoster`) prüft — ein zweites `max`,
`parent`/`self`/`category`-scoped Constraints, Prozent-Limits, die
Kategorie-Obergrenze der Force sowie **alle** Autoren-`error`-Meldungen (z. B.
„nur mit aktiver experimenteller Regel wählbar", Muster *Emperor Fire Dragon*).

Folge: Ein nicht legal wählbarer Eintrag erschien im Dialog normal wählbar; erst
**nach** dem Ausheben meldete die nachgelagerte Validierung den Verstoß. Die
UI-Prüfung driftete strukturell gegen den Validator — die Nachbildung war eine
zweite Wahrheitsquelle für dieselbe Frage.

## Entscheidungsfaktoren (Drivers)

- **Single Source of Truth (SSOT):** „Im Dialog wählbar" muss verlässlich „nach
  dem Ausheben legal" bedeuten. Zwei parallele Regel-Implementierungen können das
  nicht garantieren.
- **System-Agnostik (ADR-0003):** Keine armeespezifische Sonderlogik im UI.
- **Wartbarkeit:** Neue/erweiterte Constraint-Klassen im Validator sollen ohne
  Nachziehen einer zweiten UI-Logik automatisch wirken.
- **Performance (ADR-0005):** Der Validator läuft über das gesamte Roster; eine
  naive Auswertung pro Kandidat darf den Dialog nicht spürbar verlangsamen.

## Betrachtete Optionen

- **Option 1 — UI-Nachbildung erweitern:** die im Dialog nachgebaute Prüfung um
  die fehlenden Constraint-Klassen ergänzen.
- **Option 2 — Verfügbarkeit = Validator-Diff:** den Kandidaten hypothetisch in
  die Ziel-Force hinzudenken, `validateRoster` ausführen und das Ergebnis gegen
  die Baseline (Validierung ohne den Kandidaten) diffen.

## Entscheidungsergebnis

Gewählte Option: **Option 2 (Verfügbarkeit = Validator-Diff)**, weil sie die
Verfügbarkeit aus derselben Quelle ableitet, die nach dem Ausheben ohnehin
urteilt, und damit Drift strukturell ausschließt. Option 1 würde die
Doppel-Implementierung — die eigentliche Ursache — nur vergrößern.

Umsetzung (reine Solver-Funktion `getEntryAddAvailability`):

- **Hypothetisches Hinzufügen über die geteilte Selektions-Fabrik:** eine immutable
  Roster-Kopie erhält in der Ziel-Force eine synthetische Selektion, die über
  **dieselbe reine Fabrik** (`selectionFactory.createSelectionFromDef`) gebaut wird,
  die auch das echte `useRoster.addUnit` nutzt (SSOT). Sie erzeugt nicht nur die
  Top-Selektion (`entryLinkId`/`selectionEntryId`, `number: 1`, Kategorie-Zuordnung),
  sondern bevölkert **alle Pflicht-Kinder** (`min > 0`, inkl. Default-Gruppenwahl)
  rekursiv — genau wie beim echten Ausheben. Damit schlägt limit-sprengende
  Pflicht-Ausrüstung (Kosten/Anzahl der Pflicht-Kinder) schon in der Verfügbarkeit an,
  statt erst nach dem Ausheben; ein handnachgebautes `selections: []` würde diese
  Verstöße übersehen. Die Fabrik erhält `system` und `resolveEntry` per Dependency
  Injection (kein Closure über Hook-State) und bleibt so eine reine, testbare Einheit.
  Die stabile synthetische Top-ID wird **nach** dem Fabrik-Aufruf vergeben (die Fabrik
  verteilt frische UUIDs, die nie in der Baseline vorkommen), damit der Diff-Schlüssel
  deterministisch und kollisionsfrei bleibt.
- **Baseline-Diff:** die Baseline (`validateRoster` ohne Kandidat) wird **einmal
  pro Dialog-Öffnung** berechnet; pro Kandidat läuft nur die hypothetische
  Validierung. Verglichen wird über einen **stabilen Verstoß-Schlüssel** aus
  `type` + `selectionId`/`categoryId`/`forceId` — **nicht** über die
  count-behaftete `message`, damit eine bloße Zähler-Änderung an einem schon
  vorhandenen Verstoß nicht fälschlich als „neu eingeführt" gilt.
- **Validator-eigene Sperr-Klassifikation:** ob ein Verstoß die Aushebe-Verfügbarkeit
  sperrt, entscheidet der **Validator selbst**, nicht der Dialog über eine
  Typ-Namenskonvention. `rosterValidator.js` hält dafür **eine einzige autoritative
  Tabelle** (`VIOLATION_BLOCKS_ADD_AVAILABILITY`: `type → boolean`) und stempelt über
  einen zentralen Erzeugungspunkt (`pushViolation`) **jeden** erzeugten Verstoß mit
  einem expliziten `blocksAddAvailability`-Flag. Sperrend (`true`) sind die
  Obergrenzen-/„nicht erlaubt"-Klassen — `entry-max`, `entry-percent-max`,
  `category-max`, `group-count-max`, `group-points-max`, `group-percent-max` sowie der
  Autoren-`modifier-error`. Nicht sperrend (`false`, normaler unfertiger Bauzustand)
  sind `roster-limit`, `force-roster-limit`, alle `*-min`, `force-selector-min`,
  `unresolved-entry` sowie `modifier-warning`/`modifier-info`. Ein eingeführter Verstoß
  sperrt genau dann, wenn sein Schweregrad `error` ist (deckungsgleich mit
  `hasBlockingViolations`) **und** sein `blocksAddAvailability` `true` ist —
  `entryAvailability.js` liest ausschließlich dieses Flag, nie mehr den `-max`-Suffix.
  Ein neu eingeführter, unklassifizierter `type` lässt `classifyBlocksAddAvailability`
  **werfen** (und einen Driftschutz-Test fehlschlagen), sodass keine neue Verstoßart
  stillschweigend als „nicht sperrend" durchrutscht.
- **Grund-Anzeige:** die (deduplizierten) `message`-Texte der sperrenden Verstöße;
  bei `modifier-error` ist das der wortgetreue Autoren-`value`, ohne
  Übersetzungs-/Parsing-Schicht.

Der frühere `isMaxedOut`-Einzelpfad im Dialog entfällt; die Verfügbarkeit hat
danach genau einen Codepfad.

### Konsequenzen (Auswirkungen)

- **Positiv:** „Wählbar" und „legal nach dem Ausheben" fallen garantiert
  zusammen. Neue Constraint-Klassen wirken automatisch im Dialog. Keine
  armeespezifische Sonderlogik im UI.
- **Negativ:** Rechenaufwand steigt — pro angebotenem Kandidaten läuft eine
  vollständige Roster-Validierung. Abgefedert durch die einmalige Baseline pro
  Dialog und die Memoisierung an Roster/System; bei sehr großen Rostern bleibt
  dies der bewusst in Kauf genommene Trade-off zugunsten der SSOT.
- **Neutral:** Der Dialog kennt keine Constraint-Semantik mehr selbst; er fragt
  ausschließlich den Solver-Seam. Das Roster-/Katalog-Schema bleibt unverändert.

## Vor- und Nachteile der Optionen

### Option 1 — UI-Nachbildung erweitern

- **Gut, weil** kein zusätzlicher Validierungslauf pro Kandidat nötig ist.
- **Schlecht, weil** sie die doppelte Wahrheitsquelle zementiert und bei jeder
  künftigen Constraint-Änderung erneut driftet — genau der behobene Fehler.

### Option 2 — Verfügbarkeit = Validator-Diff

- **Gut, weil** eine einzige Regel-Engine über Wählbarkeit und nachgelagerte
  Validierung urteilt (SSOT), system-agnostisch und ohne Drift.
- **Schlecht, weil** sie pro Kandidat einen vollständigen Validierungslauf kostet;
  akzeptiert als bewusster Rechenaufwand-↔-Korrektheit-Trade-off.
