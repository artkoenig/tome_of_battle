# E2E-Regeln & Testkatalog: `atLeast` auf `limit::<costTypeId>` mit `scope="roster"` (das eingestellte Punktebudget)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln,
Constraint-Ids und Erwartungswerte sind **ausschließlich aus den Katalogdaten**
der *6th Definitive Edition* (`src/evaluator/__fixtures__/whfb6-definitive/`)
und der Formatspezifikation
([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md),
§7.7 und §13.2) abgeleitet — nicht aus einem Engine-Lauf. Die Roster-Form ist an
den bestehenden Szenarien verifiziert (direktes `entryId`, `entryLinkId=""`,
verschachtelte `selections` mit `number`, `<costLimits><costLimit typeId=…/></costLimits>`
für das eingestellte Budget).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1) — Träger der Kostenart **`pts`**
  `ecfa-8486-4f6c-c249` (`.gst:13`, `defaultCostLimit="-1"`)
- Armeebuch: `Orcs and goblins (6th definitive edition).cat`
  (`4049-c46d-7f80-44fb`, rev 1, `.cat:2`) — Kontingent **„Standard (OG-AB)"**
  `2bfa-e64a-7123-895f` (`.cat:47`)
- Bibliothek: `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`) —
  per `catalogueLink` `b066-2f8e-11ee-1dce` deklarierte Abhängigkeit der
  O&G-`.cat` (`.cat:14915-14917`)

---

## Die Regel (In-World)

`field="limit::<costTypeId>"` bezeichnet laut
[§13.2](../../battlescribe-data-format.md#132-der-field-wert-je-nach-kontext)
*„das **Kostenlimit** (Budget) der Roster für diese Kostenart"* — also den Wert,
den der `<costLimits>`-Block am `<roster>`-Wurzelelement setzt, **nicht** die
Summe der Kosten der gewählten Auswahlen. `childId="any"` benennt bei einer
zählenden Query „alles im Rahmen"; hier ist damit **nichts weiter auszuwählen** —
verglichen wird allein das Budget. `type="atLeast"` ist der **einschließende**
Vergleich: die Bedingung hält, sobald der Wert den `value` **erreicht** (≥), nicht
erst wenn er ihn überschreitet ([§7.7, Condition-Tabelle](../../battlescribe-data-format.md#condition--eine-voraussetzung),
[§13.1](../../battlescribe-data-format.md#131-wichtige-enum-werte)).

Der **Schwellenwert selbst** ist deshalb der stärkste Zeuge: bei genau `value`
muss der gegatterte Modifikator greifen, einen Punkt darunter nicht.

---

## Die Datenlage: das Uprising-Ruleset der O&G-`.cat`

```
selectionEntry "Army composition rules"   6fcf-b33d-3cf5-b56a   hidden="true"    (.cat:11529)
  └ selectionEntryGroup "Ruleset restriction" 43b3-35c6-d7cc-e3c6 hidden="false"  (.cat:11531)
       └ selectionEntry "Tournament rules: Uprising (2026)" 4bc4-8781-2091-d9df   (.cat:11533)
              hidden="true"
              constraint 00f6-c1b3-ee85-5c02  max 0 selections scope="force"      (.cat:11611)
```

Die Basisgrenze verbietet den Eintrag also zunächst vollständig (`max 0`). Zwei
Modifikatoren heben ihn — beide unter **derselben** `and`-Gruppe aus genau zwei
Mitgliedern auf demselben Kostenlimit:

| Modifikator | Wirkung | Bedingungen (`conditionGroup type="and"`) | Beleg |
|---|---|---|---|
| `set false` auf `field="hidden"` | der Eintrag wird sichtbar | `atLeast 2000` **∧** `atMost 2500` auf `limit::ecfa-8486-4f6c-c249`, `scope="roster"`, `childId="any"` | `.cat:11570-11579` (Bedingungen `:11574`/`:11575`) |
| `set 1` auf `field="00f6-c1b3-ee85-5c02"` | die Grenze wird von `max 0` auf `max 1` gehoben | **identische** Gruppe, identische Werte | `.cat:11580-11589` (Bedingungen `:11584`/`:11585`) |

Netto (In-World): *„Das Turnier-Ruleset ‚Uprising (2026)' ist genau für Listen
gebaut, deren Budget zwischen 2000 und 2500 Punkten liegt — nur dort darf es
gewählt werden."*

Beide Roster-Paare halten das **`atMost`-Mitglied konstant wahr** (1999 ≤ 2500
und 2000 ≤ 2500), so dass der Umschlag ausschließlich vom `atLeast`-Mitglied
getrieben wird.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **ARPL-R1** | **Basis:** Der Eintrag „Tournament rules: Uprising (2026)" trägt genau **eine** Grenze: `max 0` Auswahlen je Kontingent (`field="selections"`, `scope="force"`, `shared="true"`, `includeChildSelections="false"`). Steht er ohne wirksamen Modifikator im Kontingent, ist `actual` die Zahl seiner Selektionen dort, `bound` der wirksame `value`. | O&G-`.cat:11611`: `<constraint type="max" value="0" field="selections" scope="force" shared="true" id="00f6-c1b3-ee85-5c02" includeChildSelections="false"/>`. Die Id kommt im ganzen Fixture-Datensatz **genau zweimal** vor: als Grenze (`:11611`) und als `field` des Modifikators (`:11580`) — kein weiterer Schreiber. |
| **ARPL-R2** | **`limit::<costTypeId>` ist das eingestellte Budget, nicht die Summe.** Das `field` der Bedingung liest den `<costLimit typeId="ecfa-8486-4f6c-c249">`-Wert der Roster. In den Rostern 01/02 ist die verplante Summe konstant **0** — allein das gesetzte Budget unterscheidet sie, und nur unter der Budget-Lesart kann sich das Ergebnis überhaupt ändern. | [§13.2](../../battlescribe-data-format.md#132-der-field-wert-je-nach-kontext): *„`limit::<costTypeId>` = das Kostenlimit (Budget) der Roster für diese Kostenart"*; Kostenart `.gst:13`. Bedingungen O&G-`.cat:11584`. |
| **ARPL-R3** | **`atLeast` schließt den Schwellenwert ein.** Bei Budget **genau 2000** hält `atLeast 2000`; bei **1999** hält es nicht. Da `atMost 2500` in beiden Fällen wahr bleibt, entscheidet allein dieses eine Mitglied über die `and`-Gruppe ([§7.7](../../battlescribe-data-format.md#conditiongroup--verknüpfung-mehrerer-bedingungen): eine `and`-Gruppe hält, wenn **alle** Mitglieder halten). | O&G-`.cat:11584` (`atLeast value="2000"`), `:11585` (`atMost value="2500"`); Vergleichs-Semantik [§7.7/§13.1](../../battlescribe-data-format.md#131-wichtige-enum-werte). |
| **ARPL-R4** | **`childId="any"` fordert keine weitere Auswahl.** Die Bedingung zählt nichts im Roster, sondern vergleicht das Budget mit `value`. Die Roster brauchen darum außer der Trägerauswahl **keinerlei** Inhalt — die Vergleichsgröße ist ohne jede Selektion definiert. | O&G-`.cat:11584` (`childId="any"`, `shared="true"`, `includeChildSelections="true"`, `includeChildForces="true"` — alles Zähl-Flags ohne Zählgegenstand); [§13.2](../../battlescribe-data-format.md#132-der-field-wert-je-nach-kontext), Zeile zu `childId`. |
| **ARPL-R5** | **Wirksame Grenze je Budget:** Budget **1999** → `and`-Gruppe falsch → Grenze bleibt auf Basis **0** → mit einer Uprising-Selektion feuert `00f6…` mit **Ist 1 / Grenze 0**. Budget **2000** → Gruppe wahr → `set 1` → **Ist 1 ≤ Grenze 1** → `00f6…` feuert **nicht**. | ARPL-R1–R4 kombiniert; `set`-Semantik [§7.7](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat): der `value` **ersetzt** den Grenzwert. |
| **ARPL-R6** | **Der Träger ist im Kontingent erreichbar.** „Army composition rules" (`6fcf…`) trägt primär die Kategorie *Special list rules* `32f1-197f-d719-a393`, die das Kontingent „Standard (OG-AB)" per `categoryLink` führt. Weder der Eintrag noch die Gruppe „Ruleset restriction" tragen eigene Grenzen — es gibt keine konkurrierende Schranke auf diesem Pfad. | O&G-`.cat:11617-11619` (`categoryLink` `3da4-efb0-d2dc-3dba` → `32f1-197f-d719-a393`, `primary="true"`); Kontingent `:47`, dessen `categoryLink` `0636-2809-bf71-0f02` → `32f1…` (`:50`). Gruppe `:11531` ohne `<constraints>`, Elterneintrag `:11529` ohne `<constraints>`. |
| **ARPL-R7** | **Die übrigen Modifikatoren des Trägers bleiben in allen drei Rostern inert.** Die vier `add`/`error`-Modifikatoren verlangen jeweils Selektionen bzw. Kostenwerte, die keines der Roster enthält: „gleiche Special Choice > 1" (`c679…`/`4112…`), „> 10 Casting Dice" (Kostenart `fcec-2340-6368-a2ba`, alle gewählten Einträge 0), „Special Characters ≥ 1" (Kategorie `0644-bfcd-32c2-21dc`), „> 1 Large Target" (`7645ed71…`/`b184…`). Keiner von ihnen berührt `00f6…`. | O&G-`.cat:11534-11557`, `:11558-11563`, `:11564-11569`, `:11590-11608`. |
| **ARPL-R8** | **Roster 03 (Gegenprobe „Summe ≠ Budget"):** Eine Einheit *Orc Boyz* (`ac23-b9d3-4046-23b7`, Einheit selbst **0** pts) mit **400** Modellen à **5** pts ergibt eine verplante Summe von exakt **2000** pts — dem Schwellenwert. Bei Budget **1999** bleibt die Bedingung dennoch falsch. Die roster-weite Budget-Regel bezeugt die Summe: **Ist 2000 / Grenze 1999**. | O&G-`.cat:3007` (Einheit, Kosten `:3186` = 0), `:3020` (Modell `cef0-77ce-8158-32d4`), `:3028` (`cost pts value="5"`), `:3022` (`min 10` parent — mit 400 erfüllt), `:3023` (`max -1` = unbegrenzt). Kostenrechnung wie im Szenario [`orcs-and-goblins-budget`](../orcs-and-goblins-budget/README.md) (30 Modelle = 150 pts). Budget-Grenz-Id `budget::ecfa-8486-4f6c-c249` ebenda (OGB-R2, strikte Überschreitung). |

### Wahrheitstafel — die Mitglieder je Roster

| Roster | eingestelltes Budget | verplante Summe | `atLeast 2000` | `atMost 2500` | **`and`-Gruppe** | wirksame Grenze `00f6…` | Ist |
|---|---|---|---|---|---|---|---|
| 01 | **2000** | 0 | ✓ (Kante) | ✓ | **✓** | **1** (`set 1`) | 1 → still |
| 02 | **1999** | 0 | **✗** | ✓ | **✗** | **0** (Basis) | 1 → feuert |
| 03 | **1999** | **2000** | **✗** | ✓ | **✗** | **0** (Basis) | 1 → feuert |

### Was eine falsche Lesart produzieren würde

| Fehl-Lesart | Roster 01 (Budget 2000) | Roster 02 (Budget 1999) | Roster 03 (Budget 1999, Summe 2000) |
|---|---|---|---|
| `limit::…` als **Kostensumme** gelesen | Summe 0 < 2000 → Gruppe falsch → `00f6…` feuert Ist 1 / Grenze 0 → **fällt auf** | konform | Summe 2000 ≥ 2000 **und** ≤ 2500 → Gruppe wahr → `00f6…` still → **fällt auf** |
| `limit::…` als **Maximum aus Summe und Budget** gelesen | konform | konform | wie oben → `00f6…` still → **fällt auf** |
| `atLeast` als **ausschließend** (>) gelesen | 2000 > 2000 falsch → Gruppe falsch → `00f6…` feuert → **fällt auf** | konform | konform |
| `atLeast` als **≤**/`atMost` verwechselt | 2000 ≤ 2000 wahr → zufällig konform | 1999 ≤ 2000 wahr → `00f6…` still statt feuern → **fällt auf** | dito → **fällt auf** |
| `childId="any"` als **Zählung von Auswahlen** gelesen (Rahmen zählt 1–2 Selektionen) | Zähler ≪ 2000 → Gruppe falsch → `00f6…` feuert → **fällt auf** | konform | Zähler ≪ 2000 → konform |
| Bedingung **ignoriert** (`set` greift unbedingt) | konform | Grenze 1 statt 0 → `00f6…` still → **fällt auf** | dito → **fällt auf** |
| Bedingung **immer falsch** (fail-closed missverstanden) | Grenze bleibt 0 → `00f6…` feuert → **fällt auf** | konform | konform |

Roster **01** ist der Kernfall: der Schwellenwert **selbst** muss halten, obwohl
die Roster nichts kosten. Roster **02** ist derselbe Aufbau einen Punkt darunter
— zwischen beiden ändert sich **nur** die Zahl im `<costLimit>`-Attribut, also
kann der Umschlag keiner anderen Ursache zugeschrieben werden. Roster **03**
trennt Budget und Summe explizit.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle laufen gegen
denselben Datensatz (`.gst` + O&G-`.cat` + Mercenaries-`.cat`).

> **Assertion-Fokus:** die Grenze `00f6-c1b3-ee85-5c02`, der `effectiveMax` des
> besetzten Uprising-Slots und (in Roster 03) die roster-weite Budget-Grenze
> `budget::ecfa-8486-4f6c-c249`. Andere Armeeaufbau-Diagnosen des Kontingents —
> namentlich die Core-Pflicht `35c2-d478-392a-aeb1` und die General-Pflicht
> `1077-7379-f142-f382` — dürfen zusätzlich auftreten und sind hier ohne Belang
> (selektive Erwartung, Manifest-Vertrag). Sie stehen bewusst **nicht** in
> `absent`.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | Der Schwellenwert selbst öffnet das Gatter | Kontingent `2bfa…`, `costLimit` **2000** pts, genau eine Uprising-Selektion, verplante Summe 0. | **ARPL-R3/R5:** `atLeast 2000` hält an der Kante, `atMost 2500` ebenfalls → `set 1`. `00f6…` feuert **nicht**; der besetzte Slot meldet **`effectiveMax` 1** bei Ist 1. Kein Budget-Verstoß (0 ≤ 2000). | [`01-limit-2000-gate-open.ros`](rosters/01-limit-2000-gate-open.ros) |
| 02 | Ein Punkt darunter schließt es | **Identischer** Aufbau, `costLimit` **1999** pts. | **ARPL-R5:** Die `and`-Gruppe fällt allein am `atLeast`-Mitglied → kein `set`. `00f6…` feuert **Ist 1 / Grenze 0**; der Slot meldet **`effectiveMax` 0**. | [`02-limit-1999-gate-closed.ros`](rosters/02-limit-1999-gate-closed.ros) |
| 03 | Budget 1999, verplant 2000 — die Summe zählt nicht | Aufbau von 02 **plus** Orc Boyz mit 400 Modellen (Summe **2000** pts). | **ARPL-R2/R8:** Die Bedingung liest weiter das Budget (1999) → Gruppe falsch → `00f6…` feuert **Ist 1 / Grenze 0**, Slot `effectiveMax` 0. Die Budget-Regel `budget::ecfa-8486-4f6c-c249` feuert **Ist 2000 / Grenze 1999** und bezeugt die Summe. | [`03-limit-1999-spent-2000-gate-closed.ros`](rosters/03-limit-1999-spent-2000-gate-closed.ros) |

### Herleitung der Zahlen

- **`bound`** von `00f6-c1b3-ee85-5c02` ist der wirksame `value`: Katalogwert
  **0** (`.cat:11611`); greift der gegatterte `set`, dessen `value` **1**
  (`.cat:11580`). Herleitung je Roster in der Wahrheitstafel.
- **`actual`** ist die Zahl der Uprising-Selektionen im Kontingent
  (`field="selections"`, `scope="force"`). Jedes Roster enthält **genau eine**
  → konstant **1**. Genau diese Konstanz macht den `bound`-Umschlag zur einzigen
  Variablen.
- **`effectiveMax`** des besetzten Uprising-Slots ist dieselbe Grenze aus
  Slot-Sicht (der Eintrag trägt keine zweite `max`-Grenze), **`effectiveMin`**
  ist `null` (er trägt keine `min`-Grenze).
- **`budget::ecfa-8486-4f6c-c249`** in Roster 03: `actual` = 400 × 5 pts = **2000**
  (Modellkosten `.cat:3028`; Einheit, Choppa und Light Armour je 0 pts —
  `.cat:3186`, `:3050`, `:3064`), `bound` = eingestelltes `costLimit` **1999**.

### Was bewusst **nicht** Teil der Erwartung ist

| Facette | Warum nicht |
|---------|-------------|
| Der **zweite** gegatterte Modifikator `set hidden=false` (`.cat:11570-11579`) — also `isHidden` des Uprising-Slots. | Der Träger hängt unter dem Elterneintrag „Army composition rules" (`6fcf…`), der selbst `hidden="true"` ist und keinen Aufdeck-Modifikator trägt. Ob das `hidden` einer **Eltern-`selectionEntry`** auf die Slot-Projektion ihrer Kinder durchschlägt, legt die Formatreferenz **nicht** fest: [§8](../../battlescribe-data-format.md#8-kategorien--sichtbarkeit) regelt nur die Komposition `entryLink`↔Ziel und die Vererbung einer verborgenen **`selectionEntryGroup`** (die Gruppe „Ruleset restriction" ist hier `hidden="false"`). Eine `isHidden`-Behauptung wäre aus den erlaubten Quellen nicht ableitbar; dieselbe Auslassung trifft [`at-least-roster-border-patrols-gate`](../at-least-roster-border-patrols-gate/README.md) für Kind-Slots. Der Umschlag wird stattdessen am **zweiten**, gleich gegatterten Modifikator (`set 1` auf die Grenze) gepinnt — die Bedingung ist identisch, das Ergebnis zählbar. |
| Die **obere** Bracket-Kante (`atMost 2500`, `.cat:11585`). | Eigene Bedingungszelle (`atMost`). Sie wird hier **konstant wahr** gehalten (alle Budgets ≤ 2500), damit der Umschlag eindeutig dem `atLeast`-Mitglied zuzuschreiben ist. |
| Die vier `add`/`error`-Meldungen des Trägers (ARPL-R7). | Eigene Zelle (`modifier add field="error"`), bereits gepinnt von [`author-message-severity`](../author-message-severity/README.md) / [`author-message-tokens`](../author-message-tokens/README.md). In allen drei Rostern sind ihre Bedingungen falsch; behauptet wird das nicht. |
| Die weiteren Fundstellen desselben Konstrukts (30 in der `.gst`, 1 in `Mercenaries`, 1 weitere in O&G). | In der `.gst` stehen sie fast durchgehend als `atLeast`/`lessThan`-Punkteleiter der Kategorie-Grenzen — deren Gruppenlogik pinnt bereits [`condition-group-and-points-bracket`](../condition-group-and-points-bracket/README.md) (dort mit `childId="model"`, einer anderen Zelle). Die `Mercenaries`-Fundstelle (`0-1 Amazon Serpent Priestess` `9ddd-69c8-644d-abc2`) gattert ein `add category` neben einer variablen `or`-Untergruppe und ließe sich nicht mit konstanten Geschwistern straddeln. |
| Der Fall **ohne** `<costLimits>` (`defaultCostLimit="-1"`, `.gst:13`). | Eigener Mechanismus (unaufgelöstes Budget, Diagnose `UNRESOLVED_BUDGET_LIMIT`), bereits gepinnt in [`orcs-and-goblins-budget`](../orcs-and-goblins-budget/README.md), Test 06. Alle Roster hier setzen ihr Budget explizit. |
| Core-/General-Pflichten und die parent-Mindestgrenzen der Orc-Boyz-Optionen in Roster 03. | Beiwerk des Armeeaufbaus; die Erwartung ist selektiv. Choppa und Light Armour sind mitgewählt (je 0 pts), damit Roster 03 möglichst wenig Nebenrauschen erzeugt. |

*Abgrenzung:* [`at-least-roster-border-patrols-gate`](../at-least-roster-border-patrols-gate/README.md)
pinnt `atLeast` + `scope="roster"` auf **`field="selections"`** mit einer
Ziel-`childId`; dieses Szenario pinnt dieselbe Vergleichsart auf
**`field="limit::<costTypeId>"`** mit `childId="any"` — eine Größe, die gar nicht
aus dem Roster-Inhalt kommt, sondern aus dessen **Budget-Einstellung**.

---

## Abgleich mit dem Engine-Bericht (Runner-Verifikation)

Die oben aus den Katalogdaten **abgeleiteten** Erwartungen treffen die Engine
erst im **Runner-Lauf** — der separate Verifikationsschritt, der nicht zur
(blinden) Autorenschaft gehört (siehe
[ADR 0033](../../adr/0033-evaluator-e2e-manifest-runner-und-black-box-autorenschaft.md)).
Abweichungen sind zu **untersuchen**, nicht durch Anpassen der Erwartung
wegzudefinieren. Die erwartungsgemäß heiklen Stellen:

1. **ARPL-R3** — ob `atLeast` den Schwellenwert wirklich **einschließt**
   (Roster 01 bei exakt 2000).
2. **ARPL-R2/R8** — ob `limit::…` das **eingestellte** `costLimit` liest und
   nicht die verplante Summe (Roster 03: Budget 1999, Summe 2000).
3. **ARPL-R1/R5** — ob der `set`-Modifikator auf die **Constraint-Id** den
   gemeldeten `bound` tatsächlich von 0 auf 1 hebt und ob eine
   `scope="force"`-`max`-Grenze am Träger dessen eigene Selektion zählt
   (`actual` 1) — dieselbe Konstruktion wie in
   [`at-least-force-toggle-gate`](../at-least-force-toggle-gate/README.md).
4. Die Slot-Adressierung: `defId 4bc4-8781-2091-d9df` + `anchorKind occupied`
   muss die eine Uprising-Auswahl eindeutig treffen (sie kommt je Roster genau
   einmal vor; `frameDefId`/`path` sind darum nicht gesetzt).

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Spielsystem WHFB 6th definitive | `0d13-7737-ea86-4662` (`.gst:2`) |
| Katalog **Orcs and Goblins** | `4049-c46d-7f80-44fb` (O&G-`.cat:2`) |
| Bibliothek **Mercenaries** (per `catalogueLink` `b066-2f8e-11ee-1dce`, `:14916`) | `fc47-8392-a6c8-452a` |
| `costType` „pts" (`.gst:13`) — Nenner von `limit::…` | `ecfa-8486-4f6c-c249` |
| ForceEntry **„Standard (OG-AB)"** (`:47`) | `2bfa-e64a-7123-895f` |
| — dessen `categoryLink` *Special list rules* (`:50`) | `0636-2809-bf71-0f02` → `32f1-197f-d719-a393` |
| SelectionEntry **„Army composition rules"** (`:11529`, `hidden="true"`, ohne Grenzen) | `6fcf-b33d-3cf5-b56a` |
| — dessen primärer `categoryLink` (`:11618`) | `3da4-efb0-d2dc-3dba` → `32f1-197f-d719-a393` |
| SelectionEntryGroup **„Ruleset restriction"** (`:11531`, `hidden="false"`, ohne Grenzen) | `43b3-35c6-d7cc-e3c6` |
| SelectionEntry **„Tournament rules: Uprising (2026)"** (`:11533`, `hidden="true"`) | `4bc4-8781-2091-d9df` |
| — dessen einzige Grenze `max 0`, `scope="force"` (`:11611`) | **`00f6-c1b3-ee85-5c02`** |
| — `set 1`-Modifikator darauf, `and`-Gruppe `atLeast 2000` ∧ `atMost 2500` (`:11580-11589`) | (unbenannt, `field="00f6-c1b3-ee85-5c02"`) |
| — `set hidden=false`-Modifikator mit **derselben** Gruppe (`:11570-11579`, bewusst nicht gepinnt) | (unbenannt, `field="hidden"`) |
| Budget-Grenze (Engine-Regel, roster-weit; Roster 03) | `budget::ecfa-8486-4f6c-c249` |
| Orc Boyz, Einheit (0 pts, `:3007`/`:3186`) — Punktequelle für Roster 03 | `ac23-b9d3-4046-23b7` |
| — Modell Orc Boyz (5 pts, `:3020`/`:3028`; `min 10` parent `158f-ed55-76f2-eba0`, `max -1` `2115-87d4-2ead-6ba1`) | `cef0-77ce-8158-32d4` |
| — Choppa (0 pts, `:3041`; `min/max 1` parent) | `f73d-18a2-089b-285e` |
| — Light Armour (0 pts, `:3055`; `min/max 1` parent) | `ee53-a14e-2084-9f87` |
| Kategorie *Core* (primär an Orc Boyz; Pflicht toleriert, nicht Gegenstand) | `64bf-efb4-9978-26df` — Constraint `35c2-d478-392a-aeb1` |
