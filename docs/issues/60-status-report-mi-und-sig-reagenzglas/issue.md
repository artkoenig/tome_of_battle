Status: resolved
Type: feature
Blocked by: None

## Description

# PRD: Maintainability Index als Quality-Gate & SIG-Risikoprofil im Alchemisten-Reagenzglas

## Problem Statement
Bisher erfasst die Komplexitätsmessung in `scripts/project-state/complexity.js` zwar die zyklomatische Komplexität $V(G)$ jeder Funktion, verdichtet diese im Statusbericht jedoch primär als arithmetischen Durchschnitt. Dadurch können hochkomplexe Funktionen ($V(G) > 25$) von vielen einfachen Helferfunktionen kaschiert werden.

## Solution
1. **Maintainability Index ($MI$)**:
   - Berechnung des normierten Maintainability Index ($0 \dots 100$) auf Basis von Halstead-Volumen, zyklomatischer Komplexität $V(G)$ und $\text{LOC}$.
   - Einbindung als eigenes **Quality Gate** im Statusbericht (z. B. $MI \ge 65$ grün/bestanden, $< 65$ Warnung/Blocker).

2. **ISO 25010 / SIG Risikoprofil-Verteilung**:
   - Kategorisierung aller Funktionen nach Komplexität $V(G)$ in 4 Risikobänder:
     - **Low Risk ($V(G) 1–5$)**: Ziel $> 60\%$ LOC
     - **Moderate Risk ($V(G) 6–10$)**: Ziel $< 30\%$ LOC
     - **High Risk ($V(G) 11–25$)**: Ziel $< 8\%$ LOC
     - **Very High Risk ($V(G) > 25$)**: Ziel $< 2\%$ LOC

3. **Visuelles Komplexitäts-Reagenzglas (Alchemisten-Thema)**:
   - Visualisierung der prozentualen Risikoverteilung als magisches Reagenzglas / Test-Tube mit farbigen Flüssigkeitsschichten (Grün, Gelb, Orange, Purpur/Rot) pro Modul und für das Gesamtsystem im Statusbericht.

## Child Issues
- `01-mi-und-sig-berechnung-in-complexity`
- `02-mi-quality-gate-in-buildreportmodel`
- `03-reagenzglas-visualisierung-in-renderreport`
