Status: resolved
Type: refactor
Blocked by: None

## Description

Der Toast-Zustand samt Auto-Ausblende-Timer (`showToast`) und der Fehlerkanal
(`reportError`) verlassen `App.jsx` und werden ein eigener Hook. **Lokaler
State, kein React-Context** — ADR-0010 hat einen Toast-Context bewusst
verworfen und bleibt gewahrt.

Der Hook liefert den aktuellen Toast plus die Aktionen; `App.jsx` rendert das
Toast-Element weiterhin an der Wurzel und reicht die Aktionen an die Kinder
durch. Verhalten (Text, Dauer, Fehlerpfad) unverändert.

## Acceptance Criteria
- [ ] Ein Hook (`useToast` o. ä.) kapselt Toast-State, Timer und Fehlerkanal;
  `App.jsx` hält keinen Toast-`useState`/Timer mehr selbst.
- [ ] Kein neuer React-Context/Provider (ADR-0010 gewahrt).
- [ ] Anzeigeverhalten und Fehlerpfad unverändert; der Hook hat eigene
  Unit-Tests; `src/App.test.jsx` bleibt unverändert grün.

## Comments
- Toast-Zustand, Auto-Ausblende-Timer (showToast) und Fehlerkanal (reportError) in src/hooks/useToast.js gekapselt. Lokaler State, kein Context (ADR-0010). App.jsx hält keinen Toast-useState/Timer mehr, rendert das Toast-Element weiterhin an der Wurzel und reicht showToast/reportError an useAppData, useRosterList und die Kinder durch. Anzeige-/Fehlerverhalten unverändert; eigene Unit-Tests (Fake-Timer); App.test.jsx unverändert grün.
