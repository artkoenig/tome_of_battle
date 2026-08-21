# E2E-Regeln & Testkatalog: `equalTo`-Bedingung (`scope="force"`, `childId` = Eintrag) — exakte Gleichheit statt „mindestens" (Gotrek & Felix)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln,
Constraint-Ids und Erwartungswerte sind **ausschließlich** aus den Katalogdaten
der *6th Definitive Edition* (`src/domain/evaluator/__fixtures__/whfb6-definitive/`)
und aus der Formatspezifikation
([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md),
§7.5/§7.6/§7.7) abgeleitet. Die Roster-Form folgt den bereits verifizierten
Szenario-Fixtures (direktes `entryId`, `entryLinkId=""`, geschachtelte
`selections` mit `number`).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armeebuch: `Orcs and goblins (6th definitive edition).cat`
  (`4049-c46d-7f80-44fb`, rev 1) — Kontingent **„Standard (OG-AB)"**
  `2bfa-e64a-7123-895f` (`:47`)
- Bibliothek: `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`,
  `library="true"`), per `catalogueLink` `b066-2f8e-11ee-1dce` aus dem
  Orcs-Katalog gefordert (`:14916`)

---

## Der gepinnte Mechanismus

Die **Bedingungszelle** `condition | equalTo | force | selectionCount |
child=id`: eine `condition type="equalTo"` mit `field="selections"`,
`scope="force"` und einer `childId`, die einen **Eintrag** benennt, zählt die
Selektionen dieses Eintrags im umschließenden Kontingent und hält **nur bei
exakter Gleichheit** mit ihrem `value` — nicht „mindestens". Genau darin
unterscheidet sie sich von `atLeast`, und genau das macht der dritte Roster
sichtbar.

Diese Zelle kommt im ganzen Fixture-Korpus **genau einmal** vor
(Mercenaries-`.cat` `:5538`; verifiziert über alle 28 `type="equalTo"`-Vorkommen
der fünf Dateien — das einzige weitere mit `scope="force"` misst
`field="limit::ecfa-8486-4f6c-c249"` mit `childId="any"`, `:9387`, ist also
keine Eintrags-Zählung). Träger ist der Sondercharakter **Gotrek Gurnisson &
Felix Jaeger**:

```
selectionEntry "Gotrek Gurnisson & Felix Jaeger"
               (ef9d-ae15-cc43-f2d6, type=unit, Mercenaries-.cat :5371,
                in <sharedSelectionEntries>)
  ├ constraint max 0 selections scope=roster   e3c5-278b-09bc-84cf   (:5533)
  │      shared=true  includeChildSelections=true  includeChildForces=true
  ├ modifier set 1 field=e3c5-278b-09bc-84cf                          (:5536)
  │    └ condition equalTo value=1 field=selections scope=force
  │         childId=8923-5946-7b10-8957                               (:5538)
  │         shared=true  includeChildSelections=false
  │         includeChildForces=false          ← DIESE ZELLE
  └ modifier add field=error                                          (:5541)
         value='Please enable "Allow special characters?"'
       └ condition lessThan value=1 field=selections scope=force
            childId=8923-5946-7b10-8957  shared=true
            includeChildSelections=true                               (:5543)

selectionEntry "Allow special characters?" (.gst :1935, type=upgrade,
       hidden="false", Wurzel-Eintrag)  = das gezählte Ziel
  ├ constraint max 1 selections scope=roster   5036-e10c-2fd8-f135    (:1937)
  ├ constraint min 0 selections scope=force    3d91-4deb-faa0-9996    (:1938)
  └ constraint min 0 selections scope=parent   77da-4055-647c-6978    (:1939)
```

**Zwei Gatter, eine Zählung, zwei Vergleichsarten.** Beide Modifikatoren des
Trägers zählen **dasselbe** `childId` im **selben** Rahmen (`selections`,
`scope="force"`) — der eine mit `equalTo 1`, der andere mit `lessThan 1`. Bei
einer Zählung von **2** fallen sie deshalb **auseinander**: `equalTo 1` fällt
(2 ≠ 1), `lessThan 1` fällt ebenfalls (2 ≮ 1). Das ist der Fingerabdruck der
Gleichheit — bei `atLeast 1` (der Form des Schwester-Eintrags, siehe unten)
hielte das erste Gatter bei 2 weiter.

### Abgrenzung zur `atLeast`-Form am Schwester-Eintrag

Derselbe Schalter gattert im selben Katalog die **„0-1 Amazon Serpent
Priestess"** (`9ddd-69c8-644d-abc2`) — dort aber als
`condition type="atLeast" value="1" … childId="8923-5946-7b10-8957"` auf die
Grenze `f706-5d39-7bf7-5f7b` (Mercenaries-`.cat` `:4771`/`:4776`). Beide Formen
sind bei Zählung 0 und 1 **ununterscheidbar**; erst bei 2 trennen sie sich.
Damit die Gleichheit isoliert bleibt, kommt die Priesterin in **keinem** der
drei Roster vor — die `atLeast`-Seite pinnen
[`add-info-and-warning-campaign-gate`](../add-info-and-warning-campaign-gate/README.md)
und [`at-least-force-toggle-gate`](../at-least-force-toggle-gate/README.md)
(dort an Greasus Goldtooth).

### Wie zwei Schalter-Selektionen in eine `.ros` geschrieben werden

Beide Kodierungen sind schreibbar; gewählt ist die **zweite Geschwister-
`<selection>` mit `number="1"`**:

| Kodierung | Zählung | Warum (nicht) gewählt |
|-----------|---------|------------------------|
| **zwei `<selection>`-Geschwister, je `number="1"`** *(gewählt)* | 2 unter **jeder** Lesart von `number` | Die Zählung „zwei Auswahlen sind zwei" hängt an **keiner** offenen Frage. Beide stehen als **direkte** Kinder des Kontingents, es gibt also auch keine Elternkette, die eine Stückzahl multiplizieren könnte ([§7.5, Kasten „Zahlenbasis"](../../battlescribe-data-format.md#75-cost--cost-type)). Dazu passt der Katalogwert `collective="false"` am Ziel (`.gst:1935`): ein nicht-kollektiver Eintrag wird als getrennte Instanzen geführt, nicht als gestapelte Zeile ([§7.1](../../battlescribe-data-format.md#71-selection-entry--selection-entry-group)). Dieselbe Form nutzt bereits [`roster-repeat-category-count`](../roster-repeat-category-count/README.md), Roster 03. |
| eine `<selection number="2">` | 2 **nur** unter der Lesart „`number` ist die absolute Gesamtstückzahl" | Diese Lesart ist im Korpus belegt und gepinnt (RRCC-R5 in [`roster-repeat-category-count`](../roster-repeat-category-count/README.md), Roster 05), die `.ros`-Semantik von `number` ist in [§7.5](../../battlescribe-data-format.md#75-cost--cost-type) aber ausdrücklich als **Lücke der Quelle** markiert. Zählte eine Auswertung Elemente statt Stückzahlen, ergäbe diese Kodierung **1** — und damit hielte `equalTo 1`, der Fall kippte in sein Gegenteil und pinnte nicht mehr die Gleichheit, sondern die `number`-Semantik. Deshalb hier vermieden: das ist die Frage eines **anderen** Szenarios. |

Die zweite Selektion hat einen **Preis**, der offen deklariert wird: der
Schalter trägt eine eigene Roster-Obergrenze `max 1`
(`5036-e10c-2fd8-f135`, `.gst:1937`), die dabei mit **Ist 2 / Grenze 1** feuert.
Sie steht in Roster 03 in `expect.firing` — sie zu verschweigen wäre eine
verdeckte Nebenwirkung.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **EFTC-R1** | Gotreks geschriebene Grenze ist **max 0** Selektionen im **Roster**-Rahmen — ohne Freischaltung ist die Einheit nirgends legal wählbar. | Mercenaries-`.cat` `:5533` — `constraint type="max" value="0" field="selections" scope="roster" shared="true" id="e3c5-278b-09bc-84cf" includeChildSelections="true" includeChildForces="true"` am `selectionEntry` `ef9d-ae15-cc43-f2d6` (`:5371`). |
| **EFTC-R2** | **Die Kernaussage:** Enthält das Kontingent **exakt eine** „Allow special characters?"-Selektion, wird diese Grenze per `set` auf **1** gesetzt. Bei **jeder anderen** Zahl — 0 **wie auch 2** — bleibt sie beim Basiswert **0**. `equalTo` ist eine Gleichheit, kein Mindestmaß. | Mercenaries-`.cat` `:5536-5539` — `modifier type="set" value="1" field="e3c5-278b-09bc-84cf"` mit **genau einer** `condition type="equalTo" value="1" field="selections" scope="force" childId="8923-5946-7b10-8957" shared="true" percentValue="false" includeChildSelections="false" includeChildForces="false"`. `equalTo` als Vergleichsart: [§7.7, Tabelle `condition`](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat). |
| **EFTC-R3** | Der gehobene bzw. nicht gehobene Wert ist auch der Wert, der im Verletzungsbericht erscheint: ein Gotrek (Ist 1) verletzt die Grenze bei **Grenze 0**, nicht aber bei **Grenze 1**. Kein weiterer Modifikator im ganzen Fixture-Satz adressiert `e3c5-278b-09bc-84cf`. | Verifiziert: die Id kommt im Fixture-Satz **genau zweimal** vor — die Constraint (`:5533`) und dieser eine `set` (`:5536`). |
| **EFTC-R4** | Die Zählung der Bedingung ist die **Stückzahl der Schalter-Selektionen des Kontingents**. `childId` nennt die **Ziel-Id** `8923-5946-7b10-8957` selbst (kein Link dazwischen), die Roster binden dieselbe Id direkt — die Auflösung ist unmittelbar. `includeChildSelections="false"` und `includeChildForces="false"` sind hier **wirkungslos**, weil der Schalter in allen Rostern **direktes** Kind des einen Kontingents ist. | `.gst:1935` (`selectionEntry id="8923-5946-7b10-8957"`, Wurzel-Eintrag, `type="upgrade"`, `hidden="false"`, `collective="false"`); `condition` `:5538`. Flag-Bedeutung: [§7.6](../../battlescribe-data-format.md#76-constraint). |
| **EFTC-R5** | **Die Autor-Meldung hat ein eigenes, anderes Gatter.** `modifier type="add" field="error"` trägt den Text `Please enable "Allow special characters?"` und hängt an `lessThan 1` auf **dasselbe** `childId` im **selben** Rahmen. Sie liegt daher **nur** bei Zählung 0 an — bei 1 **und** bei 2 nicht. | Mercenaries-`.cat` `:5541-5545` — `modifier type="add" value="Please enable &quot;Allow special characters?&quot;" field="error"` mit `condition type="lessThan" value="1" field="selections" scope="force" childId="8923-5946-7b10-8957" shared="true" includeChildSelections="true"`. `field="error"` trägt keinen Feldwert, sondern den Meldungstext: [§7.7, Kasten „Klartext-Hinweise an den Spieler"](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat). |
| **EFTC-R6** | **Das Trennkriterium.** Bei Zählung 2 fallen beide Gatter zugleich: die Grenze feuert **wieder** (Ist 1 / Grenze 0) **und** die Meldung bleibt **stumm**. Genau diese Kombination ist unter `atLeast 1` unmöglich — dort hielte das erste Gatter (2 ≥ 1) und die Grenze bliebe still. | Kombination aus EFTC-R2 und EFTC-R5; Gegenform am Schwester-Eintrag `9ddd-69c8-644d-abc2`: `constraint f706-5d39-7bf7-5f7b` (`:4771`) mit `modifier set 1` und `condition type="atLeast" value="1" … childId="8923-5946-7b10-8957"` (`:4774-4776`). |
| **EFTC-R7** | Der Schalter selbst trägt **max 1** im **Roster**-Rahmen. Eine Selektion ist zulässig, **zwei** verletzen diese Grenze mit **Ist 2 / Grenze 1**. Seine beiden `min 0`-Grenzen sind No-ops (Grenze 0, nie unterschritten); die zwei `set 0`-Modifikatoren darauf schreiben 0 auf 0 und sind zusätzlich auf die Kategorie „Special Characters" (`0644-bfcd-32c2-21dc`) gegatet, die Gotrek **nicht** führt. | `.gst:1937` (`5036-e10c-2fd8-f135`, `type="max" value="1" scope="roster" includeChildSelections="true" includeChildForces="true"`), `:1938`/`:1939` (`3d91-4deb-faa0-9996`, `77da-4055-647c-6978`, je `type="min" value="0"`), `:1953-1962` (die beiden `set 0`). Gotreks `categoryLinks`: `:5373-5374` — nur `Rare` `e94b-6a54-8779-cd60` und `Regiment of Renown` `ee09-9a50-ad78-9c32`. |
| **EFTC-R8** | Gotrek ist in allen drei Rostern **sichtbar**. Sein Basiswert ist `hidden="false"`, und an der Definition hängt **kein** `field="hidden"`-Modifikator und **keine** `modifierGroup` — die einzigen zwei Modifikatoren sind der `set` aus EFTC-R2 und die Meldung aus EFTC-R5. Da direkt an die Definition gebunden wird, gibt es auch keinen `entryLink`, dessen `hidden` sich per ODER dazumischen könnte. | Mercenaries-`.cat` `:5371` (`hidden="false"`) und `:5535-5546` (vollständige `<modifiers>`-Liste des Eintrags). ODER-Komposition von Link und Ziel: [§8](../../battlescribe-data-format.md#8-kategorien--sichtbarkeit). |
| **EFTC-R9** | Der **effektive Anzeigename** bleibt der Basisname **„Gotrek Gurnisson & Felix Jaeger"**: an `ef9d-ae15-cc43-f2d6` hängt kein `field="name"`-Modifikator, und der Meldungstext trägt **kein** `{this}`-Token. | Mercenaries-`.cat` `:5371` (`name="Gotrek Gurnisson &amp; Felix Jaeger"`, XML-Entity `&amp;` → `&`; im Fixture-Satz genau **einmal** vorhanden) und `:5535-5546`. |
| **EFTC-R10** | Die Bindung erfolgt **direkt an die geteilte Definition** (`entryId="ef9d-ae15-cc43-f2d6"`, leeres `entryLinkId`). Im **ganzen** Fixture-Satz existiert **kein** `entryLink` auf diese Id — die direkte Bindung ist damit nicht nur zulässig, sondern der einzige Weg, und es geht kein Link-eigener `constraint`/`cost`/`modifier` verloren. | Verifiziert: die Id `ef9d-ae15-cc43-f2d6` kommt im Fixture-Satz **genau einmal** vor — als `id` der Definition (`:5371`). Muster der Direktbindung wie in [`add-info-and-warning-campaign-gate`](../add-info-and-warning-campaign-gate/README.md) und [`primary-catalogue-scope`](../primary-catalogue-scope/README.md). |

**Ableitung des Erwartungsbilds.** `bound` ist der Wert der Constraint
`e3c5-278b-09bc-84cf` **nach** Anwendung der Modifikatoren: **0**, wenn die
`equalTo`-Bedingung fällt (Roster 01 und 03), **1**, wenn sie hält (Roster 02).
`actual` ist die Stückzahl der Gotrek-Selektionen im Roster-Rahmen — in allen
drei Rostern genau **eine** Auswahl mit `number="1"`, also **1**; die
Pflicht-Kindmodelle (Gotrek Gurnisson, Felix Jaeger) sind eigene Einträge und
zählen für diese Grenze nicht mit. Daraus: Roster 01 und 03 feuern mit
**Ist 1 / Grenze 0**, Roster 02 feuert nicht.

---

## Bewusst **nicht** Gegenstand dieses Szenarios

- **Sichtbarkeit ist keine feuernde Grenze.** EFTC-R8 steht als `isHidden` am
  Fähigkeits-Datensatz, **nicht** im Verletzungsbericht — dieser kodiert
  zählende Grenzen, nicht Verfügbarkeit oder Profilwerte (gleiche Abgrenzung
  wie VBL-R4/R5 in [`vampire-bloodlines`](../vampire-bloodlines/README.md)).
  Dasselbe gilt für die Kategorie „Special Characters" (`0644-bfcd-32c2-21dc`),
  die derselbe Schalter per `hidden`-Gatter steuert.
- **Gotreks Pflicht-Kinder bleiben unbesetzt.** Die beiden Modelle
  „Gotrek Gurnisson" (`ce6a-5110-45de-637f`, `min 1` `fde7-bf8e-f148-e4cf`) und
  „Felix Jaeger" (`b1e5-1930-8b3e-fd0c`, `min 1` `9e0d-73c0-dda4-873e`) samt
  ihren Pflicht-Waffen (`0ff8-0b8a-38e6-e959` / `4901-3bcc-f4f8-385b`,
  `801b-32c7-1da8-b4d8` / `3ec6-5efb-a4ae-60d1`) sind aus Minimalitätsgründen
  in **allen drei** Rostern gleich weggelassen — wie bei Greasus in
  [`at-least-force-toggle-gate`](../at-least-force-toggle-gate/README.md). Ihre
  Min-Meldungen dürfen in allen drei Rostern zusätzlich feuern und stehen
  deshalb weder in `firing` noch in `absent`.
- **Die optionalen Kinder des Schalters** („Special Characters from ArmyBooks"
  `3c7a-8752-c9bc-c68c` u. a., `.gst:1965 ff.`) sind in keinem Roster gewählt;
  ihre `max 1`-Grenzen sind trivial eingehalten, ihre `min 0`-Grenzen No-ops.
  Der bedingte `set 1` auf `5305-9d36-caa4-c907` ist nicht assertiert.
- **`headroom` in den Überschreitungs-Rostern.** Bei Ist 1 über Maximum 0 wäre
  der Restspielraum rechnerisch negativ; ob der Bericht ihn negativ oder auf 0
  geklemmt meldet, ist aus den Katalogdaten **nicht** ableitbar — in Roster 01
  und 03 wird er deshalb nicht assertiert (in Roster 02 ist er eindeutig
  1 − 1 = 0).
- **Armeeweite Aufbau-Diagnosen.** General-Pflicht, Core-Mindestzahl und
  Punktelimit sind in den bewusst minimalen Rostern nicht erfüllt und dürfen
  zusätzlich melden; die Roster tragen **kein** `<costLimits>`, also greift auch
  keine punkteskalierende Stufe. Die Erwartung ist selektiv und macht darüber
  keine Aussage.
- **Die übrigen `equalTo`-Vorkommen des Korpus** (27 weitere, überwiegend
  `scope="parent"` in Vampire Counts und Orcs and Goblins) sind andere Zellen
  derselben Vergleichsart in anderen Rahmen und hier nicht berührt.

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle drei laufen
gegen **denselben** Datensatz (`.gst` + Orcs-and-Goblins-`.cat` +
Mercenaries-`.cat`) und benutzen dasselbe Kontingent „Standard (OG-AB)"
`2bfa-e64a-7123-895f` mit **genau einem** Gotrek. Die Roster unterscheiden sich
**ausschließlich** in der Zahl der „Allow special characters?"-Selektionen.

> **Assertion-Fokus:** die Grenze `e3c5-278b-09bc-84cf` (feuert / feuert nicht,
> mit `actual`/`bound`), das effektive Maximum des Gotrek-Slots
> (`expect.capabilities`, Feld `effectiveMax`) und die Autor-Meldung
> (`expect.messages`, `origin: "authorMessage"`) in jedem der drei Roster.
> Dazu in Roster 03 die unvermeidbare Nebenwirkung `5036-e10c-2fd8-f135`.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | **Kein** Schalter → Bedingung fällt, max 0 feuert, Meldung liegt an | Kontingent „Standard (OG-AB)", 1× Gotrek, **keine** „Allow special characters?"-Selektion. | **EFTC-R1/R5:** Die Zählung ist 0 — `equalTo 1` fällt, der `set 1` wirkt nicht, die Grenze `e3c5-…` bleibt bei **0** und feuert mit **Ist 1 / Grenze 0**; der Slot meldet `effectiveMax=0`, `effectiveMin=null`, `isHidden=false`. Zugleich hält `lessThan 1`: am selben Slot liegt die **`error`**-Meldung `Please enable "Allow special characters?"` an. Die Schalter-Obergrenze `5036-…` kann mangels Selektion nicht feuern. | [`01-gotrek-no-toggle-max0.ros`](rosters/01-gotrek-no-toggle-max0.ros) |
| 02 | **Genau ein** Schalter → Bedingung hält, max 1, alles still | **Identischer** Aufbau, zusätzlich **1×** „Allow special characters?" (`number="1"`). | **EFTC-R2:** Die Zählung ist 1 und trifft den `value` exakt — der `set 1` wirkt, der Slot meldet `effectiveMax=1` (Spielraum 0, ausgeschöpft), **keine** Verletzung von `e3c5-…`. `lessThan 1` fällt: die Meldung ist **weg**. Die Schalter-Obergrenze (max 1) ist mit einer Selektion genau erfüllt. | [`02-gotrek-one-toggle-max1.ros`](rosters/02-gotrek-one-toggle-max1.ros) |
| 03 | **Zwei** Schalter → Bedingung fällt **wieder** (das Trennkriterium) | **Identischer** Aufbau, aber **2×** „Allow special characters?" als zwei Geschwister-`<selection>`, je `number="1"`. | **EFTC-R6:** Die Zählung ist 2 — `equalTo 1` hält **nicht**, die Grenze fällt auf **0** zurück und feuert **erneut** mit **Ist 1 / Grenze 0**, der Slot meldet wieder `effectiveMax=0`. Die Meldung bleibt **abwesend**, denn `lessThan 1` ist bei 2 ebenfalls falsch. Zusätzlich feuert die Schalter-Obergrenze `5036-…` mit **Ist 2 / Grenze 1**. Unter `atLeast 1` sähe dieser Roster aus wie 02. | [`03-gotrek-two-toggles-max0.ros`](rosters/03-gotrek-two-toggles-max0.ros) |

### Herleitung je Roster (Begründung der Erwartung, nicht selbst Assertion)

| Roster | Schalter-Zählung im Kontingent | `equalTo 1` (`:5538`) | Wert von `e3c5-…` | Gotrek-Ist | Grenze feuert? | `lessThan 1` (`:5543`) | Meldung |
|--------|-------------------------------|-----------------------|-------------------|------------|----------------|------------------------|---------|
| 01 | 0 | **nein** (0 ≠ 1) | **0** (Basis) | 1 | **ja** (1 > 0) | **ja** (0 < 1) | **liegt an** (`error`) |
| 02 | 1 | **ja** (1 = 1) | **1** (`set`) | 1 | nein (1 ≤ 1) | nein (1 ≮ 1) | abwesend |
| 03 | 2 | **nein** (2 ≠ 1) | **0** (Basis) | 1 | **ja** (1 > 0) | nein (2 ≮ 1) | abwesend |

Zum Vergleich die **Gegenprobe**, die dieses Szenario ausschließt: wäre die
Bedingung ein `atLeast 1` (die Form am Schwester-Eintrag), stünde in Zeile 03
„ja (2 ≥ 1)", der Wert wäre **1**, die Grenze feuerte **nicht** und der Slot
meldete `effectiveMax=1`. Roster 03 unterscheidet die beiden Lesarten damit
trennscharf.

**Zahlen im Einzelnen.** `bound`/`effectiveMax` ist der Constraint-Basiswert
**0** (`:5533`) bzw. der `set`-Wert **1** (`:5536`) — je nach EFTC-R2.
`actual`/`current` = **1** folgt aus genau einer Gotrek-Auswahl mit `number="1"`
im Roster-Rahmen (`field="selections"`, `scope="roster"`). `effectiveMin` ist
`null`: der Eintrag trägt **keine** min-Grenze, und kein Modifikator fügt eine
hinzu (EFTC-R3: nur zwei Fundstellen der Constraint-Id). `isBlocked=true` in
allen drei Rostern (in 02 das Maximum genau ausgeschöpft, in 01/03 erst recht),
`isMandatoryUnmet=false` mangels min-Grenze. Der Meldungstext ist der Inhalt des
`value`-Attributs **unverändert** nach XML-Entity-Auflösung (`&quot;` → `"`);
das Muster mit ausschließlich gewöhnlichen Leerzeichen findet sich in der
Mercenaries-`.cat` dreimal (drei Träger derselben Meldung), von denen in diesen
Rostern nur Gotrek vorkommt — die Meldungs-Assertion nennt deshalb zusätzlich
`anchorDefId`.

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID | Fundort (Datei / Zeile) |
|---------|-----|--------------------------|
| Spielsystem WHFB 6th definitive (rev 1) | `0d13-7737-ea86-4662` | `.gst` `:2` |
| Katalog **Orcs and Goblins** (rev 1) | `4049-c46d-7f80-44fb` | Orcs-`.cat` `:2` |
| Bibliothek **Mercenaries** (`library="true"`) | `fc47-8392-a6c8-452a` | Mercenaries-`.cat` `:2` |
| `catalogueLink` Orcs → Mercenaries | `b066-2f8e-11ee-1dce` → `fc47-8392-a6c8-452a` | Orcs-`.cat` `:14916` |
| ForceEntry „Standard (OG-AB)" | `2bfa-e64a-7123-895f` | Orcs-`.cat` `:47` |
| **SelectionEntry „Gotrek Gurnisson & Felix Jaeger"** (`type="unit"`, `hidden="false"`, in `<sharedSelectionEntries>`) — der Träger | **`ef9d-ae15-cc43-f2d6`** | Mercenaries-`.cat` `:5371` |
| — **die gegatete Grenze** `max 0`, `field="selections" scope="roster"`, `ics=true`, `icf=true` | **`e3c5-278b-09bc-84cf`** | Mercenaries-`.cat` `:5533` |
| — `set 1` auf diese Id mit **der gepinnten `equalTo`-Zelle** | `childId=8923-5946-7b10-8957`, `scope="force"`, `value=1`, `ics=false`, `icf=false` | Mercenaries-`.cat` `:5536-5539` (Condition `:5538`) |
| — `add error` „Please enable \"Allow special characters?\"" mit `lessThan 1` auf dieselbe `childId` | — (Modifikatoren tragen keine Id) | Mercenaries-`.cat` `:5541-5545` (Condition `:5543`) |
| — Kategorien (im Roster gespiegelt) | `ee09-9a50-ad78-9c32` (primär, „Regiment of Renown"), `e94b-6a54-8779-cd60` („Rare") | Mercenaries-`.cat` `:5373-5374` |
| — Pflicht-Kinder (in allen Rostern unbesetzt, **nicht** assertiert) | Modell `ce6a-5110-45de-637f` (min `fde7-bf8e-f148-e4cf`, max `3417-f56f-58b1-2448`), Modell `b1e5-1930-8b3e-fd0c` (min `9e0d-73c0-dda4-873e`, max `231e-5d8b-738f-1b47`) | Mercenaries-`.cat` `:5377-5381`, `:5466-5470` |
| **SelectionEntry „Allow special characters?"** (`type="upgrade"`, `hidden="false"`, `collective="false"`, Wurzel-Eintrag) — das gezählte Ziel | **`8923-5946-7b10-8957`** | `.gst` `:1935` |
| — **eigene Roster-Obergrenze** `max 1` (in Roster 03 verletzt) | **`5036-e10c-2fd8-f135`** | `.gst` `:1937` |
| — `min 0`-No-ops (nie verletzt; ihre `set 0` schreiben 0 auf 0) | `3d91-4deb-faa0-9996` (`scope=force`) / `77da-4055-647c-6978` (`scope=parent`) | `.gst` `:1938-1939`, Modifikatoren `:1953-1962` |
| — Kategorie „Special list rules" (im Roster gespiegelt) | `32f1-197f-d719-a393` | `.gst` `:1945` |
| Gegenform `atLeast` am Schwester-Eintrag „0-1 Amazon Serpent Priestess" (**nicht** in den Rostern) | `9ddd-69c8-644d-abc2` — Grenze `f706-5d39-7bf7-5f7b`, `set 1` mit `atLeast 1` auf `8923-…` | Mercenaries-`.cat` `:4771`, `:4774-4776` |
| Kategorie „Special Characters" (Schalter-`hidden`-Gatter, **nicht** assertiert) | `0644-bfcd-32c2-21dc` | `.gst` |
| Einzige weitere `equalTo`-Zelle mit `scope="force"` (kein Eintrags-Zähler, `field="limit::…"`, `childId="any"`) | — | Mercenaries-`.cat` `:9387` |
