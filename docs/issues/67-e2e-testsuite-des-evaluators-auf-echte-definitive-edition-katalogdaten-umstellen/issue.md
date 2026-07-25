Status: ready-for-agent
Type: refactor
Blocked by: None

## Description

### Problem

Die Reinraum-Engine (`src/evaluator/`) wird heute end-to-end nur gegen
**synthetische Mini-Kataloge** und einen **einzelnen** realen Katalog geprüft.
Der reale Smoke-Test (`e2e.realCatalog.smoke.test.js`) liest bewusst nur die
direkt unter der Katalog-Wurzel stehenden Einträge: `entryLink`, `infoLink`,
`sharedSelectionEntries` und die `.gst`-Spielsystemdatei bleiben außen vor
(dokumentierte Grenze in `resolver.js`, in ADR-0030/0031 als künftige Arbeit
vermerkt). Damit prüft kein Test die Engine an einem **vollständigen, echten**
Datenset, wie es ein Nutzer beim Import erlebt.

Zugleich fehlt eine gepflegte, **nicht-technische** Übersicht der E2E-Testfälle:
was jeder Test in Nutzer-Begriffen prüft, gegen welche echten Katalogdateien,
mit welchem Roster-Zustand und welchem erwarteten Auswertungsergebnis.

Diese Änderung betrifft **ausschließlich die neue Engine** (`src/evaluator/`).
Die Tests und Testdaten der alten Engine (Solver, `src/solver/`) bleiben
unberührt.

### Ziel / gewünschtes Verhalten

1. **Dateiübergreifende Auflösung im Evaluator.** Die Engine löst einen realen
   Armee-Katalog (`.cat`) samt seiner zugehörigen Spielsystemdatei (`.gst`)
   vollständig auf: `entryLink`, `infoLink` und `sharedSelectionEntries` werden
   transitiv über die Link-Ketten zusammengeführt, sodass per Verweis
   importierte Definitionen tatsächlich mit-ausgewertet werden. `.cat`→`.cat`-
   Importe (`catalogueLink`) kommen in den vendored Daten nicht vor (0 Vorkommen)
   und sind nicht Teil dieser Änderung. Ein Verweis auf eine trotz Auflösung
   nicht gefundene Definition erscheint weiterhin als **Diagnose**, nie als
   Absturz.

2. **E2E-Ebene vollständig auf echte, vollständige Daten umgestellt.** Die
   E2E-Testsuite der neuen Engine prüft **alle drei** realen Definitive-Edition-
   Kataloge (Ogre Kingdoms, Orcs and Goblins, Vampire Counts) — jeweils zusammen
   mit der `.gst` (WHFB 6th Edition) — als vollständig aufgelöste Datensätze. Die
   Katalog-Rohdaten liegen zu diesem Zweck **versioniert im Repository**.
   Assertions prüfen **bekannte, im Katalog verifizierte** Definitions-IDs,
   Namen und Grenzwerte (Muster wie im heutigen Ogre-Smoke-Test: reale
   Pflichteinheit, realer Modifikator, reale Bedingung), sodass jeder Test echtes
   Regel-Verhalten dokumentiert und robust gegen bloßes Datenwachstum ist.

   **Keine synthetischen E2E-Tests mehr:** die bestehenden synthetischen
   E2E-Tests der Engine werden **entfernt bzw. durch Real-Data-Tests ersetzt** —
   der synthetische „Walking Skeleton"-Fassadentest, das an der Definitive
   Edition *modellierte* synthetische Fixture und die synthetische Paritätssuite
   gegen die alte Engine. Szenarien der Paritätssuite, die sich in echten
   Katalogdaten wiederfinden, werden als Real-Data-E2E neu abgebildet; rein
   synthetische Konstrukte entfallen ersatzlos. Die B1/B2-Befunde (Kategorie-
   `max`-ohne-`min` wird nicht erzwungen; `forceEntry`-Punktelimit nicht direkt
   ausdrückbar) bleiben ausschließlich in ADR/Issue dokumentiert, nicht mehr als
   Test.

3. **Testkatalog für die E2E-Suite.** Ein gepflegtes Markdown-Dokument listet
   **je E2E-Test der neuen Engine**:
   - den **Titel** des Tests,
   - die **betroffenen Katalogdateien**,
   - eine **Beschreibung des Roster-Zustands**, der geprüft wird,
   - das **erwartete Ergebnis des Evaluators, nicht-technisch formuliert**,
   - den **Link zur konkreten Testdatei**.

   Der Testkatalog deckt **nur** die E2E-Tests der neuen Engine ab — nicht die
   Unit-/Komponententests und nicht die alte Engine.

4. **Dokumentierte Pflege-Regel.** Eine im Repository dokumentierte Regel
   schreibt vor: Sobald ein neues Problem der Engine erkannt und gelöst wird,
   wird dafür ein E2E-Test **und** ein zugehöriger Testkatalog-Eintrag angelegt.
   Die Pflege erfolgt von Hand (kein Generator, kein CI-Gate).

### Nicht-Ziele / Abgrenzung

- **Keine** Änderung an der alten Engine (Solver) oder ihren Testdaten.
- **Keine** App-Verdrahtung der neuen Engine (bleibt gemäß ADR-0030 entkoppelt);
  daher kein Versions-Bump (`Type: refactor`).
- **Kein** `catalogueLink`/`.cat`→`.cat`-Import (real nicht vorhanden).
- **Kein** Auto-Generator und **kein** CI-Zwang für den Testkatalog.
- Die Unit-/Komponententests der Engine behalten ihre minimalen, synthetischen
  Eingaben; **nur die E2E-/Integrationsebene** stellt auf echte Daten um. „Keine
  synthetischen Tests mehr" gilt ausschließlich für diese Ebene.
- **Kein** Verlust an Regel-Abdeckung, wo ein synthetisches Paritätsszenario ein
  reales Gegenstück hat: solche Szenarien werden real neu abgebildet, nicht bloß
  gestrichen.

### Kontext / betroffene Bereiche (verifiziert)

- Reale Daten unter `src/solver/__fixtures__/whfb6/`: 3 `.cat` (Ogre Kingdoms
  206 KB, Orcs and Goblins 593 KB, Vampire Counts 375 KB) + 1 `.gst`
  (WHFB 6th, 139 KB). Alle drei `.cat` verweisen auf dieselbe `gameSystemId`
  der einen `.gst`.
- Verweisdichte je Datei: Ogre 155 `entryLink` / 123 `infoLink`; O&G 249 / 352;
  VC 176 / 201; `.gst` 48 / 74. `catalogueLink`: 0 in allen Dateien.
- Fassade heute: `evaluate(catalogXml, roster)` nimmt genau **einen** Katalog-
  XML-String (`src/evaluator/evaluator.js`); der Resolver löst nur Direkteinträge
  auf (`src/evaluator/resolver.js`). Diese Änderung schließt die in ADR-0030 und
  ADR-0031 als künftige Arbeit vermerkte Auflösungs-Grenze.

### Nahtstellen (Test-Seams)

- Öffentliche Auswertungs-Fassade der Engine (`evaluate`, heute
  `src/evaluator/evaluator.js`) — der einzige Einstieg, über den die E2E-Tests
  reale `.cat`+`.gst`-Daten auswerten. Die konkrete Signatur (ein XML-String
  vs. mehrere Katalogquellen/Katalog-Set) ist eine Implementierungsentscheidung.
- Der von der Fassade gelieferte **Bericht** (`report`: `violations`,
  `capabilities`, `diagnostics`) als Beobachtungspunkt der Assertions.

## Acceptance Criteria
- [ ]

## Comments
