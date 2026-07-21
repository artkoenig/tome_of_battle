Status: ready-for-agent
Type: refactor
Blocked by: None

## Description

Die drei an der Wurzel gehosteten Dialoge (Einstellungen, Neues-Roster-Modal,
Lösch-Bestätigung) verlassen den JSX-Rumpf von `App.jsx` und werden in eine
eigene Präsentationskomponente `AppDialogs` gebündelt, die nur Sichtbarkeits-
Flags und Callbacks von außen erhält.

**Kein Context/Provider** — die Dialoge bleiben von außen gesteuert und lokal an
ihren jeweiligen Vorgang gebunden (ADR-0010 gewahrt). Verhalten (Öffnen,
Bestätigen, Abbrechen) unverändert.

## Acceptance Criteria
- [ ] Eine Komponente `AppDialogs` (o. ä.) rendert die drei Dialoge und bekommt
  Sichtbarkeit + Callbacks als Props; `App.jsx` deklariert die Dialoge nicht
  mehr einzeln im JSX.
- [ ] Kein neuer Context/Provider (ADR-0010 gewahrt).
- [ ] Öffnen/Bestätigen/Abbrechen unverändert; `src/App.test.jsx` bleibt
  unverändert grün.

## Comments
