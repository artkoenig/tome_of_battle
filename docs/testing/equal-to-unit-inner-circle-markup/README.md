# E2E-Regeln & Testkatalog: `condition type="equalTo" scope="unit"` mit **Link-`childId`** — der Blazing-Sun-Aufschlag springt von 3 auf 5 Punkte je Ritter

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln,
Constraint-Ids, Punktebeträge und Erwartungswerte sind **ausschließlich aus den
Katalogdaten** der *6th Definitive Edition* und der Formatspezifikation
([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md), §7.2,
§7.5, §7.6, §8 und der
[Kasten `scope="unit"`](../../battlescribe/building-blocks/modifier.md#scopeunit-und-scopeancestor--die-umschließende-einheit-und-die-vorfahrenkette)
in §7.7) abgeleitet. Die Roster-Form folgt den bereits verifizierten Szenarien
(direktes `entryId` bzw. `entryId` + `entryLinkId`, `entryGroupId` für
Gruppenmitglieder — bei einer **verlinkten** geteilten Gruppe die Id der
**Ziel**-Gruppe, wie in
[`parent-repeat-item-count`](../parent-repeat-item-count/README.md) —,
verschachtelte `selections` mit `number`).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armeebuch: `The Empire (6th definitive edition).cat` (`3938-8369-a300-4a03`,
  rev 1) — Kontingent **„Standard (EM-AB)"** `e821-88b8-2071-6b6a`
  (`The Empire (…).cat:15372`)
- Söldner-Bibliothek: `Mercenaries (6th definitive edition).cat`
  (`fc47-8392-a6c8-452a`, `library="true"`) — **nicht** Fundort der geprüften
  Zelle, aber die einzige `catalogueLink`-Abhängigkeit des Armeebuchs
  (`id="7773-ecbb-5fb9-eb56"`) und deshalb Teil des Datensatzes.

> **Abgrenzung zum Schwester-Szenario.**
> [`unit-scope-repeat-knight-markup`](../unit-scope-repeat-knight-markup/README.md)
> pinnt an derselben Einheit den **`repeat`** mit `scope="unit"` und
> Eintrags-`childId` — also die *Häufigkeit* einer Kostenanwendung. Dieses
> Szenario lässt die Wiederholung konstant (immer „einmal je Ritter") und
> variiert stattdessen die **`condition`**, die den Modifikator überhaupt
> zuschaltet: zwei `equalTo`-Bedingungen auf **denselben** `childId`, die sich
> gegenseitig ausschließen und über die Punktesumme unterscheidbar werden.

---

## Worum es geht

Der `entryLink` „Knights of the Blazing Sun" trägt **zwei** Kostenmodifikatoren
auf dieselbe Kostenart, die sich allein durch ihre Bedingung unterscheiden —
wörtlich aus `The Empire (6th definitive edition).cat:12961-12988`:

```xml
<entryLink import="true" name="Knights of the Blazing Sun" hidden="false"
           id="f711-222f-99ff-5e01" type="selectionEntry" targetId="dfad-d77b-9156-e917">
  <modifiers>
    <modifier type="increment" value="3" field="ecfa-8486-4f6c-c249">
      <repeats>
        <repeat value="1" repeats="1" field="selections" scope="unit"
                childId="7b8d-8405-0e74-9f46" shared="true" roundUp="false"
                includeChildSelections="true"/>
      </repeats>
      <conditions>
        <condition type="equalTo" value="0" field="selections" scope="unit"
                   childId="6e1d-9e41-114f-8128" shared="true" includeChildSelections="true"/>
      </conditions>
    </modifier>
    <modifier type="increment" value="5" field="ecfa-8486-4f6c-c249">
      <repeats>… identisch …</repeats>
      <conditions>
        <condition type="equalTo" value="1" field="selections" scope="unit"
                   childId="6e1d-9e41-114f-8128" shared="true" includeChildSelections="true"/>
      </conditions>
    </modifier>
    <modifier type="set" value="true" field="hidden">
      <conditions>
        <condition type="instanceOf" value="1" field="selections" scope="force"
                   childId="6b0d-2c9f-2d46-b330" shared="true" includeChildSelections="true"/>
      </conditions>
    </modifier>
  </modifiers>
  <costs><cost name="pts" typeId="ecfa-8486-4f6c-c249" value="0"/></costs>
</entryLink>
```

Lesart der Attribute:

- **`field="ecfa-8486-4f6c-c249"`** ist die **pts**-Kostenart der `.gst`
  ([§5.3](../../battlescribe/files/game-system.md#53-cost-types-kostenarten)) — beide
  Modifikatoren ändern **Kosten**, keinen Constraint.
- **Basis der Rechnung ist 0 pts:** der `entryLink` setzt ausdrücklich
  `pts 0` und schlägt damit die 3 pts seiner Zieldefinition
  `dfad-d77b-9156-e917` (`.cat:11451-11464`) — Kosten am Link gehen vor
  ([§7.2](../../battlescribe/building-blocks/links.md#72-entry-link-info-link-category-link),
  [§9.3](../../battlescribe/patterns/common-patterns.md#93-kosten-am-link-statt-an-der-definition)).
- **`scope="unit"`** in *beiden* Queries ist der nächste Vorfahre mit
  `type="unit"`, den Träger eingeschlossen
  ([Kasten `scope="unit"`](../../battlescribe/building-blocks/modifier.md#scopeunit-und-scopeancestor--die-umschließende-einheit-und-die-vorfahrenkette)).
  Träger ist die Blazing-Sun-Auswahl (`type="upgrade"`); darüber steht direkt die
  Einheit „Knights of the Knightly Orders" `1d77-9e6e-a6ab-573f`
  (`.cat:1872`, `type="unit"`). Der Rahmen ist damit aufgelöst — kein
  `UNRESOLVED_SCOPE`.
- **`childId="6e1d-9e41-114f-8128"`** der Bedingungen ist die Id des
  **`entryLink`** „Knights of the Inner Circle" unter derselben Einheit
  (`.cat:2061`, Ziel `selectionEntry 2cbd-fee0-a336-0e5d`, `.cat:10519`) — kein
  Typ-Schlüsselwort und keine Kategorie.
- **`childId="7b8d-8405-0e74-9f46"`** der Wiederholung ist der `selectionEntry`
  „Knight" (`.cat:2029`, `type="model"`, 23 pts), der einzige Modell-Eintrag der
  Einheit. `value="1" repeats="1" roundUp="false"` ⇒ `floor(N/1) × 1 = N`
  Anwendungen.

Daraus folgen **zwei Geraden durch den Ursprung** — und welche gilt, entscheidet
allein der Zählwert des `equalTo`:

| Zählwert von `6e1d-…` im unit-Rahmen | greifende Bedingung | Blazing-Sun-Kosten |
|---:|---|---:|
| 0 | `equalTo value="0"` | `0 + 3 N` |
| 1 | `equalTo value="1"` | `0 + 5 N` |
| ≥ 2 | **keine** | `0` (nicht baubar, siehe ETUIC-R6) |

### Wo die Bausteine im Katalog hängen

```
selectionEntry "Knights of the Knightly Orders" (1d77-9e6e-a6ab-573f, type="unit", Core 64bf-…)
 ├ selectionEntry "Knight" (7b8d-8405-0e74-9f46, type="model", 23 pts, min 5 / max -1)
 ├ selectionEntryGroup "Weapons and Armour" (f1bb-0dde-c39a-d0e1)
 │    Shield / Lance / Hand Weapon / Full Plate Armour  je min 1 / max 1, alle 0 pts
 │    "Cavalry hammer " (9a71-…, min 0, hidden)         — nicht gewaehlt
 ├ entryLink "Empire Warhorse" (aaf2-8dbc-b925-fac5, min 1 / max 1, 0 pts)
 ├ entryLink "Knights of the Inner Circle" (6e1d-9e41-114f-8128 -> 2cbd-fee0-a336-0e5d)
 │    increment 3 pts, repeat scope="parent" childId="model"        <- eigener Aufschlag
 │    constraint max 1 scope="parent"   (5454-b1cf-abc3-042a)
 │    Ziel-constraint max 1 scope="force" (abd1-90ab-2b66-ecff)
 ├ entryLink "Knights of the Inner Circle (White Wolf)" (8229-6f9b-ba74-c239 -> 12c2-2826-c92f-4930)
 │    hidden="true"; increment 3 pts, repeat scope="parent" childId="model"
 │    constraint max 1 scope="parent"   (ad1b-51cb-9726-034e)
 │    Ziel-constraint max 1 scope="force" (a3ff-4097-904b-d617)
 └ selectionEntryGroup "Knightly Order" (06b5-8412-53d1-49ac, max 1 self / min 0 parent)
      └ entryLink "Knightly Orders (CJ#43)" (3d6b-e7e1-9c78-28a3)
           -> sharedSelectionEntryGroup d454-fa90-afa7-fa48 (hidden="true", max 1 parent)
                └ entryLink "Knights of the Blazing Sun" (f711-222f-99ff-5e01 -> dfad-…)
                     increment 3 / increment 5, je repeat scope="unit" childId="7b8d-…"
                     conditions equalTo 0 bzw. equalTo 1 auf childId="6e1d-…"
```

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **ETUIC-R1** | **Ohne Inner Circle kostet der Orden 3 pts je Ritter der eigenen Einheit.** Bei N Rittern also 3 N pts; Basis sind 0 pts. | `.cat:12961-12970` → `entryLink` **`f711-222f-99ff-5e01`** → `modifier type="increment" value="3" field="ecfa-8486-4f6c-c249"` mit `condition type="equalTo" value="0" … scope="unit" childId="6e1d-9e41-114f-8128"` und `repeat … scope="unit" childId="7b8d-8405-0e74-9f46"`. Link-Kosten `pts 0` (`.cat:12985-12987`) schlagen die 3 pts der Definition `dfad-…` (`.cat:11455-11459`). Roster 01. |
| **ETUIC-R2** | **Mit genau einem Inner Circle kostet derselbe Orden 5 pts je Ritter.** Der 3-pts-Zweig entfällt dabei vollständig — die beiden Bedingungen schließen sich aus, weil ein Zählwert nicht zugleich 0 und 1 sein kann. | `.cat:12971-12978` → zweiter `modifier type="increment" value="5"` mit `condition type="equalTo" value="1"` auf **demselben** `childId` und **demselben** `repeat`. Roster 02: Summe 155 (nicht 170, wie bei gleichzeitigem Greifen beider Zweige, und nicht 145, wie bei stehengebliebenem 3-pts-Zweig). |
| **ETUIC-R3** | **`equalTo` ist eine Gleichheit, keine Schranke.** Ein Zählwert von 1 lässt die `equalTo 0`-Bedingung fallen, obwohl 1 ≥ 0 ist; ein Zählwert von 0 lässt die `equalTo 1`-Bedingung fallen, obwohl 0 ≤ 1 ist. | Formatspezifikation [§7.7](../../battlescribe/building-blocks/modifier.md#77-modifier-condition-condition-group-repeat), Tabelle der `condition`-Attribute (`type` = Vergleich; `equalTo` steht dort neben `atLeast`/`atMost`, ist also keine von beiden). Beobachtbar im Kontrast Roster 01 (130) ↔ Roster 02 (155): eine „mindestens"-Lesart der `equalTo 0`-Bedingung ergäbe in Roster 02 die Summe 170, eine „höchstens"-Lesart der `equalTo 1`-Bedingung in Roster 01 die Summe 155. |
| **ETUIC-R4** | **`childId` benennt genau *einen* Verweis, nicht „irgendeine Inner-Circle-Aufwertung".** Der Geschwister-`entryLink` „Knights of the Inner Circle (White Wolf)" derselben Einheit erfüllt die Bedingung **nicht** — der 3-pts-Zweig bleibt stehen. | `.cat:2061` (`entryLink id="6e1d-9e41-114f-8128" targetId="2cbd-fee0-a336-0e5d"`) gegen `.cat:2103` (`entryLink id="8229-6f9b-ba74-c239" targetId="12c2-2826-c92f-4930"`). **Beide Lesarten fallen hier zusammen:** die zwei Verweise unterscheiden sich sowohl in ihrer eigenen Id als auch in ihrer Ziel-Id, und `2cbd-…` wird im ganzen Armeebuch nur von `6e1d-…` verlinkt. Ob der Zähler über Verweis- oder Ziel-Id auflöst ([§3.4](../../battlescribe/overview.md#34-kontext-threading)), trennen die Roster daher bewusst **nicht**. Roster 03. |
| **ETUIC-R5** | **Der Zählrahmen ist die umschließende Einheit, nicht das Kontingent.** Steht der Inner Circle in einem **anderen** Ritterregiment desselben Kontingents, bleibt der Zählwert im Rahmen des Ordens 0 und der 3-pts-Zweig gilt. | [Kasten `scope="unit"`](../../battlescribe/building-blocks/modifier.md#scopeunit-und-scopeancestor--die-umschließende-einheit-und-die-vorfahrenkette): „der nächste **Vorfahre** — den Träger der Query eingeschlossen — mit `type="unit"`". Ein Vorfahre ist eine Eigenschaft der **Instanz**, nicht der Definition; `shared="true"` verengt oder weitet einen so bestimmten Rahmen nicht. Roster 05 macht den Unterschied messbar (338 gegen 348). |
| **ETUIC-R6** | **Ein Zählwert ≥ 2 ist im unit-Rahmen nicht baubar** — es gibt also keinen legalen Bauzustand, in dem *keine* der beiden Bedingungen greift und der Orden 0 pts kostet. | Der Verweis `6e1d-…` trägt **`5454-b1cf-abc3-042a`** (`type="max" value="1" field="selections" scope="parent"`, `.cat:2097`), sein Ziel `2cbd-…` zusätzlich **`abd1-90ab-2b66-ecff`** (`type="max" value="1" field="selections" scope="force"`, `.cat:10521`). Die force-Grenze lässt sich per `increment 1` je 2 „Wealthy (Knights)" bzw. je 2 Reiksguard mit Karl Franz heben (`.cat:2073-2094`), die **parent**-Grenze dagegen **nicht** — kein Modifikator im Armeebuch adressiert `5454-b1cf-abc3-042a`. Je Einheit bleibt also höchstens ein Inner Circle, und der `scope="unit"`-Zähler kann 2 nie legal erreichen. **Deshalb gibt es für diesen Fall bewusst kein Roster.** |
| **ETUIC-R7** | **Der Inner Circle bringt einen eigenen, von den `equalTo`-Zweigen unabhängigen Aufschlag von 3 pts je Modell mit.** Er hängt am Verweis, nicht am Orden, und gilt daher auch ohne jeden Knightly Order. | `.cat:2062-2067` → `modifier type="increment" field="ecfa-8486-4f6c-c249" value="3"` mit `repeat field="selections" scope="parent" childId="model" value="1" repeats="1" includeChildSelections="false"`. Der `parent`-Rahmen ist die Einheit; „Knight" ist ihr einziger direkter Eintrag mit `type="model"`. Basis 0 pts (`.cat:10523-10527`; der Verweis trägt keinen `<costs>`-Block). Roster 04 isoliert genau diesen Betrag. |
| **ETUIC-R8** | **Der Geschwister-Verweis trägt denselben Eigenaufschlag** (3 pts je Modell, `scope="parent"`), sodass Roster 03 sich von Roster 02 **nur** im Blazing-Sun-Zweig unterscheidet: 145 gegen 155, Differenz genau `5 × (5 − 3)`. | `.cat:2105-2109` (identischer `increment 3` + `repeat scope="parent" childId="model"`); Basis 0 pts (`.cat:11985-11989`). |
| **ETUIC-R9** | **Die Ritterzahl ist nach unten auf 5 gebunden und nach oben unbegrenzt.** 5 und 8 Ritter sind daher beide legal. | `selectionEntry "Knight"` `7b8d-…` → **`24bb-871e-6aa3-e4b5`** (`min 5 scope="parent" shared="false"`) und **`9941-5a64-0bde-add3`** (`max -1 scope="parent"`). `-1` = unbegrenzt, solange kein `set` greift ([§7.6](../../battlescribe/building-blocks/constraint.md#76-constraint), Sentinel-Kasten; der einzige `set 25` hängt an „Border Patrols rules" `4e15-0353-165f-5528`, die in keinem Roster steht). |
| **ETUIC-R10** | **Die Pflichtausrüstung der Einheit ist Shield, Lance, Hand Weapon, Full Plate Armour und Empire Warhorse (je `min 1`/`max 1`), alle 0 pts;** die „Cavalry hammer "-Option ist `min 0` und bleibt außen vor. Deshalb trägt jedes Regiment genau diese fünf Auswahlen — die Summe besteht außer den Aufschlägen nur aus Ritterkosten. | Gruppe „Weapons and Armour" `f1bb-0dde-c39a-d0e1` (`.cat:2282-2390`) → Links `9ccc-ad24-583e-41e0` (min `1e3a-4402-70e8-2b08`), `e082-13b2-e746-34e0` (min `f0ce-7b2e-0be1-9dd1`), `d2a3-c146-1dbb-118f` (min `50ac-f86f-cfa1-d050`), `8757-aa59-69fa-1060` (min `8d09-7d84-af64-cb83`), `9a71-cb61-06fb-005a` (min `f78b-9ad2-c515-7c0a` = 0, `hidden="true"`); dazu `entryLink` „Empire Warhorse" `aaf2-8dbc-b925-fac5` (min `22cd-67c5-1c2c-2266`). pts-Werte: `.gst` `50e2-…`/`8649-…`/`abdb-…` je 0, `The Empire` `199f-b4b9-aaca-490f`/`a1e3-7f97-5fc6-abaa` je 0. |
| **ETUIC-R11** | **Die force-skopierte Obergrenze der Einheit ist im Standard-Kontingent aufgehoben und darf nicht feuern.** Roh steht `max 0`; ein `set -1` hebt sie für **jedes** Kontingent auf, das **nicht** „Emperor's Guard (EM-AB)" ist. | `selectionEntry 1d77-…` → constraint **`2943-aa1c-4532-4fb2`** (`type="max" value="0" field="selections" scope="force"`, `.cat:2393`) → `modifier type="set" value="-1"` mit `condition type="notInstanceOf" scope="force" childId="9d76-5d25-ce1d-1d12"` (`.cat:2130-2134`). Die Roster nutzen „Standard (EM-AB)" `e821-88b8-2071-6b6a` ≠ `9d76-…`. Auch der `set 1` derselben Grenze ist an „Army of Middenland (SoC)" `6b0d-2c9f-2d46-b330` gebunden und greift nicht. |
| **ETUIC-R12** | **Die Orden-Gruppe ist roh verborgen und wird erst durch den Schalter „Allow experimental rules from White-Dwarf and Citadel Journal issues" aufgedeckt.** Deshalb trägt jedes Roster diesen Schalter (0 pts) unter „Allow experimental rules?" (0 pts). | `sharedSelectionEntryGroup "Knightly Orders (CJ#43)"` `d454-fa90-afa7-fa48` (`hidden="true"`, `.cat:12956`) → `modifier type="set" value="false" field="hidden"` mit `condition atLeast 1 selections scope="force" childId="cc03-e8fe-c143-6863" includeChildSelections="true"` (`.cat:13317-13323`). `cc03-…` ist ein Kind des `.gst`-Schalters `8b76-92c4-23f9-54b1` (`.gst:1836-1878`), in The Empire per `entryLink` `2961-128d-196e-c6c6` wählbar; beide ohne pts-Kosten. Derselbe Link trägt `min 0` **`30c1-0e8a-ca51-3eee`**, das per `set 1` zur Pflicht wird, sobald `3d6b-e7e1-9c78-28a3` im Kontingent steht (`.cat:15834`) — der Schalter ist also ohnehin Pflicht, sobald der CJ-Orden gewählt ist. |
| **ETUIC-R13** | **Das `hidden`-Gatter des Blazing-Sun-Verweises bleibt geschlossen.** Es greift nur im Kontingent „Army of Middenland (SoC)". | `.cat:12979-12983` → `modifier type="set" value="true" field="hidden"` mit `condition type="instanceOf" scope="force" childId="6b0d-2c9f-2d46-b330"`; `6b0d-…` ist der `forceEntry` „Army of Middenland (SoC)" (`.cat:15507`), die Roster nutzen `e821-88b8-2071-6b6a`. Kanonische `forceEntry`-Kodierung, [§7.7](../../battlescribe/building-blocks/modifier.md#77-modifier-condition-condition-group-repeat). |
| **ETUIC-R14** | **Beobachtbar wird die Summe über die roster-weite Budget-Regel.** Eine Kostenart hat kein eigenes Feld in der Slot-Projektion; die verplante Gesamtsumme steht dagegen im `actual` der Budget-Verletzung `budget::ecfa-8486-4f6c-c249`, die bei **strikter** Überschreitung des eingestellten `<costLimits>`-Wertes feuert. | Belegt an den bestehenden Szenarien [`orcs-and-goblins-budget`](../orcs-and-goblins-budget/README.md) (Roster 04: Ist 150 / Grenze 100; Roster 05: Summe = Limit → still) sowie [`unit-scope-repeat-knight-markup`](../unit-scope-repeat-knight-markup/README.md). Das Punktelimit steht hier je Roster **eine Einheit unter** der korrekten Summe, damit `actual` die Summe exakt trägt. |

---

## Die Punkte-Arithmetik je Roster

Alle Kostenzeilen stammen aus den oben belegten Elementen. Einträge **ohne**
`<costs>`-Block zählen 0; die Einheit `1d77-…` trägt ausdrücklich `pts 0`.

| Auswahl | Quelle der pts-Kosten | 01 | 02 | 03 | 04 | 05 A | 05 B |
|---------|------------------------|---:|---:|---:|---:|-----:|-----:|
| Schalter „Allow experimental rules?" `8b76-…` (+ `cc03-…`) | `.gst`, `value="0"` | 0 | 0 | 0 | 0 | 0 | 0 |
| Einheit „Knights of the Knightly Orders" `1d77-…` | Eintrag, `value="0"` | 0 | 0 | 0 | 0 | 0 | 0 |
| Modell „Knight" `7b8d-…` | Eintrag, `value="23"` × `number` | 115 | 115 | 115 | 115 | 115 | 184 |
| Shield / Lance / Hand Weapon / Full Plate / Warhorse | Ziele, je `value="0"` | 0 | 0 | 0 | 0 | 0 | 0 |
| **Inner Circle** `6e1d-…` | Basis 0 + N × `increment 3` (parent/model) | — | **15** | — | **15** | — | **24** |
| **Inner Circle (White Wolf)** `8229-…` | Basis 0 + N × `increment 3` (parent/model) | — | — | **15** | — | — | — |
| **Knights of the Blazing Sun** `f711-…` | Basis 0 + N × `increment 3` **oder** `increment 5` | **15** | **25** | **15** | — | **15** | — |
| **Summe** | | **130** | **155** | **145** | **130** | **130** | **208** |

Roster 05 addiert seine beiden Regimenter zu **338**.

### Warum die `actual`-Zusage beidseitig scharf ist

Die Budget-Grenze feuert bei **strikter** Überschreitung, und ihr `actual` ist
die verplante Gesamtsumme (ETUIC-R14). Das Limit steht je Roster genau eine
Einheit darunter. Damit fällt jede Fehlrechnung auf — korrekt sind
**130 / 155 / 145 / 338** für die Roster 01 / 02 / 03 / 05:

| Fehlrechnung der Engine | Summe 01 / 02 / 03 / 05 | Ergebnis |
|-------------------------|------------------------:|----------|
| `equalTo 0` als „mindestens 0" gelesen (der 3-pts-Zweig bleibt bei Zählwert 1 stehen) | 130 / **170** / 145 / 338 | Roster 02 weicht ab → Fall bricht |
| `equalTo 1` hält auch bei Zählwert 0 (zusätzlich zum 3-pts-Zweig) | **155** / 155 / **170** / **363** | Roster 01/03/05 weichen ab → Fall bricht |
| `childId` als „irgendeine Inner-Circle-Aufwertung" gelesen | 130 / 155 / **155** / 338 | Roster 03 weicht ab → Fall bricht |
| Zählrahmen = Kontingent statt Einheit | 130 / 155 / 145 / **348** | Roster 05 weicht ab → Fall bricht |
| Beide Bedingungen scheitern (Rahmen unaufgelöst, `equalTo` unbekannt) | **115** / **130** / **130** / **323** | Budget bleibt still bzw. `actual` weicht ab → Fall bricht |
| Wiederholung genau einmal angewandt statt je Ritter | **118** / **123** / **121** / **305** | Budget bleibt still → Fall bricht |
| Link-Kosten des Ordens ignoriert (Definition `pts 3`) | **133** / **158** / **148** / **341** | `actual` weicht ab → Fall bricht |
| Eigenaufschlag des Inner Circle übersehen (Roster 04 dann 115 statt 130) | 130 / **140** / **130** / **314** | Roster 02/03/04/05 weichen ab → Fall bricht |
| `set -1` auf `2943-…` übersehen | — | `2943-aa1c-4532-4fb2` feuert → `absent` verletzt |

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle laufen
gegen **denselben** Datensatz (`.gst` + The-Empire-`.cat` + Mercenaries-`.cat`)
und dasselbe Kontingent „Standard (EM-AB)". Regimentsgröße, Pflichtausrüstung
und Schalter sind in den Rostern 01–04 identisch; variiert wird **nur**, welche
Inner-Circle-Aufwertung gewählt ist bzw. ob der Orden dabei ist.

> **Assertion-Fokus:** die Budget-Grenze `budget::ecfa-8486-4f6c-c249` mit
> **exaktem `actual`**, die Abwesenheit der berührten Katalog-Grenzen
> (insbesondere der per `set -1` aufgehobenen Einheiten-Obergrenze
> `2943-aa1c-4532-4fb2` und der beiden Inner-Circle-Obergrenzen), die
> Slot-Stände, die die Herleitung tragen (Ritterzahl, Inner-Circle-Stand,
> Orden-Stand), und je Roster die Abwesenheit von `UNSUPPORTED_REPEAT` sowie
> von `UNRESOLVED_SCOPE` mit `scope="unit"`. Andere Armeeaufbau-Diagnosen
> (General-/Core-Pflicht der `.gst`, Kategorie-Slots) dürfen zusätzlich
> auftreten und sind hier ohne Belang.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators | Fixture |
|---|-----------|----------------|------------------------------------|---------|
| 01 | **`equalTo 0`-Zweig:** Orden ohne Inner Circle | 5 Ritter, Pflichtausrüstung, Schalter, Orden „Knights of the Blazing Sun"; Limit **129**. | `budget::ecfa-8486-4f6c-c249` feuert **Ist 130 / Grenze 129** (ETUIC-R1). Ritter-Slot: Ist 5, min 5, kein Maximum; Blazing-Sun-Slot: Ist 1, nicht verborgen. Keine der gelisteten Katalog-Grenzen feuert. | [`01-blazing-sun-no-inner-circle-3pts.ros`](rosters/01-blazing-sun-no-inner-circle-3pts.ros) |
| 02 | **`equalTo 1`-Zweig:** Orden **plus** Inner Circle | Wie 01, zusätzlich „Knights of the Inner Circle" (`6e1d-…`); Limit **154**. | Budget feuert **Ist 155 / Grenze 154** (ETUIC-R2/R3): 115 Ritter + 15 Inner Circle + **25** Orden. Der 3-pts-Zweig ist vollständig weg. Inner-Circle-Slot: Ist 1, nicht verborgen; `5454-…` und `abd1-…` bleiben still. | [`02-blazing-sun-with-inner-circle-5pts.ros`](rosters/02-blazing-sun-with-inner-circle-5pts.ros) |
| 03 | **Geschwister-Beweis:** Orden plus Inner Circle **(White Wolf)** | Wie 02, aber der Verweis `8229-…` (Ziel `12c2-…`) statt `6e1d-…`; Limit **144**. | Budget feuert **Ist 145 / Grenze 144** (ETUIC-R4/R8): der Zähler bleibt 0, der Orden kostet weiter 3 pts je Ritter. Der Geschwister-Slot ist **verborgen** (`isHidden: true`), trägt seinen Eigenaufschlag aber bei. Griffe die `equalTo 1`-Bedingung, wären es 155. | [`03-blazing-sun-with-white-wolf-sibling-3pts.ros`](rosters/03-blazing-sun-with-white-wolf-sibling-3pts.ros) |
| 04 | **Kontrolle:** Inner Circle **ohne** Orden | 5 Ritter, Pflichtausrüstung, Schalter, „Knights of the Inner Circle", **kein** Knightly Order; Limit **129**. | Budget feuert **Ist 130 / Grenze 129** (ETUIC-R7): ohne den Blazing-Sun-Verweis existieren beide `equalTo`-Modifikatoren nicht, übrig bleibt der Eigenaufschlag von 15. Damit zerfällt die Differenz 01 → 02 (25 pts) sauber in 15 pts Inner Circle und 10 pts Zweigwechsel. | [`04-inner-circle-without-blazing-sun-control.ros`](rosters/04-inner-circle-without-blazing-sun-control.ros) |
| 05 | **Rahmen-Beweis:** zwei Regimenter | Regiment A: 5 Ritter **mit** Orden, ohne Inner Circle. Regiment B: 8 Ritter **mit** Inner Circle, ohne Orden; Limit **337**. | Budget feuert **Ist 338 / Grenze 337** (ETUIC-R5): der `equalTo`-Zähler sieht nur die eigene Einheit, also gilt für A der 3-pts-Zweig (130) und B kostet 208. Ein kontingentweiter Zählrahmen ergäbe 348. `abd1-…` (max 1 je Kontingent) bleibt mit einem Exemplar still. | [`05-two-regiments-inner-circle-in-other-unit.ros`](rosters/05-two-regiments-inner-circle-in-other-unit.ros) |

### Was bewusst **nicht** als feuernde Grenze erwartet wird

| Facette | Warum nicht im Bericht |
|---------|------------------------|
| **Der Kostenaufschlag selbst.** Eine Kostenart hat kein eigenes Feld in der Slot-Projektion (`expect.capabilities` kennt Stände und Grenzen, keine Kosten). | Deshalb wird er **indirekt** über die roster-weite Budget-Regel `budget::ecfa-8486-4f6c-c249` beobachtet (ETUIC-R14). `budget::…` ist **kein** Katalog-Constraint, sondern die Engine-eigene Regel aus dem `<costLimits>`-Block des Rosters. |
| **Der Fall „Zählwert ≥ 2", in dem keine der beiden Bedingungen greift.** | Er ist im `scope="unit"`-Rahmen **nicht baubar** (ETUIC-R6): `5454-b1cf-abc3-042a` (`max 1 scope="parent"` am Verweis) ist durch keinen Modifikator des Armeebuchs anhebbar. Statt ein absichtlich regelwidriges Roster zu erfinden, hält dieses README den Befund fest — die Zelle „keine Bedingung greift" ist an dieser Katalogstelle unerreichbar. |
| **Sichtbarkeit.** Die Ordensgruppe `d454-…` ist `hidden="true"` und wird per Schalter aufgedeckt (ETUIC-R12); der Geschwister-Verweis `8229-…` ist `hidden="true"` und wird nur bei gewähltem Orden „Knights of the White Wolf" `9f9b-5a33-9c07-93e6` aufgedeckt; `6e1d-…` wird umgekehrt in diesem Fall verborgen. | Als **Verfügbarkeit** (`field="hidden"`) modelliert, nicht als zählende Schranke — der Verletzungsbericht kodiert zählende Grenzen (gleiche Abgrenzung wie in [`vampire-bloodlines`](../vampire-bloodlines/README.md), VBL-R4/R5). Roster 03 behauptet über die Sichtbarkeit nur den Slot-Stand `isHidden: true`; dass eine **gewählte**, verborgene Auswahl ihre Kosten dennoch einbringt, ist die Lesart der Formatspezifikation ([§8](../../battlescribe/building-blocks/category-and-visibility.md#8-kategorien--sichtbarkeit) nennt als Wirkung von `hidden` ausschließlich das Nicht-Anbieten und das Aussetzen von **Mindest**-Grenzen; Kosten kommen dort nicht vor). |
| **Namens- und Profil-Modifikatoren** der Einheit (`set … field="name"` je Orden, `increment 1` auf `b690-4bc0-bb73-267b` = S am „First Knight", sobald ein Inner Circle in der Einheit steht). | Profilwerte und Namen stehen nicht im Verletzungsbericht. Der „First Knight" ist in keinem Roster gewählt. |
| **Laufzeit-Kategoriewechsel** der Einheit (`add`/`remove`/`set-primary category` in mehreren `modifierGroup`s ab `.cat:2395`). | Alle diese Klammern sind an andere Kontingente bzw. an nicht gewählte Sonderauswahlen gebunden und greifen unter „Standard (EM-AB)" nicht; Kategorie-Slots gehören ohnehin zum Nebengeräusch, über das die Erwartung nichts sagt. |
| **Autor-Meldung** am Constraint `2943-aa1c-4532-4fb2` („You must have at least one unit of Reiksguard for every unit of other Knights…"). | Sie hängt am `message`-Attribut **dieser** Grenze; da die Grenze per `set -1` aufgehoben ist, wird hier weder ihr Erscheinen noch ihr Ausbleiben behauptet. |
| **Kategorie-Slots und Armeeaufbau** (General-Pflicht der `.gst`, Core-Kontingent). | Nebengeräusch: in allen fünf Rostern gleichartig und für den Kontrast belanglos; die Erwartung ist selektiv. |

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Spielsystem WHFB 6th definitive | `0d13-7737-ea86-4662` |
| Katalog **The Empire** / **Mercenaries** | `3938-8369-a300-4a03` / `fc47-8392-a6c8-452a` |
| `catalogueLink` The Empire → Mercenaries | `7773-ecbb-5fb9-eb56` |
| ForceEntry „Standard (EM-AB)" (benutzt) | `e821-88b8-2071-6b6a` |
| ForceEntry „Emperor's Guard (EM-AB)" (Bedingung des `set -1`, **nicht** benutzt) | `9d76-5d25-ce1d-1d12` |
| ForceEntry „Army of Middenland (SoC)" (`hidden`-Gatter des Ordens, **nicht** benutzt) | `6b0d-2c9f-2d46-b330` |
| pts-Kostenart (`.gst`) | `ecfa-8486-4f6c-c249` |
| Budget-Grenze (Engine-Regel, roster-weit) | `budget::ecfa-8486-4f6c-c249` |
| SelectionEntry Einheit „Knights of the Knightly Orders" (Core `64bf-efb4-9978-26df`, 0 pts) | `1d77-9e6e-a6ab-573f` — constraint `2943-aa1c-4532-4fb2` (`max 0 scope="force"` → per `set -1` aufgehoben) |
| SelectionEntry Modell „Knight" (23 pts) | `7b8d-8405-0e74-9f46` — constraints `24bb-871e-6aa3-e4b5` (`min 5`), `9941-5a64-0bde-add3` (`max -1`) |
| Gruppe „Weapons and Armour" | `f1bb-0dde-c39a-d0e1` |
| `entryLinks` Shield / Lance / Hand Weapon / Full Plate Armour (je `min 1`/`max 1`, alle 0 pts) | `9ccc-ad24-583e-41e0`→`50e2-1873-a856-03e7` (`1e3a-4402-70e8-2b08`), `e082-13b2-e746-34e0`→`8649-8ac8-5a6f-fd8d` (`f0ce-7b2e-0be1-9dd1`), `d2a3-c146-1dbb-118f`→`abdb-bbd0-41b2-5dff` (`50ac-f86f-cfa1-d050`), `8757-aa59-69fa-1060`→`199f-b4b9-aaca-490f` (`8d09-7d84-af64-cb83`) |
| `entryLink` „Cavalry hammer " (`min 0`, `hidden="true"`; nicht gewählt) | `9a71-cb61-06fb-005a` — constraint `f78b-9ad2-c515-7c0a` |
| `entryLink` „Empire Warhorse" (`min 1`/`max 1`, 0 pts) → Ziel | `aaf2-8dbc-b925-fac5` (`22cd-67c5-1c2c-2266`) → `a1e3-7f97-5fc6-abaa` |
| Gruppe „Knightly Order" | `06b5-8412-53d1-49ac` — constraints `7944-27db-49ec-7bbd` (`max 1 scope="self"`), `21ca-c541-0b3d-6d4d` (`min 0 scope="parent"`) |
| `entryLink` „Knightly Orders (CJ#43)" → geteilte Gruppe (`hidden="true"`, `max 1 scope="parent"`) | `3d6b-e7e1-9c78-28a3` → `d454-fa90-afa7-fa48` — constraint `a51e-d04a-de5d-664f` |
| **`entryLink` „Knights of the Blazing Sun" (Träger beider `equalTo`-Modifikatoren, Link-Kosten `pts 0`)** | **`f711-222f-99ff-5e01`** → Ziel `dfad-d77b-9156-e917` (Definition `pts 3`) — constraint `3d1f-8999-a10e-80c7` (`max 1 scope="parent"`) |
| **`entryLink` „Knights of the Inner Circle" (das gezählte `childId`)** | **`6e1d-9e41-114f-8128`** → Ziel `2cbd-fee0-a336-0e5d` — constraints `5454-b1cf-abc3-042a` (`max 1 scope="parent"`), `abd1-90ab-2b66-ecff` (`max 1 scope="force"`, am Ziel) |
| `entryLink` „Knights of the Inner Circle (White Wolf)" (Geschwister, `hidden="true"`) | `8229-6f9b-ba74-c239` → Ziel `12c2-2826-c92f-4930` — constraints `ad1b-51cb-9726-034e` (`max 1 scope="parent"`), `a3ff-4097-904b-d617` (`max 1 scope="force"`, am Ziel) |
| „Knights of the White Wolf" (Aufdeck-Bedingung von `8229-…`; in **keinem** Roster gewählt) | `9f9b-5a33-9c07-93e6` |
| Schalter „Allow experimental rules?" (`.gst`, 0 pts) → `entryLink` in The Empire | `8b76-92c4-23f9-54b1` → `2961-128d-196e-c6c6` — constraint `30c1-0e8a-ca51-3eee` (`min 0` → per `set 1` Pflicht, sobald `3d6b-…` gewählt ist) |
| Unterpunkt „…from White-Dwarf and Citadel Journal issues" (`.gst`, deckt `d454-…` auf) | `cc03-e8fe-c143-6863` |
| „Border Patrols rules" (`set 25` auf die Ritter-Obergrenze; in **keinem** Roster enthalten) | `4e15-0353-165f-5528` |

*(`budget::ecfa-8486-4f6c-c249` sowie die Diagnose-Arten `UNSUPPORTED_REPEAT`
und `UNRESOLVED_SCOPE` sind keine Katalog-Bausteine, sondern Schlüssel des
Manifest-Vertrags — vgl. [`orcs-and-goblins-budget`](../orcs-and-goblins-budget/README.md)
und [`unit-scope-repeat-knight-markup`](../unit-scope-repeat-knight-markup/README.md).
Die `absent`-Aussage über `UNRESOLVED_SCOPE` gilt berichtsweit für
`scope="unit"`, nicht nur für die hier geprüften Bedingungen — sie folgt der
Konvention der Schwester-Szenarien.)*
