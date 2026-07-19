Status: ready-for-agent
Type: feature
Blocked by: None

## Description
Die beiden Vampire-Counts-Sonderheere „Army of the Lichemaster (WD#309-UK)"
und „Vampire Coast (WD#306-UK)" tragen je eine eigene, an ihre `forceEntry`
gehängte Constraint (`field="limit::<pts-costTypeId>"`, `scope="roster"`,
Basis `min=0`) sowie einen `modifier` (Typ `set`, bereits unterstützt), der
diese beim Wählen des jeweiligen Sonderheeres auf 2000 anhebt — netto: „wer
dieses Sonderheer wählt, muss die Liste auf ≥2000 Punkte bauen". Der Parser
liest die `modifiers` einer `forceEntry` bislang nicht, und es existiert
keine Auswertungslogik für forceEntry-eigene Constraints (nur
`categoryLink`-Constraints werden heute geprüft).

Scope bewusst eng: nur dieses belegte Muster (forceEntry-eigene
`limit::<costTypeId>`-Constraint, gated auf die eigene forceEntry-Id) wird
unterstützt — keine generische Auswertung für forceEntry-Modifier auf
beliebige andere Constraints, da dafür kein realer Anwendungsfall vorliegt.
Kein Bezug zu Kind-Issue 01.

## Acceptance Criteria
- [ ] Eine Roster mit gewähltem Sonderheer „Army of the Lichemaster" oder
      „Vampire Coast" und einem Punktelimit unter 2000 zeigt einen
      Validierungsfehler (die Liste ist ungültig).
- [ ] Ab einem Punktelimit von 2000 verschwindet dieser Fehler.
- [ ] Ein normales (nicht per forceEntry-Modifier eingeschränktes)
      Heerlager verhält sich unverändert — keine Regression.
- [ ] Reproduktions-Regressionstest mit realdatennahem Fixture (Vampire
      Counts, eines der beiden Sonderheere).
- [ ] Die volle Testsuite (`npm test`) bleibt grün.

## Comments
