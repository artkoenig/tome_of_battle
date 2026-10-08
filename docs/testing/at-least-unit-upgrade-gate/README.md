# E2E-Regeln & Testkatalog: atLeast-Bedingung mit scope=unit (Nehekhara's Noble Blood)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Regeln aus den
Katalogdaten der *6th Definitive Edition* abgeleitet; das Eingabeformat der
Roster ist an den **verifizierten Beispiel-Rostern** der bestehenden Szenarien
orientiert (direktes `entryId`, `entryLinkId` für verlinkte Aufwertungen,
`entryGroupId` für die tragende Gruppe).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee: `Vampire Counts (6th definitive edition).cat`
  (`4d73-5ab0-9020-403c`, rev 1) — Force **„Standard"** `e989-15b8-7eb6-9668`
  (+ die per `catalogueLink` `ef73-f9bd-e250-54d2` benötigte `Mercenaries`-`.cat`)

**Gepinnte Zelle:** `condition|atLeast|unit|selectionCount|child=id` — eine
`condition type="atLeast"` mit `scope="unit"` und einer Eintrags-Id in `childId`
zählt die Selektionen dieses Eintrags **innerhalb der umschließenden Einheit**:
des nächsten Vorfahren mit `type="unit"`, den Träger der Query eingeschlossen
(Formatdoku [§7.7, Kasten „`scope=unit` und `scope=ancestor`"](../../battlescribe/building-blocks/modifier.md#scopeunit-und-scopeancestor--die-umschließende-einheit-und-die-vorfahrenkette)).
Der damit gegatete Modifier wirkt genau **ab** dem Schwellwert (`value`).

## Die Struktur im Katalog (wichtig)

Der Gate-Zeuge **„Nehekhara's Noble Blood"** (`32d0-a151-94a3-aa54`, Basis
`hidden="false"`, 45 pts, max 1 `scope=parent`) wird **innerhalb desselben
Vampire Lord** gewählt — über eine dreistufige Link-Kette, deren Necrarch-Stufe
per force-gegatetem `hidden` eingeblendet wird:

```
selectionEntry "0-1 Vampire Lord" (b77b-88d5-5e80-e178, type=unit)   ← die umschließende Einheit
  ├ selectionEntry "Lord hero choice extra cost" (42c5-…)            min 1 / max 1 (parent)
  ├ selectionEntryGroup "Weapons and Armour" (ac8f-…)
  │    └ "Handweapon" (6abf-…)                                       min 1 / max 1 (parent)
  ├ selectionEntryGroup "Wizard Level" (43b8-dacd-f09f-37c3)         min 1 / max 1 (parent)
  │    ├ entryLink "Magic Level 3" (9dc7-…  → cb6c-…)                50 pts; Noble-Blood-Modifier s. ALU-R4
  │    ├ entryLink "Magic Level 2" (54fc-2ba6-00ed-76ac → fbc2-…)    Basis hidden=false, 0 pts   ← inverser Zeuge
  │    └ entryLink "Magic Level 4" (c5d1-4b7d-c96b-2fb9 → fc28-…)    Basis hidden=true, 50 pts   ← Gate-Ziel
  └ entryLink "Magic selection" (3b8f-… → Gruppe 53e8-…)
       └ entryLink "Bloodline" (6005-… → Gruppe 0719-…)
            └ entryLink "Vampiric Powers" (fb5e-… → Gruppe 8627-…, Basis hidden=true,
              eingeblendet per atLeast 1 childId=5017-… [Clan Necrarch] scope=force)
                 └ entryLink "Nehekhara's Noble Blood" (75e7-… → 32d0-a151-94a3-aa54)
```

> **Namens-Hinweis (Abweichung von der Aufgabenstellung):** Der inverse Zeuge im
> **Vampire Lord** heißt **„Magic Level 2"** (`54fc-2ba6-00ed-76ac`). Einen gleich
> gebauten Link **„Magic Level 1"** (`69f7-0112-b50e-c883`, `set true hidden` auf
> derselben Bedingung) gibt es nur in der Wizard-Level-Gruppe `7ab1-d9dc-6124-443f`
> des **Vampire Count** (`6822-0110-a7c9-cbb0`) — dort ist „Magic Level 3"
> (`15f0-88b7-5fcc-061b`, Basis `hidden=true`) das Gate-Ziel. Dieses Szenario pinnt
> die im Auftrag benannte Lord-Gruppe `43b8-…` mit ihren tatsächlichen Mitgliedern.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **ALU-R1** | Eine `atLeast`-Bedingung mit `scope="unit"` und `childId=32d0-…` zählt die Noble-Blood-Selektionen **innerhalb des umschließenden Vampire Lord** (Träger eingeschlossen, `includeChildSelections="true"` → auch verschachtelte Auswahlen). Schwellwert `value=1`: die Bedingung hält **genau ab** einer Noble-Blood-Selektion in der Einheit. | Formatdoku §7.7 (Kasten `scope=unit`); VC-`.cat`, beide Links der Gruppe `43b8-…`: `<condition type="atLeast" value="1" field="selections" scope="unit" childId="32d0-a151-94a3-aa54" shared="true" includeChildSelections="true"/>`. |
| **ALU-R2** | **Einblenden:** „Magic Level 4" (`c5d1-…`, Basis `hidden="true"`) wird sichtbar, sobald ALU-R1 hält: `modifier type="set" value="false" field="hidden"`. Ohne Noble Blood bleibt der Basiswert `hidden=true`. | VC-`.cat`, entryLink `c5d1-4b7d-c96b-2fb9` (Ziel `fc28-3af2-d37a-d07e`, `.gst`-Shared-Upgrade „Magic Level 4", Basis `hidden=false`, max 1 `8975-9aca-1463-1a1f`). |
| **ALU-R3** | **Ausblenden (inverser Zeuge):** „Magic Level 2" (`54fc-…`, Basis `hidden="false"`) wird verborgen, sobald ALU-R1 hält: `modifier type="set" value="true" field="hidden"` — auch wenn Magic Level 2 bereits **gewählt** ist (belegter, nun verborgener Slot). | VC-`.cat`, entryLink `54fc-2ba6-00ed-76ac` (Ziel `fbc2-5115-f240-7367`, `.gst`-Shared-Upgrade „Magic Level 2", max 1 `0885-9b48-f6d0-241e`). |
| **ALU-R4** | **Nicht gepinnt:** „Magic Level 3" (`9dc7-…`) trägt eine `and`-Modifier-Gruppe (Kommentar „Nehekara's Noble Blood"): `lessThan 1` ML4 (`fc28-…`) **und** `atLeast 1` Noble Blood (beide `scope=unit`) ⇒ `set` pts→0 **und** `set` der eigenen min-Grenze `4d5e-8101-e8d4-d7ad` auf 1 (Noble Blood schenkt einen Pflicht-Level 3, solange kein Level 4 gewählt ist). In Roster 02 (ML2 gewählt, kein ML3) **kann** diese dynamische min-1-Grenze feuern — ob eine min-Grenze an einem nicht gewählten Gruppen-Mitglied meldet, ist Seeding-Verhalten (vgl. den Seeding-Hinweis in [`../vampire-bloodlines/README.md`](../vampire-bloodlines/README.md)) und wird hier bewusst **weder als feuernd noch als abwesend** behauptet. | VC-`.cat`, entryLink `9dc7-b9d7-4e92-4cda` (Ziel `cb6c-c69a-5c73-97e8`), modifierGroup mit `conditionGroup type="and"`. |
| **ALU-R5** | Die Gruppe „Wizard Level" verlangt **genau einen** Level (min 1 / max 1, `scope=parent`). Beide Roster erfüllen das mit der einen Magic-Level-2-Selektion — die Grenzen `769e-…`/`f66f-…` feuern nicht. Der `defaultSelectionEntryId="3c1a-3350-04ae-7a3f"` der Gruppe löst auf **keine** Definition der Fixtures auf (dangling; nur als Default-Verweis vorhanden). | VC-`.cat`, Gruppe `43b8-dacd-f09f-37c3`, constraints `769e-ff2d-6795-86cb` (min 1) / `f66f-32f7-5f65-14a7` (max 1). |

**Hinweis zum Mechanismus:** ALU-R2/R3 sind — wie in den Szenarien
`set-hidden-force-gate` und `vampire-bloodlines` (VBL-R4/R5) — als
**Verfügbarkeit** (`hidden`) modelliert, nicht als zählende Schranke. Der
Verletzungsbericht kodiert keine (Un-)Sichtbarkeit; `firing` bleibt daher in
beiden Rostern leer, und die beiden Zweige werden über
`expect.capabilities[].isHidden` an den beiden Wizard-Level-Slots festgehalten.

**Hinweis zum Roster-Aufbau:** Beide Roster enthalten **Bloodlines → Clan
Necrarch** (`a56a-…` → `5017-…`), damit die Necrarch-Gruppe „Vampiric Powers"
(`fb5e-…`, force-gegatet) eingeblendet und Noble Blood ein legaler Griff ist —
das Delta zwischen den Rostern ist **ausschließlich** die Noble-Blood-Selektion.
Nebenwirkungen der Necrarch-Bloodline auf den Lord (Namens-Anhang „of Clan
Necrarch", WS −2, Kategorie-Umbau) sind in **beiden** Rostern identisch und
werden nicht behauptet; die Slot-Auswahl erfolgt über Definitions-Ids, nicht
über den Einheiten-Namen.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Beide
referenzieren `.gst` + Vampire-Counts-`.cat` (+ `Mercenaries`-`.cat`).

> **Assertion-Fokus:** die beiden `isHidden`-Zustände der Wizard-Level-Slots und
> die genannten `absent`-Grenzen. Andere Armeeaufbau-Diagnosen (General-Pflicht,
> Core-Pflicht, Punktelimit, ALU-R4) können zusätzlich auftreten und sind hier
> ohne Belang.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | Ohne Noble Blood: Basiswerte | Bloodlines (Necrarch) + Vampire Lord (Lord hero choice, Handweapon, **Magic Level 2**), **keine** Noble-Blood-Selektion. | ALU-R1 hält nicht (Ist 0 < 1): **Magic Level 4 verborgen** (`isHidden true`, Angebots-Slot), **Magic Level 2 sichtbar** (`isHidden false`, belegter Slot). Keine der genannten Grenzen feuert. | [`01-vampire-lord-without-noble-blood.ros`](rosters/01-vampire-lord-without-noble-blood.ros) |
| 02 | Mit Noble Blood: Gate kippt beide Slots | **Identischer** Aufbau + **Nehekhara's Noble Blood** unter dem Vampire Lord. | ALU-R1 hält (Ist 1 ≥ 1, Schwellwert **genau** erreicht): **Magic Level 4 sichtbar** (`isHidden false`), **Magic Level 2 verborgen** (`isHidden true`) — obwohl gewählt. Keine der genannten Grenzen feuert. | [`02-vampire-lord-with-noble-blood.ros`](rosters/02-vampire-lord-with-noble-blood.ros) |

**Abwesend behauptete Grenzen (beide Roster):** Wizard-Level min/max
`769e-…`/`f66f-…` (genau ein Level gewählt), Shared-max-1 der Ziele „Magic
Level 2" `0885-…` (Ist 1) und „Magic Level 4" `8975-…` (Ist 0), Noble-Blood-max-1
`e8e0-…` (Ist 0 bzw. 1) und die Roster-Obergrenze des Lords `a7c9-…` (Ist 1).

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Force „Standard" (VC) | `e989-15b8-7eb6-9668` |
| 0-1 Vampire Lord (Wurzel-Unit, max 1 roster) | `b77b-88d5-5e80-e178` — constraint `a7c9-5fec-592a-3716` |
| Gruppe „Wizard Level" (Lord; min 1 / max 1 parent) | `43b8-dacd-f09f-37c3` — constraints `769e-ff2d-6795-86cb` / `f66f-32f7-5f65-14a7`; `defaultSelectionEntryId` `3c1a-3350-04ae-7a3f` (dangling) |
| entryLink „Magic Level 4" (Basis hidden=true, set-false-Gate) | `c5d1-4b7d-c96b-2fb9` → Ziel `fc28-3af2-d37a-d07e` (`.gst`, max 1 `8975-9aca-1463-1a1f`) |
| entryLink „Magic Level 2" (Basis hidden=false, set-true-Gate) | `54fc-2ba6-00ed-76ac` → Ziel `fbc2-5115-f240-7367` (`.gst`, max 1 `0885-9b48-f6d0-241e`) |
| entryLink „Magic Level 3" (Noble-Blood-Modifier, nicht gepinnt) | `9dc7-b9d7-4e92-4cda` → Ziel `cb6c-c69a-5c73-97e8`; dynamische min-Grenze `4d5e-8101-e8d4-d7ad` |
| Nehekhara's Noble Blood (Gate-Zeuge, max 1 parent) | `32d0-a151-94a3-aa54` — constraint `e8e0-d7f1-f9a4-a8c0` |
| Link-Kette zum Zeugen: „Magic selection" → „Bloodline" → „Vampiric Powers" (Necrarch) → Noble Blood | `3b8f-2a39-0b3b-7c59` → `53e8-0ce2-eaf6-0163`; `6005-e508-4d47-eb0a` → `0719-24b8-19d4-c832`; `fb5e-133e-b364-6b28` → `8627-7a0f-231c-7572`; `75e7-b83e-a2b3-13af` → `32d0-…` |
| Bloodlines / Bloodline of Clan Necrarch (Kontext, in beiden Rostern) | `a56a-eb32-5a45-16fd` / `5017-296d-edef-4562` |
| Pflicht-Kinder des Lords: „Lord hero choice extra cost" / „Handweapon" (Gruppe „Weapons and Armour") | `42c5-9ebc-7493-89ef` (min `0780-5a76-9d51-e9ea`) / `6abf-e08f-6480-cd58` (min `d830-89e1-7573-92e7`, Gruppe `ac8f-eafa-97e8-3b04`) |
| Gegenstück im Vampire Count (nur Doku, nicht getestet): Gruppe „Wizard Level" mit „Magic Level 1"/„Magic Level 3" | `7ab1-d9dc-6124-443f`; `69f7-0112-b50e-c883` (set-true-Gate) / `15f0-88b7-5fcc-061b` (set-false-Gate) |

### Bewusst nicht gepinnte Facetten

- **ALU-R4** (Noble Blood macht Magic Level 3 kostenlos und formal zur Pflicht,
  solange kein Level 4 gewählt ist): hängt am Seeding-Verhalten für min-Grenzen
  nicht gewählter Gruppen-Mitglieder — weder in `firing` noch in `absent`.
- **Profil-/Namens-Effekte der Necrarch-Bloodline** auf den Lord: in beiden
  Rostern identisch, bereits durch `vampire-bloodlines` (VBL-R6) abgedeckt.
- **Wie die Engine eine gewählte, nun verborgene Selektion einordnet** (Roster
  02, Magic Level 2): behauptet wird nur der `isHidden`-Zustand des belegten
  Slots, keine zusätzliche Diagnose.
