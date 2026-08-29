# E2E-Regeln & Testkatalog: `modifierGroup | cond=false | repeats=true | nested=false` — die bedingungslose, aber wiederholende Klammer

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln,
Constraint-Ids und Erwartungswerte sind **ausschließlich aus den Katalogdaten**
der *6th Definitive Edition* (`src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive/`)
und der Formatspezifikation
([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md), §7.5/§7.6/§7.7/§8)
abgeleitet. Die Roster-Form ist an den bestehenden Szenarien verifiziert
(direktes `entryId`, `entryLinkId=""`, verschachtelte `selections` mit `number`,
`<costLimits><costLimit …/></costLimits>` für das eingestellte Budget).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armeebuch: `Vampire Counts (6th definitive edition).cat` (`4d73-5ab0-9020-403c`, rev 1)
  — Kontingent **„Army of Sylvania (SoC)"** `4072-c3b8-84c4-a097` (`:29418`)
- Bibliothek: `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`) —
  per `catalogueLink` `ef73-f9bd-e250-54d2` eingebundene Abhängigkeit des
  Vampire-Counts-Katalogs

---

## Die Regel (In-World)

Eine `<modifierGroup>` ist laut Spezifikation „die Kurzform für ‚dieselbe
Bedingung an mehreren Modifiern'" — und dasselbe gilt für ihre `<repeats>`:

> Dasselbe gilt für ihre **`<repeats>`** (Issue 0116): der Wiederholungsfaktor der
> Klammer multipliziert sich in jedem Modifier darin auf dessen eigenen Faktor.
> — [§7.7, `modifierGroup`](../../battlescribe/building-blocks/modifier.md#modifiergroup--eine-bedingte-klammer-um-mehrere-modifier)

Die Zelle, die dieses Szenario festnagelt, ist die Klammer **ohne jede
Bedingung, aber mit `<repeats>`** (`cond=false | repeats=true | nested=false`).
Sie steht zwischen zwei naheliegenden Fehl-Lesarten:

1. „Eine Klammer ohne `<conditions>`/`<conditionGroups>` hat kein Gatter, also
   greift sie **einmal**" — dann stünden die Grenzen immer auf 3, unabhängig von
   der Armee.
2. „Eine Klammer, deren `<repeats>` im Nullpunkt 0 Treffer zählt, greift **gar
   nicht**" — dann stünden die Grenzen immer auf 2.

Richtig ist: sie greift **unbedingt**, und **wie oft**, sagen allein die
`<repeats>`. Der Katalog schreibt die Absicht im Klartext daneben — die Regel
„Army of Sylvania" (`rule` `dd10-ed71-f7d1-7bff`, `:26349-26350`, per `infoLink`
`62f0-e869-8ffa-bd9d` am Träger, `:10098`):

> *„the Sylvanian player places two Grave markers, **plus an additional Grave
> marker for each Vampire Count or Vampire Lord** in the army"*

Zwei Marker als Sockel, **je Vampir einer mehr** — also eine Staffel, keine
Einmal-Anwendung und kein Nullwert.

---

## Die Datenlage im Fixture-Satz

Der Träger ist der Wurzel-Eintrag „Army of Sylvania" `b48b-4a69-80f1-5d47`
(`:10079`, `hidden="true"`), aufgedeckt genau im Kontingent
`4072-c3b8-84c4-a097` (`:10090-10096`). Sein einziges Kind ist „Grave markers"
(`:10101-10118`):

```xml
<selectionEntry type="upgrade" import="true" name="Grave markers"
                hidden="false" id="f899-4fbd-db93-629e" defaultAmount="2">
  <constraints>
    <constraint type="min" value="2" field="selections" scope="parent"
                shared="true" id="5c4a-c8ea-073d-909c" includeChildSelections="false"/>
    <constraint type="max" value="2" field="selections" scope="parent"
                shared="true" id="1b4e-3003-8b78-4be6" includeChildSelections="false"/>
  </constraints>
  <modifierGroups>
    <modifierGroup type="and">          <!-- KEINE <conditions>, KEINE <conditionGroups> -->
      <modifiers>
        <modifier type="increment" value="1" field="1b4e-3003-8b78-4be6"/>
        <modifier type="increment" value="1" field="5c4a-c8ea-073d-909c"/>
      </modifiers>
      <repeats>
        <repeat value="1" repeats="1" field="selections" scope="force"
                childId="6822-0110-a7c9-cbb0" shared="true" roundUp="false"
                includeChildSelections="true"/>          <!-- je Vampire Count -->
        <repeat value="1" repeats="1" field="selections" scope="force"
                childId="b77b-88d5-5e80-e178" shared="true" roundUp="false"
                includeChildSelections="true"/>          <!-- je 0-1 Vampire Lord -->
      </repeats>
    </modifierGroup>
  </modifierGroups>
</selectionEntry>
```

Die beiden Grenzen `5c4a…` und `1b4e…` werden **im gesamten Fixture-Satz von
keinem weiteren Modifikator adressiert** — die einzigen Fundstellen ihrer Ids
sind die Constraint-Deklarationen (`:10103`, `:10104`) und die zwei `increment`
in genau dieser Klammer (`:10109`, `:10110`). Was die Grenzen bewegt, ist damit
ausschließlich diese Klammer.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **GM-R1** | Die Katalog-Grundwerte für „Grave markers" sind **min 2 / max 2**, beide `field="selections" scope="parent" includeChildSelections="false"` — also *genau zwei* Marker unter „Army of Sylvania", solange nichts sie hebt. | `Vampire Counts (…).cat:10103` (`5c4a-c8ea-073d-909c`, `type="min" value="2"`) und `:10104` (`1b4e-3003-8b78-4be6`, `type="max" value="2"`). Muster „genau zwei" aus [§7.6](../../battlescribe/building-blocks/constraint.md#76-constraint). |
| **GM-R2** | `scope="parent"` zählt die Auswahlen von „Grave markers" **innerhalb ihrer Elternauswahl** „Army of Sylvania", nicht armeeweit. `actual`/`current` ist damit die Markerzahl unter genau diesem Träger. | `:10103-10104`; [§7.6-Regelkasten](../../battlescribe/building-blocks/constraint.md#76-constraint): `scope="parent"` vergleicht aufgelöste **Ziel-IDs**. Jedes Roster trägt genau **eine** „Army of Sylvania"-Auswahl. |
| **GM-R3** | Die Markerzahl steht im Roster als `number` an **einer** Auswahl und ist eine **absolute Gesamtstückzahl**. | [§7.5-Kasten „Zahlenbasis"](../../battlescribe/building-blocks/cost.md#75-cost--cost-type): jeder Knoten trägt sein `count` unverrechnet bei. Passend dazu trägt der Katalogeintrag `defaultAmount="2"` (`:10101`) — der Eintrag ist von Haus aus mengenwertig. |
| **GM-R4** | Die `modifierGroup` trägt **weder `<conditions>` noch `<conditionGroups>`** — es gibt kein Gatter, das sie stummschalten könnte. Ihre beiden Modifikatoren tragen ebenfalls **keine eigenen** Bedingungen. | `:10106-10117`: `modifierGroup type="and"` mit ausschließlich `<modifiers>` und `<repeats>`. [§7.7](../../battlescribe/building-blocks/modifier.md#modifiergroup--eine-bedingte-klammer-um-mehrere-modifier) und der dortige Fallstrick-Kasten (Modifikatoren stehen **entweder** in `<modifiers>` **oder** in einer `<modifierGroup>`). |
| **GM-R5** | Je **Anwendung** hebt die Klammer **beide** Grenzen um genau **1** (`increment value="1"` auf `1b4e…` **und** auf `5c4a…`). Min und Max wandern also im Gleichschritt; „genau N Marker" bleibt in jeder Stufe erhalten. | `:10109-10110`. Zwei `increment` mit `value="1"` auf die beiden Constraint-Ids aus GM-R1. |
| **GM-R6** | Die Zahl der Anwendungen kommt allein aus den `<repeats>`: `value="1"`, `repeats="1"`, `roundUp="false"` ⇒ **eine** Anwendung je gezähltem Treffer. | `:10113-10114`; [§7.7, `repeat`](../../battlescribe/building-blocks/modifier.md#repeat--modifier-mehrfach-anwenden): *„bewirkt, dass der Modifier **mehrfach** angewendet wird […] `repeats` (wie oft pro Treffer)"*. |
| **GM-R7** | Der hier wirksame `<repeat>` zählt „Vampire Count" `6822-0110-a7c9-cbb0` im `scope="force"` mit `includeChildSelections="true"`; das Ziel ist ein **Eintrag** (kein Kategorie-Ziel), also **pro Kontingent**. Alle Roster haben genau ein Kontingent. | `:10113`; Ziel-Typ-Regel [§7.7](../../battlescribe/building-blocks/modifier.md#77-modifier-condition-condition-group-repeat) / ADR 0029. `6822-0110-a7c9-cbb0` = `selectionEntry` „Vampire Count" (`:3124`). |
| **GM-R8** | **Die Kernaussage:** wirksame Grenze = `2 + (#Vampire Count im Kontingent)`, für min **und** max. Mit 0 / 1 / 2 Counts also **2 / 3 / 4**. | GM-R1 + GM-R5 + GM-R6 + GM-R7. In-World-Beleg: `rule` `dd10-ed71-f7d1-7bff` (`:26350`): *„two Grave markers, plus an additional Grave marker **for each** Vampire Count or Vampire Lord"*. |
| **GM-R9** | „Vampire Count" ist **nicht** mengenbeschränkt (kein eigener `constraint` am Eintrag) und im Kontingent `4072…` **sichtbar** — zwei Counts sind also eine zulässige Bühne für Stufe 2. | `:3124-3499` enthält **kein** `<constraints>`-Element am Eintrag selbst; der einzige `set hidden="true"` (`:3400-3410`) gilt den Kontingenten „Necromancer's Army" `d3af-1add-4e99-b977` und „Vampire Coast" `bf46-ee85-7c10-ba98`, nicht `4072…`. |
| **GM-R10** | „Army of Sylvania" ist per Basis `hidden="true"` und wird **genau im Kontingent `4072-c3b8-84c4-a097`** aufgedeckt; nur dort werden Min-Grenzen darunter überhaupt validiert. Es ist dort zugleich **Pflicht** (`min 1`, force **und** parent) und auf **eins** begrenzt (`max 1`, force und parent). | `:10079` (`hidden="true"`), `:10091-10095` (`set hidden="false"` bei `instanceOf … childId="4072-c3b8-84c4-a097"`), `:10085-10088` (`e574-8cdb-9a8a-e48f` max/force, `1f2f-e5cc-d04d-162e` min/force, `9f7d-8853-00c9-4bb1` max/parent, `e23f-0cea-11ac-9376` min/parent). Zur Nichtvalidierung verborgener Min-Grenzen: [§5.6](../../battlescribe/files/game-system.md#56-force-entries-detachments) / [§8](../../battlescribe/building-blocks/category-and-visibility.md#8-kategorien--sichtbarkeit). |
| **GM-R11** | „Grave markers" selbst ist `hidden="false"` und trägt **keinen** `hidden`-Modifikator; unter dem im Kontingent `4072…` aufgedeckten Träger ist der Slot mithin **sichtbar** (`isHidden: false`), und seine Untergrenze ist zu validieren. | `:10101` (`hidden="false"`), `:10101-10118` ohne `field="hidden"`-Modifikator; GM-R10 für den Träger. |

### Warum das Kontingent `4072-c3b8-84c4-a097`

Alle sechs Roster stehen im Kontingent „Army of Sylvania (SoC)". Nur dort greift
das Aufdeck-Gatter des Trägers (GM-R10), und nur dann ist die **Min**-Aussage der
Roster 02 und 04 wohlbestimmt: die Min-Grenzen einer effektiv verborgenen
Entität werden laut [§8](../../battlescribe/building-blocks/category-and-visibility.md#8-kategorien--sichtbarkeit)
**nicht** validiert. In jedem anderen Kontingent bliebe der Träger verborgen und
die Erwartung „min feuert" wäre aus den erlaubten Quellen nicht ableitbar.

### Abgrenzung zum Szenario [`modifier-group-repeats`](../modifier-group-repeats/README.md)

Beide Szenarien lesen **denselben** Katalogausschnitt, stellen aber **verschiedene
Fragen** und teilen **kein einziges Roster**:

| | [`modifier-group-repeats`](../modifier-group-repeats/README.md) | dieses Szenario |
|---|---|---|
| Frage | Wie verrechnen sich **zwei** `<repeat>` **einer** `<repeats>`-Liste? (additiv vs. multiplizierend) | Greift eine Klammer **ohne Bedingung, aber mit `<repeats>`** unbedingt, und **wandert** ihre Wirkung mit der Trefferzahl? |
| Bühne | Vampire Counts **und** Vampire Lord nebeneinander (Roster 07/08), zusätzlich ein Fremd-Kontingent | **ausschließlich** Vampire Counts, **nie** ein Vampire Lord, immer Kontingent `4072…` |
| Ablesestelle | nur `firing`/`absent` | **`expect.capabilities`** am Slot „Grave markers" (`effectiveMin`/`effectiveMax`/`current`/`headroom`/`isBlocked`/`isMandatoryUnmet`) **plus** `firing`/`absent` |
| Stufen | 0, 1, 3 Anwendungen | 0, 1, **2** Anwendungen — die Staffel wird über **zwei** Schritte in gleichen Abständen abgegangen |

> **Hinweis zur Auftragsbeschreibung:** Der Auftrag nannte
> `modifier-group-repeats` als Szenario über „eine Klammer, die *auch*
> Bedingungen trägt". Das trifft auf die Daten nicht zu — die dort untersuchte
> Klammer ist dieselbe bedingungslose Grave-markers-Klammer. Die Trennlinie
> zwischen den Szenarien verläuft deshalb, wie oben tabelliert, entlang der
> **Frage** und der **Ablesestelle**, nicht entlang zweier verschiedener
> `modifierGroup`-Vorkommen; ein zweites Vorkommen von
> `cond=false | repeats=true` gibt es im Fixture-Satz nicht.

### Die offene Frage, die dieses Szenario **nicht** entscheidet

Was **zwei** `<repeat>`-Elemente in **einer** `<repeats>`-Liste gemeinsam
ergeben — ob sich ihre Beiträge summieren oder ob jeder für sich der Reihe nach
angewandt wird —, ist weder in der Formatspezifikation
([§7.7](../../battlescribe/building-blocks/modifier.md#repeat--modifier-mehrfach-anwenden)
spricht nur vom einzelnen `repeat`) noch im BSData-Wiki festgelegt.

Dieses Szenario weicht der Frage **konstruktiv** aus: **kein** Roster enthält
einen „0-1 Vampire Lord" `b77b-88d5-5e80-e178`. Der zweite `<repeat>` zählt
damit in **jedem** Roster 0 Treffer, und die einzige Aussage, die dieses Szenario
über das Zusammenspiel überhaupt trifft, lautet: **ein `<repeat>` mit 0 Treffern
ist neutral** — er löscht die Beiträge des anderen nicht aus. Genau das sagt die
gedruckte Regel `dd10-ed71-f7d1-7bff` unmissverständlich („for each Vampire Count
**or** Vampire Lord"): eine Armee mit einem Count und ohne Lord bekommt **drei**
Marker, nicht zwei. Ob sich zwei **beiderseits positive** Trefferzahlen addieren
oder multiplizieren, bleibt hier ausdrücklich offen; diese Frage beantwortet
[`modifier-group-repeats`](../modifier-group-repeats/README.md) an eigenen
Rostern.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle laufen gegen
**denselben** Datensatz (`.gst` + Vampire Counts `.cat` + Mercenaries `.cat`),
tragen `<costLimit>` 3000 Punkte und dasselbe Kontingent `4072-c3b8-84c4-a097`
mit genau **einer** „Army of Sylvania"-Auswahl.

> **Assertion-Fokus:** die Capability-Projektion des Slots „Grave markers"
> (`f899-4fbd-db93-629e`) sowie die Constraint-Ids `5c4a-c8ea-073d-909c` und
> `1b4e-3003-8b78-4be6`. Andere Armeeaufbau-Diagnosen dürfen zusätzlich auftreten
> und sind hier ohne Belang — namentlich die General-/Core-Pflichten des
> Kontingents und die Pflicht-Kinder des Vampire Count (u. a. die Gruppe
> „Wizard Level" `7ab1-d9dc-6124-443f` mit `min 1` `19ba-de18-6ad7-2825`), die in
> den bewusst minimal gehaltenen Rostern nicht ausgefüllt sind.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | Nullpunkt: kein Vampir, 2 Marker | „Army of Sylvania" + **2** Marker, **0** Vampire Counts. | **GM-R1/GM-R8:** beide `<repeat>` zählen 0 ⇒ Grenzen **2/2**. Slot: `current 2`, `effectiveMin 2`, `effectiveMax 2`, `headroom 0`, `isBlocked`, nicht `isMandatoryUnmet`. Beide Grenzen **absent**. | [`01-no-vampire-2-markers-base-bounds.ros`](rosters/01-no-vampire-2-markers-base-bounds.ros) |
| 02 | **Kernfall:** 1 Count, Marker auf der *unverschobenen* Grenze | Wie 01, zusätzlich **1 × Vampire Count**, weiterhin **2** Marker. | **GM-R8:** Grenzen **3/3**. `5c4a-c8ea-073d-909c` feuert **Ist 2 / Grenze 3**; `1b4e…` **absent**. Slot: `current 2`, `effectiveMin 3`, `effectiveMax 3`, `headroom 1`, `isMandatoryUnmet`. Griffe die Klammer nicht, stünde die Untergrenze bei 2 und schwiege ganz. | [`02-one-count-2-markers-min-fires.ros`](rosters/02-one-count-2-markers-min-fires.ros) |
| 03 | 1 Count, Marker auf der *verschobenen* Grenze | Wie 02, aber **3** Marker. | Grenzen **3/3**, Ist 3 liegt genau dazwischen ⇒ beide **absent**. Slot: `current 3`, `effectiveMin 3`, `effectiveMax 3`, `headroom 0`, `isBlocked`. Ohne die Wiederholung feuerte hier die Obergrenze (Ist 3 / Grenze 2). | [`03-one-count-3-markers-legal.ros`](rosters/03-one-count-3-markers-legal.ros) |
| 04 | Zweite Stufe: 2 Counts, 3 Marker | „Army of Sylvania" + **3** Marker, **2 × Vampire Count** (zwei getrennte Auswahlen, je `number="1"`). | Grenzen **4/4**. `5c4a-c8ea-073d-909c` feuert **Ist 3 / Grenze 4** — dieselbe Markerzahl, die in Roster 03 legal war. Slot: `current 3`, `effectiveMin 4`, `effectiveMax 4`, `headroom 1`, `isMandatoryUnmet`. `1b4e…` **absent**. | [`04-two-counts-3-markers-min-fires.ros`](rosters/04-two-counts-3-markers-min-fires.ros) |
| 05 | Zweite Stufe erfüllt: 2 Counts, 4 Marker | Wie 04, aber **4** Marker. | Grenzen **4/4**, Ist 4 dazwischen ⇒ beide **absent**. Slot: `current 4`, `effectiveMin 4`, `effectiveMax 4`, `headroom 0`, `isBlocked`. Bei nur **einer** Anwendung läge die Obergrenze bei 3 und feuerte hier — das trennt Stufe 2 von Stufe 1. | [`05-two-counts-4-markers-legal.ros`](rosters/05-two-counts-4-markers-legal.ros) |
| 06 | Obergrenze der zweiten Stufe | Wie 04, aber **5** Marker. | `1b4e-3003-8b78-4be6` feuert **Ist 5 / Grenze 4** — der gehobene `bound` unterscheidet die Stufen (2 ohne Anwendung, 3 bei einer, 4 bei zweien). Slot: `current 5`, `effectiveMin 4`, `effectiveMax 4`, `isBlocked`. `5c4a…` **absent**. | [`06-two-counts-5-markers-max-fires.ros`](rosters/06-two-counts-5-markers-max-fires.ros) |

### Herleitung der Zahlen

- **`effectiveMin` / `effectiveMax` / `bound`** ist der wirksame `value` der
  jeweiligen Grenze: Katalogwert **2** (`:10103`, `:10104`), erhöht um **1 je
  Anwendung** der Klammer (`increment value="1"`, `:10109-10110`, GM-R5). Die
  Zahl der Anwendungen ist die Trefferzahl des `<repeat>` auf „Vampire Count"
  (GM-R6/GM-R7; der zweite `<repeat>` zählt überall 0). Daraus: Roster 01 ⇒ **2**,
  Roster 02–03 ⇒ **3**, Roster 04–06 ⇒ **4** — für **beide** Grenzen identisch.
- **`current` / `actual`** ist die Zahl der Grave-marker-Auswahlen unter „Army of
  Sylvania" (`field="selections"`, `scope="parent"`, GM-R2) und steht als `number`
  an der einen Marker-Auswahl (GM-R3): **2 / 2 / 3 / 3 / 4 / 5** in den Rostern
  01…06.
- **`headroom`** ist der Rest bis zum Höchstmaß (`effectiveMax − current`),
  behauptet nur dort, wo `current ≤ effectiveMax`: 0 / 1 / 0 / 1 / 0 in den
  Rostern 01–05. In Roster 06 liegt `current` **über** dem Höchstmaß; welchen
  Wert `headroom` dann trägt (0 oder negativ), lässt sich aus den erlaubten
  Quellen nicht ableiten und wird dort deshalb **nicht** behauptet.
- **`isBlocked`** („Höchstmaß ausgeschöpft") gilt, wo `current ≥ effectiveMax`
  (Roster 01, 03, 05, 06); **`isMandatoryUnmet`** gilt, wo
  `current < effectiveMin` (Roster 02, 04).
- Wo `actual` zwischen `min` und `max` liegt, ist beides erfüllt und keine der
  Grenzen erscheint im Bericht — die Erwartung lautet dort `absent`, ohne
  `actual`/`bound`.

### Was bewusst **nicht** Teil der Erwartung ist

| Facette | Warum nicht |
|---------|-------------|
| **Sichtbarkeit als Verstoß** — „Army of Sylvania" ist per Basis `hidden="true"` und wird nur im Kontingent `4072…` aufgedeckt (GM-R10). | Als **Verfügbarkeit** (`field="hidden"`) modelliert, nicht als zählende Schranke. Der Verletzungsbericht kodiert zählende Grenzen; die Sichtbarkeit liest man an der Capability-Projektion ab — dort wird sie als `isHidden: false` des Slots „Grave markers" (GM-R11) sehr wohl behauptet, aber **nicht** als `firing`-Eintrag (gleiche Abgrenzung wie VBL-R4/R5 in [`vampire-bloodlines`](../vampire-bloodlines/README.md)). |
| **Die vier Eigengrenzen von „Army of Sylvania"** (`e574-8cdb-9a8a-e48f`, `1f2f-e5cc-d04d-162e`, `9f7d-8853-00c9-4bb1`, `e23f-0cea-11ac-9376`). | In allen Rostern durch die eine Träger-Auswahl erfüllt (GM-R10); sie tragen nichts zur geprüften Aussage bei und stehen als Beleg, nicht als Assertion. |
| **Das Verhalten bei zwei beiderseits positiven `<repeat>`-Trefferzahlen** (`b77b-88d5-5e80-e178` „0-1 Vampire Lord ", armeeweite Obergrenze `a7c9-5fec-592a-3716`, `:2715`). | Aus den erlaubten Quellen nicht entscheidbar (siehe „Die offene Frage" oben). Kein Roster führt einen Vampire Lord; damit trifft dieses Szenario dazu **weder** eine `firing`- **noch** eine `absent`-Aussage. |
| **`headroom` in Roster 06** und generell die Rechenregel bei überschrittenem Höchstmaß. | Aus den erlaubten Quellen nicht ableitbar; siehe „Herleitung der Zahlen". |
| **Die Pflicht-Kinder des Vampire Count** (u. a. Gruppe „Wizard Level" `7ab1-d9dc-6124-443f` mit `min 1` `19ba-de18-6ad7-2825`) und die General-/Core-Pflichten des Kontingents. | Beiwerk des Armeeaufbaus. Die Roster sind bewusst minimal: die Vampire Counts stehen nur da, um den `<repeat>`-Zähler zu füttern. Zusätzliche Verletzungen sind ausdrücklich erlaubt. |
| **Der Regeltext `dd10-ed71-f7d1-7bff`** („two Grave markers, plus an additional …"). | Ein `rule`-Text ist Prosa, keine zählende Grenze — er dient hier als In-World-Beleg für die Staffel, nicht als geprüfte Ausgabe. |
| **Eine bedingungslose `<repeats>`-Klammer mit `value > 1`, `roundUp="true"` oder verschachtelten `<modifierGroups>`.** | Im Fixture-Satz an dieser Stelle nicht vorhanden; die Grave-marker-Klammer ist das einzige Vorkommen einer bedingungslosen Klammer mit `<repeats>`. Ein solcher Fall müsste erfunden werden (die verschachtelte Variante deckt [`nested-modifier-group`](../nested-modifier-group/README.md) auf ihrer eigenen Bühne ab). |

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Spielsystem WHFB 6th definitive | `0d13-7737-ea86-4662` |
| Katalog **Vampire Counts** | `4d73-5ab0-9020-403c` |
| Bibliothek **Mercenaries** (per `catalogueLink` `ef73-f9bd-e250-54d2`) | `fc47-8392-a6c8-452a` |
| `costType` „pts" (`.gst`) | `ecfa-8486-4f6c-c249` |
| ForceEntry „Army of Sylvania (SoC)" (`:29418`) | `4072-c3b8-84c4-a097` |
| SelectionEntry „Army of Sylvania" (`:10079`, `hidden="true"`, aufgedeckt bei `4072…`) | `b48b-4a69-80f1-5d47` |
| — dessen Eigengrenzen max/force, min/force, max/parent, min/parent (`:10085-10088`) | `e574-8cdb-9a8a-e48f` / `1f2f-e5cc-d04d-162e` / `9f7d-8853-00c9-4bb1` / `e23f-0cea-11ac-9376` |
| — dessen `infoLink` auf die Regel „Army of Sylvania" (`:10098` / `:26349`) | `62f0-e869-8ffa-bd9d` → `dd10-ed71-f7d1-7bff` |
| SelectionEntry „Grave markers" (`:10101`, `defaultAmount="2"`, `hidden="false"`) — der geprüfte Slot | **`f899-4fbd-db93-629e`** |
| — **Untergrenze** min 2, `scope="parent"` (`:10103`) | **`5c4a-c8ea-073d-909c`** |
| — **Obergrenze** max 2, `scope="parent"` (`:10104`) | **`1b4e-3003-8b78-4be6`** |
| — die bedingungslose `modifierGroup` mit zwei `increment 1` und zwei `<repeat>` (`:10106-10117`) | (unbenannt) |
| SelectionEntry „Vampire Count" (`:3124`) — Ziel des wirksamen `<repeat>`, ohne eigene Mengengrenze | `6822-0110-a7c9-cbb0` |
| — dessen Gruppe „Wizard Level" (min 1 / max 1) — bewusst unausgefülltes Beiwerk | `7ab1-d9dc-6124-443f` — `19ba-de18-6ad7-2825` / `436d-44fa-86cf-bf42` |
| SelectionEntry „0-1 Vampire Lord " (`:2713`) — Ziel des zweiten `<repeat>`, **in keinem Roster enthalten** | `b77b-88d5-5e80-e178` |
| — dessen armeeweite Obergrenze max 1, `scope="roster"` (`:2715`) | `a7c9-5fec-592a-3716` |
| Kontingente, in denen „Vampire Count" verborgen ist (nicht `4072…`) | `d3af-1add-4e99-b977` / `bf46-ee85-7c10-ba98` |
