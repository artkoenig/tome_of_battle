# E2E-Regeln & Testkatalog: Roster-weites `lessThan` auf eine **Kategorie** (Extra Goblin Hero)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Regeln ausschließlich
aus den Katalogdaten der *6th Definitive Edition* und der Formatspezifikation
([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md), §7.6/§7.7)
abgeleitet; das Roster-Format ist an den bereits verifizierten Szenarien
(direktes `entryId`, `entryLinkId=""`, verschachtelte `selections` mit `number`,
`costLimits` mit `typeId`) nachgebildet.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Katalog: `Orcs and goblins (6th definitive edition).cat`
  (`4049-c46d-7f80-44fb`, rev 1) — Kontingent **„Standard (OG-AB)"**
  `2bfa-e64a-7123-895f` (Z. 47), dazu die per `catalogueLink`
  (`b066-2f8e-11ee-1dce`, Z. 14916) benötigte
  `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`).

**Gepinnte Condition-Zelle:** `condition|lessThan|roster|selectionCount|child=categoryId` —
eine `condition type="lessThan" value="1" field="selections" scope="roster"
childId="<Kategorie-Id>"` hält genau dann, wenn das **gesamte Roster** strikt
weniger als `value` Selektionen mit dieser Kategorie führt. Das gezählte Ziel ist
eine **Kategorie**, also greift die Ziel-Typ-Regel aus §7.7 (ADR 0029): ein
Kategorie-Ziel wird **armeeweit über alle Kontingente** aggregiert.

---

## Wo die Grenze im Katalog hängt (verifizierte Position)

Träger ist die Wurzel-Einheit **„Extra Goblin Hero"** (`ed97-811b-cdb5-46c3`,
O&G-`.cat` Z. 5669, `type="unit"`, Basis `hidden="false"`, primäre Kategorie
*Heroes* `c16b-f319-2c62-2c12` über `categoryLink ba88-49bd-cb48-e5cb`, Z. 5720;
eigene Kosten 0 pts, Z. 6185–6188). Struktur:

```
selectionEntry "Extra Goblin Hero" (ed97-811b-cdb5-46c3)          ← Kontingent-Selektion
  ├ constraint 186c-6345-5b25-5aa2   max 0  field=selections  scope=parent   (Z. 5714)
  ├ constraint a12c-ee31-526c-20a5   max -1 field=pts         scope=parent   (Z. 5715)
  ├ modifier set  0 → field=186c-…                                            (Z. 5671)
  │    conditionGroup type="or"
  │      ├ lessThan   1000 · limit::ecfa-8486-4f6c-c249 · scope=roster
  │      └ greaterThan   0 · selections · scope=roster · childId=d4a7-… (Orc)
  ├ modifier increment 1 → field=186c-…                                       (Z. 5681)
  │    repeat  limit::ecfa-8486-4f6c-c249 · scope=roster · value=1000
  │            repeats=1 · roundUp=false
  │    conditionGroup type="and"
  │      ├ greaterThan 999 · limit::ecfa-8486-4f6c-c249 · scope=roster
  │      └ lessThan     1 · selections · scope=roster · childId=d4a7-… (Orc)  ← DAS GEPINNTE
  └ selectionEntryGroup "Night or common" (c392-1399-0baa-b41c)
       ├ constraint 25ca-002c-a4c5-dfce  max 1 scope=parent
       └ constraint 7610-1a81-b6f9-75c0  min 1 scope=parent   (bewusstes Rauschen, s. u.)
```

`d4a7-5999-8207-4efe` ist die **`categoryEntry` „Orc"** des O&G-Katalogs
(Z. 21, `hidden="false"`, **ohne** eigene Constraints). Sie wird im Katalog
ausschließlich per `categoryLink` an **16 Wurzel-Einheiten** vergeben (alle
Orc-Charaktere; die Orc-*Regimenter* wie „Orc Boyz" `ac23-b9d3-4046-23b7` tragen
sie **nicht**) — verifiziert durch Volltextsuche über alle Vorkommen der Id im
Datensatz (Z. 204, 518, 1191, 1491, 1777, 1975, 2164, 7384, 7608, 7987, 8268,
8911, 9115, 9275, 9430, 9909).

---

## Was eine `lessThan`-Bedingung mit `scope="roster"` und Kategorie-`childId` laut Format tut

Aus [§7.6](../../battlescribe-data-format.md#76-constraint) /
[§7.7](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat)
der Formatreferenz, wörtlich abgeleitet:

- `type="lessThan"` hält genau dann, wenn der im Bezugsrahmen gezählte Wert
  **strikt unter** `value` liegt. Bei `value="1"` heißt das: Zähler **= 0**.
- `field="selections"` + `childId="<Kategorie-Id>"` zählt die Selektionen, die
  diese **Kategorie** tragen; `scope="roster"` spannt den Zählrahmen über das
  gesamte Roster. Weil das Ziel eine Kategorie ist, gilt die **Ziel-Typ-Regel**
  (§7.7, ADR 0029): der Zähler wird **armeeweit über alle Kontingente**
  aggregiert. Wo die Kategorie-tragende Selektion steht, ist unerheblich.
- `type="increment"` addiert `value` auf den Feldwert — bei einem `<repeats>`
  **so oft, wie der `repeat` auslöst**. `roundUp="false"` bedeutet Abrunden:
  `floor(limit::pts / 1000) · repeats`.
- `type="set"` **ersetzt** den Feldwert; adressiert per `field="<Constraint-Id>"`
  ersetzt es den `value` der Grenze.
- Eine `and`-Gruppe hält nur, wenn **alle** Mitglieder halten; eine `or`-Gruppe,
  wenn **mindestens eines** hält.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **LTR-R1** | **Basis:** Der Extra Goblin Hero ist per geschriebenem Katalogwert **gar nicht** wählbar — seine Selektionsgrenze im Eltern-Rahmen (dem Kontingent) ist `max 0`. Jeder positive effektive Deckel entsteht erst durch Modifikatoren. | O&G-`.cat` Z. 5714: `<constraint field="selections" scope="parent" value="0" percentValue="false" shared="true" includeChildSelections="false" includeChildForces="false" id="186c-6345-5b25-5aa2" type="max"/>`. |
| **LTR-R2** | **Das gepinnte Gatter:** Zählt das Roster **strikt weniger als 1** Selektion mit der Kategorie *Orc*, hält die Bedingung; hält zugleich `greaterThan 999` auf dem Punktelimit, hält die ganze `and`-Gruppe, und `increment 1` hebt die Grenze — einmal je **vollem** 1000-Punkte-Block des Roster-Kostenlimits (`roundUp="false"`). Enthält das Roster **irgendwo** ≥ 1 Orc-Kategorie-Mitglied, fällt die Gruppe und das `increment` bleibt aus. | O&G-`.cat` Z. 5681–5693: `<modifier type="increment" field="186c-6345-5b25-5aa2" value="1">` mit `<repeat field="limit::ecfa-8486-4f6c-c249" scope="roster" value="1000" repeats="1" roundUp="false" childId="model"/>` und `<conditionGroup type="and">` aus `<condition type="greaterThan" value="999" field="limit::ecfa-8486-4f6c-c249" scope="roster" …/>` **und** `<condition type="lessThan" value="1" field="selections" scope="roster" childId="d4a7-5999-8207-4efe" shared="true" includeChildSelections="false" includeChildForces="false"/>` (Z. 5689). |
| **LTR-R3** | **Die Kehrseite derselben Zelle:** Ein `set 0` auf dieselbe Grenze greift, sobald das Punktelimit **unter 1000** liegt **oder** das Roster **mehr als 0** Orc-Kategorie-Mitglieder führt. In jeder der fünf Konstellationen greift daher **genau einer** der beiden Modifikatoren — die Reihenfolge der Modifikator-Anwendung ist in diesem Szenario **nicht** beobachtbar und wird bewusst nicht behauptet. | O&G-`.cat` Z. 5671–5680: `<modifier type="set" field="186c-6345-5b25-5aa2" value="0">` mit `<conditionGroup type="or">` aus `<condition type="lessThan" value="1000" field="limit::ecfa-8486-4f6c-c249" scope="roster" …/>` **und** `<condition type="greaterThan" value="0" field="selections" scope="roster" childId="d4a7-5999-8207-4efe" shared="true" includeChildSelections="true" includeChildForces="true"/>` (Z. 5676). |
| **LTR-R4** | **Der Kategorie-Träger der Zwillinge:** *Orc Bigboss* trägt die Orc-Kategorie, *Goblin Bigboss* nicht. Beide sind Wurzel-Einheiten desselben Katalogs, beide primär *Heroes*, beide ohne Pflicht-Untergrenze am Eintrag selbst — das Paar unterscheidet sich in der Kategoriezugehörigkeit und sonst in nichts, was auf `186c…` wirkt. | *Orc Bigboss* `6279-4d0a-6dce-f2f3` (Z. 1482) → `categoryLink bfc2-b5c6-63cd-2f52 → d4a7-5999-8207-4efe` (Z. 1491), daneben *Characters* `7a1c…` / *Heroes* `c16b…` (primär). *Goblin Bigboss* `8c8f-3fba-e337-fd2f` (Z. 2278) → *Characters*, *Heroes* (primär), *Goblin Character* `6b1c-cce4-a402-a6e4` (Z. 2283–2287) — **keine** Orc-Kategorie. |
| **LTR-R5** | **Der Wiederholungsfaktor ist beobachtbar:** Bei gehaltener `and`-Gruppe ist der effektive Deckel `floor(costLimit / 1000)`. 1000 pts → 1, 2000 pts → 2. Damit ist der `repeat` von der Bedingung unterscheidbar gepinnt. | ebd., `<repeat … value="1000" repeats="1" roundUp="false"/>` (Z. 5683). |
| **LTR-R6** | **Nichts anderes bewegt die Grenze:** Die Id `186c-6345-5b25-5aa2` erscheint im **gesamten** Datensatz (`.gst` + alle vier `.cat`) nur **dreimal**: als Constraint-Definition (Z. 5714) und als `field=` der beiden Modifikatoren (Z. 5671, 5681). Der Eintrag trägt **kein** `<modifierGroups>` (§7.7, Fallstrick-Kasten — in `<modifiers>` **und** `<modifierGroups>` geprüft). | O&G-`.cat` Z. 5670–5712 (`<modifiers>`), Z. 5713–5718 (`<constraints>`); Entrag endet Z. 6191 ohne weitere Modifikator-Elemente. |
| **LTR-R7** | **Der Eintrag bleibt im Kontingent „Standard (OG-AB)" sichtbar:** Sein `set hidden=true` ist per `instanceOf` auf drei **fremde** Kontingente gegattert (*Snotling Horde* `03cc…`, *Savage Orc Horde* `59e1…`, *Grimgor's 'Ardboyz* `1821…`) — `2bfa-e64a-7123-895f` ist nicht darunter. Damit greift das Sichtbarkeits-Validierungsverbot (§5.6, Issue 0088) hier **nicht**. | O&G-`.cat` Z. 5694–5705. |
| **LTR-R8** | **Der Kosten-Deckel bleibt unbegrenzt:** Die zweite Grenze des Eintrags (`a12c…`, `max -1` auf die pts-Kostenart) wird nur durch einen Border-Patrols-`set 125` bewegt; kein Roster dieses Szenarios führt eine „Border Patrols rules"-Selektion. `-1` als **hingeschriebener** Wert heißt „unbegrenzt" (§7.6, Sentinel-Kasten) — die Grenze feuert nie. | O&G-`.cat` Z. 5706–5711 (`<modifier type="set" value="125" field="a12c-ee31-526c-20a5">` mit `atLeast 1` auf `4e15-0353-165f-5528`), Z. 5715–5717. |

### Bewusst ausgelassene Facetten

| Facette | Warum nicht abgedeckt |
|---------|------------------------|
| `isHidden` des Extra-Goblin-Hero-Slots | Eigene Bedingungszelle (`instanceOf` gegen `forceEntry`-Ids), bereits von anderen Szenarien gepinnt; hier nur Aufbau-Voraussetzung (LTR-R7). Verfügbarkeit ist ohnehin **keine** zählende Grenze und erschiene nicht im Verletzungsbericht. |
| Die Aggregation **über mehrere Kontingente** (`includeChildForces`) | Bräuchte ein Zwei-Kontingent-Roster. Die Kategorie-Zählung „irgendwo im Roster" ist mit einem Kontingent bereits eindeutig gepinnt; die Mehr-Force-Aggregation eines Kategorie-Ziels ist eine eigene Facette (§7.7, Ziel-Typ-Regel). Bemerkenswert: die beiden Bedingungen widersprechen sich in ihren Zähl-Flags (`includeChildSelections`/`includeChildForces` `false` beim `lessThan`, `true` beim `greaterThan`) — der Kategorie-Träger steht deshalb bewusst als **direkte** Kontingent-Selektion, wo jede Lesart denselben Zähler liefert. |
| Die Reihenfolge `set` vs. `increment` | In jeder der fünf Konstellationen greift genau **einer** der beiden Modifikatoren (LTR-R3) — die Reihenfolge ist auf diesen Daten nicht beobachtbar und wird nicht behauptet. |
| Punktebänder ≥ 3000 / nicht-glatte Limits (z. B. 1500) | Weitere Stützstellen desselben `repeat`; 1000 vs. 2000 pinnt den Faktor bereits. Ein krummes Limit prüfte die Rundung (`roundUp="false"`) — eine eigene Zelle. |
| Die Pflicht-Untergruppe „Night or common" (`7610-1a81-b6f9-75c0`, `min 1`) | Bewusst **unbesetzt** gelassen, damit die Roster minimal bleiben. Die Grenze feuert in **allen fünf** Rostern identisch (Ist 0 / Grenze 1) und ist damit als Ursache für den Unterschied ausgeschlossen — sie wird toleriert, nicht behauptet. |
| `headroom` / `isBlocked` am Slot | Bei effektivem Hoechstmass 0 und Ist 1 wäre der Restspielraum negativ; ob er so gemeldet oder auf 0 geklemmt wird, sagen die Katalogdaten nicht. Behauptet werden nur `current`, `effectiveMin` und `effectiveMax`. |

### Toleriertes Rauschen (nicht Teil der Erwartung)

In **allen fünf** Rostern gleichartig: die Core-Pflicht der `.gst`
(`35c2-d478-392a-aeb1`, `min 2`, force-scope — 0 Core-Auswahlen), die
General-Pflicht der `.gst`-Kategorie *General*
(`1077-7379-f142-f382`, `min 1` — kein General gewählt), die unbesetzte
Pflicht-Untergruppe `7610-1a81-b6f9-75c0` sowie die Pflicht-Kinder der beiden
Bigbosse (*Choppa* `438b-0ba6-8e22-8a2a` beim Orc Bigboss, *Hand Weapon*
`4b7b-ab0c-0149-d4bf` beim Goblin Bigboss). Das alles ist zwischen den
Zwillingen deckungsgleich und fällt unter die **selektive** Erwartung des
Runners.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle fünf Roster
sind bis auf **zwei** Stellschrauben identisch: das `costLimit` und die eine
Charakter-Selektion (Goblin Bigboss ↔ Orc Bigboss). Jedes Roster führt **genau
eine** Extra-Goblin-Hero-Selektion (`number="1"`), damit der
`capabilities`-Selektor `defId` + `anchorKind: occupied` eindeutig genau einen
Slot trifft.

> **Assertion-Fokus:** das effektive Hoechstmass des Extra-Goblin-Hero-Slots und
> die Grenze `186c-6345-5b25-5aa2`; als `absent` zusätzlich die still bleibenden
> Grenzen `a12c…` (Kosten, unbegrenzt), `25ca…` (Untergruppe max 1, 0 Mitglieder),
> `c3c3-a80c-e026-200f` (*Characters* max 3 bzw. 4, Ist 1) und
> `7fca-63fb-63d2-9dad` (*Heroes* max `-1`). Alles andere darf zusätzlich
> auftreten.

| # | Testtitel | costLimit | Orc-Kategorie im Roster | `lessThan 1` (Orc) | `greaterThan 999` (pts) | Erwartetes Ergebnis | Fixture |
|---|-----------|-----------|--------------------------|--------------------|--------------------------|----------------------|---------|
| 01 | Gatter hält → Deckel 1 | 1000 pts | nein (Goblin Bigboss) | **hält** (0 < 1) | **hält** | `increment 1` × `floor(1000/1000)=1` → `effectiveMax` **1**; eine Selektion → `186c…` **feuert nicht**. | [`01-limit1000-no-orc-max-one.ros`](rosters/01-limit1000-no-orc-max-one.ros) |
| 02 | Ein Orc kippt das Gatter | 1000 pts | **ja** (Orc Bigboss) | hält **nicht** (1 ≮ 1) | hält | `and` fällt, `or` hält über `greaterThan 0` → `set 0` → `effectiveMax` **0**; `186c…` **feuert** (Ist 1 / Grenze 0). | [`02-limit1000-orc-present-max-zero.ros`](rosters/02-limit1000-orc-present-max-zero.ros) |
| 03 | Kategorie-Bedingung allein genügt nicht | 500 pts | nein (Goblin Bigboss) | **hält** (0 < 1) | hält **nicht** | `and` fällt an der Punkte-Bedingung, `or` hält über `lessThan 1000` → `effectiveMax` **0**; `186c…` **feuert** (Ist 1 / Grenze 0). Trennt die beiden `and`-Mitglieder. | [`03-limit500-no-orc-max-zero.ros`](rosters/03-limit500-no-orc-max-zero.ros) |
| 04 | Wiederholungsfaktor 2 | 2000 pts | nein (Goblin Bigboss) | **hält** | **hält** | `increment 1` × `floor(2000/1000)=2` → `effectiveMax` **2**; `186c…` **feuert nicht**. | [`04-limit2000-no-orc-max-two.ros`](rosters/04-limit2000-no-orc-max-two.ros) |
| 05 | Kategorie schlägt Punkteband | 2000 pts | **ja** (Orc Bigboss) | hält **nicht** | hält | Trotz Faktor 2 fällt die `and`-Gruppe an der Kategorie; `set 0` greift → `effectiveMax` **0**; `186c…` **feuert** (Ist 1 / Grenze 0). | [`05-limit2000-orc-present-max-zero.ros`](rosters/05-limit2000-orc-present-max-zero.ros) |

**Herleitung von Ist/Grenze und `effectiveMax` (aus Daten + Rosterbau, nicht aus
einem Testlauf):**

- `bound` / `effectiveMax` ist der **gerechnete** Wert der Grenze
  `186c-6345-5b25-5aa2`: Basiswert `0` (Z. 5714), verändert durch genau den
  Modifikator, dessen Bedingungsgruppe im jeweiligen Roster hält —
  `0 + 1 · floor(costLimit/1000)` bei gehaltener `and`-Gruppe, sonst `set 0`.
  Daraus: 01 → 1, 02 → 0, 03 → 0, 04 → 2, 05 → 0.
- `actual` ist die Zählung von `field="selections"` im `scope="parent"`-Rahmen des
  Trägers, also im Kontingent: jedes Roster führt **eine** Extra-Goblin-Hero-
  Selektion mit `number="1"` → Ist **1**. Gefeuert wird folglich genau dort, wo
  `1 > effectiveMax` gilt (02, 03, 05).
- Der Zähler der gepinnten Bedingung ist die Zahl der Selektionen mit der
  Kategorie `d4a7-5999-8207-4efe` im Roster: **0** in 01/03/04 (Goblin Bigboss
  trägt sie nicht, Extra Goblin Hero trägt nur *Heroes*), **1** in 02/05
  (Orc Bigboss).
- `effectiveMin` ist `null`, weil der Eintrag **keine** `min`-Grenze trägt
  (Z. 5713–5718 enthält nur `186c…` und `a12c…`, beide `type="max"`).

---

## Abgleich mit dem Engine-Bericht (Runner-Verifikation)

Die oben aus den Katalogdaten **abgeleiteten** Erwartungen treffen die Engine
erst im **Runner-Lauf** — der separate Verifikationsschritt, der nicht zur
(blinden) Autorenschaft gehört (siehe
[ADR 0033](../../adr/0033-evaluator-e2e-manifest-runner-und-black-box-autorenschaft.md)).
Abweichungen sind zu **untersuchen**, nicht durch Anpassen der Erwartung
wegzudefinieren. Die erwartungsgemäß heiklen Stellen:

1. **LTR-R2** — ob die `lessThan`-Zählung mit `scope="roster"` und einer
   **Kategorie**-`childId` die Kategorie-Mitgliedschaft einer *anderen*
   Wurzel-Selektion überhaupt sieht (Ziel-Typ-Regel, §7.7 / ADR 0029) und nicht
   etwa versucht, `d4a7-5999-8207-4efe` als Eintrags-Id aufzulösen.
2. **LTR-R5** — ob der `repeat` auf `limit::ecfa-8486-4f6c-c249` mit
   `roundUp="false"` tatsächlich `floor(costLimit/1000)` Wiederholungen liefert
   (01 → 1, 04 → 2) und den `increment` entsprechend oft anwendet.
3. **LTR-R3 / Fall 03** — ob die widersprüchlichen Zähl-Flags der beiden
   Bedingungen (`includeChildSelections`/`includeChildForces` `false` vs. `true`)
   auf einer **direkten** Kontingent-Selektion beidseitig denselben Zähler
   ergeben.
4. Die Slot-Adressierung: `defId ed97-811b-cdb5-46c3` + `anchorKind occupied`
   muss die eine Extra-Goblin-Hero-Auswahl je Roster eindeutig treffen.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Extra Goblin Hero (Wurzel-Einheit, Träger der Grenze) | `ed97-811b-cdb5-46c3` (O&G-`.cat` Z. 5669) |
| Die gepinnte Grenze (`max 0`, `field=selections`, `scope=parent`) | `186c-6345-5b25-5aa2` (Z. 5714) |
| Kosten-Grenze des Eintrags (`max -1`, als `absent`) | `a12c-ee31-526c-20a5` (Z. 5715) |
| `categoryEntry` „Orc" (`childId` beider Bedingungen) | `d4a7-5999-8207-4efe` (Z. 21) |
| Punkte-Kostenart (`limit::…` in Repeat und beiden Punkte-Bedingungen) | `ecfa-8486-4f6c-c249` |
| Orc Bigboss (Kategorie-Träger der Zwillinge 02/05) | `6279-4d0a-6dce-f2f3` — `categoryLink bfc2-b5c6-63cd-2f52` → `d4a7-…` (Z. 1482/1491) |
| Goblin Bigboss (kategorie-freier Gegenpart in 01/03/04) | `8c8f-3fba-e337-fd2f` — Kategorien *Characters*/*Heroes*/*Goblin Character* (Z. 2278/2283–2287) |
| Untergruppe „Night or common" (max 1 als `absent`, min 1 als toleriertes Rauschen) | `c392-1399-0baa-b41c` — Grenzen `25ca-002c-a4c5-dfce` / `7610-1a81-b6f9-75c0` (Z. 5723–5727) |
| Kategorie *Heroes* (primär am Extra Goblin Hero; force max `-1`, als `absent`) | `c16b-f319-2c62-2c12` — Constraint `7fca-63fb-63d2-9dad` (`.gst` Z. 366–369) |
| Kategorie *Characters* (force max 3 bzw. 4 je Punkteband, als `absent`) | `7a1c-d611-c2dc-def1` — Constraint `c3c3-a80c-e026-200f` (`.gst` Z. 641–645, Punkteband-Modifikatoren Z. 646–682) |
| Kategorie *Core* (min 2, toleriert — nicht Gegenstand) | `64bf-efb4-9978-26df` — Constraint `35c2-d478-392a-aeb1` (`.gst` Z. 372–375) |
| Kategorie *General* (min 1, toleriert — nicht Gegenstand) | `a37e-7207-de6d-acb0` — Constraint `1077-7379-f142-f382` |
| Kontingent „Standard (OG-AB)" (führt *Heroes* `3b7e-2aff-641b-2e7a` und *Characters* `a541-7b89-797d-8285`) | `2bfa-e64a-7123-895f` (O&G-`.cat` Z. 47–61) |
| Fremde Kontingente im `hidden`-Gatter (hier **nicht** benutzt) | `03cc-8a3f-abd4-3c03` / `59e1-efd7-af88-55a1` / `1821-fbd1-0d96-2d88` (Z. 5699–5701) |
| „Border Patrols rules" (in **keinem** Roster gewählt) | `4e15-0353-165f-5528` (`.gst`) |
| `catalogueLink` O&G → Mercenaries | `b066-2f8e-11ee-1dce` → `fc47-8392-a6c8-452a` (Z. 14916) |
