Status: claimed
Type: fix
Blocked by: [04]

## Description

Letzte Nachbesserung dieses Main-Issues, aus der Nachpruefung von Scheibe 04.
Keiner der vier Punkte ist heute ein Fehlverhalten. Bei zweien behauptet der Code
aber etwas, das nicht stimmt — und eine Zusicherung, die nicht gilt, ist
gefaehrlicher als gar keine, weil sich spaetere Arbeit auf sie verlaesst.

**1. Ein Sicherheitsnetz, das nicht ausloesen kann.** Scheibe 04 laesst die
roster-weite Budget-Grenze bewusst aus der Rangfolge der Messgroessen heraus und
schreibt dazu, ein solcher Fall werde laut gemeldet. Das kann nicht eintreten:
die Rangfolge wird ueberhaupt nur befragt, wenn zwei Ergebnisse **verschiedene**
Messgroessen haben. Budget-Verletzungen tragen aber alle denselben Anker,
dieselbe Grenzenart und dieselbe Messgroesse — sie treffen also nur auf
ihresgleichen, und der Schutz wird nie erreicht. Nachgestellt: zwei
ueberschrittene Kostenarten werden still indiziert, ohne Meldung.

Heute unschaedlich, weil die Budget-Ergebnisse erst nach dem Indizieren
dazukommen. Die beiden Listen werden aber eine Zeile auseinander
zusammengefuehrt — der naheliegende kuenftige Fehler ist genau der, den der
Kommentar zu fangen verspricht.

Zu entscheiden: das Netz echt spannen oder die Behauptung streichen. Ein
Kommentar, der eine Pruefung verspricht, die es nicht gibt, darf nicht stehen
bleiben.

**2. Die Mitglieder-Menge einer Gruppe ist stillschweigend gewachsen.** Seit
Scheibe 04 die Aufloesung der Gruppen-Mitglieder auf die gemeinsame
Identitaets-Quelle umgestellt hat, traegt sie auch die **Kategorie**-Ids bei, mit
denen eine Gruppe ausgezeichnet ist — vorher waren es nur die Verweise. Damit
vermischen sich zwei Dinge: "ist Mitglied dieser Gruppe" und "ist eine Kategorie,
mit der die Gruppe ausgezeichnet ist".

Heute wirkungslos, aber nur, weil eine Abfrage in einem **anderen** Modul
synthetische Knoten ueberspringt. Die Unschaedlichkeit haengt also an einer
Stelle, die von dieser gar nichts weiss. Der Kommentar beschreibt ausserdem nur
den Verweis-Fall.

**3. Ist-Stand und Spielraum eines Slots gelten nur je Messgroesse.** Ein Slot
fuehrt eine Grenze, traegt aber moeglicherweise mehrere Messgroessen. Scheibe 04
hat die Zahlen einheiten-treu gemacht — sie sagen jetzt nichts Widerspruechliches
mehr. Sie sind damit aber noch keine Aussage ueber Verfuegbarkeit: ein Slot kann
"noch 4 frei" melden, waehrend die Punktegrenze bereits ausgereizt ist. Die
eigenen Tests der Scheibe halten genau diesen Fall fest. Das gehoert in die
Dokumentation, damit sich die kuenftige Oberflaeche nicht darauf verlaesst.

**4. Ein Kommentar mit Zahlen, die nichts absichert.** Eine Erlaeuterung nennt
gezaehlte Vorkommen aus den Katalogdaten. Die Zahlen stimmen heute, aber nichts
schlaegt an, wenn sich die Daten aendern. Entweder sie werden durch einen Test
gehalten oder sie verschwinden.

## Acceptance Criteria
- [ ] Die Zusicherung zur ausgelassenen Budget-Messgroesse gilt tatsaechlich, oder die Behauptung steht nicht mehr im Code; ein Test haelt fest, was von beidem gewaehlt wurde.
- [ ] Die Mitglieder-Menge einer Gruppe enthaelt nur, was fachlich Mitglied ist; ihre Beschreibung deckt alle Faelle ab, die sie behandelt.
- [ ] Die Dokumentation sagt ausdruecklich, dass Ist-Stand und Spielraum eines Slots je Messgroesse gelten und keine Zusage ueber Verfuegbarkeit sind.
- [ ] Kein Kommentar nennt gezaehlte Werte aus den Katalogdaten, ohne dass ein Test sie haelt.
- [ ] Die Testsuite bleibt gruen; keine Erwartung unter docs/testing/ wird abgeschwaecht.

## Comments
- Alle vier Punkte stammen aus der Nachpruefung von Scheibe 04 und betreffen ausschliesslich Code, der in diesem Main-Issue entstanden ist. Punkt 1 wurde vom Pruefer nicht hergeleitet, sondern ausgefuehrt: buildReport mit zwei ueberschrittenen Kostenarten wirft nicht.
