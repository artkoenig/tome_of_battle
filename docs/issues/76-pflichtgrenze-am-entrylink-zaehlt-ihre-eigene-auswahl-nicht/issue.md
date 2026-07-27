Status: superseded
Type: fix
Blocked by: None

## Description

Eine Grenze, die **nicht an der Auswahl-Definition, sondern an dem `entryLink`
deklariert ist, der sie hereinzieht**, zaehlt die eigene Auswahl nicht mit. Sie
meldet eine Pflicht als unerfuellt, obwohl die Auswahl im Roster gesetzt ist.

Ursache an den Daten: ein Roster benennt eine so bezogene Auswahl mit **zwei**
Ids — `entryId` (das Ziel) und `entryLinkId` (der Verweis). Der Zaehlindex
registriert die Instanz unter der Ziel-Id, die Grenze fragt aber nach der
Link-Id. Ergebnis: Ist 0 gegen `min 1`.

Zwei belegte Faelle, beide aus `Mercenaries (…).cat`, beide `min`/`scope="parent"`:

| Grenze | Deklariert an | Beobachtet |
|---|---|---|
| `dfd9-3e46-eda5-be8b` (min 1 *Hand Weapon*) | `entryLink b581-8a9e-9d0c-b7c8`, Z. 7462–7464 | Ist 0 / Grenze 1 |
| `feb1-c10d-9318-dbda` (min 1 *Light Armour*) | `entryLink d3dc-56c1-9565-889a`, Z. 4352–4354 | Ist 0 / Grenze 1 |

Gefunden als Nebenbefund beim E2E-Szenario `modifier-characteristic-value`
(Issue 75/04); dort ausfuehrlich dokumentiert. Die beiden Ids sind in jenem
Szenario aus der `absent`-Liste **entfernt** und bewusst **nicht** nach `firing`
verschoben — das wuerde das falsche Verhalten als gewollt festschreiben. Das
Manifest macht ueber sie derzeit also schlicht keine Aussage; diese Luecke
schliesst erst dieser Fix.

Die Behebung aendert die Verletzungsliste an mehreren Stellen der Suite und
gehoert deshalb nicht in einen laufenden Slice von Issue 75.

## Acceptance Criteria
- [ ] Eine am `entryLink` deklarierte Grenze zaehlt die ueber diesen Verweis gesetzte Auswahl mit.
- [ ] Die beiden belegten Faelle (*Hand Weapon*, *Light Armour*) melden keine Pflichtverletzung mehr.
- [ ] Das Szenario `modifier-characteristic-value` nimmt beide Ids wieder in seine Erwartung auf.
- [ ] Die uebrige E2E-Suite bleibt gruen; jede geaenderte Erwartung ist einzeln begruendet.

## Comments
- Dieselbe Wurzel auf der Fixture-Seite, gefunden in Slice 75/07: Der .ros-Leser der Testumgebung (src/evaluator/__fixtures__/rosParser.js) bindet eine Auswahl allein ueber entryId und ignoriert entryLinkId. Alles, was am <entryLink> selbst deklariert ist, gilt damit im Test nie — im Widerspruch zu report.js, das den Verweis-Slot ausdruecklich den Verweis tragen laesst. Belegt an Ogre Kingdoms (6th definitive edition).cat:3165: dort gewaehrt Verweis d82e 'Bully Bully' bedingungslos. Betrifft 13 von 102 vorhandenen Rostern in 4 Szenarien. Wer 76 behebt, sollte beide Stellen zusammen anfassen: Engine-Zaehlung und Roster-Adapter benennen eine Auswahl nur dann gleich, wenn beide Ids tragen.
- superseded: Aufgegangen in Main-Issue 81 (Verweis-Identitaet in der Zaehlung), das Symptom 1 unveraendert samt beiden Belegfaellen und der Fixture-Seite uebernimmt und mit Issue 78 dieselbe Wurzel gemeinsam behebt.
