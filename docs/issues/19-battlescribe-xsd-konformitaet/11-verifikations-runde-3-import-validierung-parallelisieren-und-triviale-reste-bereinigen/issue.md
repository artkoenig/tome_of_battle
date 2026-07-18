Status: resolved
Type: fix
Blocked by: None

## Description
Behebt die Funde der dritten Vier-Achsen-Verifikation von Main-Issue 19.
Keine Regressionen mehr gefunden; die Seam-Adoption ist bestätigt vollständig.
Offen sind ein substanzieller Robustheits-/Performance-Punkt und triviale
Code-Reste. Zeilennummern sind Orientierung — bei der Umsetzung selbst
verifizieren. `npm test` (inkl. Puppeteer-E2E) muss grün bleiben.

**Substanziell (B):**
- **Import-Validierung parallelisieren.** `collectSchemaWarnings`
  (`src/parser/importSchemaGate.js`) validiert im Import-Pfad (`Importer.jsx`)
  **sequenziell** pro Datei mit einem `xmllint-wasm`-`validateXML`-Aufruf. Bei
  mehreren Dateien summiert sich das (kalter WASM-Compile) und kann den E2E-Test
  nah an sein 15s-Wartelimit bringen (2/5 Läufe timeten intermittierend) — und
  verlangsamt reale Mehrdatei-Importe. Die Validierung so umbauen, dass sie nicht
  mehr strikt sequenziell pro Datei kalt läuft: z. B. die Aufrufe parallelisieren
  (`Promise.all`) und/oder das kompilierte Schema/den WASM-Modulzustand einmalig
  aufsetzen und wiederverwenden statt pro Datei neu. Ziel: deutlich reduzierte
  Gesamt-Importdauer bei gleichem Advisory-Verhalten (Warnungen unverändert,
  keine Ablehnung). Das Advisory-Verhalten und die verortbaren Warnungen dürfen
  sich nicht ändern.

**Trivial (A):**
- Toten Import `Upload` in `src/components/Importer.jsx` entfernen (Rest der
  Dead-Code-Bereinigung aus Kind-Issue 10).
- `minLimit` in `src/components/editor/OptionGroup.jsx` (berechnet, nirgends
  konsumiert): entweder in die Limit-Anzeige einbinden oder entfernen.
- `src/components/PlayMode.jsx`: das pro `.sort()`-Vergleich neu gebaute
  `costContext`-Objekt über den Sort hieven und den duplizierten
  „absteigend nach Kosten"-Comparator in einen gemeinsamen Helfer extrahieren
  (DRY + kleine Perf).

**Bewusst NICHT geändert (dokumentieren, nicht umbauen):** Der Ort von
`SELECTIONS_FIELD` im Parser-Layer (von `constraintScope.js` konsumiert) ist eine
vertretbare Geschmacksfrage ohne Zyklus; kein Umbau, um Churn zu vermeiden.

## Acceptance Criteria
- [ ] Import-Schema-Validierung läuft nicht mehr strikt sequenziell-kalt pro Datei (parallelisiert und/oder Schema/WASM wiederverwendet); Advisory-Verhalten + verortbare Warnungen unverändert
- [ ] Mehrdatei-Import ist messbar schneller; die E2E-Flakiness (`.desktop-nav-actions`-Timeout) tritt nicht mehr auf
- [ ] Toter `Upload`-Import entfernt; oxlint ohne diesen Fund
- [ ] `minLimit` in OptionGroup entweder genutzt oder entfernt
- [ ] PlayMode: `costContext` aus dem Sort-Vergleich herausgezogen, gemeinsamer Comparator
- [ ] `npm test` (inkl. Puppeteer-E2E) ist grün und stabil; keine Verhaltensregression

## Comments
- Import-Schema-Validierung parallelisiert: collectSchemaWarnings validiert nun pro Kind (gameSystem/catalogue) in EINEM xmllint-Aufruf (Schema einmal kompiliert, ein Worker) und beide Kinder via Promise.all nebenläufig statt sequenziell-kalt pro Datei; Advisory-Verhalten + verortbare Warnungen unverändert (per loc.fileName attribuiert). Bench 1 gst + 3 cat: 91ms -> 25ms. Trivial: toter Upload-Import entfernt, ungenutztes minLimit entfernt, PlayMode costContext aus dem Sort gehoben + gemeinsamer absteigend-nach-Kosten-Comparator. npm test (vitest + Puppeteer-E2E) 2x grün/stabil.
