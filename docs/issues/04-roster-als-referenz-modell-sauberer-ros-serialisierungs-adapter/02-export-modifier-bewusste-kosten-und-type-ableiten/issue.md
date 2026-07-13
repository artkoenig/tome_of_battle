Status: ready-for-agent
Blocked by: [01]

## Description

Der Export serialisiert pro Auswahl den **modifier-bewussten** Kostenwert aus der
in Issue 01 bereitgestellten Pro-Auswahl-Kostenfunktion (statt des interimistischen
`sel.costs × number`). Das `type`-Attribut wird aus dem Katalog abgeleitet
(`resolveEntry(entry).type` → `unit`/`model`/`upgrade`) statt konstant `upgrade`.

Damit ist der Export die eine autoritative Kostenquelle: Zeilenkosten und
Gesamtblock stammen aus derselben Berechnung; auch durch Modifikatoren veränderte
Optionskosten (Rabatt/Aufpreis) werden korrekt exportiert.

## Acceptance Criteria
- [ ] Exportierte `.ros`: flache Summe der Selektionskosten = im Editor
      berechnete Gesamtsumme (inkl. mehrmodelliger Einheiten).
- [ ] Durch Modifikatoren veränderte Optionskosten werden pro Zeile korrekt
      exportiert.
- [ ] `type` im Export entspricht dem Katalogeintrag.
- [ ] Unit-Tests für Kosten- und `type`-Serialisierung erweitert.
- [ ] `docs/battlescribe-data-format.md` / CLAUDE.md: falls sie das alte
      Export-Kostenverhalten beschreiben, an ADR-0011 angeglichen.

## Comments
