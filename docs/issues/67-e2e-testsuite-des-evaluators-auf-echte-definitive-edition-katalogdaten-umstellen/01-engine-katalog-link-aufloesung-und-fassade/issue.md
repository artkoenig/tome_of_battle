Status: resolved
Type: refactor
Blocked by: None

## Description

Die eigentliche Engine-Anpassung, Fundament für die gesamte Testsuite. Die
Reinraum-Engine (`src/evaluator/`) löst heute nur die direkt unter der
Katalog-Wurzel stehenden Einträge auf; per Verweis importierte Definitionen und
die Spielsystemdatei bleiben außen vor. Damit ist kein echtes, vollständiges
Datenset auswertbar.

Diese Slice befähigt die Engine, ein reales Datenset — eine Spielsystemdatei
(`.gst`) plus **eine oder mehrere** Armee-Kataloge (`.cat`) — **vollständig
aufzulösen**: `entryLink`, `infoLink`, `sharedSelectionEntries` **und
`catalogueLink`** (`.cat`→`.cat`-Import) werden transitiv über eine einzige
globale `id→Definition`-Symboltabelle zusammengeführt (global-by-ID,
zyklen-sicher — ADR-0032), sodass importierte Definitionen tatsächlich
mit-ausgewertet werden. Die Fassade nimmt dafür eine `.gst` + eine Liste von
`.cat` entgegen; die deterministische Verarbeitungsreihenfolge leitet die Engine
selbst ab.

Kohärenz wird als Diagnose gemeldet, nie still fehlausgewertet: ein Katalog,
dessen `gameSystemId` nicht zur mitgegebenen `.gst` passt
(`GAMESYSTEM_MISMATCH`), und ein per `catalogueLink` deklariertes, aber nicht
mitgegebenes Abhängigkeits-Ziel (`MISSING_CATALOGUE_DEPENDENCY`) erzeugen je eine
Diagnose. Ein Verweis, der auch nach der Auflösung nicht gefunden wird, bleibt
Diagnose, nie Absturz.

Der bekannte Korrektheits-Fallstrick wird dabei berücksichtigt: nur per Verweis
bezogene bzw. geteilte Einträge (`sharedSelectionEntries`, Link-Ziele) gehen in
die `byId`-Tabelle, aber **nicht** in die Wurzel-Definitionsliste, damit ihre
`min`-Grenze keine falsche Pflichtverletzung synthetisiert.

Im selben Zug werden die von der realen Auflösung **abgelösten synthetischen
E2E-Tests entfernt**: der synthetische „Walking Skeleton"-Fassadentest und das an
der Definitive Edition modellierte synthetische Fixture samt Loader. Die ~12
bestehenden Aufrufstellen der Ein-Katalog-Fassade werden mechanisch auf die neue
`.gst`+`.cat`-Liste-Signatur angepasst.

Die konkreten Domänen-Szenarien (Bulls-Pflicht, Tyrant-Modifikator, O&G, VC)
sind **nicht** Teil dieser Slice — sie ziehen in die E2E-Szenarien-Slice (02)
ein. Der Nachweis hier ist die **Auflösungs-Fähigkeit** an echten Daten, nicht
die Regel-Semantik.

Die realen DE-Rohdaten liegen versioniert unter
`src/evaluator/__fixtures__/whfb6-definitive/` (bereits bereitgestellt), getrennt
von den unberührten Solver-Testdaten und ohne die Clean-Room-Trennung (ADR-0030)
zu verletzen.

## Acceptance Criteria
- [ ] Die Fassade nimmt eine `.gst` + eine Liste von `.cat` entgegen; alle
      mitgegebenen Quellen werden in eine einzige globale `id→Definition`-Tabelle
      zusammengeführt und `entryLink`/`infoLink`/`sharedSelectionEntries`/
      `catalogueLink`-Ziele lösen darüber transitiv und zyklen-sicher auf.
- [ ] Wird die echte Ogre-`.cat` zusammen mit der `.gst` und der Mercenaries-`.cat`
      ausgewertet, so werden per Verweis importierte Definitionen (einschließlich
      solcher aus der `.gst` **und katalogübergreifend aus Mercenaries**) in der
      Auswertung berücksichtigt und erscheinen nicht fälschlich als unaufgelöst.
- [ ] Mindestens eine bekannte, nur über Mercenaries auflösbare Definition wird im
      Bericht korrekt aufgelöst (Beleg der katalogübergreifenden `catalogueLink`-
      Auflösung an echten Daten).
- [ ] Wird dieselbe Ogre-`.cat` **ohne** die Mercenaries-Abhängigkeit ausgewertet,
      erscheint das als Diagnose (`MISSING_CATALOGUE_DEPENDENCY`), nicht als Absturz.
- [ ] Ein Katalog, dessen `gameSystemId` nicht zur mitgegebenen `.gst` passt,
      erzeugt eine `GAMESYSTEM_MISMATCH`-Diagnose statt einer stillen
      Teil-Auswertung.
- [ ] Nur per Verweis bezogene bzw. geteilte Einträge erzeugen keine falsche
      Pflichtverletzung (sie stehen im `byId`-Lookup, nicht in der
      Wurzel-Definitionsliste).
- [ ] Eine leere Armee gegen die echten Ogre-Daten liefert einen strukturell
      vollständigen Bericht ohne Absturz.
- [ ] Ein Verweis, der trotz Auflösung nicht gefunden wird, erscheint als
      Diagnose; die Auswertung stürzt nicht ab.
- [ ] Die realen DE-Rohdaten werden von den Tests aus dem Repository gelesen, ohne
      die Testdaten der alten Engine zu verändern.
- [ ] Der synthetische Fassaden-E2E-Test („Walking Skeleton") und das synthetische
      Definitive-Edition-E2E-Fixture samt Loader existieren nicht mehr; alle ~12
      Aufrufstellen der Fassade sind auf die neue Signatur angepasst.
- [ ] Alle Tests (`npm test`) sind grün.

## Comments
- Engine auf Mehr-Katalog-Datensaetze umgestellt (ADR-0032): Fassade evaluate({ gameSystem, catalogues }, roster); catalogReader liest entryLink/selectionEntryGroup/sharedSelectionEntries/catalogueLink + gameSystemId; neues catalogSet.js aggregiert die Dokumente; Resolver loest entryLink/infoLink/catalogueLink transitiv & zyklen-sicher ueber eine globale id->Definition-Tabelle auf (geteilte/verlinkte Eintraege im lookup, nicht in der Wurzel-Definitionsliste); Kohaerenz-Diagnosen GAMESYSTEM_MISMATCH/MISSING_CATALOGUE_DEPENDENCY. Synthetische Walking-Skeleton- und Definitive-Edition-E2E-Tests samt Fixture/Loader entfernt, ~11 Aufrufstellen auf die neue Signatur angepasst, neuer realCatalogs-Loader + reale Ogre-E2E. npm test gruen (1796 Vitest + Puppeteer).
