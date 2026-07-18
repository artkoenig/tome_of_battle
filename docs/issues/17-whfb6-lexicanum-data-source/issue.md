Status: resolved
Type: feature
Blocked by: None

## Description
# PRD: WHFB6-Datenquellenwechsel zu Lexicanum Imperialis

## Problem Statement / Bug Description
Aktuell bezieht die App ihre WHFB6-Katalogdaten zur Laufzeit ausschließlich aus einem fest verdrahteten Fork von `Ergofarg/Warhammer-Fantasy-6th-edition` ([ADR-0014](../../adr/0014-kataloge-als-externes-fork-repo-mit-laufzeit-abruf.md)). Dieser Datensatz ist im Vergleich zum aktiv gepflegten, deutlich umfangreicheren Datensatz von [lexicanum-imperialis/Warhammer-Fantasy-Battles-6th-Definitive-edition](https://github.com/lexicanum-imperialis/Warhammer-Fantasy-Battles-6th-Definitive-edition) (Karak Norn Wargaming Club) inhaltlich unterlegen: weniger Fraktionen (fehlt z. B. Kislev), weniger integrierte Errata/FAQ, weniger Sonderfiguren und Alternativlisten.

Ein vollständiger Test-Import des neuen Datensatzes durch den bestehenden Parser deckte zusätzlich zwei App-seitige Lücken auf, die unabhängig vom gewählten Datensatz bestehen, aber erst durch dessen reichhaltigeres Schema sichtbar wurden:
- `parseRules()` in `src/parser/xmlParser.js` verwirft alle `sharedRules`, wenn zusätzlich ein Geschwister-Element `<rules>` auf derselben Ebene existiert (erst-Treffer-gewinnt statt Merge) — erklärt 654 von 658 unauflösbaren Referenzen im Test-Import (u. a. Terror, Fear, Fly, Stubborn, Large Target, Magical Resistance).
- `infoGroup`-Elemente (ein laut BattleScribe-Schema gültiger `infoLink`-Zieltyp neben `profile`/`rule`) werden vom Parser überhaupt nicht extrahiert — erklärt die restlichen 4 unauflösbaren Referenzen.

Beide Lücken sind bei jedem BattleScribe-konformen Katalog reproduzierbar, der `rules`+`sharedRules` als Geschwister bzw. `infoGroup` nutzt — nicht spezifisch für Lexicanums Daten.

**Scope-Erweiterung (nach Abschluss des ursprünglichen Cutovers):** Der Ergofarg-Fork
(`artkoenig/Warhammer-Fantasy-6th-edition`) ist entgegen der ursprünglichen Annahme weiterhin
aktiv gepflegt und trägt lokal eingepflegte Datenfixes (u. a. Bloodline-Korrekturen,
Arcane-Items-Lift-Modifier, ConditionKind-Schemakonformität nach BSData/schemas), die im
Lexicanum-Datensatz nicht existieren. Der Nutzer möchte diese Variante beim Import weiterhin
frisch auswählen können — nicht nur bereits gespeicherte Alt-Rosters weiternutzen. Das war im
ursprünglichen Out-of-Scope dieses Main-Issues ausdrücklich ausgeschlossen; [ADR-0018](../../adr/0018-katalog-mehrquellenbetrieb-ergofarg-und-lexicanum-parallel.md)
nimmt diese Entscheidung explizit zurück.

## Solution
Der fest verdrahtete Katalog-Fork wird von Ergofarg auf einen neuen, eigenen Fork von `lexicanum-imperialis/Warhammer-Fantasy-Battles-6th-Definitive-edition` umgestellt (`CATALOG_REPO_RAW_BASE_URL` in `src/db/catalogUpdate.js`). Die beiden entdeckten Parser-Lücken werden als Voraussetzung dafür behoben.

Da das neue Upstream-Repository BattleScribes `revision`-Konvention nachweislich nicht pflegt (empirisch belegt: Inhalt von `Skaven.cat` änderte sich zwischen den Releases `0.0.6` und `0.0.6.20260711`, `revision` blieb in beiden Fällen `"1"`) und kein `catpkg.json` bereitstellt, übernimmt der neue eigene Fork diese beiden Aufgaben selbst (eigene CI: Revision hochzählen bei erkannter inhaltlicher Änderung, `catpkg.json` generieren) — damit bleibt ADR-0014s Update-Mechanismus („revision, higher wins") funktionsfähig. Details und verworfene Alternativen: [ADR-0017](../../adr/0017-lexicanum-katalog-fork-mit-eigener-revision-ci.md).

Zusätzlich erhält der Import einen Abhängigkeitsschutz: Wählt der Nutzer die Standardauswahl manuell so weit ein, dass ein ausgewählter Katalog per `catalogueLink` auf einen abgewählten Katalog verweist (z. B. „Dogs of War" auf den Library-Katalog „Mercenaries"), wird der Import **abgebrochen** und der fehlende Katalog benannt — statt still unvollständig zu importieren. Die Prüfung läuft zum Import-Zeitpunkt in `handleImportBundle`, weil die `catalogueLinks` erst mit den vollständig geladenen `.cat`-Daten der Auswahl vorliegen (nicht schon beim Anklicken der Auswahl, wo nur die `catpkg.json`-Metadaten bekannt sind — ein eifriges Vorab-Laden aller Kataloge wäre in einer Offline-first-PWA unverhältnismäßig). Diese Situation konnte mit dem alten Datensatz nicht auftreten, weil er keine Library-Kataloge kannte.

Bereits importierte Systeme aus der alten Ergofarg-Quelle (andere `gameSystemId`) bleiben unverändert nutzbar. *(Von der Scope-Erweiterung überholt: siehe unten — Ergofarg erhält wieder aktive, symmetrische Updates statt passiv auszulaufen.)*

**Mehrquellenbetrieb (Scope-Erweiterung, [ADR-0018](../../adr/0018-katalog-mehrquellenbetrieb-ergofarg-und-lexicanum-parallel.md)):**
Die bisherigen Einzelkonstanten `CATALOG_REPO_RAW_BASE_URL`/`CATALOG_INDEX_URL` in
`src/db/catalogUpdate.js` weichen einer Liste `CATALOG_SOURCES`
(`{ gameSystemId, indexUrl, rawBaseUrl }`, ein Eintrag pro Fork). Die Spielsystem-Auswahl
im Importer ruft `transformIndexToSystems` einmal pro Quelle auf und führt die Ergebnisse zu
einer flachen Liste zusammen — kein zusätzlicher Auswahlschritt, beide Systeme erscheinen im
bestehenden Dropdown.

*(Revision 2026-07-18, Kind-Issue 10): Ursprünglich war hier ein verkürztes Anzeige-Label mit
Quellenangabe vorgesehen ("WHFB 6th ed. (Ergofarg)"/„WHFB 6th ed. (Lexicanum)"), weil die
echten Original-Namen einander ähneln ("Warhammer Fantasy Battle 6th edition" vs. "Warhammer
Fantasy Battles (6th definitive edition)"). Nutzerentscheidung nach expliziter Abwägung dieses
Trade-offs: Die UI zeigt stattdessen ausschließlich den echten Katalognamen, ohne jeden
Quellzusatz — auch auf die Gefahr hin, dass die beiden Einträge im Dropdown einander sehr
ähnlich sehen. `CATALOG_SOURCES[].label` und `resolveSystemDisplayLabel` wurden entsprechend
wieder entfernt.*

Die Zuordnung eines bereits gespeicherten Systems zu seiner Quelle läuft über seine ohnehin
eindeutige, stabile `gameSystemId` (Lookup in `CATALOG_SOURCES`) — kein neues Datenbankfeld,
keine Migration. Der stille Update-Mechanismus (`findOutdatedCatalogFiles`,
`runSystemMigrations`) iteriert über alle Quellen und prüft jedes gespeicherte System gegen den
Index seiner eigenen Quelle; beide Quellen erhalten damit symmetrisch automatische Updates
(„higher wins", wie in ADR-0014 etabliert). Voraussetzung dafür ist ein Fix des
`loadCatalogIndex`-Caches in `catalogUpdate.js`: Er schlüsselt aktuell nur nach der
`fetchText`-Funktionsidentität, nicht zusätzlich nach der Index-URL — bei zwei parallelen
Quellen mit derselben `fetchText`-Instanz würde der zweite Aufruf sonst still das gecachte
Ergebnis des ersten zurückliefern.

## User Stories / Requirements
1. Als Spieler möchte ich beim Import Zugriff auf die Fraktion Kislev haben, die im aktuellen Datensatz fehlt, um auch mit dieser Armee Listen zu bauen.
2. Als Spieler möchte ich, dass Sonderregeln wie Terror, Fear, Fly, Stubborn etc. in importierten Katalogen korrekt aufgelöst werden, damit Einheiten ihre vollständigen Regeltexte zeigen.
3. Als Spieler, der einen Katalog mit Verweis auf einen Library-Katalog importiert (z. B. Dogs of War → Mercenaries), möchte ich nicht versehentlich unvollständige Daten importieren können, indem ich den Library-Katalog abwähle.
4. Als Entwickler möchte ich, dass Katalog-Updates aus dem neuen Fork weiterhin automatisch bei bestehenden Nutzern ankommen (wie in ADR-0014 etabliert), damit Datenfixes nicht erneut nur durch manuellen Reimport erreichbar sind.
5. Als Nutzer mit einem bereits importierten System aus der alten Quelle möchte ich, dass meine gespeicherten Rosters nach der Umstellung unverändert nutzbar bleiben.
6. Als Spieler möchte ich beim Import zwischen der Ergofarg- und der Lexicanum-Quelle wählen können, weil die Ergofarg-Quelle eigene, im Lexicanum-Datensatz nicht vorhandene Fixes trägt, die ich weiterhin nutzen möchte.
7. ~~Als Spieler möchte ich die beiden Quellen im Dropdown eindeutig unterscheiden können, ohne die sehr ähnlichen Original-Systemnamen genau lesen zu müssen.~~ *(Revision 2026-07-18, Kind-Issue 10: zurückgenommen — der Nutzer entschied sich bewusst gegen ein Unterscheidungs-Label, siehe Solution.)*
8. Als Nutzer mit einem bereits importierten Ergofarg-System möchte ich, dass es wieder automatische stille Updates erhält, sobald Ergofarg wieder eine aktiv angebotene Quelle ist — symmetrisch zu Lexicanum.

## Technical Decisions
- **Affected Modules:** `src/parser/xmlParser.js` (parseRules-Merge, infoGroup-Parsing), `src/solver/catalogResolver.js` (infoGroup-Auflösung), `src/solver/systemQuirks.js` (neuer Eintrag für die neue gameSystemId `0d13-7737-ea86-4662`), `src/db/catalogUpdate.js` (`CATALOG_SOURCES`-Liste ersetzt die Einzelkonstanten; `loadCatalogIndex`-Cache-Fix; `findOutdatedCatalogFiles`/`runSystemMigrations` iterieren über Quellen), `src/db/migrations.js` (Update-Loop über mehrere Quellen), `src/components/Importer.jsx` (Abhängigkeitsschutz für catalogueLinks; Mehrquellen-Merge in `transformIndexToSystems`/`fetchAvailableSystems`; Anzeige unter echtem Katalognamen, kein Quellzusatz), externer neuer Fork (eigene GitHub Action für Revision-Bumping + `catpkg.json`-Generierung — liegt außerhalb dieses Repos, wird aber als Workflow-Datei in diesem Main-Issue mit entworfen).
- **Technical Clarifications / Architectural Decisions:** [ADR-0017](../../adr/0017-lexicanum-katalog-fork-mit-eigener-revision-ci.md) amendet ADR-0014: Wahl des neuen Fork-Ziels + Begründung, warum eine eigene CI für Revision-Disziplin nötig ist, da Lexicanum sie nicht praktiziert. [ADR-0018](../../adr/0018-katalog-mehrquellenbetrieb-ergofarg-und-lexicanum-parallel.md) nimmt ADR-0014s Einquellen-Prinzip zurück: beide Forks werden dauerhaft parallel als benannte Quellen betrieben, Quellenzuordnung über die bereits eindeutige `gameSystemId`, kein neues Datenbankfeld.
- **API Contracts / Data Models:** Kein neues Datenmodell und keine Migration gespeicherter Systeme (siehe ADR-0018 — `gameSystemId` ist bereits der Quellenschlüssel). Das `catpkg.json`-Format bleibt wie in ADR-0014 festgelegt (BSData/publish-catpkg-kompatibel), jetzt aber zwei unabhängige Indizes (einer pro Quelle). Die neue gameSystemId `0d13-7737-ea86-4662` ergänzt (statt ersetzt) `6d8e-38d9-3c69-febf` als Schlüssel in `SYSTEM_QUIRKS` — beide bleiben dauerhaft aktive Einträge. Katalog-/Kategorie-IDs (z. B. Heroes `c16b-f319-2c62-2c12`, Characters `7a1c-d611-c2dc-def1`, General-Eintrag `1b7c-2c90-6d96-28c9`) sind zwischen altem und neuem Datensatz identisch verifiziert — Werte werden übernommen, aber gegen die neue Katalogstruktur validiert, nicht blind kopiert.

## Testing Decisions
- **Modules to Test:** `src/parser/xmlParser.js`, `src/solver/catalogResolver.js`, `src/solver/systemQuirks.js` (neue Testdatei, bisher ungetestet), `src/db/catalogUpdate.js`, `src/db/migrations.js`, `src/components/Importer.jsx`.
- **Test Interfaces (Seams):**
  - `parseGameSystemXML`/`parseCatalogueXML` (`src/parser/xmlParser.js`, getestet über `xmlParser.revision.test.js`, `src/solver/parser.test.js`) — rules/sharedRules-Merge, infoGroup-Parsing.
  - `findEntryInSystem`/`resolveEntry` (`src/solver/catalogResolver.js`, getestet über `catalogResolver.test.js`) — infoGroup-Auflösung, Regel-Auflösung nach Merge-Fix.
  - `getSystemQuirks`/`getInheritedCategoryMaxSource`/`isQuirkGeneralEntryId` (`src/solver/systemQuirks.js`, neue Testdatei `systemQuirks.test.js`) — neuer Quirks-Eintrag für die neue gameSystemId.
  - `CATALOG_SOURCES`/`loadCatalogIndex`/`findOutdatedCatalogFiles` (`src/db/catalogUpdate.js`, getestet über `catalogUpdate.test.js`) — Mehrquellen-Konfiguration, Cache-Fix (Schlüsselung nach URL), Revision-Vergleich pro Quelle bleibt unverändert.
  - `runSystemMigrations` (`src/db/migrations.js`, getestet über `migrations.test.js`) — Update-Loop über mehrere Quellen, korrekte Quellenzuordnung gespeicherter Systeme.
  - `findMissingLibraryDependencies`/`handleImportBundle`/`transformIndexToSystems` (`src/components/Importer.jsx`, getestet über `Importer.test.jsx`) — Import-Zeit-Abhängigkeitsschutz für per `catalogueLink` referenzierte, aber abgewählte Kataloge; Mehrquellen-Merge; Anzeige unter echtem Katalognamen (Revision 2026-07-18, Kind-Issue 10 — ersetzt die ursprünglich vorgesehene, inzwischen entfernte Label-Hilfsfunktion).

## Out of Scope
- Keine UI zum Hinzufügen beliebiger, benutzerdefinierter Katalogquellen — nur die zwei fest konfigurierten Einträge in `CATALOG_SOURCES` (Ergofarg, Lexicanum). *(Ersetzt die frühere, jetzt durch [ADR-0018](../../adr/0018-katalog-mehrquellenbetrieb-ergofarg-und-lexicanum-parallel.md) zurückgenommene Out-of-Scope-Aussage "Kein UI zur Verwaltung mehrerer Katalogquellen".)*
- Keine explizite Migrations-/Hinweis-UI für Nutzer mit bereits importierten Ergofarg-Systemen.
- Kein automatisches Zurückspielen von Fixes an lexicanum-imperialis (ein Pull-Request-Workflow ist möglich, aber nicht Teil dieses Main-Issues).
- Keine Bereinigung/Neuausrichtung der eingefrorenen Test-Fixture `src/solver/__fixtures__/whfb6/` (bleibt laut ihrer eigenen README bewusst vom Live-Datensatz entkoppelt).
- Kein neues Datenbankfeld/keine Migration für gespeicherte Systeme (bewusst nicht nötig, siehe ADR-0018).

## Acceptance Criteria
- [ ]

## Comments
- Alle 6 Kind-Issues resolved und gemerged. Vier-Achsen-Verifikation gelaufen: Tests gruen (466 passed, 2 skipped, UI-Tests bestanden), Standards-Gate gruen (nur vorbestehende codebasisweite Smells, ausserhalb dieses PRs). Spec- und Docs-Funde behoben (Workflow-Branch main, Spec-Texte an Import-Zeit-Guard angeglichen, categoryEntry-scope=force in der Format-Doku ergaenzt). Beim Merge aufgedeckte Flaky-Test-Ursache (echtes Netzwerk-I/O im Importer-Test seit Fork-URL-Swap) durch fetch-Stub behoben; Suite 3x deterministisch gruen. Offen ausserhalb dieses Trackers: manueller Fork von lexicanum-imperialis unter artkoenig anlegen, CI aus scripts/catalog-fork/ dort aktivieren, Live-Verifikation.
- Verifikations-Fund beim Bootstrap der catpkg.json im echten Fork: generate-catpkg.js rief `git show` ohne maxBuffer auf (Node-Default 1 MiB) und stuerzte bei Katalogen >1 MiB (z. B. "Forces of Chaos") mit ENOBUFS ab -- die Fork-CI waere beim ersten echten Sync gecrasht. Behoben via maxBuffer (256 MiB) plus neuem Regressionstest generate-catpkg.test.js, der den bisher ungetesteten CLI-git-show-Pfad mit einer >1-MiB-Datei ausuebt. E2E gegen den echten Fork-Klon bestaetigt: Generator laeuft durch, regenerierte catpkg.json byte-identisch zur gebooteten.
- Scope-Erweiterung nach Live-Test des Lexicanum-Forks: Der neue (BattleScribe-konforme) Datensatz nutzt zwei Konstrukte, die der Editor bislang nicht auswertet und die im alten Ergofarg-Datensatz nicht vorkamen — (a) armeeweite, force-scoped Wurzel-selectionEntries als 'globaler Schalter' (Vampire Bloodline) und (b) mehrstufig verschachtelte, katalog-uebergreifende entryLinks in den Library-Katalog Mercenaries (Relics of Lustria). Untersuchung bestaetigt: App-Faehigkeitsluecke, kein Datenfehler. Zwei neue Child-Issues 07 (force-scoped Wurzel-Selektor) und 08 (Cross-Catalogue-Library-Links) angelegt, Status needs-triage. Main-Issue von resolved auf ready-for-agent zurueckgesetzt; PR #59 sollte erst nach Aufloesung des gesamten Subtrees mergen.
- PRD um Mehrquellenbetrieb erweitert (grill-me-for-spec-Sitzung): Ergofarg-Fork ist entgegen urspruenglicher Annahme weiterhin aktiv gepflegt und traegt eigene Datenfixes, die im Lexicanum-Datensatz fehlen. Nutzer will beide Quellen dauerhaft parallel im Import-Dropdown waehlbar haben, nicht nur Alt-Systeme passiv weiternutzen -- nimmt die fruehere Out-of-Scope-Aussage 'Kein UI zur Verwaltung mehrerer Katalogquellen' zurueck. Dokumentiert in neuem ADR-0018 (amendiert ADR-0014/0017). Architekturentscheidung: CATALOG_SOURCES-Liste statt Einzelkonstanten; Quellenzuordnung ueber die bereits eindeutige gameSystemId, kein neues DB-Feld/keine Migration. Naechster Schritt: Decompose in Child-Issues (issue-tracker).
- Alle 10 Kind-Issues resolved und gemergt (01-10). Vier-Achsen-Verifikation gelaufen: Tests gruen (Suite-weiter Selector-Timeout im Puppeteer-UI-Test isoliert 2x reproduziert grün -> Flakiness durch parallele Worktree-Lastkonkurrenz, keine Regression); Standards-Gate gruen (oxlint exit 0, 5 Findings, 0 blockierend, alle vorbestehende codebasisweite Smells ausserhalb dieses Diffs); Spec 0 fehlende Requirements/0 Scope-Creep nach Korrektur der veralteten main-Referenz; Docs-Funde behoben (ADR-0017/0018 Ueberschriften und alle Fehlzitate ADR-0015/0016 -> 0017/0018 in Code-Kommentaren und Tests korrigiert; dieses issue.md an Kind-Issue-10-Umkehrung angeglichen, veraltetes label-Feld/WHFB-Kurzlabel aus Solution/US7/Technical+Testing Decisions entfernt bzw. mit Revisionsvermerk versehen). Bereit fuer PR-Merge.
