---
status: active
branch: claude/neue-engine-ui-integration-5t7ohu
pr:
---

# Cutover: Oberfläche auf den Reinraum-Evaluator umstellen, alte Engine entfernen

## Intent

ADR-0030 hat entschieden, dass die Reinraum-Engine (`src/evaluator/`) die alte,
als fehlerhaft eingestufte Engine (`src/solver/`) vollständig ablöst; ein
Parallelbetrieb wurde ausdrücklich verworfen. Issue 75 hat die Engine dafür
ausgebaut — der Bericht trägt Angebot, eingeordnete Verletzungen, Profile,
Regeltexte und die roster-freie Datensatz-Beschreibung. Was fehlt, ist der
Cutover selbst: die Oberfläche bezieht heute 69 Namen aus der alten Fassade
(`src/solver/validator.js`, 22 Dateien) und importiert den Evaluator nirgends.

Nach dieser Änderung ist der Bericht der Reinraum-Engine die alleinige Quelle
der Oberfläche (ADR-0034); die Oberfläche projiziert ihn und rechnet nichts
nach. Die alte Engine ist gelöscht.

Acceptance criteria:

1. **Adapter.** Es gibt einen Adapter, der das App-Roster (Referenzmodell
   ADR-0011) in das Engine-Roster (`{ forces: [{defId, count, children}],
   costLimits }`) übersetzt und Engine-Anker (Pfade/defIds) zurück auf
   App-Selektions-Ids abbildet. Wenn ein App-Roster mit verlinkten Auswahlen,
   verschachtelten Kindern und Punktelimit übersetzt wird, dann trägt jede
   Auswahl die `entryLinkId` als `defId` und das Punktelimit erscheint als
   `costLimits`-Eintrag.
2. **Validierung aus dem Bericht.** Wenn ein Roster eine Grenze verletzt, dann
   zeigt die Validierungsanzeige (Panel, Einheitenkarten, Sidebar-Badges) die
   Verletzung aus dem Evaluator-Bericht: übersetzter Satz aus der sprachfreien
   Einordnung, Ursachen (ADR-0027), Autor-Meldungen im Katalog-Wortlaut
   (ADR-0028). `validateRoster` der alten Engine wird von keiner UI-Datei mehr
   aufgerufen.
3. **Meldungsschlüssel-Projektion.** Es gibt eine UI-seitige Projektion von
   Verletzungs-Einordnung (origin, ConstraintKind, LimitMeasure, ScopeKind,
   Ankerart) auf i18n-Schlüssel (ADR-0026). Wenn eine Verletzungsart im Bericht
   auftritt, die die Projektion nicht kennt, dann erscheint ein generischer,
   übersetzter Satz mit Grenzwert/Ist-Wert — nie ein roher Enum-Name.
4. **Verfügbarkeit aus Fähigkeitsdatensätzen.** Der Aushebe-Dialog und die
   Options-Darstellung lesen gesperrt/versteckt/Restspielraum aus den
   SlotCapabilities (ADR-0035). Das hypothetische Hinzufügen mit
   Validierungs-Diff (`entryAvailability.js`, ADR-0022) existiert nicht mehr.
5. **Zweistufigkeit.** `prepareDataset` läuft einmal je geladenem Datensatz
   (Systemladung/Katalog-Update), `evaluate` je Roster-Änderung auf dem
   wiederverwendeten `PreparedDataset`. Wenn ein Roster editiert wird, dann
   wird kein erneutes `prepareDataset` ausgelöst.
6. **Kein Solver mehr.** `src/solver/` ist samt Testsuite gelöscht; kein
   Import, keine Lint-/Depcruise-Regel und kein Skript verweist mehr darauf.
   Die anwendungsweiten Puppeteer-E2E-Tests sind aus dem Solver-Ordner
   umgezogen und laufen weiter.
7. **New-Roster-Fluss.** Der Anlege-Dialog bezieht spielbare Kataloge,
   Kostenarten (Klartext) und anlegbare Kontingente aus `describeDataset`.
8. **Spielmodus.** Der Spielmodus zeigt Profile, Regeltexte und Namen aus den
   `infoElements` des Berichts — einschließlich bedingt modifizierter
   Charakteristiken und Namen.
9. **Fakten per Exitcode.** `npm test`, `npm run lint`, `npm run typecheck`,
   `npm run depcruise` und `npm run analyze` enden mit Exitcode 0.

## Plan

**Module:**

- NEU `src/report/` — die UI-seitige Berichts-Schicht, künftig die **einzige**
  Stelle, die `src/evaluator/evaluator.js` importiert (Fassaden-Regel in
  oxlint/depcruise zieht vom Solver hierher um):
  - `datasetLifecycle.js` — `prepareDatasetForSystem(system)`: baut das
    `PreparedDataset` aus `system.rawXmls`, memoisiert je System; Re-Prepare
    nur bei Systemwechsel (Kriterium 5).
  - `rosterAdapter.js` — `toEngineRoster(roster)`.
  - `violationProjection.js` — Bericht-Verletzungen → UI-Fehlerform + i18n.
  - `reportSelectors.js` — Capability-/Kosten-/Options-Sichten für die
    Komponenten.
- NEU `src/roster/` — die engine-freien Roster-Baum-Helfer, aus dem Solver
  umgezogen (childSelectionsOf, mapSelectionTree, foldSelectionTree,
  withAddedInstance/withoutInstance/withChangedOptionCount,
  createSelectionFromDef, syncRosterSelectionsWithSystem,
  reconcileImportedSelectionIds, findSelectionInRoster, …).
- GEÄNDERT `src/evaluator/` — kleine Erweiterung: Kosten-Summen je Kostenart
  (roster-weit, je Kontingent, je Slot) in den Bericht; der Zählindex führt
  die Summen bereits (`tally.costSums`). `formatRules` nur, falls der
  Spielmodus sie braucht (Issue 75/08).
- GEÄNDERT: `useRoster.js`, `useRosterList.js`, `rosterSerialization.js`,
  die 19 Komponenten-Dateien.
- GELÖSCHT: `src/solver/` samt Testsuite; die anwendungsweiten
  Puppeteer-E2E ziehen vorher um.

**Verträge:**

1. **Engine-Roster:** `{ forces: [{ defId, count, children }], costLimits }`;
   `defId` = `entryLinkId` der Auswahl, sonst `selectionEntryId`; `count` =
   `number` (absolut); `costLimits` aus `roster.costLimit`/`costLimitType`.
   Rückweg: der Adapter baut beim Übersetzen einen Pfadindex
   `enginePath ↔ App-Selektions-Id`; Bericht-Anker werden darüber auf
   `selectionId`/`forceId` abgebildet.
2. **UI-Fehlerform bleibt:** `{ messageKey, messageParams, severity,
   forceId?, categoryId?, selectionId?, causes? }` — die Projektion erzeugt
   sie aus `{ origin, limit, anchor, actual, bound, delta, causes }`;
   unbekannte Einordnung → generischer Schlüssel mit Zahlen (Kriterium 3).
3. **Capability-Sicht:** Options-/Aushebe-/Badge-Entscheidungen lesen
   `effectiveMin/Max, current, headroom, isBlocked, isHidden,
   isMandatoryUnmet, isValueUnstable` — keine rohen Constraints, kein
   Modifier-Kontext in der UI. Radio/Checkbox folgt dem aktuellen effektiven
   Stand (Entscheidung Issue 75, „Eingabe-Widget folgt dem effektiven Stand").
4. **Lebenszyklus:** ein `PreparedDataset` je geladenem System, gehalten im
   Hook; `evaluate` im `useMemo` je Roster-Änderung (heutiger Ort:
   `useRoster.js`).

**Nicht-offensichtliche Entscheidungen:**

- Die UI-Fehlerform bleibt unverändert, damit die Rendering-Komponenten
  (ValidationMessage, Panel, Karten) minimal ändern — die Projektion trägt
  die Differenz.
- Kosten-Summen wandern in den Bericht statt in eine App-seitige
  Kostenrechnung: ADR-0034 (die UI rechnet nichts nach), und die Engine hat
  die Summen schon.
- Die Baum-Helfer sind App-Modell-Logik ohne Engine-Wissen → eigenes Modul
  `src/roster/`, überlebt die Solver-Löschung unverändert.
- Sprachliche Keyword-Konstanten des Solvers (UPGRADE_DETAILS_KEYWORDS,
  GENERAL_*_KEYWORDS, isQuirkGeneralEntryId) sind Anzeige-Quirks → ziehen in
  die UI-Schicht, nicht in die Engine.

## Tasks

1. [ ] Engine-Erweiterung: Kosten-Summen je Kostenart in den Bericht
   (roster-weit, je Kontingent, je Slot), aus dem bestehenden Zählindex.
2. [ ] `src/roster/`: engine-freie Baum-Helfer aus dem Solver umziehen;
   Solver re-exportiert übergangsweise, damit der Schnitt klein bleibt.
3. [ ] `src/report/`: Lifecycle, Roster-Adapter (inkl. Pfadindex),
   Verletzungs-Projektion, Selektoren — mit Unit-Tests (Kriterien 1, 3).
4. [ ] `useRoster.js`/`useRosterList.js` auf `evaluate` umstellen:
   Validierung, Kosten, Zählungen aus dem Bericht (Kriterien 2, 5).
5. [ ] Validierungsflächen: RosterValidationPanel, unitCardValidation,
   UnitSelectionCard, RosterSidebar, ValidationMessage (Kriterium 2).
6. [ ] Aushebe-Dialog aus Capabilities: CategoryUnitAdder;
   `entryAvailability.js`-Diff löschen (Kriterium 4).
7. [ ] Options-Flächen: OptionGroup, SelectionConfigurator,
   AutoFillSuggestions, upgradeDetails, UnitChips (Kriterium 4).
8. [ ] New-Roster-Fluss aus `describeDataset`: NewRosterModal,
   RosterEditorTopBar (Kriterium 7).
9. [ ] Kosten-/Anzeige-Flächen: RosterDashboard, RosterEditor, PlayMode,
   PlayUnitDetails, RosterCategorySection, CategoryCountBadge,
   ForceEditorSection, rosterSerialization (Kriterium 8; `formatRules` falls
   nötig).
10. [ ] Puppeteer-E2E aus `src/solver/` umziehen; `src/solver/` löschen;
    oxlint-/depcruise-Fassadenregeln auf `src/report/` umstellen
    (Kriterium 6).
11. [ ] Doku nachziehen (ADR-0022 als ersetzt markieren, ADR-0030-Stand,
    README, battlescribe-doku-Verweise auf Solver); Fakten per Exitcode;
    Screenshots der betroffenen Views (Kriterium 9).

## Decisions

- **Richtung ist entschieden, keine Rückfrage nötig:** vollständige Ablösung
  ohne Parallelbetrieb/Feature-Flag (ADR-0030, Option 3 verworfen); der Umfang
  ist wörtlich das in Issue 75 „Out of Scope" benannte Folge-Main-Issue.
  Quelle: ADR-0030, Issue 75.
- **Roster-XML-Quelle:** Die Roh-XMLs liegen bereits in IndexedDB
  (`system.rawXmls`, `src/db/systemImport.js:66`) — `prepareDataset` braucht
  keinen Download. Quelle: Researcher-Briefing.
- **`formatRules`** (Charakteristik-Anzeige-Mapping) wandern laut Issue 75/08
  während des Cutovers in den Bericht — gehört zu diesem Issue, falls der
  Spielmodus sie braucht. Quelle: Issue 75, Kommentar 08.

## Log

- Researcher-Briefing eingeholt: 69 Namen/22 UI-Dateien an
  `src/solver/validator.js`; zentrale Validierung in `useRoster.js` (useMemo,
  synchron je Änderung); Evaluator-Fassade zweistufig, Wiederverwendung des
  `PreparedDataset` ist Sache des Aufrufers; Messung: evaluate 3,9–5,7 ms in
  Chrome auf realen Katalogen, Vorbereitung 96–99 % der Gesamtzeit (reißt
  allein die 100-ms-Schwelle — Wiederverwendung ist Pflicht).
- Bekanntes Risiko für den Adapter: der Roster-Vertrag der Fassade ist
  ungeschrieben (Issue 084); die Engine nimmt absolute Stückzahlen an
  (`number` als Gesamtzahl, nicht per-Eltern-Multiplikator).

## Checkpoints

### Before implementation

- **Does this match what was asked?** Ja. „Neue Engine an die UI anschließen"
  ist wörtlich das in Issue 75 als Folge-Main-Issue benannte Cutover; die
  Richtung (vollständige Ablösung, kein Flag) ist durch ADR-0030 entschieden.
- **What surprised me?** (a) `prepareDataset` allein reißt die 100-ms-Schwelle
  (96–99 % der Gesamtzeit) — die Zweistufigkeit ist nicht Kür, sondern
  Pflicht. (b) Die SlotCapabilities tragen keine Kosten — Kosten-Summen
  fehlen im Bericht und brauchen eine kleine Engine-Erweiterung. (c) Es gab
  trotz Branch-Namens weder Issue noch angefangene Arbeit — die Session
  startet bei null.
- **What am I assuming without having verified it?** (a) Das `number` des
  App-Rosters ist eine absolute Stückzahl, wie die Engine sie annimmt
  (Issue 084 ist offen; der Adapter-Test muss das festnageln). (b) Alle in
  IndexedDB gespeicherten Systeme tragen `rawXmls` — ältere Importe könnten
  es nicht tun; früh prüfen, sonst braucht der Cutover eine
  Re-Import-Aufforderung. (c) Die Capability-Signale reichen für alle
  Radio/Checkbox/Stepper-Entscheidungen der Options-Flächen (Issue 75 sagt
  ja; die Options-Tasks zeigen es).

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
