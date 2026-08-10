# E2E-Regeln & Testkatalog: `repeat` mit `scope="parent"` und `includeChildSelections="true"` — der Power-Stone-Stepper der Ogre-„Arcane Items"

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Regeln aus den
Katalogdaten der *6th Definitive Edition* abgeleitet; das Eingabeformat der
Roster folgt den bereits verifizierten Szenario-Fixtures (direktes `entryId`,
`entryLinkId=""`, geschachtelte `selections` mit `number`, `entryGroupId` für
Gruppen-Mitglieder).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee: `Ogre Kingdoms (6th definitive edition).cat`
  (`731d-5b13-2a92-5427`, rev 2) — Force **„Standard (OK-AB)"**
  `729f-9246-5cd3-5044`
- Dazu `Mercenaries (6th definitive edition).cat` (per `catalogueLink`
  `a067-78d5-50a2-affe` → `fc47-8392-a6c8-452a` aus der OK-`.cat` eingebunden)

**Abgrenzung zum Nachbarszenario.** [`parent-repeat-item-count`](../parent-repeat-item-count/)
pinnt den **ersten** der beiden `increment`-Modifier der Gruppe „Arcane Items" —
den mit `childId="b76c-6bad-4650-dbb0"` (Dispel Scroll) und
`includeChildSelections="false"`. Dieses Szenario pinnt den **zweiten**, eine
andere Zelle derselben Constraint-Id: `childId="696a-648d-c842-4c6a"`
(Power Stone) mit `includeChildSelections="true"`. In **allen** Rostern hier ist
kein Dispel Scroll gewählt — der erste Modifier ist durchgehend inert.

## Der gepinnte Mechanismus

Ein `modifier` mit einer `<repeats>`-Liste wird **einmal je gezähltem Treffer**
angewendet ([§7.7](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat),
Muster in [§9.7](../../battlescribe-data-format.md#97-mehrfach-erlaubte-gegenstände-in-einer-max1-gruppe-dispel-scroll-etc)).
Der hier gepinnte `repeat` zählt mit `field="selections"`, `scope="parent"`,
`value="1"`, `repeats="1"`, `shared="true"`, `roundUp="false"`,
`percentValue="false"`, `includeChildForces="false"` und
**`includeChildSelections="true"`**. Träger ist die geteilte Gruppe
**„Arcane Items"** der Ogre Kingdoms, die der **Butcher** über seine Gruppe
„Magic Items and Big Names" und die Sammelgruppe „Arcane Items (OK-AB + Common)"
hält:

```
forceEntry "Standard (OK-AB)" (729f-9246-5cd3-5044)
  └ selectionEntry "Butcher" (8933-af8e-e780-6f48, type=unit, Heroes)
       ├ entryLink 8b61-79ab-f251-234b ──▶ "Hand Weapon" (abdb-bbd0-41b2-5dff)
       │      Pflicht: min 1 am Link (4dd7-…) und min 1 am Eintrag (bdef-…)
       └ selectionEntryGroup "Magic Items and Big Names" (8b6d-368b-90b0-164b)
            ├ constraint max 50 <pts> scope=parent          62a3-8df3-3e65-6be1
            └ entryLink c5ed-e4a2-689a-ae42 ──▶ sharedSelectionEntryGroup
                 "Arcane Items (OK-AB + Common)" (d502-9cf6-2232-202c)
                   └ entryLink a8d2-cc08-f449-6ad6 ──▶ sharedSelectionEntryGroup
                        "Arcane Items" (4c3e-febe-6d5d-6912)
                          ├ constraint max 1 selections scope=parent  188e-3808-4b37-c8d9
                          │      (includeChildSelections=false, shared=true)   ← Ziel beider increments
                          ├ modifier increment +1 field=188e-…
                          │    └ repeat … childId=b76c-6bad-4650-dbb0
                          │          includeChildSelections=false  (andere Zelle, inert gehalten)
                          ├ modifier increment +1 field=188e-…
                          │    ├ repeat field=selections scope=parent value=1 repeats=1
                          │    │     childId=696a-648d-c842-4c6a
                          │    │     includeChildSelections=TRUE              ← DIESE Zelle
                          │    └ condition greaterThan 0 … childId=696a-648d-c842-4c6a
                          │          includeChildSelections=TRUE
                          ├ entryLink c492-f625-09c8-3702 ──▶ 696a-648d-c842-4c6a
                          │      („Power Stone (only one use)", .gst, 25 pts,
                          │       eigene max-4-Grenze e44e-74a9-e4a4-6939)
                          ├ entryLink 2b2e-55f4-12ec-7fd1 ──▶ 5ccf-df71-8c78-ee5e (Skullmantle, 20 pts)
                          └ entryLink 0d40-306e-1e25-1447 ──▶ be52-409a-aa8e-0ac5 (Halfling cookbook, 25 pts)
```

Netto-Semantik der Daten: die Gruppe erlaubt **ein** Arcane Item — aber jede im
Eltern-Rahmen gezählte Kopie des Power Stone hebt die Obergrenze um eins,
verbraucht den einen Item-Slot also **nicht**. Mit N Power Stones ist das
effektive Maximum **1 + N**. Anwendungszahl des `repeat`:
`floor(Treffer / value) × repeats` = `floor(N / 1) × 1` = N.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **PRICI-R1** | Die Gruppe „Arcane Items" erlaubt als **geschriebene** Grenze **max 1** Auswahl unter ihren Mitgliedern, gezählt im Eltern-Rahmen (dem Träger). | `Ogre Kingdoms (6th definitive edition).cat`, `sharedSelectionEntryGroup` `4c3e-febe-6d5d-6912` → constraint **`188e-3808-4b37-c8d9`** (`type=max value=1 field=selections scope=parent shared=true includeChildSelections=false`). |
| **PRICI-R2** | Je gewähltem **Power Stone** steigt diese Grenze um **+1**: der zweite `increment`-Modifier der Gruppe trägt genau einen `<repeat>` mit `value=1`/`repeats=1`, der die Kopien von `696a-648d-c842-4c6a` im Eltern-Rahmen zählt. Mit 1 Stein ist das effektive Maximum `1+1=2`, mit 2 Steinen greift die Wiederholung **zweimal**: `1+2=3`. | Ebd. → `modifier type="increment" value="1" field="188e-3808-4b37-c8d9"` mit `<repeat value="1" repeats="1" field="selections" scope="parent" childId="696a-648d-c842-4c6a" shared="true" roundUp="false" percentValue="false" includeChildSelections="true" includeChildForces="false"/>`. |
| **PRICI-R3** | Ohne Power Stone zählt der `repeat` **0 Treffer** **und** die zusätzliche `condition` `greaterThan 0` auf dieselbe `childId` hält nicht — der Modifier wird **nicht** angewendet, die Grenze behält ihren **Basiswert 1**. | Ebd. → `<condition type="greaterThan" value="0" field="selections" scope="parent" childId="696a-648d-c842-4c6a" shared="true" percentValue="false" includeChildSelections="true" includeChildForces="false"/>`; Anwendungszahl `floor(0/1)×1 = 0`. |
| **PRICI-R4** | Die **angehobene** Grenze ist auch die Grenze, die im Verletzungsbericht erscheint: wird die Zahl der Gruppen-Mitglieder größer als `1+N`, feuert `188e-3808-4b37-c8d9` mit dem **effektiven** `bound` (1 ohne Stein, 2 mit einem, 3 mit zwei) — nicht mit dem geschriebenen Wert. | Kombination aus PRICI-R1/R2/R3; keine weitere Katalogstelle im mitgegebenen Datensatz adressiert `188e-3808-4b37-c8d9` (verifiziert: genau 3 Treffer der Id im ganzen Fixture-Satz — die Constraint und die beiden increments an `4c3e-…`). |
| **PRICI-R5** | Der Power Stone ist in **diesem** Datensatz **kein Wrapper**: `696a-648d-c842-4c6a` ist ein flacher `selectionEntry type="upgrade"` mit 25 pts, einem `infoLink` auf die Regel `ba52-fca2-87b6-72c7` und **einer** eigenen Grenze `max 4 scope=parent` — er trägt **keine** `selectionEntries`/`selectionEntryGroups`. Die Stückzahl steckt daher im `number` **einer** Auswahl, nicht in einem Unterbereich. | `.gst`, `selectionEntry` `696a-648d-c842-4c6a` (Zeilen der `sharedSelectionEntries`) → nur `<comment>`, `<constraints>` (`e44e-74a9-e4a4-6939`), `<infoLinks>`, `<costs>`. **Weicht bewusst von [§9.7](../../battlescribe-data-format.md#97-mehrfach-erlaubte-gegenstände-in-einer-max1-gruppe-dispel-scroll-etc) ab**, dessen „Wrapper"-Kasten den BSData-`whfb6`-Satz beschreibt (`0ed5-eacf-d55a-5e9e`), nicht die Definitive Edition. |
| **PRICI-R6** | Die Hälfte `includeChildSelections="true"` des `repeat` ist mit einem **katalogkonformen** Roster **nicht** gegen die `false`-Variante abgrenzbar: eine gezählte Power-Stone-Kopie kann in diesen Katalogdaten immer nur **direktes** Kind des Trägers sein (Begründung unten). Sie wird deshalb hier **nicht** assertiert — gepinnt wird der Zählschritt, nicht die Tiefe. | Siehe „bewusst nicht Gegenstand", erster Punkt. |
| **PRICI-R7** | Der Power Stone selbst limitiert sich auf **max 4 je Träger** — mit 1 bzw. 2 Kopien still. Skullmantle und Halfling cookbook tragen je **max 1 je Träger** und **max 1 je Roster** — mit je einer Kopie still. | `.gst`, `selectionEntry` `696a-648d-c842-4c6a` (25 pts) → **`e44e-74a9-e4a4-6939`** (`max 4 scope=parent`); OK-`.cat`, `5ccf-df71-8c78-ee5e` (20 pts) → **`153e-42d6-004c-e352`** (`max 1 scope=parent`) / **`6482-f23b-9933-2363`** (`max 1 scope=roster`); `be52-409a-aa8e-0ac5` (25 pts) → **`9854-1f29-c1f2-153f`** / **`442c-7320-ceec-81c5`**. |
| **PRICI-R8** | Die Pflicht-Untergrenze des Trägers ist in allen Rostern erfüllt: **Hand Weapon min 1** (gewählt), sowohl am Link des Butchers als auch am geteilten `.gst`-Eintrag; die zugehörigen max-1-Grenzen sind mit einer Kopie eingehalten. | OK-`.cat`, `8933-af8e-e780-6f48` → `entryLink 8b61-79ab-f251-234b` mit min **`4dd7-db61-d846-4252`** / max **`90b7-8f2e-6da9-6516`**; `.gst`, `abdb-bbd0-41b2-5dff` → min **`bdef-ba9b-d6ce-5b14`** / max **`e28e-dbb4-b8ad-d4ab`**. |
| **PRICI-R9** | Die einzige Katalogstelle, die die Power-Stone-Eigengrenze `e44e-74a9-e4a4-6939` per Modifier verändert (`set 1`), steht in `Vampire Counts (6th definitive edition).cat` an einem dortigen `entryLink`. Dieser Katalog gehört **nicht** zum Datensatz dieses Szenarios — die Grenze bleibt bei 4. | Fixture-weite Suche nach `e44e-74a9-e4a4-6939`: 2 Treffer — die Constraint in der `.gst` und der `set`-Modifier in `Vampire Counts` (Link `d38e-d821-3b69-67c8`). |

**Bewusst nicht Gegenstand dieses Szenarios** (in allen Rostern inert bzw. nicht
assertiert):

- **Die Abgrenzung `includeChildSelections="true"` gegen `false` (die Tiefe).**
  Ein Gegenbeispiel bräuchte eine Power-Stone-Kopie, die **unterhalb** einer
  weiteren Auswahl des Trägers hängt. Das ist in diesen Katalogdaten nicht
  konstruierbar, und zwar aus zwei unabhängigen Gründen:
  1. Der Power Stone ist hier **kein Wrapper** (PRICI-R5) — er hat kein
     zählbares Kind, unter das sich die Stückzahl verlagern ließe.
  2. Verweise auf `696a-648d-c842-4c6a` stehen im mitgegebenen Datensatz
     **ausschließlich** in zwei `sharedSelectionEntryGroups` — `4c3e-febe-6d5d-6912`
     (Link `c492-f625-09c8-3702`) und `0d3f-389c-02b2-bb34` der `.gst`
     (Link `f969-0b28-b1cf-bb02`). Beide werden nur über die Gruppen
     „Magic Items and Big Names" der **Butcher** (`8b6d-368b-90b0-164b`) bzw.
     des **Slaughtermaster** (`5011-bacc-59dd-ef7f`) erreicht, und eine
     `selectionEntryGroup` erzeugt keine Roster-Ebene. Keiner der beiden Träger
     besitzt eine Unterauswahl, die einen Power Stone führen dürfte (Butcher:
     Hand Weapon, Luck Gnoblar, Tooth Gnoblar — alle flach). Eine gezählte
     Kopie ist damit **immer** direktes Kind des Rahmens; ein erfundener Aufbau
     wäre kein Katalogbeleg.

  Die Zelle wird darum über den Zählschritt in ihrer realen Verwendung gepinnt
  (PRICI-R2/R4), nicht über einen Kontrast zur `false`-Variante. **Das ist eine
  offene Lücke dieses Szenarios**, keine Aussage darüber, dass die Engine hier
  `true` wie `false` behandeln dürfte.
- **Die Sammelgruppe darüber:** „Arcane Items (OK-AB + Common)"
  (`d502-9cf6-2232-202c`) trägt eine **eigene** `max 1`-Grenze
  `7855-e50e-e607-015e` mit zwei increments, deren `repeat`-`childId`s die
  **Link**-Ids der Common-Gruppe nennen (`f969-0b28-b1cf-bb02` = Power Stone,
  `989e-9d22-7fea-19b5` = Dispel Scroll) und `includeChildSelections="true"`
  tragen. Ob eine Auswahl mit `entryId=696a-…` unter dem **OK**-Link `c492-…`
  für eine `childId` zählt, die die **Common**-Link-Id nennt, ist eine eigene
  Frage der Link/Ziel-Auflösung ([§9.7, Fallstrick 1](../../battlescribe-data-format.md#97-mehrfach-erlaubte-gegenstände-in-einer-max1-gruppe-dispel-scroll-etc))
  — deshalb steht `7855-e50e-e607-015e` **weder** in `firing` **noch** in
  `absent`. Dasselbe gilt für die `max 1`-Grenze `7ed8-2807-ba7d-fe27` der
  `.gst`-Gruppe „Arcane Items (Common)" (`0d3f-389c-02b2-bb34`).
- **Der Dispel-Scroll-increment** (`childId=b76c-6bad-4650-dbb0`,
  `includeChildSelections="false"`) ist in **allen** Rostern inert, weil kein
  Dispel Scroll gewählt ist. Er ist eine **andere** Zelle und in
  [`parent-repeat-item-count`](../parent-repeat-item-count/) gepinnt.
- **Punkte-Budget in Roster 05 und 06:** die 50-pts-Grenze
  `62a3-8df3-3e65-6be1` der Gruppe „Magic Items and Big Names" wird dort mit
  `25+20+25 = 70` bzw. `2×25+20+25 = 95` pts bewusst gesprengt; sie darf
  zusätzlich feuern und steht deshalb dort **nicht** in `absent` (in 01–04 mit
  0/25/50/45 pts dagegen schon).
- **Armeeweite Aufbau-Diagnosen** (General-Pflicht, Core-Mindestzahl, die
  Ogre-Bulls-Pflicht, Kategorien-Skalierung ohne gesetztes Punktebudget):
  können zusätzlich auftreten; die Erwartung ist selektiv und macht darüber
  keine Aussage.
- **`headroom`/`isBlocked` jenseits der Grenze:** in den drei
  Überschreitungs-Rostern (04–06) ist nicht aus den Daten oder der Formatdoku
  ableitbar, ob der Restspielraum negativ oder auf 0 geklemmt gemeldet wird —
  dort werden nur `current`, `effectiveMin` und `effectiveMax` assertiert.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle sechs Roster
tragen **denselben** Träger: ein Butcher im Kontingent „Standard (OK-AB)" mit
Pflicht-Hand-Weapon. 01–03 unterscheiden sich **ausschließlich** in der Zahl der
Power Stones; 04–06 fügen dieselben zwei nicht-steppenden Arcane Items hinzu und
variieren erneut nur die Zahl der Power Stones.

> **Assertion-Fokus:** das effektive Maximum des Gruppen-Ankers „Arcane Items"
> (`expect.capabilities`, Feld `effectiveMax`) sowie `actual`/`bound` der Grenze
> `188e-3808-4b37-c8d9` im Verletzungsbericht.

| # | Testtitel | Betroffene Katalogdateien | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|---------------------------|----------------|-------------------------------------------------------|---------|
| 01 | Kein Stein → Basiswert 1 | `.gst` + OK-`.cat` (+ Mercenaries) | Butcher ohne jede Auswahl in der Gruppe `4c3e-…`. | **PRICI-R3:** Der Gruppen-Anker (Verweis `a8d2-…` → Gruppe `4c3e-…`, Rahmen = Butcher `8933-…`) meldet den geschriebenen Basiswert `effectiveMax=1` bei Ist 0 (Spielraum 1, kein `min`, nicht blockiert). Keine der genannten Grenzen feuert. | [`01-no-power-stone-base-max-1.ros`](rosters/01-no-power-stone-base-max-1.ros) |
| 02 | Ein Stein → Maximum 2 | wie 01 | Derselbe Aufbau mit `number="1"` Power Stone (Link `c492-…`). | **PRICI-R2:** Derselbe Anker meldet `effectiveMax=2` bei Ist 1 (Spielraum 1); die Wiederholung greift **einmal**. Keine der genannten Grenzen feuert. | [`02-one-power-stone-max-2.ros`](rosters/02-one-power-stone-max-2.ros) |
| 03 | Zwei Steine → Maximum 3 | wie 01 | Derselbe Aufbau mit `number="2"`. | **PRICI-R2:** `effectiveMax=3` bei Ist 2 (Spielraum 1); die Wiederholung greift **zweimal**. Keine der genannten Grenzen feuert. | [`03-two-power-stones-max-3.ros`](rosters/03-two-power-stones-max-3.ros) |
| 04 | Zwei andere Items ohne Stein → Grenze 1 feuert | wie 01 | Skullmantle + Halfling cookbook in der Gruppe, **kein** Stein. | **PRICI-R3/R4:** Ohne Treffer bleibt die Grenze bei 1; sie feuert mit **Ist 2 gegen Grenze 1**. Der Anker meldet `current=2`, `effectiveMax=1`. Budget (45 ≤ 50 pts) und die Eigengrenzen der beiden Items bleiben still. | [`04-two-other-items-no-stone-max-1-fires.ros`](rosters/04-two-other-items-no-stone-max-1-fires.ros) |
| 05 | Ein Stein + dieselben zwei Items → Grenze 2 feuert | wie 01 | Wie 04, zusätzlich `number="1"` Power Stone. | **PRICI-R4:** Dieselbe Grenze feuert mit **Ist 3 gegen Grenze 2** — der gemeldete `bound` ist um genau **einen** Wiederholungsschritt höher als in Test 04. Der Anker meldet `current=3`, `effectiveMax=2`. Das 50-pts-Budget darf zusätzlich feuern (70 pts) und ist nicht assertiert. | [`05-one-power-stone-plus-two-items-max-2-fires.ros`](rosters/05-one-power-stone-plus-two-items-max-2-fires.ros) |
| 06 | Zwei Steine + dieselben zwei Items → Grenze 3 feuert | wie 01 | Wie 05, aber `number="2"`. | **PRICI-R4:** Die Grenze feuert mit **Ist 4 gegen Grenze 3** — **zwei** Schritte über Test 04. Der Anker meldet `current=4`, `effectiveMax=3`. Das 50-pts-Budget darf zusätzlich feuern (95 pts) und ist nicht assertiert. | [`06-two-power-stones-plus-two-items-max-3-fires.ros`](rosters/06-two-power-stones-plus-two-items-max-3-fires.ros) |

**Ableitung der Zahlen (aus den Daten, nicht aus einem Engine-Lauf):**
`effectiveMax` ist der Basiswert **1** der Constraint `188e-…` plus
`floor(N/1)×1×1` Anwendungen des increment **+1**, wobei N die Zahl der im
Eltern-Rahmen (Butcher) gezählten Power Stones ist (PRICI-R2/R3) — also
1, 2, 3, 1, 2, 3 in den Tests 01…06. `current` ist die Zahl der gezählten
Gruppen-Mitglieder unter dem Träger, d. h. die Summe der `number`-Werte der
Auswahlen mit `entryGroupId="4c3e-febe-6d5d-6912"`: 0, 1, 2, 2 (1+1), 3 (1+1+1),
4 (2+1+1). `headroom` ist in 01–03 die Differenz Maximum − Ist (jeweils 1).
`effectiveMin` ist `null`, weil weder die Gruppe noch der einbindende Verweis
eine min-Grenze trägt und kein Modifier eine hinzufügt. In 04–06 ist
`current > effectiveMax`, die Grenze feuert also mit `actual = current` und
`bound = effectiveMax` (2/1, 3/2 bzw. 4/3). Der effektive Name bleibt der
Basisname **„Arcane Items"**: an `4c3e-…` hängt kein Namens-Modifier (der
`append "Relics of Lustria"` steht an der Sammelgruppe `d502-…`, an
„Talismans" `66af-…` und an „Magic Weapons" `e826-…`, nicht hier), und der
einbindende Verweis `a8d2-…` trägt denselben Namen.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Force „Standard (OK-AB)" | `729f-9246-5cd3-5044` |
| Katalog Ogre Kingdoms (rev 2) / Katalog-Link auf Mercenaries | `731d-5b13-2a92-5427` / `a067-78d5-50a2-affe` → `fc47-8392-a6c8-452a` |
| Butcher (type=unit, Heroes primär) | `8933-af8e-e780-6f48` |
| — Hand Weapon (Pflicht-Upgrade) | Link `8b61-79ab-f251-234b` (min `4dd7-db61-d846-4252`, max `90b7-8f2e-6da9-6516`) → `abdb-bbd0-41b2-5dff` (min `bdef-ba9b-d6ce-5b14`, max `e28e-dbb4-b8ad-d4ab`) |
| — Gruppe „Magic Items and Big Names" (50-pts-Budget) | `8b6d-368b-90b0-164b` — `62a3-8df3-3e65-6be1` |
| — Verweis auf die Sammelgruppe (nicht assertiert) | entryLink `c5ed-e4a2-689a-ae42` → `d502-9cf6-2232-202c` (max `7855-e50e-e607-015e`) |
| Verweis auf die Arcane-Items-Gruppe (der Slot-`defId`) | entryLink `a8d2-cc08-f449-6ad6` → `4c3e-febe-6d5d-6912` |
| Gruppe „Arcane Items" (geteilt, Ogre Kingdoms) | `4c3e-febe-6d5d-6912` |
| — max 1 (scope=parent, `includeChildSelections=false`, Ziel beider increments) | constraint `188e-3808-4b37-c8d9` |
| — **increment +1 je Power Stone** (`repeat` value=1, repeats=1, `includeChildSelections=true`) + condition `greaterThan 0` (ebenfalls `includeChildSelections=true`) | `childId=696a-648d-c842-4c6a` |
| — increment +1 je Dispel Scroll (hier inert; `includeChildSelections=false`) | `childId=b76c-6bad-4650-dbb0` (Link `1954-4ffd-5be0-eac7`) |
| Power-Stone-Link → geteilter `.gst`-Eintrag (25 pts, flach, max 4/Träger) | `c492-f625-09c8-3702` → `696a-648d-c842-4c6a` — max `e44e-74a9-e4a4-6939` |
| Power-Stone-Link der `.gst`-Common-Gruppe (hier nicht benutzt) | `f969-0b28-b1cf-bb02` (in Gruppe `0d3f-389c-02b2-bb34`, max `7ed8-2807-ba7d-fe27`) |
| Skullmantle-Link → Eintrag (20 pts, max 1/Träger, max 1/Roster) | `2b2e-55f4-12ec-7fd1` → `5ccf-df71-8c78-ee5e` — `153e-42d6-004c-e352` / `6482-f23b-9933-2363` |
| Halfling-cookbook-Link → Eintrag (25 pts, max 1/Träger, max 1/Roster) | `0d40-306e-1e25-1447` → `be52-409a-aa8e-0ac5` — `9854-1f29-c1f2-153f` / `442c-7320-ceec-81c5` |
| Zweiter Träger derselben Gruppe (hier nicht benutzt) | Slaughtermaster `0ff3-ec4d-1c6b-6d53` → Gruppe `5011-bacc-59dd-ef7f` (100-pts-Budget `543d-a1eb-e12e-204d`), Verweis `a708-c845-879e-adb9` |
| Kategorie „Heroes" (im Kontingent verlinkt) | `c16b-f319-2c62-2c12` |
| Kontingent, in dem der Butcher versteckt wäre (hier nicht benutzt) | `8711-ed16-2a44-7251` („Ironskin Tribe") |
