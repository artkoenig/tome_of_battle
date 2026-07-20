Status: ready-for-agent
Type: refactor
Blocked by: None

## Description

Ergebnis einer Gesamtbewertung der Anwendung gegen die Architektur- und
Code-Generierungs-Prinzipien (UDF, SSOT, Immutability, OCP, Modularisierung,
keine leaky abstractions, DI, KISS; sprechende Namen, SRP, kurze Funktionen,
keine Magic Values, DRY, robuste Fehlerbehandlung, FIRST, YAGNI).

Die Bewertung bestand aus zwei unabhängigen Durchgängen — einer Analyse der
architektonischen Nahtstellen und einem vollständigen Code-Health-Audit über
alle ~13.200 Zeilen Produktivcode. Beide kamen zum selben Gesamtbild.

### Gesamtbefund

Die Codebasis ist **gesund, mit lokal begrenzten Problemzonen**. Die Schichtung
`parser → solver → components` ist real und wird eingehalten: kein Zyklus, keine
Node-Abhängigkeiten im Produktivcode, die Solver-Fachlogik ist ohne React
testbar. `npm run lint` (oxlint) ist grün (0 Fehler, 30 Warnungen).

Vorbildlich gelöst und als Maßstab für den Rest der Codebasis geeignet:
`db/catalogUpdate.js` und `db/migrations.js` (echte Dependency Injection,
bewusst entschiedenes und dokumentiertes Fehlerverhalten), `parser/xmlParser.js`
(gleichförmige kleine Parser-Funktionen, Attributnamen aus dem generierten
Schema-SSOT), `pushViolation`/`classifyBlocksAddAvailability` in
`solver/rosterValidator.js` (ein einziger Erzeugungspunkt für Verstöße, der bei
unklassifiziertem Typ wirft statt still durchzurutschen — Driftschutz im Code
statt in einer Konvention), sowie die ADR-Disziplin, die nicht-offensichtliche
Entscheidungen im Code an ihre ADR rückbindet.

Die Schwächen konzentrieren sich in drei Zonen:

1. **Die Grenze zwischen React-State und Solver.** Mutierende Solver-Helfer
   werden auf React-State losgelassen; abgeleitete Werte werden als State
   gespiegelt statt berechnet.
2. **`catalogEditor.js`** — die schwächste Datei der Codebasis; ein früher Wurf,
   der die spätere Qualitätslatte nie nachgezogen hat.
3. **Kontextobjekte und Konstanten** — dieselben Werte werden an mehreren
   Stellen leicht unterschiedlich zusammengebaut.

Ein Muster zieht sich durch mehrere Befunde: es existiert bereits eine benannte
Konstante oder ein exportierter Helfer, und daneben steht eine handgeschriebene
Kopie. Das deutet auf fehlende Auffindbarkeit, nicht auf Nachlässigkeit — eine
geteilte Konstantenquelle und eine durchgesetzte Solver-Fassade schließen
gleich mehrere Befunde auf einmal.

### Abgrenzung

Dieses Haupt-Issue ist **verhaltensneutral**. Die drei bei der Bewertung
gefundenen Korrektheitsfehler (stille Fehlauflösungen an Katalog- und
Persistenzgrenzen) sind bewusst als eigenes Haupt-Issue vom Typ `fix`
abgetrennt, damit dieser PR keine Verhaltensänderung mit sich führt.

### Übernommener Altbestand

Die Issues 28, 36 und 37 gehen inhaltlich in dieser Zerlegung auf; ihre Befunde
stehen in den jeweiligen Kind-Issues.

### Reihenfolge

Kind-Issue 01 ist bewusst als Prefactoring vorangestellt — 02 und 03 stützen
sich darauf. 08 setzt 07 voraus. Alle übrigen sind unabhängig und parallel
bearbeitbar.

Die Kind-Issues 04, 10 und 12 fassen dieselben Dateien an wie der offene
Pull Request zur UI-Internationalisierung und sollten erst nach dessen Merge
bearbeitet werden.

## Acceptance Criteria
- [ ] Alle Kind-Issues sind resolved
- [ ] `npm run lint` bleibt grün, `npm test` bleibt grün
- [ ] Keine Verhaltensänderung an Bestandsfunktionen — reines Refactoring
- [ ] Wo eine Umstrukturierung eine Architekturentscheidung festschreibt, ist
      sie als ADR dokumentiert

## Comments
