# E2E-Regeln & Testkatalog: Eintragsart eines verlinkten Vorkommens

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln sind
**aus den Katalogdaten** der *6th Definitive Edition*, aus
[`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md) und aus
dem mitgelieferten Schema [`Catalogue.xsd`](../../../src/parser/schema/Catalogue.xsd)
abgeleitet — nicht aus einem Engine-Lauf. Das Roster-Eingabeformat folgt der in
bestehenden Szenarien verifizierten Form (`entryId` = gewaehltes **Ziel**,
`entryLinkId` = **Verweis** bzw. `""` bei direkter Wahl, verschachtelte
`selections` mit `number`) — vgl.
[`author-message-tokens/rosters/02-gnoblars-token-silent.ros`](../author-message-tokens/rosters/02-gnoblars-token-silent.ros).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee: `Ogre Kingdoms (6th definitive edition).cat`
  (`731d-5b13-2a92-5427`, rev 2) — Force **„Standard (OK-AB)"** `729f-9246-5cd3-5044`
- Zusatzkatalog: `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`) —
  zwingend, weil die Ogre-`.cat` ihn per `<catalogueLink id="a067-78d5-50a2-affe">`
  (Z. 3087) einbindet und die verlinkten Einheiten dieses Szenarios **dort**
  definiert sind.

---

## Worum es geht: Eintragsart vs. Verweisart

Eine Bedingung kann statt einer Ziel-Id ein **Typ-Keyword** zaehlen. Der
Datenformat-Leitfaden nennt die drei Schluesselwoerter ausdruecklich:

> `childId` — *Was* gezaehlt wird: eine Ziel-ID, ein Typ-Keyword (`model`, `unit`,
> `upgrade`) oder `any`.
> — [`battlescribe-data-format.md`, §7.7](../../battlescribe-data-format.md), Z. 708

Diese drei Keywords sind exakt die Wertemenge von `selectionEntry/@type`
(`SelectionEntryKind`, `Catalogue.xsd` Z. 307–313). Ein `entryLink` traegt zwar
ebenfalls ein `type`-Attribut, aber aus einer **anderen, disjunkten** Wertemenge
(`EntryLinkKind` = `selectionEntry` | `selectionEntryGroup`, `Catalogue.xsd`
Z. 414–419): es sagt, **worauf** der Verweis zeigt, nicht **was** das Ziel ist.
Ein Roster kann daher nie „Eintragsart aus dem Verweis" lesen — sie kommt immer
vom aufgeloesten Ziel.

```
force "Standard (OK-AB)" (729f-…)
  ├ selection entryId=9cb5-…  entryLinkId=""            → selectionEntry type="unit"   ← zaehlt als unit
  └ selection entryId=7754-…  entryLinkId="d82e-…"      → entryLink type="selectionEntry"
                                                          └ Ziel selectionEntry type="unit" ← zaehlt als unit
```

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **LET-R1** | Ist die `.gst`-Auswahl **„Border Patrols rules"** im Roster, feuert an ihr eine **Autor-Meldung** (`modifier type="add" field="error"`, Schweregrad *Fehler*) mit dem Wortlaut „The army must consist of at least TWO units but no more than FOUR units", sobald das Kontingent **weniger als 2** oder **mehr als 4** direkte Auswahlen der Eintragsart `unit` traegt. | `.gst` → `selectionEntry id="4e15-0353-165f-5528"` (Z. 17584) → `modifier add error` (Z. 17600) mit `conditionGroup type="or"` (Z. 17603): `condition greaterThan value="4" field="selections" scope="force" childId="unit" includeChildSelections="false"` (Z. 17605) und `condition lessThan value="2" … childId="unit" …` (Z. 17606). |
| **LET-R2** | Gezaehlt wird die **Eintragsart**, nicht eine Element-Id: `childId="unit"` ist ein Typ-Keyword. Es gibt im gesamten Fixture-Satz kein Element mit der Id `unit`. | `battlescribe-data-format.md` Z. 708 (Tabelle `childId`); `Catalogue.xsd` Z. 307–313 (`SelectionEntryKind` = `upgrade` \| `model` \| `unit`). Dieselbe Schreibweise fuer Modelle z. B. Ogre-`.cat` Z. 471 (`childId="model" scope="self"`). |
| **LET-R3** | Die Eintragsart eines Vorkommens stammt **immer vom aufgeloesten Ziel**. Ein ueber einen `entryLink` bezogenes Vorkommen zaehlt deshalb unter derselben Eintragsart wie dasselbe Ziel direkt gesetzt. Das gleichnamige `type`-Attribut des `entryLink` gehoert zu einer **disjunkten** Wertemenge und kann keine Eintragsart bezeichnen. | `Catalogue.xsd` Z. 307–313 (`SelectionEntryKind`) vs. Z. 414–419 (`EntryLinkKind` = `selectionEntry` \| `selectionEntryGroup`) — kein gemeinsamer Wert. Konkret: Ogre-`.cat` Z. 3133 `entryLink type="selectionEntry" targetId="7754-8b3d-df99-d2d5"` → Mercenaries-`.cat` Z. 3438 `selectionEntry type="unit"`. |
| **LET-R4** | Die Zaehlung von LET-R1 sieht **nur direkte Kinder des Kontingents** (`includeChildSelections="false"`). Modelle und Aufwertungen **innerhalb** der Einheiten sind daher fuer diesen Test ohne Belang; die Roster duerfen sie weglassen. | `.gst` Z. 17605/17606, Attribut `includeChildSelections="false"`. |
| **LET-R5** | „Border Patrols rules" ist per Basis verborgen und wird nur bei einem **Roster-Punktelimit von exakt 500** eingeblendet. Alle Roster setzen deshalb `costLimit` 500. | `.gst` Z. 17595–17599: `modifier set hidden="false"` mit `condition equalTo value="500" field="limit::ecfa-8486-4f6c-c249" scope="roster"`. |
| **LET-R6** | Am selben Slot haengt eine **zweite**, unabhaengige Autor-Meldung („You must include at least ONE infantry unit of 10+ models."). Sie ist **nicht** Gegenstand dieses Szenarios; die Erwartungen greifen deshalb einzelne Meldungen ueber ihren Wortlaut heraus statt die Meldungsliste des Slots vollstaendig zu behaupten. | `.gst` Z. 17611–17615: `modifier add error` mit `condition lessThan value="1" … childId="6ad6-f54e-1867-00a7"` (Kategorie „BP Infantry 10+"). |

**Direkt gesetzte Einheiten** (Wurzel-`<selectionEntries>` der Ogre-`.cat`,
jeweils `type="unit"`): „Yhetees" `9cb5-fe07-22d4-22de` (Z. 394),
„Gnoblar Trappers" `041b-7d95-6ff9-754a` (Z. 121), „Gorger"
`81b9-e978-56c2-e942` (Z. 976).

**Ueber Verweis bezogene Einheiten** (Wurzel-`<entryLinks>` der Ogre-`.cat`,
Ziel jeweils `type="unit"` in der Mercenaries-`.cat`): „Ogre Bulls"
`d82e-111e-89b9-2be1` → `7754-8b3d-df99-d2d5` (Z. 3133 → Merc. Z. 3438),
„Leadbelchers" `c487-0350-e5cf-0c0a` → `da30-4b49-acc3-21a7`
(Z. 3168 → Merc. Z. 3693).

> **Warum `unit` und nicht `model`?** Die Regel ist dieselbe („ein Eintrag zaehlt
> unter seiner Eintragsart mit"), aber nur fuer `unit` gibt es in diesen
> Katalogdaten Vorkommen, die **selbst** an einen Verweis gebunden sind und
> zugleich von einer Eintragsart-Bedingung gezaehlt werden. Nachgeprueft: im
> gesamten Fixture-Satz sind genau drei `selectionEntry` mit `type="model"`
> ueberhaupt Ziel eines `entryLink` — „Gorger" `ece1-a86f-38f9-304e`
> (Ogre-`.cat` Z. 2195; verlinkt Z. 998 und Z. 1020), „Horned One [LIZARDMEN]"
> `6d1e6aa2-c062-4798-9145-04cbe9d30374` (VC-`.cat` Z. 17163; verlinkt Z. 17090)
> und „Tiranoc Chariot [HIGH ELVES]" `9ee68772-6b2d-42a2-b24a-0dce060be729`
> (VC-`.cat` Z. 20249; verlinkt Z. 8885 und Z. 8999). Keine dieser Verweis-Stellen
> liegt in einem Eintrag mit einer `childId="model"`-Bedingung: die Ogre-Einheit
> „Gorger" `81b9-e978-56c2-e942` (Z. 976–1000) traegt keine solche Bedingung,
> und beide VC-Stellen liegen ausserhalb jedes Eintrags, der eine der 14
> `childId="model" scope="self"`-Bedingungen der VC-`.cat` (alle bei Z. ≤ 13085)
> enthaelt. Bei allen Einheiten mit `childId="model"`-Bedingung (z. B. Ogre
> „Yhetees" Z. 471, O&G „Stone Trolls" Z. 6950) sind die Modelle **inline**
> deklariert — der Verweis-Fall laesst sich dort also gar nicht herstellen.
> Das vorhandene Szenario
> [`evaluator-bug-childid-model`](../evaluator-bug-childid-model/README.md) deckt
> genau diesen inline-Fall auf `model`-Ebene ab; dieses Szenario ergaenzt die
> Verweis-Ebene auf `unit`.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle
referenzieren `.gst` + Ogre-Kingdoms-`.cat` + die per `catalogueLink` benoetigte
Mercenaries-`.cat`.

> **Assertion-Fokus:** ausschliesslich die Autor-Meldung aus LET-R1, ausgewaehlt
> ueber ihren Wortlaut. Andere Armeeaufbau-Diagnosen (fehlende Pflicht-Modelle in
> den leeren Einheiten, Core-/General-Pflicht, Punktelimit, die zweite Meldung aus
> LET-R6) duerfen zusaetzlich auftreten und sind hier ohne Belang.

| # | Testtitel | Roster-Zustand | Ist / Grenze (aus den Katalogdaten) | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------|-------------------------------------------------------|---------|
| 01 | Kontrolle: beide Einheiten **direkt** | „Border Patrols rules" + Yhetees (`9cb5…`) + Gnoblar Trappers (`041b…`), beide mit `entryLinkId=""`. | Ist **2** Auswahlen der Art `unit`; `lessThan 2` haelt nicht, `greaterThan 4` haelt nicht. | **Keine** Meldung „The army must consist of at least TWO units…". | [`01-zwei-einheiten-direkt.ros`](rosters/01-zwei-einheiten-direkt.ros) |
| 02 | Gemischt: **eine direkt, eine verlinkt** | „Border Patrols rules" + Yhetees (direkt) + Ogre Bulls (`entryId=7754…`, `entryLinkId=d82e…`). | Ist **2** — identisch zu 01, nur die Herkunft der zweiten Einheit unterscheidet sich. | **Keine** Meldung. *(Zaehlt das verlinkte Vorkommen nicht unter `unit` mit, waere Ist 1 und `lessThan 2` wuerde halten.)* | [`02-eine-direkt-eine-verlinkt.ros`](rosters/02-eine-direkt-eine-verlinkt.ros) |
| 03 | Beide Einheiten **ueber Verweis** | „Border Patrols rules" + Ogre Bulls (`d82e…`) + Leadbelchers (`c487…`). | Ist **2** — wieder identisch zu 01. | **Keine** Meldung. *(Ohne Eintragsart am Verweis waere Ist 0 und `lessThan 2` wuerde halten.)* | [`03-zwei-einheiten-verlinkt.ros`](rosters/03-zwei-einheiten-verlinkt.ros) |
| 04 | Gegenprobe nach oben: **3 direkt + 2 verlinkt** | „Border Patrols rules" + Yhetees + Gnoblar Trappers + Gorger (direkt) + Ogre Bulls + Leadbelchers (verlinkt). | Ist **5**, Grenze **4**; `greaterThan 4` haelt. | Am Slot „Border Patrols rules" (`4e15…`) liegt die Meldung „The army must consist of at least TWO units but no more than FOUR units" als **Fehler** an. *(Zaehlten die verlinkten Vorkommen nicht mit, waere Ist 3 und es entstuende gar keine Meldung.)* | [`04-fuenf-einheiten-drei-direkt-zwei-verlinkt.ros`](rosters/04-fuenf-einheiten-drei-direkt-zwei-verlinkt.ros) |

Die vier Faelle zusammen trennen genau den Unterschied, um den es geht: **01**
haelt den rein direkten Referenzwert fest, **02** und **03** fordern dasselbe
Ergebnis fuer dieselbe Einheitenzahl mit verlinkter Herkunft, und **04** belegt in
der Gegenrichtung, dass ein verlinktes Vorkommen die Zaehlung tatsaechlich
**erhoeht** — eine Meldung, die bei blosser Unterzaehlung gar nicht entstuende.

### Was dieses Szenario bewusst NICHT behauptet

- **Sichtbarkeit (`hidden`).** Die Verweise „Ogre Bulls"/„Leadbelchers" und die
  Einheit „Border Patrols rules" tragen `hidden`-Modifikatoren (Ogre-`.cat`
  Z. 3134–3159, `.gst` Z. 17595). Sichtbarkeit ist Verfuegbarkeit, keine zaehlende
  Grenze, und erscheint nicht als feuernde Grenze im Verletzungsbericht.
- **Kategorien am Verweis.** Der „Ogre Bulls"-Verweis vergibt eigene Kategorien
  (Ogre-`.cat` Z. 3137–3141, Z. 3165). Das ist Gegenstand des Szenarios
  [`author-message-tokens`](../author-message-tokens/README.md) und wird hier
  nicht behauptet.
- **Die zweite Autor-Meldung** des Slots (LET-R6) — sie haengt an der Kategorie
  „BP Infantry 10+" und ist von der Einheitenzahl unabhaengig.
- **Die Modell-Ebene (`childId="model"`) fuer verlinkte Vorkommen** — dafuer gibt
  es in diesen Katalogdaten keinen Fall (siehe Kasten oben). Das ist eine
  Datenluecke, keine Aussage ueber die Engine.

### Erwarteter Ausgangszustand

Dieses Szenario entsteht **vor** der Engine-Aenderung (Issue 76/03). Solange die
Eintragsart eines verlinkten Vorkommens nicht vom aufgeloesten Ziel bezogen wird,
sind die Roster **02, 03 und 04 rot** und nur Roster **01** gruen. Das ist so
gewollt: die Erwartungen stehen so, wie die Katalogdaten sie vorgeben.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID | Fundstelle |
|---------|-----|-----------|
| Spielsystem WHFB 6th definitive | `0d13-7737-ea86-4662` | `.gst`, Wurzel |
| Force „Standard (OK-AB)" | `729f-9246-5cd3-5044` | Ogre-`.cat` → `<forceEntries>` (Z. 3090) |
| „Border Patrols rules" (Traeger der Meldung) | `4e15-0353-165f-5528` | `.gst` → Wurzel-`<selectionEntries>` (Z. 17584) |
| Autor-Meldung „…at least TWO units but no more than FOUR units" | `modifier add error` (Z. 17600) | `.gst`, Bedingungen Z. 17605/17606 (`childId="unit"`, `scope="force"`) |
| Einblende-Bedingung (Punktelimit 500) | `modifier set hidden=false` (Z. 17595) | `.gst` Z. 17597 (`limit::ecfa-8486-4f6c-c249`) |
| Kostenart „pts" | `ecfa-8486-4f6c-c249` | `.gst` → `<costTypes>` |
| Einheit „Yhetees" (direkt) | `9cb5-fe07-22d4-22de` | Ogre-`.cat` Z. 394, `type="unit"` |
| Einheit „Gnoblar Trappers" (direkt) | `041b-7d95-6ff9-754a` | Ogre-`.cat` Z. 121, `type="unit"` |
| Einheit „Gorger" (direkt) | `81b9-e978-56c2-e942` | Ogre-`.cat` Z. 976, `type="unit"` |
| Wurzel-`entryLink` „Ogre Bulls" → Ziel | `d82e-111e-89b9-2be1` → `7754-8b3d-df99-d2d5` | Ogre-`.cat` Z. 3133 / Mercenaries-`.cat` Z. 3438 (`type="unit"`) |
| Wurzel-`entryLink` „Leadbelchers" → Ziel | `c487-0350-e5cf-0c0a` → `da30-4b49-acc3-21a7` | Ogre-`.cat` Z. 3168 / Mercenaries-`.cat` Z. 3693 (`type="unit"`) |
| `catalogueLink` Ogre → Mercenaries | `a067-78d5-50a2-affe` → `fc47-8392-a6c8-452a` | Ogre-`.cat` Z. 3087 |
| Kategorie „BP Infantry 10+" (nur LET-R6, nicht behauptet) | `6ad6-f54e-1867-00a7` | `.gst` Z. 17613 |
| Wertemenge Eintragsart / Verweisart | `SelectionEntryKind` / `EntryLinkKind` | `Catalogue.xsd` Z. 307–313 / Z. 414–419 |
