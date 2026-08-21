# E2E-Regeln & Testkatalog: verschachtelte `conditionGroup` — eine `or`-Gruppe *innerhalb* einer Gruppe

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln, Ids,
Texte und Erwartungswerte sind **ausschließlich aus den Katalogdaten** der
*6th Definitive Edition* (`src/domain/evaluator/__fixtures__/whfb6-definitive/`) und der
Formatspezifikation ([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md),
§7.4, §7.7, §13.1) abgeleitet — nicht aus einem Engine-Lauf. Die Roster-Form ist
an den bereits verifizierten Szenarien nachgebildet (direktes `entryId`,
`entryLinkId=""`, verschachtelte `selections` mit `number`, `<costLimits>` für
das eingestellte Budget) — konkret an
[`at-least-roster-points-limit`](../at-least-roster-points-limit/README.md) und
[`condition-group-and-nested`](../condition-group-and-nested/README.md), die
denselben Träger auswählen.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1, `.gst:2`) — Kostenart **`pts`**
  `ecfa-8486-4f6c-c249` (`.gst:13`)
- Armeebuch: `Orcs and goblins (6th definitive edition).cat`
  (`4049-c46d-7f80-44fb`, rev 1, `.cat:2`)
- Bibliothek: `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`) —
  per `catalogueLink` `b066-2f8e-11ee-1dce` deklarierte Abhängigkeit der
  O&G-`.cat` (`.cat:14915-14917`). Die Abhängigkeit steht in den Daten, der
  Katalog bleibt darum im Datensatz.

> **Assertion-Fokus:** die **Autor-Meldung** des `field="error"`-Modifikators —
> `expect.messages` mit `origin: "authorMessage"` und (wo eine Vollständigkeits-
> aussage sinnvoll ist) `expect.capabilities[].authorMessages`. Eine
> `condition`/`conditionGroup` ist **keine zählende Grenze**; sie erscheint
> deshalb **nicht** als feuernde `limitId` im Verletzungsbericht, sondern ist nur
> über ihre Wirkung — hier die Meldung — beobachtbar. Andere Armeeaufbau-
> Diagnosen (General-/Core-Pflicht, die roster-weite `max`-Grenze der Big 'Uns)
> dürfen zusätzlich auftreten und stehen bewusst **nicht** in `absent`
> (selektive Erwartung, Manifest-Vertrag).

---

## Die Datenlage: eine `or`-Gruppe als Mitglied einer `and`-Gruppe

Der Träger ist der Turnier-Schalter „Tournament rules: Uprising (2026)"
(`4bc4-8781-2091-d9df`, `.cat:11533`, `hidden="true"`), sein **erster**
Modifikator (`.cat:11535-11557`):

```
modifier add field="error"                                     (.cat:11535)
  value = "No more than 2 of the same Special Choice are allowed!⏎See [PDF, p.X]"
  └ conditionGroup type="or"                                   (.cat:11538)   ← äußere Gruppe, EIN Mitglied
       └ conditionGroup type="and"                             (.cat:11540)   ← umschließende Gruppe
            ├ condition instanceOf value=1 field=selections    (.cat:11542)
            │     scope="force"  childId="2bfa-e64a-7123-895f" (Kontingent „Standard (OG-AB)")
            └ conditionGroup type="or"                         (.cat:11545)   ◀── DIE ZELLE
                 ├ condition greaterThan value=1 scope="roster"(.cat:11547)
                 │     childId="c679-3389-ca76-2ea1"  (Savage Orc Boar Big 'Uns)
                 └ condition greaterThan value=1 scope="roster"(.cat:11548)
                       childId="4112-026b-500a-b6fd"  (Stone Trolls)
```

Die **innere `or`-Gruppe** (`.cat:11545-11550`) ist Gegenstand dieses Szenarios.
Sie steht **nicht** auf der obersten Ebene des Modifikators, sondern als Mitglied
einer `and`-Gruppe, die ihrerseits Mitglied einer `or`-Gruppe ist. Ihr Urteil
wird also **zweimal** weitergereicht, bevor es den Modifikator erreicht.

In-World: *„… und **eine** der beiden namentlich genannten Special-Choice-
Einheiten steht mehr als einmal in der Liste."* — „eine der beiden", nicht
„beide", und nicht „beide zusammen".

> **Der Schwellenwert ist `greaterThan 1`, nicht „2".** Der Meldungstext sagt
> „No more than 2", die Daten sagen `value="1"` mit `type="greaterThan"` — die
> Bedingung hält also erst ab **zwei** Auswahlen und bei genau einer noch nicht
> ([§13.1](../../battlescribe-data-format.md#131-wichtige-enum-werte) /
> §7.7-Condition-Tabelle: `greaterThan` ist der **echt** größere Vergleich).
> Gepinnt wird die Datenlage, nicht die Prosa des Autors (Roster 05).

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

Zeilenangaben beziehen sich auf `Orcs and goblins (6th definitive edition).cat`,
sofern nicht anders vermerkt.

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **CGON-R1** | **Eine `or`-Gruppe hält, sobald *mindestens eines* ihrer Mitglieder hält.** Die Gruppe `.cat:11545` hat zwei gleichrangige `condition`-Mitglieder (`:11547`, `:11548`). Hält eines davon, hält die Gruppe — unabhängig davon, ob das jeweils andere hält. | [§7.7, „`conditionGroup` — Verknüpfung mehrerer Bedingungen"](../../battlescribe-data-format.md#conditiongroup--verknüpfung-mehrerer-bedingungen): *„Eine `and`-Gruppe hält, wenn **alle** ihre Mitglieder (Bedingungen **und** Untergruppen) halten, eine `or`-Gruppe, wenn **mindestens eines** hält."* |
| **CGON-R2** | **Jedes Mitglied trägt für sich allein.** Das erste Mitglied zählt `Savage Orc Boar Big 'Uns` `c679-3389-ca76-2ea1`, das zweite `Stone Trolls` `4112-026b-500a-b6fd` — zwei **verschiedene** Ziele, unabhängig voneinander. Roster 01 (nur Big 'Uns) und Roster 02 (nur Stone Trolls) erzeugen daher **dasselbe** Urteil. Eine Auswertung, die die Gruppe als `and` liest oder nur ihr erstes Mitglied liest, fällt an einem der beiden Roster auf. | `.cat:11547` (`childId="c679-3389-ca76-2ea1"`) und `.cat:11548` (`childId="4112-026b-500a-b6fd"`); Ziele: `selectionEntry "Savage Orc Boar Big 'Uns"` (`.cat:6565`) und `selectionEntry "Stone Trolls"` (`.cat:6932`). |
| **CGON-R3** | **Die Gruppe ist ein Urteil, keine Summe.** Jedes Mitglied vergleicht **seinen eigenen** Zähler gegen **seine eigene** Schwelle (`field="selections"`, `value="1"`, `type="greaterThan"`); es gibt in den Daten keinen Zähler über die Gruppe. Je **eine** Auswahl beider Ziele (1 und 1) lässt beide Mitglieder fallen — obwohl die Summe der Zähler 2 wäre. Roster 03 ist genau dieser Falsifikator. | `.cat:11547-11548`: zwei getrennte `condition`-Elemente mit je eigenem `childId`/`value`; die `conditionGroup` selbst trägt **kein** `field`/`value`/`childId` (`.cat:11545`: nur `type="or"`). |
| **CGON-R4** | **Die Gruppe ist inklusiv, nicht exklusiv — und feuert nicht doppelt.** Halten **beide** Mitglieder, hält sie weiterhin („mindestens eines"), und der gegatterte Modifikator greift **einmal**, nicht zweimal: ein `modifier` ohne `<repeats>` wird nicht vervielfacht. Roster 04 pinnt beides (`authorMessages` mit genau einem Eintrag). | `.cat:11535-11557`: der Modifikator trägt `<conditionGroups>`, aber **kein** `<repeats>` — vgl. [§7.7, „`repeat` — Modifier mehrfach anwenden"](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat), wo die Mehrfachanwendung ausschließlich aus `<repeats>` folgt. |
| **CGON-R5** | **Hält kein Mitglied, hält die Gruppe nicht.** Bei Zählern 0/0 (Roster 06) oder 1/1 (Roster 03) oder 1/0 (Roster 05) ist keine der beiden Bedingungen erfüllt; die Gruppe fällt. Sie darf **nicht** als „nichts hält ⇒ vacuously true" gelesen werden — sie ist auch nicht leer, sie hat zwei Mitglieder. | `.cat:11546-11549`: `<conditions>` mit **zwei** Kindern; `or` ist laut §7.7 die Existenzaussage, deren Negation (kein Mitglied hält) die Gruppe fallen lässt. |
| **CGON-R6** | **Das Urteil propagiert nach der Regel der umschließenden Gruppe.** Die innere `or`-Gruppe ist Mitglied der `and`-Gruppe `.cat:11540` — ihr Urteil wird dort mit `instanceOf … childId="2bfa-e64a-7123-895f"` konjunktiv verrechnet; das Ergebnis ist wiederum das einzige Mitglied der äußeren `or`-Gruppe `.cat:11538` und damit deren Urteil. In **allen sechs** Rostern ist das Kontingent „Standard (OG-AB)" — die `instanceOf`-Hälfte hält konstant, sodass die beobachtete Meldung genau der Wahrheitswert der inneren `or`-Gruppe ist. | `.cat:11538-11555`; `forceEntry name="Standard (OG-AB)" id="2bfa-e64a-7123-895f"` (`.cat:47`). Die konjunktive Seite dieser Verschachtelung ist eigenständig gepinnt in [`condition-group-and-nested`](../condition-group-and-nested/README.md) (CGAN-R1/R2/R3). |
| **CGON-R7** | **Zählrahmen und Zählbasis der Mitglieder:** `field="selections"`, `scope="roster"`, `shared="true"`, `includeChildSelections="true"`, `includeChildForces="true"` — armeeweit über alle Kontingente. Jede Ziel-Einheit steht in den Rostern als **je eigene Auswahl mit `number="1"`** (nie als eine Auswahl mit `number="2"`); unter jeder Lesart der Stückzahl-Frage ([§7.5](../../battlescribe-data-format.md#75-cost--cost-type), Zahlenbasis) ergibt das denselben Zähler, sodass der Umschlag der Bedingung nicht an der Multiplikationsfrage hängt. | `.cat:11547-11548`; Roster 01/02/04: zwei Geschwister-`<selection>` desselben `entryId`; Roster 03/05: je eine; Roster 06: keine. |
| **CGON-R8** | **Das Observable ist die Autor-Meldung, nicht eine Grenze.** `modifier type="add" field="error"` ist kein Wert-Modifikator, sondern eine kontextabhängige **Nachricht**; `value` trägt den Text, `field` den Schweregrad. Halten die Bedingungen, liegt die Meldung an der tragenden Auswahl an; halten sie nicht, liegt dort keine an. | [§7.7, „`field="error"`/`"warning"`/`"info"` — Klartext-Hinweise an den Spieler"](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat); Muster bereits gepinnt in [`author-message-severity`](../author-message-severity/README.md). |
| **CGON-R9** | **Der Meldungstext ist einzeilig.** Im Katalog steht der `value` mit einem **rohen Zeilenumbruch im Attributwert** (`.cat:11535/11536`). Ein `rule`-`<description>` ist laut Formatreferenz die **einzige mehrzeilige** Textentität; Attributtext ist es nicht. Erwartet wird deshalb der zeilenumbruch-normalisierte Wortlaut: `No more than 2 of the same Special Choice are allowed! See [PDF, p.X]` (ein Leerzeichen an der Umbruchstelle). | [§7.4](../../battlescribe-data-format.md#74-rule). Der Text kommt im ganzen Fixture-Datensatz **genau einmal** vor (`.cat:11535`), ist als Auswahlkriterium also eindeutig. |
| **CGON-R10** | **Der Träger trägt keinen `field="name"`-Modifikator** — sein wirksamer Anzeigename ist sein Katalog-`name` „Tournament rules: Uprising (2026)". Der Meldungstext enthält zudem **kein** Text-Token (`{this}` o. ä.), bleibt also unangetastet. | `.cat:11534-11609`: die sechs Modifikatoren des Trägers tragen `field="error"` (4×), `field="hidden"` (1×) und `field="00f6-c1b3-ee85-5c02"` (1×) — kein `name`. Tokens: siehe [`author-message-tokens`](../author-message-tokens/README.md). |
| **CGON-R11** | **Der Träger ist erreichbar und seine eigene Grenze bleibt still.** „Army composition rules" (`6fcf…`) trägt primär die Kategorie *Special list rules* `32f1-197f-d719-a393`; „Standard (OG-AB)" führt einen `categoryLink` darauf. Bei eingestelltem Budget **2000 pts** hält die `and`-Gruppe der beiden Budget-Modifikatoren (`atLeast 2000` ∧ `atMost 2500`), der `set 1` hebt die Grenze `00f6…` von `max 0` auf `max 1` — bei genau einer Uprising-Auswahl feuert sie also **nicht**. Darum steht sie in **allen** Rostern in `absent`. | `.cat:11617-11619` (`categoryLink` `3da4-efb0-d2dc-3dba` → `32f1…`, `primary="true"`); Kontingent `.cat:47/50` (`0636-2809-bf71-0f02`). Grenze `.cat:11611`, `set 1` `.cat:11580-11589`, `set hidden=false` `.cat:11570-11579`. Vollständig hergeleitet in [`at-least-roster-points-limit`](../at-least-roster-points-limit/README.md) (ARPL-R1/R5). |
| **CGON-R12** | **Die übrigen drei `error`-Modifikatoren des Trägers bleiben in allen sechs Rostern inert** — am Toggle-Slot kann also höchstens **die eine** hier gepinnte Meldung anliegen (Grundlage der Vollständigkeitsaussage `authorMessages`). „> 10 power die": Kostenart `fcec-2340-6368-a2ba`, alle gewählten Einträge tragen dort **0**. „Special Characters ≥ 1": Kategorie `0644-bfcd-32c2-21dc`, von keiner gewählten Einheit geführt. „> 2 Large Targets": Ziele `7645ed71-…` (Giant, per `entryLink` `.cat:14866`) und `b184-b03c-693b-53b1` (Wyvern, `.cat:11623`) — beide in **keinem** Roster gewählt, weder direkt noch als Kind. | `.cat:11558-11563`, `:11564-11569`, `:11590-11608`; Casting-Dice-Kosten der benutzten Einträge `.cat:6611`, `:6630`, `:6718`, `:6977`, `:6992` (je 0), Träger und Elterneintrag ohne `<costs>` (`.cat:11529-11620`); Kategorien der Ziel-Einheiten `.cat:6599` / `:6965` (jeweils nur *Special* `43cc-fc3f-35a7-8d03`). |
| **CGON-R13** | **Die Einheiten sind legal geformt.** *Savage Orc Boar Big 'Uns*: Modell `dfed-1871-769e-437e` `min 5` je Eltern (`7b80-f94a-91ab-fa42`, 21 pts) und Pflicht-Upgrade *Hand Weapons and Shields* `588a-5107-a954-9a37` `min 1`/`max 1` (`1da2…`/`a93f…`, 0 pts) — beide in jeder Auswahl enthalten. *Stone Trolls*: Modell `f559-032b-c545-f727` `min 3` je Eltern (`5e99-1c89-95ca-c41b`, 55 pts). Die Einheiten selbst kosten 0 pts. | `.cat:6602/6604/6610`, `:6623/6625/6626/6629`, `:6717`; `:6968/6970/6976`, `:6991`. |

### Wahrheitstafel — die Mitglieder der inneren `or`-Gruppe je Roster

| Roster | Big 'Uns (Zähler) | `> 1`? | Stone Trolls (Zähler) | `> 1`? | **innere `or`** | `instanceOf 2bfa` | and | äußere `or` | Meldung |
|---|---|---|---|---|---|---|---|---|---|
| 01 | 2 | ✓ | 0 | ✗ | **✓** | ✓ | ✓ | ✓ | **liegt an** |
| 02 | 0 | ✗ | 2 | ✓ | **✓** | ✓ | ✓ | ✓ | **liegt an** |
| 03 | 1 | ✗ | 1 | ✗ | **✗** | ✓ | ✗ | ✗ | keine |
| 04 | 2 | ✓ | 2 | ✓ | **✓** | ✓ | ✓ | ✓ | **liegt an (genau 1×)** |
| 05 | 1 | ✗ | 0 | ✗ | **✗** | ✓ | ✗ | ✗ | keine |
| 06 | 0 | ✗ | 0 | ✗ | **✗** | ✓ | ✗ | ✗ | keine |

Die `instanceOf`-Hälfte hält in allen sechs Rostern (Kontingent stets „Standard
(OG-AB)"). Die Meldung ist damit ein direkter Abdruck des Wahrheitswerts der
inneren `or`-Gruppe.

### Was eine falsche Lesart produzieren würde

| Fehl-Lesart | 01 | 02 | 03 | 04 | 05 | 06 |
|---|---|---|---|---|---|---|
| Innere `or`-Gruppe als **`and`** gelesen | keine Meldung → **fällt auf** | keine Meldung → **fällt auf** | konform | konform | konform | konform |
| Nur das **erste** Mitglied gelesen (zweites ignoriert) | konform | keine Meldung → **fällt auf** | konform | konform | konform | konform |
| Nur das **letzte** Mitglied gelesen (erstes ignoriert) | keine Meldung → **fällt auf** | konform | konform | konform | konform | konform |
| Mitglieder-Zähler **summiert** statt einzeln verglichen (1+1 = 2 > 1) | konform | konform | Meldung statt Stille → **fällt auf** | konform | konform | konform |
| `or` als **exklusives** Entweder-Oder gelesen | konform | konform | konform | keine Meldung → **fällt auf** | konform | konform |
| Modifikator je haltendem Mitglied **einmal** angewandt | konform | konform | konform | zwei Meldungen statt einer → **fällt auf** | konform | konform |
| `greaterThan 1` als `atLeast 1` gelesen | konform | konform | Meldung statt Stille → **fällt auf** | konform | Meldung statt Stille → **fällt auf** | konform |
| „kein Mitglied hält" als **vacuously true** gelesen | konform | konform | Meldung statt Stille → **fällt auf** | konform | Meldung statt Stille → **fällt auf** | Meldung statt Stille → **fällt auf** |
| Untergruppe **an der `and`-Gruppe vorbei** in die äußere `or` gehoben | konform | konform | konform | konform | konform | konform (eigene Zelle: [`condition-group-and-nested`](../condition-group-and-nested/README.md), Roster 04) |
| Bedingungen **ignoriert** (Modifikator greift unbedingt) | konform | konform | Meldung → **fällt auf** | konform | Meldung → **fällt auf** | Meldung → **fällt auf** |

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle laufen gegen
denselben Datensatz (`.gst` + O&G-`.cat` + Mercenaries-`.cat`), nutzen dasselbe
Kontingent **Standard (OG-AB)** `2bfa-e64a-7123-895f` und setzen `costLimit`
**2000 pts**, damit das Uprising-Gatter offen ist und die eigene Grenze des
Trägers (`00f6…`) still bleibt (CGON-R11).

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | Erstes Mitglied trägt allein | Uprising-Toggle, **zwei** Auswahlen *Savage Orc Boar Big 'Uns* (je `number="1"`), **keine** *Stone Trolls*. | **CGON-R1/R2/R9:** Am belegten Toggle-Slot liegt **genau eine** Autor-Meldung an, Schweregrad **error**, Wortlaut `No more than 2 of the same Special Choice are allowed! See [PDF, p.X]`. `00f6…` feuert nicht. | [`01-first-member-two-big-uns-message.ros`](rosters/01-first-member-two-big-uns-message.ros) |
| 02 | Zweites Mitglied trägt allein | Uprising-Toggle, **zwei** Auswahlen *Stone Trolls*, **keine** Big 'Uns. | **CGON-R2:** Dasselbe Ergebnis wie 01 — genau **eine** error-Meldung am Toggle-Slot. Bewusst **textfrei** gepinnt (Anker + Anzahl + Schweregrad), damit die `or`-Aussage von der Textfrage aus CGON-R9 unabhängig bleibt. | [`02-second-member-two-stone-trolls-message.ros`](rosters/02-second-member-two-stone-trolls-message.ros) |
| 03 | Je eine — **der Summen-Falsifikator** | Uprising-Toggle, **je eine** Auswahl beider Ziele. | **CGON-R3/R5:** Beide Mitglieder zählen 1, `greaterThan 1` hält in keinem Fall — die Gruppe fällt. Am Toggle-Slot liegt **keine** Autor-Meldung an (`authorMessages: []`). Eine summierende Lesart (1+1 = 2 > 1) meldete hier fälschlich. | [`03-one-of-each-no-member-holds-silent.ros`](rosters/03-one-of-each-no-member-holds-silent.ros) |
| 04 | Beide Mitglieder halten — inklusiv, einmal | Uprising-Toggle, **zwei** Big 'Uns **und zwei** Stone Trolls. | **CGON-R4:** Die Gruppe hält weiterhin („mindestens eines"), und der Modifikator greift **genau einmal**: `authorMessages` enthält **genau einen** Eintrag. Falsifiziert sowohl eine XOR-Lesart als auch eine Anwendung je haltendem Mitglied. | [`04-both-members-hold-message.ros`](rosters/04-both-members-hold-message.ros) |
| 05 | Schwellenwert-Randfall eines Mitglieds | Uprising-Toggle, **eine** Auswahl Big 'Uns, keine Stone Trolls. | **CGON-R5:** `1 > 1` ist falsch (echt größer, §13.1) — die Gruppe fällt, **keine** Meldung. Trennt `greaterThan 1` von `atLeast 1` ohne Beitrag des zweiten Mitglieds. | [`05-single-big-uns-boundary-silent.ros`](rosters/05-single-big-uns-boundary-silent.ros) |
| 06 | Nullpunkt — kein Mitglied hält | Uprising-Toggle, **weder** Big 'Uns **noch** Stone Trolls; im Kontingent steht nur der Träger samt Elterneintrag. | **CGON-R5:** Beide Zähler 0, die Gruppe fällt. Eine Gruppe, in der kein Mitglied hält, darf nicht als „leer ⇒ wahr" gelesen werden. **Keine** Meldung. | [`06-neither-target-empty-or-silent.ros`](rosters/06-neither-target-empty-or-silent.ros) |

### Herleitung der Zahlen

- **Zähler der beiden Mitglieder** (`field="selections"`, `scope="roster"`,
  `includeChildSelections="true"`, `includeChildForces="true"`):
  01 → Big 'Uns **2** / Stone Trolls **0**; 02 → **0** / **2**; 03 → **1** / **1**;
  04 → **2** / **2**; 05 → **1** / **0**; 06 → **0** / **0**. Jede Einheit ist
  eine eigene `<selection number="1">` (CGON-R7).
- **Schwelle** beider Mitglieder: `value="1"`, `type="greaterThan"` — der Umschlag
  liegt zwischen 1 (falsch) und 2 (wahr).
- **Verplante Summe** (nur zur Einordnung, nicht Gegenstand): 01 = 2 × 5 × 21 =
  **210 pts**; 02 = 2 × 3 × 55 = **330 pts**; 03 = 105 + 165 = **270 pts**;
  04 = 210 + 330 = **540 pts**; 05 = **105 pts**; 06 = **0 pts** — alle deutlich
  unter dem Budget 2000, es gibt also keinen Budget-Verstoß.
- **`00f6-c1b3-ee85-5c02`** (in `absent`): Budget 2000 ∈ [2000, 2500] → `set 1`;
  Ist = eine Uprising-Auswahl je Kontingent → **1 ≤ 1**, keine Verletzung.

### Bewusst ausgelassene Facetten

| Facette | Warum nicht |
|---------|--------------|
| Die `condition`/`conditionGroup` als **feuernde Grenze** (`expect.firing`) | Eine Bedingung ist keine `constraint`; der Verletzungsbericht kodiert zählende Grenzen. Der Effekt ist nur über die Meldung beobachtbar — dieselbe Abgrenzung wie in [`condition-group-or-force-gate`](../condition-group-or-force-gate/README.md) und [`condition-group-and-nested`](../condition-group-and-nested/README.md). `firing` bleibt darum in allen sechs Rostern leer. |
| Die **konjunktive** Hälfte der Verschachtelung (`instanceOf 2bfa` fällt weg) | Eigene Zelle, vollständig gepinnt in [`condition-group-and-nested`](../condition-group-and-nested/README.md) (Roster 04, anderes Kontingent). Hier wird sie in **allen** Rostern konstant wahr gehalten, damit die Meldung ausschließlich den Wahrheitswert der inneren `or`-Gruppe abbildet. |
| Die roster-weite Grenze `3f45-a5bb-0dda-6ef9` der Big 'Uns (`max 0`, per `repeat` je *Savage boar Boyz*-Auswahl um 1 angehoben, `.cat:6567-6571`, `:6588`, Kategorie `39c9-363a-dd54-8a84` `.cat:26`) | Sie feuert in den Rostern 01/03/04/05 (Ist 1–2, Grenze 0), weil kein *Savage Boar Boyz* mitgewählt ist; in 02 und 06 gibt es keine Big 'Uns. Reines Beiwerk des Armeeaufbaus, in einer eigenen Zelle (`repeat`) zu Hause — steht bewusst weder in `firing` noch in `absent`, zumal die Zählbasis bei `includeChildSelections="false"` ohne `childId` aus den Daten nicht eindeutig ableitbar ist und dieses Szenario darüber keine Behauptung aufstellen will. |
| `isHidden` des Toggle-Slots (der `set hidden=false`-Modifikator, `.cat:11570-11579`) | Der Träger hängt unter „Army composition rules" (`6fcf…`, `hidden="true"`, ohne Aufdeck-Modifikator). Ob das `hidden` einer **Eltern-`selectionEntry`** auf die Slot-Projektion ihrer Kinder durchschlägt, legt [§8](../../battlescribe-data-format.md#8-kategorien--sichtbarkeit) **nicht** fest — dieselbe Auslassung wie in [`at-least-roster-points-limit`](../at-least-roster-points-limit/README.md). |
| `isHidden` der beiden Ziel-Einheiten | *Stone Trolls* sind laut `.cat:6934-6944` überall dort verborgen, wo das Kontingent **nicht** „Savage Orc Horde" `59e1-efd7-af88-55a1` ist (`instanceOf value="0"`), also auch im Standard-Kontingent der Roster 02/03/04; *Savage Orc Boar Big 'Uns* sind in den sechs unter `.cat:6576-6581` genannten Kontingenten verborgen — in „Standard" **nicht**. Sichtbarkeit ist **Verfügbarkeit**, keine zählende Größe: [§5.6](../../battlescribe-data-format.md#56-force-entries-detachments) suspendiert für verborgene Entitäten nur die **Min**-Validierung, nicht das Zählen. Die Zähl-Bedingungen dieses Szenarios lesen die tatsächlich im Roster stehenden Auswahlen; eine `isHidden`-Behauptung wird hier nicht aufgestellt. |
| Die drei übrigen `error`-Meldungen des Trägers | In allen sechs Rostern inert (CGON-R12); Schweregrad und Wortlaut-Treue sind Gegenstand von [`author-message-severity`](../author-message-severity/README.md) und [`author-message-tokens`](../author-message-tokens/README.md). Die Vollständigkeitsaussagen `authorMessages` in 01/03/04/05/06 stützen sich auf CGON-R12. |
| General-Pflicht `1077-7379-f142-f382` und Core-Pflicht `35c2-d478-392a-aeb1` (`.gst`) | Beiwerk; die Erwartung ist selektiv und nennt sie nicht. |
| `conditionGroup type="not"` | Eigene Zelle, gepinnt von [`condition-group-not`](../condition-group-not/README.md). |

*Abgrenzung:* [`condition-group-or-force-gate`](../condition-group-or-force-gate/README.md)
pinnt eine **flache** `or`-Gruppe auf oberster Modifikator-Ebene;
[`condition-group-and-nested`](../condition-group-and-nested/README.md) pinnt an
demselben Träger die **konjunktive** Weitergabe eines Untergruppen-Urteils.
Dieses Szenario pinnt die **disjunktive Zelle selbst** — eine `or`-Gruppe, die
zwei Ebenen tief in einer Bedingungshierarchie sitzt, mit der vollständigen
Wahrheitstafel ihrer beiden Mitglieder (0/0, 1/0, 1/1, 2/0, 0/2, 2/2).

---

## Abgleich mit dem Engine-Bericht (Runner-Verifikation)

Die oben aus den Katalogdaten **abgeleiteten** Erwartungen treffen die Engine
erst im **Runner-Lauf** — der separate Verifikationsschritt, der nicht zur
(blinden) Autorenschaft gehört (siehe
[ADR 0033](../../adr/0033-evaluator-e2e-manifest-runner-und-black-box-autorenschaft.md)).
Abweichungen sind zu **untersuchen**, nicht durch Anpassen der Erwartung
wegzudefinieren. Die erwartungsgemäß heiklen Stellen:

1. **CGON-R1/R2** (Kernaussage) — ob eine `or`-Gruppe in zweiter Verschachtelungs-
   ebene tatsächlich disjunktiv ausgewertet wird und **beide** Mitglieder gelesen
   werden. Roster 01 und 02 fallen bei jeder einseitigen Lesart auseinander.
2. **CGON-R3** — Roster 03 ist der schärfste Fall: eine Auswertung, die die
   Mitglieder-Zähler zu einer Größe zusammenzieht, statt jeden gegen seine eigene
   Schwelle zu prüfen, meldete dort fälschlich.
3. **CGON-R4** — Roster 04 prüft zwei Dinge zugleich: Inklusivität (`or` ist kein
   XOR) und **Einmaligkeit** der Wirkung. Zwei Meldungen statt einer wären ein
   eigenständiger Befund zur Modifikator-Anwendung, kein `or`-Fehler.
4. **CGON-R9** — der **Zeilenumbruch im Attributwert**. Erwartet wird der
   normalisierte, einzeilige Wortlaut (ein Leerzeichen statt des Umbruchs). Die
   Textbehauptung steht **nur** in Roster 01 und 04; Roster 02 pinnt dieselbe
   Aussage textfrei über Anker + Anzahl, damit ein etwaiger Textbefund die
   `or`-Aussage nicht verdeckt.
5. **Roster 06** — ob ein Kontingent, das **nur** den Träger samt Elterneintrag
   enthält, überhaupt ohne Weiteres ausgewertet wird. Fehlende Core-/General-
   Pflichten dürfen zusätzlich als Verletzung erscheinen; die Erwartung ist
   selektiv und nennt sie nicht.
6. Die Slot-Adressierung: `defId 4bc4-8781-2091-d9df` + `anchorKind occupied`
   muss die eine Uprising-Auswahl eindeutig treffen — sie kommt je Roster genau
   einmal vor, `frameDefId`/`path` sind darum nicht gesetzt.

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Spielsystem WHFB 6th definitive (`.gst:2`) | `0d13-7737-ea86-4662` |
| Katalog **Orcs and Goblins** (`.cat:2`) | `4049-c46d-7f80-44fb` |
| Bibliothek **Mercenaries** (per `catalogueLink` `b066-2f8e-11ee-1dce`, `.cat:14916`) | `fc47-8392-a6c8-452a` |
| `costType` „pts" (`.gst:13`) | `ecfa-8486-4f6c-c249` |
| ForceEntry **„Standard (OG-AB)"** — Ziel der `instanceOf`-Bedingung, Kontingent aller sechs Roster (`.cat:47`) | **`2bfa-e64a-7123-895f`** |
| — dessen `categoryLink` *Special list rules* (`.cat:50`) | `0636-2809-bf71-0f02` → `32f1-197f-d719-a393` |
| SelectionEntry **„Army composition rules"** (`.cat:11529`, `hidden="true"`, ohne Grenzen) | `6fcf-b33d-3cf5-b56a` |
| — dessen primärer `categoryLink` (`.cat:11618`) | `3da4-efb0-d2dc-3dba` → `32f1-197f-d719-a393` |
| SelectionEntryGroup **„Ruleset restriction"** (`.cat:11531`, ohne Grenzen) | `43b3-35c6-d7cc-e3c6` |
| SelectionEntry **„Tournament rules: Uprising (2026)"** — Träger des Modifikators (`.cat:11533`) | **`4bc4-8781-2091-d9df`** |
| — `modifier add field="error"` mit dem verschachtelten Bau (`.cat:11535-11557`) | (unbenannt; äußere `or` `:11538`, `and` `:11540`, **innere `or` `:11545`**) |
| — dessen einzige Grenze `max 0`, `field="selections"`, `scope="force"` (`.cat:11611`) | `00f6-c1b3-ee85-5c02` |
| — `set 1` darauf, gegattert `atLeast 2000` ∧ `atMost 2500` (`.cat:11580-11589`) | (unbenannt, `field="00f6-c1b3-ee85-5c02"`) |
| SelectionEntry **„Savage Orc Boar Big 'Uns"** — 1. Mitglied der inneren `or` (`.cat:6565`, `.cat:11547`) | **`c679-3389-ca76-2ea1`** |
| — Modell „Savage Orc Big 'Un  Boar Boyz" (`min 5` `7b80-f94a-91ab-fa42`, 21 pts, `.cat:6602/6604/6610`) | `dfed-1871-769e-437e` |
| — Pflicht-Upgrade „Hand Weapons and Shields" (`min/max 1` `1da2-5218-88f3-7bb3`/`a93f-35ac-98b7-8b43`, 0 pts, `.cat:6623-6632`) | `588a-5107-a954-9a37` |
| — roster-weite `max 0`-Grenze (Beiwerk, `.cat:6588`; `repeat` auf Kategorie `39c9-363a-dd54-8a84`) | `3f45-a5bb-0dda-6ef9` |
| SelectionEntry **„Stone Trolls"** — 2. Mitglied der inneren `or` (`.cat:6932`, `.cat:11548`) | **`4112-026b-500a-b6fd`** |
| — Modell „Trolls" (`min 3` `5e99-1c89-95ca-c41b`, 55 pts, `.cat:6968/6970/6976`) | `f559-032b-c545-f727` |
| Kategorie *Special* (primär an beiden Ziel-Einheiten, `.cat:6599` / `.cat:6965`) | `43cc-fc3f-35a7-8d03` |
| Kategorie *Special list rules* (Pfad des Trägers ins Kontingent) | `32f1-197f-d719-a393` |
| Inerte Nachbar-Ziele (nie gewählt, CGON-R12): Giant / Wyvern / *Special Characters* / Casting Dice | `7645ed71-72bd-4b72-89ab-22571a0a8b0c` / `b184-b03c-693b-53b1` / `0644-bfcd-32c2-21dc` / `fcec-2340-6368-a2ba` |
| ForceEntry „Savage Orc Horde (OG-AB)" (hier **nicht** benutzt; Gegenprobe der `and`-Hälfte in `condition-group-and-nested`) | `59e1-efd7-af88-55a1` |
