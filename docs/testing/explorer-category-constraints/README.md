# E2E-Regeln & Testkatalog: Kategorie-Grenzen am `categoryLink` eines Kontingents

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln, Constraint-IDs
und Erwartungswerte (`actual`/`bound`) sind **ausschliesslich aus den Katalogdaten** der
*6th Definitive Edition* **abgeleitet**.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst` (`0d13-7737-ea86-4662`, rev 1)
- Armee: `Orcs and goblins (6th definitive edition).cat` (`4049-c46d-7f80-44fb`, rev 1) —
  Force **„Savage Orc Horde (OG-AB)"** `59e1-efd7-af88-55a1`.

## Worum es geht

Ein `forceEntry` fuehrt seine Kategorien als `categoryLink`. So ein Link kann **eigene**
Grenzen tragen: sie gelten nur in dieser Armeeliste und zaehlen die Auswahlen, die zur
verlinkten Kategorie gehoeren.

Die Armeeliste „Savage Orc Horde" begrenzt so die Zahl der Goblin-Charaktere: ihr
`categoryLink` „Goblin Character" (`19ee-4dd1-e36d-6d70` → Kategorie
`6b1c-cce4-a402-a6e4`) traegt die Grenze `0298-fc5a-a995-cbae` mit Basiswert `-1`
(unbegrenzt), die ein bedingungsloser Modifikator am selben Link auf **2** setzt.

> **Achtung bei der Ableitung:** Diese Grenze haengt **nur** an dieser Armeeliste. Die
> Force „Mountain or Troll Country Waaagh!" (`a2fa-6a0e-8c17-373c`) fuehrt gar keinen
> `categoryLink` „Goblin Character" — ein Roster dieser Force kann die Grenze also nie
> ausloesen.

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **ECC-R1** | In der „Savage Orc Horde" duerfen hoechstens **2** Auswahlen der Kategorie „Goblin Character" im Kontingent stehen. Drei verletzen die Grenze (`actual: 3, bound: 2`). | `Orcs and goblins (…).cat` → `forceEntry 59e1-efd7-af88-55a1` → `categoryLink 19ee-4dd1-e36d-6d70` → `constraint id="0298-fc5a-a995-cbae" type="max" value="-1" field="selections" scope="parent"` **plus** `modifier type="set" value="2" field="0298-fc5a-a995-cbae"` (ohne Bedingung, greift immer). |

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/).

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators | Fixture |
|---|-----------|----------------|------------------------------------|---------|
| 01 | Drei Goblin-Charaktere (unzulaessig) | Force „Savage Orc Horde", Goblin Warboss (`40fd-b64c-e174-2a96`), Goblin Bigboss (`8c8f-3fba-e337-fd2f`) und Goblin Shaman (`554e-660d-0005-d122`), alle in der Kategorie „Goblin Character". | **Verletzung von ECC-R1:** `0298-fc5a-a995-cbae` feuert mit `actual: 3`, `bound: 2`. | [`01-exceeds-goblin-character-max.ros`](rosters/01-exceeds-goblin-character-max.ros) |

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Force „Savage Orc Horde (OG-AB)" | `59e1-efd7-af88-55a1` |
| CategoryLink „Goblin Character" (an dieser Force) | `19ee-4dd1-e36d-6d70` |
| Kategorie „Goblin Character" | `6b1c-cce4-a402-a6e4` |
| Grenze „max Goblin-Charaktere" | `0298-fc5a-a995-cbae` |
| SelectionEntry Goblin Warboss | `40fd-b64c-e174-2a96` |
| SelectionEntry Goblin Bigboss | `8c8f-3fba-e337-fd2f` |
| SelectionEntry Goblin Shaman | `554e-660d-0005-d122` |
