Status: claimed
Type: feature
Blocked by: None

## Description
# PRD: Internationalisierung der UI (Deutsch + Englisch)

## Problem Statement / Bug Description
Tome of Battle bietet seine gesamte Oberfläche ausschließlich auf Deutsch an —
sämtliche Nutzertexte (Buttons, Dialoge, Labels, Erklärtexte) sind als
Literal-Strings direkt in den React-Komponenten hinterlegt. Nutzer, die kein
Deutsch verstehen, können die App nicht bedienen.

## Solution
Einführung von `react-i18next` zur Übersetzung der **UI-Chrome** (Buttons,
Dialoge, Labels, Menüs, Erklärtexte der App selbst) ins Englische. Deutsch
bleibt die vollständige Ausgangssprache; Englisch wird als vollständige zweite
Sprache ergänzt und dient zugleich als globale Fallback-Sprache. Die Sprache
wird beim ersten Aufruf aus der Browser-Spracheinstellung (`navigator.language`)
ermittelt und ist danach über einen manuellen Umschalter in den Einstellungen
dauerhaft überstimmbar. Siehe [ADR-0022](../../adr/0022-i18n-ui-chrome-react-i18next.md)
für die Bibliotheks- und Scope-Entscheidung und
[ADR-0023](../../adr/0023-settingscontext-generischer-store.md) für die
Erweiterung des `SettingsContext`.

## User Stories / Requirements
1. Als Spieler mit englischer Browsersprache möchte ich die App beim ersten
   Aufruf automatisch auf Englisch sehen, damit ich sie ohne Deutschkenntnisse
   bedienen kann.
2. Als Spieler mit einer nicht unterstützten Browsersprache (z. B.
   Französisch) möchte ich die App auf Englisch sehen (globaler Fallback),
   statt auf eine für mich unverständliche Sprache zu treffen.
3. Als Spieler möchte ich die automatisch erkannte Sprache in den
   Einstellungen manuell auf Deutsch oder Englisch umschalten können, damit
   ich nicht von einer Fehlerkennung des Browsers abhängig bin.
4. Als wiederkehrender Spieler möchte ich, dass meine manuell gewählte Sprache
   über Neuladen und neue Sitzungen hinweg erhalten bleibt.
5. Als Spieler, der auf einen noch nicht übersetzten UI-Text trifft, möchte
   ich trotzdem einen sinnvollen (englischen) Text sehen statt eines Platzhalters
   oder Fehlers.
6. Als englischsprachiger Spieler möchte ich, dass der episch-altertümliche
   Erzählton der App auch auf Englisch spürbar bleibt, statt in eine
   nüchterne Business-Sprache zu wechseln.

## Technical Decisions
- **Affected Modules:** praktisch alle Komponenten unter `src/components/`
  (inkl. `editor/` und `play/`) für die String-Extraktion; `SettingsContext`
  (`src/context/` o. ä.) für die Sprachpräferenz; `src/db/database.js`
  (`settings`-Store) für die Persistenz; ein neues i18n-Initialisierungsmodul.
- **Technical Clarifications / Architectural Decisions:** siehe
  [ADR-0022](../../adr/0022-i18n-ui-chrome-react-i18next.md) (react-i18next,
  Scope UI-Chrome, Englisch als `fallbackLng`) und
  [ADR-0023](../../adr/0023-settingscontext-generischer-store.md)
  (`SettingsContext`-Erweiterung, revidiert ADR-0015). Variable Textlängen
  pro Sprache müssen innerhalb der festen Typografie-Klassen aus
  [ADR-0004](../../adr/0004-styling-conventions.md) funktionieren.
- **API Contracts / Data Models:** `SettingsContext` liefert zusätzlich
  `{ locale, setLocale }` neben dem bestehenden `whfb6LinkingEnabled`-Paar;
  `locale` wird im bestehenden `settings`-Object-Store persistiert
  ([ADR-0002](../../adr/0002-data-flow-and-indexeddb-storage.md)).

## Testing Decisions
- **Modules to Test:** bestehende Komponententests (unverändert, Testumgebung
  fix auf Deutsch); neues i18n-Initialisierungsmodul; `SettingsContext`/
  Sprachumschalter-UI; Persistenzschicht.
- **Test Interfaces (Seams):**
  1. Komponenten-Rendering (`@testing-library/react`, bestehendes Muster,
     Testumgebung fix auf `de`).
  2. Sprachumschalter-UI (`LanguageSwitcher.test.jsx` oder Erweiterung von
     `SettingsContext.test.jsx`) — prüft am UI-Verhalten.
  3. Persistenz (Erweiterung bestehender `database.test.js`-Tests) — Sprache
     wird geschrieben und beim Neuladen korrekt gelesen.
  4. i18n-Initialisierungsmodul (neue öffentliche Schnittstelle) — Browser-
     Erkennung, Fallback Englisch, Vorrang der gespeicherten Nutzer-Override.
  5. Fehlender Übersetzungsschlüssel (gegen dieselbe Schnittstelle) — löst
     zum englischen Wert auf.

## Out of Scope
- Übersetzung von Battlescribe-Spielinhalten (Einheiten-, Waffen-, Regelnamen
  aus `.cat`/`.gst`) — das Datenmodell hält nur einen String pro Element,
  eine Content-Übersetzung wäre ein eigenständiges, separates Vorhaben.
- Die extern verlinkten Regeltexte von `6th.whfb.app`
  ([ADR-0012](../../adr/0012-integration-externer-regeltexte-6th-whfb-app.md))
  bleiben unabhängig von der UI-Sprache immer englisch — akzeptierte
  Einschränkung des verlinkten Drittanbieter-Inhalts, kein Implementierungsfehler.
- Weitere Sprachen über Deutsch/Englisch hinaus.
- Übersetzung von Fehlermeldungen/Logs, die nur im Entwicklermodus sichtbar sind.
- Der separate PWA-"Update verfügbar"-Toast (Changelog-Hinweis) bleibt
  unabhängig von der UI-Sprache immer deutsch — anderer Mechanismus als das
  ADR-0010-Dialog-/Toast-System, bewusst nicht Teil dieser Änderung.

## Acceptance Criteria
- [ ]

## Comments
