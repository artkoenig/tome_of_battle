Status: superseded
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
Meldungstext, i18n-fähig ablegen) baut aus diesen Feldern einen Klartext-Satz
gemäß der verbindlichen **Ton-Vorgabe im PRD des Main-Issues 58**
(Abschnitt „Formulierung / Ton"). Die Anzeige-Komponente aus Issue 01 bevorzugt
den komponierten Satz, wenn strukturierte Felder vorliegen, und fällt sonst auf
den bisherigen Text zurück.

Für diese Familie gelten die PRD-Beispiele:

- Gruppe max = 0 (Screenshot): `Commander darf keine Auswahl aus „Weapons" treffen.`
- Gruppe max ≥ 1: `Butcher darf höchstens eine Auswahl aus „Arcane Items" treffen.`
- Gruppe min: `Butcher braucht mindestens eine Auswahl aus „Arcane Items".`
- Kategorie (Armee-Ebene): `Die Armee darf höchstens eine Auswahl aus „Special" treffen.`

Katalognamen (`"Weapons"`, `"Arcane Items"`) bleiben im Satz **unverändert und
unübersetzt** (ADR 0003).

## Acceptance Criteria
- [ ] Der Validator füllt für die `group-count`/`category` min/max-Familie
      strukturierte Felder (Typ, Schweregrad, Entität + Katalogname, min/max,
      aktueller Wert, Einheit); Menge und Wahrheit der Verstöße bleiben unverändert
      (dieselben Verstöße wie vorher).
- [ ] Eine zentrale, framework-freie Kompositionsfunktion erzeugt aus diesen
      Feldern einen deutschen Klartext-Satz gemäß der Ton-Vorgabe im PRD
      (ohne Possessiv, ohne interne Struktur­begriffe, „Auswahl(en)" als
      Zählwort, Katalognamen wortgetreu, kein Handlungshinweis).
- [ ] Die Screenshot-Meldung erscheint in der App als
      `Commander darf keine Auswahl aus „Weapons" treffen.`
- [ ] Meldungen ohne strukturierte Felder werden weiterhin unverändert angezeigt
      (Fallback).
- [ ] Der deutsche Meldungstext dieser Familie entsteht an genau einer Stelle
      (keine erneute Verstreuung über Views).
- [ ] Tests für die Kompositionsfunktion (Felder → erwarteter Satz) und für die
      strukturierten Felder am Validator; volle Suite grün.

## Comments
- superseded: Strukturierte Fehler (messageKey+params) und zentrale Komposition (formatValidationError) bereits durch i18n-PR #114 auf main vorhanden.
