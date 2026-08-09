# E2E-Regeln & Testkatalog: `set` auf eine Kostenart, gegated per Kontingent

**Rolle:** Black-Box-Test (kein Blick in den Quellcode der Engine). Alle Regeln sind
aus den Katalogdaten der *6th Definitive Edition* und aus
[`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md) abgeleitet;
das Eingabeformat der Roster folgt den bereits verifizierten Fixtures
(direktes `entryId`, `entryLinkId=""`, verschachtelte `selections` mit `number`).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1) — Kostenart **`pts`** `ecfa-8486-4f6c-c249`
- Armee: `Vampire Counts (6th definitive edition).cat`
  (`4d73-5ab0-9020-403c`, rev 1) — plus die per `catalogueLink`
  `ef73-f9bd-e250-54d2` geforderte `Mercenaries`-`.cat` (`fc47-8392-a6c8-452a`)
- Kontingente: **„Standard (VC-AB)"** `e989-15b8-7eb6-9668` (ungegatete Kontrolle),
  **„Necromancer's Army (VC-AB)"** `d3af-1add-4e99-b977` und
  **„Army of Sylvania (SoC)"** `4072-c3b8-84c4-a097` (die beiden gegateten)

## Worum es geht

Ein `<modifier type="set" …>` kann als `field` nicht nur ein Attribut oder eine
Constraint-Id tragen, sondern auch eine **Kostenart-Id**
([§7.5](../../battlescribe-data-format.md#75-cost--cost-type) /
[§7.7](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat)).
Dann ersetzt er die Kosten **seines Trägers** in genau dieser Kostenart durch
seinen `value` — solange seine Bedingung hält. Hält sie nicht, bleibt der
**hingeschriebene** `<cost>`-Wert stehen; der Modifikator ist kein Zuschlag,
sondern ein Ersatz.

Das Zombie-Modell der Vampire Counts trägt genau dieses Muster in seiner
saubersten Form: **eine** geschriebene Kostenzeile und **zwei** einbedingte
`set`-Modifikatoren ohne `<repeats>`, die einander ausschließen, weil eine Roster
in einem Kontingent zugleich nicht in einem anderen sein kann. Damit kostet
dieselbe Auswahl in drei Kontingenten drei verschiedene Beträge — und das ist die
Zahl, mit der jede Summe über `pts` weiterrechnet, die Punktsumme der Roster
eingeschlossen.

```
selectionEntry "Zombies"  749f-cf91-6317-7ac0   (unit, 0 pts)
  └ selectionEntry "Zombie"  5c6c-eaf9-2716-6f7e   (model)
       <cost name="pts" typeId="ecfa-8486-4f6c-c249" value="6"/>      ← geschrieben
       <modifier type="set" value="5" field="ecfa-8486-4f6c-c249">    ← Gate: Force d3af…
       <modifier type="set" value="8" field="ecfa-8486-4f6c-c249">    ← Gate: Force 4072…
```

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **SCV-R1** | **`set` auf eine Kostenart ersetzt.** Hält die Bedingung, ist die Kostenart des Trägers exakt der `value` des Modifikators — nicht der geschriebene Wert und nicht die Summe aus beidem. Im Kontingent „Necromancer's Army" kostet ein Zombie-Modell **5** pts statt der geschriebenen 6. | VC-`.cat` → `selectionEntry "Zombies"` **`749f-cf91-6317-7ac0`** → Kind `selectionEntry "Zombie"` **`5c6c-eaf9-2716-6f7e`** (`type="model"`): `<cost name="pts" typeId="ecfa-8486-4f6c-c249" value="6"/>` und `<modifier type="set" value="5" field="ecfa-8486-4f6c-c249">` mit `<condition type="instanceOf" value="1" field="selections" scope="force" childId="d3af-1add-4e99-b977" shared="true" includeChildSelections="true"/>`. `4072`/`d3af` sind `forceEntry`-Ids (VC-`.cat` → `<forceEntries>`). |
| **SCV-R2** | **Derselbe Träger, zweites Gate, anderer Wert.** Im Kontingent „Army of Sylvania (SoC)" kostet dasselbe Modell **8** pts. | Derselbe Eintrag `5c6c…`: `<modifier type="set" value="8" field="ecfa-8486-4f6c-c249">` mit derselben Bedingungsform gegen `childId="4072-c3b8-84c4-a097"`. |
| **SCV-R3** | **Hält kein Gate, bleibt der geschriebene Wert unangetastet.** In jedem anderen Kontingent — hier „Standard (VC-AB)" — kostet das Modell die geschriebenen **6** pts. Es gibt keine dritte Quelle: der Eintrag trägt genau vier Modifikatoren, und die beiden übrigen adressieren **Constraint-Ids** (`6610-c1d7-511e-688d`, `9f51-6184-28cc-ec80`), nicht die Kostenart. Beide Kosten-Modifikatoren tragen **kein** `<repeats>`, der Wert wird also nicht vervielfacht. | Dieselben `<modifiers>` von `5c6c…`; der `<costs>`-Block nennt neben `pts` nur ` Casting Dice` (`fcec-2340-6368-a2ba`) und ` Dispel Dice` (`6001-b2bf-4529-c07d`), beide `value="0"`. |
| **SCV-R4** | **Die Gates schließen einander aus.** `instanceOf … scope="force"` prüft die Identität des Kontingents; eine Force ist entweder `d3af…` **oder** `4072…` **oder** keins von beidem. Es gibt daher genau drei mögliche Kosten des Modells (5 / 8 / 6) und keine Reihenfolgefrage zwischen den beiden `set`. | VC-`.cat` → `<forceEntries>`: `e989-15b8-7eb6-9668`, `d3af-1add-4e99-b977`, `4072-c3b8-84c4-a097` sind drei verschiedene `forceEntry`-Elemente. |
| **SCV-R5** | **Der ersetzte Wert ist es, mit dem weitergerechnet wird.** Jede Summe über `pts` benutzt die ersetzten Kosten. Beobachtbar ist das an der **engine-eigenen Budget-Regel** `budget::ecfa-8486-4f6c-c249`: 20 Modelle kosten 120 / 100 / 160 pts, je nach Kontingent. | Messgröße `rosterBudget` und Grenz-Id `budget::<costType-Id>` sind in [`violation-classification`](../violation-classification/README.md) (VCC-R6) und [`orcs-and-goblins-budget`](../orcs-and-goblins-budget/README.md) (OGB-R2) aus den Daten festgenagelt; die Grenze ist der `<costLimit>`-Wert der Roster. Kostenart: `.gst` → `<costTypes>` → `costType id="ecfa-8486-4f6c-c249" name="pts"`. |
| **SCV-R6** | **Die Summe ist sauber, weil alles andere 0 pts kostet.** Die Einheit „Zombies" selbst kostet 0 pts; ihre einzige unbedingte Pflicht-Unterauswahl „Handweapon" (`4de6-f2a7-b81a-9d2b`) ebenfalls. In „Army of Sylvania" kommen zwei sonst verborgene Gruppen hinzu („Armour" `daef-3921-e971-8d99`, „Weapons" `ced9-661e-af2a-120c`) — deren Optionen kosten dort ausnahmslos **0** pts, weil ihre Zuschläge `notInstanceOf 4072…` verlangen. Die Punktsumme ist daher exakt *Modellzahl × Modellkosten*. | VC-`.cat`: `749f…` `<costs>` `pts value="0"`; `4de6…` `pts value="0"`; `3c11-22a3-78bf-7927` („Light Armour") `pts value="0"` + `increment 2` mit `condition type="notInstanceOf" … childId="4072-c3b8-84c4-a097"`; `5694-b8f2-88cd-3e6f` („Shield") `pts value="0"`; `6d1e-d792-a94d-f03a` („Spears") `pts value="0"` + `increment 1` mit derselben `notInstanceOf`-Bedingung; `.gst` → `b3f3-a133-2869-0be8` („Halberds") `pts value="0"`. |
| **SCV-R7** | **Kein Katalog-`constraint` misst diese Kostensumme.** In der VC-`.cat` trägt **kein** `constraint` mit `field="ecfa-8486-4f6c-c249"` einen Bezugsrahmen, der die Zombie-Modelle einschlösse — alle solchen Grenzen sind `scope="parent"` an Magie-Item-Gruppen der Charaktere. In der `.gst` gibt es **keinen einzigen** `constraint` mit `field="ecfa-8486-4f6c-c249"` oder `field="limit::ecfa-8486-4f6c-c249"`. Die veränderten Kosten sind deshalb **nicht** als feuernde Katalog-Grenze zu beobachten, sondern **nur** über die Budget-Regel aus SCV-R5. | Vollständige Fundstellenprüfung `constraint … field="ecfa-8486-4f6c-c249"` in VC-`.cat` (sämtlich `scope="parent"`, z. B. `e4ef-628f-fae9-f0db`, `b012-c96f-128c-0848`) und in der `.gst` (keine Fundstelle). |
| **SCV-R8** | **Der Fähigkeits-Datensatz trägt keinen Kostenwert.** Die Aussagen über einen Slot (`name`, `current`, `effectiveMin`, `effectiveMax`, `headroom`, `isHidden`, `isBlocked`, `isMandatoryUnmet`, `authorMessages`, `infoElements`) kennen laut Manifest-Vertrag **kein** Feld für Kosten. Die ersetzten Kosten sind dort also **nicht** pinnbar — siehe „Was dieses Szenario bewusst NICHT behauptet". | Manifest-Vertrag im Kopfkommentar des Runners (`expect.capabilities[]`). |
| **SCV-R9** | **Unabhängiger Zeuge, dass ein Gate hält.** Derselbe `instanceOf`-Test gegen `4072…` schaltet an der Einheit „Zombies" einen Namens-`set`: im Sylvania-Kontingent heißt sie **„Sylvanian Levy"**, sonst „Zombies". Das belegt die Gültigkeit des Gates **ohne** die Kostenrechnung der Engine zu benutzen. | VC-`.cat` → `749f-cf91-6317-7ac0` → `<modifier type="set" value="Sylvanian Levy" field="name">` mit `condition type="instanceOf" value="1" field="selections" scope="force" childId="4072-c3b8-84c4-a097"`. Für `d3af…` gibt es an dieser Einheit **keinen** Namens-Modifikator — dort bleibt der Katalogname stehen. Das Muster „`set` auf `field="name"`" ist in [`modifier-effective-name`](../modifier-effective-name/README.md) festgenagelt. |

### Zweiter Zeuge desselben Konstrukts (bewusst nicht als Träger benutzt)

Das Schwester-Modell **„Skeletons"** `eaa1-c6a6-9aae-ae9a` (unter der Einheit
`9ac2-f4c1-bcc3-3aee`) trägt dasselbe Muster: geschrieben `pts value="8"`,
`set 7` und `set 10`. Seine Bedingungen stecken aber in `<conditionGroups>`
(`or`) — der `set 7` gilt für **zwei** Kontingente (`f37a…` „Army of the
Lichemaster" **oder** `d3af…`). Für dieses Szenario wäre das eine zweite,
sachfremde Aussage (Bedingungsgruppen-Semantik, bereits in
[`condition-group-not`](../condition-group-not/README.md) und
[`modifier-group-repeats`](../modifier-group-repeats/README.md) abgedeckt);
deshalb ist der **Zombie** der Träger: seine beiden Kosten-Modifikatoren tragen
je genau **eine** unmittelbare `<condition>`.

---

## Wie `actual` / `bound` hier zustande kommen

Die Tabelle ist die **Herleitung aus den Katalogdaten**, nicht selbst eine
Assertion. `bound` ist der `<costLimit>`-Wert der jeweiligen Roster, `actual` die
Punktsumme, die sich aus SCV-R1…R3 und R6 ergibt.

| Roster | Kontingent | greifender Kosten-Modifikator | wirksame pts je Modell | Modelle | Summe = `actual` | `costLimit` = `bound` | Budget-Regel |
|--------|------------|-------------------------------|------------------------|---------|------------------|------------------------|--------------|
| 01 | Standard `e989…` | **keiner** (beide Bedingungen falsch) | **6** (geschrieben) | 20 | **120** | 110 | feuert, `delta` −10 |
| 02 | Necromancer's Army `d3af…` | `set 5` | **5** | 20 | **100** | 110 | feuert **nicht** |
| 03 | Army of Sylvania `4072…` | `set 8` | **8** | 20 | **160** | 110 | feuert, `delta` −50 |
| 04 | Necromancer's Army `d3af…` | `set 5` | **5** | 20 | **100** | 90 | feuert, `delta` −10 |

Die Modellzahl **20** liegt in beiden Zählgrenzen des Modells
(`6610-c1d7-511e-688d` `min 10 scope=parent`, `1763-7c07-c161-7072`
`max 40 scope=parent`) und ist in allen vier Rostern identisch — es bewegt sich
also wirklich nur der Preis je Modell.

Roster 02 und 04 unterscheiden sich **allein** im Budget. Ohne Roster 04 wäre die
Aussage über das Necromancer's-Kontingent bloß „die Summe ist höchstens 110";
mit ihm ist sie exakt: die Summe ist 100, also 5 pts je Modell.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle laufen gegen
`.gst` + VC-`.cat` (+ die per `catalogueLink` benötigte `Mercenaries`-`.cat`).

> **Assertion-Fokus:** ausschließlich die Budget-Grenze
> `budget::ecfa-8486-4f6c-c249` und die beiden Namens-Zeugen. Andere
> Armeeaufbau-Diagnosen dürfen zusätzlich auftreten und sind hier ohne Belang —
> insbesondere die Core-Untergrenze (`35c2-d478-392a-aeb1`, `min 2` je
> Kontingent), die Bloodlines-Pflicht (`4a0a-b107-e726-da32`), die
> Handweapon-Pflicht unter der Einheit (`8b97-ef59-1049-3925`) und die im
> Sylvania-Kontingent zusätzlich eingeblendeten Pflicht-Gruppen
> (`3d7a-cfda-8792-b579`, `c744-316a-9aad-f10d`, `a848-036f-df00-845a`).

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | Kein Gate: die geschriebenen Kosten bleiben stehen | Kontingent „Standard (VC-AB)", eine Zombies-Einheit mit **20** Modellen, Budget **110** pts. | **SCV-R3 + SCV-R5:** Die Armee kostet **120** pts (20 × die geschriebenen 6) und sprengt das Budget um 10. **SCV-R9:** Die Einheit heißt weiterhin **„Zombies"** — der Sylvania-Test greift hier nicht. | [`01-standard-force-written-cost.ros`](rosters/01-standard-force-written-cost.ros) |
| 02 | Gate `set 5`: dieselbe Armee bleibt im Budget | **Identischer** Aufbau, nur Kontingent „Necromancer's Army (VC-AB)"; Budget unverändert **110** pts. | **SCV-R1 + SCV-R5:** Das Modell kostet jetzt **5** statt 6 pts, die Armee also **100** pts — dieselbe Modellzahl bleibt **innerhalb** desselben Budgets, die Budget-Regel feuert **nicht**. | [`02-necromancer-army-set-5-within-budget.ros`](rosters/02-necromancer-army-set-5-within-budget.ros) |
| 03 | Gate `set 8`: dieselbe Armee sprengt das Budget | **Identischer** Aufbau, nur Kontingent „Army of Sylvania (SoC)"; Budget unverändert **110** pts. | **SCV-R2 + SCV-R5:** Das Modell kostet **8** pts, die Armee **160** — 50 pts über dem Budget. **SCV-R9:** Die Einheit heißt hier **„Sylvanian Levy"**; damit ist unabhängig von der Kostenrechnung bezeugt, dass genau dieses Force-Gate hält. | [`03-sylvania-force-set-8-over-budget.ros`](rosters/03-sylvania-force-set-8-over-budget.ros) |
| 04 | Der ersetzte Wert ist exakt 5, nicht bloß „klein genug" | Wie 02 (dasselbe Kontingent, dieselben 20 Modelle), nur Budget **90** pts. | **SCV-R1:** Die Armee kostet **100** pts und überschreitet die 90 um 10 — die Summe ist damit auf den Punkt festgenagelt. | [`04-necromancer-army-set-5-over-tight-budget.ros`](rosters/04-necromancer-army-set-5-over-tight-budget.ros) |

### Was dieses Szenario bewusst NICHT behauptet

- **Keine feuernde Katalog-Grenze auf der Kostensumme.** Nach SCV-R7 gibt es in
  diesem Datensatz keinen `constraint`, der die pts der Zombie-Modelle summiert.
  Eine Erwartung `measure="costSum"` ließe sich hier nur erfinden — das verbietet
  die Black-Box-Rolle. Beobachtbar bleibt allein die Budget-Regel.
- **Kein Kostenwert im Fähigkeits-Datensatz.** Nach SCV-R8 kennt
  `expect.capabilities[]` kein Kosten-Feld. Die Kapazitäts-Aussagen dieses
  Szenarios beschränken sich deshalb auf den **Namen** der Einheit (SCV-R9) —
  den Zeugen dafür, dass das Force-Gate hält. Wollte man die ersetzten Kosten
  direkt am Slot pinnen, müsste der Manifest-Vertrag um ein Kostenfeld erweitert
  werden; das ist eine Änderung am Runner und gehört nicht in die Autorenschaft.
- **Keine Aussage über `causes` der Budget-Meldung.** Die Budget-Regel entspringt
  keinem `<constraint>` und damit keinem Modifikator-Pfad (VCC-R6); ob die
  gegateten **Kosten**-Modifikatoren dort als Ursache erscheinen könnten, ist aus
  den Katalogdaten nicht zu entscheiden. Die Meldungs-Pins nennen deshalb
  `causes` nicht.
- **Keine Aussage über `anchorKind`/`anchorName` der Budget-Meldung** über das in
  [`violation-classification`](../violation-classification/README.md) (VCC-R6)
  bereits Festgenagelte hinaus.
- **Keine Aussage über die Sichtbarkeits-Nebenwirkungen des
  Sylvania-Kontingents** (die dort eingeblendeten Gruppen „Armour"/„Weapons").
  Sie sind für die Kostenrechnung folgenlos (SCV-R6) und in
  [`vampire-bloodlines`](../vampire-bloodlines/README.md) bzw.
  [`info-projection`](../info-projection/README.md) thematisch abgedeckt.

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID | Fundort (Datei / Element) |
|---------|-----|---------------------------|
| Kostenart „pts" | `ecfa-8486-4f6c-c249` | `.gst` → `<costTypes>` |
| Einheit „Zombies" (0 pts; Namens-`set` „Sylvanian Levy") | `749f-cf91-6317-7ac0` | VC-`.cat` → Wurzel-`<selectionEntries>` (Zeile 441) |
| Modell „Zombie" (Träger der Kosten-`set`) | `5c6c-eaf9-2716-6f7e` | VC-`.cat` → in `749f…` |
| Geschriebene Kosten des Modells | `<cost name="pts" typeId="ecfa-8486-4f6c-c249" value="6"/>` | VC-`.cat` → in `5c6c…` |
| Kosten-`set` **5**, Gate Kontingent „Necromancer's Army" | `modifier type="set" value="5" field="ecfa-8486-4f6c-c249"` → `condition instanceOf … childId="d3af-1add-4e99-b977" scope="force"` | VC-`.cat` → in `5c6c…` |
| Kosten-`set` **8**, Gate Kontingent „Army of Sylvania" | `modifier type="set" value="8" field="ecfa-8486-4f6c-c249"` → `condition instanceOf … childId="4072-c3b8-84c4-a097" scope="force"` | VC-`.cat` → in `5c6c…` |
| Zählgrenzen des Modells (Rahmen für die Modellzahl 20) | `6610-c1d7-511e-688d` (`min 10`) / `1763-7c07-c161-7072` (`max 40`) / `9f51-6184-28cc-ec80` (`max -1`) | VC-`.cat` → in `5c6c…` |
| Force „Standard (VC-AB)" (ungegatete Kontrolle) | `e989-15b8-7eb6-9668` | VC-`.cat` → `<forceEntries>` |
| Force „Necromancer's Army (VC-AB)" | `d3af-1add-4e99-b977` | VC-`.cat` → `<forceEntries>` |
| Force „Army of Sylvania (SoC)" | `4072-c3b8-84c4-a097` | VC-`.cat` → `<forceEntries>` |
| Kategorie „Core" (`categoryLink` in allen drei Kontingenten) | `64bf-efb4-9978-26df` — `6940-bf72-caa7-537f` / `b31d-af24-f6be-9eec` / `02aa-e3f6-d6ad-bbba` | `.gst` → `<categoryEntries>`, VC-`.cat` → `<forceEntries>` |
| Budget-Grenze (Engine-Regel, roster-weit) | `budget::ecfa-8486-4f6c-c249` | keine Katalogquelle — siehe SCV-R5 |
| Nullkosten-Nachbarn unter „Zombies" | `4de6-f2a7-b81a-9d2b` („Handweapon") | VC-`.cat` → in `749f…` |
| In Sylvania eingeblendete Nullkosten-Gruppen | `daef-3921-e971-8d99` („Armour") / `ced9-661e-af2a-120c` („Weapons") mit `3c11-22a3-78bf-7927`, `5694-b8f2-88cd-3e6f`, `6d1e-d792-a94d-f03a`, `ce00-67cf-caf7-8b3d` → `b3f3-a133-2869-0be8` | VC-`.cat` / `.gst` |
| Zweiter Zeuge desselben Konstrukts (nicht benutzt) | `eaa1-c6a6-9aae-ae9a` („Skeletons"-Modell: `8` geschrieben, `set 7`, `set 10`) unter `9ac2-f4c1-bcc3-3aee` | VC-`.cat` → Wurzel-`<selectionEntries>` |
| `catalogueLink` VC → Mercenaries | `ef73-f9bd-e250-54d2` → `fc47-8392-a6c8-452a` | VC-`.cat` → `<catalogueLinks>` |
