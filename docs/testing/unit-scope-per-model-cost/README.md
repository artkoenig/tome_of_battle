# E2E-Regeln & Testkatalog: `scope="unit"` — ein Kostenaufschlag je Modell

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln, Constraint-IDs
und Erwartungswerte sind **ausschliesslich aus den Katalogdaten** der *6th Definitive
Edition* **abgeleitet**.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst` (`0d13-7737-ea86-4662`, rev 1)
- Kataloge: `Ogre Kingdoms (6th definitive edition).cat` (`49a5-e8f7-aa09-ad96`) — liefert das
  Kontingent **„Standard (OK-AB)"** `729f-9246-5cd3-5044` — und
  `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`) mit der Einheit selbst.

## Regel (In-World)

Die Soeldnereinheit **„Heavy Cavalry"** (5+ Ritter zu je 19 Punkten) reitet Warhorses und
kann diese mit **Barding** (Rossharnisch) ausruesten. Das Barding kostet **2 Punkte je
Modell der Einheit** — bei 5 Rittern also 10 Punkte.

## Beleg (Katalog-Daten)

Aus `Mercenaries (6th definitive edition).cat`, Einheit „Heavy Cavalry"
(`18a2-7e02-a130-068f`) → Gruppe „Mounts" → `entryLink` „Warhorse" (`a93d-c22a-b4d7-3fa4`)
→ `entryLink` „Barding" (`19d1-de95-644d-00a7`, Ziel `3211-d836-02f1-01d0`):

```xml
<entryLink import="true" name="Barding" hidden="false" id="19d1-de95-644d-00a7"
           collective="false" targetId="3211-d836-02f1-01d0" type="selectionEntry">
  <modifiers>
    <modifier type="increment" value="2" field="ecfa-8486-4f6c-c249">
      <repeats>
        <repeat value="1" repeats="1" field="selections" scope="unit" childId="model"
                shared="true" roundUp="false" percentValue="false"
                includeChildSelections="false" includeChildForces="false"/>
      </repeats>
    </modifier>
  </modifiers>
  <constraints>
    <constraint type="max" value="1" field="selections" scope="parent" shared="true"
                id="7c9a-8406-5f84-70a4" .../>
  </constraints>
  <costs>
    <cost name="pts" typeId="ecfa-8486-4f6c-c249" value="0"/>
  </costs>
</entryLink>
```

Lesart der Attribute:

- **`field="ecfa-8486-4f6c-c249"`** ist die **pts-Kostenart** aus der `.gst` — der Modifikator
  aendert also die Kosten der Barding-Auswahl, keinen Constraint.
- **`scope="unit"`** ist der Bezugsrahmen der Wiederholung: die **umschliessende Einheit**,
  d. h. der naechste Vorfahre (den Traeger eingeschlossen) mit `type="unit"`. Traeger ist die
  Barding-Auswahl (`upgrade`), ihr Elternteil das Warhorse (`upgrade`,
  `313455d3-3643-49fe-b5e6-a2260731f465`), erst darueber steht die Einheit „Heavy Cavalry"
  (`type="unit"`).
- **`childId="model"`** ist das Roh-Typ-Schluesselwort: gezaehlt werden die Auswahlen mit
  `type="model"` im Rahmen — hier das Modell „Heavy Cavalry" (`b576-acc9-fc91-617b`,
  `number="5"`). Warhorse, Barding und die Waffen sind `type="upgrade"` und zaehlen nicht.
  `includeChildSelections="false"` ist hier ohne Unterschied, weil die Modelle direkte
  Kinder der Einheit sind.
- **`value="1" repeats="1" roundUp="false"`**: je 1 gezaehltem Modell 1 Anwendung —
  `floor(5 / 1) × 1 = 5` Anwendungen von `increment 2` → Barding-Kosten
  `0 + 5 × 2 = 10` pts. Basis ist die **Link-Kosten** `0` (Kosten am Link ueberschreiben
  die Definitions-Kosten; die geteilte `.gst`-Definition `3211-d836-02f1-01d0` traegt 6 pts,
  die hier **nicht** gelten — „Kosten am Link statt an der Definition", Format-Doku §9.3).

### Vorrechnung der Rostersumme

| Auswahl | Quelle der Kosten | pts |
|---------|-------------------|-----|
| Einheit „Heavy Cavalry" (`18a2-7e02-a130-068f`) | Eintrag, `value="0"` | 0 |
| 5 × Modell „Heavy Cavalry" (`b576-acc9-fc91-617b`) | Eintrag, `value="19"` | 95 |
| Lance (Link `7a86-8518-80b8-f0bc` → `.gst` `8649-8ac8-5a6f-fd8d`) | Ziel, `value="0"` | 0 |
| Hand Weapon (Link `d882-cea2-9251-571b` → `.gst` `abdb-bbd0-41b2-5dff`) | Ziel, `value="0"` | 0 |
| Heavy Armour (Link `518c-9dd7-529a-6c46` → `.gst` `dde4-0ba8-7b3c-57b7`) | Ziel, `value="0"` | 0 |
| Shield (Link `f40b-e44a-da6e-1ee0` → `.gst` `50e2-1873-a856-03e7`) | Ziel, `value="0"` | 0 |
| Warhorse (Link `a93d-c22a-b4d7-3fa4` → `3134…1f465`) | Ziel, `value="0"` | 0 |
| Barding (Link `19d1-de95-644d-00a7`) | Link `0` + 5 × `increment 2` | **10** |
| **Summe** | | **105** |

Lance, Hand Weapon, Heavy Armour, Shield und Warhorse sind ueber `min`-Constraints an
ihren Links Pflicht (`5b41-8b42-ed3c-92a9`, `f1b8-305e-3543-0cdf`, `2766-029b-dfb4-a2b7`,
`25b4-961d-adac-a9fe`, `0bdf-eb0b-7c64-1b49`); das Modell-Minimum ist 5
(`b07b-fa16-2c95-94d3`). Die Roster sind also die kleinste legale Auspraegung der Einheit.

### Beobachtbarkeit ueber die Budget-Regel

Die roster-weite Budget-Regel (`budget::ecfa-8486-4f6c-c249`) feuert bei **strikter**
Ueberschreitung des eingestellten Punktelimits (Ist = Summe, Grenze = Limit; Grenzfall
„Summe = Limit" feuert nicht — belegt im Szenario
[`orcs-and-goblins-budget`](../orcs-and-goblins-budget/README.md), Roster 04/05).
Ein Limit **zwischen** der korrekten Summe (105) und der Summe ohne Aufschlag (95) macht
den `scope="unit"`-Rahmen als feuernde/schweigende Grenze beobachtbar.

| ID | Regel | Erwartung |
|----|-------|-----------|
| **USC-R1** | Das Barding kostet je Modell der umschliessenden Einheit 2 pts mehr (`increment 2` + `repeat scope="unit" childId="model"`). Bei 5 Modellen: 10 pts, Rostersumme 105. | Limit 100: `budget::ecfa-8486-4f6c-c249` feuert **Ist 105 / Grenze 100**. Eine Engine, die den unit-Rahmen nicht aufloest (0 Anwendungen, Summe 95–100), laesst es fälschlich schweigen. |
| **USC-R2** | Dieselbe Summe haelt ein Limit von 110 ein. | Limit 110: Budget **absent**. Eine Engine, die den Aufschlag doppelt oder auf der Definitions-Basis 6 rechnet (≥ 111), feuert faelschlich. |
| **USC-R3** | Der Rahmen `scope="unit"` ist aufloesbar (die Barding-Auswahl hat eine umschliessende Einheit). | Keine Diagnose `UNRESOLVED_SCOPE` mit `scope="unit"`. |

## Testkatalog (E2E-Szenarien der neuen Engine)

| # | Roster-Zustand | Erwartetes Ergebnis des Evaluators | Fixture |
|---|----------------|------------------------------------|---------|
| 01 | Heavy Cavalry (5 Modelle, Pflichtausruestung, Warhorse + Barding), Punktelimit **100**. | `budget::ecfa-8486-4f6c-c249` feuert **Ist 105 / Grenze 100**; keine Diagnose `UNRESOLVED_SCOPE` (`scope="unit"`). | [`01-barding-over-budget.ros`](rosters/01-barding-over-budget.ros) |
| 02 | Derselbe Aufbau, Punktelimit **110**. | Budget **absent** (105 ≤ 110); keine Diagnose `UNRESOLVED_SCOPE` (`scope="unit"`). | [`02-barding-within-budget.ros`](rosters/02-barding-within-budget.ros) |

Die Erwartung ist selektiv: weitere Armeeaufbau-Verstoesse (General-/Core-Pflicht der
`.gst`-Kontingentregeln) duerfen zusaetzlich auftreten und sind nicht Gegenstand dieses
Szenarios.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| ForceEntry „Standard (OK-AB)" (Ogre Kingdoms) | `729f-9246-5cd3-5044` |
| SelectionEntry Einheit „Heavy Cavalry" (Mercenaries) | `18a2-7e02-a130-068f` |
| SelectionEntry Modell „Heavy Cavalry" (min 5: `b07b-fa16-2c95-94d3`, 19 pts) | `b576-acc9-fc91-617b` |
| EntryLink Warhorse (min 1: `0bdf-eb0b-7c64-1b49`) → Ziel | `a93d-c22a-b4d7-3fa4` → `313455d3-3643-49fe-b5e6-a2260731f465` |
| EntryLink Barding (Traeger des Modifikators, Link-Kosten 0) → Ziel | `19d1-de95-644d-00a7` → `3211-d836-02f1-01d0` |
| EntryLinks Lance / Hand Weapon / Heavy Armour / Shield → `.gst`-Ziele (alle 0 pts) | `7a86-8518-80b8-f0bc`→`8649-8ac8-5a6f-fd8d`, `d882-cea2-9251-571b`→`abdb-bbd0-41b2-5dff`, `518c-9dd7-529a-6c46`→`dde4-0ba8-7b3c-57b7`, `f40b-e44a-da6e-1ee0`→`50e2-1873-a856-03e7` |
| pts-Kostenart (`.gst`) | `ecfa-8486-4f6c-c249` |
| Budget-Grenze (Engine-Regel, roster-weit) | `budget::ecfa-8486-4f6c-c249` |
