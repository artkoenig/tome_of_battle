# E2E-Regeln & Testkatalog: Ein `set`-Modifikator ohne Ziel lässt den Lord-Slot unberührt

**Rolle:** Black-Box-Test (kein Blick in den Engine-Quellcode). Alle Regeln,
Grenz-Ids, Ist- und Grenzwerte sind **ausschließlich aus den Katalogdaten** der
*6th Definitive Edition* (`src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive/`), der
Format-Doku [`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md)
und der vendorten `Catalogue.xsd` **abgeleitet** — nicht aus einem Engine-Lauf.
Die Roster-Form folgt der in bestehenden Szenarien verifizierten Gestalt
(direktes `entryId`, leeres `entryLinkId`, `entryId`=Ziel-Id + `entryLinkId`=Verweis-Id
bei einem `entryLink`, verschachtelte `selections` mit `number`,
`<costLimits><costLimit …/></costLimits>` für das eingestellte Budget).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armeebuch: `Vampire Counts (6th definitive edition).cat` (`4d73-5ab0-9020-403c`,
  rev 1) — Kontingente **„Army of the Lichemaster (WD#309-UK)"**
  `f37a-a93e-fa22-61a8` (`:29441`) und **„Vampire Coast (WD#306-UK)"**
  `bf46-ee85-7c10-ba98` (`:29471`)
- Bibliothek: `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`) —
  per `<catalogueLink type="catalogue" name="Mercenaries" id="ef73-f9bd-e250-54d2"
  targetId="fc47-8392-a6c8-452a"/>` (`Vampire Counts (…).cat:29511`) erklärte
  Abhängigkeit; ohne sie wäre der Datensatz unvollständig.

---

## Worum es geht

Ein `modifier` **ändert** laut
[§7.7](../../battlescribe/building-blocks/modifier.md#77-modifier-condition-condition-group-repeat)
„eine Eigenschaft des Elternelements oder den Wert eines Constraints". Sein
`field` darf genau eines von neun Dingen benennen:

> `field` | *Constraint-`id`* \| *`<costTypeId>`* \| `hidden` \| `name` \| `category` \| `error` \| `warning` \| `info` \| *`<characteristicTypeId>`*

Der Vampire-Counts-Katalog enthält **zwei** Modifikatoren, deren `field` **keines**
davon ist: die Id `a59d-2ddb-429c-1aca` ist weder ein Schlüsselwort noch im
geladenen Datensatz als `constraint`, `costType` oder `characteristicType`
definiert. Beide sitzen wortgleich am **Lord-`categoryLink`** eines Sonderheeres
und sind **unbedingt** — sie tragen weder `<conditions>` noch `<conditionGroups>`
noch `<repeats>`:

```xml
<!-- Vampire Counts (…).cat:29447-29454  — Kontingent „Army of the Lichemaster" -->
<categoryLink name="Lord" hidden="false" id="7a76-8153-c4b2-9fee" targetId="d024-d25b-a9b4-73b6" primary="false">
  <modifiers>
    <modifier type="set" value="1" field="a59d-2ddb-429c-1aca"/>
  </modifiers>
  <constraints>
    <constraint type="min" value="1" field="selections" scope="parent" shared="true" id="760d-2352-9fac-0e46"/>
  </constraints>
</categoryLink>
```

```xml
<!-- Vampire Counts (…).cat:29477-29484  — Kontingent „Vampire Coast" -->
<categoryLink name="Lord" hidden="false" id="aa77-6ac1-ba5c-5646" targetId="d024-d25b-a9b4-73b6" primary="false">
  <modifiers>
    <modifier type="set" value="1" field="a59d-2ddb-429c-1aca"/>
  </modifiers>
  <constraints>
    <constraint type="min" value="1" field="selections" scope="parent" shared="true" id="8471-437a-59d6-bc3d"/>
  </constraints>
</categoryLink>
```

Es gibt damit nichts, was diese Modifikatoren ändern könnten: **kein Zielwert,
kein Effekt.** Die Regel ist aus den erlaubten Quellen vollständig herleitbar,
ohne zu raten: Die Wirkung eines Modifikators ist im Format ausschließlich als
*Änderung eines benannten Ziels* definiert
([§7.7](../../battlescribe/building-blocks/modifier.md#77-modifier-condition-condition-group-repeat)).
Existiert das Ziel nicht, existiert auch die Änderung nicht — es gibt im Format
keinen zweiten, zielfreien Wirkungspfad, und ein `modifier` legt insbesondere
**nie** eine Grenze an: Grenzen entstehen ausschließlich aus `constraint`-Elementen
([§7.6](../../battlescribe/building-blocks/constraint.md#76-constraint)).

Dieses Szenario ist das Schwester-Szenario zu
[`../modifier-unresolved-target-inert/`](../modifier-unresolved-target-inert/README.md)
(dort `increment`/`decrement` auf `ce6e-afde-2ed1-aac2` im Orcs-and-Goblins-Katalog).
Hier ist der Operator ein **`set`** — die Operation, die einen Grenzwert nicht
verrechnet, sondern **überschreibt**, und die deshalb am ehesten „aus Versehen"
einen fremden Wert setzen würde.

### Wie das Fehlen des Ziels geprüft wurde

Volltextsuche über **alle fünf** Dateien des eingefrorenen Korpus
`src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive/` (`.gst` + `Vampire Counts` +
`Orcs and goblins` + `Ogre Kingdoms` + `Mercenaries`), zuerst nach der vollen Id,
dann nach dem Präfix `a59d`:

| Fundstelle | Zeile | Rolle |
|------------|-------|-------|
| `Vampire Counts (…).cat` | 29449 | `<modifier type="set" value="1" field="a59d-2ddb-429c-1aca"/>` (Lord-Link des Lichemaster-Kontingents) |
| `Vampire Counts (…).cat` | 29479 | `<modifier type="set" value="1" field="a59d-2ddb-429c-1aca"/>` (Lord-Link des Vampire-Coast-Kontingents) |
| `Vampire Counts (…).cat` | 19238 | `selectionEntry id="f289bd06-06ef-4bd1-a59d-26aa6afda1e8"` — **andere** Id, nur Präfix-Treffer |
| `Vampire Counts (…).cat` | 23363 | `entryLink targetId="f289bd06-06ef-4bd1-a59d-26aa6afda1e8"` — dito |

Zwei Treffer der vollen Id, beide als `field` eines `modifier`. **Null** Treffer
als `id=` — also kein `constraint`, kein `costType` (die drei Kostenarten der
`.gst` sind `ecfa-8486-4f6c-c249` „pts", `fcec-2340-6368-a2ba` „Casting Dice",
`6001-b2bf-4529-c07d` „Dispel Dice"), kein `characteristicType`, kein
`selectionEntry`, keine `categoryEntry`, kein `forceEntry`. Auch keines der neun
Schlüsselwörter aus der `field`-Tabelle. Die einzigen Vorkommen der Id im ganzen
Datensatz sind ihre eigenen zwei Verweise.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **SUTIL-R1** | Ein `set`-Modifikator, dessen `field` eine im Datensatz nirgends definierte Id nennt, **erzeugt keine Grenze dieser Id**. Im Verletzungsbericht darf `a59d-2ddb-429c-1aca` nie erscheinen. | Grenzen entstehen ausschließlich aus `constraint`-Elementen ([§7.6](../../battlescribe/building-blocks/constraint.md#76-constraint)); ein `modifier` ändert nur ([§7.7](../../battlescribe/building-blocks/modifier.md#77-modifier-condition-condition-group-repeat)). Zu `a59d-2ddb-429c-1aca` existiert kein `constraint` (Suchbeleg oben). Im Manifest in **jedem** Roster als `absent`. |
| **SUTIL-R2** | Er ist **unbedingt** und damit in jedem Roster dieses Szenarios aktiv — das Fehlen des Ziels ist das Einzige, was ihn wirkungslos machen kann. | `:29449` und `:29479`: das `<modifier>`-Element ist in beiden Fällen leer (`/>`), trägt also weder `<conditions>` noch `<conditionGroups>` noch `<repeats>`. Es steht direkt in `<modifiers>`, nicht in einer `modifierGroup` (Fallstrick-Kasten [§7.7](../../battlescribe/building-blocks/modifier.md#modifiergroup--eine-bedingte-klammer-um-mehrere-modifier)). |
| **SUTIL-R3** | Er **stört die Auswertung seines Trägers nicht**: die echte Grenze desselben `categoryLink` verhält sich exakt wie geschrieben — `min 1` auf die Zahl der Lord-Auswahlen im Kontingent. Ohne Lord feuert sie mit Ist **0** / Grenze **1**, mit genau einer Lord-Auswahl schweigt sie. | Lichemaster: `:29452` `constraint type="min" value="1" field="selections" scope="parent" shared="true" id="760d-2352-9fac-0e46"`. Vampire Coast: `:29482` dieselbe Grenze als `8471-437a-59d6-bc3d`. Träger ist der `categoryLink` auf die Kategorie „Lord" `d024-d25b-a9b4-73b6`; gezählt werden die Auswahlen dieser Kategorie im Kontingent ([§7.6](../../battlescribe/building-blocks/constraint.md#76-constraint), Regelkasten „gezählt werden die Auswahlen *unterhalb* des Trägers"; Ziel-Typ-Regel für Kategorie-Ziele, ADR 0029). Roster 01/03 gegen 02/04. |
| **SUTIL-R4** | Er **verschiebt keine fremde Grenze**. Die Grenzen im selben Rahmen behalten genau die Werte, die die Katalogdaten ihnen geben — insbesondere bleibt die Core-Untergrenze auf ihrem `.gst`-Klassenwert **4** (Budget 3000–3999) statt auf **1**. | `.gst:374` `constraint type="min" value="2" field="selections" scope="force" shared="true" id="35c2-d478-392a-aeb1"` an der `categoryEntry` „Core" `64bf-efb4-9978-26df`, per `.gst:395` `modifier set value="4"` für 3000–3999 pts. Im Manifest als `firing`-Grenzwert und als `capabilities.effectiveMin`. |
| **SUTIL-R5** | Er **stört seine Nachbarn nicht**: der Heroes-`categoryLink` desselben Kontingents bleibt grenzenlos, wie die Daten es sagen. | Lichemaster `:29455` / Vampire Coast `:29485`: `categoryLink "Heroes"` **ohne** `<constraints>`; die `.gst`-`categoryEntry` „Heroes" `c16b-f319-2c62-2c12` trägt nur `max -1` (`.gst:368`, `7fca-63fb-63d2-9dad`) = unbegrenzt ([§7.6](../../battlescribe/building-blocks/constraint.md#76-constraint), Sentinel-Kasten). Erwartet als `effectiveMin: null` / `effectiveMax: null`. |
| **SUTIL-R6** | **Gegenprobe (Lebendigkeit):** Ein **echter** Modifikator an einem **Nachbar-`categoryLink` desselben Kontingents** verschiebt seine Grenze nachweislich: die Core-Untergrenze des Vampire-Coast-Kontingents steigt um **+1 je „Bloated Corpse"** im Kontingent, also von 4 auf 5. | `:29486-29494`: `categoryLink "Core"` `4292-f5de-24ff-93a7` mit `<modifier type="increment" value="1" field="35c2-d478-392a-aeb1">` und `<repeat value="1" repeats="1" field="selections" scope="force" childId="8b63-3344-e972-cd0d" shared="true" roundUp="false" includeChildSelections="true"/>`. „Bloated Corpse" `8b63-3344-e972-cd0d` (`:13218`, 30 pts, Kategorie „Core" `2abb-389b-b6ab-6179`) ist im Vampire-Coast-Kontingent aufgedeckt (`:13236`). Roster 05. |
| **SUTIL-R7** | **Sichtbarkeit:** Die Kategorie „Lord" ist bei Budget ≥ 2000 **nicht** versteckt, ihre Mindestgrenze ist also zu validieren. | `.gst:220-227`: `categoryEntry "Lord"` mit `modifier set hidden="true"`, Bedingung `lessThan 2000` auf `limit::ecfa-8486-4f6c-c249` (`scope="roster"`). Alle Roster setzen `costLimit` **3000**. [§8](../../battlescribe/building-blocks/category-and-visibility.md#8-kategorien--sichtbarkeit) / Issue 0088: Min-Grenzen einer effektiv versteckten Entität werden **nicht** validiert — hier ist sie nicht versteckt (`capabilities.isHidden: false`). |
| **SUTIL-R8** | Die Grenze des **einen** Sonderheeres darf im **anderen** nicht auftauchen. `760d-…` gehört dem Lichemaster-, `8471-…` dem Vampire-Coast-Kontingent; jede steht im jeweils anderen Roster als `absent`. | Beide Grenzen hängen am `categoryLink` **innerhalb** ihres `forceEntry` (`:29452` bzw. `:29482`). Ein Roster wählt genau ein Kontingent. |

### Was in beiden Kontingenten sonst noch Pflicht ist — und wie dieses Szenario damit umgeht

Ein Szenario, das einen wirkungslosen Modifikator pinnt, darf nicht in fremdem
Rot ersaufen. Deshalb sind **alle** Pflichtgrenzen, die die beiden Sonderheere
selbst mitbringen, aus den Daten hergeleitet und im Manifest **explizit**
deklariert — als `firing` (bewusst stehen gelassen) oder als `absent` (bewusst
erfüllt):

| Grenze | Herkunft | Wert | Wie die Roster damit umgehen |
|--------|----------|------|------------------------------|
| `8461-3eab-e5ac-1636` (Kemmler) | `:10806` `min 0`, `scope="force"`, per `:10772` `set 1`, wenn das Kontingent `f37a…` ist und **nicht** (Budget < 2000 **und** Kampagne gewählt) | 1 | Roster 01: **feuert** 0/1 (deklariert). Roster 02: Kemmler gewählt ⇒ still. |
| `60a8-5b49-6b81-7c84` (Krell) | `:12313` / `:12373`, wortgleich | 1 | Roster 01: **feuert** 0/1. Roster 02: Krell gewählt ⇒ still. |
| `6476-ebd7-6fae-8d90` (Luthor Harkon) | `:12720` `min 0`, `scope="force"`, per `:12708` `set 1`, wenn das Kontingent `bf46…` ist und **keine** „Border Patrols rules"-Auswahl im Kontingent steht | 1 | Roster 03: **feuert** 0/1. Roster 04/05: Luthor gewählt ⇒ still. |
| `f460-f7d0-e0ed-689f` (Luthor, `max 1`, `scope="force"`) | `:12721` | 1 | Nie verletzt (Ist 0 bzw. 1) ⇒ in allen Rostern `absent`. |
| `c456-6da8-2246-62db` („Vampire Fleet Captain", `min 0`) | `:12948` — im Vampire-Coast-Kontingent aufgedeckt (`:12804`), aber von **keinem** Modifikator gehoben (einziger Treffer der Id im Korpus) | 0 | Nie verletzt ⇒ in den Vampire-Coast-Rostern `absent`. Zugleich ein feiner Detektor: eine verirrte `set 1` auf diese Grenze ließe sie mit Ist 0 / Grenze 1 feuern. |
| `76c2-0b65-ca83-69b9` („General" unter Luthor, `min 1`, `scope="parent"`) | `:12791` | 1 | Roster 04/05 wählen den `entryLink` `95d8-3d53-2165-2303` mit ⇒ erfüllt. |
| `1077-7379-f142-f382` / `d818-c60d-b1f8-8aaa` (Kategorie „General", `min 1` / `max 1`, `scope="force"`) | `.gst:723-724` | 1 / 1 | Roster 01/03 (leer): **feuert** 0/1 (deklariert). Roster 02/04/05: genau ein „General" `1b7c-2c90-6d96-28c9` gewählt ⇒ beide still. |
| `35c2-d478-392a-aeb1` (Kategorie „Core", `min`) | `.gst:374` + `.gst:395` (Klasse 3000–3999 ⇒ 4), im Vampire-Coast-Kontingent zusätzlich `+1` je Bloated Corpse (`:29488`) | 4 bzw. 5 | In **allen** Rostern deklariert — als `firing` mit dem jeweils hergeleiteten `bound`. Das ist zugleich der Zeuge für SUTIL-R4/R6. |

### Warum die Roster ein Budget von 3000 Punkten setzen

Drei Gründe, alle aus den Daten:

1. **Die Lord-Kategorie muss sichtbar sein** (SUTIL-R7): unter 2000 Punkten
   versteckt `.gst:222` sie, und die Mindestgrenzen einer versteckten Entität
   werden nicht validiert — der Kernfall wäre nicht beobachtbar.
2. **Beide Sonderheere fordern ein Mindestbudget von 2000 Punkten**: `:29461`
   `constraint min 0 field="limit::ecfa-8486-4f6c-c249" scope="roster"
   id="8f3f-ffa8-387b-0bf9"`, per `:29464` auf `2000` gesetzt, wenn das
   Kontingent `f37a…` ist; wortgleich `f3aa-b530-9b6c-0995` (`:29499`/`:29502`)
   für `bf46…` ([§5.6](../../battlescribe/files/game-system.md#56-force-entries-detachments)).
   Mit `limit::pts = 3000` ist diese Forderung erfüllt.
3. **Der Lord-Höchstwert der `.gst` liegt bei 3000–3999 auf 2** (`.gst:264`,
   `fda5-91c2-e17f-774c`, Basis `max 1`) — eine Lord-Auswahl je Roster kann ihn
   also unter keiner Lesart reißen.

### Was eine falsche Lesart produzieren würde

| Fehl-Lesart | Wo sie auffällt |
|---|---|
| Der `set` legt eine **eigene Grenze** `a59d-2ddb-429c-1aca` an (etwa als „min/max 1" ins Leere) | In **jedem** Roster: die Id steht überall in `absent`. |
| Der `set` landet auf der **Core-Untergrenze** des Kontingents | Roster 01–04: `35c2-…` meldete `bound 1` statt **4**; Roster 05 statt **5**. |
| Der `set` landet auf einer beliebigen **min-0-Grenze** im Rahmen | Roster 03–05: `c456-6da8-2246-62db` („Vampire Fleet Captain") feuerte mit 0/1. |
| Der Rahmen wird **gar nicht ausgewertet** („nichts passiert" = „nichts gemessen") | Roster 01/03: die echte Grenze feuert 0/1; Roster 05: der echte Nachbar-Modifikator hebt Core von 4 auf **5**. |
| Die Grenze des einen Sonderheeres gilt **auch im anderen** | Roster 01 vs. 03: `760d-…` und `8471-…` stehen jeweils im anderen Roster in `absent`. |

> **Ehrliche Grenze der Beobachtbarkeit.** Der haltlose Modifikator setzt den Wert
> **1**, und die echte Nachbargrenze desselben `categoryLink` steht ebenfalls auf
> **1**. Landete der `set` ausgerechnet auf ihr, wäre das an den realen Daten
> **nicht** zu sehen — `set 1` auf eine Grenze, die schon 1 ist, ist ein No-op.
> Dieses Szenario behauptet deshalb nicht mehr, als die Daten hergeben: keine
> Grenze der haltlosen Id, `bound` der echten Grenze unverändert **1**, und alle
> übrigen erreichbaren Grenzen des Rahmens auf ihren geschriebenen bzw. regulär
> modifizierten Werten.

### Zahlenbasis der Roster

Jede Auswahl trägt `number="1"`; verschachtelt ist nur der „General"-Verweis unter
seinem Charakter. Damit ist die in
[§7.5](../../battlescribe/building-blocks/cost.md#75-cost--cost-type) benannte Lücke
(„ist `.ros`-`number` per-Eltern-relativ oder absolut?") für dieses Szenario
**folgenlos**: `1 × 1 = 1` in beiden Lesarten. Die Punktesummen bleiben weit unter
dem Budget (Roster 02: Kemmler 550 + Krell 190 = 740; Roster 04: Luthor 260;
Roster 05: 260 + 30 = 290) — das Punktelimit spielt in diesem Szenario keine Rolle
außer als Klassenschalter (siehe oben).

---

## Testkatalog (E2E-Szenarien)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle laufen gegen
**denselben** Datensatz (`.gst` + Vampire-Counts-`.cat` + die per `catalogueLink`
benötigte `Mercenaries`-`.cat`). Das `catalogueId`-Attribut einer `<force>` ist
Roster-Beiwerk; welcher Katalog das Kontingent deklariert hat, kommt aus der
Herkunft der Force-**Definition**.

> **Assertion-Fokus:** die haltlose Id, die beiden echten Lord-Mindestgrenzen und
> die oben tabellierten Nachbargrenzen. Andere Armeeaufbau-Diagnosen dürfen
> zusätzlich auftreten und sind hier ohne Belang — namentlich die
> Pflicht-Kinder von Kemmler (u. a. „Magic Level 4" `5a5b-c983-a881-b72b`, „Black
> Periapt" `8afc-6249-ca78-881d`, „Skull Staff" `91ab-8ba6-23f9-6c06`, „Power
> Familiar" `bcf6-5cdc-29f3-a505`, „Cloak of Mist and Shadows"
> `f8a6-f6f8-27f6-60d6`) und von Krell (`dae0-be51-cf67-002f`,
> `3618-ea5e-e092-5ca5`, `117a-38bc-6350-8e22`) in Roster 02, die Autor-Meldungen
> „Please enable &quot;Allow special characters?&quot;" (`:10762`, `:12363`) sowie
> die Eigengrenzen der Kontingente auf `limit::pts` (`8f3f-ffa8-387b-0bf9`,
> `f3aa-b530-9b6c-0995`, siehe unten).

| # | Roster-Zustand | Erwartetes Ergebnis (aus Katalogdaten abgeleitet) | Fixture |
|---|----------------|---------------------------------------------------|---------|
| 01 | Kontingent **Lichemaster** `f37a…`, Budget 3000, **leer** | **SUTIL-R1/R2/R3:** `a59d-2ddb-429c-1aca` erscheint nicht; die echte Grenze `760d-2352-9fac-0e46` feuert **Ist 0 / Grenze 1**. Deklariertes Beiwerk: Kemmler `8461-…` 0/1, Krell `60a8-…` 0/1, Core `35c2-…` 0/**4**, General `1077-…` 0/1. **SUTIL-R5:** der Heroes-Slot desselben Kontingents ist grenzenlos (`effectiveMin`/`effectiveMax` = `null`). **SUTIL-R8:** `8471-…` (das andere Sonderheer) bleibt still. | [`01-lichemaster-empty-lord-min-fires.ros`](rosters/01-lichemaster-empty-lord-min-fires.ros) |
| 02 | Wie 01, zusätzlich **Kemmler** `595f…` (Lord) + „General", **Krell** `2d17…` | **SUTIL-R3:** genau eine Lord-Auswahl ⇒ Ist 1 ≥ Grenze 1 ⇒ `760d-…` **still**, Slot `effectiveMin` unverändert **1**, `isMandatoryUnmet: false`. Kemmler- und Krell-Pflicht erfüllt, General-Pflicht erfüllt. Core meldet unverändert **4**. | [`02-lichemaster-kemmler-krell-lord-min-silent.ros`](rosters/02-lichemaster-kemmler-krell-lord-min-silent.ros) |
| 03 | Kontingent **Vampire Coast** `bf46…`, Budget 3000, **leer** | Das **zweite** Vorkommen derselben Konstruktion: `a59d-…` erscheint nicht; `8471-437a-59d6-bc3d` feuert **Ist 0 / Grenze 1**. Deklariertes Beiwerk: Luthor `6476-…` 0/1, Core `35c2-…` 0/**4**, General `1077-…` 0/1. Still bleiben `f460-…` (max 1), `c456-…` (min 0) und die Lichemaster-Grenzen. | [`03-vampire-coast-empty-lord-min-fires.ros`](rosters/03-vampire-coast-empty-lord-min-fires.ros) |
| 04 | Wie 03, zusätzlich **Luthor Harkon** `f9bc…` (Lord) + „General" | Genau eine Lord-Auswahl ⇒ `8471-…` **still**, Slot `effectiveMin` unverändert **1**. Luthors eigene Pflicht (`6476-…`), seine Obergrenze (`f460-…`) und sein Pflicht-Kind (`76c2-…`) sind erfüllt. Core unverändert **4**. | [`04-vampire-coast-luthor-lord-min-silent.ros`](rosters/04-vampire-coast-luthor-lord-min-silent.ros) |
| 05 | Wie 04, zusätzlich **ein „Bloated Corpse"** `8b63…` | **SUTIL-R6 (Gegenprobe):** der **echte** Modifikator am Nachbar-`categoryLink` „Core" hebt `35c2-…` von 4 auf **5**; die Grenze feuert **Ist 1 / Grenze 5**. Gleichzeitig bleibt der Lord-Slot bei `effectiveMin` **1** und `a59d-…` abwesend. Damit ist „nichts bewirkt" messbar von „nichts ausgewertet" getrennt. | [`05-vampire-coast-bloated-corpse-core-min-raised.ros`](rosters/05-vampire-coast-bloated-corpse-core-min-raised.ros) |

### Herleitung der Zahlen

- **`bound` der beiden Lord-Grenzen** ist ihr geschriebener `value` **1**
  (`:29452`, `:29482`); kein Modifikator im Datensatz nennt ihre Ids als `field`
  (geprüft: `760d-2352-9fac-0e46` und `8471-437a-59d6-bc3d` kommen je genau
  **einmal** vor, nämlich als `id=` ihres eigenen `constraint`).
- **`actual`** ist die Zahl der Auswahlen der Kategorie „Lord"
  `d024-d25b-a9b4-73b6` im Kontingent: 0 in den leeren Rostern, 1 sobald Kemmler
  (`categoryLink` `5def-cdef-a98d-9a86`, `:10540`) bzw. Luthor (`categoryLink`
  `3809-e26d-2360-8293`, `:12798`) im Kontingent steht.
- **Core `bound` 4** = `.gst`-Basis `min 2` (`:374`), überschrieben durch den
  `set 4` der Klasse 3000–3999 (`:395`). **Core `bound` 5** = derselbe Wert plus
  der eine `increment 1` des Vampire-Coast-Core-Links, dessen `repeat` genau einen
  Bloated Corpse im Kontingent zählt (`:29488-29491`).
- **Core `actual`** ist die Zahl der Core-Auswahlen im Kontingent: 0 in den
  Rostern 01–04, 1 in Roster 05 (der Bloated Corpse; sein „Hand Weapon"-Verweis
  trägt keine Kategorie).

> **Bewusst gewählte Lesart bei Core `bound 5` (Roster 05).** Die Grenze
> `35c2-d478-392a-aeb1` wird von **zwei** Trägern adressiert: der `.gst`-Klassen-
> `set` an der `categoryEntry` und der `.cat`-`increment` am `categoryLink` des
> Kontingents. Die Formatspezifikation legt keine Reihenfolge zwischen Trägern
> fest. Aus den Daten ist sie dennoch bestimmt: Beide Sonderheere fordern per
> Eigengrenze mindestens **2000** Punkte (`:29461`/`:29499`), es gibt also kein
> legales Budget, in dem der `.gst`-Klassen-`set` nicht griffe. Würde der
> `increment` **vor** dem `set` gerechnet, wäre die Regel „ein Core-Pflichtslot
> mehr je Bloated Corpse" in **jedem** legalen Spiel toter Code — eine Lesart, die
> den Katalogautor sinnlos machte. Erwartet wird deshalb *erst setzen, dann
> erhöhen*: 4 + 1 = **5**. Sollte allein diese eine Erwartung brechen, ist die
> Frage die Modifikator-Reihenfolge, **nicht** der haltlose `set` — die Aussagen
> zu `a59d-2ddb-429c-1aca` stehen in allen fünf Rostern unabhängig davon.

---

### Nicht als feuernde Grenze erwartet

- **Die haltlose Id `a59d-2ddb-429c-1aca` selbst** — sie ist kein `constraint` und
  kann deshalb nie als Grenze im Bericht stehen. Sie steht in **jedem** Roster in
  `expect.absent`; das ist die eine Hälfte der Aussage „wirkungslos". Die andere
  Hälfte sind die unveränderten Nachbarwerte.
- **Sichtbarkeit (`hidden`, SUTIL-R7)** ist keine zählende Schranke und erscheint
  nicht im Verletzungsbericht (Konvention der bestehenden Szenarien, vgl.
  [`../vampire-bloodlines/README.md`](../vampire-bloodlines/README.md), VBL-R4/R5).
  Sie wird hier nur als Vorbedingung benutzt und zusätzlich als
  `capabilities.isHidden: false` festgehalten — dort ist sie eine Slot-Aussage,
  keine Grenze.
- **Profilwerte** kommen als Regel nicht vor. `a59d-2ddb-429c-1aca` ist kein
  `characteristicType` und könnte ein Profil ohnehin nicht treffen; und ein
  `categoryLink` trägt gar keine Profile.
- **Autor-Meldungen** (`field="error"`/`"warning"`/`"info"`) tragen
  `origin="authorMessage"` und keine `limitId`; sie gehören nicht in
  `firing`/`absent`. Betroffen wären hier die „Allow special characters?"-Hinweise
  an Kemmler (`:10762`), Krell (`:12363`) und der Border-Patrols-Hinweis am
  „Vampire Fleet Captain" (`:12815`) — ihr eigenes Szenario ist
  [`../author-message-severity/`](../author-message-severity/README.md).

### Bewusst offen gelassen

| Facette | Warum |
|---------|-------|
| **Die Eigengrenzen der Kontingente auf `limit::pts`** (`8f3f-ffa8-387b-0bf9`, `f3aa-b530-9b6c-0995`; Basis `min 0`, per Modifikator auf `2000` gesetzt) | Ihr `actual` müsste über die Messgröße des Budgets hergeleitet werden, die die Formatspezifikation für den Bericht nicht festlegt (dieselbe Zurückhaltung wie in [`../condition-group-not/`](../condition-group-not/README.md)). Das Budget **3000** erfüllt die Forderung unter der Lesart „`limit::` = das eingestellte Kostenlimit der Roster" ([§7.7, Condition-Tabelle](../../battlescribe/building-blocks/modifier.md#condition--eine-voraussetzung)); asseriert wird sie trotzdem nicht. |
| **Der Lord-Höchstwert `fda5-91c2-e17f-774c`** (`.gst:363`, `max 1`, `scope="parent"` an der `categoryEntry`, per Klasse auf 2 gehoben) | `scope="parent"` an einer `categoryEntry` ist von der Formatspezifikation nicht eindeutig bestimmt, und mit höchstens **einer** Lord-Auswahl je Roster unterscheidet die Grenze ohnehin keine Lesart. Deshalb weder in `firing` noch in `absent` noch als `effectiveMax`. |
| **Ob die Engine eine Diagnose meldet**, wenn ein `modifier`-`field` nicht auflöst | Weder die Format-Doku noch die XSD sagen, ob ein solcher Verweis ein Datenfehler mit Meldepflicht oder eine stille No-op ist. Dieses Szenario pinnt allein die **Wirkung** (keine), nicht die **Meldung** — `diagnostics` bleibt unbesetzt. |
| **Ein dritter Träger derselben Konstruktion** | Im Korpus nicht vorhanden: die Id kommt genau zweimal vor. Beide Vorkommen sind hier abgedeckt — je ein Paar „ohne Lord / mit Lord" pro Kontingent, wie es die Daten hergeben (beide Sonderheere haben eine erreichbare, im Kontingent aufgedeckte Lord-Einheit: Kemmler bzw. Luthor Harkon, beide obendrein dort Pflicht). |

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Spielsystem (`.gst`) | `0d13-7737-ea86-4662` |
| Katalog „Vampire Counts" | `4d73-5ab0-9020-403c` |
| Bibliothek „Mercenaries" (per `catalogueLink` `ef73-f9bd-e250-54d2`) | `fc47-8392-a6c8-452a` |
| **Das haltlose Ziel** (nur als `field` zweier `set`-Modifikatoren vorhanden) | **`a59d-2ddb-429c-1aca`** |
| Kategorie „Lord" (`.gst:220`, versteckt unter 2000 pts) | `d024-d25b-a9b4-73b6` |
| — deren Höchstmaß (`max 1`, `scope="parent"`, Klasse 3000–3999 ⇒ 2), **nicht** asseriert | `fda5-91c2-e17f-774c` |
| Kontingent „Army of the Lichemaster (WD#309-UK)" (`:29441`) | `f37a-a93e-fa22-61a8` |
| — dessen Lord-`categoryLink` (Träger von Modifikator **und** Grenze, `:29447`) | `7a76-8153-c4b2-9fee` |
| — dessen echte Grenze `min 1`, `field=selections`, `scope=parent`, `shared=true` (`:29452`) | **`760d-2352-9fac-0e46`** |
| — dessen Heroes-`categoryLink` ohne Grenzen (`:29455`) | `7352-efeb-1090-e8d5` |
| — dessen Eigengrenze `limit::pts` (`:29461`), per `set 2000` (`:29464`) | `8f3f-ffa8-387b-0bf9` |
| Kontingent „Vampire Coast (WD#306-UK)" (`:29471`) | `bf46-ee85-7c10-ba98` |
| — dessen Lord-`categoryLink` (`:29477`) | `aa77-6ac1-ba5c-5646` |
| — dessen echte Grenze `min 1`, `scope=parent` (`:29482`) | **`8471-437a-59d6-bc3d`** |
| — dessen Core-`categoryLink` mit **echtem** `increment` + `repeat` (`:29486`) | `4292-f5de-24ff-93a7` |
| — dessen Heroes-`categoryLink` ohne Grenzen (`:29485`) | `df96-11e5-67c3-4e13` |
| — dessen Eigengrenze `limit::pts` (`:29499`), per `set 2000` (`:29502`) | `f3aa-b530-9b6c-0995` |
| Kategorie „Core" (`.gst:372`) — Untergrenze `min 2`, Klasse 3000–3999 ⇒ 4 (`.gst:395`) | `64bf-efb4-9978-26df` — constraint `35c2-d478-392a-aeb1` |
| Kategorie „Heroes" (`.gst:366`) — nur `max -1` = unbegrenzt | `c16b-f319-2c62-2c12` — constraint `7fca-63fb-63d2-9dad` |
| Kategorie „General" (`.gst:721`) — `min 1` / `max 1`, `scope=force` | `a37e-7207-de6d-acb0` — constraints `1077-7379-f142-f382` / `d818-c60d-b1f8-8aaa` |
| SelectionEntry „General" (`.gst:1191`, 0 pts) | `1b7c-2c90-6d96-28c9` |
| SelectionEntry „Heinrich Kemmler (WD#309-UK)" (`:10536`, `hidden="true"`, im Lichemaster aufgedeckt `:10757`, 550 pts) | `595f-a4e4-5cbc-dab4` |
| — dessen Lord-`categoryLink` (`:10540`) | `5def-cdef-a98d-9a86` |
| — dessen Pflichtgrenze (`min 0` → `set 1`, `:10806`/`:10772`) | `8461-3eab-e5ac-1636` |
| — dessen „General"-`entryLink` (`:10553`) | `f9ae-1022-ca80-6224` |
| SelectionEntry „Krell, King of Wights (WD#309-UK)" (`:12305`, 190 pts, **kein** Lord) | `2d17-c7be-5fd6-f1a3` |
| — dessen Pflichtgrenze (`min 0` → `set 1`, `:12313`/`:12373`) | `60a8-5b49-6b81-7c84` |
| SelectionEntry „Luthor Harkon, Arch Grand Commodore" (`:12696`, `hidden="true"`, im Vampire Coast aufgedeckt `:12703`, 260 pts) | `f9bc-3250-464c-1740` |
| — dessen Lord-`categoryLink` (`:12798`) | `3809-e26d-2360-8293` |
| — dessen Pflichtgrenze (`min 0` → `set 1`, `:12720`/`:12708`) | `6476-ebd7-6fae-8d90` |
| — dessen Obergrenze (`max 1`, `scope=force`, `:12721`) | `f460-f7d0-e0ed-689f` |
| — dessen „General"-`entryLink` mit `min 1` (`:12789`/`:12791`) | `95d8-3d53-2165-2303` / `76c2-0b65-ca83-69b9` |
| SelectionEntry „Vampire Fleet Captain" (`:12802`, im Vampire Coast aufgedeckt `:12804`) | `cc50-6a0b-1c09-7d3e` |
| — dessen **nie gehobene** `min 0`-Grenze (`:12948`) | `c456-6da8-2246-62db` |
| SelectionEntry „Bloated Corpse" (`:13218`, 30 pts, Kategorie Core `2abb-389b-b6ab-6179`, aufgedeckt `:13236`) | `8b63-3344-e972-cd0d` |
| Kostenart „pts" (Klassenschalter `limit::…`) | `ecfa-8486-4f6c-c249` |
| Umgebungsrauschen, nicht asseriert: Wächter der Autor-Meldungen „Allow special characters?" | `8923-5946-7b10-8957` |
