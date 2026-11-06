# E2E-Regeln & Testkatalog: `repeat scope="unit"` mit **Eintrags-`childId`** — der Aufschlag zaehlt nur die Ritter der **eigenen** Einheit

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln,
Constraint-Ids, Punktebetraege und Erwartungswerte sind **ausschliesslich aus den
Katalogdaten** der *6th Definitive Edition* und der Formatspezifikation
([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md), §7.2,
§7.5, §7.6 und der [Kasten `scope="unit"`](../../battlescribe/building-blocks/modifier.md#scopeunit-und-scopeancestor--die-umschließende-einheit-und-die-vorfahrenkette)
in §7.7) abgeleitet. Die Roster-Form folgt den bereits verifizierten Szenarien
(direktes `entryId` bzw. `entryId` + `entryLinkId`, `entryGroupId` fuer
Gruppenmitglieder, verschachtelte `selections` mit `number`).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armeebuch: `The Empire (6th definitive edition).cat` (`3938-8369-a300-4a03`,
  rev 1) — Kontingent **„Standard (EM-AB)"** `e821-88b8-2071-6b6a`
- Soeldner-Bibliothek: `Mercenaries (6th definitive edition).cat`
  (`fc47-8392-a6c8-452a`, `library="true"`) — **nicht** Fundort der geprueften
  Zelle, aber die einzige `catalogueLink`-Abhaengigkeit, die das Armeebuch
  deklariert (`<catalogueLink … id="7773-ecbb-5fb9-eb56" targetId="fc47-8392-a6c8-452a"/>`,
  `The Empire (…).cat:15537-15539`) und deshalb Teil des Datensatzes.

> **Abgrenzung zu den Schwester-Szenarien.**
> [`unit-scope-per-model-cost`](../unit-scope-per-model-cost/README.md) und
> [`unit-model-repeat-shield-markup`](../unit-model-repeat-shield-markup/README.md)
> pinnen dieselbe `repeat`-Zelle mit dem **Typ-Schluesselwort**
> `childId="model"`, einem Traeger **direkt** unter der Einheit bzw. eine Ebene
> darunter und jeweils **einer** Einheit im Roster. Dieses Szenario setzt drei
> Stufen darueber an:
> 1. `childId` ist eine **konkrete Eintrags-Id** (`7b8d-8405-0e74-9f46`), kein
>    Typ-Schluesselwort — gezaehlt wird ein benannter Eintrag, nicht „alles vom
>    Typ Modell".
> 2. Der Traeger haengt **drei** Nicht-Einheit-Ebenen unter der Einheit; der
>    Rahmen muss ueber `upgrade` → `upgrade` → `upgrade` hinweg bis zum
>    naechsten `type="unit"` hochlaufen.
> 3. Ein Roster enthaelt **zwei** Regimenter derselben Definition — erst damit
>    ist „die **umschliessende** Einheit" von „irgendeine Einheit im
>    Kontingent" unterscheidbar.

---

## Worum es geht

Ein `<repeat>` an einem `modifier` bewirkt, dass der Modifikator **mehrfach**
angewendet wird ([§7.7](../../battlescribe/building-blocks/modifier.md#repeat--modifier-mehrfach-anwenden)).
Steht die Wiederholung auf `field="selections" scope="unit"`, ist ihr
Bezugsrahmen der **naechste Vorfahre mit `type="unit"`, den Traeger
eingeschlossen** ([Kasten `scope="unit"`](../../battlescribe/building-blocks/modifier.md#scopeunit-und-scopeancestor--die-umschließende-einheit-und-die-vorfahrenkette)).
Auf einen `increment` einer Kostenart angewandt, ist der Aufschlag damit eine
**Gerade durch den Ursprung** — mit der Zahl der gezaehlten Auswahlen **dieser
einen Einheit** als Laufvariable.

Der Kern, woertlich aus `The Empire (6th definitive edition).cat:11812-11820`:

```xml
<entryLink import="true" name="Exemplars of Sigmar (Knights)" hidden="false"
           id="dcf8-3a0e-7f04-4dd4" type="selectionEntry" targetId="8c35-c7e7-0a70-7a90">
  <modifiers>
    <modifier type="increment" value="2" field="ecfa-8486-4f6c-c249">
      <repeats>
        <repeat value="1" repeats="1" field="selections" scope="unit"
                childId="7b8d-8405-0e74-9f46" shared="true" roundUp="false"
                includeChildSelections="true"/>
      </repeats>
    </modifier>
  </modifiers>
</entryLink>
```

Lesart der Attribute:

- **`field="ecfa-8486-4f6c-c249"`** ist die **pts-Kostenart** der `.gst`
  ([§5.3](../../battlescribe/files/game-system.md#53-cost-types-kostenarten)) — der
  Modifikator aendert also die **Kosten** der Exemplars-Auswahl, keinen
  Constraint.
- **Basis der Rechnung ist 0 pts:** weder der `entryLink` `dcf8-…` noch seine
  Zieldefinition `8c35-c7e7-0a70-7a90` (`.cat:11704-11712`) traegt einen
  `<costs>`-Block.
- **`scope="unit"`** ist der Bezugsrahmen der Wiederholung. Traeger ist die
  Exemplars-Auswahl (`type="upgrade"`); ueber ihr stehen „Knightly advantages"
  `e82b-32bf-6032-2d30` (`upgrade`), „Custom Knightly Order (WD#310(UK)"
  `0bd1-8b50-44e0-6fc7` (`upgrade`) und erst dann die Einheit „Knights of the
  Knightly Orders" `1d77-9e6e-a6ab-573f` (`type="unit"`). Der Rahmen ist also
  aufgeloest — kein `UNRESOLVED_SCOPE`.
- **`childId="7b8d-8405-0e74-9f46"`** ist **keine** Typ-Angabe, sondern die Id
  des `selectionEntry` „Knight" (`type="model"`, 23 pts), des einzigen
  Modell-Eintrags der Einheit (`.cat:2029-2049`). Gezaehlt wird also genau
  dieser Eintrag mit seinem `number` — Shield, Lance, Hand Weapon, Full Plate
  Armour, Empire Warhorse und die Order-Kette sind andere Eintraege und zaehlen
  nicht.
- **`includeChildSelections="true"`** erweitert die Zaehlung auf verschachtelte
  Auswahlen unterhalb des Rahmens; hier ohne Unterschied, weil die Ritter
  direkte Kinder der Einheit sind.
- **`value="1" repeats="1" roundUp="false"`**: je 1 gezaehltem Ritter 1
  Anwendung — `floor(N / 1) x 1 = N` Anwendungen von `increment 2`.

Daraus folgt die **Geradengleichung** des Vorteils:
`Exemplars-Kosten(N) = 0 + N x 2 = 2 N pts`.

### Wo der Traeger im Katalog haengt

```
selectionEntry "Knights of the Knightly Orders" (1d77-9e6e-a6ab-573f, type="unit", Core)
 ├ selectionEntry "Knight" (7b8d-8405-0e74-9f46, type="model", 23 pts, min 5 / max -1)
 ├ selectionEntryGroup "Weapons and Armour" (f1bb-0dde-c39a-d0e1)
 ├ entryLink "Empire Warhorse" (aaf2-8dbc-b925-fac5, min 1 / max 1)
 └ selectionEntryGroup "Knightly Order" (06b5-8412-53d1-49ac, max 1 self / min 0 parent)
      └ entryLink "Custom Knightly Order (WD#310(UK)" (e628-04ab-0a07-b37c)
           → selectionEntry 0bd1-8b50-44e0-6fc7 (type="upgrade", hidden, max 2 parent)
                └ selectionEntry "Knightly advantages" (e82b-32bf-6032-2d30, max 1 parent)
                     └ entryLink "Exemplars of Sigmar (Knights)" (dcf8-3a0e-7f04-4dd4)
                          modifier increment 2 auf ecfa-8486-4f6c-c249
                            repeat selections / scope=unit / childId=7b8d-… / value=1 / repeats=1
```

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **USRK-R1** | **Der Vorteil „Exemplars of Sigmar" kostet 2 pts je Ritter-Modell der Einheit.** Bei N Rittern also 2 N pts; Basis sind 0 pts. | `The Empire (…).cat:11812-11820` → `entryLink` **`dcf8-3a0e-7f04-4dd4`** (Ziel `8c35-c7e7-0a70-7a90`) → `modifier type="increment" value="2" field="ecfa-8486-4f6c-c249"` mit `repeat value="1" repeats="1" field="selections" scope="unit" childId="7b8d-8405-0e74-9f46" shared="true" roundUp="false" includeChildSelections="true"`. Weder Link noch Ziel tragen `<costs>` → Basis 0. |
| **USRK-R2** | **Der Aufschlag ist linear, nicht konstant.** Waechst die Ritterzahl um Δ, waechst der Aufschlag um genau Δ x 2 pts. | Folgt aus USRK-R1: der Zaehlwert des `repeat` ist die Ritterzahl selbst, `value="1"`/`repeats="1"` machen daraus 1:1 Anwendungen. Roster 01/02/03 (5/8/12 Ritter) liefern drei Stuetzstellen, die Kontrollen 04/05 den Nullpunkt bei derselben Ritterzahl. |
| **USRK-R3** | **Der Rahmen ist die umschliessende Einheit, nicht das Kontingent.** Stehen zwei Ritterregimenter im selben Kontingent, zaehlen fuer den Aufschlag **nur** die Ritter des Regiments, in dem der Traeger steht. | [Kasten `scope="unit"`](../../battlescribe/building-blocks/modifier.md#scopeunit-und-scopeancestor--die-umschließende-einheit-und-die-vorfahrenkette): „`unit` ist ein regulaerer Zaehlrahmen: der naechste **Vorfahre** — den Traeger der Query eingeschlossen — mit `type="unit"`". Ein Vorfahre ist eine Eigenschaft der **Instanz**, nicht der Definition; `shared="true"` verengt oder weitet einen so bestimmten Rahmen nicht (dieselbe Lesart wie beim idiomatischen Je-Modell-Aufschlag der Mercenaries — sonst kostete ein Schild Punkte je Modell **jeder** Einheit der Armee). Roster 06 macht den Unterschied messbar. |
| **USRK-R4** | **`childId` benennt hier einen Eintrag, kein Typ-Schluesselwort.** Gezaehlt wird der `selectionEntry` „Knight" `7b8d-8405-0e74-9f46` mit seinem `number`, nicht „alles vom Typ `model`". | `.cat:11816` (`childId="7b8d-8405-0e74-9f46"`) gegen `.cat:2029` (`<selectionEntry id="7b8d-8405-0e74-9f46" name="Knight" … type="model">`). In dieser Einheit fallen beide Lesarten zusammen — sie hat genau einen Modell-Eintrag —, weshalb die Roster den Unterschied bewusst **nicht** zu trennen versuchen; die Zelle ist die Eintrags-`childId`. |
| **USRK-R5** | **Ohne den Traeger kein Aufschlag.** Ist „Exemplars of Sigmar" nicht gewaehlt, entfaellt der Modifikator vollstaendig — auch dann, wenn die Kette „Custom Knightly Order → Knightly advantages" steht. | Der Modifikator haengt am `entryLink` `dcf8-…` selbst; ohne diese Auswahl gibt es keine Kostenzeile, auf die er wirkte ([§7.2](../../battlescribe/building-blocks/links.md#72-entry-link-info-link-category-link)). Roster 04. |
| **USRK-R6** | **Der Aufschlag haengt am Exemplars-Link, nicht am Vorhandensein eines Vorteils.** „Blessed (Knights)" ist der einzige Vorteilseintrag der Gruppe **ohne** `repeat`-Modifikator und kostet ueber seinen Link 0 pts — obwohl die geteilte Definition 1 pt traegt (Kosten am Link gehen vor). | `.cat:11807-11811` (`entryLink e5dd-925e-7519-badf`, `<cost name="pts" … value="0"/>`, keine `<modifiers>`) gegen `.cat:11559-11572` (`selectionEntry e252-623d-12ed-6efd`, `<cost name="pts" … value="1"/>`). Zum Vorrang der Link-Kosten [§7.2](../../battlescribe/building-blocks/links.md#72-entry-link-info-link-category-link). Roster 05. |
| **USRK-R7** | **Die Ritterzahl ist nach unten auf 5 gebunden und nach oben unbegrenzt.** 5/8/12 Ritter sind daher alle legal. | `selectionEntry "Knight"` `7b8d-…` → **`24bb-871e-6aa3-e4b5`** (`min 5 scope="parent" shared="false"`) und **`9941-5a64-0bde-add3`** (`max -1 scope="parent"`, Kommentar `BP`). `-1` = unbegrenzt, solange kein `set` greift ([§7.6](../../battlescribe/building-blocks/constraint.md#76-constraint), Sentinel-Kasten; der einzige `set 25` haengt an „Border Patrols rules" `4e15-0353-165f-5528`, die in keinem Roster dieses Szenarios steht). |
| **USRK-R8** | **Die Pflichtausruestung der Einheit ist Shield, Lance, Hand Weapon, Full Plate Armour und Empire Warhorse (je `min 1`/`max 1`), alle 0 pts;** die „Cavalry hammer "-Option ist `min 0` und bleibt aussen vor. Deshalb traegt jedes Roster genau diese fuenf Auswahlen — und die Summe besteht ausser dem Aufschlag nur aus Ritterkosten. | Gruppe „Weapons and Armour" `f1bb-0dde-c39a-d0e1` → Links `9ccc-ad24-583e-41e0` (min `1e3a-4402-70e8-2b08`, max `58c4-d930-895a-0b74`), `e082-13b2-e746-34e0` (min `f0ce-7b2e-0be1-9dd1`, max `128a-6411-f218-72fc`), `d2a3-c146-1dbb-118f` (min `50ac-f86f-cfa1-d050`, max `9368-e62e-157c-023e`), `8757-aa59-69fa-1060` (min `8d09-7d84-af64-cb83`, max `e635-0971-2920-856c`), `9a71-cb61-06fb-005a` (min `f78b-9ad2-c515-7c0a` = 0, `hidden="true"`); dazu `entryLink` „Empire Warhorse" `aaf2-8dbc-b925-fac5` (min `22cd-67c5-1c2c-2266`, max `ae52-6868-5949-892c`). pts-Werte: `.gst` `50e2-…`/`8649-…`/`abdb-…` je 0, `The Empire` `199f-b4b9-aaca-490f`/`a1e3-7f97-5fc6-abaa` je 0. |
| **USRK-R9** | **Die force-skopierte Obergrenze der Einheit ist im Standard-Kontingent aufgehoben und darf nicht feuern.** Roh steht `max 0`; ein `set -1` hebt sie fuer **jedes** Kontingent auf, das **nicht** „Emperor's Guard (EM-AB)" ist. | `selectionEntry 1d77-…` → constraint **`2943-aa1c-4532-4fb2`** (`type="max" value="0" field="selections" scope="force" includeChildSelections="true"`, mit `message`-Attribut) → `modifier type="set" value="-1"` mit `condition type="notInstanceOf" scope="force" childId="9d76-5d25-ce1d-1d12"` (`.cat:2130-2134`). Die Roster nutzen „Standard (EM-AB)" `e821-88b8-2071-6b6a` ≠ `9d76-…`, also greift der `set -1` (kanonische `forceEntry`-Kodierung, [§7.7](../../battlescribe/building-blocks/modifier.md#77-modifier-condition-condition-group-repeat)). Die uebrigen Modifikatoren derselben Grenze sind an „Emperor's Guard" bzw. „Army of Middenland (SoC)" `6b0d-2c9f-2d46-b330` gebunden und greifen hier nicht. |
| **USRK-R10** | **Die Order-Kette ist roh verborgen** (`hidden="true"`) **und wird erst durch den Schalter „Allow experimental rules from White-Dwarf and Citadel Journal issues" aufgedeckt.** Deshalb traegt jedes Roster diesen Schalter (0 pts) unter „Allow experimental rules?" (0 pts). | `selectionEntry 0bd1-8b50-44e0-6fc7` (`hidden="true"`) → `modifier type="set" value="false" field="hidden"` mit `condition atLeast 1 selections scope="force" childId="cc03-e8fe-c143-6863" includeChildSelections="true"` (`.cat:11937-11943`). `cc03-…` ist ein Kind des `.gst`-Schalters `8b76-92c4-23f9-54b1` (`.gst:1878-1895`), in The Empire per `entryLink` `2961-128d-196e-c6c6` waehlbar; beide ohne pts-Kosten. Derselbe Link traegt `min 0` **`30c1-0e8a-ca51-3eee`**, das per `set 1` zur Pflicht wird, sobald `e628-04ab-0a07-b37c` im Kontingent steht (`.cat:15833`) — der Schalter ist also ohnehin Pflicht, sobald die Order gewaehlt ist. |
| **USRK-R11** | **Beobachtbar wird die Summe ueber die roster-weite Budget-Regel.** Eine Kostenart hat kein eigenes Feld in der Slot-Projektion; die verplante Gesamtsumme steht dagegen im `actual` der Budget-Verletzung `budget::ecfa-8486-4f6c-c249`, die bei **strikter** Ueberschreitung des eingestellten `<costLimits>`-Wertes feuert. | Belegt an den bestehenden Szenarien [`orcs-and-goblins-budget`](../orcs-and-goblins-budget/README.md) (Roster 04: Ist 150 / Grenze 100; Roster 05: Summe = Limit → still) sowie [`unit-scope-per-model-cost`](../unit-scope-per-model-cost/README.md) und [`unit-model-repeat-shield-markup`](../unit-model-repeat-shield-markup/README.md). Das Punktelimit steht hier je Roster **eine Einheit unter** der korrekten Summe, damit `actual` die Summe exakt traegt. |

---

## Die Punkte-Arithmetik je Roster

Alle Kostenzeilen stammen aus den oben belegten Elementen. Eintraege **ohne**
`<costs>`-Block zaehlen 0 (Einheit `1d77-…` traegt ausdruecklich `pts 0`;
`0bd1-…`, `e82b-…`, `8c35-…` und `cc03-…` haben keinen Block).

| Auswahl | Quelle der pts-Kosten | 5 Ritter | 8 Ritter | 12 Ritter |
|---------|------------------------|---------:|---------:|----------:|
| Schalter „Allow experimental rules?" `8b76-…` (+ Unterpunkt `cc03-…`) | `.gst`, `value="0"` (bzw. kein Block) | 0 | 0 | 0 |
| Einheit „Knights of the Knightly Orders" `1d77-…` | Eintrag, `value="0"` | 0 | 0 | 0 |
| Modell „Knight" `7b8d-…` | Eintrag, `value="23"` x `number` | 115 | 184 | 276 |
| Shield (Link `9ccc-…` → `.gst 50e2-…`) | Ziel, `value="0"` | 0 | 0 | 0 |
| Lance (Link `e082-…` → `.gst 8649-…`) | Ziel, `value="0"` | 0 | 0 | 0 |
| Hand Weapon (Link `d2a3-…` → `.gst abdb-…`) | Ziel, `value="0"` | 0 | 0 | 0 |
| Full Plate Armour (Link `8757-…` → `199f-…`) | Ziel, `value="0"` | 0 | 0 | 0 |
| Empire Warhorse (Link `aaf2-…` → `a1e3-…`) | Ziel, `value="0"` | 0 | 0 | 0 |
| Custom Knightly Order `0bd1-…` + „Knightly advantages" `e82b-…` | kein `<costs>` → 0 | 0 | 0 | 0 |
| **Exemplars of Sigmar** (Link `dcf8-…`) | Basis `0` + N x `increment 2` | **10** | **16** | **24** |
| **Summe mit Exemplars** | | **125** | **200** | **300** |
| **Summe ohne Exemplars** (Kontrollen 04/05) | | — | **184** | — |

Die drei Stuetzstellen 5 → 125, 8 → 200, 12 → 300 liegen auf der Geraden
`Summe(N) = 25 N` — davon 23 N Ritterkosten und **2 N Aufschlag**. Die
Kontrollen isolieren den Aufschlag exakt, weil sie **dieselbe** Ritterzahl
tragen:

| Paar | mit Exemplars | ohne | Differenz | erwartet (`N x increment`) |
|------|--------------:|-----:|----------:|---------------------------:|
| 8 Ritter (02 ↔ 04, „Knightly advantages" leer) | 200 | 184 | **16** | 8 x 2 = **16** |
| 8 Ritter (02 ↔ 05, Vorteil „Blessed" statt Exemplars) | 200 | 184 | **16** | 8 x 2 = **16** |

### Roster 06 — zwei Regimenter, ein Traeger

| Auswahl | pts |
|---------|----:|
| Regiment A: Einheit 0 + 5 x 23 Ritter + Pflichtausruestung 0 + Order-Kette 0 | 115 |
| Regiment A: **Exemplars** = 5 x 2 | **10** |
| Regiment B: Einheit 0 + 8 x 23 Ritter + Pflichtausruestung 0 (kein Knightly Order) | 184 |
| **Summe** | **309** |

Der Punkt dieses Rosters ist die Zahl, die **nicht** herauskommen darf: zaehlte
die Wiederholung ueber das Kontingent statt ueber die Einheit, waeren es
13 Ritter und damit 26 pts Aufschlag — Summe 325.

### Warum die `actual`-Zusage beidseitig scharf ist

Die Budget-Grenze feuert bei **strikter** Ueberschreitung, und ihr `actual` ist
die verplante Gesamtsumme (USRK-R11). Das Limit steht je Roster genau eine
Einheit darunter. Damit faellt jede Fehlrechnung auf:

| Fehlrechnung der Engine | Summe in Roster 01 / 06 | Ergebnis |
|-------------------------|------------------------:|----------|
| Wiederholung gar nicht angewandt (Rahmen unaufgeloest) | 115 / 299 | Budget bleibt still → Fall bricht |
| Wiederholung genau einmal angewandt | 117 / 301 | Budget bleibt still → Fall bricht |
| je Ritter-**Auswahlzeile** statt je Ritter gezaehlt | 117 / 301 | Budget bleibt still → Fall bricht |
| Rahmen = Kontingent statt Einheit | 125 / **325** | Roster 06 weicht ab → Fall bricht |
| Aufschlag doppelt gerechnet | 135 / 319 | `actual` weicht ab → Fall bricht |
| `set -1` auf `2943-…` uebersehen | — | `2943-aa1c-4532-4fb2` feuert → `absent` verletzt |
| Link-Kosten von „Blessed" ignoriert (Definition 1 pt) | 185 in Roster 05 | `actual` weicht ab → Fall bricht |

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle laufen
gegen **denselben** Datensatz (`.gst` + The-Empire-`.cat` + Mercenaries-`.cat`)
und dasselbe Kontingent „Standard (EM-AB)". In den Rostern 01–05 ist die
**Ritterzahl** die einzige bzw. — bei den Kontrollen — die zweite Variable.

> **Assertion-Fokus:** die Budget-Grenze `budget::ecfa-8486-4f6c-c249` mit
> **exaktem `actual`**, die Abwesenheit der beruehrten Katalog-Grenzen
> (insbesondere der per `set -1` aufgehobenen Einheiten-Obergrenze
> `2943-aa1c-4532-4fb2`), die Slot-Staende, die die Herleitung tragen
> (Ritterzahl, Exemplars-/Blessed-Stand, Einheiten-Obergrenze), und je Roster
> die Abwesenheit von `UNSUPPORTED_REPEAT` sowie von `UNRESOLVED_SCOPE` mit
> `scope="unit"`. Andere Armeeaufbau-Diagnosen (General-/Core-Pflicht der
> `.gst`, Kategorie-Slots) duerfen zusaetzlich auftreten und sind hier ohne
> Belang.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators | Fixture |
|---|-----------|----------------|------------------------------------|---------|
| 01 | Aufschlag bei **5** Rittern (Mindestgroesse) | Ritterregiment, 5 Ritter, Pflichtausruestung, Order-Kette mit Exemplars, Schalter; Limit **124**. | `budget::ecfa-8486-4f6c-c249` feuert **Ist 125 / Grenze 124** (USRK-R1). Ritter-Slot: Ist 5, min 5, kein Maximum; Exemplars-Slot: Ist 1, max 1, blockiert; Einheiten-Slot: Ist 1, **kein Maximum** (der `set -1` hebt `2943-…` auf, USRK-R9). Keine der gelisteten Katalog-Grenzen feuert. | [`01-knights-5-exemplars.ros`](rosters/01-knights-5-exemplars.ros) |
| 02 | Aufschlag bei **8** Rittern | Byte-gleich zu 01, `number="8"`; Limit **199**. | Budget feuert **Ist 200 / Grenze 199**. Der Aufschlag ist um 6 gewachsen — genau 3 zusaetzliche Ritter x 2 (USRK-R2). | [`02-knights-8-exemplars.ros`](rosters/02-knights-8-exemplars.ros) |
| 03 | Aufschlag bei **12** Rittern | Byte-gleich zu 01, `number="12"`; Limit **299**. | Budget feuert **Ist 300 / Grenze 299**. Dritte Stuetzstelle: 5/8/12 → 125/200/300 (USRK-R2). | [`03-knights-12-exemplars.ros`](rosters/03-knights-12-exemplars.ros) |
| 04 | **Kontrolle** zu 02: Vorteil nicht gewaehlt | 8 Ritter, Order-Kette bis „Knightly advantages", aber **kein** Vorteil; Limit **183**. | Budget feuert **Ist 184 / Grenze 183** (kein Aufschlag, USRK-R5). Differenz zu 02: **exakt 16**. Die Vorteils-Obergrenze `5f81-…` bleibt bei Ist 0 still. | [`04-knights-8-no-advantage.ros`](rosters/04-knights-8-no-advantage.ros) |
| 05 | **Kontrolle** zu 02: anderer Vorteil ohne `repeat` | 8 Ritter, Vorteil **„Blessed (Knights)"** statt Exemplars; Limit **183**. | Budget feuert **Ist 184 / Grenze 183** (USRK-R6): der Blessed-Link setzt `pts 0` und traegt keinen Modifikator. Blessed-Slot: Ist 1, max 1, blockiert. Zusammen mit 04 ist belegt, dass der Aufschlag am **Exemplars-Link** haengt — und dass die **Link**-Kosten die 1 pt der Definition schlagen. | [`05-knights-8-blessed-control.ros`](rosters/05-knights-8-blessed-control.ros) |
| 06 | **Rahmen-Beweis:** zwei Regimenter | Regiment A: 5 Ritter **mit** Exemplars; Regiment B: 8 Ritter ohne Knightly Order; Limit **308**. | Budget feuert **Ist 309 / Grenze 308** (USRK-R3): der Aufschlag zaehlt **nur** die 5 Ritter der eigenen Einheit. Ein kontingentweiter Zaehlrahmen (13 Ritter) ergaebe 325, ein fehlender Rahmen 299 — beides bricht den Fall. Auch bei zwei Einheiten feuert `2943-…` nicht (USRK-R9). | [`06-two-units-only-carrier-unit-counts.ros`](rosters/06-two-units-only-carrier-unit-counts.ros) |

### Was bewusst **nicht** als feuernde Grenze erwartet wird

| Facette | Warum nicht im Bericht |
|---------|------------------------|
| **Der Kostenaufschlag selbst.** Eine Kostenart hat kein eigenes Feld in der Slot-Projektion (`expect.capabilities` kennt Staende und Grenzen, keine Kosten). | Deshalb wird der Aufschlag **indirekt** ueber die roster-weite Budget-Regel `budget::ecfa-8486-4f6c-c249` beobachtet (USRK-R11). `budget::…` ist **kein** Katalog-Constraint, sondern die Engine-eigene Regel aus dem `<costLimits>`-Block des Rosters. |
| **Sichtbarkeit** — `0bd1-8b50-44e0-6fc7` ist `hidden="true"` und wird per Modifikator aufgedeckt (USRK-R10); ebenso gattern die `set hidden`-Modifikatoren an `e628-…`, am Shield-/Lance-Link und an „Cavalry hammer " (`9a71-cb61-06fb-005a`). | Als **Verfuegbarkeit** (`field="hidden"`) modelliert, nicht als zaehlende Schranke — der Verletzungsbericht kodiert zaehlende Grenzen (gleiche Abgrenzung wie in [`vampire-bloodlines`](../vampire-bloodlines/README.md), VBL-R4/R5). Die Roster setzen den Schalter, damit die Kette regulaer waehlbar ist; behauptet wird ueber die Sichtbarkeit nichts. |
| **Namens- und Profil-Modifikatoren** der Einheit (die vielen `set … field="name"` am `infoLink` „Elite" und am Einheiteneintrag, `increment 1` auf `b690-4bc0-bb73-267b` = S bei „Knights of the Inner Circle"). | Profilwerte und Namen stehen nicht im Verletzungsbericht. Keiner ihrer Ausloeser (Inner Circle `6e1d-…`/`8229-…`, benannte Orden) ist in einem Roster dieses Szenarios gewaehlt. |
| **Autor-Meldung** am Constraint `2943-aa1c-4532-4fb2` („You must have at least one unit of Reiksguard for every unit of other Knights…"). | Sie haengt am `message`-Attribut **dieser** Grenze; da die Grenze per `set -1` aufgehoben ist, wird hier weder ihr Erscheinen noch ihr Ausbleiben behauptet. |
| **Kategorie-Slots und Armeeaufbau** (General-Pflicht der `.gst`, Core-Kontingent). | Nebengeraeusch: in allen sechs Rostern gleichartig und fuer den Kontrast belanglos; die Erwartung ist selektiv. |

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Spielsystem WHFB 6th definitive | `0d13-7737-ea86-4662` |
| Katalog **The Empire** / **Mercenaries** | `3938-8369-a300-4a03` / `fc47-8392-a6c8-452a` |
| `catalogueLink` The Empire → Mercenaries | `7773-ecbb-5fb9-eb56` |
| ForceEntry „Standard (EM-AB)" | `e821-88b8-2071-6b6a` |
| ForceEntry „Emperor's Guard (EM-AB)" (Bedingung des `set -1`, in **keinem** Roster benutzt) | `9d76-5d25-ce1d-1d12` |
| pts-Kostenart (`.gst`) | `ecfa-8486-4f6c-c249` |
| Budget-Grenze (Engine-Regel, roster-weit) | `budget::ecfa-8486-4f6c-c249` |
| SelectionEntry Einheit „Knights of the Knightly Orders" (Core `64bf-efb4-9978-26df`, 0 pts) | `1d77-9e6e-a6ab-573f` — constraint `2943-aa1c-4532-4fb2` (`max 0 scope="force"` → per `set -1` aufgehoben) |
| SelectionEntry Modell „Knight" (23 pts) | `7b8d-8405-0e74-9f46` — constraints `24bb-871e-6aa3-e4b5` (`min 5`), `9941-5a64-0bde-add3` (`max -1`) |
| Gruppe „Weapons and Armour" | `f1bb-0dde-c39a-d0e1` |
| `entryLinks` Shield / Lance / Hand Weapon / Full Plate Armour (je `min 1`/`max 1`, alle 0 pts) | `9ccc-ad24-583e-41e0`→`50e2-1873-a856-03e7` (`1e3a-4402-70e8-2b08`/`58c4-d930-895a-0b74`), `e082-13b2-e746-34e0`→`8649-8ac8-5a6f-fd8d` (`f0ce-7b2e-0be1-9dd1`/`128a-6411-f218-72fc`), `d2a3-c146-1dbb-118f`→`abdb-bbd0-41b2-5dff` (`50ac-f86f-cfa1-d050`/`9368-e62e-157c-023e`), `8757-aa59-69fa-1060`→`199f-b4b9-aaca-490f` (`8d09-7d84-af64-cb83`/`e635-0971-2920-856c`) |
| `entryLink` „Cavalry hammer " (`min 0`, `hidden="true"`; nicht gewaehlt) | `9a71-cb61-06fb-005a` — constraint `f78b-9ad2-c515-7c0a` |
| `entryLink` „Empire Warhorse" (`min 1`/`max 1`, 0 pts) → Ziel | `aaf2-8dbc-b925-fac5` (`22cd-67c5-1c2c-2266`/`ae52-6868-5949-892c`) → `a1e3-7f97-5fc6-abaa` (`0cda-8c44-bc6f-1e6a`) |
| Gruppe „Knightly Order" | `06b5-8412-53d1-49ac` — constraints `7944-27db-49ec-7bbd` (`max 1 scope="self"`), `21ca-c541-0b3d-6d4d` (`min 0 scope="parent"`) |
| `entryLink` „Custom Knightly Order (WD#310(UK)" → geteilter Eintrag (`hidden="true"`) | `e628-04ab-0a07-b37c` → `0bd1-8b50-44e0-6fc7` — constraint `9ff4-e65c-ebb1-1f3c` (`max 2 scope="parent"`) |
| SelectionEntry „Knightly advantages" | `e82b-32bf-6032-2d30` — constraint `5f81-d4a6-b74f-6fc3` (`max 1 scope="parent"`) |
| **`entryLink` „Exemplars of Sigmar (Knights)" (Traeger des Modifikators, keine eigenen Kosten)** | **`dcf8-3a0e-7f04-4dd4`** → Ziel `8c35-c7e7-0a70-7a90` — constraint `ee36-a6dc-84a1-51b7` (`max 1 scope="parent"`) |
| `entryLink` „Blessed (Knights)" (Kontrolle; Link `pts 0` gegen Definition `pts 1`) | `e5dd-925e-7519-badf` → Ziel `e252-623d-12ed-6efd` — constraint `407a-f9c7-b69d-9d28` (`max 1 scope="parent"`) |
| Schalter „Allow experimental rules?" (`.gst`, 0 pts) → `entryLink` in The Empire | `8b76-92c4-23f9-54b1` → `2961-128d-196e-c6c6` — constraint `30c1-0e8a-ca51-3eee` (`min 0` → per `set 1` Pflicht, sobald `e628-…` gewaehlt ist) |
| Unterpunkt „…from White-Dwarf and Citadel Journal issues" (`.gst`, deckt `0bd1-…` auf) | `cc03-e8fe-c143-6863` |
| „Border Patrols rules" (`set 25` auf die Ritter-Obergrenze; in **keinem** Roster enthalten) | `4e15-0353-165f-5528` |

*(`budget::ecfa-8486-4f6c-c249` sowie die Diagnose-Arten `UNSUPPORTED_REPEAT`
und `UNRESOLVED_SCOPE` sind keine Katalog-Bausteine, sondern Schluessel des
Manifest-Vertrags — vgl. [`orcs-and-goblins-budget`](../orcs-and-goblins-budget/README.md)
und [`unit-model-repeat-shield-markup`](../unit-model-repeat-shield-markup/README.md).
Die `absent`-Aussage ueber `UNRESOLVED_SCOPE` gilt berichtsweit fuer
`scope="unit"`, nicht nur fuer die hier gepruefte Wiederholung — sie folgt der
Konvention der Schwester-Szenarien.)*
