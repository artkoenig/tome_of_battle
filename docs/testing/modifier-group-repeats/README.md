# E2E-Regeln & Testkatalog: `<repeats>` an einer `<modifierGroup>` — mehrere `<repeat>` **addieren** sich

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln,
Constraint-Ids und Erwartungswerte sind **ausschließlich aus den Katalogdaten**
der *6th Definitive Edition* (`src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive/`)
und der Formatspezifikation
([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md), §7.5/§7.6/§7.7)
abgeleitet. Die Roster-Form ist an den bestehenden Szenarien verifiziert
(direktes `entryId`, `entryLinkId=""`, verschachtelte `selections` mit `number`,
`<costLimits><costLimit …/></costLimits>` für das eingestellte Budget).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armeebuch: `Vampire Counts (6th definitive edition).cat` (`4d73-5ab0-9020-403c`, rev 1)
  — Kontingent **„Army of Sylvania (SoC)"** `4072-c3b8-84c4-a097` (`:29418`),
  Kontrast-Kontingent **„Clan Von Carstein (VC-AB)"** `b1e4-e1cf-9bd6-2438` (`:29312`)
- Bibliothek: `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`) —
  per `catalogueLink` `ef73-f9bd-e250-54d2` eingebundene Abhängigkeit des
  Vampire-Counts-Katalogs (`Vampire Counts (…).cat:29511`).

---

## Die Regel (In-World)

Ein `<repeats>` an einer `<modifierGroup>` wiederholt die Modifikatoren **in**
der Klammer:

> Dasselbe gilt für ihre **`<repeats>`** (Issue 0116): der Wiederholungsfaktor der
> Klammer multipliziert sich in jedem Modifier darin auf dessen eigenen Faktor.
> Real genutzt in `Vampire Counts` („Grave markers": `+1` auf zwei Grenzen,
> wiederholt je gezähltem Vampir im Kontingent).
> — [§7.7, `modifierGroup`](../../battlescribe/building-blocks/modifier.md#modifiergroup--eine-bedingte-klammer-um-mehrere-modifier)

Die Frage, die dieses Szenario festnagelt, ist die **Kombination mehrerer
`<repeat>`-Elemente in *einer* `<repeats>`-Liste**: jedes `<repeat>` steuert
seine eigenen Anwendungen bei, und die Beiträge **addieren** sich. Sie
multiplizieren sich **nicht**. Der Katalog schreibt die Absicht im Klartext
daneben — die Regel „Army of Sylvania" (`rule` `dd10-ed71-f7d1-7bff`, `:26349`,
per `infoLink` `62f0-e869-8ffa-bd9d` am Träger, `:10098`):

> *„the Sylvanian player places two Grave markers, **plus an additional Grave
> marker for each Vampire Count or Vampire Lord** in the army"*

„für **jeden** Vampire Count **oder** Vampire Lord" ist eine Summe über zwei
Zählklassen, kein Produkt. Eine multiplizierende Auswertung ließe die Zahl der
Marker bei 2 stehen, sobald eine der beiden Klassen leer ist — was bei einer
Armee mit einem Vampire Count und ohne Vampire Lord der gedruckten Regel
widerspricht.

---

## Die Datenlage im Fixture-Satz

Der Träger ist der Wurzel-Eintrag „Army of Sylvania" `b48b-4a69-80f1-5d47`
(`:10079`, `hidden="true"`), aufgedeckt genau im Kontingent
`4072-c3b8-84c4-a097` (`:10091-10095`, `modifier set hidden="false"` mit
`condition instanceOf … scope="force" childId="4072-c3b8-84c4-a097"`). Sein
einziges Kind ist „Grave markers" (`:10101-10118`):

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
    <modifierGroup type="and">
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

Die `modifierGroup` trägt **keine** `<conditions>`/`<conditionGroups>` — sie
greift immer, allein die `<repeats>` steuern, **wie oft**.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **MGR-R1** | Die Katalog-Grundwerte für „Grave markers" sind **min 2 / max 2**, beide `field="selections" scope="parent" includeChildSelections="false"` — also *genau zwei* Marker unter „Army of Sylvania", solange nichts sie hebt. | `Vampire Counts (…).cat:10103` (`5c4a-c8ea-073d-909c`, `type="min" value="2"`) und `:10104` (`1b4e-3003-8b78-4be6`, `type="max" value="2"`). Muster „genau eins/genau zwei" aus [§7.6](../../battlescribe/building-blocks/constraint.md#76-constraint). |
| **MGR-R2** | `scope="parent"` zählt die Auswahlen von „Grave markers" **innerhalb ihrer Elternauswahl** „Army of Sylvania" — nicht armeeweit. `actual` ist damit die Markerzahl unter genau diesem Träger. | `:10103-10104`; [§7.6-Regelkasten](../../battlescribe/building-blocks/constraint.md#76-constraint): `scope="parent"` vergleicht aufgelöste **Ziel-IDs**. Alle Roster tragen genau eine „Army of Sylvania"-Auswahl. |
| **MGR-R3** | Die Markerzahl im Roster steht als `number` an **einer** Auswahl und ist eine **absolute Gesamtstückzahl**. | [§7.5-Kasten „Zahlenbasis"](../../battlescribe/building-blocks/cost.md#75-cost--cost-type): jeder Knoten trägt sein `count` unverrechnet bei; die `.ros`-Semantik ist die absolute Gesamtstückzahl. Passend dazu trägt der Katalogeintrag `defaultAmount="2"` (`:10101`) — der Eintrag ist von Haus aus mengenwertig. |
| **MGR-R4** | Die `modifierGroup` erhöht **beide** Grenzen je Anwendung um **1** (`increment value="1"` auf `1b4e…` **und** auf `5c4a…`). Sie trägt keine Bedingungen; ihre Wirkung hängt allein an den `<repeats>`. | `:10107-10116` — `modifierGroup type="and"` mit zwei `<modifier type="increment" value="1">`, ohne `<conditions>`/`<conditionGroups>`. [§7.7](../../battlescribe/building-blocks/modifier.md#modifiergroup--eine-bedingte-klammer-um-mehrere-modifier): die Klammer ist die Kurzform für „dieselbe Bedingung/denselben Wiederholungsfaktor an mehreren Modifiern". |
| **MGR-R5** | Ein einzelnes `<repeat value="1" repeats="1">` liefert **so viele** Anwendungen, wie im Rahmen gezählt wird (Schrittweite 1, `repeats="1"` Anwendung je Schritt, `roundUp="false"`). | `:10113-10114`; [§7.7, `repeat`](../../battlescribe/building-blocks/modifier.md#repeat--modifier-mehrfach-anwenden): *„bewirkt, dass der Modifier **mehrfach** angewendet wird […] `repeats` (wie oft pro Treffer)"*. |
| **MGR-R6** | **Die Kernaussage:** Die beiden `<repeat>` derselben `<repeats>`-Liste **addieren** ihre Anwendungen. Wirksame Grenze = `2 + (#Vampire Count) + (#0-1 Vampire Lord)` im Kontingent — für **beide** Grenzen gleichermaßen. | `:10112-10115` (zwei `<repeat>` in einer `<repeats>`-Liste, `childId="6822-0110-a7c9-cbb0"` bzw. `"b77b-88d5-5e80-e178"`). In-World-Beleg: `rule` „Army of Sylvania" `dd10-ed71-f7d1-7bff` (`:26350`): *„plus an additional Grave marker **for each** Vampire Count **or** Vampire Lord"*. |
| **MGR-R7** | Gezählt wird je `<repeat>` im `scope="force"` mit `includeChildSelections="true"`, Ziel ist ein **Eintrag** (kein Kategorie-Ziel) — also pro Kontingent. Alle Roster haben genau ein Kontingent. | `:10113-10114`; Ziel-Typ-Regel [§7.7](../../battlescribe/building-blocks/modifier.md#77-modifier-condition-condition-group-repeat) / ADR 0029: `scope="force"` mit **Eintrags**-Ziel zählt **pro Detachment**. `6822-0110-a7c9-cbb0` = `selectionEntry` „Vampire Count" (`:3124`), `b77b-88d5-5e80-e178` = `selectionEntry` „0-1 Vampire Lord " (`:2713`). |
| **MGR-R8** | „0-1 Vampire Lord" ist **armeeweit auf 1** begrenzt; die Roster nehmen deshalb höchstens einen. | `:2715` — `constraint field="selections" scope="roster" value="1" type="max" id="a7c9-5fec-592a-3716" includeChildSelections="false" includeChildForces="false"`. |
| **MGR-R9** | „Army of Sylvania" ist per Basis `hidden="true"` und wird **genau im Kontingent `4072-c3b8-84c4-a097`** aufgedeckt; dort werden auch seine Min-Grenzen validiert. Es ist dort zugleich **Pflicht** (`min 1`, force **und** parent) und auf **eins** begrenzt (`max 1`, force und parent). | `:10079` (`hidden="true"`), `:10091-10095` (`set hidden="false"` bei `instanceOf … childId="4072-c3b8-84c4-a097"`), `:10085-10088` (`e574-8cdb-9a8a-e48f` max/force, `1f2f-e5cc-d04d-162e` min/force, `9f7d-8853-00c9-4bb1` max/parent, `e23f-0cea-11ac-9376` min/parent). Alle Roster enthalten genau **eine** „Army of Sylvania"-Auswahl, alle vier sind damit erfüllt. |
| **MGR-R10** | „Vampire Count" und „0-1 Vampire Lord" sind im Kontingent `4072…` **sichtbar** — die einzigen Verstecken-Modifikatoren gelten den Kontingenten „Necromancer's Army" `d3af-1add-4e99-b977`, „Vampire Coast" `bf46-ee85-7c10-ba98` bzw. „Army of the Lichemaster" `f37a-a93e-fa22-61a8`. | Vampire Count: `:3401-3410` (`set hidden="true"` bei `d3af…` **oder** `bf46…`). Vampire Lord: `:3024-3030` (`set hidden="true"` bei `d3af…` **oder** `f37a…`). |

### Warum das Kontingent `4072-c3b8-84c4-a097` und nicht `b1e4-e1cf-9bd6-2438`

Der Auftrag nannte als Bühne das Kontingent „Clan Von Carstein"
`b1e4-e1cf-9bd6-2438`. Dort ist „Army of Sylvania" jedoch **verborgen** (MGR-R9:
das Aufdeck-Gatter verlangt `4072…`), und die Formatspezifikation lässt offen,
ob die **Min**-Grenze eines *sichtbaren* Kindes unter einem *verborgenen*
Eltern-`selectionEntry` noch validiert wird: [§8](../../battlescribe/building-blocks/category-and-visibility.md#8-kategorien--sichtbarkeit)
regelt die Vererbung der Verborgenheit ausdrücklich nur für die
`selectionEntryGroup` („Eine versteckte `selectionEntryGroup` versteckt, was sie
hält"), nicht für einen `selectionEntry`-Elternteil. Die Min-Erwartungen der
Roster 03, 05 und 08 wären dort also **unterbestimmt** — ein Fehlschlag würde
nicht mehr über die Additivität der `<repeats>` aussagen, sondern über eine
Frage, die die erlaubten Quellen nicht beantworten.

Die Hauptroster stehen deshalb im Kontingent **„Army of Sylvania (SoC)"**
`4072-c3b8-84c4-a097` — dem Kontingent, das der Katalog für diesen Eintrag selbst
vorsieht und in dem er unstrittig sichtbar ist. Roster **09** trägt die vom
Auftrag gewünschte Bühne `b1e4-e1cf-9bd6-2438` trotzdem, aber nur mit einer
**Max**-Aussage: Max-Grenzen gelten laut [§8](../../battlescribe/building-blocks/category-and-visibility.md#8-kategorien--sichtbarkeit)
*„unabhängig von der Sichtbarkeit"*, die Aussage ist dort also wohlbestimmt. Über
die Min-Grenze schweigt Roster 09 bewusst (weder `firing` noch `absent`).

### Additiv vs. multiplizierend — die Kreuztabelle

`c` = Zahl der Vampire Counts, `l` = Zahl der Vampire Lords im Kontingent.
Additiv: Grenzen = `2 + c + l`. Multiplizierend: Grenzen = `2 + c · l`.

| Roster | c | l | Marker | additiv (korrekt) | multiplizierend | Unterschied sichtbar? |
|---|---|---|---|---|---|---|
| 01 | 0 | 0 | 2 | Grenzen 2 — still | Grenzen 2 — still | nein (Grundwert) |
| 02 | 0 | 0 | 3 | max feuert 3/**2** | max feuert 3/2 | nein (Grundwert) |
| 03 | 0 | 0 | 1 | min feuert 1/**2** | min feuert 1/2 | nein (Grundwert) |
| 04 | 1 | 0 | 3 | Grenzen 3 — **still** | Grenzen 2 — max feuert 3/2 | **ja** |
| 05 | 1 | 0 | 2 | min **feuert 2/3** | Grenzen 2 — still | **ja** |
| 06 | 1 | 0 | 4 | max feuert 4/**3** | max feuert 4/**2** | **ja** (am `bound`) |
| 07 | 2 | 1 | 5 | Grenzen 5 — **still** | Grenzen 4 — max feuert 5/4 | **ja** |
| 08 | 2 | 1 | 4 | min **feuert 4/5** | Grenzen 4 — still | **ja** |

Roster **05** ist der Kernfall: bei einer multiplizierenden Lesart bliebe die
Grenze bei 2, weil kein Lord da ist — die Mindestpflicht verschwände ganz.
Roster **06** zeigt denselben Unterschied an einer Grenze, die in *beiden*
Lesarten feuert, aber mit **unterschiedlichem `bound`**; Roster **07** trennt
zusätzlich `2 + 2 + 1 = 5` von `2 + 2 · 1 = 4`.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle laufen gegen
**denselben** Datensatz (`.gst` + Vampire Counts `.cat` + Mercenaries `.cat`) und
tragen `<costLimit>` 3000 Punkte. Das `catalogueId`-Attribut einer `<force>` ist
Roster-Beiwerk; welcher Katalog das Kontingent deklariert hat, kommt aus der
Herkunft der Force-**Definition**
(PCS-R5 in [`primary-catalogue-scope`](../primary-catalogue-scope/README.md)).

> **Assertion-Fokus:** nur die Constraint-Ids `5c4a-c8ea-073d-909c`,
> `1b4e-3003-8b78-4be6` und (als Beifang) `a7c9-5fec-592a-3716`. Andere
> Armeeaufbau-Diagnosen dürfen zusätzlich auftreten und sind hier ohne Belang —
> namentlich die General-/Core-Pflichten des Kontingents und die Pflicht-Kinder
> der Vampir-Charaktere (u. a. die Gruppe „Wizard Level" des Vampire Count
> `7ab1-d9dc-6124-443f` mit `min 1` `19ba-de18-6ad7-2825`), die in den bewusst
> minimal gehaltenen Rostern nicht ausgefüllt sind.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | Grundwert: 0 Vampire, genau 2 Marker | Kontingent `4072…`: „Army of Sylvania" + **2** Grave markers. | **MGR-R1:** beide Grenzen stehen auf 2, Ist 2 liegt genau dazwischen — `5c4a-c8ea-073d-909c` und `1b4e-3003-8b78-4be6` **absent**. | [`01-no-vampires-2-markers-legal.ros`](rosters/01-no-vampires-2-markers-legal.ros) |
| 02 | Grundwert-Obergrenze: 0 Vampire, 3 Marker | Wie 01, **3** Marker. | `1b4e-3003-8b78-4be6` feuert **Ist 3 / Grenze 2**; `5c4a…` **absent**. | [`02-no-vampires-3-markers-max-fires.ros`](rosters/02-no-vampires-3-markers-max-fires.ros) |
| 03 | Grundwert-Untergrenze: 0 Vampire, 1 Marker | Wie 01, **1** Marker. | `5c4a-c8ea-073d-909c` feuert **Ist 1 / Grenze 2**; `1b4e…` **absent**. | [`03-no-vampires-1-marker-min-fires.ros`](rosters/03-no-vampires-1-marker-min-fires.ros) |
| 04 | 1 Count, 0 Lords: 3 Marker sind erlaubt | Wie 01 mit **3** Markern, zusätzlich **1 × Vampire Count** `6822…`. | **MGR-R6:** `2 + 1 + 0 = 3` — beide Grenzen **absent**. Multiplizierend läge die Obergrenze bei 2 und schlüge mit Ist 3 / Grenze 2 an. | [`04-one-count-3-markers-legal.ros`](rosters/04-one-count-3-markers-legal.ros) |
| 05 | **Kernfall:** 1 Count, 0 Lords, nur 2 Marker | Wie 04, aber **2** Marker. | `5c4a-c8ea-073d-909c` feuert **Ist 2 / Grenze 3**; `1b4e…` **absent**. Multiplizierend bliebe die Untergrenze bei 2 und schwiege. | [`05-one-count-2-markers-min-fires.ros`](rosters/05-one-count-2-markers-min-fires.ros) |
| 06 | Kernfall über die Obergrenze: 1 Count, 4 Marker | Wie 04, aber **4** Marker. | `1b4e-3003-8b78-4be6` feuert **Ist 4 / Grenze 3**. Multiplizierend feuerte dieselbe Grenze mit Ist 4 / **Grenze 2** — der Unterschied steckt im `bound`. `5c4a…` **absent**. | [`06-one-count-4-markers-max-fires.ros`](rosters/06-one-count-4-markers-max-fires.ros) |
| 07 | 2 Counts + 1 Lord: 5 Marker sind erlaubt | Kontingent `4072…`: „Army of Sylvania" + **5** Marker, **2 × Vampire Count**, **1 × 0-1 Vampire Lord** `b77b…`. | `2 + 2 + 1 = 5` — beide Grenzen **absent**; auch die armeeweite Lord-Grenze `a7c9-5fec-592a-3716` (max 1) bleibt **absent**. Multiplizierend läge die Obergrenze bei 4 (Ist 5 / Grenze 4). | [`07-two-counts-one-lord-5-markers-legal.ros`](rosters/07-two-counts-one-lord-5-markers-legal.ros) |
| 08 | 2 Counts + 1 Lord, nur 4 Marker | Wie 07, aber **4** Marker. | `5c4a-c8ea-073d-909c` feuert **Ist 4 / Grenze 5**; `1b4e…` und `a7c9…` **absent**. Multiplizierend läge die Untergrenze bei 4 und schwiege. | [`08-two-counts-one-lord-4-markers-min-fires.ros`](rosters/08-two-counts-one-lord-4-markers-min-fires.ros) |
| 09 | Andere Bühne: Kontingent „Clan Von Carstein", 3 Marker | Kontingent **`b1e4-e1cf-9bd6-2438`**: „Army of Sylvania" (dort **verborgen**) + **3** Marker, 0 Vampire. | `1b4e-3003-8b78-4be6` feuert **Ist 3 / Grenze 2** — Max-Grenzen gelten unabhängig von der Sichtbarkeit ([§8](../../battlescribe/building-blocks/category-and-visibility.md#8-kategorien--sichtbarkeit)). Über `5c4a…` **keine Aussage** (s. u.). | [`09-von-carstein-force-3-markers-max-fires.ros`](rosters/09-von-carstein-force-3-markers-max-fires.ros) |

### Herleitung der Zahlen

- **`bound`** ist der wirksame `value` der Grenze: Katalogwert **2** (`:10103`,
  `:10104`), erhöht um **1 je Anwendung** der `modifierGroup` (`increment
  value="1"`, `:10109-10110`). Die Zahl der Anwendungen ist die **Summe** der
  beiden `<repeat>`-Beiträge (MGR-R6): `#Vampire Count + #0-1 Vampire Lord` im
  Kontingent, weil beide `<repeat>` `value="1" repeats="1" roundUp="false"`
  tragen (MGR-R5). Daraus: Roster 01–03 und 09 ⇒ `2`; Roster 04–06 ⇒ `3`;
  Roster 07–08 ⇒ `5`.
- **`actual`** ist die Zahl der Grave-marker-Auswahlen unter „Army of Sylvania"
  (`field="selections"`, `scope="parent"`, MGR-R2) und steht als `number` an der
  einen Marker-Auswahl (MGR-R3): 2 / 3 / 1 / 3 / 2 / 4 / 5 / 4 / 3 in den
  Rostern 01…09.
- Wo `actual` zwischen `min` und `max` liegt, ist beides erfüllt und keine der
  Grenzen erscheint im Bericht — die Erwartung lautet dort `absent`, ohne
  `actual`/`bound`.
- **`a7c9-5fec-592a-3716`** (Vampire Lord, `max 1`, `scope="roster"`): die
  Roster 07 und 08 enthalten genau **einen** Lord ⇒ 1 ≤ 1, **absent**.

### Was bewusst **nicht** Teil der Erwartung ist

| Facette | Warum nicht |
|---------|-------------|
| **Sichtbarkeit** — „Army of Sylvania" ist per Basis `hidden="true"` und wird nur im Kontingent `4072…` aufgedeckt (MGR-R9); „Vampire Count"/„0-1 Vampire Lord" sind in anderen Kontingenten verborgen (MGR-R10). | Als **Verfügbarkeit** (`field="hidden"`) modelliert, nicht als zählende Schranke. Der Verletzungsbericht kodiert zählende Grenzen; Sichtbarkeit liest man an der Capability-Projektion ab (gleiche Abgrenzung wie VBL-R4/R5 in [`vampire-bloodlines`](../vampire-bloodlines/README.md)). |
| **Die Min-Grenze `5c4a-c8ea-073d-909c` in Roster 09.** | **Aus den erlaubten Quellen nicht entscheidbar:** dort ist der Eltern-`selectionEntry` „Army of Sylvania" verborgen, und [§8](../../battlescribe/building-blocks/category-and-visibility.md#8-kategorien--sichtbarkeit) regelt die Vererbung der Verborgenheit auf Kinder nur für die `selectionEntryGroup`, nicht für einen `selectionEntry`-Elternteil. Ob die Min-Grenze des sichtbaren Kindes dort noch validiert wird, ist offen — Roster 09 fordert deshalb **weder** ihre Anwesenheit **noch** ihre Abwesenheit. Sollte das Verhalten normativ festgelegt werden, gehört hier eine Erwartung ergänzt. |
| **Die vier Eigengrenzen von „Army of Sylvania"** (`e574-8cdb-9a8a-e48f`, `1f2f-e5cc-d04d-162e`, `9f7d-8853-00c9-4bb1`, `e23f-0cea-11ac-9376`). | Sie sind in allen Rostern durch die eine Träger-Auswahl erfüllt (MGR-R9) und tragen nichts zur geprüften Aussage bei. Als Beleg oben aufgeführt, nicht als Assertion. |
| **Die Pflicht-Kinder der Vampir-Charaktere** (u. a. Gruppe „Wizard Level" `7ab1-d9dc-6124-443f` mit `min 1` `19ba-de18-6ad7-2825`) und die General-/Core-Pflichten des Kontingents. | Beiwerk des Armeeaufbaus. Die Roster sind bewusst minimal: die Vampire stehen nur da, um die `<repeat>`-Zähler zu füttern. Zusätzliche Verletzungen sind ausdrücklich erlaubt. |
| **Der Regeltext `dd10-ed71-f7d1-7bff`** („two Grave markers, plus an additional …"). | Ein `rule`-Text ist Prosa, keine zählende Grenze — er dient hier als In-World-Beleg für die **additive** Lesart, nicht als geprüfte Ausgabe. |
| **Eine `<repeats>`-Liste mit drei oder mehr `<repeat>`** oder mit `value > 1` / `roundUp="true"` in dieser Konstellation. | Im Fixture-Satz an dieser Stelle nicht vorhanden; die Grave-marker-Klammer ist das einzige Vorkommen mehrerer `<repeat>` an einer `<modifierGroup>`. Ein solcher Fall müsste erfunden werden. |

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Spielsystem WHFB 6th definitive | `0d13-7737-ea86-4662` |
| Katalog **Vampire Counts** | `4d73-5ab0-9020-403c` |
| Bibliothek **Mercenaries** (per `catalogueLink` `ef73-f9bd-e250-54d2`) | `fc47-8392-a6c8-452a` |
| `costType` „pts" (`.gst`) | `ecfa-8486-4f6c-c249` |
| ForceEntry „Army of Sylvania (SoC)" (`:29418`) | `4072-c3b8-84c4-a097` |
| ForceEntry „Clan Von Carstein (VC-AB)" (`:29312`) — Bühne von Roster 09 | `b1e4-e1cf-9bd6-2438` |
| SelectionEntry „Army of Sylvania" (`:10079`, `hidden="true"`, aufgedeckt bei `4072…`) | `b48b-4a69-80f1-5d47` |
| — dessen Eigengrenzen max/force, min/force, max/parent, min/parent (`:10085-10088`) | `e574-8cdb-9a8a-e48f` / `1f2f-e5cc-d04d-162e` / `9f7d-8853-00c9-4bb1` / `e23f-0cea-11ac-9376` |
| — dessen `infoLink` auf die Regel „Army of Sylvania" (`:10098` / `:26349`) | `62f0-e869-8ffa-bd9d` → `dd10-ed71-f7d1-7bff` |
| SelectionEntry „Grave markers" (`:10101`, `defaultAmount="2"`) | `f899-4fbd-db93-629e` |
| — **Untergrenze** min 2, `scope="parent"` (`:10103`) | **`5c4a-c8ea-073d-909c`** |
| — **Obergrenze** max 2, `scope="parent"` (`:10104`) | **`1b4e-3003-8b78-4be6`** |
| — die `modifierGroup` mit zwei `increment 1` und zwei `<repeat>` (`:10106-10117`) | (unbenannt) |
| SelectionEntry „Vampire Count" (`:3124`) — Ziel des ersten `<repeat>` | `6822-0110-a7c9-cbb0` |
| — dessen Gruppe „Wizard Level" (min 1 / max 1) | `7ab1-d9dc-6124-443f` — `19ba-de18-6ad7-2825` / `436d-44fa-86cf-bf42` |
| SelectionEntry „0-1 Vampire Lord " (`:2713`) — Ziel des zweiten `<repeat>` | `b77b-88d5-5e80-e178` |
| — dessen armeeweite Obergrenze max 1, `scope="roster"` (`:2715`) | `a7c9-5fec-592a-3716` |
| Kontingente, in denen die Vampire verborgen sind (MGR-R10) | `d3af-1add-4e99-b977` / `bf46-ee85-7c10-ba98` / `f37a-a93e-fa22-61a8` |
