# E2E-Regeln & Testkatalog: Ogre Kingdoms (reale Domänen-Regeln)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln und alle
erwarteten Ist/Grenze-Werte unten sind **ausschließlich aus den Katalogdaten** der
*6th Definitive Edition* **abgeleitet** — aus den `.gst`/`.cat`-XML, die auch die
Reinraum-Engine (`src/contexts/ruleengine/engine/`) als E2E-Fixtures nutzt. Sie stammen **nicht** aus
einem Engine-Lauf; die Autorenschaft ist blind gegenüber dem Auswerter.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (id `0d13-7737-ea86-4662`, rev 1)
- Armee: `Ogre Kingdoms (6th definitive edition).cat` (id `731d-5b13-2a92-5427`) —
  Force **„Standard (OK-AB)"** `729f-9246-5cd3-5044`
- Abhängigkeit: `Mercenaries (6th definitive edition).cat` (id `fc47-8392-a6c8-452a`,
  `library="true"`, per `catalogueLink` `a067-78d5-50a2-affe` gefordert)

Dieses Szenario ist die manifest-getriebene Neufassung der früheren
programmatischen Suite `e2e.ogreKingdoms.test.js` (Issue 67, ADR-0032): dieselben
Domänen-Regeln, jetzt als `.ros`-Fixtures + Manifest statt als im Testcode
aufgebaute Roster.

## Wie Selektionen im Roster gewählt werden (wichtig)

Alle Selektionen stehen **direkt über die eigene `entryId`** mit leerem
`entryLinkId=""` im Roster (kein zusammengesetzter `linkId::targetId`). Die
Pflicht-Kategorien „General" und „Core" werden nicht als eigene Selektion gewählt,
sondern **über die Kategorie-Zugehörigkeit** der gelegten Einheiten erfüllt:

```
force "Standard (OK-AB)" (729f-9246-5cd3-5044)
  ├ "General" (1b7c-2c90-6d96-28c9, gst-shared upgrade)  → categoryLink → Kategorie "General" (a37e-…)
  ├ "Gnoblars" (1e26-0d1a-bb3c-f47a)                       → categoryLink primary → Kategorie "Core" (64bf-…)
  ├ "Gnoblar Trappers" (041b-7d95-6ff9-754a)              → categoryLink primary → Kategorie "Core" (64bf-…)
  ├ "Tyrant" (2679-58f4-1771-662d)                         → constraint max 1 (scope=roster)
  └ "Border Patrols rules" (4e15-0353-165f-5528, gst-shared upgrade, hidden)
```

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **OK-R1 (General-Pflicht)** | Je Kontingent **min 1** Selektion der Kategorie „General". | `.gst` Kategorie „General" `a37e-7207-de6d-acb0` → constraint **`1077-7379-f142-f382`** `type=min value=1 field=selections scope=force`. |
| **OK-R2 (Core-Pflicht)** | Je Kontingent **min 2** Selektionen der Kategorie „Core". | `.gst` Kategorie „Core" `64bf-efb4-9978-26df` → constraint **`35c2-d478-392a-aeb1`** `type=min value=2 field=selections scope=force`. |
| **OK-R3 (Core-Ausnahme, bedingt)** | Liegt **„Border Patrols rules"** (`4e15-0353-165f-5528`) im Roster, senkt ein `set→1`-Modifikator die effektive Core-Untergrenze auf **1**. | `.gst`, an der Core-Kategorie: `modifier type="set" value="1" field="35c2-d478-392a-aeb1"` mit `condition type="atLeast" value="1" … childId="4e15-0353-165f-5528" scope="roster"`. |
| **OK-R4 (Tyrant-Obergrenze)** | **Max 1** Tyrant im Roster. | Ogre-`.cat` „Tyrant" `2679-58f4-1771-662d` → constraint **`cb1c-3389-8f55-d6c6`** `type=max value=1 field=selections scope=roster`. |
| **OK-R5 (§7.7, ADR-0029)** | Ein **Kategorie-Ziel** zählt **armeeweit** über alle Kontingente, auch unter `scope="force"`: je Kontingent ein Phantom-Anker, jeder sieht dieselbe Armeesumme. | General/Core-Constraints sind `scope="force"`, ihr Anker ist eine **Kategorie** (`a37e…` / `64bf…`). Abgeleitet aus Skopus + Ankertyp. |
| **OK-R6 (Kataloguebergreifende Aufloesung)** | Bei vollständiger Quelle lösen alle per `catalogueLink`/`entryLink`/`infoLink` importierten Definitionen auf — **kein** baumelnder Verweis, **keine** fehlende Abhängigkeit. Fehlt die per `catalogueLink` geforderte Mercenaries-Bibliothek, meldet der Auswerter die fehlende Abhängigkeit. | Ogre-`.cat` `catalogueLink` `a067-78d5-50a2-affe` `targetId="fc47-8392-a6c8-452a"` (Mercenaries, `library="true"`). Diagnose-Arten: `MISSING_CATALOGUE_DEPENDENCY`, `DANGLING_ENTRY_LINK`, `DANGLING_INFO_LINK`. |
| **OK-R7 (Unauflösbare Auswahl)** | Eine Roster-Selektion ohne Definition im Katalog wird als **Diagnose** gemeldet, **nicht** als Absturz; der Bericht bleibt vollständig. | Roster-`entryId="ffff-ffff-ffff-ffff"` existiert in keinem Katalog → Diagnose-Art `UNRESOLVED_DEFINITION`. |

**Verwendete Bausteine der Roster:** Die „General"-Aufwertung
`1b7c-2c90-6d96-28c9` (gst-weiter `sharedSelectionEntry`, `type="upgrade"` mit
`categoryLink` `b6a9-…` auf Kategorie „General") erfüllt einmal ins Roster gelegt
die General-Pflicht. Die zwei realen Core-Einheiten sind **Gnoblars**
`1e26-0d1a-bb3c-f47a` und **Gnoblar Trappers** `041b-7d95-6ff9-754a`, beide mit
`categoryLink … targetId="64bf-efb4-9978-26df" primary="true"` (Core).

**Hinweis zum Verletzungsbericht (Konvention der Pilot-Suite):** Der
Verletzungsbericht des Auswerters kodiert **zählende** Constraints (min/max auf
`selections`/Kategorien) und **strukturelle Diagnosen** (fehlende
Katalog-Abhängigkeit, unaufgelöste/baumelnde Verweise). Er kodiert **keine**
Verfügbarkeit (`hidden`) und **keine** Profilwerte. Border Patrols schaltet daneben
auch zahlreiche `hidden`-Modifikatoren (z. B. die Einträge, die dann verborgen
werden) — diese Verfügbarkeits-Effekte sind **bewusst nicht** Teil der Erwartung.
Gepinnt werden nur die zählenden Grenzen (OK-R1…R5) und die strukturellen Diagnosen
(OK-R6/R7).

---

## Testkatalog (E2E-Szenarien)

> **Assertion-Fokus:** nur die genannten Grenz-/Diagnose-Ids. Andere Diagnosen
> (Punktelimit, weitere Pflichtregeln, weitere Diagnose-Arten) können zusätzlich
> auftreten und sind ohne Belang. Das Manifest [`scenario.json`](scenario.json)
> pinnt die aus den Katalogdaten abgeleiteten Ist/Grenze-Werte.

| # | Datensatz | Roster-Zustand | Erwartetes Ergebnis (aus Katalogdaten abgeleitet) | Fixture |
|---|-----------|----------------|----------------------------------------------------|---------|
| 01 | voll (gst + Ogre + Mercenaries) | Leeres Ogre-Kontingent | General (min 1) und Core (min 2) feuern mit Ist 0. Keine fehlende Abhängigkeit, kein baumelnder Verweis (Auflösung vollständig). | [`01-empty-force.ros`](rosters/01-empty-force.ros) |
| 01b | **Override: OHNE Mercenaries** (gst + Ogre) | Dasselbe leere Kontingent | Gegenprobe zu OK-R6: die per `catalogueLink` geforderte Mercenaries-Bibliothek fehlt → Diagnose `MISSING_CATALOGUE_DEPENDENCY`. | [`01-empty-force.ros`](rosters/01-empty-force.ros) (roster-eigener `dataset`-Override) |
| 02 | voll | General + zwei Core-Einheiten | Beide Pflichten erfüllt — keine General-/Core-Verletzung. | [`02-general-and-two-core.ros`](rosters/02-general-and-two-core.ros) |
| 03 | voll | General + eine Core-Einheit, ohne Border Patrols | Core feuert (Ist 1, Grenze 2) — eine Einheit reicht nicht. | [`03-one-core-no-border-patrols.ros`](rosters/03-one-core-no-border-patrols.ros) |
| 04 | voll | General + eine Core-Einheit + Border Patrols rules | Die gesenkte Grenze (1) ist erfüllt — keine Core-Verletzung. | [`04-one-core-with-border-patrols.ros`](rosters/04-one-core-with-border-patrols.ros) |
| 05 | voll | Nur Border Patrols rules | Core feuert mit **Grenze 1** (statt 2) bei Ist 0 — sichtbarer Beleg der gesenkten Grenze (OK-R3). | [`05-border-patrols-only.ros`](rosters/05-border-patrols-only.ros) |
| 06 | voll | Zwei Tyrants | Tyrant-Obergrenze `cb1c…` feuert an beiden Ankern (Ist 2, Grenze 1; `count=2`). | [`06-two-tyrants.ros`](rosters/06-two-tyrants.ros) |
| 07 | voll | Ein Tyrant | Obergrenze eingehalten — keine Tyrant-Verletzung. | [`07-one-tyrant.ros`](rosters/07-one-tyrant.ros) |
| 08 | voll | Zwei leere Kontingente | §7.7 (OK-R5): General und Core feuern **je zweimal** (`count=2`, ein Phantom-Anker je Kontingent, Ist 0). | [`08-two-empty-forces.ros`](rosters/08-two-empty-forces.ros) |
| 09 | voll | Ein Kontingent bestückt, ein zweites leer | §7.7 (OK-R5): die Kategorie zählt armeeweit — die Pflicht ist erfüllt, auch das leere Geschwister verletzt nicht. | [`09-one-force-satisfied-one-empty.ros`](rosters/09-one-force-satisfied-one-empty.ros) |
| 10 | voll | Auswahl mit unbekannter Kennung (`ffff-ffff-ffff-ffff`) | Diagnose `UNRESOLVED_DEFINITION` (OK-R7) — kein Absturz, Bericht bleibt vollständig. | [`10-unresolved-selection.ros`](rosters/10-unresolved-selection.ros) |

*(01 und 01b nutzen dieselbe Fixture-Datei; 01b überschreibt das Szenario-`dataset`
per roster-eigenem `dataset`-Feld und lässt die Mercenaries-Bibliothek weg. So wird
OK-R6 durch Kontrast — vorhanden vs. fehlend — belegt.)*

### Roster → Erwartung (Grenzen / Diagnosen)

| Fixture | firing (limitId → Ist/Grenze) | absent | diagnostics |
|---------|-------------------------------|--------|-------------|
| 01 | `1077-…` 0/1 · `35c2-…` 0/2 | — | absent: `DANGLING_ENTRY_LINK`, `DANGLING_INFO_LINK`, `MISSING_CATALOGUE_DEPENDENCY` |
| 01b (ohne Mercenaries) | — | — | present: `MISSING_CATALOGUE_DEPENDENCY` |
| 02 | — | `1077-…`, `35c2-…` | — |
| 03 | `35c2-…` 1/2 | — | — |
| 04 | — | `35c2-…` | — |
| 05 | `35c2-…` 0/1 | — | — |
| 06 | `cb1c-…` 2/1 (count 2) | — | — |
| 07 | — | `cb1c-…` | — |
| 08 | `1077-…` 0/1 (count 2) · `35c2-…` 0/2 (count 2) | — | — |
| 09 | — | `1077-…`, `35c2-…` | — |
| 10 | — | — | present: `UNRESOLVED_DEFINITION` (defId `ffff-ffff-ffff-ffff`) |

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Force „Standard (OK-AB)" | `729f-9246-5cd3-5044` |
| Kategorie „General" / constraint min 1 (scope=force) | `a37e-7207-de6d-acb0` / `1077-7379-f142-f382` |
| Kategorie „Core" / constraint min 2 (scope=force) | `64bf-efb4-9978-26df` / `35c2-d478-392a-aeb1` |
| „General"-Aufwertung (gst-shared, categoryLink → General) | `1b7c-2c90-6d96-28c9` |
| Core-Einheiten (Gnoblars / Gnoblar Trappers, primary=Core) | `1e26-0d1a-bb3c-f47a` / `041b-7d95-6ff9-754a` |
| „Border Patrols rules" (gst-shared upgrade, hidden) | `4e15-0353-165f-5528` |
| set→1-Modifikator auf Core-Grenze (bedingt auf Border Patrols) | `modifier set value=1 field="35c2-d478-392a-aeb1"` |
| Tyrant / constraint max 1 (scope=roster) | `2679-58f4-1771-662d` / `cb1c-3389-8f55-d6c6` |
| catalogueLink Ogre → Mercenaries | `a067-78d5-50a2-affe` → `fc47-8392-a6c8-452a` |
| Unbekannte Kennung (kein Katalog-Element) | `ffff-ffff-ffff-ffff` |
