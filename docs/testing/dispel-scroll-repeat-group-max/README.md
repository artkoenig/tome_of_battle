# E2E-Regeln & Testkatalog: `repeat` mit einem einzigen `<repeat>` am Modifier — das Dispel-Scroll-Muster (Vampire Counts)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Regeln aus den
Katalogdaten der *6th Definitive Edition* abgeleitet; das Eingabeformat der
Roster folgt den bereits verifizierten Szenario-Fixtures (direktes `entryId`,
`entryLinkId=""`, geschachtelte `selections` mit `number`, `entryGroupId` für
Gruppen-Mitglieder).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee: `Vampire Counts (6th definitive edition).cat`
  (`4d73-5ab0-9020-403c`, rev 1) — Force **„Standard (VC-AB)"**
  `e989-15b8-7eb6-9668` (dort bleiben die vielen force-gebundenen Modifikatoren
  des Katalogs inert)
- Dazu `Mercenaries (6th definitive edition).cat` (per `catalogueLink`
  `ef73-f9bd-e250-54d2` → `fc47-8392-a6c8-452a` aus der VC-`.cat` eingebunden)

## Der gepinnte Mechanismus

Ein `modifier`, der eine `<repeats>`-Liste mit **genau einem** `<repeat>` trägt,
wird **einmal je gezähltem Treffer** dieses `repeat` angewendet
([§7.7 der Formatdoku](../../battlescribe-data-format.md): der `repeat` lässt den
Modifier „mehrfach" greifen; §9.7 nennt genau dieses Muster). Träger ist die
geteilte Gruppe **„Arcane Items (VC)"**, die der **Master Necromancer** über
seine Gruppe „Magic Items" hält:

```
selectionEntry "Master Necromancer" (4ee2-ac3a-3cc6-11af, type=unit, Lord)
  └ selectionEntryGroup "Magic Items" (4074-b07b-7ed7-ab86)
       ├ constraint max -1 selections scope=parent   dde4-9bc3-f762-d6cb  (Sentinel „unbegrenzt")
       ├ constraint max 100 <pts> scope=parent       e4ef-628f-fae9-f0db  (Punkte-Budget)
       └ entryLink 69c5-dedc-fc86-77ae ──▶ sharedSelectionEntryGroup
            "Arcane Items (VC)" (2f34-a145-911a-fa00)
              ├ constraint max 1 selections scope=parent   fa59-e6b8-9523-3510   ← Ziel beider increments
              ├ modifier increment +1 field=fa59-…
              │    └ repeat field=selections scope=parent value=1 repeats=1
              │         childId=adb3-9853-d566-e432   (Link „Dispel Scroll (one use only)")
              ├ modifier increment +1 field=fa59-…
              │    └ repeat field=selections scope=parent value=1 repeats=1
              │         childId=a7ac-677c-c302-3837   (Link „Power Stone (only one use)")
              ├ entryLink adb3-9853-d566-e432 ──▶ b76c-6bad-4650-dbb0 (.gst, 25 pts,
              │      eigene max-4-Grenze 809a-eb2a-6def-15f6, scope=parent)
              └ entryLink a7ac-677c-c302-3837 ──▶ 696a-648d-c842-4c6a (Power Stone)
```

Netto-Semantik der Daten: die Gruppe erlaubt **ein** Arcane Item — aber jede
gewählte Kopie des Dispel Scroll (bzw. Power Stone) hebt die Obergrenze um eins,
verbraucht also den einen Item-Slot **nicht**. Mit N Dispel Scrolls ist das
effektive Maximum **1 + N**. Anwendungszahl je `repeat`:
`floor(Treffer / value) × repeats` = `floor(N / 1) × 1` = N.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **DSR-R1** | Die Gruppe „Arcane Items (VC)" erlaubt als geschriebene Grenze **max 1** Auswahl unter ihren Mitgliedern (je Träger). | `Vampire Counts (6th definitive edition).cat`, `sharedSelectionEntryGroup` `2f34-a145-911a-fa00` → constraint **`fa59-e6b8-9523-3510`** (`type=max value=1 field=selections scope=parent shared=true includeChildSelections=false`). |
| **DSR-R2** | Je gewähltem **Dispel Scroll** in der Gruppe steigt diese Grenze um **+1** — der `increment`-Modifier trägt **genau einen** `<repeat>`, der die Kopien des Dispel-Scroll-Links zählt. Mit 2 Scrolls greift die Wiederholung **zweimal**: effektives Maximum `1 + 2 = 3`. | Ebd. → `modifier type="increment" value="1" field="fa59-e6b8-9523-3510"` mit `<repeats>` aus genau einem `<repeat field="selections" scope="parent" value="1" childId="adb3-9853-d566-e432" repeats="1" roundUp="false" shared="true" includeChildSelections="true" includeChildForces="true"/>`. |
| **DSR-R3** | Ohne Auswahl in der Gruppe zählt der `repeat` **0 Treffer**, der Modifier wird **nicht** angewendet, die Grenze behält ihren **Basiswert 1**. | Anwendungszahl `floor(0/1)×1 = 0`; kein anderer Modifier im gesamten Fixture-Datensatz adressiert `fa59-e6b8-9523-3510` (verifiziert: nur die beiden increments an `2f34-…` nennen diese Id). |
| **DSR-R4** | Der zweite, baugleiche increment (+1 je **Power Stone**) ist in beiden Rostern **inert**, weil kein Power Stone gewählt ist — er ändert die erwarteten Maxima nicht. | Ebd. → zweiter `modifier type="increment" value="1" field="fa59-…"` mit `<repeat … childId="a7ac-677c-c302-3837" value="1" repeats="1"/>`; die Roster enthalten keine Auswahl mit diesem Link. |
| **DSR-R5** | Der Dispel Scroll selbst limitiert sich auf **max 4 je Träger** — mit 2 Kopien still. Das **100-Punkte-Budget** der Magic-Items-Gruppe ist mit `2 × 25 = 50` pts eingehalten; ihre `max -1`-Selektionsgrenze ist als geschriebener Sentinel **unbegrenzt** ([§7.6](../../battlescribe-data-format.md), Sentinel-Kasten). | `.gst`, `selectionEntry` `b76c-6bad-4650-dbb0` (25 pts) → constraint **`809a-eb2a-6def-15f6`** (`type=max value=4 scope=parent`); `.cat`, Gruppe `4074-b07b-7ed7-ab86` → constraints **`e4ef-628f-fae9-f0db`** (`type=max value=100 field=<pts> scope=parent`) und `dde4-9bc3-f762-d6cb` (`type=max value=-1`). |
| **DSR-R6** | Die Pflicht-Untergrenzen des Trägers sind in beiden Rostern erfüllt bzw. nicht validierbar: **Handweapon min 1** (gewählt), **Wizard Level min 1** (Wizard level 3 gewählt, der Gruppen-Default), und die **min-1-Grenze in der Gruppe „Lores of Magic"** hängt in einer `hidden="true"`-Gruppe — Min-Grenzen effektiv versteckter Entitäten werden nicht validiert ([§5.6/§8](../../battlescribe-data-format.md), Issue 0088). | `.cat`, `4ee2-ac3a-3cc6-11af`: Handweapon `c4a5-f61d-e7da-8d5c` (min **`b1f6-6649-de74-f4d5`**), Gruppe „Wizard Level" `22be-1719-8e8a-96dc` (min **`4599-666f-72d3-1822`**, `defaultSelectionEntryId="c39e-3f58-0fbd-3a04"`), Gruppe „Lores of Magic" `3e50-5f62-a177-304d` `hidden="true"` → Link `09ca-8236-8226-79c0` min **`7c6b-9f80-b44d-a824`**. |

**Bewusst nicht Gegenstand dieses Szenarios** (in beiden Rostern absichtlich
inert bzw. nicht assertiert):

- **Name der Gruppe:** der `append "Relics of Lustria"`-Modifier an `2f34-…`
  hängt an `atLeast 1` von `7d87-7436-5341-bbc0` (scope=force) — die Roster
  enthalten diesen Eintrag nicht, der effektive Name bleibt der Basisname
  „Arcane Items (VC)" (so assertiert).
- **Sichtbarkeit des Trägers:** der Master Necromancer wird nur in den
  Sonderheer-Kontingenten (`91ad-…`, `5e95-…`, `b1e4-…`, `4072-…`, `f37a-…`,
  `bf46-…` u. a.) versteckt; „Standard (VC-AB)" steht **nicht** in dieser Liste,
  der Träger ist dort sichtbar und wählbar.
- **Armeeweite Aufbau-Diagnosen** (General-Pflicht, Core-Mindestzahl,
  Bloodlines-Pflicht `4a0a-b107-e726-da32`, Kategorien-Skalierung ohne gesetztes
  Punktebudget): können zusätzlich auftreten; die Erwartung ist selektiv und
  macht darüber keine Aussage.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Beide Roster
sind **bis auf die Dispel-Scroll-Auswahl identisch**: ein Master Necromancer im
Kontingent „Standard (VC-AB)" mit Pflicht-Handweapon und Wizard level 3.

> **Assertion-Fokus:** das effektive Maximum des Gruppen-Ankers „Arcane Items
> (VC)" (`expect.capabilities`, Feld `effectiveMax`) sowie die Stille der in
> DSR-R1/R5/R6 genannten Grenzen im Verletzungsbericht.

| # | Testtitel | Betroffene Katalogdateien | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|---------------------------|----------------|-------------------------------------------------------|---------|
| 01 | Zwei Dispel Scrolls → Maximum 3 | `.gst` + VC-`.cat` (+ Mercenaries) | Master Necromancer mit `number="2"` Dispel Scrolls in der Gruppe `2f34-…` (Link `adb3-…`). | **DSR-R2:** Der Gruppen-Anker (Verweis `69c5-…` → Gruppe `2f34-…`, Rahmen = Necromancer `4ee2-…`) meldet `effectiveMax=3` bei Ist 2 (Spielraum 1); die Wiederholung greift **zweimal**. Keine der genannten Grenzen feuert. | [`01-two-dispel-scrolls-effective-max-3.ros`](rosters/01-two-dispel-scrolls-effective-max-3.ros) |
| 02 | Keine Auswahl → Basiswert 1 | wie 01 | **Identischer** Aufbau ohne Auswahl in der Gruppe. | **DSR-R3:** Derselbe Anker meldet den geschriebenen Basiswert `effectiveMax=1` bei Ist 0 (Spielraum 1, kein `min`, nicht blockiert). | [`02-no-arcane-item-base-max-1.ros`](rosters/02-no-arcane-item-base-max-1.ros) |

**Ableitung der Zahlen (aus den Daten, nicht aus einem Engine-Lauf):**
`effectiveMax` ist in Test 01 `1 + floor(2/1)×1×1 = 3` (Basiswert 1 der
Constraint `fa59-…` plus zwei Anwendungen des increment +1, DSR-R2), in Test 02
der Basiswert `1` (DSR-R3). `current` folgt aus dem `number` der
Scroll-Selektion (2 bzw. keine Selektion → 0); `headroom` ist die Differenz
Maximum − Ist (jeweils 1). `effectiveMin` ist `null`, weil weder die Gruppe noch
der einbindende Verweis eine min-Grenze trägt und kein Modifier eine hinzufügt.
Mit 2 ≤ 3 (bzw. 0 ≤ 1), 2 ≤ 4 (Scroll-eigene Grenze) und 50 ≤ 100 pts sind alle
genannten Grenzen eingehalten — sie stehen darum in `absent`.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Force „Standard (VC-AB)" | `e989-15b8-7eb6-9668` |
| Master Necromancer (type=unit, Lord primär, Characters) | `4ee2-ac3a-3cc6-11af` |
| — Handweapon (Pflicht-Upgrade, min 1/max 1) | `c4a5-f61d-e7da-8d5c` — min `b1f6-6649-de74-f4d5` |
| — Gruppe „Wizard Level" (min 1/max 1, Default Wizard level 3) | `22be-1719-8e8a-96dc` — min `4599-666f-72d3-1822`; Default `c39e-3f58-0fbd-3a04` |
| — Gruppe „Lores of Magic" (`hidden="true"`, min darin nicht validiert) | `3e50-5f62-a177-304d` — min `7c6b-9f80-b44d-a824` |
| — Gruppe „Magic Items" (max −1 Selektionen; 100-pts-Budget) | `4074-b07b-7ed7-ab86` — `dde4-9bc3-f762-d6cb` / `e4ef-628f-fae9-f0db` |
| Verweis auf die Arcane-Items-Gruppe (der Slot-`defId`) | entryLink `69c5-dedc-fc86-77ae` → `2f34-a145-911a-fa00` |
| Gruppe „Arcane Items (VC)" (geteilt) | `2f34-a145-911a-fa00` |
| — max 1 (scope=parent, Ziel beider increments) | constraint `fa59-e6b8-9523-3510` |
| — increment +1 je Dispel Scroll (`repeat` value=1, repeats=1) | `childId=adb3-9853-d566-e432` |
| — increment +1 je Power Stone (inert, kein Power Stone gewählt) | `childId=a7ac-677c-c302-3837` |
| — `append "Relics of Lustria"` (inert, Bedingung nicht erfüllt) | condition `childId=7d87-7436-5341-bbc0` |
| Dispel-Scroll-Link → geteilter `.gst`-Eintrag (25 pts, max 4/Träger) | `adb3-9853-d566-e432` → `b76c-6bad-4650-dbb0` — max `809a-eb2a-6def-15f6` |
| Power-Stone-Link → geteilter Eintrag | `a7ac-677c-c302-3837` → `696a-648d-c842-4c6a` |
| Katalog-Link auf Mercenaries | `ef73-f9bd-e250-54d2` → `fc47-8392-a6c8-452a` |
