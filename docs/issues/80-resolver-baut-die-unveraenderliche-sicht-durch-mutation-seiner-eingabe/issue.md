Status: ready-for-agent
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

## Comments
- PO-Entscheid zur offenen Frage: Option B — die Mutation bleibt, die Unveraenderlichkeit wird nach der Aufbereitung maschinell erzwungen (tiefes Einfrieren des aufgeloesten Graphen). Begruendung aus den Messungen des Architekten an echten Definitive-Edition-Katalogen: (1) Ein vollstaendig eingefrorener Graph traegt alle drei Messfaelle ohne TypeError durch die Auswertung — die Zusicherung stimmt bereits, sie ist nur nicht erzwungen. (2) Einfrieren kostet einmalig 23-49 ms in einer Aufbereitung, die ohnehin 126-327 ms braucht, und der Auswertung nichts (3,09 vs 3,20 ms eingefroren/offen). (3) Der mutationsfreie Weg waere zwar nicht langsamer (+0,15-0,46 ms je Auswertung), erforderte aber, die aufgeloeste Sicht durch rund 15 Signaturen und durch EffectiveState zu faedeln, weil .resolved in sechs Modulen aus reinen Hilfsfunktionen gelesen wird — Parameter-Durchreichen, das wir an anderer Stelle gerade abbauen. (4) Einfrieren deckt den ganzen Graphen ab, nicht nur die vier bekannten Felder. Bewusst gekaufte Einschraenkung: ein spaeterer Zwischenspeicher am Definitionsknoten ist damit ausgeschlossen und muesste eine Seitentabelle werden. Die Entscheidung ist als ADR festzuhalten.
