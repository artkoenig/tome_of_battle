# E2E-Regeln & Testkatalog: Orcs and Goblins (Spielsystem-Pflichten + Auflösung)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln sind
**aus den Katalogdaten** der *6th Definitive Edition* abgeleitet — nicht aus einem
Engine-Lauf. Das Roster-Eingabeformat folgt der in bestehenden Szenarien
verifizierten Form (direktes `entryId`, leeres `entryLinkId`).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (id `0d13-7737-ea86-4662`, rev 1)
- Armee: `Orcs and goblins (6th definitive edition).cat` — Force **„Standard (OG-AB)"**
  `2bfa-e64a-7123-895f`
- Abhängigkeit: `Mercenaries (6th definitive edition).cat` (id `fc47-8392-a6c8-452a`),
  per `catalogueLink` aus der O&G-`.cat` deklariert.

Manifest-getriebene Neufassung: geprüft werden die **im Spielsystem** (`.gst`)
definierten Pflichtregeln — für jede Armee gleich — sowie die kataloguebergreifende
Auflösung über den Mercenaries-Katalog.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **OG-R1** | Je Kontingent **min 1** Selektion der Kategorie „General". | `.gst` `categoryEntry` „General" `a37e-7207-de6d-acb0` → constraint **`1077-7379-f142-f382`** `type=min value=1 field=selections scope=force`. |
| **OG-R2** | Je Kontingent **min 2** Selektionen der Kategorie „Core". | `.gst` `categoryEntry` „Core" `64bf-efb4-9978-26df` → constraint **`35c2-d478-392a-aeb1`** `type=min value=2 field=selections scope=force`. (Ein Modifier senkt den Wert auf 1 nur bei vorhandener „Border Patrols rules"-Selektion `4e15-0353-165f-5528` — in keinem Roster vorhanden, Grenze bleibt 2.) |
| **OG-R3** | **Kataloguebergreifende Auflösung:** mit vollständiger Quelle (inkl. Mercenaries) lösen alle per `catalogueLink`/`entryLink` importierten Verweise auf — kein baumelnder Verweis, keine fehlende Abhängigkeit. | O&G-`.cat` `catalogueLink` „Mercenaries" `targetId=fc47-8392-a6c8-452a`; `entryLink` „Pikemen" `targetId=f7d8-66b4-21ee-00dd` löst gegen den Mercenaries-Eintrag auf. |
| **OG-R4** | **Fehlende Abhängigkeit:** wird **ohne** die Mercenaries-`.cat` ausgewertet, meldet der Auswerter die deklarierte Mercenaries-Abhängigkeit als fehlend (`MISSING_CATALOGUE_DEPENDENCY`); der nur darüber erreichbare „Pikemen"-`entryLink` baumelt (`DANGLING_ENTRY_LINK`) — ein Hinweis, kein Absturz. | O&G-`.cat` `catalogueLink` `targetId=fc47-8392-a6c8-452a`; „Pikemen"-`entryLink` `id=83dd-e495-0501-f785 targetId=f7d8-66b4-21ee-00dd` — Ziel `f7d8…` existiert **nur** in Mercenaries (`selectionEntry` „Pikemen", `type=unit`). |

**Konvention (aus dem Pilot-Szenario, nicht aus Engine-Code):** Der
Verletzungsbericht kodiert **nur zählende Constraints** (Grenzen) und **strukturelle
Diagnosen** (fehlende Abhängigkeit, baumelnde/ungelöste Verweise) — **nicht**
`hidden`/Sichtbarkeit oder Profilwerte.

### Verwendete reale Einträge

- **General-Aufwertung** `1b7c-2c90-6d96-28c9` (gst-shared, `import="true"`): trägt
  `categoryLink` → „General" `a37e-7207-de6d-acb0`, erfüllt OG-R1.
- **Orc Boyz** `ac23-b9d3-4046-23b7` (`type=unit`): `categoryLink` → „Core"
  `64bf-efb4-9978-26df` (`primary=true`).
- **Orc Arrer Boyz** `bc74-bb63-2abd-4e0b` (`type=unit`): `categoryLink` → „Core"
  `64bf-efb4-9978-26df` (`primary=true`).

Ein leeres Kontingent liefert daher General-Ist **0** (Grenze 1) und Core-Ist **0**
(Grenze 2); ein General plus zwei Core-Einheiten liefert General-Ist **1** und
Core-Ist **2** — beide Pflichten erfüllt.

---

## Testkatalog (E2E-Szenarien)

> **Assertion-Fokus:** nur die genannten Grenz-/Diagnose-Ids. Das Manifest
> [`scenario.json`](scenario.json) pinnt die verifizierten Werte. Das leere Roster
> `01-empty-force.ros` wird **zweimal** ausgewertet — einmal mit vollständiger
> Quelle, einmal (per Roster-`dataset`-Override) **ohne** Mercenaries.

| # | Roster-Zustand | Datensatz | Erwartetes Ergebnis (aus Katalogdaten abgeleitet) | Fixture |
|---|----------------|-----------|--------------------------------------------------|---------|
| 01 | Leeres O&G-Kontingent | gst + O&G + Mercenaries | **OG-R1** feuert: `1077-7379-f142-f382` (Ist 0, Grenze 1). **OG-R2** feuert: `35c2-d478-392a-aeb1` (Ist 0, Grenze 2). **OG-R3:** kein baumelnder Verweis, keine fehlende Abhängigkeit. | [`01-empty-force.ros`](rosters/01-empty-force.ros) |
| 02 | General-Aufwertung + zwei Core-Einheiten | gst + O&G + Mercenaries | Regelkonform: **weder** OG-R1 **noch** OG-R2 feuert (General-Ist 1, Core-Ist 2). | [`02-general-and-two-core.ros`](rosters/02-general-and-two-core.ros) |
| 03 | Dasselbe leere Kontingent | gst + O&G *(ohne Mercenaries)* | **OG-R4:** `MISSING_CATALOGUE_DEPENDENCY` auf `fc47-8392-a6c8-452a`; „Pikemen"-Verweis `DANGLING_ENTRY_LINK` auf `f7d8-66b4-21ee-00dd` — Hinweis, kein Absturz. | [`01-empty-force.ros`](rosters/01-empty-force.ros) |

*Fall 03 ist selektiv auf die Diagnosen fokussiert (die Grenzen OG-R1/OG-R2 feuern
gegen die reduzierte Quelle zwar ebenfalls, werden hier aber bewusst nicht
zusätzlich asseriert).*

### Nicht als feuernde Grenze erwartet

`hidden`/Sichtbarkeit und Profilwerte kommen in diesem Szenario nicht als Regeln
vor; die geprüften Punkte sind ausschließlich **zählende** Kategorie-Constraints
(OG-R1/R2) und **strukturelle Diagnosen** (OG-R3/R4). Die Diagnose-Arten
(`MISSING_CATALOGUE_DEPENDENCY`, `DANGLING_ENTRY_LINK`) sind Schlüssel der
SSOT-Aufzählung `DiagnosticKind`, wie im Runner-Vertrag dokumentiert.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Spielsystem (gst) | `0d13-7737-ea86-4662` |
| Force „Standard (OG-AB)" | `2bfa-e64a-7123-895f` |
| Kategorie „General" / constraint min 1 (force) | `a37e-7207-de6d-acb0` / `1077-7379-f142-f382` |
| Kategorie „Core" / constraint min 2 (force) | `64bf-efb4-9978-26df` / `35c2-d478-392a-aeb1` |
| „General"-Aufwertung (gst-shared) | `1b7c-2c90-6d96-28c9` |
| Core-Einheiten (Orc Boyz / Orc Arrer Boyz) | `ac23-b9d3-4046-23b7` / `bc74-bb63-2abd-4e0b` |
| `catalogueLink` → Mercenaries-Katalog | `b066-2f8e-11ee-1dce` → `fc47-8392-a6c8-452a` |
| „Pikemen"-`entryLink` / Ziel (nur in Mercenaries) | `83dd-e495-0501-f785` / `f7d8-66b4-21ee-00dd` |
