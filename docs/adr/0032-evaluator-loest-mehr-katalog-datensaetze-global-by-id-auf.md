---
Status: accepted
---

# Der Reinraum-Evaluator löst Mehr-Katalog-Datensätze (`.gst` + Liste von `.cat`) global-by-ID auf

ADR-0030 und ADR-0031 haben die katalogübergreifende Auflösung des Evaluators
(`src/evaluator/`) bewusst ausgeklammert: die Fassade `evaluate(catalogXml, roster)`
nahm genau **einen** Katalog-XML-String, und der Resolver löste nur die direkt
unter der Wurzel stehenden Einträge auf. Per Verweis oder Import bezogene
Definitionen — `entryLink`, `infoLink`, `sharedSelectionEntries` und
`catalogueLink` — sowie die Spielsystemdatei (`.gst`) blieben außen vor und
wurden nur als Diagnose gemeldet. Damit war kein echtes, vollständiges Datenset
auswertbar. Diese Grenze war in beiden ADRs als künftige Arbeit vermerkt.

## Kontext (an echten Definitive-Edition-Daten verifiziert)

Ein reales WHFB6-Datenset ist eine `.gst`-Spielsystemdatei plus **eine oder
mehrere** `.cat`-Armee-Kataloge. In der Definitive Edition
(`artkoenig/Warhammer-Fantasy-Battles-6th-Definitive-edition`, Upstream Lexicanum
Imperialis) deklariert **jeder** der 17 Armee-Kataloge genau **einen**
`catalogueLink` auf eine gemeinsame `Mercenaries`-`.cat`; Mercenaries selbst hängt
von keinem weiteren Katalog ab (Stern-Struktur). Beispiel Ogre Kingdoms: von 244
eindeutigen `targetId`s lösen **41 ausschließlich** über die Mercenaries-`.cat`
auf. `catalogueLink`/`.cat`→`.cat` ist damit real und für jede Armee zwingend.

BattleScribe-IDs sind global-eindeutige GUIDs. Über `.gst` + Ogre + Mercenaries
zusammengeführt treten keine ID-Kollisionen auf; alle Verweise lösen über eine
einzige flache Symboltabelle auf.

## Entscheidung

1. **Fassade nimmt eine `.gst` + eine Liste von `.cat`.** Die öffentliche
   Auswertungsfunktion nimmt ein Datenset entgegen, das die einzelne
   Spielsystemdatei strukturell von der Liste der Armee-Kataloge trennt (eine
   `.gst`, ein oder mehrere `.cat`). Die deterministische katalogübergreifende
   Verarbeitungsreihenfolge (Spielsystem zuerst, dann die Kataloge) leitet die
   Engine selbst ab — sie ist **keine** positionsabhängige Aufrufer-Konvention.
   Die konkrete Signatur-Form ist Implementierungsdetail.

2. **Auflösung ist global-by-ID, nicht der Kontext-Stack.** Alle mitgegebenen
   Quellen werden in eine einzige globale `id→Definition`-Symboltabelle gemischt;
   `entryLink`/`infoLink`/`catalogueLink`-Ziele lösen darüber als gewöhnlicher
   Lookup auf (transitiv, zyklen-sicher). Der in der Architektur (§3.1)
   beschriebene Kontext-Stack (lokal → Importe → Spielsystem) wird **nicht**
   gebaut: er ist nur bei mehrdeutigen IDs über importierende Kataloge nötig, was
   die disjunkten GUIDs ausschließen (YAGNI). `catalogueLink` wird deshalb als
   **Abhängigkeits-Deklaration** behandelt, nicht als eigener
   Auflösungsmechanismus — weil alle benötigten Kataloge gemeinsam als Quellen
   übergeben werden.

3. **Kohärenz wird als Diagnose gemeldet, nie still fehlausgewertet.** Ein
   Katalog, dessen `gameSystemId` nicht zur mitgegebenen `.gst` passt, und ein
   `catalogueLink`, dessen Ziel-Katalog nicht unter den mitgegebenen Quellen ist,
   erzeugen je eine Diagnose (`GAMESYSTEM_MISMATCH` bzw.
   `MISSING_CATALOGUE_DEPENDENCY`) statt einer stillen Teil-Auswertung. Ein trotz
   Auflösung unauflösbarer Verweis bleibt Diagnose, nie Absturz.

Der bestehende disjunktheits-Guard des Resolvers meldet eine echte ID-Kollision
weiterhin als Diagnose — der Sicherheitsnetz für den Fall, dass ein künftiger
Datensatz die GUID-Disjunktheit verletzt.

## Konsequenzen

- **Positiv:** Echte, vollständige Datensätze der Definitive Edition sind
  auswertbar, wie der Nutzer sie beim Import erlebt — inklusive der realen
  Mercenaries-Abhängigkeit. Die eine Fassaden-Naht ist explizit und
  reihenfolge-robust; ein mehrdeutig sortierter Aufruf kann die Modifikator-
  Semantik nicht mehr still kippen. Die katalogübergreifende Auflösung fügt sich
  in das bestehende globale `byId`-Modell des Resolvers ein, ohne dessen
  Ein-Katalog-Signatur zu brechen.
- **Negativ:** Die Fassaden-Signatur ändert sich (~12 Aufrufstellen, überwiegend
  Tests, werden mechanisch angepasst). Global-by-ID ist nur korrekt, solange die
  IDs katalogübergreifend disjunkt sind; bei kollidierenden IDs müsste der
  Kontext-Stack nachgezogen werden (durch die Kollisions-Diagnose sichtbar).
- **Neutral:** Der Evaluator bleibt gemäß ADR-0030 von `src/solver/` isoliert und
  nicht in die App verdrahtet. Die harte Import-Isolation ist unberührt. Der
  vollständige Kontext-Stack-Aufbau bleibt bewusst ungebaut, bis ein realer
  Datensatz ihn erzwingt.

## Zugehörige ADRs

- Schließt die in **ADR-0030** und **ADR-0031** als künftige Arbeit vermerkte
  katalogübergreifende Auflösungs-Grenze.
