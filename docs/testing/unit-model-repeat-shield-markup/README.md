# E2E-Regeln & Testkatalog: `repeat scope="unit" childId="model"` — der Kostenaufschlag skaliert **linear** mit der Modellzahl

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln,
Constraint-Ids, Punktebeträge und Erwartungswerte sind **ausschliesslich aus den
Katalogdaten** der *6th Definitive Edition* und der Formatspezifikation
([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md), §7.5,
§7.6 und der [Kasten `scope="unit"`](../../battlescribe/building-blocks/modifier.md#scopeunit-und-scopeancestor--die-umschließende-einheit-und-die-vorfahrenkette)
in §7.7) abgeleitet. Die Roster-Form folgt den bereits verifizierten Szenarien
(direktes `entryId` bzw. `entryId` + `entryLinkId`, `entryGroupId` für
Gruppenmitglieder, verschachtelte `selections` mit `number`).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armeebuch: `Orcs and goblins (6th definitive edition).cat`
  (`4049-c46d-7f80-44fb`, rev 1) — Kontingent **„Standard (OG-AB)"**
  `2bfa-e64a-7123-895f`
- Söldner-Bibliothek: `Mercenaries (6th definitive edition).cat`
  (`fc47-8392-a6c8-452a`, `library="true"`) — trägt **beide** Fundstellen der
  hier geprüften `repeat`-Zelle; in O&G per `catalogueLink`
  `b066-2f8e-11ee-1dce` eingebunden.

> **Abgrenzung zu den Schwester-Szenarien.**
> [`unit-scope-per-model-cost`](../unit-scope-per-model-cost/README.md) pinnt,
> **dass** der `scope="unit"`-Rahmen überhaupt aufgelöst wird (eine Modellzahl,
> zwei Limits als Klammer); [`parent-scope-per-model-cost`](../parent-scope-per-model-cost/README.md)
> tut dasselbe für `scope="parent"`. Dieses Szenario setzt eine Stufe darüber an:
> es variiert **allein die Modellzahl** und fordert damit die **Linearität** der
> Wiederholung — „je Modell 1 pt", nicht „irgendein Aufschlag ist passiert".

---

## Worum es geht

Ein `<repeat>` an einem `modifier` bewirkt, dass der Modifikator **mehrfach**
angewendet wird ([§7.7](../../battlescribe/building-blocks/modifier.md#repeat--modifier-mehrfach-anwenden)).
Steht die Wiederholung auf `field="selections" scope="unit" childId="model"`,
zählt sie die Modelle der **umschliessenden Einheit** — laut Format-Doku genau
das „idiomatische Muster … der **Kostenaufschlag je Modell** (Mercenaries)"
([Kasten `scope="unit"`](../../battlescribe/building-blocks/modifier.md#scopeunit-und-scopeancestor--die-umschließende-einheit-und-die-vorfahrenkette)).
Auf einen `increment` einer **Kostenart** angewandt, ist der Aufschlag damit eine
**Gerade durch den Ursprung**: `Aufschlag = Modellzahl × increment-value`.

Beide Fundstellen dieser Zelle im Fixture-Satz stehen in
`Mercenaries (6th definitive edition).cat`:

```
A) Manbiters (0efb-7f63-7932-0655, type="unit")
     └ selectionEntryGroup "Weapons and Armour" (7e37-3bee-16fc-5145)
          └ entryLink "Shield" (a7e5-d466-038a-a9d6 → .gst 50e2-1873-a856-03e7)
               modifier increment 1 auf ecfa-8486-4f6c-c249
                 repeat selections / scope=unit / childId=model / value=1 / repeats=1

B) Heavy Cavalry (18a2-7e02-a130-068f, type="unit")
     └ selectionEntryGroup "Mounts" (fe73-2e49-792d-4474)
          └ entryLink "Warhorse" (a93d-c22a-b4d7-3fa4)
               └ entryLink "Barding" (19d1-de95-644d-00a7 → .gst 3211-d836-02f1-01d0)
                    modifier increment 2 auf ecfa-8486-4f6c-c249
                      repeat selections / scope=unit / childId=model / value=1 / repeats=1
```

Der Kern (A), wörtlich aus `Mercenaries (6th definitive edition).cat:6662-6674`:

```xml
<entryLink import="true" name="Shield" hidden="false" id="a7e5-d466-038a-a9d6"
           type="selectionEntry" targetId="50e2-1873-a856-03e7">
  <constraints>
    <constraint type="min" value="1" field="selections" scope="parent" shared="true"
                id="e6d2-9b61-a635-cd51" includeChildSelections="false"/>
    <constraint type="max" value="1" field="selections" scope="parent" shared="true"
                id="184f-af1f-b607-edf5" includeChildSelections="false"/>
  </constraints>
  <modifiers>
    <modifier type="increment" value="1" field="ecfa-8486-4f6c-c249">
      <repeats>
        <repeat value="1" repeats="1" field="selections" scope="unit" childId="model"
                shared="true" roundUp="false"/>
      </repeats>
    </modifier>
  </modifiers>
</entryLink>
```

Lesart der Attribute:

- **`field="ecfa-8486-4f6c-c249"`** ist die **pts-Kostenart** der `.gst`
  ([§5.3](../../battlescribe/files/game-system.md#53-cost-types-kostenarten)) — der
  Modifikator ändert also die **Kosten** der Shield-Auswahl, keinen Constraint.
- **Basis der Rechnung** sind die Kosten der aufgelösten Definition: der
  `entryLink` trägt **kein** `<costs>`, also gilt die `.gst`-Definition
  `50e2-1873-a856-03e7` mit `pts value="0"`
  (`Warhammer Fantasy Battles (6th definitive edition).gst:964-972`).
- **`scope="unit"`** ist der Bezugsrahmen der Wiederholung: der nächste Vorfahre
  mit `type="unit"`, den Träger eingeschlossen. Träger ist die Shield-Auswahl
  (`type="upgrade"`); ihr Elternteil ist die Einheit „Manbiters"
  (`type="unit"`) — der Rahmen ist also aufgelöst, kein `UNRESOLVED_SCOPE`.
- **`childId="model"`** ist das **rohe Typ-Schlüsselwort**: gezählt werden die
  Auswahlen mit `type="model"` im Rahmen. Das ist im Manbiters-Baum genau der
  Eintrag `45ff-9a9c-aa59-8c4c` (`type="model"`, 5 pts) mit seinem `number`.
  Hand Weapon, Light Armour, Flail, Shield und der Unit-slot sind
  `type="upgrade"` und zählen **nicht**. `includeChildSelections` ist am
  `repeat` nicht gesetzt (Default `false`) und hier ohne Unterschied, weil die
  Modelle direkte Kinder der Einheit sind.
- **`value="1" repeats="1" roundUp="false"`**: je 1 gezähltem Modell 1
  Anwendung — `floor(N / 1) × 1 = N` Anwendungen von `increment 1`.

Daraus folgt die **Geradengleichung** des Shields:
`Shield-Kosten(N) = 0 + N × 1 = N pts`.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **UMR-R1** | **Der Shield der Manbiters kostet 1 pt je Modell der Einheit.** Bei N Modellen also N pts; Basis sind 0 pts. | `Mercenaries (…).cat` → `selectionEntry "Manbiters"` `0efb-7f63-7932-0655` → Gruppe `"Weapons and Armour"` `7e37-3bee-16fc-5145` → `entryLink "Shield"` **`a7e5-d466-038a-a9d6`** (Ziel `50e2-1873-a856-03e7`) → `modifier type="increment" value="1" field="ecfa-8486-4f6c-c249"` mit `repeat value="1" repeats="1" field="selections" scope="unit" childId="model" shared="true" roundUp="false"`. Basiskosten aus der `.gst`-Definition (`pts 0`), da der Link keine eigenen `<costs>` trägt. |
| **UMR-R2** | **Der Aufschlag ist linear, nicht konstant.** Verdoppelt sich die Modellzahl nicht, sondern wächst sie um Δ, so wächst der Aufschlag um genau Δ × 1 pt. | Folgt aus UMR-R1: der Zählwert des `repeat` ist die Modellzahl selbst, `repeats="1"` und `value="1"` machen daraus 1:1 Anwendungen. Roster 01/02/03 (20/25/30 Modelle) liefern drei Stützstellen; die Kontrollen 04/05 den Nullpunkt bei derselben Modellzahl. |
| **UMR-R3** | **Ohne den Träger kein Aufschlag.** Ist der Shield nicht gewählt, entfällt der Modifikator vollständig — die Einheit kostet nur ihre Modelle. | Der Modifikator hängt am `entryLink` selbst; ohne Shield-Auswahl gibt es keine Kostenzeile, auf die er wirkte ([§7.2](../../battlescribe/building-blocks/links.md#72-entry-link-info-link-category-link): Kosten liegen am Link/Ziel der Auswahl). |
| **UMR-R4** | **Der Shield ist an dieser Einheit Pflicht** (`min 1`) und **höchstens einmal** wählbar (`max 1`), je `scope="parent"`. Fehlt er, feuert die Untergrenze mit Ist 0. | Ebenda: constraints **`e6d2-9b61-a635-cd51`** (`type=min value=1 field=selections scope=parent shared=true includeChildSelections=false`) und **`184f-af1f-b607-edf5`** (`type=max value=1 …`). Zusätzlich trägt die `.gst`-Definition eine eigene Obergrenze **`61e6-14a6-8422-d83a`** (`max 1 scope=parent`, `.gst:974`). |
| **UMR-R5** | **Die Einheitsgrösse ist nach unten auf 20 Modelle gebunden und nach oben unbegrenzt.** 20/25/30 Modelle sind daher alle legal. | `selectionEntry "Manbiters"` (model) `45ff-9a9c-aa59-8c4c` → **`5194-0651-556d-8143`** (`min 20 scope=parent`) und **`9eae-88c9-5c5d-8a07`** (`max -1 scope=parent`, Kommentar `BP`). `-1` = unbegrenzt, solange kein `set` greift ([§7.6](../../battlescribe/building-blocks/constraint.md#76-constraint), Sentinel-Kasten; der einzige `set 25` ist an „Border Patrols rules" `4e15-0353-165f-5528` gebunden, die in keinem Roster dieses Szenarios steht). |
| **UMR-R6** | **Die Einheit braucht einen Unit-slot** (genau eine der Optionen Rare/Core/Special) — deshalb steht in jedem Manbiters-Roster „Rare" (0 pts). | Gruppe `"Unit slot"` `b63d-9c53-ef70-8723` → constraints **`ca73-afca-79f9-bfb6`** (`min 1 scope=parent`) und **`c867-2baf-38f7-8679`** (`max 1 scope=parent`); Option „Rare" `75ab-2ebb-8c82-3286` ohne `<costs>` (= 0 pts). |
| **UMR-R7** | **Die Manbiters sind roh verboten** (`max 0`) und werden erst durch den Force-Schalter **„Allow experimental rules?"** freigeschaltet — ausserhalb einer Ogerarmee. Deshalb trägt jedes Manbiters-Roster diesen Schalter (0 pts) und das Kontingent stammt aus O&G. | `selectionEntry "Manbiters"` → constraint **`30f0-d417-2185-bf4a`** (`type=max value=0 field=selections scope=parent shared=true`); `modifier type="set" value="1" field="30f0-d417-2185-bf4a"` mit `conditionGroup type="and"`: `notInstanceOf … scope="primary-catalogue" childId="731d-5b13-2a92-5427"` (= **nicht** Ogre Kingdoms) **und** `atLeast 1 selections scope="force" childId="8b76-92c4-23f9-54b1"`. Der Schalter ist der `.gst`-Eintrag `8b76-92c4-23f9-54b1` (`pts 0`), in O&G per `entryLink` `22a7-2e88-eaf1-49a9` wählbar; das O&G-Kontingent gehört zum Katalog `4049-c46d-7f80-44fb` ≠ `731d-…`. Vgl. [`primary-catalogue-scope`](../primary-catalogue-scope/README.md) und [`offer-and-category-slots`](../offer-and-category-slots/README.md) (dort zeigt der Manbiters-Angebots-Anker **ohne** Schalter `effectiveMax: 0`). |
| **UMR-R8** | **Zweite Fundstelle, gleiche Zelle, anderer Betrag:** Das Barding der „Heavy Cavalry" kostet **2 pts je Modell** der Einheit, Basis 0 (Link-Kosten überschreiben die `.gst`-Definition von 6 pts). | `Mercenaries (…).cat:8044-8068` → Gruppe `"Mounts"` `fe73-2e49-792d-4474` → `entryLink "Warhorse"` `a93d-c22a-b4d7-3fa4` → `entryLink "Barding"` **`19d1-de95-644d-00a7`** (Ziel `3211-d836-02f1-01d0`) → `modifier increment 2` mit demselben `repeat`; `<cost name="pts" … value="0"/>` **am Link** gegen `value="6"` an der `.gst`-Definition (`.gst:1019-1027`) — „Kosten am Link statt an der Definition" ([§7.2](../../battlescribe/building-blocks/links.md#72-entry-link-info-link-category-link)). |
| **UMR-R9** | **Beobachtbar wird die Summe über die roster-weite Budget-Regel.** Eine Kostenart hat kein eigenes Feld in der Slot-Projektion; die verplante Gesamtsumme steht dagegen im `actual` der Budget-Verletzung `budget::ecfa-8486-4f6c-c249`, die bei **strikter** Überschreitung des eingestellten `<costLimits>`-Wertes feuert. | Belegt an den bestehenden Szenarien [`orcs-and-goblins-budget`](../orcs-and-goblins-budget/README.md) (Roster 04: Ist 150 / Grenze 100; Roster 05: Summe = Limit → still) sowie [`unit-scope-per-model-cost`](../unit-scope-per-model-cost/README.md) / [`parent-scope-per-model-cost`](../parent-scope-per-model-cost/README.md). Das Punktelimit steht hier je Roster **eine Einheit unter** der korrekten Summe, damit `actual` die Summe exakt trägt. |

---

## Die Punkte-Arithmetik je Roster

Alle Kostenzeilen stammen aus den oben belegten Elementen. Einträge **ohne**
`<costs>`-Block zählen 0 (Einheit „Manbiters" `0efb-…`, Unit-slot „Rare"
`75ab-…`).

### Manbiters (Roster 01–05)

| Auswahl | Quelle der pts-Kosten | 20 Modelle | 25 Modelle | 30 Modelle |
|---------|------------------------|-----------:|-----------:|-----------:|
| Einheit „Manbiters" `0efb-7f63-7932-0655` | kein `<costs>` → 0 | 0 | 0 | 0 |
| Modell „Manbiters" `45ff-9a9c-aa59-8c4c` | Eintrag, `value="5"` × `number` | 100 | 125 | 150 |
| Hand Weapon (Link `290f-b0ea-ed0f-27b4` → `.gst abdb-…`) | Ziel, `value="0"` | 0 | 0 | 0 |
| Light Armour (Link `9b6d-1a85-e5dc-f1c9` → `.gst 055f-…`) | Ziel, `value="0"` | 0 | 0 | 0 |
| Flail (Link `cc41-bc53-d81b-b58a` → `.gst 2eb9-…`) | Ziel, `value="0"` | 0 | 0 | 0 |
| Unit-slot „Rare" `75ab-2ebb-8c82-3286` | kein `<costs>` → 0 | 0 | 0 | 0 |
| Schalter „Allow experimental rules?" `8b76-92c4-23f9-54b1` | `.gst`, `value="0"` | 0 | 0 | 0 |
| **Shield** (Link `a7e5-d466-038a-a9d6`) | Ziel `0` + N × `increment 1` | **20** | **25** | **30** |
| **Summe mit Shield** | | **120** | **150** | **180** |
| **Summe ohne Shield** (Kontrolle) | | **100** | — | **150** |

Die drei Stützstellen 20 → 120, 25 → 150, 30 → 180 liegen auf der Geraden
`Summe(N) = 6 N` — davon 5 N Modellkosten und **1 N Aufschlag**. Die Kontrollen
isolieren den Aufschlag exakt, weil sie **dieselbe** Modellzahl tragen:

| Paar | mit Shield | ohne Shield | Differenz | erwartet (`N × increment`) |
|------|-----------:|------------:|----------:|---------------------------:|
| 20 Modelle (01 ↔ 04) | 120 | 100 | **20** | 20 × 1 = **20** |
| 30 Modelle (03 ↔ 05) | 180 | 150 | **30** | 30 × 1 = **30** |

Ein **konstanter** Zuschlag (einmalig 1 pt) ergäbe in beiden Paaren 1; ein
Aufschlag „je Modell-**Auswahl**" statt je Modell ebenfalls 1; ein doppelt
gerechneter Aufschlag ergäbe 40 bzw. 60. Alle drei Fehlrechnungen brechen die
`actual`-Zusagen.

### Heavy Cavalry (Roster 06)

| Auswahl | Quelle der pts-Kosten | pts |
|---------|------------------------|----:|
| Einheit „Heavy Cavalry" `18a2-7e02-a130-068f` | Eintrag, `value="0"` | 0 |
| 8 × Modell „Heavy Cavalry" `b576-acc9-fc91-617b` | Eintrag, `value="19"` | 152 |
| Lance (Link `7a86-8518-80b8-f0bc` → `.gst 8649-…`) | Ziel, `value="0"` | 0 |
| Hand Weapon (Link `d882-cea2-9251-571b` → `.gst abdb-…`) | Ziel, `value="0"` | 0 |
| Heavy Armour (Link `518c-9dd7-529a-6c46` → `.gst dde4-…`) | Ziel, `value="0"` | 0 |
| Shield (Link `f40b-e44a-da6e-1ee0` → `.gst 50e2-…`) | Ziel, `value="0"` — **dieser** Link trägt **keinen** Modifikator | 0 |
| Warhorse (Link `a93d-c22a-b4d7-3fa4` → `3134…1f465`) | Ziel, `value="0"` | 0 |
| **Barding** (Link `19d1-de95-644d-00a7`) | Link `0` + 8 × `increment 2` | **16** |
| **Summe** | | **168** |

Der Kontrast zu (A) ist der Punkt: **dieselbe** `repeat`-Zelle (`value="1"`,
`repeats="1"`), aber `increment 2` statt `increment 1` — die Anwendungs**zahl**
kommt aus der Modellzahl, der **Betrag** je Anwendung aus dem `increment`. Bei
8 Modellen also 16 statt 8 pts.

Pflicht-Kinder der Heavy Cavalry (damit die Roster ausser der gepinnten Grenze
nichts Unnötiges reissen): Lance `5b41-8b42-ed3c-92a9`, Hand Weapon
`f1b8-305e-3543-0cdf`, Heavy Armour `2766-029b-dfb4-a2b7`, Shield
`25b4-961d-adac-a9fe`, Warhorse `0bdf-eb0b-7c64-1b49` (je `min 1`), Modelle
`b07b-fa16-2c95-94d3` (`min 5`).

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle laufen gegen
**denselben** Datensatz (`.gst` + O&G-`.cat` + Mercenaries-`.cat`) und dasselbe
Kontingent „Standard (OG-AB)". In den Rostern 01–05 ist die **Modellzahl** die
einzige bzw. — bei den Kontrollen — die zweite Variable.

> **Assertion-Fokus:** die Budget-Grenze `budget::ecfa-8486-4f6c-c249` mit
> **exaktem `actual`**, die Shield-Pflichtgrenze `e6d2-9b61-a635-cd51`, die
> übrigen Grenzen des berührten Korpus als `absent`, die Slot-Stände, die die
> Herleitung tragen (Modellzahl, Shield/Barding-Stand, Manbiters-Obergrenze),
> und für jedes Roster die Abwesenheit von `UNSUPPORTED_REPEAT` sowie von
> `UNRESOLVED_SCOPE` mit `scope="unit"`. Andere Armeeaufbau-Diagnosen
> (General-/Core-Pflicht des `.gst`, Kategorie-Slots, die bedingten
> Untergrenzen am Schalter „Allow experimental rules?") dürfen zusätzlich
> auftreten und sind hier ohne Belang.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators | Fixture |
|---|-----------|----------------|------------------------------------|---------|
| 01 | Aufschlag bei **20** Modellen | Manbiters, 20 Modelle, Shield + Pflichtausrüstung, Unit-slot „Rare", Schalter; Limit **119**. | `budget::ecfa-8486-4f6c-c249` feuert **Ist 120 / Grenze 119** (UMR-R1). Shield-Slot: Ist 1, min 1, max 1, blockiert; Modell-Slot: Ist 20, min 20, kein Maximum; Manbiters-Slot: Ist 1, **max 1** (der Schalter hebt `30f0-…` von 0 auf 1, UMR-R7). Weder `e6d2-…`/`184f-…`/`61e6-…` noch `5194-…`/`9eae-…`/`30f0-…`/`ca73-…`/`c867-…` feuern. | [`01-manbiters-20-shield.ros`](rosters/01-manbiters-20-shield.ros) |
| 02 | Aufschlag bei **25** Modellen | Byte-gleich zu 01, `number="25"`; Limit **149**. | Budget feuert **Ist 150 / Grenze 149**. Der Aufschlag ist um 5 gewachsen — genau die Differenz der Modellzahlen (UMR-R2). | [`02-manbiters-25-shield.ros`](rosters/02-manbiters-25-shield.ros) |
| 03 | Aufschlag bei **30** Modellen | Byte-gleich zu 01, `number="30"`; Limit **179**. | Budget feuert **Ist 180 / Grenze 179**. Dritte Stützstelle: 20/25/30 → 120/150/180 (UMR-R2). | [`03-manbiters-30-shield.ros`](rosters/03-manbiters-30-shield.ros) |
| 04 | **Kontrolle** zu 01: kein Shield | 20 Modelle, Shield **nicht** gewählt; Limit **99**. | Budget feuert **Ist 100 / Grenze 99** (kein Aufschlag, UMR-R3) **und** `e6d2-9b61-a635-cd51` feuert **Ist 0 / Grenze 1** (UMR-R4). Der Shield-Slot ist ein **Pflicht-Anker** (`mandatoryPhantom`, Ist 0, min 1). Differenz zu 01: **exakt 20**. | [`04-manbiters-20-no-shield.ros`](rosters/04-manbiters-20-no-shield.ros) |
| 05 | **Kontrolle** zu 03: kein Shield | 30 Modelle, Shield **nicht** gewählt; Limit **149**. | Budget feuert **Ist 150 / Grenze 149**; `e6d2-…` feuert **Ist 0 / Grenze 1**. Differenz zu 03: **exakt 30**. Zusammen mit 04 belegt das: der Aufschlag **wächst** mit der Modellzahl. | [`05-manbiters-30-no-shield.ros`](rosters/05-manbiters-30-no-shield.ros) |
| 06 | Zweite Fundstelle: Barding, `increment 2` | Heavy Cavalry, 8 Modelle, Pflichtausrüstung + Warhorse mit Barding; Limit **167**. | Budget feuert **Ist 168 / Grenze 167** (UMR-R8): 152 Modelle + 8 × 2 Barding. Barding-Slot: Ist 1, max 1, blockiert; Modell-Slot: Ist 8, min 5, kein Maximum. Keine der Pflicht-/Obergrenzen der Einheit feuert. | [`06-heavy-cavalry-8-barding.ros`](rosters/06-heavy-cavalry-8-barding.ros) |

### Warum die `actual`-Zusage beidseitig scharf ist

Die Budget-Grenze feuert bei **strikter** Überschreitung, und ihr `actual` ist
die verplante Gesamtsumme (UMR-R9). Das Limit steht je Roster genau eine Einheit
darunter. Damit fällt jede Fehlrechnung auf:

| Fehlrechnung der Engine | Summe in Roster 01 | Ergebnis |
|-------------------------|-------------------:|----------|
| Wiederholung gar nicht angewandt | 100 | Budget bleibt still → Fall bricht |
| Wiederholung genau einmal angewandt | 101 | Budget bleibt still → Fall bricht |
| je Modell-**Auswahl** statt je Modell gezählt | 101 | Budget bleibt still → Fall bricht |
| Basis = `.gst`-Definitionskosten statt Link-Auflösung (nur bei 06 verschieden) | 174 statt 168 | `actual` weicht ab → Fall bricht |
| Aufschlag doppelt gerechnet | 140 | `actual` weicht ab → Fall bricht |

### Was bewusst **nicht** als feuernde Grenze erwartet wird

| Facette | Warum nicht im Bericht |
|---------|------------------------|
| **Der Kostenaufschlag selbst.** Eine Kostenart hat kein eigenes Feld in der Slot-Projektion (`expect.capabilities` kennt Stände und Grenzen, keine Kosten). | Deshalb wird der Aufschlag **indirekt** über die roster-weite Budget-Regel `budget::ecfa-8486-4f6c-c249` beobachtet (UMR-R9) — dieselbe Technik wie in [`unit-scope-per-model-cost`](../unit-scope-per-model-cost/README.md) und [`parent-scope-per-model-cost`](../parent-scope-per-model-cost/README.md). `budget::…` ist **kein** Katalog-Constraint, sondern die Engine-eigene Regel aus dem `<costLimits>`-Block des Rosters. |
| **Autor-Meldung „Please enable ‚Allow experimental rules?'"** am Manbiters-Eintrag (`modifier type="add" … field="error"` mit `lessThan 1 … childId="8b76-…"`). | Eigene Herkunft (`authorMessage`), keine abgeleitete Grenze. In allen Manbiters-Rostern hält die Bedingung ohnehin nicht, weil der Schalter gesetzt ist. Hier weder als vorhanden noch als abwesend behauptet. |
| **Sichtbarkeit** — die `set hidden`-Modifikatoren im Umfeld (z. B. die verborgene Gruppe „Magic Banners (Common)" `0132-a7c0-8366-be6e` unter dem Heavy-Cavalry-Standartenträger). | Als **Verfügbarkeit** (`field="hidden"`) modelliert, nicht als zählende Schranke — der Verletzungsbericht kodiert zählende Grenzen (gleiche Abgrenzung wie in [`vampire-bloodlines`](../vampire-bloodlines/README.md), VBL-R4/R5). |
| **Profilwerte** — die `Sv`-Modifikatoren am Heavy-Cavalry-Modellprofil (`decrement` je nach Heavy Armour / Warhorse / Barding / Shield). | Profilwerte stehen nicht im Verletzungsbericht; sie sind hier auch nicht Gegenstand. |
| **Kategorie-Slots und Armeeaufbau** (General-/Core-Pflicht der `.gst`, Rare-Kontingent der Kategorie). | Nebengeräusch: in allen sechs Rostern identisch bzw. für den Kontrast belanglos; die Erwartung ist selektiv. |

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Spielsystem WHFB 6th definitive | `0d13-7737-ea86-4662` |
| Katalog **Orcs and Goblins** / **Mercenaries** | `4049-c46d-7f80-44fb` / `fc47-8392-a6c8-452a` |
| `catalogueLink` O&G → Mercenaries | `b066-2f8e-11ee-1dce` |
| ForceEntry „Standard (OG-AB)" | `2bfa-e64a-7123-895f` |
| pts-Kostenart (`.gst`) | `ecfa-8486-4f6c-c249` |
| Budget-Grenze (Engine-Regel, roster-weit) | `budget::ecfa-8486-4f6c-c249` |
| SelectionEntry Einheit „Manbiters" (Mercenaries) | `0efb-7f63-7932-0655` — constraint `30f0-d417-2185-bf4a` (`max 0` → per Modifikator `1`) |
| `entryLink` „Manbiters" in O&G | `e3c2-1778-d3d5-edd1` |
| SelectionEntry Modell „Manbiters" (5 pts) | `45ff-9a9c-aa59-8c4c` — constraints `5194-0651-556d-8143` (`min 20`), `9eae-88c9-5c5d-8a07` (`max -1`) |
| Gruppe „Weapons and Armour" (Manbiters) | `7e37-3bee-16fc-5145` |
| **`entryLink` „Shield" (Träger des Modifikators, Fundstelle A)** | **`a7e5-d466-038a-a9d6`** → Ziel `50e2-1873-a856-03e7` — constraints `e6d2-9b61-a635-cd51` (`min 1`), `184f-af1f-b607-edf5` (`max 1`) |
| `.gst`-Eintrag „Shield" (Basiskosten 0, eigene Obergrenze) | `50e2-1873-a856-03e7` — constraint `61e6-14a6-8422-d83a` (`max 1`) |
| `entryLinks` Hand Weapon / Light Armour / Flail (Manbiters, je `min 1`/`max 1`, alle 0 pts) | `290f-b0ea-ed0f-27b4`→`abdb-bbd0-41b2-5dff` (`d408-ac61-4947-53b0`/`1d75-9f07-f069-61ad`), `9b6d-1a85-e5dc-f1c9`→`055f-8e4e-f170-35d2` (`06b3-15b0-df14-8539`/`cd92-3576-1bf9-69af`), `cc41-bc53-d81b-b58a`→`2eb9-be12-caec-57e8` (`dd0b-c746-367e-5b0a`/`7315-630d-250b-e5e7`) |
| Gruppe „Unit slot" (Manbiters) | `b63d-9c53-ef70-8723` — constraints `ca73-afca-79f9-bfb6` (`min 1`), `c867-2baf-38f7-8679` (`max 1`); gewählte Option „Rare" `75ab-2ebb-8c82-3286` |
| Schalter „Allow experimental rules?" (`.gst`, 0 pts) | `8b76-92c4-23f9-54b1` — `entryLink` in O&G `22a7-2e88-eaf1-49a9` |
| Katalog-Id „Ogre Kingdoms" (die `notInstanceOf`-Bedingung von UMR-R7) | `731d-5b13-2a92-5427` |
| SelectionEntry Einheit „Heavy Cavalry" (Mercenaries) | `18a2-7e02-a130-068f` — `entryLink` in O&G `ff40-df2f-b2d2-2afb` |
| SelectionEntry Modell „Heavy Cavalry" (19 pts) | `b576-acc9-fc91-617b` — constraints `b07b-fa16-2c95-94d3` (`min 5`), `f99b-486c-00f0-f2ef` (`max -1`) |
| Gruppen „Weapons and Armour" / „Mounts" (Heavy Cavalry) | `a705-3e2c-c128-ea34` / `fe73-2e49-792d-4474` |
| `entryLinks` Lance / Hand Weapon / Heavy Armour / Shield (Heavy Cavalry, je `min 1`) | `7a86-8518-80b8-f0bc` (`5b41-8b42-ed3c-92a9`), `d882-cea2-9251-571b` (`f1b8-305e-3543-0cdf`), `518c-9dd7-529a-6c46` (`2766-029b-dfb4-a2b7`), `f40b-e44a-da6e-1ee0` (`25b4-961d-adac-a9fe`) |
| `entryLink` Warhorse (`min 1`) → Ziel | `a93d-c22a-b4d7-3fa4` (`0bdf-eb0b-7c64-1b49`) → `313455d3-3643-49fe-b5e6-a2260731f465` |
| **`entryLink` „Barding" (Träger des Modifikators, Fundstelle B; Link-Kosten 0)** | **`19d1-de95-644d-00a7`** → Ziel `3211-d836-02f1-01d0` — constraint `7c9a-8406-5f84-70a4` (`max 1`); `.gst`-Definition: 6 pts + eigene Obergrenze `ffd4-6f1b-e014-6708` |
| „Border Patrols rules" (`set 25` auf beide Modell-Obergrenzen; in **keinem** Roster enthalten) | `4e15-0353-165f-5528` |

*(`budget::ecfa-8486-4f6c-c249` sowie die Diagnose-Arten `UNSUPPORTED_REPEAT`
und `UNRESOLVED_SCOPE` sind keine Katalog-Bausteine, sondern Schlüssel des
Manifest-Vertrags — vgl. [`orcs-and-goblins-budget`](../orcs-and-goblins-budget/README.md)
und [`parent-scope-per-model-cost`](../parent-scope-per-model-cost/README.md).)*
