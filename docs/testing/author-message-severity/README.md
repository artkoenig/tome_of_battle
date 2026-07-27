# E2E-Regeln & Testkatalog: Autor-Meldungen des Katalogs (`error` / `warning` / `info`)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Regeln aus den
Katalogdaten der *6th Definitive Edition* abgeleitet; das Eingabeformat der
Roster ist an den bereits verifizierten Szenarien (`ogre-kingdoms`,
`vampire-bloodlines`, `explorer-modifier-constraints`) abgenommen —
direktes `entryId`, `entryLinkId=""`, verschachtelte `selections` mit `number`.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee (Standard-Dataset): `Ogre Kingdoms (6th definitive edition).cat`
  (`731d-5b13-2a92-5427`, rev 2) — Force **„Standard (OK-AB)"** `729f-9246-5cd3-5044`
  (+ die per `catalogueLink` `a067-78d5-50a2-affe` geforderte
  `Mercenaries`-`.cat` `fc47-8392-a6c8-452a`)
- Armee (Dataset-Override der Roster 06/07): `Vampire Counts (6th definitive edition).cat`
  (`4d73-5ab0-9020-403c`, rev 1) — Force **„Vampire Coast (WD#306-UK)"** `bf46-ee85-7c10-ba98`

## Worum es geht

Ein `modifier` mit `type="add"` und `field="error"` (bzw. `"warning"` / `"info"`)
ist **kein Wert-Modifikator**, sondern eine **Meldung des Katalog-Autors an den
Spieler**. Das Datenformat sagt das ausdrücklich
([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md), §7.7,
Abschnitt „`field="error"`/`"warning"`/`"info"` — Klartext-Hinweise an den
Spieler"): das `value`-Attribut trägt **den Nachrichtentext**, nicht einen Wert.
Die Spec benutzt als Beispiel genau den Modifikator, den die Tests 01–03 hier
festnageln.

Daraus folgen drei Aussagen, die dieses Szenario prüft:

1. **Bedingung hält → Meldung liegt an.** Am *tragenden Slot* (der `selection`,
   an deren Definition der Modifikator hängt) erscheint eine Meldung.
2. **Bedingung hält nicht → kein Eintrag.** An diesem Slot feuert *keine*
   Autor-Meldung. Das ist im Manifest als `"authorMessages": []` formuliert —
   eine **vollständige** Aussage über den Slot.
3. **Wortlaut und Schweregrad sind Katalogdaten.** Der Text ist der
   `value`-Inhalt **unverändert und in Katalogsprache** (hier Englisch); der
   Schweregrad ist der Name des `field` (`error` / `warning` / `info`).

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **AMS-R1** | **`error`, Bedingung hält.** Enthält das Kontingent **keine** Auswahl „Allow special characters?", trägt **Skrag the Slaughterer** die Meldung `Please enable "Allow special characters?"` mit Schweregrad **error**. | `Ogre Kingdoms .cat`, Z. 1049: `selectionEntry "Skrag the Slaughterer, Prohet of the Great Maw"` `82a9-0281-ffa1-2290` → `modifier type="add" field="error" value="Please enable &quot;Allow special characters?&quot;"` mit `condition type="lessThan" value="1" field="selections" scope="force" childId="8923-5946-7b10-8957" includeChildSelections="true"`. |
| **AMS-R2** | **`error`, Bedingung hält nicht.** Enthält dasselbe Kontingent die Auswahl **„Allow special characters?"** (`8923-5946-7b10-8957`), ist die Zählung 1 und `lessThan 1` falsch → an Skrags Slot **keine** Meldung. | Dieselbe `condition` wie AMS-R1. Die Auswahl selbst ist der `.gst`-Shared-Entry `8923-5946-7b10-8957` (Z. 1935, `type="upgrade"`), im Ogre-Katalog per Wurzel-`entryLink` `9e50-7486-65ab-c449` (Z. 3304) eingebunden und damit im Kontingent wählbar. |
| **AMS-R3** | **Meldung hängt am Slot, nicht am Kontingent.** Stehen **zwei** Träger derselben Meldung im selben Kontingent (Skrag **und** Greasus Goldtooth), trägt **jede** der beiden Auswahlen ihre eigene `error`-Meldung. | Zwei unabhängige, wortgleiche Modifikatoren: `82a9-0281-ffa1-2290` (Z. 1049) und `47f3-befb-e32e-0b4a` „Greasus Goldtooth, Overtyrant of the Ogre Kingdoms" (Z. 1077), beide mit derselben `condition` auf `8923-5946-7b10-8957`. |
| **AMS-R4** | **`warning`.** Ist **„Border Patrols rules"** im Roster, trägt der **Bruiser** die Meldung `For Ogre Kingdoms, the max` mit Schweregrad **warning**. Fehlt sie, feuert an diesem Slot nichts. | `Ogre Kingdoms .cat`, Z. 746: `selectionEntry "Bruiser"` `d097-a3de-898f-91c8` → `modifierGroup type="and"` (Z. 739) mit `condition type="atLeast" value="1" field="selections" scope="roster" childId="4e15-0353-165f-5528" includeChildSelections="true" includeChildForces="true"` → darin `modifier type="add" field="warning" value="For Ogre Kingdoms, the max"` (die Bedingung sitzt an der Gruppe, der Modifikator selbst trägt keine eigene). |
| **AMS-R5** | **`info`.** Ist **„Border Patrols rules"** im Kontingent, trägt der **Vampire Fleet Captain** die Meldung `Technically, Luthor Harkon, Arch Grand Commodore is mandatory. Since it would be illegal in Border Patrols, a house-rule allows to ignore it.` mit Schweregrad **info**. Fehlt sie, feuert an diesem Slot nichts. | `Vampire Counts .cat`, Z. 12815: `selectionEntry "Vampire Fleet Captain"` `cc50-6a0b-1c09-7d3e` → `modifier type="add" field="info"` mit `condition type="atLeast" value="1" field="selections" scope="force" childId="4e15-0353-165f-5528" includeChildSelections="true"`. |
| **AMS-R6** | **Wortlaut unverändert.** Der erwartete Text ist exakt der Inhalt des `value`-Attributs nach XML-Entity-Auflösung — inklusive der eingebetteten Anführungszeichen (`&quot;` → `"`) und inklusive des im Katalog offensichtlich abgeschnittenen Satzes „For Ogre Kingdoms, the max". Es wird **nicht** übersetzt, ergänzt oder umformuliert. | `value="Please enable &quot;Allow special characters?&quot;"` (Ogre Z. 1049/1077) bzw. `value="For Ogre Kingdoms, the max"` (Ogre Z. 746) bzw. der vollständige Satz in VC Z. 12815. |

### Warum diese Fälle — und welche bewusst nicht

- **Kein `{this}`.** Von den ~50 Meldungs-Modifikatoren der Fixtures enthalten
  einige das BattleScribe-Text-Token `{this}` (z. B. Ogre Z. 23
  „You cannot have more units of {this} than …", Mercenaries Z. 4784/4819). Die
  Auflösung dieses Tokens ist **nicht** Gegenstand dieses Szenarios; alle hier
  gewählten Fälle kommen **ohne** `{this}` aus, damit die Erwartung eindeutig ist.
- **Die Meldungen von „Border Patrols rules" selbst sind ausgeklammert.** Der
  `.gst`-Eintrag `4e15-0353-165f-5528` trägt seinerseits zwei `error`-Meldungen
  (Z. 17600 „The army must consist of at least TWO units but no more than FOUR
  units", Z. 17611 „You must include at least ONE infantry unit of 10+ models.").
  Deren Bedingungen zählen über `childId="unit"` (Typ-Schlüsselwort) bzw. über
  die per Modifikator vergebene Kategorie „BP Infantry 10+"
  (`6ad6-f54e-1867-00a7`) — beides eigene, bereits separat festgenagelte
  Fragestellungen (siehe [`../evaluator-bug-childid-model/`](../evaluator-bug-childid-model/README.md)).
  Über den Slot `4e15-…` trifft dieses Szenario deshalb **keine** Aussage; die
  `capabilities`-Aussage ist pro Slot vollständig, über Slots hinweg aber
  selektiv.
- **Autor-Meldungen sind keine zählenden Grenzen.** Ein
  `type="add" field="error"`-Modifikator hat **keine** Constraint-`id`, kein
  `value` als Zahl und kein `field="selections"`. Er kann daher gar nicht als
  feuernde Grenze mit `actual`/`bound` im Verletzungsbericht auftauchen — die
  Aussage gehört ausschließlich in `expect.capabilities.authorMessages`. Alle
  Roster dieses Szenarios haben deshalb `firing: []` und `absent: []`.
- **Nicht mit-behauptet: die Constraint-Modifikatoren an denselben Einheiten.**
  Skrag und Greasus tragen zusätzlich `constraint max 0 scope=force`
  (`2e16-3ee1-477f-acf5` bzw. `cef8-c3b1-7850-85bc`), die ein
  `modifier type="set" value="1"` auf **1** hebt — allerdings mit einer Bedingung
  auf die **`entryLink`-Id** `9e50-7486-65ab-c449` (Ogre Z. 1046/1074), während
  die Meldungs-Bedingung die **Ziel-Id** `8923-5946-7b10-8957` nennt. Diese
  Id-Modellierungsfrage ist ein eigenes Thema; das Szenario nennt diese
  Constraint-Ids weder in `firing` noch in `absent`.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Roster 01–05
laufen gegen `.gst` + Ogre-Kingdoms-`.cat` (+ Mercenaries), Roster 06–07 gegen
`.gst` + Vampire-Counts-`.cat` (+ Mercenaries) per **Roster-Dataset-Override**.

> **Assertion-Fokus:** ausschließlich `authorMessages` an den genannten Slots.
> Andere Armeeaufbau-Diagnosen (General-/Core-Pflicht, Punktelimit, die
> `max 0`-Grenzen der Sondercharaktere) treten zusätzlich auf und sind hier
> ohne Belang.

| # | Testtitel | Betroffene Katalogdateien | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|---------------------------|----------------|-------------------------------------------------------|---------|
| 01 | `error` feuert | `.gst` + Ogre-`.cat` (+ Mercenaries) | Kontingent „Standard (OK-AB)" mit **Skrag** (`82a9…`), **ohne** „Allow special characters?". | **AMS-R1:** An Skrags Slot liegt **genau eine** Meldung an: Schweregrad **error**, Text `Please enable "Allow special characters?"`. | [`01-skrag-error-fires.ros`](rosters/01-skrag-error-fires.ros) |
| 02 | `error` schweigt | wie 01 | Dasselbe Kontingent **plus** „Allow special characters?" (`8923…`). | **AMS-R2:** An Skrags Slot **keine** Meldung (`[]`). Auch der Slot „Allow special characters?" selbst bleibt leer — er trägt keinen Meldungs-Modifikator. | [`02-skrag-error-silent.ros`](rosters/02-skrag-error-silent.ros) |
| 03 | Zwei Träger, zwei Meldungen | wie 01 | **Skrag** *und* **Greasus Goldtooth** (`47f3…`), weiterhin ohne „Allow special characters?". | **AMS-R3:** **Beide** Slots tragen je **eine** `error`-Meldung mit demselben Wortlaut — die Meldung hängt am Slot, nicht am Kontingent. | [`03-two-carriers-error-fires.ros`](rosters/03-two-carriers-error-fires.ros) |
| 04 | `warning` feuert | wie 01 | Kontingent mit **Bruiser** (`d097…`) **und** „Border Patrols rules" (`4e15…`). | **AMS-R4:** An Bruisers Slot liegt **genau eine** Meldung an: Schweregrad **warning**, Text `For Ogre Kingdoms, the max` (unverändert, auch wenn der Satz im Katalog abbricht). | [`04-bruiser-warning-fires.ros`](rosters/04-bruiser-warning-fires.ros) |
| 05 | `warning` schweigt | wie 01 | Kontingent nur mit **Bruiser**, ohne „Border Patrols rules". | **AMS-R4 (Gegenprobe):** An Bruisers Slot **keine** Meldung (`[]`). | [`05-bruiser-warning-silent.ros`](rosters/05-bruiser-warning-silent.ros) |
| 06 | `info` feuert | `.gst` + VC-`.cat` (+ Mercenaries), **Dataset-Override** | Kontingent „Vampire Coast (WD#306-UK)" mit **Vampire Fleet Captain** (`cc50…`) **und** „Border Patrols rules". | **AMS-R5:** An Fleet Captains Slot liegt **genau eine** Meldung an: Schweregrad **info**, Text `Technically, Luthor Harkon, Arch Grand Commodore is mandatory. Since it would be illegal in Border Patrols, a house-rule allows to ignore it.` | [`06-fleet-captain-info-fires.ros`](rosters/06-fleet-captain-info-fires.ros) |
| 07 | `info` schweigt | wie 06 | Dasselbe Kontingent nur mit **Vampire Fleet Captain**. | **AMS-R5 (Gegenprobe):** An Fleet Captains Slot **keine** Meldung (`[]`). | [`07-fleet-captain-info-silent.ros`](rosters/07-fleet-captain-info-silent.ros) |

### Wie `actual`/`bound` hier zu lesen sind

Autor-Meldungen sind **keine** zählenden Grenzen, deshalb tragen alle Roster
`firing: []`. Was den Auslöser trägt, ist die **Bedingung** des Modifikators; die
folgende Tabelle hält die daraus abgeleitete Zählung fest — sie ist die
Begründung der Erwartung, nicht selbst eine Manifest-Assertion.

| Roster | Bedingung (aus den Katalogdaten) | Gezählt im Roster | Bedingung hält? | Erwartung am Slot |
|--------|----------------------------------|-------------------|-----------------|-------------------|
| 01 | `lessThan 1` `selections` `scope=force` `childId=8923-5946-7b10-8957` | 0 | ja (0 < 1) | 1× `error` |
| 02 | dieselbe | 1 | nein (1 ≮ 1) | `[]` |
| 03 | dieselbe, an zwei Definitionen | 0 | ja | je 1× `error` an `82a9…` und `47f3…` |
| 04 | `atLeast 1` `selections` `scope=roster` `childId=4e15-0353-165f-5528` | 1 | ja (1 ≥ 1) | 1× `warning` |
| 05 | dieselbe | 0 | nein (0 < 1) | `[]` |
| 06 | `atLeast 1` `selections` `scope=force` `childId=4e15-0353-165f-5528` | 1 | ja (1 ≥ 1) | 1× `info` |
| 07 | dieselbe | 0 | nein (0 < 1) | `[]` |

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Force „Standard (OK-AB)" (Ogre Kingdoms) | `729f-9246-5cd3-5044` |
| Force „Vampire Coast (WD#306-UK)" (Vampire Counts) | `bf46-ee85-7c10-ba98` |
| Skrag the Slaughterer (Träger `error`) | `82a9-0281-ffa1-2290` |
| Greasus Goldtooth (Träger `error`, zweiter Slot) | `47f3-befb-e32e-0b4a` |
| Bruiser (Träger `warning`) | `d097-a3de-898f-91c8` |
| Vampire Fleet Captain (Träger `info`) | `cc50-6a0b-1c09-7d3e` |
| „Allow special characters?" (`.gst`-Shared-Entry, Schalter für AMS-R1/R2) | `8923-5946-7b10-8957` |
| Wurzel-`entryLink` auf „Allow special characters?" im Ogre-Katalog | `9e50-7486-65ab-c449` |
| „Border Patrols rules" (`.gst`-Wurzel-Entry, Schalter für AMS-R4/R5) | `4e15-0353-165f-5528` |
| `catalogueLink` Ogre → Mercenaries | `a067-78d5-50a2-affe` → `fc47-8392-a6c8-452a` |
| Kategorie „Special Characters" / „Lord" / „Characters" | `0644-bfcd-32c2-21dc` / `d024-d25b-a9b4-73b6` / `7a1c-d611-c2dc-def1` |
| Kategorie „Heroes" / „Special list rules" / „Vampire" | `c16b-f319-2c62-2c12` / `32f1-197f-d719-a393` / `017d-3857-a815-782f` |
| Nicht mit-behauptet: `max 0`-Grenzen Skrag / Greasus | `2e16-3ee1-477f-acf5` / `cef8-c3b1-7850-85bc` |
| Nicht mit-behauptet: eigene `error`-Meldungen von „Border Patrols rules" | `.gst` Z. 17600 / Z. 17611 |
