Status: resolved
Blocked by: None

## Description

Erstelle die `RulesIndexDialog`-Komponente – einen modalen Dialog, der einen Iframe mit einer Seite von 6th.whfb.app einbettet.

Props:
- `ruleName` (string) – Anzeigetitel im Dialog-Header
- `url` (string) – die vollständige Iframe-URL (inkl. `?minimal=true&utm_source=...`)
- `isOpen` (boolean)
- `onClose` (function)

Verhalten:
- Rendert einen Iframe mit `https://6th.whfb.app${path}` wenn `isOpen=true`
- Zeigt einen Lade-Spinner, bis der Iframe geladen ist
- Bei Verbindungsfehler: benutzerfreundliche Fehlermeldung ("Keine Verbindung zu 6th.whfb.app")
- Schließen-Button (X) oben rechts oder via Escape-Taste
- Folgt dem lokalen Dialog-State-Muster (ADR-0010) – kein globaler Context

Die Komponente verwendet die gleiche Stilistik wie das bestehende BottomSheet (Overlay, Transition, z-index).

Tests: `RulesIndexDialog.test.jsx` testet Iframe-URL, Spinner, Error, Close.

## Acceptance Criteria
- [ ] Dialog öffnet sich bei `isOpen=true` und schließt bei `onClose`
- [ ] Iframe lädt die übergebene URL
- [ ] Lade-Spinner wird gezeigt, bis der Iframe bereit ist
- [ ] Bei Netzwerkfehler wird eine Fehlermeldung angezeigt
- [ ] Escape-Taste schließt den Dialog
- [ ] Tests decken alle Zustände ab (offen, geschlossen, laden, fehler)

## Comments
- Implementiert: RulesIndexDialog.jsx mit Iframe, Lade-Spinner, Escape-Schließen, Body-Scroll-Lock. CSS in index.css. 12 Komponententests grün.
