Status: needs-triage
Type: fix
Blocked by: None

## Description

`src/evaluator/constraints.js` deutet einen Grenzwert von `-1` als „unbegrenzt"
und laesst die Grenze fallen. Zwei Probleme daran:

1. **Der Wert ist an dieser Stelle bereits der wirksame**, also der nach allen
   Modifikatoren (`resolveBound`). Eine MAX-Grenze, die ein `decrement`-Modifikator
   auf `-1` herunterzieht, bedeutet fachlich „nichts erlaubt" — sie wird aber
   still als „unbegrenzt" gelesen. Das ist die denkbar groesste Verwechslung: aus
   der schaerfsten Grenze wird gar keine.
2. **Der Sentinel ist bereits benannt**: `catalogReader.js` fuehrt ihn als
   `NO_DEFAULT_COST_LIMIT`, und die zugehoerige Dokumentation sagt ausdruecklich,
   der Leser bilde ihn weg, *damit kein Leser den Sentinel als Zahl weiterrechnet*.
   `constraints.js` tut genau das — mit einem harten Literal.

Vorbestehend (Commit `15219dc` auf `main`), nicht durch Main-Issue 75 entstanden;
dort bei der Standards-Pruefung gefunden.

Zu klaeren ist zuerst, wo `-1` in den Katalogdaten ueberhaupt als „unbegrenzt"
gemeint ist — am Basiswert einer Grenze, an `defaultCostLimit`, oder an beidem.
Die Antwort gehoert an die Daten und an das Format-Dokument.

## Acceptance Criteria
- [ ] Aus den Katalogdaten und dem Format-Dokument ist belegt, an welchen Stellen `-1` „unbegrenzt" bedeutet.
- [ ] Der Sentinel wird dort gedeutet, wo er als Rohwert steht, nicht auf dem wirksamen Wert.
- [ ] Eine Grenze, die ein Modifikator auf einen negativen Wert zieht, wird nicht als unbegrenzt gelesen.
- [ ] Kein hartes `-1`-Literal mehr in der auswertenden Schicht; der benannte Sentinel ist die eine Quelle.
- [ ] Ein Szenario an echten Katalogdaten deckt beide Faelle ab (ADR-0033, verfasst vom Black-Box-Autor).

## Comments
