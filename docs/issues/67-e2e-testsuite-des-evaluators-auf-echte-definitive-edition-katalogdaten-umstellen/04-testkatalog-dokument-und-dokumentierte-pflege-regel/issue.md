Status: resolved
Type: refactor
Blocked by: [01, 02, 03]

## Description

Sobald die E2E-Ebene vollständig auf echte Daten steht (Slices 01–03), wird ein
gepflegtes **Testkatalog-Dokument** angelegt, das jeden E2E-Test der neuen Engine
in nicht-technischer Sprache beschreibt, damit ein fachlicher Leser jeden Fall
nachvollziehen kann.

Je E2E-Test enthält der Katalog:
- den **Titel** des Tests,
- die **betroffenen Katalogdateien**,
- eine **Beschreibung des geprüften Roster-Zustands**,
- das **erwartete Ergebnis des Evaluators, nicht-technisch formuliert**,
- den **Link zur konkreten Testdatei**.

Der Katalog deckt **nur** die E2E-Tests der neuen Engine ab — keine Unit-/
Komponententests, keine Tests der alten Engine.

Zusätzlich wird eine **Pflege-Regel** im Repository dokumentiert: Sobald ein
neues Problem der Engine erkannt und gelöst wird, werden dafür ein E2E-Test
**und** ein zugehöriger Testkatalog-Eintrag angelegt. Die Pflege erfolgt von
Hand (kein Generator, kein CI-Gate).

## Acceptance Criteria
- [ ] Es existiert ein Testkatalog-Dokument, das **jeden** E2E-Test der neuen
      Engine auflistet.
- [ ] Jeder Eintrag nennt Titel, betroffene Katalogdateien, den geprüften
      Roster-Zustand, das erwartete Ergebnis in nicht-technischer Sprache und
      einen Link zur Testdatei.
- [ ] Der Katalog enthält keine Unit-/Komponententests und keine Tests der alten
      Engine.
- [ ] Der Katalog ist deckungsgleich mit den tatsächlich vorhandenen E2E-Tests
      (kein gelisteter Test fehlt in der Suite, kein Suite-Test fehlt im Katalog).
- [ ] Die Pflege-Regel ist an sichtbarer Stelle im Repository dokumentiert.

## Comments
- Testkatalog docs/testkatalog-evaluator-e2e.md angelegt: katalogisiert alle 23 E2E-Einzeltests (11 Szenarien) der Reinraum-Engine ueber 4 Dateien, je mit Titel, betroffenen Katalogdateien, Roster-Zustand, nicht-technischem Erwartungsergebnis und Zeilen-Link. Manuelle Pflege-Regel prominent im Dok + kurzer Verweis in ADR 0006. Deckungsgleich mit der Suite verifiziert.
