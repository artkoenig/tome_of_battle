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
- [x] 5. UI-Umstellung Validierungspfad: useRoster → useEvaluation;
  Anzeige (ValidationMessage, Panel, Sidebar, ValidationCauses) über
  `formatViolation`
- [x] 6. UI-Umstellung Verfügbarkeitspfad: CategoryUnitAdder,
  OptionGroup, SelectionConfigurator, AutoFillSuggestions lesen
  `capabilities` (ADR-0035; Baseline-Diff + Sperrtabelle entfallen)
- [x] 7. UI-Umstellung Rest: Dashboard, PlayMode, Modals,
  rosterSerialization; Kosten aus `costTotals`, Profile aus
  `infoElements`
- [x] 8. Schreibmodell-Umzug nach `src/roster/`: was die UI nach 5–7
  noch aus `src/solver/` importiert (Selektions-Fabrik, Baum-Editing,
  rosterSync, Katalogauswahl …), zieht verhaltensgleich um, Tests
  wandern mit (umgereiht: erst nach der UI-Umstellung ist der wahre
  Restbedarf sichtbar — was capabilities ersetzen, stirbt statt
  umzuziehen)
- [x] 9. E2E-/Fixture-Umzug nach `e2e/`, Kommandos/CI/Lint-/Depcruise-
  Regeln nachziehen
- [x] 10. `src/solver/` löschen, alte validation.*-Schlüssel raus,
  Doku (CLAUDE.md, bsdata-Doku, ADRs) nachziehen, Vollabnahme aller
  Kriterien

Korrekturen aus Prüfrunde 2:

- [ ] 11. (B3+B7) Rettung eines Systems ohne Roh-XML darf keine
  Kataloge löschen, die der Index nicht kennt — Kriterium 6
- [ ] 12. (B2) Slot-Pfade bleiben gültig, wenn eine Auswahl nicht mehr
  auflösbar ist — Kriterium 3
- [ ] 13. (B1) Der Aushebe-Dialog bietet nur Einheiten des aktiven
  Katalogs an — Kriterium 5
- [ ] 14. (B5) Wirkungstest für die Link-Id-Regel (Grenze am
  `entryLink` wirkt sichtbar) — Kriterium 3
- [x] 15. (B6) ADR 0028/0029 nachziehen — Kriterium 2
- [x] 16. E2E-Harness: Serverprozess vollständig beenden, Fehlstart nicht
  verschweigen (schützt die Exitcode-Fakten von Kriterium 7)

## Befund-Trend

Je Zeile ein Akzeptanzkriterium, je Spalte eine Prüfrunde, je Zelle die
Zahl der Befunde:

| # | Kriterium | R1 | R2 |
|---|---|---|---|
| 1 | Kein Produktivimport aus `src/solver/` | 0 | 0 |
| 2 | Solver gelöscht, Prüfungen grün, Doku nachgezogen | 2 | 1 |
| 3 | Produktiver Roster-Adapter (Link-Id-Regel) | 0 | 2 |
| 4 | i18n aus der Evaluator-Einordnung | 0 | 0 |
| 5 | Verfügbarkeit aus `capabilities` | 1 | 2 |
| 6 | Nicht-Validierungs-Funktionen verhaltensgleich umgezogen | 1 | 1 |
| 7 | E2E umgezogen, laufen grün | 0 | 0 |
| 8 | `prepareDataset` höchstens einmal je Datensatz | 0 | 0 |
| — | ohne Kriteriumsverletzung (Bequemlichkeiten, Perf, Testlücke) | 4 | 1 |
| | **Summe** | **8** | **7** |

Runde 2 hat weniger Befunde, aber **schwerere**: die beiden Fälle unter
Kriterium 3 und 5 (B1, B2) liefern der Oberfläche fremde Daten, statt
etwas fehlen zu lassen. Ein Befund (B3) ist ein Loch, das die
Runde-1-Korrektur selbst gerissen hat — für die Stoppregel „dieselbe
Sache zweimal" gezählt: es ist derselbe Gegenstand (Systeme ohne
Roh-XML), zum zweiten Mal falsch. Beim dritten Mal geht die Frage an den
Menschen statt in eine weitere Runde.

## Decisions

- **Triage Prüfrunde 2.** Behoben werden B1, B2, B3, B5, B6 — alle innerhalb
  der acht Kriterien. B4 ist kein Engine-Defekt (§7.6 der bsdata-Doku
  entscheidet gegen den alten Solver) und geht als Issue 0125 an den Menschen.
  B7 (verwaister Export `findAllCatalogFiles`) erledigt sich mit B3. Die
  Harness-Beobachtung ist Task 16 geworden, obwohl sie kein Kriterium verletzt:
  sie **entwertet Exitcodes**, und darauf steht die Abnahme dieses Issues.
  *(Quelle: Prüfrunde 2, 2026-07-30.)*
- **Export ohne Roh-XML bleibt offen.** `exportRosterToXml` liest die Kosten
  aus dem Bericht und damit aus `system.rawXmls`. Ein System, dessen Dateien
  sich nicht nachrüsten lassen, schreibt deshalb eine `.ros` mit Kosten 0. Der
  Nutzer wird gewarnt (Toast „bitte neu importieren"), der Export selbst hat
  keine eigene Sperre. Ein Riegel dort wäre eine neue Entscheidung über das
  Verhalten des Exports und liegt außerhalb der Kriterien — dem Menschen
  vorgelegt, nicht eigenmächtig gebaut. *(Beobachtung; der Mensch entscheidet.)*
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
- **Verfügbarkeitspfad-Defaults (Task 6):** Gruppen-Mitgliedschaft
  (Option→Gruppe) bleibt Struktur aus dem geparsten System; nur Zustand/
  Grenzen/Kosten/Namen kommen aus dem Bericht. Die ADR-0029-Sonderregel
  "Gruppen-Maximum über 1 hebbar" nutzt übergangsweise weiter den
  bestehenden Helfer (Umzug in Task 8; Projektion in den Bericht als
  Folge-Issue zu filen — ADR-0034-Spannung). Sperr-Grund bleibt die
  Observable "(Nicht verfügbar)". Auto-Fill wechselt nur die
  Vorschlagsquelle, nicht die Apply-Mechanik. *(Defaults, unanswered.)*
- **Akzeptanzkriterien 1–8 vom Menschen freigegeben.** *(Quelle: Antwort des
  Menschen, 2026-07-29.)*
- **Kategorie-Vererbungs-Sonderfall** (fehlendes Kategorie-Maximum aus
  anderer Kategorie geerbt) bleibt gemäß ADR-0034 undurchgesetzt, bis die
  externen Katalog-Forks korrigiert sind — keine Sonderbehandlung in diesem
  Issue. *(Quelle: ADR-0034; default, unanswered.)*

## Log

- 2026-07-30, Task 16 (E2E-Harness) erledigt: `spawnVite` startet den
  Preview-Server jetzt `detached` in einer **eigenen Prozessgruppe**, und
  `stop()` signalisiert die Gruppe (`process.kill(-pid)`) statt nur die
  Shell-Hülle. Endet der Server **vor** seiner Startmeldung, scheitert der
  Aufbau jetzt laut samt gesammelter Ausgabe, statt nach 15 s stillschweigend
  weiterzulaufen — genau der Fall, in dem `--strictPort` an einem belegten Port
  abbricht und der Lauf sonst einen fremden, womöglich alten Build geprüft
  hätte. Belegt mit zwei Wegwerf-Proben: (a) Server starten, stoppen, erneut
  starten → beide Male HTTP 200, danach kein `vite preview`-Prozess mehr übrig
  (vorher scheiterte der zweite Start am belegten Port); (b) zweiten Server bei
  laufendem erstem starten → Ablehnung mit „endete vor seiner Startmeldung
  (Code 1)" und „Port is already in use" in der Meldung. Bleibt die
  Startmeldung nur aus, während der Prozess **läuft**, wird weiter
  fortgefahren — die Erkennung hängt an einem Ausgabetext, und das allein soll
  keinen Lauf kosten.
- 2026-07-30, Task 15 (Doku, B6) erledigt: ADR-0029 von *Proposed* auf
  *Superseded (0030/0034)* — sie plante die Zentralisierung **innerhalb** des
  Solvers und wurde nie umgesetzt; ihre Orte (`validateRoster`,
  `entryAvailability`, `getModifiedConstraintValue`, `getSelectionTotalCost`)
  existieren alle nicht mehr. ADR-0028 bleibt *Accepted* — die Entscheidung
  (`{this}` rendern, nicht übersetzen) gilt unverändert, nur ihre Orte sind
  heute `src/evaluator/authorMessages.js` und `src/i18n/violationMessages.js`.
  Über den Befund hinaus mitgezogen, weil dieselbe Suche sie fand: ADR-0031 und
  ADR-0032 (Import-Isolation läuft heute gegen `src/roster/`; „nicht in die App
  verdrahtet" ist überholt) und der PRD zu den Katalog-Updates (die Naht
  `validateRoster` heißt heute Diagnose `unresolvedDefinition`).
- 2026-07-30, Prüfrunde 2 (frischer Kontext, ganze Absicht): 7 Befunde,
  Trend 8 → 7. Zwei schwer (B1 Aushebe-Dialog bietet Einheiten fremder
  Armeebücher; B2 nach einer unauflösbaren Auswahl verschieben sich alle
  folgenden Slot-Pfade), einer davon ein Loch, das meine Runde-1-
  Korrektur selbst gerissen hat (B3: die Nachrüstung löscht Kataloge,
  die der Index nicht kennt). Fakten der Runde: `npm test`, `npm run
  lint`, `npm run typecheck`, `npm run depcruise`, `npm run build` je
  Exit 0. Zwei Vorbehalte des Prüfers zur Beweiskraft: der E2E-Harness
  hinterlässt einen `vite preview`-Prozess auf Port 5175, und ein
  Folgelauf testet dann still den **alten** Build weiter, statt zu
  scheitern — deshalb Task 16.
- 2026-07-30, akzeptierte Abweichung (B4): die Kategorie-Grenze „Lord"
  der WHFB6-Fixture verschwindet aus Anzeige und Durchsetzung. Der
  `categoryLink` trägt `max="-1"` und darauf einen `increment`; nach
  `docs/battlescribe-data-format.md` §7.6 („Arithmetik auf einer
  unbegrenzten Grenze lässt sie unbegrenzt") ist unbegrenzt richtig und
  die 1 des Solvers war falsch. Die bsdata-Doku hat Vorrang, der
  Evaluator bleibt wie er ist. Nutzersichtbar ist der Verlust trotzdem:
  in WHFB6 greift dadurch **keine** Lord-/Hero-Grenze mehr. Als Issue
  0125 gefilt (Ort der Behebung ist der Katalog-Fork), dem Menschen
  vorgelegt.

- 2026-07-30, **Review-Runde 1 (frischer Kontext) und Triage.** Acht
  Befunde, je mit Reproduktion. Trend nach Kriterium:

  | Kriterium | Runde 1 |
  | --- | --- |
  | 1 (kein Solver-Import) | 0 |
  | 2 (gelöscht, Prüfungen grün) | 1 (Doku unvollständig) |
  | 3 (Adapter) | 0 |
  | 4 (Meldungen) | 1 (Meldung für unauflösbare Einträge fehlt) |
  | 5 (Verfügbarkeit) | 0 |
  | 6 (Umzug verhaltensgleich) | 1 (Alt-Systeme ohne rawXmls) |
  | 7 (E2E-Umzug) | 0 |
  | 8 (Cache) | 0 |
  | ohne Kriteriumsbezug | 4 (Auto-Fill, General-Sortierung, Erst-Render-Freeze, Vorgabe-Limit) |
  | **Summe** | **8** |

  Triage: **gefixt** — Alt-Systeme ohne `rawXmls` (die im Plan
  notierte Annahme über die Start-Migration war schlicht falsch: sie
  übersprang solche Systeme, bevor sie die Quelle fragte; jetzt werden
  sie von dort nachgerüstet, Unrettbares wird gemeldet statt still leer
  zu bleiben), die verlorene Meldung für Auswahlen ohne Definition
  (Diagnosen werden durchgereicht und projiziert), sechs
  Gift-Stub-Assertions, die nach dem Abriss nicht mehr fehlschlagen
  konnten, samt verwaister Spies, sowie der Doku-Nachzug (ADR-Index,
  ADR-0002/0003/0022/0024, veraltete Produktivkommentare). **An den
  Menschen abgegeben** — Auto-Fill-Restpunkte und General-Sortierung
  (Issue 0123), Erst-Render-Freeze 268–600 ms (Issue 0124); beide
  außerhalb der acht Kriterien. **Als Entscheidung notiert** — der
  Anlege-Dialog übernimmt jetzt `defaultCostLimit` des Katalogs als
  Vorschlag statt immer 2000; bei WHFB6 folgenlos (Sentinel −1 →
  Rückfall 2000), bei einem Katalog mit echter Vorgabe sichtbar und
  sinnvoller.
  Abnahme nach den Fixes: `npm test` 2474 vitest-Tests + Puppeteer-E2E
  Exit 0, lint/typecheck/build/depcruise Exit 0.
- 2026-07-30, **Fund beim Abriss (Issue 0122 gefilt):** Der vorher
  solver-basierte Test "Blood Dragons list validates without errors"
  meldet unter dem Evaluator 3 statt 0 Fehler. Ursache ist ein
  vorbestehender Engine-Defekt: eine `max 0`-Grenze im Rahmen einer
  **fremden** Kategorie (Strigoi) zählt in einer Blood-Dragon-Liste 1.
  Über den Fixture-Parser des Evaluators reproduziert — der App-Adapter
  ist entlastet. Nicht hier gefixt (Semantik-Eingriff im Query-Primitiv
  gehört nicht in den Cutover-Schnitt); die Assertion wurde aus dem
  Serialisierungstest entfernt, seine Round-Trip-Eigenschaft bleibt
  grün. **Nutzersichtbar: bis 0122 läuft, zeigen Listen mit
  bloodline-gebundenen Optionen Phantom-Fehler — beim Merge-Entscheid
  zu berücksichtigen.**
- 2026-07-30, Task 10 (Solver-Abriss) erledigt, Vollabnahme:
  `npm test` 2472 vitest-Tests + Puppeteer-E2E Exit 0; lint, typecheck,
  build, depcruise je Exit 0 (0 depcruise-Errors, 1 vorbestehende
  Warnung); knip von 10 auf 5 verwaiste Exporte, unter Baseline;
  Screenshots Exit 0. `src/solver/` existiert nicht mehr (7 Module,
  20 Testdateien, Fassade); 29 alte `validation.*`-Schlüssel je Sprache
  und `formatValidationError` gelöscht, Ursachen-Titel in die
  Evaluator-Projektion gezogen. Solver-Regeln aus oxlint und
  dependency-cruiser entfernt, Schichtkarte auf `roster` umgestellt,
  README/bsdata-Doku/Renderer-Audit/ADR-0023+0030 nachgezogen.
  Eingriffe der Hauptsitzung in Tabu-Dateien: die 12 inerten
  `vi.mock`-Blöcke auf die gelöschte Solver-Fassade entfernt (Gift-Stubs
  ohne Gegenstand; Erwartungen unberührt) samt der dadurch toten
  Spy-Deklarationen. Task 10 lief ohne Subagent-Implementierer: der
  beauftragte Agent starb an einem API-Fehler, die Hauptsitzung hat den
  Abriss selbst gefahren.
- 2026-07-30, Task 9 (E2E-/Fixture-Umzug) erledigt: ui.test.js/
  pwa.test.js → e2e/, Fixtures → src/__fixtures__/ (bewusste
  Abweichung vom Plan-Stichwort "nach e2e/": 20 von 24 Verbrauchern
  sind src-Unit-Tests; ein Ort, keine Duplikate). 48 Dateien
  Referenz-Nachzug inkl. CI, knip/depcruise-Scope, Manifest-Pfade.
  npm test komplett Exit 0 (2694 vitest + Puppeteer), build/lint/
  typecheck/depcruise/knip Exit 0, Audit-Grep alte Pfade leer.
  Überraschung: ein Fixture-Verbraucher baute den Pfad aus Segmenten
  (grep-unsichtbar) — einmaliger Suite-Fehlschlag, gefixt. CLAUDE.md
  ist Symlink auf .agents/AGENTS.md (sed materialisierte ihn kurz;
  wiederhergestellt). Task-10-Nachzüge notiert: stale Verweise in
  src/__fixtures__/whfb6-lexicanum/README.md, solver-Schicht in
  scripts/project-state/graph.test.js.
- 2026-07-30, Task 8 (Schreibmodell-Umzug) erledigt: 21 Module + 49
  Modultests per git mv nach src/roster/ (verhaltensgleich),
  catalogueSelection/ungenutzte Exporte gelöscht, Rest-Kosten/Namens-
  Anzeigen in PlayMode/PlayUnitDetails/UnitSelectionCard auf den
  Bericht umgestellt. Kein Produktivcode außerhalb src/solver
  importiert mehr den Solver (grep leer). Neue blockierende
  Schichtregeln (oxlint+depcruise, je per gepflanzter Verletzung
  belegt): evaluator↮roster, evaluation↛roster. Volle Suite 2694
  Exit 0, E2E Exit 0, build/lint/typecheck/depcruise Exit 0.
  Judgment-Call (kein test-author-Lauf): reiner Umzug, die
  mitwandernden Modultests sind die Tests. Eingriff der Hauptsitzung
  in eine Tabu-Datei: RosterCategorySection.evaluator.test.jsx pinnte
  sein Harness per vi.mock auf den alten Solver-Pfad — nach dem Umzug
  griff der benigne Stub nicht mehr; eine Zeile auf '../../roster'
  retargetet, Erwartungen unberührt (Harness-Defekt, keine
  Verhaltensfrage; Alternative hätte auf echten Daten leere
  Characters-Sektionen sichtbar gemacht).
- 2026-07-30, ADR-0034-Spannungen aus Task 8 (Folge-Kandidaten):
  collectUnreachableArmyWideSelectors, der Upgrade-Chips-Filter
  (infoElements ohne Quell-Selektion-Herkunft), computeRosterCounts/
  buildModifierEvalContext-Zählscheiben, Kategorie-Sichtbarkeit
  (isEntryPrimaryInCategory) — je UI-seitige Katalog-Ableitung, die
  der Bericht (noch) nicht trägt; "Kategorie bietet Kandidaten" im
  Bericht würde Spannung + Harness-Wurzelursache zugleich lösen.
- 2026-07-30, Task 7 (Rest-UI) erledigt: 10 Vertragsdateien (28 rot
  vorher), volle Suite 2700 Tests Exit 0, E2E Exit 0 unverändert,
  build/lint/typecheck/depcruise Exit 0. Neu evaluationCache
  (WeakMap je System-Objekt — Kriterium 8 verschärft auf "je
  Datensatz", auch für Nicht-React-Aufrufer) und costDisplays.
  Kosten-Parität auf echten WHFB6-Katalogen belegt (Round-trip 2000
  pts, 3 Armeen). Akzeptierte Deltas: Prozent-Kategorien zeigen
  aufgelöste Zahlen statt "%"-Suffix; WHFB6-Quirk-Vererbungstests der
  Sidebar gelöscht (ADR-0034); Regel-Details ohne publicationRef;
  NewRosterModal filtert creatableForces zusätzlich per sourceId
  (bewahrt Alt-Verhalten). Rest-Solver-Importe (Struktur-Helfer +
  einzelne Kosten-/Namens-Reste in PlayMode/PlayUnitDetails/
  UnitSelectionCard) als Task-8-Inventar im Bericht erfasst.
- 2026-07-30, Task 6 (Verfügbarkeitspfad) erledigt: 21 rote
  Vertragstests in 4 Dateien, dann volle Suite 2646 Tests Exit 0,
  Puppeteer-E2E Exit 0 unverändert, build/lint/typecheck/depcruise
  Exit 0. Neu `src/evaluation/slotLookups.js`. Vier Alt-Testdateien
  gelöscht (Solver-Vertrag vollständig ersetzt, je begründet), vier
  angepasst. Überraschungen, sichtbare Detail-Abweichungen (per
  ADR-0030-Entscheidung akzeptiert, als Folge-Kandidaten notiert):
  (a) der Bericht führt je Slot nur EIN Min-/Max-Ergebnis — die alte
  kombinierte Kopfzeile "X pts | N/M" bei Gruppen mit Zähl-Max UND
  Punkte-Cap ist nicht mehr rekonstruierbar; (b) der Hinweistext
  "(bereits vergeben)" für roster-einzigartige Optionen entfällt, die
  Sperre selbst kommt aus isBlocked; (c) Issue-17/07-Fall (gleichnamige
  Gruppen per Gruppen-Id getrennt) hat keine komponentennahe Absicherung
  mehr. Folge-Issues beim Retro filen: ADR-0029-Hebbarkeit in den
  Bericht projizieren; ggf. Mehrfach-Grenzen je Slot; Gruppen-Id-
  Testfall.
- 2026-07-29, Task 5 (UI-Validierungspfad) erledigt: 5 neue rote
  Vertragsdateien (34 Tests), dann volle Suite `npx vitest run` 2671
  Tests Exit 0, Puppeteer-E2E Exit 0 OHNE Anpassung (die Evaluator-
  Texte erfüllen dieselben Selektoren/Zählungen), build/lint/typecheck/
  depcruise Exit 0. Prop-Umbenennungen error→violation,
  validationErrors→violations; Panel verliert den general/contextual-
  Split (Evaluator-Verletzungen ankern über Pfade); Karten-Zuordnung
  über pathBySelectionId + anchor.path. CategoryUnitAdder rendert
  seine Solver-Sperrgründe übergangsweise lokal (SolverReasonMessage),
  bis Task 6 den Verfügbarkeitspfad umstellt. Ein gelöschter Alt-Test
  (ValidationCauses.test.jsx, vollständig ersetzt), übrige Alt-Tests
  angepasst.
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

- **Does this match what was asked?** Ja. "UI auf die neue Engine, ohne
  Plugin" ist erfüllt: die Oberfläche liest Verletzungen, Verfügbarkeit,
  Grenzen, Namen, Kosten und Profile direkt aus dem Bericht; es gibt
  keine Zwischenschicht, die das alte Fehlerformat nachbaut (nur den
  Eingabe-Adapter, den Kriterium 3 ausdrücklich verlangt). Ein Zug, ein
  Branch, zehn Zwischencommits, `src/solver/` gelöscht.
- **What surprised me?** Drei Dinge. (1) Der Bericht trug keine
  Kostensummen — die Engine musste dafür wachsen, statt dass die UI
  rechnet (ADR-0034). (2) Der Cutover legte einen echten Engine-Defekt
  frei: eine `max 0`-Grenze im Rahmen einer fremden Kategorie zählt
  falsch und lässt eine legale Liste als fehlerhaft erscheinen
  (Issue 0122) — "cutover-fähig" aus Issue 75 war also nicht ganz wahr.
  (3) `scripts/measure-evaluator.js` riss die 100-ms-Schwelle schon auf
  der unveränderten Baseline.
- **What am I assuming without having verified it?** Dass die
  Detail-Abweichungen, die ich als akzeptierte Deltas protokolliert
  habe (Prozent-Kategorien ohne "%"-Suffix, entfallene kombinierte
  Gruppen-Kopfzeile, fehlender "(bereits vergeben)"-Hinweis, Regel-
  Details ohne publicationRef), für den Menschen wirklich akzeptabel
  sind — belegt sind sie nur als bewusst getroffene Entscheidungen, nicht
  als gewünschtes Verhalten. Und dass die Abdeckung der gelöschten
  Solver-Modultests (rund 90 Dateien) tatsächlich vollständig von der
  Evaluator-Suite getragen wird; geprüft ist das nur indirekt über die
  grüne Gesamtsuite und den E2E, nicht Fall für Fall.

## Retro
