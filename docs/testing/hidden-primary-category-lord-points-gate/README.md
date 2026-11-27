# E2E-Regeln & Testkatalog: versteckte Primaer-Kategorie versteckt den Eintrag (Lord unter 2000 Punkten)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln und
Erwartungswerte sind **ausschliesslich** aus den Katalogdaten der *6th
Definitive Edition* (`src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive/`) und aus
[`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md) (§7.7, §8)
abgeleitet. Die Roster-Form folgt den verifizierten Fixtures (direktes `entryId`,
`entryLinkId=""`, geschachtelte `selections` mit `number`); die Punktegrenze steht
wie in [`ancestor-scope-instance-of`](../ancestor-scope-instance-of/README.md) als
`<costLimits><costLimit typeId="ecfa-8486-4f6c-c249" value="…"/></costLimits>`.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armeebuch: `Vampire Counts (6th definitive edition).cat` (`4d73-5ab0-9020-403c`)
  — Kontingent **„Standard (VC-AB)"** `e989-15b8-7eb6-9668` (Z. 29297)
- Bibliothek: `Mercenaries (6th definitive edition).cat` (wie in
  [`vampire-bloodlines`](../vampire-bloodlines/README.md) mitgeladen)

## Der gepinnte Mechanismus (Issue 0204)

Ein Eintrag, dessen **effektive Primaer-Kategorie** im Kontingent **effektiv
versteckt** ist, ist selbst versteckt: sein Angebot meldet `isHidden`, und ist
er trotzdem gewaehlt, meldet der belegte Slot `isHidden` **und** eine
`hiddenSelection`-Verletzung (Schweregrad `error`,
[§8](../../battlescribe-data-format.md#8-kategorien--sichtbarkeit), „Eine versteckte
Entitaet, die trotzdem im Roster liegt, ist ein Fehler"). Wird die Kategorie
sichtbar, verschwinden beide.

Der Traeger im Korpus ist die `.gst`-Kategorie **„Lord"**:

```
categoryEntry "Lord" d024-d25b-a9b4-73b6 hidden="false"           (.gst Z. 220)
  ├ modifier set hidden=true                                       (Z. 222)
  │    └ condition lessThan 2000 field=limit::ecfa-8486-4f6c-c249 scope=roster childId=any
  ├ modifier set 0 → fda5-…   lessThan 200                          (Z. 228)
  ├ modifier set 0 → fda5-…   200 ≤ x < 500, keine Border Patrols    (Z. 234)
  ├ modifier set 0 → fda5-…   Border Patrols ≥ 1                     (Z. 246)
  ├ modifier set 1 → fda5-…   2000 ≤ x < 3000, keine Border Patrols  (Z. 252)
  ├ modifier set 2 → fda5-…   3000 ≤ x < 4000, keine Border Patrols  (Z. 264)
  ├ … (set 3, set 4 …)                                              (Z. 276 ff.)
  └ constraint max 1 selections scope=parent  fda5-91c2-e17f-774c   (Z. 363)
```

`field="limit::ecfa-8486-4f6c-c249"` misst die **eingestellte** Punktegrenze
des Rosters (Kostenart `pts`), nicht die verplanten Punkte.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **HPC-R1** | Unter 2000 Punkten Grenze ist die Kategorie „Lord" **versteckt**, ab 2000 sichtbar. | `.gst` Z. 220–227: `categoryEntry id="d024-d25b-a9b4-73b6" hidden="false"` mit `modifier type="set" value="true" field="hidden"` und `condition type="lessThan" value="2000" field="limit::ecfa-8486-4f6c-c249" scope="roster" childId="any"`. |
| **HPC-R2** | Das Kontingent fuehrt „Lord" als eigene Kategorie; der Kategorie-Link selbst ist nicht versteckt und traegt keine eigenen Modifikatoren — die Sichtbarkeit kommt allein vom Ziel (ODER von Link und Ziel). | VC-`.cat` Z. 29303: `categoryLink id="d321-a893-b7b7-5eae" targetId="d024-d25b-a9b4-73b6" hidden="false"` (selbstschliessend) im `forceEntry` `e989-15b8-7eb6-9668`. |
| **HPC-R3** | Der **Master Necromancer** fuehrt „Lord" als **Primaer**-Kategorie und ist im Kontingent „Standard (VC-AB)" **selbst nicht** versteckt; seine Sichtbarkeit haengt damit allein an HPC-R1. | VC-`.cat` Z. 1949: Wurzel-`selectionEntry id="4ee2-ac3a-3cc6-11af" hidden="false"`; Z. 1954 `categoryLink … targetId="d024-d25b-a9b4-73b6" primary="true"`; sein einziger `field="hidden"`-Modifikator (Z. 2089–2104) haelt nur bei `instanceOf` einer der acht Force-Ids `91ad-…`, `3c87-…`, `5e95-…`, `b1e4-…`, `2102-…`, `4072-…`, `f37a-…`, `bf46-…` — `e989-15b8-7eb6-9668` ist nicht darunter. |
| **HPC-R4** | Versteckter, aber gewaehlter Eintrag → `isHidden` am belegten Slot **und** genau eine `hiddenSelection`-Meldung (`error`). Ein **Angebot** meldet `isHidden`, traegt aber nie eine Meldung. | [§8](../../battlescribe-data-format.md#8-kategorien--sichtbarkeit) (Issue 0119, Issue 0204); Manifest-Vertrag: ein `offerAnchor` traegt nie eine Meldung. |
| **HPC-R5** | Die Lord-Obergrenze `fda5-91c2-e17f-774c` steht bei **1000** auf dem Basiswert **1** (kein `set` greift: nicht < 200, nicht 200–499, keine Border Patrols, nicht ≥ 2000), bei **2000** per `set 1` auf **1**, bei **3000** per `set 2` auf **2**. Hoechstgrenzen gelten unabhaengig von der Sichtbarkeit; mit einem Lord feuert sie in keinem Roster. | `.gst` Z. 363 (`type="max" value="1" field="selections" scope="parent"`); Modifikatoren Z. 228–287. Border Patrols (`4e15-0353-165f-5528`) ist in keinem Roster gewaehlt. |

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster unter [`rosters/`](rosters/), alle gegen `.gst` + VC-`.cat` +
Mercenaries-`.cat`, Kontingent „Standard (VC-AB)". Der Master Necromancer traegt
in den belegten Rostern seine Pflicht-Kinder „Handweapon" (`c4a5-f61d-e7da-8d5c`,
min 1) und „Wizard level 3" (`c39e-3f58-0fbd-3a04`, Vorgabe der Gruppe
`22be-1719-8e8a-96dc`, min 1).

> **Assertion-Fokus:** `isHidden` am Necromancer-Slot (belegt bzw. Angebot) und
> an der Lord-Kategorie, die `hiddenSelection`-Meldung, `effectiveMax` der
> Lord-Kategorie, und dass `fda5-91c2-e17f-774c` nicht feuert.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) | Fixture |
|---|-----------|----------------|----------------------------------------|---------|
| 01 | 1000 Punkte, Lord gewaehlt → versteckt + Fehler | Grenze 1000, 1× Master Necromancer | **HPC-R1/R3/R4:** Necromancer `isHidden=true`, genau **eine** `hiddenSelection` (`error`) an ihm; Lord-Kategorie `isHidden=true`, `effectiveMax=1`, Ist 1, Spielraum 0; `fda5-…` feuert nicht (**HPC-R5**). | [`01-…`](rosters/01-1000pts-master-necromancer-hidden.ros) |
| 02 | 1000 Punkte, leer → Angebot versteckt | Grenze 1000, leeres Kontingent | Angebot des Necromancers `isHidden=true`, **keine** `hiddenSelection`. | [`02-…`](rosters/02-1000pts-empty-offer-hidden.ros) |
| 03 | 2000 Punkte, Lord gewaehlt → sichtbar, max 1 | Grenze 2000, 1× Master Necromancer | Necromancer `isHidden=false`, **keine** `hiddenSelection`; Lord-Kategorie `effectiveMax=1`, Ist 1, Spielraum 0, ausgeschoepft. | [`03-…`](rosters/03-2000pts-master-necromancer-visible.ros) |
| 04 | 2000 Punkte, leer → Angebot sichtbar | Grenze 2000, leeres Kontingent | Angebot `isHidden=false`; Lord-Kategorie `effectiveMax=1`, Ist 0, Spielraum 1. | [`04-…`](rosters/04-2000pts-empty-offer-visible.ros) |
| 05 | 3000 Punkte, Lord gewaehlt → max 2 | Grenze 3000, 1× Master Necromancer | sichtbar, keine `hiddenSelection`; Lord-Kategorie `effectiveMax=2`, Ist 1, Spielraum 1, nicht blockiert. | [`05-…`](rosters/05-3000pts-master-necromancer-max2.ros) |

### Herleitung je Roster

| Roster | Punktegrenze | `lessThan 2000` (hidden) | greifender `set` auf `fda5-…` | `fda5-…` | Lords | feuert? | `hiddenSelection` |
|--------|--------------|--------------------------|-------------------------------|----------|-------|---------|-------------------|
| 01 | 1000 | **ja** | keiner | 1 (Basis) | 1 | nein | **1** |
| 02 | 1000 | **ja** | keiner | 1 | 0 | nein | 0 (Angebot) |
| 03 | 2000 | nein | `set 1` | 1 | 1 | nein | 0 |
| 04 | 2000 | nein | `set 1` | 1 | 0 | nein | 0 |
| 05 | 3000 | nein | `set 2` | 2 | 1 | nein | 0 |

`current` der Lord-Kategorie ist die Zahl der Selektionen mit dieser Kategorie
unter dem Kontingent (`scope="parent"` an einem Kategorie-Link im `forceEntry`
= das Kontingent): ein Necromancer mit `number="1"` → **1**.

### Bewusst nicht behauptet

- **Andere Armeeaufbau-Meldungen** (General-Pflicht ueber den `entryLink`
  `5c57-5cd6-a17c-1d0c`, Core-Mindestzahl, Pflicht-Lehre „Lore of Necromancy"
  `09ca-8236-8226-79c0` in der versteckten Gruppe `3e50-5f62-a177-304d`) duerfen
  zusaetzlich auftreten.
- **`isBlocked` der versteckten Lord-Kategorie in Roster 01** und
  `effectiveMin` aller Slots — fuer den Mechanismus ohne Belang.
- **Der Necromancer-Name** ist nur in 01/03 als Basisname behauptet (kein
  `field="name"`-Modifikator am Eintrag).

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID | Fundort |
|---------|-----|---------|
| Kategorie „Lord" (`set hidden=true` unter 2000) | `d024-d25b-a9b4-73b6` | `.gst` Z. 220–227 |
| Lord-Obergrenze (`max 1`, `scope=parent`) | `fda5-91c2-e17f-774c` | `.gst` Z. 363, Modifikatoren Z. 228–287 |
| Kostenart `pts` (in `limit::…`) | `ecfa-8486-4f6c-c249` | `.gst` |
| „Border Patrols rules" (nicht gewaehlt) | `4e15-0353-165f-5528` | `.gst` Z. 241 ff. (`childName`) |
| Katalog Vampire Counts | `4d73-5ab0-9020-403c` | VC-`.cat` |
| ForceEntry „Standard (VC-AB)" | `e989-15b8-7eb6-9668` | VC-`.cat` Z. 29297 |
| — dessen `categoryLink` „Lord" | `d321-a893-b7b7-5eae` → `d024-d25b-a9b4-73b6` | VC-`.cat` Z. 29303 |
| „Master Necromancer" (Wurzel-Eintrag, `type="unit"`) | `4ee2-ac3a-3cc6-11af` | VC-`.cat` Z. 1949 |
| — `categoryLink` „Lord" (`primary="true"`) | `4a65-6d41-e28b-5f3f` | VC-`.cat` Z. 1954 |
| — „Handweapon" (min 1 `b1f6-6649-de74-f4d5`) | `c4a5-f61d-e7da-8d5c` | VC-`.cat` Z. 1958–1961 |
| — Gruppe „Wizard Level" (min 1 `4599-666f-72d3-1822`), Member „Wizard level 3" | `22be-1719-8e8a-96dc` / `c39e-3f58-0fbd-3a04` | VC-`.cat` Z. 2013–2019 |
| — eigener `hidden`-Modifikator (haelt nicht im Standard-Kontingent) | — | VC-`.cat` Z. 2089–2104 |
