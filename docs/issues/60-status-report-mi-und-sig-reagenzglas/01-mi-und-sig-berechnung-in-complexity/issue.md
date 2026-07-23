Status: resolved
Type: feature
Blocked by: None

## Description
Erweiterung von `scripts/project-state/complexity.js` um:
1. Berechnung des Halstead-Volumens $V = N \cdot \log_2(\eta)$ (Operatoren & Operanden per AST).
2. Berechnung des Maintainability Index ($MI$) normiert auf 0–100:
   $$MI = \max\left(0, \frac{171 - 5.2 \ln(V) - 0.23 \cdot V(G) - 16.2 \ln(\text{LOC})}{171} \cdot 100\right)$$
3. Zuordnung der Codezeilen ($\text{LOC}$) in 4 SIG-Risikoklassen:
   - Low (1–5), Moderate (6–10), High (11–25), Very High (> 25).
4. Abdeckung mit Unit-Tests in `complexity.test.js`.
