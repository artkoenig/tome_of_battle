# E2E-Regeln & Testkatalog: `greaterThan` (scope=force, Eintrags-`childId`) schaltet eine Grenze auf „unbegrenzt" (Ogre Kingdoms)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Regeln aus den
Katalogdaten der *6th Definitive Edition* abgeleitet; das Eingabeformat der
Roster folgt den bereits verifizierten Szenario-Fixtures (direktes `entryId`,
`entryLinkId=""`, geschachtelte `selections` mit `number`).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee: `Ogre Kingdoms (6th definitive edition).cat`
  (`731d-5b13-2a92-5427`, rev 2) — Force **„Standard (OK-AB)"** `729f-9246-5cd3-5044`
- Dazu `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`, per
  `catalogueLink` `a067-78d5-50a2-affe` aus der Ogre-`.cat` eingebunden). Die
  Roster greifen tatsächlich hinein: **Ogre Bulls** (`7754-8b3d-df99-d2d5`),
  **Ogre Club** (`8768-377c-88da-c3e8`) und ihr Modellslot stehen dort.
  Ein weiterer Katalog wird **nicht** gebraucht.

## Der gepinnte Mechanismus

Eine `condition type="greaterThan"` mit `field="selections"`, `scope="force"`
und einer **Eintrags-Id** in `childId` hält genau dann, wenn das umschließende
Kontingent **strikt mehr** Selektionen dieses Eintrags führt als der `value` der
Bedingung. Hält sie, ersetzt der von ihr gegatete `set`-Modifier den Wert der
adressierten Grenze *exakt* ([§7.6/§7.7 der Formatdoku](../../battlescribe-data-format.md):
*„Modifier adressieren einen Constraint über dessen `id`"*). Der geschriebene
Wert ist hier **`-1`** — und `-1` an einem `max` heißt laut Sentinel-Kasten in
[§7.6](../../battlescribe-data-format.md) **„unbegrenzt"**, nicht „eins" und
nicht „keins".

```
selectionEntry "Slaughtermaster" (0ff3-ec4d-1c6b-6d53, type=unit, Kategorie Lord)
  ├ constraint max 0  selections scope=roster  c70d-c292-36ee-21b5
  │     shared=true includeChildSelections=true includeChildForces=true
  ├ modifier set -1  field=c70d-c292-36ee-21b5          ← das Gatter
  │     └ condition type=greaterThan value=0 field=selections scope=force
  │          childId=2679-58f4-1771-662d ("Tyrant")
  │          shared=true includeChildSelections=true includeChildForces=true
  ├ modifier set true field=hidden                      ← Sichtbarkeits-Gatter
  │     └ conditionGroup or → condition instanceOf scope=force
  │          childId=8711-ed16-2a44-7251 (forceEntry „Ironskin Tribe (WD#309-UK)")
  └ entryLink "Ogre Club" cb68-e576-63d9-ce9a → 8768-377c-88da-c3e8
        min 1 (947e-b119-5cdb-99ca) / max 1 (7cce-b2b8-4a66-15ad), scope=parent
```

Netto: **Ohne Tyrant im Kontingent darf gar kein Slaughtermaster im Roster
stehen; mit mindestens einem Tyrant beliebig viele.** Die einzige Variable
zwischen den Rostern ist damit die Anwesenheit des Tyrants bzw. die Zahl der
Slaughtermaster — der Mechanismus ist vollständig isoliert.

**Wahl des Kontingents.** Alle Roster nutzen **„Standard (OK-AB)"**
(`729f-9246-5cd3-5044`), **nicht** „Ironskin Tribe" (`8711-ed16-2a44-7251`).
Nur so hält die `instanceOf`-Bedingung des zweiten Modifiers **nicht**, der
Slaughtermaster bleibt sichtbar, und der Fall wird nicht durch die
Sichtbarkeitsregel überlagert (eine effektiv versteckte Entität wird bei
Min-Grenzen nicht validiert, [§8](../../battlescribe-data-format.md)).

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **GTFU-R1** | Der Slaughtermaster trägt als **geschriebene** Grenze **max 0** Selektionen, gezählt **armeeweit** (`scope="roster"`, `includeChildSelections`/`includeChildForces` = `true`). Ohne Modifier darf also **kein einziger** im Roster stehen. | `Ogre Kingdoms (6th definitive edition).cat`, `selectionEntry` `0ff3-ec4d-1c6b-6d53` → constraint **`c70d-c292-36ee-21b5`** (`type=max value=0 field=selections scope=roster shared=true includeChildSelections=true includeChildForces=true`). |
| **GTFU-R2** | Genau **ein** Modifier adressiert diese Grenze: `type="set" value="-1"`. Er trägt **genau eine** Bedingung, keine `conditionGroups` und keine `repeats`. | Ebd. → `<modifier type="set" field="c70d-c292-36ee-21b5" value="-1">` mit einem einzigen `<conditions>`-Kind. Kein weiterer Modifier im Datensatz nennt `c70d-c292-36ee-21b5` als `field`. |
| **GTFU-R3** | Die Bedingung hält genau dann, wenn das **Kontingent** **strikt mehr als 0** Tyrant-Selektionen führt — also ab dem ersten Tyrant. `0 > 0` ist falsch, `1 > 0` und `2 > 0` sind wahr. | Ebd. → `<condition field="selections" scope="force" value="0" percentValue="false" shared="true" includeChildSelections="true" includeChildForces="true" childId="2679-58f4-1771-662d" type="greaterThan"/>`; `2679-58f4-1771-662d` ist das Wurzel-`selectionEntry` **„Tyrant"** (`type=unit`, `categoryLink` Lord `d024-d25b-a9b4-73b6`, primary). `greaterThan` ist ein **strikter** Vergleich ([§7.7](../../battlescribe-data-format.md), Tabelle `condition`-`type`) — `atLeast` wäre der nicht-strikte. |
| **GTFU-R4** | Hält die Bedingung, ist der effektive Wert von `c70d-c292-36ee-21b5` der **hingeschriebene Sentinel `-1` = unbegrenzt** — die Grenze feuert dann bei **jeder** Zahl von Slaughtermastern nicht. | [§7.6, Sentinel-Kasten](../../battlescribe-data-format.md): `-1` bedeutet „unbegrenzt" genau dort, wo er hingeschrieben steht — u. a. **„am `value` eines `set`-Modifiers auf einen Constraint"**. Der Wert ist geschrieben, nicht errechnet (kein `increment`/`decrement`/`multiply`). Schwester-Szenarien: [`max-unlimited-violation`](../max-unlimited-violation/) (Rohwert `-1` feuert nie) und [`unlimited-modifier-toggle`](../unlimited-modifier-toggle/) (Fall B: `set -1` hebt eine `max 0`-Grenze auf). |
| **GTFU-R5** | „Unbegrenzt" wird im Bericht als **`effectiveMax = null`** (und folglich `headroom = null`) ausgedrückt — nicht als Zahl `-1`. | Aus dem Manifest-Vokabular der bestehenden Szenarien abgeleitet: [`offer-and-category-slots`](../offer-and-category-slots/scenario.json) assertiert für den **Heroes**-Kategorie-Anker (`c16b-f319-2c62-2c12`) `effectiveMax: null, headroom: null`; die einzige Grenze dieser Kategorie ist `constraint type="max" value="-1"` (`7fca-63fb-63d2-9dad`, `.gst`). Ein geschriebenes `max -1` ⇒ **kein** Höchstmaß. Zusammen mit GTFU-R4 gilt das auch für den per `set -1` aufgehobenen Deckel. |
| **GTFU-R6** | Der Slaughtermaster ist im Kontingent **„Standard (OK-AB)" nicht verborgen**; verborgen wird er nur im Kontingent **„Ironskin Tribe"**. | Ebd. → `modifier type="set" value="true" field="hidden"` mit `conditionGroup type="or"` → `condition type="instanceOf" scope="force" childId="8711-ed16-2a44-7251"`; `8711-ed16-2a44-7251` ist das `forceEntry` „Ironskin Tribe (WD#309-UK)" derselben `.cat`. Für `729f-9246-5cd3-5044` („Standard (OK-AB)") hält die Bedingung nicht; der Basiswert des Eintrags ist `hidden="false"`. |
| **GTFU-R7** | Sichtbarkeit ist **keine zählende Grenze**: GTFU-R6 erscheint **nicht** als feuernde Grenze im Verletzungsbericht. Sie wird stattdessen als Slot-Eigenschaft `isHidden=false` assertiert. | Projektkonvention der bestehenden Szenarien (z. B. [`vampire-bloodlines`](../vampire-bloodlines/README.md), VBL-R4/R5): der Verletzungsbericht kodiert Zählgrenzen, keine (Un-)Sichtbarkeit. Der Manifest-Vertrag bietet dafür `capabilities[].isHidden`. |
| **GTFU-R8** | Die Pflicht-Kinder der eingesetzten Einheiten sind erfüllt, damit keine fremde Grenze mitfeuert: Slaughtermaster **Ogre Club min 1** (`947e-b119-5cdb-99ca`), Tyrant **Ogre Club min 1** (`c572-4ef8-0dc5-2131`) **und Gruppe „Armour" min 1** (`d109-0d6c-cf1f-9197`, `defaultSelectionEntryId` = Link `5d1e-c4b7-03cf-fbd1` → „Light Armour" `055f-8e4e-f170-35d2`), Ogre Bulls **Bulls-Modelle min 3** (`92d9-b5d1-9411-e954`) **und Ogre Club min 1** (`fff8-7da0-1bdc-5bdf`). | Ogre-`.cat` `selectionEntry` `0ff3-…`/`2679-…`; Mercenaries-`.cat` `selectionEntry` `7754-8b3d-df99-d2d5`. |
| **GTFU-R9** | Die armeeweite **Ogre-Bulls-Pflichteinheit** ([§9.9](../../battlescribe-data-format.md), `entryLink`-Form) ist in **jedem** Roster erfüllt — deshalb ist sie kein Störfaktor. | Ogre-`.cat`, Wurzel-`entryLink` **`d82e-111e-89b9-2be1`** → Ziel `7754-8b3d-df99-d2d5` mit constraint **`32ed-26da-3f27-5c04`** (`type=min value=0 field=selections scope=force`), angehoben per `modifierGroup`-`modifier type="set" value="1" field="32ed-26da-3f27-5c04"`, gegatet auf `notInstanceOf` Ironskin Tribe — im Kontingent „Standard (OK-AB)" gilt also **min 1**. Jedes Roster führt genau eine Ogre-Bulls-Einheit. |
| **GTFU-R10** | Das gewählte Punktelimit **4000 pts** lässt die punkteskalierten Charakter-Slots die eingesetzten Lords zu und reißt kein Budget. | `.gst`: **Lord**-`categoryEntry` `d024-d25b-a9b4-73b6` → constraint `fda5-91c2-e17f-774c` (`max 1`), `modifier set 3` für „4000-4999 pts" ⇒ effektiv **3 Lords**; die Roster führen höchstens 3 (1 Tyrant + 2 Slaughtermaster). Das `set hidden=true` der Lord-Kategorie greift nur unter 2000 pts. **Rare** `0a44-2d3f-adfe-f3a1`: `set 4` für 4000-4999 ⇒ die eine Ogre-Bulls-Einheit (Kategorien Rare/Regiment of Renown) passt. Summe der Roster ≤ ca. 705 pts (Tyrant 200, Slaughtermaster 200 je, Ogre Bulls 0 + 3×35, Ogre Club/Light Armour je 0) — weit unter 4000. |

**Bewusst nicht Gegenstand dieses Szenarios:**

- **Sichtbarkeit als Verstoß (GTFU-R6/R7).** Das `hidden`-Gatter des
  Slaughtermasters wird **nicht** als feuernde Grenze erwartet; es wird nur als
  `isHidden=false` am Slot festgehalten. Wer das Gatter selbst pinnen will,
  findet es in [`set-hidden-force-gate`](../set-hidden-force-gate/).
- **Armeeaufbau-Pflichten, die in *allen* Rostern gleich ausfallen.** Die Roster
  führen bewusst **keine** Core-Einheiten und **keinen** „General"-Eintrag
  (`1b7c-2c90-6d96-28c9`): der Slaughtermaster bietet keinen `General`-`entryLink`
  an, ein General ließe sich also nur in den Tyrant-Rostern unterbringen — das
  wäre eine Asymmetrie genau dort, wo der Fall variiert. Die Kategorie-Pflichten
  **General min 1** (`1077-7379-f142-f382`) und **Core min 5**
  (`35c2-d478-392a-aeb1`, `set 5` für 4000-4999) feuern deshalb in **jedem** der
  vier Roster identisch mit Ist 0 und sind — der Manifest-Konvention folgend —
  **nicht** Teil der Erwartung.
- **Die Tyrant-Obergrenze** `cb1c-3389-8f55-d6c6` (`max 1`, `scope=roster`) ist
  in allen Rostern eingehalten (0 bzw. 1 Tyrant) und steht als Gegenprobe in
  `absent`.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle vier sind
**bis auf den Tyrant und die Zahl der Slaughtermaster identisch**: Kontingent
„Standard (OK-AB)", Punktelimit 4000, eine Ogre-Bulls-Einheit (3 Bulls +
Pflicht-Ogre-Club), jeder Slaughtermaster mit seinem Pflicht-Ogre-Club, jeder
Tyrant mit Pflicht-Ogre-Club und Pflicht-Light-Armour.

> **Assertion-Fokus:** die Grenze `c70d-c292-36ee-21b5` (feuernd in 01,
> abwesend in 02–04) und das **effektive Maximum** des Slaughtermaster-Slots
> (`expect.capabilities`, Feld `effectiveMax`). Andere Armeeaufbau-Diagnosen
> (General-/Core-Pflicht, Charakter-Slots, Punktelimit) können zusätzlich
> auftreten und sind hier ohne Belang.

| # | Testtitel | Betroffene Katalogdateien | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|---------------------------|----------------|-------------------------------------------------------|---------|
| 01 | Gatter zu: kein Tyrant → max 0 | `.gst` + Ogre-`.cat` (+ Mercenaries) | **Kein** Tyrant, **ein** Slaughtermaster. | **GTFU-R1/R3:** `0 > 0` ist falsch, der `set -1` bleibt inert. `c70d-c292-36ee-21b5` feuert mit **Ist 1 / Grenze 0**; der Slaughtermaster-Slot meldet `effectiveMax=0`, `isBlocked=true`, `isHidden=false`. | [`01-no-tyrant-slaughtermaster-max0.ros`](rosters/01-no-tyrant-slaughtermaster-max0.ros) |
| 02 | Gatter auf: ein Tyrant → unbegrenzt | wie 01 | **Ein** Tyrant, **ein** Slaughtermaster. | **GTFU-R3/R4/R5:** `1 > 0` hält, der `set -1` hebt die Grenze auf. `c70d-…` feuert **nicht**; der Slot meldet `effectiveMax=null`, `headroom=null`, `isBlocked=false`. | [`02-tyrant-one-slaughtermaster-unlimited.ros`](rosters/02-tyrant-one-slaughtermaster-unlimited.ros) |
| 03 | Unbegrenzt ≠ 1: zwei Slaughtermaster in einem Slot | wie 01 | **Ein** Tyrant, **zwei** Slaughtermaster als **eine** Selektion (`number="2"`). | **GTFU-R4:** Wäre `-1` still als `1` gelesen, müsste `c70d-…` bei Ist 2 feuern. Erwartung: **feuert nicht**; der Slot meldet `current=2` bei `effectiveMax=null`. | [`03-tyrant-two-slaughtermasters-unlimited.ros`](rosters/03-tyrant-two-slaughtermasters-unlimited.ros) |
| 04 | Dieselbe Zählung, zwei getrennte Selektionen | wie 01 | **Ein** Tyrant, **zwei** Slaughtermaster als **zwei** Selektionen (je `number="1"`). | **GTFU-R1/R4:** Die armeeweite Zählung sieht in beiden Kodierungen dieselbe Summe 2; `c70d-…` bleibt still. **Keine** Slot-Aussage (siehe Ableitungshinweis unten). | [`04-tyrant-two-slaughtermaster-selections-unlimited.ros`](rosters/04-tyrant-two-slaughtermaster-selections-unlimited.ros) |

**Ableitung der Zahlen (aus den Daten, nicht aus einem Engine-Lauf):**

- `bound = 0` in Test 01 ist der **geschriebene** `value` des Constraints
  `c70d-c292-36ee-21b5` (GTFU-R1); `actual = 1` folgt aus der einen
  Slaughtermaster-Selektion mit `number="1"` im Roster, gezählt im Rahmen
  `scope="roster"` (armeeweit, `includeChildForces="true"`).
- In den Tests 02–04 ist der effektive `value` der **gesetzte** `-1`
  (GTFU-R2/R3/R4) und damit gar keine Obergrenze mehr — deshalb steht die Id in
  `absent` statt in `firing`, und es gibt kein `bound` zu nennen.
- `current` am Slot ist die Stückzahl der Selektion (`number`): 1 in 01/02, 2 in
  03. Die Zahlenbasis ist die **absolute** `.ros`-Stückzahl
  ([§7.5](../../battlescribe-data-format.md), Kasten „Zahlenbasis").
- `effectiveMin = null`: der Slaughtermaster trägt **keine** `min`-Grenze;
  `isMandatoryUnmet = false` folgt daraus.
- **Warum Test 03 `number="2"` und Test 04 zwei Selektionen nutzt:** Test 03 soll
  eine **eindeutige** Slot-Aussage tragen; ein `capabilities`-Selektor muss laut
  Manifest-Vertrag genau einen Slot treffen, und zwei gleiche Definitionen im
  selben Rahmen wären ohne Pfad mehrdeutig. Test 04 liefert die zweite Kodierung
  derselben Zählung nach — dort ohne Slot-Aussage.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Force „Standard (OK-AB)" (Slaughtermaster sichtbar) | `729f-9246-5cd3-5044` |
| Force „Ironskin Tribe (WD#309-UK)" (bewusst gemieden, versteckt den Slaughtermaster) | `8711-ed16-2a44-7251` |
| Slaughtermaster (Lord, `type=unit`) | `0ff3-ec4d-1c6b-6d53` |
| — max 0 (`scope=roster`), Ziel des `set -1` | constraint **`c70d-c292-36ee-21b5`** |
| — Pflicht-Ogre-Club min 1 / max 1 (`scope=parent`) | `947e-b119-5cdb-99ca` / `7cce-b2b8-4a66-15ad` (Link `cb68-e576-63d9-ce9a`) |
| Tyrant (Lord, `type=unit`) — das Gatter-Ziel in `childId` | `2679-58f4-1771-662d` |
| — Tyrant-Obergrenze max 1 (`scope=roster`) | constraint `cb1c-3389-8f55-d6c6` |
| — Pflicht-Ogre-Club min 1 (`scope=parent`) | `c572-4ef8-0dc5-2131` (Link `d147-4027-3433-9add`) |
| — Gruppe „Armour" min 1 (`scope=parent`), Default „Light Armour" | `d109-0d6c-cf1f-9197` (Gruppe `3668-9d1a-d2b4-acf2`, Default-Link `5d1e-c4b7-03cf-fbd1`) |
| Ogre Club (Mercenaries, 0 pts) | `8768-377c-88da-c3e8` |
| Light Armour (`.gst`, 0 pts) | `055f-8e4e-f170-35d2` |
| Ogre Bulls (Mercenaries, Pflichteinheit der Armee) | `7754-8b3d-df99-d2d5` |
| — Modellslot „Bulls" min 3 (`scope=parent`) | `411b-6f5f-06f1-be37` — constraint `92d9-b5d1-9411-e954` |
| — Pflicht-Ogre-Club min 1 (`scope=parent`) | `fff8-7da0-1bdc-5bdf` (Link `415f-94c9-571c-19c6`) |
| Wurzel-`entryLink` „Ogre Bulls" mit der Armee-Pflicht (§9.9) | `d82e-111e-89b9-2be1` — constraint `32ed-26da-3f27-5c04` |
| Lord-Kategorie (punkteskalierter Slot-Deckel) | `d024-d25b-a9b4-73b6` — constraint `fda5-91c2-e17f-774c` |
| Heroes-Kategorie (Beleg „`max -1` ⇒ `effectiveMax=null`") | `c16b-f319-2c62-2c12` — constraint `7fca-63fb-63d2-9dad` |
| Katalog-Link auf Mercenaries | `a067-78d5-50a2-affe` → `fc47-8392-a6c8-452a` |
| „Border Patrols rules" (in keinem Roster enthalten — alle BP-Modifier bleiben inert) | `4e15-0353-165f-5528` |
