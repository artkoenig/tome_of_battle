# E2E-Regeln & Testkatalog: `greaterThan` mit `scope="self"` (Blessed Spawning, Lizardmen)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Regeln aus den
Katalogdaten der *6th Definitive Edition* abgeleitet; das Eingabeformat der
Roster folgt der in den bestehenden Szenarien verifizierten Form (direktes
`entryId`, `entryLinkId=""`, `entryGroupId` = **Ziel-Id der Gruppe**,
verschachtelte `selections` mit `number`).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armee: `Lizardmen (6th definitive edition).cat` (`19e3-92e5-1158-4551`, rev 1)
  — Kontingent **„Standard (LM-AB)"** `8fcd-0130-a0ff-b7bc`
- Dazu `Mercenaries (6th definitive edition).cat` — der Lizardmen-Katalog
  verlangt sie per `catalogueLink` (`targetId="fc47-8392-a6c8-452a"`, Zeile 7463);
  ohne sie meldet die Datensatz-Vorbereitung eine fehlende Abhängigkeit.

## Der Mechanismus (wichtig)

Das `selectionEntry` **„Saurus Warriors"** (`2258-e16e-24dd-6e85`) trägt roh
**genau eine** Kategorie — Core, primary (`categoryLink 4e44-1ec9-460f-8c88` →
`64bf-efb4-9978-26df`). Über seinen Optionen hängt eine dreistufig
verschachtelte `modifierGroups`-Klammer. Die **äußere** Klammer ist auf
„Kroq-Gar ist **nicht** General" gegatet, die beiden **inneren** Klammern
unterscheiden sich allein in einer `scope="self"`-Zählung:

```xml
<modifierGroup>                                   <!-- äußere Klammer -->
  <conditions>
    <condition field="selections" scope="force" value="0" childId="859a-ac18-878a-600b"
               type="equalTo" includeChildSelections="true"/>   <!-- Kroq-Gar als General -->
  </conditions>
  <modifierGroups>
    <modifierGroup>                               <!-- Stufe 1: Core -> Special -->
      <conditionGroups><conditionGroup type="or"><conditionGroups>
        <conditionGroup type="and"><conditions>
          <condition field="selections" scope="force" value="0" childId="b5ff-0687-4b30-f367" type="equalTo"/>
          <condition field="selections" scope="self"  value="0" childId="bd30-a138-fa7a-ecbe"
                     type="greaterThan" includeChildSelections="false"/>
        </conditions></conditionGroup>
        <conditionGroup type="and"><conditions>
          <condition field="selections" scope="force" value="1" childId="b5ff-0687-4b30-f367" type="equalTo"/>
          <condition field="selections" scope="self"  value="1" childId="bd30-a138-fa7a-ecbe" type="greaterThan"/>
        </conditions></conditionGroup>
      </conditionGroups></conditionGroup></conditionGroups>
      <modifiers>
        <modifier type="set-primary" field="category" value="43cc-fc3f-35a7-8d03"/>   <!-- Special -->
        <modifier type="add"         field="category" value="43cc-fc3f-35a7-8d03"/>
        <modifier type="remove"      field="category" value="64bf-efb4-9978-26df"/>   <!-- Core -->
      </modifiers>
    </modifierGroup>
    <modifierGroup>                               <!-- Stufe 2: Special -> Rare -->
      <conditionGroups><conditionGroup type="and"><conditions>
        <condition field="selections" scope="force" value="0" childId="b5ff-0687-4b30-f367" type="equalTo"/>
        <condition field="selections" scope="self"  value="1" childId="bd30-a138-fa7a-ecbe" type="greaterThan"/>
      </conditions></conditionGroup></conditionGroups>
      <modifiers>
        <modifier type="set-primary" field="category" value="e94b-6a54-8779-cd60"/>   <!-- Rare -->
        <modifier type="add"         field="category" value="e94b-6a54-8779-cd60"/>
        <modifier type="remove"      field="category" value="43cc-fc3f-35a7-8d03"/>   <!-- Special -->
      </modifiers>
    </modifierGroup>
  </modifierGroups>
</modifierGroup>
```

`bd30-a138-fa7a-ecbe` ist die `selectionEntryGroup` **„Blessed Spawning
Warrios"**; sie hängt per `entryLink 08cf-e97b-2217-24d0` direkt unter der
Einheit und trägt `max 2 scope="parent"` (`1239-2402-7195-3d05`), ihre sieben
Mitglieds-Links je `max 1`. **Buildbar sind also genau die Stände 0, 1 und 2** —
und genau diese drei Stände trennen die beiden Bedingungen `>0` und `>1`.

Beobachtbar ist die Kategoriezugehörigkeit im Verletzungsbericht **nur** über
kategoriezählende Grenzen (wie im Szenario
[`remove-category-force-gate`](../remove-category-force-gate/README.md)):
gepinnt wird über die drei `scope="force"`-Zählgrenzen der `.gst`-
`categoryEntries` (Kategorie-Ziel ⇒ armeeweit gezählt, Ziel-Typ-Regel
BSData-Doku §7.7 / ADR 0029; bei Ein-Force-Listen identisch mit „pro Force")
sowie — schärfer — über die **Kategorie-Anker** des Kontingents
(`expect.capabilities`), deren `current` den Zählstand jeder Kategorie direkt
benennt. Erst der Anker macht die **Special**-Stufe positiv sichtbar: Special
max 3 feuert bei Ständen ≤ 2 nie.

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **GTS-R1** | `greaterThan` vergleicht **strikt**: bei genau dem hingeschriebenen `value` hält die Bedingung **nicht**. Bei Selbst-Zählung 0 gilt `>0` nicht, bei Selbst-Zählung 1 gilt `>1` nicht. | LM-`.cat`, `2258-e16e-24dd-6e85` → `<condition … scope="self" value="0" … type="greaterThan"/>` bzw. `value="1"`. Dass die Datenautoren strikt meinen, belegt die **Staffelung selbst**: mit einer `>=`-Lesart wären `>=0` (immer wahr) und `>=1` deckungsgleich mit `>0` — die zweistufige Klammer hätte keine unterscheidbaren Stände mehr, obwohl die Gruppe genau die drei Stände 0/1/2 zulässt. |
| **GTS-R2** | `scope="self"` zählt **im Träger der Bedingung** — hier in der einzelnen Saurus-Warriors-Auswahl —, nicht im Kontingent und nicht armeeweit. Ein Nachbarregiment wird nach **seinen eigenen** Optionen beurteilt. | BSData-Doku §7.6/§7.7: der `scope` ist der Zählrahmen; `self` benennt den Träger. Aus den Daten erzwungen: die Modifier hängen **an der Einheit** und ändern **deren** Kategorie — eine kontingentweite Zählung machte alle Regimenter gleich und die Unterscheidung sinnlos. Das `shared="true"` der Bedingung erweitert den Rahmen nicht (dieselbe Lesart wie bei `primary-catalogue`/`ancestor`, §7.6/§7.7: Zähl-Flags verengen *innerhalb* des Rahmens, sie ersetzen ihn nicht). Gepinnt durch die Roster **02** und **05**. |
| **GTS-R3** | `includeChildSelections="false"` genügt hier: die Blessed-Spawning-Auswahlen sind **direkte** Kinder der Regiments-Auswahl (Gruppenmitglieder erscheinen in der `.ros` als direkte `selection` mit `entryGroupId`), nicht verschachtelt. | LM-`.cat`, `entryLink 08cf-e97b-2217-24d0` (Gruppe direkt an der Einheit); `.ros`-Form verifiziert an bestehenden Szenarien (z. B. [`dispel-scroll-repeat-group-max`](../dispel-scroll-repeat-group-max/rosters/01-two-dispel-scrolls-effective-max-3.ros): `entryGroupId` trägt die **Ziel-Id** der Gruppe, nicht die Link-Id). |
| **GTS-R4** | **Stand 0 ⇒ Core.** Keine der beiden Klammern hält; die rohe Kategorie bleibt. | `categoryLink 4e44-1ec9-460f-8c88` → `64bf-efb4-9978-26df`, `primary="true"`; kein weiterer haltender Kategorie-Modifier (siehe „Was in diesen Rostern bewusst nicht gattert"). |
| **GTS-R5** | **Stand 1 ⇒ Special, nicht Rare.** Stufe 1 hält (`1 > 0`), Stufe 2 nicht (`1 > 1` ist falsch). Effektive Kategorien = {Special}. | Klammern oben; `add`/`set-primary` `43cc-fc3f-35a7-8d03`, `remove` `64bf-efb4-9978-26df`. |
| **GTS-R6** | **Stand 2 ⇒ Rare.** Beide Klammern halten; Stufe 2 nimmt das von Stufe 1 gesetzte Special wieder weg. Effektive Kategorien = {Rare}. | Klammern oben; Stufe 2 `add`/`set-primary` `e94b-6a54-8779-cd60`, `remove` `43cc-fc3f-35a7-8d03`. Dass Stufe 2 **nach** Stufe 1 wirkt, ist die Dokumentreihenfolge der beiden `modifierGroup`s — ihr `remove` auf Special ist nur unter dieser Reihenfolge sinnvoll (Stufe 1 hat es gerade hinzugefügt). |
| **GTS-R7** | Die `.gst`-Kategoriegrenzen bei `costLimit` 1000 (ohne Border Patrols): **Core min 2**, **Special max 3**, **Rare max 1** — die Basiswerte, keine Anhebung hält. | `.gst` `categoryEntry` `64bf-efb4-9978-26df` → constraint **`35c2-d478-392a-aeb1`** (`min 2`, `field=selections`, `scope=force`); `43cc-fc3f-35a7-8d03` → **`16f0-6e5b-55d0-4102`** (`max 3`); `e94b-6a54-8779-cd60` → **`0a44-2d3f-adfe-f3a1`** (`max 1`). Sämtliche `set`-Modifier verlangen entweder eine Border-Patrols-Selektion (`4e15-0353-165f-5528`), ein Limit < 500 oder ≥ 2000 — bei 1000 pts ohne Border Patrols hält **keiner**. |
| **GTS-R8** | Derselbe Bau wiederholt sich an **„Temple Guard"** (`e235-3d94-2bdc-6a1a`) mit denselben `childId`/`value`-Paaren — dort zusätzlich eine `equalTo 2`-Bedingung auf dieselbe Gruppe. Das Szenario pinnt die Regel bewusst an **einem** Träger. | LM-`.cat`, Zeilen 1401–1449: `scope="self" childId="bd30-a138-fa7a-ecbe"` mit `greaterThan 0`, `greaterThan 1` und `equalTo 2`. Nur Korroboration, kein eigener Testfall. |
| **GTS-R9** | Der `<categories>`-Block einer `.ros`-Selektion ist ein **denormalisierter Snapshot** — nicht die Wahrheit. Alle fünf Roster notieren bewusst den **rohen** Core-Link, auch bei Regimentern, die effektiv Special oder Rare sind. | ADR 0011 (Katalog ist SSOT für abgeleitete Daten); BSData-Doku §8 („**Sämtliche** kategorie-abhängige Logik muss die **effektiven** … Kategorie-Links auswerten, nicht die rohen"). |

**Bewusst nicht als feuernde Grenze erwartet:** Kategoriezugehörigkeit selbst,
das `primary`-Flag der `set-primary`-Modifier (UI-Einsortierung) und der
Anzeige-Bucket sind **keine** zählenden Schranken und tauchen im
Verletzungsbericht nicht auf. Ebenso wenig die `hidden`-Gatter der Gruppe
(`set hidden=true`, wenn Lord Mazdamundi `cac7-06e3-24a5-7655` im Kontingent
steht bzw. das Kontingent „Southlands" ist) — Verfügbarkeit ist kein
Verletzungsbericht. Beides wird hier über die kategoriezählenden Grenzen und
die Kategorie-Anker mittelbar gepinnt.

### Was in diesen Rostern bewusst *nicht* gattert

| Gatter | Bedingung | Warum es hier nicht hält |
|--------|-----------|--------------------------|
| Äußere Klammer „Sacred Hosts ohne Kroq-Gar" | `equalTo 0` auf `859a-ac18-878a-600b` (Kroq-Gars „General"-Aufwertung), `scope=force` | Kein Kroq-Gar im Roster ⇒ Zähler 0 ⇒ die Klammer **hält** (das ist der gewünschte Zweig). |
| Zweite Top-Level-Klammer „Sacred Hosts + Kroq-Gar" | `equalTo 1` auf `859a-…` | Zähler 0 ≠ 1 ⇒ hält nicht. |
| Beide inneren Klammern, Force-Hälfte | `equalTo 0` auf `b5ff-0687-4b30-f367` („Sacred Host of the Gods") | Nicht im Roster ⇒ Zähler 0 ⇒ die `equalTo 0`-Hälfte **hält**; die `equalTo 1`-Alternative der Stufe 1 hält nicht. |
| Dritte Top-Level-Klammer | `instanceOf` auf `fe15-38b7-daea-2ec8` („Southlands (LM-AB)") | Alle Roster nutzen **„Standard (LM-AB)"** `8fcd-0130-a0ff-b7bc`. Sonst würde Saurus Warriors unbedingt nach Special geschoben und die Selbst-Zählung wäre nicht mehr beobachtbar. |
| `add category 6ad6-f54e-1867-00a7` („Border Patrols") an der Einheit | ≥ 10 Modelle **und** ≥ 1 „Border Patrols rules" `4e15-0353-165f-5528` im Roster | Keine Border-Patrols-Selektion ⇒ hält nicht (und hielte sie, wären auch die `.gst`-Punkte-Brackets andere). |
| `set hidden=true` an Gruppe/Link | Lord Mazdamundi `cac7-06e3-24a5-7655` bzw. Kontingent „Southlands" | Beides nicht im Roster ⇒ Gruppe sichtbar, `max 2` (`1239-2402-7195-3d05`) bleibt 2. |
| `set 1` auf `30d8-59b7-0761-13b5` (Gruppen-`min`) | Mazdamundi < 1 **und** „Sacred Host of the Gods" ≥ 1 | „Sacred Host of the Gods" fehlt ⇒ `min` bleibt 0, die Gruppe ist optional. |

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle fünf
referenzieren `.gst` + Lizardmen-`.cat` + die per `catalogueLink` benötigte
`Mercenaries`-`.cat`, setzen `costLimit` **1000 pts** und enthalten **zwei**
Saurus-Warriors-Regimenter mit identischer Pflichtausstattung — 10 Modelle
(`5005-7199-18bd-22ca`, min 10, 12 pts), Hand Weapon (`abdb-bbd0-41b2-5dff`,
min 1 an der `.gst`-Definition), Shield (`50e2-1873-a856-03e7`, min 1 am Link
`f11f-b61d-fb7d-720a`) und Scaly Skin (6+) (`2481-9ff2-5fe7-f381`, min 1).
Einziger Unterschied zwischen den Fällen ist die **Anzahl der
Blessed-Spawning-Optionen je Regiment**.

> **Assertion-Fokus:** die drei `.gst`-Kategorie-Grenzen, die Gruppen-Obergrenze
> `1239-…` und die drei Kategorie-Anker des Kontingents. Andere
> Armeeaufbau-Diagnosen — insbesondere die General-Pflicht (`.gst`
> `categoryEntry "General"` `a37e-7207-de6d-acb0`, min 1
> `1077-7379-f142-f382`; keines dieser Roster führt einen Charakter) — können
> zusätzlich auftreten und sind hier ohne Belang.

| # | Testtitel | Regiment A / B | Selbst-Zählung `bd30-…` | Effektive Kategorien | Erwartetes Ergebnis des Evaluators | Fixture |
|---|-----------|----------------|--------------------------|----------------------|-------------------------------------|---------|
| 01 | Keine Option ⇒ beide bleiben Core | – / – | 0 / 0 | Core / Core | **Keine** der drei Grenzen feuert. Anker: Core 2 (min 2), Special 0, Rare 0. *Wäre `greaterThan` als `>=` gelesen, wären beide Special und Core min 2 feuerte mit Ist 0.* | [`01-two-regiments-no-spawning-core.ros`](rosters/01-two-regiments-no-spawning-core.ros) |
| 02 | Eine Option nur bei A ⇒ A Special, B Core | Tzunki / – | 1 / 0 | Special / Core | **Core min 2 feuert mit Ist 1**, Grenze 2. Special (Anker 1) ≤ 3 und Rare (Anker 0) ≤ 1 stumm. *Der Ist-Wert **1** ist die Aussage: kontingentweite Zählung ergäbe Ist 0.* | [`02-one-regiment-one-spawning-special.ros`](rosters/02-one-regiment-one-spawning-special.ros) |
| 03 | Je eine Option ⇒ beide Special, keines Rare | Tzunki / Tzunki | 1 / 1 | Special / Special | **Core min 2 feuert mit Ist 0.** Special-Anker 2 ≤ 3, **Rare-Anker 0** ⇒ `0a44-…` bleibt stumm. *Genau das verbietet die `>1`-Bedingung beim Stand 1 — und eine kontingentweite Zählung (jeder sähe 2) ebenso.* | [`03-two-regiments-one-spawning-each-special.ros`](rosters/03-two-regiments-one-spawning-each-special.ros) |
| 04 | Je zwei Optionen ⇒ beide Rare | Tzunki+Tlazcotl / Tzunki+Tlazcotl | 2 / 2 | Rare / Rare | **Rare max 1 feuert mit Ist 2**, **Core min 2 feuert mit Ist 0**; Special-Anker **0** ⇒ `16f0-…` stumm (Stufe 2 hat Special wieder entfernt). Gruppen-Obergrenze `1239-…` mit Ist 2 = Grenze 2 eingehalten. | [`04-two-regiments-two-spawnings-each-rare.ros`](rosters/04-two-regiments-two-spawnings-each-rare.ros) |
| 05 | Zwei Optionen nur bei A ⇒ A Rare, B Core | Tzunki+Tlazcotl / – | 2 / 0 | Rare / Core | **Core min 2 feuert mit Ist 1**; Rare-Anker **1** ≤ 1 ⇒ `0a44-…` stumm; Special-Anker 0. *Nachbarschaftsprobe der zweiten Stufe: kontingentweite Zählung machte auch B zu Rare (Ist 2 ⇒ `0a44-…` feuerte, Core-Ist 0).* | [`05-only-one-regiment-two-spawnings-rare.ros`](rosters/05-only-one-regiment-two-spawnings-rare.ros) |

**Warum das Fallpaar 01/03 die Striktheit einklemmt:** 01 verbietet, dass `>0`
beim Stand **0** hält (sonst Core-Ist 0 statt 2), 03 verbietet, dass `>1` beim
Stand **1** hält (sonst Rare-Ist 2 ⇒ `0a44-…` feuerte). 04 zeigt die
Gegenrichtung — beim Stand **2** halten beide. Damit ist die Grenze zwischen
„hält" und „hält nicht" von beiden Seiten festgenagelt.

**Warum die Rosterpaare 02/03 und 04/05 den Rahmen einklemmen:** Bei jedem Paar
ist die Summe im Kontingent gleich verteilt (02: 1, 03: 2 · 05: 2, 04: 4), die
Verteilung **auf die Träger** aber verschieden. Nur eine Zählung *im Träger*
liefert die vier verschiedenen Anker-Bilder; jede kontingentweite Zählung ließe
02 wie 03 und 05 wie 04 aussehen.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Kontingent „Standard (LM-AB)" (Anker-`frameDefId`) | `8fcd-0130-a0ff-b7bc` |
| Kontingent „Southlands (LM-AB)" (bewusst **nicht** benutzt) | `fe15-38b7-daea-2ec8` |
| Saurus Warriors (Träger der `modifierGroups`) | `2258-e16e-24dd-6e85` |
| Roher Kategorie-Link Core an Saurus Warriors (primary) | `4e44-1ec9-460f-8c88` → `64bf-efb4-9978-26df` |
| Gruppe „Blessed Spawning Warrios" (`childId` der Selbst-Zählung) | `bd30-a138-fa7a-ecbe` — constraint `1239-2402-7195-3d05` (max 2, scope=parent) |
| `entryLink` der Gruppe an der Einheit | `08cf-e97b-2217-24d0` — constraint `30d8-59b7-0761-13b5` (min 0) |
| Blessed Spawning of Tzunki, the Water God (10 pts) | `5dcd-c767-b2a6-5ff4` — Link `a347-553a-afa1-d025` (max 1: `39f3-95a3-e3a5-8707`) |
| Blessed Spawning of Tlazcotl, the Impassive (20 pts) | `31c1-f8e7-c99d-90cc` — Link `51c7-4aa0-0f5c-bb0c` (max 1: `41bb-7e6c-ed5a-1379`) |
| Saurus-Warrior-Modell (min 10 je Regiment, 12 pts) | `5005-7199-18bd-22ca` — constraint `e39d-7db5-eef6-c332` |
| Gruppe „Weapons and Armour" (Hand Weapon / Shield) | `be2a-754f-1943-edaa` |
| Hand Weapon (Pflicht min 1, `.gst`) | `abdb-bbd0-41b2-5dff` — Link `d534-9465-25dd-bcc0`, constraint `bdef-ba9b-d6ce-5b14` |
| Shield (Pflicht min 1 am Link) | `50e2-1873-a856-03e7` — Link `f11f-b61d-fb7d-720a`, constraint `abfd-b45c-ec35-9243` |
| Scaly Skin (6+) (Pflicht min 1) | `2481-9ff2-5fe7-f381` — Link `e899-01e5-cba3-601f`, constraint `1516-cfea-82c2-3181` |
| Kategorie „Core" (`.gst`) | `64bf-efb4-9978-26df` — constraint `35c2-d478-392a-aeb1` (min 2, scope=force) |
| Kategorie „Special" (`.gst`) | `43cc-fc3f-35a7-8d03` — constraint `16f0-6e5b-55d0-4102` (max 3, scope=force) |
| Kategorie „Rare" (`.gst`) | `e94b-6a54-8779-cd60` — constraint `0a44-2d3f-adfe-f3a1` (max 1, scope=force) |
| Kroq-Gars „General"-Aufwertung (äußeres Gatter) | `859a-ac18-878a-600b` |
| „Sacred Host of the Gods" (Force-Hälfte beider Klammern) | `b5ff-0687-4b30-f367` |
| Lord Mazdamundi (`hidden`-Gatter der Gruppe) | `cac7-06e3-24a5-7655` |
| „Border Patrols rules" (Punkte-Brackets der `.gst`) | `4e15-0353-165f-5528` |
| Temple Guard (Korroboration desselben Baus) | `e235-3d94-2bdc-6a1a` |
| pts-Kostenart (`costLimit`-`typeId`) | `ecfa-8486-4f6c-c249` |
| Mercenaries-Katalog (per `catalogueLink` verlangt) | `fc47-8392-a6c8-452a` |
