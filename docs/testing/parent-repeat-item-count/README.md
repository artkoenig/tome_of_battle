# E2E-Regeln & Testkatalog: `repeat` mit `scope="parent"` und `includeChildSelections="false"` — der Stückzähler der Ogre-„Arcane Items"

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Regeln aus den
Katalogdaten der *6th Definitive Edition* abgeleitet; das Eingabeformat der
Roster folgt den bereits verifizierten Szenario-Fixtures (direktes `entryId`,
`entryLinkId=""`, geschachtelte `selections` mit `number`, `entryGroupId` für
Gruppen-Mitglieder).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee: `Ogre Kingdoms (6th definitive edition).cat`
  (`731d-5b13-2a92-5427`, rev 2) — Force **„Standard (OK-AB)"**
  `729f-9246-5cd3-5044` (dort ist der Träger sichtbar; versteckt wird er nur im
  Kontingent „Ironskin Tribe" `8711-ed16-2a44-7251`)
- Dazu `Mercenaries (6th definitive edition).cat` (per `catalogueLink`
  `a067-78d5-50a2-affe` → `fc47-8392-a6c8-452a` aus der OK-`.cat` eingebunden)

## Der gepinnte Mechanismus

Ein `modifier` mit einer `<repeats>`-Liste wird **einmal je gezähltem Treffer**
angewendet ([§7.7](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat),
Muster in [§9.7](../../battlescribe-data-format.md#97-mehrfach-erlaubte-gegenstände-in-einer-max1-gruppe-dispel-scroll-etc)).
Der hier gepinnte `repeat` zählt mit `field="selections"`, `scope="parent"`,
`value="1"`, `repeats="1"` und **`includeChildSelections="false"`** — er zählt
also nur, was der Eltern-Rahmen **unmittelbar** hält, nicht was tiefer darunter
hängt ([§7.6](../../battlescribe-data-format.md#76-constraint): `false` zählt
*„just `scope`'s `field`"*). Träger ist die geteilte Gruppe **„Arcane Items"**
der Ogre Kingdoms, die der **Butcher** über seine Gruppe „Magic Items and Big
Names" und die Sammelgruppe „Arcane Items (OK-AB + Common)" hält:

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
                          │    ├ repeat field=selections scope=parent value=1 repeats=1
                          │    │     childId=b76c-6bad-4650-dbb0
                          │    │     includeChildSelections=false            ← DIESE Zelle
                          │    └ condition greaterThan 0 … childId=b76c-6bad-4650-dbb0
                          ├ modifier increment +1 field=188e-…
                          │    └ repeat … childId=696a-648d-c842-4c6a
                          │          includeChildSelections=TRUE   (andere Zelle, inert gehalten)
                          ├ entryLink 1954-4ffd-5be0-eac7 ──▶ b76c-6bad-4650-dbb0
                          │      („Dispel Scroll", .gst, 25 pts, eigene max-4-Grenze 809a-…)
                          ├ entryLink 2b2e-55f4-12ec-7fd1 ──▶ 5ccf-df71-8c78-ee5e (Skullmantle, 20 pts)
                          └ entryLink f7d4-c610-84a1-2796 ──▶ c5d0-f7e9-6534-f6f4 (Bangstick, 25 pts)
```

Netto-Semantik der Daten: die Gruppe erlaubt **ein** Arcane Item — aber jede
vom Träger direkt gehaltene Kopie des Dispel Scroll hebt die Obergrenze um
eins, verbraucht den einen Item-Slot also **nicht**. Mit N Dispel Scrolls ist
das effektive Maximum **1 + N**. Anwendungszahl des `repeat`:
`floor(Treffer / value) × repeats` = `floor(N / 1) × 1` = N.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **PRIC-R1** | Die Gruppe „Arcane Items" erlaubt als **geschriebene** Grenze **max 1** Auswahl unter ihren Mitgliedern, gezählt im Eltern-Rahmen (dem Träger). | `Ogre Kingdoms (6th definitive edition).cat`, `sharedSelectionEntryGroup` `4c3e-febe-6d5d-6912` → constraint **`188e-3808-4b37-c8d9`** (`type=max value=1 field=selections scope=parent shared=true includeChildSelections=false`). |
| **PRIC-R2** | Je gewähltem **Dispel Scroll** steigt diese Grenze um **+1**: der `increment`-Modifier trägt genau einen `<repeat>` mit `value=1`/`repeats=1`, der die Kopien von `b76c-6bad-4650-dbb0` zählt. Mit 1 Scroll ist das effektive Maximum `1+1=2`, mit 2 Scrolls greift die Wiederholung **zweimal**: `1+2=3`. | Ebd. → `modifier type="increment" value="1" field="188e-3808-4b37-c8d9"` mit `<repeat field="selections" scope="parent" value="1" repeats="1" roundUp="false" percentValue="false" shared="true" includeChildSelections="false" includeChildForces="false" childId="b76c-6bad-4650-dbb0"/>`. |
| **PRIC-R3** | Ohne Dispel Scroll zählt der `repeat` **0 Treffer** **und** die zusätzliche `condition` `greaterThan 0` auf dieselbe `childId` hält nicht — der Modifier wird **nicht** angewendet, die Grenze behält ihren **Basiswert 1**. | Ebd. → `<condition type="greaterThan" value="0" field="selections" scope="parent" childId="b76c-6bad-4650-dbb0" includeChildSelections="false"/>`; Anwendungszahl `floor(0/1)×1 = 0`. |
| **PRIC-R4** | Die **angehobene** Grenze ist auch die Grenze, die im Verletzungsbericht erscheint: wird die Zahl der Gruppen-Mitglieder größer als `1+N`, feuert `188e-3808-4b37-c8d9` mit dem **effektiven** `bound` (1 ohne Scroll, 3 mit zwei Scrolls) — nicht mit dem geschriebenen Wert. | Kombination aus PRIC-R1/R2/R3; keine weitere Katalogstelle im ganzen Fixture-Satz adressiert `188e-3808-4b37-c8d9` (verifiziert: genau 3 Treffer der Id — die Constraint und die beiden increments an `4c3e-…`). |
| **PRIC-R5** | Der `repeat` zählt mit `includeChildSelections="false"` nur, was der Eltern-Rahmen **unmittelbar** hält. In diesen Rostern ist das kein Unterschied, weil die Mitglieder der Gruppe stets **direkte** Kinder des Trägers sind (eine `selectionEntryGroup` erzeugt keine Roster-Ebene) — die Zelle ist also die des `false`-Zählers, aber sie ist mit einem minimalen, katalogkonformen Roster **nicht** gegen die `true`-Variante abgrenzbar (siehe „bewusst nicht Gegenstand"). | [§7.6](../../battlescribe-data-format.md#76-constraint) (`false` = *„just `scope`'s `field`"*); Roster-Aufbau der Fixtures unter [`rosters/`](rosters/). |
| **PRIC-R6** | Der zweite, baugleiche increment (+1 je **Power Stone**, `repeat`-`childId=696a-648d-c842-4c6a` mit `includeChildSelections="true"`) ist in **allen** Rostern inert, weil kein Power Stone gewählt ist. Er ist eine **andere** Zelle und wird hier nicht gepinnt. | Ebd. → zweiter `modifier type="increment" value="1" field="188e-3808-4b37-c8d9"`; die Roster enthalten keine Auswahl mit `entryId=696a-648d-c842-4c6a` bzw. Link `c492-f625-09c8-3702`. |
| **PRIC-R7** | Der Dispel Scroll selbst limitiert sich auf **max 4 je Träger** — mit 1 bzw. 2 Kopien still. Skullmantle und Bangstick tragen je **max 1 je Träger** und **max 1 je Roster** — mit je einer Kopie still. | `.gst`, `selectionEntry` `b76c-6bad-4650-dbb0` (25 pts) → **`809a-eb2a-6def-15f6`** (`max 4 scope=parent`); OK-`.cat`, `5ccf-df71-8c78-ee5e` (20 pts) → **`153e-42d6-004c-e352`** (`max 1 scope=parent`) / **`6482-f23b-9933-2363`** (`max 1 scope=roster`); `c5d0-f7e9-6534-f6f4` (25 pts) → **`ffca-6d1b-26f9-9be5`** / **`0fad-e34d-5f8d-b1f3`**. |
| **PRIC-R8** | Die Pflicht-Untergrenze des Trägers ist in allen Rostern erfüllt: **Hand Weapon min 1** (gewählt), sowohl am Link des Butchers als auch am geteilten `.gst`-Eintrag; die zugehörigen max-1-Grenzen sind mit einer Kopie eingehalten. | OK-`.cat`, `8933-af8e-e780-6f48` → `entryLink 8b61-79ab-f251-234b` mit min **`4dd7-db61-d846-4252`** / max **`90b7-8f2e-6da9-6516`**; `.gst`, `abdb-bbd0-41b2-5dff` → min **`bdef-ba9b-d6ce-5b14`** / max **`e28e-dbb4-b8ad-d4ab`**. |

**Bewusst nicht Gegenstand dieses Szenarios** (in allen Rostern inert bzw. nicht
assertiert):

- **Die Sammelgruppe darüber:** „Arcane Items (OK-AB + Common)"
  (`d502-9cf6-2232-202c`) trägt eine **eigene** `max 1`-Grenze
  `7855-e50e-e607-015e` mit zwei increments, deren `repeat`-`childId`s die
  **Link**-Ids der Common-Gruppe nennen (`989e-9d22-7fea-19b5` = Dispel Scroll,
  `f969-0b28-b1cf-bb02` = Power Stone) und `includeChildSelections="true"`
  tragen. Ob eine Auswahl mit `entryId=b76c-…` unter dem **OK**-Link
  `1954-…` für eine `childId` zählt, die die **Common**-Link-Id nennt, ist eine
  eigene Frage der Link/Ziel-Auflösung ([§9.7, Fallstrick 1](../../battlescribe-data-format.md#97-mehrfach-erlaubte-gegenstände-in-einer-max1-gruppe-dispel-scroll-etc))
  — deshalb steht `7855-e50e-e607-015e` **weder** in `firing` **noch** in
  `absent`. Dasselbe gilt für die `max 1`-Grenze `7ed8-2807-ba7d-fe27` der
  `.gst`-Gruppe „Arcane Items (Common)" (`0d3f-389c-02b2-bb34`).
- **Die `includeChildSelections="false"`-Abgrenzung selbst:** ein Gegenbeispiel
  bräuchte einen Dispel Scroll, der **unterhalb** einer weiteren Auswahl des
  Trägers hängt. Der Butcher hat im Katalog keine solche Unterauswahl, die den
  Scroll führen dürfte; ein erfundener Aufbau wäre kein Katalogbeleg. Die Zelle
  wird darum über den `false`-Zähler in seiner realen Verwendung gepinnt
  (PRIC-R5), nicht über einen Kontrast zu `true`.
- **Punkte-Budget in Roster 05:** die 50-pts-Grenze `62a3-8df3-3e65-6be1` der
  Gruppe „Magic Items and Big Names" wird dort mit `2×25 + 20 + 25 = 95` pts
  bewusst gesprengt; sie darf zusätzlich feuern und steht deshalb in Roster 05
  **nicht** in `absent` (in 01–04 mit 0/25/50/45 pts dagegen schon).
- **Armeeweite Aufbau-Diagnosen** (General-Pflicht, Core-Mindestzahl, die
  Ogre-Bulls-Pflicht, Kategorien-Skalierung ohne gesetztes Punktebudget):
  können zusätzlich auftreten; die Erwartung ist selektiv und macht darüber
  keine Aussage.
- **`headroom`/`isBlocked` jenseits der Grenze:** in den beiden
  Überschreitungs-Rostern (04, 05) ist nicht aus den Daten oder der Formatdoku
  ableitbar, ob der Restspielraum negativ oder auf 0 geklemmt gemeldet wird —
  dort werden nur `current`, `effectiveMin` und `effectiveMax` assertiert.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle fünf Roster
tragen **denselben** Träger: ein Butcher im Kontingent „Standard (OK-AB)" mit
Pflicht-Hand-Weapon. 01–03 unterscheiden sich **ausschließlich** in der Zahl der
Dispel Scrolls; 04 und 05 fügen dieselben zwei anderen Arcane Items hinzu.

> **Assertion-Fokus:** das effektive Maximum des Gruppen-Ankers „Arcane Items"
> (`expect.capabilities`, Feld `effectiveMax`) sowie `actual`/`bound` der Grenze
> `188e-3808-4b37-c8d9` im Verletzungsbericht.

| # | Testtitel | Betroffene Katalogdateien | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|---------------------------|----------------|-------------------------------------------------------|---------|
| 01 | Kein Scroll → Basiswert 1 | `.gst` + OK-`.cat` (+ Mercenaries) | Butcher ohne jede Auswahl in der Gruppe `4c3e-…`. | **PRIC-R3:** Der Gruppen-Anker (Verweis `a8d2-…` → Gruppe `4c3e-…`, Rahmen = Butcher `8933-…`) meldet den geschriebenen Basiswert `effectiveMax=1` bei Ist 0 (Spielraum 1, kein `min`, nicht blockiert). Keine der genannten Grenzen feuert. | [`01-no-dispel-scroll-base-max-1.ros`](rosters/01-no-dispel-scroll-base-max-1.ros) |
| 02 | Ein Scroll → Maximum 2 | wie 01 | Derselbe Aufbau mit `number="1"` Dispel Scroll (Link `1954-…`). | **PRIC-R2:** Derselbe Anker meldet `effectiveMax=2` bei Ist 1 (Spielraum 1); die Wiederholung greift **einmal**. Keine der genannten Grenzen feuert. | [`02-one-dispel-scroll-max-2.ros`](rosters/02-one-dispel-scroll-max-2.ros) |
| 03 | Zwei Scrolls → Maximum 3 | wie 01 | Derselbe Aufbau mit `number="2"`. | **PRIC-R2:** `effectiveMax=3` bei Ist 2 (Spielraum 1); die Wiederholung greift **zweimal**. Keine der genannten Grenzen feuert. | [`03-two-dispel-scrolls-max-3.ros`](rosters/03-two-dispel-scrolls-max-3.ros) |
| 04 | Zwei andere Items ohne Scroll → Grenze 1 feuert | wie 01 | Skullmantle + Bangstick in der Gruppe, **kein** Scroll. | **PRIC-R3/R4:** Ohne Treffer bleibt die Grenze bei 1; sie feuert mit **Ist 2 gegen Grenze 1**. Der Anker meldet `current=2`, `effectiveMax=1`. Budget (45 ≤ 50 pts) und die Eigengrenzen der beiden Items bleiben still. | [`04-two-other-items-no-scroll-max-1-fires.ros`](rosters/04-two-other-items-no-scroll-max-1-fires.ros) |
| 05 | Zwei Scrolls + dieselben zwei Items → Grenze 3 feuert | wie 01 | Wie 04, zusätzlich `number="2"` Dispel Scrolls. | **PRIC-R4:** Dieselbe Grenze feuert jetzt mit **Ist 4 gegen Grenze 3** — der gemeldete `bound` ist um genau **zwei** Wiederholungsschritte höher als in Test 04. Der Anker meldet `current=4`, `effectiveMax=3`. Das 50-pts-Budget darf zusätzlich feuern (95 pts) und ist nicht assertiert. | [`05-two-scrolls-plus-two-items-max-3-fires.ros`](rosters/05-two-scrolls-plus-two-items-max-3-fires.ros) |

**Ableitung der Zahlen (aus den Daten, nicht aus einem Engine-Lauf):**
`effectiveMax` ist der Basiswert **1** der Constraint `188e-…` plus
`floor(N/1)×1×1` Anwendungen des increment **+1**, wobei N die Zahl der vom
Butcher direkt gehaltenen Dispel Scrolls ist (PRIC-R2/R3) — also 1, 2, 3, 1, 3
in den Tests 01…05. `current` ist die Zahl der gezählten Gruppen-Mitglieder
unter dem Träger, d. h. die Summe der `number`-Werte der Auswahlen mit
`entryGroupId="4c3e-febe-6d5d-6912"`: 0, 1, 2, 2 (1+1), 4 (2+1+1).
`headroom` ist in 01–03 die Differenz Maximum − Ist (jeweils 1).
`effectiveMin` ist `null`, weil weder die Gruppe noch der einbindende Verweis
eine min-Grenze trägt und kein Modifier eine hinzufügt. In 04/05 ist
`current > effectiveMax`, die Grenze feuert also mit `actual = current` und
`bound = effectiveMax` (2/1 bzw. 4/3). Der effektive Name bleibt der Basisname
**„Arcane Items"**: an `4c3e-…` hängt kein Namens-Modifier (der
`append "Relics of Lustria"` steht an der Sammelgruppe `d502-…` und an
„Talismans" `66af-…`, nicht hier), und der einbindende Verweis `a8d2-…` trägt
denselben Namen.

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
| — increment +1 je Dispel Scroll (`repeat` value=1, repeats=1, `includeChildSelections=false`) + condition `greaterThan 0` | `childId=b76c-6bad-4650-dbb0` |
| — increment +1 je Power Stone (inert; `includeChildSelections=true`) | `childId=696a-648d-c842-4c6a` (Link `c492-f625-09c8-3702`) |
| Dispel-Scroll-Link → geteilter `.gst`-Eintrag (25 pts, max 4/Träger) | `1954-4ffd-5be0-eac7` → `b76c-6bad-4650-dbb0` — max `809a-eb2a-6def-15f6` |
| Skullmantle-Link → Eintrag (20 pts, max 1/Träger, max 1/Roster) | `2b2e-55f4-12ec-7fd1` → `5ccf-df71-8c78-ee5e` — `153e-42d6-004c-e352` / `6482-f23b-9933-2363` |
| Bangstick-Link → Eintrag (25 pts, max 1/Träger, max 1/Roster) | `f7d4-c610-84a1-2796` → `c5d0-f7e9-6534-f6f4` — `ffca-6d1b-26f9-9be5` / `0fad-e34d-5f8d-b1f3` |
| Kategorie „Heroes" (im Kontingent verlinkt) | `c16b-f319-2c62-2c12` |
| Kontingent, in dem der Butcher versteckt wäre (hier nicht benutzt) | `8711-ed16-2a44-7251` („Ironskin Tribe") |
