# E2E-Regeln & Testkatalog: Force Child Category Missing (Vampire Counts)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Regeln aus den
Katalogdaten der *6th Definitive Edition* abgeleitet.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee: `Vampire Counts (6th definitive edition).cat`
  (`4d73-5ab0-9020-403c`, rev 1) — Force **„Army of the Lichemaster (WD#309-UK)"** `f37a-a93e-fa22-61a8`

## Wie Constraints an CategoryLinks greifen

Ein `forceEntry` kann über seine `categoryLinks` direkt Bedingungen an die Anzahl der in der Force erlaubten Auswahlen einer bestimmten Kategorie hängen. 

In diesem Fall erfordert die "Army of the Lichemaster" zwingend einen General/Lord. Der Constraint hängt direkt am `categoryLink` "Lord" und hat `scope="parent"`, was bedeutet, dass er sich auf die übergeordnete Force bezieht und die im gesamten Roster gewählten Selektionen mit dieser Kategorie zählt.

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **FCC-R1** | Die „Army of the Lichemaster (WD#309-UK)"-Force muss **mindestens einen** Lord enthalten. | `forceEntry "Army of the Lichemaster (WD#309-UK)"` `f37a-a93e-fa22-61a8` → `categoryLink "Lord"` `7a76-8153-c4b2-9fee` → constraint **`760d-2352-9fac-0e46`** `type=min value=1 field=selections scope=parent`. |

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). 

| # | Testtitel | Betroffene Katalogdateien | Roster-Zustand | Erwartetes Ergebnis des Evaluators | Fixture |
|---|-----------|---------------------------|----------------|------------------------------------|---------|
| 01 | Kein Lord (unzulässig) | `.gst` + VC-`.cat` | Force "Army of the Lichemaster", **keine** Einheiten ausgewählt. | **Verletzung von FCC-R1:** die Pflicht `760d-2352-9fac-0e46` (min 1) ist unerfüllt (Ist 0, Grenze 1). | [`01-missing-lord-illegal.ros`](rosters/01-missing-lord-illegal.ros) |
| 02 | Mit Lord (legal) | wie 01 | Force "Army of the Lichemaster" mit **einem** Master Necromancer (Kategorie Lord). | **Keine** Verletzung: das Limit (1) ist erfüllt. | [`02-has-lord-legal.ros`](rosters/02-has-lord-legal.ros) |


### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Force „Army of the Lichemaster (WD#309-UK)" | `f37a-a93e-fa22-61a8` |
| CategoryLink „Lord" | `7a76-8153-c4b2-9fee` |
| Constraint auf CategoryLink (min 1) | `760d-2352-9fac-0e46` |
| Auswahl „Master Necromancer" (als Lord-Beispiel) | `4ee2-ac3a-3cc6-11af` |
| Kategorie „Lord" (Ziel-Kategorie) | `d024-d25b-a9b4-73b6` |
