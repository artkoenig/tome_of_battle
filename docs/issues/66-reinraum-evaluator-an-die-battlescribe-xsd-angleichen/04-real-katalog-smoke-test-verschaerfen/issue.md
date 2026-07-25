Status: ready-for-agent
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
- [ ] Der Real-Katalog-Smoke-Test assertiert, dass mindestens ein echter
      Modifikator den effektiven Wert bzw. eine Grenze im Bericht verändert.
- [ ] Der Test assertiert, dass mindestens eine echte Bedingung (bzw.
      Bedingungsgruppe) das Greifen/Nicht-Greifen einer Regel steuert.
- [ ] Der Test enthält keine Assertion mehr, die echte Bedingungen/Modifikatoren
      als UNSUPPORTED-Diagnose erwartet.
- [ ] Der Smoke-Test läuft gegen einen realen Katalog und ist grün.

## Comments
