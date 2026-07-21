Status: resolved
Type: fix
Blocked by: [01]

## Description

Befund W6. Hat eine Auswahlgruppe eine Mindestanzahl, muss beim Ausheben der
übergeordneten Einheit automatisch etwas aus dieser Gruppe mitkommen. Welche
Option das ist, legt der Katalog über eine Vorgabe fest.

Zwei Stellen beantworten diese Frage heute unterschiedlich:

- die Fabrik, die die Auswahl tatsächlich anlegt, respektiert die im Katalog
  hinterlegte Vorgabe — korrekt
- die Kostenschätzung, die den Preis im Aushebe-Dialog anzeigt, nimmt stumpf
  die erste Option der Gruppe

Ist die Vorgabe nicht zufällig die erste Option, weicht der angezeigte Preis
vom tatsächlich anfallenden ab: der Nutzer sieht vor dem Ausheben eine andere
Zahl als danach.

Beide Stellen müssen dieselbe Vorgabe-Ermittlung verwenden.

## Acceptance Criteria
- [ ] Die Kostenschätzung ermittelt die vorgegebene Option auf demselben Weg wie die Fabrik, die die Auswahl anlegt
- [ ] Ist die Vorgabe nicht die erste Option der Gruppe, stimmen angezeigter und nach dem Ausheben tatsächlich anfallender Preis überein
- [ ] Gruppen ohne hinterlegte Vorgabe verhalten sich wie bisher
- [ ] Die Ermittlung existiert nur noch an einer Stelle im Code, nicht zweimal
- [ ] Ein Test deckt eine Gruppe ab, deren Vorgabe nicht die erste Option ist, und schlägt gegen den alten Stand fehl

## Comments
- Die Ermittlung der Pflichtgruppen-Option liegt jetzt einmalig in src/solver/selectionMembers.js (resolveGroupDefaultMember: Katalog-Vorgabe, sonst erstes Mitglied). Fabrik und Kostenschaetzung nutzen sie beide; Tests decken eine Gruppe ab, deren Vorgabe nicht die erste Option ist.
