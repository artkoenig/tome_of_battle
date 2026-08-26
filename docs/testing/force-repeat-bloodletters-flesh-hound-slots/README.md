# E2E-Regeln & Testkatalog: `<repeat scope="force" childId="<Eintrags-Id>">` — die Flesh-Hound-Slots je Bloodletters-Einheit

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln,
Constraint-Ids und Erwartungswerte sind **ausschließlich aus den Katalogdaten**
der *6th Definitive Edition* (`src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive/`)
und der Formatspezifikation
([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md),
§5.6, §7.6, §7.7, §8, §13.1/13.2) sowie dem
[BSData-Wiki-Submodul](../../bsdata-catalogue-development-wiki/Data-structure-overview.md)
abgeleitet — nicht aus einem Engine-Lauf. Die Roster-Gestalt ist an den
bestehenden Szenarien verifiziert (direktes `entryId` mit `entryLinkId=""` beim
Wurzeleintrag, `entryLinkId` beim verlinkten Kind, verschachtelte `selections`
mit `number`, `<costLimits><costLimit typeId=…/></costLimits>` für das
eingestellte Budget — vgl.
[`at-least-roster-limit-lord-slots`](../at-least-roster-limit-lord-slots/rosters/01-limit-999-lord-max-0.ros)
und [`roster-repeat-category-count`](../roster-repeat-category-count/rosters/04-two-orc-boyz-three-big-uns-max-two-fires.ros)).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1, `.gst` Z. 2) — Träger der Kostenart **`pts`**
  `ecfa-8486-4f6c-c249`
- Armeebuch: `Forces of Chaos (6th definitive edition).cat`
  (`6b83-a975-a500-41c3`, rev 1, `.cat` Z. 2) — Kontingente
  **„Daemonic Legion (SoC)"** `93f4-7522-86e9-7d45` (`.cat` Z. 17377) und
  **„Standard (HC-AB + BC-AB)"** `d403-5cc9-152c-2093` (`.cat` Z. 17353)
- Bibliothek: `Mercenaries (6th definitive edition).cat`
  (`fc47-8392-a6c8-452a`, `library="true"`) — per `catalogueLink`
  `b824-6470-4943-f4bc` (`.cat` Z. 17606) deklarierte Abhängigkeit des
  Chaos-Katalogs; im Szenario selbst nicht benutzt, aber Teil des Datensatzes

---

## Die Regel (In-World)

Ein `<repeat>` an einem Modifikator lässt diesen *„multiple times"* greifen —
**einmal je gezähltem Schritt** seiner Query
([§7.7](../../battlescribe-data-format.md#repeat--modifier-mehrfach-anwenden)).
Zählrahmen und Zählgegenstand stehen in denselben Attributen wie bei einer
Condition oder einem Constraint (`field`, `scope`, `childId`, `shared`,
`includeChild…`); das Datenformat unterscheidet `scope` **nicht** nach Query-Art
([§7.7](../../battlescribe-data-format.md#condition--eine-voraussetzung), ADR 0029).

Hier ist die Query eine **Eintrags**-Zählung im **Kontingent**:
`field="selections" scope="force" childId="7dc4-fb32-003b-c289"` — gezählt wird
die Wurzel-Einheit *Bloodletters*, und weil das Ziel ein **Eintrag** und keine
Kategorie ist, zählt sie **je Kontingent**
([§7.6](../../battlescribe-data-format.md#76-constraint), Ziel-Typ-Regel). Mit
`value="1" repeats="1" roundUp="false"` ist die Zahl der Anwendungen
`floor(N / 1) × 1 = N`; der Modifikator ist ein `increment 1`, dessen Wirkung der
Faktor vervielfacht (ein wiederholter `set` bliebe idempotent —
[§7.7, Kasten „Ein wiederholter `set` wächst nicht"](../../battlescribe-data-format.md#repeat--modifier-mehrfach-anwenden)).

In-World: *„In einer Dämonenlegion bringt jede Einheit Bloodletters einen
Slot für eine Einheit Flesh Hounds mit; außerhalb einer Dämonenlegion gibt es
für Flesh Hounds gar keine Obergrenze."*

---

## Die Datenlage: die Wurzel-Einheit „Flesh Hounds"

```
selectionEntry "Flesh Hounds"  eaf6-a701-f67e-7c26   type="unit"       .cat Z. 5790
 ├ constraint  max 0  field="selections"  scope="force"  shared="true"
 │             includeChildSelections="false"   id="7f35-5f3f-42c9-be19"  .cat Z. 5886
 ├ modifier set  hidden="true"                                          .cat Z. 5792
 │    └ conditionGroup or → condition instanceOf force f1d2-… (Archaon's Horde)
 ├ modifier set  value="-1"  field="7f35-5f3f-42c9-be19"                .cat Z. 5801
 │    └ condition notInstanceOf  selections  scope="force"
 │                childId="93f4-7522-86e9-7d45"    <!-- If NOT Daemonic Legion -->
 ├ modifier increment value="1"  field="7f35-5f3f-42c9-be19"            .cat Z. 5807
 │    ├ condition instanceOf  selections  scope="force"
 │    │            childId="93f4-7522-86e9-7d45"   <!-- If Daemonic Legion -->
 │    └ repeat    value="1" repeats="1"  field="selections"  scope="force"
 │                childId="7dc4-fb32-003b-c289"  shared="true" roundUp="false"
 │                includeChildSelections="true" includeChildForces="true"  .cat Z. 5812
 ├ selectionEntry "Flesh hound"  51c0-1582-976e-d0bb  type="model"      .cat Z. 5828
 │    ├ constraint min 5   scope="parent"   id="ded6-a8de-3d2f-f4c8"    .cat Z. 5830
 │    ├ constraint max -1  scope="parent"   id="1429-53b5-f82f-7df3"    .cat Z. 5831
 │    └ cost 16 pts                                                     .cat Z. 5836
 └ modifierGroup "CORE" (instanceOf Daemonic Legion or Daemon General im Kontingent)
      └ remove/add/set-primary category → Core 64bf-…                   .cat Z. 5855
```

Die gezählte Einheit:

```
selectionEntry "Bloodletters"  7dc4-fb32-003b-c289  type="unit"         .cat Z. 5634
 ├ modifier set hidden="true"  ← conditionGroup or: atLeast 1 Morghur 1d54-… (force)
 │                                oder instanceOf force f1d2-… (Archaon's Horde)  Z. 5641
 ├ selectionEntry "Bloodletter" f260-1878-a029-72d3  type="model"       .cat Z. 5673
 │    ├ constraint min 10  scope="parent"  id="4cac-43ad-ee07-745f"     .cat Z. 5675
 │    └ cost 16 pts                                                     .cat Z. 5681
 ├ entryLink "Hand Weapon"   b34f-43d3-bb62-363d → abdb-… (.gst Z. 1032, 0 pts)
 │    └ min 1 / max 1  scope="parent"  1223-261b-447b-79b9 / ccd0-…     .cat Z. 5701
 └ entryLink "Light Armour"  c1a8-c1b7-857e-1d9e → 055f-… (.gst Z. 951, 0 pts)
      └ min 1 / max 1  scope="parent"  ca8b-df40-04bb-1640 / 2477-…     .cat Z. 5707
```

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **FRBFH-R1** | **Basis:** Die Flesh Hounds tragen genau **eine** Grenze: `max 0` Auswahlen, `field="selections"`, `scope="force"`, `shared="true"`, `includeChildSelections="false"`. `actual` ist die Zahl der Flesh-Hounds-Auswahlen **im Kontingent**, `bound` der wirksame `value`. Ohne jeden Modifikator ist der Eintrag also **gar nicht** wählbar. | `.cat` Z. 5886. Zählregel [§7.6](../../battlescribe-data-format.md#76-constraint): Eintragsziel bei `scope="force"` ⇒ pro Kontingent. |
| **FRBFH-R2** | **Genau zwei Schreiber.** Die Id `7f35-5f3f-42c9-be19` kommt im gesamten Fixture-Datensatz **dreimal** vor: als Grenze (Z. 5886) und als `field` der beiden Modifikatoren (Z. 5801, 5807). Kein weiterer Katalog schreibt darauf; die Rechnung ist damit vollständig. | Grep über `src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive/` auf `7f35-5f3f-42c9-be19` → 3 Treffer, alle in `Forces of Chaos`. |
| **FRBFH-R3** | **Die beiden Schreiber schließen einander aus.** Der `set -1` hält per `notInstanceOf` auf `93f4-7522-86e9-7d45` genau dann, wenn das Kontingent **nicht** die Daemonic Legion ist; der `increment 1` per `instanceOf` genau dann, wenn es sie **ist**. In keinem Kontingent greifen beide, die Schreibreihenfolge ist deshalb ohne Belang. | `.cat` Z. 5803 (`notInstanceOf`) und Z. 5809 (`instanceOf`); Kodierung „`scope="force"` + Force-Id in `childId`" ist die **kanonische** Instanzprüfung ([§7.7, Kasten](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat)). |
| **FRBFH-R4** | **Der `<repeat>` staffelt den `increment` je Bloodletters-Einheit.** `value="1" repeats="1" roundUp="false"` ⇒ `floor(N / 1) × 1 = N` Anwendungen, wobei `N` die im Kontingent gezählten Auswahlen des Eintrags `7dc4-fb32-003b-c289` sind. Wirksames Maximum in der Daemonic Legion: **`0 + N`**. | `.cat` Z. 5812; [§7.7](../../battlescribe-data-format.md#repeat--modifier-mehrfach-anwenden) und [BSData-Wiki, *Repeat*](../../bsdata-catalogue-development-wiki/Data-structure-overview.md). |
| **FRBFH-R5** | **`childId` ist eine Eintrags-Id, kein Kategorie- und kein Typ-Schlüsselwort.** `7dc4-fb32-003b-c289` ist die Wurzel-Einheit „Bloodletters"; die Id benennt im ganzen Datensatz keine Kategorie und kein Kontingent. Gezählt werden also **nur** Bloodletters-Auswahlen — die Flesh Hounds selbst (dieselbe Kategorie, dasselbe Khorne-Tag) erhöhen ihr eigenes Maximum **nicht**. | `.cat` Z. 5634 (Definition); `childId`-Bedeutung [§13.2](../../battlescribe-data-format.md#132-der-field-wert-je-nach-kontext). Gegenprobe: Roster 01 hat eine Flesh-Hounds-Auswahl und trotzdem `bound 0`. |
| **FRBFH-R6** | **`number` ist die Stückzahl.** Das `number` einer `.ros`-Auswahl ist die **absolute Gesamtstückzahl**; jeder Knoten trägt sie unverrechnet bei. Eine Flesh-Hounds-Auswahl mit `number="3"` ist damit `actual 3`, drei getrennte Bloodletters-Auswahlen mit je `number="1"` sind `N = 3`. | [§7.5, Kasten „Zahlenbasis"](../../battlescribe-data-format.md#75-cost--cost-type); gepinnt in [`roster-repeat-category-count`](../roster-repeat-category-count/README.md) (Roster 04/05). |
| **FRBFH-R7** | **Außerhalb der Daemonic Legion ist die Grenze aufgehoben.** Der `set -1` schreibt den Sentinel **hin** — und *„`-1` bedeutet ‚unbegrenzt' genau dort, wo er **hingeschrieben** steht — … am `value` eines `set`-Modifiers auf einen Constraint"*. Das wirksame Maximum ist also **keines** (`effectiveMax: null`), nicht „nichts erlaubt". | `.cat` Z. 5801; [§7.6, Sentinel-Kasten](../../battlescribe-data-format.md#76-constraint) (Issue 079). Gleiche Projektion wie beim geschriebenen `max -1` in [`unit-scope-repeat-knight-markup`](../unit-scope-repeat-knight-markup/scenario.json). |
| **FRBFH-R8** | **Beide Einheiten sind in beiden benutzten Kontingenten sichtbar.** Die Flesh Hounds verbergen sich nur bei `instanceOf` **„Archaon's Horde (SoC)"** `f1d2-edba-0f35-030a`, die Bloodletters zusätzlich, wenn **Morghur** `1d54-5b22-90c0-96c4` im Kontingent steht. Kein Roster nutzt dieses Kontingent oder diesen Charakter; beide Basis-`hidden` sind `false`, und die Roster wählen die Wurzeleinträge direkt (kein `entryLink`, dessen `hidden` mit-oderte). | `.cat` Z. 5792–5799 und Z. 5641–5649; `hidden`-Komposition [§8](../../battlescribe-data-format.md#8-kategorien--sichtbarkeit); `forceEntry` `f1d2-…` Z. 17487. |
| **FRBFH-R9** | **Wirksame Flesh-Hounds-Grenze je Kontingent und Bloodletters-Zahl:** Daemonic Legion — `N=0 → 0`, `N=1 → 1`, `N=2 → 2`, `N=3 → 3`; „Standard (HC-AB + BC-AB)" — **unbegrenzt**, unabhängig von `N`. | FRBFH-R1 bis R7 kombiniert. |
| **FRBFH-R10** | **Die Roster sind katalogkonform gebaut.** Jede Bloodletters-Einheit führt 10 Modelle (`min 10`, Z. 5675), eine *Hand Weapon* und eine *Light Armour* (je `min 1`/`max 1` am Verweis, Z. 5701/5707); jede Flesh-Hounds-Einheit führt 5 Modelle (`min 5`, Z. 5830). Die Flesh Hounds tragen **keine** Pflicht-`entryLinks`. | `.cat` Z. 5673–5711 und Z. 5827–5849. |
| **FRBFH-R11** | **Das Budget wird nie überschritten.** Eine Bloodletters-Einheit kostet 0 + 10 × 16 = **160** pts (Hand Weapon und Light Armour je 0 pts, `.gst` Z. 1041/959), eine Flesh-Hounds-Einheit 0 + 5 × 16 = **80** pts. Größte Summe: Roster 05 mit 3 × 160 + 3 × 80 = **720** pts gegen ein eingestelltes Budget von **3000** pts. Die Aussage hält unter beiden Lesarten der Eltern-Multiplikation ([§7.5](../../battlescribe-data-format.md#75-cost--cost-type)). | `.cat` Z. 5681 und Z. 5836; `costType` „pts" `ecfa-8486-4f6c-c249`. |

### Wahrheitstafel — die Grenze `7f35-5f3f-42c9-be19` je Roster

| Roster | Kontingent | Bloodletters `N` | Flesh Hounds `number` | `set -1`? | `increment`-Gatter? | `repeat`-Faktor | wirksame Grenze | Ist | Ergebnis |
|---|---|---|---|---|---|---|---|---|---|
| 01 | Daemonic Legion | **0** | 1 | ✗ | ✓ | **0** | **0** (Basis) | 1 | feuert |
| 02 | Daemonic Legion | **1** | 2 | ✗ | ✓ | **1** | **1** | 2 | feuert |
| 03 | Daemonic Legion | **2** | 2 | ✗ | ✓ | **2** | **2** | 2 | still |
| 04 | Daemonic Legion | **2** | 3 | ✗ | ✓ | **2** | **2** | 3 | feuert |
| 05 | Daemonic Legion | **3** | 3 | ✗ | ✓ | **3** | **3** | 3 | still |
| 06 | Standard | **0** | 2 | ✓ | ✗ | – | **unbegrenzt** | 2 | still |
| 07 | Standard | **2** | 3 | ✓ | ✗ | – | **unbegrenzt** | 3 | still |

Die Leiter wird **zweimal von unten gestraddelt** (03 still / 04 feuert bei
demselben `N`, 04 feuert / 05 still bei derselben Flesh-Hounds-Zahl), und die
Paare 01/02 sowie 04/07 isolieren je genau eine Ursache.

### Was eine falsche Lesart produzieren würde

| Fehl-Lesart | fällt auf bei |
|---|---|
| `<repeat>` **ignoriert** (Modifikator nur einmal angewendet) | Roster 03 (Grenze 1 statt 2 → feuerte) und 05 (Grenze 1 statt 3 → feuerte). |
| `<repeat>` als **Bedingung** gelesen („mindestens ein Bloodletters ⇒ +1") | Roster 03 und 05 — die Grenze bliebe bei 1. |
| `repeat`-Faktor **aufgerundet** oder um eins verschoben | Roster 01 (Faktor 1 statt 0 ⇒ Grenze 1, kein Verstoß) bzw. Roster 04 (Grenze 3 statt 2). |
| `childId` als **Kategorie** gelesen (Special/Core bzw. Khorne) | Roster 01 — die Flesh Hounds zählten sich selbst, Grenze ≥ 1, kein Verstoß. |
| `scope="force"` als **roster-weit** oder als **parent** gelesen | nicht in diesem Satz beobachtbar (jede Roster hat genau ein Kontingent, und die Bloodletters stehen dort auf oberster Ebene) — bewusst so gebaut, damit der `repeat` und nicht der Rahmenbegriff geprüft wird. |
| `number` als **Auswahl-Element** statt Stückzahl gelesen | Roster 02/04/05 — `actual` wäre 1 statt 2 bzw. 3 und keine Grenze feuerte. |
| Getrennte Geschwister-Auswahlen **nicht** summiert | Roster 03/05 — `N` wäre 1, die Grenze bliebe 1 und beide feuerten. |
| `set -1` als **„nichts erlaubt"** gelesen (statt als hingeschriebener Sentinel) | Roster 06 und 07 — beide feuerten mit `bound -1`. |
| Gatter des `increment` missachtet (`<repeat>` zählt immer) | Roster 07 — die Grenze läge bei 2 statt unbegrenzt; sie feuerte bei Ist 3. |
| Gatter des `set -1` missachtet | Roster 01–05 — die Grenze wäre überall aufgehoben, keiner der drei erwarteten Verstöße erschiene. |

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle laufen gegen
denselben Datensatz (`.gst` + `Forces of Chaos`-`.cat` + die per `catalogueLink`
deklarierte `Mercenaries`-`.cat`) und tragen dasselbe Budget von 3000 pts.

> **Assertion-Fokus:** ausschließlich die Grenze `7f35-5f3f-42c9-be19` und der
> `effectiveMax`/`current` des Flesh-Hounds-Slots. Andere Armeeaufbau-Diagnosen —
> namentlich die General-Pflicht `1077-7379-f142-f382` (`.gst` Z. 721 ff.), die
> Core-Pflicht der `.gst` `35c2-d478-392a-aeb1` (Z. 374) und die des
> Daemonic-Legion-`categoryLink`s `74c3-3332-fac6-c293` (`.cat` Z. 17426) —
> dürfen zusätzlich auftreten und sind hier ohne Belang (selektive Erwartung,
> Manifest-Vertrag). Sie stehen bewusst **nicht** in `absent`.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | Der unwiederholte Basiswert | Daemonic Legion, **keine** Bloodletters, **eine** Einheit Flesh Hounds. | **FRBFH-R1/R4:** Der `repeat` zählt 0 Treffer, der `increment` wird nie angewendet: Grenze bleibt **0**. `7f35…` feuert **Ist 1 / Grenze 0**; der Slot meldet Ist 1 bei `effectiveMax` 0. | [`01-…-max-0.ros`](rosters/01-daemonic-legion-no-bloodletters-max-0.ros) |
| 02 | Der erste Wiederholungsschritt | **Eine** Einheit Bloodletters, **zwei** Einheiten Flesh Hounds. | **FRBFH-R4:** Faktor 1 ⇒ Grenze **1**. `7f35…` feuert **Ist 2 / Grenze 1** — der Schritt ist genau eins. | [`02-…-max-1-fires.ros`](rosters/02-one-bloodletters-two-flesh-hounds-max-1-fires.ros) |
| 03 | Der zweite Schritt trägt | **Zwei** Einheiten Bloodletters (getrennte Auswahlen), **zwei** Einheiten Flesh Hounds. | **FRBFH-R4/R6:** Faktor 2 ⇒ Grenze **2**. `7f35…` feuert **nicht**; der Slot meldet Ist 2 bei `effectiveMax` 2, `headroom` 0, `isBlocked`. | [`03-…-max-2.ros`](rosters/03-two-bloodletters-two-flesh-hounds-max-2.ros) |
| 04 | Eine Einheit zu viel | **Zwei** Bloodletters, **drei** Flesh Hounds. | **FRBFH-R4:** Grenze weiterhin **2**. `7f35…` feuert **Ist 3 / Grenze 2** — gegen den *angehobenen* bound, nicht gegen die geschriebene 0. | [`04-…-max-2-fires.ros`](rosters/04-two-bloodletters-three-flesh-hounds-max-2-fires.ros) |
| 05 | Der dritte Schritt — der Faktor sättigt nicht | **Drei** Bloodletters, **drei** Flesh Hounds. | **FRBFH-R4:** Faktor 3 ⇒ Grenze **3**. Dieselben drei Flesh Hounds wie in 04 feuern **nicht**; der Slot meldet Ist 3 bei `effectiveMax` 3, `headroom` 0, `isBlocked`. | [`05-…-max-3.ros`](rosters/05-three-bloodletters-three-flesh-hounds-max-3.ros) |
| 06 | Außerhalb der Legion: Grenze aufgehoben | Kontingent **„Standard (HC-AB + BC-AB)"**, **keine** Bloodletters, **zwei** Flesh Hounds. | **FRBFH-R7:** Der `set -1` greift, die Grenze ist aufgehoben. `7f35…` feuert **nicht**; der Slot meldet **kein** Höchstmaß (`effectiveMax` null, `headroom` null, nicht blockiert) — Kontrast zu Roster 01, wo schon **eine** Einheit feuerte. | [`06-…-unlimited.ros`](rosters/06-standard-force-no-bloodletters-unlimited.ros) |
| 07 | Auswahlgleiche Gegenprobe zu 04 | **Dieselben** Auswahlen wie Roster 04 (zwei Bloodletters, drei Flesh Hounds), nur im Kontingent **„Standard"**. | **FRBFH-R3/R7:** Das Gatter des `increment` hält nicht, der `repeat` zählt nicht — stattdessen hebt der `set -1` die Grenze auf. `7f35…` feuert **nicht**, `effectiveMax` null. Einziger Unterschied zu 04 ist das Kontingent. | [`07-…-unlimited.ros`](rosters/07-standard-force-two-bloodletters-unlimited.ros) |

### Herleitung der Zahlen

- **`bound`** ist der wirksame `value` von `7f35-5f3f-42c9-be19`: Katalogwert
  **0** (`.cat` Z. 5886), verrechnet nach der Wahrheitstafel. Die Rechnung stammt
  ausschließlich aus dem XML.
- **`actual`** ist die Stückzahl der Flesh-Hounds-Auswahlen im Kontingent, also
  das `number` des einen Trägers (FRBFH-R6). Seine Kinder (die *Flesh
  hound*-Modelle) zählen **nicht** mit — `includeChildSelections="false"` zählt
  *„just `scope`'s `field`"*
  ([§7.6](../../battlescribe-data-format.md#76-constraint)) —, und sie sind
  ohnehin ein anderer Eintrag.
- **`effectiveMax`** des Flesh-Hounds-Slots ist dieselbe Grenze aus Slot-Sicht;
  **`effectiveMin`** ist `null`, weil der Eintrag keine `min`-Grenze trägt.
  `headroom 0` wird nur behauptet, wo `current == effectiveMax` gilt
  (Roster 03/05), und `headroom null` dort, wo es kein Höchstmaß gibt
  (Roster 06/07).
- **Der Slot ist eindeutig adressierbar,** weil jede Roster genau **eine**
  Flesh-Hounds-Auswahl trägt (die Mehrfachheit steckt im `number`) — daher
  `defId` + `anchorKind` + `frameDefId` ohne `path`.

### Was bewusst **nicht** Teil der Erwartung ist

| Facette | Warum nicht |
|---------|-------------|
| Die **`hidden`-Gatter** beider Einheiten (`set hidden="true"` bei „Archaon's Horde (SoC)" bzw. bei Morghur). | Sichtbarkeit, keine zählende Grenze — der Verletzungsbericht kodiert keine (Un-)Sichtbarkeit (vgl. [`vampire-bloodlines`](../vampire-bloodlines/README.md), VBL-R4/R5). Behauptet wird nur das **Ausbleiben** des Gatters als `isHidden: false` am Slot; das eigene Kontingent und der Charakter kommen in keinem Roster vor (FRBFH-R8). |
| Die **Kategorie-Umschaltung** durch die `modifierGroup` „CORE" (`remove`/`add`/`set-primary` auf Core, `.cat` Z. 5855 bzw. 5717). | Eigene Zelle (Kategoriezugehörigkeit zur Laufzeit); sie verschiebt nur, **welcher** Kategorie-Anker die Einheiten zählt, nicht die hier gepinnte Eintragsgrenze. Ihre Folge ist aber mitgedacht: in der Daemonic Legion sind beide Einheiten **Core**, im Kontingent „Standard" bleiben sie **Special**. |
| Die **Kategoriegrenzen** `16f0-6e5b-55d0-4102` (Special, `.gst` Z. 436) und `15f5-05f7-6b9e-4dd4` (Special im DL-`categoryLink`, `.cat` Z. 17441). | Beiwerk; die Erwartung ist selektiv. Sie sind bei 3000 pts rechnerisch still — die Special-Leiter der `.gst` steht bei 3000–3999 pts auf **5** (`.gst` Z. 492), und Roster 07 führt mit 2 + 3 = 5 Special-Auswahlen genau diesen Wert; in der Daemonic Legion sind die Einheiten ohnehin Core. Weil das an der Kategorie-Zählweise hängt und nicht am `repeat`, steht keine der beiden in `absent`. |
| Die **Pflichtgrenzen der Kinder** (`min 10` Bloodletter `4cac-…`, `min 5` Flesh hound `ded6-…`, `min 1` Hand Weapon/Light Armour). | Die Träger stehen teils gestapelt (`number` > 1); wie `shared="true"` bei `scope="parent"` über mehrere Instanzen summiert, ist eine eigene Zelle ([§7.6](../../battlescribe-data-format.md#76-constraint)). Die Roster erfüllen sie unter jeder Lesart (FRBFH-R10), behauptet wird das nicht — dieselbe Zurückhaltung wie in [`roster-repeat-category-count`](../roster-repeat-category-count/scenario.json), Roster 03. |
| **`includeChildForces="true"`** am `<repeat>` (`.cat` Z. 5812). | Braucht geschachtelte Kontingente; jede Roster hier hat genau eines. Die roster-weite Variante derselben Frage ist in [`roster-repeat-category-count`](../roster-repeat-category-count/README.md) (Roster 06) gepinnt. |
| Der **parallele Bau an „BloodCrushers"** `0b88-5c64-bf44-815f` (`.cat` Z. 8081): dieselbe `max 0`-Grenze `32f8-b21a-d22f-bdc4` mit **unbedingtem** `increment` + demselben `<repeat>` auf Bloodletters (Z. 8094). | Derselbe Konstrukttyp ohne Gatter; er belegt, dass das Muster im Datensatz kein Einzelfall ist, fügt aber keine neue Zelle hinzu. Die Einheit ist zudem per Basis `hidden="true"` gattert und steht in keinem Roster. |
| Die **General-/Core-Pflichten** (`1077-7379-f142-f382`, `35c2-d478-392a-aeb1`, `74c3-3332-fac6-c293`). | Beiwerk des Armeeaufbaus; ein General oder weitere Core-Einheiten würden nur Rauschen hinzufügen, ohne die Slot-Leiter zu berühren. |

*Abgrenzung:* [`roster-repeat-category-count`](../roster-repeat-category-count/README.md)
pinnt denselben `repeat`-Bau mit **`scope="roster"`** und einem **Kategorie**-Ziel;
[`unit-scope-repeat-knight-markup`](../unit-scope-repeat-knight-markup/README.md)
und [`parent-repeat-item-count`](../parent-repeat-item-count/README.md) pinnen ihn
mit `scope="unit"`/`scope="parent"` auf **Kosten** bzw. auf eine Gruppenkappe;
[`at-least-roster-limit-lord-slots`](../at-least-roster-limit-lord-slots/README.md)
pinnt ihn auf `field="limit::<costTypeId>"`. Dieses Szenario pinnt die
verbleibende Kombination: **`scope="force"` mit einer Eintrags-`childId`**, dazu
den Gegenspieler `set -1` am selben Constraint.

---

## Abgleich mit dem Engine-Bericht (Runner-Verifikation)

Die oben aus den Katalogdaten **abgeleiteten** Erwartungen treffen die Engine
erst im **Runner-Lauf** — der separate Verifikationsschritt, der nicht zur
(blinden) Autorenschaft gehört (siehe
[ADR 0033](../../adr/0033-evaluator-e2e-manifest-runner-und-black-box-autorenschaft.md)).
Abweichungen sind zu **untersuchen**, nicht durch Anpassen der Erwartung
wegzudefinieren. Die erwartungsgemäß heiklen Stellen:

1. **FRBFH-R4** — ob der `repeat` den `increment` wirklich `N`-mal anwendet und
   der Faktor über zwei Wiederholungen hinaus weiterwächst (Roster 03/05).
2. **FRBFH-R5** — ob eine **Eintrags**-`childId` bei `scope="force"` genau die
   Auswahlen dieses Eintrags zählt und nicht seine Kategorie-Geschwister
   (Roster 01 muss trotz einer Flesh-Hounds-Auswahl gegen `bound 0` feuern).
3. **FRBFH-R7** — ob ein **hingeschriebener** `set -1` als „unbegrenzt" und
   nicht als „nichts erlaubt" projiziert wird (Roster 06/07: `effectiveMax`
   null statt `bound -1`).
4. **FRBFH-R3** — ob die `instanceOf`/`notInstanceOf`-Gatter auf die
   `forceEntry`-Id in `childId` (kanonische Kodierung) korrekt greifen; das
   Paar 04/07 unterscheidet sich in **nichts** außer dem Kontingent.
5. **FRBFH-R6** — ob das `number` einer Auswahl als Stückzahl in `actual` und in
   die `repeat`-Zählung eingeht.

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Spielsystem WHFB 6th definitive (`.gst` Z. 2) | `0d13-7737-ea86-4662` |
| Katalog **Forces of Chaos** (`.cat` Z. 2, rev 1) | `6b83-a975-a500-41c3` |
| Bibliothek **Mercenaries** (per `catalogueLink b824-6470-4943-f4bc`, `.cat` Z. 17606) | `fc47-8392-a6c8-452a` |
| `costType` „pts" | `ecfa-8486-4f6c-c249` |
| ForceEntry **„Daemonic Legion (SoC)"** (`.cat` Z. 17377) | `93f4-7522-86e9-7d45` |
| ForceEntry **„Standard (HC-AB + BC-AB)"** (`.cat` Z. 17353) | `d403-5cc9-152c-2093` |
| ForceEntry **„Archaon's Horde (SoC)"** — Sichtbarkeitsgatter, in keinem Roster (`.cat` Z. 17487) | `f1d2-edba-0f35-030a` |
| SelectionEntry **„Flesh Hounds"** (`.cat` Z. 5790, `type="unit"`, 0 pts) | `eaf6-a701-f67e-7c26` |
| — dessen einzige Grenze `max 0`, `field="selections"`, `scope="force"`, `shared="true"`, `includeChildSelections="false"` (`.cat` Z. 5886) | **`7f35-5f3f-42c9-be19`** |
| — — `set -1` darauf, `condition notInstanceOf` Daemonic Legion (`.cat` Z. 5801–5806) | (unbenannt, `field="7f35-5f3f-42c9-be19"`) |
| — — `increment 1` darauf, `condition instanceOf` Daemonic Legion + `<repeat>` je Bloodletters (`.cat` Z. 5807–5815) | (unbenannt, `field="7f35-5f3f-42c9-be19"`) |
| — — dessen `<repeat>` `value=1 repeats=1 field="selections" scope="force" childId="7dc4-…" roundUp="false"` (`.cat` Z. 5812) | (unbenannt) |
| — Modell **„Flesh hound"**, 16 pts, `min 5` / `max -1` (`.cat` Z. 5828–5839) | `51c0-1582-976e-d0bb` — `ded6-a8de-3d2f-f4c8` / `1429-53b5-f82f-7df3` |
| SelectionEntry **„Bloodletters"** (`.cat` Z. 5634, `type="unit"`, 0 pts) — die vom `<repeat>` gezählte Einheit | `7dc4-fb32-003b-c289` |
| — Modell **„Bloodletter"**, 16 pts, `min 10` (`.cat` Z. 5673–5684) | `f260-1878-a029-72d3` — `4cac-43ad-ee07-745f` |
| — `entryLink` *Hand Weapon* → `.gst` Z. 1032, 0 pts (`min` `1223-261b-447b-79b9` / `max` `ccd0-3a78-f520-9732`) | `b34f-43d3-bb62-363d` → `abdb-bbd0-41b2-5dff` |
| — `entryLink` *Light Armour* → `.gst` Z. 951, 0 pts (`min` `ca8b-df40-04bb-1640` / `max` `2477-2439-8b87-8bcf`) | `c1a8-c1b7-857e-1d9e` → `055f-8e4e-f170-35d2` |
| Kategorie **Core** / **Special** / **Khorne** (Ziel der Laufzeit-Umschaltung, nicht gepinnt) | `64bf-efb4-9978-26df` / `43cc-fc3f-35a7-8d03` / `1e5a-e1dc-3591-46bc` |
| „Morghur, Master of Skulls" — versteckt die Bloodletters, in **keinem** Roster (`.cat` Z. 7422) | `1d54-5b22-90c0-96c4` |
| „BloodCrushers" — paralleler `repeat`-Bau auf denselben Bloodletters, nicht gepinnt (`.cat` Z. 8081/8094) | `0b88-5c64-bf44-815f` — Constraint `32f8-b21a-d22f-bdc4` |
| Toleriertes Beiwerk: General-Pflicht (`.gst`), Core-Pflicht (`.gst`), Core-Pflicht des DL-`categoryLink` (`.cat` Z. 17426) | `1077-7379-f142-f382` / `35c2-d478-392a-aeb1` / `74c3-3332-fac6-c293` |
