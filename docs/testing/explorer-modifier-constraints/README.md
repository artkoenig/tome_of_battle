# E2E-Regeln & Testkatalog: Modifier Constraints (Orcs & Goblins - Grom & General)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln, Constraint-IDs und Erwartungswerte (`actual`/`bound`) sind **ausschliesslich aus den Katalogdaten** der *6th Definitive Edition* **abgeleitet**.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst` (`0d13-7737-ea86-4662`, rev 1)
- Armee: `Orcs and goblins (6th definitive edition).cat` (`4049-c46d-7f80-44fb`, rev 1) — Force **„Standard (OG-AB)"** `2bfa-e64a-7123-895f`.

## Wie Modifikatoren auf Constraints an EntryLinks wirken

Ein `entryLink` kann Modifikatoren (`modifier`) besitzen, die bei Erfüllung bestimmter Bedingungen (`conditions`) Constraint-Werte dynamisch verändern. 

In Orcs & Goblins setzt die Auswahl von **Grom the Paunch** (`1821-fbd1-0d96-2d88`) über die Condition am `entryLink` `"General"` (`a2d7-7a89-7059-81f2`) das `max`-Limit des Constraints `fc6d-21e4-3da5-17f9` für die General-Auswahl von 1 auf 0.

Wird zusätzlich ein Orc Warboss (`fde7-8ba8-08c8-7504`) mit der General-Aufwertung (`1b7c-2c90-6d96-28c9`) ausgewählt, so ist die Bedingung verletzt, da 1 General gewählt ist, die zugelassene Obergrenze jedoch 0 beträgt.

Ohne Grom the Paunch gilt das Standard-Limit von max 1 General in der Force (`fc6d-21e4-3da5-17f9`), welches bei 1 General erfüllt ist.

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **EMC-R1** | Ist Grom the Paunch in der Armee enthalten, verringert sich das Obergrenze-Limit für Generäle (`fc6d-21e4-3da5-17f9`) von 1 auf 0. Ein weiterer General führt zur Verletzung (`actual: 1, bound: 0`). | `Orcs and goblins (6th definitive edition).cat` → `entryLink "General"` `a2d7-7a89-7059-81f2` → `modifier type="set" value="0" field="fc6d-21e4-3da5-17f9"` mit Condition `instanceOf value="1" childId="1821-fbd1-0d96-2d88" scope="force"`. |
| **EMC-R2** | Ist Grom the Paunch NICHT in der Armee enthalten, bleibt das General-Limit auf 1. Genau ein General erfüllt die Bedingung (`actual: 1, bound: 1`) und das Limit feuert nicht. | `Warhammer Fantasy Battles (6th definitive edition).gst` → sharedSelectionEntry `"General"` `1b7c-2c90-6d96-28c9` → constraint **`fc6d-21e4-3da5-17f9`** `type="max" value="1" scope="force"`. |

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). 

| # | Testtitel | Betroffene Katalogdateien | Roster-Zustand | Erwartetes Ergebnis des Evaluators | Fixture |
|---|-----------|---------------------------|----------------|------------------------------------|---------|
| 01 | Grom plus General (unzulässig) | `.gst` + OG-`.cat` | Force "Standard", Grom the Paunch (`1821-fbd1-0d96-2d88`) UND Orc Warboss (`fde7-8ba8-08c8-7504`) mit General-Aufwertung (`1b7c-2c90-6d96-28c9`). | **Verletzung von EMC-R1:** Constraint `fc6d-21e4-3da5-17f9` (max 0) feuert mit actual: 1, bound: 0. | [`01-grom-plus-general-illegal.ros`](rosters/01-grom-plus-general-illegal.ros) |
| 02 | General ohne Grom (zulässig) | `.gst` + OG-`.cat` | Force "Standard", Orc Warboss (`fde7-8ba8-08c8-7504`) mit General-Aufwertung (`1b7c-2c90-6d96-28c9`), **kein** Grom the Paunch. | **Keine Verletzung:** Constraint `fc6d-21e4-3da5-17f9` (max 1) ist erfüllt (`absent`). | [`02-general-without-grom-legal.ros`](rosters/02-general-without-grom-legal.ros) |

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Force „Standard (OG-AB)" | `2bfa-e64a-7123-895f` |
| SelectionEntry Grom the Paunch | `1821-fbd1-0d96-2d88` |
| SelectionEntry Orc Warboss | `fde7-8ba8-08c8-7504` |
| EntryLink General | `a2d7-7a89-7059-81f2` |
| SharedSelectionEntry General | `1b7c-2c90-6d96-28c9` |
| Constraint General Max (Force) | `fc6d-21e4-3da5-17f9` |
