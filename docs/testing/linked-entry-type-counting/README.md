# E2E-Regeln & Testkatalog: Ein verlinkter Eintrag zählt unter seinem geerbten `type`

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln, IDs und
Erwartungswerte sind **ausschliesslich aus den Katalogdaten** der *6th Definitive
Edition*, aus [`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md)
und aus [ADR 0011](../../adr/0011-roster-referenzmodell-und-serialisierungs-adapter.md)
**abgeleitet**.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1) — hier liegt der Wurzeleintrag
  **„Border Patrols rules"** `4e15-0353-165f-5528` mit der zählenden Bedingung.
- Armee-Katalog: `Ogre Kingdoms (6th definitive edition).cat`
  (`731d-5b13-2a92-5427`, rev 2) — Kontingent **„Standard (OK-AB)"**
  `729f-9246-5cd3-5044`. Er trägt sowohl **eigene Wurzel-Einheiten** (direkt
  gesetzt) als auch **Wurzel-`entryLink`s** auf Fremd-Einheiten (über einen
  Verweis bezogen) — beides in einem Kontingent.
- Bibliothek: `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`,
  `library="true"`), eingebunden per `catalogueLink a067-78d5-50a2-affe`. Hier
  liegt die Einheit, die Ogre Kingdoms per Verweis bezieht.

---

## Worum es geht

Ein `selectionEntry` trägt ein eigenes, rohes **`type`-Attribut** mit den Werten
`unit` | `model` | `upgrade` ([§7.1](../../battlescribe-data-format.md#71-selection-entry--selection-entry-group)).
Genau dieses Attribut liest eine Query, deren `childId` ein **Typ-Schlüsselwort**
ist (`model`, `unit`, `upgrade` — [§7.7](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat),
Tabelle `condition`-Attribute).

Ein `entryLink` hat **kein** solches Attribut. Sein `type`-Attribut bedeutet
etwas völlig anderes: es benennt die **Art des Ziels** (`selectionEntry` oder
`selectionEntryGroup`, [§7.2](../../battlescribe-data-format.md#72-entry-link-info-link-category-link)).
Eine über einen Verweis bezogene Auswahl kann ihren Zähl-Typ deshalb **nur von
ihrem Ziel erben** — sonst wäre er für sie überhaupt nicht definiert. ADR 0011 §4
bestätigt die Richtung unabhängig: das `type`-Feld einer `.ros`-Auswahl ist ein
**denormalisiertes, aus dem Katalog abgeleitetes** Feld, kein eigenständiger Wert.

Daraus folgt die Regel, die dieses Szenario festnagelt: **dieselbe Einheit muss
gleich zählen, egal ob sie direkt im Kontingent steht oder über einen `entryLink`
hereinkommt.**

### Wie ein Roster „über einen Verweis bezogen" ausdrückt

Eine so bezogene Auswahl trägt **zwei** Ids: `entryId` die Id des **Ziels**,
`entryLinkId` die Id des **Verweises**, über den sie hereinkam. Ein direkt
gesetztes Vorkommen trägt nur `entryId` (`entryLinkId` leer oder fehlend — beides
bedeutet dasselbe). Ohne `entryLinkId` ist „über einen Verweis bezogen" in der
Datei nicht ausgedrückt, und der Fall wäre nicht geprüft.

```
force „Standard (OK-AB)" 729f-9246-5cd3-5044
├─ selection entryId=81b9-e978-56c2-e942 entryLinkId=""                  ← DIREKT   (OK-Wurzeleintrag „Gorger", type="unit")
│    └─ selection entryId=ece1-a86f-38f9-304e entryLinkId=7908-…-d650    ← Verweis  (geteiltes Modell „Gorger", type="model")
└─ selection entryId=7db1-21db-c287-f50d entryLinkId=42d8-7559-6542-15fc ← VERWEIS  (Mercenaries-Einheit „Ogres", type="unit")
     └─ selection entryId=ff8f-ce5a-d663-f9b4 entryLinkId=""             ← direkt   (Modell „Ogre", type="model")
```

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **LTC-R1** | Eine Query mit einem **Typ-Schlüsselwort** als `childId` zählt Auswahlen nach dem rohen `type`-Attribut ihrer Katalog-Definition. | `.gst` Z. 17605–17606: `condition … field="selections" scope="force" childId="unit" childName="unit"` — `childName` benennt das Schlüsselwort im Klartext, es ist keine Ziel-Id. Format-Dokument §7.7 führt `model`/`unit`/`upgrade` als zulässige `childId`-Werte, §7.1 als zulässige `type`-Werte. |
| **LTC-R2** | Der Zähl-Typ einer **über einen `entryLink` bezogenen** Auswahl ist der `type` ihres **Ziels**. Der Verweis selbst trägt keinen Zähl-Typ; sein `type`-Attribut ist `selectionEntry`. | `Ogre Kingdoms…cat` Z. 3343: `entryLink id="42d8-7559-6542-15fc" type="selectionEntry" targetId="7db1-21db-c287-f50d"` — der Verweis nennt nur die Ziel-Art. Das Ziel `Mercenaries…cat` Z. 7350: `selectionEntry type="unit" … id="7db1-21db-c287-f50d"`. Ebenso `Ogre Kingdoms…cat` Z. 998: `entryLink 7908-07bf-ccc6-d650 → ece1-a86f-38f9-304e`, dessen Ziel dort in Z. 2195 `type="model"` trägt. ADR 0011 §4: das `.ros`-`type`-Feld ist abgeleitet, nicht autoritativ. |
| **LTC-R3** | Die Autor-Meldung **„The army must consist of at least TWO units but no more than FOUR units"** am Slot „Border Patrols rules" feuert **genau dann**, wenn das Kontingent **weniger als 2** oder **mehr als 4** direkte Auswahlen vom rohen Typ `unit` enthält. | `.gst` Z. 17600–17610: `modifier type="add" field="error" value="The army must consist of at least TWO units but no more than FOUR units"` am `selectionEntry "Border Patrols rules"` `4e15-0353-165f-5528`; `conditionGroup type="or"` mit `greaterThan 4` **oder** `lessThan 2`, beide `field="selections" scope="force" childId="unit" includeChildSelections="false"`. Format-Dokument §7.7: `field="error"` + `type="add"` ist eine Klartext-Meldung an den Spieler mit Schweregrad *Fehler*. |
| **LTC-R4** | Gezählt werden **nur direkte Kinder des Kontingents** (`includeChildSelections="false"`) und **nur** solche vom Typ `unit`. Der Regelschalter selbst (`type="upgrade"`) und die Modelle **innerhalb** der Einheiten (`type="model"`) zählen **nicht** mit. | Dieselben Bedingungen (Z. 17605–17606). `.gst` Z. 17584: `selectionEntry type="upgrade" … "Border Patrols rules"`. `Ogre Kingdoms…cat` Z. 2195 / `Mercenaries…cat` Z. 7359: die Modelle tragen `type="model"`. |
| **LTC-R5** | Der Slot „Border Patrols rules" ist per Basis `hidden="true"` und wird nur bei einem Punktelimit von **genau 500** eingeblendet. Das betrifft die **Verfügbarkeit**, nicht das Feuern der Meldung. | `.gst` Z. 17584 (`hidden="true"`) und Z. 17595–17599: `modifier type="set" value="false" field="hidden"` mit `condition type="equalTo" value="500" field="limit::ecfa-8486-4f6c-c249" scope="roster"`. Alle Roster setzen deshalb `costLimit` = 500. |
| **LTC-R6** | Die Pflichtgrenzen der eingesetzten Einheiten sind in allen Rostern **erfüllt** und dürfen deshalb **nicht** feuern: „Gorger"-Modell `min 1` je Elternauswahl, „Ogre"-Modell `min 3` je Elternauswahl, „Hand Weapon" `min 1` je Elternauswahl. | `Ogre Kingdoms…cat` Z. 2203: `constraint type="min" value="1" field="selections" scope="parent" id="e998-b2d3-1333-a37d"` (an der **Definition** des geteilten Modells). `Mercenaries…cat` Z. 7361: `min 3 … id="0dad-7f3c-00e8-e07e"` (Definition). `Mercenaries…cat` Z. 7463–7464: `min 1 … scope="parent" id="dfd9-3e46-eda5-be8b"` am **`entryLink b581-8a9e-9d0c-b7c8`**. |

### LTC-R3/R4 im Detail — die Zählung je Roster

`scope="force"` verankert die Zählung im Kontingent; `includeChildSelections="false"`
beschränkt sie auf dessen **direkte** Auswahlen. Gezählt wird nach dem rohen
`type` (LTC-R1/R2):

| Roster | direkte Kontingent-Auswahlen | davon `type="unit"` | `lessThan 2` | `greaterThan 4` | Meldung |
|--------|------------------------------|---------------------|--------------|-----------------|---------|
| 01 | BP-Regeln (`upgrade`) + 2× Gorger (`unit`, **direkt**) | **2** | nein | nein | **stumm** |
| 02 | BP-Regeln (`upgrade`) + 2× Ogres (`unit`, **Verweis**) | **2** | nein | nein | **stumm** |
| 03 | BP-Regeln (`upgrade`) + 1× Gorger (`unit`, **direkt**) | **1** | **ja** | nein | **feuert** (1×, `error`) |
| 04 | BP-Regeln (`upgrade`) + 1× Gorger (**direkt**) + 1× Ogres (**Verweis**) | **2** | nein | nein | **stumm** |

Roster 01 und 03 unterscheiden sich **nur** in der Anzahl direkt gesetzter
Einheiten und belegen damit, dass die Zählung überhaupt gelesen wird und die
Meldung feuern *kann*. Roster 02 und 04 fordern für dieselbe Anzahl dasselbe
Ergebnis, obwohl die Einheiten dort über einen Verweis bezogen sind — das ist die
eigentliche Aussage des Szenarios.

### LTC-R6 im Detail — die erfüllten Pflichtgrenzen

| Grenze | deklariert an | Roster | Ist / Grenze | Erwartung |
|--------|---------------|--------|--------------|-----------|
| `e998-b2d3-1333-a37d` (`min 1`, `scope="parent"`) | **Definition** des geteilten Modells `ece1-a86f-38f9-304e` | 01, 03, 04 | 1 / 1 | nicht feuernd |
| `0dad-7f3c-00e8-e07e` (`min 3`, `scope="parent"`) | **Definition** des Modells `ff8f-ce5a-d663-f9b4` | 02, 04 | 3 / 3 | nicht feuernd |
| `dfd9-3e46-eda5-be8b` (`min 1`, `scope="parent"`) | **`entryLink b581-8a9e-9d0c-b7c8`** (Ziel `abdb-bbd0-41b2-5dff`) | 02, 04 | 1 / 1 | nicht feuernd |

Die dritte Zeile ist die zweite Hälfte derselben Naht: eine über einen Verweis
bezogene Auswahl muss **auch unter der Id des Verweises** zählbar sein, an dem
ihre Grenze deklariert ist. Beide Leserichtungen des Format-Dokuments führen hier
zum selben Ist-Wert — `scope="parent"` vergleicht laut §3.4/§7.6 die aufgelösten
**Ziel-Ids** (`abdb-bbd0-41b2-5dff`, 1 Stück), und die Auswahl trägt zugleich die
**Link-Id** (`b581-8a9e-9d0c-b7c8`, 1 Stück). Die Erwartung „nicht feuernd" ist
deshalb unabhängig davon robust, welche der beiden Ids die Zählung benutzt.
Dieselbe Grenze wird im Szenario
[`modifier-characteristic-value`](../modifier-characteristic-value/README.md)
aus demselben Grund als nicht feuernd erwartet.

---

## Was dieses Szenario bewusst **nicht** festnagelt

- **`childId="model"` mit einem über einen Verweis bezogenen Modell.** Die
  Zuarbeit zu diesem Auftrag schlug den umgekehrten Fall vor — das geteilte
  Modell **„Gorger"** `ece1-a86f-38f9-304e` (`type="model"`), das
  **ausschliesslich** über Verweise bezogen wird (`7908-07bf-ccc6-d650` in der
  Einheit „Gorger" `81b9-e978-56c2-e942`, `4983-51a9-3fef-ddf1` an Skrag
  `82a9-0281-ffa1-2290`). Aus den Fixture-Daten lässt sich dazu **keine**
  Erwartung ableiten, weil **keine** `childId="model"`-Query dieses Modell je
  erreicht:
  - `childId="model"` kommt in den vier Fixture-Katalogen 124-mal vor
    (Orcs & Goblins 63, Mercenaries 30, Vampire Counts 28, Ogre Kingdoms 3), im
    `.gst` **gar nicht**. Alle Vorkommen sind entweder Kosten-/Grenzen-`repeat`s
    mit `scope="parent"` bzw. `scope="unit"` oder die Border-Patrols-Bedingung
    `atLeast 10 … scope="self" includeChildSelections="true"`. Eine
    `childId="model"`-Query auf `field="selections"` mit `scope="force"` oder
    `scope="roster"` existiert **nicht** — die drei `scope="roster"`-Treffer
    (`Orcs and goblins…cat` Z. 5675, 5683, 5688) fragen
    `field="limit::ecfa-8486-4f6c-c249"` ab, also das Punktelimit der Roster,
    wo `childId` nichts zählt.
  - Die Einheiten „Gorger" und „Skrag" tragen **keine** dieser Queries — weder
    die Border-Patrols-Bedingung (der Kategorie-Modifikator
    `add category 6ad6-f54e-1867-00a7` kommt in Ogre Kingdoms nur an *Gnoblars*
    Z. 28, *Gnoblar Trappers* Z. 128 und *Yhetees* Z. 466 vor, in Mercenaries
    **gar nicht**) noch einen Kosten-`repeat` mit `childId="model"`.
  - Umgekehrt sind die Modelle **aller** Einheiten, die eine
    `childId="model"`-Query tragen, **inline** definierte
    `selectionEntry`-Kinder — sie stehen also immer direkt. Geteilte
    `type="model"`-Einträge, die überhaupt Ziel eines `entryLink` sein können,
    gibt es in den Fixtures nur drei: `ece1-a86f-38f9-304e`;
    `Vampire Counts…cat` Z. 17163 „Horned One", dessen einziger Verweis
    `e5ad7c5c-01a1-43bd-ae29-b472db34b2fd` `hidden="true"` ist; und Z. 20249
    „Tiranoc Chariot", nur tief in einer Hochelfen-Verbündeten-Reittiergruppe
    erreichbar (Z. 8885 / 8999).

  Ein `childId="model"`-Gegenpaar wäre daher nur mit erfundenen Daten
  darstellbar. Das Szenario prüft stattdessen **dieselbe Regel** am
  Typ-Schlüsselwort **`unit`**, für das die Daten beide Seiten hergeben — der
  Mechanismus (rohes `type`-Attribut als Zählschlüssel) ist derselbe. **Lücke,
  bewusst offen gelassen und hier dokumentiert.**
- **Die Obergrenze `greaterThan 4`.** Sie ist in LTC-R3 aus den Daten abgeleitet,
  wird aber von keinem Roster ausgelöst. Ein Roster mit 5 Einheiten würde die
  Meldung feuern lassen — bei verlinkten Einheiten allerdings auch dann, wenn die
  Zählung 0 ergibt (weil dann `lessThan 2` greift). Der Fall könnte also nicht
  zwischen richtig und falsch unterscheiden und ist deshalb **nicht** enthalten.
- **`hidden` (LTC-R5).** Die Sichtbarkeit des Slots ist als **Verfügbarkeit**
  modelliert, nicht als zählende Schranke; der Verletzungsbericht kodiert keine
  (Un-)Sichtbarkeit. Das Szenario macht dazu **keine** Aussage und setzt das
  Punktelimit nur, damit der Slot dem Spieler regulär angeboten wird.
- **Der Verletzungsbericht zur Einheiten-Zählung.** LTC-R3 ist eine
  **Autor-Meldung** (`field="error"`), keine `constraint`-Grenze. Es wird deshalb
  **keine** feuernde Grenze aus LTC-R1…R4 erwartet; die `firing`-Liste aller vier
  Roster ist leer, und die Aussagen laufen über `expect.messages`.
- **Weitere Armeeaufbau-Diagnosen.** Kategoriegrenzen (Rare/Core/General),
  Punktelimit und die zweite Autor-Meldung der Border-Patrols-Regeln
  („You must include at least ONE infantry unit of 10+ models.", `.gst` Z. 17611)
  dürfen zusätzlich auftreten — die Erwartung ist selektiv.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle referenzieren
`.gst` + Ogre-Kingdoms-`.cat` + die per `catalogueLink` benötigte
`Mercenaries`-`.cat`.

> **Assertion-Fokus:** die genannte Autor-Meldung am Slot
> `4e15-0353-165f-5528` sowie die aufgeführten Constraint-Ids. Andere
> Armeeaufbau-Diagnosen können zusätzlich auftreten und sind hier ohne Belang.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | Zwei **direkt** gesetzte Einheiten | „Border Patrols rules" + **2×** Wurzeleintrag *Gorger* (`entryLinkId` leer), je 1 Gorger-Modell. | Das Kontingent enthält 2 Einheiten → die Meldung „mindestens ZWEI, höchstens VIER Einheiten" bleibt **stumm**. Die Modell-Pflicht (`min 1`) ist erfüllt. | [`01-two-direct-units.ros`](rosters/01-two-direct-units.ros) |
| 02 | Zwei über einen **Verweis** bezogene Einheiten | „Border Patrols rules" + **2×** *Ogres* über `entryLink 42d8-7559-6542-15fc`, je 3 Ogre-Modelle + Handwaffe. | **Gleiches Ergebnis wie 01:** das Kontingent enthält 2 Einheiten → die Meldung bleibt **stumm**. Modell-Pflicht (`min 3`) und Handwaffen-Pflicht (`min 1`, am Verweis deklariert) sind erfüllt. | [`02-two-linked-units.ros`](rosters/02-two-linked-units.ros) |
| 03 | Gegenprobe: nur **eine** direkte Einheit | „Border Patrols rules" + **1×** Wurzeleintrag *Gorger*. | Das Kontingent enthält 1 Einheit → die Meldung **feuert genau einmal** mit Schweregrad *Fehler*. Belegt, dass die Zählung wirklich gelesen wird. | [`03-one-direct-unit-fires.ros`](rosters/03-one-direct-unit-fires.ros) |
| 04 | Gemischt: **direkt + Verweis** | „Border Patrols rules" + 1× *Gorger* (direkt) + 1× *Ogres* (Verweis). | Dieselbe Summe (2 Einheiten) aus zwei verschiedenen Herkünften → die Meldung bleibt **stumm**. Alle drei Pflichtgrenzen sind erfüllt. | [`04-one-direct-one-linked-unit.ros`](rosters/04-one-direct-one-linked-unit.ros) |

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Spielsystem / Katalog Ogre Kingdoms / Bibliothek Mercenaries | `0d13-7737-ea86-4662` / `731d-5b13-2a92-5427` / `fc47-8392-a6c8-452a` |
| `catalogueLink` Ogre Kingdoms → Mercenaries | `a067-78d5-50a2-affe` |
| ForceEntry „Standard (OK-AB)" | `729f-9246-5cd3-5044` |
| `.gst`-Wurzeleintrag „Border Patrols rules" (`type="upgrade"`, `hidden="true"`) | `4e15-0353-165f-5528` |
| Sichtbarkeits-Umschalter (Punktelimit = 500) / pts-Kostenart | `limit::ecfa-8486-4f6c-c249` / `ecfa-8486-4f6c-c249` |
| **Direkt** gesetzte Einheit: OK-Wurzeleintrag *Gorger* (`type="unit"`) | `81b9-e978-56c2-e942` |
| Geteiltes Modell *Gorger* (`type="model"`) + sein Verweis in der Einheit | `ece1-a86f-38f9-304e` + `7908-07bf-ccc6-d650` |
| Zweiter Verweis auf dasselbe Modell (an Skrag `82a9-0281-ffa1-2290`) | `4983-51a9-3fef-ddf1` |
| **Verlinkte** Einheit: OK-Wurzel-`entryLink` → Mercenaries-Einheit *Ogres* (`type="unit"`) | `42d8-7559-6542-15fc` → `7db1-21db-c287-f50d` |
| Modell *Ogre* (inline, `type="model"`) | `ff8f-ce5a-d663-f9b4` |
| Gruppe „Weapons and Armour" der *Ogres* | `6aad-4eeb-5d2c-35cb` |
| *Hand Weapon* (Ziel-Id) + ihr Verweis in den *Ogres* | `abdb-bbd0-41b2-5dff` + `b581-8a9e-9d0c-b7c8` |
| Grenze „min 1 Gorger-Modell" (an der Definition) | `e998-b2d3-1333-a37d` |
| Grenze „min 3 Ogre-Modelle" (an der Definition) | `0dad-7f3c-00e8-e07e` |
| Grenze „min 1 Hand Weapon" (**am Verweis** deklariert) | `dfd9-3e46-eda5-be8b` |
| Kategorie „BP Infantry 10+" (zweite BP-Meldung, hier nicht geprüft) | `6ad6-f54e-1867-00a7` |
