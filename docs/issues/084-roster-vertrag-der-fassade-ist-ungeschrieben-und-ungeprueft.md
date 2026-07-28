---
status: backlog
branch:
pr:
---

# Der Roster-Vertrag der Fassade ist ungeschrieben und ungeprüft

## Intent

Seit Issue 076 stellt der Evaluator eine Anforderung an jeden Aufrufer von
`evaluate`, die nirgends steht: Eine Auswahl, die über einen `<entryLink>`
gesetzt wurde, muss unter der **Link**-Id übergeben werden, nicht unter der Id
ihres Ziels. Nur dann gelten die am Verweis deklarierten Grenzen, und nur dann
fällt der Slot des Verweises mit dem belegten Slot zusammen, statt daneben als
Phantom stehenzubleiben.

Geschrieben steht diese Regel bisher **nur im Test-Adapter**
(`src/evaluator/__fixtures__/rosParser.js`, JSDoc zu `defIdOf`). Der öffentliche
Rand — `src/evaluator/evaluator.js`, `@param roster` — beschreibt die Eingabe
weiter als `Array<{ defId: string, count: number, children?: object[] }>` und
sagt zu Verweis oder Ziel nichts.

Zwei Befunde aus den Review-Runden von 076, beide reproduziert, beide ohne
Testabdeckung:

**F2 — die Wirkung des Adapters ist von keiner Erwartung gedeckt.** Nimmt man
nur die Constraint-Änderung und lässt den Adapter auf dem alten Stand, sind
alle Suiten grün und die Fassaden-Ausgabe über alle 108 Manifest-Läufe
byte-identisch. Was der Adapter zusätzlich bewirkt, ist die Slot-Zuordnung: In
12 von 108 Rostern fällt ein doppelter Slot zu einem zusammen, z. B.

```
ohne Adapter-Fix:  0/0/1  abdb-bbd0-41b2-5dff  occupied          "Hand Weapon"
                   0/0/3  b581-8a9e-9d0c-b7c8  mandatoryPhantom  "Hand Weapon"
mit  Adapter-Fix:  0/0/1  b581-8a9e-9d0c-b7c8  occupied  target=abdb-bbd0-41b2-5dff
```

Kein Manifest prüft das. Fiele der Adapter zurück, bliebe die Suite grün.

**F3 — kein Rückfall auf `entryId`.** `defIdOf` bindet an `entryLinkId` ohne
Ausweichpfad. Wertet man
`docs/testing/modifier-characteristic-value/rosters/01-ogre-no-light-armour.ros`
gegen einen Datensatz *ohne* den Mercenaries-Katalog aus, entsteht neu
`{"kind":"unresolvedDefinition","defId":"b581-8a9e-9d0c-b7c8"}` (37 → 38
Diagnosen); vorher band die Auswahl an die Ziel-Id in der `.gst` und wertete
durch.

Gewünschtes Ergebnis: Die Regel steht am öffentlichen Rand, und beide Befunde
sind durch je eine Erwartung gedeckt, die rot wird, wenn das Verhalten
zurückfällt.

Acceptance criteria:

1. Der `@param roster` der Fassade (`src/evaluator/evaluator.js`) sagt, unter
   welcher Id eine über einen `entryLink` gesetzte Auswahl zu übergeben ist,
   und was gilt, wenn kein Verweis im Spiel ist.
2. Eine Erwartung deckt die Slot-Zusammenlegung ab: für eine über einen
   Verweis gesetzte Auswahl entsteht **ein** belegter Slot unter der Link-Id
   mit dem Ziel unter `targetDefId` — kein zweiter Pflicht-Phantomslot
   daneben. Sie wird rot, wenn der Adapter auf `entryId` zurückfällt.
3. Das Verhalten bei nicht auflösbarer Link-Id ist entschieden und
   dokumentiert: entweder `unresolvedDefinition` als gewollte, ehrliche
   Antwort, oder ein Rückfall auf `entryId` in der Engine (nur dort — der
   Adapter kennt den Datensatz nicht). Die Entscheidung ist durch eine
   Erwartung gedeckt.
4. Die übrige Suite bleibt grün — mit Kommando, Umfang und Exit-Code belegt.

## Plan

## Tasks

## Decisions

- **Herkunft:** Review-Runden 1–3 von Issue 076. Dort bewusst nicht behoben:
  beide Befunde verletzen kein Kriterium jenes Issues, und der Mensch hat
  entschieden, den Schnitt so zu lassen und diesen Teil eigenständig zu führen.
- **F3 ist entschärft, aber nicht erledigt.** Das BSData-Wiki sagt zum
  `entryLink`, sein Ziel müsse aus den *shared*-Listen desselben Katalogs
  stammen (oder per Grundregelwerk-Import aus der `.gst`); für ein Kontingent
  gilt *„All selections within must originate from a single catalogue."* Ein
  Roster, das einen Verweis aus einem nicht geladenen Katalog benennt, war
  also nie gültig — der scheinbar verlorene Fall war keiner. Damit ist
  `unresolvedDefinition` wahrscheinlich die *richtige* Antwort und Kriterium 3
  eher eine Dokumentations- als eine Verhaltensfrage. Belegstellen:
  `docs/battlescribe-data-format.md` §7.2 und §15.
- **Die Quelle hilft bei Kriterium 1 nicht.** Die Abschnitte *Roster*, *Force*
  und *Selection* des Wikis stehen als `TODO`; welche Id eine Auswahl
  identifiziert, ist nirgends dokumentiert (`docs/battlescribe-data-format.md`
  §15). Die Festlegung ist eine Entscheidung dieses Projekts und gehört als
  solche benannt.
- **Der `report.js`-Ankervertrag ist die Begründung der heutigen Wahl:** „ein
  Angebots-Anker den `entryLink`, nicht den Eintrag (nur so gelten die am
  Verweis deklarierten Grenzen)". Kriterium 2 hält genau das fest.

## Log

## Checkpoints

### Before implementation

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
