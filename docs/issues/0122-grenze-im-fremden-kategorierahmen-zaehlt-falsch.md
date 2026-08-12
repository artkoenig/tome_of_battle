---
status: done
branch:
pr:
---

# Grenze im fremden Kategorierahmen zählt falsch (legale Liste zeigt Fehler)

## Intent

Eine Grenze mit `scope="<categoryId>"` löst laut Fassaden-Doku auf den
armeeweiten Kategorierahmen auf. Katalogautoren nutzen genau das für
"Option X nur für Bloodline Y": am Angebot steht `max 0` im Rahmen der
*anderen* Bloodline-Kategorie. Ist diese Kategorie im Roster gar nicht
vertreten, ist der Rahmen leer — die Grenze kann nicht verletzt sein.

Der Evaluator zählt in diesem Fall trotzdem 1 und meldet einen Fehler.
Beobachtbar an der eingefrorenen WHFB6-Fixture: die Blood-Dragons-Liste
(2000 Punkte, legal, wurde vor Issue 0121 fehlerfrei bewertet) zeigt drei
Verletzungen. Alle drei haben dieselbe Form:

```
origin: derivedLimit, severity: error
anchor: "Mounts"        (Gruppen-Anker, Pfade 0/1/11, 0/2/1/12, 0/3/9)
limit:  { kind: max, measure: selectionCount,
          scope: { kind: categoryId, targetId: bf30-4ff0-a4d8-3909 } }
actual: 1, bound: 0
```

`bf30-4ff0-a4d8-3909` ist die Kategorie **Strigoi**; die Liste ist eine
Blood-Dragon-Liste und enthält keine einzige Strigoi-Auswahl. Der
Constraint im Katalog (`Vampire Counts.cat`, u. a. Zeile 1259) lautet
`<constraint field="selections" scope="bf30-…" value="0.0" shared="true"
includeChildSelections="true" includeChildForces="true" type="max"/>` —
das Idiom "Strigoi dürfen kein Reittier nehmen".

Der Ist-Stand von 1 entspricht genau der Zahl der Reittiere im ganzen
Roster: der Rahmen wird offenbar wie "armeeweit, ohne Rücksicht auf die
Kategorie" behandelt statt als "die Auswahlen, die in dieser Kategorie
liegen".

**Reproduktion (ohne App-Code, ohne den Roster-Adapter):** derselbe
Befund entsteht mit dem Test-Fixture-Parser des Evaluators —
`rosterFromRos('src/utils/__fixtures__/blood-dragons.ros')` gegen
`prepareDataset` über `src/__fixtures__/whfb6/` — die beiden Verletzungen
`6681-a071-a9f8-4146` und `6753-a69e-4550-a4c4` erscheinen dort ebenso.
Der Defekt liegt also in der Engine, nicht in der Brücke `src/evaluation/`.

Acceptance criteria:

1. Ein `max`-Zählgrenzwert mit `scope="<categoryId>"` zählt nur Auswahlen,
   die im Rahmen dieser Kategorie liegen. Enthält das Roster keine
   Auswahl dieser Kategorie, ist der Ist-Stand 0 und die Grenze wird
   nicht verletzt — auch bei `bound: 0`.
2. Die Blood-Dragons-Fixture wird fehlerfrei bewertet: der Bericht über
   `src/__fixtures__/whfb6/Vampire Counts.cat` +
   `src/utils/__fixtures__/blood-dragons.ros` enthält keine Verletzung
   mit `severity: error`.
3. Eine echte Verletzung derselben Bauart wird weiterhin gemeldet: liegt
   die Auswahl **tatsächlich** im Rahmen der genannten Kategorie, feuert
   die `max 0`-Grenze wie bisher.
4. Der Fall ist als E2E-Szenario unter `docs/testing/` hinterlegt
   (manifest-getrieben, ADR-0033), damit er nicht über eine
   App-Integrationsprüfung abgesichert werden muss.

## Plan

## Tasks

## Decisions

- **Vorbestehender Defekt, nicht vom Cutover verursacht.** Belegt über
  den Fixture-Parser des Evaluators, der den App-Adapter nicht benutzt.
  Issue 0121 hat ihn nur sichtbar gemacht, weil vorher der Solver dieses
  Roster beurteilte. *(Quelle: Reproduktion, 2026-07-30.)*
- **Nicht in Issue 0121 mitgefixt.** Ein Semantik-Eingriff im
  Query-Primitiv gehört nicht in den Cutover-Schnitt; eigenes Issue,
  eigene Tests. *(Default, unanswered.)*
- **Nutzersichtbar.** Solange der Defekt lebt, zeigen Listen mit
  bloodline-gebundenen Optionen Phantom-Fehler. Das ist beim
  Merge-/Release-Entscheid zu Issue 0121 zu berücksichtigen.
  *(Beobachtung; der Mensch entscheidet.)*

## Log

- 2026-08-12 — Closed: fixed by PR #200. A category id in `@scope` now resolves
  to the nearest ancestor that effectively carries that category, and fails
  closed with a diagnostic when no ancestor does — pinned by
  `src/evaluator/query.categoryScope.test.js`, whose header names this very
  Strigoi/Mounts case, and by the E2E scenario `docs/testing/category-scope-bug`.
  Re-measured on 2026-08-12 with the repro recipe of this file
  (`rosterFromRos('src/utils/__fixtures__/blood-dragons.ros')` against
  `prepareDataset` over `src/__fixtures__/whfb6/`): the three Strigoi violations
  are gone, `6681-a071-a9f8-4146` and `6753-a69e-4550-a4c4` among them.
  One error remains in that measurement — the game system's `General` mandate
  `1077-7379-f142-f382` — and it is an artefact of the test-fixture reader, not
  of the engine: `src/evaluator/__fixtures__/rosParser.js` keeps the `::`
  qualifier of a roster `entryId`, while the production import path strips it
  (`src/utils/rosterSerialization.js:417`). Stripping it in the probe makes that
  violation disappear.

- 2026-07-30: Gefunden beim Abriss des Solvers (Issue 0121, Task 10). Der
  vorher solver-basierte Test "Blood Dragons list validates without
  errors" schlug nach der Umstellung auf den Evaluator mit 3 statt 0
  Fehlern fehl. Die Assertion wurde in
  `src/utils/rosterSerialization.integration.test.js` entfernt (ihr
  Gegenstand ist Engine-Bewertung, nicht Serialisierung) und der Fund
  hierher überführt; die Round-Trip-Eigenschaft desselben Tests (Export →
  Reimport ändert die Fehlerzahl nicht) bleibt dort und ist grün.

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
