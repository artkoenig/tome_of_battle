Status: ready-for-agent
Type: refactor
Blocked by: [01]

## Description

Die synthetische Paritätssuite der neuen Engine (36 Fälle, an Mini-Katalogen
nachgebaute Solver-Szenarien) ist der letzte synthetische E2E-Bestand. Nach der
Festlegung „keine synthetischen E2E-Tests mehr" wird sie aufgelöst:

- Szenarien, die sich in den echten Definitive-Edition-Katalogdaten wiederfinden,
  werden als **Real-Data-E2E neu abgebildet** (mit Assertions auf bekannte reale
  IDs/Werte), sodass keine Regel-Abdeckung verloren geht, die real belegbar ist.
- Rein synthetische Konstrukte ohne reales Gegenstück **entfallen ersatzlos**.
- Die B1/B2-Befunde (Kategorie-`max`-ohne-`min` wird nicht erzwungen;
  `forceEntry`-Punktelimit nicht direkt ausdrückbar) bleiben ausschließlich in
  ADR/Issue dokumentiert und werden nicht länger als Test geführt.

Ergebnis: nach dieser Slice existiert **kein synthetischer E2E-Test der neuen
Engine mehr**. Unit-/Komponententests bleiben unberührt.

## Acceptance Criteria
- [ ] Die synthetische Paritäts-E2E-Datei existiert nicht mehr.
- [ ] Jedes Paritätsszenario mit realem Gegenstück ist als Real-Data-E2E-Test
      gegen echte Katalogdaten neu abgebildet und grün.
- [ ] Kein E2E-Test der neuen Engine nutzt mehr einen synthetischen Katalog;
      alle E2E-Tests werten echte Katalogdaten aus.
- [ ] Die B1/B2-Befunde sind in ADR/Issue dokumentiert; es existiert kein Test
      mehr, der die Lücken als erwartetes Verhalten festschreibt.
- [ ] Alle Tests (`npm test`) sind grün.

## Comments
