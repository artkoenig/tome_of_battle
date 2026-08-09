# E2E-Regeln & Testkatalog: `scope="parent"` — ein Kostenaufschlag je Modell der Eltern-Auswahl

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln, Constraint-IDs
und Erwartungswerte sind **ausschliesslich aus den Katalogdaten** der *6th Definitive
Edition* **abgeleitet**.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst` (`0d13-7737-ea86-4662`, rev 1)
- Kataloge: `Ogre Kingdoms (6th definitive edition).cat` (`49a5-e8f7-aa09-ad96`) — liefert das
  Kontingent **„Standard (OK-AB)"** `729f-9246-5cd3-5044`, das Soeldner zulaesst — und
  `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`) mit der Einheit selbst.

## Regel (In-World)

Die Soeldnereinheit **„Ogre Bulls"** (3+ Bulls zu je 35 Punkten, nach oben unbegrenzt)
kann **Light Armour** tragen. Das Light Armour kostet **3 Punkte je Modell der Einheit** —
bei 4 Bulls also 12 Punkte.

## Beleg (Katalog-Daten)

Aus `Mercenaries (6th definitive edition).cat`, Wurzel-Einheit „Ogre Bulls"
(`7754-8b3d-df99-d2d5`, `type="unit"`) → **direkter** `entryLink` „Light Armour"
(`e5af-d4b8-8f97-9197`, Ziel `.gst` `055f-8e4e-f170-35d2`):

```xml
<entryLink import="true" name="Light Armour" hidden="false" id="e5af-d4b8-8f97-9197"
           collective="false" targetId="055f-8e4e-f170-35d2" type="selectionEntry">
  <modifiers>
    <modifier type="increment" value="3" field="ecfa-8486-4f6c-c249">
      <repeats>
        <repeat value="1" repeats="1" field="selections" scope="parent" childId="model"
                shared="true" roundUp="false" percentValue="false"
                includeChildSelections="false" includeChildForces="false"/>
      </repeats>
    </modifier>
  </modifiers>
</entryLink>
```

Daneben aus derselben Einheit: das Modell „Bulls" (`411b-6f5f-06f1-be37`, 35 pts,
`min 3` `92d9-b5d1-9411-e954`, `max -1` = unbegrenzt `d5f9-2bf9-c174-f44e`) und der
Pflicht-`entryLink` „Ogre Club" (`415f-94c9-571c-19c6`, `min 1` `fff8-7da0-1bdc-5bdf`,
`max 1` `431b-bb5a-8710-7c0c`, Ziel `8768-377c-88da-c3e8` mit 0 pts).

Lesart der Attribute:

- **`field="ecfa-8486-4f6c-c249"`** ist die **pts-Kostenart** aus der `.gst` — der Modifikator
  aendert also die Kosten der Light-Armour-Auswahl, keinen Constraint.
- **`scope="parent"`** ist der Bezugsrahmen der Wiederholung: die **Eltern-Auswahl des
  Traegers**. Traeger ist die Light-Armour-Auswahl; sie haengt als **direktes Kind** unter
  der Einheiten-Auswahl „Ogre Bulls" — der Eltern-Rahmen ist hier also die Einheit selbst.
  (Abgrenzung zum Szenario [`unit-scope-per-model-cost`](../unit-scope-per-model-cost/README.md):
  dort haengt der Traeger eine Ebene tiefer und `scope="unit"` muss die Vorfahrenkette
  hochsteigen; hier fallen parent- und unit-Rahmen zusammen, gepinnt wird die
  **parent**-Aufloesung. Fallstrick aus Format-Doku §9.7: bei einem **Top-Level-Anker**
  ist die Auswahl selbst der Bezugs-Parent — dieser Fall tritt hier nicht ein, weil der
  Traeger ein Kind der Einheit ist, der Rahmen also regulaer aufloesbar bleibt.)
- **`childId="model"`** ist das Roh-Typ-Schluesselwort (Format-Doku §7.7): gezaehlt werden
  die Auswahlen mit `type="model"` im Rahmen — hier das Modell „Bulls" (`number="4"`).
  Ogre Club und Light Armour selbst sind `type="upgrade"` und zaehlen nicht.
  `includeChildSelections="false"` ist hier ohne Unterschied, weil die Modelle direkte
  Kinder der Einheit sind.
- **`value="1" repeats="1" roundUp="false"`**: je 1 gezaehltem Modell 1 Anwendung —
  `floor(4 / 1) × 1 = 4` Anwendungen von `increment 3` → Light-Armour-Kosten
  `0 + 4 × 3 = 12` pts. Basis sind die **Ziel-Kosten** `0`: der Link traegt **kein**
  eigenes `<costs>`, also gilt die geteilte `.gst`-Definition `055f-8e4e-f170-35d2`
  mit `pts value="0"` („Kosten am Link statt an der Definition" greift hier nicht,
  Format-Doku §9.3).

### Vorrechnung der Rostersumme

| Auswahl | Quelle der Kosten | pts |
|---------|-------------------|-----|
| Einheit „Ogre Bulls" (`7754-8b3d-df99-d2d5`) | Eintrag, `value="0"` | 0 |
| 4 × Modell „Bulls" (`411b-6f5f-06f1-be37`) | Eintrag, `value="35"` | 140 |
| Ogre Club (Link `415f-94c9-571c-19c6` → `8768-377c-88da-c3e8`) | Ziel, `value="0"` | 0 |
| Light Armour (Link `e5af-d4b8-8f97-9197` → `.gst` `055f-8e4e-f170-35d2`) | Ziel `0` + 4 × `increment 3` | **12** |
| **Summe** | | **152** |

Der Ogre Club ist ueber den `min 1`-Constraint an seinem Link Pflicht
(`fff8-7da0-1bdc-5bdf`), das Modell-Minimum ist 3 (`92d9-b5d1-9411-e954`). Gewaehlt
sind **4** Bulls — legal, weil das Modell-Maximum unbegrenzt ist (`d5f9-2bf9-c174-f44e`,
`value="-1"`; der Border-Patrols-Modifikator darauf bleibt ohne die Auswahl
„Border Patrols rules" wirkungslos) — und bewusst **nicht** das Minimum: eine Engine,
die statt der echten Zaehlung den `min`-Constraint-Wert 3 einsetzt, rechnet 149 statt
152 und wird von der Klammer unten mitgefangen.

### Beobachtbarkeit ueber die Budget-Regel

Die roster-weite Budget-Regel (`budget::ecfa-8486-4f6c-c249`) feuert bei **strikter**
Ueberschreitung des eingestellten Punktelimits (Ist = Summe, Grenze = Limit; Grenzfall
„Summe = Limit" feuert nicht — belegt im Szenario
[`orcs-and-goblins-budget`](../orcs-and-goblins-budget/README.md)). Die Klammer
**151 / 153** um die korrekte Summe 152 macht die exakt 4-fache Anwendung der
Wiederholung im parent-Rahmen beobachtbar:

| Fehl-Lesart der Wiederholung | Summe | Limit 151 (Roster 01) | Limit 153 (Roster 02) |
|------------------------------|-------|-----------------------|-----------------------|
| 0 Anwendungen (Rahmen nicht aufgeloest) | 140 | schweigt faelschlich | — |
| 1 Anwendung (Wiederholung als Bedingung gelesen) | 143 | schweigt faelschlich | — |
| je Modell-**Auswahl** statt je Modell (`number` ignoriert) | 143 | schweigt faelschlich | — |
| `min`-Constraint-Wert 3 statt Zaehlung / N−1 | 149 | schweigt faelschlich | — |
| **korrekt: 4 Anwendungen** | **152** | **feuert 152/151** | **schweigt** |
| N+1 = 5 Anwendungen | 155 | feuert mit falschem Ist | feuert faelschlich |
| alle Eltern-Kinder statt nur `type="model"` (4+1+1=6) | 158 | feuert mit falschem Ist | feuert faelschlich |

| ID | Regel | Erwartung |
|----|-------|-----------|
| **PSC-R1** | Das Light Armour kostet je Modell-Auswahl der Eltern-Einheit 3 pts mehr (`increment 3` + `repeat scope="parent" childId="model" repeats="1"`). Bei 4 Bulls: 12 pts, Rostersumme 152. | Limit 151: `budget::ecfa-8486-4f6c-c249` feuert **Ist 152 / Grenze 151**. Jede Unter-Anwendung (Summen 140–149) laesst es faelschlich schweigen; Ueber-Zaehlung liefert ein falsches Ist. |
| **PSC-R2** | Dieselbe Summe haelt ein Limit von 153 ein. | Limit 153: Budget **absent**. Eine Engine, die 5-fach oder ueber alle Eltern-Kinder rechnet (≥ 155), feuert faelschlich. |
| **PSC-R3** | Die Wiederholung wird gelesen und ihr Rahmen ist aufloesbar (der Traeger hat eine Eltern-Auswahl). | Keine Diagnose `UNSUPPORTED_REPEAT`; keine Diagnose `UNRESOLVED_SCOPE` mit `scope="parent"`. |

## Testkatalog (E2E-Szenarien der neuen Engine)

| # | Roster-Zustand | Erwartetes Ergebnis des Evaluators | Fixture |
|---|----------------|------------------------------------|---------|
| 01 | Ogre Bulls (4 Bulls, Ogre Club, Light Armour), Punktelimit **151**. | `budget::ecfa-8486-4f6c-c249` feuert **Ist 152 / Grenze 151**; keine Diagnose `UNSUPPORTED_REPEAT`, keine `UNRESOLVED_SCOPE` (`scope="parent"`). | [`01-light-armour-over-budget.ros`](rosters/01-light-armour-over-budget.ros) |
| 02 | Derselbe Aufbau, Punktelimit **153**. | Budget **absent** (152 ≤ 153); keine Diagnose `UNSUPPORTED_REPEAT`, keine `UNRESOLVED_SCOPE` (`scope="parent"`). | [`02-light-armour-within-budget.ros`](rosters/02-light-armour-within-budget.ros) |

Die Erwartung ist selektiv: weitere Armeeaufbau-Verstoesse (General-/Core-Pflicht der
`.gst`-Kontingentregeln) duerfen zusaetzlich auftreten und sind nicht Gegenstand dieses
Szenarios.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| ForceEntry „Standard (OK-AB)" (Ogre Kingdoms) | `729f-9246-5cd3-5044` |
| SelectionEntry Einheit „Ogre Bulls" (Mercenaries, `type="unit"`, 0 pts) | `7754-8b3d-df99-d2d5` |
| SelectionEntry Modell „Bulls" (min 3: `92d9-b5d1-9411-e954`, max unbegrenzt: `d5f9-2bf9-c174-f44e`, 35 pts) | `411b-6f5f-06f1-be37` |
| EntryLink Ogre Club (min 1: `fff8-7da0-1bdc-5bdf`, max 1: `431b-bb5a-8710-7c0c`) → Ziel (0 pts) | `415f-94c9-571c-19c6` → `8768-377c-88da-c3e8` |
| EntryLink Light Armour (Traeger des Modifikators, ohne Link-Kosten) → `.gst`-Ziel (0 pts) | `e5af-d4b8-8f97-9197` → `055f-8e4e-f170-35d2` |
| Kategorien der Einheit (Regiment of Renown primaer / Rare) | `ee09-9a50-ad78-9c32` / `e94b-6a54-8779-cd60` |
| pts-Kostenart (`.gst`) | `ecfa-8486-4f6c-c249` |
| Budget-Grenze (Engine-Regel, roster-weit) | `budget::ecfa-8486-4f6c-c249` |
