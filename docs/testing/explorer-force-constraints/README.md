# E2E-Regeln & Testkatalog: Force Constraints (Ogre Kingdoms Special Limit)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Regeln aus den Katalogdaten der *6th Definitive Edition* abgeleitet.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst` (`0d13-7737-ea86-4662`, rev 1)
- Kataloge:
  - `Ogre Kingdoms (6th definitive edition).cat` (`731d-5b13-2a92-5427`, rev 2) — Force **„Standard (OK-AB)"** `729f-9246-5cd3-5044`
  - `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`, rev 1)

## Auswertung von Force Constraints auf Kategorie-Ebene

Ein `forceEntry` stellt das Haupt-Kontingent einer Armee dar. Über die im Spielsystem definierten Kategorie-Bedingungen (`categoryEntry`) werden Beschränkungen (z. B. maximale Anzahl von Auswahlen einer Kategorie pro Force) für das Kontingent durchgesetzt.

In der Kategorie „Special" (`43cc-fc3f-35a7-8d03`) definiert das Spielsystem einen `max`-Constraint mit ID `16f0-6e5b-55d0-4102` (`value="3"`, `field="selections"`, `scope="force"`). Jede Einheit mit der Primärkategorie „Special" (wie „Yhetees" `9cb5-fe07-22d4-22de`) zählt als 1 Auswahl gegen dieses Force-Limit.

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **FC-R1** | Ein Ogre Kingdoms Kontingent ("Standard (OK-AB)") darf maximal **3 Auswahlen** der Kategorie "Special" enthalten. | `Warhammer Fantasy Battles (6th definitive edition).gst` → `categoryEntry "Special"` `43cc-fc3f-35a7-8d03` → constraint **`16f0-6e5b-55d0-4102`** `type=max value=3 field=selections scope=force`. |

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). 

| # | Testtitel | Betroffene Katalogdateien | Roster-Zustand | Erwartetes Ergebnis des Evaluators | Fixture |
|---|-----------|---------------------------|----------------|------------------------------------|---------|
| 01 | 4 Special-Einheiten (unzulässig) | `.gst` + OK-`.cat` + Mercenaries-`.cat` | Force „Standard (OK-AB)" mit 1 Tyrant, 2 Ogre Bulls (ueber ihren `entryLink`) und **4 Yhetees** (Kategorie Special). | **Verletzung von FC-R1:** Constraint `16f0-6e5b-55d0-4102` (max 3) feuert mit `actual: 4`, `bound: 3`. | [`01-four-special-illegal.ros`](rosters/01-four-special-illegal.ros) |
| 02 | 3 Special-Einheiten (legal) | wie 01 | Force „Standard (OK-AB)" mit 1 Tyrant, 2 Ogre Bulls (ueber ihren `entryLink`) und **3 Yhetees** (Kategorie Special). | **Keine** Verletzung von FC-R1: Constraint `16f0-6e5b-55d0-4102` (max 3) darf NICHT feuern. | [`02-three-special-legal.ros`](rosters/02-three-special-legal.ros) |


### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Spielsystem | `0d13-7737-ea86-4662` |
| Force „Standard (OK-AB)" | `729f-9246-5cd3-5044` |
| Kategorie „Special" | `43cc-fc3f-35a7-8d03` |
| Constraint max 3 Special (scope=force) | `16f0-6e5b-55d0-4102` |
| Selection „Tyrant" | `2679-58f4-1771-662d` |
| EntryLink „Ogre Bulls" (Ziel: geteilter Eintrag `7754-8b3d-df99-d2d5`) | `d82e-111e-89b9-2be1` |
| Selection „Yhetees" | `9cb5-fe07-22d4-22de` |
