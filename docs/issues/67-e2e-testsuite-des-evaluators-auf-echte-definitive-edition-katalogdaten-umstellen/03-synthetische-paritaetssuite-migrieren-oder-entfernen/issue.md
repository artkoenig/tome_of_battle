Status: resolved
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
- Szenario→Disposition-Mapping der geloeschten synthetischen Paritaetssuite (e2e.solverParity.test.js, Bloecke A–I). "Real re-expressed" = das Verhalten wird von einem Real-Daten-E2E gegen echte DE-Daten abgedeckt; "Dropped" = rein synthetisches Konstrukt ohne reales Gegenstueck / punkte-getriebenes Budget, nicht selektionsdrehbar; "Removed (Befund)" = Luecken-fixierender Test, entfernt und in ADR-0032 dokumentiert.

A. Pflichtselektoren
- A.1/A.2 roster-/force-weite Pflicht-MIN (fehlt→Verletzung, vorhanden→erfuellt): REAL — General/Core-MIN, bestehende Ogre/O&G/VC-Suiten (leeres Kontingent feuert, konforme Liste sauber).
- A.3 doppelt codierte Pflicht → 1 Verletzung + DUPLICATE_DEFINITION: DROPPED — reale DE-GUIDs sind eindeutig, kein reales Gegenstueck. (Achtung: war die einzige Testabdeckung des Resolver-Dedup-Pfads, siehe Rueckmeldung.)

B. Eintrags-Constraints
- B.1/B.2 Kontingent-Hoechstzahl (scope=force) ueber/an Grenze: DROPPED — kein realer force-scoped Entry-MAX unter den verifizierten Konstanten; MAX-Durchsetzung+Grenzverhalten real via Tyrant (roster-scope) abgedeckt.
- B.3 roster-weites MAX ueber getrennte Positionen (Aggregation): REAL — Tyrant max 1, zwei Instanzen aggregieren zu 2 (bestehende Ogre-Suite).
- B.4 unaufloesbare Auswahl → Diagnose statt Absturz: REAL (NEU) — Ogre-Datensatz + Bogus-defId → UNRESOLVED_DEFINITION, Bericht vollstaendig (e2e.ogreKingdoms.test.js).

C. Kategorie-Constraints
- C.1 Kategorie-MIN feuert bei leerer Armee: REAL — General/Core-MIN (bestehend) + NEU Zwei-Kontingent-Test.
- C.2 Kategorie-MIN armeeweit erfuellt sobald irgendein Kontingent traegt: REAL (NEU) — Zwei-Kontingent-Test, ein Kontingent erfuellt → keine Verletzung (§7.7, e2e.ogreKingdoms.test.js).
- C.3/C.4 Kategorie-MAX armeeweit: DROPPED — kein realer Kategorie-MAX-Grenzwert unter den verifizierten Konstanten; der armeeweite Zaehl-Mechanismus (§7.7) ist ueber die MIN-Seite (C.2) real abgebildet.
- C.5 max="-1" unbegrenzt: DROPPED — rein synthetische Charakterisierung.
- C.6 endliche reine MAX-Kategorie wird nicht erzwungen: REMOVED (Befund B1) — in ADR-0032 dokumentiert, kein Luecken-fixierender Test mehr.

D. Gruppen-/Optionslimits (Kosten-/Punktebudgets)
- D.1 Magic-Budget, D.3 kategoriegebundene Option, D.4 andere Kostenart (abs/%): DROPPED — synthetische Kostenbudget-Konstrukte, nicht aus einem Unit-Count-Roster gegen verifizierte reale Konstanten treibbar.
- D.2 per Modifikator angehobenes Limit: DROPPED (synthetische Magic-Item-Spezifika) — der Mechanismus „bedingter Modifikator aendert eine Grenze" ist real via Core set→1 (Border Patrols) in der Ogre-Suite abgedeckt.

E. Armee-Punkteuntergrenze (B2-Workaround): DROPPED — synthetischer Kostentest; Befund B2 in ADR-0032 dokumentiert, kein Luecken-fixierender Test.

F. multiply (Kosten-Verdopplung / Nicht-Kosten-multiply): DROPPED — kein multiply-Modifikator unter den verifizierten realen Regeln der drei Armeen.

G. §7.7 / shared
- G.1 Entry-Ziel scope=force pro Kontingent: DROPPED — kein realer force-scoped Entry-MAX; §7.7-Prinzip real via Kategorie-armeeweit (G.2) abgebildet.
- G.2 Kategorie-Ziel armeeweit unter scope=force: REAL (NEU) — Zwei-Kontingent-§7.7-Test (e2e.ogreKingdoms.test.js).
- G.3 shared=true/false: DROPPED — synthetischer shared-Attribut-Toggle, kein reales Gegenstueck.

H. Dokumentreihenfolge (gestapelte increment+set, nicht-kommutierend): DROPPED — rein synthetisches Konstrukt.

I. Prozentgrenze (MIN % mit kaufmaennischer Rundung): DROPPED — kosten-/punktegetrieben, nicht aus einem Unit-Count-Roster gegen verifizierte Konstanten treibbar.

Ergebnis: kein E2E-Test der neuen Engine nutzt mehr einen synthetischen Katalog; alle vier E2E-Dateien (Ogre, O&G, VC, realCatalog.smoke) werten echte DE-Daten aus. Zwei real belegbare, bislang ungedeckte Verhalten (§7.7-Kategorie-armeeweit; unaufloesbare Auswahl→Diagnose) neu als Real-Daten-E2E abgebildet.
- Umgesetzt: e2e.solverParity.test.js (synthetische 36-Fall-Suite) geloescht. Real belegbare, bislang ungedeckte Verhalten als Real-Daten-E2E neu abgebildet in e2e.ogreKingdoms.test.js: (1) §7.7 Kategorie-Ziel zaehlt armeeweit ueber Kontingente (Zwei-Kontingent-Test), (2) unaufloesbare Roster-Auswahl → UNRESOLVED_DEFINITION-Diagnose statt Absturz. Uebrige Paritaets-Szenarien entweder bereits durch die bestehenden Ogre/O&G/VC-/Smoke-Suiten real abgedeckt oder als rein synthetisch/punktegetrieben ersatzlos entfallen (Mapping oben). B1/B2-Befunde dauerhaft in ADR-0032 dokumentiert; kein Luecken-fixierender Test mehr. Kein E2E-Test der neuen Engine nutzt noch einen synthetischen Katalog. npm test gruen (1779 Vitest-Tests + Puppeteer-E2E).
