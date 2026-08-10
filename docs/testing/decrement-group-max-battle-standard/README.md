# E2E-Regeln & Testkatalog: Bedingter `decrement` auf ein Gruppen-Max — Battle Standard Bearer (Vampire Counts)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Regeln aus den
Katalogdaten der *6th Definitive Edition* abgeleitet; das Eingabeformat der
Roster folgt den bereits verifizierten Szenario-Fixtures (direktes `entryId`,
`entryLinkId=""` bzw. `entryLinkId` des Verweises, geschachtelte `selections`
mit `number`, `entryGroupId` an Gruppen-Mitgliedern — auch bei geschachtelten
Gruppen die **innerste** Gruppen-Id, wie in
[`less-than-unit-wizard-level-gate`](../less-than-unit-wizard-level-gate/README.md)).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee: `Vampire Counts (6th definitive edition).cat`
  (`4d73-5ab0-9020-403c`, rev 1) — Force **„Clan Lahmia (VC-AB)"**
  `2102-34f1-c876-98c5`
- Dazu `Mercenaries (6th definitive edition).cat` (per `catalogueLink`
  `ef73-f9bd-e250-54d2` → `fc47-8392-a6c8-452a` aus der VC-`.cat` eingebunden)

## Der gepinnte Mechanismus

Ein `modifier type="decrement"`, dessen `field` die **`id` eines Constraints**
nennt, zieht seinen `value` vom effektiven Wert dieser Grenze ab — die
absenkende Gegenrichtung zum vertrauten `increment`
([Formatdoku §7.6/§7.7](../../battlescribe-data-format.md#76-constraint):
„Modifier adressieren einen Constraint über dessen `id`, um dessen `value`
dynamisch zu ändern"). Träger ist die Gruppe **„Weapons"** der Einheit
**Commander [HIGH ELVES]**:

```
selectionEntry "Swain" (b920-b398-dc26-7f4d, type=unit, Basis hidden=true)   VC-.cat Z. 5210
  │   modifier set hidden=false  ⟵ condition instanceOf 2102-… (Force Clan Lahmia)  Z. 10058
  └ selectionEntryGroup "Hero from another faction" (09bf-a395-daf9-7e25)     Z. 5216
       │   constraint max 1 selections scope=parent   2e71-b752-12d3-5100
       └ selectionEntryGroup "High Elves" (6bb3-dd06-5788-b4f7)               Z. 8776
            └ selectionEntry "Commander [HIGH ELVES]"                          Z. 8778
                 (d8e205ee-ee8d-4c18-afc8-cce2dde3f4ff, type=unit, 70 pts)
                 │   constraint max 1 selections scope=parent  84a5-3fa2-f13f-40c8
                 ├ selectionEntry "Magic Items and Honours" 86633839-…         Z. 8802
                 │     constraint max 1                       0918bd42-…
                 ├ selectionEntryGroup "Weapons" (86431046-9343-42d5-b774-db24c99c4bb3)  Z. 8847
                 │     constraint max 1 selections scope=parent shared=true
                 │                includeChildSelections=false includeChildForces=false
                 │                                            93f2a491-7de3-4020-ad0d-5d08ac3399f8
                 │     modifier decrement −1  field=93f2a491-…                 Z. 8849
                 │        └ condition equalTo 1 selections scope=parent
                 │             childId=e9ad-f1ce-aebf-6d23 (Battle Standard Bearer, .gst)
                 │             shared=true includeChildSelections=false        Z. 8851
                 │     (KEINE Mitglieder — weder selectionEntries noch entryLinks)
                 ├ selectionEntryGroup "Mounts" 56887100-…  max 1  aa1491d9-…  Z. 8859
                 └ selectionEntryGroup "Armour" 4c76b6a1-…  max 1  b6c4f102-…  Z. 8888
```

Netto-Semantik der Daten: die Gruppe erlaubt **eine** Auswahl; steht im
Eltern-Rahmen **genau ein** Battle Standard Bearer, fällt die Kappe auf
**1 − 1 = 0**. Der Commander wäre also entweder Standartenträger **oder**
Waffenträger, nicht beides.

---

## Zwei Befunde in den Katalogdaten — die Zelle ist nur zur Hälfte messbar

> **Lücke (bewusst nicht weggeschrieben).** Die absenkende Hälfte des Musters
> — effektives Hoechstmaß **0** — lässt sich aus **keinem** katalogzulässigen
> Roster erzeugen. Zwei unabhängige Gründe, beide direkt an den Daten belegt:
>
> 1. **Die Gruppe „Weapons" `86431046-…` hat keine Mitglieder.** Zwischen
>    `<modifiers>` und `<constraints>` steht nichts: kein `selectionEntry`,
>    kein `entryLink`, und **kein** `entryLink` irgendwo im Datensatz zeigt auf
>    die Gruppe (`targetId="86431046-…"` kommt 0-mal vor). Der gezählte Wert
>    von `93f2a491-…` ist damit in jedem zulässigen Roster **0** — die Grenze
>    kann **weder** gegen ihren Basiswert 1 **noch** gegen den abgesenkten Wert
>    0 verletzt werden (0 ≤ 1 und 0 ≤ 0). `93f2a491-…` steht deshalb in beiden
>    Rostern in `absent` und **nie** in `firing`; der einzige Unterschied, den
>    ein Roster überhaupt sichtbar machen könnte, ist das **`effectiveMax` des
>    Gruppen-Slots**.
> 2. **Der Commander bietet nirgends einen Battle Standard Bearer an.** Sein
>    gesamter Teilbaum (Z. 8778–8924) besteht aus dem Eintrag „Magic Items and
>    Honours" und den drei Gruppen Weapons/Mounts/Armour; ein `entryLinks`-Block
>    auf Einheitsebene fehlt ganz. Auch die eingebundene Gruppe „Honours"
>    (`1d71e0a9-…`, Z. 23434) enthält nur die sechs High-Elves-Honours
>    (Lion Guard, Pure of Heart, Channeler, Loremaster, Seer, Swordmaster).
>    Die drei Vorkommen des BSB-Verweises in dieser `.cat`
>    (`a359-4a25-39d6-f518` am Wight Lord, `da79-b7c3-3a00-1979`,
>    `a36b-9379-a11a-f8e0`) hängen an **anderen** Charakteren. Da die Bedingung
>    `scope="parent"` trägt — und `shared="true"` diesen Rahmen **nicht** auf
>    Kontingent oder Roster ausweitet (belegt im Nachbarszenario
>    [`parent-max-enchanted-items-per-bearer`](../parent-max-enchanted-items-per-bearer/README.md),
>    Roster 03/04) —, ist ihr Zählwert für diesen Commander **immer 0**.
>
> **Folge:** Der Zählwert der Bedingung kann nur den Wert **0** annehmen; ein
> Roster mit Zählwert 1 (Modifier greift) oder ≥ 2 (`equalTo 1` hält trotz
> vorhandener BSB nicht — der von der Aufgabe erhoffte dritte Fall) ist aus den
> Katalogdaten **nicht** baubar. Er wird hier **nicht erfunden**: eine
> BSB-Auswahl unter den Commander zu schreiben, die der Katalog dort nicht
> anbietet, würde eine Erwartung an ein Roster pinnen, das der Datensatz nicht
> zulässt. Die Zelle `modifier|decrement|constraintValue` bleibt damit auf
> diesem Datensatz **nicht positiv messbar**; gepinnt wird ihre negative
> Hälfte — „der decrement greift **nicht**, solange seine Bedingung nicht hält"
> — und der **Rahmen** der Bedingung.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **DGM-R1** | Die Gruppe „Weapons" des Commander [HIGH ELVES] trägt als **geschriebene** Grenze **max 1** Auswahl unter ihren Mitgliedern. | `Vampire Counts (6th definitive edition).cat` Z. 8856: `selectionEntry` `d8e205ee-ee8d-4c18-afc8-cce2dde3f4ff` → `selectionEntryGroup` `86431046-9343-42d5-b774-db24c99c4bb3` → constraint **`93f2a491-7de3-4020-ad0d-5d08ac3399f8`** (`type=max value=1 field=selections scope=parent shared=true includeChildSelections=false includeChildForces=false`). |
| **DGM-R2** | Genau **ein** Modifier adressiert diese Grenze, und zwar **absenkend**: `type="decrement" value="1" field="93f2a491-…"`. Er trägt **keinen** `<repeat>` — greift also, wenn seine Bedingung hält, genau **einmal**: effektives Hoechstmaß `1 − 1 = 0`. Kein weiteres Element im Datensatz nennt diese Constraint-Id (verifiziert: 2 Treffer insgesamt — die Grenze selbst und dieser Modifier). | Ebd. Z. 8849. |
| **DGM-R3** | Die Bedingung ist eine **Gleichheits**-Prüfung, kein `atLeast`: `type="equalTo" value="1" field="selections" scope="parent" childId="e9ad-f1ce-aebf-6d23" shared="true" includeChildSelections="false" includeChildForces="false"`. Sie hält **nur** bei exakt einer Battle-Standard-Bearer-Auswahl im Eltern-Rahmen; bei **0** (und rechnerisch auch bei ≥ 2) hält sie **nicht**. | Ebd. Z. 8851; Ziel `e9ad-f1ce-aebf-6d23` = geteilter `.gst`-Eintrag „Battle Standard Bearer" (`.gst` Z. 799). |
| **DGM-R4** | Der **Rahmen** der Bedingung ist der einzelne Träger (der Commander), nicht das Kontingent und nicht das Roster: `scope="parent"`, und `shared="true"` weitet ihn nicht — es unterscheidet nur, ob über alle **Verweis-Instanzen** des Ziels hinweg gezählt wird. | [Formatdoku §7.6/§7.7](../../battlescribe-data-format.md#76-constraint) sowie das Nachbarszenario [`parent-max-enchanted-items-per-bearer`](../parent-max-enchanted-items-per-bearer/README.md) (Roster 03/04: `scope="parent" shared="true"` zählt je Träger, nicht roster-weit). |
| **DGM-R5** | **Hält die Bedingung nicht, bleibt der geschriebene Basiswert:** effektives Hoechstmaß **1**. Ein `decrement` ist keine unbedingte Absenkung. | DGM-R1 + DGM-R2 (Basiswert Z. 8856, Modifier bedingt Z. 8849–8853). |
| **DGM-R6** | **Erreichbarkeit:** Der Commander ist ausschließlich als Mitglied der Gruppe „High Elves" `6bb3-dd06-5788-b4f7` unterhalb des Verbunds „Swain" `b920-b398-dc26-7f4d` angeboten (kein `entryLink` im Datensatz zeigt auf `d8e205ee-…`). „Swain" trägt `hidden="true"` und wird per `modifier set hidden="false"` eingeblendet, sobald das Kontingent eine Instanz der Force **„Clan Lahmia (VC-AB)"** `2102-34f1-c876-98c5` ist. Beide Roster nutzen darum genau dieses Kontingent; die Kette darunter ist durchgängig `hidden="false"`. | Ebd. Z. 5210 (Swain), Z. 10057–10062 (`set hidden=false`, `condition instanceOf … childId="2102-34f1-c876-98c5" scope="force"`), Z. 5216 (Gruppe `09bf-…`), Z. 8776 (Gruppe `6bb3-…`), Z. 8778 (Commander); `forceEntry` „Clan Lahmia (VC-AB)" Z. 29403. |
| **DGM-R7** | **Die Gruppe hat keine Mitglieder** — der Zählwert von `93f2a491-…` ist in jedem zulässigen Roster 0, die Grenze feuert nie. Siehe Lücken-Kasten oben. | Ebd. Z. 8847–8858 (Gruppenrumpf: nur `<modifiers>` + `<constraints>`); `targetId="86431046-…"` kommt im gesamten Fixture-Satz nicht vor. |
| **DGM-R8** | **Der Commander kann keinen Battle Standard Bearer tragen** — die Bedingung aus DGM-R3 hält in keinem zulässigen Roster. Siehe Lücken-Kasten oben. | Ebd. Z. 8778–8924 (kein `entryLinks` auf Einheitsebene, keine BSB-Option in „Magic Items and Honours"/„Honours" `1d71e0a9-…` Z. 23434). |
| **DGM-R9** | **Die legale Gegenprobe zum Rahmen:** Der Katalog bietet den BSB in dieser Armee u. a. am **Wight Lord** `b9c6-93fb-ce3c-965a` an (Verweis `a359-4a25-39d6-f518` → `e9ad-…`). Steht dort genau ein BSB, sind dessen eigene Grenzen (roster-weit `082b-…`, je Träger `01a5-…`) und die Kategorie-Grenzen der `categoryEntry` „Battle standard bearer" `2ef7-3efe-a448-423f` (force-weit `2a1d-…`, je Träger `6935-…`) mit Ist 1 gegen Grenze 1 erfüllt — der BSB ist also **legal platziert** und die Bedingung des Commander muss dennoch schweigen. | Ebd. Z. 2317 (Verweis am Wight Lord), Z. 2118–2121 (Pflicht-Handweapon `c527-e525-5b58-9b7c`, min `a775-7b1e-7fa8-d353` / max `34c1-6e91-4dae-0ef6`); `.gst` Z. 799–803 (BSB mit `082b-067c-b983-c393`, `01a5-106d-f6e8-560b`), Z. 728–731 (Kategorie `2ef7-…` mit `6935-5f06-39d4-5f45`, `2a1d-03a1-b48c-64ad`). |

**Bewusst nicht Gegenstand dieses Szenarios** (absichtlich inert bzw. nicht
assertiert):

- **Die absenkende Hälfte selbst** (`effectiveMax` 0, `isBlocked` true): nicht
  baubar, siehe Lücken-Kasten. Sie wird **weder** als `firing` **noch** über
  eine Capability gepinnt.
- **`isHidden` der Slots:** „Swain" ist per Basis versteckt und wird nur über
  die Force eingeblendet (DGM-R6). Ob und wie sich die Sichtbarkeit einer
  Eltern-**Einheit** auf den Slot einer verschachtelten Gruppe fortpflanzt, ist
  eine andere Zelle; die Erwartung macht dazu keine Aussage. Auf die
  **Max**-Grenze wirkt Sichtbarkeit ohnehin nicht
  ([Formatdoku §8](../../battlescribe-data-format.md#8-kategorien--sichtbarkeit)).
- **Die Punkte-/Kostengrenzen:** die pts-Eigengrenze von „Swain"
  (`33ca-8daa-88e1-47f6`, Basis `max -1` = unbegrenzt, per Border-Patrols-
  Modifier auf 125 setzbar) und die 50-pts-Grenze `7eaade17-…` der Gruppe
  „Magic and Honors" bleiben mangels Auswahl bzw. mangels Border-Patrols-
  Selektion unberührt und werden nicht gepinnt.
- **Armeeweite Aufbau-Diagnosen** (General-Pflicht, Core-Mindestzahl, die
  force-skopierte Bloodlines-Pflicht `4a0a-b107-e726-da32`, Punktebudget):
  können zusätzlich auftreten; die Erwartung ist **selektiv** und macht darüber
  keine Aussage. Die Roster sind bewusst minimal gehalten und enthalten deshalb
  keine „Bloodlines"-Selektion.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Beide Roster
sind **bis auf den zweiten Charakter identisch**: Kontingent „Clan Lahmia
(VC-AB)", darin „Swain" mit dem Commander [HIGH ELVES].

> **Assertion-Fokus:** das effektive Hoechstmaß des Gruppen-Ankers „Weapons"
> (`expect.capabilities`, Feld `effectiveMax`) sowie das Schweigen der in
> DGM-R1/R9 genannten Grenzen im Verletzungsbericht. `firing` bleibt in beiden
> Fällen leer — die Gruppengrenze **kann** mangels Mitgliedern nicht feuern
> (DGM-R7).

| # | Testtitel | Betroffene Katalogdateien | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|---------------------------|----------------|-------------------------------------------------------|---------|
| 01 | Kein Standartenträger → Basiswert 1 | `.gst` + VC-`.cat` (+ Mercenaries) | „Swain" mit dem Commander [HIGH ELVES]; unter dem Commander steht nichts. | **DGM-R5:** Der Gruppen-Anker (Gruppe `86431046-…`, Rahmen = Commander `d8e205ee-…`) meldet den geschriebenen Basiswert `effectiveMax=1` bei Ist 0 (Spielraum 1, kein `min`, nicht blockiert) — die `equalTo`-Bedingung hält bei 0 BSB **nicht**, der decrement greift nicht. | [`01-commander-no-bsb-effective-max-1.ros`](rosters/01-commander-no-bsb-effective-max-1.ros) |
| 02 | Standartenträger auf einem **anderen** Charakter → weiterhin 1 | wie 01 | **Identischer** Aufbau plus ein Wight Lord mit Pflicht-Handweapon und der BSB-Aufwertung. | **DGM-R4/R9:** Derselbe Anker meldet unverändert `effectiveMax=1` bei Ist 0. Ein force-/roster-weites Lesen des Rahmens (oder ein Lesen von `shared="true"` als „roster-weit") fände hier die geforderte **eine** BSB-Auswahl und ließe das Hoechstmaß auf 0 fallen — genau das schließt dieser Fall aus. Die BSB-eigenen und die kategorie-skopierten Grenzen schweigen mit Ist 1 gegen Grenze 1. | [`02-bsb-on-other-character-still-max-1.ros`](rosters/02-bsb-on-other-character-still-max-1.ros) |

**Ableitung der Zahlen (aus den Daten, nicht aus einem Engine-Lauf):**
`effectiveMax` ist in **beiden** Tests der geschriebene Basiswert `1` der
Constraint `93f2a491-…` (DGM-R1), weil die einzige Anpassung dieser Grenze ein
`decrement −1` mit einer Bedingung ist, die in beiden Rostern **nicht** hält
(DGM-R3/R4). `current` zählt die im Eltern-Rahmen gewählten Mitglieder der
Gruppe — das ist `0`, weil die Gruppe überhaupt keine Mitglieder besitzt
(DGM-R7); `headroom` ist die Differenz Hoechstmaß − Ist, also `1`.
`effectiveMin` ist `null`, weil die Gruppe keine min-Grenze trägt und ihr kein
Modifier eine hinzufügt; `isBlocked` ist damit `false` und `isMandatoryUnmet`
`false`. Alle in `absent` genannten Grenzen sind Max-Grenzen mit Ist ≤ Grenze:
Commander `84a5-…` (1 ≤ 1), Gruppe „Hero from another faction" `2e71-…`
(1 ≤ 1), Mounts `aa1491d9-…` (0 ≤ 1), Armour `b6c4f102-…` (0 ≤ 1),
„Magic Items and Honours" `0918bd42-…` (0 ≤ 1) und in Roster 02 zusätzlich die
BSB-Grenzen `082b-…`/`01a5-…`/`2a1d-…`/`6935-…` (je 1 ≤ 1) sowie die
Handweapon-Grenzen `a775-…` (min 1, erfüllt) und `34c1-…` (1 ≤ 1).

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Force „Clan Lahmia (VC-AB)" (blendet „Swain" ein) | `2102-34f1-c876-98c5` |
| „Swain" (Verbund der Fremdfraktions-Helden, Basis `hidden=true`) | `b920-b398-dc26-7f4d` |
| — Gruppe „Hero from another faction" (max 1) | `09bf-a395-daf9-7e25` — max `2e71-b752-12d3-5100` |
| — Gruppe „High Elves" (hält den Commander, keine eigene Grenze) | `6bb3-dd06-5788-b4f7` |
| Commander [HIGH ELVES] (type=unit, 70 pts, keine `categoryLinks`) | `d8e205ee-ee8d-4c18-afc8-cce2dde3f4ff` — max `84a5-3fa2-f13f-40c8` |
| Gruppe „Weapons" (der Slot-`defId`, **ohne Mitglieder**) | `86431046-9343-42d5-b774-db24c99c4bb3` |
| — max 1 (scope=parent, Ziel des decrement) | constraint `93f2a491-7de3-4020-ad0d-5d08ac3399f8` |
| — decrement −1, solange **genau ein** BSB im Eltern-Rahmen steht | condition `equalTo 1`, `childId=e9ad-f1ce-aebf-6d23` |
| Gruppe „Mounts" / „Armour" des Commander (je max 1) | `56887100-c584-49da-a438-a737a8a65094` — `aa1491d9-9d50-4d35-a6bf-9351ba3f6939` / `4c76b6a1-6f37-48a5-8049-b649e1f397bf` — `b6c4f102-c2fe-449a-8f02-d7be07231e7d` |
| „Magic Items and Honours" des Commander (max 1) | `86633839-75c9-46fd-9627-400229927ab5` — `0918bd42-2d7e-4aa9-9baa-36e8d81eb8f1` |
| — Gruppe „Magic and Honors" (max 50 pts) / verlinkte Gruppe „Honours" | `5025cb30-12fb-4436-a0d0-47a561597f25` — `7eaade17-79eb-493c-85e7-867000e4beb7` / `1d71e0a9-5883-4f30-8ead-a2f63f5b2fa1` |
| Battle Standard Bearer (geteilter `.gst`-Eintrag, 25 pts) | `e9ad-f1ce-aebf-6d23` — max `082b-067c-b983-c393` (roster), `01a5-106d-f6e8-560b` (parent) |
| — Kategorie „Battle standard bearer" | `2ef7-3efe-a448-423f` — max `2a1d-03a1-b48c-64ad` (force), `6935-5f06-39d4-5f45` (parent) |
| Wight Lord (einziger BSB-Anbieter dieses Szenarios) | `b9c6-93fb-ce3c-965a` — BSB-Verweis `a359-4a25-39d6-f518` |
| — Pflicht-Handweapon des Wight Lord | `c527-e525-5b58-9b7c` — min `a775-7b1e-7fa8-d353`, max `34c1-6e91-4dae-0ef6` |
| Weitere BSB-Verweise der VC-`.cat` (nicht am Commander) | `da79-b7c3-3a00-1979`, `a36b-9379-a11a-f8e0` |
| Katalog-Link auf Mercenaries | `ef73-f9bd-e250-54d2` → `fc47-8392-a6c8-452a` |
