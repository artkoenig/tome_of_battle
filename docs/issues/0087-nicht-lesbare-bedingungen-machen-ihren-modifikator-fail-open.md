---
status: backlog
branch:
pr:
---

# Nicht lesbare Bedingungen machen ihren Modifikator fail-open

## Intent

Eine `<condition>`, `<conditionGroup>` oder `<repeat>`, die der Leser nicht
deuten kann, wird mit Diagnose verworfen (`readCondition`,
`src/evaluator/catalogReader.js:317`; analog Repeats und Gruppen) und aus der
Wächterliste des Modifikators **herausgefiltert**. Der Modifikator feuert dann
mit den verbliebenen — im Grenzfall: gar keinen — Wächtern, also **öfter** als
im Katalog kodiert. Das ist die Umkehrung der engine-eigenen
Fail-closed-Konvention (vgl. `UNRESOLVED_BUDGET`: „die Regel feuert nicht",
`src/evaluator/model.js`).

Der Fall ist nicht nur theoretisch: laut vendored XSD ist `field` an einer
Condition **optional**, und bei `instanceOf`/`notInstanceOf` sind `field` und
`value` laut Wiki bedeutungslos („Has no effect where Type is instance
of|not instance of"). Eine schema-konforme Condition ohne `field` fällt heute
durch die Lesbarkeits-Prüfung (`field === undefined || Number.isNaN(value)`);
eine Condition ohne `value` verletzt zwar die XSD (`value` ist dort
`use="required"`, `Catalogue.xsd:427`), ist bei `instanceOf`/`notInstanceOf`
laut Wiki aber ebenso bedeutungslos und fällt heute genauso durch.

Repro (Audit 2026-07-28, gegen die echte Fassade): Condition
`type="greaterThan" childId="…"` ohne `value`-Attribut → Condition verworfen
(Diagnose `unsupportedCondition`), das Kosten-Increment feuert unbedingt →
Verstoß, den es nicht geben dürfte. Gleiches Muster: ein Repeat mit
unlesbarem `value` → Modifikator wird einmal unbedingt angewendet statt
je N.

Verwandt, aber gesondert zu entscheiden: eine nicht lesbare **Constraint**
verschwindet ebenfalls still aus der Auswertung (Grenze weg = alles erlaubt).
Fail-closed hieße dort „Grenze suspendieren und ausweisen" — ob das gewünscht
ist, klärt dieser Lauf als Entscheidung.

Acceptance criteria:

1. Ein Modifikator, von dessen Wächtern (Conditions, Condition-Gruppen,
   Repeats) mindestens einer nicht lesbar ist, feuert nicht (fail-closed);
   die Diagnose bleibt erhalten.
2. Eine `instanceOf`-/`notInstanceOf`-Condition ohne `field`- und/oder
   `value`-Attribut wird ausgewertet statt verworfen.
3. Das Repro aus dem Intent erzeugt keinen Verstoß mehr, und die Diagnose
   benennt den betroffenen Modifikator-Träger.
4. Die bestehende Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt.

## Plan

## Tasks

## Decisions

- **Herkunft:** Intensiv-Audit der Reinraum-Engine gegen die BSData-Doku im
  Repo (2026-07-28), Fund mit ausgeführtem Repro gegen die echte Fassade.

## Log

- 2026-07-29 — Doku-Abgleich (Goal-Lauf „Behauptungen gegen bsdata prüfen"):
  Intent präzisiert. Die frühere Formulierung nannte eine Condition ohne
  `field` **und/oder** `value` pauschal „schema-konform"; laut vendored XSD
  ist nur `field` optional, `value` ist `use="required"`. Die Wiki-Semantik
  (bedeutungslos bei `instanceOf`/`notInstanceOf`) gilt für beide Fälle,
  an den Akzeptanzkriterien ändert sich nichts.

## Checkpoints

### Before implementation

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
