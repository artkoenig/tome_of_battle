# E2E-Regeln & Testkatalog: `repeat` mit `scope="parent"` und `childId="upgrade"` — der Waffenaufschlag der Ogre Maneaters

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln,
Constraint-IDs und Erwartungswerte sind **ausschliesslich aus den Katalogdaten**
des **upstream**-Fixture-Satzes `src/shared/__fixtures__/whfb6/` abgeleitet, dazu aus
der Formatspezifikation [`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md).
Das Eingabeformat der Roster folgt den bereits verifizierten Szenario-Fixtures
desselben Satzes (direktes `entryId`, `entryLinkId=""` bzw. Link-Id,
`entryGroupId` für Gruppen-Mitglieder, geschachtelte `selections` mit `number`) —
siehe [`../parent-max-enchanted-items-per-bearer/`](../parent-max-enchanted-items-per-bearer/README.md)
und [`../decrement-cost-bloodline-casting-dice/`](../decrement-cost-bloodline-casting-dice/README.md).

- Spielsystem: `Warhammer Fantasy Battle 6th edition.gst`
  (`6d8e-38d9-3c69-febf`, rev 8) — Kontingent **„Standard "** `7d9d-6c8d-4ea0-b7ad` (`.gst:61`)
- Armee: `Dogs of War.cat` (`4887-12ed-22a2-f461`, rev 4, `gameSystemId="6d8e-38d9-3c69-febf"`);
  der Katalog trägt **keine** `catalogueLinks` und **keine** eigenen `forceEntries`,
  der Datensatz besteht also aus genau diesen zwei Dateien.

> **Nur ein Fixture-Satz.** Dieses Szenario nutzt ausschliesslich den upstream-Satz
> `src/shared/__fixtures__/whfb6/`. Der Definitive-Edition-Satz
> (`src/domain/evaluator/__fixtures__/whfb6-definitive/`) enthält dieselben Ids teils mit
> anderen Attributen; er wird hier **nirgends** referenziert.

## Der gepinnte Mechanismus

```
forceEntry "Standard " (.gst 7d9d-6c8d-4ea0-b7ad)
  └ selectionEntry "Ogre Maneaters" (b1b8-10da-ac1a-ba7c, type="unit", 0 pts)   :2543
       ├ selectionEntry "Ogre Maneaters" (8fed-6b86-9099-db53, type="model", 80 pts)  :2581
       │    ├ constraint min 1 scope=parent            fb53-ce3d-0b8b-cca8      :2583
       │    └ selectionEntryGroup "Weapon" (6a33-8be5-b0a4-5b42)                :2586
       │         ├ constraint max 1 scope=parent       f353-4ad9-3691-858c      :2588
       │         ├ constraint max 1 scope=parent       1fed-7cb3-eaf7-5d17      :2589   (identische Zweitgrenze)
       │         ├ defaultSelectionEntryId = bbaf-1abe-4478-62d8 (Ogre club)
       │         ├ entryLink "Great Weapon"        d13c-78a4-0289-7d87 ──▶ .gst 1eb7-3f36-8cf7-e0ba (upgrade, 0 pts)
       │         │    ├ modifier increment 6.0 auf field=ecfa-8486-4f6c-c249    :2594
       │         │    │    └ repeat field="selections" scope="parent" value="1.0"
       │         │    │             childId="upgrade" repeats="1" roundUp="false"
       │         │    │             shared="true" includeChildSelections="false" :2596   ← DIESE ZELLE
       │         │    └ constraint max 1 scope=parent 173e-78a6-860e-2b1e       :2601
       │         ├ entryLink "Cathayan Longsword"  3d48-775c-37e8-0dc0 ──▶ 4186-0bfd-0938-69d8 (upgrade, 0 pts)  :2604
       │         │    └ derselbe increment + repeat, eigene max 1 b004-ed55-2156-385c
       │         ├ entryLink "Brace of Handguns"   70ab-1c93-f3b5-9405 ──▶ 098c-580d-026b-f647 (upgrade, 0 pts)  :2616
       │         │    └ derselbe increment + repeat, eigene max 1 c5fd-d20e-73e6-0690
       │         └ entryLink "Ogre club"           bbaf-1abe-4478-62d8 ──▶ 6192-2089-b7d5-7084 (upgrade, 0 pts)  :2628
       │              └ KEIN Modifikator, eigene max 1 074d-5c87-9c9f-5052
       └ selectionEntryGroup "Armour" (6b9b-e957-af89-cd63)                     :2644
            ├ constraint max 1 scope=parent  2ee2-9774-5dcc-530b
            ├ constraint min 1 scope=parent  b9c9-2eef-0ce0-4307     ← Pflicht
            ├ defaultSelectionEntryId = 868a-ecb7-b621-41cc (Light Armour)
            ├ entryLink "Heavy Armour" cb9b-3946-521c-5fa0 (increment 4 je childId="model") — hier nicht gewählt
            └ entryLink "Light Armour" 868a-ecb7-b621-41cc ──▶ .gst 055f-8e4e-f170-35d2 (upgrade, 0 pts)
```

Netto-Semantik der Daten: **jede** der drei modifikator-tragenden Waffen kostet
`6 pts × (Zahl der Auswahlen vom Typ `upgrade` im Eltern-Rahmen des Modells)`.
Der Ogre club — die Vorgabe der Gruppe — trägt denselben Konstruktionsplatz
**ohne** Modifikator und ist damit die kostenfreie Grundlinie.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **PRUW-R1** | Der `repeat` wendet seinen Modifikator `floor(Treffer / value) × repeats` mal an; mit `value="1.0"` und `repeats="1"` ist die Anwendungszahl **gleich der Trefferzahl**. `roundUp="false"` und `percentValue="false"` lassen die Rechnung ganzzahlig und absolut. | `Dogs of War.cat:2596` — `<repeat field="selections" scope="parent" value="1.0" percentValue="false" shared="true" includeChildSelections="false" includeChildForces="false" childId="upgrade" repeats="1" roundUp="false"/>`; Format-Doku [§7.7](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat) („bewirkt, dass der Modifier **mehrfach** angewendet wird"). |
| **PRUW-R2** | Der Bezugsrahmen `scope="parent"` ist die **Eltern-Auswahl des Trägers**. Träger ist die Waffen-Auswahl; sie steht in der Gruppe „Weapon", und eine `selectionEntryGroup` erzeugt **keine** eigene Roster-Ebene — der Rahmen ist also das **Modell** `8fed-6b86-9099-db53`, nicht die Einheit `b1b8-10da-ac1a-ba7c`. | Katalogstruktur oben (`:2581`→`:2586`→`:2592`); Format-Doku [§7.6](../../battlescribe-data-format.md#76-constraint) (`scope` = Bezugsrahmen der Zählung) und die bereits gepinnte Roster-Form in [`../parent-repeat-item-count/`](../parent-repeat-item-count/README.md) (PRIC-R5: „eine `selectionEntryGroup` erzeugt keine Roster-Ebene"). |
| **PRUW-R3** | `childId="upgrade"` ist ein **Roh-Typ-Schlüsselwort**: gezählt werden die Auswahlen, deren aufgelöster Eintrag `type="upgrade"` trägt. Steht die Auswahl über einen `entryLink` im Baum, zählt der rohe Typ ihres **transitiv aufgelösten Ziels**. | Format-Doku [§7.7](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat) / [§13.2](../../battlescribe-data-format.md#13-referenztabellen) (`childId` = Ziel-ID, Typ-Schlüsselwort `model`/`unit`/`upgrade` oder `any`) und der Erb-Kasten zu `scope="unit"` („zählt der rohe Typ ihres transitiv aufgelösten Ziels — dieselbe Erb-Regel wie beim Typ-Keyword-Zählen, Issue 078"). |
| **PRUW-R4** | **Alle vier** Mitglieder der Gruppe „Weapon" zählen für diese Zählung: ihre Ziele sind sämtlich `type="upgrade"`. Die Waffe zählt damit auch **sich selbst** — sie steht als direktes Kind im gezählten Rahmen, und weder Format-Doku noch XSD nehmen den Träger einer Query aus seinem eigenen Rahmen aus. | `.gst:443` Great Weapon `1eb7-3f36-8cf7-e0ba` `type="upgrade"`; `Dogs of War.cat:4005` Cathayan Longsword `4186-0bfd-0938-69d8`, `:4016` Brace of Handguns `098c-580d-026b-f647`, `:3984` Ogre club `6192-2089-b7d5-7084` — alle `type="upgrade"`. |
| **PRUW-R5** | Dass der Träger mitzählt, ist auch die **einzige** Lesart, unter der der Katalog überhaupt einen Preis erzeugt: alle vier Waffenziele kosten `0` pts, und **kein** Waffen-`entryLink` trägt eigene `<costs>`. Ohne den Selbst-Treffer wäre die Trefferzahl bei einer einzeln gewählten Waffe 0 und jede Maneater-Waffe kostenlos — die drei Aufpreis-Modifikatoren wären wirkungslose Daten. | `.gst:447-451` (Great Weapon 0 pts), `Dogs of War.cat:3989-3993 / :4010-4014 / :4021-4025` (0 pts); die Links `:2592`, `:2604`, `:2616`, `:2628` tragen `<modifiers>` und `<constraints>`, aber **kein** `<costs>` (Format-Doku [§7.2](../../battlescribe-data-format.md#72-entry-link-info-link-category-link): Kosten am Link **oder**, wenn er keine trägt, am Ziel). |
| **PRUW-R6** | `includeChildSelections="false"` zählt nur, was der Rahmen **unmittelbar** hält. Im Rahmen des Modells sind das ausschliesslich die Mitglieder der Gruppe „Weapon"; die Pflicht-Rüstung hängt eine Ebene **darüber** (Gruppe „Armour" an der **Einheit**) und zählt deshalb **nicht** mit. | Format-Doku [§7.6](../../battlescribe-data-format.md#76-constraint) (`false` zählt *„just `scope`'s `field`"*); Katalogstruktur: `6b9b-e957-af89-cd63` hängt an `b1b8-…` (`:2643`), nicht an `8fed-…`. |
| **PRUW-R7** | Ein katalogkonformer Ogre-Maneaters-Aufbau braucht **genau zwei** Pflichtteile: mindestens **ein Modell** (`min 1`, 80 pts) und **genau eine Rüstung** (`min 1` + `max 1`). Die Gruppe „Weapon" trägt **keine** `min`-Grenze — eine Waffe ist optional, und `defaultSelectionEntryId` greift laut Formatdoku nur bei `min > 0`. | `Dogs of War.cat:2583` (`fb53-ce3d-0b8b-cca8`, min 1, scope=parent), `:2647` (`b9c9-2eef-0ce0-4307`, min 1) + `:2646` (`2ee2-9774-5dcc-530b`, max 1); `:2586-2590` — die Gruppe „Weapon" hat nur zwei `max`-Grenzen. Format-Doku [§7.1](../../battlescribe-data-format.md#71-selection-entry--selection-entry-group) zu `defaultSelectionEntryId`. |
| **PRUW-R8** | Ein Zählerstand **grösser als 1** ist in diesem Rahmen nur durch **Überfüllen** der Gruppe erreichbar: sie trägt **zwei** inhaltlich identische `max 1`-Grenzen. Beide sind eigenständige `<constraint>`-Elemente mit eigener `id` und müssen daher **beide** feuern, wenn drei Mitglieder im Rahmen stehen (Ist 3 / Grenze 1). | `Dogs of War.cat:2588` `f353-4ad9-3691-858c` und `:2589` `1fed-7cb3-eaf7-5d17` — beide `type="max" value="1.0" field="selections" scope="parent" shared="true" includeChildSelections="false"`. |
| **PRUW-R9** | Die Wirkung dieser Zelle ist eine **Kostenänderung**, keine Grenze — sie erscheint deshalb **nicht** als eigene feuernde Limit-Id. Beobachtet wird sie über die roster-weite Budget-Regel `budget::ecfa-8486-4f6c-c249`, die bei **strikter** Überschreitung des eingestellten Punktelimits feuert (Ist = Summe, Grenze = Limit). | `field="ecfa-8486-4f6c-c249"` ist die pts-Kostenart der `.gst` (`.gst:7`); dieselbe Beobachtungstechnik in [`../parent-scope-per-model-cost/`](../parent-scope-per-model-cost/README.md) und [`../decrement-cost-bloodline-casting-dice/`](../decrement-cost-bloodline-casting-dice/README.md), Grenzfall „Summe = Limit feuert nicht" belegt in [`../orcs-and-goblins-budget/`](../orcs-and-goblins-budget/README.md). |

### Vorrechnung der Rostersummen

| Auswahl | Quelle der Kosten | Roster 01/02 | Roster 03/04 | Roster 05/06 |
|---------|-------------------|--------------|--------------|--------------|
| Einheit „Ogre Maneaters" `b1b8-…` | Eintrag, `value="0"` | 0 | 0 | 0 |
| Modell „Ogre Maneaters" `8fed-…` (`number="1"`) | Eintrag, `value="80"` | 80 | 80 | 80 |
| Light Armour (Link `868a-…` → `.gst 055f-…`) | Ziel, `value="0"`, kein Modifikator | 0 | 0 | 0 |
| Ogre club (Link `bbaf-…`) | Ziel `0`, **kein** Modifikator | 0 | — | — |
| Great Weapon (Link `d13c-…`) | Ziel `0` + `Treffer × 6` | — | 6 | 18 |
| Cathayan Longsword (Link `3d48-…`) | Ziel `0` + `Treffer × 6` | — | — | 18 |
| Brace of Handguns (Link `70ab-…`) | Ziel `0` + `Treffer × 6` | — | — | 18 |
| **Treffer im Eltern-Rahmen (Modell)** | Auswahlen vom Typ `upgrade` | **1** | **1** | **3** |
| **Summe** | | **80** | **86** | **134** |

> **Warum überall `number="1"`.** Die Zahlenbasis der `.ros` ist upstream nicht
> festgelegt (Format-Doku [§7.5](../../battlescribe-data-format.md#75-cost--cost-type) und
> [§15](../../battlescribe-data-format.md#15-lücken-der-quelle), Issue 084): ob ein
> `number` eine absolute Stückzahl oder ein Multiplikator je Eltern-Instanz ist,
> ist offen. Solange **jede** Auswahl `number="1"` trägt, fallen beide Lesarten
> zusammen und die Summen oben sind eindeutig. Ein Roster mit mehreren Modellen
> hätte diese Eindeutigkeit nicht — deshalb steht hier bewusst **ein** Modell,
> was der Katalog mit `min 1` auch erlaubt.

### Beobachtbarkeit über die Budget-Regel — die Klammern

Jeder der drei Aufbauten steht zweimal da: einmal mit Punktelimit `Summe − 1`
(das Budget **muss** mit `actual = Summe` feuern) und einmal mit `Summe + 1`
(es **muss** schweigen). Damit ist jede Summe exakt eingeklemmt:

| Fehl-Lesart der Zelle | Summe 01/02 | Summe 03/04 | Summe 05/06 | wo sie auffliegt |
|-----------------------|-------------|-------------|-------------|------------------|
| **korrekt: Treffer 1 / 1 / 3** | **80** | **86** | **134** | — |
| Wiederholung gar nicht angewendet (Modifikator inert) | 80 | 80 | 80 | 03 + 05 schweigen fälschlich |
| Wiederholung als blosse Bedingung gelesen (1 Anwendung) | 80 | 86 | 98 | 05 schweigt fälschlich |
| Träger aus dem eigenen Rahmen ausgenommen (Treffer 0 / 0 / 2) | 80 | 80 | 116 | 03 + 05 schweigen fälschlich |
| Rahmen fälschlich die **Einheit** (Treffer = 1 Light Armour) | 80 | 86 | 98 | 05 schweigt fälschlich |
| Rahmen Einheit **und** `includeChildSelections` als `true` (Treffer 4) | 80 | 92 | 152 | 04 + 06 feuern fälschlich |
| `childId` als `model` statt `upgrade` gelesen (Treffer 0) | 80 | 80 | 80 | 03 + 05 schweigen fälschlich |
| Rahmen roster-weit über alle `upgrade`-Auswahlen (Treffer 2 / 2 / 4) | 80 | 92 | 152 | 04 + 06 feuern fälschlich |

**Bewusst nicht abgrenzbar** (in der Formatdoku und den Daten begründet, nicht
durch ein erfundenes Roster kaschiert):

- **`childId="upgrade"` gegen `childId="any"`.** Der Eltern-Rahmen (das Modell)
  kann laut Katalog **ausschliesslich** Mitglieder der Gruppe „Weapon" halten,
  und die sind alle vom Typ `upgrade`. Ein Gegenbeispiel bräuchte ein Kind des
  Modells mit anderem Typ — der Katalog bietet keines. Die Abgrenzung gegen
  `childId="model"` gelingt dagegen (Zeile oben in der Tabelle).
- **Rahmen „Modell" gegen Rahmen „Gruppe".** Läse eine Engine `scope="parent"`
  als die Gruppe statt als die Eltern-Auswahl, ergäbe sich hier dieselbe Zahl,
  weil das Modell ausser der Gruppe nichts hält. Dieses Szenario grenzt den
  Rahmen nur gegen **die Einheit** ab (Zeilen oben).
- **`shared="true"` gegen `shared="false"`.** In allen Rostern steht genau eine
  Instanz jedes Verweises; die beiden Lesarten fallen zusammen.
- **`includeChildForces="false"`.** Alle Roster haben genau ein Kontingent.
- **Die Kategorie-Umschaltung der Einheit.** `b1b8-…` trägt zwei Modifikatoren
  (`set-primary category e94b-6a54-8779-cd60`, `remove category 43cc-fc3f-35a7-8d03`),
  die greifen, solange keine Auswahl der Kategorie „DOW" (`bb6b-cda8-b237-4dfd`)
  im Roster steht — in allen sechs Rostern ist das der Fall. Das ist eine
  **andere** Zelle; sie wird hier weder assertiert noch ausgeschlossen.
- **Armeeweite Aufbau-Diagnosen** (General-Pflicht `1077-7379-f142-f382`,
  Core-Mindestzahl `9636-e6ed-b522-1f4a` des Kontingents, punkteskalierende
  Kategoriegrenzen bei diesen sehr kleinen Punktelimits) dürfen zusätzlich
  auftreten; die Erwartung ist selektiv und macht darüber keine Aussage.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle sechs
referenzieren `.gst` + `Dogs of War.cat`, alle enthalten **dieselbe** Einheit mit
**einem** Modell und der Pflicht-Rüstung Light Armour; sie unterscheiden sich nur
in den gewählten Waffen und im Punktelimit.

> **Assertion-Fokus:** `actual`/`bound` der Budget-Regel
> `budget::ecfa-8486-4f6c-c249` sowie — in 05/06 — die beiden `max 1`-Grenzen der
> Gruppe „Weapon".

| # | Testtitel | Roster-Zustand | Treffer im Eltern-Rahmen | Summe | Erwartetes Ergebnis des Evaluators | Fixture |
|---|-----------|----------------|--------------------------|-------|-------------------------------------|---------|
| 01 | Grundlinie, Limit darunter | Modell + Light Armour + **Ogre club** (kein Modifikator), Limit **79**. | 1 | 80 | Budget feuert **Ist 80 / Grenze 79**. Beide Gruppen-`max 1` schweigen (ein Mitglied), Pflicht-Grenzen erfüllt. | [`01-ogre-club-baseline-over-budget.ros`](rosters/01-ogre-club-baseline-over-budget.ros) |
| 02 | Grundlinie, Limit darüber | derselbe Aufbau, Limit **81**. | 1 | 80 | Budget **absent**. Zusammen mit 01 ist die Grundlinie auf exakt 80 pts geklemmt. | [`02-ogre-club-baseline-within-budget.ros`](rosters/02-ogre-club-baseline-within-budget.ros) |
| 03 | Eine Anwendung, Limit darunter | wie 01, aber **Great Weapon** statt Ogre club, Limit **85**. | 1 | 86 | Budget feuert **Ist 86 / Grenze 85**. Die Differenz zu 01/02 ist **genau 6** — eine Anwendung. | [`03-great-weapon-one-step-over-budget.ros`](rosters/03-great-weapon-one-step-over-budget.ros) |
| 04 | Eine Anwendung, Limit darüber | derselbe Aufbau, Limit **87**. | 1 | 86 | Budget **absent**; zwei Anwendungen (92) feuerten hier fälschlich. | [`04-great-weapon-one-step-within-budget.ros`](rosters/04-great-weapon-one-step-within-budget.ros) |
| 05 | Drei Anwendungen, Limit darunter | Great Weapon **+** Cathayan Longsword **+** Brace of Handguns unter demselben Modell, Limit **133**. | 3 | 134 | Budget feuert **Ist 134 / Grenze 133**; zusätzlich feuern **beide** Gruppen-`max 1` mit **Ist 3 / Grenze 1** (`f353-4ad9-3691-858c`, `1fed-7cb3-eaf7-5d17`). Die drei Eigen-`max 1` der Waffenlinks bleiben still (je ein Exemplar). | [`05-three-weapons-three-steps-over-budget.ros`](rosters/05-three-weapons-three-steps-over-budget.ros) |
| 06 | Drei Anwendungen, Limit darüber | derselbe Aufbau, Limit **135**. | 3 | 134 | Budget **absent**; die beiden Gruppen-`max 1` feuern unverändert **Ist 3 / Grenze 1**. Zusammen mit 05 ist der Aufschlag je Waffe auf exakt 18 pts geklemmt. | [`06-three-weapons-three-steps-within-budget.ros`](rosters/06-three-weapons-three-steps-within-budget.ros) |

**Beweisführung in beide Richtungen:** 01/02 fixieren die Grundlinie **ohne**
jeden Aufschlag bei sonst identischem Aufbau; 03/04 zeigen die **einfache**
Anwendung (Treffer 1, +6); 05/06 zeigen die **wiederholte** (Treffer 3, +18 je
Waffe) — der Abstand von zwei Zählschritten zwischen 03/04 und 05/06 macht
„einmal angewendet" und „je Treffer angewendet" unverwechselbar.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Game System (rev 8) / pts-Kostenart | `6d8e-38d9-3c69-febf` / `ecfa-8486-4f6c-c249` |
| Katalog „Dogs of War" (rev 4, keine `catalogueLinks`) | `4887-12ed-22a2-f461` |
| ForceEntry „Standard " (`.gst`) | `7d9d-6c8d-4ea0-b7ad` |
| Einheit „Ogre Maneaters" (`type="unit"`, 0 pts) | `b1b8-10da-ac1a-ba7c` |
| — Modell „Ogre Maneaters" (`type="model"`, 80 pts, min 1) | `8fed-6b86-9099-db53` — `fb53-ce3d-0b8b-cca8` |
| — Gruppe „Weapon" (zwei identische max 1, Vorgabe = Ogre club) | `6a33-8be5-b0a4-5b42` — `f353-4ad9-3691-858c`, `1fed-7cb3-eaf7-5d17` |
| — — Link „Great Weapon" (Träger der gepinnten Zelle, max 1) → `.gst`-Ziel (`upgrade`, 0 pts) | `d13c-78a4-0289-7d87` — `173e-78a6-860e-2b1e` → `1eb7-3f36-8cf7-e0ba` |
| — — Link „Cathayan Longsword" (baugleiche Zelle, max 1) → Ziel (`upgrade`, 0 pts) | `3d48-775c-37e8-0dc0` — `b004-ed55-2156-385c` → `4186-0bfd-0938-69d8` |
| — — Link „Brace of Handguns" (baugleiche Zelle, max 1) → Ziel (`upgrade`, 0 pts) | `70ab-1c93-f3b5-9405` — `c5fd-d20e-73e6-0690` → `098c-580d-026b-f647` |
| — — Link „Ogre club" (**ohne** Modifikator, max 1) → Ziel (`upgrade`, 0 pts) | `bbaf-1abe-4478-62d8` — `074d-5c87-9c9f-5052` → `6192-2089-b7d5-7084` |
| — Gruppe „Armour" (min 1 / max 1, Vorgabe = Light Armour) | `6b9b-e957-af89-cd63` — `b9c9-2eef-0ce0-4307` / `2ee2-9774-5dcc-530b` |
| — — Link „Light Armour" (max 1, min 0) → `.gst`-Ziel (`upgrade`, 0 pts, eigene max 1) | `868a-ecb7-b621-41cc` — `2624-53c3-c680-aa50` / `0375-f3e2-722a-06b2` → `055f-8e4e-f170-35d2` — `6f1a-1be1-6660-d9a6` |
| — — Link „Heavy Armour" (increment 4 je `childId="model"`; hier **nicht** gewählt) | `cb9b-3946-521c-5fa0` → `dde4-0ba8-7b3c-57b7` |
| Kategorien: Special (Basis, per Modifikator entfernt) / Rare (per `set-primary`) / DOW (Bedingung) | `43cc-fc3f-35a7-8d03` / `e94b-6a54-8779-cd60` / `bb6b-cda8-b237-4dfd` |
| Budget-Grenze (Engine-Regel, roster-weit) | `budget::ecfa-8486-4f6c-c249` |
