Status: resolved
Type: feature
Blocked by: [01]

## Description
Extrahiert alle hart-codierten deutschen UI-Strings des Spielmodus
(`play/`-Baum: u. a. `PlayMode`, `PlayUnitDetails`, Lebenspunkte-Zähler) in
Übersetzungsschlüssel und ergänzt die englischen Übersetzungen. Baut auf dem
i18n-Grundgerüst aus Issue 01 auf.

## Acceptance Criteria
- [ ] Bei aktiver englischer Sprache ist der komplette Spielmodus
      (Einheitenübersicht, Lebenspunkte-Zähler, Detailansichten)
      ausschließlich auf Englisch beschriftet.
- [ ] Der episch-altertümliche Erzählton bleibt in der englischen Übersetzung
      erkennbar.
- [ ] Bestehende Komponententests (u. a. `PlayMode.test.jsx`) laufen
      unverändert grün (Testumgebung fix auf Deutsch).

## Comments
- Alle hart-codierten deutschen UI-Strings im Spielmodus (PlayMode.jsx, play/PlayUnitDetails.jsx) in t()-Schluessel unter dem play-Namespace extrahiert und englische Uebersetzungen mit epischem Ton ergaenzt (de.json/en.json). Bestehende Play-Tests unveraendert gruen.
