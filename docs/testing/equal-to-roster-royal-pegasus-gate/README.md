# E2E-Regeln & Testkatalog: `equalTo` mit `scope="roster"` — das Royal-Pegasus-Gatter (Bretonnia)

**Rolle:** Black-Box-Test (kein Blick in den Evaluator-Quellcode). Alle Regeln,
IDs, Ist- und Grenzwerte sind allein aus den Katalogdaten der *6th Definitive
Edition*, aus [`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md)
und aus der vendorten `Catalogue.xsd` abgeleitet. Das Roster-Format ist an den
bereits verifizierten Bretonnia-Fixtures aus
[`../at-least-self-equipment-save/`](../at-least-self-equipment-save/README.md)
abgeglichen (direktes `entryId` auf das aufgeloeste Ziel, `entryLinkId` = Id des
`entryLink`s, `entryGroupId` = Id der umschliessenden `selectionEntryGroup`).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee: `Bretonnia (6th definitive edition).cat`
  (`a5c3-073c-b4e8-4284`, rev 1) — Force **„Standard (BR-AB)"** `3a8b-8c11-beff-0534`
- Zusaetzlich noetig: `Mercenaries (6th definitive edition).cat`
  (`fc47-8392-a6c8-452a`, `library="true"`) — der Bretonnia-Katalog deklariert
  sie per `catalogueLink` `99a3-c59a-d610-9847`.

---

## Der Mechanismus in einem Bild

```
selectionEntry "Pegasus Knights" (ff3a-61e9-e154-92cc)   ← Wurzel-Einheit, Kategorie Special
  ├ constraints
  │    └ constraint id=968c-6c14-9c73-d0c5
  │         type="max" field="selections" scope="roster" value="1"
  │         shared="true" includeChildSelections="false" includeChildForces="false"
  └ modifiers
       └ modifier type="set" field="968c-6c14-9c73-d0c5" value="-1"
            └ condition type="equalTo" value="1"
                 field="selections" scope="roster" childId="bfa3-6734-c03f-3594"
                 shared="true" includeChildSelections="true" includeChildForces="true"

selectionEntry "Royal Pegasus" (bfa3-6734-c03f-3594)   ← shared entry, type="upgrade"
   verlinkt als Charakter-Reittier aus fuenf entryLinks (siehe Traegertabelle)
```

Netto: *„0-1 Pegasus Knights — es sei denn, in der Armee steht **genau ein**
Royal Pegasus, dann unbegrenzt."*

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **ETRPG-R1** | Eine Bretonnia-Armee darf **hoechstens eine** Einheit „Pegasus Knights" enthalten. Gezaehlt wird **armeeweit** (`scope="roster"`), nicht pro Kontingent. | `Bretonnia.cat` → `selectionEntry "Pegasus Knights"` `ff3a-61e9-e154-92cc` → constraint **`968c-6c14-9c73-d0c5`** `type="max" value="1" field="selections" scope="roster" percentValue="false" shared="true" includeChildSelections="false" includeChildForces="false"`. |
| **ETRPG-R2** | Diese Obergrenze wird auf **unbegrenzt** gesetzt, wenn die Armee **genau einen** „Royal Pegasus" enthaelt. | Derselbe `selectionEntry` → `modifiers` → **`modifier type="set" field="968c-6c14-9c73-d0c5" value="-1"`**. Der Modifikator adressiert die Grenze ueber deren `id` (§7.6 der Formatdoku). `-1` ist der hingeschriebene Sentinel „unbegrenzt" (§7.6, Sentinel-Kasten). |
| **ETRPG-R3** | Das Gatter ist eine **Gleichheit**, kein Mindestmass: es haelt bei Ist **1** und ist bei Ist **0** wie bei Ist **2** gleichermassen falsch. | Die einzige `condition` des Modifikators: `type="equalTo" value="1" field="selections" scope="roster" childId="bfa3-6734-c03f-3594" percentValue="false" shared="true" includeChildSelections="true" includeChildForces="true"`. Die vendorte XSD (`src/platform/battlescribe/schema/Catalogue.xsd`, `xs:simpleType name="ConditionKind"`) fuehrt `equalTo` als eigenen Aufzaehlungswert **neben** `lessThan`, `greaterThan`, `notEqualTo`, `atLeast` und `atMost` — die Semantik ist damit die exakte Gleichheit des gezaehlten Werts mit `value`, nicht ein Mindest- oder Hoechstmass. |
| **ETRPG-R4** | Gezaehlt wird der **armeeweite** Bestand des shared entry `bfa3-6734-c03f-3594`, ueber alle Kontingente und in beliebiger Verschachtelungstiefe — also auch das Reittier unter einem Charakter unter einem Kontingent. | `scope="roster"` + `includeChildSelections="true"` + `includeChildForces="true"` an derselben `condition`. `shared="true"` heisst: es zaehlt **das Ziel**, unabhaengig davon, ueber welchen der fuenf `entryLink`s es gewaehlt wurde (§7.6, Attributtabelle). Roster 04 nutzt genau das: zwei Royal Pegasus ueber **zwei verschiedene** Links (`5f65-…` am Paladin, `349a-…` an der Damsel). |
| **ETRPG-R5** | Eine Einheit „Pegasus Knights" ist erst mit **3–10 Modellen**, **einem** „Pegasus", **einem** „Gallant" und je **einem** Hand Weapon / Lance / Shield / Heavy Armour katalogkonform. | `ff3a-…` → `selectionEntry "Pegasus Knights"` (`type="model"`) `bfef-1015-d60c-1035` mit `min 3` (**`ab94-5c7c-3fb2-bd09`**) / `max 10` (**`8337-24fc-f0cd-2c64`**), `scope="parent"`; `selectionEntry "Pegasus"` `f299-077e-3d74-9e8c` mit `min 1` (**`2c32-41ac-9c5d-2de8`**) / `max 1` (`31b6-8f02-0ea4-d359`); Gruppe „Command group" `5dbc-1de3-4cd7-68c3` → „Gallant" `2995-2018-2931-43c8` mit `min 1` (**`76c1-253c-26f0-8330`**) / `max 1` (`904b-52d5-a9c0-f13e`); Gruppe „Weapons and Armour" `b03a-42a8-a13f-1c09` → vier `entryLink`s je `min 1`/`max 1`: Hand Weapon (**`e6b0-6756-93e0-dcdd`**), Lance (**`93d7-d3cb-6b2e-504f`**), Shield (**`2f5d-1823-e9ef-5427`**), Heavy Armour (**`06e2-8a3d-a4e5-b26e`**). Alle Rosters dieses Szenarios bauen jede Einheit vollstaendig aus. |
| **ETRPG-R6** | Ein „Royal Pegasus" haengt **nur** an einem Charakter, und nur als Mitglied von dessen „Mounts"-Gruppe — nie an der Einheit Pegasus Knights selbst. | Fuenf `entryLink type="selectionEntry" targetId="bfa3-6734-c03f-3594"`, alle 50 pts — siehe Traegertabelle unten. `ff3a-…` traegt **keinen** solchen Link; die Einheit „reitet" per eigenem `selectionEntry "Pegasus"` `f299-…`, ein anderes Ziel. |
| **ETRPG-R7** | Der „Royal Pegasus" traegt eine **eigene**, parent-skopierte Obergrenze von 1 je Traeger, die durch ein „Banner of the Lady" auf 0 faellt. Das ist **nicht** Gegenstand dieses Szenarios. | `bfa3-…` → constraint **`efa6-a391-f62d-8034`** `type="max" value="1" field="selections" scope="parent"`; dazu `modifier type="set" field="efa6-…" value="0"` mit `condition equalTo 1 scope="parent" childId="36a1-9d3a-15d1-44a7"` („Banner of the Lady", `entryLink` in der Magic-Banner-Gruppe). Keiner der hier verwendeten Traeger fuehrt ein Banner. |

### Traeger eines „Royal Pegasus" (`targetId="bfa3-6734-c03f-3594"`) — vollstaendig

| Traeger-Einheit | Kategorie | `entryLink` | „Mounts"-Gruppe | Punkte |
|-----------------|-----------|-------------|-----------------|--------|
| Bretonnian Lord `bf54-da29-921a-e457` | Lord (primary) | `fb16-14ee-6cb6-5e4b` | `99f3-9464-d966-2a3b` (min 1 / max 1) | 50 |
| Prophetess of the Lady `1efc-5470-e01d-d037` | — | `b769-0b9f-0691-1311` | `2c21-224a-0255-665f` (max 1) | 50 |
| **Paladin `2674-4f8e-d872-f448`** | Heroes (primary) | **`5f65-7e04-08cd-39dd`** | **`cf84-8d9b-e694-0f3e`** (min 1 / max 1) | 50 |
| **Damsel of the Lady `9f03-3ab3-72d8-3a69`** | Heroes (primary) | **`349a-77d5-4b8c-5f81`** | **`aa68-c75c-7e72-95c7`** (max 1) | 50 |
| Paladin Battle Standard Bearer `2f57-db88-56b5-180f` | — | `e7b0-35f2-5dc4-9d05` | Mounts-Gruppe des BSB | 50 |

Gewaehlt sind **Paladin** und **Damsel**: beide sind Helden (keine Beruehrung
mit den punkteskalierenden Lord-Slots am `categoryLink` `d1d3-6362-e2f7-23c9`),
beide brauchen wenige Pflichtteile, und sie erreichen dasselbe Ziel ueber
**zwei verschiedene `entryLink`s** — genau der Nachweis fuer `shared="true"`
in ETRPG-R4.

- **Paladin** katalogkonform: Vow-Gruppe `db72-6f10-69f3-a133` `min 1`
  (`6b67-31e7-0623-7bce`) → „Knights Vow" (Link `da35-acc1-2d40-fe4d` auf
  `e432-4d78-0f50-1e35`, 0 pts); Hand Weapon `min 1` (`9cd2-349a-8d91-03cc`);
  Heavy Armour `min 1` (`7374-751c-a4c2-9be5`); Mounts-Gruppe `min 1`
  (`50f5-2b5f-6625-d104`) → der Royal Pegasus erfuellt sie. 60 + 50 = **110 pts**.
- **Damsel** katalogkonform: Hand Weapon `min 1` (`fe29-e78b-6881-23d2`);
  Gruppe „Magic level" `c0a2-4ce4-e325-75bd` `min 1` (`9558-8cc9-fe43-adb2`) →
  „Magic Level 1" (Link `76ab-3c3b-4eef-d212` auf `158f-d753-59e2-9ad2` in der
  `.gst`, 0 pts); die Mounts-Gruppe `aa68-…` hat **nur** ein `max 1`
  (`08fd-508b-cc75-ea79`), das Reittier ist dort also freiwillig.
  70 + 50 = **120 pts**.

---

## Wie `actual` und `bound` zustande kommen

- **`bound`** ist der Wert der Grenze `968c-6c14-9c73-d0c5` **nach** Anwendung
  des Modifikators: `1`, wenn die `equalTo`-Bedingung falsch ist; `-1`
  (unbegrenzt), wenn sie haelt. Eine unbegrenzte Grenze kann nicht gerissen
  werden — deshalb steht in den Gatter-offenen Rosters kein `firing`-Eintrag,
  sondern `absent`.
- **`actual`** ist die Zahl der roster-weit gezaehlten „Pegasus Knights"-
  Auswahlen. Jede Einheit steht als eigene `<selection entryId="ff3a-…"
  number="1">` im Roster; zwei Einheiten ergeben **2**, drei ergeben **3**.
  `includeChildSelections="false"` an der Grenze aendert daran nichts: das
  betrifft die verschachtelten Auswahlen *unterhalb* des Zaehlrahmens, nicht die
  Zahl der Traeger-Instanzen (§7.6, „`false` zaehlt just `scope`'s `field`").
- Die Rosters 02 und 04 tragen jeweils **zwei** Einheiten, damit die Ist-Zahl in
  beiden Faellen identisch **2** ist. So unterscheiden sich die beiden Faelle
  ausschliesslich im Wert der Grenze — die Rueckkehr der Verletzung in Roster 04
  ist damit eindeutig dem `equalTo` zuzuschreiben und nichts anderem.

---

## Testkatalog

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle
referenzieren `.gst` + Bretonnia-`.cat` (+ die per `catalogueLink` benoetigte
`Mercenaries`-`.cat`), alle nutzen die Force „Standard (BR-AB)"
`3a8b-8c11-beff-0534` und ein Punktelimit von 2000.

> **Assertion-Fokus:** die Grenze `968c-6c14-9c73-d0c5` und die
> Pflicht-Mindestgrenzen der aufgebauten Einheiten. Andere Armeeaufbau-Diagnosen
> (General-Pflicht, Core-Mindestzahl, Punktelimit) koennen zusaetzlich auftreten
> und sind hier ohne Belang.

| # | Testtitel | Roster-Zustand | Ist Royal Pegasus | `equalTo 1` | Grenze `968c-…` | Erwartetes Ergebnis | Fixture |
|---|-----------|----------------|-------------------|-------------|------------------|---------------------|---------|
| 01 | Grundlinie: eine Einheit, kein Royal Pegasus | 1× Pegasus Knights (voll ausgebaut) | 0 | **falsch** | 1 | **Keine** Verletzung: Ist 1 ≤ Grenze 1. Zeigt, dass erst die zweite Einheit die Grenze reisst. | [`01-one-unit-no-royal-pegasus-legal.ros`](rosters/01-one-unit-no-royal-pegasus-legal.ros) |
| 02 | Zwei Einheiten ohne Royal Pegasus (unzulaessig) | 2× Pegasus Knights | 0 | **falsch** | 1 | **Verletzung ETRPG-R1:** `968c-6c14-9c73-d0c5`, **Ist 2 / Grenze 1**. | [`02-two-units-no-royal-pegasus-illegal.ros`](rosters/02-two-units-no-royal-pegasus-illegal.ros) |
| 03 | Zwei Einheiten mit **genau einem** Royal Pegasus (legal) | 2× Pegasus Knights + Paladin mit Royal Pegasus | **1** | **haelt** | **-1** | **Keine** Verletzung von `968c-…`: der `set`-Modifikator hat die Grenze auf unbegrenzt gesetzt (ETRPG-R2). | [`03-two-units-one-royal-pegasus-legal.ros`](rosters/03-two-units-one-royal-pegasus-legal.ros) |
| 04 | Zwei Einheiten mit **zwei** Royal Pegasus (unzulaessig) | wie 03, zusaetzlich Damsel mit Royal Pegasus | 2 | **falsch** | 1 | **Verletzung ETRPG-R1/R3:** `968c-6c14-9c73-d0c5`, **Ist 2 / Grenze 1** — die Verletzung kommt zurueck. Ein `atLeast 1` haette hier weiter gehalten; dieser Fall trennt `equalTo` von `atLeast`. | [`04-two-units-two-royal-pegasus-illegal.ros`](rosters/04-two-units-two-royal-pegasus-illegal.ros) |
| 05 | Drei Einheiten bei einem Royal Pegasus (legal) | 3× Pegasus Knights + Paladin mit Royal Pegasus | 1 | **haelt** | **-1** | **Keine** Verletzung: der gesetzte Wert ist der Sentinel „unbegrenzt", nicht eine auf 2 angehobene Grenze. | [`05-three-units-one-royal-pegasus-legal.ros`](rosters/05-three-units-one-royal-pegasus-legal.ros) |

### Warum gerade diese fuenf

- **02 gegen 03** zeigt, dass das Gatter ueberhaupt wirkt (Verletzung → keine
  Verletzung), bei **identischer** Ist-Zahl 2.
- **03 gegen 04** ist der eigentliche `equalTo`-Nachweis: **mehr** vom gegatterten
  Kind macht die Bedingung wieder falsch. Eine Auswertung, die `equalTo` als
  „mindestens" liest, wuerde Roster 04 faelschlich als legal durchgehen lassen.
- **01 gegen 02** haelt fest, dass `actual` mit der Zahl der Einheiten waechst
  und die Grenze wirklich bei 1 liegt.
- **05** trennt den Sentinel `-1` von einer blossen Anhebung: die Bedingung
  haelt weiterhin bei einem Royal Pegasus, obwohl drei Einheiten im Heer stehen.

### Bewusst nicht behauptet

| Sachverhalt | Warum nicht in `firing`/`absent` |
|-------------|----------------------------------|
| `efa6-a391-f62d-8034` in **Roster 04** | Die Eigengrenze des Royal Pegasus ist `scope="parent"` **und** `shared="true"`. In Roster 04 haengen zwei Royal Pegasus an **zwei verschiedenen** Eltern. §7.6 der Formatdoku beschreibt `shared="true"` als „die Summe umfasst alle Auswahlen dieses shared entry im Roster" und laesst damit offen, wie sich das mit einem engeren `scope` verzahnt — ein Punkt, den die Quelle nicht aufloest. In den Rosters 03 und 05 (genau **ein** Royal Pegasus im ganzen Heer) ist die Grenze unter jeder Lesart erfuellt; nur dort steht sie in `absent`. |
| Alle `max`-Grenzen mit `scope="parent"` innerhalb der Einheit (`31b6-8f02-0ea4-d359`, `904b-52d5-a9c0-f13e`, `de3a-e230-4e8f-7a13`, `37c3-2dae-0196-8476`, `6cdb-d758-0313-548d`, `e04f-3932-e237-8242`) | Dieselbe offene Stelle: sie sind `shared="true"` mit `value="1"`, und in den Rosters stehen zwei bzw. drei gleichartige Einheiten. Behauptet werden nur die zugehoerigen **Mindest**grenzen, die unter jeder Lesart erfuellt sind, sowie `8337-24fc-f0cd-2c64` (max 10 Modelle), das selbst bei roster-weiter Summierung mit 9 Modellen nicht gerissen wird. |
| Sichtbarkeit (`hidden`) und Profilwerte | Kommen im Gatter dieses Szenarios nicht vor. Der Verletzungsbericht kodiert ohnehin nur zaehlende Grenzen (siehe [`../vampire-bloodlines/README.md`](../vampire-bloodlines/README.md)). |
| General-Pflicht, Core-Mindestzahl, Punktelimit | Bewusst offen gelassene Armeeaufbau-Regeln — die Rosters sind auf den Gegenstand des Szenarios reduziert. Die Erwartung ist selektiv, solche Diagnosen duerfen zusaetzlich auftreten. |

---

## Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Katalog Bretonnia (rev 1) | `a5c3-073c-b4e8-4284` — `gameSystemId` `0d13-7737-ea86-4662` |
| Force „Standard (BR-AB)" | `3a8b-8c11-beff-0534` |
| `catalogueLink` auf Mercenaries | `99a3-c59a-d610-9847` → `fc47-8392-a6c8-452a` |
| **Pegasus Knights (Wurzel-Einheit, Special)** | **`ff3a-61e9-e154-92cc`** |
| **Die gegatterte Grenze (max 1, `scope="roster"`)** | **`968c-6c14-9c73-d0c5`** |
| **Royal Pegasus (shared entry, `type="upgrade"`)** | **`bfa3-6734-c03f-3594`** |
| Pegasus-Knights-Modell (min 3 / max 10) | `bfef-1015-d60c-1035` — `ab94-5c7c-3fb2-bd09` / `8337-24fc-f0cd-2c64` |
| „Pegasus" der Einheit (min 1 / max 1) | `f299-077e-3d74-9e8c` — `2c32-41ac-9c5d-2de8` / `31b6-8f02-0ea4-d359` |
| Gruppe „Command group" / „Gallant" (min 1 / max 1) | `5dbc-1de3-4cd7-68c3` / `2995-2018-2931-43c8` — `76c1-253c-26f0-8330` / `904b-52d5-a9c0-f13e` |
| Gruppe „Weapons and Armour" | `b03a-42a8-a13f-1c09` |
| Hand Weapon / Lance / Shield / Heavy Armour (Ziele) | `abdb-bbd0-41b2-5dff` / `8649-8ac8-5a6f-fd8d` / `50e2-1873-a856-03e7` / `dde4-0ba8-7b3c-57b7` |
| deren Links in `b03a-…` | `ff7d-2f06-eea7-f541` / `77dd-73b2-dc08-6d33` / `6a05-995e-9317-c524` / `5cc3-7722-5ed8-dcde` |
| deren `min 1`-Grenzen | `e6b0-6756-93e0-dcdd` / `93d7-d3cb-6b2e-504f` / `2f5d-1823-e9ef-5427` / `06e2-8a3d-a4e5-b26e` |
| Paladin (Held, 60 pts) | `2674-4f8e-d872-f448` |
| Paladin: Vow-Gruppe (min 1) / Knights Vow | `db72-6f10-69f3-a133` — `6b67-31e7-0623-7bce` / Link `da35-acc1-2d40-fe4d` → `e432-4d78-0f50-1e35` |
| Paladin: Mounts-Gruppe (min 1 / max 1) | `cf84-8d9b-e694-0f3e` — `50f5-2b5f-6625-d104` / `228c-ed0d-33fc-7d17` |
| Paladin: Royal-Pegasus-Link (50 pts) | `5f65-7e04-08cd-39dd` |
| Paladin: Hand Weapon / Heavy Armour (min 1) | Link `0027-677d-c09c-3f85` — `9cd2-349a-8d91-03cc` / Link `c63e-2489-573b-7ff4` — `7374-751c-a4c2-9be5` |
| Damsel of the Lady (Held, 70 pts) | `9f03-3ab3-72d8-3a69` |
| Damsel: Mounts-Gruppe (nur max 1) | `aa68-c75c-7e72-95c7` — `08fd-508b-cc75-ea79` |
| Damsel: Royal-Pegasus-Link (50 pts) | `349a-77d5-4b8c-5f81` |
| Damsel: Hand Weapon (min 1) | Link `7580-9dec-7971-c142` — `fe29-e78b-6881-23d2` |
| Damsel: Gruppe „Magic level" (min 1 / max 1) | `c0a2-4ce4-e325-75bd` — `9558-8cc9-fe43-adb2` / `e3e4-9537-af28-f789` |
| Magic Level 1 (Ziel in der `.gst`, 0 pts) | Link `76ab-3c3b-4eef-d212` → `158f-d753-59e2-9ad2` |
| Eigengrenze des Royal Pegasus (max 1, `scope="parent"`) | `efa6-a391-f62d-8034` — Gegen-Gatter `childId="36a1-9d3a-15d1-44a7"` („Banner of the Lady") |
| Kostenart „pts" | `ecfa-8486-4f6c-c249` |
