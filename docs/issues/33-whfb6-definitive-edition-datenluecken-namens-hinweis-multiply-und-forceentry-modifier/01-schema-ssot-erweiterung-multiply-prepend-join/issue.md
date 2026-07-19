Status: resolved
Type: feature
Blocked by: None

## Description
Vorarbeit für die Kind-Issues 04 und 05: Die vendorte `Catalogue.xsd`
(ADR-0016s SSOT für `ModifierKind`/`AttributeName`) kennt die Modifier-Kind-
Werte `multiply` und `prepend` nicht sowie kein `join`-Attribut auf
`<modifier>`, obwohl echte Definitive-Edition-Kataloge sie nutzen (siehe
ADR-0016, Revision 2026-07-19, und das Main-Issue-PRD). Diese drei Konstrukte
werden von Hand in die vendorte XSD-Datei ergänzt, danach läuft der
bestehende Codegen (`npm run generate:schema`) regulär dagegen — kein
manuelles Editieren des generierten Moduls, der SSOT-Guard bleibt aktiv und
grün.

Reine Schema-/Codegen-Änderung; kein Verhalten im Parser/Solver/UI ändert
sich in diesem Issue — das ist Gegenstand der Kind-Issues 04 und 05.

## Acceptance Criteria
- [ ] Die vendorte `Catalogue.xsd` definiert `multiply` und `prepend` als
      zusätzliche `ModifierKind`-Enum-Werte sowie ein optionales `join`-
      Attribut auf dem `Modifier`-Element.
- [ ] `npm run generate:schema` regeneriert das committete Enum-/
      Attributnamen-Modul erfolgreich aus der erweiterten XSD; das Ergebnis
      enthält die neuen Werte.
- [ ] Der bestehende SSOT-Guard-Test (`scripts/generate-schema-module.test.js`)
      bleibt grün.
- [ ] Die volle Testsuite (`npm test`) bleibt grün.

## Comments
- Vendored Catalogue.xsd um ModifierKind-Werte 'multiply'/'prepend' und ein optionales 'join'-Attribut auf <modifier> erweitert (dokumentierte Abweichung per ADR-0016). Codegen neu ausgefuehrt; generiertes Modul enthaelt MULTIPLY/PREPEND und AttributeName.JOIN. SSOT-Guard gruen, volle vitest-Suite gruen (671).
