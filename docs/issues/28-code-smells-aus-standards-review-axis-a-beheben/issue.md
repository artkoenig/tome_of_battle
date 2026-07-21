Status: superseded
Type: refactor
Blocked by: None

## Description
Die Axis-A-Standards-Review im Rahmen von Haupt-Issue 22 (Repository-
Aufräumung) hat sechs vorbestehende Code-Smells über die gesamte Codebasis
gefunden. Drei davon sind inzwischen in die Haupt-Issues 39 und 40
übergegangen (siehe Kommentar); dieses Issue führt nur noch die **Restpunkte**,
die dort bewusst nicht aufgenommen wurden:

1. **Tote Such-Funktion — `src/components/PlayMode.jsx`.** Der
   `searchTerm`-State wird nie verändert, daher können die Filter-Zweige in
   `getGroupedAndSortedSelections` nie greifen. Entweder entfernen oder die
   Suche tatsächlich verdrahten.
2. **Duplizierter Filter-Block — `src/components/PlayMode.jsx`.** Hinfällig,
   falls Punkt 1 die Suche entfernt statt sie zu verdrahten; die Entscheidung
   dort bestimmt diesen Punkt mit.
3. **Überlange Funktionen — `getArmourSave` und `getWardSave` in
   `src/solver/rulesEvaluator.js`.** Sie mischen Keyword-Scanning, mehrere
   Regex-Durchläufe und Save-Arithmetik. Beide haben dieselbe Struktur — ein
   Hinweis auf ein extrahierbares Muster. Der ursprüngliche Befund nannte
   ~220 Zeilen und die Datei `modifierEvaluator.js`; beides ist überholt:
   die Funktion liegt in `rulesEvaluator.js` und ist auf rund 357 Zeilen
   angewachsen.
4. **Inkonsistente Primitive/Union-Shapes außerhalb des Roster-Hooks** —
   `toast` (String oder `{message,type}`) sowie
   `saveSummaryData.breakdown`/`tooltipState.content` (Array oder ReactNode)
   erzwingen `typeof`/`Array.isArray`-Verzweigungen an jeder Nutzungsstelle.
   Der Anteil, der den Roster-Hook betrifft, ist in 39/03 aufgegangen und hier
   nicht mehr enthalten.

## Acceptance Criteria
- [ ] Für jeden der vier Restpunkte ist entschieden und umgesetzt: entfernen,
      beheben oder bewusst zurückstellen (mit Begründung)
- [ ] `npm run lint` bleibt grün, `npm test` bleibt grün
- [ ] Keine Verhaltensänderung an Bestandsfunktionen ohne separate Abnahme
      (reines Refactoring/Cleanup, keine neuen Features)

## Comments
- Teilweise ueberfuehrt in Issue 39 (Refactoring aus der Gesamtbewertung der
  Anwendung) und Issue 40 (Stille Fehlaufloesungen). Aufgegangen sind:
  Punkt 2 der urspruenglichen Liste (Positionsparameter statt
  Auswertungskontext) in Issue 40; Punkt 3 (duplizierte Zaehllogik) in 39/07;
  Punkt 6 (inkonsistente Union-Shapes) in 39/03, soweit er den Roster-Hook
  betrifft.
- Auf die Restpunkte gekuerzt: die uebergegangenen Punkte sind aus der
  Beschreibung entfernt, die verbleibenden neu durchnummeriert. Der Befund zu
  den ueberlangen Save-Funktionen wurde dabei auf den heutigen Stand
  gebracht (rulesEvaluator.js, rund 357 Zeilen statt der urspruenglich
  genannten ~220 in modifierEvaluator.js).
- Erneute Gesamtbewertung (2026-07-21): Punkt 3 (getArmourSave/getWardSave) bestaetigt und praezisiert. getArmourSave ist inzwischen 219 Zeilen mit neun mutablen Akkumulatoren; getWardSave dupliziert die Struktur. Der eigentliche Befund ist nicht die Laenge, sondern das Verfahren: Ruestungs- und Rettungswuerfe werden aus deutschen und englischen Regeltext-Schluesselwoertern heuristisch erraten statt aus Katalogdaten gelesen - im Widerspruch zur sonst durchgehaltenen Linie (systemQuirks.js: Sonderfaelle als Daten, nicht als Heuristik). Dazu laeuft eine gesonderte Spezifikations-Sitzung; das Ergebnis kann dieses Issue ersetzen oder einengen.
- Nachtrag zum vorigen Kommentar: die dort erwaehnte Spezifikations-Sitzung ist abgeschlossen. Ergebnis: das AS/WS-Feature wird auf Entscheidung des Maintainers ersatzlos entfernt statt auf Katalogdaten umgestellt (Kind-Issue 42/01). Damit entfaellt Punkt 3 dieses Issues vollstaendig - getArmourSave, getWardSave und die zugehoerigen Keyword-Listen werden geloescht. Offen bleiben hier nur die Punkte 1 und 2 (tote Suche im Spielmodus).
- superseded: Alle drei Punkte sind inzwischen andernorts erledigt, ohne dass dieses Issue je implementiert wurde. Punkt 1 und 2 (tote Suche im Spielmodus samt dupliziertem Filter-Block): von Kind-Issue 42/04 entfernt - searchTerm, setSearchTerm und beide Filter-Zweige sind aus PlayMode.jsx verschwunden, verifiziert. Punkt 3 (ueberlange getArmourSave/getWardSave): durch Kind-Issue 42/01 gegenstandslos, die Funktionen wurden mitsamt dem Feature ersatzlos geloescht, verifiziert. Es bleibt nichts zu tun.
