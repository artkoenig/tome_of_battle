# E2E-Regeln & Testkatalog: `modifier type="multiply"` auf eine Kostenart („Traditional Army", Dwarfs)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln,
Ids, Kostenwerte und Erwartungszahlen sind **ausschließlich aus den
Katalogdaten** der *6th Definitive Edition*
(`src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive/`) und der Formatspezifikation
([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md), §7.5,
§7.6, §7.7, §8) abgeleitet — nicht aus einem Engine-Lauf. Die Roster-Form ist an
den bestehenden Szenarien verifiziert (direktes `entryId`, `entryLinkId=""`,
verschachtelte `selections` mit `number`,
`<costLimits><costLimit typeId=…/></costLimits>` für das eingestellte Budget).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1, `.gst:2`) — Träger der Kostenart **`pts`**
  `ecfa-8486-4f6c-c249` (`.gst:13`, `defaultCostLimit="-1"`)
- Armeebuch: `Dwarfs (2005) (6th definitive edition).cat`
  (`a505-6b65-703b-4976`, Name „Dwarfs (2006)", rev 1, `.cat:2`) — Kontingent
  **„Standard (DW2-AB)"** `8bd9-db54-8bdc-cdfa` (`.cat:4`)
- Bibliothek: `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`) —
  per `catalogueLink` `1a0f-ac09-e659-9629` deklarierte Abhängigkeit der
  Dwarfs-`.cat` (`.cat:129-131`)

---

## Die Regel (In-World)

Der Katalog schreibt die Regel selbst hin — im `<comment>` des Modifikators:
**„Traditional Army", DW1-AB, p.53**. Drei Dwarfs-Kriegsmaschinen tragen einen
**identischen** Modifikator unter einer **identischen** Bedingung:

```xml
<modifier type="multiply" value="2" field="ecfa-8486-4f6c-c249">
  <conditions>
    <condition type="atLeast" value="1" field="selections" scope="force"
               childId="8424-9cb7-d1ca-56fe" shared="true" includeChildSelections="true"/>
  </conditions>
  <comment>&quot;Traditional Army&quot;, DW1-AB, p.53</comment>
</modifier>
```

`field` ist **keine** Constraint-Id, sondern die **Id einer Kostenart**
(`ecfa-8486-4f6c-c249` = `pts`, `.gst:13`) — laut
[§7.7, Modifier-Tabelle](../../battlescribe/building-blocks/modifier.md#77-modifier-condition-condition-group-repeat)
eine der erlaubten `field`-Belegungen (*Constraint-`id`* | *`<costTypeId>`* |
`hidden` | `name` | …). Der Modifikator ändert also die **`pts`-Kosten seines
Trägers**. `type="multiply"` ist die multiplikative Operation derselben Tabelle
(*„`increment`/`decrement`/`set`/`multiply` für numerische Felder"*); sie ist
upstream nicht spezifiziert und in der vendorten `Catalogue.xsd` dieses Projekts
bewusst ergänzt (siehe den Kasten *„Nicht offiziell spezifiziert
(`multiply`, `prepend`, `join`)"* in §7.7 und
[ADR 0016](../../adr/0016-battlescribe-xsd-als-vendored-konformitaetsquelle.md)).

Netto (In-World): *„Führt das Kontingent King Alrik Ranulfsson von Karak-Hirn,
verdoppelt sich der Preis jeder Dwarfs-Kriegsmaschine."*

Die entscheidende Aussage ist **Multiplikation, nicht Aufschlag**: `value="2"`
ist ein **Faktor** auf den Wert des Trägers, kein Summand. Auf einem einzigen
Träger sind beide Lesarten ununterscheidbar — deshalb liest dieser Satz **zwei
verschiedene Grundkosten** ab (140 und 120), die sich zu **verschiedenen** Zahlen
verdoppeln (280 und 240), während ein konstanter Aufschlag beide um denselben
Betrag anhöbe.

---

## Die Datenlage

```
catalogue "Dwarfs (2006)"  a505-6b65-703b-4976
  ├ forceEntry "Standard (DW2-AB)" 8bd9-db54-8bdc-cdfa                       (.cat:4)
  │    ├ categoryLink "Special list rules"  → 32f1-197f-d719-a393            (.cat:7)
  │    ├ categoryLink "Special Characters"  → 0644-bfcd-32c2-21dc            (.cat:8)
  │    └ categoryLink "Rare"                → e94b-6a54-8779-cd60            (.cat:14)
  ├ selectionEntry "Gyrocopter"   fe43-aa5e-3d37-9772   pts 140              (.cat:3199/3201)
  │    ├ selectionEntry "Steam gun" 7ef5-6a2c-59fd-452a  (ohne <costs> = 0)  (.cat:3210)
  │    └ modifier multiply 2 auf ecfa-8486-4f6c-c249, cond. atLeast 1 Alrik  (.cat:3227-3232)
  ├ selectionEntry "Organ Gun"    b767-3b91-f82d-efb6   pts 120              (.cat:3266/3268)
  │    ├ selectionEntry "Crew" c0da-410d-044a-75df  (ohne <costs> = 0)       (.cat:3277)
  │    └ modifier multiply 2 auf ecfa-8486-4f6c-c249, cond. atLeast 1 Alrik  (.cat:3320-3325)
  ├ selectionEntry "Flame Cannon" 6abc-75c5-412f-011d   pts 140              (.cat:3359/3361)
  │    └ modifier multiply 2 auf ecfa-8486-4f6c-c249, cond. atLeast 1 Alrik  (.cat:3440-3445)
  └ selectionEntry "King Alrik Ranulfsson of Karak-Hirn (WD#315-UK)"
                                  8424-9cb7-d1ca-56fe   pts 290              (.cat:4577/4579)
```

Die **Flame Cannon** kostet ebenfalls **140** pts und ist deshalb als zweite
Ablesung wertlos — sie verdoppelt sich auf dieselbe Zahl wie der Gyrocopter.
Als zweite, unabhängige Grundkoste dient darum die **Organ Gun** (120 → 240).

### Welches Kontingent alle Beteiligten anbietet

Alle drei Kriegsmaschinen tragen zusätzlich `set hidden="true"`-Modifikatoren,
die auf `instanceOf`-Prüfungen gegen **Sonderkontingente** gegated sind; King
Alrik trägt eine analoge Prüfung. Die Schnittmenge bestimmt das nutzbare
Kontingent:

| Eintrag | verstecken in Kontingent (`instanceOf`, `scope="force"`) | Beleg |
|---|---|---|
| Gyrocopter | `da11-3c95-580e-1a4f` (Throng of Karak Kadrin), `fe66-8f64-704f-dc84` (Royal Clan), `afe2-7534-0b67-5ee9` (Undgrin Ankor), `d18e-88cd-44b8-f527` (War of Vengeance), `f130-ff1b-2f7b-e49f` (Slayers of Karak Kadrin) | `.cat:3233-3245` |
| Organ Gun | `da11…`, `fe66…`, `ba06-a708-72aa-794b` (Overground Defence), `d18e…`, `f130…` | `.cat:3326-3338` |
| Flame Cannon | `da11…`, `fe66…`, `ba06…`, `afe2…`, `d18e…`, `f130…` | `.cat:3446-3459` |
| King Alrik | `4f36-662f-50dd-55fe` | `.cat:4717-4725` |
| Gyrocopter / Flame Cannon / King Alrik | zusätzlich: „Border Patrols rules" `4e15-0353-165f-5528` **irgendwo im Roster** (`scope="roster"`) | `.cat:3246-3250`, `:3460-3464`, `:4726-4730` |

**Ergebnis:** Das reguläre Kontingent **„Standard (DW2-AB)"**
`8bd9-db54-8bdc-cdfa` (`.cat:4`) steht in **keiner** dieser Listen; kein Roster
dieses Satzes wählt „Border Patrols rules". Damit sind Gyrocopter, Organ Gun
**und** King Alrik dort gleichzeitig verfügbar. Ebenfalls gemieden wird
„Guild Expedition (DW1-AB)" `37f8-30a3-8720-6b2c` — dessen `modifierGroup`
gliedert die Maschinen um und hebt bei Organ Gun/Flame Cannon zusätzlich eine
Grenze (`.cat:3252-3264`, `:3340-3354`, `:3466-3480`).

Zusätzlich verlangt die Sichtbarkeit von King Alrik den Schalter **„Allow
special characters?"** (`8923-5946-7b10-8957`, `.gst:1935`): die `categoryEntry`
*Special Characters* `0644-bfcd-32c2-21dc` trägt `set hidden="true"`, solange
dieser Schalter im Kontingent fehlt (`.gst:211-219`). Der Schalter ist im
Dwarfs-Katalog per Wurzel-`entryLink` `1829-8304-be4a-310c` eingebunden
(`.cat:7593`) und kostet **0 pts** (`.gst:1950`) — er steht deshalb in **allen
acht** Rostern, damit der einzige Unterschied innerhalb eines Paares King Alrik
selbst ist.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **MCTA-R1** | **`field` ist eine Kostenart, kein Constraint.** `ecfa-8486-4f6c-c249` ist der `costType` „pts" des Spielsystems und kommt nirgends als `constraint`-`id` vor. Der Modifikator ändert damit die `<cost>` seines Trägers, nicht eine Grenze. | `.gst:13` `<costType id="ecfa-8486-4f6c-c249" name="pts" defaultCostLimit="-1"/>`; erlaubte `field`-Belegungen [§7.7, Modifier-Tabelle](../../battlescribe/building-blocks/modifier.md#77-modifier-condition-condition-group-repeat) und [§13.2](../../battlescribe/reference/tables.md#132-der-field-wert-je-nach-kontext). |
| **MCTA-R2** | **`multiply` vervielfacht den bestehenden Wert.** `value="2"` ist ein Faktor, kein Summand: der wirksame Wert ist `Katalogwert × 2`. | [§7.7](../../battlescribe/building-blocks/modifier.md#77-modifier-condition-condition-group-repeat): *„`increment`/`decrement`/`set`/`multiply` für numerische Felder"*; Abgrenzung zu `set` ebenda (Issue-0095-Kasten: *„… genau darin unterscheidet es sich von `increment`/`decrement`/`multiply`, deren Wirkung der Wiederholungsfaktor vervielfacht"*). Kein `<repeats>` an diesen Modifikatoren → Faktor genau **einmal** angewandt. |
| **MCTA-R3** | **Der Träger ist die Einheit selbst, nicht die Armee.** Der Modifikator steht in `<modifiers>` **direkt an der Wurzel-`selectionEntry`** der Kriegsmaschine. Er ändert damit deren eigene `pts`, nicht die Summe der Liste und nicht die Kosten der Kinder. | `.cat:3226-3232` (Gyrocopter, `<modifiers>` als direktes Kind von `.cat:3199`), `:3319-3325` (Organ Gun), `:3439-3445` (Flame Cannon); Kostenmodell [§7.5](../../battlescribe/building-blocks/cost.md#75-cost--cost-type). |
| **MCTA-R4** | **Das Gatter ist force-skopiert und nennt genau einen Eintrag.** `atLeast 1`, `field="selections"`, `scope="force"`, `childId="8424-9cb7-d1ca-56fe"`, `shared="true"`, `includeChildSelections="true"` — die Bedingung hält genau dann, wenn im **selben Kontingent** mindestens eine Selektion King Alriks steht. `8424-9cb7-d1ca-56fe` ist `selectionEntry type="unit" name="King Alrik Ranulfsson of Karak-Hirn (WD#315-UK)"` desselben Katalogs. | `.cat:3229`, `:3322`, `:3442` (drei wortgleiche Bedingungen); Ziel `.cat:4577`. Ziel-Typ-Regel für `scope="force"` mit **Eintrags**-Ziel: zählt **pro Detachment** ([§7.6](../../battlescribe/building-blocks/constraint.md#76-constraint) / ADR 0029). |
| **MCTA-R5** | **Grundkosten (ohne Alrik):** Gyrocopter **140** pts, Organ Gun **120** pts, Flame Cannon **140** pts. Alle drei tragen daneben `Casting Dice 0` und `Dispel Dice 0`. | `.cat:3200-3204`, `:3267-3271`, `:3360-3364`. |
| **MCTA-R6** | **Verdoppelte Kosten (mit Alrik):** Gyrocopter **280**, Organ Gun **240**. Die Differenz der beiden Deltas (140 gegen 120) ist der Beweis der Multiplikation. | MCTA-R2 × MCTA-R5. |
| **MCTA-R7** | **Die Pflichtkinder der Träger sind kostenlos.** Gyrocopter → „Steam gun" (`min/max 1` `scope="parent"`) hat **kein** `<costs>`-Element; Organ Gun → „Crew" (`min/max 3` `scope="parent"`) ebenfalls nicht. Sie verändern die Summe nicht und werden trotzdem mitgewählt, um die Pflicht-Untergrenzen der Träger zu erfüllen. | `.cat:3210-3219` (Steam gun `7ef5-6a2c-59fd-452a`, `min 1` `4609-ccf4-1f81-6af2`, `max 1` `582a-99fd-1aac-13f2`, ohne `<costs>`); `.cat:3277-3281` (Crew `c0da-410d-044a-75df`, `min 3` `b2a2-4c1e-18a1-a15d`, `max 3` `e3f7-b33d-9b66-08b3`, ohne `<costs>`). |
| **MCTA-R8** | **King Alrik kostet 290 pts** und trägt selbst **keinen** Kosten-Modifikator — seine `<modifiers>` sind ein `add`/`error` und zwei `set hidden`. Sein Beitrag zur Summe ist damit in jedem Roster konstant. | `.cat:4578-4582` (`pts 290`), `.cat:4711-4731` (die drei Modifikatoren). |
| **MCTA-R9** | **Der Schalter „Allow special characters?" kostet 0 pts** und verschiebt keine Summe. Seine eigenen Grenzen sind `max 1` `scope="roster"` (`5036-e10c-2fd8-f135`) und zwei `min 0`-No-ops; seine Kinder sind sämtlich `min 0`, also optional. | `.gst:1935-1963` (Kosten `:1950`, Grenzen `:1937-1939`), Kinder `.gst:1965-2022` (alle `min 0` bzw. ohne `min`). |
| **MCTA-R10** | **Die Summe ist die Summe der tatsächlich gewählten Selektionen.** Ein `cost` hängt an einer Auswahl; nicht gewählte Pflichtoptionen tragen nichts bei (sie erzeugen nur unerfüllte Mindestgrenzen). | [§7.5](../../battlescribe/building-blocks/cost.md#75-cost--cost-type); dieselbe Rechenweise wie in [`at-most-roster-points-limit`](../at-most-roster-points-limit/README.md) (AMPL-R9) und [`orcs-and-goblins-budget`](../orcs-and-goblins-budget/README.md). |
| **MCTA-R11** | **Messgröße ist das Punktebudget.** Der Effekt ist eine Kosten-, keine Zählgröße; sichtbar wird er über die roster-weite Budget-Regel `budget::ecfa-8486-4f6c-c249`, die bei **strikter** Überschreitung der Summe über das eingestellte `<costLimit>` feuert (Summe = Limit feuert **nicht**). | [`orcs-and-goblins-budget`](../orcs-and-goblins-budget/README.md), OGB-R2 (Test 04/05: Ist 150 / Grenze 100 feuert, Ist 150 / Grenze 150 nicht); [`at-most-roster-points-limit`](../at-most-roster-points-limit/README.md), Roster 04. Kostenart `.gst:13`. |

### Rechnung je Bauform

| Bauform | Schalter | King Alrik | Kriegsmaschine (Katalog) | Bedingung `atLeast 1 Alrik` | wirksamer Preis | **Summe** |
|---|---|---|---|---|---|---|
| A (Gyrocopter, ohne Alrik) | 0 | — | 140 | **falsch** | 140 | **140** |
| B (Gyrocopter, mit Alrik) | 0 | 290 | 140 | **wahr** | 140 × 2 = **280** | **570** |
| C (Organ Gun, ohne Alrik) | 0 | — | 120 | **falsch** | 120 | **120** |
| D (Organ Gun, mit Alrik) | 0 | 290 | 120 | **wahr** | 120 × 2 = **240** | **530** |

### Was eine falsche Lesart produzieren würde

| Fehl-Lesart | Bauform A (140) | Bauform B (570) | Bauform C (120) | Bauform D (530) |
|---|---|---|---|---|
| Modifikator **ignoriert** (Kosten immer Katalogwert) | 140 → konform | 430 → bei Limit 569 **still statt feuern** → fällt auf | 120 → konform | 410 → bei Limit 529 **still statt feuern** → fällt auf |
| `multiply` als **`increment` um 2** gelesen | konform | 432 → **fällt auf** | konform | 412 → **fällt auf** |
| `multiply` als **`set` auf 2** gelesen | konform | 292 → **fällt auf** | konform | 292 → **fällt auf** |
| **Konstanter Aufschlag** in Höhe des Gyrocopter-Deltas (+140) | konform | 570 → zufällig konform | konform | 550 → bei Limit 531 **feuert statt still** → fällt auf |
| Modifikator **unbedingt** angewandt (Gatter ignoriert) | 280 → bei Limit 141 **feuert statt still** → fällt auf | konform | 240 → bei Limit 121 **feuert statt still** → fällt auf | konform |
| Faktor **zweimal** angewandt | konform | 850 → bei Limit 571 **feuert statt still** → fällt auf | konform | 770 → **fällt auf** |
| `field` als **Constraint-Id** missdeutet (Kosten unverändert) | konform | wie „ignoriert" → **fällt auf** | konform | wie „ignoriert" → **fällt auf** |

Jede der vier Bauformen steht **zweimal** im Satz: einmal mit
`costLimit = Summe − 1` (die Budget-Regel **muss** feuern und meldet die Summe
als `actual`) und einmal mit `costLimit = Summe + 1` (sie **darf nicht** feuern).
Das klammert die Summe beidseitig auf genau einen Wert ein — eine zu kleine
**und** eine zu große Rechnung fallen auf.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle laufen gegen
denselben Datensatz (`.gst` + Dwarfs-`.cat` + Mercenaries-`.cat`) und dasselbe
Kontingent „Standard (DW2-AB)" `8bd9-db54-8bdc-cdfa`.

> **Assertion-Fokus:** ausschließlich die roster-weite Budget-Grenze
> `budget::ecfa-8486-4f6c-c249`. Andere Armeeaufbau-Diagnosen dürfen zusätzlich
> auftreten und sind hier ohne Belang (selektive Erwartung, Manifest-Vertrag);
> sie stehen bewusst **nicht** in `absent`. Namentlich: die Core-Pflicht
> `35c2-d478-392a-aeb1` und die General-Pflicht `1077-7379-f142-f382` (kein
> Roster führt Core-Einheiten oder einen General), die Sonderhelden-Grenze
> `3751-1529-9d9d-46c3` King Alriks, die vier `min 1`-Pflichten seiner
> Magic-Items-Gruppe sowie die `min 1`-Pflichten der Organ-Gun-Ausrüstung
> (siehe „Was bewusst nicht Teil der Erwartung ist").

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | Gyrocopter allein — Grundpreis 140 | Schalter + Gyrocopter (+ Steam gun), **ohne** Alrik; `costLimit` **139**. | **MCTA-R5:** Das Gatter hält nicht, der Gyrocopter kostet 140. Die Budget-Regel feuert **Ist 140 / Grenze 139**. | [`01-gyrocopter-plain-limit-139.ros`](rosters/01-gyrocopter-plain-limit-139.ros) |
| 02 | Dieselbe Liste, ein Punkt Luft | **Identischer** Aufbau, `costLimit` **141**. | Summe 140 ≤ 141 → Budget-Regel **still**. Zusammen mit 01 ist die Summe auf genau 140 eingeklammert. | [`02-gyrocopter-plain-limit-141.ros`](rosters/02-gyrocopter-plain-limit-141.ros) |
| 03 | Gyrocopter mit King Alrik — 280 statt 140 | Aufbau von 01 **plus** King Alrik (290); `costLimit` **569**. | **MCTA-R6:** Das Gatter hält, der Gyrocopter kostet 140 × 2 = 280. Budget-Regel feuert **Ist 570 / Grenze 569**. | [`03-gyrocopter-alrik-limit-569.ros`](rosters/03-gyrocopter-alrik-limit-569.ros) |
| 04 | Dieselbe Liste, ein Punkt Luft | **Identischer** Aufbau, `costLimit` **571**. | Summe 570 ≤ 571 → Budget-Regel **still**. Schließt eine Mehrfachanwendung des Faktors aus. | [`04-gyrocopter-alrik-limit-571.ros`](rosters/04-gyrocopter-alrik-limit-571.ros) |
| 05 | Organ Gun allein — Grundpreis 120 | Schalter + Organ Gun (+ 3 Crew), **ohne** Alrik; `costLimit` **119**. | **MCTA-R5:** Grundpreis 120. Budget-Regel feuert **Ist 120 / Grenze 119**. Zweite, von 140 verschiedene Grundkoste. | [`05-organ-gun-plain-limit-119.ros`](rosters/05-organ-gun-plain-limit-119.ros) |
| 06 | Dieselbe Liste, ein Punkt Luft | **Identischer** Aufbau, `costLimit` **121**. | Summe 120 ≤ 121 → Budget-Regel **still**. | [`06-organ-gun-plain-limit-121.ros`](rosters/06-organ-gun-plain-limit-121.ros) |
| 07 | Organ Gun mit King Alrik — 240 statt 120 | Aufbau von 05 **plus** King Alrik (290); `costLimit` **529**. | **MCTA-R6:** 120 × 2 = 240. Budget-Regel feuert **Ist 530 / Grenze 529**. **Der Fall, der Multiplikation von konstantem Aufschlag trennt** (+140 ergäbe 550). | [`07-organ-gun-alrik-limit-529.ros`](rosters/07-organ-gun-alrik-limit-529.ros) |
| 08 | Dieselbe Liste, ein Punkt Luft | **Identischer** Aufbau, `costLimit` **531**. | Summe 530 ≤ 531 → Budget-Regel **still**. Ein Aufschlag von +140 (Summe 550) würde hier feuern. | [`08-organ-gun-alrik-limit-531.ros`](rosters/08-organ-gun-alrik-limit-531.ros) |

### Herleitung der Zahlen

- **`bound`** ist in jedem Roster der Wert des `<costLimit typeId="ecfa-8486-4f6c-c249">`
  am Wurzelelement — 139 / 141 / 569 / 571 / 119 / 121 / 529 / 531.
- **`actual`** ist die verplante `pts`-Summe nach MCTA-R10:
  - Roster 01/02: `0` (Schalter) + `140` (Gyrocopter) + `0` (Steam gun) = **140**
  - Roster 03/04: `0` + `290` (Alrik) + `140 × 2` + `0` = **570**
  - Roster 05/06: `0` + `120` (Organ Gun) + `3 × 0` (Crew) = **120**
  - Roster 07/08: `0` + `290` + `120 × 2` + `3 × 0` = **530**
- Die Kostenarten *Casting Dice* (`fcec-2340-6368-a2ba`) und *Dispel Dice*
  (`6001-b2bf-4529-c07d`) sind an allen gewählten Einträgen **0** und in keinem
  Roster mit einem `<costLimit>` versehen — es gibt zu ihnen keine Budget-Grenze.

### Was bewusst **nicht** Teil der Erwartung ist

| Facette | Warum nicht |
|---------|-------------|
| Die `set hidden="true"`-Modifikatoren derselben drei Einträge (`.cat:3233`, `:3246`, `:3326`, `:3446`, `:3460`) und der `hidden`-Gate der `categoryEntry` *Special Characters* (`.gst:213`). | **Verfügbarkeit, keine zählende Grenze.** Der Verletzungsbericht kodiert keine (Un-)Sichtbarkeit — dieselbe Zurückhaltung wie in [`vampire-bloodlines`](../vampire-bloodlines/README.md) (VBL-R4/R5). Hier werden sie nur benutzt, um das *richtige* Kontingent zu wählen: in „Standard (DW2-AB)" hält **keine** ihrer Bedingungen. |
| Der `modifierGroup` „Guild Expedition" der drei Einträge (`.cat:3252-3264`, `:3340-3354`, `:3466-3480`) — `set-primary`/`add`/`remove category` und `set` auf `49a9-b21a-b549-daa7` bzw. `bd01-3e58-1433-7775`. | Eigene Zellen (Kategorie-Modifikatoren, `set` auf Grenzen). Ihre Bedingung ist `instanceOf` gegen das Kontingent `37f8-30a3-8720-6b2c`; die Roster nutzen `8bd9-db54-8bdc-cdfa`, sie bleiben also **inert**. |
| Die Sonderhelden-Grenze King Alriks: `constraint type="max" value="0" field="selections" scope="force" id="3751-1529-9d9d-46c3"` (`.cat:4709`). | Die Id kommt im ganzen Datensatz **genau einmal** vor — es gibt **keinen** Modifikator, der sie hebt (anders als bei den Schwestern `ffec-3fe8-153f-f682` `.cat:1404/1407` und `4026-8c10-6935-7b9b` `.cat:5688/5696`). Mit einer Alrik-Selektion im Kontingent ist sie folglich unerfüllbar. Das ist eine **Eigenheit der Katalogdaten** und nicht Gegenstand dieses Szenarios; die Grenze steht darum weder in `firing` noch in `absent`. Die Zelle „`max 0` + gegatterter `set`" pinnt [`at-most-roster-points-limit`](../at-most-roster-points-limit/README.md). |
| Die `error`-Meldung King Alriks (`.cat:4712`, *„Please enable ‚Allow special characters?'"*). | Eigene Zelle (`modifier add field="error"`), bereits gepinnt von [`author-message-severity`](../author-message-severity/README.md). Ihre Bedingung (`lessThan 1` auf `8923-5946-7b10-8957`, `scope="force"`) ist in **allen** acht Rostern falsch, weil der Schalter überall gewählt ist. |
| Die vier `min 1`-`scope="parent"`-Pflichten der Gruppe „Magic Items" King Alriks (`0966-7368-f2bd-538b`, `.cat:4592-4697`). | Sie sind für den gemessenen Effekt irrelevant und würden die Summe verfälschen: der `entryLink` „Master Rune of Challenge" `9630-3450-116e-0c49` (`.cat:4693`) trägt **kein** eigenes `<costs>`, während sein Ziel `bb8d-7f83-d404-2c06` **25 pts** kostet (`.cat:7005-7006`) — ob ein Verweis ohne eigene Kosten auf die Kosten seines Ziels zurückfällt, legt [§7.2](../../battlescribe/building-blocks/links.md#72-entry-link-info-link-category-link) nicht eindeutig fest (*„die Kosten liegen am Link, nicht an der Definition"*). Diese Unschärfe wird gemieden, indem die Gruppe **nicht** bestückt wird; ihre unerfüllten Mindestgrenzen sind toleriertes Beiwerk. |
| Die `min 1`-Pflichten der Organ-Gun-Ausrüstung („Light Armour" `fd2f-89a8-90a5-a124`, „Hand Weapon" `38f3-bfb8-9466-4704`, `.cat:3292-3303`). | Beide Ziele kosten **0 pts** (`.gst:958-959`, `:1040-1041`), verändern die Summe also nicht. Sie sind `entryLink`s; ihre Kodierung in einer `.ros` ist in den bestehenden Szenarien nicht belegt (alle dortigen Roster wählen inline-`selectionEntry`s über deren eigene `entryId`). Statt eine Konvention zu erfinden, bleiben sie ungewählt — die dadurch unerfüllten Mindestgrenzen sind toleriertes Beiwerk. |
| Die **Flame Cannon** (`6abc-75c5-412f-011d`, `.cat:3359`). | Trägt denselben Modifikator unter derselben Bedingung, kostet aber wie der Gyrocopter **140** pts und liefert damit keine zusätzliche Ablesung. Sie ist hier nur **Beleg** dafür, dass das Muster im Katalog dreifach vorkommt. Ihre Option „Flaming attacks" (`7284-2bf0-735d-399d`) trüge zudem eine `warning`-Meldung (`.cat:3412`) — eigene Zelle, gepinnt von [`author-message-severity`](../author-message-severity/README.md). |
| Der `entryLink` „General" King Alriks (`7aff-c872-2112-77ad` → `1b7c-2c90-6d96-28c9`, `.cat:4584`) und damit die General-Pflicht der `.gst`. | Optional (keine `min`-Grenze); ungewählt, damit alle acht Roster in ihrer Nicht-Alrik-/Alrik-Ausprägung strukturgleich bleiben. Die General-Pflicht feuert dadurch in **allen** Rostern gleichermaßen — toleriertes Beiwerk. |
| Punkteskalierende Kategorie-Grenzen der `.gst` (Lord/Core/Rare, `.gst:220 ff.`). | Beiwerk des Armeeaufbaus; die Erwartung ist selektiv. Sie greifen keine Kostenart an und können den gemessenen `actual` nicht verschieben. |

---

## Abgleich mit dem Engine-Bericht (Runner-Verifikation)

Die oben aus den Katalogdaten **abgeleiteten** Erwartungen treffen die Engine
erst im **Runner-Lauf** — der separate Verifikationsschritt, der nicht zur
(blinden) Autorenschaft gehört (siehe
[ADR 0033](../../adr/0033-evaluator-e2e-manifest-runner-und-black-box-autorenschaft.md)).
Abweichungen sind zu **untersuchen**, nicht durch Anpassen der Erwartung
wegzudefinieren. Die erwartungsgemäß heiklen Stellen:

1. **MCTA-R2/R6** — ob `multiply` den bestehenden Kostenwert wirklich
   **vervielfacht**. Roster 07 ist der Kernfall: nur eine echte Multiplikation
   liefert 240 (und damit Summe 530); jeder konstante Aufschlag, der beim
   Gyrocopter passt (+140), liefert hier 550 und fällt an Roster 08 auf.
2. **MCTA-R3** — ob der Faktor **nur den Träger** trifft und nicht die
   Kostensumme des Kontingents (dann wären die Alrik-Roster 860 bzw. 820).
3. **MCTA-R4** — ob das force-skopierte Gatter ohne King Alrik **nicht** hält
   (Roster 02/06 müssen still bleiben) und mit ihm hält (Roster 03/07 müssen
   feuern).
4. **MCTA-R10/R11** — ob die Budget-Regel die Summe der **gewählten**
   Selektionen misst; nicht gewählte Pflichtoptionen (Magic Items, Organ-Gun-
   Ausrüstung) dürfen nichts beitragen.
5. Die Grenz-Id der Budget-Regel: `budget::ecfa-8486-4f6c-c249`, roster-weit,
   strikte Überschreitung — bei `costLimit = Summe + 1` darf sie nicht feuern.

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Spielsystem WHFB 6th definitive (`.gst:2`) | `0d13-7737-ea86-4662` |
| Katalog **Dwarfs (2006)** (`.cat:2`) | `a505-6b65-703b-4976` |
| Bibliothek **Mercenaries** (per `catalogueLink` `1a0f-ac09-e659-9629`, `.cat:130`) | `fc47-8392-a6c8-452a` |
| `costType` „pts" (`.gst:13`) — Ziel des `multiply`-`field` | `ecfa-8486-4f6c-c249` |
| `costType` „ Casting Dice" / „ Dispel Dice" (`.gst:14`/`:15`, überall 0) | `fcec-2340-6368-a2ba` / `6001-b2bf-4529-c07d` |
| ForceEntry **„Standard (DW2-AB)"** (`.cat:4`) — keines der `hidden`-Gatter | `8bd9-db54-8bdc-cdfa` |
| — dessen `categoryLink` *Special list rules* (`.cat:7`) | `6a6b-c44c-7f1d-b673` → `32f1-197f-d719-a393` |
| — dessen `categoryLink` *Special Characters* (`.cat:8`) | `1a6b-a33a-ab73-5c16` → `0644-bfcd-32c2-21dc` |
| — dessen `categoryLink` *Rare* (`.cat:14`) | `7fb5-451f-068f-e701` → `e94b-6a54-8779-cd60` |
| SelectionEntry **„Gyrocopter"** (`.cat:3199`, `type="unit"`, `pts 140` `.cat:3201`) | `fe43-aa5e-3d37-9772` |
| — dessen `multiply 2` auf `ecfa-8486-4f6c-c249` (`.cat:3227`), Kommentar „Traditional Army", DW1-AB, p.53 | (unbenannt) |
| — dessen Pflichtoption „Steam gun" (`.cat:3210`, ohne `<costs>`; `min 1` / `max 1` parent) | `7ef5-6a2c-59fd-452a` — `4609-ccf4-1f81-6af2` / `582a-99fd-1aac-13f2` |
| SelectionEntry **„Organ Gun"** (`.cat:3266`, `type="unit"`, `pts 120` `.cat:3268`) | `b767-3b91-f82d-efb6` |
| — dessen `multiply 2` (`.cat:3320`), identische Bedingung | (unbenannt) |
| — dessen Pflichtbesatzung „Crew" (`.cat:3277`, ohne `<costs>`; `min 3` / `max 3` parent) | `c0da-410d-044a-75df` — `b2a2-4c1e-18a1-a15d` / `e3f7-b33d-9b66-08b3` |
| — deren Ausrüstungsgruppe (`.cat:3290`) mit `entryLink`s Light Armour / Hand Weapon (je 0 pts, ungewählt) | `2909-ca1b-f4d6-e424` — `bba6-25c5-a724-c31f` → `055f-8e4e-f170-35d2`, `4315-ddbf-95ea-c122` → `abdb-bbd0-41b2-5dff` |
| SelectionEntry **„Flame Cannon"** (`.cat:3359`, `pts 140` `.cat:3361`, `multiply` `.cat:3440`) — Beleg, nicht Testgegenstand | `6abc-75c5-412f-011d` |
| SelectionEntry **„King Alrik Ranulfsson of Karak-Hirn (WD#315-UK)"** (`.cat:4577`, `pts 290` `.cat:4579`) | `8424-9cb7-d1ca-56fe` |
| — dessen `max 0`-Grenze `scope="force"` (`.cat:4709`, ohne hebenden Modifikator; toleriert) | `3751-1529-9d9d-46c3` |
| — dessen Gruppe „Magic Items" (`.cat:4592`, vier `min 1` parent; ungewählt) | `0966-7368-f2bd-538b` |
| — dessen `entryLink` „General" (`.cat:4584`, optional, ungewählt) | `7aff-c872-2112-77ad` → `1b7c-2c90-6d96-28c9` |
| Schalter **„Allow special characters?"** (`.gst:1935`, `pts 0` `.gst:1950`), im Dwarfs-Katalog per Wurzel-`entryLink` `1829-8304-be4a-310c` (`.cat:7593`) | `8923-5946-7b10-8957` |
| — dessen `max 1` `scope="roster"` (`.gst:1937`) | `5036-e10c-2fd8-f135` |
| Kategorie *Special Characters* (`.gst:211`) mit `set hidden=true`, solange der Schalter fehlt (`.gst:213-217`) | `0644-bfcd-32c2-21dc` |
| Kategorien *Rare* / *War Machine* / *Lord* / *Characters* | `e94b-6a54-8779-cd60` / `f672-d9d4-a601-479a` / `d024-d25b-a9b4-73b6` / `7a1c-d611-c2dc-def1` |
| Sonderkontingente der `hidden`-Gatter (alle gemieden) | `da11-3c95-580e-1a4f`, `fe66-8f64-704f-dc84`, `ba06-a708-72aa-794b`, `afe2-7534-0b67-5ee9`, `d18e-88cd-44b8-f527`, `f130-ff1b-2f7b-e49f`, `37f8-30a3-8720-6b2c`, `4f36-662f-50dd-55fe` |
| „Border Patrols rules" (roster-weites `hidden`-Gatter; in keinem Roster gewählt) | `4e15-0353-165f-5528` |
| Budget-Grenze (Engine-Regel, roster-weit) — die einzige behauptete Grenze | `budget::ecfa-8486-4f6c-c249` |
