Status: resolved
Type: fix
Blocked by: None

## Description
Korrigiert die Import-Validierung aus Kind-Issue 02 (Solution C) von einem
**Hard-Gate** (ungültige Dateien ablehnen) auf **Advisory** (validieren, verortbar
warnen, Import fortsetzen). Grundlage: ADR 0016, Revision 2026-07-18.

Empirischer Befund: 2 von 4 eingefrorenen, produktiv genutzten Katalogen verletzen
die strikte `xs:sequence`-Ordnung der offiziellen XSD (Element-Reihenfolge;
condition-Platzierung), obwohl die App sie heute korrekt lädt und rendert. Der reale
BSData-Validator ist `wham publish`, nicht reine XSD-Prüfung. Ein striktes Hard-Gate
ist damit strenger als das reale Ökosystem und würde funktionierende Kataloge
fälschlich ablehnen — im Widerspruch zum Ziel „Format generisch unterstützen".

Änderung:
- Der Validierungs-Seam `validateAgainstSchema(xmlText, kind)` und `schemaValidator`
  bleiben unverändert (Validierungs-Engine).
- Der Import-Pfad (manueller Datei-Import **und** Laufzeit-Fork-Abruf) bricht bei
  Schemaverstoß **nicht mehr ab**, sondern parst/importiert weiter und macht die
  verortbaren Verstöße (Datei + Zeile) als nicht-blockierende **Warnung** in der UI
  sichtbar.
- Tests, die bisher die Ablehnung erzwangen, werden auf das Advisory-Verhalten
  umgestellt (Warnung sichtbar, Import läuft durch). Der zuvor an der WHFB6-Fixture
  scheiternde E2E-Import muss wieder grün sein.

## Acceptance Criteria
- [ ] Import einer schema-ungültigen `.cat`/`.gst` wird fortgesetzt (nicht abgelehnt); Daten werden geparst/gespeichert
- [ ] Der Schemaverstoß erscheint als verortbare, nicht-blockierende Warnung in der UI (Datei + Zeile)
- [ ] Der Laufzeit-Fork-Abruf verhält sich ebenso (melden statt ablehnen)
- [ ] `validateAgainstSchema`/`schemaValidator` bleiben als Validierungs-Engine erhalten
- [ ] E2E-Import der WHFB6-Fixture ist wieder grün (`npm test`)
- [ ] Bisherige „Ablehnung"-Tests sind auf Advisory-Verhalten umgestellt; keine stille Fehlverarbeitung

## Comments
- Import-Schema-Prüfung von Hard-Gate auf Advisory umgestellt (ADR 0016 Rev. 2026-07-18): collectSchemaWarnings ersetzt assertRawFilesConformToSchema; manueller Import und Laufzeit-Fork-Abruf parsen/speichern jetzt trotz Schemaverstoß und melden verortbare Verstöße (Datei + Zeile) als nicht-blockierende Warnung. Vite dev-server fs.allow um den (im Worktree ausgelagerten) xmllint-wasm-Pfad erweitert, damit der E2E-Browser-Import wieder lädt. WHFB6-E2E wieder grün.
