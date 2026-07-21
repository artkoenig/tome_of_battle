Status: needs-triage
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
