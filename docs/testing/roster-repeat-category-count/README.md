# E2E-Regeln & Testkatalog: `repeat` mit `scope="roster"`, Kategorie-Ziel und `includeChildForces="true"` — der armeeweite Stückzähler der Orc Big 'Uns

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln,
Constraint-Ids und Erwartungswerte sind **ausschließlich aus den Katalogdaten**
der *6th Definitive Edition* (`src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive/`)
und der Formatspezifikation
([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md),
§5.6/§7.5/§7.6/§7.7) abgeleitet. Die Roster-Form folgt den bereits verifizierten
Szenario-Fixtures (direktes `entryId`, `entryLinkId=""`, geschachtelte
`selections` mit `number`, zwei Geschwister-`<force>` wie in
[`ogre-kingdoms`](../ogre-kingdoms/rosters/08-two-empty-forces.ros)).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armeebuch: `Orcs and goblins (6th definitive edition).cat`
  (`4049-c46d-7f80-44fb`, rev 1, `:2`) — Kontingent **„Standard (OG-AB)"**
  `2bfa-e64a-7123-895f` (`:47`)
- Bibliothek: `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`)
  — per `catalogueLink` `b066-2f8e-11ee-1dce` eingebundene Abhängigkeit des
  O&G-Katalogs (`:14916`)

---

## Der gepinnte Mechanismus

Ein `modifier` mit einer `<repeats>`-Liste wird **einmal je gezähltem Treffer**
angewendet ([§7.7](../../battlescribe/building-blocks/modifier.md#repeat--modifier-mehrfach-anwenden)).
Die hier gepinnte Zelle zählt mit `field="selections"`, **`scope="roster"`**,
einem **Kategorie-Ziel** in `childId`, `value="1"`, `repeats="1"`,
`roundUp="false"`, `percentValue="false"`, `shared="true"` und **beiden**
Einschluss-Flags auf `true` (`includeChildSelections`, `includeChildForces`) —
sie zählt also über die **gesamte** Armee, verschachtelte Auswahlen und weitere
Kontingente eingeschlossen. Träger ist die Wurzel-Einheit **„Orc Big 'Uns"**:

```
forceEntry "Standard (OG-AB)" (2bfa-e64a-7123-895f, :47)
  ├ selectionEntry "Orc Boyz" (ac23-b9d3-4046-23b7, :3007, type=unit, Core primär)
  │    └ categoryLink 61ca-d64b-4a52-c623 ──▶ categoryEntry "Orc boyz"
  │           (344f-77ef-7238-f157, :23)          ← das GEZÄHLTE Ziel
  └ selectionEntry "Orc Big 'Uns" (eeb1-a6c4-b57e-f08c, :6351, type=unit, Core primär)
       ├ constraint max 0 selections scope=roster   938b-15b1-f433-e0d5   (:6391)
       │      (shared=true, includeChildSelections=false, includeChildForces=false)
       ├ modifier increment +1 field=938b-…          (:6353)
       │    └ repeat field=selections scope=roster value=1 repeats=1
       │          childId=344f-77ef-7238-f157
       │          shared=true includeChildSelections=TRUE
       │          includeChildForces=TRUE roundUp=false        ← DIESE ZELLE (:6355)
       └ modifier set -1 field=938b-…  (:6373, nur im Kontingent
              „Grimgor's 'Ardboyz" 1821-fbd1-0d96-2d88 — hier inert)
```

Netto-Semantik der Daten: **Orc Big 'Uns sind von Haus aus verboten (max 0) —
jede armeeweit gezählte Auswahl der Kategorie „Orc boyz" erlaubt genau eine.**
Mit N gezählten Orc Boyz ist das effektive Maximum **0 + N**. Anwendungszahl des
`repeat`: `floor(Treffer / value) × repeats` = `floor(N / 1) × 1` = N.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **RRCC-R1** | Die Einheit „Orc Big 'Uns" trägt als **geschriebene** Grenze **max 0** Auswahlen ihrer selbst, gezählt im **Roster**-Rahmen. Ohne Modifier ist sie damit gar nicht wählbar. | `Orcs and goblins (…).cat:6391` — `constraint field="selections" scope="roster" value="0" type="max" id="938b-15b1-f433-e0d5" shared="true" includeChildSelections="false" includeChildForces="false"` am `selectionEntry` `eeb1-a6c4-b57e-f08c` (`:6351`). |
| **RRCC-R2** | **Die Kernaussage:** Je armeeweit gezählter Auswahl der Kategorie **„Orc boyz"** steigt diese Grenze um **+1**. Der `increment`-Modifier trägt genau einen `<repeat>` mit `value="1"`/`repeats="1"`/`roundUp="false"`; mit 1 Treffer ist das effektive Maximum `0+1=1`, mit 2 Treffern greift die Wiederholung **zweimal**: `0+2=2`. | `:6353-6357` — `modifier type="increment" value="1" field="938b-15b1-f433-e0d5"` mit `<repeat field="selections" scope="roster" value="1" percentValue="false" shared="true" includeChildSelections="true" includeChildForces="true" childId="344f-77ef-7238-f157" repeats="1" roundUp="false"/>`. Anwendungszahl je [§7.7](../../battlescribe/building-blocks/modifier.md#repeat--modifier-mehrfach-anwenden). |
| **RRCC-R3** | Ohne jede Auswahl der Kategorie zählt der `repeat` **0 Treffer**; der Modifier wird **nicht** angewendet (er trägt keine weitere `condition`), die Grenze behält ihren **Basiswert 0**. | `:6353-6357` — der Modifier hat **keine** `<conditions>`/`<conditionGroups>`, allein der `<repeat>` steuert die Anwendungszahl (`floor(0/1)×1 = 0`). |
| **RRCC-R4** | Das gezählte Ziel ist eine **Kategorie**, keine Eintrags-Id: `344f-77ef-7238-f157` ist ein `categoryEntry` („Orc boyz"). Im gesamten Fixture-Satz trägt sie **genau eine** Definition — die Wurzel-Einheit **„Orc Boyz"** `ac23-b9d3-4046-23b7`; kein `modifier add/remove category` verändert das. Damit ist „gezählte Kopie" hier gleichbedeutend mit „Stückzahl der Orc-Boyz-Auswahlen". | `:23` (`categoryEntry id="344f-77ef-7238-f157" name="Orc boyz"`), `:3017` (`categoryLink id="61ca-d64b-4a52-c623" targetId="344f-77ef-7238-f157"` an `ac23-b9d3-4046-23b7`, `:3007`). Verifiziert: die Id kommt im Fixture-Satz **genau dreimal** vor — Kategorie-Definition, dieser eine `categoryLink` und der `<repeat>`. Kategorie-Ziele werden armeeweit gezählt ([§7.7, Ziel-Typ-Regel](../../battlescribe/building-blocks/modifier.md#77-modifier-condition-condition-group-repeat) / ADR 0029). |
| **RRCC-R5** | Gezählt wird die **Stückzahl** (`number`) der Auswahlen, nicht die Zahl der `<selection>`-Elemente: eine Orc-Boyz-Auswahl mit `number="2"` liefert dieselben 2 Treffer wie zwei Auswahlen mit je `number="1"`. | [§7.5, Kasten „Zahlenbasis"](../../battlescribe/building-blocks/cost.md#75-cost--cost-type): jeder Knoten trägt sein `count` unverrechnet bei, das `number` einer `.ros`-Auswahl ist die **absolute Gesamtstückzahl**. Gepinnt im Zwillingspaar Roster 04 / 05. |
| **RRCC-R6** | `includeChildForces="true"` zusammen mit `scope="roster"`: die gezählten Auswahlen dürfen in einem **anderen Kontingent** stehen als der Träger — der Zähler läuft über die ganze Armee. | `:6355` (`scope="roster" includeChildForces="true"`); [§7.6](../../battlescribe/building-blocks/constraint.md#76-constraint) zu `includeChildForces`. Gepinnt in Roster 06 (Träger in Kontingent 1, gezählte Orc Boyz in Kontingent 2). |
| **RRCC-R7** | Die **angehobene** Grenze ist auch die Grenze, die im Verletzungsbericht erscheint: übersteigt die Stückzahl der Orc Big 'Uns `0+N`, feuert `938b-15b1-f433-e0d5` mit dem **effektiven** `bound` (0 ohne Orc Boyz, 2 mit zwei) — nicht mit dem geschriebenen Wert. | Kombination aus RRCC-R1/R2/R3; im ganzen Fixture-Satz adressieren **genau drei** Stellen die Id `938b-15b1-f433-e0d5`: die Constraint (`:6391`), das increment (`:6353`) und der `set -1` (`:6373`). |
| **RRCC-R8** | Der `set -1` auf dieselbe Grenze (= „unbegrenzt", [§7.6, Sentinel-Kasten](../../battlescribe/building-blocks/constraint.md#76-constraint)) ist in **allen** Rostern inert: er ist auf das Kontingent „Grimgor's 'Ardboyz (SoC)" `1821-fbd1-0d96-2d88` gegatet, die Roster nutzen „Standard (OG-AB)". | `:6373-6377` — `modifier type="set" value="-1" field="938b-15b1-f433-e0d5"` mit `condition type="instanceOf" scope="force" childId="1821-fbd1-0d96-2d88"`; `forceEntry` `:147`. |
| **RRCC-R9** | Beide Einheiten sind im Kontingent „Standard (OG-AB)" **sichtbar**. Die `set hidden="true"`-Gatter nennen ausschließlich Sonderheere: Big 'Uns `c248` / `59e1` / `b26c` / `1f55` / `03cc` / `9f70`, Orc Boyz `c248` / `59e1` / `1f55` / `03cc` / `9f70`. `2bfa-e64a-7123-895f` steht in keiner der beiden Listen. | `:6358-6372` (Big 'Uns) und `:3191-3204` (Orc Boyz). |
| **RRCC-R10** | Die Pflicht-Kinder beider Einheiten sind in den Rostern ausgefüllt: **10 Modelle** (`min 10`, `scope="parent"`), **Choppa** (`min 1`) und **Light Armour** (`min 1`); die zugehörigen `max 1` sind mit je einer Kopie eingehalten. | Big 'Uns: `:6404-6410` (`0d44-66f5-eae1-bb16`, min `cd53-8606-5530-dbe3`), `:6425-6428` (`a199-353d-5f10-c4da`, min `d707-6a7b-03fe-e3d8` / max `2d4e-7468-78d3-fc5e`), `:6439-6442` (`ab64-4412-7454-4b8e`, max `a28c-90ff-44ec-daf9` / min `10b8-4839-ddb4-4014`). Orc Boyz: `:3020-3026` (`cef0-77ce-8158-32d4`, min `158f-ed55-76f2-eba0`), `:3041-3044` (`f73d-18a2-089b-285e`, min `dbcc-2eb6-66d6-e785` / max `db48-8078-f3c8-6c29`), `:3055-3058` (`ee53-a14e-2084-9f87`, max `34cc-8bc4-9ef8-cd20` / min `0b95-cef7-a64a-3172`). |

**Bewusst nicht Gegenstand dieses Szenarios** (in allen Rostern inert bzw. nicht
assertiert):

- **Die Abgrenzung `includeChildSelections="true"` gegen `false`:** die einzige
  Definition mit der Kategorie „Orc boyz" (RRCC-R4) ist eine **Wurzel**-Einheit
  und steht in jedem katalogkonformen Roster als direkte Auswahl des
  Kontingents. Ein Gegenbeispiel bräuchte einen Orc-Boyz-Träger **unterhalb**
  einer anderen Auswahl; kein Eintrag im Katalog führt ihn dort. Die Zelle wird
  darum in ihrer realen Verwendung gepinnt, nicht über einen Kontrast zu
  `false` — dieselbe Lage wie PRIC-R5 in
  [`parent-repeat-item-count`](../parent-repeat-item-count/README.md).
- **Die Pflichtkinder-Grenzen eines *gestapelten* Trägers.** In den Rostern 03–06
  steht „Orc Big 'Uns" als **eine** Auswahl mit `number` 2 bzw. 3 (nötig, damit
  der Capability-Selektor genau **einen** Slot trifft). Ob eine `scope="parent"`-
  Grenze eines Kindes dann gegen `child.number` oder gegen
  `child.number × parent.number` misst, ist genau die in
  [§7.5](../../battlescribe/building-blocks/cost.md#75-cost--cost-type) offen benannte
  Frage („Zahlenbasis"; Katalog-Mathematik vs. Reinraum-Engine). Die
  Kinder-Grenzen des gestapelten Trägers stehen deshalb in 03–06 **weder** in
  `firing` **noch** in `absent`; in Roster 05 gilt dasselbe für die ebenfalls
  gestapelte Orc-Boyz-Auswahl. In den Rostern 01/02 (alle `number="1"`) sind sie
  eindeutig und werden als `absent` gefordert.
- **`headroom` / `isBlocked` / `isHidden`:** nicht assertiert. In den
  Überschreitungs-Rostern ist aus Daten und Formatdoku nicht ableitbar, ob der
  Restspielraum negativ oder auf 0 geklemmt gemeldet wird; assertiert werden nur
  `name`, `current`, `effectiveMin` und `effectiveMax`.
- **Sichtbarkeit (`field="hidden"`) und die Kategorie-Umgliederung** der beiden
  Einheiten in den Sonderheeren (RRCC-R9, `:3217-3228` für den Common Goblin
  Horde). Als **Verfügbarkeit** modelliert, nicht als zählende Schranke — der
  Verletzungsbericht kodiert zählende Grenzen (gleiche Abgrenzung wie VBL-R4/R5
  in [`vampire-bloodlines`](../vampire-bloodlines/README.md)).
- **Armeeweite Aufbau-Diagnosen:** die General-Pflicht (`.gst:721`, Kategorie
  `a37e-7207-de6d-acb0`, `min 1`) und die Core-Mindestzahl (`.gst:372`,
  `35c2-d478-392a-aeb1`, Basis `min 2`) sind in den bewusst minimalen Rostern
  nicht erfüllt und dürfen zusätzlich feuern; die Erwartung ist selektiv und
  macht darüber keine Aussage. Die Roster tragen **kein** `<costLimits>`, also
  greift auch keine punkteskalierende Stufe dieser Grenzen.
- **Die drei baugleichen Schwester-Zellen** derselben Art im selben Katalog
  (`Savage Orc Boar Big 'Uns` → `39c9-363a-dd54-8a84`, `Savage Orc Big 'Uns` →
  `5e83-d646-097c-dbee`, `Orc Boar Chariot` → `a85e-af08-5fea-41bd`, `:6569`,
  `:6726`, `:4732`): dieselbe Zelle an anderen Trägern, hier nicht gewählt und
  in allen Rostern inert, weil keine ihrer Einheiten vorkommt.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle laufen gegen
**denselben** Datensatz (`.gst` + Orcs-and-Goblins-`.cat` + Mercenaries-`.cat`)
und benutzen dasselbe Kontingent „Standard (OG-AB)" `2bfa-e64a-7123-895f`.
Jede Einheit trägt ihre Pflichtkinder (10 Modelle, Choppa, Light Armour).

> **Assertion-Fokus:** das effektive Maximum des Big-'Uns-Slots
> (`expect.capabilities`, Felder `current`/`effectiveMax`) sowie `actual`/`bound`
> der Grenze `938b-15b1-f433-e0d5` im Verletzungsbericht.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | Kein Orc Boyz → Basiswert 0 feuert | 1 × Orc Big 'Uns, **keine** Auswahl der Kategorie „Orc boyz". | **RRCC-R1/R3:** Der `repeat` trifft 0-mal, die Grenze bleibt bei **max 0** und feuert mit **Ist 1 gegen Grenze 0**. Der Slot meldet `current=1`, `effectiveMax=0`, kein Mindestmaß. Die Pflichtkinder-Grenzen bleiben still. | [`01-no-orc-boyz-max-zero-fires.ros`](rosters/01-no-orc-boyz-max-zero-fires.ros) |
| 02 | Eine Einheit Orc Boyz → Maximum 1 | Wie 01, zusätzlich **1 ×** Orc Boyz (`number="1"`). | **RRCC-R2:** Die Wiederholung greift **einmal** → `effectiveMax=1` bei Ist 1. Keine der genannten Grenzen feuert. | [`02-one-orc-boyz-max-one-legal.ros`](rosters/02-one-orc-boyz-max-one-legal.ros) |
| 03 | Zwei Einheiten Orc Boyz → Maximum 2 | **2 ×** Orc Boyz (zwei Auswahlen, je `number="1"`), Träger mit `number="2"`. | **RRCC-R2:** Die Wiederholung greift **zweimal** → `effectiveMax=2` bei Ist 2. Keine der genannten Grenzen feuert. | [`03-two-orc-boyz-max-two-legal.ros`](rosters/03-two-orc-boyz-max-two-legal.ros) |
| 04 | Drei Big 'Uns gegen Maximum 2 → angehobene Grenze feuert | Wie 03, Träger mit `number="3"`. | **RRCC-R7:** Dieselbe Grenze feuert jetzt mit **Ist 3 gegen Grenze 2** — der gemeldete `bound` liegt um genau **zwei** Wiederholungsschritte über dem Basiswert aus Test 01. Slot: `current=3`, `effectiveMax=2`. | [`04-two-orc-boyz-three-big-uns-max-two-fires.ros`](rosters/04-two-orc-boyz-three-big-uns-max-two-fires.ros) |
| 05 | Dieselben zwei Kopien als **eine** Auswahl mit `number="2"` | Zwilling zu 04: **1 ×** Orc Boyz mit `number="2"`, Träger `number="3"`. | **RRCC-R5:** Gezählt wird die Stückzahl, nicht das Element — `bound` bleibt **2**, die Grenze feuert mit **Ist 3 gegen Grenze 2**. Zählte die Engine Elemente, wäre der `bound` 1. | [`05-orc-boyz-number-two-max-two-fires.ros`](rosters/05-orc-boyz-number-two-max-two-fires.ros) |
| 06 | Gezählte Kopien im **zweiten** Kontingent | Kontingent 1: Träger `number="3"`. Kontingent 2 (dasselbe `forceEntry`): **2 ×** Orc Boyz. | **RRCC-R6:** `scope="roster"` + `includeChildForces="true"` zählen über Kontingentsgrenzen hinweg → `bound` **2**, die Grenze feuert mit **Ist 3 gegen Grenze 2**. Bliebe das zweite Kontingent ungezählt, feuerte sie mit `bound` 0. | [`06-orc-boyz-in-second-force-max-two-fires.ros`](rosters/06-orc-boyz-in-second-force-max-two-fires.ros) |

### Ableitung der Zahlen (aus den Daten, nicht aus einem Engine-Lauf)

- **`effectiveMax` / `bound`** ist der Basiswert **0** der Constraint
  `938b-15b1-f433-e0d5` (`:6391`) plus `floor(N/1) × 1 × 1` Anwendungen des
  `increment +1` (`:6353-6357`), wobei **N** die armeeweit gezählte Stückzahl der
  Auswahlen mit der Kategorie `344f-77ef-7238-f157` ist (RRCC-R2/R4/R5). Daraus:
  Roster 01 ⇒ **0**; Roster 02 ⇒ **1**; Roster 03–06 ⇒ **2**.
- **`current` / `actual`** ist die Stückzahl der Orc-Big-'Uns-Auswahlen im
  Roster-Rahmen (`field="selections"`, `scope="roster"`), also das `number` der
  einen Träger-Auswahl: 1, 1, 2, 3, 3, 3 in den Rostern 01…06.
- Wo `actual ≤ bound` liegt, ist die Grenze eingehalten und erscheint nicht im
  Bericht — die Erwartung lautet dort `absent`, ohne `actual`/`bound`
  (Roster 02, 03).
- **`effectiveMin`** ist `null`: die Einheit trägt **keine** min-Grenze, und kein
  Modifier fügt eine hinzu (RRCC-R7: nur drei Fundstellen der Constraint-Id).
- Der **effektive Name** bleibt der Basisname **„Orc Big 'Uns"** (`:6351`,
  XML-escaped `Orc Big &apos;Uns`): an `eeb1-a6c4-b57e-f08c` hängt kein
  Namens-Modifier.

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Spielsystem WHFB 6th definitive | `0d13-7737-ea86-4662` |
| Katalog **Orcs and Goblins** (rev 1, `:2`) | `4049-c46d-7f80-44fb` |
| Bibliothek **Mercenaries** (per `catalogueLink` `b066-2f8e-11ee-1dce`, `:14916`) | `fc47-8392-a6c8-452a` |
| `costType` „pts" (`.gst`) | `ecfa-8486-4f6c-c249` |
| ForceEntry „Standard (OG-AB)" (`:47`) | `2bfa-e64a-7123-895f` |
| ForceEntry „Grimgor's 'Ardboyz (SoC)" (`:147`) — Gatter des inerten `set -1` | `1821-fbd1-0d96-2d88` |
| **SelectionEntry „Orc Big 'Uns"** (`:6351`, `type="unit"`, Core primär) — der Träger | **`eeb1-a6c4-b57e-f08c`** |
| — **die gegatete Grenze** max 0, `field="selections" scope="roster"` (`:6391`) | **`938b-15b1-f433-e0d5`** |
| — `increment +1` auf diese Id mit **der gepinnten `repeat`-Zelle** (`:6353-6357`) | `childId=344f-77ef-7238-f157`, `scope="roster"`, `ics=true`, `icf=true` |
| — `set -1` auf dieselbe Id, gegatet auf `1821-…` (inert, `:6373`) | — |
| — Pflichtkinder: Modelle / Choppa / Light Armour (`:6404`, `:6425`, `:6439`) | `0d44-66f5-eae1-bb16` (min `cd53-8606-5530-dbe3`) / `a199-353d-5f10-c4da` (min `d707-6a7b-03fe-e3d8`, max `2d4e-7468-78d3-fc5e`) / `ab64-4412-7454-4b8e` (min `10b8-4839-ddb4-4014`, max `a28c-90ff-44ec-daf9`) |
| **CategoryEntry „Orc boyz"** (`:23`) — das gezählte Ziel | **`344f-77ef-7238-f157`** |
| **SelectionEntry „Orc Boyz"** (`:3007`, `type="unit"`, Core primär) — einziger Träger dieser Kategorie | `ac23-b9d3-4046-23b7`, `categoryLink` `61ca-d64b-4a52-c623` (`:3017`) |
| — Pflichtkinder: Modelle / Choppa / Light Armour (`:3020`, `:3041`, `:3055`) | `cef0-77ce-8158-32d4` (min `158f-ed55-76f2-eba0`) / `f73d-18a2-089b-285e` (min `dbcc-2eb6-66d6-e785`, max `db48-8078-f3c8-6c29`) / `ee53-a14e-2084-9f87` (min `0b95-cef7-a64a-3172`, max `34cc-8bc4-9ef8-cd20`) |
| Kategorie „Core" (`.gst:372`) — Primärkategorie beider Einheiten, `min 2` (nicht assertiert) | `64bf-efb4-9978-26df` — `35c2-d478-392a-aeb1` |
| Kategorie „General" (`.gst:721`) — armeeweite Pflicht (nicht assertiert) | `a37e-7207-de6d-acb0` — `1077-7379-f142-f382` |
| Kontingente, in denen die beiden Einheiten verborgen sind (RRCC-R9) | `c248-eea0-b5c1-857b` / `59e1-efd7-af88-55a1` / `b26c-6f4c-34a5-dc0c` / `1f55-c922-66d8-08ef` / `03cc-8a3f-abd4-3c03` / `9f70-0506-b8c7-f2c4` |
