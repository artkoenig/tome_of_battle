# E2E-Regeln & Testkatalog: `lessThan` mit `scope="self"` und einer **Gruppen-Id** — das Reittier-/Waffen-Gatter des Dark-Elf-Highborn

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln, IDs und
Erwartungswerte sind **ausschließlich aus den Katalogdaten** der *6th Definitive
Edition* und aus [`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md)
**abgeleitet**.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee-Katalog: `Dark Elves (6th definitive edition).cat`
  (`d4c0-4f0c-4a89-40fc`, rev 1) — Kontingent **„Standard (DE-AB)"**
  `26bc-729f-a188-f285` (`.cat` Z. 10081); es bindet per
  `catalogueLink 4301-a1ec-729b-b898` (Z. 10152) die Bibliothek
  `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`,
  `library="true"`) ein.
- Getestete Einheit: der Wurzel-`selectionEntry` **„Highborn"**
  `79af-7092-a9a9-393d` (`.cat` Z. 13, `type="unit"`, `categoryLink`s
  *Lord* `d024-d25b-a9b4-73b6` und *Characters* `7a1c-d611-c2dc-def1`).

## Worum es geht

Eine `<condition type="lessThan">` mit `scope="self"` zählt **im Rahmen der
Auswahl, die die Abfrage trägt** — hier: der Highborn selbst — die **unter diesem
Träger stehenden** Auswahlen, die auf die in `childId` genannte Id auflösen, und
hält, solange dieser Stand **unter** ihrem `value` liegt. Das Format-Dokument
führt `lessThan` in der Vergleichsliste der Condition (§7.7) und hält für
`constraint`/`condition` fest, dass gezählt wird, was **unterhalb** des Trägers
steht (§7.6).

Die Besonderheit dieses Ausschnitts: `childId` nennt **keine Eintrags-Id**,
sondern zweimal die Id einer **`selectionEntryGroup`**. Eine Gruppen-Id zählt
damit **jede in dieser Gruppe getroffene Auswahl** — sonst wäre die Bedingung
nicht erfüllbar, denn eine Gruppe wird im Roster nie selbst als Auswahl geführt
(§7.1: die Gruppe bündelt Alternativen; §7.6: eine Grenze an einer Gruppe zählt
**ihre Mitglieder**, nicht die Gruppe).

Fachlich ist das der **zusätzliche Rüstungsschritt** des Highborn: Er greift nur,
solange er ein **Schild** führt und **weder ein Reittier noch eine
Nahkampfwaffe** unter sich hat.

### Der getestete Ausschnitt des Katalogs

```
selectionEntry "Highborn" (79af-7092-a9a9-393d, type=unit)        ← Wurzel, entryLinkId=""
 ├ infoLink "Highborn" (7ae07422-6715-4692-aeb9-89fbd4ed033f)     → profile 3ffc-3172-37a9-a1fc
 │    └ modifiers: 8 Stück auf f1be-e66c-d5e1-673c (Sv)           ← Träger aller Abfragen
 ├ selectionEntries (direkte Kinder!)
 │    ├ "Hand Weapon"       5dc5-1087-8483-1d9b   min 1 (ad31-…) / max 1 (c62a-…)
 │    ├ "Repeater Crossbow" a97c-f9d2-2c74-f3d5   max 1
 │    └ "Character options" e8af-bd8c-71e2-8c30   min 1 (a8f3-…) / max 1 (31ee-…)
 │                                                 + 100-pts-Budget (79df-…)
 └ selectionEntryGroups
     ├ "CC Weapons" (4c8c-ab06-0b67-d4e8)          max 1 (ba0b-…)
     │    ├ "Additional Hand Weapon" ae70-df75-db2f-345d
     │    ├ "Halberd"                09ff-e7b5-c235-3470
     │    ├ "Great Weapon"           33db-02ad-6323-1ca6
     │    └ "Lance"                  a950-001a-0817-4791
     ├ "Mounts" (ba90-e917-dbad-292c)              max 1 (445f-…) / min 0 (e556-…)
     │    ├ entryLink "Cold One"         6584-… → 6315-38ea-2a11-da65
     │    ├ entryLink "Dark Steed"       82fe-… → 03e9-b763-6e56-2836
     │    ├ entryLink "Dark Pegasus"     630f-… → 68f3-4984-8c3c-e164
     │    ├ entryLink "Manticore"        3564-… → 1ac4-decf-43eb-a6bc
     │    ├ entryLink "Black Dragon"     9828-… → 269a-cdbc-e46f-3940
     │    └ entryLink "Cold One Chariot" fbe7-… → d003-57cb-9a43-beb0
     └ "Armour" (f074-0296-4374-278e)              keine Grenzen
          ├ "Sea Dragon Cloak" 5757-fa04-871e-f842
          ├ "Shield"           0b9c-d3ff-6535-74cd   max 1 (9b9e-…)
          └ "Body armour" (84a8-ac6e-d4a7-9233)      max 1 (7874-…)
               ├ "Light Amour"   b03f-3877-64c5-d83f
               └ "Heavy Armour"  03b3-b1ea-0aef-65f1
```

**Der entscheidende strukturelle Punkt:** die Pflicht-`selectionEntry`
**„Hand Weapon"** `5dc5-1087-8483-1d9b` ist ein **direktes Kind** des Highborn und
**kein Mitglied** der Gruppe „CC Weapons" `4c8c-ab06-0b67-d4e8`. Sie erhöht den
gezählten Gruppenstand also **nicht** — der Highborn kann die Pflichtwaffe führen
und trotzdem `lessThan 1 CC Weapons` erfüllen.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **LTS-R1** | Eine `condition type="lessThan" value="1" field="selections" scope="self" childId="<X>"` hält genau dann, wenn der **Träger der Abfrage** unter sich **weniger als 1**, also **null** Auswahlen führt, die auf `<X>` auflösen. Sie ist die Negation von „mindestens eins" und kippt, sobald eine solche Auswahl erscheint. | `Dark Elves…cat` Z. 45: `<condition type="lessThan" value="1" field="selections" scope="self" childId="ba90-e917-dbad-292c" shared="true" childName="Mounts" includeChildSelections="true"/>` und Z. 47 dieselbe Form mit `childId="4c8c-ab06-0b67-d4e8"` (`childName="CC Weapons"`). |
| **LTS-R2** | **`childId` nennt hier eine `selectionEntryGroup`, keinen Eintrag.** Gezählt wird deshalb **jede in dieser Gruppe getroffene Auswahl**. Beide Ids sind Gruppen **unter dem Highborn selbst**. | `ba90-e917-dbad-292c` ist der `selectionEntryGroup` „Mounts" (Z. 212), `4c8c-ab06-0b67-d4e8` der `selectionEntryGroup` „CC Weapons" (Z. 153) — beide in `<selectionEntryGroups>` des Highborn, **nicht** in `<selectionEntries>`. Eine Gruppe erscheint im Roster nie als eigene Auswahl (§7.1); unter der Lesart „zähle die Gruppe selbst" wäre die Bedingung **immer** wahr und der Katalog sinnlos. Belegt wird die Gruppen-Lesart durch das Messpaar 02↔03 (Mitglied der Gruppe „CC Weapons") und 02↔04 (Mitglied der Gruppe „Mounts"). |
| **LTS-R3** | Der zusätzliche Rüstungsschritt (`decrement 1` auf **Sv**) hängt an einer **`and`-Gruppe** aus **drei** Bedingungen: „**kein** Reittier" **und** „**mindestens ein** Schild" **und** „**keine** Nahkampfwaffe". Fehlt **eines** der drei Glieder, wirkt der Modifikator nicht. | Z. 41–51: `modifier type="decrement" value="1" field="f1be-e66c-d5e1-673c"` mit `conditionGroups/conditionGroup type="and"`, darin die beiden `lessThan` (Z. 45, 47) und `condition type="atLeast" value="1" … childId="0b9c-d3ff-6535-74cd"` (Z. 46, Schild). Eine `and`-Gruppe hält nur, wenn **alle** Mitglieder halten (Format-Dokument §7.7). |
| **LTS-R4** | **Bezugsrahmen `scope="self"`:** Alle acht Modifikatoren hängen am `infoLink` `7ae07422-…` **des Highborn**; „self" ist damit die Highborn-Auswahl. Mit `includeChildSelections="true"` zählen auch **verschachtelte** Nachfahren mit — Schild und Body-armour-Einträge liegen zwei Ebenen tiefer (Gruppe „Armour" → Untergruppe „Body armour"), die Gruppenmitglieder von „Mounts"/„CC Weapons" eine Ebene tiefer. | Z. 16–63: `<infoLink id="7ae07422-6715-4692-aeb9-89fbd4ed033f" … targetId="3ffc-3172-37a9-a1fc" type="profile"><modifiers>…`. Die Zieleinträge aller Bedingungen (`0b9c-…`, `03e9-…`, `5757-…`, `6315-…`, `b03f-…`, `03b3-…`) und die beiden Gruppen (`ba90-…`, `4c8c-…`) sind **ausschließlich** unterhalb des Highborn deklariert (Z. 69–365). |
| **LTS-R5** | **Basis und bedingungsloser Abzug:** Das Profil schreibt **Sv 11**, und der **vierte** Modifikator ist ein `decrement 4` **ohne jedes `<conditions>`-Element** — er wirkt immer. Ein Highborn ohne Ausrüstung steht damit auf **Sv 7** (im Datensatz der Wert für „kein Rüstungswurf"). | Z. 9690: `<characteristic name="Sv" typeId="f1be-e66c-d5e1-673c">11</characteristic>`; Z. 33–35: `<modifier type="decrement" value="4" field="f1be-e66c-d5e1-673c"><comment>race condition</comment></modifier>` — nur ein `<comment>`, **keine** `<conditions>`/`<conditionGroups>`. `.gst` Z. 84: `characteristicType id="f1be-e66c-d5e1-673c" name="Sv" defaultValue="7"`. |
| **LTS-R6** | Auf **demselben** Feld liegen fünf weitere, je an ein `atLeast 1` gebundene Abzüge: **Schild → `decrement 1`**, **Dark Steed → `decrement 1`**, **Sea Dragon Cloak → `decrement 1`**, **Cold One → `decrement 2`**, **Light Amour → `decrement 1`**, **Heavy Armour → `decrement 2`**. Mehrere `decrement` auf einem Merkmal **summieren** sich. | Z. 18–22 (`0b9c-…` Shield), Z. 23–27 (`03e9-…` Dark Steed), Z. 28–32 (`5757-…` Sea Dragon Cloak), Z. 36–40 (`6315-…` Cold One), Z. 52–56 (`b03f-…` Light Amour), Z. 57–61 (`03b3-…` Heavy Armour) — alle `scope="self" shared="true" includeChildSelections="true"`. |
| **LTS-R7** | **Nicht verwechseln:** das Profil trägt **zwei** Rüstungsspalten — `Sv` `f1be-e66c-d5e1-673c` (Wert 11) und `Sv+` `d4a9-0ed4-d041-e54b` (Wert 7). **Alle acht** Modifikatoren nennen `field="f1be-e66c-d5e1-673c"`; **kein** Modifikator berührt `Sv+`. `Sv+` bleibt daher in **jedem** Roster auf **7**. | Z. 9690/9691 (die beiden `characteristic`-Elemente des Profils `3ffc-3172-37a9-a1fc`); Z. 18, 23, 28, 33, 36, 41, 52, 57 (`field` aller acht Modifikatoren). `.gst` Z. 97: `characteristicType id="d4a9-0ed4-d041-e54b" name="Sv+" defaultValue="7"`. |
| **LTS-R8** | Der Effekt ist ein **Merkmalswert**, keine zählende Schranke. Es wird deshalb **keine** feuernde Grenze aus LTS-R1…R7 erwartet; die Aussagen laufen über `expect.capabilities[].infoElements[].characteristics`. | Der Verletzungsbericht kodiert Zähl-Grenzen (`constraint`), nicht Profilwerte — dieselbe Feststellung wie in [`less-than-parent-parry-save`](../less-than-parent-parry-save/README.md) (LTP-R7), [`modifier-characteristic-value`](../modifier-characteristic-value/README.md) und [`vampire-bloodlines`](../vampire-bloodlines/README.md) (VBL-R6). Die `firing`-Liste **aller fünf** Roster ist leer. |

### Die Rechnung im Detail

Basis-`characteristics` des Profils `3ffc-3172-37a9-a1fc` („Highborn",
`typeId=a54a-7f00-29bf-12b1`, Z. 9679–9694):

```
Mv 5 | WS 7 | BS 6 | S 4 | T 3 | W 3 | I 8 | A 4 | Ld 10 | Sv 11 | Sv+ 7 | US 1 | Base 20x20
```

Die acht Modifikatoren auf `f1be-e66c-d5e1-673c` (Sv), in Katalogreihenfolge:

| # | Operation | Bedingung | Beleg |
|---|-----------|-----------|-------|
| M1 | `decrement 1` | `atLeast 1` **Shield** `0b9c-d3ff-6535-74cd` | Z. 18–22 |
| M2 | `decrement 1` | `atLeast 1` **Dark Steed** `03e9-b763-6e56-2836` | Z. 23–27 |
| M3 | `decrement 1` | `atLeast 1` **Sea Dragon Cloak** `5757-fa04-871e-f842` | Z. 28–32 |
| M4 | `decrement 4` | **keine** (bedingungslos) | Z. 33–35 |
| M5 | `decrement 2` | `atLeast 1` **Cold One** `6315-38ea-2a11-da65` | Z. 36–40 |
| **M6** | `decrement 1` | `and`( **`lessThan 1` Mounts `ba90-…`** , `atLeast 1` Shield `0b9c-…` , **`lessThan 1` CC Weapons `4c8c-…`** ) | Z. 41–51 |
| M7 | `decrement 1` | `atLeast 1` **Light Amour** `b03f-3877-64c5-d83f` | Z. 52–56 |
| M8 | `decrement 2` | `atLeast 1` **Heavy Armour** `03b3-b1ea-0aef-65f1` | Z. 57–61 |

| Roster | Auswahl unter dem Highborn | Mounts-Stand | CC-Weapons-Stand | Schild-Stand | M1 | M2 | M4 | **M6** | **Sv** |
|--------|----------------------------|--------------|------------------|--------------|----|----|----|--------|--------|
| 01 | Hand Weapon, Character options | 0 | 0 | 0 | – | – | −4 | – (kein Schild) | **7** |
| 02 | + **Schild** | 0 | 0 | 1 | −1 | – | −4 | **−1** (0 < 1 **und** 0 < 1) | **5** |
| 03 | + Schild, **Great Weapon** | 0 | **1** | 1 | −1 | – | −4 | – (1 CC-Waffe, nicht < 1) | **6** |
| 04 | + Schild, **Dark Pegasus** | **1** | 0 | 1 | −1 | – | −4 | – (1 Reittier, nicht < 1) | **6** |
| 05 | + Schild, **Dark Steed** | **1** | 0 | 1 | −1 | **−1** | −4 | – (1 Reittier) | **5** |

**Die beiden Messpaare:**

- **Waffen-Paar 02 ↔ 03.** Einziger Unterschied: die *Great Weapon*
  `33db-02ad-6323-1ca6` — ein **inline-`selectionEntry` innerhalb** der Gruppe
  „CC Weapons". Sie verschlechtert den Rüstungswurf um **genau einen Punkt**,
  obwohl sie **selbst keinen** Sv-Modifikator am Highborn-Profil trägt (sie kommt
  in M1…M8 nicht vor). Das ist der beobachtbare Fingerabdruck der zweiten
  `lessThan`-Bedingung — und zugleich der Beleg, dass eine **Gruppen-Id** ihre
  Mitglieder zählt (LTS-R2).
- **Reittier-Paar 02 ↔ 04.** Einziger Unterschied: der *Dark Pegasus*
  `68f3-4984-8c3c-e164` — ein **`entryLink`** (`630f-b8b0-b4e1-c381`) **innerhalb**
  der Gruppe „Mounts". Wieder **genau ein Punkt**. Der Dark Pegasus ist bewusst
  gewählt: er ist das einzige Reittier der Gruppe, das **weder** in M1…M8 vorkommt
  **noch** eigene Kinder mitbringt (Z. 6874–6888: nur `infoLinks` und `costs`).

**Warum nicht der Dark Steed?** Genau das zeigt **Roster 05** als
Kontrollmessung: der Dark Steed trägt mit M2 einen **eigenen** `decrement 1`.
Sein Erscheinen kippt M6 (−1 entfällt) und fügt zugleich M2 (−1) hinzu — netto
**null**, `Sv 5` wie in Roster 02. Mit ihm wären die beiden Wirkungen in der Zahl
**nicht unterscheidbar**. Dasselbe gilt verschärft für den *Cold One* (M5,
`decrement 2`).

Als **Kontrollwerte** prüfen alle fünf Roster zusätzlich **Sv+ 7**
(`d4a9-0ed4-d041-e54b`, LTS-R7), **WS 7** (`f95b-da01-0578-3bdc`), **T 3**
(`8712-f56f-5b22-a720`) und **A 4** (`6b9f-c8fe-8998-27e3`) mit: am `infoLink`
hängen ausschließlich die acht Sv-Modifikatoren, alle anderen Merkmale bleiben in
**jedem** Roster auf Basis.

---

## Was dieses Szenario bewusst **nicht** festnagelt

- **Verfügbarkeit (`hidden`) der Reittiere.** Die `entryLink`s *Dark Pegasus*
  (Z. 234–245), *Manticore* (Z. 246–257) und *Black Dragon* (Z. 258–269) tragen je
  einen `modifier set hidden="true"` mit `condition type="instanceOf" scope="force"
  childId="77cd-dafb-16af-93c0"` — dem `forceEntry` **„City Garrison (AN-02)"**
  (Z. 10096). Die Roster nutzen das Kontingent **„Standard (DE-AB)"**
  `26bc-729f-a188-f285`, der Schalter greift also **nicht** und die Basis
  `hidden="false"` des Links bleibt stehen. Sichtbarkeit ist **Verfügbarkeit**,
  keine zählende Schranke (vgl. [`vampire-bloodlines`](../vampire-bloodlines/README.md),
  VBL-R4/R5) und wird hier **nicht** assertiert.
- **Der Namens-Modifikator des Highborn.** Drei Modifikatoren können den
  Anzeigenamen ändern: `set "City Commander"` (Z. 372–376, gated auf `force`
  `77cd-…`), `append "Captain of the Black Arc"` (Z. 377–386, verlangt zugleich die
  Auswahl des `entryLink` „General" `7a1e-c134-434e-3313` **und** das Kontingent
  „The Raiding Army" `4b5b-aebb-1526-91bb`) und derselbe `set` am Profil selbst
  (Z. 9695–9701). **Keiner** greift in diesen Rostern — deshalb ist der erwartete
  Slot-Name schlicht **„Highborn"**, und die Roster enthalten bewusst **keine**
  „General"-Auswahl.
- **Die punkteskalierte Border-Patrols-Grenze `73b0-905f-f230-93a8`.** Der
  Highborn trägt eine eigene Kostengrenze `max value="-1"` auf die pts-Kostenart
  (Z. 400, `-1` = unbegrenzt, §7.6-Sentinel), die per `modifier set 125`
  (Z. 392–397) nur greift, wenn „Border Patrols rules" `4e15-0353-165f-5528`
  **roster-weit** vorliegt. Das ist in keinem Roster der Fall; die Grenze steht in
  **jedem** `absent`.
- **Fremde Armeeaufbau-Diagnosen.** Die Erwartung ist laut Runner-Vertrag
  **selektiv**. Zusätzlich feuern dürfen (und sind hier ohne Belang): die
  General-Pflicht `1077-7379-f142-f382` (`.gst`) und die punkteskalierte
  Core-Pflicht `35c2-d478-392a-aeb1` (`.gst`) — die Roster enthalten bewusst nur
  den einen Charakter und **keine** Kerneinheit.
- **Die `formatRules` des Merkmals Sv.** Die `.gst` definiert für
  `f1be-e66c-d5e1-673c` Anzeigeregeln (`^([1-6])$` → `$1+`, „7 und höher" → `-`;
  Z. 85–95). Das ist **Darstellung**; geprüft wird der **gerechnete Rohwert**
  (`"7"`, `"6"`, `"5"`) — dieselbe Konvention wie in
  [`less-than-parent-parry-save`](../less-than-parent-parry-save/README.md) und
  [`modifier-characteristic-value`](../modifier-characteristic-value/README.md).
- **Die Zweige Sea Dragon Cloak, Cold One, Light/Heavy Armour.** Aus den Daten
  belegt (LTS-R6), aber nicht als eigenes Roster ausgeführt: für die
  `lessThan`-Frage tragen sie nichts bei. Rechnerisch ergäbe „Schild + Heavy
  Armour, kein Reittier, keine CC-Waffe" `11 − 1 − 2 − 4 − 1 = 3`.
- **Kosten.** Die `entryLink`s *Cold One* und *Dark Steed* tragen je einen
  `modifier type="set" field="ecfa-8486-4f6c-c249"` (39 bzw. 18 pts, Z. 220/228),
  der die Kosten des Zieleintrags am Link überschreibt. Das Manifest-Feld
  `capabilities` kennt keine Kosten-Aussage; der Punkt bleibt dokumentiert, aber
  unassertiert.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle referenzieren
`.gst` + Dark-Elves-`.cat` (+ die per `catalogueLink` benötigte
`Mercenaries`-`.cat`). Format wie die verifizierte Beispiel-Datei (direktes
`entryId`, `entryLinkId=""` bei inline deklarierten Einträgen, `entryLinkId` bei
verlinkten, `entryGroupId` = die tragende Gruppe).

> **Assertion-Fokus:** der **Sv**-Wert des Highborn-Profils je Roster, die vier
> Kontrollmerkmale sowie die in `absent` genannten Grenzen. Andere
> Armeeaufbau-Diagnosen (General-/Core-Pflicht, Lord-Grenze, Punktelimit) können
> zusätzlich auftreten und sind hier ohne Belang.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | Grundlinie: der bedingungslose Modifikator allein | Highborn mit nur den beiden Pflichtkindern *Hand Weapon* und *Character options*. | Der Highborn hat **Sv 7** — kein Rüstungswurf. Von acht Modifikatoren wirkt allein der **bedingungslose** `decrement 4` (11 → 7); die `and`-Gruppe fällt bereits an ihrem Schild-Glied. Sv+ 7, WS 7, T 3, A 4 unverändert. | [`01-highborn-bare-sv-7.ros`](rosters/01-highborn-bare-sv-7.ros) |
| 02 | **Schild, kein Reittier, keine Nahkampfwaffe** | wie 01 **+ Schild**. | Der Highborn hat **Sv 5**: Schild-Abzug **und** der zusätzliche Rüstungsschritt greifen, weil **beide** `lessThan`-Bedingungen halten. Die Pflicht-*Hand Weapon* zählt **nicht** als CC-Waffe — sonst stünde hier 6. | [`02-shield-only-sv-5.ros`](rosters/02-shield-only-sv-5.ros) |
| 03 | **Schild + Nahkampfwaffe** (Gruppe „CC Weapons") | **Bis auf die *Great Weapon* identisch mit 02.** | Der Highborn hat **Sv 6** — der Rüstungsschritt **entfällt**, sobald ein Mitglied der Gruppe „CC Weapons" unter ihm steht. Genau ein Punkt schlechter als 02, obwohl die Waffe selbst keinen Sv-Modifikator trägt. | [`03-shield-and-great-weapon-sv-6.ros`](rosters/03-shield-and-great-weapon-sv-6.ros) |
| 04 | **Schild + Reittier** (Gruppe „Mounts") | **Bis auf den *Dark Pegasus* identisch mit 02.** | Der Highborn hat **Sv 6** — der Rüstungsschritt **entfällt**, sobald ein Mitglied der Gruppe „Mounts" unter ihm steht. Wieder genau ein Punkt; der Dark Pegasus trägt **keinen** eigenen Sv-Modifikator. | [`04-shield-and-dark-pegasus-sv-6.ros`](rosters/04-shield-and-dark-pegasus-sv-6.ros) |
| 05 | Kontrolle: Reittier **mit** eigenem Abzug | **Bis auf den *Dark Steed* identisch mit 02.** | Der Highborn hat **Sv 5** — derselbe Wert wie 02, aber aus **anderer** Ursache: der entfallene Rüstungsschritt (−1) und der eigene Abzug des Dark Steed (−1) heben sich exakt auf. Belegt, warum Test 04 den Dark Pegasus braucht. | [`05-shield-and-dark-steed-sv-5-control.ros`](rosters/05-shield-and-dark-steed-sv-5-control.ros) |

Alle fünf Roster halten jede Grenze des Highborn ein (genau eine *Hand Weapon*,
genau eine *Character options*, höchstens ein Schild, höchstens ein Reittier,
höchstens eine CC-Waffe, kein Magiegegenstand → 0 von 100 pts) — sie stehen
deshalb sämtlich in den `absent`-Listen.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| ForceEntry „Standard (DE-AB)" (Dark Elves) | `26bc-729f-a188-f285` |
| Katalog Dark Elves / Bibliothek Mercenaries | `d4c0-4f0c-4a89-40fc` / `fc47-8392-a6c8-452a` (Link `4301-a1ec-729b-b898`) |
| SelectionEntry *Highborn* (Wurzel, Träger der Abfragen) | `79af-7092-a9a9-393d` (Kategorien `d024-d25b-a9b4-73b6` Lord, `7a1c-d611-c2dc-def1` Characters) |
| InfoLink *Highborn* (Träger der acht Sv-Modifikatoren) | `7ae07422-6715-4692-aeb9-89fbd4ed033f` → Profil `3ffc-3172-37a9-a1fc` (`profileType` „Profile" `a54a-7f00-29bf-12b1`) |
| Merkmal Sv (Subjekt) / Sv+, WS, T, A (Kontrolle) | `f1be-e66c-d5e1-673c` / `d4a9-0ed4-d041-e54b`, `f95b-da01-0578-3bdc`, `8712-f56f-5b22-a720`, `6b9f-c8fe-8998-27e3` |
| Gruppe *Mounts* (`lessThan`-Ziel Nr. 1) | `ba90-e917-dbad-292c` (`max 1` `445f-35a8-9739-f98d`, `min 0` `e556-9588-cb62-fed5`) |
| Gruppe *CC Weapons* (`lessThan`-Ziel Nr. 2) | `4c8c-ab06-0b67-d4e8` (`max 1` `ba0b-4441-5ece-5fee`) |
| Auslöser *Shield* (`atLeast`-Ziel der `and`-Gruppe) | `0b9c-d3ff-6535-74cd` (in Gruppe „Armour" `f074-0296-4374-278e`, `max 1` `9b9e-1cae-a668-f57f`) |
| Auslöser *Great Weapon* (Mitglied „CC Weapons", inline) | `33db-02ad-6323-1ca6` (`max 1` `bad1-2b62-b68d-1c9b`) |
| Auslöser *Dark Pegasus* (Mitglied „Mounts", **ohne** eigenen Sv-Modifikator) | `68f3-4984-8c3c-e164` (Link `630f-b8b0-b4e1-c381`, `max 1` am Link `673b-b16a-3450-b5ea`, am Ziel `303c-e96d-e4dc-cd4f`) |
| Kontrolle *Dark Steed* (Mitglied „Mounts", **mit** eigenem `decrement 1`) | `03e9-b763-6e56-2836` (Link `82fe-54ca-9dfc-e131`, `max 1` am Link `c3b3-dceb-f5b6-39e3`, am Ziel `fe79-ad23-a431-5be9`) |
| Weitere Mounts (nicht ausgeführt) | Cold One `6315-38ea-2a11-da65` (Link `6584-60d8-9672-01a1`), Manticore `1ac4-decf-43eb-a6bc`, Black Dragon `269a-cdbc-e46f-3940`, Cold One Chariot `d003-57cb-9a43-beb0` |
| Weitere CC Weapons (nicht ausgeführt) | `ae70-df75-db2f-345d`, `09ff-e7b5-c235-3470`, `a950-001a-0817-4791` |
| *Hand Weapon* (Pflicht, **direktes Kind**, kein CC-Weapons-Mitglied) | `5dc5-1087-8483-1d9b` (`min 1` `ad31-faa2-6dd0-c8ff`, `max 1` `c62a-9089-2b02-e959`) |
| *Character options* (Pflicht) | `e8af-bd8c-71e2-8c30` (`min 1` `a8f3-c5ec-4979-8f97`, `max 1` `31ee-1b0d-0417-5cc6`, 100-pts-Budget `79df-9ec7-9c79-b8dc`) |
| Gruppe *Armour* / Untergruppe *Body armour* | `f074-0296-4374-278e` (keine Grenzen) / `84a8-ac6e-d4a7-9233` (`max 1` `7874-ef54-fef7-0abc`) |
| Weitere Sv-Auslöser (belegt, nicht ausgeführt) | Sea Dragon Cloak `5757-fa04-871e-f842`, Light Amour `b03f-3877-64c5-d83f`, Heavy Armour `03b3-b1ea-0aef-65f1` |
| Eigene Kostengrenze des Highborn (`-1` = unbegrenzt) | `73b0-905f-f230-93a8` (Schalter „Border Patrols rules" `4e15-0353-165f-5528`) |
| Sichtbarkeits-Schalter der Reittiere (nicht ausgelöst) | ForceEntry „City Garrison (AN-02)" `77cd-dafb-16af-93c0` |
| Weitere Kontingente des Katalogs (nicht genutzt) | „The Raiding Army" `4b5b-aebb-1526-91bb`, „Watchtower Patrol" `ff5e-f712-03ce-bb85`, „Cult of Slaanesh" `5013-f9f4-e03b-94d5` |
| Fremde Pflichten (nicht Gegenstand): General / Core | `1077-7379-f142-f382` / `35c2-d478-392a-aeb1` |
