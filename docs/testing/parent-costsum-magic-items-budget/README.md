# E2E-Regeln & Testkatalog: `field=<costTypeId>` + `scope="parent"` — das Magiegegenstands-Budget des Hunters

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln, Constraint-IDs
und Erwartungswerte sind **ausschliesslich aus den Katalogdaten** der *6th Definitive
Edition* **abgeleitet** — aus den `.gst`/`.cat`-XML, die auch die Reinraum-Engine
(`src/contexts/ruleengine/engine/`) als E2E-Fixtures nutzt. Sie stammen **nicht** aus einem Engine-Lauf.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee: `Ogre Kingdoms (6th definitive edition).cat` (`731d-5b13-2a92-5427`, rev 2) —
  Kontingent **„Standard (OK-AB)"** `729f-9246-5cd3-5044`
- Abhängigkeit: `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`,
  `library="true"`, per `catalogueLink` `a067-78d5-50a2-affe` gefordert; liefert u. a.
  die Pflichtwaffe **Ogre Club** `8768-377c-88da-c3e8`)

## Regel (In-World)

Der **Hunter** (Held der Ogre Kingdoms) darf magische Gegenstände und „Big Names"
wählen — aber **zusammen für höchstens 50 Punkte**. Anders als die üblichen
`max 1`-Grenzen zählt diese Schranke keine *Auswahlen*, sondern **summiert Punkte**.

## Beleg (Katalog-Daten)

Aus `Ogre Kingdoms (6th definitive edition).cat`, `selectionEntry` **„Hunter"**
`478d-eeb4-9e02-c6b2` (`type="unit"`, Zeile 755) → `selectionEntryGroup`
**„Magic Items and Big Names"** `9326-f5c9-9e82-f4bf` (Zeile 772):

```xml
<selectionEntryGroup id="9326-f5c9-9e82-f4bf" name="Magic Items and Big Names" ...>
  <constraints>
    <constraint field="ecfa-8486-4f6c-c249" scope="parent" value="50" percentValue="false"
                shared="true" includeChildSelections="true" includeChildForces="false"
                id="2dd3-546b-146e-ce63" type="max"/>
  </constraints>
  <entryLinks>
    <entryLink id="d552-c643-ca48-43f5" name="Big Names"        targetId="be5e-0c92-4eec-1335" type="selectionEntryGroup"/>
    <entryLink id="f552-7435-2f84-b59e" name="Magic Weapons"    targetId="e826-8d77-2f41-9ee4" type="selectionEntryGroup"/>
    <entryLink id="555a-8821-ed80-af72" name="Magic Armour"     targetId="d4da-5457-3aef-10e1" type="selectionEntryGroup"/>
    <entryLink id="2c13-f630-0a75-75e5" name="Talismans"        targetId="66af-5014-80e6-063d" type="selectionEntryGroup"/>
    <entryLink id="ef84-f736-9694-8685" name="Hunter Enchanted Items" targetId="2b20-aee9-60cc-70c8" type="selectionEntryGroup"/>
    <entryLink id="2566-8d83-c38d-baf6" name="Magic Weapons (Relics of Lustria)" targetId="11e7-7d5d-b0fa-1f34" type="selectionEntryGroup"/>
  </entryLinks>
</selectionEntryGroup>
```

Lesart der Attribute (Format-Doku [§7.6](../../battlescribe-data-format.md#76-constraint)):

- **`field="ecfa-8486-4f6c-c249"`** ist **keine** der Zähl-Felder `selections`/`forces`,
  sondern die **pts-Kostenart** der `.gst` (`<costType id="ecfa-8486-4f6c-c249" name="pts"/>`).
  Gemessen wird also die **Punktesumme**, nicht eine Anzahl. Der `actual`-Wert einer
  Verletzung ist damit die summierte Punktzahl (hier z. B. `55`), nicht die Zahl der
  Gegenstände (`2`).
- **`scope="parent"`** ist der Bezugsrahmen der Summe: die umschliessende Auswahl —
  die **Hunter-Instanz**. Gezählt/summiert werden dabei laut Format-Doku §7.6 „die
  Auswahlen **unterhalb des Trägers** der Grenze", also die Nachfahren der Gruppe
  `9326…` — **nicht** der Träger selbst und **nicht** die Geschwister der Gruppe.
- **`includeChildSelections="true"`** erweitert die Summe von den direkten
  Gruppenmitgliedern auf **alles, was darunter hängt** — insbesondere auf einen
  bepreisten Kindeintrag *unter* einem Gegenstand. (Der XSD-Vorgabewert wäre `false`,
  `src/platform/battlescribe/schema/Catalogue.xsd` Zeile 430; hier steht `true` ausdrücklich da.)
- **`value="50"` / `type="max"`** ist die Grenze. Kein `modifier` im gesamten
  Fixture-Korpus adressiert `field="2dd3-546b-146e-ce63"` — die Grenze bleibt in jedem
  Roster dieses Szenarios **50**.
- **`percentValue="false"`**: 50 sind 50 Punkte, kein Prozentsatz.

### Wo die Preise stehen

Die sechs `entryLink`s der Gruppe und die `entryLink`s **innerhalb** der geteilten
Gegenstandsgruppen tragen **keine** `<costs>`. Die Punkte liegen daher durchgängig
**an der Definition**, nicht am Verweis (Gegenbeispiel wäre das Barding im Szenario
[`unit-scope-per-model-cost`](../unit-scope-per-model-cost/README.md), wo die
Link-Kosten die Definitionskosten überschreiben). Deshalb dürfen die Roster die
Gegenstände mit **direktem `entryId` und `entryLinkId=""`** setzen, ohne den Preis
zu verfälschen.

Preise der in diesem Szenario verwendeten Gegenstände (alle aus
`Ogre Kingdoms (6th definitive edition).cat`, `sharedSelectionEntries`):

| Gegenstand | ID | Gruppe (geteilt) | pts | Quelle der Kosten |
|------------|-----|------------------|-----|-------------------|
| Mawseeker | `1697-55ab-4cf3-062e` | Big Names `be5e-0c92-4eec-1335` | **10** | Definition (Zeile 1786) |
| Wardstone necklace | `bba5-e0b2-3f93-24ff` | Talismans `66af-5014-80e6-063d` | **20** | Definition (Zeile 1972) |
| Greedy Fist | `8644-cf16-aaf1-49b8` | Magic Armour `d4da-5457-3aef-10e1` | **20** | Definition (Zeile 1930) |
| Cathayan Jet | `3aae-1505-669f-64fd` | Talismans `66af-5014-80e6-063d` | **30** | Definition (Zeile 1944) |
| Greatskull | `9fb2-cfc9-ab70-880b` | Magic Armour `d4da-5457-3aef-10e1` | **35** | Definition (Zeile 1888) |
| Gnoblar thiefstone | `a405-b750-7487-0272` | Talismans `66af-5014-80e6-063d` | **0** | Definition (Zeile 1997) |
| ↳ Gnoblar Thiefstones (Kindeintrag) | `a0c7-163f-4a34-f054` | — (inline unter `a405…`) | **15 je Stück** | Definition (Zeile 1988) |

Keiner dieser Einträge trägt einen `modifier` auf `field="ecfa-8486-4f6c-c249"`; die
Preise sind statisch.

### Der bepreiste Kindeintrag — der Fall, den `includeChildSelections="true"` entscheidet

Die Talismane enthalten genau **einen** Gegenstand mit einem eigenen bepreisten Kind:

```xml
<selectionEntry id="a405-b750-7487-0272" name="Gnoblar thiefstone" ... type="upgrade">
  <selectionEntries>
    <selectionEntry id="a0c7-163f-4a34-f054" name="Gnoblar Thiefstones" ... type="upgrade">
      <constraints>
        <constraint field="selections" scope="parent" value="1" ... id="c0b7-f9ea-d693-9c94" type="min"/>
        <constraint field="selections" scope="parent" value="3" ... id="2217-0c91-447a-5fd4" type="max"/>
      </constraints>
      <costs><cost name="pts" typeId="ecfa-8486-4f6c-c249" value="15"/></costs>
    </selectionEntry>
  </selectionEntries>
  <costs><cost name="pts" typeId="ecfa-8486-4f6c-c249" value="0"/></costs>
</selectionEntry>
```

Der Talisman selbst kostet **0** Punkte, seine 1–3 Steine je **15**. Ein Träger dieses
Talismans zahlt also 15/30/45 Punkte — und zwar **ausschliesslich** über die
verschachtelte Ebene. Rechnet eine Auswertung nur die direkten Gruppenmitglieder, sieht
sie 0 Punkte. Genau daran hängen die Roster 04/05.

Stückzahl-Rechnung: `number="3"` auf der Kind-Selektion bedeutet 3 Steine zu je 15 pts
= **45 pts** (Format-Doku [§7.5](../../battlescribe-data-format.md#75-cost--cost-type),
Rechenregel `child.number * parent.number`; der Hunter hat `number="1"`). Dieselbe Form
ist im Szenario [`unit-scope-per-model-cost`](../unit-scope-per-model-cost/README.md)
(`number="5"` × 19 pts) verifiziert.

### Was **nicht** in die Summe gehört — die Pflichtausrüstung und der Sabertusk

Der Hunter trägt vier `entryLink`s **direkt an sich selbst**, also als *Geschwister*
der Gruppe `9326…`, nicht als deren Nachfahren:

| Verweis | Ziel | Grenzen | pts |
|---------|------|---------|-----|
| **Ogre Club** `04d9-1775-d2cb-911e` | `8768-377c-88da-c3e8` (Mercenaries) | `min 1` `a4fb-5134-54ae-6e3a` / `max 1` `8062-a3f0-16cd-4d2c` | **0** |
| Harpoon Crossbow `c4eb-7549-7543-c449` | `cfbe-d2fe-cb2a-8d55` | `min 1` `a1d9-1683-67ac-51e8` / `max 1` `da12-ae07-9274-0764` | **0** |
| Light Armour `dbf2-a9f0-f26a-b8d9` | `055f-8e4e-f170-35d2` (`.gst`) | `min 1` `0174-70ff-7222-7ed7` / `max 1` `3402-8c55-6e5b-9655` | **0** |
| Sabertusk `9753-0ac3-9319-9686` | `64cc-52fc-69f6-59b5` | `max 2` `473e-2ab4-8862-bf63` | **20** |

**Befund zum Ogre Club (ausdrücklich gefragt):** Seine Kosten gehören **nicht** in die
Summe von `2dd3-546b-146e-ce63` — und zwar aus zwei unabhängigen Gründen:

1. **Strukturell:** Die Grenze hängt an der Gruppe `9326…`; gezählt werden nach
   Format-Doku §7.6 nur die Auswahlen *unterhalb ihres Trägers*. Der Ogre Club hängt
   als `entryLink` am `selectionEntry` „Hunter", eine Ebene **neben** der Gruppe.
2. **Numerisch:** Er ist ohnehin mit `value="0"` bepreist (Mercenaries-`.cat`
   Zeile 3940) — genau wie Harpoon Crossbow und Light Armour. Die Pflichtausrüstung
   könnte die Summe also selbst dann nicht verschieben, wenn sie fälschlich mitgezählt
   würde.

Weil Punkt 2 den strukturellen Punkt 1 unbeobachtbar macht, trägt **Roster 02**
zusätzlich einen **Sabertusk (20 pts)** — eine bepreiste Auswahl direkt am Hunter,
aber ausserhalb der Gruppe. Bei korrektem Rahmen bleibt die Gruppensumme dort **50**
(die Grenze schweigt); würde die Summe über den ganzen Hunter gebildet, wären es
**70** und die Grenze feuerte.

Ebenfalls nicht in der Summe: die **145 pts des Hunters selbst** (`.cat` Zeile 815).
Das pinnt Roster 01 mit nur 30 Punkten an Gegenständen: Zählte der Träger mit, stünde
dort 175 und jede Fassung feuerte.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **PCB-R1** | Eine `constraint` mit `field=<costTypeId>` misst eine **Kostensumme**, keine Anzahl. Der Ist-Wert einer Verletzung ist die summierte Punktzahl. | Ogre-`.cat` Gruppe `9326-f5c9-9e82-f4bf` → constraint **`2dd3-546b-146e-ce63`** `type=max value=50 field=ecfa-8486-4f6c-c249 scope=parent`; `ecfa-8486-4f6c-c249` ist der `costType` „pts" der `.gst`. |
| **PCB-R2** | Der Rahmen `scope="parent"` bindet die Summe an die **Hunter-Instanz** und zählt nur die Nachfahren der Grenzen-tragenden **Gruppe** — weder den Träger (145 pts) noch dessen Geschwister-Verweise (Ogre Club/Harpoon/Light Armour: je 0 pts; Sabertusk: 20 pts). | §7.6: „Gezählt werden die Auswahlen *unterhalb* des Trägers der Grenze". Träger ist `9326…`; Ogre Club `04d9-1775-d2cb-911e` und Sabertusk `9753-0ac3-9319-9686` hängen am `selectionEntry` `478d…`. |
| **PCB-R3** | `includeChildSelections="true"` zieht **verschachtelte** Auswahlen in die Summe — hier die 15-pts-Steine unter dem 0-pts-Talisman „Gnoblar thiefstone". | `2dd3-546b-146e-ce63` hat `includeChildSelections="true"` (XSD-Vorgabewert wäre `false`). Kindeintrag `a0c7-163f-4a34-f054` unter `a405-b750-7487-0272`, 15 pts, `min 1`/`max 3`. |
| **PCB-R4** | Ein `max` ist **auf** seiner Grenze noch erfüllt: 50 = 50 feuert nicht, erst 55 > 50 feuert. | `type="max"` (Untergrenzen wären `type="min"`). Verhalten am Grenzwert ist auch im Szenario [`orcs-and-goblins-budget`](../orcs-and-goblins-budget/README.md) belegt. |
| **PCB-R5** | Die **zweite** Kostensummen-Grenze am Hunter (`c7d2-e151-77ae-2e3a`, `field=pts scope=parent`) ist mit `value="-1"` **unbegrenzt** und feuert nie — solange „Border Patrols rules" nicht im Roster liegt, das sie per `set 150` auf einen echten Deckel zöge. | Ogre-`.cat` Zeile 758 + `modifier type="set" value="150" field="c7d2-e151-77ae-2e3a"` mit `condition atLeast 1 childId="4e15-0353-165f-5528" scope="roster"`. Sentinel `-1` = unbegrenzt: Format-Doku §7.6. Kein Roster dieses Szenarios enthält `4e15…`. |
| **PCB-R6** | Die **Anzahl**-Grenzen der Gegenstandsgruppen sind von der Punktegrenze unabhängig: Talismane `max 1` mit `includeChildSelections="false"` zählt nur die direkten Mitglieder — die verschachtelten Thiefstones zählen dort **nicht** mit. | Gruppe „Talismans" `66af-5014-80e6-063d` → constraint `3d0b-90f9-0333-7423` `type=max value=1 field=selections scope=parent includeChildSelections="false"`. Derselbe Träger-Typ, gegenteiliges Flag wie `2dd3…` — der Kontrast belegt, dass das Flag gelesen wird. |

**Nicht Teil der Erwartung (Verfügbarkeit / Sichtbarkeit):** Der Hunter trägt einen
`modifier set hidden=true`, der nur im Kontingent **„Ironskin Tribe (WD#309-UK)"**
(`forceEntry` `8711-ed16-2a44-7251`) greift; die Roster nutzen „Standard (OK-AB)"
`729f-9246-5cd3-5044`, das Gatter ist also zu. Der sechste Verweis der Gruppe,
„Magic Weapons (Relics of Lustria)" `2566-8d83-c38d-baf6` → `11e7-7d5d-b0fa-1f34`
(Mercenaries), zeigt auf eine per Basis **`hidden="true"`** gesetzte Gruppe. Beides ist
**Verfügbarkeit**, keine zählende/summierende Schranke; der Verletzungsbericht kodiert
das nicht, und keines der Roster wählt daraus. Deshalb wird dazu **keine** feuernde
Grenze erwartet.

### Wahl des Punktelimits

Alle Roster tragen `<costLimits><costLimit typeId="ecfa-8486-4f6c-c249" value="2000.0"/>`.
Begründung, aus den Daten:

- Die Rostersummen liegen zwischen **175** und **215** Punkten (Hunter 145 + Gruppe +
  ggf. Sabertusk). Ein Limit von 2000 schliesst aus, dass eine roster-weite
  Punkteschranke die Gruppengrenze überdeckt oder Verwirrung stiftet.
- Das Limit ist bewusst **nicht 500**: die `.gst` blendet „Border Patrols rules"
  (`4e15-0353-165f-5528`) per `condition type="equalTo" value="500"
  field="limit::ecfa-8486-4f6c-c249" scope="roster"` genau dort ein, und dieser
  Eintrag würde über `set 150` die zweite Punktegrenze `c7d2-e151-77ae-2e3a` des
  Hunters scharf schalten (PCB-R5).

Die Kontingent-Pflichten der `.gst` (General `1077-7379-f142-f382`, Core
`35c2-d478-392a-aeb1`) sind in diesen Rostern **nicht** erfüllt und dürfen zusätzlich
feuern — die Erwartung ist selektiv und macht dazu keine Aussage.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

> **Assertion-Fokus:** nur die genannten Grenz-Ids. Andere Armeeaufbau-Diagnosen
> (General-/Core-Pflicht, weitere Grenzen) können zusätzlich auftreten und sind ohne
> Belang. Das Manifest [`scenario.json`](scenario.json) pinnt die abgeleiteten
> Ist/Grenze-Werte.

| # | Roster-Zustand (Gruppe „Magic Items and Big Names") | Summe | Erwartetes Ergebnis (aus Katalogdaten abgeleitet) | Fixture |
|---|-----------------------------------------------------|-------|----------------------------------------------------|---------|
| 01 | Mawseeker (10) + Wardstone necklace (20) | **30** | `2dd3-546b-146e-ce63` **schweigt**. Beleg zugleich: die 145 pts des Trägers zählen nicht mit (sonst 175). | [`01-two-items-well-under-budget.ros`](rosters/01-two-items-well-under-budget.ros) |
| 02 | Greedy Fist (20) + Cathayan Jet (30); **zusätzlich** Sabertusk (20) ausserhalb der Gruppe | **50** | `2dd3…` **schweigt** (max ist auf der Grenze erfüllt, PCB-R4). Ein falscher Rahmen (ganzer Hunter) ergäbe 70 und feuerte — PCB-R2. | [`02-two-items-exactly-at-budget.ros`](rosters/02-two-items-exactly-at-budget.ros) |
| 03 | Greatskull (35) + Wardstone necklace (20) | **55** | `2dd3…` **feuert**: Ist **55** / Grenze **50**. Beide Gegenstände liegen einzeln unter 50 — nur die Summe reisst die Grenze; eine zählende Lesart ergäbe Ist 2. | [`03-two-items-over-budget.ros`](rosters/03-two-items-over-budget.ros) |
| 04 | Greedy Fist (20) + Gnoblar thiefstone (0) mit **3×** Gnoblar Thiefstones (45) | **65** | `2dd3…` **feuert**: Ist **65** / Grenze **50**. Ohne die verschachtelte Ebene wären es 20 → still. Der Fall zu `includeChildSelections="true"` (PCB-R3). Talisman-Anzahl `3d0b…` bleibt still (PCB-R6). | [`04-nested-thiefstones-over-budget.ros`](rosters/04-nested-thiefstones-over-budget.ros) |
| 05 | Greedy Fist (20) + Gnoblar thiefstone (0) mit **2×** Gnoblar Thiefstones (30) | **50** | `2dd3…` **schweigt**. Gegenprobe zu 04: klammert den Beitrag je Stein auf genau 15 pts ein. | [`05-nested-thiefstones-exactly-at-budget.ros`](rosters/05-nested-thiefstones-exactly-at-budget.ros) |

### Roster → Erwartung (Grenzen)

| Fixture | firing (limitId → Ist/Grenze) | absent |
|---------|-------------------------------|--------|
| 01 | — | `2dd3-546b-146e-ce63`, `c7d2-e151-77ae-2e3a`, `3d0b-90f9-0333-7423` |
| 02 | — | `2dd3-546b-146e-ce63`, `c7d2-e151-77ae-2e3a`, `3d0b-90f9-0333-7423` |
| 03 | `2dd3-546b-146e-ce63` **55/50** | `c7d2-e151-77ae-2e3a`, `3d0b-90f9-0333-7423` |
| 04 | `2dd3-546b-146e-ce63` **65/50** | `c7d2-e151-77ae-2e3a`, `3d0b-90f9-0333-7423`, `2217-0c91-447a-5fd4`, `c0b7-f9ea-d693-9c94` |
| 05 | — | `2dd3-546b-146e-ce63`, `c7d2-e151-77ae-2e3a`, `3d0b-90f9-0333-7423`, `2217-0c91-447a-5fd4`, `c0b7-f9ea-d693-9c94` |

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| ForceEntry „Standard (OK-AB)" (Ogre Kingdoms) | `729f-9246-5cd3-5044` |
| SelectionEntry „Hunter" (`type="unit"`, 145 pts) | `478d-eeb4-9e02-c6b2` |
| SelectionEntryGroup „Magic Items and Big Names" | `9326-f5c9-9e82-f4bf` |
| **Punktegrenze der Gruppe** (`max 50`, `field=pts`, `scope=parent`, `includeChildSelections=true`) | **`2dd3-546b-146e-ce63`** |
| Zweite Punktegrenze am Hunter (`max -1` = unbegrenzt; `set 150` bei Border Patrols) | `c7d2-e151-77ae-2e3a` |
| pts-Kostenart (`.gst`) | `ecfa-8486-4f6c-c249` |
| EntryLinks der Gruppe → geteilte Gegenstandsgruppen | `d552-c643-ca48-43f5`→`be5e-0c92-4eec-1335`, `f552-7435-2f84-b59e`→`e826-8d77-2f41-9ee4`, `555a-8821-ed80-af72`→`d4da-5457-3aef-10e1`, `2c13-f630-0a75-75e5`→`66af-5014-80e6-063d`, `ef84-f736-9694-8685`→`2b20-aee9-60cc-70c8`, `2566-8d83-c38d-baf6`→`11e7-7d5d-b0fa-1f34` (`hidden="true"`) |
| Mawseeker (Big Names, 10 pts) | `1697-55ab-4cf3-062e` |
| Wardstone necklace (Talisman, 20 pts) | `bba5-e0b2-3f93-24ff` |
| Cathayan Jet (Talisman, 30 pts) | `3aae-1505-669f-64fd` |
| Greedy Fist (Magic Armour, 20 pts) | `8644-cf16-aaf1-49b8` |
| Greatskull (Magic Armour, 35 pts) | `9fb2-cfc9-ab70-880b` |
| Gnoblar thiefstone (Talisman, **0 pts**) | `a405-b750-7487-0272` |
| ↳ Gnoblar Thiefstones (bepreister Kindeintrag, 15 pts; `min 1`/`max 3`) | `a0c7-163f-4a34-f054` — `c0b7-f9ea-d693-9c94` / `2217-0c91-447a-5fd4` |
| Anzahl-Grenze Talismane (`max 1`, `includeChildSelections="false"`) | `3d0b-90f9-0333-7423` |
| Ogre Club (Pflicht `min 1`/`max 1`, **0 pts**, ausserhalb der Gruppe) | Link `04d9-1775-d2cb-911e` → `8768-377c-88da-c3e8` (Mercenaries) |
| Harpoon Crossbow / Light Armour (Pflicht, je 0 pts) | `cfbe-d2fe-cb2a-8d55` / `055f-8e4e-f170-35d2` |
| Sabertusk (20 pts, ausserhalb der Gruppe, `max 2`) | Link `9753-0ac3-9319-9686` → `64cc-52fc-69f6-59b5` |
| ForceEntry „Ironskin Tribe (WD#309-UK)" (Gatter des `hidden`-Modifikators am Hunter) | `8711-ed16-2a44-7251` |
| „Border Patrols rules" (`.gst`, nicht in den Rostern) | `4e15-0353-165f-5528` |
