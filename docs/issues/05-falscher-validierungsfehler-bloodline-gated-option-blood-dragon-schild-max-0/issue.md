Status: needs-triage
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
