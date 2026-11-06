# E2E-Regeln & Testkatalog: `atLeast` auf `limit::<costTypeId>` mit `scope="roster"` und `childId="model"` — die Lord-Slots der Bretonen

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln,
Constraint-Ids und Erwartungswerte sind **ausschließlich aus den Katalogdaten**
der *6th Definitive Edition* (`src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive/`)
und der Formatspezifikation
([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md),
§5.6, §7.6, §7.7, §13.2) sowie dem
[BSData-Wiki-Submodul](../../bsdata-catalogue-development-wiki/Data-structure-overview.md)
abgeleitet — nicht aus einem Engine-Lauf. Die Roster-Gestalt ist an den
bestehenden Szenarien verifiziert (direktes `entryId`, `entryLinkId=""` beim
Wurzeleintrag, `entryLinkId`/`entryGroupId` bei verlinkten bzw. gruppierten
Kindern, verschachtelte `selections` mit `number`, `<costLimits><costLimit
typeId=…/></costLimits>` für das eingestellte Budget — vgl.
[`at-least-self-equipment-save`](../at-least-self-equipment-save/rosters/06-lord-all-four-sv-2.ros)).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1) — Träger der Kostenart **`pts`**
  `ecfa-8486-4f6c-c249` (`.gst` Z. 13, `defaultCostLimit="-1"`)
- Armeebuch: `Bretonnia (6th definitive edition).cat` (`a5c3-073c-b4e8-4284`,
  rev 1, `.cat` Z. 2) — Kontingent **„Standard (BR-AB)"**
  `3a8b-8c11-beff-0534` (`.cat` Z. 5743)
- Bibliothek: `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`,
  `library="true"`) — per `catalogueLink 99a3-c59a-d610-9847` (`.cat` Z. 5848)
  deklarierte Abhängigkeit der Bretonnia-`.cat`; im Szenario selbst nicht benutzt
- Gepinnte Zelle des Deckungs-Inventars:
  `condition|atLeast|roster|limitValue|child=model`
  ([`worklist.json`](../worklist.json)) — deren erste beiden Beispiel-Fundstellen
  sind genau die hier getesteten Bedingungen am `categoryLink` „Lord"
  `d1d3-6362-e2f7-23c9`.

---

## Die Regel (In-World)

`field="limit::<costTypeId>"` bezeichnet laut
[§13.2](../../battlescribe/reference/tables.md#132-der-field-wert-je-nach-kontext)
*„das **Kostenlimit** (Budget) der Roster für diese Kostenart"* — also den Wert,
den der `<costLimits>`-Block am `<roster>`-Wurzelelement setzt, **nicht** die
Summe der Kosten der gewählten Auswahlen. `type="atLeast"` ist der
**einschließende** Vergleich: die Bedingung hält, sobald der Wert den `value`
**erreicht** (≥), nicht erst wenn er ihn überschreitet
([§7.7, Condition-Tabelle](../../battlescribe/building-blocks/modifier.md#condition--eine-voraussetzung),
[§13.1](../../battlescribe/reference/tables.md#131-wichtige-enum-werte)).

Und: **`childId` benennt bei dieser Feldart nichts Zählbares.** Das `childId`
einer Query legt fest, *welche Elemente gezählt werden*
([§13.2](../../battlescribe/reference/tables.md#132-der-field-wert-je-nach-kontext)) —
gezählt wird hier aber gar nichts, verglichen wird eine Roster-Einstellung. Die
drei Bedingungen am Lord-Link tragen `childId="model"`, der `repeat` daneben
`childId="any"`, und beide lesen **dieselbe** Größe: das eingestellte Budget. Ein
`childId="model"` darf also weder auf Modelle im Roster umschalten noch die
Bedingung entwerten.

In-World ist das die Punkteleiter der Lord-Slots: *„Unter 2000 Punkten führt eine
bretonische Armee keinen Lord; ab 2000 Punkten einen, und je weitere 1000 Punkte
einen mehr."*

---

## Die Datenlage: der `categoryLink` „Lord" im Kontingent „Standard (BR-AB)"

```
forceEntry "Standard (BR-AB)"  3a8b-8c11-beff-0534                        .cat Z. 5743
 ├ categoryLink "Characters" a1ce-5a55-3301-a65a → 7a1c-d611-c2dc-def1    .cat Z. 5748
 │    └ modifier increment 1 auf c3c3-a80c-e026-200f (unbedingt)          .cat Z. 5750
 └ categoryLink "Lord"       d1d3-6362-e2f7-23c9 → d024-d25b-a9b4-73b6    .cat Z. 5755
      ├ constraint  max 0  selections  scope="force"  shared="true"
      │             includeChildSelections="true" includeChildForces="false"
      │             id="d7e7-599d-12cf-1fd1"                              .cat Z. 5757
      ├ modifier decrement 1  auf d7e7-…                                  .cat Z. 5760
      │    └ condition atLeast 1000  limit::ecfa-8486-4f6c-c249  roster  childId="model"  Z. 5762
      ├ modifier increment 1  auf d7e7-…                                  .cat Z. 5765
      │    ├ repeat    value=1000 repeats=1  limit::ecfa-…  roster  childId="any"
      │    │           roundUp="false"                                    .cat Z. 5767
      │    └ condition atLeast 2000  limit::ecfa-…  roster  childId="model"   .cat Z. 5770
      └ modifier set -1       auf d7e7-…                                  .cat Z. 5773
           └ condition lessThan 0  limit::ecfa-…  roster  childId="model"     .cat Z. 5775
```

### Die zweite Grenze auf derselben Kategorie

[§5.6](../../battlescribe/files/game-system.md#56-force-entries-detachments) warnt
ausdrücklich: eine force-weite Kategoriegrenze kann **auch** an der
`categoryEntry`-Definition hängen. Für „Lord" ist das der Fall — die
`categoryEntry d024-d25b-a9b4-73b6` der `.gst` (Z. 220) trägt

```xml
<constraint type="max" value="1" field="selections" scope="parent" shared="true"
            id="fda5-91c2-e17f-774c" includeChildSelections="false"/>   <!-- .gst Z. 363 -->
```

samt eigener Punkteleiter aus `set`-Modifikatoren (`.gst` Z. 228–359) und einem
`set hidden="true"` unterhalb von 2000 Punkten (`.gst` Z. 222–227). Ebenso trägt
die Kategorie **Characters** `7a1c-d611-c2dc-def1` ihre eigene Grenze
`c3c3-a80c-e026-200f` (`max 3 selections scope="force"`, `.gst` Z. 644) mit
Punkteleiter (`.gst` Z. 647–718), die der Bretonnia-`categoryLink` unbedingt um 1
anhebt. Beide sind in den Erwartungen mitgeführt, damit **kein zweites Limit die
Aussage überrascht** — siehe ARLS-R7 und ARLS-R8.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **ARLS-R1** | **Basis:** Der `categoryLink` „Lord" des Kontingents trägt genau **eine** Grenze: `max 0` Auswahlen der Kategorie `d024-d25b-a9b4-73b6`, `field="selections"`, `scope="force"`, `shared="true"`, `includeChildSelections="true"`. `actual` ist die Zahl der Lord-Kategorie-Auswahlen im Kontingent, `bound` der wirksame `value`. Die Id kommt im gesamten Fixture-Datensatz **genau viermal** vor: als Grenze (Z. 5757) und als `field` der drei Modifikatoren (Z. 5760, 5765, 5773) — kein weiterer Schreiber. | Bretonnia-`.cat` Z. 5757; Grep über `src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive/` auf `d7e7-599d-12cf-1fd1`. Zählregel [§7.6](../../battlescribe/building-blocks/constraint.md#76-constraint) (Kategorie-Ziel ⇒ armeeweit; bei einer Ein-Kontingent-Liste identisch). |
| **ARLS-R2** | **`limit::<costTypeId>` ist das eingestellte Budget.** Alle vier Queries der drei Modifikatoren (drei `condition`, ein `repeat`) lesen `limit::ecfa-8486-4f6c-c249` mit `scope="roster"` — also den `<costLimit typeId="ecfa-8486-4f6c-c249">`-Wert des Rosters, nicht die Summe der Auswahlkosten. In allen sechs Rostern ist die verplante Summe konstant (131 bzw. 262 pts) und **weit** von jeder Schwelle entfernt; allein das gesetzte Budget unterscheidet die Fälle. | [§13.2](../../battlescribe/reference/tables.md#132-der-field-wert-je-nach-kontext): *„`limit::<costTypeId>` = das Kostenlimit (Budget) der Roster für diese Kostenart"*; Kostenart `.gst` Z. 13. Queries Bretonnia-`.cat` Z. 5762, 5767, 5770, 5775. |
| **ARLS-R3** | **`atLeast` schließt den Schwellenwert ein.** Bei Budget **genau 1000** hält `atLeast 1000`, bei 999 nicht; bei **genau 2000** hält `atLeast 2000`, bei 1999 nicht. Beide Kanten werden von unten und exakt auf ihnen angefahren. | Bedingungen Bretonnia-`.cat` Z. 5762 (`value="1000"`) und Z. 5770 (`value="2000"`); Vergleichssemantik [§7.7](../../battlescribe/building-blocks/modifier.md#condition--eine-voraussetzung) / [§13.1](../../battlescribe/reference/tables.md#131-wichtige-enum-werte). |
| **ARLS-R4** | **`childId="model"` ändert nichts.** Die drei Bedingungen tragen `childId="model"`, der `repeat` daneben `childId="any"` — beide vergleichen dieselbe Größe, weil `field="limit::…"` kein zählbares Ziel im Roster hat. Ein Roster kann diese Bedingungen deshalb **ohne jedes Modell** erfüllen; die Vergleichsgröße ist ohne jede Selektion definiert. Gegenprobe im Aufbau: die Roster enthalten **keine** Auswahl mit `type="model"` (der Lord ist `type="unit"`, alle seine Kinder sind `type="upgrade"`), und trotzdem müssen die Bedingungen ab 1000 bzw. 2000 halten. | `childId`-Bedeutung [§13.2](../../battlescribe/reference/tables.md#132-der-field-wert-je-nach-kontext) (*„welche Elemente gezählt werden"*); `type`-Attribute Bretonnia-`.cat` Z. 9 (`unit`), Z. 3457/3483 und `.gst` Z. 938/1032 (`upgrade`). |
| **ARLS-R5** | **Der `repeat` staffelt den `increment`.** `repeat value="1000" repeats="1"` auf demselben Budget-Feld wendet den Modifikator *„the number of times the parent modifier should apply each time the `Query` is met"* an — mit `roundUp="false"` also `floor(Budget / 1000) × 1` mal. Nur `increment`/`decrement`/`multiply` vervielfacht der Faktor (ein wiederholter `set` bliebe idempotent). | `repeat` Bretonnia-`.cat` Z. 5767; [BSData-Wiki, *Repeat*](../../bsdata-catalogue-development-wiki/Data-structure-overview.md); [§7.7](../../battlescribe/building-blocks/modifier.md#repeat--modifier-mehrfach-anwenden) und der Kasten *„Ein wiederholter `set` wächst nicht"*. |
| **ARLS-R6** | **Ein errechnetes `-1` ist „nichts erlaubt", kein Unbegrenzt-Sentinel.** Bei Budget 1000–1999 greift allein der `decrement 1` und zieht die Grenze von 0 auf **-1**. Dieser Wert steht nirgends geschrieben, er ist gerechnet — und der Sentinel gilt *„nur als hingeschriebener Wert"*: am `value` eines `constraint`s, am `value` eines `set`-Modifikators, an `defaultCostLimit` und am eingestellten `costLimit`. *„Ein **errechneter** negativer Wert (`increment`/`decrement`/`multiply`) ist dagegen **nie** unbegrenzt — ein Max, das rechnerisch auf `-1` fällt, heißt ‚nichts erlaubt', nicht ‚alles erlaubt'."* Der gemeldete `bound` ist deshalb **-1**, und eine Lord-Auswahl verletzt ihn. | [§7.6, Sentinel-Kasten](../../battlescribe/building-blocks/constraint.md#76-constraint) (Entscheidung aus Issue 079); Basiswert Bretonnia-`.cat` Z. 5757, `decrement` Z. 5760. Der einzige **geschriebene** `-1` an dieser Grenze steht am `set` (Z. 5773) — dessen Bedingung `lessThan 0` auf das Budget ist bei keinem der sechs Roster erfüllt. |
| **ARLS-R7** | **Die zweite Kategoriegrenze `fda5-91c2-e17f-774c` überrascht nicht.** Ihre `set`-Leiter trifft bei keinem Budget zwischen 500 und 1999 zu (die 0-Setzer verlangen Budget < 200, Budget 200–499 oder eine „Border Patrols rules"-Auswahl `4e15-0353-165f-5528`, die kein Roster hier enthält) — dort bleibt der geschriebene Basiswert **1**. Bei 2000–2999 setzt sie **1**, bei 3000–3999 **2**. Bei einem Lord (Roster 01–04) ist `actual ≤ 1 ≤ bound`, bei zwei Lords und Budget 3000 ist `actual 2 ≤ bound 2` — sie kann in diesen fünf Fällen unter keiner Lesart feuern und steht deshalb in `absent`. | `.gst` Z. 363 (Grenze), Z. 228–299 (die vier 0-/1-Setzer), Z. 264–275 (`set 2` für 3000–3999). |
| **ARLS-R8** | **Die Charaktergrenze `c3c3-a80c-e026-200f` überrascht nicht.** Der Bretonnian Lord trägt neben „Lord" auch die Kategorie „Characters" (`.cat` Z. 12). Deren `max`-Leiter liegt bei allen sechs Budgets bei **mindestens 3** (Basis 3; `set 4` ab 2000, `set 6` ab 3000), und der Bretonnia-`categoryLink` hebt sie zusätzlich unbedingt um 1. Bei einem bzw. zwei Charakteren ist `actual` höchstens 2 — die Grenze feuert in keinem Fall, unabhängig davon, in welcher Reihenfolge `set` und `increment` verrechnet werden. | `.gst` Z. 644 (Basis `max 3`), Z. 647–718 (Leiter); Bretonnia-`.cat` Z. 5750 (`increment 1`), Z. 12 (Kategoriezugehörigkeit des Lords). |
| **ARLS-R9** | **Wirksame Lord-Grenze je Budget** (Basis 0, dann `decrement`, dann `increment × repeat`; der `set -1` greift nie): **< 1000 → 0**, **1000–1999 → -1**, **2000–2999 → -1 + 2 = 1**, **3000–3999 → -1 + 3 = 2**. | ARLS-R1–R6 kombiniert. |
| **ARLS-R10** | **Der Lord ist im Kontingent erreichbar und katalogkonform gebaut.** „Bretonnian Lord" `bf54-da29-921a-e457` führt „Lord" als **primäre** Kategorie; das Kontingent führt diese Kategorie per `categoryLink`. Seine vier Pflichten sind in jedem Roster erfüllt: Vow-Gruppe `min 1` (`5352-…`) → *Knights Vow*, Mounts-Gruppe `min 1` (`8f92-…`) → *Bretonnian Warhorse*, *Hand Weapon* `min 1` (`1d32-…`) und *Heavy Armour* `min 1` (`fbf1-…`). | Bretonnia-`.cat` Z. 9/11 (Eintrag, primäre Kategorie), Z. 5755 (`categoryLink` des Kontingents), Z. 15–19 (Vow-Gruppe), Z. 99–103 (Mounts-Gruppe), Z. 209–214 (Hand Weapon), Z. 231–236 (Heavy Armour). |
| **ARLS-R11** | **Das Budget wird nie überschritten.** Ein Lord kostet 110 pts (`.cat` Z. 240); Knights Vow (`.cat` Z. 3465), Hand Weapon (`.gst` Z. 1041) und Heavy Armour (`.gst` Z. 946) je 0 pts; das Warhorse 21 pts am Verweis (`.cat` Z. 131) bzw. 14 pts an der Definition (`.cat` Z. 3493) — höchstens **131** pts je Lord. Kleinstes Budget ist 999, größte Summe 262 bei Budget 2999. Die roster-weite Budget-Regel steht deshalb überall in `absent`. | Kostenregel [§7.2](../../battlescribe/building-blocks/links.md#72-entry-link-info-link-category-link) (*„die Kosten liegen am Link, nicht an der Definition"*); die Aussage hält unter beiden Lesarten. |

### Wahrheitstafel — die Bedingungen je Budget

| Roster | eingestelltes Budget | Lords | `atLeast 1000` | `atLeast 2000` | `repeat`-Faktor `floor(B/1000)` | wirksame Grenze `d7e7…` | Ist | Ergebnis |
|---|---|---|---|---|---|---|---|---|
| 01 | **999** | 1 | ✗ | ✗ | – | **0** (Basis) | 1 | feuert |
| 02 | **1000** | 1 | ✓ (Kante) | ✗ | – | **-1** (0 − 1) | 1 | feuert |
| 03 | **1999** | 1 | ✓ | ✗ | – | **-1** | 1 | feuert |
| 04 | **2000** | 1 | ✓ | ✓ (Kante) | 2 | **1** (0 − 1 + 2) | 1 | still |
| 05 | **2999** | 2 | ✓ | ✓ | 2 | **1** | 2 | feuert |
| 06 | **3000** | 2 | ✓ | ✓ | 3 | **2** (0 − 1 + 3) | 2 | still |

### Was eine falsche Lesart produzieren würde

| Fehl-Lesart | fällt auf bei |
|---|---|
| `atLeast` **ausschließend** (`>`) gelesen | Roster 02 (Grenze bliebe 0 statt -1) und Roster 04 (Grenze bliebe -1 statt 1 → feuerte). |
| `atLeast` mit `atMost`/`≤` verwechselt | Roster 01 (Grenze fiele auf -1) und Roster 04/06 (die Leiter kippte um). |
| `limit::…` als **Kostensumme** gelesen (131 bzw. 262 pts) | **alle sechs** — keine Bedingung hielte je, die Grenze bliebe überall 0, Roster 04 und 06 feuerten. |
| `childId="model"` als **Modell-Zählung** gelesen | alle Roster ab 1000: die Roster enthalten keine einzige `type="model"`-Auswahl, der Zähler wäre 0 und keine Bedingung hielte → Roster 04/06 feuerten. |
| Errechnetes `-1` als **unbegrenzt** gelesen | Roster 02 und 03 — die Grenze meldete nichts statt `Ist 1 / Grenze -1`. |
| Errechnetes `-1` auf **0 geklemmt** | Roster 02 und 03 — der `bound` wäre 0 statt -1 (der Verstoß selbst bliebe). |
| `repeat` **ignoriert** (Modifikator nur einmal angewendet) | Roster 04 (Grenze 0 statt 1 → feuerte) und Roster 06 (Grenze 0 statt 2). |
| `repeat`-Faktor **aufgerundet** (`roundUp` missachtet) | Roster 05 (Faktor 3 statt 2 → Grenze 2, kein Verstoß). |
| Grenze wegen **verborgener** Lord-Kategorie unterdrückt (Budget < 2000) | Roster 01–03 — die Max-Grenze muss trotz `hidden` melden ([§8](../../battlescribe/building-blocks/category-and-visibility.md#8-kategorien--sichtbarkeit)). |
| Nur `categoryLink`-Grenzen gelesen, `categoryEntry`-Grenze übersehen | nicht hier — beide sind in den Erwartungen geführt (ARLS-R7); die Auslassung fiele in einem Szenario mit `actual > 1` bei kleinem Budget auf. |
| Alle Auswahlen **unterhalb** des Lords in die Kategorie gezählt (`includeChildSelections`) | Roster 04 und 06 — `actual` wäre 5 statt 1 bzw. 10 statt 2 und die Grenze feuerte. |

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle laufen gegen
denselben Datensatz (`.gst` + Bretonnia-`.cat` + Mercenaries-`.cat`).

> **Assertion-Fokus:** die Grenze `d7e7-599d-12cf-1fd1` und der `effectiveMax`
> des Lord-Kategorie-Ankers; begleitend die zweite Kategoriegrenze
> `fda5-91c2-e17f-774c`, die Charaktergrenze `c3c3-a80c-e026-200f` und die
> Budget-Regel `budget::ecfa-8486-4f6c-c249` als Nicht-Feuern. Andere
> Armeeaufbau-Diagnosen des Kontingents — namentlich die Core-Pflicht
> `35c2-d478-392a-aeb1` (`.gst` Z. 374) und die General-Pflicht
> `1077-7379-f142-f382` (`.gst` Z. 721 ff.) — dürfen zusätzlich auftreten und
> sind hier ohne Belang (selektive Erwartung, Manifest-Vertrag). Sie stehen
> bewusst **nicht** in `absent`.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | Unter der ersten Schwelle: die geschriebene Basis | Ein katalogkonformer Bretonnian Lord, `costLimit` **999** pts. | **ARLS-R9:** Keine Bedingung hält, die Grenze bleibt **0**. `d7e7…` feuert **Ist 1 / Grenze 0**; der Kategorie-Anker „Lord" meldet Ist 1 bei `effectiveMax` 0. | [`01-limit-999-lord-max-0.ros`](rosters/01-limit-999-lord-max-0.ros) |
| 02 | Der Schwellenwert 1000 selbst senkt die Grenze | **Identischer** Aufbau, `costLimit` **1000** pts. | **ARLS-R3/R6:** `atLeast 1000` hält an der Kante → `decrement 1` → Grenze **-1**. Das ist kein „unbegrenzt", sondern „nichts erlaubt": `d7e7…` feuert **Ist 1 / Grenze -1**. | [`02-limit-1000-lord-max-minus-1.ros`](rosters/02-limit-1000-lord-max-minus-1.ros) |
| 03 | Ein Punkt unter der zweiten Schwelle | **Identischer** Aufbau, `costLimit` **1999** pts. | **ARLS-R3:** `atLeast 2000` hält nicht → kein `increment`, Grenze weiter **-1**. `d7e7…` feuert **Ist 1 / Grenze -1**. | [`03-limit-1999-lord-max-minus-1.ros`](rosters/03-limit-1999-lord-max-minus-1.ros) |
| 04 | Der Schwellenwert 2000 selbst öffnet den Slot | **Identischer** Aufbau, `costLimit` **2000** pts. | **ARLS-R3/R5/R9:** `atLeast 2000` hält an der Kante, der `repeat` zählt 2 Wiederholungen → Grenze **-1 + 2 = 1**. `d7e7…` feuert **nicht**; der Kategorie-Anker meldet Ist 1 bei `effectiveMax` **1**, `headroom` 0, `isBlocked`. | [`04-limit-2000-lord-max-1.ros`](rosters/04-limit-2000-lord-max-1.ros) |
| 05 | Oberes Ende des 2000er-Plateaus, zwei Lords | **Zwei** gleich gebaute Lords, `costLimit` **2999** pts. | **ARLS-R5/R9:** Faktor weiter 2 → Grenze **1**. `d7e7…` feuert **Ist 2 / Grenze 1**; der Kategorie-Anker meldet Ist 2 bei `effectiveMax` 1. | [`05-two-lords-limit-2999-max-1.ros`](rosters/05-two-lords-limit-2999-max-1.ros) |
| 06 | Ein Punkt weiter — die Leiter steigt | **Identischer** Aufbau wie 05, `costLimit` **3000** pts. | **ARLS-R5/R9:** Faktor 3 → Grenze **-1 + 3 = 2**. `d7e7…` feuert **nicht**; der Kategorie-Anker meldet Ist 2 bei `effectiveMax` **2**, `headroom` 0, `isBlocked`. | [`06-two-lords-limit-3000-max-2.ros`](rosters/06-two-lords-limit-3000-max-2.ros) |

### Herleitung der Zahlen

- **`bound`** von `d7e7-599d-12cf-1fd1` ist der wirksame `value`: Katalogwert
  **0** (`.cat` Z. 5757), verrechnet mit den greifenden Modifikatoren nach
  ARLS-R9. Die Rechnung steht vollständig in der Wahrheitstafel; sie stammt
  ausschließlich aus dem XML, nicht aus einem Lauf.
- **`actual`** ist die Zahl der Auswahlen der Kategorie `d024-d25b-a9b4-73b6` im
  Kontingent. Die Kinder des Lords (Vow, Hand Weapon, Heavy Armour, Warhorse)
  tragen **keine** `categoryLink`s und zählen darum nicht mit — trotz
  `includeChildSelections="true"`, das die *Reichweite* der Summe erweitert, nicht
  ihren *Gegenstand*. Also **1** (Roster 01–04) bzw. **2** (Roster 05/06).
- **`effectiveMax`** des Lord-Kategorie-Ankers ist dieselbe Grenze aus Slot-Sicht.
  Die zweite Grenze derselben Kategorie (`fda5-…`, ARLS-R7) steht bei den
  behaupteten Budgets auf demselben Wert (2000–2999 → 1, 3000–3999 → 2) bzw.
  darüber (999 → 1 gegen 0) — welche der beiden die engere ist, ändert das
  Ergebnis in keinem behaupteten Fall. **`effectiveMin`** ist `null`: auf dieser
  Kategorie gibt es in beiden Quellen keine `min`-Grenze.
- **`budget::ecfa-8486-4f6c-c249`** feuert nirgends: höchstens 262 verplante
  gegen mindestens 999 eingestellte Punkte (ARLS-R11).

### Was bewusst **nicht** Teil der Erwartung ist

| Facette | Warum nicht |
|---------|-------------|
| Das **`hidden`-Flag** des Lord-Kategorie-Ankers unterhalb von 2000 Punkten (`.gst` Z. 222–227: `set hidden="true"` bei `lessThan 2000` auf dasselbe Budget). | Eigene Bedingungszelle (`lessThan`) und eine Sichtbarkeits-, keine Zählaussage — der Verletzungsbericht kodiert zählende Grenzen. Für die hier gepinnte Grenze ist das Flag ohne Belang: [§8](../../battlescribe/building-blocks/category-and-visibility.md#8-kategorien--sichtbarkeit) und [§5.6](../../battlescribe/files/game-system.md#56-force-entries-detachments) stellen fest, dass nur **Min**-Grenzen einer effektiv versteckten Entität ungeprüft bleiben, *„Max-Grenzen gelten unabhängig von der Sichtbarkeit"*. In den Rostern 04–06 (Budget ≥ 2000) ist `isHidden: false` behauptet, weil dort schlicht kein Gatter greift; unterhalb von 2000 wird nichts behauptet. |
| Der **`effectiveMax`** des Kategorie-Ankers in den Rostern 02 und 03 (rechnerisch **-1**). | Ob die Slot-Projektion ein rechnerisch negatives Maximum unverändert ausweist oder bei 0 klemmt, legt die Formatreferenz **nicht** fest — sie entscheidet nur die *Bedeutung* (ARLS-R6: „nichts erlaubt"). Die Aussage über den Wert **-1** wird darum an genau einer Stelle geführt: am `bound` der feuernden Grenze. |
| Die Bedingung `lessThan 0` am `set -1`-Modifikator (`.cat` Z. 5773–5776). | Eigene Bedingungszelle (`lessThan`), und sie ist mit einem realen Budget nicht auslösbar: ein Budget < 0 gibt es nur als **hingeschriebenen** Sentinel `-1` („unbegrenzt", [§7.6](../../battlescribe/building-blocks/constraint.md#76-constraint)), dessen numerischer Vergleich mit 0 aus den erlaubten Quellen nicht ableitbar ist. Alle sechs Roster halten die Bedingung konstant falsch, behauptet wird das nicht. |
| Die zweite Kategoriegrenze `fda5-91c2-e17f-774c` in **Roster 05** (Budget 2999, zwei Lords). | Dort steht ihr `bound` auf 1 bei zwei Lord-Auswahlen — ob sie feuert, hängt daran, welchen Rahmen ihr `scope="parent"` an einer `categoryEntry` bezeichnet. Das legen weder Wiki noch Formatreferenz fest ([§7.6](../../battlescribe/building-blocks/constraint.md#76-constraint) nennt für `parent` nur den Vergleich aufgelöster Ziel-Ids). Sie steht deshalb in diesem einen Roster weder in `firing` noch in `absent`; in den fünf anderen kann sie unter **keiner** Lesart feuern (ARLS-R7). |
| Die **`shared="true"`-Wirkung** der Ausrüstungsgrenzen des Lords in den Rostern 05/06 (z. B. Warhorse `max 1 scope="parent" shared="true"`, `.cat` Z. 3485). | Bei **zwei** Trägern hängt das Ergebnis daran, ob `shared="true"` die Summe über alle Instanzen zieht ([§7.6](../../battlescribe/building-blocks/constraint.md#76-constraint)) — eine eigene Zelle. Diese Ids stehen darum nur in den Ein-Lord-Rostern 01–04 in `absent`, wo beide Lesarten zusammenfallen. |
| Core-Pflicht (`35c2-d478-392a-aeb1`) und General-Pflicht (`1077-7379-f142-f382`). | Beiwerk des Armeeaufbaus; die Erwartung ist selektiv. Ein Core-Regiment oder ein General-Upgrade würde nur Rauschen hinzufügen, ohne die Punkteleiter zu berühren. |
| Die weiteren 11 Fundstellen derselben Zelle (`Forces of Chaos` 10×, `Lizardmen` 1×, laut [`worklist.json`](../worklist.json)). | Dieselbe Konstruktion an anderen `categoryLink`s; die Zelle ist mit den zwei Bretonnia-Fundstellen und ihren beiden Kanten erschöpfend gestraddelt. |

*Abgrenzung:* [`at-least-roster-points-limit`](../at-least-roster-points-limit/README.md)
pinnt dieselbe Vergleichsart auf `field="limit::<costTypeId>"` mit
**`childId="any"`** an einer `set`-gegatterten Eintragsgrenze; dieses Szenario
pinnt sie mit **`childId="model"`** an einer **Kategoriegrenze**, deren Wert
`decrement`/`increment`-Arithmetik samt `repeat` durchläuft — inklusive des
Bereichs, in dem diese Arithmetik unter null fällt.
[`condition-group-and-points-bracket`](../condition-group-and-points-bracket/README.md)
pinnt die Klammerung mehrerer solcher Bedingungen zu einer `and`-Gruppe.

---

## Abgleich mit dem Engine-Bericht (Runner-Verifikation)

Die oben aus den Katalogdaten **abgeleiteten** Erwartungen treffen die Engine
erst im **Runner-Lauf** — der separate Verifikationsschritt, der nicht zur
(blinden) Autorenschaft gehört (siehe
[ADR 0033](../../adr/0033-evaluator-e2e-manifest-runner-und-black-box-autorenschaft.md)).
Abweichungen sind zu **untersuchen**, nicht durch Anpassen der Erwartung
wegzudefinieren. Die erwartungsgemäß heiklen Stellen:

1. **ARLS-R6** — ob ein rechnerisch auf **-1** gefallenes Maximum als „nichts
   erlaubt" gemeldet wird (Roster 02/03) und nicht als „unbegrenzt"
   verschluckt oder auf 0 geklemmt wird.
2. **ARLS-R3** — ob `atLeast` beide Schwellen wirklich **einschließt**
   (Roster 02 bei exakt 1000, Roster 04 bei exakt 2000).
3. **ARLS-R5** — ob der `repeat` den `increment` `floor(Budget/1000)`-mal
   anwendet (Roster 04/05: Faktor 2; Roster 06: Faktor 3).
4. **ARLS-R4** — ob `childId="model"` an einer `limit::`-Query folgenlos bleibt,
   obwohl keines der Roster eine `type="model"`-Auswahl enthält.
5. **ARLS-R1** — ob eine `scope="force"`-Grenze am `categoryLink` die
   **Kategorie**-Auswahlen des Kontingents zählt (`actual` 1 bzw. 2) und nicht
   alle Nachfahren des Lords.
6. Die Slot-Adressierung: `targetDefId d024-d25b-a9b4-73b6` +
   `anchorKind categoryAnchor` + `frameDefId 3a8b-8c11-beff-0534` muss den einen
   Lord-Kategorie-Anker des Kontingents eindeutig treffen (Muster verifiziert an
   [`offer-and-category-slots`](../offer-and-category-slots/scenario.json)).

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Spielsystem WHFB 6th definitive (`.gst` Z. 2) | `0d13-7737-ea86-4662` |
| Katalog **Bretonnia** (`.cat` Z. 2) | `a5c3-073c-b4e8-4284` |
| Bibliothek **Mercenaries** (per `catalogueLink 99a3-c59a-d610-9847`, `.cat` Z. 5848) | `fc47-8392-a6c8-452a` |
| `costType` „pts" (`.gst` Z. 13) — Nenner von `limit::…` | `ecfa-8486-4f6c-c249` |
| ForceEntry **„Standard (BR-AB)"** (`.cat` Z. 5743) | `3a8b-8c11-beff-0534` |
| — dessen `categoryLink` **„Lord"** (`.cat` Z. 5755, `primary="false"`) | `d1d3-6362-e2f7-23c9` → `d024-d25b-a9b4-73b6` |
| — — dessen einzige Grenze `max 0`, `field="selections"`, `scope="force"` (`.cat` Z. 5757) | **`d7e7-599d-12cf-1fd1`** |
| — — `decrement 1` darauf, `condition atLeast 1000` (`.cat` Z. 5760–5763) | (unbenannt, `field="d7e7-599d-12cf-1fd1"`) |
| — — `increment 1` darauf, `repeat` je 1000 pts + `condition atLeast 2000` (`.cat` Z. 5765–5771) | (unbenannt, `field="d7e7-599d-12cf-1fd1"`) |
| — — `set -1` darauf, `condition lessThan 0` (`.cat` Z. 5773–5777, nie erfüllt) | (unbenannt, `field="d7e7-599d-12cf-1fd1"`) |
| — dessen `categoryLink` **„Characters"** mit `increment 1` (`.cat` Z. 5748–5754) | `a1ce-5a55-3301-a65a` → `7a1c-d611-c2dc-def1` |
| CategoryEntry **„Lord"** (`.gst` Z. 220) — zweite Grenze `max 1`, `scope="parent"` (`.gst` Z. 363) | `d024-d25b-a9b4-73b6` — Constraint `fda5-91c2-e17f-774c` |
| — dessen `set hidden="true"` bei `lessThan 2000` (`.gst` Z. 222–227, bewusst nicht gepinnt) | (unbenannt, `field="hidden"`) |
| CategoryEntry **„Characters"** (`.gst` Z. 641) — Grenze `max 3`, `scope="force"` (`.gst` Z. 644) | `7a1c-d611-c2dc-def1` — Constraint `c3c3-a80c-e026-200f` |
| SelectionEntry **„Bretonnian Lord"** (`.cat` Z. 9, `type="unit"`, 110 pts) | `bf54-da29-921a-e457` |
| — dessen primärer `categoryLink` „Lord" (`.cat` Z. 11) | `1da4-f589-d2ab-f81d` → `d024-d25b-a9b4-73b6` |
| — dessen `categoryLink` „Characters" (`.cat` Z. 12) | `fe46-86f6-abd5-f2d1` → `7a1c-d611-c2dc-def1` |
| — Gruppe „Vow" (`.cat` Z. 15; `min` `5352-910f-fe13-a8f5` / `max` `d7b1-1663-7bd9-d8c4`) | `4533-c439-9afd-8a27` |
| — — *Knights Vow*, 0 pts (`.cat` Z. 21 Verweis, Z. 3457 Ziel; `max` `dde3-d464-c6d0-8ec8`) | `1858-1a94-5453-9f62` → `e432-4d78-0f50-1e35` |
| — Gruppe „Mounts" (`.cat` Z. 99; `max` `bb04-e762-5ef0-a6bc` / `min` `8f92-2c89-5335-8ce8`) | `99f3-9464-d966-2a3b` |
| — — *Bretonnian Warhorse*, 21 pts am Verweis (`.cat` Z. 129/131, Ziel Z. 3483; `max` `25d8-9ea5-9936-d44c` am Verweis, `d1fd-8f42-122a-e2b6` am Ziel) | `cf12-1619-f359-4462` → `adc2-53db-4a9e-b8ea` |
| — *Hand Weapon*, 0 pts (`.cat` Z. 209 Verweis, `.gst` Z. 1032 Ziel; `min` `1d32-3280-ccc4-5f89` / `max` `ce85-f523-bccd-ba01` am Verweis) | `50dd-7a6f-a038-a90b` → `abdb-bbd0-41b2-5dff` |
| — *Heavy Armour*, 0 pts (`.cat` Z. 231 Verweis, `.gst` Z. 938 Ziel; `max` `8df7-8f2d-4b60-a938` / `min` `fbf1-0ef9-150e-90da` am Verweis) | `d0d1-a2dc-5164-3b51` → `dde4-0ba8-7b3c-57b7` |
| „Border Patrols rules" — Auswahl, die die konkurrierenden Punkteleitern umschaltet und in **keinem** Roster steht | `4e15-0353-165f-5528` |
| Budget-Grenze (Engine-Regel, roster-weit; überall in `absent`) | `budget::ecfa-8486-4f6c-c249` |
| Kategorie *Core* — Pflicht toleriert, nicht Gegenstand (`.gst` Z. 372/374) | `64bf-efb4-9978-26df` — Constraint `35c2-d478-392a-aeb1` |
