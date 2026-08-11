# E2E-Regeln & Testkatalog: `condition type="lessThan"` mit `scope="<Eintrags-Id>"` — der White Wolf macht den Cavalry hammer zur Pflicht, die magische Waffe nimmt sie zurück

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln,
Element-Ids und Erwartungswerte sind **ausschließlich aus den Katalogdaten** der
*6th Definitive Edition*, der Formatspezifikation
([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md), §5.6,
§7.1, §7.2, §7.6, §7.7, §8) und der vendorten
[`Catalogue.xsd`](../../../src/parser/schema/Catalogue.xsd) abgeleitet. Die
Roster-Form folgt den bereits verifizierten Szenarien (direktes `entryId` bzw.
`entryId` + `entryLinkId`, `entryGroupId` = **innerste** Gruppen-Id bzw. bei
einem verlinkten Gruppen-Verweis deren **Ziel-Id**, verschachtelte `selections`
mit `number`).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armeebuch: `The Empire (6th definitive edition).cat` (`3938-8369-a300-4a03`,
  rev 1) — Kontingent **„Standard (EM-AB)"** `e821-88b8-2071-6b6a`
  (`The Empire (…).cat:15372`)
- Söldner-Bibliothek: `Mercenaries (6th definitive edition).cat`
  (`fc47-8392-a6c8-452a`, `library="true"`) — **nicht** Fundort der geprüften
  Zelle, aber die einzige `catalogueLink`-Abhängigkeit des Armeebuchs
  (`id="7773-ecbb-5fb9-eb56"`, `.cat:15538`) und deshalb Teil des Datensatzes.

> **Abgrenzung zu den Schwester-Szenarien.**
> [`at-least-id-scope-inner-circle-champion`](../at-least-id-scope-inner-circle-champion/README.md)
> pinnt denselben **Rahmen** (`scope` = eine Eintrags-Id) mit dem Vergleich
> `atLeast` und macht ihn über **Merkmalswerte** beobachtbar.
> [`greater-than-id-scope-brain-transplant`](../greater-than-id-scope-brain-transplant/README.md)
> tut dasselbe für `greaterThan`. Dieses Szenario pinnt den Vergleich
> **`lessThan`** in derselben Spalte und macht ihn über eine **zählende Grenze**
> (`min`) beobachtbar — die Zelle
> `condition|lessThan|id|selectionCount|child=id`
> ([`worklist.json`](../worklist.json)), die im gesamten Fixture-Datensatz
> **vier** Vorkommen hat, alle in `The Empire (…).cat`.

---

## Worum es geht

Die geprüfte Bedingung steht wörtlich in `The Empire (6th definitive edition).cat`
(`.cat:3893-3919`), am `entryLink` „Cavalry hammer " innerhalb der Gruppe
„Order Weapon" des `selectionEntry` „Templar Grand Master":

```xml
<entryLink id="cc8d-7cc1-0e80-0108" name="Cavalry hammer " hidden="true"
           collective="false" import="true"
           targetId="9c55-fbdf-3b4c-f808" type="selectionEntry">
  <modifiers>
    <modifier type="set" field="name" value="Cavalry Hammer (White Wolves)"/>
    <modifier type="set" value="false" field="hidden">
      <conditions>
        <condition type="atLeast" value="1" field="selections"
                   scope="8ab4-17be-8a49-b3f7" childId="32c2-bfbe-88b1-8425"
                   shared="true" includeChildSelections="true"/>
      </conditions>
    </modifier>
    <modifier type="set" value="1" field="106f-93b5-2186-7f80">
      <conditionGroups>
        <conditionGroup type="and">
          <conditions>
            <condition type="atLeast" value="1" field="selections"
                       scope="8ab4-17be-8a49-b3f7" childId="32c2-bfbe-88b1-8425"
                       shared="true" includeChildSelections="true"/>
            <condition type="lessThan" value="1" field="selections"
                       scope="8ab4-17be-8a49-b3f7" childId="c071-eb48-3009-9ec1"
                       shared="true" includeChildSelections="true"/>
          </conditions>
        </conditionGroup>
      </conditionGroups>
    </modifier>
  </modifiers>
  <constraints>
    <constraint field="selections" scope="parent" value="1" … id="a144-8323-15a1-d4fe" type="max"/>
    <constraint type="min" value="0" field="selections" scope="parent"
                shared="true" id="106f-93b5-2186-7f80" includeChildSelections="false"/>
  </constraints>
  <costs><cost name="pts" typeId="ecfa-8486-4f6c-c249" value="6"/></costs>
</entryLink>
```

Lesart der Attribute:

- **`field="106f-93b5-2186-7f80"`** ist die **`id` eines Constraints** desselben
  Verweises — der Modifikator ändert einen **Grenzwert**, kein Merkmal und keine
  Kosten ([§7.6](../../battlescribe-data-format.md#76-constraint): „Modifier
  adressieren einen Constraint über dessen `id`"). Der geschriebene Rohwert ist
  `min 0`, der `set` hebt ihn auf `1`.
- **`scope="8ab4-17be-8a49-b3f7"`** ist **kein** Schlüsselwort. Die Spezifikation
  zählt `parent | roster | force | category | self | unit | primary-catalogue`
  auf ([§7.6](../../battlescribe-data-format.md#76-constraint)) und nennt daneben
  ausdrücklich **Vorfahren-Ids**
  ([Kasten `primary-catalogue`](../../battlescribe-data-format.md#scope-primary-catalogue)).
  `8ab4-17be-8a49-b3f7` ist die `id` des `selectionEntry` „Templar Grand Master"
  (`.cat:3858`, `type="unit"`) — der Rahmen ist also die nächste umschließende
  Auswahl, die auf diese Id auflöst, den Träger eingeschlossen (dieselbe
  Konvention, die die Spezifikation für `unit` beschreibt,
  [Kasten](../../battlescribe-data-format.md#scope-unit-ancestor)).
- **`childId="c071-eb48-3009-9ec1"`** ist die `selectionEntryGroup`
  **„Magic Weapons"** (`.cat:12695`) — gezählt werden also die Auswahlen, die
  Mitglieder dieser Gruppe sind. Sie hängt unter dem Grand Master am Träger
  „Magic Selection" (`2cf1-e089-263b-aec4`) über den Gruppen-Verweis
  `e1e1-2043-73cc-5a45` (`.cat:3874`); wegen
  `includeChildSelections="true"` zählt der Enkel mit.
- **`type="lessThan" value="1"`** ist die echte Untergrenze: gezählt **< 1**,
  also **genau 0**, ⇒ die Bedingung hält.
- **`childId="32c2-bfbe-88b1-8425"`** der Geschwister-Bedingung ist das
  `selectionEntry` „0-1 Knights of the White Wolf" (`.cat:11945`,
  `type="upgrade"`).
- Die `and`-Gruppe hält nur, wenn **beide** Bedingungen halten
  ([§7.7](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat)).

Netto-Semantik der Daten: **Ein Templar Grand Master des Ordens der Weißen Wölfe
führt den Cavalry hammer — es sei denn, er trägt eine magische Waffe.**

### Wo die Bausteine im Katalog hängen

```
selectionEntry "Templar Grand Master" (8ab4-17be-8a49-b3f7, type="unit", 160 pts, Lord/Characters)
 │   modifier set hidden=true  ⟵ nur fuer die Kontingente 6b0d-… / d2eb-… (Cult of Ulric)  .cat:4175
 ├ selectionEntry "Magic Selection" (2cf1-e089-263b-aec4, 0 pts)                            .cat:3868
 │    constraints: max 1 selections  d707-a89c-2143-1971 | max 100 pts  c568-b884-80b5-bb1c
 │    └ entryLink "Magic Weapons" (e1e1-2043-73cc-5a45 -> selectionEntryGroup c071-eb48-3009-9ec1)
 │         Gruppe: max 1 selections scope=parent  c4e5-2128-e15d-7894
 │         Mitglied u. a. entryLink "Sword of Might" (099e-250b-a57e-7027 -> .gst 8c56-9be1-c4a9-5afe, 20 pts)
 ├ selectionEntryGroup "Order Weapon" (e254-997d-e319-33c6, defaultSelectionEntryId=6ffd-…)  .cat:3887
 │    constraints: max 1  ac7c-3782-0795-89ca | min 1  29c9-4d50-361c-dfb1  (beide scope=parent)
 │    modifier set 0 auf 29c9-…  ⟵ condition greaterThan 0, scope="8ab4-…", childId=c071-…   .cat:3935
 │    ├ entryLink "Cavalry hammer " (cc8d-7cc1-0e80-0108 -> 9c55-fbdf-3b4c-f808, 6 pts, hidden="true")
 │    │    modifier set name="Cavalry Hammer (White Wolves)"      (UNBEDINGT)
 │    │    modifier set hidden=false  ⟵ atLeast 1, scope="8ab4-…", childId=32c2-…
 │    │    modifier set 1 auf 106f-93b5-2186-7f80  ⟵ and(atLeast 1 childId=32c2-…,
 │    │                                                   lessThan 1 childId=c071-…)   ← GEPRUEFTE ZELLE
 │    │    constraints: max 1  a144-8323-15a1-d4fe | min 0  106f-93b5-2186-7f80
 │    │    Ziel 9c55-… : hidden="false", max 1  4631-1a49-90b7-067b, 0 pts
 │    └ entryLink "Lance" (6ffd-43e9-329f-d85c -> .gst 8649-8ac8-5a6f-fd8d, 0 pts, hidden="false")
 │         modifier set hidden=true  ⟵ atLeast 1, scope="8ab4-…", childId=32c2-…
 │         constraints: max 1  c3dd-c1d8-860d-0091 | min 1  6992-af3c-357c-9bdc
 ├ selectionEntryGroup "Knightly Order" (a10d-3539-8d93-55cd)                                .cat:3942
 │    constraints: max 1 scope=self  013b-ca2c-876e-7ba6 | min 0 scope=parent  e08a-3412-5d3e-0923
 │    └ entryLink "Knightly Orders (WD#310(UK))" (29cc-7184-aa01-dc85 -> Gruppe 7059-6d2b-6ed3-3527)
 │         └ selectionEntryGroup "Knightly Orders (EM-AB)" (ef59-a7d3-a7d7-ec9c, hidden="true")
 │              modifier set hidden=false ⟵ atLeast 1 scope="force" childId=32c2-…
 │              └ entryLink "0-1 Knights of the White Wolf" (4430-d4ff-7985-09fa -> 32c2-bfbe-88b1-8425)
 ├ entryLink "Full Plate Armour" (fb3a-9b3f-4a15-6030 -> 199f-b4b9-aaca-490f)  min 72c3-… / max f603-…
 ├ entryLink "Empire Warhorse"   (7ba6-d697-88e0-c7f7 -> a1e3-7f97-5fc6-abaa)  min d0e1-… / max 3cc3-…
 │    └ entryLink "Barding"      (5f95-206a-3007-3cb6 -> .gst 3211-d836-02f1-01d0, Kosten per Modifier 0)
 ├ entryLink "Hand Weapon"       (8e82-e9b7-ae87-abdf -> .gst abdb-bbd0-41b2-5dff) min 8668-… / max b90f-…
 ├ entryLink "Shield"            (0a5f-3110-a889-c3ed -> .gst 50e2-1873-a856-03e7) min 9c05-… / max a53b-…
 │    modifier set 0 auf a53b-… und auf 9c05-…  ⟵ equalTo 1, scope=parent, childId=9c55-… (Hammer)
 │    modifier set hidden=true  ⟵ and(atLeast 1 childId=32c2-…, atLeast 1 childId=cc8d-…)
 └ entryLink "General"           (ebfe-5617-1c16-0ead -> 1b7c-2c90-6d96-28c9)  min 0  3065-4091-48c8-aefb
```

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **LTWWH-R1** | **Ein `scope`, der keines der Schlüsselwörter ist, benennt einen Katalog-Eintrag und damit einen Zählrahmen aus dem Roster-Baum.** `8ab4-17be-8a49-b3f7` ist die `id` eines realen `selectionEntry` — nicht die einer Kategorie, eines Kontingents oder eines Katalogs. | `.cat:3858` (`<selectionEntry id="8ab4-17be-8a49-b3f7" name="Templar Grand Master" … type="unit">`). Die Id kommt im Fixture-Datensatz sonst nur in `scope="8ab4-…"`-Attributen vor (`.cat:3898`, `3905`, `3906`, `3928`, `3937`, `4028`, `4029`, `4058`) — nirgends als `categoryEntry`, `forceEntry` oder Katalog-Wurzel. Abgrenzung der drei Fälle: [Kasten `primary-catalogue`](../../battlescribe-data-format.md#scope-primary-catalogue), [§7.7](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat) (`forceEntry`-Kodierungen). |
| **LTWWH-R2** | **Der Rahmen ist die nächste umschließende Auswahl, die auf diese Id auflöst — den Träger eingeschlossen.** Für alle acht Fundstellen am Grand Master ist das die Grand-Master-Instanz selbst: die Träger sind ein `entryLink` in einer Gruppe des Eintrags (`cc8d-…`, `6ffd-…`), die Gruppe selbst (`e254-…`) und zwei direkte `entryLink`-Kinder (`0a5f-…`, `ebfe-…`) — also Nachfahren, nie der Eintrag selbst. | Träger-Orte: `.cat:3896-3910` (Verweis Cavalry hammer), `.cat:3926-3930` (Verweis Lance), `.cat:3934-3939` (Gruppe „Order Weapon"), `.cat:4024-4033` (Verweis Shield), `.cat:4053-4065` (Verweis General). Eine Lesart „nur der Träger" (wie `self`) ließe **keine** dieser Bedingungen je greifen, weil der Grand Master nie unter seinem eigenen Verweis steht. Roster 05 misst die Gegenprobe zur kontingentweiten Lesart. |
| **LTWWH-R3** | **`lessThan value="1"` hält genau bei Zählstand 0** — echt kleiner, nicht „höchstens". | `.cat:3906` (`type="lessThan" value="1"`); [§7.7](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat), Vergleichsliste. Roster 01 (0 magische Waffen ⇒ hält) gegen Roster 02 (1 magische Waffe ⇒ hält nicht). |
| **LTWWH-R4** | **Eine `childId`, die eine `selectionEntryGroup` benennt, zählt die Mitglieder dieser Gruppe.** Eine Gruppe ist selbst nie eine Auswahl; gezählt wird, was unter ihr gewählt ist. | `c071-eb48-3009-9ec1` ist ein `selectionEntryGroup` (`.cat:12695`), kein `selectionEntry`. Derselbe Katalog stellt der `lessThan`-Bedingung die komplementäre `greaterThan 0`-Bedingung mit **derselben** `childId` und demselben `scope` an die Seite (`.cat:3937`, sie senkt die Pflicht der Gruppe „Order Weapon" auf 0) — beide sind nur unter dieser Lesart sinnvoll: „trägt dieser Grand Master eine magische Waffe?". [§7.6](../../battlescribe-data-format.md#76-constraint), Regelkasten („Eine Grenze an einer `selectionEntryGroup` zählt ihre **Mitglieder**"). |
| **LTWWH-R5** | **`includeChildSelections="true"` lässt den Enkel mitzählen.** Die magische Waffe hängt nicht direkt am Grand Master, sondern unter dem Träger „Magic Selection". | `.cat:3906` (`includeChildSelections="true"`); Katalogstruktur `.cat:3868-3884`. [§7.6](../../battlescribe-data-format.md#76-constraint), Attributtabelle. |
| **LTWWH-R6** | **Die `and`-Gruppe hebt `106f-93b5-2186-7f80` von 0 auf 1 — und nur sie.** Kein weiterer Modifikator im Datensatz adressiert diese Constraint-Id. | `.cat:3901-3910`; die Id `106f-93b5-2186-7f80` kommt im ganzen Fixture-Datensatz nur zweimal vor: als `field` dieses `set` und als `id` des Constraints (`.cat:3914`). |
| **LTWWH-R7** | **Der Verweis ist per Basis `hidden="true"` und wird von *derselben* `atLeast`-Hälfte aufgedeckt.** Die Bedingung der Aufdeckung ist damit eine **echte Oberklasse** der Bedingung der Pflicht: wann immer das Mindestmass auf 1 steht, ist der Verweis sichtbar — die gehobene Pflicht ist also **immer validierbar**. | `.cat:3893` (`hidden="true"`) und `.cat:3896-3900` (`set hidden="false"` unter `atLeast 1 … childId="32c2-…"`) gegen `.cat:3901-3910` (`and`(dieselbe `atLeast`, `lessThan`)). Ziel `9c55-fbdf-3b4c-f808` ist `hidden="false"` (`.cat:10444`), die ODER-Komposition Verweis/Ziel ([§8](../../battlescribe-data-format.md#8-kategorien--sichtbarkeit)) ergibt also genau den Verweis-Wert. Ohne diese Deckungsgleichheit wäre die Zelle nicht messbar: die Min-Grenzen einer effektiv versteckten Entität werden **nicht** validiert ([§5.6](../../battlescribe-data-format.md#56-force-entries-detachments) / [§8](../../battlescribe-data-format.md#8-kategorien--sichtbarkeit), Projektentscheidung Issue 0088). |
| **LTWWH-R8** | **Der White Wolf blendet umgekehrt die „Lance" aus; deren `min 1` darf deshalb nicht validiert werden.** In den Rostern 01–03 und 05 (Grand Master A) ist keine Lance gewählt, und `6992-af3c-357c-9bdc` muss dennoch schweigen. | `.cat:3926-3930` (`set hidden="true"` unter `atLeast 1 … childId="32c2-…"`) und `.cat:3923` (`min 1`, `id="6992-af3c-357c-9bdc"`); Validierungsverbot: [§5.6](../../battlescribe-data-format.md#56-force-entries-detachments)/[§8](../../battlescribe-data-format.md#8-kategorien--sichtbarkeit). Netto ist der Hammer **der Ersatz** der Lance, nicht ihre Ergänzung. |
| **LTWWH-R9** | **Der effektive Anzeigename des Hammer-Slots ist unbedingt „Cavalry Hammer (White Wolves)".** Der `set`-Modifikator davor trägt **keine** `conditions`/`conditionGroups`. | `.cat:3895`. Ein Modifikator am Verweis ändert die Eigenschaften des **Ziels** ([§7.2](../../battlescribe-data-format.md#72-entry-link-info-link-category-link)). Der Name dient zugleich als Sonde, dass die Modifikator-Kette dieses Verweises überhaupt ausgeführt wird. |
| **LTWWH-R10** | **Das Höchstmass des Hammer-Slots ist 1.** Verweis und Ziel tragen je ein `max 1 scope="parent"`. | `.cat:3913` (`a144-8323-15a1-d4fe`) und `.cat:10446` (`4631-1a49-90b7-067b`). |
| **LTWWH-R11** | **Der White Wolf ist unter dem Grand Master nur über einen einzigen Verweis wählbar,** der in einer vom `entryLink` `29cc-…` lokal beigesteuerten Gruppe hängt. Diese Schachtelung ist schema-konform. | `.cat:3951` — `4430-d4ff-7985-09fa` ist im **gesamten** Fixture-Datensatz der einzige Verweis mit `targetId="32c2-bfbe-88b1-8425"`. Er steht in `selectionEntryGroup ef59-a7d3-a7d7-ec9c` (`.cat:3949`), die als Kind des `entryLink` `29cc-7184-aa01-dc85` (`.cat:3947`) deklariert ist; die XSD erlaubt das, weil `EntryLink` die Basis `SelectionEntryBase` erweitert, die `selectionEntries`/`selectionEntryGroups`/`entryLinks` führt (`Catalogue.xsd:274-287`, `396-406`). |
| **LTWWH-R12** | **Der White Wolf ist im Kontingent „Standard (EM-AB)" höchstens einmal erlaubt** (`0-1`), pro Elternauswahl ebenso. Deshalb trägt in Roster 05 nur **einer** der beiden Grand Masters die Aufwertung. | `.cat:11947-11948`: `105f-fcbb-23b2-7d06` (`max 1 scope="parent"`) und `3219-23f5-50e5-8903` (`max 1 scope="force"`); der `set -1` darauf (`.cat:11959-11968`) ist an die Kontingente `802e-a5b7-4570-1e7e` / `cd47-f9b6-5a40-b4b2` gebunden, nicht an `e821-…`. |
| **LTWWH-R13** | **Der Grand Master ist im Kontingent „Standard (EM-AB)" sichtbar und trägt keine eigene Anzahlgrenze.** | Der einzige `hidden`-Modifikator des Eintrags (`.cat:4175-4185`) ist an die Kontingente `6b0d-2c9f-2d46-b330` / `d2eb-6fe3-7349-f03d` gebunden — beide ≠ `e821-88b8-2071-6b6a`. Der Eintrag hat **kein** `<constraints>`-Element (`.cat:3858-4187`). |
| **LTWWH-R14** | **Beobachtbar wird die Zelle doppelt:** über den Verletzungsbericht (die gehobene `min`-Grenze feuert) **und** über den Slot-Stand (`effectiveMin`). Die Sichtbarkeit selbst ist **keine** zählende Grenze und erscheint nur als `isHidden`. | Manifest-Vertrag: `expect.firing[]` bzw. `expect.capabilities[].effectiveMin`/`isHidden`. Gleiche Abgrenzung wie in [`vampire-bloodlines`](../vampire-bloodlines/README.md) (VBL-R4/R5) und [`not-instance-of-force-gate`](../not-instance-of-force-gate/README.md). |

---

## Die Rechnung je Roster

Der Rahmen ist jeweils die Grand-Master-Instanz; gezählt wird mit
`includeChildSelections="true"`.

| Zelle | 01 | 02 | 03 | 04 | 05 (A) | 05 (B) |
|-------|---:|---:|---:|---:|-------:|-------:|
| „0-1 Knights of the White Wolf" `32c2-…` im Rahmen | 1 | 1 | 1 | **0** | 1 | **0** |
| Mitglieder von „Magic Weapons" `c071-…` im Rahmen | 0 | **1** | 0 | 0 | 0 | **1** |
| `atLeast 1` hält? | ja | ja | ja | **nein** | ja | **nein** |
| `lessThan 1` hält? | ja | **nein** | ja | ja | ja | **nein** |
| ⇒ `and`-Gruppe hält? | **ja** | nein | **ja** | nein | **ja** | nein |
| ⇒ `106f-…` effektiv | **min 1** | min 0 | **min 1** | min 0 | **min 1** | min 0 |
| Cavalry hammer gewählt (Ist) | 0 | 0 | **1** | 0 | 0 | 0 |
| ⇒ `106f-…` feuert? | **ja (0/1)** | nein | nein | nein | **ja (0/1)** | nein |
| Hammer-Slot `isHidden` | false | false | false | **true** | false | false |

Punktesummen (nur zur Einordnung, **nicht** Gegenstand einer Zusage; Grand
Master 160, Sword of Might 20, Cavalry hammer 6 am Verweis, alles übrige 0 —
die Barding-Kosten setzt ein Modifikator am Verweis auf 0, `.cat:4001`):
160 / 180 / 166 / 160 / 340. Das `<costLimits>` steht in den Rostern 01–04 auf
**2000** und in Roster 05 auf **3000**, damit die roster-weite Budget-Regel
schweigt und in Roster 05 zwei Lord-Auswahlen im Kontingent-Slot-Raster liegen
(`.gst`, Lord-Kategorie `d024-d25b-a9b4-73b6`: `fda5-91c2-e17f-774c` = 1 bei
2000–2999, = 2 bei 3000–3999).

### Warum die Zusagen scharf sind

| Fehlauswertung der Engine | Wirkung | Ergebnis |
|---------------------------|---------|----------|
| `scope="<Eintrags-Id>"` unaufgelöst, fail-closed | `and` hält nie, Mindestmass bleibt 0 | Roster 01 und 05 verlieren ihre feuernde Grenze → Fall bricht (zusätzlich verlangt `diagnostics.absent` das Ausbleiben von `UNRESOLVED_SCOPE` mit `scope="8ab4-17be-8a49-b3f7"`) |
| Rahmen wie `force`/`roster` gelesen | in Roster 05 zählt A die magische Waffe des B mit ⇒ `lessThan` fällt | Roster 05 feuert 0-mal statt 1-mal → Fall bricht |
| Rahmen wie `self` (nur der Träger) gelesen | unter dem Hammer-Verweis stehen weder White Wolf noch magische Waffe: `atLeast` fällt überall | Roster 01/05 verlieren die feuernde Grenze → Fall bricht |
| Rahmen als „alle Instanzen dieses Eintrags" gelesen (`shared="true"` als Instanz-Vereinigung) | wie force/roster in Roster 05 | Roster 05 → Fall bricht |
| `lessThan` als `atMost` gelesen (≤ statt <) | Roster 02 hielte weiter ⇒ Mindestmass 1, Ist 0 | Roster 02 feuert → Fall bricht |
| `lessThan` invertiert gelesen | Roster 01 hielte nicht, Roster 02 hielte | beide Roster weichen ab → Fall bricht |
| `and`-Gruppe als `or` gelesen | Roster 02 hielte über die `atLeast`-Hälfte; Roster 04 hielte über die `lessThan`-Hälfte | Roster 02 **und** 04 feuern → Fall bricht |
| `childId`=Gruppen-Id nicht als Mitglieder-Zählung gelesen | in Roster 02/05(B) zählt die magische Waffe nicht | Roster 02 feuert, Roster 05 feuert 2-mal → Fall bricht |
| `includeChildSelections` ignoriert (nur direkte Kinder) | die magische Waffe (Enkel) zählt nicht | Roster 02 feuert → Fall bricht |
| Modifikator-Kette des Verweises gar nicht ausgeführt | Slot-Name bliebe „Cavalry hammer " | LTWWH-R9 (`name`) → Fall bricht |
| Min-Grenzen verborgener Entitäten trotzdem validiert | die ausgeblendete „Lance" meldete `6992-…` | `absent` in 01–03/05 → Fall bricht |

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle laufen
gegen **denselben** Datensatz (`.gst` + The-Empire-`.cat` + Mercenaries-`.cat`)
und dasselbe Kontingent „Standard (EM-AB)". Die Pflichtausrüstung des Grand
Masters (Full Plate Armour, Empire Warhorse + Barding, Hand Weapon; dazu Shield,
wo er nicht vom Hammer verdrängt wird) ist überall identisch.

> **Assertion-Fokus:** die Grenze `106f-93b5-2186-7f80` (feuernd bzw. abwesend),
> der Slot-Stand des Hammer-Verweises `cc8d-7cc1-0e80-0108`
> (`effectiveMin`/`effectiveMax`/`current`/`isHidden`/`name`) und des
> Lance-Verweises `6ffd-43e9-329f-d85c`, die Abwesenheit der berührten
> Katalog-Grenzen und das Ausbleiben von `UNRESOLVED_SCOPE` für
> `scope="8ab4-17be-8a49-b3f7"`. Andere Armeeaufbau-Diagnosen (General-/Core-
> Pflicht der `.gst`, Kategorie-Slots) dürfen zusätzlich auftreten und sind hier
> ohne Belang.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators | Fixture |
|---|-----------|----------------|------------------------------------|---------|
| 01 | **Die Pflicht greift:** White Wolf, keine magische Waffe | Ein Grand Master, Pflichtausrüstung + Shield, „0-1 Knights of the White Wolf". Kein Cavalry hammer, keine „Magic Selection". | **`106f-93b5-2186-7f80` feuert, Ist 0 / Grenze 1** (LTWWH-R3/R6). Hammer-Slot: `effectiveMin 1`, `isHidden false`, Name „Cavalry Hammer (White Wolves)" (LTWWH-R7/R9). Lance-Slot: `isHidden true`, `effectiveMin 1` — und `6992-…` schweigt (LTWWH-R8). | [`01-white-wolf-no-magic-weapon-hammer-mandatory.ros`](rosters/01-white-wolf-no-magic-weapon-hammer-mandatory.ros) |
| 02 | **Die `lessThan`-Hälfte fällt:** dieselbe Einheit **mit** magischer Waffe | Wie 01, zusätzlich „Magic Selection" mit „Sword of Might" aus der Gruppe „Magic Weapons". | **`106f-…` feuert nicht:** die Grenze bleibt auf ihrem Rohwert `min 0`. Hammer-Slot: `effectiveMin 0`, `isHidden` **unverändert false**. Der Kontrast zu 01 isoliert genau die `lessThan`-Bedingung — gleiche Sichtbarkeit, anderes Mindestmass. | [`02-white-wolf-magic-weapon-hammer-optional.ros`](rosters/02-white-wolf-magic-weapon-hammer-optional.ros) |
| 03 | **Positive Kontrolle:** dieselbe Pflicht, erfüllt | Wie 01, aber der Cavalry hammer ist gewählt; der Shield entfällt (der Hammer setzt dessen `min` **und** `max` auf 0 und blendet ihn aus). | **`106f-…` feuert nicht** (Ist 1 ≥ Grenze 1). Hammer-Slot: `current 1`, `effectiveMin 1`, `headroom 0`. Belegt, dass die Abwesenheit in Roster 02 an der gefallenen Bedingung liegt, nicht an einem unbewerteten Slot. | [`03-white-wolf-hammer-selected-min-met.ros`](rosters/03-white-wolf-hammer-selected-min-met.ros) |
| 04 | **Grundlinie:** kein White Wolf | Ein Grand Master mit Pflichtausrüstung + Shield und der regulären Order-Weapon-Wahl „Lance". | **`106f-…` feuert nicht:** die `atLeast`-Hälfte fällt, der Rohwert `min 0` bleibt. Hammer-Slot: `effectiveMin 0` und **`isHidden true`** — beides an derselben Hälfte. Lance-Slot: sichtbar, `current 1`, Pflicht erfüllt. | [`04-no-white-wolf-hammer-hidden-min-zero.ros`](rosters/04-no-white-wolf-hammer-hidden-min-zero.ros) |
| 05 | **Rahmen-Beweis:** zwei Grand Masters in **einem** Kontingent | A: White Wolf, **keine** magische Waffe. B: „Sword of Might", **kein** White Wolf (dazu Lance und Shield). | **`106f-…` feuert GENAU EINMAL**, Ist 0 / Grenze 1 — für A. Ein kontingent- oder rosterweiter Rahmen fände B's magische Waffe und ließe die Pflicht bei A gar nicht steigen (0 Treffer); ein trägerlokaler Rahmen ließe sie bei beiden steigen (2 Treffer). | [`05-two-grand-masters-frame-isolation.ros`](rosters/05-two-grand-masters-frame-isolation.ros) |

### Was bewusst **nicht** als feuernde Grenze erwartet wird

| Facette | Warum nicht im Bericht |
|---------|------------------------|
| **Die Sichtbarkeit selbst** (`set hidden` an Hammer, Lance, Shield und an der Gruppe `ef59-…`). | Als **Verfügbarkeit** (`field="hidden"`) modelliert, nicht als zählende Schranke — der Verletzungsbericht kodiert Grenzen (gleiche Abgrenzung wie in [`vampire-bloodlines`](../vampire-bloodlines/README.md), VBL-R4/R5). Beobachtet wird sie deshalb über `expect.capabilities[].isHidden`. |
| **Die Gruppen-Pflicht „Order Weapon" `29c9-4d50-361c-dfb1`.** | Sie ist in den Rostern 01 und 05 (Grand Master A) aus demselben Grund unerfüllt wie die geprüfte Grenze — in beiden ist gar keine Order-Weapon-Wahl getroffen — und wird dort deshalb **weder** als feuernd **noch** als abwesend behauptet: sie hängt an einem Gruppen-Anker, nicht am geprüften Verweis, und soll den Ausgang dieses Falls nicht mitbestimmen. Wo sie erfüllt oder per `set 0` gefallen ist (Roster 02/03/04), steht sie in `absent` — dort ist sie die **komplementäre** Zelle `greaterThan 0` derselben Zählung (`.cat:3937`) und stützt die Lesart aus LTWWH-R4. |
| **Der `isHidden`-Stand des White-Wolf-Slots selbst.** | Die Gruppe `ef59-a7d3-a7d7-ec9c` ist `hidden="true"` und wird von `atLeast 1 scope="force" childId="32c2-…"` aufgedeckt — also von der **eigenen** Auswahl (`.cat:3953-3959`). Diese selbstbezügliche Aufdeckung ist eine Frage der Auswertungsreihenfolge, keine Aussage der Katalogdaten über die geprüfte Zelle; das Szenario behauptet dazu nichts. Auf die Zählung wirkt sie nicht: `32c2-…` trägt nur Max-Grenzen, und Max-Grenzen gelten unabhängig von der Sichtbarkeit ([§8](../../battlescribe-data-format.md#8-kategorien--sichtbarkeit)). |
| **Der effektive *Name* des Grand Masters** („… of the White Wolf" per `append` ohne `join`, `.cat:4166-4170`). | Er hängt an einem `modifierGroup` mit `scope="self"`-Bedingungen — eine **andere** Rahmen-Frage als die hier geprüfte, und zusätzlich abhängig von der `join`-Konvention ([§7.7](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat), Widerspruchs-Kasten). Zugesichert wird nur der **unbedingte** Name des Hammer-Slots (LTWWH-R9). |
| **Slot-Aussagen in Roster 05.** | Beide Grand Masters tragen dieselben Slot-Definitions-Ids; der Manifest-Vertrag trennte sie nur über `path`, für den es keine aus den Katalogdaten ableitbare Bildungsregel gibt (dieselbe Lücke wie in [`at-least-id-scope-inner-circle-champion`](../at-least-id-scope-inner-circle-champion/README.md)). Roster 05 behauptet deshalb ausschließlich über `firing`/`count`. |
| **`anchorKind` der Slots.** | Ob ein Slot mit gehobener Pflicht als `mandatoryPhantom` und derselbe Slot mit `min 0` als `offerAnchor` geführt wird, ist eine Aussage über die Slot-Taxonomie der Engine, nicht über die Katalogdaten. Das Manifest benennt die Slots deshalb über `defId` + `targetDefId` (Präzedenz: [`not-instance-of-force-gate`](../not-instance-of-force-gate/README.md)). |
| **Punktekosten** (Hammer 6 am Verweis, Sword of Might 20). | Kostenzellen sind an anderen Szenarien gepinnt; hier steht das `<costLimits>` bewusst großzügig, damit `budget::ecfa-8486-4f6c-c249` schweigt. |

### Eine Randbemerkung zu `shared="true"`

Beide Bedingungen tragen `shared="true"`. In den Rostern 01–04 steht genau **ein**
Grand Master, dort ist die Flagge folglich ohne beobachtbare Wirkung. In Roster
05 stehen zwei — und die Zusage `count: 1` verlangt gerade, dass `shared="true"`
den durch eine **Eintrags-Id** bestimmten Rahmen **nicht** zur Vereinigung aller
Instanzen aufweitet. Das ist dieselbe Aussage, die die Spezifikation für die
Vorfahren-Rahmen trifft: „eine Vorfahrenkette wird durch eine Instanz nicht
enger" ([Kasten `scope="unit"`/`ancestor`](../../battlescribe-data-format.md#scope-unit-ancestor)) —
und sie ist hier die einzige Lesart, unter der die Regel des Armeebuchs
(„*dieser* Grand Master führt den Hammer, wenn *er* keine magische Waffe trägt")
sinnvoll bleibt.

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Spielsystem WHFB 6th definitive | `0d13-7737-ea86-4662` |
| Katalog **The Empire** / **Mercenaries** | `3938-8369-a300-4a03` / `fc47-8392-a6c8-452a` |
| `catalogueLink` The Empire → Mercenaries | `7773-ecbb-5fb9-eb56` |
| ForceEntry „Standard (EM-AB)" (benutzt) | `e821-88b8-2071-6b6a` |
| ForceEntries der `hidden`-Gatter des Grand Masters (**nicht** benutzt) | `6b0d-2c9f-2d46-b330` / `d2eb-6fe3-7349-f03d` |
| **SelectionEntry „Templar Grand Master" — zugleich der `scope`-Wert der geprüften Bedingungen** | **`8ab4-17be-8a49-b3f7`** (160 pts, ohne eigene Constraints) |
| **`entryLink` „Cavalry hammer " (Träger der Zelle, `hidden="true"`, 6 pts)** | **`cc8d-7cc1-0e80-0108`** → Ziel `9c55-fbdf-3b4c-f808` |
| **Der bewegte Constraint (`min`, Rohwert 0, `scope="parent"`)** | **`106f-93b5-2186-7f80`** |
| Höchstmass des Hammers am Verweis / am Ziel | `a144-8323-15a1-d4fe` / `4631-1a49-90b7-067b` |
| **SelectionEntryGroup „Magic Weapons" (das gezählte `childId`)** | **`c071-eb48-3009-9ec1`** — constraint `c4e5-2128-e15d-7894` (`max 1 scope="parent"`) |
| **SelectionEntry „0-1 Knights of the White Wolf" (das andere gezählte `childId`)** | **`32c2-bfbe-88b1-8425`** — constraints `105f-fcbb-23b2-7d06` (`max 1 parent`), `3219-23f5-50e5-8903` (`max 1 force`) |
| `entryLink` auf den White Wolf (einziger im Datensatz) und seine tragende Gruppe | `4430-d4ff-7985-09fa` in `ef59-a7d3-a7d7-ec9c` (`hidden="true"`), diese im `entryLink` `29cc-7184-aa01-dc85` → Gruppe `7059-6d2b-6ed3-3527` (constraint `1f94-bceb-13ee-f93d`) |
| SelectionEntryGroup „Order Weapon" (`defaultSelectionEntryId="6ffd-…"`) | `e254-997d-e319-33c6` — constraints `ac7c-3782-0795-89ca` (`max 1`), `29c9-4d50-361c-dfb1` (`min 1`, per `set 0` gesenkt bei magischer Waffe) |
| SelectionEntryGroup „Knightly Order" | `a10d-3539-8d93-55cd` — constraints `013b-ca2c-876e-7ba6` (`max 1 scope="self"`), `e08a-3412-5d3e-0923` (`min 0`) |
| **`entryLink` „Lance" (vom White Wolf ausgeblendet)** | **`6ffd-43e9-329f-d85c`** → Ziel `8649-8ac8-5a6f-fd8d` (`.gst`) — constraints `c3dd-c1d8-860d-0091` (`max 1`), **`6992-af3c-357c-9bdc`** (`min 1`) |
| SelectionEntry „Magic Selection" (Träger der Magie-Gruppen) | `2cf1-e089-263b-aec4` — constraints `d707-a89c-2143-1971` (`max 1`), `c568-b884-80b5-bb1c` (`max 100 pts`) |
| `entryLink` „Magic Weapons" unter „Magic Selection" | `e1e1-2043-73cc-5a45` → `c071-eb48-3009-9ec1` |
| `entryLink` „Sword of Might" (gewählte magische Waffe, 20 pts) → Ziel in der `.gst` | `099e-250b-a57e-7027` → `8c56-9be1-c4a9-5afe` — constraints `3e58-33a7-788f-7fc7` (`max 1 roster`), `e40b-b4c1-ed22-82cc` (`max 1 parent`) |
| `entryLink` „Shield" (`min`/`max` per Hammer auf 0 gesetzt, dann ausgeblendet) → Ziel | `0a5f-3110-a889-c3ed` (`a53b-3d35-f6d7-2910` / `9c05-dbb0-ce76-1ca3`) → `50e2-1873-a856-03e7` (`61e6-14a6-8422-d83a`) |
| `entryLink` „Full Plate Armour" (`min 1`/`max 1`, 0 pts) → Ziel | `fb3a-9b3f-4a15-6030` (`72c3-8d9a-9738-df40` / `f603-a5d3-b8d1-d988`) → `199f-b4b9-aaca-490f` (`e369-888c-81f7-bf21`) |
| `entryLink` „Empire Warhorse" (`min 1`/`max 1`) → Ziel | `7ba6-d697-88e0-c7f7` (`d0e1-8406-8a40-63d2` / `3cc3-41d7-7267-e347`) → `a1e3-7f97-5fc6-abaa` (`0cda-8c44-bc6f-1e6a`) |
| `entryLink` „Barding" (`min 1`/`max 1`, Kosten per Modifikator 0) → Ziel (`.gst`) | `5f95-206a-3007-3cb6` (`8558-47f5-960b-9e7c` / `03b7-bc8e-fc30-1f30`) → `3211-d836-02f1-01d0` (`ffd4-6f1b-e014-6708`) |
| `entryLink` „Hand Weapon" (`min 1`/`max 1`) → Ziel (`.gst`, eigenes `min 1`) | `8e82-e9b7-ae87-abdf` (`8668-6a27-8afb-884c` / `b90f-4c89-9fe6-9d65`) → `abdb-bbd0-41b2-5dff` (`bdef-ba9b-d6ce-5b14` / `e28e-dbb4-b8ad-d4ab`) |
| `entryLink` „General" (`min 0`, in keinem Roster gewählt) | `ebfe-5617-1c16-0ead` — constraint `3065-4091-48c8-aefb` |
| Kategorien Lord / Characters (`.gst`) mit den punkteskalierenden Grenzen | `d024-d25b-a9b4-73b6` (`fda5-91c2-e17f-774c`) / `7a1c-d611-c2dc-def1` (`c3c3-a80c-e026-200f`) |
| pts-Kostenart (`.gst`; nur zur Einordnung, keine Zusage) | `ecfa-8486-4f6c-c249` |
| Die drei **übrigen** Vorkommen derselben Zelle (nicht Gegenstand dieses Szenarios) | `.cat:2593` (`scope="1d77-9e6e-a6ab-573f"`, `childId="8229-6f9b-ba74-c239"`), `.cat:4058` (Verweis „General" des Grand Masters, `childId="32c2-…"`), `.cat:7088` (`scope="4549-742f-f75e-0c88"` = „0-1 Grand Master of the Knights of the White Wolf", `childId="32c2-…"`) |

*(`UNRESOLVED_SCOPE` ist kein Katalog-Baustein, sondern ein Schlüssel des
Manifest-Vertrags — die `absent`-Aussage ist bewusst auf
`scope="8ab4-17be-8a49-b3f7"` eingeschränkt, damit sie nicht über einen
unabhängigen, offen gebliebenen Rahmen desselben Datensatzes fällt.)*
