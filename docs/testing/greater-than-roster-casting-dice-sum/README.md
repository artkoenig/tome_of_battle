# E2E-Regeln & Testkatalog: `greaterThan` auf einer **Kostenart** mit `scope="roster"` — die Casting-Dice-Summe der Armee

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln, Ids,
Texte und Erwartungswerte sind **ausschließlich aus den Katalogdaten** der
*6th Definitive Edition* (`src/evaluator/__fixtures__/whfb6-definitive/`) und der
Formatspezifikation ([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md),
§7.5, §7.6, §7.7, §9.4, §13.1, §13.2) abgeleitet — nicht aus einem Engine-Lauf.
Die Roster-Form ist an den bereits verifizierten Szenarien nachgebildet (direktes
`entryId`, `entryLinkId=""`, verschachtelte `selections` mit `number`,
`<costLimits>` für das eingestellte Budget) — konkret an
[`at-least-roster-points-limit`](../at-least-roster-points-limit/README.md) und
[`condition-group-and-nested`](../condition-group-and-nested/README.md), die
denselben Träger auswählen, sowie an
[`explorer-category-constraints`](../explorer-category-constraints/README.md) für
den `<categories>`-Block einer Einheit.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1) — Kostenarten **`pts`** `ecfa-8486-4f6c-c249`
  (`.gst:13`) und **„ Casting Dice"** `fcec-2340-6368-a2ba` (`.gst:14`,
  `defaultCostLimit="-1"`; das Anfangs-Leerzeichen im Namen steht so im Katalog —
  gerechnet wird ohnehin über die `typeId`, nie über den Namen, §3.1)
- Armeebuch: `Orcs and goblins (6th definitive edition).cat`
  (`4049-c46d-7f80-44fb`, rev 1, `.cat:2`) — Kontingent **„Standard (OG-AB)"**
  `2bfa-e64a-7123-895f` (`.cat:47`)
- Bibliothek: `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`) —
  per `catalogueLink` `b066-2f8e-11ee-1dce` deklarierte Abhängigkeit der
  O&G-`.cat`

> **Assertion-Fokus:** die **Autor-Meldung** `No more than 10 power die are
> allowed! See [PDF, p.X]` — `expect.messages` mit `origin: "authorMessage"` und
> (wo der Träger im Roster steht) `expect.capabilities[].authorMessages`. Eine
> `condition` ist **keine zählende Grenze**; sie erscheint deshalb **nicht** als
> feuernde `limitId` im Verletzungsbericht, sondern ist nur über ihre Wirkung —
> hier die Meldung — beobachtbar. Als **Randbedingungen** werden zusätzlich die
> eigene Grenze des Trägers `00f6-c1b3-ee85-5c02` (still), die Budget-Regel
> `budget::ecfa-8486-4f6c-c249` (still) und die Characters-Obergrenze
> `c3c3-a80c-e026-200f` (in 02–05 **konstant** feuernd) behauptet. Andere
> Armeeaufbau-Diagnosen — namentlich Core-Pflicht `35c2-d478-392a-aeb1` und
> General-Pflicht `1077-7379-f142-f382` — dürfen zusätzlich auftreten und stehen
> bewusst **nicht** in `absent` (selektive Erwartung, Manifest-Vertrag).

---

## Die Datenlage: die einzige Kostensummen-Bedingung des Korpus

Der Träger ist der Turnier-Schalter „Tournament rules: Uprising (2026)"
(`4bc4-8781-2091-d9df`, `.cat:11533`, `hidden="true"`), verschachtelt in der
Gruppe „Ruleset restriction" (`43b3-35c6-d7cc-e3c6`, `.cat:11531`) unter dem
Eintrag „Army composition rules" (`6fcf-b33d-3cf5-b56a`, `.cat:11529`,
`hidden="true"`). Sein **zweiter** Modifikator (`.cat:11558-11563`):

```xml
<modifier type="add" value="No more than 10 power die are allowed!
See [PDF, p.X]" field="error">
  <conditions>
    <condition type="greaterThan" value="10" field="fcec-2340-6368-a2ba" scope="roster" childId="any"
               shared="true" includeChildSelections="true" includeChildForces="true"/>
  </conditions>
</modifier>
```

`fcec-2340-6368-a2ba` ist **keine** Auswahl-Id und **kein** `limit::…`-Präfix,
sondern die `costType`-Id „ Casting Dice" der `.gst` (`.gst:14`). Laut
[§13.2](../../battlescribe-data-format.md#132-der-field-wert-je-nach-kontext) sagt
das `field` einer `condition`, *worauf getestet/gezählt wird*, und nennt als
zulässige Werte `selections`, `<costTypeId>` und `limit::<costTypeId>`. Eine
Kostenart-Id dort bedeutet also — wie am `constraint`
([§7.6](../../battlescribe-data-format.md#76-constraint),
[§9.4](../../battlescribe-data-format.md#94-punkte-budget-als-constraint):
*„begrenzt die **Summe** dieser Kosten"*) — die **Summe** dieser Kostenart im
benannten Rahmen, nicht eine Stückzahl und nicht das eingestellte Budget.

In-World: *„Meckere, sobald die Armee **mehr als 10** Zauberwürfel auf den Tisch
bringt."*

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

Zeilenangaben beziehen sich auf `Orcs and goblins (6th definitive edition).cat`,
sofern nicht anders vermerkt.

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **GTCD-R1** | **Eine Kostenart-Id im `field` einer `condition` summiert diese Kostenart.** Weder `selections` (Stückzahl) noch `limit::…` (Budget) — der nackte `costType`-Schlüssel bezeichnet die **Kostensumme**. | `.cat:11561` (`field="fcec-2340-6368-a2ba"`); `costType id="fcec-2340-6368-a2ba" name=" Casting Dice"` `.gst:14`. [§13.2](../../battlescribe-data-format.md#132-der-field-wert-je-nach-kontext) (Zeile `condition`/`repeat`: `selections`, `<costTypeId>`, `limit::<costTypeId>`), [§9.4](../../battlescribe-data-format.md#94-punkte-budget-als-constraint), [§7.6](../../battlescribe-data-format.md#76-constraint). |
| **GTCD-R2** | **Der Rahmen ist die ganze Roster.** `scope="roster"` + `childId="any"` + `includeChildSelections="true"` + `includeChildForces="true"`: summiert werden **alle** Auswahlen der Liste samt verschachtelter Kinder und untergeordneter Kontingente. `childId="any"` engt nichts ein (*„eine Ziel-ID, ein Typ-Keyword oder `any`"*). | `.cat:11561`; [§7.7, Condition-Tabelle](../../battlescribe-data-format.md#condition--eine-voraussetzung) (`childId`, `includeChildSelections`), [§13.2](../../battlescribe-data-format.md#132-der-field-wert-je-nach-kontext). Alle Roster hier haben **ein** Kontingent, so dass `includeChildForces` ohne Wirkung bleibt. |
| **GTCD-R3** | **`greaterThan` ist der *echte* Vergleich.** Die Bedingung hält erst, wenn die Summe den `value` **überschreitet** — bei **genau 10** hält sie **nicht**. Das ist die Kernaussage: der Schwellenwert selbst liegt auf der stillen Seite. | `.cat:11561` (`type="greaterThan" value="10"`); [§13.1](../../battlescribe-data-format.md#131-wichtige-enum-werte) / [§7.7-Condition-Tabelle](../../battlescribe-data-format.md#condition--eine-voraussetzung). Dieselbe Lesart pinnt CGAN-R4 in [`condition-group-and-nested`](../condition-group-and-nested/README.md) für `greaterThan` auf `selections`. |
| **GTCD-R4** | **Das Observable ist die Autor-Meldung, keine Grenze.** `modifier type="add" field="error"` trägt im `value` den Text und im `field` den Schweregrad. Hält die Bedingung, liegt die Meldung an der **tragenden Auswahl** an; hält sie nicht, feuert dort keine. | `.cat:11558`; [§7.7, „`field="error"`/`"warning"`/`"info"`"](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat); Muster gepinnt in [`author-message-severity`](../author-message-severity/README.md). |
| **GTCD-R5** | **Der Meldungstext ist einzeilig.** Im Katalog steht der `value` mit einem **rohen Zeilenumbruch im Attributwert** (`.cat:11558/11559`). Ein `rule`-`<description>` ist laut Formatreferenz die **einzige mehrzeilige** Textentität; Attributtext ist es nicht. Erwartet wird deshalb `No more than 10 power die are allowed! See [PDF, p.X]` (ein Leerzeichen an der Umbruchstelle). | [§7.4](../../battlescribe-data-format.md#74-rule); identische Herleitung und identische Schreibweise wie CGAN-R7 in [`condition-group-and-nested`](../condition-group-and-nested/README.md) für den Nachbar-Modifikator desselben Trägers. Der Text kommt im Fixture-Datensatz **genau einmal** vor (`.cat:11558`). |
| **GTCD-R6** | **Die Meldung hängt am Träger, nicht am Kontingent.** Steht `4bc4…` nicht als Auswahl im Roster, erscheint keine Meldung — auch wenn die Bedingung hielte. Ein bloßes **Angebot** (nicht gewählte, aber wählbare Definition) trägt seine Autor-Meldung nicht in die Meldungsliste. | GTCD-R4; VCC-R11 in [`violation-classification`](../violation-classification/README.md) (Roster 07: der Angebots-Anker trägt seine Autor-Meldung im Fähigkeits-Datensatz, die **Meldungsliste** enthält sie nicht) und CGAN-Roster 05 in [`condition-group-and-nested`](../condition-group-and-nested/README.md). Deshalb ist der Träger in 01–04 **gewählt**; Roster 05 ist die Gegenprobe. |
| **GTCD-R7** | **Der Träger ist nur bei Budget 2000–2500 erreichbar und bleibt dann still.** Basis ist `max 0` Auswahlen je Kontingent (`00f6-c1b3-ee85-5c02`); zwei Modifikatoren unter **derselben** `and`-Gruppe (`atLeast 2000` ∧ `atMost 2500` auf `limit::ecfa-8486-4f6c-c249`) setzen `hidden=false` und heben die Grenze auf `max 1`. Bei eingestelltem Budget **2000 pts** hält die Gruppe, und die eine Uprising-Auswahl je Roster ist **1 ≤ 1** → `00f6…` feuert nicht. | `.cat:11611` (Grenze), `:11570-11579` (`set hidden=false`), `:11580-11589` (`set 1`), Bedingungen `:11584`/`:11585`. Vollständig hergeleitet in [`at-least-roster-points-limit`](../at-least-roster-points-limit/README.md) (ARPL-R1/R3/R5). |
| **GTCD-R8** | **Der Träger ist im Kontingent erreichbar.** „Army composition rules" trägt primär die Kategorie *Special list rules* `32f1-197f-d719-a393`, die „Standard (OG-AB)" per `categoryLink` führt. Weder der Eintrag noch die Gruppe „Ruleset restriction" tragen eigene Grenzen. | `.cat:11617-11619` (`categoryLink` `3da4-efb0-d2dc-3dba` → `32f1…`, `primary="true"`); Kontingent `:47`, dessen `categoryLink` `0636-2809-bf71-0f02` → `32f1…` (`:50`); Gruppe `:11531` und Elterneintrag `:11529` ohne `<constraints>`. |
| **GTCD-R9** | **Die Casting-Dice-Träger des Katalogs sind die Zauberstufen der Schamanen.** Im ganzen O&G-Katalog stehen **18** `<cost typeId="fcec-2340-6368-a2ba">` mit Wert > 0. 16 davon sind die „Magic Level"-Optionen der acht Schamanen-Einheiten (Great Shamans: 3 bzw. 4; Shamans: 1 bzw. 2). Die **einzigen zwei** anderen (`:8067` = 4, `:9225` = 2) hängen unter *Wurrzag Ud Ura Zahubu* und *Azhag the Slaughterer* — beide **Special Characters** und darum hier bewusst nicht benutzt (sie würden die Nachbar-Meldung wecken). Alles andere im Katalog kostet **0** Casting Dice. | Vollständige Fundstellenprüfung `typeId="fcec-2340-6368-a2ba" value="[1-9]` in der O&G-`.cat`: 18 Treffer (`:439`, `:449`, `:605`, `:615`, `:1020`, `:1030`, `:1135`, `:1145`, `:2069`, `:2079`, `:2237`, `:2247`, `:2835`, `:2845`, `:2950`, `:2960`, `:8067`, `:9225`). Special-Characters-`categoryLink`s `:7988` (Wurrzag) und `:9116` (Azhag) → Kategorie `0644-bfcd-32c2-21dc`. |
| **GTCD-R10** | **Kein Modifikator verändert diese Kosten.** In der O&G-`.cat` gibt es **keinen einzigen** `modifier` mit `field="fcec-2340-6368-a2ba"`. Die geschriebenen `<cost>`-Werte sind also zugleich die **wirksamen** — die Arithmetik unten ist ohne Fallunterscheidung gültig. | Fundstellenprüfung `modifier … field="fcec-2340-6368-a2ba"` in der O&G-`.cat`: 0 Treffer. (Zum Gegenbild — ein `decrement` auf genau diese Kostenart — siehe [`decrement-cost-bloodline-casting-dice`](../decrement-cost-bloodline-casting-dice/README.md), anderer Datensatz.) |
| **GTCD-R11** | **Zählbasis:** Jede Einheit steht als **eigene** `<selection number="1">`, jede Zauberstufe als eigenes Kind mit `number="1"`. Unter **jeder** Lesart der Stückzahl-Frage ([§7.5](../../battlescribe-data-format.md#75-cost--cost-type), Zahlenbasis: `child.number * parent.number` vs. absolute Stückzahl) ergibt das dieselbe Summe — die Kernaussage hängt nicht an der Multiplikationsfrage. | Roster 02–05: fünf Geschwister-`<selection>` mit `number="1"`, je ein Kind `number="1"`; dieselbe Vorsichtsmaßnahme wie CGAN-R5. |
| **GTCD-R12** | **Die drei übrigen Autor-Meldungen des Trägers bleiben in *allen* Rostern inert** — am Toggle-Slot kann also höchstens die eine hier gepinnte Meldung anliegen. „> 2 gleiche Special Choice": Ziele `c679-3389-ca76-2ea1` und `4112-026b-500a-b6fd`, nie gewählt (Zähler 0, `greaterThan 1` hält nicht). „Special Characters ≥ 1": Kategorie `0644-bfcd-32c2-21dc`, von keiner gewählten Einheit geführt. „> 2 Large Targets": Ziele `7645ed71-72bd-4b72-89ab-22571a0a8b0c` und `b184-b03c-693b-53b1`, nie gewählt. | `.cat:11535-11557`, `:11564-11569`, `:11590-11608`. Kategorien der benutzten Einheiten: Orc Great Shaman `:343-344` (*Lord*, *Characters*), Orc Shaman `:1973-1975` (*Characters*, *Heroes*, *Orc*) — keine davon ist `0644…`. |
| **GTCD-R13** | **Die benutzten Einheiten sind vollständig geformt.** *Orc Great Shaman* `aa57-63c4-136b-4af5`: Pflicht-Kind „Choppa" `051b-bb88-69f3-6eb6` (`min 1`/`max 1`, 0 pts/0 CD) und Pflicht-Gruppe „Magic Level" `3aea-621a-cde8-b4f6` (`min 1`/`max 1`). *Orc Shaman* `e4cf-8043-5127-dd26`: „Choppa" `3ff4-4fc9-03d2-ee1f` (`min 1`/`max 1`) und „Magic Level" `bbf1-6402-24b4-5794` (`min 1`/`max 1`). Die „Mounts"-Gruppen tragen `min 0`; ihr `set 1` gattert auf ein **anderes** Kontingent (`1f55-c922-66d8-08ef`) und greift in „Standard (OG-AB)" nicht — es gibt also kein erzwungenes Reittier. | `.cat:347/349/350`, `:427/429/430`; `:1978/1980/1981`, `:2057/2059/2060`; Mounts `:377`/`:411` bzw. `:2007`/`:2039`. |
| **GTCD-R14** | **Die Characters-Obergrenze ist die konstante Randbedingung.** `c3c3-a80c-e026-200f` (`max`, `field="selections"`, `scope="force"`, `includeChildSelections="true"`) steht an der Kategorie *Characters* `7a1c-d611-c2dc-def1`; Basiswert **3**, bei Budget 2000–2999 pts und ohne „Border Patrols rules" per `set` auf **4**. Die Roster 02–05 führen **fünf** Charaktere → **Ist 5 / Grenze 4** in **jedem** von ihnen. Genau diese Konstanz macht die Casting-Dice-Summe zur einzigen Variablen. | `.gst:641` (Kategorie), `:644` (Grenze), `:671-682` (`set 4`, `atLeast 2000` ∧ `lessThan 3000` ∧ `lessThan 1` Border Patrols). Kategorie-Ziel ⇒ armeeweite Aggregation ([§7.7, Ziel-Typ-Regel](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat)); bei Ein-Kontingent-Listen identisch. |
| **GTCD-R15** | **Genau ein Lord, damit die Lord-Grenze schweigt.** `fda5-91c2-e17f-774c` (`max 1`) an der Kategorie *Lord* wird bei 2000–2999 pts auf **1** gesetzt; die Roster führen genau **einen** Lord (den Great Shaman). Die *Heroes*-Grenze `7fca-63fb-63d2-9dad` ist `max -1` = unbegrenzt, die vier Orc Shamans sind dort also frei. | `.gst:220` (Kategorie), `:363` (Grenze), `:252-263` (`set 1`); Heroes `.gst:366`/`:368`. Sentinel `-1` = unbegrenzt: [§7.6-Kasten](../../battlescribe-data-format.md#76-constraint). |

---

## Die Casting-Dice-Arithmetik — Posten für Posten

Alle Werte sind **geschriebene** `<cost>`-Werte (GTCD-R10: kein Modifikator
berührt diese Kostenart). Kein Eintrag außer den Zauberstufen trägt Casting Dice
> 0 (GTCD-R9).

| Posten | Id | `<cost typeId="fcec-2340-6368-a2ba">` | Fundort | pts |
|--------|-----|-----|------|-----|
| Army composition rules | `6fcf-b33d-3cf5-b56a` | *keine `<costs>`* → 0 | `.cat:11529` | 0 |
| Tournament rules: Uprising (2026) | `4bc4-8781-2091-d9df` | *keine `<costs>`* → 0 | `.cat:11533` | 0 |
| Orc Great Shaman (Einheit) | `aa57-63c4-136b-4af5` | **0** | `.cat:467-471` | 180 |
| — Choppa (Pflicht) | `051b-bb88-69f3-6eb6` | **0** | `.cat:352-356` | 0 |
| — **Level 4 Shaman** | `66e0-fd8f-7578-d1b1` | **4** | `.cat:447-451` | 35 |
| — (Level 3 Shaman, nicht benutzt) | `9888-4923-f6d5-157a` | (3) | `.cat:437-441` | (0) |
| Orc Shaman (Einheit) | `e4cf-8043-5127-dd26` | **0** | `.cat:2097-2101` | 65 |
| — Choppa (Pflicht) | `3ff4-4fc9-03d2-ee1f` | **0** | `.cat:1983-1987` | 0 |
| — **Level 1 Shaman** | `eb20-c898-6345-c1b3` | **1** | `.cat:2067-2071` | 0 |
| — **Level 2 Shaman** | `9d6d-45b0-8cf3-7a10` | **2** | `.cat:2077-2081` | 35 |

**Die Summe je Roster:**

| Roster | Great Shaman | Shaman A | Shaman B | Shaman C | Shaman D | Rechnung | **Σ Casting Dice** | Σ pts |
|--------|--------------|----------|----------|----------|----------|----------|--------------------|-------|
| **01** | — | — | — | — | — | *(keine Zauberstufe im Roster)* | **0** | 0 |
| **02** | Lvl 4 → 4 | Lvl 2 → 2 | Lvl 2 → 2 | Lvl 1 → **1** | Lvl 1 → 1 | 4 + 2 + 2 + 1 + 1 | **10** | 545 |
| **03** | Lvl 4 → 4 | Lvl 2 → 2 | Lvl 2 → 2 | Lvl 2 → **2** | Lvl 1 → 1 | 4 + 2 + 2 + 2 + 1 | **11** | 580 |
| **04** | Lvl 4 → 4 | Lvl 2 → 2 | Lvl 2 → 2 | Lvl 2 → **2** | Lvl 2 → **2** | 4 + 2 + 2 + 2 + 2 | **12** | 615 |
| **05** | Lvl 4 → 4 | Lvl 2 → 2 | Lvl 2 → 2 | Lvl 2 → 2 | Lvl 1 → 1 | 4 + 2 + 2 + 2 + 1 | **11** | 580 |

Die pts-Summen im Detail: Great Shaman 180 + Choppa 0 + Level 4 35 = **215**;
ein Orc Shaman mit Level 2 65 + 0 + 35 = **100**, mit Level 1 65 + 0 + 0 = **65**.
Roster 02 = 215 + 100 + 100 + 65 + 65 = **545**; Roster 03/05 = 215 + 100 + 100 +
100 + 65 = **580**; Roster 04 = 215 + 4 × 100 = **615**.

Zwischen **02** und **03** ändert sich **genau ein Attribut**: die `entryId` der
Zauberstufe des dritten Shamans (`eb20-c898-6345-c1b3` → `9d6d-45b0-8cf3-7a10`).
Einheitenzahl, Charakterzahl, Kontingent, Budget und Träger bleiben identisch —
der Umschlag der Meldung kann also keiner anderen Ursache zugeschrieben werden.
**04** wiederholt denselben Schritt am vierten Shaman (Summe 12) als
Nicht-Kanten-Kontrolle. **05** ist **03** ohne den Träger.

Die pts-Summen (545/580/615) liegen weit unter dem eingestellten Budget von
**2000 pts** — `budget::ecfa-8486-4f6c-c249` feuert in keinem Roster, und die
punkteabhängigen Gatter (Uprising `atLeast 2000` ∧ `atMost 2500`, Lord `set 1`,
Characters `set 4`) hängen ohnehin am **eingestellten** Budget und nicht an der
verplanten Summe (ARPL-R2).

### Wahrheitstafel

| Roster | Träger im Roster | Σ Casting Dice | `greaterThan 10` | **Meldung** | `00f6…` | `c3c3…` |
|---|---|---|---|---|---|---|
| 01 | ja | **0** | ✗ | keine | still (1 ≤ 1) | still (0 ≤ 4) |
| 02 | ja | **10** (Kante) | **✗** | **keine** | still (1 ≤ 1) | feuert (5 > 4) |
| 03 | ja | **11** | **✓** | **liegt an** | still (1 ≤ 1) | feuert (5 > 4) |
| 04 | ja | **12** | ✓ | liegt an | still (1 ≤ 1) | feuert (5 > 4) |
| 05 | **nein** | 11 | (✓) | keine (kein Träger) | still (0) | feuert (5 > 4) |

### Was eine falsche Lesart produzieren würde

| Fehl-Lesart | 01 | 02 | 03 | 04 | 05 |
|---|---|---|---|---|---|
| `greaterThan` als **einschließend** (`atLeast`/≥) gelesen | konform | Meldung statt Stille → **fällt auf** | konform | konform | konform |
| `field="<costTypeId>"` als **Stückzahl** gelesen (wie `selections`) | konform (2 Auswahlen) | **17** Auswahlen > 10 → Meldung statt Stille → **fällt auf** | konform (aus falschem Grund) | konform (aus falschem Grund) | konform (aus falschem Grund) |
| `field="<costTypeId>"` als **`limit::<costTypeId>`** (Budget) gelesen | konform (kein Casting-Dice-Budget gesetzt) | konform | **keine Meldung → fällt auf** | **fällt auf** | konform |
| Kostenart verwechselt (pts statt Casting Dice summiert) | konform (0 pts) | 545 > 10 → Meldung statt Stille → **fällt auf** | konform | konform | konform |
| Nur **direkte** Kinder des Rahmens summiert (`includeChildSelections` ignoriert) | konform | konform | Summe 0 → keine Meldung → **fällt auf** | **fällt auf** | konform |
| Rahmen als **Träger-Teilbaum** statt `roster` gelesen | konform | konform | Summe 0 → keine Meldung → **fällt auf** | **fällt auf** | konform |
| Zauberstufen-Kosten nicht rekursiv eingesammelt (nur Einheitskosten) | konform | konform | Summe 0 → **fällt auf** | **fällt auf** | konform |
| Bedingung **ignoriert** (Modifikator greift unbedingt) | Meldung → **fällt auf** | Meldung → **fällt auf** | konform | konform | konform |
| Meldung am **Kontingent** statt am Träger verankert | konform | konform | konform | konform | Meldung → **fällt auf** |
| Angebots-Anker liefert Meldungen (VCC-R11 verletzt) | konform | konform | konform | konform | Meldung → **fällt auf** |

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle laufen gegen
denselben Datensatz (`.gst` + O&G-`.cat` + Mercenaries-`.cat`), im Kontingent
**„Standard (OG-AB)"** `2bfa-e64a-7123-895f` und mit `costLimit` **2000 pts**
(GTCD-R7: nur so ist der Träger überhaupt wählbar und seine eigene Grenze still).

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | Keine Zauberer — die Summe ist 0 | Nur „Army composition rules" + Uprising-Schalter. | **GTCD-R1/R3:** 0 ist nicht größer als 10 — am belegten Toggle-Slot liegt **keine** Autor-Meldung an (`authorMessages: []`). Weder `00f6…` noch `budget::…` noch `c3c3…` feuern. | [`01-no-wizards-sum-0-silent.ros`](rosters/01-no-wizards-sum-0-silent.ros) |
| 02 | **Die Kante:** exakt 10 Zauberwürfel schweigen | Uprising-Schalter, 1 × Orc Great Shaman (Lvl 4), 2 × Orc Shaman (Lvl 2), 2 × Orc Shaman (Lvl 1) → 4+2+2+1+1 = **10**. | **GTCD-R3:** `greaterThan` ist echt größer — bei genau 10 hält die Bedingung **nicht**, der Toggle-Slot bleibt meldungsfrei. Die Characters-Grenze feuert (Ist **5** / Grenze **4**) und ist ab hier die konstante Randbedingung. | [`02-sum-10-boundary-silent.ros`](rosters/02-sum-10-boundary-silent.ros) |
| 03 | **Ein Würfel darüber** — dieselbe Liste, eine Zauberstufe höher | **Baugleich** zu 02, nur der dritte Shaman nimmt Level 2 statt Level 1 → **11**. | **GTCD-R1/R2/R3/R5:** Jetzt hält 11 > 10 — am Toggle-Slot liegt **genau eine** Autor-Meldung an, Schweregrad **error**, Wortlaut `No more than 10 power die are allowed! See [PDF, p.X]`. Alle Randbedingungen unverändert. | [`03-sum-11-message-fires.ros`](rosters/03-sum-11-message-fires.ros) |
| 04 | Nicht-Kanten-Kontrolle: 12 | Wie 03, zusätzlich der vierte Shaman auf Level 2 → **12**. | **GTCD-R1:** Dasselbe Ergebnis wie 03 — **eine** error-Meldung am Toggle-Slot. Bewusst **textfrei** gepinnt (Anker + Anzahl + Schweregrad), damit die Summen-Aussage von der Textfrage aus GTCD-R5 unabhängig bleibt. | [`04-sum-12-control-message-fires.ros`](rosters/04-sum-12-control-message-fires.ros) |
| 05 | Die Bedingung hielte — aber der Träger fehlt | Dieselben fünf Charaktere wie in 03 (**11**), **ohne** `6fcf…` und **ohne** `4bc4…`. | **GTCD-R6:** Die Meldung hängt am Träger. Ohne ihn im Roster erscheint **keine** Meldung dieses Ankers — auch nicht über ein Angebot (VCC-R11). Trennt „Bedingung falsch" von „kein Träger". | [`05-sum-11-carrier-absent-silent.ros`](rosters/05-sum-11-carrier-absent-silent.ros) |

### Herleitung der Zahlen

- **Σ Casting Dice** je Roster: die Tabelle „Die Summe je Roster" oben, Posten für
  Posten aus den `<cost>`-Zeilen (GTCD-R9/R10). Sie ist **keine** Assertion,
  sondern die Herleitung, aus der die Meldung folgt — die Kostensumme selbst ist
  im Bericht nicht als Grenze beobachtbar (siehe „Bewusst ausgelassene Facetten").
- **`c3c3-a80c-e026-200f`** (`firing` in 02–05): `bound` ist der wirksame Wert
  **4** (Basis 3, `.gst:644`; `set 4` bei 2000–2999 pts, `.gst:671-682`);
  `actual` ist die Zahl der Auswahlen mit der Kategorie *Characters* im
  Kontingent — je ein Orc Great Shaman und vier Orc Shamans (`.cat:344`,
  `:1973`) → **5**. Die Pflicht-Kinder (Choppa, Zauberstufe) tragen keine
  Kategorie und zählen nicht mit.
- **`00f6-c1b3-ee85-5c02`** (`absent`): Budget 2000 ∈ [2000, 2500] → `set 1`;
  Ist = eine Uprising-Auswahl je Kontingent → **1 ≤ 1**. In Roster 05 gibt es die
  Auswahl gar nicht (Ist 0).
- **`budget::ecfa-8486-4f6c-c249`** (`absent`): verplante Summe 0/545/580/615/580
  pts gegen das eingestellte Budget **2000** — nie überschritten.

### Bewusst ausgelassene Facetten

| Facette | Warum nicht |
|---------|--------------|
| Die Kostensumme als **feuernde Grenze** (`measure="costSum"` auf `fcec-2340-6368-a2ba`) | Im ganzen Datensatz gibt es **keinen** `constraint` mit `field="fcec-2340-6368-a2ba"` — die Summe ist hier nur die Vergleichsgröße einer **Bedingung**, und eine Bedingung ist keine zählende Grenze. Dieselbe Abgrenzung zieht DCB-R8 in [`decrement-cost-bloodline-casting-dice`](../decrement-cost-bloodline-casting-dice/README.md). |
| Ein **Casting-Dice-Budget** (`<costLimit typeId="fcec-2340-6368-a2ba">`) als zweiter Zeuge der Summe | Das wäre die **Budget**-Regel (`budget::fcec-2340-6368-a2ba`, Messgröße `rosterBudget`), also eine andere Zelle — bereits gepinnt in [`decrement-cost-bloodline-casting-dice`](../decrement-cost-bloodline-casting-dice/README.md) und [`violation-classification`](../violation-classification/README.md) (VCC-R6). Sie hier mitzuführen hieße, zwei Mechanismen in einem Roster zu vermengen; die Roster setzen deshalb **nur** ein pts-Budget, wie alle Nachbarszenarien am selben Träger. |
| `isHidden` des Toggle-Slots (`set hidden=false`, `.cat:11570-11579`) | Der Träger hängt unter „Army composition rules" (`6fcf…`, `hidden="true"`, ohne Aufdeck-Modifikator). Ob das `hidden` einer **Eltern-`selectionEntry`** auf die Slot-Projektion ihrer Kinder durchschlägt, legt [§8](../../battlescribe-data-format.md#8-kategorien--sichtbarkeit) **nicht** fest — dieselbe Auslassung wie in [`at-least-roster-points-limit`](../at-least-roster-points-limit/README.md) und [`condition-group-and-nested`](../condition-group-and-nested/README.md). |
| Die punktegegatterten Modifikatoren des Trägers (`atLeast 2000` ∧ `atMost 2500`) | Eigene Zelle, vollständig gepinnt in [`at-least-roster-points-limit`](../at-least-roster-points-limit/README.md). Hier in **allen** Rostern konstant wahr gehalten (Budget 2000), damit `00f6…` als Randbedingung stillsteht. |
| Die Meldung „No more than 2 Large Targets are allowed! See [PDF, p.X]" als eigener `count: 0`-Eintrag | In allen Rostern inert (GTCD-R12) und bereits von der **Gesamtaussage am Anker** erfasst: `{origin: authorMessage, anchorDefId: 4bc4…, count: 0}` in 01/02/05 fordert *gar keine* Meldung, `count: 1` in 03/04 fordert *genau eine* — beides schließt sie mit ein. Die beiden vom Auftrag benannten Nachbar-Meldungen sind zusätzlich **einzeln** mit `count: 0` festgenagelt. |
| Schweregrad-/Token-Semantik der Autor-Meldungen | Eigene Zellen, gepinnt in [`author-message-severity`](../author-message-severity/README.md) und [`author-message-tokens`](../author-message-tokens/README.md). Der Text hier enthält **kein** Token (`{this}` o. ä.) und der Träger trägt **keinen** `field="name"`-Modifikator (`.cat:11534-11609`: vier `error`, ein `hidden`, ein Constraint-Feld). |
| Die Lord-Grenze `fda5-91c2-e17f-774c` und die Heroes-Grenze `7fca-63fb-63d2-9dad` | GTCD-R15: beide sind erfüllt (1 Lord bei Grenze 1; Heroes unbegrenzt). `fda5…` trägt `scope="parent"` an einer `categoryEntry` — ein Rahmen, dessen Auflösung die Formatreferenz für Kategorie-Grenzen nicht eindeutig festlegt; deshalb steht sie **weder** in `firing` **noch** in `absent`. |
| Core-Pflicht `35c2-d478-392a-aeb1` und General-Pflicht `1077-7379-f142-f382` | Beiwerk des Armeeaufbaus; die Erwartung ist selektiv und nennt sie nicht. Sie sind in allen fünf Rostern gleich (kein Core, kein General). |
| Die Dispel Dice (`6001-b2bf-4529-c07d`) | Die Zauberstufen tragen sie mit (Lvl 1/2 → 1, Lvl 3/4 → 2), aber **keine** Bedingung und **kein** Constraint des Datensatzes liest diese Kostenart am Träger. Sie ist hier ohne Belang und nicht budgetiert. |

*Abgrenzung:* [`at-least-roster-points-limit`](../at-least-roster-points-limit/README.md)
pinnt dieselbe Rahmen-Art (`scope="roster"`, `childId="any"`) auf
**`field="limit::<costTypeId>"`** — das **eingestellte Budget**. Dieses Szenario
pinnt die Schwester-Zelle **`field="<costTypeId>"`** — die **verplante Summe**.
Die beiden Szenarien sind damit die zwei Hälften derselben Unterscheidung; ARPL
Roster 03 (Budget 1999, Summe 2000) hält sie von der anderen Seite auseinander.
[`condition-group-and-nested`](../condition-group-and-nested/README.md) und
[`condition-group-or-nested`](../condition-group-or-nested/README.md) pinnen die
Gruppenlogik der Nachbar-Modifikatoren desselben Trägers; hier hängt der
Modifikator an **einer einzelnen, ungruppierten** `<conditions>`-Liste
(`.cat:11560-11562`).

---

## Abgleich mit dem Engine-Bericht (Runner-Verifikation)

Die oben aus den Katalogdaten **abgeleiteten** Erwartungen treffen die Engine
erst im **Runner-Lauf** — der separate Verifikationsschritt, der nicht zur
(blinden) Autorenschaft gehört (siehe
[ADR 0033](../../adr/0033-evaluator-e2e-manifest-runner-und-black-box-autorenschaft.md)).
Abweichungen sind zu **untersuchen**, nicht durch Anpassen der Erwartung
wegzudefinieren. Die erwartungsgemäß heiklen Stellen:

1. **GTCD-R1** (Kernaussage) — ob eine `condition` mit einer **Kostenart-Id** im
   `field` überhaupt als Kostensumme ausgewertet wird und nicht still als
   Stückzahl oder als unbekanntes Feld (fail-closed) endet.
2. **GTCD-R2** — ob die Summe **rekursiv** über den ganzen Roster-Baum läuft: die
   Zauberstufen hängen zwei Ebenen unter dem Kontingent, und der Träger der
   Bedingung steht in einem **ganz anderen** Teilbaum als die Kosten.
3. **GTCD-R3** — ob `greaterThan` an der Kante **echt** vergleicht (Roster 02 bei
   exakt 10 gegen Roster 03 bei 11).
4. **GTCD-R5** — der **Zeilenumbruch im Attributwert**. Erwartet wird der
   normalisierte, einzeilige Wortlaut. Die Textbehauptung steht nur in Roster 03
   (und als `count: 0`-Auswahl in 01/02/05); Roster 04 pinnt dieselbe Aussage
   textfrei.
5. **GTCD-R14** — ob die Characters-Obergrenze tatsächlich mit **Ist 5 / Grenze 4**
   meldet (Kategorie-Ziel, `scope="force"`, Punkte-`set`). Sie ist hier
   Randbedingung, nicht Gegenstand — feuert sie mit anderen Zahlen, ist der
   Befund zur Meldung davon unberührt, die Erwartung aber zu untersuchen.
6. Die Anker-Adressierung: `anchorDefId 4bc4-8781-2091-d9df` +
   `anchorKind occupied` muss die eine Uprising-Auswahl eindeutig treffen (sie
   kommt je Roster höchstens einmal vor; `anchorPath` ist darum nicht gesetzt).

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID | Fundort |
|---------|-----|---------|
| Spielsystem WHFB 6th definitive | `0d13-7737-ea86-4662` | `.gst:2` |
| Katalog **Orcs and Goblins** | `4049-c46d-7f80-44fb` | `.cat:2` |
| Bibliothek **Mercenaries** (per `catalogueLink` `b066-2f8e-11ee-1dce`) | `fc47-8392-a6c8-452a` | — |
| `costType` **„ Casting Dice"** (`defaultCostLimit="-1"`) — das `field` der Bedingung | **`fcec-2340-6368-a2ba`** | `.gst:14` |
| `costType` „pts" | `ecfa-8486-4f6c-c249` | `.gst:13` |
| ForceEntry **„Standard (OG-AB)"** | `2bfa-e64a-7123-895f` | `.cat:47` |
| — dessen `categoryLink` *Special list rules* | `0636-2809-bf71-0f02` → `32f1-197f-d719-a393` | `.cat:50` |
| SelectionEntry **„Army composition rules"** (`hidden="true"`, ohne Grenzen) | `6fcf-b33d-3cf5-b56a` | `.cat:11529` |
| — dessen primärer `categoryLink` | `3da4-efb0-d2dc-3dba` → `32f1-197f-d719-a393` | `.cat:11618` |
| SelectionEntryGroup **„Ruleset restriction"** (`hidden="false"`, ohne Grenzen) | `43b3-35c6-d7cc-e3c6` | `.cat:11531` |
| **Träger** SelectionEntry **„Tournament rules: Uprising (2026)"** (`hidden="true"`) | `4bc4-8781-2091-d9df` | `.cat:11533` |
| — **der gepinnte Modifikator**: `add field="error"`, Text `No more than 10 power die are allowed!⏎See [PDF, p.X]` | (unbenannt) | `.cat:11558-11563` |
| — **die gepinnte Bedingung**: `greaterThan value="10" field="fcec-2340-6368-a2ba" scope="roster" childId="any" shared includeChildSelections includeChildForces` | (unbenannt) | `.cat:11561` |
| — dessen einzige Grenze `max 0`, `scope="force"` (per `set 1` gehoben) | `00f6-c1b3-ee85-5c02` | `.cat:11611` / `:11580-11589` |
| — `set hidden=false` mit derselben `and`-Gruppe (bewusst nicht gepinnt) | (unbenannt, `field="hidden"`) | `.cat:11570-11579` |
| — Nachbar-Meldung „gleiche Special Choice" (konstant still, `count: 0`) | (unbenannt) — Ziele `c679-3389-ca76-2ea1`, `4112-026b-500a-b6fd` | `.cat:11535-11557` |
| — Nachbar-Meldung „Special Characters" (konstant still, `count: 0`) | (unbenannt) — Kategorie `0644-bfcd-32c2-21dc` | `.cat:11564-11569` |
| — Nachbar-Meldung „Large Targets" (konstant still) | (unbenannt) — Ziele `7645ed71-72bd-4b72-89ab-22571a0a8b0c`, `b184-b03c-693b-53b1` | `.cat:11590-11608` |
| Einheit **„Orc Great Shaman"** (180 pts, 0 Casting Dice) | `aa57-63c4-136b-4af5` | `.cat:336`, Kosten `:467-471` |
| — `categoryLink` *Lord* (primär) / *Characters* | `e6b9-d7ad-c1ba-6af0` → `d024-d25b-a9b4-73b6` / `75e3-1b05-8910-e2c0` → `7a1c-d611-c2dc-def1` | `.cat:343` / `:344` |
| — Pflicht-Kind „Choppa" (`min`/`max` 1, 0 pts, 0 CD) | `051b-bb88-69f3-6eb6` — `12fa-412a-3927-39e9` / `0a6b-7450-63a5-825e` | `.cat:347`, `:349`, `:350` |
| — Pflicht-Gruppe „Magic Level" (`min`/`max` 1) | `3aea-621a-cde8-b4f6` — `56e7-cf73-36d9-421f` / `e61c-2c49-1872-a290` | `.cat:427`, `:429`, `:430` |
| — — **„Level 4 Shaman"** (35 pts, **4** Casting Dice) | `66e0-fd8f-7578-d1b1` | `.cat:443`, Kosten `:447-451` |
| — — „Level 3 Shaman" (0 pts, 3 Casting Dice; nicht benutzt) | `9888-4923-f6d5-157a` | `.cat:433`, Kosten `:437-441` |
| — „Mounts"-Gruppe `min 0` (kein Pflicht-Reittier in diesem Kontingent) | `1b40-9a15-a41c-9cd6` (`set 1` gattert auf `1f55-c922-66d8-08ef`) | `.cat:377`, `:409-413` |
| Einheit **„Orc Shaman"** (65 pts, 0 Casting Dice) | `e4cf-8043-5127-dd26` | `.cat:1966`, Kosten `:2097-2101` |
| — `categoryLink` *Heroes* (primär) / *Characters* / *Orc* | `7303-f945-df41-d6f8` → `c16b-f319-2c62-2c12` / `2e2e-f65b-1341-47f9` → `7a1c-d611-c2dc-def1` / `0721-ab49-a27c-a7ae` → `d4a7-5999-8207-4efe` | `.cat:1974` / `:1973` / `:1975` |
| — Pflicht-Kind „Choppa" (`min`/`max` 1, 0 pts, 0 CD) | `3ff4-4fc9-03d2-ee1f` — `c893-22e3-2330-caa5` / `8aab-89d3-9a37-fa2a` | `.cat:1978`, `:1980`, `:1981` |
| — Pflicht-Gruppe „Magic Level" (`min`/`max` 1, `defaultSelectionEntryId="eb20…"`) | `bbf1-6402-24b4-5794` — `5c9d-253a-6b37-4c1f` / `dbc6-86d9-026c-7549` | `.cat:2057`, `:2059`, `:2060` |
| — — **„Level 1 Shaman"** (0 pts, **1** Casting Die) | `eb20-c898-6345-c1b3` | `.cat:2063`, Kosten `:2067-2071` |
| — — **„Level 2 Shaman"** (35 pts, **2** Casting Dice) | `9d6d-45b0-8cf3-7a10` | `.cat:2073`, Kosten `:2077-2081` |
| — „Mounts"-Gruppe `min 0` | `4194-dd10-a476-18d0` (`set 1` gattert auf `1f55-c922-66d8-08ef`) | `.cat:2007`, `:2039-2043` |
| Kategorie *Characters* — Randbedingung `max 3`, per `set` auf **4** (2000–2999 pts) | `7a1c-d611-c2dc-def1` — **`c3c3-a80c-e026-200f`** | `.gst:641`, `:644`, `:671-682` |
| Kategorie *Lord* — `max 1`, per `set` auf 1 (2000–2999 pts) | `d024-d25b-a9b4-73b6` — `fda5-91c2-e17f-774c` | `.gst:220`, `:363`, `:252-263` |
| Kategorie *Heroes* — `max -1` (unbegrenzt) | `c16b-f319-2c62-2c12` — `7fca-63fb-63d2-9dad` | `.gst:366`, `:368` |
| Kategorie *Special Characters* (Zähl-Ziel der Nachbar-Meldung; nie besetzt) | `0644-bfcd-32c2-21dc` | `.gst:211` |
| Nicht benutzte Casting-Dice-Träger (Special Characters) | *Wurrzag Ud Ura Zahubu* `74d1-13e5-d030-0577` (Zauberstufe `e217-462d-c3bb-d324`, 4 CD) / *Azhag the Slaughterer* `3bef-161e-6c48-0016` (2 CD) | `.cat:7954`/`:8067`, `:9079`/`:9225` |
| Zusatz-Diagnosen ohne Belang: Core-Pflicht / General-Pflicht | `35c2-d478-392a-aeb1` / `1077-7379-f142-f382` | `.gst:374` / `:724` |
| Budget-Regel (Engine-Regel, roster-weit; in allen Rostern still) | `budget::ecfa-8486-4f6c-c249` | keine Katalogquelle |
