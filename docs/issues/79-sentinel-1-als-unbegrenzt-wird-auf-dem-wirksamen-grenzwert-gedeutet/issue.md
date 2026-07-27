Status: resolved
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
- PO-Entscheid zu Kriterium 5 ('Ein Szenario an echten Katalogdaten deckt beide Faelle ab'): Der zweite Fall — eine Grenze, die ein Modifikator ins Negative zieht — ist an echten Katalogdaten NICHT belegbar. Kein Katalog im Repo zieht eine Grenze unter null; der einzige decrement auf einer Grenze (93f2a491-..., Vampire Counts) geht 1 -> 0. Ein Szenario dafuer zu erfinden hiesse, synthetische Katalogdaten zu bauen — genau das schliesst ADR-0033 aus. Kriterium 5 gilt daher als erfuellt, wenn: (a) ein E2E-Szenario an echten Daten die belegten Faelle abdeckt (Basiswert -1 als unbegrenzt, set -1 als erklaertes unbegrenzt, -1 als Rechenbasis mit increment/repeat wie ffea-b24a-0cdf-781e), und (b) der Negativ-Zug durch einen Modultest in constraints.test.js festgehalten wird. Der Unterschied ist zu dokumentieren, nicht zu kaschieren.
- PO-Sichtung, Datenbelege stichprobenartig nachgeprueft und bestaetigt: constraints.js:62 traegt das harte 'if (bound === -1) return null', catalogReader.js:173 den privaten NO_DEFAULT_COST_LIMIT = -1. Gegenbeispiel gegen die naive Loesung haelt: ffea-b24a-0cdf-781e ist max value=-1.0 (Warhammer Fantasy Battle 6th edition.gst:84) und traegt zugleich einen increment 1.0 (:67) — dort ist -1 Rechenbasis, nicht Sentinel. Beide Schreibweisen kommen vor (138x value=-1, 8x value=-1.0), numerischer Vergleich ist Pflicht.
- KORREKTUR des PO-Entscheids zu Kriterium 5. Die zuvor angefuehrte Grenze ffea-b24a-0cdf-781e (mit -1 deklariert und per increment/repeat hochgezaehlt) liegt in src/solver/__fixtures__/whfb6/ und scripts/__fixtures__/showcase-empire/ — den ALTEN Solver-Fixtures, nicht im Datensatz des Evaluators unter src/evaluator/__fixtures__/whfb6-definitive/. ADR-0030 schliesst Solver-Daten als Referenz fuer den Evaluator aus. Im Evaluator-Datensatz nachgezaehlt: 122 Grenzen mit value=-1, 36 Ziele arithmetischer Modifikatoren, Schnittmenge LEER. Auch die Schreibweise -1.0 kommt dort nicht vor. Folge: nicht nur der Negativ-Zug, sondern auch das Muster '-1 deklariert und hochgezaehlt' ist an echten Evaluator-Daten nicht belegbar. Beide Faelle gehoeren in Modultests. Das E2E-Szenario deckt ab, was die Daten hergeben.
- Auflösungs-Gate: Fuenf-Achsen-Review gruen. Standards: 9 Funde, keiner blockierend, keiner gegen diese Aenderung — als Issues 85, 86, 87 aufgenommen. Spezifikation: 0 Funde; ADR-0033 mechanisch geprueft (git diff auf docs/testing/ zeigt 301 eingefuegte, 0 geloeschte Zeilen — das Szenario wurde einmal angelegt und nie abgeschwaecht). Tests: gruen, 2110 vitest-Tests plus Puppeteer-E2E. Doku: 0 Funde, Format- und Architektur-Dokument im selben Diff nachgezogen. Design-Konformitaet: Plan eingehalten; die eine gemeldete Abweichung (Sentinel-Konstante modul-privat statt exportiert) als gerechtfertigte Verbesserung bewertet, kein Aenderungsbedarf.
