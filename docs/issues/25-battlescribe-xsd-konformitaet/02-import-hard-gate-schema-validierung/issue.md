Status: resolved
Type: fix
Blocked by: [01]

## Description
Deckt Solution C und User Story 4 aus Main-Issue 19 ab (Architektur: ADR 0016);
baut auf der vendored XSD aus Kind-Issue 01 auf.

Jede importierte `.cat`/`.gst` wird **vor** dem Parsen strukturell gegen die
vendored XSD validiert. Neuer Seam
`validateAgainstSchema(xmlText, kind) → { valid, errors: [{ line, column, message }] }`
mit `kind ∈ {catalogue, gameSystem, roster}` (steuert den Namespace-Tausch der
einen XSD). Umsetzung mit `xmllint-wasm` (libxml2→WASM), da die PWA kein
Backend hat.

Als **Hard-Gate**: bei Schemaverstoß wird der Import **abgelehnt** — kein stilles
Fehlverarbeiten — mit einer für den Nutzer sichtbaren, verortbaren Fehlermeldung
(Datei + Zeile/Element). Das Gate gilt für beide Import-Wege: den manuellen
Datei-Import **und** den Laufzeit-Abruf aus dem Community-Fork (ADR 0014).
Gültige Dateien passieren unverändert.

Das Gate prüft **strukturelle** Gültigkeit; Roster-Bau-Constraints („erlauben
schlägt verbieten") sind eine andere Ebene und nicht betroffen.

## Acceptance Criteria
- [ ] `validateAgainstSchema(xml, kind)` validiert gegen die vendored XSD und liefert bei Fehlern verortbare Einträge (Zeile/Spalte/Meldung)
- [ ] Eine schema-gültige Fixture passiert; eine bewusst ungültige Fixture wird abgelehnt
- [ ] Import (manuell) einer ungültigen Datei zeigt eine klare, verortbare Fehlermeldung in der UI statt stiller Fehlverarbeitung
- [ ] Der Laufzeit-Fork-Abruf durchläuft dasselbe Gate
- [ ] Der `kind`-Schalter validiert catalogue/gameSystem/roster gegen den jeweils korrekten Namespace

## Comments
- Implemented the import hard-gate: new seam validateAgainstSchema(xmlText, kind) (src/parser/schemaValidator.js) validates against the vendored Catalogue.xsd via xmllint-wasm, swapping the target namespace per kind (catalogue/gameSystem/roster). Wired a shared gate (src/parser/importSchemaGate.js) as a pre-parse HARD-GATE into the manual file import and the bundle import (Importer.jsx) plus the runtime silent fork update (catalogUpdate.js), rejecting invalid files with a user-visible, locatable error (file + line).
- 2026-07-18: Nachtrag - das Hard-Gate (ablehnen) wird durch Advisory (melden, weiter importieren) ersetzt; Empirie zeigte, dass 2/4 reale Kataloge die strikte XSD-sequence verletzen, obwohl sie funktionieren. Umbau in Kind-Issue 08. Siehe ADR 0016 (Revision 2026-07-18).
