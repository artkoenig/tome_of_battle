Status: ready-for-agent
Type: feature
Blocked by: [01]

## Description
Extrahiert alle hart-codierten deutschen UI-Strings des Roster-Dashboards
(Übersicht/Verwaltung der Armeelisten und Feldzüge) sowie des Import/Export-
Flows (`Importer`) und der Top-Level-App-Navigation in Übersetzungsschlüssel
und ergänzt die englischen Übersetzungen. Baut auf dem i18n-Grundgerüst aus
Issue 01 auf (Sprachumschalter, Erkennung, Persistenz existieren bereits).

## Acceptance Criteria
- [ ] Bei aktiver englischer Sprache zeigen Dashboard, Feldzug-/Armeelisten-
      Verwaltung, Import- und Export-Dialoge ausschließlich englische Texte.
- [ ] Der episch-altertümliche Erzählton bleibt in der englischen Übersetzung
      erkennbar (keine nüchterne Business-Sprache).
- [ ] Bestehende Komponententests (u. a. für `RosterDashboard`, `Importer`)
      laufen unverändert grün (Testumgebung fix auf Deutsch).

## Comments
