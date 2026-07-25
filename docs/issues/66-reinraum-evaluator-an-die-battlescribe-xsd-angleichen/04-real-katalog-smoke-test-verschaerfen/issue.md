Status: resolved
Type: refactor
Blocked by: [01, 02, 03]

## Description
Der bestehende Real-Katalog-Smoke-Test der Engine
(`src/evaluator/e2e.realCatalog.smoke.test.js`) prüft heute nur Grenzen; echte
Bedingungen und Modifikatoren erscheinen dort nur als Diagnosen. Nachdem 01–03
die Engine XSD-konform gemacht haben, wird der Smoke-Test verschärft: Er
assertiert an einem **echten `.cat`-Katalog** die **tatsächliche Auswertung** von
Bedingungen und Modifikatoren (inkl. Gruppen) — also dass reale Regeln den
Bericht verändern — statt nur zu prüfen, dass sie als Diagnose auftauchen.

Damit ist end-to-end an realen Daten belegt, dass die Engine reale Kataloge
auswertet und nicht nur syntaktisch akzeptiert.

## Acceptance Criteria
- [x] Der Real-Katalog-Smoke-Test assertiert, dass mindestens ein echter
      Modifikator den effektiven Wert bzw. eine Grenze im Bericht verändert.
- [x] Der Test assertiert, dass mindestens eine echte Bedingung (bzw.
      Bedingungsgruppe) das Greifen/Nicht-Greifen einer Regel steuert.
- [x] Der Test enthält keine Assertion mehr, die echte Bedingungen/Modifikatoren
      als UNSUPPORTED-Diagnose erwartet.
- [x] Der Smoke-Test läuft gegen einen realen Katalog und ist grün.

## Comments
- Real-Katalog-Smoke-Test verschaerft: assertiert nun am echten Ogre-Kingdoms-Katalog die tatsaechliche Auswertung. Realer set-Modifikator senkt die effektive Tyrant-Obergrenze im Bericht von 1 auf 0, sobald Dogs of War im Roster steht; die reale Bedingung (Dogs-of-War-Auswahlen im Roster > 0) steuert, ob die Grenze als Regel greift (Verletzung erscheint/verschwindet). Keine Produktivaenderung, kein Solver-Import, Berichtsform unveraendert.
