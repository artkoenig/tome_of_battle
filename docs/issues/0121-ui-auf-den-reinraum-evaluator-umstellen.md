---
status: active
branch: claude/ui-neue-engine-49yiie
pr:
---

# UI auf den Reinraum-Evaluator umstellen (Cutover, Solver-Abriss)

## Intent

Die Oberfläche bezieht Validierung, Verfügbarkeit und Anzeige-Daten heute aus
der alten Solver-Fassade (`src/solver/validator.js`), die per ADR-0030 als
fehlerhaft gilt und verschwinden soll. Der Reinraum-Evaluator
(`src/evaluator/`) ist seit Issue 75 cutover-fähig, wird aber von keiner
Produktiv-Datei konsumiert. Gewollt: Die UI liest den Evaluator-Bericht
(`violations` + `capabilities`) direkt — ohne Zwischenschicht, die das alte
Solver-Fehlerformat nachbaut — und `src/solver/` verschwindet vollständig,
in einem Zug (ein Branch, ein PR, Taskliste).

Acceptance criteria:

1. Kein Produktivcode importiert mehr aus `src/solver/`; alle heutigen
   Konsumenten der Solver-Fassade beziehen Validierung, Verfügbarkeit,
   Kosten, Namen, Profile und Kategorie-Grenzen aus der Evaluator-Fassade
   (`prepareDataset` / `evaluate` / `describeDataset`). Falsifizierbar per
   `grep "from .*solver" src/` außerhalb von `src/solver/` selbst.
2. `src/solver/` ist gelöscht, samt seiner Modultests. `npm test`,
   `npm run lint`, `npm run typecheck` und `npm run depcruise` laufen ohne
   ihn mit Exitcode 0; `package.json`-Skripte, Lint-/Depcruise-Regeln und
   die Doku (CLAUDE.md, betroffene ADR-Verweise) sind nachgezogen.
3. Ein produktiver Adapter übersetzt das App-Roster (IndexedDB-Modell,
   `src/types.js`) in den Evaluator-Roster-Vertrag, inkl. der
   Identitäts-Regel aus Issue 084: eine über einen `entryLink` gesetzte
   Auswahl wird unter der Link-Id übergeben. Beobachtbar: Grenzen, die am
   Link definiert sind, wirken in der UI (Verletzung erscheint, wenn sie
   überschritten werden).
4. Verletzungen erscheinen dem Nutzer als i18n-Texte, komponiert aus der
   sprachfreien Evaluator-Einordnung (ConstraintKind, LimitMeasure, Scope,
   Ist/Grenze, Verursacher) über neue, am Evaluator-Vokabular ausgerichtete
   `validation.*`-Schlüssel. Die alten, am Solver-`type` ausgerichteten
   Schlüssel sind entfernt. Autoren-Meldungen aus dem Katalog erscheinen
   mit ihrem Katalogtext.
5. Die Aushebe-Verfügbarkeit (Einheit hinzufügbar ja/nein, Optionen
   wählbar/gesperrt/versteckt/Pflicht) wird aus dem Fähigkeitsdatensatz
   (`capabilities`) abgelesen (ADR-0035). Der Baseline-Diff-Mechanismus und
   die Sperrtabelle `VIOLATION_BLOCKS_ADD_AVAILABILITY` existieren nicht
   mehr.
6. Die Nicht-Validierungs-Funktionen aus `src/solver/` (Roster-Abgleich
   nach Katalog-Update, spielbare Kataloge) sind mit unverändertem
   Verhalten umgezogen; Katalog-Metadaten kommen künftig aus
   `describeDataset`.
7. Die app-weiten Puppeteer-E2E-Tests (`ui.test.js`, `pwa.test.js`) sind
   aus `src/solver/` an ihren neuen Ort umgezogen und laufen grün; `npm
   test` ruft sie weiterhin auf.
8. `prepareDataset` läuft höchstens einmal je geladenem Datensatz (gecacht
   über Roster-Änderungen hinweg); nur `evaluate` läuft je
   Roster-Änderung. Falsifizierbar per Aufruf-Zähler im Test.

## Plan

**Module und ihre Rollen:**

1. **`src/evaluator/` (wächst, eine Erweiterung):** Der Bericht erhält eine
   Kostenprojektion — `SlotCapability.costs` (Eigenkosten je Instanz,
   `Record<costTypeId, number>`), `SlotCapability.totalCosts`
   (Teilbaum × Anzahl) und im `evaluate`-Ergebnis `costTotals`
   (roster-weit, `Record<costTypeId, number>`). Grund: ADR-0034 macht den
   Bericht zur alleinigen Quelle, und Kriterium 1 nennt Kosten ausdrücklich;
   heute liefert der Bericht nur Budget-*Verletzungen*, keine Summen.
   Sonst bleibt die Engine unverändert.
2. **`src/evaluation/` (neu, dünne App-Brücke, nur Eingaberichtung):**
   - `rosterAdapter.js`: `toEvaluatorRoster(roster) → { evalRoster,
     pathBySelectionId }`. Abbildung: Force-`defId` = `forceEntryId`,
     Selection-`defId` = `entryLinkId || selectionEntryId` (Link-Id-Regel,
     Issue 084), `count` = `number`, `children` = `selections`,
     `costLimits` = `[{ costTypeId: roster.costLimitType, value:
     roster.costLimit }]` (−1 = unbegrenzt). `pathBySelectionId` bildet
     App-Selection-UUIDs auf Slot-Pfade des Berichts ab (beim selben
     Durchlauf erzeugt).
   - `useEvaluation(system, roster) → { violations, capabilities,
     description, costTotals, pathBySelectionId }`: hält
     `prepareDataset(system.rawXmls…)` je System-Objektidentität gecacht
     (Kriterium 8); `describeDataset` aus demselben Griff.
3. **`src/i18n/violationMessages.js` (neu):** `formatViolation(violation,
   translate)` komponiert Text aus `origin`/`limit.kind`/`measure`/`scope` +
   Zahlen; Autoren-Meldungen geben ihren Katalogtext durch. Neue
   `validation.*`-Schlüssel am Enum-Vokabular; alte Solver-Schlüssel und
   `formatValidationError` sterben; Paritäts-/Abdeckungstests werden auf
   das neue Vokabular umgeschrieben.
4. **`src/roster/` (neu, Umzug des Schreibmodells, Verhalten unverändert):**
   Der Evaluator ist rein lesend — alles, womit die UI das App-Roster
   *erzeugt und editiert*, zieht aus `src/solver/` hierher: Selektions-Fabrik
   (`createSelectionFromDef`), Teilbaum-Editing (`withAddedInstance` u. a.),
   Baum-Helfer (`rosterTree`), Auflösung (`resolveEntry`,
   `findEntryInSystem`), `rosterSync` (`syncRosterSelectionsWithSystem`,
   `reconcileImportedSelectionIds`), Katalogauswahl, Quirk-/Keyword-
   Konstanten. Was dagegen *Anzeige aus Katalogdaten ableitet*
   (Verfügbarkeit, Grenzen, Namen, Profile, Kosten), kommt künftig aus dem
   Bericht, nicht aus diesem Modul.
5. **UI (22 Dateien):** lesen `violations` (Anzeige über
   `formatViolation`), `capabilities` (Verfügbarkeit inkl. `offerAnchor`
   für Ungewähltes, Kategorie-Grenzen aus `categoryAnchor`-Slots, Namen,
   `infoElements` für Profile/Regeln) und `costTotals`; Zuordnung
   Selection → Slot über `pathBySelectionId`.
6. **E2E/Kommandos:** `ui.test.js`, `pwa.test.js` und das
   `whfb6`-Fixture ziehen nach `e2e/`; `package.json`, `ci.yml`,
   `.oxlintrc.json`, `.dependency-cruiser.cjs` (Solver-Regeln raus,
   Evaluator-Fassaden-Zwang rein), CLAUDE.md, bsdata-Doku-Verweise und
   betroffene ADRs ziehen nach; `src/solver/` fällt zuletzt.

**Nicht offensichtliche Entscheidungen:**

- Kosten in den Bericht statt in ein umgezogenes Util, weil ADR-0034 die
  UI vom Nachrechnen ausschließt.
- Schreibmodell nach `src/roster/` statt in die Brücke, weil Erzeugen und
  Bewerten getrennte Verantwortungen sind und der Evaluator lesend bleibt.
- Slot-Pfad-Index entsteht im Adapter; ist das Pfadschema des Berichts
  extern nicht reproduzierbar, wird die Fassade um eine dokumentierte
  Pfadableitung ergänzt — die UI rät nie selbst.
- Systeme ohne `rawXmls` verlassen sich auf die bestehende
  Start-Migration (`src/db/migrations.js`); kein eigener Pfad in diesem
  Issue.

## Tasks

Landung in Zwischencommits auf dem Issue-Branch, in dieser Reihenfolge:

- [x] 1. Kostenprojektion im Evaluator-Bericht (`costs`/`totalCosts` je
  Slot, `costTotals` im Ergebnis) — evaluator-only, Tests zuerst
- [x] 2. Roster-Adapter `toEvaluatorRoster` inkl. `pathBySelectionId`
  (Link-Id-Regel, costLimits, −1) — Tests zuerst
- [x] 3. `useEvaluation`-Hook mit Datensatz-Cache — Aufruf-Zähler-Test
  (Kriterium 8)
- [x] 4. Meldungsprojektion `formatViolation` + neue i18n-Schlüssel
  (alte Schlüssel sterben erst mit dem Solver-Abriss)
- [ ] 5. UI-Umstellung Validierungspfad: useRoster → useEvaluation;
  Anzeige (ValidationMessage, Panel, Sidebar, ValidationCauses) über
  `formatViolation`
- [ ] 6. UI-Umstellung Verfügbarkeitspfad: CategoryUnitAdder,
  OptionGroup, SelectionConfigurator, AutoFillSuggestions lesen
  `capabilities` (ADR-0035; Baseline-Diff + Sperrtabelle entfallen)
- [ ] 7. UI-Umstellung Rest: Dashboard, PlayMode, Modals,
  rosterSerialization; Kosten aus `costTotals`, Profile aus
  `infoElements`
- [ ] 8. Schreibmodell-Umzug nach `src/roster/`: was die UI nach 5–7
  noch aus `src/solver/` importiert (Selektions-Fabrik, Baum-Editing,
  rosterSync, Katalogauswahl …), zieht verhaltensgleich um, Tests
  wandern mit (umgereiht: erst nach der UI-Umstellung ist der wahre
  Restbedarf sichtbar — was capabilities ersetzen, stirbt statt
  umzuziehen)
- [ ] 9. E2E-/Fixture-Umzug nach `e2e/`, Kommandos/CI/Lint-/Depcruise-
  Regeln nachziehen
- [ ] 10. `src/solver/` löschen, alte validation.*-Schlüssel raus,
  Doku (CLAUDE.md, bsdata-Doku, ADRs) nachziehen, Vollabnahme aller
  Kriterien

## Decisions

- **"Ohne Plugin" = keine Zwischenschicht.** Die UI konsumiert den
  Evaluator-Bericht direkt; es gibt keinen Kompatibilitäts-Layer, der das
  alte Solver-Fehlerformat nachbaut. Der Eingabe-Adapter App-Roster →
  Evaluator-Vertrag (Kriterium 3) ist davon ausgenommen — er übersetzt nur
  die Eingabe, nicht das Ergebnis. *(Quelle: Antwort des Menschen,
  Grill 2026-07-29.)*
- **Cutover in einem Zug.** Ein Issue, ein Branch, ein PR: alle
  UI-Konsumenten, Adapter, Meldungsprojektion, E2E-Umzug und Solver-Abriss
  zusammen; kein Zwischenzustand mit zwei Wahrheitsquellen. Der Umfang wird
  über eine Taskliste mit Zwischencommits gelandet. *(Quelle: Antwort des
  Menschen.)*
- **Meldungen: neue Projektion in der UI.** Neue `validation.*`-Schlüssel
  am Evaluator-Vokabular; die alten solver-gebundenen Schlüssel sterben.
  Sichtbare Textänderungen gegenüber heute sind akzeptiert. *(Quelle:
  Antwort des Menschen.)*
- **Solver-Reste: umziehen, Verhalten behalten.** Roster-Abgleich und
  Katalog-Auswahl wandern unverändert aus `src/solver/` heraus; eine
  Neukonzeption auf Evaluator-Begriffen ist ausdrücklich nicht Teil dieses
  Issues. *(Quelle: Antwort des Menschen.)*
- **Verhaltensabweichungen zum Solver sind erwartet.** Der Solver gilt per
  ADR-0030 als fehlerhaft; wo Evaluator und Solver abweichen, gilt der
  Evaluator. Es gibt keine Paritätsprüfung gegen den Solver. *(Quelle:
  ADR-0030; default, unanswered.)*
- **Zielort der app-weiten E2E-Tests** wählt der Implementierer sinnvoll
  (außerhalb von `src/solver/`, z. B. `e2e/`); festgelegt ist nur der Umzug
  selbst (Kriterium 7). *(Default, unanswered.)*
- **Akzeptanzkriterien 1–8 vom Menschen freigegeben.** *(Quelle: Antwort des
  Menschen, 2026-07-29.)*
- **Kategorie-Vererbungs-Sonderfall** (fehlendes Kategorie-Maximum aus
  anderer Kategorie geerbt) bleibt gemäß ADR-0034 undurchgesetzt, bis die
  externen Katalog-Forks korrigiert sind — keine Sonderbehandlung in diesem
  Issue. *(Quelle: ADR-0034; default, unanswered.)*

## Log

- 2026-07-29, Task 4 (Meldungsprojektion) erledigt: 23+Deckungs-Tests
  rot, dann grün ohne Testedit (`npx vitest run src/i18n` 236 Tests
  Exit 0; Regression evaluator+evaluation 871 Exit 0; lint/typecheck/
  depcruise Exit 0). Schema `validation.evaluator.<measure>.<kind>.
  <scopeGroup>[.percent]`, 77 Schlüssel je Sprache. Defaults: Enum-
  Literale stehen im Modul (Fassade re-exportiert die Enums nicht;
  Drift fängt der Deckungstest, der die echten Enums liest); Kostenart
  geht nur als `costTypeId`-Parameter mit, Klartext-Label wäre eine
  spätere Vertragserweiterung; de sagt "Kontingent" für force.
- 2026-07-29, Taskliste umgereiht: Schreibmodell-Umzug (alt Task 5)
  rückt hinter die UI-Umstellung (neu Task 8) — erst nach der
  Umstellung ist sichtbar, welche Solver-Module die UI noch braucht;
  was capabilities ersetzen, stirbt mit dem Solver statt umzuziehen.
- 2026-07-29, Task 3 (useEvaluation) erledigt: 18 rote Tests, dann grün
  ohne Testedit (`npx vitest run src/evaluation` 37 Tests Exit 0;
  Evaluator 834 Exit 0; lint/typecheck/depcruise Exit 0). Hook ist
  synchron im Render (die Tests legen das fest); Entkopplung des teuren
  Vorlaufs bleibt Sache der aufrufenden UI. Defaults: leere/fehlende
  gst-Liste und `roster undefined` verhalten sich wie "fehlt" →
  eingefrorenes, referenzstabiles Leer-Ergebnis. Alte Solver-i18n-
  Schlüssel sterben erst mit dem Solver-Abriss (Task 9), nicht in
  Task 4 — bis dahin laufen alt und neu parallel in den Locale-Dateien.
- 2026-07-29, Task 2 (Roster-Adapter) erledigt: 19 rote Tests, dann grün
  ohne Testedit (`npx vitest run src/evaluation` Exit 0; Evaluator-
  Regression 834 Tests Exit 0; lint/typecheck/depcruise Exit 0). Das
  Slot-Pfadschema (Kind-Indizes der Roster-Eingabe, synthetische Anker
  nur angehängt) war nur intern dokumentiert und steht jetzt als
  Vertragszusatz in der Fassaden-JSDoc; Gültigkeit nur ohne
  `unresolvedDefinition`-Diagnose. `costLimits` entfällt bei fehlendem
  `costLimitType` ganz. Kleinere Panne: der test-author-Bericht nannte
  25 Tests, die Datei hat 19 `it`-Blöcke — Zählfehler im Bericht, Datei
  unangetastet (per git diff belegt).
- 2026-07-29, Task 1 (Kostenprojektion) erledigt: test-author 15 rote
  Tests (`costProjection.test.js`), Implementierer grün ohne Testedit.
  `npx vitest run src/evaluator` 834 Tests Exit 0; lint/typecheck/
  depcruise Exit 0. Vertragsentscheidungen: deklarierte Kostenarten
  erscheinen in `costTotals` immer (ohne Vorkommen mit 0); `totalCosts`
  nutzt `instance.count` (absolute Zahlenbasis, §7.5), nicht das ggf.
  shared-skopierte `current`; Angebots-Anker zählen nicht in `costTotals`.
  Positive Überraschung: effektive Instanzkosten existierten bereits
  vollständig in der Effektiv-Werte-Schicht (Link-vor-Ziel, Modifikatoren)
  — die Projektion ist reine Lesearbeit im Bericht.
- 2026-07-29, Überraschung: `node scripts/measure-evaluator.js` liefert
  Exit 1 schon auf der unveränderten Baseline (per `git stash` belegt) —
  die 100-ms-Schwelle reißt seit jeher der jsdom-XML-Vorlauf, nicht die
  Auswertung (Wiederverwendungs-Zeile ~5–18 ms). Kein Blocker für 0121;
  ggf. eigenes Issue: Schwelle an der Wiederverwendungs-Zeile messen.
- 2026-07-29: Issue per Grill-Interview gefilt. Recherche-Briefing
  (researcher): 22 Nicht-Test-Dateien konsumieren die Solver-Fassade;
  zentraler Fluss `useRoster.js` (`validateRoster` per `useMemo`);
  Evaluator-Fassade zweistufig (`prepareDataset` teuer, `evaluate` rein);
  Roster-Vertrag weicht vom App-Modell ab (Link-Id-Regel, Issue 084);
  Meldungsprojektion und produktiver Adapter existieren noch nicht;
  Issue 75 (resolved) nennt genau diesen Cutover als offenes Folge-Issue.

## Checkpoints

### Before implementation

- **Does this match what was asked?** Ja — "UI auf die neue Engine, ohne
  Plugin" ist als Ein-Zug-Cutover ohne Ergebnis-Zwischenschicht spezifiziert
  und freigegeben; genau der Folge-Scope, den Issue 75 offen gelassen hat.
- **What surprised me?** "Plugin" kommt im Repo nirgends vor — die Lesart
  musste beim Menschen erfragt werden (Antwort: keine Zwischenschicht).
  Außerdem: es gibt noch keinerlei produktiven Evaluator-Konsumenten, der
  Adapter existiert nur als Test-Fixture.
- **What am I assuming without having verified it?** Dass der
  Evaluator-Bericht fachlich alles hergibt, was die 22 UI-Dateien heute vom
  Solver beziehen (Kosten, Namen, Profile, Kategorie-Grenzen) — Issue 75
  behauptet Cutover-Fähigkeit, aber der Beweis kommt erst beim Verdrahten.
  Und dass die E2E-Harness-Tests nach dem Umzug ohne Solver-Fixture laufen.

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
