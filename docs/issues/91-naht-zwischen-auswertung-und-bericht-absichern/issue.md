Status: ready-for-agent
Type: refactor
Blocked by: None

## Description

Der Ablauf der Auswertung existiert zweimal, und die Uebergabe an den Bericht
haelt Zusagen, die niemand prueft. Beides ist an Main-Issue 82 sichtbar geworden,
weil es der erste Vorgang seit langem war, der dem Ablauf einen Schritt und dem
Bericht eine Eingabe hinzugefuegt hat.

Gefunden bei der Standards-Pruefung von Main-Issue 82, dessen beauftragte Arbeit
belegt und abgeschlossen ist. Anders als bei den Issues 88 und 90 sind hier
**drei der vier Punkte keine Umgebungsbefunde**, sondern die Form dessen, was
gerade gebaut wurde. Sie stehen trotzdem hier und nicht dort, weil sie den
Auftrag nicht unerfuellt lassen: der erfundene Nullwert ist weg und gemessen. Was
fehlt, ist die Absicherung der Naht — eine eigene Aufgabe mit eigenem Zuschnitt.

**1. Der Ablauf existiert zweimal, und die Kopien sind bereits auseinander.**
Neben der Fassade fuehrt das Messwerkzeug (`scripts/lib/evaluator-measurement.js:156-212`)
denselben Ablauf Schritt fuer Schritt noch einmal: Baumbau, Fixpunkt, Index,
Angebots-Anker, Nach-Durchlauf, Grenzen, Budget, Bericht. Main-Issue 82 musste
deshalb dieselbe Aenderung an beiden Stellen eintragen. Und sie stehen schon
nicht mehr gleich: die Fassade baut die Belegung **vor** dem Nach-Durchlauf, das
Messwerkzeug **danach**. Heute folgenlos, weil der Nach-Durchlauf nur die
effektiven Werte fortschreibt und die Knotenmenge nicht anfasst — aber nichts
haelt das fest. Der naechste Schritt, den jemand hinzufuegt, hat keinen Grund, in
beiden zu landen.

**2. Zwei Namen fuer dieselbe Traversierung, und ihre Gleichheit traegt jetzt
einen harten Abbruch.** Die Belegung laeuft ueber `allNodes`, der Bericht ueber
`selectableSlotsOf`. Liefern sie nicht exakt dieselbe Menge, bricht der
Berichtsbau ab (`occupancy.js:116`) — und dieser Pfad ist seit Main-Issue 82
nicht mehr optional, sondern Pflicht. Sie stimmen ueberein, weil
`selectableSlotsOf` heute nichts weiter tut als `allNodes` weiterzureichen
(`evalTree.js:722-724`). Genau die Entflechtung, die Issue 90 fuer diese Datei
vorsieht, koennte das aendern — und aus einem Berichtsbau eine Ausnahme machen.

**3. Zwei Indizes, zwei Bauformen.** Der Zaehlindex gibt einen gekapselten Leser
zurueck (`countIndex.js:207-218`), sein neues Geschwister eine rohe Abbildung
plus eine freistehende Lesefunktion (`occupancy.js:83`, `:113`) — weshalb der
Bericht einen Leser fuer eine Sammlung importieren muss, die er uebergeben
bekommen hat. Dieselbe Modulfamilie, dieselbe Rolle, zwei Konventionen.

**4. Die Berichtsfunktion nimmt sechs Stellungsparameter.** Die neue Eingabe
wurde als **vierte** eingeschoben, vor die Diagnosen — zwei benachbarte
Argumente, die niemand am Typ unterscheiden kann. Eine Funktion weiter unten in
derselben Datei nimmt genau solche Daten bereits als benanntes Buendel; das
Muster ist vorhanden.

*Abgrenzung zu Issue 87 Punkt 1:* jener betrifft den **Auswertungs-Kontext**
(Wurzel, Index, Kategorie-Ids, Diagnosen, Budget) an anderen Aufrufstellen. Die
Parameterliste der Berichtsfunktion ist eine andere Menge und dort nicht genannt.

## Acceptance Criteria
- [ ] Der Ablauf der Auswertung steht an einer Stelle; das Messwerkzeug benutzt ihn, statt ihn nachzubauen — oder die Abweichung ist begruendet und maschinell festgehalten.
- [ ] Belegung und Bericht laufen ueber denselben benannten Begriff; eine Erweiterung der Traversierung kann keinen Berichtsbau mehr zum Absturz bringen.
- [ ] Die beiden Indizes des Evaluators haben dieselbe Bauform.
- [ ] Die Berichtsfunktion ist gegen ein Vertauschen benachbarter Argumente unempfindlich.
- [ ] Kein Verhaltenswechsel an echten Katalogdaten; die Testsuite bleibt gruen, keine Erwartung unter `docs/testing/` wird abgeschwaecht.

## Comments
- Entstehung: Standards-Achse zu Main-Issue 82. Punkt 1 ist ein Umgebungsbefund, die Punkte 2 bis 4 betreffen die Form der Arbeit jenes Main-Issues. Sie wurden trotzdem nicht dort nachgebessert: der beauftragte Fehler ist behoben und ueber alle 112 Szenario-Roster gemessen (280 Slots aendern ihren Ist-Stand, ausnahmslos von 0 nach oben; Verletzungen, Diagnosen und Sichtbarkeit an allen 17180 Slots unveraendert). Die Naht abzusichern ist ein eigener Zuschnitt, kein offenes Ende jenes Auftrags.
- Beruehrt Issue 90 unmittelbar: dessen Punkt zur Entflechtung von `evalTree.js` ist genau die Aenderung, die Punkt 2 hier gefaehrlich macht. Wer 90 anfasst, sollte 91 Punkt 2 vorher oder zusammen erledigen.
- Ein weiterer Befund derselben Pruefung ist kein Fehler, sondern eine Annahme, die ehrlich hingeschrieben ist: die Belegung verwirft die Diagnosen ihrer Abfragen und verlaesst sich darauf, dass eine Diagnose immer mit einer Abfrage ohne Antwort zusammenfaellt. Das gilt heute an allen vier Stellen des Query-Primitivs, wird aber von nichts erzwungen.
