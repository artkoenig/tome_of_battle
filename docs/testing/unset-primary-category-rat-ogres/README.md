# E2E-Regeln & Testkatalog: `unset-primary` auf `field="category"` (Skaven, Rat Ogres)

**Rolle:** Black-Box-Test (kein Blick in den Evaluator-Quellcode). Alle Regeln,
Grenzen und Ist-Werte sind allein aus den Katalogdaten der *6th Definitive
Edition*, aus [`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md)
und aus der vendorten `Catalogue.xsd` abgeleitet. Das Roster-Format ist an den
bereits verifizierten Fixtures dieses Verzeichnisses nachgebildet (direktes
`entryId`, `entryLinkId=""` bei Inline-Einträgen, `entryLinkId="<linkId>"` bei
über `entryLink` erreichten Einträgen).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee: `Skaven (6th definitive edition).cat` (`cac6-5f02-f95d-a403`, rev 1)
- Zusätzlich nötig: `Mercenaries (6th definitive edition).cat`
  (`fc47-8392-a6c8-452a`) — der Skaven-Katalog deklariert sie per
  `<catalogueLink id="4f16-8437-4e47-58a8" targetId="fc47-8392-a6c8-452a">`
  (Zeile 11451 f.).

---

## Der geprüfte Sachverhalt

Die Einheit **„Rat Ogres"** (`232c-d42d-bb0b-a85d`, `type="unit"`) trägt drei
statische Kategorie-Links:

| `categoryLink` | Ziel | `primary` |
|----------------|------|-----------|
| `5ef3-3f30-9fbb-658f` „Special" | `43cc-fc3f-35a7-8d03` | **`true`** |
| `f211-5bca-ec32-a217` „Non-Skirmisher_nor_character (SoC)" | `7aa6-96b4-5b49-d7d9` | `false` |
| `50b0-cde7-44ff-fcde` „Clan Moulder" | `7078-3ba6-2d44-bcfa` | `false` |

Darüber liegen zwei `modifierGroup`-Klammern (`<modifierGroups>` des Eintrags,
Zeilen 2775–2802). Die **erste** ist der Gegenstand dieses Szenarios:

```xml
<modifierGroup>
  <conditions>
    <condition field="selections" scope="force" value="0" type="instanceOf"
               childId="9f0b-5346-a3bc-b5fe"
               shared="true" includeChildSelections="false" includeChildForces="false"/>
  </conditions>
  <modifiers>
    <modifier type="unset-primary" field="category" value="43cc-fc3f-35a7-8d03"/>
    <modifier type="add"           field="category" value="64bf-efb4-9978-26df"/>
    <modifier type="set-primary"   field="category" value="64bf-efb4-9978-26df"/>
  </modifiers>
</modifierGroup>
```

`9f0b-5346-a3bc-b5fe` ist das `forceEntry` **„Hell Pit (WD-311)"** desselben
Katalogs (Zeile 184). Die Klammer enthält **kein** `remove` auf Special — im
Gegensatz zur zweiten Klammer desselben Eintrags, die für Clan Eshin (SK-AB)
`1191-bf6e-974a-b6e7`, Clan Pestilens (SK-AB) `adc6-cd5d-19cc-1bf3` und Clan
Skryre (SK-AB) `38dc-9bed-455f-f309` genau das tut:
`add`/`set-primary` auf Rare (`e94b-6a54-8779-cd60`) **plus**
`<modifier type="remove" field="category" value="43cc-fc3f-35a7-8d03"/>`.

Dass der Autor an der einen Stelle `remove` schreibt und an der anderen bewusst
nicht, ist der Beleg im Datensatz selbst: `unset-primary` ist **nicht** das
Entfernen einer Mitgliedschaft. Dieselbe Aussage macht die Formatreferenz
([§8](../../battlescribe-data-format.md#8-kategorien--sichtbarkeit)):
„`unset-primary` löscht dagegen nur das Flag; die Mitgliedschaft bleibt, denn
zählrelevant ist allein sie."

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **UPC-R1** | In **jedem** Kontingent ohne Umgliederungs-Klammer sind Rat Ogres **Special** (primär). | `Skaven.cat` → `selectionEntry 232c-d42d-bb0b-a85d` → `categoryLink 5ef3-3f30-9fbb-658f targetId="43cc-fc3f-35a7-8d03" primary="true"`. |
| **UPC-R2** | Im Kontingent **Hell Pit (WD-311)** verliert der Special-Link nur sein `primary`-Flag; die **Mitgliedschaft in Special bleibt**. Rat Ogres zählen dort weiterhin gegen jede Special-Grenze. | `Skaven.cat` → `232c…` → `modifierGroups/modifierGroup[1]` → `modifier type="unset-primary" field="category" value="43cc-fc3f-35a7-8d03"`; **kein** `remove` in derselben Klammer. Gate: `condition type="instanceOf" field="selections" scope="force" childId="9f0b-5346-a3bc-b5fe"`. |
| **UPC-R3** | Im selben Kontingent kommt **Core** als zusätzliche Mitgliedschaft hinzu und wird primär. Rat Ogres zählen dort **zusätzlich** gegen jede Core-Grenze. | Dieselbe Klammer: `modifier type="add" field="category" value="64bf-efb4-9978-26df"` und `modifier type="set-primary" field="category" value="64bf-efb4-9978-26df"`. |
| **UPC-R4** | Die armee-/kontingentweite **Special-Obergrenze** ist ein `max`-Constraint an der *Kategorie-Definition* (nicht am `categoryLink` des Kontingents) und gilt daher in **jedem** Skaven-Kontingent gleich. | `.gst` → `categoryEntry 43cc-fc3f-35a7-8d03` („Special") → constraint **`16f0-6e5b-55d0-4102`** `type=max value=3 field=selections scope=force shared=true includeChildSelections=true`. Die `categoryLink`s der Skaven-`forceEntries` (`aafe-f153-696a-fcd8` Standard, `dbe3-89fb-1122-4063` Hell Pit, `c73c-e160-947e-1c65` Clan Pestilens) tragen **keine** eigenen Constraints. |
| **UPC-R5** | Die **Core-Pflicht** ist ein `min`-Constraint an der Kategorie-Definition, ebenfalls force-skopiert und in jedem Kontingent gleich. | `.gst` → `categoryEntry 64bf-efb4-9978-26df` („Core") → constraint **`35c2-d478-392a-aeb1`** `type=min value=2 field=selections scope=force shared=true includeChildSelections=true`. Die Core-`categoryLink`s der Skaven-`forceEntries` (`a4bc-8548-b212-ed89`, `8434-fd93-2271-5b80`, `002f-e1be-7700-b89f`) tragen keine eigenen Constraints. |
| **UPC-R6** | Die **Rare-Obergrenze** dient als Gegenprobe für die zweite Klammer. | `.gst` → `categoryEntry e94b-6a54-8779-cd60` („Rare") → constraint **`0a44-2d3f-adfe-f3a1`** `type=max value=1 field=selections scope=force shared=true includeChildSelections=true`. |
| **UPC-R7** | Bei einem Punktelimit von **1000** gelten die **Basiswerte** aller drei Grenzen: Special `max 3`, Core `min 2`, Rare `max 1`. | Alle Modifier auf `16f0…`, `35c2…` und `0a44…` sind an `limit::ecfa-8486-4f6c-c249`-Fenster (`<200`, `200–499`, `2000–2999`, `3000–3999`, `4000–4999`, `5000–5999`) oder an eine „Border Patrols rules"-Selektion (`4e15-0353-165f-5528`, `scope="roster"`) gebunden. 1000 liegt in keinem Fenster, und keine Roster dieses Szenarios enthält die Border-Patrols-Selektion → kein Modifier greift. |
| **UPC-R8** | Rat Ogres sind in Hell Pit, Standard (SK-AB) und Clan Pestilens (SK-AB) **sichtbar**. | `232c…` → `modifier type="set" field="hidden" value="true"` mit `conditionGroup type="or"` über **nur** `bec8-e291-0c4a-903f` (Clan Eshin (SoC)) und `2ac5-0165-8a9e-8942` (Bubonic Court of Nurglitch (LUS)). Wichtig, weil Min-Grenzen einer effektiv versteckten Entität nicht validiert werden ([§8](../../battlescribe-data-format.md#8-kategorien--sichtbarkeit)). |
| **UPC-R9** | In Clan Pestilens (SK-AB) wird Special per **`remove`** wirklich entfernt und Rare hinzugefügt — der Special-Zähler fällt dort auf 0. | `232c…` → `modifierGroups/modifierGroup[2]`, `conditionGroup type="or"` über `1191-bf6e-974a-b6e7`, `adc6-cd5d-19cc-1bf3`, `38dc-9bed-455f-f309`; Modifier `add`/`set-primary` auf `e94b-6a54-8779-cd60` **und** `remove` auf `43cc-fc3f-35a7-8d03`. |

### Warum die Ist-Werte so und nicht anders lauten

Beide Grenzen zählen `field="selections"` mit `scope="force"` gegen ein
**Kategorie**-Ziel; nach der Ziel-Typ-Regel
([§7.7](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat),
ADR 0029) aggregieren sie armeeweit. Alle Roster dieses Szenarios haben genau
**ein** Kontingent, damit fallen „pro Detachment" und „armeeweit" zusammen und
der Ist-Wert ist schlicht die Zahl der Selektionen der jeweiligen Kategorie.

Jede Rat-Ogres-Selektion steht mit `number="1"` da; vier Selektionen ergeben
Ist 4, zwei ergeben Ist 2. `includeChildSelections="true"` erweitert nur den
Zählrahmen auf verschachtelte Selektionen — die Kinder einer Rat-Ogres-Einheit
(„Ogre Pack" `a321-5389-dab4-1f54`, „Rat Ogre" `cafc-ed54-2012-4907`,
„Packmaster each pack" `4eb2-daf5-2374-6108`, „Light Armour"
`055f-8e4e-f170-35d2`, „Whip" `e92b-3eab-c634-f54a`, „Hand Weapon"
`abdb-bbd0-41b2-5dff`) tragen **keine** `categoryLinks` und erhöhen daher
weder den Special- noch den Core- noch den Rare-Zähler (geprüft in
`.cat`-Zeilen 2825, 2845, 2887 und `.gst`-Zeilen 951, 1032 sowie
`.cat`-Zeile 9350).

Die Roster tragen bewusst **keinen** `<categories>`-Block an den
Rat-Ogres-Selektionen: die Kategoriezugehörigkeit soll ausschließlich aus dem
Katalog und den Modifiern folgen, nicht aus einer im Roster vorweggenommenen
Behauptung.

### Pflichtbestandteile einer katalogkonformen Rat-Ogres-Einheit

Aus den `min`-Constraints unterhalb von `232c-d42d-bb0b-a85d` abgeleitet;
jedes Roster baut jede Einheit genau so:

| Bestandteil | ID (im Roster als `entryId`) | Erreicht über | Pflicht laut Constraint |
|-------------|------------------------------|---------------|--------------------------|
| „Packmaster each pack" | `4eb2-daf5-2374-6108` | Inline-`selectionEntry` (`entryLinkId=""`) | `b6be-64ec-5c72-25f2` `min 1 scope=parent` / `5e94-8d06-54dc-d6ad` `max 1` |
| ↳ „Light Armour" | `055f-8e4e-f170-35d2` | `entryLink` `670b-28e6-84e2-db97` | `8e65-56fe-4229-8aca` `min 1` / `08cb-79b5-5c2b-8fa2` `max 1` |
| ↳ „Whip" | `e92b-3eab-c634-f54a` | `entryLink` `5674-6df2-aa7c-91af` | `99e9-f39a-e418-f5ad` `min 1` / `b97e-c01c-9b0d-f290` `max 1` |
| ↳ „Hand Weapon" | `abdb-bbd0-41b2-5dff` | `entryLink` `98a9-69de-5437-f795` | `b02f-90ab-b324-306c` `min 1` / `4f74-0b2d-a19f-e6d8` `max 1`; zusätzlich `bdef-ba9b-d6ce-5b14` `min 1` an der Definition in der `.gst` |
| „Rat Ogre" | `cafc-ed54-2012-4907` | Inline-`selectionEntry` | `bce7-d401-7bb8-e497` `min 1` / `a949-acb7-6639-b016` `max 1` |
| „Ogre Pack" (Modell, 50 pts) | `a321-5389-dab4-1f54` | Inline-`selectionEntry` | **kein** `min`; nur `f52e-380b-3c72-fd86` `max -1` (= unbegrenzt). Je Einheit ist **ein** Pack enthalten, damit die Einheit Modelle und Kosten hat. |

Kosten je Einheit: 50 pts (nur „Ogre Pack" ist kostenbehaftet). Vier Einheiten
= 200 pts, zwei Einheiten = 100 pts — beides deutlich unter dem gesetzten
Limit von 1000 pts.

---

## Bewusst **nicht** gepinnte Diagnosen

Die Erwartung ist selektiv, nicht erschöpfend. Diese zusätzlich zu erwartenden
Meldungen sind aus den Daten erklärbar, gehören aber nicht zur Regel dieses
Szenarios und stehen deshalb weder in `firing` noch in `absent`:

- **`101d-f2f2-1c2f-a3a1`** — die eigene Obergrenze von „Rat Ogres"
  (`type=max value=0 field=selections scope=parent`), angehoben per
  `modifier type="increment" value="1"` mit `repeat field="selections"
  scope="roster" childId="736a-30de-d314-9262"` („Mainstay", `.cat` Zeile 12).
  Die Kategorie „Mainstay" trägt im ganzen Katalog **nur** der Eintrag „Rotten
  Rodents" (`79a1-8539-569b-ed88`, `categoryLink 82b6-aa96-180a-de08`), und der
  ist `hidden="true"`, außer im Kontingent Bubonic Court of Nurglitch
  (`2ac5-0165-8a9e-8942`) — in dem Rat Ogres ihrerseits versteckt sind
  (UPC-R8). In den hier genutzten Kontingenten ist die Grenze daher rechnerisch
  0 und durch keine wählbare Selektion anzuheben. Das ist eine Eigenheit des
  Datensatzes und unabhängig vom `unset-primary`-Verhalten; das Szenario nimmt
  dazu keine Stellung.
- **Armeeaufbau-Grundregeln** — die roster-skopierte „General"-Pflicht der
  `.gst` (`categoryEntry a37e-7207-de6d-acb0`) sowie sonstige Pflichtanker
  können zusätzlich melden. Ohne Belang für dieses Szenario.

Ebenfalls **nicht** als feuernde Grenze erwartet wird die Wirkung von
`set-primary`/`unset-primary` auf die **Anzeige-Einsortierung** (welcher
Bucket „Core" oder „Special" die Einheit in der UI bekommt). Das ist eine
Darstellungsfrage, keine zählende Schranke, und der Verletzungsbericht kodiert
keine Einsortierung — genauso wie er weder `hidden` noch Profilwerte kodiert.
Positiv beobachtbar ist allein die **Mitgliedschaft**, und genau die messen
die drei Kategoriegrenzen unten.

---

## Testkatalog

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle
referenzieren `.gst` + Skaven-`.cat` + die per `catalogueLink` benötigte
Mercenaries-`.cat`; alle setzen `<costLimit typeId="ecfa-8486-4f6c-c249"
value="1000"/>`.

| # | Testtitel | Kontingent | Roster-Zustand | Erwartetes Ergebnis (Grenzen-Ebene) | Fixture |
|---|-----------|------------|----------------|--------------------------------------|---------|
| 01 | Hell Pit: Special überlebt `unset-primary` | Hell Pit (WD-311) `9f0b-5346-a3bc-b5fe` | 4× Rat Ogres | **UPC-R2/R4:** Special `16f0-6e5b-55d0-4102` feuert, **Ist 4 / Grenze 3** — der Zähler ist *nicht* auf 0 gefallen. **UPC-R3/R5:** Core `35c2-d478-392a-aeb1` feuert **nicht** (Ist 4 ≥ 2). Rare `0a44-2d3f-adfe-f3a1` feuert nicht (Ist 0). | [`01-hell-pit-four-rat-ogres-special-max-fires.ros`](rosters/01-hell-pit-four-rat-ogres-special-max-fires.ros) |
| 02 | Standard: identische Special-Verletzung ohne Klammer | Standard (SK-AB) `f143-b4f7-0151-8478` | 4× Rat Ogres (baugleich zu 01) | Special `16f0…` feuert **exakt gleich**, Ist 4 / Grenze 3 → der Vergleich mit 01 zeigt, dass `unset-primary` den Special-Zähler unverändert lässt. Core `35c2…` feuert, **Ist 0 / Grenze 2**. Rare feuert nicht. | [`02-standard-four-rat-ogres-special-max-and-core-min-fire.ros`](rosters/02-standard-four-rat-ogres-special-max-and-core-min-fire.ros) |
| 03 | Hell Pit: Core-Pflicht allein durch Rat Ogres erfüllt | Hell Pit (WD-311) | 2× Rat Ogres | **UPC-R3:** Core `35c2…` feuert **nicht** (Ist 2 = Grenze 2) — die `add`/`set-primary`-Hälfte ist positiv beobachtbar. Special `16f0…` feuert nicht (Ist 2 < 3). Rare feuert nicht. | [`03-hell-pit-two-rat-ogres-core-min-met.ros`](rosters/03-hell-pit-two-rat-ogres-core-min-met.ros) |
| 04 | Standard: dieselben zwei Einheiten, Core bleibt leer | Standard (SK-AB) | 2× Rat Ogres (baugleich zu 03) | Core `35c2…` feuert, **Ist 0 / Grenze 2** — Minimalpaar zu 03, nur das Kontingent unterscheidet sich. Special feuert nicht (Ist 2 < 3). Rare feuert nicht. | [`04-standard-two-rat-ogres-core-min-fires.ros`](rosters/04-standard-two-rat-ogres-core-min-fires.ros) |
| 05 | Clan Pestilens: `remove` senkt den Special-Zähler wirklich | Clan Pestilens (SK-AB) `adc6-cd5d-19cc-1bf3` | 4× Rat Ogres (baugleich zu 01/02) | **UPC-R9:** Special `16f0…` feuert **nicht** (Ist 0, weil `remove`). Rare `0a44…` feuert, **Ist 4 / Grenze 1**. Core `35c2…` feuert, **Ist 0 / Grenze 2**. Der Kontrast zu 01 trennt `remove` von `unset-primary`. | [`05-clan-pestilens-four-rat-ogres-special-removed.ros`](rosters/05-clan-pestilens-four-rat-ogres-special-removed.ros) |

### Wie die fünf Fälle zusammen beweisen

- **01 vs. 02** isoliert die `unset-primary`-Hälfte: gleiche vier Einheiten,
  nur das Kontingent unterscheidet sich. Wäre `unset-primary` ein verstecktes
  `remove`, müsste `16f0…` in 01 schweigen. Es feuert mit demselben Ist-Wert
  wie in 02.
- **03 vs. 04** isoliert die `add`/`set-primary`-Hälfte: gleiche zwei
  Einheiten, nur das Kontingent unterscheidet sich. Die Core-Pflicht ist in
  Hell Pit erfüllt und in Standard verletzt.
- **05** ist die Gegenprobe, die zeigt, dass der Datensatz sehr wohl eine
  Mitgliedschaft entfernen kann, wenn er es will — und dass der Special-Zähler
  dann tatsächlich auf 0 fällt.

So trägt keine der beiden Modifier-Hälften den Beweis allein.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Katalog Skaven (Wurzel) | `cac6-5f02-f95d-a403` |
| Force „Standard (SK-AB)" | `f143-b4f7-0151-8478` |
| Force „Hell Pit (WD-311)" (Gate der Klammer) | `9f0b-5346-a3bc-b5fe` |
| Force „Clan Pestilens (SK-AB)" (Gegenprobe mit `remove`) | `adc6-cd5d-19cc-1bf3` |
| Force „Clan Eshin (SoC)" / „Bubonic Court of Nurglitch (LUS)" (verstecken Rat Ogres) | `bec8-e291-0c4a-903f` / `2ac5-0165-8a9e-8942` |
| „Rat Ogres" (Einheit) | `232c-d42d-bb0b-a85d` |
| `categoryLink` „Special" an Rat Ogres (`primary="true"`) | `5ef3-3f30-9fbb-658f` |
| Kategorie „Special" | `43cc-fc3f-35a7-8d03` — constraint `16f0-6e5b-55d0-4102` (`max 3`, `scope=force`) |
| Kategorie „Core" | `64bf-efb4-9978-26df` — constraint `35c2-d478-392a-aeb1` (`min 2`, `scope=force`) |
| Kategorie „Rare" | `e94b-6a54-8779-cd60` — constraint `0a44-2d3f-adfe-f3a1` (`max 1`, `scope=force`) |
| Kostenart „pts" (Punktelimit) | `ecfa-8486-4f6c-c249` |
| „Border Patrols rules" (in keinem Roster enthalten) | `4e15-0353-165f-5528` |
| Kategorie „Mainstay" (hebt `101d-f2f2-1c2f-a3a1`) | `736a-30de-d314-9262` |
| „Rotten Rodents" (einziger Mainstay-Träger, `hidden="true"`) | `79a1-8539-569b-ed88` |
| „Ogre Pack" / „Packmaster each pack" / „Rat Ogre" | `a321-5389-dab4-1f54` / `4eb2-daf5-2374-6108` / `cafc-ed54-2012-4907` |
| „Light Armour" / „Whip" / „Hand Weapon" (Ziele) | `055f-8e4e-f170-35d2` / `e92b-3eab-c634-f54a` / `abdb-bbd0-41b2-5dff` |
| deren `entryLink`s unter „Packmaster each pack" | `670b-28e6-84e2-db97` / `5674-6df2-aa7c-91af` / `98a9-69de-5437-f795` |
| Bibliothekskatalog „Mercenaries" (per `catalogueLink 4f16-8437-4e47-58a8`) | `fc47-8392-a6c8-452a` |
