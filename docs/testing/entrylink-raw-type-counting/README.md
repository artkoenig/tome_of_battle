# E2E-Regeln & Testkatalog: Rohtyp-Zählung über `entryLink` (`childId="unit"`/`childId="model"`)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Regeln aus den
Katalogdaten der *6th Definitive Edition* abgeleitet; das Eingabeformat der
Roster ist an **echten Beispiel-Dateien** bestehender Szenarien verifiziert
(direkter Fall: [`../evaluator-bug-childid-model/`](../evaluator-bug-childid-model/README.md),
Link-Fall: [`../modifier-characteristic-value/rosters/02-ogre-light-armour.ros`](../modifier-characteristic-value/rosters/02-ogre-light-armour.ros)).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee: `Vampire Counts (6th definitive edition).cat`
  (`4d73-5ab0-9020-403c`, rev 1) — Force **„Standard (VC-AB)"** `e989-15b8-7eb6-9668`
- Zusatz: `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`),
  von Vampire Counts per `catalogueLink` `ef73-f9bd-e250-54d2` eingebunden —
  Quelle des **verlinkten** Einheiten-Ziels.

## Worum es geht: verlinkt gesetzt = direkt gesetzt

Ein Eintrag kann auf zwei Wegen in eine Force gelangen:

- **direkt** — die Force instanziiert ein `selectionEntry` des Katalogs; die
  Roster-`<selection>` trägt nur `entryId` (kein `entryLinkId`).
- **verlinkt** — die Force instanziiert einen `<entryLink>`; die
  Roster-`<selection>` trägt `entryId` = **Ziel-ID** des Links und
  `entryLinkId` = ID des `<entryLink>` (so schreibt Battlescribe es real, siehe
  die verifizierte Beispiel-Datei oben).

Das Datenformat behandelt beide Formen als denselben Eintrag: der Link ist ein
Verweis, Zählungen vergleichen **aufgelöste Ziel-IDs**, nicht Link-IDs
(`docs/battlescribe-data-format.md` §3.4 „Kontext-Threading" und §7,
„Fallstricke": `childId` kann Ziel-ID *oder* Link-ID sein — beide Fälle müssen
auf dasselbe Ziel abgleichen). Insbesondere trägt eine verlinkte Auswahl den
**rohen `type` ihres Ziel-Eintrags** (`model`, `unit`, …). Eine Bedingung mit
`childId="unit"` oder `childId="model"` muss deshalb im verlinkten Fall
**dasselbe** zählen wie im direkten — sie darf dort nicht 0 sehen.

Das bestehende Szenario [`evaluator-bug-childid-model`](../evaluator-bug-childid-model/README.md)
pinnt den **direkten** Fall (Stone Trolls, `atLeast 10 childId="model" scope="self"`).
Dieses Szenario pinnt den **verlinkten** Fall und die Übereinstimmung beider Formen.

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **ELT-R1** | Eine über einen `<entryLink>` gesetzte Auswahl zählt unter dem **rohen `type`** ihres Ziel-Eintrags — genauso wie dieselbe Auswahl direkt gesetzt. | Formatspezifikation `docs/battlescribe-data-format.md` §3.4 (Zählung über aufgelöste Ziel-IDs) und §7 (Fallstrick: `childId` = Ziel-ID *oder* Link-ID, beide Fälle abgleichen). Roster-Form an echter Beispiel-Datei verifiziert: `entryId`=Ziel, `entryLinkId`=Link. |
| **ELT-R2** | Unter den „Border Patrols"-Regeln muss die Armee **mindestens 2 und höchstens 4 Einheiten** enthalten; sonst feuert am Slot „Border Patrols rules" die Autor-Meldung `The army must consist of at least TWO units but no more than FOUR units` (Schweregrad *error*). Gezählt werden **Selektionen vom Rohtyp `unit`** auf Force-Ebene. | `.gst` → `selectionEntry` „Border Patrols rules" (`4e15-0353-165f-5528`, Zeile ~17600) → `modifier add error` mit `conditionGroup or`: `greaterThan 4` **oder** `lessThan 2`, jeweils `field="selections" scope="force" childId="unit" includeChildSelections="false"`. |
| **ELT-R3** | Zusätzlich verlangt „Border Patrols" **mindestens eine Infanterie-Einheit von 10+ Modellen**; sonst feuert am selben Slot die zweite Autor-Meldung. Die Kategorie „BP Infantry 10+" vergeben Einheiten wie die VC-Skeletons per Modifikator, dessen Bedingung Selektionen vom **Rohtyp `model`** zählt. | `.gst` → `4e15…` → `modifier add error` mit `lessThan 1 childId="6ad6-f54e-1867-00a7" scope="force"`. VC-`.cat` → Einheit „Skeletons" (`9ac2-f4c1-bcc3-3aee`) → `modifier add category 6ad6-f54e-1867-00a7` mit `conditionGroup and`: `atLeast 10 childId="model" scope="self" includeChildSelections="true"` **und** `atLeast 1 childId="4e15-0353-165f-5528" scope="roster"` (Zeilen ~401–411). |
| **ELT-R4** | Der Eintrag „Border Patrols rules" ist per Basis verborgen und wird sichtbar, wenn das Punktelimit des Rosters **genau 500** beträgt. Die Roster tragen deshalb `costLimit` 500. | `.gst` → `4e15…` → `modifier set hidden=false` mit `condition equalTo 500 field="limit::ecfa-8486-4f6c-c249" scope="roster"`. |
| **ELT-R5** | Die Mercenaries-Einheit **„Ogre Bulls"** steht in einer Vampire-Counts-Force **nur über einen `<entryLink>`** zur Verfügung; ihr Ziel ist ein `selectionEntry` mit `type="unit"`. Minimalbelegung: 3 „Bulls"-Modelle und 1 „Ogre Club". | VC-`.cat` → Wurzel-`entryLinks` → `entryLink` „Ogre Bulls" `21f4-c979-396b-c02a` → `targetId="7754-8b3d-df99-d2d5"` (ohne eigene Modifikatoren). Mercenaries-`.cat` → `selectionEntry type="unit"` „Ogre Bulls" `7754-8b3d-df99-d2d5`: Modell „Bulls" `411b-6f5f-06f1-be37` mit constraint `92d9-b5d1-9411-e954` `min 3 scope="parent"`; `entryLink` „Ogre Club" `415f-94c9-571c-19c6` (Ziel `8768-377c-88da-c3e8`) mit constraint `fff8-7da0-1bdc-5bdf` `min 1 scope="parent"`. |

**Warum keine `firing`-Limit-IDs:** In den Fixtures trägt **kein einziger
`constraint`** ein `childId` — die Rohtyp-Zählung (`childId="model"`/`"unit"`)
existiert ausschließlich in **`condition`s**, die Autor-Meldungen bzw.
Kategorie-Modifikatoren gaten. Die Zählung wird daher — wie schon im
Vorbild-Szenario `evaluator-bug-childid-model` — über die **Autor-Meldung am
Slot „Border Patrols rules"** beobachtet (`capabilities` → `authorMessages`),
nicht über eine feuernde Grenze. Die Ist/Grenze-Werte der Zählung sind unten je
Roster hergeleitet.

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle
referenzieren `.gst` + VC-`.cat` + Mercenaries-`.cat`; alle tragen
`costLimit` 500 (ELT-R4). Direkte Auswahlen schreiben **kein** `entryLinkId`,
verlinkte Auswahlen schreiben `entryId`=Ziel **und** `entryLinkId`=Link.

> **Assertion-Fokus:** nur die Autor-Meldungen am Slot `4e15…`. Andere
> Armeeaufbau-Diagnosen (General-Pflicht, Kategorie-Kontingente der 500-Punkte-
> Force) können zusätzlich auftreten und sind hier ohne Belang.

| # | Testtitel | Roster-Zustand | Zählung `childId="unit"` (scope=force) | Erwartetes Ergebnis | Fixture |
|---|-----------|----------------|----------------------------------------|---------------------|---------|
| 01 | Direkte Grundlinie | BP rules + **2 direkte** Skeletons-Einheiten (je 10 Modelle + Handweapon). | Ist **2** — weder >4 noch <2. | **Keine** Autor-Meldung am Slot `4e15…` (auch die Infanterie-Meldung still: beide Skeletons erreichen `atLeast 10 childId="model"` mit Ist 10 und tragen `6ad6…`). | [`01-two-direct-units-silent.ros`](rosters/01-two-direct-units-silent.ros) |
| 02 | Verlinkte Einheit zählt wie direkt | BP rules + **1 direkte** Skeletons-Einheit (10 Modelle) + **Ogre Bulls über `entryLink`** `21f4…` (3 Bulls + Ogre Club). | Ist **2** — nur wenn die verlinkte Auswahl unter dem Rohtyp `unit` ihres Ziels zählt. Sähe die Engine dort 0, wäre Ist 1 (<2) und die Meldung erschiene. | **Keine** Autor-Meldung am Slot `4e15…` — identisches Ergebnis zur direkten Form aus Test 01. | [`02-linked-unit-silent.ros`](rosters/02-linked-unit-silent.ros) |
| 03 | Verlinkte Einheit kippt die Obergrenze (positiver Nachweis) | BP rules + **4 direkte** Skeletons-Einheiten + **Ogre Bulls über `entryLink`** als fünfte Einheit. | Ist **5** (>4) — die Grenze wird **nur** überschritten, wenn die verlinkte Auswahl mitzählt; ohne sie wäre Ist 4 und der Slot still. | Am Slot `4e15…` liegt **genau eine** Autor-Meldung an: *error* `The army must consist of at least TWO units but no more than FOUR units`. Die Infanterie-Meldung bleibt still (Skeletons tragen `6ad6…`). | [`03-linked-fifth-unit-fires.ros`](rosters/03-linked-fifth-unit-fires.ros) |

**Beweisführung in beide Richtungen:** Test 02 schlägt fehl, wenn die Engine
den verlinkten Beitrag **unterschlägt** (Meldung erschiene fälschlich); Test 03
schlägt fehl, wenn sie ihn unterschlägt **oder** unter einem falschen Typ führt
(Meldung bliebe fälschlich aus). Test 01 fixiert die direkte Referenzform, mit
der beide übereinstimmen müssen.

**Punktekontrolle (nicht Teil der Assertion):** Skeletons 10 × 8 = 80 pts
(+ Handweapon 0), Ogre Bulls 3 × 35 = 105 pts (+ Club 0, Einheit 0). Roster 01:
160, Roster 02: 185, Roster 03: 425 — alle unter dem 500er-Limit, damit keine
Budget-Diagnose dazwischenfunkt.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Force „Standard (VC-AB)" | `e989-15b8-7eb6-9668` |
| „Border Patrols rules" (GST-Eintrag, Träger beider Autor-Meldungen) | `4e15-0353-165f-5528` |
| Kategorie „BP Infantry 10+" | `6ad6-f54e-1867-00a7` |
| Einheit „Skeletons" (VC, direkt, Modifikator `add category 6ad6…` bei `atLeast 10 childId="model"`) | `9ac2-f4c1-bcc3-3aee` |
| Modell „Skeletons" (min 10 `ad1d-03cf-a16f-ae52`, 8 pts) | `eaa1-c6a6-9aae-ae9a` |
| „Handweapon" (Skeletons, min 1 `175c-13ab-b2bf-a749`) | `565b-37e6-290b-e040` |
| `entryLink` „Ogre Bulls" (VC-Wurzel → Mercenaries) | `21f4-c979-396b-c02a` |
| Einheit „Ogre Bulls" (Mercenaries, `type="unit"`, Ziel des Links) | `7754-8b3d-df99-d2d5` |
| Modell „Bulls" (min 3 `92d9-b5d1-9411-e954`, 35 pts) | `411b-6f5f-06f1-be37` |
| `entryLink` „Ogre Club" (min 1 `fff8-7da0-1bdc-5bdf`) → Ziel | `415f-94c9-571c-19c6` → `8768-377c-88da-c3e8` |
| `catalogueLink` VC → Mercenaries | `ef73-f9bd-e250-54d2` → `fc47-8392-a6c8-452a` |
