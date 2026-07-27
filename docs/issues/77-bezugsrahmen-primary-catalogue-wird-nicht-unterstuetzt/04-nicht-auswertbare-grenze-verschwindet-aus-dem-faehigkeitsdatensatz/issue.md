Status: resolved
Type: fix
Blocked by: [03]

## Description

Nachbesserung an der eigenen Arbeit dieses Main-Issues.

**1. Der Hauptpunkt: die Entscheidung kippt an der Stelle um, an der sie am
meisten zaehlt.** Scheibe 03 hat richtig entschieden, dass eine Regel, die die
Engine nicht auswerten kann, nicht als erfuellt durchgehen darf. Fuer
Verletzungen gilt das jetzt. Fuer den **Faehigkeitsdatensatz** — den Datensatz,
aus dem sich die Oberflaeche speist (ADR-0035) — gilt das Gegenteil: eine Grenze,
die nicht ausgewertet werden kann, faellt dort ersatzlos heraus. Der Slot sieht
danach aus, als haette er gar keine Grenze.

Gemessen an derselben Eingabe, vor und nach der Aenderung: eine Obergrenze von
eins auf einem nicht aufloesbaren Bezugsrahmen, eine Auswahl getroffen —
vorher Obergrenze 1 und Spielraum 1, nachher **beides leer**. Und leer bedeutet
laut Vertrag "keine Obergrenze". Aus "wir wissen es nicht" wird also "unbegrenzt"
— genau das fail-open, das dieser Slice schliessen sollte, nur eine Schicht
weiter.

Der Bericht kann heute nicht unterscheiden zwischen "es gibt keine Grenze" und
"die Grenze war nicht auswertbar". Diese Unterscheidung fehlt und muss her.

**2. Eine unbeantwortbare Abfrage ohne jede Meldung.** Die Bindung des primaeren
Katalogs geschieht nur an echten Kontingent-Knoten. Ausserhalb davon — etwa an
einem Pflicht-Platzhalter auf oberster Ebene — liefert die Abfrage zwar den Wert
"keine Antwort", aber es entsteht **keine** Diagnose. Der Code sagt an zwei
Stellen ausdruecklich zu, die Meldung stamme bereits aus dem Baumbau. Diese
Zusage gilt dort nicht. Im eingefrorenen Datensatz sind die Zutaten vorhanden:
sieben roster-weite Pflichtgrenzen und 27 Vorkommen des Bezugsrahmens.

**3. Eine letzte Stelle, die noch die Null liefert.** In derselben Datei, in der
eine unbeantwortbare Abfrage den neuen Wert zurueckgibt, tut eine zweite Stelle
bei derselben Art von Fehler weiterhin das Alte. Heute nur ein Schutzzweig, aber
es ist exakt das Muster, gegen das der gemeinsame Wert eingefuehrt wurde: zwei
Antworten auf dieselbe Frage, von denen eine geprueft und eine vergessen wird.

**4. Die Meldung je Kontingent erscheint auch dann, wenn niemand fragt.** Fehlt
einem Kontingent die Katalog-Angabe, wird das gemeldet — selbst wenn im ganzen
Datensatz keine einzige Regel diesen Bezugsrahmen benutzt. Der Bericht wirft
damit jedem Kontingent einen Mangel vor, der dort folgenlos ist. Die
gleichartige Meldung fuer das Kostenbudget macht es richtig: sie erscheint erst,
wenn tatsaechlich jemand fragt.

**5. Ein stiller Ersatzwert an einer auswertungsrelevanten Eingabe.** Die Menge
der bekannten Kataloge hat einen leeren Ersatzwert. Wird sie vergessen, gilt
jedes Kontingent als nicht aufloesbar und es hagelt Meldungen — ein Pflichtfeld
sieht dadurch optional aus. Es gibt genau einen Aufrufer in der Produktion.

**6. Die Knotenform ist uneinheitlich.** Zwei der drei Fabriken tragen das neue
Feld, die dritte nicht; und es wird erst auf leer gesetzt und danach beschrieben,
sodass "leer" drei verschiedene Dinge bedeuten kann: noch nicht gebunden, kein
Kontingent, nicht aufloesbar.

## Acceptance Criteria
- [ ] Der Faehigkeitsdatensatz unterscheidet "es gibt keine Grenze" von "die Grenze war nicht auswertbar"; im zweiten Fall wird kein unbegrenzter Spielraum ausgewiesen.
- [ ] Ein Test haelt genau den gemessenen Fall fest: Obergrenze eins auf nicht aufloesbarem Bezugsrahmen, eine Auswahl getroffen.
- [ ] Eine unbeantwortbare Abfrage erzeugt in jedem Fall eine Meldung — auch ausserhalb eines echten Kontingents. Die im Code formulierte Zusage stimmt dann.
- [ ] Es gibt keine Stelle mehr, an der eine unbeantwortbare Abfrage eine Zahl liefert.
- [ ] Die Meldung zum fehlenden Katalog eines Kontingents erscheint nur, wenn eine Regel den Bezugsrahmen tatsaechlich benutzt.
- [ ] Die Menge der bekannten Kataloge ist eine Pflichteingabe ohne stillen Ersatzwert.
- [ ] Die Knotenform ist einheitlich, und der leere Wert bedeutet genau eine Sache.
- [ ] Die Testsuite bleibt gruen; keine Erwartung unter docs/testing/ wird abgeschwaecht.

## Comments
- Punkt 1 wurde vom Pruefer nicht hergeleitet, sondern gemessen: derselbe Aufruf vor und nach Commit ff050ac liefert effectiveMax 1 -> null und headroom 1 -> null. Die Aussage im Commit-Text, die Verschiebung betreffe ausschliesslich die Sichtbarkeit, gilt fuer Verletzungen und Sichtbarkeit — der Faehigkeitsdatensatz war nicht mitgemessen.
- Heute schlaegt das ueberwiegend ueber den Bezugsrahmen "unit" durch (Issue 83), der Mechanismus ist aber allgemein und trifft jeden nicht aufloesbaren Rahmen.
- Nicht auswertbare Grenzen verschwinden nicht mehr: evaluateConstraints liefert neben den Ergebnis-Tripeln eine zweite Liste (LIMIT_WITHOUT_ANSWER), der Faehigkeitsdatensatz fuehrt sie je Slot als unevaluatedLimitKinds und weist ein nicht auswertbares Hoechstmass fail-closed aus (headroom 0, isBlocked true) statt als 'unbegrenzt' (null). Dazu: die Diagnose zum primaeren Katalog wandert vom Baumbau an die fragende Stelle in query.js (erscheint nur, wenn eine Regel fragt, dafuer in JEDEM unbeantwortbaren Fall, auch ausserhalb eines Kontingents, neuer Grund NO_ROSTER_FORCE); UNSUPPORTED_FIELD liefert den Sentinel statt 0; datasetCatalogueIds ist Pflichteingabe von buildEvalTree; jeder Knoten traegt dieselbe Bindung {id|unresolved}, gesetzt bei der Erzeugung. Messung ueber alle 112 E2E-Roster: keine Verletzung, keine Diagnose und keine Slot-Zahl aendert sich; 76 Slots (2 forceEntries, min-Grenze auf einem nicht budgetierten limit::-Feld) tragen jetzt sichtbar 'min' statt still zu verschwinden.
