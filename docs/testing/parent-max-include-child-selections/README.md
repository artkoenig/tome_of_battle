# E2E-Regeln & Testkatalog: `max`-Grenze mit `scope="parent"` und `includeChildSelections="true"` (Orcs & Goblins)

**Rolle:** Black-Box-Test (kein Blick in den Evaluator-Quellcode). Alle Regeln
sind aus den Katalogdaten der *6th Definitive Edition* abgeleitet; das
Eingabeformat der Roster folgt den bereits verifizierten Szenario-Fixtures
(direktes `entryId`, `entryLinkId` des Verweises, `entryGroupId` für
Gruppen-Mitglieder, geschachtelte `selections` mit `number`).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee: `Orcs and goblins (6th definitive edition).cat`
  (`4049-c46d-7f80-44fb`, rev 1) — Kontingent **„Standard (OG-AB)"**
  `2bfa-e64a-7123-895f`
- Dazu `Mercenaries (6th definitive edition).cat` (per `catalogueLink`
  `b066-2f8e-11ee-1dce` → `fc47-8392-a6c8-452a` aus der O&G-`.cat` eingebunden)

## Der gepinnte Mechanismus

Träger der Grenze ist der **Gegenstand selbst** — der geteilte `selectionEntry`
**„Buzgob's Knobbly Staff "** (`6a95-95ff-7763-bd6d`, 50 pts). Er trägt zwei
Zählgrenzen mit demselben Wert, aber unterschiedlichem Bezugsrahmen:

```
selectionEntry "Buzgob's Knobbly Staff " (6a95-95ff-7763-bd6d, type=upgrade, 50 pts)
  ├ constraint 7bb9-9e7c-920b-9c2a  type=max value=1 field=selections scope=roster
  │     shared=true includeChildSelections=true includeChildForces=true
  └ constraint c807-4ad1-4a8d-d2b1  type=max value=1 field=selections scope=parent   ← gepinnte Zelle
        shared=true includeChildSelections=true includeChildForces=true
```

Erreichbar ist der Gegenstand ausschließlich über eine **Kette von Gruppen**
unterhalb eines Magier-Charakters:

```
selectionEntry "Orc Great Shaman" (aa57-63c4-136b-4af5, type=unit, Lord)
  └ selectionEntryGroup "Magic Items" (d0b4-bc9d-bb72-39e8)
       ├ constraint 3f10-bafd-c607-1bae  max 100 <pts> scope=parent
       └ entryLink 9e35-fc3f-fb95-63ab ──▶ selectionEntryGroup
            "Arcane Items (OG-AB + Common)" (2162-4c38-5fcf-ae8b)
              └ entryLink 552b-03bd-f34c-45a9 ──▶ selectionEntryGroup
                   "Arcane Items (Orcs)" (2eab-0673-0cb1-a5ea)
                     └ entryLink 99ed-8337-b602-d233 ──▶ 6a95-95ff-7763-bd6d
```

Da `selectionEntryGroup`s im `.ros` **keine** Selektionen erzeugen, ist jede
Kopie des Gegenstands ein **direktes Kind** des Shamans; der Bezugsrahmen der
`scope="parent"`-Grenze ist damit der Shaman.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **PMICS-R1** | Unterhalb **eines** Eltern-Rahmens darf der Träger **höchstens einmal** vorkommen. `bound` ist der geschriebene Wert **1**. | `Orcs and goblins (…).cat`, `selectionEntry` `6a95-95ff-7763-bd6d` → constraint **`c807-4ad1-4a8d-d2b1`** (`type=max value=1 field=selections scope=parent shared=true includeChildSelections=true includeChildForces=true`). |
| **PMICS-R2** | `actual` ist die Zahl der **Instanzen des Trägers** im Rahmen — nicht die Zahl aller Auswahlen im Rahmen. Zwei Kopien ⇒ `actual=2`, Verstoß gegen PMICS-R1. | Ebd.; `field="selections"` mit dem Träger als Bezug. In den Rostern 02/05 stehen 2 Kopien im Rahmen `aa57-63c4-136b-4af5`, in 01/03 genau eine. |
| **PMICS-R3** | `shared="true"`: die Summe läuft über **alle** Instanzen des Trägers im Rahmen — gleichgültig, ob sie als **eine** Selektion mit `number="2"` oder als **zwei** getrennte Selektionen mit je `number="1"` notiert sind. | Ebd., Attribut `shared="true"` ([Formatdoku §7.6](../../battlescribe-data-format.md): „die Summe umfasst **alle** Auswahlen dieses shared entry"). Roster 02 (`number="2"`) und Roster 05 (zwei Geschwister-Selektionen) sind die beiden Notationen desselben Ist-Werts 2. |
| **PMICS-R4** | `includeChildSelections="true"`: der Rahmen umfasst **auch tiefer geschachtelte** Auswahlen, nicht nur seine direkten Kinder. Gezählt werden darin weiterhin **nur Kopien des Trägers** — andere tiefe Auswahlen erhöhen `actual` **nicht**. | Ebd., Attribut `includeChildSelections="true"` ([Formatdoku §7.6/§7.7](../../battlescribe-data-format.md): „auch **unterhalb** des Scope-Ziels verschachtelte Auswahlen"). Roster 03 füllt den Rahmen mit echter Unterstruktur (Boar `8614-4beb-61b2-9595`; „Show Spells" `35d0-8c85-663b-fb2b` → Spruch `c2cf-8f3a-6f9d-6e5c` auf Tiefe 2) und hält dennoch `actual=1`. |
| **PMICS-R5** | Der Rahmen ist die **Eltern-Auswahl**, nicht die Armee: zwei Kopien unter **zwei verschiedenen** Rahmen verletzen PMICS-R1 **nicht**. | Ebd. (`scope="parent"`). Roster 04: je eine Kopie unter `aa57-63c4-136b-4af5` und `0767-0a7d-7c03-8833`; beide Rahmen zählen 1. |
| **PMICS-R6** | Die **armeeweite** Zwillingsgrenze desselben Trägers greift dagegen über alle Rahmen hinweg: zwei Kopien irgendwo im Roster ⇒ `actual=2`, `bound=1`. | Ebd. → constraint **`7bb9-9e7c-920b-9c2a`** (`type=max value=1 field=selections scope=roster shared=true includeChildSelections=true includeChildForces=true`). Sie ist der Kontrast, der belegt, dass in Roster 04 **beide** Kopien gesehen werden. |
| **PMICS-R7** | Beide Grenzen behalten ihren **geschriebenen** Wert 1 — im gesamten Fixture-Datensatz adressiert **kein** `modifier` die Ids `c807-4ad1-4a8d-d2b1` oder `7bb9-9e7c-920b-9c2a`. | Verifiziert über alle fünf Fixture-Dateien: die beiden Ids kommen ausschließlich als `constraint id` vor (O&G-`.cat`, Zeilen 11654/11655), nie als `modifier field`. |
| **PMICS-R8** | Das Punkte-Budget der Magic-Items-Gruppe bleibt in allen fünf Rostern still: 1 × 50 pts bzw. 2 × 50 = **100 pts** bei `max 100`. | O&G-`.cat`, Gruppe `d0b4-bc9d-bb72-39e8` → constraint **`3f10-bafd-c607-1bae`** (`type=max value=100 field=ecfa-8486-4f6c-c249 scope=parent`); analog am Savage Orc Great Shaman Gruppe `3230-f6ab-0826-f6a4` → **`ca0b-53c1-102f-178e`**. |

### Bewusst nicht assertiert

- **Die Gruppengrenze `82c7-4662-f638-e130`** („Arcane Items (OG-AB + Common)",
  `max 1 selections scope=parent`, **`includeChildSelections="false"`**): der
  Gegenstand ist kein direktes Mitglied dieser Gruppe, sondern Mitglied der
  darin verschachtelten Gruppe `2eab-0673-0cb1-a5ea`. Ob `false` diese
  verschachtelten Mitglieder ausschließt, ist aus der Formatdoku
  ([§7.6](../../battlescribe-data-format.md): `false` zählt *„just `scope`'s
  `field`"*) **nicht eindeutig** ableitbar — die Grenze steht deshalb weder in
  `firing` noch in `absent`. Sie trägt zudem zwei `increment`-Modifier
  (`repeat` auf `f969-0b28-b1cf-bb02` bzw. `989e-9d22-7fea-19b5`), die in diesen
  Rostern inert sind, weil keine dieser Auswahlen vorkommt.
- **Armeeweite Aufbau-Diagnosen** (General-Pflicht, Core-Mindestzahl,
  Lord-/Charakter-Kontingente ohne gesetztes Punktebudget) können zusätzlich
  auftreten; die Erwartung ist selektiv und macht darüber keine Aussage.

### Lücke: der tiefer geschachtelte Zwilling ist in diesen Daten nicht baubar

Der **stärkste** denkbare Zeuge für `includeChildSelections="true"` wäre eine
**zweite Kopie des Trägers auf größerer Tiefe unterhalb desselben Rahmens**
(Kopie A direkt unter dem Charakter, Kopie B unter einer Unter-Auswahl des
Charakters → `actual=2` **nur dann**, wenn die Tiefe mitzählt). Dieser Aufbau
ist mit den Trägern dieser Form im eingefrorenen Datensatz **nicht
katalog-legal** herstellbar:

- Alle fünf O&G-Träger dieser Form (`6a95-95ff-7763-bd6d`,
  `704c-1121-5a10-174e`, `d46e-ef96-d733-e1ae`, `4676-97f2-17cb-60fa`,
  `a038-6d17-2707-62c4`) sind **ausschließlich** über die beiden Gruppen
  „Arcane Items (Orcs)" `2eab-0673-0cb1-a5ea` und „Arcane Items (Goblin)"
  `f5dc-bffb-5305-5ddc` verlinkt.
- Diese Gruppen hängen — direkt oder über die Sammelgruppen
  `2162-4c38-5fcf-ae8b` / `87c2-9e36-88d8-7892` — stets in der „Magic
  Items"-Gruppe eines Magier-Charakters. Da Gruppen im `.ros` keine Selektionen
  erzeugen, landet **jede** Kopie als direktes Kind des Charakters.
- **Keine** Unter-Auswahl dieser Magier (Reittier `8614-4beb-61b2-9595`,
  Chariot `6b43-2113-27c3-607d`, „Show Spells" `35d0-8c85-663b-fb2b`,
  „Magic Level" `3aea-621a-cde8-b4f6`, Savage Orc Boar Chariot
  `a462-dc3d-4e19-0833`) bietet einen dieser Gegenstände an. Dasselbe gilt für
  die 13 baugleichen `[CHAOS DWARFS]`-/`[GREENSKINS]`-Träger der Vampire-Counts-
  `.cat` (`ec6f9c8d-…` … `1a41bbb6-…`).

Ein Roster, das eine Kopie unter eine Unter-Auswahl hängt, die sie im Katalog
gar nicht anbietet, wäre eine **erfundene** Struktur und damit kein zulässiger
Beleg. Roster 03 pinnt deshalb die aus den Daten belegbare Hälfte der Aussage:
der Rahmen **enthält** tiefer geschachtelte Auswahlen, und `actual` bleibt
trotzdem die Zahl der Träger-Kopien (1). Die andere Hälfte — die tiefe Kopie
zählt mit — bleibt in diesem Datensatz **unbelegbar** und ist als Lücke
festgehalten, nicht geraten.

---

## Testkatalog (E2E-Szenarien der Reinraum-Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle fünf nutzen
dasselbe Kontingent „Standard (OG-AB)" `2bfa-e64a-7123-895f` und denselben
Träger; sie unterscheiden sich nur in Zahl, Notation und Rahmen der Kopien.

> **Assertion-Fokus:** die Grenzen `c807-4ad1-4a8d-d2b1` (parent) und
> `7bb9-9e7c-920b-9c2a` (roster) sowie die Punkte-Budgets `3f10-bafd-c607-1bae`
> / `ca0b-53c1-102f-178e`; dazu der Slot-Zustand des Gegenstands über
> `expect.capabilities` (`current`, `effectiveMax`, `headroom`, `isBlocked`).

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | Eine Kopie (legal) | Orc Great Shaman, Pflicht-Choppa + Magic Level 3, **eine** Kopie des Staffs. | **PMICS-R1:** keine Verletzung. Der Slot meldet `current 1`, `effectiveMax 1`, `headroom 0`, `isBlocked true` — die eine erlaubte Kopie ist verbraucht. | [`01-one-staff-legal.ros`](rosters/01-one-staff-legal.ros) |
| 02 | Zwei Kopien als `number="2"` (unzulässig) | Identisch, Staff-Selektion mit `number="2"`. | **PMICS-R1/R2:** `c807-4ad1-4a8d-d2b1` feuert mit **Ist 2 / Grenze 1**; zusätzlich `7bb9-9e7c-920b-9c2a` (Ist 2 / Grenze 1). Das 100-pts-Budget bleibt still (genau 100). | [`02-staff-number-two-parent-max-fires.ros`](rosters/02-staff-number-two-parent-max-fires.ros) |
| 03 | Tiefe Unterstruktur, eine Kopie (legal) | Wie 01, zusätzlich Boar sowie „Show Spells" mit einem Spruch darunter (Tiefe 2). | **PMICS-R4:** der Rahmen enthält tiefer geschachtelte Auswahlen, `actual` bleibt 1 — `c807` und `7bb9` feuern nicht, Slot weiterhin `current 1` / `effectiveMax 1`. | [`03-nested-subtree-one-staff-legal.ros`](rosters/03-nested-subtree-one-staff-legal.ros) |
| 04 | Zwei Rahmen, je eine Kopie | Orc Great Shaman **und** Savage Orc Great Shaman, jeder mit einer Kopie (derselbe Verweis `99ed-…`). | **PMICS-R5/R6:** `c807-4ad1-4a8d-d2b1` bleibt **still** (je Rahmen Ist 1); `7bb9-9e7c-920b-9c2a` feuert mit **Ist 2 / Grenze 1**. Beide Slots melden `current 1`, `effectiveMax 1`, `isBlocked true`. | [`04-two-staffs-two-shamans-parent-silent.ros`](rosters/04-two-staffs-two-shamans-parent-silent.ros) |
| 05 | Zwei getrennte Instanzen (unzulässig) | Wie 02, aber zwei Geschwister-Selektionen mit je `number="1"`. | **PMICS-R3:** dieselbe Aussage wie 02 — `c807` (Ist 2 / Grenze 1) und `7bb9` (Ist 2 / Grenze 1) feuern; `shared="true"` summiert über beide Instanzen. | [`05-two-sibling-staffs-shared-count-fires.ros`](rosters/05-two-sibling-staffs-shared-count-fires.ros) |

**Ableitung der Zahlen (aus den Daten, nicht aus einem Engine-Lauf):** `bound`
ist in beiden Grenzen der geschriebene `value="1"` (PMICS-R7: kein Modifier
adressiert sie). `actual` folgt aus der Roster-Struktur unter dem jeweiligen
Bezugsrahmen: 1 (Roster 01/03 und je Rahmen in 04) bzw. 2 (Roster 02/05 im
Rahmen des Shamans, Roster 02/04/05 armeeweit). `effectiveMax` des Slots ist 1,
weil beide Grenzen des Trägers den Wert 1 tragen und keine sie verändert;
`headroom` ist `1 − current`, `isBlocked` gilt bei ausgeschöpftem Höchstmaß.
`effectiveMin` ist `null`, weil der Träger keine `min`-Grenze trägt und kein
Verweis eine hinzufügt.

---

## Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Spielsystem (`.gst`) | `0d13-7737-ea86-4662` |
| Orcs-and-Goblins-Katalog (`.cat`) | `4049-c46d-7f80-44fb` |
| Katalog-Link auf Mercenaries | `b066-2f8e-11ee-1dce` → `fc47-8392-a6c8-452a` |
| Kontingent „Standard (OG-AB)" | `2bfa-e64a-7123-895f` |
| **Träger:** „Buzgob's Knobbly Staff " (upgrade, 50 pts) | `6a95-95ff-7763-bd6d` |
| — **gepinnte Grenze** (max 1, `scope=parent`, `shared`, `includeChildSelections/Forces=true`) | `c807-4ad1-4a8d-d2b1` |
| — armeeweite Zwillingsgrenze (max 1, `scope=roster`) | `7bb9-9e7c-920b-9c2a` |
| Verweis auf den Träger (der Slot-`defId`) | entryLink `99ed-8337-b602-d233` in Gruppe `2eab-0673-0cb1-a5ea` |
| Gruppe „Arcane Items (Orcs)" | `2eab-0673-0cb1-a5ea` |
| Gruppe „Arcane Items (OG-AB + Common)" (max 1, `includeChildSelections=false`, nicht assertiert) | `2162-4c38-5fcf-ae8b` — constraint `82c7-4662-f638-e130` |
| Orc Great Shaman (unit, Lord primär, Characters) | `aa57-63c4-136b-4af5` |
| — Gruppe „Magic Items" (100-pts-Budget) | `d0b4-bc9d-bb72-39e8` — constraint `3f10-bafd-c607-1bae` |
| — Choppa (Pflicht, min 1 / max 1) | `051b-bb88-69f3-6eb6` — min `12fa-412a-3927-39e9` |
| — Gruppe „Magic Level" (min 1 / max 1), Mitglied Level 3 Shaman | `3aea-621a-cde8-b4f6` — min `56e7-cf73-36d9-421f`; `9888-4923-f6d5-157a` |
| — Gruppe „Mounts", Mitglied Boar | `ba8a-b51f-65f9-5f96`; `8614-4beb-61b2-9595` |
| — „Show Spells" → Gruppe „LittleWaaagh" → Spruch „1.Gaze of Mork" | `35d0-8c85-663b-fb2b` → `b7e2-ab17-22cd-10b6` → entryLink `b58b-cb1f-9a0b-f094` → `c2cf-8f3a-6f9d-6e5c` |
| Savage Orc Great Shaman (zweiter Rahmen in Roster 04) | `0767-0a7d-7c03-8833` |
| — Gruppe „Magic Items" (100-pts-Budget) | `3230-f6ab-0826-f6a4` — constraint `ca0b-53c1-102f-178e` |
| — Choppa (Pflicht) / Gruppe „Magic Level" + Level 3 Shaman | `4df9-3f17-67bd-8715`; `64b5-3170-8ad3-1d15` / `1248-7771-defe-214a` |
| Weitere Träger derselben Form in O&G (nicht bespielt) | `704c-1121-5a10-174e` (`18fd-6404-1d67-ebe3`), `d46e-ef96-d733-e1ae` (`3549-7f0f-3bb8-3ceb`), `4676-97f2-17cb-60fa` (`e40b-8ecc-8b62-ddbe`), `a038-6d17-2707-62c4` (`ae23-b675-31a1-a67b`) |
