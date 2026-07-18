Status: resolved
Type: fix
Blocked by: None

## Description
Behebt die Funde der zweiten Vier-Achsen-Verifikation von Main-Issue 19.
Gemeinsame Wurzel der Code-Funde: die in Kind-Issue 06/09 eingeführten Seams
(`getEffectiveModifiers`, der `EvaluationContext` von `getSelectionTotalCost`)
wurden **nicht an allen Konsum-Stellen** adoptiert. Ziel: die Seams durchgängig
durchziehen und mit Regressionstests absichern. Zeilennummern sind Orientierung —
bei der Umsetzung selbst verifizieren. `npm test` (inkl. Puppeteer-E2E) muss grün
bleiben.

**Code — echte Konsistenz-/Regressions-Bugs:**
- **A1 – Play-Mode-Kostenregression.** `getSelectionTotalCost` erwartet seit 09
  `(selection, costLimitType, parentCount, context)` mit `EvaluationContext`. Fünf
  Play-Mode-Call-Sites (`PlayUnitDetails.jsx`, `PlayMode.jsx` ×4) rufen noch die
  alte 8-Argument-Positionsform auf → `system` landet im `context`-Slot,
  `roster`/`catalogueId` werden verworfen → modifier-bewusste Kostenberechnung in
  Play-Mode still deaktiviert, Sortierung nach unmodifizierten Kosten. Auf die neue
  Kontext-Signatur migrieren.
- **B1 – `OptionGroup.jsx` ignoriert `getEffectiveModifiers`.** Die Datei liest an
  ~6 Stellen rohe `group.modifiers`; modifierGroup-gegatete Gruppen-Constraints
  (min/max/Punkte-Limit) werden vom `rosterValidator` durchgesetzt, aber in
  Gruppen-Limit-Anzeige, `isRepeatableWithinGroup` und `hasGroupError`-Styling
  ignoriert → UI widerspricht der Validierung. Auf `getEffectiveModifiers` umstellen.
- **B2 – `entryVisibility.js:isCategoryLinkHidden`.** Übergibt rohe
  `link.modifiers` an `evaluateHiddenFlag` (im Gegensatz zum migrierten
  `isSelectionEntryHidden` direkt darunter). Auf `getEffectiveModifiers` umstellen.
- **B3 – `optionsCollector.js`.** `getEffectiveModifiers(resolvedChild).concat(child.modifiers || [])`
  hängt die Link-eigenen Modifier roh an und verwirft deren modifierGroup-gegatete
  Modifier. Auch die des Links über `getEffectiveModifiers` auflösen.
- **Regressionstests** ergänzen, die diese Pfade abdecken (Play-Mode-Kostenanzeige;
  modifierGroup-gegatete Gruppen-Constraints in `OptionGroup`; `isCategoryLinkHidden`),
  damit die Lücken künftig gefangen werden.

**Docs:**
- **D1 – Widerspruch `README.md` (~Z. 79).** Behauptet, `.cat`/`.gst`/**`.ros`**
  würden gegen die XSD geprüft; der Roster-Import (`handleImportRoster` in
  `App.jsx`) validiert aber **nicht**. Text auf die tatsächliche Prüfung
  (nur Katalog-/Spielsystem-Dateien beim `.bsz`-Import) korrigieren.
- **D2 – `PROVENANCE.md` (~Z. 23-25).** „(later)" ist stale — die
  Laufzeit-Importvalidierung ist implementiert. Formulierung aktualisieren.

**Kleinkram (low, optional aber im Rahmen „alles beheben"):**
- Tote `false && (...)`-JSX-Blöcke in `Importer.jsx` entfernen (oder hinter echtes
  Flag legen).
- `DEFAULT_CONSTRAINT_FIELD`/`DEFAULT_CONSTRAINT_SCOPE` (`xmlParser.js`) mit dem
  semantisch gleichen `SELECTIONS_FIELD` (`constraintScope.js`) zusammenführen.

## Acceptance Criteria
- [ ] A1: alle Play-Mode-Call-Sites nutzen die neue `getSelectionTotalCost(…, context)`-Signatur; modifier-bewusste Kosten in Play-Mode wieder aktiv
- [ ] B1: `OptionGroup.jsx` nutzt `getEffectiveModifiers` für Gruppen-Modifier; Limit/Repeatable/Fehlerzustand stimmen mit der Validierung überein
- [ ] B2: `isCategoryLinkHidden` löst Modifier über `getEffectiveModifiers` auf
- [ ] B3: `optionsCollector.js` berücksichtigt auch die modifierGroup-gegateten Modifier des Links
- [ ] Regressionstests decken Play-Mode-Kosten, OptionGroup-Gruppen-Gating und `isCategoryLinkHidden` ab
- [ ] D1: `README.md` behauptet keine XSD-Prüfung für `.ros` mehr (Text entspricht dem Code)
- [ ] D2: `PROVENANCE.md` beschreibt die Laufzeit-Validierung als implementiert
- [ ] Tote `false &&`-Blöcke entfernt; `DEFAULT_CONSTRAINT_FIELD/SCOPE` mit `SELECTIONS_FIELD` konsolidiert
- [ ] `npm test` (inkl. Puppeteer-E2E) ist grün; keine Verhaltensregression

## Comments
- Adopted the getEffectiveModifiers and getSelectionTotalCost(context) seams at all named sites: A1 Play-mode cost calls migrated to the EvaluationContext object (PlayMode.jsx x4, PlayUnitDetails.jsx); B1 OptionGroup.jsx now resolves group modifiers via getEffectiveModifiers; B2 isCategoryLinkHidden and B3 optionsCollector link modifiers resolved through the seam. D1 README no longer claims .ros XSD validation; D2 PROVENANCE '(later)' updated. Cleanups: removed dead false&& blocks + orphaned drag handlers in Importer.jsx; consolidated DEFAULT_CONSTRAINT_FIELD into exported SELECTIONS_FIELD. Added regression tests (PlayMode/PlayUnitDetails cost signature, OptionGroup modifierGroup gating, isCategoryLinkHidden group gating, optionsCollector link gating). Full suite green.
