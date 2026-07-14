Status: resolved
Blocked by: None

## Description

**Typ:** Bug (Validierung / Modifier-Auswertung).

**Aktuelles Verhalten:** Beim Import der Armee „Blood Dragons mit 2x Black Knights"
(Vampire Counts) meldet die Validierung fälschlich:

> `entry-max: Option "Shield (Blood dragons only)" erlaubt maximal 0 Auswahlen (aktuell: 1).`

**Erwartetes Verhalten:** Der Schild ist für einen Blood-Dragon-Bloodline-Vampir
legal (aktuell 1 gewählt). Es darf kein Fehler erscheinen; die Punktesumme ist
bereits korrekt (2000).

**Beobachtung / Ausgangspunkt der Analyse:**
- Der Katalogeintrag `Shield (Blood dragons only)` (`a8c1-8998-1a95-8358`, Vampire
  Counts) trägt selbst einen Constraint `max=1` (scope=parent), **nicht** `max=0`.
- Die Validierung berechnet dennoch ein effektives Limit von 0. Vermutlich wird
  entweder ein bloodline-abhängiger Modifier (der das Limit für die passende
  Bloodline von 0 auf 1 hebt) nicht ausgewertet, oder es wird die falsche
  Constraint-/Entry-Instanz einer der mehreren „Weapons for Carstein and
  Blooddragons"-Gruppen herangezogen.
- Domäne: Modifier-/Condition-Auswertung (siehe ADR-0003). **Nicht** kostenbezogen —
  unabhängig vom Referenz-Modell-/Kosten-Umbau.

**Reproduktion:** Fixture `src/utils/__fixtures__/blood-dragons.ros` gegen den echten
WHFB6-Katalog (`public/catalogs/whfb6`, `Vampire Counts.cat`) importieren und
`validateRoster` ausführen (vgl. `src/utils/rosterSerialization.integration.test.js`,
das den Fehler-Count aktuell als bekannten Stand toleriert).

## Acceptance Criteria
- [ ] Import der Fixture „Blood Dragons" ergibt **0** Validierungsfehler.
- [ ] Root Cause identifiziert (fehlender/nicht feuernder Bloodline-Modifier vs.
      falsche Constraint-Instanz) und generisch behoben — keine armeespezifische
      Sonderlogik (ADR-0003).
- [ ] Regressionstest deckt das effektive Limit dieser bloodline-gated Option ab.
- [ ] Kein anderer Katalog/keine andere Armee regressiert (volle Suite grün).

## Comments
- Root Cause: Die Roster-Auswahl löst auf die Shield-Instanz 7081-eb7b-5ea8-9b26 auf (Basis-Constraint max=0). Ein set-Modifier hebt dieses Limit auf 1, wenn die Modifier-Bedingung 'field=selections scope=parent childId=4cae-a20e-8374-b6cb (Kategorie Blood Dragon) greaterThan 0' feuert. Die Bedingungs-Auswertung (evaluateCondition/countMatches in modifierEvaluator.js) verglich beim feld-basierten Parent-Scope-Zaehlen jedoch nur Entry-/Target-IDs und ignorierte Kategorie-Zugehoerigkeit ueber categoryLinks. Die Blood-Dragon-Bloodline-Auswahl (Entry 60a4) traegt die Kategorie 4cae per categoryLink, matchte aber nie -> count 0 -> Modifier feuerte nicht -> effektives Limit blieb 0.

Fix (generisch, ADR-0003-konform): In countMatches wird nun auch Kategorie-Mitgliedschaft beruecksichtigt (neuer Helper entryHasCategoryLink, DRY mit selectionHasCategory). Keine armeespezifische Sonderlogik.

Tests: (1) Unit-Test 21c in validator.test.js deckt das effektive Limit (0 ohne, 1 mit vorhandener Kategorie) direkt ab. (2) E2E-Regressionstest in rosterSerialization.integration.test.js: Blood-Dragons-Fixture validiert mit 0 Fehlern. Volle Suite gruen (244 passed). Zusaetzlich einen vorbestehenden flaky async-Test in App.test.jsx (globaler Click-Handler) mit waitFor gehaertet, den die neuen E2E-Tests unter CPU-Last offengelegt hatten.
