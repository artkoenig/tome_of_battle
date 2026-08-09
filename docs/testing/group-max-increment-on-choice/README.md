# E2E-Regeln & Testkatalog: Bedingter `increment` auf ein Gruppen-Max — Rüstung + „Schild" kombinierbar (Vampire Counts)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Regeln aus den
Katalogdaten der *6th Definitive Edition* abgeleitet; das Eingabeformat der
Roster folgt den bereits verifizierten Szenario-Fixtures (direktes `entryId`,
`entryLinkId=""`, geschachtelte `selections` mit `number`, `entryGroupId` für
Gruppen-Mitglieder).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee: `Vampire Counts (6th definitive edition).cat`
  (`4d73-5ab0-9020-403c`, rev 1) — Force **„Standard (VC-AB)"**
  `e989-15b8-7eb6-9668`
- Dazu `Mercenaries (6th definitive edition).cat` (per `catalogueLink`
  `ef73-f9bd-e250-54d2` → `fc47-8392-a6c8-452a` aus der VC-`.cat` eingebunden)

## Der gepinnte Mechanismus

Ein `modifier type="increment"`, dessen `field` die **`id` eines Constraints**
nennt, addiert seinen `value` auf den effektiven Wert dieser Grenze — **exakt
solange seine `condition` hält**, und ohne `<repeat>` genau **einmal**
([§9.8 der Formatdoku](../../battlescribe-data-format.md): das kanonische
Rüstung+Schild-Muster — das Max einer Gruppe steigt, wenn eine gekoppelte
Geschwister-Option gewählt ist, sodass Rüstung **und** Schild kombinierbar
werden). Träger ist die Gruppe **„Weapons and Armour"** des **Vampire Count**;
die koppelnde Option ist hier **Full Plate Armour**:

```
selectionEntry "Vampire Count" (6822-0110-a7c9-cbb0, type=unit, Lord primär)
  └ selectionEntryGroup "Weapons and Armour" (06c9-c170-adb2-86f5, hidden=false)
       ├ constraint max 2 selections scope=parent    b3b5-f872-24df-04dc   ← Ziel beider increments
       ├ modifier increment +1 field=b3b5-…
       │    └ condition atLeast 1 selections scope=parent
       │         childId=a4d1-6e85-bee8-55d1   (Link „Full Plate Armour")
       ├ modifier increment +1 field=b3b5-…
       │    └ condition atLeast 1 selections scope=parent
       │         childId=071e-7d5a-a22f-3ba7   (Link „Schild" — hier bewusst inert)
       ├ selectionEntry "Handweapon" (9e6c-19ea-19ad-7cbe, min 1/max 1, 0 pts)
       ├ entryLink a4d1-6e85-bee8-55d1 ──▶ 3869-2f40-dd21-6971 „Full Plate Armour"
       │      (Basis hidden=true, 0 pts; modifierGroup [atLeast 1 Blood Dragon
       │       9fd9-… scope=force]: set hidden=false UND set min b381-… = 1)
       ├ entryLink 071e-7d5a-a22f-3ba7 ──▶ 50e2-1873-a856-03e7 „Shield"
       │      (Basis hidden=true, 3 pts; von Blood Dragon ebenfalls eingeblendet)
       └ entryLinks „Great Weapon" 4b34-…, „Lance" 10e2-…, „Two Hand Weapons" e3a1-…
```

Netto-Semantik der Daten: die Gruppe erlaubt **zwei** Auswahlen (typisch:
Pflicht-Handweapon + eine Option). Ist **Full Plate Armour** in der Gruppe
gewählt, hebt der erste increment die Kappe auf **3** — die schwere Rüstung
verbraucht den Options-Slot also **nicht**; der zweite, baugleiche increment
täte dasselbe für den Schild (Rüstung **und** Schild **und** Handwaffe wären
kombinierbar). Full Plate Armour existiert für den Count nur in einer
**Blood-Dragon-Armee**: der geteilte Eintrag ist per Basis versteckt und wird
erst durch die Bloodline-`modifierGroup` (Formatdoku
[§7.7](../../battlescribe-data-format.md)) eingeblendet — darum tragen **beide**
Roster die Bloodline of Clan Blood Dragon.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **GMI-R1** | Die Gruppe „Weapons and Armour" des Vampire Count erlaubt als geschriebene Grenze **max 2** Auswahlen unter ihren Mitgliedern. | `Vampire Counts (6th definitive edition).cat`, `selectionEntry` `6822-0110-a7c9-cbb0` → `selectionEntryGroup` `06c9-c170-adb2-86f5` → constraint **`b3b5-f872-24df-04dc`** (`type=max value=2 field=selections scope=parent shared=true includeChildSelections=false`). |
| **GMI-R2** | Ist **Full Plate Armour** in der Gruppe gewählt, steigt diese Grenze um **+1**: der `increment`-Modifier nennt im `field` **genau die Constraint-Id** und hält, solange mindestens ein Full Plate (Link `a4d1-…`) unter dem Elternrahmen gewählt ist → effektives Maximum `2 + 1 = 3` (das §9.8-Muster „Rüstung+Schild"). | Ebd. → `modifier type="increment" value="1" field="b3b5-f872-24df-04dc"` mit `<condition type="atLeast" value="1" field="selections" scope="parent" childId="a4d1-6e85-bee8-55d1" shared="true"/>`. |
| **GMI-R3** | Ohne Full-Plate-Auswahl hält die Bedingung **nicht**, der Modifier wird nicht angewendet, die Grenze behält ihren **Basiswert 2**. | Kein anderes Element im gesamten Fixture-Datensatz adressiert `b3b5-f872-24df-04dc` (verifiziert: nur die beiden increments an `06c9-…` nennen diese Id). |
| **GMI-R4** | Der zweite, baugleiche increment (+1, solange ein **Schild** gewählt ist) ist in beiden Rostern **inert**, weil kein Schild gewählt ist — er ändert die erwarteten Maxima nicht. | Ebd. → zweiter `modifier type="increment" value="1" field="b3b5-…"` mit `<condition type="atLeast" value="1" … childId="071e-7d5a-a22f-3ba7"/>`; die Roster enthalten keine Auswahl mit diesem Link. |
| **GMI-R5** | **Verfügbarkeits-Vorbedingung:** Der geteilte Eintrag „Full Plate Armour" ist per Basis `hidden="true"`; erst eine **Blood-Dragon**-Bloodline in der Force blendet ihn ein (`set hidden=false`) **und** setzt zugleich seine min-Grenze `b381-…` von 0 auf **1** (bedingte Pflichtwahl, §9.8-Klasse „Min erhöht"). Der Link `a4d1-…` selbst ist `hidden="false"`; sein Strigoi-Verstecker (`instanceOf` Kategorie `bf30-…`) ist mit Blood Dragon inert. | Ebd., `selectionEntry` **`3869-2f40-dd21-6971`** → constraints `42ba-ae25-6a46-243e` (`max 1 scope=parent`), **`b381-5bd3-4720-6f9a`** (`min 0 scope=parent`); `modifierGroup type="and"` mit `<condition type="atLeast" value="1" field="selections" scope="force" childId="9fd9-e05c-ffcb-2c4d" …/>` und den Modifiern `set false hidden` / `set 1 b381-…`. Link-Modifier: `set true hidden` bei `instanceOf … childId="bf30-4ff0-a4d8-3909"`. |
| **GMI-R6** | Die Pflicht-Untergrenzen des Trägers sind in beiden Rostern erfüllt bzw. nicht validierbar: **Handweapon min 1** (gewählt, zählt als Gruppen-Mitglied mit), **Wizard Level min 1** (Magic Level 1 gewählt, 0 pts), und die **min-1-Grenze in der Gruppe „Lores of Magic"** hängt in einer `hidden="true"`-Gruppe — Min-Grenzen effektiv versteckter Entitäten werden nicht validiert ([§5.6/§8](../../battlescribe-data-format.md), Issue 0088). | `.cat`, `6822-…`: Handweapon `9e6c-19ea-19ad-7cbe` (min **`3a5f-f22c-f213-581e`**, max `6798-e03b-977d-7506`), Gruppe „Wizard Level" `7ab1-d9dc-6124-443f` (min **`19ba-de18-6ad7-2825`**, max `436d-44fa-86cf-bf42`) mit Link „Magic Level 1" `69f7-0112-b50e-c883` → `.gst` `158f-d753-59e2-9ad2` (0 pts), Gruppe „Lores of Magic" `d5ee-4750-3361-8bfa` `hidden="true"` → Link `0d1e-9606-4a0c-4190` min **`3e2d-11cc-0e9f-e993`**. |

**Bewusst nicht Gegenstand dieses Szenarios** (in beiden Rostern absichtlich
inert bzw. nicht assertiert):

- **Die Full-Plate-Pflicht in Roster 02:** Mit Blood Dragon in der Force setzt
  die `modifierGroup` die min-Grenze `b381-5bd3-4720-6f9a` des Full Plate auf 1
  (GMI-R5) — in Roster 02 ist Full Plate **nicht** gewählt, die Pflicht also
  real unerfüllt. Das ist eine echte Katalog-Konsequenz, gehört aber zu einer
  **anderen** Modifier-Zelle (`set` auf einen Min-Constraint-Wert), und ob der
  Bericht die Untergrenze eines **unausgewählten** Links seedet, ist dieselbe
  Feinheit wie beim Bloodlines-Seeding-Hinweis in
  [`../vampire-bloodlines/`](../vampire-bloodlines/README.md). Sie wird darum
  **weder als `firing` noch als `absent`** gepinnt — die selektive Erwartung
  toleriert beides. (In Roster 01 ist die min erfüllt und steht in `absent`.)
- **Der Shield-Zweig des Musters:** Blood Dragon blendet auch den Schild-Link
  `071e-…` ein (`set hidden=false` bei `atLeast 1` von `9fd9-…`, scope=force);
  gewählt wird er absichtlich nicht, damit ausschließlich der
  Full-Plate-increment die Differenz der beiden Roster trägt (GMI-R4).
- **Namens- und Kategorien-Effekte der Bloodline:** Die Blood-Dragon-
  `modifierGroup` am Count hängt „of Clan Blood Dragon" an den Namen und tauscht
  die Clan-Kategorie (`add 4cae-…`). Der Capability-Abgleich adressiert den
  Rahmen über `frameDefId` (nicht über den Namen) und macht dazu keine Aussage.
- **Armeeweite Aufbau-Diagnosen** (General-Pflicht, Core-Mindestzahl,
  Kategorien-Skalierung ohne gesetztes Punktebudget): können zusätzlich
  auftreten; die Erwartung ist selektiv und macht darüber keine Aussage.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Beide Roster
sind **bis auf die Full-Plate-Auswahl identisch**: Kontingent „Standard
(VC-AB)", eine „Bloodlines"-Selektion mit Blood Dragon, ein Vampire Count mit
Pflicht-Handweapon und Magic Level 1.

> **Assertion-Fokus:** das effektive Maximum des Gruppen-Ankers „Weapons and
> Armour" (`expect.capabilities`, Feld `effectiveMax`) sowie die Stille der in
> GMI-R1/R5/R6 genannten Grenzen und der Bloodline-Grenzen im
> Verletzungsbericht.

| # | Testtitel | Betroffene Katalogdateien | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|---------------------------|----------------|-------------------------------------------------------|---------|
| 01 | Full Plate gewählt → Maximum 3 | `.gst` + VC-`.cat` (+ Mercenaries) | Vampire Count mit Handweapon **und** Full Plate Armour in der Gruppe `06c9-…`; Blood Dragon in der Force. | **GMI-R2:** Der Gruppen-Anker (Gruppe `06c9-…`, Rahmen = Count `6822-…`) meldet `effectiveMax=3` bei Ist 2 (Spielraum 1) — der bedingte increment greift **genau einmal**. Keine der genannten Grenzen feuert. | [`01-full-plate-effective-max-3.ros`](rosters/01-full-plate-effective-max-3.ros) |
| 02 | Ohne Full Plate → Basiswert 2 | wie 01 | **Identischer** Aufbau ohne die Full-Plate-Auswahl. | **GMI-R3:** Derselbe Anker meldet den geschriebenen Basiswert `effectiveMax=2` bei Ist 1 (Spielraum 1, kein `min`, nicht blockiert). Die unpinnte Full-Plate-Pflicht (s. o.) darf zusätzlich erscheinen oder fehlen. | [`02-no-full-plate-base-max-2.ros`](rosters/02-no-full-plate-base-max-2.ros) |

**Ableitung der Zahlen (aus den Daten, nicht aus einem Engine-Lauf):**
`effectiveMax` ist in Test 01 `2 + 1 = 3` (Basiswert 2 der Constraint `b3b5-…`
plus **eine** Anwendung des increment +1, weil seine `atLeast`-Bedingung mit
genau einem gewählten Full Plate hält; kein `<repeat>` im Spiel), in Test 02 der
Basiswert `2` (Bedingung hält nicht; GMI-R3). `current` zählt die gewählten
Gruppen-Mitglieder im Elternrahmen: Handweapon + Full Plate = 2 bzw. nur
Handweapon = 1; `headroom` ist die Differenz Maximum − Ist (jeweils 1).
`effectiveMin` ist `null`, weil die Gruppe selbst keine min-Grenze trägt und
kein Modifier ihr eine hinzufügt. Mit 2 ≤ 3 (bzw. 1 ≤ 2), 1 ≤ 1 (Handweapon,
Full Plate, Wizard Level je eigene max) und erfüllten bzw. nicht validierbaren
Mindestgrenzen (GMI-R6) stehen alle genannten Grenzen in `absent`.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Force „Standard (VC-AB)" | `e989-15b8-7eb6-9668` |
| „Bloodlines" (Force-Selection, Pflicht min 1) | `a56a-eb32-5a45-16fd` — min `4a0a-b107-e726-da32` |
| Gruppe „Vampiric Bloodline" (max 1 Clan) | `5655-13ba-8980-bd1c` — max `39c7-f615-17db-7016` |
| Bloodline of Clan Blood Dragon | `9fd9-e05c-ffcb-2c4d` |
| Vampire Count (type=unit, Lord primär, Characters) | `6822-0110-a7c9-cbb0` |
| Gruppe „Weapons and Armour" (der Slot-`defId`) | `06c9-c170-adb2-86f5` |
| — max 2 (scope=parent, Ziel beider increments) | constraint `b3b5-f872-24df-04dc` |
| — increment +1 solange Full Plate gewählt | condition `childId=a4d1-6e85-bee8-55d1` |
| — increment +1 solange Schild gewählt (inert) | condition `childId=071e-7d5a-a22f-3ba7` |
| — Handweapon (Pflicht-Mitglied, min 1/max 1, 0 pts) | `9e6c-19ea-19ad-7cbe` — min `3a5f-f22c-f213-581e`, max `6798-e03b-977d-7506` |
| Full-Plate-Link → geteilter Eintrag (Basis `hidden=true`, 0 pts) | `a4d1-6e85-bee8-55d1` → `3869-2f40-dd21-6971` — max `42ba-ae25-6a46-243e`, min `b381-5bd3-4720-6f9a` |
| Schild-Link → geteilter Eintrag (Basis `hidden=true`, 3 pts) | `071e-7d5a-a22f-3ba7` → `50e2-1873-a856-03e7` — max `3312-3031-8f14-e124` |
| Gruppe „Wizard Level" (min 1/max 1) | `7ab1-d9dc-6124-443f` — min `19ba-de18-6ad7-2825`, max `436d-44fa-86cf-bf42` |
| — Link „Magic Level 1" → `.gst`-Eintrag (0 pts) | `69f7-0112-b50e-c883` → `158f-d753-59e2-9ad2` |
| Gruppe „Lores of Magic" (`hidden="true"`, min darin nicht validiert) | `d5ee-4750-3361-8bfa` — Link `0d1e-9606-4a0c-4190`, min `3e2d-11cc-0e9f-e993` |
| Strigoi-Clan-Kategorie (Verstecker-Bedingung, inert) | `bf30-4ff0-a4d8-3909` |
| Katalog-Link auf Mercenaries | `ef73-f9bd-e250-54d2` → `fc47-8392-a6c8-452a` |
