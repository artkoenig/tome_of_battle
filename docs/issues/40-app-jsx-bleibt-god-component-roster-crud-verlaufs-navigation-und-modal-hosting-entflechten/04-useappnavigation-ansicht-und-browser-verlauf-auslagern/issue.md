Status: ready-for-agent
Type: refactor
Blocked by: None

## Description

Der Ansichts-Zustand (`view`), die `navigate`-Funktion und die Browser-Verlauf-
Kopplung (`popstate`-Listener sowie `pushState`/`replaceState`) verlassen
`App.jsx` und werden ein gemeinsamer Hook. Beide gehören zusammen: `navigate`
ist die einzige Stelle, die State **und** History gleichzeitig schreibt.

**Kein Router-Paket** — Navigation bleibt schlichter App-Zustand (ADR-0005 §5
gewahrt; sie wird nur aus App.jsx in einen Hook verlagert, nicht durch eine
Routing-Bibliothek ersetzt). Verhalten (Vorwärts-Navigation, Zurück-Taste,
Wiederherstellung des Rosters) unverändert.

## Acceptance Criteria
- [ ] Ein Hook (`useAppNavigation` o. ä.) kapselt `view`, `navigate` und die
  History-Synchronisation; `App.jsx` verdrahtet ihn nur noch.
- [ ] Kein Routing-Paket wird eingeführt (ADR-0005 §5 gewahrt).
- [ ] Vor-/Zurück-Navigation verhalten sich unverändert; der Hook hat eigene
  Unit-Tests; `src/App.test.jsx` bleibt unverändert grün.

## Comments
