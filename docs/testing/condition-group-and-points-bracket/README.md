# E2E-Regeln & Testkatalog: `conditionGroup type="and"` — die Punkte-Bracket-Leiter der Core-Pflicht

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln,
Constraint-Ids und Erwartungswerte sind **ausschließlich aus den Katalogdaten**
der *6th Definitive Edition* (`src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive/`)
und der Formatspezifikation
([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md), §7.6/§7.7)
abgeleitet. Die Roster-Form ist an den bestehenden Szenarien verifiziert
(leeres `<force>`-Element mit direktem `entryId`,
`<costLimits><costLimit …/></costLimits>` für das eingestellte Budget).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1) — Träger der Kategorie **„Core"**
  `64bf-efb4-9978-26df` (`:372`) samt Grenze und Modifikator-Leiter
- Armeebuch: `Vampire Counts (6th definitive edition).cat` (`4d73-5ab0-9020-403c`,
  rev 1) — Kontingent **„Standard (VC-AB)"** `e989-15b8-7eb6-9668` (`:29297`)
- Bibliothek: `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`) —
  per `catalogueLink` `ef73-f9bd-e250-54d2` eingebundene Abhängigkeit des
  Vampire-Counts-Katalogs (`Vampire Counts (…).cat:29511`)

---

## Die Regel (In-World)

Eine `<conditionGroup type="and">` hält genau dann, wenn **alle** ihre
Mitglieder halten — Bedingungen wie Untergruppen gleichermaßen
([§7.7](../../battlescribe-data-format.md#conditiongroup--verknüpfung-mehrerer-bedingungen)).
Ein **einziges falsches Mitglied besiegt die Gruppe**, und der von ihr bewachte
Modifikator greift nicht — egal, wie viele der übrigen Mitglieder halten.

Dieses Szenario pinnt die Zelle **`conditionGroup|and|top`** fest: je Modifikator
sitzt **genau eine** `and`-Gruppe allein in `<conditionGroups>`, ohne nackte
`<conditions>` daneben und ohne Untergruppen — die reine Konjunktion dreier
Bedingungen. (Der geschachtelte Fall `and`/`not`/`and` hat sein eigenes Szenario:
[`condition-group-not`](../condition-group-not/README.md).)

---

## Die Datenlage: die Core-Leiter der `.gst`

Die Kategorie „Core" `64bf-efb4-9978-26df` trägt eine einzige Grenze (`.gst:374`):

```xml
<constraint type="min" value="2" field="selections" scope="force" shared="true"
            id="35c2-d478-392a-aeb1" includeChildSelections="true"/>
```

Darauf sitzt eine Leiter aus `set`-Modifikatoren (`.gst:376-431`):

| Modifikator | Bedingung(en) | Beleg |
|---|---|---|
| `set 1` | nackte `<conditions>`: `atLeast 1` der „Border Patrols rules" `4e15-0353-165f-5528`, `scope="roster"` | `:377-382` |
| `set 3` *(2000–2999 pts)* | **eine** `and`-Gruppe mit drei Mitgliedern: `lessThan 1` Border Patrols (roster) **∧** `atLeast 2000` `limit::ecfa-8486-4f6c-c249` (roster, `childId="any"`) **∧** `lessThan 3000` desselben Limits | `:383-394` |
| `set 4` *(3000–3999 pts)* | analoge `and`-Gruppe: BP < 1 **∧** `atLeast 3000` **∧** `lessThan 4000` | `:395-406` |
| `set 5` / `set 6` *(4000–4999 / 5000–5999 pts)* | gleiche Form für die höheren Brackets | `:407-418` / `:419-430` |

`limit::ecfa-8486-4f6c-c249` liest das **eingestellte Punktebudget** der Roster
(`costType` „pts", `.gst:13`; [§7.7, Condition-Tabelle](../../battlescribe-data-format.md#condition--eine-voraussetzung)) —
im Roster gesetzt über `<costLimits><costLimit typeId="ecfa-8486-4f6c-c249" …/></costLimits>`.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **CGA-R1** | Basis der Core-Pflicht ist **`min 2`** Auswahlen je Kontingent (`scope="force"`, `field="selections"`, `includeChildSelections="true"`). `bound` ist der wirksame `value`, `actual` die Zahl der Core-Auswahlen im Kontingent. | `.gst:374`, constraint **`35c2-d478-392a-aeb1`**. |
| **CGA-R2** | Jeder Bracket-`set` greift **nur**, wenn seine `and`-Gruppe hält, also **alle drei** Mitglieder: BP < 1 **und** `atLeast <unten>` **und** `lessThan <oben>`. Ein einziges falsches Mitglied genügt, um den `set` abzuschalten. | `.gst:385-393` (set 3), `:397-405` (set 4); [§7.7](../../battlescribe-data-format.md#conditiongroup--verknüpfung-mehrerer-bedingungen): *„Eine `and`-Gruppe hält, wenn **alle** ihre Mitglieder … halten."* |
| **CGA-R3** | Das Border-Patrols-Mitglied (`lessThan 1` auf `4e15-0353-165f-5528`, `scope="roster"`) hält in **allen** Rostern dieses Szenarios: keiner wählt die (per Basis versteckte) Regel-Auswahl. Es ist das konstante **wahre** Mitglied jeder Gruppe. | `.gst:388` u. a.; die Auswahl selbst: `.gst:17584` (`selectionEntry` „Border Patrols rules", `hidden="true"`). |
| **CGA-R4** | Die Bracket-Grenzen sind **halboffen**: `atLeast` ist einschließend (≥), `lessThan` ausschließend (<). Bei Budget **genau 3000** scheitert die 2000er-Gruppe an `lessThan 3000`, während die 3000er-Gruppe an `atLeast 3000` gerade noch hält. | `condition`-Typen laut [§7.7, Condition-Tabelle](../../battlescribe-data-format.md#condition--eine-voraussetzung) / §13.1; Werte `.gst:389-390`, `:401-402`. |
| **CGA-R5** | Effektive Grenze ohne Border Patrols: Budget **1000** → beide Bracket-Gruppen falsch → **2** (Basis). Budget **2500** → 2000er-Gruppe vollständig wahr → **3**. Budget **3000** → 2000er-Gruppe von *einem* Mitglied besiegt, 3000er-Gruppe vollständig wahr → **4**. | CGA-R1–R4 kombiniert; Wahrheitstafel unten. |
| **CGA-R6** | Das Kontingent „Standard (VC-AB)" verweist auf Core über einen **nackten** `categoryLink` (keine eigenen Grenzen, keine Modifikatoren) — die `.gst`-Leiter gilt dort unverändert. | `Vampire Counts (…).cat:29305` (`categoryLink` `6940-bf72-caa7-537f`, `targetId="64bf-efb4-9978-26df"`). Kontrast: der „Vampire Coast"-Force trägt einen eigenen `increment`-Modifikator auf derselben Grenze (`:29486-29494`) — er wird hier bewusst **nicht** benutzt. |

### Wahrheitstafel — die Mitglieder je Roster

Alle drei Roster sind **identisch leer** (Core-Ist konstant 0) und unterscheiden
sich **nur** im eingestellten `costLimit`. Genau dadurch wird der Bound-Flip
allein von der `and`-Semantik getrieben:

| Roster (Budget) | BP < 1 | ≥ 2000 | < 3000 | **2000er-Gruppe** | ≥ 3000 | < 4000 | **3000er-Gruppe** | wirksame Grenze |
|---|---|---|---|---|---|---|---|---|
| 01 (1000) | ✓ | **✗** | ✓ | **✗** (2 von 3 wahr!) | ✗ | ✓ | ✗ | **2** (Basis) |
| 02 (2500) | ✓ | ✓ | ✓ | **✓** | ✗ | ✓ | ✗ | **3** (`set 3`) |
| 03 (3000) | ✓ | ✓ | **✗** | **✗** (2 von 3 wahr!) | ✓ | ✓ | **✓** | **4** (`set 4`) |

### Was eine falsche Lesart der `and`-Gruppe produzieren würde

| Fehl-Lesart | Roster 01 (1000) | Roster 02 (2500) | Roster 03 (3000) |
|---|---|---|---|
| Gruppe als **`or`** gelesen (ein wahres Mitglied genügt) | 2000er- **und** 3000er-Gruppe „halten" (BP < 1 bzw. < 4000) → Grenze 3 oder 4 statt **2** → **fällt auf** | konform | konform (beide Gruppen „halten", Ergebnis zufällig 4) |
| Gruppe **ignoriert** (`set` greift unbedingt) | die Leiter läuft bis `set 6` durch → Grenze ≫ 2 → **fällt auf** | dito → **fällt auf** | dito → **fällt auf** |
| Gruppe **immer falsch** (fail-closed missverstanden) | konform | Grenze bleibt 2 statt **3** → **fällt auf** | Grenze bleibt 2 statt **4** → **fällt auf** |
| `atLeast` als **ausschließend** (>) gelesen | konform | konform | 3000er-Gruppe scheitert → Grenze 2 statt **4** → **fällt auf** |
| `limit::…` als **Kostensumme** statt eingestelltes Budget gelesen (Summe ist in allen Rostern 0) | konform | Grenze bleibt 2 statt **3** → **fällt auf** | Grenze bleibt 2 statt **4** → **fällt auf** |

Roster **01** ist der Kernfall der `and`-Semantik: zwei von drei Mitgliedern der
2000er-Gruppe sind wahr, das einzelne falsche `atLeast 2000` besiegt sie
trotzdem. Roster **03** zeigt dasselbe mit dem **anderen** Mitglied (`lessThan
3000`) und pinnt zugleich die Kante: genau an der Bracket-Grenze übernimmt die
Nachbargruppe. Roster **02** ist die positive Probe — nur wenn **alle drei**
Mitglieder halten, greift der `set`.

*Hinweis zur Kante:* die Lesart „`lessThan` einschließend (≤)" ist an dieser
Leiter **nicht beobachtbar** — bei Budget 3000 „hielten" dann beide Gruppen, und
da beide `set`-Modifikatoren in Dokumentreihenfolge auf dieselbe Grenze
schreiben, wäre das Endergebnis ebenfalls 4. Sie bleibt bewusst ungepinnt.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle laufen gegen
**denselben** Datensatz (`.gst` + Vampire Counts `.cat` + Mercenaries `.cat`).

> **Assertion-Fokus:** nur die Core-Grenze `35c2-d478-392a-aeb1`. Andere
> Armeeaufbau-Diagnosen dürfen zusätzlich auftreten und sind hier ohne Belang —
> auf einem leeren Kontingent namentlich die übrigen Pflichten der Armee (z. B.
> die Bloodlines-Pflicht `4a0a-b107-e726-da32`, siehe
> [`vampire-bloodlines`](../vampire-bloodlines/README.md)). Sie stehen bewusst
> **nicht** in `absent`.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | Ein falsches Mitglied besiegt die Gruppe | Leeres Kontingent `e989…`, Budget **1000**, keine Border Patrols. | **CGA-R2/R5:** beide Bracket-Gruppen scheitern an ihrem `atLeast`-Mitglied, obwohl je zwei Mitglieder wahr sind → kein `set`. Core feuert **Ist 0 / Grenze 2** (Basis). | [`01-empty-1000-base-bound-2.ros`](rosters/01-empty-1000-base-bound-2.ros) |
| 02 | Alle Mitglieder wahr — der `set` greift | Identisch leeres Kontingent, Budget **2500**. | **CGA-R2/R5:** alle drei Mitglieder der 2000er-Gruppe halten → `set 3`. Core feuert **Ist 0 / Grenze 3**. | [`02-empty-2500-bracket-bound-3.ros`](rosters/02-empty-2500-bracket-bound-3.ros) |
| 03 | Die Kante: das `lessThan`-Mitglied besiegt, die Nachbargruppe übernimmt | Identisch leeres Kontingent, Budget **3000**. | **CGA-R2/R4/R5:** die 2000er-Gruppe wird von `lessThan 3000` besiegt (3000 ist nicht < 3000), die 3000er-Gruppe hält vollständig (3000 ≥ 3000) → `set 4`. Core feuert **Ist 0 / Grenze 4**. | [`03-empty-3000-boundary-bound-4.ros`](rosters/03-empty-3000-boundary-bound-4.ros) |

### Herleitung der Zahlen

- **`bound`** ist der wirksame `value` der Grenze `35c2-d478-392a-aeb1`:
  Katalogwert **2** (`.gst:374`); greift ein Bracket-`set`, dessen `value`
  (**3** bei 2000–2999, **4** bei 3000–3999; `.gst:383`, `:395`). Herleitung je
  Roster in der Wahrheitstafel oben.
- **`actual`** ist die Zahl der Core-Auswahlen im Kontingent
  (`field="selections"`, `scope="force"`, `includeChildSelections="true"`). Alle
  drei Kontingente sind leer → konstant **0**. Die Grenze feuert an einem
  Kategorie-Anker ohne Auswahl (dieselbe Feinheit wie in
  [`orcs-and-goblins-budget`](../orcs-and-goblins-budget/README.md), Test 01).
- Dass 0 < 2 ≤ 3 ≤ 4, garantiert: die Grenze feuert in **allen drei** Rostern —
  die Erwartung unterscheidet die Fälle allein über den **`bound`**. Genau dieser
  Flip 2 → 3 → 4 bei konstantem Roster-Inhalt ist die Signatur der
  `and`-Semantik.

### Was bewusst **nicht** Teil der Erwartung ist

| Facette | Warum nicht |
|---------|-------------|
| Der **`set 1`**-Modifikator (Border Patrols, `.gst:377-382`). | Er hängt an **nackten** `<conditions>`, nicht an einer `conditionGroup` — er gehört einer anderen Zelle. In allen Rostern ist seine Bedingung falsch (keine Border-Patrols-Auswahl); mehr wird hier nicht behauptet. |
| Die höheren Brackets `set 5`/`set 6` (4000+/5000+, `.gst:407-430`). | Formgleich mit `set 3`/`set 4`; weitere Roster ergäben keine neue Aussage über die `and`-Semantik. |
| Die Lesart „`lessThan` einschließend" an der 3000er-Kante. | Auf dieser Leiter nicht beobachtbar (siehe Hinweis zur Kante oben) — beide Lesarten ergäben bei Budget 3000 dasselbe Endergebnis 4. |
| Sonstige Pflichten des leeren Kontingents (Bloodlines `4a0a-b107-e726-da32`, General-/Lord-Regeln, „Special"-Leiter `16f0-6e5b-55d0-4102` mit derselben Gruppenform, `.gst:436 ff.`). | Erwartung ist **selektiv** (Manifest-Vertrag): geprüft wird nur die benannte Grenze; Beiwerk-Diagnosen dürfen zusätzlich auftreten. |
| Der Fall **ohne** `<costLimits>` (`defaultCostLimit="-1"`, `.gst:13`). | Eigener Mechanismus (unaufgelöstes Budget), bereits gepinnt in [`orcs-and-goblins-budget`](../orcs-and-goblins-budget/README.md), Test 06. Alle Roster hier setzen ihr Budget explizit. |

*Abgrenzung:* [`orcs-and-goblins-budget`](../orcs-and-goblins-budget/README.md)
pinnt dieselbe Grenze `35c2…` als **Budget-Skalierung** an einem O&G-Kontingent
(2000/3000, ohne 1000er-Grundlinie). Dieses Szenario pinnt die
**Gruppenlogik** dahinter: die 1000er-Grundlinie, in der ein einzelnes falsches
Mitglied eine sonst mehrheitlich wahre Gruppe besiegt, und die 3000er-Kante, an
der ein **anderes** einzelnes Mitglied kippt — an einem Vampire-Counts-Force mit
nacktem Core-`categoryLink` (CGA-R6).

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Spielsystem WHFB 6th definitive | `0d13-7737-ea86-4662` |
| Katalog **Vampire Counts** | `4d73-5ab0-9020-403c` |
| Bibliothek **Mercenaries** (per `catalogueLink` `ef73-f9bd-e250-54d2`, `:29511`) | `fc47-8392-a6c8-452a` |
| `costType` „pts" (`.gst:13`, `defaultCostLimit="-1"`) — Nenner von `limit::…` | `ecfa-8486-4f6c-c249` |
| Kategorie **„Core"** (`.gst:372`) | `64bf-efb4-9978-26df` |
| — deren Grenze `min 2`, `scope="force"` (`.gst:374`) | **`35c2-d478-392a-aeb1`** |
| — `set 3`-Modifikator mit `and`-Gruppe 2000–2999 (`.gst:383-394`) | (unbenannt, `field="35c2-d478-392a-aeb1"`) |
| — `set 4`-Modifikator mit `and`-Gruppe 3000–3999 (`.gst:395-406`) | (unbenannt, `field="35c2-d478-392a-aeb1"`) |
| SelectionEntry „Border Patrols rules" (`.gst:17584`, `hidden="true"`) — konstantes wahres `lessThan 1`-Mitglied | `4e15-0353-165f-5528` |
| ForceEntry **„Standard (VC-AB)"** (`Vampire Counts (…).cat:29297`) | `e989-15b8-7eb6-9668` |
| — dessen nackter Core-`categoryLink` (`:29305`, ohne eigene Grenzen/Modifikatoren) | `6940-bf72-caa7-537f` |
| Kontrast (nicht benutzt): Core-`categoryLink` des „Vampire Coast"-Force mit `increment` auf `35c2…` (`:29486-29494`) | `4292-f5de-24ff-93a7` |
