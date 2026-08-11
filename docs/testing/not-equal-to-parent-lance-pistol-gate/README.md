# E2E-Regeln & Testkatalog: `notEqualTo` mit `scope="parent"` — das Pistolen-Gatter der Lanze

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln, IDs,
Zählstände und Erwartungswerte sind **ausschließlich aus den Katalogdaten** der
*6th Definitive Edition* und aus
[`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md) (§3.4,
§7.2, §7.5, §7.6, §7.7) **abgeleitet**. Die Roster-Form folgt den bereits
verifizierten Szenarien (direktes `entryId` bzw. `entryId` + `entryLinkId`,
`entryGroupId` für Gruppenmitglieder, verschachtelte `selections` mit `number`).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armeebuch: `The Empire (6th definitive edition).cat` (`3938-8369-a300-4a03`,
  rev 1) — Kontingent **„Standard (EM-AB)"** `e821-88b8-2071-6b6a`
  (`.cat:15372`)
- Söldner-Bibliothek: `Mercenaries (6th definitive edition).cat`
  (`fc47-8392-a6c8-452a`, `library="true"`) — **nicht** Fundort der geprüften
  Zelle, aber die einzige `catalogueLink`-Abhängigkeit, die das Armeebuch
  deklariert (`<catalogueLink … id="7773-ecbb-5fb9-eb56"
  targetId="fc47-8392-a6c8-452a"/>`) und deshalb Teil des Datensatzes.
- Geprüfte Einheit: **„Knights of the Knightly Orders"** `1d77-9e6e-a6ab-573f`
  (`.cat:1872`, Wurzel-`selectionEntry`, Kategorie *Core*)

## Worum es geht

`notEqualTo` ist **nicht** die „Option fehlt"-Hälfte eines Gatters — das ist
`lessThan` (siehe [`less-than-parent-parry-save`](../less-than-parent-parry-save/README.md)).
Eine `<condition type="notEqualTo" value="1" …>` hält bei **jedem** Zählstand
außer genau 1: bei **0** ebenso wie bei **2 oder mehr**. Beide Vergleiche stehen
gleichberechtigt in der Vergleichsliste der Condition
([§7.7](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat));
unterscheidbar werden sie erst **oberhalb** des Vergleichswerts.

Genau diese Stelle modelliert The Empire an der Lanze der Ritterorden: der
Ritter **behält** seine Pflicht-Lanze, wenn seine Signature Weapon **genau eine**
Pistole ist, und **verliert** sie, sobald die Signature Weapon etwas anderes ist
— oder eben nicht genau eine Pistole. Der Katalogautor schreibt die Absicht
selbst hin, als `rule` am Pistolen-Verweis (`.cat:13367-13369`):

```xml
<rule name="Not replace lance" id="45a3-03e9-e611-9a98" hidden="false">
  <description>The pistol does not replace the Lance</description>
</rule>
```

Der Kern, wörtlich aus `The Empire (6th definitive edition).cat:2307-2340`:

```xml
<entryLink import="true" name="Lance" hidden="false" id="e082-13b2-e746-34e0"
           collective="false" targetId="8649-8ac8-5a6f-fd8d" type="selectionEntry">
  <constraints>
    <constraint type="max" value="1" field="selections" scope="parent" shared="true"
                id="128a-6411-f218-72fc" includeChildSelections="false"/>
    <constraint type="min" value="1" field="selections" scope="parent" shared="false"
                id="f0ce-7b2e-0be1-9dd1" includeChildSelections="false"/>
  </constraints>
  <modifierGroups>
    <modifierGroup type="and">
      <modifiers>
        <modifier type="set" value="0" field="f0ce-7b2e-0be1-9dd1"/>
        <modifier type="set" value="0" field="128a-6411-f218-72fc"/>
      </modifiers>
      <conditionGroups>
        <conditionGroup type="and">
          <conditions>
            <condition type="atLeast"    value="1" field="selections" scope="parent"
                       childId="5191-89ca-822d-60e5" shared="true" includeChildSelections="true"/>
            <condition type="notEqualTo" value="1" field="selections" scope="parent"
                       childId="44f9-f44d-d693-84f8" shared="true" includeChildSelections="true"/>
          </conditions>
        </conditionGroup>
      </conditionGroups>
    </modifierGroup>
    <modifierGroup type="and">
      <modifiers>
        <modifier type="set" value="1" field="f0ce-7b2e-0be1-9dd1"/>
        <modifier type="set" value="1" field="128a-6411-f218-72fc"/>
      </modifiers>
      <conditionGroups>
        <conditionGroup type="and">
          <conditions>
            <condition type="equalTo" value="1" field="selections" scope="parent"
                       childId="44f9-f44d-d693-84f8" shared="true" includeChildSelections="true"/>
          </conditions>
        </conditionGroup>
      </conditionGroups>
    </modifierGroup>
  </modifierGroups>
  …
</entryLink>
```

### Der getestete Ausschnitt des Katalogs

```
selectionEntry "Knights of the Knightly Orders" (1d77-9e6e-a6ab-573f, type=unit, Core)   .cat:1872
 ├ selectionEntry "Knight" (7b8d-8405-0e74-9f46, model, 23 pts)   min 5 (24bb) / max -1 (9941)
 ├ entryLink "Empire Warhorse" (aaf2-8dbc-b925-fac5)              min 1 (22cd) / max 1 (ae52)
 ├ selectionEntryGroup "Weapons and Armour" (f1bb-0dde-c39a-d0e1)  KEINE eigenen Grenzen
 │    ├ entryLink "Shield"            9ccc-…  min 1 (1e3a) / max 1 (58c4)
 │    ├ entryLink "Lance"             e082-…  min 1 (f0ce) / max 1 (128a)   ← SUBJEKT
 │    ├ entryLink "Hand Weapon"       d2a3-…  min 1 (50ac) / max 1 (9368)
 │    ├ entryLink "Full Plate Armour" 8757-…  min 1 (8d09) / max 1 (e635)
 │    └ entryLink "Cavalry hammer "   9a71-…  hidden, min 0 (f78b) / max 1 (dff9)
 └ selectionEntryGroup "Knightly Order" (06b5-8412-53d1-49ac)   max 1 self (7944) / min 0 parent (21ca)
      └ entryLink "Custom Knightly Order (WD#310(UK)" (e628-04ab-0a07-b37c)
           → selectionEntry 0bd1-8b50-44e0-6fc7 (upgrade, hidden="true", max 2 parent 9ff4)
                └ selectionEntry "Knightly advantages" (e82b-32bf-6032-2d30, max 1 parent 5f81)
                     └ entryLink "Signature Weapon" (5191-89ca-822d-60e5, type=selectionEntryGroup)
                          → selectionEntryGroup 7195-9f86-b364-0a4f   max 1 parent (ecdd)
                               ├ entryLink "Cavalry hammer " 5686-…
                               ├ entryLink "Flail"           2fbc-…  max 1 (1578)
                               ├ entryLink "Great Weapon"    e667-…  max 1 (8126)
                               ├ entryLink "Morning Star"    b96a-…  max 1 (1580)
                               └ entryLink "Pistol"          fdd1-…  max 1 (dbff)   ← ZÄHLZIEL
                                    → selectionEntry 44f9-f44d-d693-84f8 (.gst:1086, keine Grenzen)
```

Im Roster erscheinen Gruppen **nicht** als eigene Auswahl; die
Gruppenzugehörigkeit steht im `entryGroupId`. Die Lanze ist damit ein direktes
Kind der Einheiten-Auswahl, die Pistole hängt zwei Ebenen tiefer (Order →
Knightly advantages).

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **NEQ-R1** | **`notEqualTo 1` hält bei jedem Zählstand außer genau 1** — bei 0 **und** bei 2 oder mehr. Es ist keine „kleiner als"-Prüfung; die beiden Lesarten fallen erst oberhalb des Vergleichswerts auseinander. | `.cat:2322`: `<condition type="notEqualTo" value="1" field="selections" scope="parent" childId="44f9-f44d-d693-84f8" shared="true" includeChildSelections="true"/>`. `notEqualTo` steht als eigener Vergleich neben `lessThan` in [§7.7](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat); die Wortbedeutung ist die einzige Lesart, die der Katalog anbietet. Roster **04/05** (Zählstand 2) sind der Fall, den `lessThan` **nicht** trifft. |
| **NEQ-R2** | **Der Bezugsrahmen ist die Elternauswahl des Verweisträgers — die Einheit.** Der `entryLink` „Lance" hängt in der grenzenlosen Gruppe „Weapons and Armour" unter der Einheit; deren Auswahl ist im Roster die Elternauswahl. Gezählt wird also der Pistolenbestand **dieses Regiments**, nicht des Kontingents und nicht der Roster. | `scope="parent"` an allen vier Bedingungen (`.cat:2321`, `2322`, `2335`) und an beiden Grenzen (`.cat:2309-2310`). `scope="parent"` vergleicht dabei aufgelöste **Ziel-Ids**, nicht `entryLinkId`s ([§3.4](../../battlescribe-data-format.md#34-kontext-threading) / [§7.6](../../battlescribe-data-format.md#76-constraint)) — das Roster trägt die Ziel-Id im `entryId`. `shared="true"` verengt oder weitet einen so bestimmten Rahmen nicht (gleiche Lesart wie in [`less-than-id-scope-white-wolf-hammer`](../less-than-id-scope-white-wolf-hammer/README.md), Roster 05, und [`unit-scope-repeat-knight-markup`](../unit-scope-repeat-knight-markup/README.md), USRK-R3). **Roster 07** macht den Unterschied messbar. |
| **NEQ-R3** | **`includeChildSelections="true"` reicht die Zählung bis unter die Order-Kette.** Die Pistole hängt nicht direkt unter der Einheit, sondern unter „Custom Knightly Order" → „Knightly advantages". Ohne die Ausweitung könnte die Bedingung sie nie sehen — und beide `modifierGroup`s wären tote Daten. | `.cat:2321-2322` (`includeChildSelections="true"` an beiden Bedingungen) gegen die Verschachtelung `.cat:2183` → `.cat:11803` → `.cat:11805` → `.cat:11857`. Zur Bedeutung des Flags [§7.7](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat). |
| **NEQ-R4** | **Die `and`-Klammer hat zwei Glieder.** Der `set 0` auf **beide** Lanzen-Grenzen greift nur, wenn **zusätzlich** mindestens eine Signature-Weapon-Auswahl im Rahmen steht. Ist gar keine Signature Weapon gewählt, hält die `notEqualTo`-Hälfte zwar (Zählstand 0), die Klammer aber nicht — die geschriebenen Grenzen `min 1` / `max 1` bleiben stehen. | `.cat:2318-2325`: `conditionGroup type="and"` mit `atLeast 1 childId="5191-89ca-822d-60e5"` **und** der `notEqualTo`-Bedingung. Eine `and`-Gruppe hält nur, wenn **alle** Mitglieder halten ([§7.7](../../battlescribe-data-format.md#conditiongroup--verknüpfung-mehrerer-bedingungen)). **Roster 06** gegen **Roster 03**. |
| **NEQ-R5** | **`childId="5191-89ca-822d-60e5"` benennt den Verweis auf die Gruppe „Signature Weapon", gezählt werden deren Mitglieder.** Ein `selectionEntryGroup` erscheint im Roster nie selbst als Auswahl; die einzige Lesart, unter der die Bedingung je hält, ist „mindestens eine Auswahl **aus** dieser Gruppe". | `.cat:11857`: `<entryLink … id="5191-89ca-822d-60e5" type="selectionEntryGroup" targetId="7195-9f86-b364-0a4f"/>`. Die Auflösung über die Ziel-Id ist die Regel aus [§3.4](../../battlescribe-data-format.md#34-kontext-threading); die Gruppe selbst ist kein Roster-Knoten ([§7.1](../../battlescribe-data-format.md#71-selection-entry--selection-entry-group)), ihre Mitglieder tragen sie im `entryGroupId`. |
| **NEQ-R6** | **Der zweite `modifierGroup` setzt beide Grenzen auf ihren geschriebenen Wert zurück** — `equalTo 1` desselben Pistolen-Ziels, ebenfalls `scope="parent"`. Bei genau einer Pistole ist er wirkungsgleich mit „keine Änderung"; er ist die ausdrückliche Ausnahme, die die Autorenregel `45a3-03e9-e611-9a98` beschreibt. | `.cat:2327-2339` (`set 1` auf `f0ce-…` und `128a-…`, Bedingung `.cat:2335`) gegen die geschriebenen Werte `.cat:2309-2310` (je `value="1"`). Beide Klammern schließen sich gegenseitig aus (`notEqualTo 1` und `equalTo 1` können nie zugleich halten) — die Reihenfolge der Anwendung ist deshalb in **keinem** Roster dieses Szenarios beobachtbar und wird nicht behauptet. |
| **NEQ-R7** | **Kein weiterer Modifikator rührt die beiden Grenzen an**, solange weder „Knights of the White Wolf" `9f9b-5a33-9c07-93e6` im Rahmen steht noch das Kontingent `d2eb-6fe3-7349-f03d` ist. Beide Auslöser fehlen in **allen** Rostern; die Lanze ist deshalb auch nie ausgeblendet. | `.cat:2341-2357`: `set hidden="true"` (Bedingung `atLeast 1` White Wolf, `.cat:2344`) und `set 0` auf `f0ce-…` (Bedingung `or`: `instanceOf` Kontingent `d2eb-…` **oder** White Wolf, `.cat:2351-2352`). Das gewählte Kontingent ist `e821-88b8-2071-6b6a`; der White Wolf `32c2-bfbe-88b1-8425`/`9f9b-…` ist in keinem Roster gewählt. |
| **NEQ-R8** | **Zwei Pistolen im Rahmen der Einheit sind nur über `number="2"` an einer Auswahl erreichbar** — und reißen dabei zwangsläufig zwei Hoechstmaße. Der Katalog bietet unter dieser Einheit **genau einen** Weg zu einer Pistole (die Gruppe „Signature Weapon"), und diese Gruppe erlaubt `max 1`. | Pistolen-Vorkommen im Rahmen: nur `entryLink fdd1-053d-3b57-76ca` (`.cat:13365`, `max 1` **`dbff-c6e9-ba8a-4a3c`**, `.cat:13372`) innerhalb der Gruppe `7195-…` (`max 1` **`ecdd-8e84-6a0e-c90b`**, `.cat:13384`); die Gruppe „Weapons and Armour" der Einheit führt keine Pistole (`.cat:2283-2389`). Ein zweites „Knightly advantages" verböte `5f81-d4a6-b74f-6fc3` (`max 1`), ein zweiter Knightly Order `7944-27db-49ec-7bbd` (`max 1`). Dass ein `number > 1` ein Zählstand von 2 ist, steht in [§7.5](../../battlescribe-data-format.md#75-cost--cost-type) und ist an [`dispel-scroll-repeat-group-max`](../dispel-scroll-repeat-group-max/README.md) (zwei Dispel Scrolls per `number="2"`) verifiziert. |
| **NEQ-R9** | **Die Order-Kette ist roh verborgen und wird über den `.gst`-Schalter aufgedeckt.** Deshalb trägt jedes Roster „Allow experimental rules?" mit dem Unterpunkt „…from White-Dwarf and Citadel Journal issues" (beide 0 pts). Sichtbarkeit ist dabei **keine** zählende Schranke — behauptet wird darüber nur `isHidden` am Lanzen-Slot. | `selectionEntry 0bd1-8b50-44e0-6fc7` (`hidden="true"`, `.cat:11803`) → `modifier set hidden="false"` mit `condition atLeast 1 scope="force" childId="cc03-e8fe-c143-6863"` (`.cat:11937-11943`). `cc03-…` ist Kind des `.gst`-Schalters `8b76-92c4-23f9-54b1` (`.gst:1836/1878`), in The Empire per `entryLink 2961-128d-196e-c6c6` wählbar (`.cat:15812`); dessen `min 0` **`30c1-0e8a-ca51-3eee`** wird per `set 1` zur Pflicht, sobald `e628-…` im Kontingent steht (`.cat:15833`) — der Schalter ist also ohnehin Pflicht, sobald die Order gewählt ist. |
| **NEQ-R10** | **Die force-skopierte Obergrenze der Einheit ist im Standard-Kontingent aufgehoben** und darf in keinem Roster feuern (roh `max 0`, per `set -1` aufgehoben für jedes Kontingent außer „Emperor's Guard"). | `.cat:2393`: constraint **`2943-aa1c-4532-4fb2`** (`max 0`, `scope="force"`, mit `message`) → `.cat:2130-2134`: `modifier set -1` mit `condition notInstanceOf scope="force" childId="9d76-5d25-ce1d-1d12"`. Die Roster nutzen `e821-88b8-2071-6b6a` ≠ `9d76-…`. Gleiche Ableitung wie [`unit-scope-repeat-knight-markup`](../unit-scope-repeat-knight-markup/README.md), USRK-R9. |
| **NEQ-R11** | **Beobachtbar ist die Zelle auf zwei Wegen:** über die **feuernden Grenzen** `f0ce-…` / `128a-…` und über den **Slot-Stand** der Lanze (`effectiveMin`/`effectiveMax`), der die verschobenen Grenzen auch dort zeigt, wo nichts feuert. Die Bedingung selbst ist kein Berichtsgegenstand. | Der Verletzungsbericht kodiert zählende Grenzen; die Slot-Projektion trägt `effectiveMin`/`effectiveMax` (Manifest-Vertrag, `expect.capabilities`) — dieselbe Kombination wie in [`less-than-id-scope-white-wolf-hammer`](../less-than-id-scope-white-wolf-hammer/README.md). |

### Die Wahrheitstafel der Zelle

Rahmen ist stets die Einheiten-Auswahl `1d77-…`. „SigW" = Zahl der Auswahlen aus
der Gruppe `7195-…` im Rahmen, „Pistol" = Zählstand von `44f9-…` im Rahmen.

| Roster | SigW | Pistol | `atLeast 1` (5191) | **`notEqualTo 1` (44f9)** | `equalTo 1` (44f9) | ⇒ `f0ce` (min) | ⇒ `128a` (max) |
|--------|-----:|-------:|--------------------|---------------------------|--------------------|---------------:|---------------:|
| 01 / 02 | 1 (Pistol) | **1** | hält | **hält nicht** | hält | **1** | **1** |
| 03 / 07 | 1 (Great Weapon) | **0** | hält | **hält** | hält nicht | **0** | **0** |
| 04 / 05 | 1 (Pistol ×2) | **2** | hält | **hält** | hält nicht | **0** | **0** |
| 06 | 0 | **0** | hält nicht | hält | hält nicht | **1** | **1** |

**Der Punkt des Szenarios ist die dritte Zeile.** Läse die Auswertung
`notEqualTo` als `lessThan`, stünden dort dieselben Werte wie in Zeile 1 — und
Roster 04 müsste `f0ce-7b2e-0be1-9dd1` mit Ist 0 / Grenze 1 melden (wie Roster
02 es tut), Roster 05 dürfte `128a-6411-f218-72fc` nicht melden. Beide Fälle
brechen dann.

### Warum jedes Roster genau so gebaut ist

| Auswahl | Grund |
|---------|-------|
| 5 × „Knight" | `min 5` **`24bb-871e-6aa3-e4b5`** (`.cat:2031`, `shared="false"`); die Obergrenze ist `-1` = unbegrenzt (**`9941-5a64-0bde-add3`**, `.cat:2032`; der einzige `set 25` hängt an „Border Patrols rules" `4e15-…`, die in keinem Roster steht). |
| Shield, Hand Weapon, Full Plate Armour, Empire Warhorse | Je `min 1` (**`1e3a-4402-70e8-2b08`**, **`50ac-f86f-cfa1-d050`**, **`8d09-7d84-af64-cb83`**, **`22cd-67c5-1c2c-2266`**); alle 0 pts. Ohne sie käme Rauschen aus unerfüllten Pflichten dazu, das mit der geprüften Zelle nichts zu tun hat. |
| „Allow experimental rules?" + Unterpunkt | NEQ-R9: sonst bliebe die Order-Kette verborgen. |
| Kontingent „Standard (EM-AB)" | NEQ-R7 und NEQ-R10: es ist weder `d2eb-…` (setzte die Lanzen-Pflicht selbst auf 0) noch `6b0d-…` (verbärge den Order-Verweis, `.cat:2190-2194`) noch `d1ca-…`/`d2eb-…` (verbärgen die Einheit, `.cat:2144-2153`) noch `9d76-…` (ließe `2943-…` bei `max 0`) noch `802e-…` (hübe `21ca-…` auf `min 1`). |
| Punktelimit 2000 | Die Summen liegen zwischen ~125 und ~215 pts (5 × 23 Ritter, Pistolen-Aufschlag 2 pts je Ritter über `repeat scope="unit"`, `.cat:13375-13379`; Elector Count 80 + Pistole 10). Das Budget kann damit nicht feuern und stört die Aussage nicht. |

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle laufen
gegen **denselben** Datensatz (`.gst` + The-Empire-`.cat` + Mercenaries-`.cat`)
und dasselbe Kontingent „Standard (EM-AB)".

> **Assertion-Fokus:** die beiden gegateten Grenzen `f0ce-7b2e-0be1-9dd1`
> (min) und `128a-6411-f218-72fc` (max) — feuernd bzw. abwesend —, der
> Slot-Stand der Lanze (`current`, `effectiveMin`, `effectiveMax`, `isHidden`)
> und die Zählstände der auslösenden Auswahlen. Andere Armeeaufbau-Diagnosen
> (General-Pflicht `1077-7379-f142-f382`, punkteskalierte Core-Pflicht
> `35c2-d478-392a-aeb1`, Kategorie-Slots) dürfen zusätzlich auftreten und sind
> hier ohne Belang; die Erwartung ist laut Runner-Vertrag **selektiv**.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | **Genau eine Pistole, Lanze gewählt** (legal) | Volle Pflichtausrüstung **mit** Lanze, Signature Weapon = **1 × Pistol**. | Die Lanze bleibt **Pflicht und auf eins gedeckelt** (min 1 / max 1) und ist gewählt — **nichts** feuert. Das ist die Regel „The pistol does not replace the Lance" in Zahlen. | [`01-pistol-count-1-lance-present.ros`](rosters/01-pistol-count-1-lance-present.ros) |
| 02 | **Genau eine Pistole, Lanze fehlt** (unzulässig) | Wie 01, **ohne** Lanze. | **Verletzung:** die Lanzen-Pflicht `f0ce-…` ist unerfüllt (**Ist 0 / Grenze 1**). Positive Kontrolle: die Pflicht *wird* bewertet — ihr Schweigen in 03/04 ist also kein Nicht-Bewerten. | [`02-pistol-count-1-lance-missing.ros`](rosters/02-pistol-count-1-lance-missing.ros) |
| 03 | **Signature Weapon ist keine Pistole** (Zählstand 0) | Wie 02, aber Signature Weapon = **Great Weapon**. | Beide Lanzen-Grenzen fallen auf **0**: die Lanze ist **nicht mehr Pflicht** und **nicht mehr erlaubt**. Ohne Lanze feuert **nichts** — obwohl derselbe Aufbau in 02 meldet. | [`03-signature-weapon-not-pistol-count-0.ros`](rosters/03-signature-weapon-not-pistol-count-0.ros) |
| 04 | **Zwei Pistolen** (Zählstand 2) — **das Herzstück** | Wie 02, Pistol mit `number="2"`, keine Lanze. | Beide Lanzen-Grenzen fallen **wieder** auf 0, obwohl der Zählstand **über** 1 liegt: `f0ce-…` und `128a-…` schweigen. Zusätzlich feuern die beiden Pistolen-Höchstmaße `ecdd-…` und `dbff-…` mit **Ist 2 / Grenze 1** (NEQ-R8). Unter der Lesart „kleiner als 1" müsste hier die Lanzen-Pflicht melden. | [`04-pistol-count-2-lance-missing.ros`](rosters/04-pistol-count-2-lance-missing.ros) |
| 05 | **Zwei Pistolen und eine Lanze** (Max-Seite) | Wie 04, **mit** Lanze. | **Verletzung:** das auf 0 gesetzte Höchstmaß `128a-…` meldet **Ist 1 / Grenze 0** — die Lanze ist jetzt verboten. Die Pflicht `f0ce-…` (jetzt 0) schweigt. Dazu wieder `ecdd-…`/`dbff-…` mit Ist 2. | [`05-pistol-count-2-lance-present.ros`](rosters/05-pistol-count-2-lance-present.ros) |
| 06 | **Gar keine Signature Weapon** (Zählstand 0, and-Gruppe fällt) | Keine Order-Kette, keine Lanze. | Die geschriebenen Grenzen **bleiben stehen**: `f0ce-…` meldet **Ist 0 / Grenze 1**. Der Pistolen-Zählstand ist derselbe wie in 03 — allein das fehlende zweite Glied der `and`-Klammer macht den Unterschied (NEQ-R4). | [`06-no-signature-weapon-count-0.ros`](rosters/06-no-signature-weapon-count-0.ros) |
| 07 | **Rahmenbeweis: Pistole in einer anderen Einheit** | Wie 03, **plus** ein Elector Count mit **einer** Pistole. | Für die Ritter ändert sich **nichts** (Grenzen 0/0, keine Meldung): die fremde Pistole zählt nicht in ihren Rahmen. Zählte `scope="parent"` kontingentweit, griffe `equalTo 1`, die Grenzen stünden auf 1/1 und `f0ce-…` müsste mit Ist 0 melden. | [`07-pistol-in-other-unit-frame.ros`](rosters/07-pistol-in-other-unit-frame.ros) |

### Was bewusst **nicht** als feuernde Grenze erwartet wird

| Facette | Warum nicht im Bericht |
|---------|------------------------|
| **Die Bedingung selbst** (`notEqualTo`, `equalTo`, `atLeast`). Eine `condition` ist kein Constraint und hat keine eigene Id im Verletzungsbericht. | Sie wird **mittelbar** über die von ihr gesetzten Grenzen `f0ce-…` / `128a-…` und über `effectiveMin`/`effectiveMax` des Lanzen-Slots beobachtet (NEQ-R11). |
| **Sichtbarkeit** — `0bd1-…` ist `hidden="true"` und wird per Modifikator aufgedeckt (NEQ-R9); der Lanzen- und der Shield-Verweis tragen eigene `set hidden`-Modifikatoren, „Cavalry hammer " `9a71-…` ist roh verborgen. | Als **Verfügbarkeit** (`field="hidden"`) modelliert, nicht als zählende Schranke — gleiche Abgrenzung wie in [`vampire-bloodlines`](../vampire-bloodlines/README.md) (VBL-R4/R5). Behauptet wird allein `isHidden: false` am Lanzen-Slot, weil dessen Gatter (White Wolf) in keinem Roster hält. |
| **Namens- und Profil-Modifikatoren** der Einheit (die vielen `set … field="name"` am `infoLink` „Elite" und am Einheiteneintrag, `increment 1` auf S bei „Knights of the Inner Circle"). | Profilwerte und Namen stehen nicht im Verletzungsbericht. Keiner ihrer Auslöser ist gewählt: die Order-Kette benennt nur `e628-…`, was den Einheitennamen auf „Custom Knighty Order" setzt (`.cat:2535-2539`) — eine **Namens**-Aussage, die dieses Szenario nicht trifft. |
| **Der Kostenaufschlag der Pistole** (`increment 2` je Ritter-Modell, `repeat scope="unit"`, `.cat:13375-13379`). | `expect.capabilities` kennt keine Kosten-Aussage; das Punktelimit steht mit 2000 weit über jeder Summe. Je-Modell-Aufschläge pinnt [`unit-scope-repeat-knight-markup`](../unit-scope-repeat-knight-markup/README.md). |
| **Autor-Meldung** am Constraint `2943-aa1c-4532-4fb2` („You must have at least one unit of Reiksguard…"). | Sie hängt am `message`-Attribut **dieser** Grenze; da die Grenze per `set -1` aufgehoben ist (NEQ-R10), wird weder ihr Erscheinen noch ihr Ausbleiben behauptet. |
| **Armeeaufbau** (General-Pflicht, Core-Pflicht, Lord-/Core-Kategorie-Slots). | Nebengeräusch: in allen sieben Rostern gleichartig und für den Kontrast belanglos. |

### Bewusst offen gelassen

- **Die Reihenfolge der beiden `modifierGroup`s.** Ihre Bedingungen schließen
  einander aus, also gibt es keinen Roster-Zustand, in dem beide `set`s
  konkurrieren. Das Szenario behauptet darüber nichts.
- **Roster 04/05 sind bewusst nicht katalogkonform.** Zwei Pistolen sind der
  einzige Weg zum Zählstand 2 (NEQ-R8); die dabei gerissenen Höchstmaße
  `ecdd-…`/`dbff-…` sind deshalb ausdrücklich als feuernd deklariert und nicht
  verschwiegen.
- **`shared="false"` an `f0ce-7b2e-0be1-9dd1`** gegen `shared="true"` an
  `128a-6411-f218-72fc` (`.cat:2309-2310`). In jedem Roster steht genau **eine**
  Instanz der Einheit und genau **ein** Lanzen-Verweis, in dem der Unterschied
  greifen könnte — die beiden Lesarten fallen hier zusammen, und das Szenario
  trennt sie nicht.

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Spielsystem WHFB 6th definitive | `0d13-7737-ea86-4662` |
| Katalog **The Empire** / Bibliothek **Mercenaries** (`catalogueLink` `7773-ecbb-5fb9-eb56`) | `3938-8369-a300-4a03` / `fc47-8392-a6c8-452a` |
| ForceEntry „Standard (EM-AB)" | `e821-88b8-2071-6b6a` (`.cat:15372`) |
| ForceEntry „Emperor's Guard (EM-AB)" (Bedingung des `set -1`, **nicht** benutzt) | `9d76-5d25-ce1d-1d12` |
| SelectionEntry Einheit „Knights of the Knightly Orders" (Core `64bf-efb4-9978-26df`, 0 pts) | `1d77-9e6e-a6ab-573f` — constraint `2943-aa1c-4532-4fb2` (`max 0 scope="force"` → per `set -1` aufgehoben) |
| SelectionEntry Modell „Knight" (23 pts) | `7b8d-8405-0e74-9f46` — `24bb-871e-6aa3-e4b5` (`min 5`), `9941-5a64-0bde-add3` (`max -1`) |
| Gruppe „Weapons and Armour" (ohne eigene Grenzen) | `f1bb-0dde-c39a-d0e1` (`.cat:2282`) |
| **`entryLink` „Lance" (Träger der Zelle)** → Ziel (`.gst:977`, keine eigenen Grenzen) | **`e082-13b2-e746-34e0`** → `8649-8ac8-5a6f-fd8d` — **`f0ce-7b2e-0be1-9dd1`** (`min 1`, `shared="false"`), **`128a-6411-f218-72fc`** (`max 1`, `shared="true"`) |
| `entryLink`s Shield / Hand Weapon / Full Plate Armour (je `min 1`/`max 1`, 0 pts) | `9ccc-ad24-583e-41e0` (`1e3a-4402-70e8-2b08`/`58c4-d930-895a-0b74`), `d2a3-c146-1dbb-118f` (`50ac-f86f-cfa1-d050`/`9368-e62e-157c-023e`; Ziel `abdb-bbd0-41b2-5dff` trägt zusätzlich `bdef-ba9b-d6ce-5b14`, `.gst:1034`), `8757-aa59-69fa-1060` (`8d09-7d84-af64-cb83`/`e635-0971-2920-856c`; Ziel `199f-b4b9-aaca-490f` mit `e369-888c-81f7-bf21`) |
| `entryLink` „Empire Warhorse" (`min 1`/`max 1`) → Ziel | `aaf2-8dbc-b925-fac5` (`22cd-67c5-1c2c-2266`/`ae52-6868-5949-892c`) → `a1e3-7f97-5fc6-abaa` (`0cda-8c44-bc6f-1e6a`) |
| `entryLink` „Cavalry hammer " der Einheit (roh verborgen, `min 0`; nicht gewählt) | `9a71-cb61-06fb-005a` — `f78b-9ad2-c515-7c0a` / `dff9-eb0b-1c59-3470` |
| Gruppe „Knightly Order" | `06b5-8412-53d1-49ac` — `7944-27db-49ec-7bbd` (`max 1 scope="self"`), `21ca-c541-0b3d-6d4d` (`min 0 scope="parent"`) |
| `entryLink` „Custom Knightly Order (WD#310(UK)" → geteilter Eintrag (`hidden="true"`) | `e628-04ab-0a07-b37c` → `0bd1-8b50-44e0-6fc7` — `9ff4-e65c-ebb1-1f3c` (`max 2 scope="parent"`) |
| SelectionEntry „Knightly advantages" | `e82b-32bf-6032-2d30` — `5f81-d4a6-b74f-6fc3` (`max 1 scope="parent"`) |
| **`entryLink` „Signature Weapon" (`childId` der `atLeast`-Hälfte)** → geteilte Gruppe | **`5191-89ca-822d-60e5`** → `7195-9f86-b364-0a4f` — `ecdd-8e84-6a0e-c90b` (`max 1 scope="parent"`) |
| **`entryLink` „Pistol" in dieser Gruppe** → Ziel (`.gst:1086`, keine eigenen Grenzen) | **`fdd1-053d-3b57-76ca`** → **`44f9-f44d-d693-84f8`** — `dbff-c6e9-ba8a-4a3c` (`max 1 scope="parent"`); dazu die Autorenregel `45a3-03e9-e611-9a98` „The pistol does not replace the Lance" |
| `entryLink` „Great Weapon" in derselben Gruppe (Nicht-Pistolen-Fall) → Ziel (`.gst:987`) | `e667-bf75-c92f-1ede` → `1eb7-3f36-8cf7-e0ba` — `8126-b330-ec8d-9cea` (`max 1`) |
| Schalter „Allow experimental rules?" (`.gst`, 0 pts) → `entryLink` in The Empire | `8b76-92c4-23f9-54b1` → `2961-128d-196e-c6c6` — `30c1-0e8a-ca51-3eee` (`min 0` → per `set 1` Pflicht, sobald `e628-…` gewählt ist) |
| Unterpunkt „…from White-Dwarf and Citadel Journal issues" (deckt `0bd1-…` auf) | `cc03-e8fe-c143-6863` (`.gst:1878`) |
| **Fremde Einheit des Rahmenbeweises:** „Elector Count" (Lord, 80 pts) | `f58c-9606-507a-0542` (`.cat:385`) — Gruppe „Weapons" `d7b5-6f57-f3fc-a0c4` (`max 1` `89f6-32a9-4efd-4c0b`), Pistolen-Verweis **`11b1-f83f-3b7a-63ec`** (Ziel `44f9-…`, 10 pts), Hand-Weapon-Verweis `a6cf-c60e-13e2-ccdf` (`min 1` `536c-1042-a3a2-dfd9`) |
| Nicht benutzte Gatter der Nachbarschaft (in **keinem** Roster ausgelöst) | „Knights of the White Wolf" `9f9b-5a33-9c07-93e6` / `32c2-bfbe-88b1-8425`, Kontingente `d2eb-6fe3-7349-f03d`, `6b0d-2c9f-2d46-b330`, `d1ca-0d07-b9d2-0ff1`, `802e-a5b7-4570-1e7e`, „Border Patrols rules" `4e15-0353-165f-5528` |
| Fremde Pflichten (nicht Gegenstand): General / Core | `1077-7379-f142-f382` / `35c2-d478-392a-aeb1` |
