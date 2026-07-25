# E2E-Regeln & Testkatalog: Vampire Counts (Spielsystem-Pflichten + Auflösung)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Regeln ausschließlich
aus den Katalogdaten der *6th Definitive Edition* abgeleitet; jede `limitId`,
jeder `actual`/`bound` und jede Diagnose ist aus der `.gst`/`.cat`-XML hergeleitet,
nicht aus einem Engine-Lauf.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (id `0d13-7737-ea86-4662`, rev 1)
- Armee: `Vampire Counts (6th definitive edition).cat` (id `4d73-5ab0-9020-403c`)
  — Force **„Standard (VC-AB)"** `e989-15b8-7eb6-9668`
- Abhängigkeit: `Mercenaries (6th definitive edition).cat` (id `fc47-8392-a6c8-452a`)

Geprüft werden die **im Spielsystem** definierten Pflichtregeln (für jede Armee
gleich) und die kataloguebergreifende Auflösung über Mercenaries.

> **Abgrenzung zum Bloodline-Szenario.** Dieses Szenario nutzt zwar denselben
> **Definitive**-VC-Katalog (`4d73…`) wie der Pilot
> [`../vampire-bloodlines/`](../vampire-bloodlines/README.md), pinnt aber **nicht**
> die Bloodline-Regeln, sondern die **spielsystemweiten** General-/Core-Pflichten
> und das **kataloguebergreifende** Auflösungsverhalten. Die Bloodline-Modellierung
> bleibt dem Pilot-Szenario vorbehalten.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **General-Pflicht** | Je Kontingent **min 1** Selektion der Kategorie „General". | `.gst` `categoryEntry "General"` `a37e-7207-de6d-acb0` → constraint **`1077-7379-f142-f382`** `type=min value=1 field=selections scope=force`. |
| **Core-Pflicht** | Je Kontingent **min 2** Selektionen der Kategorie „Core". | `.gst` `categoryEntry "Core"` `64bf-efb4-9978-26df` → constraint **`35c2-d478-392a-aeb1`** `type=min value=2 field=selections scope=force`. Basiswert 2; die Modifikatoren setzen die Grenze nur bei Border Patrols (→1) bzw. ab 2000 Pkt (→3/4/5). Ein leeres Roster ohne Punktelimit hält die Basis **2**. |
| **Kataloguebergreifende Auflösung** | Mit vollständiger Quelle lösen alle per `catalogueLink` importierten Definitionen auf. | VC-`.cat` `catalogueLink "Mercenaries"` `ef73-f9bd-e250-54d2` `targetId=fc47-8392-a6c8-452a`; keine `DANGLING_*`-Diagnose bei vollständiger Quelle (ADR-0032). |
| **Fehlende Abhängigkeit** | Fehlt die per `catalogueLink` deklarierte Mercenaries-`.cat`, ist das eine Diagnose (`MISSING_CATALOGUE_DEPENDENCY`); der nur darüber erreichbare „Pikemen"-`entryLink` baumelt (`DANGLING_ENTRY_LINK`). | VC-`.cat` `entryLink "Pikemen"` `ba89-72e4-0b78-71e2` `targetId=f7d8-66b4-21ee-00dd`; die Definition `f7d8…` liegt **nur** in `Mercenaries` (id `fc47-8392-a6c8-452a`). |

**Wie die Kategorien im Roster entstehen:** Die „General"-Aufwertung
`1b7c-2c90-6d96-28c9` (gst-shared) trägt einen `categoryLink` auf „General"
(`a37e…`) und erfüllt so die General-Pflicht. Reale Core-Einheiten der VC-`.cat`
tragen je einen primären `categoryLink` auf „Core" (`64bf…`): **Skeletons**
`9ac2-f4c1-bcc3-3aee` (`categoryLink c747-fa20-debf-8e62`) und **Zombies**
`749f-cf91-6317-7ac0` (`categoryLink ffc1-e185-5899-be4b`).

**Nicht im Verletzungsbericht (Domänen-Konvention, wie im Pilot):** Der
Verletzungsbericht kodiert nur **zählende Constraints** (General-/Core-Zählung)
sowie **strukturelle Diagnosen** (`MISSING_CATALOGUE_DEPENDENCY`,
`DANGLING_ENTRY_LINK`), **nicht** `hidden`/Profilwerte. Deshalb tauchen hier
ausschließlich die beiden `min`-Grenzen als feuernde Limits und die genannten
Diagnosen auf.

---

## Testkatalog (E2E-Szenarien)

> **Assertion-Fokus:** nur die genannten Grenz-/Diagnose-Ids. Andere
> Armeeaufbau-Diagnosen (z. B. Einheiten-Mindeststärken, Punktelimit) dürfen
> zusätzlich auftreten und sind hier ohne Belang. Das leere Roster
> `01-empty-force.ros` wird **zweimal** ausgewertet — einmal mit vollständiger
> Quelle, einmal (per Roster-`dataset`-Override) **ohne** Mercenaries.

| # | Roster-Zustand | Datensatz | Erwartetes Ergebnis (abgeleitet) | Fixture |
|---|----------------|-----------|-----------------------------------|---------|
| 01 | Leeres VC-Kontingent | gst + VC + Mercenaries | General (`1077…`, min 1) und Core (`35c2…`, min 2) feuern mit **Ist 0**; kein baumelnder Verweis, keine fehlende Abhängigkeit. | [`01-empty-force.ros`](rosters/01-empty-force.ros) |
| 02 | General-Aufwertung + zwei Core-Einheiten (Skeletons + Zombies) | gst + VC + Mercenaries | Regelkonforme Liste — **weder** `1077…` **noch** `35c2…` feuern (Ist 1 ≥ 1 bzw. Ist 2 ≥ 2). | [`02-general-and-two-core.ros`](rosters/02-general-and-two-core.ros) |
| 03 | Dasselbe leere Kontingent | gst + VC *(ohne Mercenaries)* | `MISSING_CATALOGUE_DEPENDENCY` auf Mercenaries-Katalog `fc47…`; der „Pikemen"-Verweis `f7d8…` baumelt (`DANGLING_ENTRY_LINK`) — Hinweis, kein Absturz. | [`01-empty-force.ros`](rosters/01-empty-force.ros) |

**Herleitung der Zahlen (aus den Daten, nicht aus einem Engine-Lauf):**
- **01:** Force `e989…` ohne Selektionen → 0 Selektionen mit Kategorie „General"
  und 0 mit Kategorie „Core". `1077…` (min 1) feuert mit Ist 0 / Grenze 1;
  `35c2…` (min 2) feuert mit Ist 0 / Grenze 2.
- **02:** 1× General-Aufwertung → 1 General-Selektion (≥ 1); Skeletons + Zombies
  → 2 Core-Selektionen (≥ 2). Beide `min`-Grenzen sind erfüllt und dürfen
  **nicht** feuern.
- **03:** Ohne die Mercenaries-Quelle bleibt der VC-eigene `catalogueLink`-Ziel­
  katalog `fc47…` ungelöst → `MISSING_CATALOGUE_DEPENDENCY`; der VC-eigene
  `entryLink "Pikemen"` (`ba89…`) zeigt auf die nur dort definierte `f7d8…` →
  `DANGLING_ENTRY_LINK`. Das leere Roster reicht, weil der baumelnde Verweis aus
  dem **Katalog** stammt, nicht aus einer Roster-Selektion.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Force „Standard (VC-AB)" | `e989-15b8-7eb6-9668` |
| Kategorie „General" / constraint min 1 (scope=force) | `a37e-7207-de6d-acb0` / `1077-7379-f142-f382` |
| Kategorie „Core" / constraint min 2 (scope=force) | `64bf-efb4-9978-26df` / `35c2-d478-392a-aeb1` |
| „General"-Aufwertung (gst-shared, categoryLink General) | `1b7c-2c90-6d96-28c9` |
| Core-Einheit Skeletons / Zombies (je categoryLink Core) | `9ac2-f4c1-bcc3-3aee` / `749f-cf91-6317-7ac0` |
| VC-`catalogueLink` → Mercenaries-Katalog | `ef73-f9bd-e250-54d2` → `fc47-8392-a6c8-452a` |
| VC-`entryLink "Pikemen"` → nur in Mercenaries definierte Einheit | `ba89-72e4-0b78-71e2` → `f7d8-66b4-21ee-00dd` |
