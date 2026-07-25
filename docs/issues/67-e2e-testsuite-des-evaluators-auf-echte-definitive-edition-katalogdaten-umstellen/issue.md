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

1. **Dateiübergreifende Auflösung im Evaluator.** Die Engine löst ein reales
   Datenset — eine Spielsystemdatei (`.gst`) plus **eine oder mehrere**
   Armee-Kataloge (`.cat`) — vollständig auf: `entryLink`, `infoLink`,
   `sharedSelectionEntries` **und `catalogueLink`** (`.cat`→`.cat`-Import) werden
   transitiv über die Link-/Import-Ketten zusammengeführt, sodass per Verweis
   importierte Definitionen tatsächlich mit-ausgewertet werden. In den echten
   Definitive-Edition-Daten ist dieser Import **zwingend**: jeder Armee-Katalog
   deklariert einen `catalogueLink` auf die gemeinsame `Mercenaries`-`.cat`, und
   z. B. die Ogre-`.cat` löst 41 ihrer Ziel-IDs ausschließlich über Mercenaries
   auf. Ein Verweis auf eine trotz Auflösung nicht gefundene Definition erscheint
   weiterhin als **Diagnose**, nie als Absturz.

2. **E2E-Ebene vollständig auf echte, vollständige Daten umgestellt.** Die
   E2E-Testsuite der neuen Engine prüft echte **Definitive-Edition**-Katalogdaten
   als vollständig aufgelöste Datensätze — jeder Armee-Katalog zusammen mit der
   `.gst` **und** der per `catalogueLink` benötigten `Mercenaries`-`.cat`. Die
   Katalog-Rohdaten liegen zu diesem Zweck **versioniert im Repository**.
   Assertions prüfen **bekannte, im Katalog verifizierte** Definitions-IDs,
   Namen und Grenzwerte (reale Pflichteinheit, realer Modifikator, reale
   Bedingung, sowie eine katalogübergreifend — über Mercenaries — aufgelöste
   Definition), sodass jeder Test echtes Regel-Verhalten dokumentiert und robust
   gegen bloßes Datenwachstum ist.

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
- **Kein** Auto-Generator und **kein** CI-Zwang für den Testkatalog.
- **Nicht** alle 18 DE-Kataloge werden versioniert — nur die von den E2E-Tests
  ausgeübte Teilmenge (`.gst` + `Mercenaries` + Ogre/Orcs & Goblins/Vampire
  Counts). Die Abhängigkeit ist ein Stern (jeder Armee-Katalog → Mercenaries),
  daher deckt diese Teilmenge den Multi-`.cat`-Fall vollständig ab.
- Die Unit-/Komponententests der Engine behalten ihre minimalen, synthetischen
  Eingaben; **nur die E2E-/Integrationsebene** stellt auf echte Daten um. „Keine
  synthetischen Tests mehr" gilt ausschließlich für diese Ebene.
- **Kein** Verlust an Regel-Abdeckung, wo ein synthetisches Paritätsszenario ein
  reales Gegenstück hat: solche Szenarien werden real neu abgebildet, nicht bloß
  gestrichen.

### Kontext / betroffene Bereiche (verifiziert)

- **Datenquelle:** die echte **Definitive Edition** aus
  `artkoenig/Warhammer-Fantasy-Battles-6th-Definitive-edition` (main), Upstream
  Lexicanum Imperialis — dieselbe Quelle, die die App zur Laufzeit bezieht
  (`CATALOG_REPO_RAW_BASE_URL`, `src/db/catalogUpdate.js`). Voller Satz: 18 `.cat`
  + 1 `.gst` (~14 MB), `.gst`-Id `0d13-7737-ea86-4662`.
- **Die alten Fixtures unter `src/solver/__fixtures__/whfb6/` sind NICHT die
  Definitive Edition** (Ergofarg-Stand, `revision="1"`, self-contained, 0
  `catalogueLink`). Sie bleiben unberührt (Solver-Testdaten). Die neue Engine
  bekommt ihre eigenen DE-Fixtures unter `src/evaluator/__fixtures__/`.
- **Katalogübergreifende Abhängigkeit (an echten DE-Daten verifiziert):** jeder
  der 17 Armee-Kataloge deklariert genau **einen** `catalogueLink` → die
  gemeinsame `Mercenaries`-`.cat`; Mercenaries selbst hat keinen. Die Ogre-`.cat`
  hat 244 eindeutige `targetId`s, **41** lösen ausschließlich über Mercenaries
  auf (ohne sie 41 dangling, mit ihr 0). `catalogueLink` ist damit real und
  zwingend — die frühere „0 catalogueLink"-Annahme galt nur für die alten
  Fixtures.
- Fassade heute: `evaluate(catalogXml, roster)` nimmt genau **einen** Katalog-
  XML-String (`src/evaluator/evaluator.js`); der Resolver löst nur Direkteinträge
  auf (`src/evaluator/resolver.js`). Diese Änderung schließt die in ADR-0030 und
  ADR-0031 als künftige Arbeit vermerkte Auflösungs-Grenze und wird als ADR-0032
  festgehalten.

### Nahtstellen (Test-Seams)

- Öffentliche Auswertungs-Fassade der Engine (`evaluate`, heute
  `src/evaluator/evaluator.js`) — der einzige Einstieg, über den die E2E-Tests
  reale Daten auswerten. Die Fassade nimmt künftig **eine `.gst` + eine Liste von
  `.cat`** entgegen (siehe ADR-0032); die genaue Signatur-Form ist eine
  Implementierungsentscheidung.
- Der von der Fassade gelieferte **Bericht** (`report`: `violations`,
  `capabilities`, `diagnostics`) als Beobachtungspunkt der Assertions.

## Acceptance Criteria
- [ ]

## Comments
