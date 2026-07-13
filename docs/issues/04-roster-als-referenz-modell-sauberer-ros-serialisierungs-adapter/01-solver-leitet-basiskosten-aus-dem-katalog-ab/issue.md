Status: resolved
Blocked by: None

## Description

Prefactor. Die Kostenberechnung im Solver bezieht die Basiskosten einer Auswahl
aus dem Katalog (`resolveEntry(entry).costs`, inkl. Link-Kosten) statt aus dem im
Roster gespeicherten `selection.costs`. Zusätzlich wird eine **Pro-Auswahl-
Kostenfunktion** bereitgestellt, die den modifier-bewussten Gesamtwert einer
einzelnen Auswahl liefert (dieselbe Quelle/Logik wie der Gesamtblock von
`calculateRosterCosts`), damit der Export sie später konsumieren kann.

Verhalten bleibt nach außen identisch: Gesamt- und Anzeigekosten für native wie
importierte Roster stimmen weiterhin, jetzt aber unabhängig vom gespeicherten
`costs`-Feld. Reine Solver-Änderung; keine armeespezifische Logik (ADR-0003).

## Acceptance Criteria
- [ ] `calculateRosterCosts` liefert für ein Roster identische Summen, wenn das
      `selection.costs`-Feld leer/entfernt ist (Basiskosten aus dem Katalog).
- [ ] Neue Pro-Auswahl-Kostenfunktion liefert den modifier-bewussten Gesamtwert
      einer Auswahl (konsistent zum Gesamtblock).
- [ ] Bestehende Solver-/Kosten-Tests bleiben grün; neue Tests decken die
      Katalog-Ableitung (inkl. Link-Kosten und eines Kosten-Modifikators) ab.

## Comments
- Umgesetzt: neuer Kernel getSelectionOwnCosts in rosterCounter.js berechnet die eigenen, modifier-bewussten Kosten eines Knotens (Basis aus Katalog via resolveEntry, inkl. Link-Kosten; Fallback auf selection.costs nur ohne System). calculateRosterCosts und getSelectionTotalCost nutzen den Kernel. Neue Tests rosterCounter.test.js decken Katalog-Ableitung, Link-Kosten und Kosten-Modifier ab. Volle Suite gruen (231).
