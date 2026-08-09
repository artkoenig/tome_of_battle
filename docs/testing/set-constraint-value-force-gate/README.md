# E2E-Regeln & Testkatalog: `set` auf eine Constraint-Id, force-gebunden (Vampire Counts)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Regeln aus den
Katalogdaten der *6th Definitive Edition* abgeleitet; das Eingabeformat der
Roster folgt den bereits verifizierten Szenario-Fixtures (direktes `entryId`,
`entryLinkId=""`, geschachtelte `selections` mit `number`).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee: `Vampire Counts (6th definitive edition).cat`
  (`4d73-5ab0-9020-403c`, rev 1) — Forces **„Army of Sylvania (SoC)"**
  `4072-c3b8-84c4-a097` und **„Standard (VC-AB)"** `e989-15b8-7eb6-9668`
- Dazu `Mercenaries (6th definitive edition).cat` (per `catalogueLink`
  `ef73-f9bd-e250-54d2` aus der VC-`.cat` eingebunden)

## Der gepinnte Mechanismus

Ein `modifier type="set"`, dessen `field` die **`id` eines Constraints** nennt,
ersetzt dessen Wert **exakt**, solange seine Bedingungen halten — und lässt den
geschriebenen Basiswert unangetastet, solange sie nicht halten
([§7.6/§7.7 der Formatdoku](../../battlescribe-data-format.md): *„Modifier
adressieren einen Constraint über dessen `id`"*, der Modifier ändert dessen Wert
dynamisch). Träger ist hier der **Skeletons-Modellslot** im Skeletons-Regiment:

```
selectionEntry "Skeletons" (9ac2-f4c1-bcc3-3aee, type=unit, Kategorie Core)
  └ selectionEntry "Skeletons" (eaa1-c6a6-9aae-ae9a, type=model)
       ├ constraint min 10  selections scope=parent   ad1d-03cf-a16f-ae52   (unmodifiziert)
       ├ constraint max 40  selections scope=parent   6679-1132-0a76-9ba3   ← Ziel des set
       ├ constraint max -1  selections scope=parent   77fc-39e4-00c0-4e3a   (Sentinel „unbegrenzt")
       └ modifier set 30 field=6679-1132-0a76-9ba3
            └ condition instanceOf value=1 field=selections scope=force
                 childId=4072-c3b8-84c4-a097 (forceEntry „Army of Sylvania (SoC)")
```

Die Bedingung fragt per `instanceOf` mit `scope="force"` ab, ob das
**Kontingent selbst** eine Instanz des forceEntry „Army of Sylvania (SoC)" ist.
Sie hängt also allein an der Wahl des Kontingents — zwei Roster, die sich **nur
im forceEntry** unterscheiden, isolieren den Mechanismus vollständig.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **SCV-R1** | Der Skeletons-Modellslot hat als geschriebene Grenzen **min 10** und **max 40** Modelle je Regiment (scope=parent). | `Vampire Counts (6th definitive edition).cat`, `selectionEntry` `eaa1-c6a6-9aae-ae9a` → constraints **`ad1d-03cf-a16f-ae52`** (`type=min value=10 field=selections scope=parent`) und **`6679-1132-0a76-9ba3`** (`type=max value=40 field=selections scope=parent shared=true`). |
| **SCV-R2** | In einem Kontingent, das das forceEntry **„Army of Sylvania (SoC)"** instanziiert, wird das Maximum des Modellslots **exakt auf 30 ersetzt**. | Ebd. → `modifier type="set" value="30" field="6679-1132-0a76-9ba3"` mit `condition type="instanceOf" value="1" field="selections" scope="force" childId="4072-c3b8-84c4-a097" includeChildSelections="true"`; forceEntry `4072-c3b8-84c4-a097` „Army of Sylvania (SoC)" ist im selben Katalog deklariert. |
| **SCV-R3** | In jedem anderen Kontingent — hier **„Standard (VC-AB)"** — hält die Bedingung nicht, und der Constraint behält seinen **Basiswert 40**. | Der `set`-Modifier trägt genau **eine** Bedingung (`instanceOf` auf `4072-…`); forceEntry `e989-15b8-7eb6-9668` „Standard (VC-AB)" ist ein anderes forceEntry, die Bedingung ist dort falsch. Kein weiterer Modifier im Katalog adressiert `6679-1132-0a76-9ba3`. |
| **SCV-R4** | Die **dritte** max-Grenze des Slots (`77fc-39e4-00c0-4e3a`, `value="-1"`) bedeutet als geschriebener Sentinel **„unbegrenzt"** ([§7.6](../../battlescribe-data-format.md), Sentinel-Kasten) und verschärft das effektive Maximum **nicht**. Ihr bedingter `set 25` (Border Patrols) hängt an `atLeast 1` von `4e15-0353-165f-5528` („Border Patrols rules", scope=roster) — die Roster dieses Szenarios enthalten diesen Eintrag **bewusst nicht**, der Modifier bleibt inert. | Ebd.: constraint `77fc-39e4-00c0-4e3a` (`type=max value=-1`, Kommentar „BP") + `modifier set 25 field=77fc-39e4-00c0-4e3a` mit Border-Patrols-Bedingung. |
| **SCV-R5** | Die **min-10-Grenze bleibt in beiden Kontingenten unverändert** — der `set`-Modifier adressiert ausschließlich die Id der max-Grenze. | Kein Modifier im Katalog adressiert `ad1d-03cf-a16f-ae52`. Beide Roster asserten `effectiveMin=10`. |

**Bewusst nicht Gegenstand dieses Szenarios** (weitere Modifikatoren am selben
Slot, in beiden Rostern absichtlich inert bzw. nicht assertiert):

- **Kosten:** `set 7` auf die pts-Kostenart, gebunden an die Forces
  „Army of the Lichemaster" `f37a-a93e-fa22-61a8` / „Necromancer's Army"
  `d3af-1add-4e99-b977`, sowie `set 10` gebunden an Sylvania. Die Roster meiden
  das Lichemaster-Kontingent; Kostenwerte werden nicht assertiert.
- **Name:** `set "Skeleton Militia"` auf `field="name"` (ebenfalls
  Sylvania-gebunden) — die Namens-Wirkung von force-gebundenen Modifikatoren
  pinnt das separate Szenario `force-instance-gated-rename`; hier wird der
  Slot deshalb bewusst **ohne** `name`-Aussage selektiert (`defId`/`frameDefId`
  genügen).

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Beide Roster
sind **bis auf das forceEntry identisch**: ein Skeletons-Regiment mit **10
Modellen** (erfüllt min 10) und der Pflicht-Handweapon.

> **Assertion-Fokus:** das effektive Maximum des Modellslots
> (`expect.capabilities`, Feld `effectiveMax`) sowie die Abwesenheit der beiden
> Modell-Grenzen im Verletzungsbericht. Andere Armeeaufbau-Diagnosen
> (General-/Charakter-Pflichten, Core-Mindestzahl, Pflicht-Phantome wie „Army of
> Sylvania" `b48b-4a69-80f1-5d47`, Punktelimit) können zusätzlich auftreten und
> sind hier ohne Belang.

| # | Testtitel | Betroffene Katalogdateien | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|---------------------------|----------------|-------------------------------------------------------|---------|
| 01 | Sylvania: Modifier greift → max 30 | `.gst` + VC-`.cat` (+ Mercenaries) | Force **„Army of Sylvania (SoC)"** (`4072-…`), 1× Skeletons-Regiment mit 10 Modellen + Handweapon. | **SCV-R2:** Der Modellslot (`eaa1-…`, occupied, Rahmen = Regiment `9ac2-…`) meldet `effectiveMax=30` (Spielraum 20 bei 10 Modellen), `effectiveMin=10` unverändert. Weder `6679-…` noch `ad1d-…` feuern. | [`01-sylvania-effective-max-30.ros`](rosters/01-sylvania-effective-max-30.ros) |
| 02 | Standard: Bedingung hält nicht → max 40 | wie 01 | **Identischer** Aufbau, Force **„Standard (VC-AB)"** (`e989-…`). | **SCV-R3:** Derselbe Slot meldet den Basiswert `effectiveMax=40` (Spielraum 30), `effectiveMin=10`. Weder `6679-…` noch `ad1d-…` feuern. | [`02-standard-base-max-40.ros`](rosters/02-standard-base-max-40.ros) |

**Ableitung der Zahlen (aus den Daten, nicht aus einem Engine-Lauf):**
`bound`/`effectiveMax` ist in Test 01 der Modifier-Wert **30** (SCV-R2), in
Test 02 der Constraint-Basiswert **40** (SCV-R1/R3). `current=10` folgt aus
`number="10"` am Modellslot unter einem Regiment mit `number="1"`
(Rechenregel `child.number × parent.number`, [§7.5](../../battlescribe-data-format.md));
`headroom` ist die Differenz Maximum − Ist (20 bzw. 30). Mit 10 ≤ 30 ≤ 40 und
10 ≥ 10 verletzen beide Roster keine der beiden Modell-Grenzen — beide stehen
darum in `absent`.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Force „Army of Sylvania (SoC)" | `4072-c3b8-84c4-a097` |
| Force „Standard (VC-AB)" | `e989-15b8-7eb6-9668` |
| Skeletons (Regiment, type=unit, Kategorie Core) | `9ac2-f4c1-bcc3-3aee` |
| Skeletons (Modellslot, type=model) | `eaa1-c6a6-9aae-ae9a` |
| — min 10 (scope=parent, unmodifiziert) | constraint `ad1d-03cf-a16f-ae52` |
| — max 40 (scope=parent, Ziel des `set 30`) | constraint `6679-1132-0a76-9ba3` |
| — max −1 (Sentinel „unbegrenzt", Border-Patrols-`set 25` inert) | constraint `77fc-39e4-00c0-4e3a` |
| Handweapon (Pflicht-Upgrade des Regiments, min 1/max 1) | `565b-37e6-290b-e040` |
| „Border Patrols rules" (im Roster bewusst NICHT enthalten) | `4e15-0353-165f-5528` |
| Lichemaster-/Necromancer-Force (Kosten-Modifier, gemieden) | `f37a-a93e-fa22-61a8` / `d3af-1add-4e99-b977` |
| Katalog-Link auf Mercenaries | `ef73-f9bd-e250-54d2` → `fc47-8392-a6c8-452a` |
