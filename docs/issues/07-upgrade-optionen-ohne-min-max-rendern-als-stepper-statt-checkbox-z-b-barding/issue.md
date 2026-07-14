Status: resolved
Blocked by: None

## Description

**Typ:** Bug (Editor-UI / Option-Rendering-Heuristik).

**Aktuelles Verhalten:** Binäre Ja/Nein-Upgrades werden im Editor als
Mengen-Stepper (−/[n]/+) statt als Checkbox gerendert. Aufgefallen bei „Barding"
am berittenen Vampir (Nightmare-Reittier), betrifft aber viele Optionen.

**Erwartetes Verhalten:** Ein einzeln wählbares Upgrade (z. B. Barding, ein
Reittier, eine magische Waffe/Rune) erscheint als Checkbox. Echte Mengen-Upgrades
(Einheitsgröße) bleiben Stepper.

**Root Cause (analysiert):**
- Die Render-Heuristik in `src/components/editor/OptionGroup.jsx:388-389` stuft
  eine Option **ohne `max`-Constraint** (und nicht mandatory, nicht Radio) als
  `isExplicitlyMulti` ein → `isBinary=false` → Stepper (`OptionGroup.jsx:560-583`),
  statt Checkbox (`OptionGroup.jsx:548`).
- Ursache im Katalog: viele `upgrade`-Einträge tragen keinen `max=1`-Constraint.
  Beispiel Vampire Counts: die eigenständige Barding-Instanz (`8c32-a1a7-bef8-d6fc`)
  hat `max=1`, die reittier-genesteten Barding-Instanzen (`3fa3…`, `899e…`, `03a8…`,
  `f843…`) haben **gar keinen** Constraint. E2E verifiziert: gesammelte Option liefert
  `entryConstraints: []`, `groupConstraints: null`.

**Umfang (katalogweite Suche):** **98 sichtbare, nicht-collective `upgrade`-Optionen
ohne `min` und ohne `max`** in **12 von 16 Katalogen** rendern fälschlich als Stepper
(Vampire Counts 42, Ogre Kingdoms 11, Dogs of War 10, Dwarfs 8, Empire 7, Skaven 6,
Dark Elves/Lizardmen je 3, Chaos/High Elf/O&G/Wood Elf je 2). Betroffene sind
durchweg binär: Barding, Mounts (Cold One, Warhorse, Pegasus, Disc of Tzeentch),
magische Waffen/Gegenstände/Runen (Frostblade, Blood Drinker, Sword of…, RUNE OF…),
Handguns. Nur **2** echte Mengen-Upgrades (`Ungors` min=5, `Kroxigor`) haben
`min>0` ohne `max` und sind als Stepper korrekt.

**Unterscheidungssignal:** Der `min`-Constraint. „Kein `min` und kein `max`" →
binär (Checkbox). „`min>0` ohne `max`" → echte Menge (Stepper).

**Lösungsansatz (empfohlen, ADR-0003-konform, generisch — keine armeespezifische
Sonderlogik):** Verfeinerung der Heuristik in `OptionGroup.jsx`: Eine
nicht-`collective` `upgrade`-Option **ohne `min` und ohne `max`** ist **binär**
(Checkbox). Ein Stepper entsteht nur bei positivem Mengen-Signal (`max>1`, `min>0`,
`collective`, oder echter Repeat-Modifier). Betroffen sind zwei Stellen:
`isExplicitlyMulti` (Zeile 388) und die `isBinary`-Ableitung (Zeile 389).
Verworfen: Daten-Fix per `systemQuirks.js` (98 Einträge über 12 Kataloge → nicht
wartbar) und pauschales „kein max → Checkbox" (würde `Ungors`/`Kroxigor` fälschlich
auf 1 kappen).

**Abgrenzung:** Unabhängig von Issue 05 (dort Modifier-/Kategorie-Auswertung im
Solver; hier reine UI-Render-Heuristik). Versteckte Einträge (`hidden="true"`)
bleiben ausgeschlossen.

## Acceptance Criteria
- [ ] Barding am berittenen Vampir rendert als Checkbox (nicht als Stepper).
- [ ] Nicht-`collective` `upgrade`-Optionen ohne `min` und ohne `max` rendern
      generell als Checkbox; keine armeespezifische Sonderlogik.
- [ ] Echte Mengen-Upgrades bleiben Stepper: `Ungors` (min=5) und `Kroxigor`
      (min>0, kein max) werden nicht auf max 1 gekappt.
- [ ] Bestehende Einstufungen unverändert: Optionen mit `max=1` bleiben Checkbox,
      `max>1` bleibt Stepper, Radio-Gruppen (Gruppe max=1) bleiben Radios,
      Pflicht-Optionen (min==max>0) bleiben mandatory.
- [ ] Regressionstest deckt Checkbox- (kein min/max) vs. Stepper-Fall (min>0) ab.
- [ ] Volle Suite grün; katalogweiter Sweep zeigt keine ungewollten Umstufungen.

## Comments
- Umgesetzt in src/components/editor/OptionGroup.jsx (Render-Heuristik, Zeilen ~384-393): isCollective vor die Heuristik gezogen; neues Signal hasQuantitySignal = (min>0 || collective). Eine upgrade-Option ist nur dann Stepper, wenn ein positives Mengen-Signal vorliegt (max>1, Repeat-Modifier, oder ohne max: min>0/collective). Ohne min und ohne max (nicht-collective, nicht-radio) ist sie jetzt binär -> Checkbox. isBinary um den '!maxConstraint'-Zweig ergänzt, damit diese Optionen tatsächlich als Checkbox rendern statt in den Stepper-Else-Zweig zu fallen. Keine armeespezifische Sonderlogik (ADR-0003-konform). Regressionstests 19 (Barding: kein min/max -> Checkbox) und 20 (Ungors min=5 -> bleibt Stepper) in OptionGroup.test.jsx ergaenzt. Volle Suite gruen: 246 Tests (25 Dateien) + E2E-UI-Test bestanden; Lint ohne neue Fehler.
