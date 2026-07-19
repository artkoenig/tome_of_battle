Status: ready-for-agent
Type: feature
Blocked by: [01]

## Description
Extrahiert alle hart-codierten deutschen UI-Strings des Roster-Editors
(`editor/`-Baum: u. a. `SelectionConfigurator`, `OptionGroup`, `UnitChips`,
`RuleChipIcon`, `RosterEditor`) in Übersetzungsschlüssel und ergänzt die
englischen Übersetzungen. Baut auf dem i18n-Grundgerüst aus Issue 01 auf.

## Acceptance Criteria
- [ ] Bei aktiver englischer Sprache ist der komplette Roster-Editor
      (Einheiten-, Ausrüstungs- und Optionsauswahl) ausschließlich auf
      Englisch beschriftet.
- [ ] Der episch-altertümliche Erzählton bleibt in der englischen Übersetzung
      erkennbar.
- [ ] Bestehende Komponententests (u. a. `RosterEditor.test.jsx`) laufen
      unverändert grün (Testumgebung fix auf Deutsch).

## Comments
