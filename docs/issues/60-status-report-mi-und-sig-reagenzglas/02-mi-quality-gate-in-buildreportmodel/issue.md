Status: resolved
Type: feature
Blocked by: 01-mi-und-sig-berechnung-in-complexity

## Description
Integration des Maintainability Index als Quality Gate und Modell-Kennzahl in `scripts/project-state/buildReportModel.js`:
1. Maintainability Index Gate als Schwellenwert-Prüfung ($MI \ge 65$).
2. Übergabe der SIG-Risikoprofil-Verteilung (% LOC in Low, Moderate, High, Very High) an das Berichtsmodell.
3. Absicherung in `buildReportModel.test.js` und `gates.test.js`.
