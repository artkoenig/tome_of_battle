---
status: backlog
branch:
pr:
---

# Sentinel -1 als „unbegrenzt" wird auf dem wirksamen Grenzwert gedeutet

## Intent

`src/evaluator/constraints.js` deutet einen Grenzwert von `-1` als
„unbegrenzt" und lässt die Grenze fallen. Zwei Probleme daran:

1. **Der Wert ist an dieser Stelle bereits der wirksame**, also der nach allen
   Modifikatoren (`resolveBound`). Eine MAX-Grenze, die ein
   `decrement`-Modifikator auf `-1` herunterzieht, bedeutet fachlich „nichts
   erlaubt" — sie wird aber still als „unbegrenzt" gelesen. Das ist die
   denkbar größte Verwechslung: Aus der schärfsten Grenze wird gar keine.
2. **Der Sentinel ist bereits benannt.** `catalogReader.js` führt ihn als
   `NO_DEFAULT_COST_LIMIT`, und die zugehörige Dokumentation sagt
   ausdrücklich, der Leser bilde ihn weg, *damit kein Leser den Sentinel als
   Zahl weiterrechnet*. `constraints.js` tut genau das — mit einem harten
   Literal.

Zu klären ist zuerst, wo `-1` in den Katalogdaten überhaupt als „unbegrenzt"
gemeint ist: am Basiswert einer Grenze, an `defaultCostLimit`, oder an beidem.
Die Antwort gehört an die Daten und an das Format-Dokument.

Acceptance criteria:

1. Aus den Katalogdaten und dem Format-Dokument ist belegt, an welchen Stellen
   `-1` „unbegrenzt" bedeutet.
2. Der Sentinel wird dort gedeutet, wo er als Rohwert steht, nicht auf dem
   wirksamen Wert.
3. Eine Grenze, die ein Modifikator auf einen negativen Wert zieht, wird nicht
   als unbegrenzt gelesen.
4. Kein hartes `-1`-Literal mehr in der auswertenden Schicht; der benannte
   Sentinel ist die eine Quelle.
5. Ein Szenario an echten Katalogdaten deckt beide Fälle ab (ADR 0033,
   verfasst vom Black-Box-Autor).

## Plan

## Tasks

## Decisions

- Aus dem alten Tracker übernommen
  (`docs/issues/79-sentinel-1-als-unbegrenzt-wird-auf-dem-wirksamen-grenzwert-gedeutet/issue.md`,
  Status `needs-triage`). Inhaltlich unverändert.
- **Herkunft:** Vorbestehend (Commit `15219dc` auf `main`), nicht durch
  Alt-Issue 75 entstanden; dort bei der Standards-Prüfung gefunden.

## Log

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
