Status: ready-for-agent
Type: fix
Blocked by: [02]

## Description

Die Engine kann den Bezugsrahmen "primaerer Katalog" nicht aufloesen. Sie meldet
das zwar als Diagnose, wertet die betroffene Regel aber **fail-open**: ein nicht
aufloesbarer Rahmen liefert die Zahl null, und eine Bedingung der Art "ist keine
Instanz von" liest null als "trifft zu". Jede solche Regel feuert also heute —
auch in genau der Armee, die sie ausschliessen soll.

Das ist die eigentliche Schwere dieses Issues, und der Beschreibungstext des
Eltern-Issues sagt bis zu seiner Korrektur das Gegenteil.

Zwei Dinge sind zu tun, und sie gehoeren zusammen:

**Den Rahmen aufloesen.** Er bezeichnet den Armeekatalog des Kontingents, in dem
der Knoten sitzt (festgeschrieben in Scheibe 01). Dafuer muss die Auswertung
wissen, welchen Katalog ein Kontingent des Rosters angibt, und welche Kataloge
der aufbereitete Datensatz ueberhaupt enthaelt. Die Antwort ist "ja", "nein" oder
"nicht entscheidbar" — Letzteres nur, wenn das Kontingent keine Angabe traegt.

**Ungeloeste Rahmen fail-closed werten.** Ein Rahmen, den die Engine nicht
aufloesen kann, darf nicht als erfuellte Bedingung durchgehen. Das betrifft
ausdruecklich nicht nur diesen einen Rahmen, sondern die Behandlung ungeloester
Rahmen ueberhaupt — dieselbe Schwaeche trifft auch andere (siehe Issue 83).

**Die vorhandenen Test-Roster sind mitzuziehen.** Ein Teil von ihnen traegt heute
keine oder falsche Katalog-Angaben je Kontingent: teils einen Platzhalter, teils
die Id einer Veroeffentlichung statt der eines Katalogs. Ohne Korrektur wird die
Aenderung zwar gebaut, aber nie wirksam geprueft.

Die Aenderung dreht das Verhalten in **beide** Richtungen: Regeln, die heute
faelschlich feuern, hoeren damit auf — und Regeln, die heute faelschlich nicht
greifen, greifen. Erwartungen der vorhandenen Szenarien werden sich daher
verschieben.

## Acceptance Criteria
- [ ] Eine Regel mit diesem Bezugsrahmen wird ausgewertet; die Diagnose "nicht aufloesbar" entfaellt fuer sie.
- [ ] Der Rahmen wird gegen den Armeekatalog des Kontingents entschieden, in dem der Knoten sitzt.
- [ ] Traegt ein Kontingent keine Katalog-Angabe, ist der Fall als nicht entscheidbar behandelt und gemeldet — nicht stillschweigend als erfuellt.
- [ ] Ein nicht aufloesbarer Bezugsrahmen wird generell nicht mehr als erfuellte Bedingung gelesen.
- [ ] Die Test-Roster tragen je Kontingent die echte Katalog-Angabe.
- [ ] Das Szenario aus Scheibe 02 ist gruen.
- [ ] Die uebrige Testsuite bleibt gruen; jede geaenderte Erwartung ist einzeln aus den Katalogdaten begruendet und im README des jeweiligen Szenarios belegt.
- [ ] Das Architektur-Dokument beschreibt, woher der primaere Katalog einer Auswertung kommt.

## Comments
- Am laufenden System nachgestellt: gegen ogre-kingdoms/02-general-and-two-core.ros meldet die Fassade 9 Diagnosen mit diesem Bezugsrahmen, und die zugehoerigen Bedingungen feuern trotzdem.
- Beruehrt Issue 83 (Bezugsrahmen "unit" wird als Id gelesen): dieselbe fail-open-Schwaeche, anderer Rahmen. Nach dieser Scheibe faellt 83 sichtbar aus, statt still falsch zu wirken — behoben ist es damit nicht.
