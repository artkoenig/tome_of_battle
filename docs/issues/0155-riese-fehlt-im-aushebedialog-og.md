---
status: backlog
branch:
pr:
---

# Riese im Aushebedialog der O&G Definitive Edition anbieten

## Goal

Der Riese ist im Aushebedialog der Armee "Orcs & Goblins" (Definitive Edition) unter der Kategorie "Selten" auswählbar; heute fehlt der Eintrag im Dialog vollständig, obwohl die Katalogdaten ihn führen.

## Acceptance criteria

- AC1: Aus den Katalogdaten der O&G Definitive Edition ist belegt, unter welchem Mechanismus (Entry Link, Selection Entry Group, Kategorie-Zuordnung, Modifier oder Constraint) der Riese als seltene Auswahl angeboten wird; das Ergebnis steht in der Issue-Datei unter "Befund".
- AC2: Der Aushebedialog listet den Riesen für die O&G Definitive Edition unter "Selten" als auswählbaren Eintrag.
- AC3: Ein aus den Katalogdaten abgeleitetes Testszenario nagelt fest, dass der Riese als seltene Auswahl der O&G Definitive Edition angeboten wird, und schlägt gegen den heutigen Stand fehl. | verify: forge-test
- AC4: Alle Checks laufen grün. | verify: forge-test && forge-lint && forge-typecheck && forge-build

## Out of scope

- Andere Armeen und andere Katalog-Editionen; die Ursache wird generisch behoben, aber nur O&G Definitive wird als Testfall festgenagelt.
- Regeln, Punktekosten und Profilwerte des Riesen.
- Umbau des Aushebedialogs über den zur Behebung nötigen Umfang hinaus.
