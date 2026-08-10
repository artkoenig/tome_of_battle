# E2E-Regeln & Testkatalog: `lessThan` mit `scope="unit"` — das Wizard-Level-Gatter der Vampir-Charaktere

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln, IDs und
Erwartungswerte sind **ausschließlich aus den Katalogdaten** der *6th Definitive
Edition* und aus [`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md)
**abgeleitet**; das Eingabeformat der Roster ist an den verifizierten
Beispiel-Rostern der bestehenden Szenarien orientiert (direktes `entryId`,
`entryLinkId` für verlinkte Aufwertungen, `entryGroupId` für die tragende Gruppe).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1) — dort liegen die geteilten Einträge
  *Magic Level 1…4*.
- Armee: `Vampire Counts (6th definitive edition).cat`
  (`4d73-5ab0-9020-403c`, rev 1) — Kontingent **„Standard (VC-AB)"**
  `e989-15b8-7eb6-9668` (`.cat` Z. 29297); es bindet per `catalogueLink`
  `ef73-f9bd-e250-54d2` (Z. 29511) die Bibliothek
  `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`) ein.

**Gepinnte Zelle:** `condition|lessThan|unit|selectionCount|child=id` — eine
`<condition type="lessThan" field="selections" scope="unit" childId="<Eintrag>">`
zählt **innerhalb der umschließenden Einheit** ihres Trägers die Auswahlen, die
auf diese Eintrags-Id auflösen (mit `includeChildSelections="true"` auch
verschachtelte), und hält **genau dann**, wenn diese Zahl **echt kleiner** als
`value` ist. `unit` ist dabei ein regulärer Zählrahmen: der nächste Vorfahre —
den Träger eingeschlossen — mit `type="unit"`
(Formatdoku [§7.7, Kasten `scope="unit"`/`ancestor`](../../battlescribe-data-format.md#scope-unit-ancestor)).

## Die Struktur im Katalog (wichtig)

Träger der Zelle ist ein `entryLink` in einer Auswahlgruppe **unmittelbar unter**
einem Wurzel-Unit; die umschließende Einheit (`scope="unit"`) ist damit die
Charakter-Selektion selbst.

```
selectionEntry "0-1 Vampire Lord " (b77b-88d5-5e80-e178, type=unit)   ← der Rahmen (scope="unit")
 ├ selectionEntry "Lord hero choice extra cost" (42c5-…)              min 1 (0780-…) / max 1 (b4f7-…)
 ├ selectionEntryGroup "Weapons and Armour" (ac8f-…)
 │    └ selectionEntry "Handweapon" (6abf-…)                          min 1 (d830-…) / max 1 (b157-…)
 ├ entryLink "Magic selection" (3b8f-… → Gruppe 53e8-…)
 │    └ entryLink "Bloodline" (6005-… → Gruppe 0719-…)
 │         └ entryLink "Vampiric Powers" (fb5e-…, Basis hidden=true → Gruppe 8627-…,
 │           eingeblendet per atLeast 1 childId=5017-… [Clan Necrarch] scope=force)
 │              └ entryLink "Nehekhara’s Noble Blood" (75e7-… → 32d0-a151-94a3-aa54)  ← Gate-Glied 2
 └ selectionEntryGroup "Wizard Level" (43b8-dacd-f09f-37c3)           min 1 (769e-…) / max 1 (f66f-…)
      ├ entryLink "Magic Level 3" (9dc7-b9d7-4e92-4cda → cb6c-…)      ← der TRÄGER der Zelle
      │     constraint  min 0  (4d5e-8101-e8d4-d7ad, scope=parent)    ← das bewegte Mindestmaß
      │     cost        pts 50 (ecfa-8486-4f6c-c249)
      │     modifierGroup type="and"
      │        conditionGroup type="and"
      │           condition lessThan 1  scope=unit childId=fc28-… (Magic Level 4)  ← Gate-Glied 1
      │           condition atLeast  1  scope=unit childId=32d0-… (Noble Blood)    ← Gate-Glied 2
      │        modifier set value="1" field="4d5e-8101-e8d4-d7ad"
      │        modifier set value="0" field="ecfa-8486-4f6c-c249"
      ├ entryLink "Magic Level 2" (54fc-… → fbc2-…)                   set hidden=true bei Noble Blood
      └ entryLink "Magic Level 4" (c5d1-4b7d-c96b-2fb9 → fc28-…)      Basis hidden=true,
            set hidden=false bei Noble Blood                          ← der lessThan-Zeuge
```

> **Die Zeugen-Kette zu „Nehekhara's Noble Blood" besteht aus
> `selectionEntryGroup`s.** Gruppen erscheinen in der `.ros` nicht als eigene
> `selection`; Noble Blood steht dort deshalb als **direktes Kind** der
> Charakter-Selektion (mit `entryLinkId="75e7-…"` und `entryGroupId="8627-…"`) —
> genau wie im Nachbarszenario
> [`greater-than-parent-upgrade-gate`](../greater-than-parent-upgrade-gate/README.md).
> Dasselbe gilt für die Mitglieder der Gruppe „Wizard Level"
> (`entryGroupId="43b8-…"` bzw. `"7ab1-…"`).

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **LTU-R1** | Die Bedingung `type="lessThan" value="1" field="selections" scope="unit" childId="fc28-3af2-d37a-d07e"` zählt die *Magic-Level-4*-Auswahlen in der **umschließenden Einheit** ihres Trägers und hält bei **echt kleiner als 1**, also **genau bei null**. Sie kippt in dem Moment, in dem die erste solche Auswahl in der Einheit steht. | VC-`.cat` Z. 2965: `<condition type="lessThan" value="1" field="selections" scope="unit" childId="fc28-3af2-d37a-d07e" shared="true" includeChildSelections="true"/>`. Zieleintrag: `.gst` Z. 2049 `selectionEntry "Magic Level 4"`. Semantik von `scope="unit"`: Formatdoku [§7.7-Kasten](../../battlescribe-data-format.md#scope-unit-ancestor). |
| **LTU-R2** | Der Effekt hängt an einer **`and`-Gruppe aus beiden** Gliedern: „**weniger als eine** Magic Level 4" **und** „**mindestens ein** Nehekhara's Noble Blood" — beide `scope="unit"`. Fehlt eines, greift **kein** Modifier der Klammer. Eine `and`-Gruppe hält nur, wenn **alle** Mitglieder halten. | VC-`.cat` Z. 2956–2970: `<modifierGroup type="and">` mit `<conditionGroup type="and">`, darin Z. 2965 (`lessThan`) und Z. 2966 (`atLeast 1 childId="32d0-a151-94a3-aa54"`). Formatdoku [§7.7 `conditionGroup`](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat). |
| **LTU-R3** | **Wo die Klammer hält, greifen BEIDE Modifier auf denselben Träger:** `set value="1" field="4d5e-8101-e8d4-d7ad"` hebt die **eigene** Mindestgrenze des Links von 0 auf **1**, und `set value="0" field="ecfa-8486-4f6c-c249"` setzt dessen pts-Kosten (Basis 50) auf 0. Die Klammer trägt **keine** `<repeats>` — es gibt keinen Wiederholungsfaktor. | VC-`.cat` Z. 2958–2961 (`<modifiers>` der Klammer) und Z. 2972–2974 (`<constraint type="min" value="0" field="selections" scope="parent" shared="true" id="4d5e-8101-e8d4-d7ad" includeChildSelections="false"/>`), Z. 2975–2977 (`<cost … value="50"/>`). Ein `modifier` mit einer Constraint-`id` im `field` ändert deren Wert: Formatdoku [§7.6](../../battlescribe-data-format.md#76-constraint)/[§7.7](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat). |
| **LTU-R4** | **Wo die Klammer nicht hält, bleibt der geschriebene Basiswert:** Mindestmaß **0**. Ein Mindestmaß 0 ist bei jedem Ist-Stand erfüllt — `4d5e-8101-e8d4-d7ad` feuert dann nicht. | Basiswert wie LTU-R3 (Z. 2973). |
| **LTU-R5** | **Wo sie hält, wird die angehobene Grenze auch geprüft:** der Träger ist **nicht** versteckt (`hidden="false"` am Verweis Z. 2954, `hidden="false"` am `.gst`-Ziel Z. 2079, **kein** `hidden`-Modifier an diesem Link) — das Validierungsverbot für effektiv versteckte Entitäten (Formatdoku [§5.6](../../battlescribe-data-format.md#56-force-entries-detachments)/[§8](../../battlescribe-data-format.md#8-kategorien--sichtbarkeit), Issue 0088) greift hier also **nicht**. Ist „Magic Level 3" nicht gewählt, ist die Grenze mit **Ist 0 gegen 1** unerfüllt und feuert. | Verweis Z. 2954, Ziel `.gst` Z. 2079–2088; Zählregel `field="selections" scope="parent" includeChildSelections="false"`: Formatdoku [§7.6](../../battlescribe-data-format.md#76-constraint). |
| **LTU-R6** | **Der Zeuge ist in der Einheit legal wählbar.** „Magic Level 4" trägt am Verweis `hidden="true"`, wird aber durch **denselben** Noble-Blood-Umstand eingeblendet (`set hidden="false"` bei `atLeast 1 childId="32d0-…" scope="unit"`). Da Noble Blood in **allen** Rostern dieses Szenarios in der Einheit liegt, ist der Zeuge in beiden Zweigen sichtbar — die `lessThan`-Achse ist damit ohne Sichtbarkeits-Nebenwirkung variierbar. | VC-`.cat` Z. 2991–3002: `<entryLink … name="Magic Level 4" hidden="true" id="c5d1-4b7d-c96b-2fb9" targetId="fc28-3af2-d37a-d07e">` mit `<modifier type="set" value="false" field="hidden">` und Bedingung Z. 2995. |
| **LTU-R7** | **Zusätzliche Erwartung aus dem bewussten Überfüllen:** Die Gruppe „Wizard Level" trägt `max 1` **und** `min 1`, beide `scope="parent"`, `field="selections"`, `includeChildSelections="false"`. Eine Grenze an einer `selectionEntryGroup` zählt **ihre Mitglieder**. Stehen „Magic Level 3" **und** „Magic Level 4" in der Einheit, zählt die Gruppe **2** → `f66f-32f7-5f65-14a7` feuert mit **Ist 2 / Grenze 1**. Steht **kein** Mitglied darin, feuert `769e-ff2d-6795-86cb` mit **Ist 0 / Grenze 1**. | VC-`.cat` Z. 2949–2952 (beide Grenzen der Gruppe `43b8-dacd-f09f-37c3`); Zählregel „Grenze an einer Gruppe zählt ihre Mitglieder": Formatdoku [§7.6](../../battlescribe-data-format.md#76-constraint). Präzedenzfälle: [`vampire-bloodlines`](../vampire-bloodlines/README.md) (VBL-R2, Ist 2 / Grenze 1) und [`group-scope-missing-mandatory`](../group-scope-missing-mandatory/README.md) (Ist 0 / Grenze 1). |
| **LTU-R8** | **Zweites, unabhängiges Vorkommen desselben Konstrukts** am Unit „Vampire Count": der `entryLink` „Magic Level 2" `5a5f-aaf8-868f-9630` in der Gruppe „Wizard Level" `7ab1-d9dc-6124-443f` trägt dieselbe `and`-Klammer, gegatet auf **`lessThan 1` Magic Level 3** (`cb6c-c69a-5c73-97e8`, `scope="unit"`) **und** `atLeast 1` Noble Blood, und hebt damit seine eigene Mindestgrenze `5e9b-7594-02cb-0bad` (Basis `min 0`, `scope=parent`) auf 1. Anderer Träger, andere `childId`, andere Grenzen-Id — dieselbe Zelle. | VC-`.cat` Z. 3178–3205: Gruppe `7ab1-…` (min `19ba-de18-6ad7-2825`, max `436d-44fa-86cf-bf42`), Verweis Z. 3184, Klammer Z. 3186–3200 (Z. 3195 `lessThan`, Z. 3196 `atLeast`, Z. 3189/3190 die beiden `set`), Grenze Z. 3203. Der dortige „Magic Level 3"-Verweis `15f0-88b7-5fcc-061b` (Z. 3215) ist Basis `hidden="true"` und wird durch Noble Blood eingeblendet (Z. 3217–3221) — der Zeuge ist also auch hier legal wählbar. |

### Die Messpaare

Beide Paare halten „Nehekhara's Noble Blood" **konstant** und variieren allein die
Zahl des `lessThan`-Zeugen in der Einheit; das zweite Glied der `and`-Klammer ist
damit in **jedem** Roster wahr und kann das Ergebnis nicht erklären.

| Paar | Träger (Slot) | konstant | variiert | `effectiveMin` des Slots |
|------|---------------|----------|----------|--------------------------|
| **01 ↔ 02** | „Magic Level 3" `9dc7-…` am Vampire Lord (leer) | Noble Blood | 0 → 1 × Magic Level 4 | **1 → 0** |
| **03 ↔ 04** | „Magic Level 3" `9dc7-…` am Vampire Lord (**belegt**) | Noble Blood + Magic Level 3 | 0 → 1 × Magic Level 4 | **1 → 0** |
| **05 ↔ 06** | „Magic Level 2" `5a5f-…` am Vampire Count (leer) | Noble Blood | 0 → 1 × Magic Level 3 | **1 → 0** |

Das Paar **01 ↔ 02** macht den Umschlag zusätzlich im **Verletzungsbericht**
sichtbar (`4d5e-8101-e8d4-d7ad` feuert / feuert nicht), das Paar **03 ↔ 04**
zeigt ihn am **belegten** Slot — dort ändert sich ausschließlich das
`effectiveMin`, während `current` in beiden Rostern 1 bleibt.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle
referenzieren `.gst` + Vampire-Counts-`.cat` (+ die per `catalogueLink`
benötigte `Mercenaries`-`.cat`); alle tragen dasselbe Punktelimit von 2000 pts.

> **Assertion-Fokus:** das `effectiveMin` des gegateten Slots (über
> `expect.capabilities`) sowie die in `firing`/`absent` genannten Grenzen.
> Andere Armeeaufbau-Diagnosen (General-Pflicht, Core-Pflicht, Kategoriegrenzen,
> Punktelimit, die Necrarch-Pflicht `c30e-56ff-1881-340f`) können zusätzlich
> auftreten und sind hier ohne Belang.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | Noble Blood, **kein** Magic Level 4 → Mindestmaß 1 | Bloodlines (Necrarch) + Vampire Lord mit Pflicht-Kindern und Noble Blood; **weder** Magic Level 3 **noch** Magic Level 4. | LTU-R1/R2 halten (0 × Magic Level 4, `0 < 1`): Der Slot „Magic Level 3" verlangt **mindestens 1** (`effectiveMin` 1, `isMandatoryUnmet` true) und ist leer → **`4d5e-8101-e8d4-d7ad` feuert (Ist 0 / Grenze 1)**. Weil die Gruppe „Wizard Level" gar kein Mitglied führt, feuert zusätzlich ihre Pflicht **`769e-ff2d-6795-86cb` (Ist 0 / Grenze 1)** — LTU-R7. | [`01-lord-noble-blood-no-level-4.ros`](rosters/01-lord-noble-blood-no-level-4.ros) |
| 02 | **Magic Level 4 dazu** → Mindestmaß fällt auf 0 | **Bis auf Magic Level 4 identisch mit 01.** | LTU-R1 hält nicht mehr (1 × Magic Level 4, `1 < 1` falsch): die `and`-Klammer fällt, **kein** Modifier greift → `effectiveMin` **0**, `isMandatoryUnmet` false, **`4d5e-…` feuert nicht** (LTU-R4). Die Gruppe führt genau ein Mitglied → weder `769e-…` noch `f66f-…` feuert. | [`02-lord-noble-blood-with-level-4.ros`](rosters/02-lord-noble-blood-with-level-4.ros) |
| 03 | Katalogkonform: Magic Level 3 gewählt | Wie 01, zusätzlich **Magic Level 3** selbst gewählt. | Die Klammer hält weiter: `effectiveMin` **1** — mit genau einer Auswahl (`current` 1) **erfüllt**. Keine der beobachteten Grenzen feuert; das legale Gegenstück zu 01. | [`03-lord-level-3-chosen-no-level-4.ros`](rosters/03-lord-level-3-chosen-no-level-4.ros) |
| 04 | Überfüllte Gruppe: Magic Level 3 **und** 4 | **Bis auf Magic Level 4 identisch mit 03.** | Die Klammer fällt: `effectiveMin` **0** bei unverändertem `current` 1 — der Umschlag am **belegten** Slot. Aus dem bewussten Überfüllen folgt genau eine zusätzliche Erwartung: **`f66f-32f7-5f65-14a7` feuert (Ist 2 / Grenze 1)** — LTU-R7. | [`04-lord-level-3-and-level-4-group-overfull.ros`](rosters/04-lord-level-3-and-level-4-group-overfull.ros) |
| 05 | Zweites Vorkommen: Count ohne Magic Level 3 | Bloodlines (Necrarch) + **Vampire Count** mit Pflicht-Handweapon und Noble Blood; **kein** Magic Level 3. | LTU-R8: Der Slot „Magic Level 2" (`5a5f-…`) verlangt **mindestens 1** (`effectiveMin` 1) und ist leer → **`5e9b-7594-02cb-0bad` feuert (Ist 0 / Grenze 1)**; die leere Gruppe „Wizard Level" lässt zusätzlich **`19ba-de18-6ad7-2825` (Ist 0 / Grenze 1)** feuern. | [`05-count-noble-blood-no-level-3.ros`](rosters/05-count-noble-blood-no-level-3.ros) |
| 06 | Zweites Vorkommen: **Magic Level 3 dazu** | **Bis auf Magic Level 3 identisch mit 05.** | LTU-R8/R4: `1 < 1` ist falsch → `effectiveMin` **0**, **`5e9b-…` feuert nicht**. Die Gruppe führt ein Mitglied → `19ba-…` und `436d-…` feuern nicht. | [`06-count-noble-blood-with-level-3.ros`](rosters/06-count-noble-blood-with-level-3.ros) |

**Abwesend behauptete Grenzen (Roster 01–04):** die Ziel-Obergrenzen von *Magic
Level 3* `8fb8-7bf0-d992-c1dd` und *Magic Level 4* `8975-9aca-1463-1a1f` (je
`max 1 parent`, Ist 0 bzw. 1), die Noble-Blood-Obergrenze
`e8e0-d7f1-f9a4-a8c0` (`max 1 parent`, Ist 1), die Bloodlines-Pflicht
`4a0a-b107-e726-da32` (`min 1 force`, erfüllt), die Handweapon-Pflicht des Lords
`d830-89e1-7573-92e7` und die Pflicht des „Lord hero choice extra cost"
`0780-5a76-9d51-e9ea` (beide erfüllt). Für **05/06** analog: `436d-44fa-86cf-bf42`
(Gruppen-max am Count), `0885-9b48-f6d0-241e` (*Magic Level 2*, `max 1 parent`),
`8fb8-7bf0-d992-c1dd`, `e8e0-d7f1-f9a4-a8c0`, `4a0a-b107-e726-da32` und die
Handweapon-Pflicht des Counts `3a5f-f22c-f213-581e`.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Kontingent „Standard (VC-AB)" | `e989-15b8-7eb6-9668` (`.cat` Z. 29297) |
| Katalog Vampire Counts / Bibliothek Mercenaries | `4d73-5ab0-9020-403c` / `fc47-8392-a6c8-452a` (Link `ef73-f9bd-e250-54d2`, Z. 29511) |
| **Unit „0-1 Vampire Lord " (der Rahmen `scope="unit"`)** | **`b77b-88d5-5e80-e178`** (Z. 2713) — `max 1 roster` `a7c9-5fec-592a-3716` |
| Gruppe „Wizard Level" am Lord | `43b8-dacd-f09f-37c3` (Z. 2948) — `min 1` **`769e-ff2d-6795-86cb`**, `max 1` **`f66f-32f7-5f65-14a7`** |
| **entryLink „Magic Level 3" am Lord (Träger der Zelle)** | **`9dc7-b9d7-4e92-4cda`** (Z. 2954) → `.gst`-Ziel `cb6c-c69a-5c73-97e8` (Z. 2079, `max 1 parent` `8fb8-7bf0-d992-c1dd`) |
| **Bewegtes Mindestmaß des Trägers (Basis `min 0` → `set 1`)** | **`4d5e-8101-e8d4-d7ad`** (Z. 2973) |
| pts-Kostenart (zweiter Modifier der Klammer, Basis 50 → 0) | `ecfa-8486-4f6c-c249` (Z. 2959 / Z. 2976) |
| **`lessThan`-Zeuge „Magic Level 4"** | Verweis **`c5d1-4b7d-c96b-2fb9`** (Z. 2991, Basis `hidden="true"`) → `.gst`-Ziel **`fc28-3af2-d37a-d07e`** (Z. 2049, `max 1 parent` `8975-9aca-1463-1a1f`) |
| Zweites Glied der `and`-Klammer: „Nehekhara’s Noble Blood" | `32d0-a151-94a3-aa54` (Z. 13661) — `max 1 parent` `e8e0-d7f1-f9a4-a8c0` |
| Link-Kette zum Noble Blood (Lord): „Magic selection" → „Bloodline" → „Vampiric Powers" (Necrarch) → Noble Blood | `3b8f-2a39-0b3b-7c59` → `53e8-0ce2-eaf6-0163`; `6005-e508-4d47-eb0a` → `0719-24b8-19d4-c832`; `fb5e-133e-b364-6b28` → `8627-7a0f-231c-7572`; `75e7-b83e-a2b3-13af` → `32d0-…` |
| Pflicht-Kinder des Lords (Rauschvermeidung) | „Lord hero choice extra cost" `42c5-9ebc-7493-89ef` (`min` `0780-5a76-9d51-e9ea`, `max` `b4f7-612f-aac4-65e6`); „Handweapon" `6abf-e08f-6480-cd58` in Gruppe `ac8f-eafa-97e8-3b04` (`min` `d830-89e1-7573-92e7`, `max` `b157-2f40-f533-4d60`) |
| Bloodlines / Bloodline of Clan Necrarch (Kontext, in allen Rostern) | `a56a-eb32-5a45-16fd` (Pflicht `4a0a-b107-e726-da32`) / `5017-296d-edef-4562` |
| **Unit „Vampire Count" (zweites Vorkommen)** | **`6822-0110-a7c9-cbb0`** (Z. 3124) |
| Gruppe „Wizard Level" am Count | `7ab1-d9dc-6124-443f` (Z. 3178) — `min 1` **`19ba-de18-6ad7-2825`**, `max 1` **`436d-44fa-86cf-bf42`** |
| **entryLink „Magic Level 2" am Count (Träger)** | **`5a5f-aaf8-868f-9630`** (Z. 3184) → `.gst`-Ziel `fbc2-5115-f240-7367` (Z. 2069, `max 1 parent` `0885-9b48-f6d0-241e`) |
| **Bewegtes Mindestmaß am Count (Basis `min 0` → `set 1`)** | **`5e9b-7594-02cb-0bad`** (Z. 3203) |
| `lessThan`-Zeuge am Count: „Magic Level 3" | Verweis `15f0-88b7-5fcc-061b` (Z. 3215, Basis `hidden="true"`, eingeblendet durch Noble Blood) → `cb6c-c69a-5c73-97e8` |
| „Handweapon" des Counts (Pflicht-Kind) | `9e6c-19ea-19ad-7cbe` in Gruppe `06c9-c170-adb2-86f5` — `min` `3a5f-f22c-f213-581e`, `max` `6798-e03b-977d-7506` |
| Link-Kette zum Noble Blood (Count) | `2dc4-ffd3-2c99-c560` → `53e8-…`; `1f18-d124-2712-9a32` → `0719-…`; `fb5e-…` → `8627-…`; `75e7-…` |
| „Necrarch additional casting dice" (Necrarch-Nebenwirkung, **nicht** gepinnt) | `68c7-4c56-8f0b-ad91` (Z. 14543; Lord-Link `b71c-a60d-b956-74bc`, Count-Link `d2e6-8ca6-4f19-5b55`) — `min` `c30e-56ff-1881-340f` / `max` `07af-27f2-a2b3-7859`, beide per Necrarch-`modifierGroup` von 0 auf 1 gesetzt |

---

## Bewusst nicht gepinnte Facetten

- **Die Kostenwirkung des zweiten Modifiers.** Hält die Klammer, setzt
  `set value="0" field="ecfa-8486-4f6c-c249"` die pts des Links „Magic Level 3"
  von 50 auf 0 (am Count analog: „Magic Level 2", dessen Basis-`cost` allerdings
  am Verweis fehlt). Das Manifest-Feld `capabilities` kennt **keine**
  Kosten-Aussage, und der Verletzungsbericht kodiert Zähl-/Kosten-**Grenzen**,
  keine Einzelpreise — dieselbe Feststellung wie in
  [`less-than-parent-parry-save`](../less-than-parent-parry-save/README.md).
  Der Punkt bleibt dokumentiert, aber **unassertiert**.
- **`includeChildSelections="true"` an den beiden Bedingungen.** Alle Zeugen
  (Noble Blood, Magic Level 3/4) liegen in der `.ros` zwangsläufig als **direkte**
  Kinder der Charakter-Selektion — die tragenden Gruppen erscheinen dort nicht als
  eigene `selection`. Ein Roster, in dem ein Zeuge **tiefer** als eine Ebene unter
  dem Rahmen hängt, lässt sich mit diesen Zeugen nicht bauen; die Flag-Wirkung ist
  an dieser Zelle latent und wird weder als feuernd noch als abwesend behauptet.
- **Die Abgrenzung `unit` gegen `parent`.** In diesen Rostern fällt die
  umschließende Einheit mit der Elternauswahl des Trägers zusammen (die Gruppe
  „Wizard Level" hängt direkt am Unit). Die Roster können also **nicht**
  unterscheiden, ob die Engine `unit` oder `parent` rechnet; behauptet wird allein
  das aus `scope="unit"` abgeleitete Ergebnis. Die *Nicht*-Gleichsetzung von `unit`
  und `force` ist dagegen implizit mitgeprüft: die Zeugen liegen in beiden Zweigen
  im selben Kontingent, gezählt wird nur, was **in der Einheit** steht.
- **`hidden`/Verfügbarkeit als Ganzes.** Dass Noble Blood die Verweise
  „Magic Level 2" (verbergen) und „Magic Level 4"/„Magic Level 3" (einblenden)
  umschaltet, ist **Verfügbarkeit**, keine zählende Schranke. Behauptet wird
  daraus nur der Kontroll-Wert `isHidden: false` am jeweils gepinnten Slot — er
  ist in **allen** Rostern gleich und belegt, dass das Delta zwischen den Paaren
  vom Mindestmaß kommt und nicht von der Sichtbarkeit.
- **`effectiveMax`/`headroom`/`isBlocked` des Slots.** Ob eine am **Ziel**
  deklarierte Grenze (`max 1 parent` an `cb6c-…`/`fbc2-…`) auf den **Verweis**-Slot
  durchschlägt, ist eine ausdrückliche
  [Lücke der Quelle](../../battlescribe-data-format.md#15-lücken-der-quelle)
  („Grenze am Verweis oder am Ziel"). Diese Felder werden deshalb **nicht**
  behauptet; die Ziel-Obergrenzen stehen nur in `absent`, wo sie ohnehin erfüllt
  sind.
- **Wie die Engine einen leeren Slot einordnet** (`anchorKind` in 01/02, 05/06).
  Da sich das Mindestmaß zwischen den Rostern ändert, wird die Herkunft des leeren
  Slots (Angebot vs. Pflicht-Anker) bewusst **nicht** behauptet; ausgewählt wird er
  allein über `defId` + `targetDefId`. In 03/04 ist der Slot **belegt**; dort
  disambiguiert `anchorKind: "occupied"` den Treffer.
- **Necrarch-Nebenwirkungen** auf beide Charaktere (Name „… of Clan Necrarch",
  Kategorie-Umbau, Profiländerungen, die dynamische Pflicht
  `c30e-56ff-1881-340f` der „Necrarch additional casting dice"): in **allen**
  Rostern identisch, also ohne Aussagekraft für das Delta — weder in `firing`
  noch in `absent`. Die Bloodline steht in den Rostern ausschließlich, weil sie
  die Gruppe „Vampiric Powers" `8627-…` einblendet, in der Noble Blood überhaupt
  angeboten wird (dieselbe Konstruktion wie in
  [`greater-than-parent-upgrade-gate`](../greater-than-parent-upgrade-gate/README.md)).
- **Roster 01, 02 und 05 sind absichtlich nicht in jeder Hinsicht
  katalogkonform.** In 01 und 05 ist die Gruppe „Wizard Level" leer (ihre
  `min`-Pflicht steht deshalb bewusst in `firing`); in 02 ist mit „Magic Level 4"
  die dem Datensatz nach ungewöhnliche, aber sichtbare und einzeln zulässige
  Stufe gewählt. Die katalogkonformen Gegenstücke liefern die Roster 03 und 06.
- **`defaultSelectionEntryId="3c1a-3350-04ae-7a3f"`** an beiden „Wizard
  Level"-Gruppen benennt eine Id, die **keiner** der drei Mitglieder-Verweise
  trägt (`9dc7`/`54fc`/`c5d1` bzw. `5a5f`/`69f7`/`15f0`) und die im Datensatz
  auch sonst nicht als Gruppen-Option auflöst. Wie eine Auswertung mit einem
  ungültigen `defaultSelectionEntryId` umgeht, ist nicht Gegenstand dieses
  Szenarios (Formatdoku [§7.1](../../battlescribe-data-format.md#71-selection-entry--selection-entry-group):
  Rückfall auf die erste verfügbare Option).
