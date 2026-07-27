Status: claimed
Type: refactor
Blocked by: [05, 07]

## Description

Wiederholt die Messung aus Slice 02 am gewachsenen Auswertungsbaum und
entscheidet damit, was die PRD offen gelassen hat: ob der aufbereitete Datensatz
wiederverwendet wird und die Fassade deshalb zweistufig ausfaellt, oder ob eine
einstufige genuegt.

Die Entscheidung faellt an Zahlen, nicht an einer Vermutung.

## Acceptance Criteria
- [ ] Die Messung aus Slice 02 ist am gewachsenen Baum wiederholt und den Grundlinienwerten gegenuebergestellt.
- [ ] Der Anteil der Datensatz-Vorbereitung an einer Auswertung ist getrennt ausgewiesen.
- [ ] Der Entscheid ein- gegen zweistufige Fassade ist getroffen, an den vorab festgelegten Schwellen begruendet und im Issue festgehalten.
- [ ] Faellt der Entscheid zweistufig aus, ist die Fassade entsprechend geschnitten und die Behauptung aus docs/evaluator-architecture.md ueber das gecachte Aufloesungs-Ergebnis erstmals wahr.
- [ ] Faellt er einstufig aus, ist die anderslautende Aussage in docs/evaluator-architecture.md korrigiert statt stehen gelassen.

## Comments
- Belegter Bedarfsnachweis fuer die zweistufige Fassade aus dem echten Verbraucher: Der E2E-Manifest-Runner (src/evaluator/e2e.testcatalog.test.js) memoisiert nur die rohen XML-Strings, nicht die Aufbereitung — jeder der 94 Faelle parst denselben Datensatz erneut. Seit Slice 06 blockiert das den Vitest-Worker so lange synchron, dass dessen Reporter-Kanal einen unhandled error 'Timeout calling onTaskUpdate' wirft (vitest/dist/chunks/rpc, nicht Produktivcode). Nachgewiesen: bei Commit 16a39c4 (vor Slice 06) 635 Tests ohne Fehler, mit Slice 06 658 Tests mit dem Fehler; isoliert reproduziert er in e2e.testcatalog.test.js allein (94 Tests, 62 s). Alle Tests bestehen, aber Vitest warnt ausdruecklich vor falsch-positiven Ergebnissen. Der Fehler ist damit kein Zufallsbefund, sondern die Kostenmessung in Testform: 99 % der Laufzeit ist Aufbereitung. Slice 08 soll ihn nicht separat wegkonfigurieren, sondern durch die zweistufige Fassade beheben — der Runner bereitet den Datensatz je Szenario einmal auf und wertet die Roster dagegen aus.
- Offene Frage aus Slice 06, die in die Entscheidung ueber die Berichtsform gehoert: Das Spielsystem deklariert formatRules an den Charakteristik-Typen (Beispiel Sv: '^7+$' → '-'). Die Engine liefert derzeit die Rohwerte. Zu entscheiden ist, ob der Bericht die Formatierung anwendet oder die Oberflaeche — ADR-0034 stellt den Bericht als alleinige Quelle, Formatierung ist aber eine Darstellungsfrage.
