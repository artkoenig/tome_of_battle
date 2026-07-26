Status: needs-triage
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
