Status: ready-for-agent
Type: feature
Blocked by: [01]

## Description

Pipeline-Tracer für Issue 58: beweist die gesamte Kette (strukturierte Daten →
zentrale Komposition → Anzeige) an **einer** Verstoß-Familie — der aus dem
Screenshot: `group-count`/`category` min/max.

Der Validator liefert für diese Familie zusätzlich zu (oder statt) dem fertigen
Text **strukturierte Felder** mit: Typ, Schweregrad, betroffene Entität +
Katalogname, Grenze (min/max), aktueller Wert, Einheit. Das sind dieselben Zahlen,
die der Validator intern ohnehin schon berechnet — **keine Logikänderung**, nur
die Datenform.

Eine **zentrale Kompositions-Stelle** (die einzige Quelle für deutschen
Meldungstext, i18n-fähig ablegen) baut aus diesen Feldern einen Klartext-Satz in
Alltagssprache, **ohne Handlungshinweis**. Die Anzeige-Komponente aus Issue 01
bevorzugt den komponierten Satz, wenn strukturierte Felder vorliegen, und fällt
sonst auf den bisherigen Text zurück.

Katalognamen (`"Weapons"`, `"Commander"`) bleiben im Satz **unverändert und
unübersetzt** (ADR 0003).

Zielwirkung: statt *„Kategorie \"Weapons\" erlaubt maximal 0 Auswahlen
(aktuell: 1 für Commander)."* z. B. *„Der Commander darf keine Waffen haben
(1 gewählt)."*

## Acceptance Criteria
- [ ] Der Validator füllt für die `group-count`/`category` min/max-Familie
      strukturierte Felder (Typ, Schweregrad, Entität + Katalogname, min/max,
      aktueller Wert, Einheit); Menge und Wahrheit der Verstöße bleiben unverändert
      (dieselben Verstöße wie vorher).
- [ ] Eine zentrale, framework-freie Kompositionsfunktion erzeugt aus diesen
      Feldern einen deutschen Klartext-Satz in Alltagssprache ohne
      Handlungshinweis; Katalognamen bleiben wortgetreu.
- [ ] Die Screenshot-Meldung erscheint in der App als verständlicher Klartext
      (z. B. „Der Commander darf keine Waffen haben (1 gewählt).").
- [ ] Meldungen ohne strukturierte Felder werden weiterhin unverändert angezeigt
      (Fallback).
- [ ] Der deutsche Meldungstext dieser Familie entsteht an genau einer Stelle
      (keine erneute Verstreuung über Views).
- [ ] Tests für die Kompositionsfunktion (Felder → erwarteter Satz) und für die
      strukturierten Felder am Validator; volle Suite grün.

## Comments
