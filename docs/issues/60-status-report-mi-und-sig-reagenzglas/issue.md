Status: resolved
Type: feature
Blocked by: None

## Description

# PRD: Maintainability Index als Quality-Gate & SIG-Risikoprofil im Alchemisten-Reagenzglas & Aufklappbare Gate-Befunde

## Problem Statement
1. Bisher erfasst die Komplexitätsmessung in `scripts/project-state/complexity.js` zwar $V(G)$, verdichtet diese aber primär als Durchschnitt.
2. Fehlschlagende Quality Gates zeigen derzeit zwar ihren Status (z.B. "findings"), aber die konkrete Ausgabe des Werkzeugs (welche Lints, welche Fehler) ist im Statusbericht nicht aufklappbar.

## Solution
1. **Maintainability Index ($MI$)**:
   - Berechnet $MI$ ($0 \dots 100$) und bindet diesen als eigenes Quality Gate ($MI \ge 65$) ein.

2. **ISO 25010 / SIG Risikoprofil-Verteilung**:
   - Einordnung der Codezeilen in 4 Risikobänder (Low, Moderate, High, Very High).

3. **Visuelles Komplexitäts-Reagenzglas**:
   - Reagenzglas mit farbigen Flüssigkeitsschichten (Grün, Gelb, Orange, Purpur/Rot) pro Modul und global.

4. **Aufklappbare Gate-Befunde (Findings)**:
   - Bei Gates mit Befunden (`status === 'findings'`) oder Abbrüchen (`status === 'not-run'`) kann die Werkzeugausgabe nativ per `<details>` aufgerufen und in einem stilisierten Codeblock gelesen werden.

## Child Issues
- `01-mi-und-sig-berechnung-in-complexity` (resolved)
- `02-mi-quality-gate-in-buildreportmodel` (resolved)
- `03-reagenzglas-visualisierung-in-renderreport` (resolved)
- `04-expandable-gate-findings-in-renderreport` (resolved)
