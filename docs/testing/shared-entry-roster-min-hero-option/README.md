# E2E-Regeln & Testkatalog: Geteilter Eintrag mit `min scope="roster"` — „Pure of Heart" (Hoch-Elfen)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Regeln aus den
Katalogdaten der *6th Definitive Edition* abgeleitet; das Eingabeformat der
Roster folgt den bereits verifizierten Szenario-Fixtures (direktes `entryId`,
`entryLinkId=""` bzw. `entryLinkId` des Verweises, geschachtelte `selections`
mit `number`, `entryGroupId` am Gruppen-Mitglied — vgl.
[`decrement-group-max-battle-standard`](../decrement-group-max-battle-standard/README.md)).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee: `High Elves (6th definitive edition).cat` (`b59c-7ff5-fb34-405e`,
  rev 1) — Force **„Standard (HE-AB)"** `c236-0d80-eff8-3cf9` (Z. 7531)
- Dazu `Mercenaries (6th definitive edition).cat` (per `catalogueLink` aus der
  HE-`.cat` eingebunden)

## Der gepinnte Mechanismus

Ein Eintrag in `<sharedSelectionEntries>` ist **keine Wurzel-Auswahl**: er ist
ausschließlich über einen Verweis erreichbar und erscheint allein an dessen
Stelle ([Formatdoku §7.2](../../battlescribe-data-format.md)). Das gilt auch
dann, wenn er eine armeeweite Grenze an sich selbst trägt — die Grenze sagt,
*wie oft* er im Roster stehen darf bzw. muss, nicht *wo* er wählbar ist.

„Pure of Heart" ist im Korpus der einzige geteilte Eintrag mit einem eigenen
`min`-Constraint `scope="roster"` ≥ 1 und ohne eigene Unterauswahlen — der Fall,
in dem die beiden Aussagen am weitesten auseinanderliegen:

```
selectionEntry "Prince" (f42c-be6f-8a5d-7199, type=unit)                     Z. 14
  └ selectionEntryGroup "Magic and Honors" (a686-83d6-bfa2-3535)             Z. 82
       └ entryLink "Honours" (c7fa-d10c-2cea-bfa2 → 45a3-3e65-6c49-5cc0)     Z. 87

sharedSelectionEntryGroups
  selectionEntryGroup "Honours" (45a3-3e65-6c49-5cc0)                        Z. 5915
    └ entryLink "Pure of Heart" (30b5-bd1a-60e2-2354 → d0ce-b0c4-fcc1-6cac)  Z. 5918

sharedSelectionEntries
  selectionEntry "Pure of Heart" (d0ce-b0c4-fcc1-6cac, type=upgrade, 0 pts)  Z. 5178
      constraint max 1 selections scope=roster   4720-59d3-07c4-68b3
      constraint max 1 selections scope=parent   69ac-892d-a730-545d
      constraint min 1 selections scope=roster   82ef-69c7-f459-5e20
        (includeChildSelections=true, includeChildForces=true)
      infoLink "Pure of Heart" (dc8f-265a-b611-d092 → rule aef2-97fe-962d-9f7a)
```

Dieselbe geteilte Gruppe „Honours" binden auch Archmage
(`283e-ea90-f0fd-1bde`, Z. 358), Commander (`6892-0e07-bfa5-348d`, Z. 476) und
Mage (`a350-de30-b2ff-e27e`, Z. 780) ein. Der Regeltext des verlinkten `rule`
sagt es selbst: *„This Honour MUST be given to exactly one high Elf
character."* — einem **Charakter**, nicht der Armee.

Erwartet wird deshalb: der Platz der Ehrung liegt **unter dem Helden** und
sonst nirgends. Da beide Roster genau einen Helden führen, trifft die
Slot-Auswahl über `defId` des Verweises je Roster genau einen Platz; sein
`frameDefId` ist der Prince — ein Platz auf Kontingent- oder Armee-Ebene
existierte sonst zusätzlich und die Auswahl bliebe mehrdeutig.

## Die Roster

| Roster | Aufbau | Erwartung |
| --- | --- | --- |
| `01-prince-ohne-pure-of-heart.ros` | Force „Standard (HE-AB)", darin ein Prince | Genau ein Platz für `30b5-bd1a-60e2-2354`: **Angebot** (`offerAnchor`) im Rahmen des Prince, Ist 0, effektives Mindest-/Höchstmaß 1, Spielraum 1, Pflicht unerfüllt. Der Platz trägt die Regel `dc8f-265a-b611-d092`. Dazu **genau eine** Meldung der armeeweiten Pflicht `82ef-69c7-f459-5e20` (Ist 0, Grenze 1). Die beiden `max`-Grenzen `4720-59d3-07c4-68b3` und `69ac-892d-a730-545d` schweigen: nichts steht in der Liste, was ein Höchstmaß reißen könnte. |
| `02-prince-mit-pure-of-heart.ros` | derselbe Aufbau, der Prince hat die Ehrung genommen (`entryLinkId="30b5-bd1a-60e2-2354"`, `entryGroupId="45a3-3e65-6c49-5cc0"`) | Derselbe Platz ist **belegt** (`occupied`), weiterhin im Rahmen des Prince, Ist 1, Spielraum 0, Höchstmaß ausgeschöpft. Keine der drei Grenzen `4720-59d3-07c4-68b3`, `69ac-892d-a730-545d`, `82ef-69c7-f459-5e20` feuert: eine Ehrung im Roster, eine unter diesem Elternteil, das Mindestmaß erfüllt. |

## Die Pflicht (Nachtrag, Issue 0154)

Ursprünglich machte Roster 01 bewusst **keine** Aussage über die `min`-Grenze
`82ef-69c7-f459-5e20` — gepinnt war allein, *wo* der Platz liegt. Die
Katalogdaten beantworten die zweite Frage aber ebenso eindeutig, und zwar in
derselben Zeile 5180 ff.: der geteilte Eintrag trägt

```
constraint id="82ef-69c7-f459-5e20" type="min" field="selections" value="1"
           scope="roster" includeChildSelections="true" includeChildForces="true"
```

Das ist keine Aussage über den Platz, sondern über die **Liste**: „mindestens
eine davon im ganzen Roster, geschachtelte Vorkommen und Unter-Kontingente
eingeschlossen." Der verlinkte Regeltext (`aef2-97fe-962d-9f7a`) sagt dasselbe
in Prosa: *„This Honour MUST be given to exactly one high Elf character."*
Beide Roster pinnen die Pflicht deshalb jetzt von beiden Seiten — Roster 01,
dass sie **feuert**, solange kein Held die Ehrung genommen hat, Roster 02, dass
sie **schweigt**, sobald einer sie hat. Wo der Platz liegt, ändert das nicht:
er bleibt in beiden Rostern der `entryLink` unter dem Prince.
