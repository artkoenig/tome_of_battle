Status: resolved
Type: refactor
Blocked by: None

## Description

Nach 39/04 liegt der PWA-Zustand größtenteils in `src/hooks/usePwaLifecycle.js`,
aber ein Rest blieb in `App.jsx`: der `isOffline`-`useState` samt eigenem
`online`/`offline`-Event-Listener. Dieser Rest wird in `usePwaLifecycle`
eingezogen, sodass der gesamte Online-/Offline-Zustand an einer Stelle liegt.

Kleiner, klar begrenzter Schnitt. Verhalten (Offline-Anzeige) unverändert.

## Acceptance Criteria
- [ ] `App.jsx` hält keinen eigenen `isOffline`-State/Listener mehr; der Wert
  kommt aus `usePwaLifecycle`.
- [ ] `usePwaLifecycle` deckt den Online-/Offline-Zustand vollständig ab; seine
  Tests werden entsprechend erweitert.
- [ ] Offline-Anzeige unverändert; `src/App.test.jsx` bleibt unverändert grün.

## Comments
- isOffline-State und die online/offline-Event-Listener aus App.jsx in usePwaLifecycle.js eingezogen; der Hook deckt den Online-/Offline-Zustand jetzt vollständig ab und gibt isOffline zurück. App.jsx hält keinen eigenen isOffline-State/Listener mehr (und keinen useEffect mehr). Offline-Anzeige unverändert; usePwaLifecycle-Tests um fünf Offline-Fälle erweitert; App.test.jsx unverändert grün.
