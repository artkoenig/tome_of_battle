# E2E-Regeln & Testkatalog: `atLeast`-Bedingung mit `scope="parent"` und `childId="any"` (Selbst-Aufdeckung „Wolf Lord")

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln, IDs und
Erwartungswerte sind **ausschließlich** aus den Katalogdaten der *6th Definitive
Edition*, aus [`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md)
und aus der vendorten `Catalogue.xsd` abgeleitet; das Eingabeformat der Roster
folgt den bereits verifizierten Szenarien (direktes `entryId`, `entryLinkId=""`,
verlinkte Auswahl als `entryId=<targetId>` + `entryLinkId=<linkId>` +
`entryGroupId=<gruppe>`).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee: `Vampire Counts (6th definitive edition).cat`
  (`4d73-5ab0-9020-403c`, rev 1) — Kontingent **„Standard (VC-AB)"**
  `e989-15b8-7eb6-9668` (+ die per `catalogueLink ef73-f9bd-e250-54d2` →
  `fc47-8392-a6c8-452a` benötigte `Mercenaries`-`.cat`)

**Gepinnte Zelle:** `condition|atLeast|parent|selectionCount|child=any` — eine
`condition type="atLeast" value="1" field="selections" scope="parent"
childId="any"` zählt im **Eltern-Rahmen** ihres Trägers die Selektionen von
**irgendetwas** (`any` ist der unbeschränkte Zähler,
[§7.7](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat))
und hält, sobald diese Zahl **1 erreicht**. Gezählt werden die Auswahlen
**unterhalb** der Eltern-Auswahl des Trägers — der Rahmen ist also, was der
Elternteil hält, nicht der Träger für sich
([§7.6](../../battlescribe-data-format.md#76-constraint)).

## Die Struktur im Katalog (der eigentliche Kern)

Der Träger ist das geteilte Upgrade **„Wolf Lord"**. Es ist im gesamten
Fixture-Korpus über **genau einen** Verweis erreichbar, und dieser Verweis liegt
**vier `selectionEntryGroup`-Ebenen tief**:

```
selectionEntry "Vampire Thrall" (e37b-c827-99ac-b706, type=unit)   ← der Eltern-Rahmen (scope="parent")
  ├ selectionEntry "Handweapon" (9dfd-134c-53c1-7181)              min 1 (e2bd-…) / max 1 (a66c-…)
  ├ selectionEntryGroup "Equipment" (3588-…) › "Weapons" (ce21-4504-871f-b034, max 1: 7807-…)
  │    └ entryLink "Great Weapon" (cbd9-0b5f-9a0e-37a1 → .gst 1eb7-3f36-8cf7-e0ba, max 1: c40e-…)
  └ entryLink "Magic selection" (2e0c-7fa1-642c-54b7 → Gruppe 53e8-…, max 50 pts: a06b-…)
       └ entryLink "Bloodline" (85fb-0691-1ee6-37f8 → Gruppe 0719-24b8-19d4-c832)
            └ entryLink "Vampiric Powers" (614f-c7bb-2050-c603, Basis hidden="true"
              → Gruppe 84fd-049b-21b4-9075 „Clan Von Carstein";
              aufgedeckt per atLeast 1 / childId=f557-… / scope="force")
                 └ entryLink "Wolf Lord" (b8be-a71f-569c-5cdc, hidden="false")
                      → selectionEntry "Wolf Lord" (66bc-8fc1-81a2-9cd4)   ← DER TRÄGER
                          Basis: hidden="true", 10 pts
                          constraint 06c5-d960-2b4d-399a = max 1 (parent)
                          modifier set hidden="false"
                            condition atLeast 1 / selections / scope="parent" / childId="any" / shared="true"
```

> **Alle vier Zwischenstufen sind Gruppen.** Gruppen erscheinen in der `.ros`
> **nicht** als eigene `selection`; ihre Mitglieder stehen dort flach als
> **direkte Kinder der umschließenden Auswahl**, die Zugehörigkeit steckt im
> `entryGroupId` (verifiziert in
> [`less-than-parent-parry-save`](../less-than-parent-parry-save/README.md),
> LTP-R6, und in
> [`greater-than-parent-upgrade-gate`](../greater-than-parent-upgrade-gate/README.md)).
> Der Eltern-Rahmen der Bedingung ist damit die **Thrall-Auswahl**, und
> `childId="any"` zählt *alles*, was der Thrall hält — auch Auswahlen aus ganz
> anderen Gruppen. Genau das trennt das Roster-Paar 01 ↔ 02.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **ALP-R1** | Die Bedingung `type="atLeast" value="1" field="selections" scope="parent" childId="any" shared="true"` hält genau dann, wenn der **Eltern-Rahmen** des Trägers **mindestens 1** Selektion hält — gleich **welche**. `atLeast` ist „≥", nicht „genau": jede Zahl ≥ 1 verhält sich identisch, 0 ist der einzige Nicht-Treffer. | VC-`.cat`, `selectionEntry 66bc-8fc1-81a2-9cd4`: `<condition type="atLeast" value="1" field="selections" scope="parent" childId="any" shared="true"/>`. |
| **ALP-R2** | **Gezählt werden nur die direkten Kinder des Rahmens.** Die Bedingung schreibt `includeChildSelections` **nicht** hin; der Vorgabewert der `QueryBase` ist `false` — „just `scope`'s `field`". | `src/platform/battlescribe/schema/Catalogue.xsd:430` `<xs:attribute name="includeChildSelections" type="xs:boolean" default="false"/>`; Deutung in [§7.6](../../battlescribe-data-format.md#76-constraint). (Praktisch latent, siehe „Bewusst nicht gepinnte Facetten".) |
| **ALP-R3** | **Basiszustand des Trägers:** „Wolf Lord" ist per geschriebenem Katalogwert **verborgen** und trägt **genau einen** Modifier — `set value="false" field="hidden"` — gegatet durch **die eine** Bedingung aus ALP-R1. Kein `<repeats>`, kein `<modifierGroups>`, kein zweiter Modifier. Sichtbarkeit des Slots ⇔ Bedingung hält. | VC-`.cat`, `<selectionEntry type="upgrade" import="true" name="Wolf Lord" hidden="true" id="66bc-8fc1-81a2-9cd4">` mit genau einem `<modifiers>`-Kind; der Verweis `b8be-a71f-569c-5cdc` trägt `hidden="false"` und **keine** Modifier. Komposition Verweis ⊕ Ziel per **ODER** ([§8](../../battlescribe-data-format.md#8-kategorien--sichtbarkeit)). |
| **ALP-R4** | **Der Eltern-Rahmen ist die umschließende Auswahl (der Vampir), nicht die Gruppe.** „Wolf Lord" ist ausschließlich über vier geschachtelte Gruppen erreichbar; Gruppen sind in der `.ros` keine `selection`, ihre Mitglieder sind direkte Kinder der Einheiten-Auswahl. Folge: schon **eine beliebige andere** Auswahl am Thrall — etwa die Pflicht-Handweapon — lässt die Bedingung halten. | Verweis-Kette `2e0c-7fa1-642c-54b7` → `53e8-0ce2-eaf6-0163`; `85fb-0691-1ee6-37f8` → `0719-24b8-19d4-c832`; `614f-c7bb-2050-c603` → `84fd-049b-21b4-9075`; `b8be-a71f-569c-5cdc` → `66bc-…`. Rahmen-Lesart wie in [`less-than-parent-parry-save`](../less-than-parent-parry-save/README.md) (LTP-R6) und [`less-than-force-min-drop`](../less-than-force-min-drop/README.md) (Rahmen = Neferata, obwohl der Träger in der Gruppe „Bloodline Powers" hängt). |
| **ALP-R5** | **Der Träger zählt in seinem eigenen Rahmen mit.** Ist „Wolf Lord" selbst gewählt, ist er ein direktes Kind desselben Rahmens und liefert die geforderte 1 — die Aufdeckung ist damit auch **selbsttragend**. Zusammen mit ALP-R4 heißt das: der Slot ist genau dann verborgen, wenn die Vampir-Auswahl **komplett leer** ist. | Roster-Struktur (Wolf Lord als Kind der Thrall-Auswahl, `entryGroupId="84fd-…"`) + ALP-R1. Rosterbau 04/05. |
| **ALP-R6** | **Eigene Obergrenze:** Pro Eltern-Rahmen ist höchstens **ein** „Wolf Lord" zulässig. `bound` ist der geschriebene Wert **1**; sie zählt `field="selections"` im `scope="parent"` ohne verschachtelte Auswahlen. | VC-`.cat`, `<constraint type="max" value="1" field="selections" scope="parent" shared="true" id="06c5-d960-2b4d-399a" includeChildSelections="false"/>`. |
| **ALP-R7** | **Max-Grenzen gelten unabhängig von der Sichtbarkeit**, Min-Grenzen einer effektiv versteckten Entität dagegen nicht. „Wolf Lord" trägt **keine** Min-Grenze — die Unterscheidung kann hier also nichts verwischen; `06c5-…` ist in jedem Roster prüfbar. | [§8](../../battlescribe-data-format.md#8-kategorien--sichtbarkeit) / [§5.6](../../battlescribe-data-format.md#56-force-entries-detachments) (Issue 0088); `66bc-…` hat genau einen `constraint`. |
| **ALP-R8** | **Sichtbarkeit ist Verfügbarkeit, keine zählende Schranke** — sie erscheint **nicht** im Verletzungsbericht. Die Aussage läuft über `expect.capabilities[].isHidden`; als feuernde Grenze wird sie ausdrücklich **nicht** erwartet. | Dieselbe Feststellung wie in [`vampire-bloodlines`](../vampire-bloodlines/README.md) (VBL-R4/R5) und [`greater-than-parent-upgrade-gate`](../greater-than-parent-upgrade-gate/README.md). |
| **ALP-R9** | **Das zweite Vorkommen der Zelle ist nicht erreichbar.** „From Death Awakened" (`c791-87b9-b00a-ddb4`, `hidden="true"`, max 1 parent `97fc-c78e-6d95-d6d0`) trägt die **wortgleiche** Bedingung, wird aber im gesamten Fixture-Korpus von **keinem** `entryLink` als `targetId` benannt und ist auch kein Inline-Kind einer Gruppe. Es gibt kein Roster, das den Eintrag legal in einen Eltern-Rahmen bringt — die Zelle wird deshalb allein über „Wolf Lord" gepinnt. | Volltextsuche über `whfb6-definitive/*` nach `c791-87b9-b00a-ddb4`: **genau ein** Treffer, die Definition selbst. Zum Vergleich `66bc-8fc1-81a2-9cd4`: zwei Treffer (Definition + Verweis `b8be-a71f-569c-5cdc`). |

**Hinweis zum Rosterbau (gilt für alle fünf Roster):** Jedes Roster führt
„Bloodlines" (`a56a-eb32-5a45-16fd`) mit der Blutlinie **Von Carstein**
(`f557-097a-d26b-9363`). Das hat genau **einen** Zweck: der umschließende
Gruppen-Verweis „Vampiric Powers" `614f-c7bb-2050-c603` trägt Basis
`hidden="true"` und wird nur durch `atLeast 1 / childId="f557-…" /
scope="force"` aufgedeckt — und eine versteckte Gruppe versteckt, was sie hält
([§8](../../battlescribe-data-format.md#8-kategorien--sichtbarkeit)). Weil die
Blutlinie in **allen** Rostern identisch vorhanden ist, ist die Gruppe überall
sichtbar und die **einzige** noch variable Ursache für die Sichtbarkeit des
Slots ist das eigene `hidden`-Flag des Trägers. Die Blutlinie hängt am
**Kontingent**, nicht am Thrall, und geht deshalb nicht in den gezählten
Eltern-Rahmen ein. Nebenbei erfüllt sie die Force-Pflicht
`4a0a-b107-e726-da32` (min 1).

**Hinweis zur Regel hinter dem Eintrag:** Die verlinkte `rule`
`6e62-1598-5185-7d83` sagt inhaltlich „Army of Sylvania only". Das Gatter der
Daten sagt etwas anderes — nämlich „sobald der Elternteil irgendetwas hält".
Gepinnt wird, was in den Daten steht, nicht, was der Regeltext meint.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle
referenzieren `.gst` + Vampire-Counts-`.cat` (+ die per `catalogueLink`
benötigte `Mercenaries`-`.cat`). Alle fünf tragen **denselben** einen Vampire
Thrall und **dieselbe** Blutlinie; das Delta ist ausschließlich, **was der
Thrall hält**.

> **Assertion-Fokus:** der `isHidden`/`current`-Zustand des „Wolf Lord"-Slots am
> Thrall und dessen eigene Obergrenze `06c5-d960-2b4d-399a`. Andere
> Armeeaufbau-Diagnosen (General-/Core-Pflicht, Punktelimit, Kategoriegrenzen)
> können zusätzlich auftreten und sind hier ohne Belang.

> **Adressierung des Slots:** In den Rostern 01–03 ist „Wolf Lord" **angeboten,
> aber nicht gewählt** — der gemeinte Slot ist der Angebots-Anker
> (`anchorKind: "offerAnchor"`), wie beim ebenfalls gegateten, ungewählten
> „Magic Level 4"-Slot in
> [`at-least-unit-upgrade-gate`](../at-least-unit-upgrade-gate/README.md). In
> 04/05 ist er **belegt** (`anchorKind: "occupied"`). Ausgewählt wird der Slot
> ansonsten über `defId` (der Verweis `b8be-…`) + `targetDefId` (das Ziel
> `66bc-…`).

| # | Testtitel | Roster-Zustand | Ist im Eltern-Rahmen | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|----------------------|-------------------------------------------------------|---------|
| 01 | Leerer Rahmen: der Slot bleibt verborgen | Thrall **ohne jede** Unterauswahl. | **0** | ALP-R1 hält **nicht**: der einzige Modifier bleibt aus, „Wolf Lord" behält `hidden="true"` (`isHidden` **true**, Ist 0). `06c5-…` feuert nicht (Ist 0 ≤ 1). | [`01-empty-frame-wolf-lord-hidden.ros`](rosters/01-empty-frame-wolf-lord-hidden.ros) |
| 02 | **Eine beliebige** Auswahl deckt auf | **Identisch zu 01** + Pflicht-**Handweapon**. | **1** | ALP-R1 hält (1 ≥ 1): „Wolf Lord" ist **sichtbar** (`isHidden` **false**), obwohl in der Gruppe „Vampiric Powers" nichts gewählt ist — der Rahmen ist die **Thrall-Auswahl** (ALP-R4). Wolf Lord selbst ungewählt (Ist 0). | [`02-one-selection-reveals-wolf-lord.ros`](rosters/02-one-selection-reveals-wolf-lord.ros) |
| 03 | Zwei Auswahlen — `atLeast` bleibt `atLeast` | Wie 02 + **Great Weapon**. | **2** | Unverändert **sichtbar** (`isHidden` false, Ist 0). Mehr als eins verhält sich exakt wie eins; die Aufdeckung hängt an **keiner** bestimmten Zahl und an **keinem** bestimmten Kind. | [`03-two-selections-reveal-unchanged.ros`](rosters/03-two-selections-reveal-unchanged.ros) |
| 04 | Selbst-Aufdeckung: der Träger zählt mit | Wie 02 + **Wolf Lord** (`number="1"`). | **2** | Sichtbar (`isHidden` false), Slot **belegt** mit Ist **1**. `06c5-…` ist mit Ist 1 gegen Grenze 1 exakt eingehalten und feuert **nicht** (ALP-R5/R6). | [`04-wolf-lord-selected-self-reveal.ros`](rosters/04-wolf-lord-selected-self-reveal.ros) |
| 05 | Zweifacher Wolf Lord: Obergrenze verletzt | Wie 04, aber `number="2"`. | **3** | Sichtbarkeit **unverändert** (`isHidden` false), Ist **2**. **`06c5-d960-2b4d-399a` feuert** mit **Ist 2 / Grenze 1** — Max-Grenzen gelten unabhängig von der Sichtbarkeit (ALP-R7). | [`05-wolf-lord-twice-max-fires.ros`](rosters/05-wolf-lord-twice-max-fires.ros) |

**Herleitung von Ist/Grenze (aus Daten + Rosterbau, nicht aus einem Testlauf):**
`bound` ist der geschriebene Katalogwert `value="1"` der Grenze
`06c5-d960-2b4d-399a`. `actual` ist die Zählung von `field="selections"` im
`scope="parent"`-Rahmen — der Thrall-Auswahl — mit
`includeChildSelections="false"`: in 01–03 steht dort **keine**
`66bc-…`-Selektion (Ist 0), in 04 genau eine (Ist 1), in 05 eine Selektion mit
`number="2"` (Ist 2). Die Zahlen in der Spalte „Ist im Eltern-Rahmen" sind die
Zählung derselben Query mit `childId="any"`: 0 / 1 / 2 / 2 / 3.

**Das Messpaar:** **01 ↔ 02**. Das einzige Delta ist eine Auswahl, die mit der
Gruppe „Vampiric Powers" nichts zu tun hat — und genau daran kippt die
Sichtbarkeit. Eine Auswertung, die als Rahmen die **Gruppe** statt der
umschließenden Auswahl nähme, hielte den Slot in 02 weiter verborgen.
**03** schließt aus, dass die Aufdeckung an einer bestimmten Zahl hängt,
**04** zeigt die Selbst-Aufdeckung, **05** trennt die Sichtbarkeit von der
Obergrenze.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Kontingent „Standard (VC-AB)" (VC-`.cat`) | `e989-15b8-7eb6-9668` |
| Vampire Thrall (Wurzel-Unit, Hero; **der Eltern-Rahmen**) | `e37b-c827-99ac-b706` — Grenzen `d72d-5648-1e88-add3` (min 0 force) / `4369-4ef3-2a81-0ba9` (max −1 pts parent) |
| „Handweapon" des Thralls (Pflicht-Kind, Basis `hidden="false"`) | `9dfd-134c-53c1-7181` — min `e2bd-1d63-464c-5b6a` / max `a66c-1bfe-738d-e621` |
| **selectionEntry „Wolf Lord" (Träger der Zelle, Basis `hidden="true"`, 10 pts)** | **`66bc-8fc1-81a2-9cd4`** — infoLink `232c-643d-9475-8090` → rule `6e62-1598-5185-7d83` |
| **Eigene Obergrenze des Trägers** | **`06c5-d960-2b4d-399a`** (`type=max value=1 field=selections scope=parent shared=true includeChildSelections=false`) |
| entryLink auf „Wolf Lord" (der Slot; `hidden="false"`, ohne Modifier) | `b8be-a71f-569c-5cdc` |
| Gruppe „Vampiric Powers (Clan Von Carstein)" / ihr Verweis (Basis `hidden="true"`) | `84fd-049b-21b4-9075` / `614f-c7bb-2050-c603` (aufgedeckt per `atLeast 1` `f557-…` `scope="force"`) |
| Gruppe „Bloodline" / ihr Verweis am Thrall | `0719-24b8-19d4-c832` / `85fb-0691-1ee6-37f8` |
| Gruppe „Magic selection" / ihr Verweis am Thrall (Budget max 50 pts) | `53e8-0ce2-eaf6-0163` / `2e0c-7fa1-642c-54b7` — Grenze `a06b-caa9-8f13-c480` |
| „Bloodlines" (Kontingent-Auswahl, Pflicht min 1) / Gruppe „Vampiric Bloodline" | `a56a-eb32-5a45-16fd` — `4a0a-b107-e726-da32` / `5655-13ba-8980-bd1c` (max 1 `39c7-f615-17db-7016`) |
| Bloodline of Clan Von Carstein (Aufdecker der Gruppe, in allen Rostern) | `f557-097a-d26b-9363` — Clan-Kategorie `ff24-ca11-afd5-865b` |
| „Great Weapon" (neutrale Zweit-Auswahl in Roster 03) | `.gst` `1eb7-3f36-8cf7-e0ba` via Verweis `cbd9-0b5f-9a0e-37a1` (max 1 `c40e-ba85-3b7e-9483`) in Gruppe „Weapons" `ce21-4504-871f-b034` (max 1 `7807-a031-bb3e-370c`) |
| Kategorien Heroes / Characters / Special list rules | `c16b-f319-2c62-2c12` / `7a1c-d611-c2dc-def1` / `32f1-197f-d719-a393` |
| **Zweites, unerreichbares Vorkommen der Zelle** | `c791-87b9-b00a-ddb4` („From Death Awakened", max 1 parent `97fc-c78e-6d95-d6d0`) — **kein** `entryLink` im Korpus |
| catalogueLink VC → Mercenaries | `ef73-f9bd-e250-54d2` → `fc47-8392-a6c8-452a` |

### Bewusst nicht gepinnte Facetten

- **Die fehlende Pflicht-Handweapon in Roster 01.** Der Thrall ist dort
  absichtlich **nicht** katalogkonform: `e2bd-1d63-464c-5b6a` (min 1) ist
  unerfüllt und der Knoten fehlt ganz. Ob eine Mindestgrenze auf einer **gar
  nicht vorhandenen** Auswahl gemeldet wird, ist die Frage des Pflicht-Ankers
  und Gegenstand von
  [`parent-scope-missing-mandatory`](../parent-scope-missing-mandatory/README.md)
  bzw. [`group-scope-missing-mandatory`](../group-scope-missing-mandatory/README.md).
  Die Id steht in Roster 01 deshalb **weder in `firing` noch in `absent`** —
  genauso wie in
  [`less-than-parent-parry-save`](../less-than-parent-parry-save/README.md)
  (Roster 01). Ein leerer Rahmen ist der **einzige** Weg, die Bedingung scheitern
  zu lassen: jede Auswahl unter dem Vampir — welche auch immer — lässt sie halten.
- **`includeChildSelections="false"` an dieser Bedingung (ALP-R2).** Nicht
  beobachtbar: ein Zeuge auf Tiefe 2 setzt zwingend einen Zeugen auf Tiefe 1
  voraus, der ohnehin zählt. Die Flag-Wirkung bleibt an dieser Zelle latent und
  wird weder als feuernd noch als abwesend behauptet.
- **`shared="true"` an dieser Bedingung.** Jedes Roster enthält **genau einen**
  Vampir; der Unterschied zwischen „über alle Instanzen" und „nur diese Instanz"
  ist damit nicht sichtbar und wird nicht behauptet.
- **Ein versteckter *Elternteil* und dessen Projektion auf den Kind-Slot.** Die
  Formatreferenz klärt für `selectionEntryGroup`s ausdrücklich, dass eine
  versteckte Gruppe ihre Mitglieder mitversteckt
  ([§8](../../battlescribe-data-format.md#8-kategorien--sichtbarkeit)) — offen
  bleibt, was ein versteckter **Eintrag** für die Projektion seiner Kind-Slots
  bedeutet. Die Roster umgehen die Frage: der einzige versteckte Vorfahre
  (`614f-…`) ist in **allen** fünf Rostern aufgedeckt, und der Thrall selbst ist
  in der Standard-Force nie versteckt. Die Behauptung dieses Szenarios ist
  ausschließlich, dass der **eigene** `hidden`-Wert des Trägers vom **eigenen**
  Modifier gekippt wird.
- **Nebenwirkungen der Von-Carstein-Blutlinie am Thrall** (Namenszusatz „of Clan
  Von Carstein", Kategorie `ff24-…`, Aufdecken der Gruppe „Armour"
  `66f2-d6a1-420c-5a39`): in allen fünf Rostern identisch und deshalb ohne
  Aussagekraft für das Delta — weder in `firing` noch in `absent` noch in
  `capabilities`.
- **`effectiveMax` / `isBlocked` / `headroom` des Slots.** Nicht behauptet; die
  Aussage über die Obergrenze läuft über `firing`/`absent` je Constraint-Id, wo
  die Zuordnung eindeutig ist. Der `anchorKind` dient in allen fünf Rostern
  allein der **eindeutigen Adressierung** des gemeinten Slots — `offerAnchor`
  für die angebotene, nicht gewählte Definition (01–03), `occupied` für den
  belegten Slot (04/05) — und trägt keine darüber hinausgehende Aussage.
- **Der 50-pts-Deckel `a06b-caa9-8f13-c480`** steht nur als Kontrolle in
  `absent`: die Wolf-Lord-Kosten summieren sich in keinem Roster über 20 pts
  (2 × 10), die Grenze kann unter keiner Lesart feuern.
