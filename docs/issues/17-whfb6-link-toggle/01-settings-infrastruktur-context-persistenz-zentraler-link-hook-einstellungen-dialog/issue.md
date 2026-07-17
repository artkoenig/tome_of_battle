Status: resolved
Type: feature
Blocked by: None

## Description
Legt die technische Grundlage für die whfb6-Link-Einstellung (siehe [PRD](../issue.md), [ADR-0015](../../../adr/0015-settings-context-fuer-whfb6-verlinkung.md)): einen app-weiten `SettingsContext` mit persistiertem Boolean `whfb6LinkingEnabled` (Default `true`), einen zentralen Hook, der „Mapping vorhanden UND Einstellung aktiv" kapselt, sowie einen Einstellungen-Dialog, über den der Wert umgeschaltet werden kann.

Der zentrale Hook wird in diesem Issue **nicht** an bestehenden Chip-Stellen verdrahtet – das ist Gegenstand der Folge-Issues 02 und 03. Dieses Issue ist end-to-end demonstrierbar über den Dialog selbst: Schalter umlegen, App neu laden, Wert ist erhalten geblieben.

## Acceptance Criteria
- [ ] Ein neuer `SettingsContext`/`SettingsProvider` umschließt die App (`App.jsx`) und stellt `{ whfb6LinkingEnabled, setWhfb6LinkingEnabled }` reaktiv bereit
- [ ] Der Wert wird über einen neuen kleinen Store/Record in `database.js` (IndexedDB) persistiert; ohne vorhandenen Record ist der Default `true`
- [ ] Ein neues Zahnrad-Icon im globalen App-Header öffnet einen Einstellungen-Dialog mit einem Schalter für „Verlinkung zu 6th.whfb.app"
- [ ] Umschalten des Reglers ruft `setWhfb6LinkingEnabled` auf, aktualisiert den Context reaktiv und persistiert den neuen Wert
- [ ] Nach einem Reload zeigt der Schalter den zuletzt gesetzten Wert (persistiert)
- [ ] Ein neuer zentraler Hook existiert, der für einen gegebenen Namen `getRuleUrl(name)` nur dann zurückgibt, wenn `whfb6LinkingEnabled === true`, sonst `null` – unabhängig davon, ob ein Mapping existieren würde (noch ohne Verdrahtung an bestehende Chip-Komponenten)
- [ ] Unit-Tests für `SettingsProvider`/`SettingsContext`, die Persistenzfunktionen in `database.js` und den zentralen Hook

## Comments
- Added SettingsProvider/useSettings (src/contexts/SettingsContext.jsx) wrapping App and exposing { whfb6LinkingEnabled, setWhfb6LinkingEnabled }; persisted the flag in a new IndexedDB 'settings' store (DB_VERSION 1->2) with default true; added a header gear icon opening a SettingsDialog toggle; and a central useRuleUrl hook (src/hooks/useRuleUrl.js) that returns getRuleUrl(name) only when linking is enabled, else null. Hook deliberately not wired into chips yet (issues 02/03). Unit tests for all four seams; full suite green.
