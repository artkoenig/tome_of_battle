Status: needs-triage
Type: refactor
Blocked by: [04, 06]

## Description

Eine Verletzung nennt heute Grenzwert, Ist-Wert und Differenz — aber nicht,
welche Art Grenze an welcher Art Anker in welchem Bezugsrahmen gerissen ist,
welcher Schweregrad gilt und welche Auswahl sie ausgeloest hat. Ohne diese
Einordnung kann die Oberflaeche keinen uebersetzten Satz waehlen.

Nach ADR-0034 bleibt die Engine sprachfrei und kennt **keine**
Meldungsschluessel: sie ordnet fachlich ein, die Oberflaeche formuliert. Die
Ursachen werden hier **gelesen**, nicht rekonstruiert — die Herleitungskette aus
Slice 04 traegt sie bereits.

Zuletzt, weil dieser Slice auf allen vorherigen aufsetzt und selbst nichts
traegt.

## Acceptance Criteria
- [ ] Jede Verletzung nennt die Art der Grenze, ihren Bezugsrahmen, die Art ihres Ankers, Ist-Wert, Grenzwert und Differenz.
- [ ] Jede Verletzung traegt ihren Schweregrad.
- [ ] Eine abgeleitete Meldung der Engine und eine Meldung des Katalog-Autors sind im Bericht voneinander unterscheidbar.
- [ ] Eine Autor-Meldung erscheint im Wortlaut des Katalogs, mit aufgeloesten Text-Tokens (ADR-0028).
- [ ] Wurde ein Grenzwert erst durch einen bedingten Modifikator zum verletzten Wert, nennt die Verletzung die ausloesende Auswahl (ADR-0027) — gelesen aus der Herleitungskette.
- [ ] Der Bericht enthaelt keinen i18n-Schluessel und keinen uebersetzten Satz.
- [ ] Aus der Einordnung laesst sich eindeutig und ohne Rateschritt ein Anzeigetext bestimmen; das ist an den heute vorhandenen Meldungsarten durchgespielt.

## Comments
