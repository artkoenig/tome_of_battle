# E2E-Regeln & Testkatalog: `atMost` auf `limit::<costTypeId>` mit `scope="roster"` (die obere Kante des Punktefensters)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln,
Constraint-Ids und Erwartungswerte sind **ausschließlich aus den Katalogdaten**
der *6th Definitive Edition* (`src/domain/evaluator/__fixtures__/whfb6-definitive/`)
und der Formatspezifikation
([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md),
§7.7, §13.1 und §13.2) abgeleitet — nicht aus einem Engine-Lauf. Die Roster-Form
ist an den bestehenden Szenarien verifiziert (direktes `entryId`,
`entryLinkId=""`, verschachtelte `selections` mit `number`,
`<costLimits><costLimit typeId=…/></costLimits>` für das eingestellte Budget).

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
verglichen wird allein das Budget. `type="atMost"` ist der **einschließende**
Vergleich nach oben: die Bedingung hält, solange der Wert den `value` nicht
**überschreitet** (≤); bei genau `value` hält sie noch
([§7.7, Condition-Tabelle](../../battlescribe-data-format.md#condition--eine-voraussetzung),
[§13.1](../../battlescribe-data-format.md#131-wichtige-enum-werte)).

Die **obere Kante selbst** ist deshalb der stärkste Zeuge: bei genau `value`
muss der gegatterte Modifikator noch greifen, einen Punkt darüber nicht mehr.

> **Warum `atMost` ≠ `lessThan` aus den Daten folgt.** Die Aufzählung der XSD
> führt `lessThan` und `atMost` als **zwei verschiedene** Werte
> (`Catalogue.xsd:571-582`, `simpleType ConditionKind`), und die `.gst` benutzt
> beide nebeneinander als Punkteleiter derselben Kategorie: `lessThan 2000`
> (`.gst:224`) gegen `atLeast 2000` (`.gst:258`), `lessThan 3000` (`:259`) gegen
> `atLeast 3000` (`:270`) und so fort bis 11000 (`:355`). Diese Leiter
> **partitioniert** die Zahlengerade lückenlos und überschneidungsfrei — also
> schließt `lessThan` die Kante aus und `atLeast` sie ein. `atMost` ist der
> Spiegel von `atLeast` (`greaterThan` der von `lessThan`); wäre `atMost` strikt,
> hätte der Autor des Uprising-Rulesets — der die Leiter-Schreibweise kennt — das
> Fenster als `lessThan 2501` bzw. `lessThan 2500` geschrieben. Er schreibt
> stattdessen `atMost 2500` (O&G-`.cat:11585`).

---

## Die Datenlage: das Uprising-Ruleset der O&G-`.cat`

```
selectionEntry "Army composition rules"   6fcf-b33d-3cf5-b56a   hidden="true"    (.cat:11529)
  └ selectionEntryGroup "Ruleset restriction" 43b3-35c6-d7cc-e3c6 hidden="false"  (.cat:11531)
       └ selectionEntry "Tournament rules: Uprising (2026)" 4bc4-8781-2091-d9df   (.cat:11533)
              hidden="true"
              constraint 00f6-c1b3-ee85-5c02  max 0 selections scope="force"      (.cat:11611)
```

Die Basisgrenze verbietet den Eintrag zunächst vollständig (`max 0`). Zwei
Modifikatoren heben ihn — beide unter **derselben** `and`-Gruppe aus genau zwei
Bedingungen auf demselben Kostenlimit:

| Modifikator | Wirkung | Bedingungen (`conditionGroup type="and"`) | Beleg |
|---|---|---|---|
| `set false` auf `field="hidden"` | der Eintrag wird sichtbar | `atLeast 2000` **∧** `atMost 2500` auf `limit::ecfa-8486-4f6c-c249`, `scope="roster"`, `childId="any"` | `.cat:11570-11579` (Bedingungen `:11574`/`:11575`) |
| `set 1` auf `field="00f6-c1b3-ee85-5c02"` | die Grenze wird von `max 0` auf `max 1` gehoben | **identische** Gruppe, identische Werte | `.cat:11580-11589` (Bedingungen `:11584`/`:11585`) |

Netto (In-World): *„Das Turnier-Ruleset ‚Uprising (2026)' ist genau für Listen
gebaut, deren Budget zwischen 2000 und 2500 Punkten liegt — nur dort darf es
gewählt werden."*

Alle vier Roster halten das **`atLeast`-Mitglied konstant wahr** (2500, 2501 und
3000 sind alle ≥ 2000), so dass der Umschlag ausschließlich vom
**`atMost`-Mitglied** getrieben wird.

*Abgrenzung:* Die **untere** Kante desselben Fensters (2000 / 1999) pinnt bereits
[`at-least-roster-points-limit`](../at-least-roster-points-limit/README.md);
dort ist umgekehrt das `atMost`-Mitglied konstant wahr. Hier wird nichts davon
wiederholt.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **AMPL-R1** | **Basis:** Der Eintrag „Tournament rules: Uprising (2026)" trägt genau **eine** Grenze: `max 0` Auswahlen je Kontingent (`field="selections"`, `scope="force"`, `shared="true"`, `includeChildSelections="false"`). Steht er ohne wirksamen Modifikator im Kontingent, ist `actual` die Zahl seiner Selektionen dort, `bound` der wirksame `value`. | O&G-`.cat:11611`: `<constraint type="max" value="0" field="selections" scope="force" shared="true" id="00f6-c1b3-ee85-5c02" includeChildSelections="false"/>`. Die Id kommt im ganzen Fixture-Datensatz **genau zweimal** vor: als Grenze (`:11611`) und als `field` des Modifikators (`:11580`) — kein weiterer Schreiber. |
| **AMPL-R2** | **`atMost` schließt den Schwellenwert ein.** Bei Budget **genau 2500** hält `atMost 2500`; bei **2501** und bei **3000** hält es nicht. Da `atLeast 2000` in allen Fällen wahr bleibt, entscheidet allein dieses eine Mitglied über die `and`-Gruppe ([§7.7](../../battlescribe-data-format.md#conditiongroup--verknüpfung-mehrerer-bedingungen): eine `and`-Gruppe hält, wenn **alle** Mitglieder halten). | O&G-`.cat:11585` (`atMost value="2500"`), `:11584` (`atLeast value="2000"`); Vergleichs-Semantik [§7.7](../../battlescribe-data-format.md#condition--eine-voraussetzung)/[§13.1](../../battlescribe-data-format.md#131-wichtige-enum-werte); Abgrenzung `lessThan` ↔ `atMost` per Leiter-Beleg `.gst:224/258/259/270` und XSD-Aufzählung `Catalogue.xsd:571-582`. |
| **AMPL-R3** | **Der Umschlag ist kein Ein-Punkt-Artefakt.** Budget **3000** liegt 500 Punkte über der Kante und muss dasselbe Verdikt liefern wie 2501. Wer den Vergleich nur um eins verschoben implementiert, fällt bei 2501 auf; wer ihn ganz ignoriert, bei beiden. | Roster 02/03 unterscheiden sich **nur** im `<costLimit value=…>`; Grenze und Träger sind identisch (`.cat:11611`). |
| **AMPL-R4** | **`limit::<costTypeId>` ist das eingestellte Budget, nicht die Summe.** Das `field` der Bedingung liest den `<costLimit typeId="ecfa-8486-4f6c-c249">`-Wert der Roster. Roster 04 setzt Budget **2500** (im Fenster) bei verplanter Summe **3000** (über dem Fenster): nur unter der Budget-Lesart bleibt das Gatter offen. | [§13.2](../../battlescribe-data-format.md#132-der-field-wert-je-nach-kontext): *„`limit::<costTypeId>` = das Kostenlimit (Budget) der Roster für diese Kostenart"*; Kostenart `.gst:13`. Bedingung O&G-`.cat:11585`. |
| **AMPL-R5** | **`childId="any"` fordert keine weitere Auswahl.** Die Bedingung zählt nichts im Roster, sondern vergleicht das Budget mit `value`. Die Roster 01–03 brauchen darum außer der Trägerauswahl **keinerlei** Inhalt. | O&G-`.cat:11585` (`childId="any"`, `shared="true"`, `includeChildSelections="true"`, `includeChildForces="true"` — alles Zähl-Flags ohne Zählgegenstand); [§13.2](../../battlescribe-data-format.md#132-der-field-wert-je-nach-kontext), Zeile zu `childId`. |
| **AMPL-R6** | **Wirksame Grenze je Budget:** Budget **2500** → `and`-Gruppe wahr → `set 1` → **Ist 1 ≤ Grenze 1** → `00f6…` feuert **nicht**. Budget **2501**/**3000** → Gruppe falsch → Grenze bleibt auf Basis **0** → mit einer Uprising-Selektion feuert `00f6…` mit **Ist 1 / Grenze 0**. | AMPL-R1–R5 kombiniert; `set`-Semantik [§7.7](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat): der `value` **ersetzt** den Grenzwert. |
| **AMPL-R7** | **Der Träger ist im Kontingent erreichbar.** „Army composition rules" (`6fcf…`) trägt primär die Kategorie *Special list rules* `32f1-197f-d719-a393`, die das Kontingent „Standard (OG-AB)" per `categoryLink` führt. Weder der Eintrag noch die Gruppe „Ruleset restriction" tragen eigene Grenzen — es gibt keine konkurrierende Schranke auf diesem Pfad. | O&G-`.cat:11617-11619` (`categoryLink` `3da4-efb0-d2dc-3dba` → `32f1-197f-d719-a393`, `primary="true"`); Kontingent `:47`, dessen `categoryLink` `0636-2809-bf71-0f02` → `32f1…` (`:50`). Gruppe `:11531` ohne `<constraints>`, Elterneintrag `:11529` ohne `<constraints>`. |
| **AMPL-R8** | **Die übrigen Modifikatoren des Trägers bleiben in allen vier Rostern inert.** Die vier `add`/`error`-Modifikatoren verlangen Selektionen bzw. Kostenwerte, die keines der Roster enthält: „gleiche Special Choice > 1" (`c679-3389-ca76-2ea1` *Savage Orc Boar Big 'Uns* `.cat:6565` / `4112-026b-500a-b6fd` *Stone Trolls* `.cat:6932` — nicht gewählt), „> 10 Casting Dice" (Kostenart `fcec-2340-6368-a2ba`; **alle** gewählten Einträge tragen dafür **0**), „Special Characters ≥ 1" (Kategorie `0644-bfcd-32c2-21dc`, `.gst:211` — Orc Boyz ist primär *Core*), „> 1 Large Target" (`7645ed71…` *Giant*, Mercenaries-`.cat:5065` / `b184-b03c-693b-53b1` *Wyvern*, O&G-`.cat:11623` — nicht gewählt). Keiner von ihnen berührt `00f6…`. | O&G-`.cat:11535-11557`, `:11558-11563`, `:11564-11569`, `:11590-11608`; Kostenwerte `.cat:3028-3030` (Modell), `:3050-3052` (Choppa), `:3064-3066` (Light Armour), `:3186-3188` (Einheit). |
| **AMPL-R9** | **Roster 04 (Gegenprobe „Summe ≠ Budget"):** Eine Einheit *Orc Boyz* (`ac23-b9d3-4046-23b7`, Einheit selbst **0** pts) mit **600** Modellen à **5** pts ergibt eine verplante Summe von exakt **3000** pts. Bei Budget **2500** hält die `atMost`-Bedingung dennoch. Die roster-weite Budget-Regel bezeugt die Summe: **Ist 3000 / Grenze 2500**. | O&G-`.cat:3007` (Einheit, Kosten `:3186` = 0), `:3020` (Modell `cef0-77ce-8158-32d4`), `:3028` (`cost pts value="5"`), `:3022` (`min 10` parent — mit 600 erfüllt), `:3023` (`max -1` = unbegrenzt; der `set 25`-Modifikator `:3033` ist an *Border Patrols rules* `4e15-0353-165f-5528` gegatet und nicht gewählt). Kostenrechnung wie im Szenario [`orcs-and-goblins-budget`](../orcs-and-goblins-budget/README.md). Budget-Grenz-Id `budget::ecfa-8486-4f6c-c249` ebenda (OGB-R2, strikte Überschreitung). |

### Wahrheitstafel — die Mitglieder je Roster

| Roster | eingestelltes Budget | verplante Summe | `atLeast 2000` | `atMost 2500` | **`and`-Gruppe** | wirksame Grenze `00f6…` | Ist |
|---|---|---|---|---|---|---|---|
| 01 | **2500** | 0 | ✓ | ✓ (Kante) | **✓** | **1** (`set 1`) | 1 → still |
| 02 | **2501** | 0 | ✓ | **✗** | **✗** | **0** (Basis) | 1 → feuert |
| 03 | **3000** | 0 | ✓ | **✗** | **✗** | **0** (Basis) | 1 → feuert |
| 04 | **2500** | **3000** | ✓ | ✓ (Kante) | **✓** | **1** (`set 1`) | 1 → still |

### Was eine falsche Lesart produzieren würde

| Fehl-Lesart | Roster 01 (Budget 2500) | Roster 02 (Budget 2501) | Roster 03 (Budget 3000) | Roster 04 (Budget 2500, Summe 3000) |
|---|---|---|---|---|
| `atMost` als **ausschließend** (`<`, wie `lessThan`) gelesen | 2500 < 2500 falsch → Gruppe falsch → `00f6…` feuert → **fällt auf** | konform | konform | Gatter zu → `00f6…` feuert → **fällt auf** |
| `atMost` mit `atLeast`/`greaterThan` verwechselt (`≥`) | 2500 ≥ 2500 wahr → zufällig konform | 2501 ≥ 2500 wahr → `00f6…` still statt feuern → **fällt auf** | dito → **fällt auf** | zufällig konform |
| `limit::…` als **Kostensumme** gelesen | Summe 0 ≤ 2500 wahr, aber `atLeast 2000` fällt (0 < 2000) → `00f6…` feuert → **fällt auf** | dito → **fällt auf** | dito → **fällt auf** | Summe 3000 > 2500 → Gruppe falsch → `00f6…` feuert → **fällt auf** |
| `limit::…` als **Maximum aus Summe und Budget** gelesen | konform | konform | konform | max(3000, 2500) = 3000 > 2500 → `00f6…` feuert → **fällt auf** |
| Bedingung **ignoriert** (`set` greift unbedingt) | konform | Grenze 1 statt 0 → `00f6…` still → **fällt auf** | dito → **fällt auf** | konform |
| Bedingung **immer falsch** (fail-closed missverstanden) | Grenze bleibt 0 → `00f6…` feuert → **fällt auf** | konform | konform | `00f6…` feuert → **fällt auf** |
| `childId="any"` als **Zählung von Auswahlen** gelesen (Rahmen zählt 1–2 Selektionen) | Zähler ≪ 2000 → `atLeast` fällt → `00f6…` feuert → **fällt auf** | dito → **fällt auf** | dito → **fällt auf** | dito → **fällt auf** |

Roster **01** ist der Kernfall: die Kante **selbst** muss noch halten. Roster
**02** ist derselbe Aufbau einen Punkt darüber — zwischen beiden ändert sich
**nur** die Zahl im `<costLimit>`-Attribut, also kann der Umschlag keiner anderen
Ursache zugeschrieben werden. Roster **03** zeigt, dass das Verdikt nicht an der
Eins hängt. Roster **04** trennt Budget und Summe explizit.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle laufen gegen
denselben Datensatz (`.gst` + O&G-`.cat` + Mercenaries-`.cat`).

> **Assertion-Fokus:** die Grenze `00f6-c1b3-ee85-5c02`, der `effectiveMax` des
> besetzten Uprising-Slots und (in Roster 04) die roster-weite Budget-Grenze
> `budget::ecfa-8486-4f6c-c249`. Andere Armeeaufbau-Diagnosen des Kontingents —
> namentlich die Core-Pflicht `35c2-d478-392a-aeb1` (`.gst:374`) und die
> General-Pflicht `1077-7379-f142-f382` — dürfen zusätzlich auftreten und sind
> hier ohne Belang (selektive Erwartung, Manifest-Vertrag). Sie stehen bewusst
> **nicht** in `absent`.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | Die obere Kante selbst hält das Gatter offen | Kontingent `2bfa…`, `costLimit` **2500** pts, genau eine Uprising-Selektion, verplante Summe 0. | **AMPL-R2/R6:** `atMost 2500` hält an der Kante, `atLeast 2000` ebenfalls → `set 1`. `00f6…` feuert **nicht**; der besetzte Slot meldet **`effectiveMax` 1** bei Ist 1. Kein Budget-Verstoß (0 ≤ 2500). | [`01-limit-2500-boundary-gate-open.ros`](rosters/01-limit-2500-boundary-gate-open.ros) |
| 02 | Ein Punkt darüber schließt es | **Identischer** Aufbau, `costLimit` **2501** pts. | **AMPL-R6:** Die `and`-Gruppe fällt allein am `atMost`-Mitglied → kein `set`. `00f6…` feuert **Ist 1 / Grenze 0**; der Slot meldet **`effectiveMax` 0**. | [`02-limit-2501-gate-closed.ros`](rosters/02-limit-2501-gate-closed.ros) |
| 03 | Weit darüber — dasselbe Verdikt | **Identischer** Aufbau, `costLimit` **3000** pts. | **AMPL-R3:** wie 02 — `00f6…` feuert **Ist 1 / Grenze 0**, Slot `effectiveMax` 0. Der Umschlag ist damit als Vergleich und nicht als Off-by-one-Artefakt bezeugt. | [`03-limit-3000-gate-closed.ros`](rosters/03-limit-3000-gate-closed.ros) |
| 04 | Budget 2500, verplant 3000 — die Summe zählt nicht | Aufbau von 01 **plus** Orc Boyz mit 600 Modellen (Summe **3000** pts). | **AMPL-R4/R9:** Die Bedingung liest weiter das Budget (2500) → Gruppe wahr → `00f6…` feuert **nicht**, Slot `effectiveMax` 1. Die Budget-Regel `budget::ecfa-8486-4f6c-c249` feuert **Ist 3000 / Grenze 2500** und bezeugt die Summe. | [`04-limit-2500-spent-3000-gate-open.ros`](rosters/04-limit-2500-spent-3000-gate-open.ros) |

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
  ist `null` (er trägt keine `min`-Grenze). Wo `effectiveMax` 1 und `current` 1
  ist, ist der `headroom` **0**.
- **`budget::ecfa-8486-4f6c-c249`** in Roster 04: `actual` = 600 × 5 pts = **3000**
  (Modellkosten `.cat:3028`; Einheit, Choppa und Light Armour je 0 pts —
  `.cat:3186`, `:3050`, `:3064`), `bound` = eingestelltes `costLimit` **2500**.
  In den Rostern 01–03 ist die verplante Summe **0** und die Regel darum still.

### Was bewusst **nicht** Teil der Erwartung ist

| Facette | Warum nicht |
|---------|-------------|
| Der **zweite** gegatterte Modifikator `set hidden=false` (`.cat:11570-11579`) — also `isHidden` des Uprising-Slots. | Der Träger hängt unter dem Elterneintrag „Army composition rules" (`6fcf…`), der selbst `hidden="true"` ist und keinen Aufdeck-Modifikator trägt. Ob das `hidden` einer **Eltern-`selectionEntry`** auf die Slot-Projektion ihrer Kinder durchschlägt, legt die Formatreferenz **nicht** fest: [§8](../../battlescribe-data-format.md#8-kategorien--sichtbarkeit) regelt nur die Komposition `entryLink`↔Ziel und die Vererbung einer verborgenen **`selectionEntryGroup`** (die Gruppe „Ruleset restriction" ist hier `hidden="false"`). Eine `isHidden`-Behauptung wäre aus den erlaubten Quellen nicht ableitbar — dieselbe Zurückhaltung übt das Schwesterszenario [`at-least-roster-points-limit`](../at-least-roster-points-limit/README.md). Der Umschlag wird stattdessen am **zweiten**, gleich gegatterten Modifikator (`set 1` auf die Grenze) gepinnt: die Bedingung ist identisch, das Ergebnis zählbar. |
| Die **untere** Bracket-Kante (`atLeast 2000`, `.cat:11584`). | Eigene Bedingungszelle (`atLeast`) und Gegenstand von [`at-least-roster-points-limit`](../at-least-roster-points-limit/README.md). Sie wird hier **konstant wahr** gehalten (alle Budgets ≥ 2000), damit der Umschlag eindeutig dem `atMost`-Mitglied zuzuschreiben ist. |
| Die vier `add`/`error`-Meldungen des Trägers (AMPL-R8). | Eigene Zelle (`modifier add field="error"`), bereits gepinnt von [`author-message-severity`](../author-message-severity/README.md) / [`author-message-tokens`](../author-message-tokens/README.md). In allen vier Rostern sind ihre Bedingungen falsch (Belege in AMPL-R8); behauptet wird das nicht. |
| Die `atLeast`/`lessThan`-Punkteleitern der `.gst` (`:224`–`:355` u. a.). | Hier nur als **Beleg** für die Trennung „einschließend ↔ ausschließend" herangezogen. Ihre Gruppenlogik pinnt [`condition-group-and-points-bracket`](../condition-group-and-points-bracket/README.md) (dort mit `childId="model"`, einer anderen Zelle). |
| Der Fall **ohne** `<costLimits>` (`defaultCostLimit="-1"`, `.gst:13`). | Eigener Mechanismus (unaufgelöstes Budget, Diagnose `UNRESOLVED_BUDGET_LIMIT`), bereits gepinnt in [`orcs-and-goblins-budget`](../orcs-and-goblins-budget/README.md). Alle Roster hier setzen ihr Budget explizit. |
| Core-/General-Pflichten sowie die parent-Mindestgrenzen der Orc-Boyz-Optionen in Roster 04. | Beiwerk des Armeeaufbaus; die Erwartung ist selektiv. Choppa (`min/max 1` parent, `:3043`/`:3044`) und Light Armour (`min/max 1` parent, `:3057`/`:3058`) sind mitgewählt (je 0 pts), damit Roster 04 möglichst wenig Nebenrauschen erzeugt. |

---

## Abgleich mit dem Engine-Bericht (Runner-Verifikation)

Die oben aus den Katalogdaten **abgeleiteten** Erwartungen treffen die Engine
erst im **Runner-Lauf** — der separate Verifikationsschritt, der nicht zur
(blinden) Autorenschaft gehört (siehe
[ADR 0033](../../adr/0033-evaluator-e2e-manifest-runner-und-black-box-autorenschaft.md)).
Abweichungen sind zu **untersuchen**, nicht durch Anpassen der Erwartung
wegzudefinieren. Die erwartungsgemäß heiklen Stellen:

1. **AMPL-R2** — ob `atMost` den Schwellenwert wirklich **einschließt**
   (Roster 01 bei exakt 2500). Ein `<`-statt-`≤`-Vergleich fällt genau hier auf.
2. **AMPL-R3** — ob 2501 und 3000 dasselbe Verdikt liefern.
3. **AMPL-R4/R9** — ob `limit::…` das **eingestellte** `costLimit` liest und
   nicht die verplante Summe (Roster 04: Budget 2500, Summe 3000). Dass die
   Budget-Regel dort feuert **und** die gegatterte Grenze gleichzeitig still
   bleibt, ist die eigentliche Aussage des Falls.
4. **AMPL-R1/R6** — ob der `set`-Modifikator auf die **Constraint-Id** den
   gemeldeten `bound` tatsächlich von 0 auf 1 hebt und ob eine
   `scope="force"`-`max`-Grenze am Träger dessen eigene Selektion zählt
   (`actual` 1).
5. Die Slot-Adressierung: `defId 4bc4-8781-2091-d9df` + `anchorKind occupied`
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
| — `set 1`-Modifikator darauf, `and`-Gruppe `atLeast 2000` ∧ **`atMost 2500`** (`:11580-11589`) | (unbenannt, `field="00f6-c1b3-ee85-5c02"`) |
| — `set hidden=false`-Modifikator mit **derselben** Gruppe (`:11570-11579`, bewusst nicht gepinnt) | (unbenannt, `field="hidden"`) |
| Budget-Grenze (Engine-Regel, roster-weit; Roster 04) | `budget::ecfa-8486-4f6c-c249` |
| Orc Boyz, Einheit (0 pts, `:3007`/`:3186`) — Punktequelle für Roster 04 | `ac23-b9d3-4046-23b7` |
| — Modell Orc Boyz (5 pts, `:3020`/`:3028`; `min 10` parent `158f-ed55-76f2-eba0`, `max -1` `2115-87d4-2ead-6ba1`) | `cef0-77ce-8158-32d4` |
| — Choppa (0 pts, `:3050`; `min/max 1` parent `dbcc-2eb6-66d6-e785`/`db48-8078-f3c8-6c29`) | `f73d-18a2-089b-285e` |
| — Light Armour (0 pts, `:3064`; `min/max 1` parent `0b95-cef7-a64a-3172`/`34cc-8bc4-9ef8-cd20`) | `ee53-a14e-2084-9f87` |
| Kategorie *Core* (primär an Orc Boyz; Pflicht toleriert, nicht Gegenstand) | `64bf-efb4-9978-26df` — Constraint `35c2-d478-392a-aeb1` (`.gst:374`) |
| Kategorie *Special Characters* (`.gst:211`, Gatter des dritten `error`-Modifikators) | `0644-bfcd-32c2-21dc` |
| Kostenart *Casting Dice* (`.gst:14`, Gatter des zweiten `error`-Modifikators; alle gewählten Einträge 0) | `fcec-2340-6368-a2ba` |
