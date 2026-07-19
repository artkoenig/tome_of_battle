Status: resolved
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
- Alle Strings des ADR-0010 Dialog- und Toast-Systems in i18n-Schluessel (neue Namespaces dialogs/toasts) ueberfuehrt: showToast-Meldungen in App.jsx, die Bestaetigungsdialoge fuer Armeeliste/Spielsystem/Einheit sowie die Default-Labels der ConfirmationDialog-Komponente. Englische Uebersetzungen im epischen Ton ergaenzt. Bewusst ausgeklammert: separater PWA-Update-Toast und Importer-setError-Banner (andere Bereiche).
