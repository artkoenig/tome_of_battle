# E2E-Regeln & Testkatalog: Modifikatoren auf Grenzen an einem `entryLink`

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln, Constraint-IDs
und Erwartungswerte (`actual`/`bound`) sind **ausschliesslich aus den Katalogdaten** der
*6th Definitive Edition* **abgeleitet**.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst` (`0d13-7737-ea86-4662`, rev 1)
- Armee: `Orcs and goblins (6th definitive edition).cat` (`4049-c46d-7f80-44fb`, rev 1)

## Worum es geht

Die Aufwertung „General" ist eine geteilte Definition des Spielsystems
(`1b7c-2c90-6d96-28c9`) und traegt dort die Grenze `fc6d-21e4-3da5-17f9`:
`max 1` mit `scope="force"` — **ein** General je Kontingent.

Jede Einheit, die General werden kann, bindet diese Aufwertung ueber einen eigenen
`entryLink` ein. Der Link des **Orc Great Shaman** (`aa57-63c4-136b-4af5`) traegt
zusaetzlich einen Modifikator: er setzt dieselbe Grenze auf **0**, wenn das Kontingent
die Armeeliste „Grimgor's 'Ardboyz" ist. In-world: bei Grimgor fuehrt Grimgor — der
Schamane darf nicht General sein.

Die Bedingung prueft das ueber die Kontingent-Definition selbst:
`instanceOf … scope="force" childId="1821-fbd1-0d96-2d88"`, und
`1821-fbd1-0d96-2d88` ist der **`forceEntry`** „Grimgor's 'Ardboyz (SoC)".

> **Achtung bei der Ableitung:** Der Modifikator haengt am **Link**, nicht an der
> geteilten Definition. Ein Roster muss die Aufwertung deshalb ueber den Verweis
> `a2d7-7a89-7059-81f2` beziehen. BattleScribe schreibt das in **zwei** Attribute
> derselben `<selection>`: `entryId="1b7c-2c90-6d96-28c9"` (das gewaehlte Ziel) und
> `entryLinkId="a2d7-7a89-7059-81f2"` (der Verweis, ueber den es hereinkam) — genau
> die Form, die beide Roster dieses Szenarios tragen. Kaeme die Auswahl **ohne**
> `entryLinkId` herein (direkt gewaehlt), griffe der Modifikator des Links nicht —
> dann waere der Test wirkungslos.

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **EMC-R1** | In der Armeeliste „Grimgor's 'Ardboyz" darf der Orc Great Shaman **nicht** General sein: die Grenze `fc6d-21e4-3da5-17f9` steht dort auf 0, ein gewaehlter General verletzt sie (`actual: 1, bound: 0`). | `Orcs and goblins (…).cat` → `selectionEntry aa57-63c4-136b-4af5` („Orc Great Shaman") → `entryLink a2d7-7a89-7059-81f2` („General") → `modifier type="set" value="0" field="fc6d-21e4-3da5-17f9"` mit `condition type="instanceOf" scope="force" childId="1821-fbd1-0d96-2d88"`. |
| **EMC-R2** | In jeder anderen Armeeliste gilt die Grundgrenze `max 1` je Kontingent. Genau ein General haelt sie ein — die Grenze feuert nicht. | `… .gst` → `sharedSelectionEntries` → `selectionEntry 1b7c-2c90-6d96-28c9` („General") → `constraint id="fc6d-21e4-3da5-17f9" type="max" value="1" field="selections" scope="force"`. |

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/).

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators | Fixture |
|---|-----------|----------------|------------------------------------|---------|
| 01 | Great Shaman als General bei Grimgor (unzulaessig) | Force „Grimgor's 'Ardboyz (SoC)" (`1821-fbd1-0d96-2d88`), ein Orc Great Shaman (`aa57-63c4-136b-4af5`) mit der General-Aufwertung ueber Link `a2d7-7a89-7059-81f2`. | **Verletzung von EMC-R1:** `fc6d-21e4-3da5-17f9` feuert mit `actual: 1`, `bound: 0`. | [`01-grimgor-shaman-as-general-illegal.ros`](rosters/01-grimgor-shaman-as-general-illegal.ros) |
| 02 | Derselbe General in der Standardliste (zulaessig) | Force „Standard (OG-AB)" (`2bfa-e64a-7123-895f`), sonst identisch. | **Keine Verletzung:** die Bedingung des Modifikators haelt nicht, `fc6d-21e4-3da5-17f9` bleibt bei `max 1` und ist mit einem General erfuellt (`absent`). | [`02-standard-shaman-as-general-legal.ros`](rosters/02-standard-shaman-as-general-legal.ros) |

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| ForceEntry „Grimgor's 'Ardboyz (SoC)" | `1821-fbd1-0d96-2d88` |
| ForceEntry „Standard (OG-AB)" | `2bfa-e64a-7123-895f` |
| SelectionEntry Orc Great Shaman | `aa57-63c4-136b-4af5` |
| EntryLink „General" am Orc Great Shaman | `a2d7-7a89-7059-81f2` |
| Geteilte Definition „General" (`.gst`) | `1b7c-2c90-6d96-28c9` |
| Grenze „max 1 General je Kontingent" | `fc6d-21e4-3da5-17f9` |
