Status: ready-for-agent
Type: refactor
Blocked by: None

## Description

# PRD: Evaluator wertet die eingestellte Roster-Punktgrenze aus

## Problem Statement / Bug Description

Der Reinraum-Evaluator (`src/evaluator/`, künftige Produktiv-Engine laut ADR 0030)
berücksichtigt die eingestellte Punktgrenze der Armee nicht. In den
BattleScribe-Daten steuert diese Grenze über das Feld `limit::<costTypeId>`
(Bezugsrahmen `roster`) reale Bedingungen und Modifikatoren: z. B. wird die
Kategorie „Lord" unter 2000 Punkten ausgeblendet, und die erlaubte Zahl an
Lords/Core/Special skaliert je 1000-Punkte-Stufe; bestimmte Sonderheere werden
erst ab einem Mindestbudget wählbar.

Beobachtet: Die Engine kennt `limit::<costTypeId>` nicht als eigene
Bezugsgröße und behandelt es wie eine gewöhnliche Kostenart, deren verplante
Summe sie nachschlägt — die es nie gibt. Jede solche Bedingung wertet damit
still zu 0. Folge: die budget-abhängige Auswahl ist durchgehend falsch (der Lord
bleibt z. B. bei jeder Punktzahl ausgeblendet, weil „unter 2000" immer auf 0
zutrifft).

Erwartet (Domänensicht): Die gewählte Punktgrenze der Armee fließt in die
Auswertung ein, sodass budget-gesteuerte Sichtbarkeit, Mindest-/Höchstzahlen und
Verfügbarkeiten sich mit der gewählten Punktzahl ändern — genau wie es die
Katalogdaten vorgeben.

## Desired Behavior / Outcome

- Der Engine wird das vollständige, aus `.ros` geparste Roster übergeben,
  inklusive der eingestellten Kostengrenzen je Kostenart. Die Engine definiert
  sich kein eigenes reduziertes Roster mehr.
- Eine Katalog-Regel, die die eingestellte Punktgrenze liest
  (`limit::<costTypeId>`, Bezugsrahmen `roster`), erhält die eingestellte Grenze
  dieser Kostenart als Wert — nicht die verplante Summe.
- Budget-gesteuerte Bedingungen und Modifikatoren werten korrekt: Sichtbarkeit
  (`hidden`), Mindest-/Höchstzahlen und Verfügbarkeiten ändern sich mit der
  gewählten Punktzahl, wie in den Katalogdaten hinterlegt (belegte Beispiele:
  Lord/Core/Special-Skalierung je 1000 Punkte; Mindestbudget für bestimmte
  Sonderheere).
- Übersteigt die verplante Summe einer Kostenart die eingestellte Grenze dieser
  Kostenart, meldet die Engine eine roster-weite Budget-Verletzung.
- Nennt eine Regel eine Kostengrenze, die im Datensatz bzw. in den übergebenen
  Grenzen nicht deklariert ist, meldet die Engine eine Diagnose, statt still 0 zu
  liefern.

## User Stories / Requirements

1. Als Listenbauer möchte ich, dass sich die auswählbaren Einheiten mit der
   eingestellten Armeegröße ändern (z. B. mehr Lord-/Held-Slots bei größeren
   Armeen), damit die Validierung den Turnierregeln des Katalogs entspricht.
2. Als Listenbauer möchte ich gewarnt werden, wenn meine Armee ihr Punktebudget
   überschreitet.
3. Als Wartender möchte ich, dass fehlerhafte oder unbekannte
   Kostengrenzen-Bezüge in den Daten als Diagnose sichtbar werden, statt still
   verschluckt zu werden.

## Constraints & Settled Decisions

- Der Evaluator wird die produktive Engine und löst `src/solver/` ab; die alte
  Engine gilt als fehlerhaft und ist bei Entwurf und Analyse nicht heranzuziehen.
  — ADR 0030 (revidiert 2026-07-25).
- Die Engine nimmt die Kostengrenzen als vollständige Liste je Kostenart
  entgegen (Zuordnung Kostenart → Wert), analog zum `.ros`/XSD-Format — nicht nur
  eine einzelne aktive Kostenart. So löst jedes `limit::<beliebigeId>` direkt auf,
  und die Budget-Verletzung prüft jede Kostenart gegen ihre eigene Grenze.
- Roster-weite Prozentgrenzen (`percentValue="true"`) werden zurückgestellt: kein
  Vorkommen in den Katalogdaten (YAGNI). Da die Budgetzahl danach als Bezugsgröße
  existiert, ist eine spätere Nachrüstung gering.
- Die harte Import-Isolation `src/evaluator/` ⇄ `src/solver/` bleibt bestehen
  (ADR 0030); die maßgebliche Kostenart und ihre Fallbacks leitet die Engine aus
  dem eigenen Datensatz bzw. dem übergebenen Roster ab, nie aus Solver-Code.
- Relevant ADRs: ADR 0030 (revidiert), ADR 0003 (Battlescribe Domain Rules),
  ADR 0016 (vendored XSD), ADR 0023 (Fassade als exklusive Schnittstelle).

## Testing Decisions

- Behavior to verify:
  - Budget-gesteuerte Sichtbarkeit und Slot-Zahlen ändern sich mit der Punktzahl
    (Lord/Core/Special-Skalierung; Mindestbudget-Heer) auf echten
    Definitive-Edition-Katalogdaten.
  - Das vollständige Roster inklusive Kostengrenzen erreicht die Engine über die
    `.ros`-Auswertung.
  - Eine Budget-Überschreitung einer Kostenart erzeugt eine roster-weite
    Verletzung.
  - Eine unauflösbare Kostengrenze erzeugt eine Diagnose.
- Test Interfaces (Seams): die öffentliche Fassade `evaluate(dataset, roster)`
  (einzige legale Außenschnittstelle, ADR 0030) — E2E gegen reale
  WHFB6-Definitive-Edition-Daten und die `.ros`-Auswertung, plus fassaden-nahe
  Fälle für Budget-Verletzung und Diagnose.

## Out of Scope

- Roster-weite Prozentgrenzen (`percentValue="true"`) — zurückgestellt, bis ein
  Katalog sie real verlangt.
- Der produktive Cutover selbst (App verdrahtet die Engine, `src/solver/` wird
  entfernt) — eigene, spätere Arbeit; hier wird nur die datenkorrekte Auswertung
  inklusive Punktgrenze hergestellt.
- Änderungen am App-seitigen Roster-Modell über das hinaus, was die
  Engine-Übergabe benötigt.
- Katalogübergreifende Importe und Inkrementalisierung (in ADR 0030 bereits als
  Zukunft vermerkt).

## Acceptance Criteria
- [ ]

## Comments
