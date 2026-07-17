Status: claimed
Type: feature
Blocked by: None

## Description

# PRD: Einstellung zum Ein-/Ausschalten der whfb6-Verlinkung

> **Architektur-Entscheidung:** Die Wahl eines neuen `SettingsContext` statt
> Prop-Drilling oder Modul-Singleton ist in
> **[ADR-0015](../../adr/0015-settings-context-fuer-whfb6-verlinkung.md)**
> festgehalten. Dieses Dokument ist die Feature-Spezifikation.

## Problem Statement / Bug Description

Seit [Issue 08](../08-6th-whfb-app-regeltexte-integrieren/issue.md) verlinken Regel-/Waffen-/Magic-Item-Chips bei bekanntem Namens-Mapping auf `6th.whfb.app` (via `getRuleUrl()`/`RuleChipIcon`). Bei unbekanntem Mapping greift bereits ein Fallback auf die knappe Katalog-Info (BottomSheet/Tooltip, `Info`-Icon) – kein Broken Link. Es gibt aber keine Möglichkeit, diese externe Verlinkung bewusst komplett abzuschalten: Nutzer, die aus welchem Grund auch immer nicht auf `6th.whfb.app` verlinkt werden wollen, haben keine Wahl.

## Solution

Eine neue, global wirkende Einstellung „Verlinkung zu 6th.whfb.app" (Default: **aktiv**, entspricht dem heutigen Verhalten). Ist sie deaktiviert, verhält sich die App überall dort, wo heute `getRuleUrl()` konsultiert wird, exakt so, als existiere kein Mapping für den jeweiligen Namen – der bereits vorhandene Katalog-Fallback (Info-Icon, BottomSheet/Tooltip) greift unverändert. Es wird kein neuer Fallback-Mechanismus gebaut; die Einstellung schaltet nur um, welcher der beiden bereits existierenden Pfade genommen wird.

Die Einstellung wird über einen neuen, schlanken `SettingsContext` (siehe ADR-0015) app-weit reaktiv bereitgestellt, in einem neuen Einstellungen-Dialog (Zahnrad-Icon im globalen Header) umgeschaltet und persistiert einen Reload (IndexedDB via `database.js`, konsistent mit ADR-0002/SSOT).

Der „Regelbuch"-Button in `PlayMode` (öffnet das gesamte Regelbuch auf `6th.whfb.app` in einem neuen Tab) ist **nicht** Teil dieser Einstellung: Er beruht nicht auf `getRuleUrl()`/dem Mapping-Mechanismus, sondern ist ein bewusster, expliziter Klick des Nutzers auf eine externe Seite.

## User Stories / Requirements

1. **Als Spieler**, der aus welchem Grund auch immer nicht zu `6th.whfb.app` verlinkt werden möchte, möchte ich die Verlinkung global abschalten können, damit Regel-/Waffen-/Magic-Item-Chips stattdessen immer die Katalog-Kurzinfo zeigen.
2. **Als Spieler** möchte ich die Einstellung jederzeit wieder umschalten können und sofort sehen, wie sich offene Chips entsprechend verhalten (keine Notwendigkeit, die App neu zu laden).
3. **Als Spieler** möchte ich, dass meine Wahl über einen Neustart/Reload der App hinweg erhalten bleibt.
4. **Als Spieler** möchte ich die Einstellung an einem naheliegenden, zentralen Ort finden (Einstellungen-Dialog über den globalen Header), unabhängig davon, ob ich mich gerade im Roster-Editor oder im Spielmodus befinde.

## Technical Decisions

- **Affected Modules:**
  - Neu: `SettingsContext`/`SettingsProvider` (app-weit in `App.jsx` eingebunden) mit `{ whfb6LinkingEnabled, setWhfb6LinkingEnabled }`.
  - Neu: zentraler Hook, der die Kombination „Mapping vorhanden UND Verlinkung aktiv" kapselt und von allen bisherigen `getRuleUrl()`-Aufrufstellen genutzt wird (ersetzt die direkten Aufrufe in `RuleChipIcon.jsx`, `UnitChips.jsx` – beide Stellen –, `RosterEditor.jsx` und `PlayMode.jsx`). Die bestehende Duplizierung der Mapping-Prüfung in `UnitChips.jsx` wird dabei zentralisiert (siehe [ADR-0012](../../adr/0012-integration-externer-regeltexte-6th-whfb-app.md) zur ursprünglichen Link-Priorität-Logik).
  - Neu: kleiner Settings-Store/Record in `database.js` (IndexedDB) für Lesen/Schreiben der Einstellung.
  - Neu: Einstellungen-Dialog-Komponente, erreichbar über ein neues Zahnrad-Icon im globalen App-Header.
  - Unverändert: `getRuleUrl()`/`rulesLookup.js` selbst (reine, settings-unabhängige Lookup-Funktion bleibt bestehen), der „Regelbuch"-Button in `PlayMode.jsx`.
- **Technical Clarifications / Architectural Decisions:** Siehe [ADR-0015](../../adr/0015-settings-context-fuer-whfb6-verlinkung.md) für die Context-vs-Prop-Drilling-vs-Singleton-Abwägung.
- **API Contracts / Data Models:**
  ```js
  // SettingsContext
  { whfb6LinkingEnabled: boolean, setWhfb6LinkingEnabled: (value: boolean) => void }
  ```
  Persistenter Wert in IndexedDB: ein einzelner Boolean-Record, Default `true` bei erstem Start (kein vorhandener Record).

## Testing Decisions

- **Modules to Test:**
  - Zentraler Hook: liefert URL nur wenn Mapping existiert UND Einstellung aktiv ist; liefert `null` sobald die Einstellung deaktiviert ist, unabhängig vom Mapping.
  - `SettingsProvider`: Default-Wert bei fehlendem persistiertem Record; gibt aktualisierten Wert nach `setWhfb6LinkingEnabled` reaktiv an Consumer weiter.
  - Settings-Persistenzfunktionen in `database.js`: Schreiben und anschließendes Lesen liefert denselben Wert; Verhalten ohne vorhandenen Record (Default).
  - Einstellungen-Dialog: zeigt aktuellen Wert des Schalters; ruft beim Umschalten `setWhfb6LinkingEnabled` auf.
  - `RuleChipIcon`/`UnitChips` (Integration): zeigen `BookOpen`-Icon nur bei Mapping + aktiver Einstellung; zeigen `Info`-Icon/Katalog-Fallback bei deaktivierter Einstellung, auch wenn ein Mapping existieren würde.
- **Test Interfaces (Seams):**
  1. Zentraler Hook (Link-vs-Fallback-Entscheidung).
  2. `SettingsContext`/`SettingsProvider`.
  3. Settings-Persistenzfunktionen in `database.js`.
  4. Einstellungen-Dialog-Komponente.
  5. `RuleChipIcon`/`UnitChips` Integrationstest.

## Out of Scope

- Der „Regelbuch"-Button in `PlayMode` (öffnet das gesamte Regelbuch in neuem Tab) – bleibt von der Einstellung unberührt.
- Ein generischer, erweiterbarer „App-Settings"-Store für beliebige zukünftige Einstellungen – der neue `SettingsContext` deckt bewusst nur diese eine Einstellung ab (siehe ADR-0015).
- Geräteübergreifende Synchronisation der Einstellung – die App hat keinerlei Sync-/Account-Mechanismus (IndexedDB ist rein lokal), daher ist die Einstellung zwangsläufig pro Gerät/Browser.
- Sonderbehandlung eines bereits geöffneten `RulesIndexDialog` beim Deaktivieren der Einstellung während der Dialog offen ist – der Dialog bleibt bis zum manuellen Schließen wie gewohnt bestehen.

## Acceptance Criteria
- [ ]

## Comments
