# E2E-Regeln & Testkatalog: Ein `modifier` auf ein nirgends definiertes `field` ist wirkungslos

**Rolle:** Black-Box-Test (kein Blick in den Engine-Quellcode). Alle Regeln,
Grenz-Ids, Ist- und Grenzwerte sind **ausschliesslich aus den Katalogdaten** der
*6th Definitive Edition* und der Format-Doku
[`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md)
**abgeleitet** — nicht aus einem Engine-Lauf. Das Roster-Eingabeformat folgt der
in bestehenden Szenarien verifizierten Form (direktes `entryId`, leeres
`entryLinkId`, verschachtelte `selections` mit `number`).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Katalog: `Orcs and goblins (6th definitive edition).cat` (`4049-c46d-7f80-44fb`,
  rev 1) — Kontingent **„Standard (OG-AB)"** `2bfa-e64a-7123-895f`
- Mitgeladen: `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`) —
  der O&G-Katalog deklariert sie per
  `<catalogueLink type="catalogue" name="Mercenaries" id="b066-2f8e-11ee-1dce" targetId="fc47-8392-a6c8-452a"/>`
  (Zeile 14916); ohne sie waere der Datensatz unvollstaendig.

## Worum es geht

Ein `modifier` **aendert** laut [§7.7](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat)
„eine Eigenschaft des Elternelements oder den Wert eines Constraints". Sein `field`
darf genau eines von sieben Dingen benennen:

> `field` | *Constraint-`id`* \| *`<costTypeId>`* \| `hidden` \| `name` \| `category` \| `error` \| `warning` \| `info` \| *`<characteristicTypeId>`*

Der Orcs-and-Goblins-Katalog enthaelt **vier** Modifikatoren, deren `field` **keines**
davon ist: die Id `ce6e-afde-2ed1-aac2` ist weder ein Schluesselwort noch im
geladenen Datensatz als `constraint`, `costType` oder `characteristicType`
definiert. Alle vier tragen den Kommentar `Swedish Comp System` — offenbar der Rest
eines nie mitgelieferten Komparativsystems. Es gibt damit nichts, was diese
Modifikatoren aendern koennten: **kein Zielwert, kein Effekt.**

Diese Regel laesst sich aus den erlaubten Quellen vollstaendig herleiten, ohne zu
raten: Die Wirkung eines Modifikators ist im Format ausschliesslich als
*Aenderung eines benannten Ziels* definiert. Existiert das Ziel nicht, existiert
auch die Aenderung nicht — es gibt im Format keinen zweiten, zielfreien
Wirkungspfad, und ein `modifier` legt insbesondere **nie** eine Grenze an
(Grenzen entstehen nur aus `constraint`-Elementen, [§7.6](../../battlescribe-data-format.md#76-constraint)).

### Wie das Fehlen des Ziels geprueft wurde

Volltextsuche nach der Zeichenfolge `ce6e` ueber **alle fuenf** Dateien des
eingefrorenen Korpus `src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive/`
(`.gst` + `Orcs and goblins` + `Mercenaries` + `Ogre Kingdoms` + `Vampire Counts`)
sowie ueber das ganze Repository:

| Fundstelle | Zeile | Rolle |
|------------|-------|-------|
| `Orcs and goblins …cat` | 8704 | `<modifier type="decrement" value="100" field="ce6e-afde-2ed1-aac2"/>` |
| `Orcs and goblins …cat` | 8865 | `<modifier type="increment" value="100" field="ce6e-afde-2ed1-aac2">` |
| `Orcs and goblins …cat` | 8876 | `<modifier type="increment" value="100" field="ce6e-afde-2ed1-aac2">` |
| `Orcs and goblins …cat` | 8887 | `<modifier type="increment" value="100" field="ce6e-afde-2ed1-aac2">` |
| `Orcs and goblins …cat` | 8960 | `infoLink id="ce6e-1957-569f-ac9a"` — **andere** Id, nur Praefix-Treffer |

Vier Treffer, alle als `field` eines `modifier`. **Null** Treffer als `id=` — also
kein `constraint`, kein `costType` (die pts/Casting/Dispel-Kostenarten der `.gst`
sind `ecfa-8486-4f6c-c249`, `fcec-2340-6368-a2ba`, `6001-b2bf-4529-c07d`), kein
`characteristicType`, kein `selectionEntry`. Die einzigen Vorkommen der Id im
gesamten Datensatz sind ihre eigenen vier Verweise.

### Die vier Modifikatoren im Katalog

**(a) Unbedingt — am Upgrade „Fanatics" `18f4-ad33-69ca-e327`** (Zeilen 8700–8707):

```xml
<modifierGroups>
  <modifierGroup type="and">
    <comment>Swedish Comp System</comment>
    <modifiers>
      <modifier type="decrement" value="100" field="ce6e-afde-2ed1-aac2"/>
    </modifiers>
  </modifierGroup>
</modifierGroups>
```

Die Klammer traegt **keine** `<conditions>`, `<conditionGroups>` und `<repeats>` —
nach [§7.7](../../battlescribe-data-format.md#modifiergroup--eine-bedingte-klammer-um-mehrere-modifier)
(und dem Szenario [`../unconditional-modifier-group/`](../unconditional-modifier-group/README.md))
ist sie eine blosse Klammer und gattert nichts. Der Modifikator ist also **immer**
aktiv, sobald ein Fanatics-Slot existiert. Das ist der schaerfste Fall: nichts
haelt ihn zurueck, allein das fehlende Ziel kann ihn wirkungslos machen.

**(b–d) Bedingt — an der Einheit „Night Goblins" `79af-55cb-9761-f0be`**
(Zeilen 8861–8900), drei `increment 100` auf dieselbe Id, jeder in einer eigenen
`and`-Gruppe:

| Kommentar | Bedingung 1 | Bedingung 2 |
|-----------|-------------|-------------|
| `Refund 3` | `atLeast 45` `childId=18f4-ad33-69ca-e327` (Fanatics), `scope=parent`, `includeChildSelections=true` | `atLeast 3` `childId=7b95-cfde-8c59-78c3` (Night-Goblin-Modell), ebenso |
| `Refund 1` | `atLeast 15` Fanatics | `atLeast 1` Night-Goblin-Modell |
| `Refund 2` | `atLeast 30` Fanatics | `atLeast 2` Night-Goblin-Modell |

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **MUTI-R1** | Ein `modifier`, dessen `field` eine im Datensatz nirgends definierte Id nennt, **erzeugt keine Grenze dieser Id**. Im Verletzungsbericht darf `ce6e-afde-2ed1-aac2` nie erscheinen. | Grenzen entstehen ausschliesslich aus `constraint`-Elementen ([§7.6](../../battlescribe-data-format.md#76-constraint)); ein `modifier` aendert nur ([§7.7](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat)). Zu `ce6e-afde-2ed1-aac2` existiert kein `constraint` (Suchbeleg oben). Im Manifest jedes Rosters als `absent`. |
| **MUTI-R2** | Er **verschiebt keine fremde Grenze**. Die Grenzen im selben Rahmen behalten genau die Werte, die die Katalogdaten ihnen geben: Fanatics `max 3`, Night-Goblin-Modell `min 20`, Netters `max 0 + floor(Modelle/4)`. | O&G-`.cat`: `0368-ef7f-01c5-924a` (`type=max value=3 field=selections scope=parent shared=true includeChildSelections=false`), `8cb2-bd82-3725-569e` (`type=min value=20 field=selections scope=parent shared=false`), `445e-c0e4-6784-9097` (`type=max value=0 field=selections scope=parent shared=true`) mit `<modifier type="increment" value="1" field="445e-c0e4-6784-9097">` + `<repeat value="4" repeats="1" field="selections" scope="parent" childId="7b95-cfde-8c59-78c3" shared="true" roundUp="false"/>`. Im Manifest als `capabilities.effectiveMin`/`effectiveMax`. |
| **MUTI-R3** | Er **stoert die Auswertung seines Traegers nicht**. Die Fanatics-Obergrenze feuert normal, wenn sie ueberschritten wird — obwohl derselbe Eintrag den unbedingten haltlosen `decrement 100` traegt. | Constraint `0368-ef7f-01c5-924a` (`max 3`, `scope=parent`) am selben `selectionEntry` `18f4-ad33-69ca-e327`, das die haltlose `modifierGroup` traegt. Roster 02/03/05: Ist 15 bzw. 45 gegen Grenze 3. |
| **MUTI-R4** | Er **stoert die Auswertung seiner Nachbarn nicht**. Die Netters-Grenze und die Modell-Mindeststaerke derselben Einheit verhalten sich unveraendert, gleichgueltig ob 0, 1 oder 3 der bedingten haltlosen Modifikatoren aktiv sind. | Vergleich der Roster 01 (kein bedingter aktiv), 02 (einer aktiv) und 03 (alle drei aktiv): dieselbe Einheit, dieselbe Modell- und Netterszahl, dieselben `effectiveMin`/`effectiveMax`. |
| **MUTI-R5** | Die Bedingung eines der drei gegatterten Modifikatoren ist **erfuellbar** — er wuerde feuern, wenn sein Ziel aufloeste. 15 Fanatics erfuellen `Refund 1` (`atLeast 15` / `atLeast 1`), 45 Fanatics zusaetzlich `Refund 2` (30/2) und `Refund 3` (45/3). | Zeilen 8865–8897, Schwellen wie in der Tabelle oben. Roster 02 (15 Fanatics) und 03 (45 Fanatics) setzen genau diese Schwellen. |
| **MUTI-R6** | **Gegenprobe (Lebendigkeit):** Ein **echter** Modifikator im selben Rahmen verschiebt seine Grenze nachweislich. Die Netters-Grenze steht geschrieben auf `max 0` und wird um `+1` je **vier** Night-Goblin-Modellen angehoben: 20 Modelle ⇒ 5, 24 Modelle ⇒ 6. | `445e-c0e4-6784-9097` + `repeat value="4" repeats="1" … roundUp="false"` (Zeilen 8671–8681). Roster 04 feuert mit **Grenze 5** (nicht 0), Roster 05 bleibt bei sechs Netters und 24 Modellen still. |
| **MUTI-R7** | **Sichtbarkeit:** Die Einheit „Night Goblins" ist im Kontingent „Standard (OG-AB)" **nicht** versteckt; ihre Grenzen sind also zu validieren. | `79af-55cb-9761-f0be` traegt `hidden="false"` und einen `modifier set hidden="true"`, dessen `or`-Gruppe ausschliesslich die Sonderheere `a2fa-6a0e-8c17-373c`, `1f55-c922-66d8-08ef`, `03cc-8a3f-abd4-3c03`, `1821-fbd1-0d96-2d88`, `b26c-6f4c-34a5-dc0c` nennt — **nicht** `2bfa-e64a-7123-895f`. Die drei Kind-Eintraege tragen `hidden="false"` ohne `hidden`-Modifikator. |

### Warum die Lesart von `scope="parent"` hier folgenlos ist

Die drei gegatterten Modifikatoren sitzen an der **Wurzel-Einheit**. Ob
`scope="parent"` dort die Einheit selbst oder das umschliessende Kontingent
bezeichnet, ist aus der Format-Doku nicht eindeutig zu entscheiden — beide Lesarten
kommen fuer einen Wurzel-Eintrag in Frage. Dieses Szenario umgeht die Frage,
statt sie zu raten: **jedes** Roster enthaelt genau **eine** „Night Goblins"-Einheit,
und alle gezaehlten Kinder (Fanatics, Modelle) haengen darunter. Einheiten-Rahmen
und Kontingent-Rahmen enthalten damit **dieselben** Zahlen; die Bedingung haelt
(Roster 02/03/05) bzw. haelt nicht (Roster 01/04) in beiden Lesarten gleich.
Sollte eine Auswertung den Rahmen ueberhaupt nicht aufloesen, waere das eine
Diagnose, keine Verletzung — die Aussagen dieses Szenarios blieben davon
unberuehrt.

### Warum die Gegenprobe (MUTI-R6) unverzichtbar ist

„Der haltlose Modifikator hat nichts bewirkt" und „hier wurde ueberhaupt nichts
ausgewertet" sehen im Bericht identisch aus, solange nur Abwesenheit behauptet
wird. Roster 04 trennt beides messbar: die Netters-Grenze ist **geschrieben
`max 0`**; sie feuert dort mit **Grenze 5**. Eine Auswertung, die Modifikatoren in
diesem Rahmen gar nicht anwendet, meldete `bound 0` (bei sechs Netters sogar mit
anderem Delta) und faellt durch. Roster 05 legt die Schrittweite von der anderen
Seite fest: vier Modelle mehr (24 statt 20) heben die Grenze auf 6, und sechs
Netters sind dann still.

### Zahlenbasis der Roster

Jede „Night Goblins"-Auswahl traegt `number="1"`, die Kinder tragen ihre volle
Stueckzahl (`number="20"`, `number="15"` usw.). Damit ist die in
[§7.5](../../battlescribe-data-format.md#75-cost--cost-type) benannte Luecke
(„ist `.ros`-`number` per-Eltern-relativ oder absolut?") fuer dieses Szenario
**folgenlos**: `n x 1 = n` in beiden Lesarten.

Die Punktesumme von Roster 01 ist damit eindeutig:
20 Modelle x 2 + „Hand Weapons and Shields" 0 + 5 Netters x 2 + 3 Fanatics x 25
= **125 pts** (Einheit selbst 0 pts). Das Punktelimit 124 klemmt sie fest.

---

## Testkatalog (E2E-Szenarien)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle referenzieren
`.gst` + O&G-`.cat` (+ die per `catalogueLink` benoetigte `Mercenaries`-`.cat`).
Jedes Roster waehlt die Pflichtwaffe „Hand Weapons and Shields"
`e555-e1a8-da79-3cc2` (0 pts, ohne Kosten-Modifikator), damit die Waffen-Gruppe
`ff58-295b-f79f-7a5d` (`min 1` / `max 1`) erfuellt ist und die Punktesumme
eindeutig bleibt.

> **Assertion-Fokus:** ausschliesslich die genannten Grenz-Ids und Slots. Andere
> Armeeaufbau-Diagnosen duerfen zusaetzlich auftreten und sind hier ohne Belang —
> insbesondere die Kontingent-Pflichten „General" `1077-7379-f142-f382` (min 1)
> und „Core" `35c2-d478-392a-aeb1` (min 2) aus der `.gst`.

| # | Roster-Zustand | Erwartetes Ergebnis (aus Katalogdaten abgeleitet) | Fixture |
|---|----------------|---------------------------------------------------|---------|
| 01 | 20 Modelle, 5 Netters, **3** Fanatics, Punktelimit 124 | **MUTI-R1/R2:** `ce6e-afde-2ed1-aac2` erscheint nicht; Fanatics `effectiveMax 3` (Ist 3, Spielraum 0), Netters `effectiveMax 5` (Ist 5), Modell `effectiveMin 20` / `effectiveMax null`. Der **unbedingte** haltlose `decrement 100` ist aktiv und bleibt folgenlos — auch fuer die Kosten: das Budget feuert mit Ist **125** / Grenze 124. Keine der Nachbargrenzen feuert. | [`01-fanatics-at-max-unconditional-dangling-modifier.ros`](rosters/01-fanatics-at-max-unconditional-dangling-modifier.ros) |
| 02 | 20 Modelle, 5 Netters, **15** Fanatics *(Kernfall)* | **MUTI-R5 + R1/R2/R3:** die `and`-Gruppe `Refund 1` haelt (15 ≥ 15, 20 ≥ 1) — der Modifikator wuerde feuern, tut aber nichts. `ce6e-…` bleibt abwesend; die Fanatics-Obergrenze `0368-ef7f-01c5-924a` feuert **genau einmal** mit Ist **15** / Grenze **3**; Netters unveraendert `effectiveMax 5`, Modell `effectiveMin 20`. | [`02-fifteen-fanatics-first-dangling-group-holds.ros`](rosters/02-fifteen-fanatics-first-dangling-group-holds.ros) |
| 03 | 20 Modelle, 5 Netters, **45** Fanatics | **MUTI-R4:** jetzt halten **alle drei** gegatterten Gruppen (45/3, 30/2, 15/1) plus der unbedingte — vier haltlose Modifikatoren gleichzeitig. Gegenueber Roster 02 aendert sich **nichts** ausser dem Ist der Fanatics-Grenze: `0368-…` feuert einmal mit Ist **45** / Grenze **3**, Netters bleibt `effectiveMax 5`, Modell `effectiveMin 20`, `ce6e-…` abwesend. | [`03-fortyfive-fanatics-all-dangling-groups-hold.ros`](rosters/03-fortyfive-fanatics-all-dangling-groups-hold.ros) |
| 04 | 20 Modelle, **6** Netters, keine Fanatics | **MUTI-R6 (Gegenprobe):** die geschriebene Grenze `max 0` von `445e-c0e4-6784-9097` ist per echtem Modifikator auf `0 + floor(20/4) = 5` gehoben. Sie feuert **genau einmal** mit Ist **6** / Grenze **5** — nicht mit Grenze 0. `ce6e-…` und die Fanatics-Grenze bleiben still. | [`04-netters-above-modified-max-20-models.ros`](rosters/04-netters-above-modified-max-20-models.ros) |
| 05 | **24** Modelle, **6** Netters, **15** Fanatics | **MUTI-R6 + R5 gemeinsam:** vier Modelle mehr heben die Netters-Grenze auf `0 + floor(24/4) = 6`; sechs Netters halten sie exakt ein (`effectiveMax 6`, Spielraum 0, `445e-…` still), waehrend `Refund 1` gleichzeitig haelt. Die Fanatics-Grenze feuert unveraendert mit Ist **15** / Grenze **3**; `ce6e-…` bleibt abwesend. | [`05-netters-at-modified-max-24-models-fanatics-15.ros`](rosters/05-netters-at-modified-max-24-models-fanatics-15.ros) |

### Nicht als feuernde Grenze erwartet

- **Die haltlose Id `ce6e-afde-2ed1-aac2` selbst** — sie ist kein `constraint` und
  kann deshalb nie als Grenze im Bericht stehen. Sie steht in **jedem** Roster in
  `expect.absent`; das ist die eine Haelfte der Aussage „wirkungslos".
- **Die unbegrenzte Obergrenze des Modells** `8036-c81f-c00c-c4c5`
  (`max -1`, `shared=true`) darf nie feuern: der Rohwert `-1` heisst „unbegrenzt"
  ([§7.6](../../battlescribe-data-format.md#76-constraint), Sentinel-Kasten), und
  der zugehoerige `set 25`-Modifikator haengt an „Border Patrols rules"
  `4e15-0353-165f-5528`, das in **keinem** Roster gewaehlt ist. Als
  `capabilities.effectiveMax: null` gespiegelt.
- **Sichtbarkeit (`hidden`)** ist keine zaehlende Schranke und erscheint nicht im
  Verletzungsbericht (Konvention der bestehenden Szenarien, vgl.
  [`../vampire-bloodlines/README.md`](../vampire-bloodlines/README.md)). MUTI-R7
  wird deshalb nur als Vorbedingung benutzt und zusaetzlich als
  `capabilities.isHidden: false` festgehalten — dort ist sie eine Slot-Aussage,
  keine Grenze.
- **Profilwerte** kommen in diesem Szenario als Regel nicht vor. Das Profil des
  Fanatics (`infoLink 3840-1b9e-9db2-d96e` → `f00f-27f9-7204-9ad2`) ist nicht
  Gegenstand der Pruefung; `ce6e-afde-2ed1-aac2` ist kein `characteristicType`,
  koennte es also ohnehin nicht treffen.

### Bewusst offen gelassen

- **Ob die Engine eine Diagnose meldet**, wenn ein `modifier`-`field` nicht
  aufloest, wird **nicht** asseriert — weder `present` noch `absent`. Weder die
  Format-Doku noch die XSD sagen, ob ein solcher Verweis ein Datenfehler mit
  Meldepflicht oder eine stille No-op ist; das aus den Daten zu entscheiden ist
  nicht moeglich. Dieses Szenario pinnt allein die **Wirkung** (keine), nicht die
  **Meldung**.
- **Ein zweites Vorkommen derselben Konstruktion** gibt es im Korpus nicht: die
  vier Modifikatoren teilen sich dasselbe Ziel und sitzen alle an derselben
  Einheit. Eine unabhaengige Gegenprobe an einem anderen Traeger ist daher aus
  diesen Daten nicht zu bauen.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Spielsystem (`.gst`) | `0d13-7737-ea86-4662` |
| Katalog „Orcs and Goblins" | `4049-c46d-7f80-44fb` |
| Kontingent „Standard (OG-AB)" | `2bfa-e64a-7123-895f` |
| **Das haltlose Ziel** (nur als `field` von vier Modifikatoren vorhanden) | **`ce6e-afde-2ed1-aac2`** |
| Einheit „Night Goblins" (`type=unit`, Traeger der drei bedingten `increment 100`) | `79af-55cb-9761-f0be` |
| — deren `categoryLink` → Kategorie „Core" (`primary=true`) | `e35b-777d-50c3-f919` → `64bf-efb4-9978-26df` |
| Upgrade „Fanatics" (`type=upgrade`, Traeger des unbedingten `decrement 100`) | `18f4-ad33-69ca-e327` |
| — dessen Obergrenze `max 3`, `scope=parent`, `shared=true` | `0368-ef7f-01c5-924a` |
| Upgrade „Netters" (`type=upgrade`, echter Modifikator zur Gegenprobe) | `638c-0f7d-3590-75b3` |
| — dessen Obergrenze `max 0`, `scope=parent`, `shared=true`, angehoben `+1` je 4 Modellen | `445e-c0e4-6784-9097` |
| Modell „Night Goblin" (`type=model`) | `7b95-cfde-8c59-78c3` |
| — dessen Mindeststaerke `min 20`, `scope=parent`, `shared=false` | `8cb2-bd82-3725-569e` |
| — dessen unbegrenzte Obergrenze `max -1`, `shared=true` (Kommentar `BP`) | `8036-c81f-c00c-c4c5` |
| Schalter „Border Patrols rules" (in keinem Roster gewaehlt) | `4e15-0353-165f-5528` |
| Gruppe „Weapons" der Night Goblins (`min 1` / `max 1`) | `ff58-295b-f79f-7a5d` — constraints `a19a-18bc-636d-69d3` / `b00d-e5a2-c63f-3bd3` |
| Pflichtwaffe „Hand Weapons and Shields" (0 pts, in jedem Roster gewaehlt) | `e555-e1a8-da79-3cc2` |
| Kostenart „pts" (Budget-Regel in Roster 01) | `ecfa-8486-4f6c-c249` |
| Umgebungsrauschen, nicht asseriert: Kategorie „General" / „Core" | `1077-7379-f142-f382` / `35c2-d478-392a-aeb1` |
