# E2E-Regeln & Testkatalog: `max` mit `scope="parent"` an einer **geteilten** Gruppe — ein Enchanted Item **je Träger**

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln, IDs und
Erwartungswerte sind **ausschliesslich aus den Katalogdaten** des
**upstream**-Fixture-Satzes (`src/__fixtures__/whfb6/`) und der
Formatspezifikation ([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md),
§7.1/§7.2/§7.6) abgeleitet. Die Roster-Form folgt der an diesem Satz bereits
verifizierten Gestalt (direktes `entryId`, `entryLinkId=""`, verschachtelte
`selections` mit `number`) aus
[`category-id-scope-instance-of`](../category-id-scope-instance-of/README.md),
ergänzt um `entryGroupId` für Gruppen-Mitglieder nach dem Muster von
[`parent-repeat-item-count`](../parent-repeat-item-count/README.md) — dort steht
die gleiche Bauform „Mitglied einer **geteilten** Gruppe, die über einen
`entryLink` an den Träger kommt".

- Spielsystem: `Warhammer Fantasy Battle 6th edition.gst`
  (`6d8e-38d9-3c69-febf`, rev 8) — einziges Kontingent: `forceEntry`
  **„Standard "** `7d9d-6c8d-4ea0-b7ad` (`.gst:61`, das Schluss-Leerzeichen im
  Namen steht so im Katalog).
- Armeebuch: `Vampire Counts.cat` (`ea4b-9294-3427-1fc1`, rev 10,
  `gameSystemId="6d8e-38d9-3c69-febf"`, `gameSystemRevision="8"`).
- **Keine** weitere `.cat`: der upstream-Vampire-Counts-Katalog trägt **kein**
  `<catalogueLinks>`. Ein Szenario nennt die Dateien **eines** Fixture-Satzes
  und mischt den upstream- nie mit dem Definitive-Korpus.

---

## Die Regel (In-World)

Ein Charakter darf **höchstens einen** Gegenstand aus der Liste „Enchanted
Items" tragen. Die Grenze gilt **je Träger**, nicht je Armee: eine Armee mit
fünf Charakteren darf fünf Enchanted Items enthalten, solange jeder Charakter
nur einen davon hält. Dass ein bestimmter Gegenstand nur **einmal je Armee**
existiert, ist eine **zweite, unabhängige** Regel — sie steht an den
Gegenständen selbst und trägt dort `scope="roster"`.

Die Datenlage dazu ist knapp und eindeutig: die geteilte Gruppe trägt **genau
eine** Grenze.

```xml
<!-- Vampire Counts.cat:3579-3635, um Kosten gekürzt -->
<selectionEntryGroup id="76c3-b01d-0836-2f86" name="Enchanted Items"
                     hidden="false" collective="false" import="true">
  <constraints>
    <constraint field="selections" scope="parent" value="1.0" percentValue="false"
                shared="true" includeChildSelections="false" includeChildForces="true"
                id="e945-1f86-ecf8-4c65" type="max"/>            <!-- :3581 -->
  </constraints>
  <selectionEntries>
    <selectionEntry id="5095-e258-cf55-78fc" name="Rod of Flaming Death" type="upgrade">
      <constraints><constraint … scope="roster" value="1.0" id="e309-8c5f-eab3-204a" type="max"/></constraints>
      <costs><cost name="pts" typeId="ecfa-8486-4f6c-c249" value="50.0"/></costs>
    </selectionEntry>
    <selectionEntry id="f26b-8b1c-b3cc-57b7" name="Cursed Book"               … 50 pts, max 1 roster: 71ad-c7ea-1916-3c28/>
    <selectionEntry id="72ba-8771-2926-3354" name="Cloak of Mist and Shadows" … 45 pts, max 1 roster: bbdf-fc18-5581-1ef2/>
    <selectionEntry id="dbc8-8204-b238-c315" name="Talon of Death"            … 40 pts, max 1 roster: 6af0-7513-7375-ff53/>
    <selectionEntry id="a46f-b46b-2efc-0283" name="Casket of Ages"            … 25 pts, max 1 roster: c235-25ac-6aaf-b4bd/>
  </selectionEntries>
</selectionEntryGroup>
```

Die Gruppe steht unter `<sharedSelectionEntryGroups>` und wird von **sechzehn**
`entryLink`s mit `targetId="76c3-b01d-0836-2f86"` gehalten (`:933`, `:1075`,
`:1144`, `:1220`, `:1403`, `:1538`, `:1643`, `:1803`, `:2005`, `:2045`,
`:2111`, `:2176`, `:2434`, `:2610`, `:2710`, `:2916`) — je einmal aus der
„Magic Items"-Gruppe eines Charakters bzw. einer Blutlinien-Aufwertung. **Eine**
Definition, **viele** Träger: genau die Konstellation, in der sich Eltern- und
Roster-Rahmen unterscheiden.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **PMEI-R1** | Die Gruppe „Enchanted Items" trägt **genau eine** Grenze: `type="max"`, `field="selections"`, `value="1.0"` — der `bound` jeder Verletzung ist damit **1**, und er ist **stabil**: die Id `e945-1f86-ecf8-4c65` kommt im ganzen Fixture-Satz **genau einmal** vor, kein `modifier` adressiert sie. | `Vampire Counts.cat:3581`. Suche nach `e945-1f86-ecf8-4c65` über `src/__fixtures__/whfb6/`: 1 Treffer (die Grenze selbst). Modifier adressieren einen Constraint über dessen `id` ([§7.6](../../battlescribe-data-format.md#76-constraint)). |
| **PMEI-R2** | Eine Grenze an einer `selectionEntryGroup` zählt **ihre Mitglieder**, nicht die Gruppe. Der `actual` ist also die Zahl der gewählten Enchanted Items, nicht 0 und nicht 1 („die Gruppe"). | [§7.6-Regelkasten](../../battlescribe-data-format.md#76-constraint): *„Gezählt werden die Auswahlen **unterhalb** des Trägers der Grenze … Eine Grenze an einer `selectionEntryGroup` zählt damit **ihre Mitglieder**"*. Mitglieder: `:3584`, `:3594`, `:3604`, `:3614`, `:3624`. Präzedenz: CISI-R8 in [`category-id-scope-instance-of`](../category-id-scope-instance-of/README.md), VBL-R2. |
| **PMEI-R3** | `scope="parent"` macht die **Elternauswahl, die die Gruppe hält**, zum Zählrahmen — hier die Charakter-Auswahl. Der Rahmen ist damit **je Träger**, und ein Roster hat so viele Rahmen wie Träger. | [§7.6](../../battlescribe-data-format.md#76-constraint) (`scope` = Bezugsrahmen der Zählung) und [§3.4](../../battlescribe-data-format.md#34-kontext-threading): *„`constraint`s mit `scope="parent"` vergleichen aufgelöste **Ziel-IDs**"*. Im Datensatz: die Gruppe hängt nie direkt am Kontingent, sondern immer unter einer „Magic Items"-Gruppe eines Charakters (`:1067` Wight Lord, `:1212` Necromancer, …). |
| **PMEI-R4** | `shared="true"` **weitet den Rahmen nicht**. Es entscheidet, ob über die **Verweis-Instanzen** derselben geteilten Definition **innerhalb** des vom `scope` benannten Rahmens zusammengezählt wird — den Rahmen benennt allein `scope`. | [§7.6](../../battlescribe-data-format.md#76-constraint): `scope` = *„Bezugsrahmen der Zählung"*, `shared` = *„ob der gezählte Wert über alle Link-Instanzen geteilt wird oder pro Instanz gilt"* — zwei verschiedene Attribute mit zwei verschiedenen Aufgaben. **Datenintern**: `scope="parent" shared="true"` steht in diesem Katalog **306-mal**, u. a. an „Mounts" (`7e5f-f372-f244-a864`, `:871`), „Armour" (`8249-154b-90f2-ccec`, `:1046`) und „Bloodline" (`6c3a-e4ae-3667-440f`, `:1374`). Läse man `shared="true"` roster-weit, dürfte eine Armee **insgesamt** ein Reittier, eine Rüstung und eine Blutlinie enthalten — der Katalog wäre für jede Liste mit zwei Charakteren unbaubar. |
| **PMEI-R5** | `includeChildForces="true"` kann einen **Eltern**-Rahmen nicht aufweiten: ein Eltern-Rahmen ist eine **Auswahl**, kein Kontingent. Das Flag regelt den Beitrag **untergeordneter Kontingente** und ist an einer `scope="parent"`-Grenze wirkungslos. | [§7.6](../../battlescribe-data-format.md#76-constraint): `includeChildForces` = *„Ob untergeordnete **Forces** mitgezählt werden"*; `false` rechnet *„only from parent force selections"*. **Datenintern**: dieselbe In-World-Regel „ein Gegenstand je Charakter" ist im selben Katalog in **beiden** Schreibweisen notiert — mit `includeChildForces="true"` (`c971-b944-79fa-980d` `:1400`, `d6d1-6f3a-1cfe-ebc2` `:1535`, `8c41-40e0-c5ca-ac74` `:1800`, … an den „Arcane Items"-Verweisen) und mit `includeChildForces="false"` (`4c83-9c72-9159-2d05` `:935`, `af46-82f9-3c5d-5f34` `:1405` — beide an `entryLink`s auf **genau diese** Enchanted-Items-Gruppe). Ein Flag, das die Bedeutung umdrehte, könnte nicht beliebig zwischen zwei wortgleichen Stellen wechseln. |
| **PMEI-R6** | `includeChildSelections="false"` hält die Zählung bei den **eigenen** Mitgliedern der Gruppe; es zählt *„just `scope`'s `field`"* — eingeschränkt, **nicht** leer. In diesen Daten ist das Flag ohnehin inert: **kein** Mitglied der Gruppe hat Kinder. | [§7.6](../../battlescribe-data-format.md#76-constraint), Zeile `includeChildSelections`. Mitglieder `:3584-3633`: je nur `<constraints>` und `<costs>`, keine `selectionEntries`/`entryLinks`/`selectionEntryGroups`. |
| **PMEI-R7** | Jedes Mitglied trägt **zusätzlich** eine eigene Grenze `max 1` mit `scope="roster"` — diese zählt **armeeweit**. Sie ist die Gegenprobe zum Eltern-Rahmen und liegt in Roster 05 mit ihm im selben Roster übereinander. | `:3586` (`e309-8c5f-eab3-204a`), `:3596` (`71ad-c7ea-1916-3c28`), `:3606` (`bbdf-fc18-5581-1ef2`), `:3616` (`6af0-7513-7375-ff53`), `:3626` (`c235-25ac-6aaf-b4bd`) — alle `field="selections" scope="roster" value="1.0" shared="true"`. |
| **PMEI-R8** | Die **haltenden** Gruppen der Träger begrenzen eine **Punktesumme**, keine Stückzahl: `field` ist die pts-Kostenart. Sie sind keine Aussage über den hier gepinnten Zähler. | Wight Lord: `selectionEntryGroup` „Magic Items" `81df-d2c1-7091-b1bc` (`:1067`) mit `constraint field="ecfa-8486-4f6c-c249" scope="parent" value="50.0" … id="67d9-40b0-b9a8-bb85" type="max"` (`:1069`). Necromancer: `040b-d0d0-fe3b-9d13` (`:1212`) mit `b5f5-2eda-0882-7aca` (`:1214`). Kostenart „pts" `.gst:7`. |
| **PMEI-R9** | Die beiden gewählten Träger halten die Gruppe über `entryLink`s **ohne eigene Grenze** — an ihnen ist `e945-1f86-ecf8-4c65` die **einzige** Stückzahl-Obergrenze der Gruppe. Das macht die Zuordnung einer feuernden Grenze eindeutig. | Wight Lord: `entryLink d257-de6d-5d8b-7c6b` (`:1075`) — leeres Element, keine `<constraints>`. Necromancer: `entryLink c6f1-4ed3-eb25-9c78` (`:1220`) — dito. Gegenbeispiel (bewusst **nicht** benutzt): `74e3-b829-7318-9578` (`:933`) am Master Necromancer trägt die zusätzliche Grenze `4c83-9c72-9159-2d05`. |
| **PMEI-R10** | Pflicht-Kinder der Träger, damit ausser der untersuchten Grenze nichts unerfüllt bleibt. | Wight Lord: `selectionEntry` „Handweapon" `c527-e525-5b58-9b7c` (`:988`), `min 1` `a775-7b1e-7fa8-d353` / `max 1` `34c1-6e91-4dae-0ef6`. Necromancer: „Handweapon" `dca8-37d5-c64a-db33` (`:1196`), `min 1` `2525-273c-d3f1-cd1f` / `max 1` `846e-7221-e02a-201f`, sowie die Pflicht-Gruppe „Wizard Level" `0c4e-627e-e499-f135` (`:1228`, `min` `03cf-1c4e-cf6f-0dad` / `max` `45f9-d1c8-4fce-347c`, `defaultSelectionEntryId="fa17-5cb0-9c97-4db6"`). |
| **PMEI-R11** | Keiner der beiden Träger trägt eine **eigene** Stückzahlgrenze — zwei Wight Lords sind zähltechnisch unauffällig, und Roster 04/05 sind damit baubar. | `selectionEntry b9c6-93fb-ce3c-965a` (`:978`): auf das Wurzelelement folgen unmittelbar `<infoLinks>` (`:979`) und `<categoryLinks>` (`:983`), **kein** `<constraints>`. `b5d8-db21-a4b7-9e94` (`:1187`): dito (`:1188`, `:1191`). Zum Vergleich: der Vampire Lord `b77b-88d5-5e80-e178` **hat** eine solche Grenze (`a7c9-5fec-592a-3716`, `:1303`). |

### Was eine Fehl-Lesart produzieren würde

Die Roster sind so gebaut, dass jede naheliegende Fehl-Lesart des Eltern-Rahmens
in mindestens einem Fall **sichtbar** wird:

| Fehl-Lesart | Roster 01 (1 Träger, 1 Item) | Roster 02 (1 Träger, 2 Items) | Roster 03 (2 verschiedene Träger, je 1) | Roster 04 (2 gleiche Träger, je 1) | Roster 05 (2 gleiche Träger, gleiches Item) |
|---|---|---|---|---|---|
| `shared="true"` als **roster-weiter** Rahmen gelesen (Rahmen = Roster) | still (korrekt, aber unbewiesen) | feuert Ist 2 (korrekt aus falschem Grund) | `e945…` feuerte mit **Ist 2** — **fällt auf** | dito — **fällt auf** | dito — **fällt auf** |
| `includeChildForces="true"` als „Rahmen aufweiten auf das Kontingent" gelesen | still | feuert Ist 2 | **fällt auf** (Ist 2) | **fällt auf** | **fällt auf** |
| Rahmen = die **Verweis-Instanz** statt der Elternauswahl (`shared` ignoriert, aber Link geteilt gedacht) | still | feuert Ist 2 | still (zwei verschiedene Links) | `e945…` feuerte mit **Ist 2** — **fällt auf**; genau dafür ist Roster 04 da | **fällt auf** |
| Grenze zählt **alle Kinder des Trägers** statt der Gruppenmitglieder | Ist 2 (Handweapon + Item) ⇒ feuerte — **fällt auf** | Ist 3 statt 2 — **fällt auf** (Ist-Wert falsch) | feuerte je Träger — **fällt auf** | **fällt auf** | **fällt auf** |
| Grenze zählt die **Gruppe** statt ihrer Mitglieder | still | Ist 1 ⇒ schwiege — **fällt auf** | still | still | still |
| `scope="roster"` der Gegenstände ebenfalls als Eltern-Rahmen gelesen | still | still | still | still | `c235…` schwiege — **fällt auf** |
| Zählung findet gar nicht statt (Alibi „alles still") | still | `e945…` schwiege — **fällt auf** | still | still | `c235…` schwiege — **fällt auf** |

Roster 02 und 05 sind die beiden **feuernden** Anker: sie schliessen aus, dass
das Schweigen in 01/03/04 aus einer generell nicht zählenden Auswertung stammt.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle fünf laufen
gegen **denselben** Datensatz (`.gst` + `Vampire Counts.cat`) und **dasselbe**
Kontingent `7d9d-6c8d-4ea0-b7ad`. Die Roster tragen bewusst **kein**
`costLimits` und bleiben minimal.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | Ein Träger, ein Gegenstand — die Grundlinie | Wight Lord + Handweapon + **Casket of Ages** (25 pts) | **PMEI-R1/R2/R3:** `e945-1f86-ecf8-4c65` **absent** (Ist 1 auf der Grenze 1). Ebenso **absent**: `c235-25ac-6aaf-b4bd`, `67d9-40b0-b9a8-bb85`, `a775-7b1e-7fa8-d353`, `34c1-6e91-4dae-0ef6`. Der Gruppen-Slot zeigt **Ist 1**, effektives Hoechstmass **1**, Spielraum **0**. | [`01-one-bearer-one-item.ros`](rosters/01-one-bearer-one-item.ros) |
| 02 | Ein Träger, **zwei** Gegenstände — die Grenze reisst | wie 01, zusätzlich **Talon of Death** (40 pts) | **PMEI-R1/R2:** `e945-1f86-ecf8-4c65` feuert mit **Ist 2 / Grenze 1**. Die Eigengrenzen der beiden Gegenstände (`c235…`, `6af0…`) bleiben **absent** — je ein Exemplar im Roster. Slot: **Ist 2** gegen Hoechstmass **1**. | [`02-one-bearer-two-items.ros`](rosters/02-one-bearer-two-items.ros) |
| 03 | **Zwei verschiedene** Träger, je ein Gegenstand — der Rahmen ist der Träger | Wight Lord (+ Casket) **und** Necromancer (+ Handweapon, Wizard level 1, Talon of Death) | **PMEI-R3/R4/R5:** `e945-1f86-ecf8-4c65` **absent** — in **beiden** Rahmen steht genau ein Mitglied. Beide Gruppen-Slots zeigen **Ist 1** gegen Hoechstmass **1**. Ebenso **absent**: `c235…`, `6af0…`, die beiden Punktegrenzen `67d9…`/`b5f5…` und alle Pflicht-Grenzen der Träger. | [`03-two-different-bearers-one-item-each.ros`](rosters/03-two-different-bearers-one-item-each.ros) |
| 04 | **Zwei gleiche** Träger, **derselbe** Verweis — auch Instanzen desselben Links zählen nicht zusammen | zweimal Wight Lord, einer mit Casket, einer mit Talon | **PMEI-R4:** `e945-1f86-ecf8-4c65` **absent**, obwohl beide Rahmen über **denselben** `entryLink` `d257-de6d-5d8b-7c6b` auf **dieselbe** geteilte Gruppe zeigen. Auch `67d9-40b0-b9a8-bb85` bleibt **absent** (25 bzw. 40 pts je Rahmen; roster-weit gelesen wären es 65). Keine Slot-Aussage — siehe unten. | [`04-two-identical-bearers-one-item-each.ros`](rosters/04-two-identical-bearers-one-item-each.ros) |
| 05 | Zwei gleiche Träger, **derselbe** Gegenstand — die Gegenprobe | zweimal Wight Lord, **beide** mit Casket of Ages | **PMEI-R7:** `c235-25ac-6aaf-b4bd` (`scope="roster"`) feuert mit **Ist 2 / Grenze 1** — der Roster-Rahmen aggregiert über Träger hinweg. **PMEI-R3:** `e945-1f86-ecf8-4c65` bleibt im selben Roster **absent**. Die beiden Grenzen trennen die Rahmen an genau einer Auswahl. | [`05-two-identical-bearers-same-item.ros`](rosters/05-two-identical-bearers-same-item.ros) |

### Herleitung der Zahlen

- **`bound = 1`** in jedem Fall: der geschriebene `value="1.0"` der jeweiligen
  Grenze (`:3581` für `e945…`, `:3626` für `c235…`). Kein `modifier`
  adressiert eine der beiden Ids (je genau ein Treffer im ganzen Satz).
- **`actual` von `e945-1f86-ecf8-4c65`** = Zahl der Mitglieder von
  `76c3-b01d-0836-2f86` **im Rahmen der Elternauswahl** (PMEI-R2/R3). Roster 01:
  1 ⇒ still. Roster 02: 2 ⇒ **feuert 2 / 1**. Roster 03/04: je Rahmen 1 ⇒ still
  (roster-weit wären es 2). Roster 05: je Rahmen 1 ⇒ still. Handweapon und
  Wizard level 1 sind **keine** Mitglieder von `76c3…` und zählen nicht mit.
- **`actual` von `c235-25ac-6aaf-b4bd`** = Zahl der „Casket of Ages" **im ganzen
  Roster** (`scope="roster"`, PMEI-R7). Roster 01/03/04: 1 ⇒ still. Roster 05:
  1 + 1 = **2** ⇒ feuert gegen Grenze 1. `6af0-7513-7375-ff53` (Talon of Death)
  bleibt überall bei 1 bzw. 0 ⇒ still.
- **Slot-Werte (`expect.capabilities`)**: der Gruppen-Anker der geteilten Gruppe
  wird über den **Verweis** benannt (`defId` = `entryLink`-Id, `targetDefId` =
  `76c3-b01d-0836-2f86`) und über `frameDefId` dem Träger zugeordnet — dieselbe
  Adressierung wie in [`parent-repeat-item-count`](../parent-repeat-item-count/README.md).
  `effectiveMax` = **1** aus `e945…` (an diesen beiden Trägern die **einzige**
  Stückzahlgrenze der Gruppe, PMEI-R9); `effectiveMin` = **null**, weil die
  Gruppe **keine** `min`-Grenze trägt (`:3580-3582` vollständig); `current` =
  der Ist-Wert im Rahmen, also 1 (Roster 01), 2 (Roster 02) bzw. 1 **je Träger**
  (Roster 03). `headroom` = `effectiveMax − current`, dort angegeben, wo er
  nicht negativ wird.
- **Punktesummen (nur zur Einordnung, PMEI-R8):** Roster 01 25 pts, Roster 03
  25 pts (Wight Lord) bzw. 40 pts (Necromancer), Roster 04 25/40 pts, Roster 05
  25/25 pts — alle unter der jeweiligen 50-pts-Grenze. **Roster 02 liegt mit
  25 + 40 = 65 pts darüber**; siehe die nächste Tabelle.

> **Assertion-Fokus:** die Grenze `e945-1f86-ecf8-4c65` (feuernd in 02,
> schweigend in 01/03/04/05), ihre roster-skopierte Gegenprobe
> `c235-25ac-6aaf-b4bd` (feuernd in 05) und der Gruppen-Slot der Träger. Andere
> Armeeaufbau-Diagnosen dürfen zusätzlich auftreten und sind hier ohne Belang —
> namentlich die roster-weite General-Pflicht `1077-7379-f142-f382` (`.gst:56`;
> beide Träger bieten „General" gar nicht bzw. nur als optionalen `entryLink`
> `509d-c95d-3792-4e44` an, der bewusst weggelassen ist) und die Core-Pflicht
> `9636-e6ed-b522-1f4a` (`.gst:136`, `min 2` roster-weit).

---

## Bewusst **nicht** Gegenstand dieses Szenarios

| Facette | Warum nicht |
|---------|-------------|
| **Die Punktegrenze `67d9-40b0-b9a8-bb85` in Roster 02** | Sie wird dort zwangsläufig mit gerissen: die beiden **billigsten** Mitglieder der Gruppe kosten zusammen 25 + 40 = 65 pts, und **kein** Paar bleibt unter den 50 pts der haltenden „Magic Items"-Gruppe. Zwei Enchanted Items an einem Träger sind in diesen Daten also nie budgetkonform. Da dieses Szenario eine **Stückzahl**-Grenze pinnt und die Kostensummen-Ausprägung des Eltern-Rahmens bereits in [`parent-costsum-magic-items-budget`](../parent-costsum-magic-items-budget/README.md) gepinnt ist, steht `67d9…` in Roster 02 **weder** in `firing` **noch** in `absent`. In allen anderen Rostern bleibt sie unter der Grenze und steht deshalb in `absent`. |
| **Eine Slot-Aussage in Roster 04/05** | Dort ist derselbe Träger **zweimal** im Roster; `defId`, `targetDefId` und `frameDefId` sind für beide Anker identisch, ein Slot liesse sich nur über einen `path` eindeutig benennen — dessen Gestalt geben die erlaubten Quellen nicht her. Die Aussage über den Rahmen trägt in diesen beiden Rostern allein `firing`/`absent`; die Slot-Sicht auf zwei getrennte Rahmen liefert Roster 03 (zwei **verschiedene** Träger, damit über `frameDefId` unterscheidbar). |
| **Sichtbarkeit (`hidden`) der Gegenstände** | Weder die Gruppe (`hidden="false"`, `:3579`) noch ihre Mitglieder (`:3584`, `:3594`, `:3604`, `:3614`, `:3624`, alle `hidden="false"`) sind ausgeblendet, und kein `modifier field="hidden"` adressiert sie. Verfügbarkeit ist ohnehin keine zählende Schranke und erscheint nicht als feuernde Grenze — gleiche Abgrenzung wie CISI in [`category-id-scope-instance-of`](../category-id-scope-instance-of/README.md). |
| **Profile/Regeln der Gegenstände** | Die fünf Mitglieder tragen **keine** `infoLinks` (`:3584-3633`) — es gibt nichts zu projizieren. Merkmalswerte sind kein Teil des Verletzungsberichts. |
| **Die vierzehn übrigen Träger der Gruppe** (`:933`, `:1144`, `:1403`, `:1538`, `:1643`, `:1803`, `:2005`, `:2045`, `:2111`, `:2176`, `:2434`, `:2610`, `:2710`, `:2916`) | Bauform-gleich; ein weiteres Roster brächte keinen neuen Fall. Die Verweise unter den Blutlinien-Aufwertungen tragen zusätzlich eine **eigene** `max 1`-Grenze am Link (z. B. `af46-82f9-3c5d-5f34`, `:1405`) — dort feuerten bei zwei Gegenständen **zwei** Grenzen zugleich, was die Zuordnung verwischte. Deshalb sind gezielt die beiden Träger **ohne** Link-Grenze gewählt (PMEI-R9). |
| **`includeChildSelections="false"` als eigener Fall** | In diesen Daten inert: kein Mitglied der Gruppe hat Kinder (PMEI-R6). Die Flag-Ausprägung ist an anderen Datensätzen gepinnt ([`parent-max-include-child-selections`](../parent-max-include-child-selections/README.md), [`parent-repeat-item-count`](../parent-repeat-item-count/README.md)). |
| **`includeChildForces="true"` als eigener Fall** (ein Roster mit **zwei** Kontingenten) | Die `.gst` kennt genau ein `forceEntry` (`7d9d-6c8d-4ea0-b7ad`, `.gst:61`) und keine `forceEntries` **unterhalb** einer Force; ein untergeordnetes Kontingent ist im upstream-Satz nicht baubar. Dieses Szenario behauptet daher nur die **Wirkungslosigkeit** des Flags am Eltern-Rahmen (PMEI-R5), nicht seine Wirkung am Force-Rahmen. |

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Spielsystem „Warhammer Fantasy Battle 6th edition" (`.gst:2`, rev 8) | `6d8e-38d9-3c69-febf` |
| Katalog „Vampire Counts" (`.cat:2`, rev 10, ohne `catalogueLinks`) | `ea4b-9294-3427-1fc1` |
| Kontingent „Standard " (`.gst:61`) | `7d9d-6c8d-4ea0-b7ad` |
| **Geteilte Gruppe „Enchanted Items"** (`:3579`) — Träger der gepinnten Grenze | `76c3-b01d-0836-2f86` |
| — deren einzige Grenze: `max`, `field="selections"`, `scope="parent"`, `value="1"`, `shared="true"`, `includeChildSelections="false"`, `includeChildForces="true"` (`:3581`) | `e945-1f86-ecf8-4c65` |
| — Mitglied „Rod of Flaming Death" (`:3584`, 50 pts) / dessen `max 1 scope="roster"` (`:3586`) | `5095-e258-cf55-78fc` / `e309-8c5f-eab3-204a` |
| — Mitglied „Cursed Book" (`:3594`, 50 pts) / dessen `max 1 scope="roster"` (`:3596`) | `f26b-8b1c-b3cc-57b7` / `71ad-c7ea-1916-3c28` |
| — Mitglied „Cloak of Mist and Shadows" (`:3604`, 45 pts) / dessen `max 1 scope="roster"` (`:3606`) | `72ba-8771-2926-3354` / `bbdf-fc18-5581-1ef2` |
| — **verwendetes** Mitglied „Talon of Death" (`:3614`, 40 pts) / dessen `max 1 scope="roster"` (`:3616`) | `dbc8-8204-b238-c315` / `6af0-7513-7375-ff53` |
| — **verwendetes** Mitglied „Casket of Ages" (`:3624`, 25 pts) / dessen `max 1 scope="roster"` (`:3626`) | `a46f-b46b-2efc-0283` / `c235-25ac-6aaf-b4bd` |
| Träger 1: Einheit „Wight Lord" (`:978`, 60 pts, ohne eigene `constraints`) | `b9c6-93fb-ce3c-965a` |
| — dessen `categoryLink`s „Heroes" (`primary`) / „Characters" (`:984-985`) | `ae1c-6bed-e731-8e20` → `c16b-f319-2c62-2c12` / `1531-67d3-2017-7555` → `7a1c-d611-c2dc-def1` |
| — Pflicht-Kind „Handweapon" (`:988`; `max` `:990` / `min` `:991`) | `c527-e525-5b58-9b7c` — `34c1-6e91-4dae-0ef6` / `a775-7b1e-7fa8-d353` |
| — Gruppe „Magic Items" (`:1067`) mit Punktegrenze `max 50 pts scope="parent"` (`:1069`) | `81df-d2c1-7091-b1bc` — `67d9-40b0-b9a8-bb85` |
| — — `entryLink` auf „Enchanted Items", **ohne eigene Grenze** (`:1075`) | `d257-de6d-5d8b-7c6b` → `76c3-b01d-0836-2f86` |
| Träger 2: Einheit „Necromancer" (`:1187`, 65 pts, ohne eigene `constraints`) | `b5d8-db21-a4b7-9e94` |
| — dessen `categoryLink`s „Heroes" (`primary`) / „Characters" (`:1192-1193`) | `9395-7ad9-f060-64bf` → `c16b-f319-2c62-2c12` / `1047-7bbc-2f5e-78fe` → `7a1c-d611-c2dc-def1` |
| — Pflicht-Kind „Handweapon" (`:1196`; `max` `:1198` / `min` `:1199`) | `dca8-37d5-c64a-db33` — `846e-7221-e02a-201f` / `2525-273c-d3f1-cd1f` |
| — Gruppe „Magic Items" (`:1212`) mit Punktegrenze `max 50 pts scope="parent"` (`:1214`) | `040b-d0d0-fe3b-9d13` — `b5f5-2eda-0882-7aca` |
| — — `entryLink` auf „Enchanted Items", **ohne eigene Grenze** (`:1220`) | `c6f1-4ed3-eb25-9c78` → `76c3-b01d-0836-2f86` |
| — Pflicht-Gruppe „Wizard Level" (`:1228`, `defaultSelectionEntryId="fa17-5cb0-9c97-4db6"`; `min` `:1230` / `max` `:1231`) | `0c4e-627e-e499-f135` — `03cf-1c4e-cf6f-0dad` / `45f9-d1c8-4fce-347c` |
| — — gewählte Option „Wizard level 1" (`:1234`; eigene `max 1` `:1236`) | `fa17-5cb0-9c97-4db6` — `c1c6-801e-dae2-3841` |
| — optionaler `entryLink` „General" (`:1293`, bewusst weggelassen) | `509d-c95d-3792-4e44` → `1b7c-2c90-6d96-28c9` |
| Bewusst **nicht** benutzter Träger „Master Necromancer" (`:844`) mit Link-Grenze (`:933`/`:935`) | `4ee2-ac3a-3cc6-11af` — `74e3-b829-7318-9578` / `4c83-9c72-9159-2d05` |
| Kategorie „Heroes" / „Characters" (`.gst:46`, `:51`) | `c16b-f319-2c62-2c12` / `7a1c-d611-c2dc-def1` |
| Kostenart „pts" (`.gst:7`) | `ecfa-8486-4f6c-c249` |
| Zusatz-Diagnosen ohne Belang: General-Pflicht (`.gst:56`) / Core-Pflicht (`.gst:136`) | `1077-7379-f142-f382` / `9636-e6ed-b522-1f4a` |
