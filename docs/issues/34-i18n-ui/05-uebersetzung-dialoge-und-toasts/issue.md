Status: ready-for-agent
Type: feature
Blocked by: [01]

## Description
Extrahiert alle hart-codierten deutschen UI-Strings des einheitlichen
Dialog- und Toast-Systems (ADR-0010: Bestätigungsdialoge, Fehlermeldungen,
Toast-Benachrichtigungen) in Übersetzungsschlüssel und ergänzt die englischen
Übersetzungen. Baut auf dem i18n-Grundgerüst aus Issue 01 auf.

## Acceptance Criteria
- [ ] Bei aktiver englischer Sprache erscheinen sämtliche Bestätigungsdialoge,
      Fehlermeldungen und Toast-Benachrichtigungen ausschließlich auf
      Englisch.
- [ ] Der episch-altertümliche Erzählton bleibt in der englischen Übersetzung
      erkennbar.
- [ ] Bestehende Komponententests, die Dialog-/Toast-Verhalten prüfen, laufen
      unverändert grün (Testumgebung fix auf Deutsch).

## Comments
