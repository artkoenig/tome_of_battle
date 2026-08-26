# E2E-Regeln & Testkatalog: verschachtelte `conditionGroup` — eine `and`-Gruppe *innerhalb* einer Gruppe

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln, Ids,
Texte und Erwartungswerte sind **ausschließlich aus den Katalogdaten** der
*6th Definitive Edition* (`src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive/`) und der
Formatspezifikation ([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md),
§7.4, §7.7, §13.1) abgeleitet — nicht aus einem Engine-Lauf. Die Roster-Form ist
an den bereits verifizierten Szenarien nachgebildet (direktes `entryId`,
`entryLinkId=""`, verschachtelte `selections` mit `number`, `<costLimits>` für
das eingestellte Budget) — konkret an
[`at-least-roster-points-limit`](../at-least-roster-points-limit/README.md), das
denselben Träger auswählt.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1) — Kostenart **`pts`** `ecfa-8486-4f6c-c249` (`.gst:13`)
- Armeebuch: `Orcs and goblins (6th definitive edition).cat`
  (`4049-c46d-7f80-44fb`, rev 1, `.cat:2`)
- Bibliothek: `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`) —
  per `catalogueLink` `b066-2f8e-11ee-1dce` deklarierte Abhängigkeit der
  O&G-`.cat` (`.cat:14915-14917`)

> **Assertion-Fokus:** die **Autor-Meldung** des `field="error"`-Modifikators —
> `expect.messages` mit `origin: "authorMessage"` und (wo der Träger im Roster
> steht) `expect.capabilities[].authorMessages`. Eine `condition`/`conditionGroup`
> ist **keine zählende Grenze**; sie erscheint deshalb **nicht** als feuernde
> `limitId` im Verletzungsbericht, sondern ist nur über ihre Wirkung — hier die
> Meldung — beobachtbar. Andere Armeeaufbau-Diagnosen (General-/Core-Pflicht, die
> roster-weite `max`-Grenze der Big 'Uns) dürfen zusätzlich auftreten und stehen
> bewusst **nicht** in `absent` (selektive Erwartung, Manifest-Vertrag).

---

## Die Datenlage: eine `and`-Gruppe als einziges Mitglied einer `or`-Gruppe

Der Träger ist der Turnier-Schalter „Tournament rules: Uprising (2026)"
(`4bc4-8781-2091-d9df`, `.cat:11533`, `hidden="true"`), sein **erster**
Modifikator (`.cat:11535-11557`):

```
modifier add field="error"                                     (.cat:11535)
  value = "No more than 2 of the same Special Choice are allowed!⏎See [PDF, p.X]"
  └ conditionGroup type="or"                                   (.cat:11538)   ← genau EIN Mitglied
       └ conditionGroup type="and"                             (.cat:11540)   ← die verschachtelte Gruppe
            ├ condition instanceOf value=1 field=selections    (.cat:11542)
            │     scope="force"  childId="2bfa-e64a-7123-895f" (Kontingent „Standard (OG-AB)")
            └ conditionGroup type="or"                         (.cat:11545)   ← ihre eigene Untergruppe
                 ├ condition greaterThan value=1 scope="roster"(.cat:11547)
                 │     childId="c679-3389-ca76-2ea1"  (Savage Orc Boar Big 'Uns)
                 └ condition greaterThan value=1 scope="roster"(.cat:11548)
                       childId="4112-026b-500a-b6fd"  (Stone Trolls)
```

Die `or`-Gruppe der obersten Ebene trägt **keine eigenen `<conditions>`** — nur
die eine Untergruppe (und einen `<comment>TODO</comment>`, `.cat:11554`). Sie ist
damit ein reiner Durchreicher: ihr Urteil **ist** das Urteil der verschachtelten
`and`-Gruppe.

In-World: *„Meckere, wenn im Standard-Kontingent gespielt wird **und** eine der
beiden namentlich genannten Special-Choice-Einheiten mehr als einmal in der Liste
steht."*

> **Der Schwellenwert ist `greaterThan 1`, nicht „2".** Der Meldungstext sagt
> „No more than 2", die Daten sagen `value="1"` mit `type="greaterThan"` — die
> Bedingung hält also schon ab **zwei** Auswahlen ([§13.1](../../battlescribe-data-format.md#131-wichtige-enum-werte)
> / §7.7-Condition-Tabelle: `greaterThan` ist der **echt** größere Vergleich).
> Gepinnt wird die Datenlage, nicht die Prosa des Autors.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

Zeilenangaben beziehen sich auf `Orcs and goblins (6th definitive edition).cat`,
sofern nicht anders vermerkt.

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **CGAN-R1** | **Eine `and`-Gruppe hält nur, wenn *alle* ihre Mitglieder halten — Bedingungen *und* Untergruppen gleichermaßen.** Die verschachtelte Gruppe `.cat:11540` hat zwei Mitglieder ungleichen Typs: eine einfache `condition` (`:11542`) und eine eigene `conditionGroup` (`:11545`). Fällt eines von beiden, fällt die ganze Gruppe. | [§7.7, „`conditionGroup` — Verknüpfung mehrerer Bedingungen"](../../battlescribe-data-format.md#conditiongroup--verknüpfung-mehrerer-bedingungen): *„Eine `and`-Gruppe hält, wenn **alle** ihre Mitglieder (Bedingungen **und** Untergruppen) halten, eine `or`-Gruppe, wenn **mindestens eines** hält."* |
| **CGAN-R2** | **Die umschließende Gruppe sieht nur EIN Urteil.** Die äußere `or`-Gruppe (`:11538`) besitzt keine eigenen `<conditions>`, sondern genau eine Untergruppe. „Mindestens eines hält" ist damit gleichbedeutend mit „die verschachtelte `and`-Gruppe hält". Die beiden `greaterThan`-Bedingungen dürfen **nicht** an der `and`-Gruppe vorbei direkt in die äußere `or`-Gruppe eingerechnet werden — genau das prüft Roster 04. | `.cat:11538-11555`: zwischen `<conditionGroup type="or">` und `</conditionGroup>` steht ausschließlich `<conditionGroups>` (`:11539`) plus `<comment>` (`:11554`); kein `<conditions>`-Element. |
| **CGAN-R3** | **Erste Hälfte — das Kontingent:** `type="instanceOf" scope="force" childId="2bfa-e64a-7123-895f"` ist die **kanonische** Kodierung einer `forceEntry`-Instanzprüfung: sie hält genau dann, wenn das umschließende Kontingent das `forceEntry` „Standard (OG-AB)" ist, und in jedem anderen nicht. Es ist eine Identitätsprüfung, kein Zählrahmen — `value`, `shared` und `includeChildSelections` engen sie nicht ein. | `.cat:11542`; `forceEntry name="Standard (OG-AB)" id="2bfa-e64a-7123-895f"` (`.cat:47`). Kasten [„`instanceOf`/`notInstanceOf` gegen eine `forceEntry` — zwei Kodierungen"](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat) in §7.7; dieselbe Lesart pinnt [`force-id-scope-instance-of`](../force-id-scope-instance-of/README.md). |
| **CGAN-R4** | **Zweite Hälfte — die eigene Untergruppe:** eine `or`-Gruppe aus zwei `greaterThan value="1"`-Zählungen auf `field="selections"`, `scope="roster"`, `includeChildSelections="true"`, `includeChildForces="true"`. Sie hält, sobald **eine** der beiden Ziel-Einheiten roster-weit **mehr als einmal** ausgewählt ist. Jedes Mitglied allein genügt (Roster 01 vs. 02). | `.cat:11545-11550`; Ziele `selectionEntry "Savage Orc Boar Big 'Uns" c679-3389-ca76-2ea1` (`.cat:6565`) und `selectionEntry "Stone Trolls" 4112-026b-500a-b6fd` (`.cat:6932`). |
| **CGAN-R5** | **Zählbasis:** Jede Ziel-Einheit steht in den Rostern als **je eigene Auswahl mit `number="1"`** (nie als eine Auswahl mit `number="2"`). Unter jeder Lesart der Stückzahl-Frage ([§7.5](../../battlescribe-data-format.md#75-cost--cost-type), Zahlenbasis) ergibt das denselben Zähler — 2 bzw. 1 —, sodass der Umschlag der Bedingung nicht an der Multiplikationsfrage hängt. | Roster 01/02: zwei Geschwister-`<selection>` desselben `entryId`; Roster 03: je eine. |
| **CGAN-R6** | **Das Observable ist die Autor-Meldung, nicht eine Grenze.** `modifier type="add" field="error"` ist kein Wert-Modifikator, sondern eine kontextabhängige **Nachricht**; `value` trägt den Text, `field` den Schweregrad. Halten die Bedingungen, liegt die Meldung an der tragenden Auswahl an; halten sie nicht, feuert dort keine. | [§7.7, „`field="error"`/`"warning"`/`"info"` — Klartext-Hinweise an den Spieler"](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat); Muster bereits gepinnt in [`author-message-severity`](../author-message-severity/README.md). |
| **CGAN-R7** | **Der Meldungstext ist einzeilig.** Im Katalog steht der `value` mit einem **rohen Zeilenumbruch im Attributwert** (`.cat:11535/11536`). Ein `rule`-`<description>` ist laut Formatreferenz die **einzige mehrzeilige** Textentität; Attributtext ist es nicht. Erwartet wird deshalb der zeilenumbruch-normalisierte Wortlaut: `No more than 2 of the same Special Choice are allowed! See [PDF, p.X]` (ein Leerzeichen an der Umbruchstelle). | [§7.4](../../battlescribe-data-format.md#74-rule): *„Eine `rule` ist die **einzige mehrzeilige** Textentität — Zeilenumbrüche im `<description>` bleiben erhalten."* Der Text kommt im ganzen Fixture-Datensatz **genau einmal** vor (`.cat:11535`), ist als Auswahlkriterium also eindeutig. |
| **CGAN-R8** | **Der Träger trägt keinen `field="name"`-Modifikator** — sein wirksamer Anzeigename ist sein Katalog-`name` „Tournament rules: Uprising (2026)". Der Meldungstext enthält zudem **kein** Text-Token (`{this}` o. ä.), bleibt also unangetastet. | `.cat:11534-11609`: die sechs Modifikatoren des Trägers tragen `field="error"` (4×), `field="hidden"` (1×) und `field="00f6-c1b3-ee85-5c02"` (1×) — kein `name`. Tokens: siehe [`author-message-tokens`](../author-message-tokens/README.md). |
| **CGAN-R9** | **Der Träger ist in beiden benutzten Kontingenten erreichbar und seine eigene Grenze bleibt still.** „Army composition rules" (`6fcf…`) trägt primär die Kategorie *Special list rules* `32f1-197f-d719-a393`; sowohl „Standard (OG-AB)" als auch „Savage Orc Horde (OG-AB)" führen einen `categoryLink` darauf. Bei eingestelltem Budget **2000 pts** hält die `and`-Gruppe der beiden Budget-Modifikatoren (`atLeast 2000` ∧ `atMost 2500`), der `set 1` hebt die Grenze `00f6…` von `max 0` auf `max 1` — bei genau einer Uprising-Auswahl feuert sie also **nicht**. | `.cat:11617-11619` (`categoryLink` `3da4-efb0-d2dc-3dba` → `32f1…`, `primary="true"`); Kontingente `.cat:50` (`0636-2809-bf71-0f02`) und `.cat:91` (`c872-f7e3-647e-d831`). Grenze `.cat:11611`, `set 1` `.cat:11580-11589`. Vollständig hergeleitet in [`at-least-roster-points-limit`](../at-least-roster-points-limit/README.md) (ARPL-R1/R5). |
| **CGAN-R10** | **Die übrigen drei `error`-Modifikatoren des Trägers bleiben in allen fünf Rostern inert** — am Toggle-Slot kann also höchstens **die eine** hier gepinnte Meldung anliegen. „> 10 power die": Kostenart `fcec-2340-6368-a2ba`, alle gewählten Einträge tragen dort **0**. „Special Characters ≥ 1": Kategorie `0644-bfcd-32c2-21dc`, von keiner gewählten Einheit geführt. „> 2 Large Targets": Ziele `7645ed71-…` (Giant) und `b184-b03c-693b-53b1` (Wyvern), nie gewählt. | `.cat:11558-11563`, `:11564-11569`, `:11590-11608`; Kosten der benutzten Einträge `.cat:6610-6612`, `:6629-6631`, `:6717-6719`, `:6976-6978`, `:6991-6993` (Casting Dice je 0); Kategorien `.cat:6599`, `:6965` (jeweils nur *Special* `43cc-fc3f-35a7-8d03`). |
| **CGAN-R11** | **Die Einheiten sind in den gewählten Kontingenten legal geformt.** *Savage Orc Boar Big 'Uns*: Modell `dfed-1871-769e-437e` `min 5` je Eltern (21 pts) und Pflicht-Upgrade *Hand Weapons and Shields* `588a-5107-a954-9a37` `min 1`/`max 1` (0 pts) — beide in jeder Auswahl enthalten. *Stone Trolls*: Modell `f559-032b-c545-f727` `min 3` je Eltern (55 pts). Die Einheiten selbst kosten 0 pts. | `.cat:6602/6604/6610`, `:6623/6625/6626/6629`, `:6717`; `:6968/6970/6976`, `:6991`. |

### Wahrheitstafel — die Mitglieder je Roster

| Roster | Kontingent | Träger im Roster | `instanceOf 2bfa` | `> 1` Big 'Uns | `> 1` Stone Trolls | innere `or` | **verschachtelte `and`** | äußere `or` | Meldung |
|---|---|---|---|---|---|---|---|---|---|
| 01 | Standard `2bfa` | ja | ✓ | ✓ (2) | ✗ (0) | **✓** | **✓** | ✓ | **liegt an** |
| 02 | Standard `2bfa` | ja | ✓ | ✗ (0) | ✓ (2) | **✓** | **✓** | ✓ | **liegt an** |
| 03 | Standard `2bfa` | ja | ✓ | ✗ (1) | ✗ (1) | **✗** | **✗** | ✗ | keine |
| 04 | Savage Orc Horde `59e1` | ja | **✗** | ✓ (2) | ✗ (0) | ✓ | **✗** | ✗ | keine |
| 05 | Standard `2bfa` | **nein** | (✓) | (✓ 2) | ✗ (0) | (✓) | (✓) | (✓) | keine (kein Träger) |

Roster **03** und **04** falsifizieren die beiden Hälften der verschachtelten
`and`-Gruppe **einzeln**; zusammen belegen sie, dass die Verschachtelung
konjunktiv wirkt und die äußere Gruppe nur das kombinierte Urteil sieht.
Roster **05** trennt „Bedingung hält nicht" von „Träger fehlt".

### Was eine falsche Lesart produzieren würde

| Fehl-Lesart | 01 | 02 | 03 | 04 |
|---|---|---|---|---|
| Untergruppen einer `and`-Gruppe **ignoriert** (nur eigene `<conditions>` gezählt) | konform | Meldung, aber aus falschem Grund | Meldung statt Stille → **fällt auf** | konform |
| Eigene `<conditions>` der `and`-Gruppe ignoriert (nur Untergruppe gezählt) | konform | konform | konform | Meldung statt Stille → **fällt auf** |
| Untergruppe **an der `and`-Gruppe vorbei** in die äußere `or`-Gruppe gehoben (Verschachtelung eingeebnet, `or` gewinnt) | konform | konform | konform | Meldung statt Stille → **fällt auf** |
| Verschachtelte Gruppe als `or` statt `and` gelesen | konform | konform | konform | Meldung statt Stille → **fällt auf** |
| Innere `or`-Untergruppe als `and` gelesen | keine Meldung → **fällt auf** | keine Meldung → **fällt auf** | konform | konform |
| Äußere Gruppe ohne eigene `<conditions>` als „leer ⇒ falsch" gelesen | keine Meldung → **fällt auf** | keine Meldung → **fällt auf** | konform | konform |
| `greaterThan 1` als `atLeast 1` gelesen | konform | konform | Meldung statt Stille → **fällt auf** | konform |
| `scope="roster"` der inneren Zählungen als `scope="force"` des Trägers gelesen | konform | konform | konform | konform (Ein-Kontingent-Roster) |
| Bedingungen **ignoriert** (Modifikator greift unbedingt) | konform | konform | Meldung → **fällt auf** | Meldung → **fällt auf** |

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle laufen gegen
denselben Datensatz (`.gst` + O&G-`.cat` + Mercenaries-`.cat`) und setzen
`costLimit` **2000 pts**, damit das Uprising-Gatter offen ist und die eigene
Grenze des Trägers (`00f6…`) still bleibt (CGAN-R9).

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | Beide Hälften halten (erstes Mitglied der Untergruppe) | Kontingent **Standard (OG-AB)**, Uprising-Toggle, **zwei** Auswahlen *Savage Orc Boar Big 'Uns* (je `number="1"`). | **CGAN-R1/R2/R4/R7:** Am belegten Toggle-Slot liegt **genau eine** Autor-Meldung an, Schweregrad **error**, Wortlaut `No more than 2 of the same Special Choice are allowed! See [PDF, p.X]`. `00f6…` feuert nicht. | [`01-standard-two-big-uns-message.ros`](rosters/01-standard-two-big-uns-message.ros) |
| 02 | Zweites Mitglied der Untergruppe trägt allein | Derselbe Aufbau, aber **zwei** Auswahlen *Stone Trolls* statt der Big 'Uns. | **CGAN-R4:** Dasselbe Ergebnis wie 01 — genau **eine** error-Meldung am Toggle-Slot. Bewusst **textfrei** gepinnt (Anker + Anzahl), damit die Nest-Logik von der Textfrage aus CGAN-R7 unabhängig bleibt. | [`02-standard-two-stone-trolls-message.ros`](rosters/02-standard-two-stone-trolls-message.ros) |
| 03 | Untergruppe fällt — je eine Einheit | Kontingent **Standard**, Uprising-Toggle, **je eine** Auswahl beider Einheiten. | **CGAN-R1:** Die innere `or`-Untergruppe hält nicht (1 ≯ 1), die eigene Bedingung der `and`-Gruppe schon — die `and`-Gruppe fällt trotzdem. Am Toggle-Slot liegt **keine** Autor-Meldung an (`authorMessages: []`). | [`03-standard-one-of-each-silent.ros`](rosters/03-standard-one-of-each-silent.ros) |
| 04 | Eigene Bedingung fällt — anderes Kontingent (**der Nesting-Beweis**) | Kontingent **Savage Orc Horde (OG-AB)** `59e1-efd7-af88-55a1`, Uprising-Toggle, **zwei** *Savage Orc Boar Big 'Uns*. | **CGAN-R2/R3:** Die Untergruppe hält, die eigene `instanceOf`-Bedingung nicht — die verschachtelte `and`-Gruppe fällt, und die äußere `or`-Gruppe darf das gehaltene Enkel-Urteil **nicht** durchreichen. Am Toggle-Slot **keine** Meldung. | [`04-savage-orc-horde-two-big-uns-silent.ros`](rosters/04-savage-orc-horde-two-big-uns-silent.ros) |
| 05 | Beide Hälften hielten — aber der Träger fehlt | Kontingent **Standard**, **zwei** *Savage Orc Boar Big 'Uns*, **ohne** Uprising-Toggle und ohne dessen Elterneintrag. | **CGAN-R6:** Die Meldung hängt am Träger, nicht am Kontingent. Ohne `4bc4…` im Roster erscheint **keine** Autor-Meldung dieses Ankers. | [`05-toggle-absent-two-big-uns-silent.ros`](rosters/05-toggle-absent-two-big-uns-silent.ros) |

### Herleitung der Zahlen

- **Zähler der inneren Bedingungen** (`field="selections"`, `scope="roster"`):
  Roster 01 → Big 'Uns **2**, Stone Trolls **0**; Roster 02 → **0** / **2**;
  Roster 03 → **1** / **1**; Roster 04/05 → **2** / **0**. Jede Einheit ist eine
  eigene `<selection number="1">` (CGAN-R5).
- **Verplante Summe** (nur zur Einordnung, nicht Gegenstand): 01/04/05 = 2 × 5 ×
  21 = **210 pts**; 02 = 2 × 3 × 55 = **330 pts**; 03 = 105 + 165 = **270 pts** —
  alle deutlich unter dem Budget 2000, es gibt also keinen Budget-Verstoß.
- **`00f6-c1b3-ee85-5c02`** (in `absent`): Budget 2000 ∈ [2000, 2500] → `set 1`;
  Ist = eine Uprising-Auswahl je Kontingent → **1 ≤ 1**, keine Verletzung. In
  Roster 05 gibt es die Auswahl gar nicht (Ist 0).

### Bewusst ausgelassene Facetten

| Facette | Warum nicht |
|---------|--------------|
| Die `condition`/`conditionGroup` als **feuernde Grenze** (`expect.firing`) | Eine Bedingung ist keine `constraint`; der Verletzungsbericht kodiert zählende Grenzen. Der Effekt ist nur über die Meldung beobachtbar — dieselbe Abgrenzung wie in [`force-id-scope-instance-of`](../force-id-scope-instance-of/README.md) und [`condition-group-or-force-gate`](../condition-group-or-force-gate/README.md). |
| `isHidden` des Toggle-Slots (der `set hidden=false`-Modifikator, `.cat:11570-11579`) | Der Träger hängt unter „Army composition rules" (`6fcf…`, `hidden="true"`, ohne Aufdeck-Modifikator). Ob das `hidden` einer **Eltern-`selectionEntry`** auf die Slot-Projektion ihrer Kinder durchschlägt, legt [§8](../../battlescribe-data-format.md#8-kategorien--sichtbarkeit) **nicht** fest — dieselbe Auslassung wie in [`at-least-roster-points-limit`](../at-least-roster-points-limit/README.md). |
| `isHidden` der beiden Ziel-Einheiten | *Stone Trolls* sind laut `.cat:6934-6944` überall dort verborgen, wo das Kontingent **nicht** „Savage Orc Horde" ist (`instanceOf value="0" childId="59e1…"`), also auch im Standard-Kontingent von Roster 02; *Savage Orc Boar Big 'Uns* sind in den sechs unter `.cat:6576-6581` genannten Kontingenten verborgen — in „Standard" und „Savage Orc Horde" **nicht**. Sichtbarkeit ist **Verfügbarkeit**, keine zählende Größe: [§5.6](../../battlescribe-data-format.md#56-force-entries-detachments) suspendiert für verborgene Entitäten nur die **Min**-Validierung, nicht das Zählen. Die Zähl-Bedingungen dieses Szenarios lesen die tatsächlich im Roster stehenden Auswahlen; eine `isHidden`-Behauptung wird hier nicht aufgestellt. |
| Die Punkte-gegatterten Modifikatoren des Trägers (`atLeast 2000` ∧ `atMost 2500`) | Eigene Zelle, vollständig gepinnt in [`at-least-roster-points-limit`](../at-least-roster-points-limit/README.md). Hier werden sie in **allen** Rostern konstant wahr gehalten (Budget 2000), damit `00f6…` als Randbedingung stillsteht. |
| Die drei übrigen `error`-Meldungen des Trägers | In allen fünf Rostern inert (CGAN-R10); Schweregrad und Wortlaut-Treue sind Gegenstand von [`author-message-severity`](../author-message-severity/README.md) und [`author-message-tokens`](../author-message-tokens/README.md). Die Vollständigkeitsaussage `authorMessages: []` in 03/04 stützt sich auf CGAN-R10. |
| Die roster-weite Grenze `3f45-a5bb-0dda-6ef9` der Big 'Uns (`max 0`, per `repeat` je *Savage boar Boyz*-Auswahl um 1 angehoben, `.cat:6567-6571`, `:6588`, Kategorie `39c9-363a-dd54-8a84` `.cat:26`) | Sie feuert in den Rostern 01/03/04/05 (Ist 1–2, Grenze 0), weil kein *Savage Boar Boyz* mitgewählt ist. Reines Beiwerk des Armeeaufbaus, in einer eigenen Zelle (`repeat`) zu Hause — steht bewusst weder in `firing` noch in `absent`. Ihn wegzukonstruieren hätte die Roster verdoppelt, ohne die Nesting-Aussage zu schärfen. |
| General-Pflicht `1077-7379-f142-f382` und Core-Pflicht `35c2-d478-392a-aeb1` (`.gst`) | Beiwerk; die Erwartung ist selektiv und nennt sie nicht. |
| `conditionGroup type="not"` | Eigene Zelle, gepinnt von [`condition-group-not`](../condition-group-not/README.md). |

*Abgrenzung:* [`condition-group-and-points-bracket`](../condition-group-and-points-bracket/README.md)
und [`condition-group-or-force-gate`](../condition-group-or-force-gate/README.md)
pinnen **flache** Gruppen (alle Mitglieder sind `condition`s auf derselben Ebene);
[`nested-modifier-group`](../nested-modifier-group/README.md) pinnt die
Verschachtelung von **`modifierGroup`s**. Dieses Szenario pinnt die
Verschachtelung von **`conditionGroup`s** — eine Gruppe als Mitglied einer
Gruppe, gemischt mit einer einfachen `condition` in derselben `and`-Gruppe.

---

## Abgleich mit dem Engine-Bericht (Runner-Verifikation)

Die oben aus den Katalogdaten **abgeleiteten** Erwartungen treffen die Engine
erst im **Runner-Lauf** — der separate Verifikationsschritt, der nicht zur
(blinden) Autorenschaft gehört (siehe
[ADR 0033](../../adr/0033-evaluator-e2e-manifest-runner-und-black-box-autorenschaft.md)).
Abweichungen sind zu **untersuchen**, nicht durch Anpassen der Erwartung
wegzudefinieren. Die erwartungsgemäß heiklen Stellen:

1. **CGAN-R1/R2** (Kernaussage) — ob eine `conditionGroup` als **Mitglied** einer
   anderen Gruppe überhaupt ausgewertet und ihr Urteil korrekt in die Eltern-
   Gruppe eingerechnet wird. Roster 04 ist der schärfste Fall: eine eingeebnete
   Auswertung würde dort melden.
2. **CGAN-R2** — ob eine `or`-Gruppe **ohne eigene `<conditions>`** (nur mit einer
   Untergruppe) nicht fälschlich als „leer ⇒ falsch" oder „leer ⇒ wahr" gewertet
   wird. Ersteres fiele in 01/02 auf, Letzteres in 03/04.
3. **CGAN-R7** — der **Zeilenumbruch im Attributwert**. Erwartet wird der
   normalisierte, einzeilige Wortlaut (ein Leerzeichen statt des Umbruchs). Die
   Textbehauptung steht **nur** in Roster 01; Roster 02 pinnt dieselbe Aussage
   textfrei über Anker + Anzahl, damit ein etwaiger Textbefund die Nest-Aussage
   nicht verdeckt. Weicht die Engine ab (Umbruch erhalten), ist das ein
   **eigenständiger Befund** zur Textbehandlung, kein Nesting-Fehler.
4. **Roster 05** — ob eine Autor-Meldung tatsächlich nur an einer **belegten**
   Auswahl entsteht. Erschiene sie an einem **Angebots-Anker** (`offerAnchor`)
   für den nicht gewählten Toggle, wäre `count: 0` verletzt; das wäre zu
   untersuchen (die Katalogdaten sagen zu Meldungen an bloßen Angeboten nichts).
5. Die Slot-Adressierung: `defId 4bc4-8781-2091-d9df` + `anchorKind occupied`
   muss die eine Uprising-Auswahl eindeutig treffen — sie kommt je Roster genau
   einmal vor, `frameDefId`/`path` sind darum nicht gesetzt.

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Spielsystem WHFB 6th definitive | `0d13-7737-ea86-4662` (`.gst:2`) |
| Katalog **Orcs and Goblins** | `4049-c46d-7f80-44fb` (`.cat:2`) |
| Bibliothek **Mercenaries** (per `catalogueLink` `b066-2f8e-11ee-1dce`, `.cat:14916`) | `fc47-8392-a6c8-452a` |
| `costType` „pts" (`.gst:13`) | `ecfa-8486-4f6c-c249` |
| ForceEntry **„Standard (OG-AB)"** — Ziel der `instanceOf`-Bedingung (`.cat:47`) | **`2bfa-e64a-7123-895f`** |
| — dessen `categoryLink` *Special list rules* (`.cat:50`) | `0636-2809-bf71-0f02` → `32f1-197f-d719-a393` |
| ForceEntry **„Savage Orc Horde (OG-AB)"** — Gegenprobe (`.cat:88`) | **`59e1-efd7-af88-55a1`** |
| — dessen `categoryLink` *Special list rules* / *Special* (`.cat:91` / `.cat:97`) | `c872-f7e3-647e-d831` / `b64c-4349-5695-e517` |
| SelectionEntry **„Army composition rules"** (`.cat:11529`, `hidden="true"`, ohne Grenzen) | `6fcf-b33d-3cf5-b56a` |
| — dessen primärer `categoryLink` (`.cat:11618`) | `3da4-efb0-d2dc-3dba` → `32f1-197f-d719-a393` |
| SelectionEntryGroup **„Ruleset restriction"** (`.cat:11531`, ohne Grenzen) | `43b3-35c6-d7cc-e3c6` |
| SelectionEntry **„Tournament rules: Uprising (2026)"** — Träger des Modifikators (`.cat:11533`) | **`4bc4-8781-2091-d9df`** |
| — `modifier add field="error"` mit dem verschachtelten Bau (`.cat:11535-11557`) | (unbenannt; äußere `or` `:11538`, verschachtelte `and` `:11540`, innere `or` `:11545`) |
| — dessen einzige Grenze `max 0`, `scope="force"` (`.cat:11611`) | `00f6-c1b3-ee85-5c02` |
| — `set 1` darauf, gegattert `atLeast 2000` ∧ `atMost 2500` (`.cat:11580-11589`) | (unbenannt, `field="00f6-c1b3-ee85-5c02"`) |
| SelectionEntry **„Savage Orc Boar Big 'Uns"** — 1. Ziel der inneren `or` (`.cat:6565`) | **`c679-3389-ca76-2ea1`** |
| — Modell „Savage Orc Big 'Un  Boar Boyz" (`min 5` `7b80-f94a-91ab-fa42`, 21 pts, `.cat:6602/6604/6610`) | `dfed-1871-769e-437e` |
| — Pflicht-Upgrade „Hand Weapons and Shields" (`min/max 1`, 0 pts, `.cat:6623-6632`) | `588a-5107-a954-9a37` |
| — roster-weite `max 0`-Grenze (Beiwerk, `.cat:6588`; `repeat` auf Kategorie `39c9-363a-dd54-8a84`) | `3f45-a5bb-0dda-6ef9` |
| SelectionEntry **„Stone Trolls"** — 2. Ziel der inneren `or` (`.cat:6932`) | **`4112-026b-500a-b6fd`** |
| — Modell „Trolls" (`min 3` `5e99-1c89-95ca-c41b`, 55 pts, `.cat:6968/6970/6976`) | `f559-032b-c545-f727` |
| Kategorie *Special* (primär an beiden Ziel-Einheiten, `.cat:6599` / `.cat:6965`) | `43cc-fc3f-35a7-8d03` |
| Kategorie *Special list rules* (Pfad des Trägers ins Kontingent) | `32f1-197f-d719-a393` |
| Inerte Nachbar-Ziele (nie gewählt, CGAN-R10): Giant / Wyvern / *Special Characters* / Casting Dice | `7645ed71-72bd-4b72-89ab-22571a0a8b0c` / `b184-b03c-693b-53b1` / `0644-bfcd-32c2-21dc` / `fcec-2340-6368-a2ba` |
