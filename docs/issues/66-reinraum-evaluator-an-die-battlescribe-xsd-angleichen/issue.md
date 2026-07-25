Status: needs-triage
Type: refactor
Blocked by: None

## Description

# PRD: Reinraum-Evaluator an die BattleScribe-XSD angleichen

## Problem Statement / Bug Description
Der Reinraum-Evaluator (`src/evaluator/`, ADR-0030) liest Bedingungen und
Modifikatoren mit einem **erfundenen Vokabular** (`op` / `operation` /
`targetKind` / `targetId`), das in der offiziellen BattleScribe-XSD gar nicht
existiert — kanonisch sind `type` und `field`. Folge: Für reale `.cat`/`.gst`-
Kataloge wird **jede** Bedingung und **jeder** Modifikator als Diagnose
(UNSUPPORTED) gemeldet statt ausgewertet; die Engine kann reale Kataloge nicht
auswerten. Ihre Enums duplizieren die vendored XSD-SSOT und weichen davon ab
(`ModifierKind` nur 4 von 10 Werten; `less`/`greater`/`equal` statt
`lessThan`/`greaterThan`/`equalTo`; `notEqualTo` fehlt). Mehrere XSD-Elementtypen
liest sie überhaupt nicht: Bedingungsgruppe, Modifikatorgruppe und die reinen
Info-Elemente.

Erwartet (aus Sicht eines Domänen-Experten): Die Engine liest und wertet reale
BattleScribe-Kataloge an den kanonischen Attributnamen aus und deckt die
Elementtypen und geschlossenen Enum-Mengen des Formats ab.

## Desired Behavior / Outcome
- Die Engine liest reale Kataloge: Bedingungen an `type` (ConditionKind),
  Modifikatoren an `type` (ModifierKind) mit dem Ziel im `field` — nirgends mehr
  `op`/`operation`/`targetKind`/`targetId`.
- Alle geschlossenen Enum-Werte des Formats werden erkannt: vollständiges
  ConditionKind (inkl. `notEqualTo`, `instanceOf`, `notInstanceOf`),
  vollständiges ModifierKind (inkl. `increment`/`decrement`/`append`/`remove`/
  `prepend`/`set-primary`/`unset-primary`/`multiply`), ConstraintKind (`min`/`max`),
  ConditionGroupKind (`and`/`or`).
- Verschachtelte **Bedingungsgruppen** und **Modifikatorgruppen** (`and`/`or`)
  werden gelesen und ausgewertet.
- Die **Info-Elemente** (Profil, Regel, Info-Gruppe, Info-Link) werden strukturell
  gelesen (sie tragen keine Grenzen-/Modifikator-Logik) und brechen das Parsen
  nicht.
- Die Format-Enums der Engine stammen aus der **einen Quelle der Wahrheit**
  `src/parser/schema/battlescribeSchema.generated.js`, nicht aus eigenen Kopien.
- Ein Real-Katalog-Smoke-Test assertiert die **tatsächliche Auswertung** von
  Bedingungen/Modifikatoren, nicht nur Diagnosen.

## User Stories / Requirements
1. Als Maintainer möchte ich, dass der Reinraum-Evaluator reale BattleScribe-
   Kataloge an den kanonischen XSD-Attributnamen auswertet, damit seine Ergebnisse
   ein gültiger Vergleich gegen die produktive Engine am echten Datenformat sind.
2. Als Maintainer möchte ich, dass die Format-Enums der Engine aus der vendored
   XSD-SSOT stammen, damit sie nicht still von der XSD abdriften können (die
   Drift-Klasse, die ADR-0016 für Parser/Solver behoben hat).
3. Als Maintainer möchte ich verschachtelte Bedingungs-/Modifikatorgruppen und die
   Info-Elemente abgedeckt haben, damit reale Kataloge, die sie nutzen, ohne
   Lücken gelesen werden.

## Constraints & Settled Decisions
- Die Engine liest kanonische XSD-Syntax und teilt die XSD-SSOT aus
  `src/parser/schema/` — entschieden in **ADR-0031**. Das erfundene Vokabular
  wird ersatzlos entfernt (kein Kompatibilitäts-Fallback).
- Die harte Import-Isolation Evaluator ⇄ Solver bleibt unberührt (ADR-0030);
  eigener Parser, eigenes Datenmodell und eigener Report der Engine bleiben
  getrennt — nur das Format-**Vokabular** wird über `src/parser/` geteilt.
- `scope`/`field` bleiben `xs:string`-Konvention (kein XSD-Enum, ADR-0016); die
  Engine behält ihre eigene Bezugsrahmen-Behandlung und importiert **keine**
  Solver-Konstanten.
- Kein produktiver Cutover: Die Engine bleibt eine Reinraum-Bibliothek, nicht in
  den App-Pfad verdrahtet (ADR-0030) — daher `refactor`, keine nutzersichtbare
  Änderung, kein Version-Bump.
- Relevante ADRs: ADR-0016, ADR-0030, ADR-0031.

## Testing Decisions
- Zu prüfendes Verhalten: reale Bedingungen (alle ConditionKind-Werte inkl.
  `notEqualTo`, `instanceOf`, `notInstanceOf`) und Modifikatoren (alle
  ModifierKind-Werte) an kanonischem `type`/`field` werden ausgewertet und
  verändern den Bericht; verschachtelte Bedingungs-/Modifikatorgruppen lösen zum
  korrekten Wahrheitswert bzw. Greifen/Nicht-Greifen auf; Info-Elemente werden
  gelesen, ohne das Parsen zu brechen.
- Test-Schnittstellen (Seams): die Evaluator-Fassade
  `evaluate(catalogXml, roster) → Bericht` (`src/evaluator/evaluator.js`) und der
  Katalog-Leser `parseCatalogue(catalogXml)` (`src/evaluator/catalogReader.js`);
  die bestehende Engine-Testsuite und der Real-Katalog-Smoke-Test
  (`src/evaluator/e2e.realCatalog.smoke.test.js`), dessen Fixtures vom erfundenen
  Vokabular auf echte BattleScribe-Syntax umgeschrieben werden.

## Out of Scope
- Verdrahtung der Engine in den App-Pfad / produktiver Cutover (eigene
  `feature`-Entscheidung, ADR-0030).
- Katalogübergreifende Importe/Link-Ketten und Inkrementalisierung (in ADR-0030
  bereits als Zukunft vorgemerkt).
- Änderung der scope/field-Domänensemantik oder Vereinheitlichung mit den
  Solver-Konstanten (verbotener Import; XSD lässt sie als String).
- Jede Änderung an `src/solver/` oder am bestehenden Verhalten von `src/parser/`
  (das SSOT-Modul wird konsumiert, nicht verändert).

## Acceptance Criteria
- [ ]

## Comments
