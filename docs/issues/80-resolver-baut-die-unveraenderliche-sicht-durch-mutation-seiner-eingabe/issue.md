Status: needs-triage
Type: refactor
Blocked by: None

## Description

`resolveCatalogue` (`src/evaluator/resolver.js`) verspricht eine unveraenderliche
Sicht, erreicht sie aber, indem es auf die gelesenen Objekte schreibt:
`modifier.target`, `condition.witnessDefinition`, `info.resolved`,
`link.resolved`. `effectiveState.js` formuliert die entgegengesetzte Zusicherung
(„Basisdefinitionen werden nie mutiert", Leitprinzip 5).

Die Auswertung selbst haelt die Zusicherung — mutiert wird einmalig **waehrend
der Aufbereitung**, nicht danach. Neu ist aber die Tragweite: seit Main-Issue 75
die Fassade zweistufig geschnitten hat (`prepareDataset` → `evaluate`), reicht
derselbe aufbereitete Graph in **beliebig viele** Auswertungen hinein. Das
Aliasing ist damit erstmals tragend statt beilaeufig.

Heute ist das nachweislich unschaedlich (`evaluate` schreibt nur in den
effektiven Zustand, nie in die Definitionen — die E2E-Suite belegt es ueber
wiederholte Auswertungen desselben aufbereiteten Datensatzes). Es ist aber eine
Zusicherung, die allein durch Disziplin gilt und die ein spaeterer Schreibzugriff
still bricht.

Zu entscheiden ist, ob die Aufloesung ohne Mutation gebaut wird (Seitentabellen
statt Feldern am Objekt) oder ob die Mutation bleibt und dafuer maschinell
abgesichert wird (Einfrieren nach der Aufbereitung).

## Acceptance Criteria
- [ ] Es ist entschieden und begruendet, ob die Aufloesung mutationsfrei wird oder die Unveraenderlichkeit nach der Aufbereitung erzwungen wird.
- [ ] Die gewaehlte Zusicherung gilt nicht nur per Dokumentation, sondern faellt bei Verletzung auf.
- [ ] `resolver.js` und `effectiveState.js` sagen dasselbe ueber Unveraenderlichkeit.
- [ ] Ein Test haelt fest, dass mehrere Auswertungen desselben aufbereiteten Datensatzes einander nicht beeinflussen.

## Decisions
- `[po]` Unabhaengige Bestaetigung fuer die Einfrier-Option aus einem Reinraum-Gegenentwurf, der fuer Main-Issue 81 eingeholt wurde. Der Gutachter sah weder unseren Code noch diese Frage; sein Brief nannte als harte Randbedingung nur 'die Auswertung ist zustandsfrei und wiederholbar: derselbe aufbereitete Datenbestand wird mehrfach ausgewertet und darf sich dabei nicht selbst veraendern'. Er kam von dort aus unaufgefordert auf genau die hier offene Entscheidung und beantwortete sie mit der Ueberschrift 'Zustandsfreiheit durch Ort, nicht durch Disziplin': der aufgeloeste Baum wird nach der Aufbereitung eingefroren (deep freeze mindestens im Dev-Build), und alles was pro Auswertung entsteht, lebt in einem Kontextobjekt, das am Ende verworfen wird. Ausdruecklich ergaenzt: 'Memoisierung im eingefrorenen Teil ist verboten, gerade weil sie harmlos aussieht.' Das deckt sich mit dem zweiten Akzeptanzkriterium dieses Issues ('faellt bei Verletzung auf') und spricht gegen die Seitentabellen-Variante als Selbstzweck. Die Entscheidung selbst bleibt diesem Issue vorbehalten; hier ist nur die Quelle gesichert.

## Comments
