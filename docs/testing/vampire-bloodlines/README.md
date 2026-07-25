# E2E-Regeln & Testkatalog: Vampire Bloodlines (Vampire Counts)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Regeln aus den
Katalogdaten der *6th Definitive Edition* abgeleitet; das Eingabeformat der
Roster ist an einer **echten Beispiel-Datei** (`test.rosz`) verifiziert.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee: `Vampire Counts (6th definitive edition).cat`
  (`4d73-5ab0-9020-403c`, rev 1) — Force **„Standard"** `e989-15b8-7eb6-9668`

## Wie eine Bloodline im Roster gewählt wird (wichtig)

Anders als bei verlinkten Aufwertungen (Konvention `linkId::targetId`) werden
Bloodlines **direkt über die eigene `entryId`** gewählt, mit leerem
`entryLinkId`. Die „Bloodline of Clan X"-Einträge sind **inline-`selectionEntry`-
Kinder** der Gruppe „Vampiric Bloodline" — sie erscheinen daher **nie als
`targetId`** im Katalog, sind aber sehr wohl wählbar. Struktur:

```
selectionEntry "Bloodlines" (a56a-eb32-5a45-16fd)          ← Force-Selection
  └ selectionEntryGroup "Vampiric Bloodline" (5655-…)      max 1 (scope=parent)
       ├ "Bloodline of Clan Blood Dragon" (9fd9-…)
       ├ "Bloodline of Clan Lahmia"       (4f07-…)
       ├ "Bloodline of Clan Necrarch"     (5017-…)
       ├ "Bloodline of Clan Strigoi"      (ddfa-…)
       └ "Bloodline of Clan Von Carstein" (f557-…)
```

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **VBL-R1** | Eine Vampire-Counts-Armee muss **mindestens eine** „Bloodlines"-Selektion enthalten. | `selectionEntry "Bloodlines"` `a56a…` → constraint **`4a0a-b107-e726-da32`** `type=min value=1 field=selections scope=force`. |
| **VBL-R2** | Pro „Bloodlines"-Selektion darf **höchstens eine** Clan-Bloodline gewählt werden. | Gruppe `"Vampiric Bloodline"` `5655…` → constraint **`39c7-f615-17db-7016`** `type=max value=1 field=selections scope=parent`. |
| **VBL-R3** | Es gibt **keine** armee­weite Clan-Eindeutigkeit und **keine** erzwungene Übereinstimmung Charakter↔Armee-Clan. Die Clan-Zugehörigkeit steuert nur **Verfügbarkeit (`hidden`)** und **Namen** (z. B. „Vampire Count" → „Vampire Countess" bei Clan Lahmia). | Gruppe `5655…` hat **kein** force-scope-`max`; die Clan-Einträge haben nur `min=0` (No-op). Modifikatoren an Einheiten setzen `hidden`/`name`, keine zählende Schranke. **Nicht als harte Regel prüfbar.** |

**Hinweis zu VBL-R1 (Seeding):** `min`-Regeln feuern nur, wenn die betroffene
Definition im Kontingent instanziiert ist. Ob der Evaluator die Force-Untergrenze
auf einer Armee **ohne** „Bloodlines"-Selektion als Verletzung meldet, hängt vom
Seeding-Verhalten ab (dieselbe Feinheit wie bei den mandatorischen Phantom-
Einträgen in Issue 67). Test 02 pinnt genau das fest.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle referenzieren
`.gst` + Vampire-Counts-`.cat` (+ die per `catalogueLink` benötigte
`Mercenaries`-`.cat`). Format wie die verifizierte Beispiel-Datei
(direktes `entryId`, `entryLinkId=""`).

> **Assertion-Fokus:** nur die genannten Bloodline-Constraint-IDs. Andere
> Armeeaufbau-Diagnosen (General/Core-Pflicht, Punktelimit) können zusätzlich
> auftreten und sind hier ohne Belang.

| # | Testtitel | Betroffene Katalogdateien | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|---------------------------|----------------|-------------------------------------------------------|---------|
| 01 | Eine Bloodline (legal) | `.gst` + VC-`.cat` (+ Mercenaries) | „Bloodlines" mit **einer** Clan-Bloodline (Blood Dragon) + ein Vampire Count. | **Keine** Bloodline-Verletzung: Pflicht (≥1) erfüllt, Clan-Obergrenze (1) erfüllt. | [`01-bloodline-legal.ros`](rosters/01-bloodline-legal.ros) |
| 02 | Keine Bloodline (unzulässig) | wie 01 | Nur ein Vampire Count, **keine** „Bloodlines"-Selektion. | **Verletzung von VBL-R1:** die Force-Pflicht `4a0a…` (min 1) ist unerfüllt (Ist 0). *Siehe Seeding-Hinweis oben — der Test hält fest, ob die Engine dies meldet.* | [`02-missing-bloodline-illegal.ros`](rosters/02-missing-bloodline-illegal.ros) |
| 03 | Zwei Clan-Bloodlines in einer „Bloodlines" (unzulässig) | wie 01 | Eine „Bloodlines" mit **zwei** Clan-Bloodlines (Blood Dragon **und** Lahmia). | **Verletzung von VBL-R2:** die Clan-Obergrenze `39c7…` (max 1, scope=parent) schlägt an (Ist 2, Grenze 1). | [`03-two-clans-in-one-bloodlines-illegal.ros`](rosters/03-two-clans-in-one-bloodlines-illegal.ros) |

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Force „Standard" (VC) | `e989-15b8-7eb6-9668` |
| „Bloodlines" (Force-Selection, Pflicht min 1) | `a56a-eb32-5a45-16fd` — constraint `4a0a-b107-e726-da32` |
| Gruppe „Vampiric Bloodline" (max 1 Clan) | `5655-13ba-8980-bd1c` — constraint `39c7-f615-17db-7016` |
| Bloodline of Clan Blood Dragon | `9fd9-e05c-ffcb-2c4d` |
| Bloodline of Clan Lahmia | `4f07-e982-6665-70b7` |
| Bloodline of Clan Necrarch / Strigoi / Von Carstein | `5017-296d-edef-4562` / `ddfa-0d72-8557-6906` / `f557-097a-d26b-9363` |
| Vampire Count (Lord) | `6822-0110-a7c9-cbb0` |
