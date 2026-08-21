# E2E-Regeln & Testkatalog: Eintrags-Id im `scope` eines `<repeat>` — der Powerhouses-Aufschlag je Ogre Pack

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln,
Constraint-Ids und Erwartungswerte sind **ausschließlich aus den Katalogdaten**
der *6th Definitive Edition* (`src/domain/evaluator/__fixtures__/whfb6-definitive/`),
der Formatspezifikation
([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md),
§7.5, §7.6, §7.7) und der vendorten `Catalogue.xsd` abgeleitet. Die Roster-Form
ist an den bereits verifizierten Szenarien nachgebildet (direktes `entryId`,
`entryLinkId` als leeres Attribut, verschachtelte `selections` mit `number`).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armeebuch: `Skaven (6th definitive edition).cat`
  (`cac6-5f02-f95d-a403`, rev 1, Z. 2) — Kontingent **„Hell Pit (WD-311)"**
  `9f0b-5346-a3bc-b5fe` (Z. 184)
- Bibliothek: `Mercenaries (6th definitive edition).cat`
  (`fc47-8392-a6c8-452a`) — per `catalogueLink` `4f16-8437-4e47-58a8`
  (Z. 11452) erklärte Abhängigkeit des Armeebuchs

Zeilenangaben ohne Dateipräfix beziehen sich auf
`Skaven (6th definitive edition).cat`.

> **Assertion-Form:** Der Aufschlag ist **Geld**, keine Sichtbarkeit und kein
> Merkmalswert — beobachtbar wird er deshalb über die roster-weite Budget-Regel
> `budget::ecfa-8486-4f6c-c249`, deren `actual` die verplante Gesamtsumme trägt.
> Je Roster steht das Punktelimit **eine Einheit unter** der aus den
> Katalogdaten abgeleiteten Summe, damit die Grenze mit genau dieser Summe
> feuert (Präzedenz: [`unit-scope-repeat-knight-markup`](../unit-scope-repeat-knight-markup/README.md)
> und [`equal-to-unit-inner-circle-markup`](../equal-to-unit-inner-circle-markup/README.md));
> ein Roster stellt das Limit **eine Einheit über** die Summe und fordert
> Stille. Der `repeat` selbst ist **keine** zählende Grenze und taucht im
> Verletzungsbericht nie unter eigener Id auf. Weitere Armeeaufbau-Diagnosen
> (General-/Core-Pflicht des Kontingents, Packmaster-Pflicht, Kategorie-Slots)
> dürfen zusätzlich auftreten; die Erwartung ist selektiv.

---

## Die Regel (In-World)

Die *Mutant Rat Ogres* aus White Dwarf #311 (`publicationId="c085-da7d-f7c0-44c1"`,
`page="115"`) sind Zuchtexperimente von Clan Moulder: eine Einheit besteht aus
beliebig vielen **Ogre Packs** (je 65 pts) und genau **einem** „Rat Ogre"-Eintrag,
der die Mutationen der ganzen Einheit trägt. Eine Mutation gilt folglich für
**jedes Pack** — und wird auch **je Pack** bezahlt. Der Katalog schreibt das nicht
als „10 pts pro Modell" hin, sondern als Grundpreis **0** plus einen
wiederholten Zuschlag (Z. 6950–6965):

```xml
<selectionEntry id="259c-906d-4b40-2b31" name="Powerhouses" … type="upgrade">
  <modifiers>
    <modifier type="increment" field="ecfa-8486-4f6c-c249" value="10">
      <repeats>
        <repeat field="selections" scope="7a4a-301b-af31-9ee0" value="1"
                percentValue="false" shared="true"
                includeChildSelections="false" includeChildForces="false"
                childId="8ea5-88f7-6636-7aaf" repeats="1" roundUp="false"/>
      </repeats>
    </modifier>
  </modifiers>
  <constraints>
    <constraint field="selections" scope="parent" value="1" … id="c161-77b3-0542-5ff1" type="max"/>
  </constraints>
  <costs>
    <cost name="pts" typeId="ecfa-8486-4f6c-c249" value="0"/>
    …
  </costs>
</selectionEntry>
```

Der `scope` ist **die Id der Einheit**, ausgeschrieben statt als Schlüsselwort —
dieselbe Kodierung, die derselbe Autor an derselben Einheit zehnmal an einer
`condition` benutzt (Szenario
[`greater-than-id-scope-brain-transplant`](../greater-than-id-scope-brain-transplant/README.md)).
Sechsmal steht sie hier an einem `repeat`, an jeder der sechs Optionen der Gruppe
„Options", mit jeweils anderem `value` des `increment`.

---

## Was die Formatspezifikation über die Zelle sagt

- **Der `scope` darf eine Eintrags-Id sein — auch am `repeat`.** Die Aufzählung
  in [§7.6](../../battlescribe-data-format.md#76-constraint) ist keine
  abschließende Liste von Literalen: die Quelle zählt neben
  `parent|roster|force|primary category` ausdrücklich **Vorfahren-Ids** mit, und
  die XSD typt `scope` als nackten String (`Catalogue.xsd:426`, `QueryBase` —
  **dieselbe Basis** für `constraint`, `condition` und `repeat`). §7.7 sagt es
  für Condition und Repeat gemeinsam: *„das Datenformat (XSD `QueryBase`)
  unterscheidet `scope` nicht nach Query-Art"*. Ein Id-`scope` bedeutet an einem
  `repeat` also genau, was er an einer `condition` bedeutet.
- **Der Rahmen sagt nur, *wo* summiert wird.** Gezählt werden „`field`'s values
  of descendant selections"
  ([§7.6-Regelkasten](../../battlescribe-data-format.md#76-constraint)) — hier
  also die Auswahlen **unterhalb** der benannten Einheit, die auf die `childId`
  passen. Der Träger des Modifikators liegt selbst **tiefer** als der Rahmen;
  der Rahmen ist sein **Vorfahre**, nicht sein Kind.
- **`includeChildSelections="false"` zählt „just `scope`'s `field`"** — also nur,
  was direkt im Rahmen steht, nicht was tiefer darunter hängt
  ([§7.6-Tabelle](../../battlescribe-data-format.md#76-constraint)); *nicht*
  „gar nichts".
- **Ein `repeat` wendet den Modifikator mehrfach an.** §7.7: „bewirkt, dass der
  Modifier **mehrfach** angewendet wird (z. B. ‚+1 Slot je 1000 Punkte')";
  Attribute u. a. `repeats` (wie oft pro Treffer), `roundUp` und `percentValue`
  (die Schrittweite `value` als Prozentsatz). Der Faktor **vervielfacht** die
  Wirkung von `increment`/`decrement`/`multiply` — im Unterschied zu `set`, das
  auch wiederholt denselben Wert schreibt
  ([§7.7-Kasten „Ein wiederholter `set` wächst nicht"](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat)).
  Hier ist der Modifikator ein `increment`: der Faktor wirkt.
- **`shared="true"` verbreitert keinen Rahmen.** Das Flag entscheidet, ob über
  alle **Verweis-Instanzen** eines geteilten Eintrags summiert wird
  (§7.6-Tabelle) — welcher Knoten der Zählrahmen ist, sagt allein der `scope`.
  Präzedenz: [`equal-to-ancestor-id-scope-mount-gate`](../equal-to-ancestor-id-scope-mount-gate/README.md),
  Roster 06, und [`greater-than-id-scope-brain-transplant`](../greater-than-id-scope-brain-transplant/README.md),
  Roster 04.
- **`field="<costTypeId>"` an einem Modifikator ändert die Kosten** dieser
  Kostenart am Träger (§7.7-Tabelle: `field` = *`<costTypeId>`*). Die pts-Kostenart
  des Systems ist `ecfa-8486-4f6c-c249` (`.gst`, §5.3).
- **`child.number` zählt.** Für Kosten **und** Constraint-Zählungen ist die
  Stückzahl einer Auswahl durchzumultiplizieren (§7.5-Rechenregel); die
  `.ros`-Semantik dieses Projekts liest `number` als **absolute** Gesamtstückzahl.
  Eine Selektion „Ogre Pack" mit `number="3"` ist also drei Packs — für die
  65 pts **und** für den Zählwert des `repeat`.
- **Sichtbarkeit vor Mindestmaß:** Min-Grenzen einer effektiv versteckten Entität
  werden **nicht** validiert (§5.6, verallgemeinert in §8). Deshalb benutzen alle
  Roster das Kontingent „Hell Pit (WD-311)" — nur dort ist die basis-verborgene
  Einheit eingeblendet (**ISRPP-R2**).

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **ISRPP-R1** | **Der `scope` des `repeat` ist eine Eintrags-Id, kein Schlüsselwort.** `scope="7a4a-301b-af31-9ee0"` benennt den `selectionEntry` „Mutant Rat Ogres" `type="unit"`. Die Id benennt **kein** Kontingent (die acht `forceEntry`-Ids stehen Z. 21/36/49/63/145/158/171/184), **keine** Kategorie und **keinen** Verweis. Sie kommt im Korpus 17× vor: 1× als Definition (Z. 6778) und 16× als `scope` — 10× an einer `condition`, **6× an einem `repeat`**. | Volltextsuche über die 12 Fixture-Dateien nach `7a4a-301b-af31-9ee0` (Treffer nur in `Skaven (…).cat`). |
| **ISRPP-R2** | **Die Einheit ist nur im Kontingent „Hell Pit (WD-311)" sichtbar.** Sie trägt `hidden="true"` als Basiswert und genau **einen** `set hidden="false"`-Modifikator, gegatet auf `instanceOf` `childId="9f0b-5346-a3bc-b5fe"` mit `scope="force"`. Alle Roster benutzen deshalb dieses Kontingent. | Einheit Z. 6778, Modifikator Z. 6780–6784; `forceEntry` Z. 184. |
| **ISRPP-R3** | **Gezählt wird das Modell „Ogre Pack".** `childId="8ea5-88f7-6636-7aaf"` ist ein `selectionEntry` `type="model"` mit `hidden="false"`, **65 pts** und den Grenzen `min 1` (`40f9-18a7-a6cf-c6f3`) sowie `max -1` (`f4c1-c87e-2fcf-5ce9`, Sentinel „unbegrenzt" als **hingeschriebener** Wert, §7.6; nur unter „Border Patrols rules" `4e15-0353-165f-5528` per `set` auf 25 gezogen — in keinem Roster vorhanden). Die Id kommt im Korpus **7×** vor: 1× als Definition und 6× als `childId` genau dieser sechs `repeat`s. Kein `entryLink` zeigt auf sie. | Definition Z. 6823–6843, Kosten Z. 6831; Volltextsuche nach `8ea5-88f7-6636-7aaf`. |
| **ISRPP-R4** | **Der Träger liegt ZWEI Ebenen unter dem Rahmen — der Rahmen ist sein Vorfahre.** Kette: `selectionEntry` „Mutant Rat Ogres" `7a4a-…` (Z. 6778) → `selectionEntry` „Rat Ogre" `40c5-05e4-da1d-6194` (Z. 6897, `type="upgrade"`, `min 1`/`max 1`) → `selectionEntryGroup` „Options" `a0a2-1a3d-86d3-4a67` (Z. 6945, `max 2`) → `selectionEntry` „Powerhouses" (Z. 6950). Das gezählte „Ogre Pack" steht dagegen **direkt** im Rahmen (Geschwister des Rat Ogre) — die Zählung führt vom Träger also erst **hinauf** zum Rahmen und dann in einen **anderen** Zweig hinab. | Verschachtelung Z. 6778 → 6897 → 6945 → 6950; Ogre Pack Z. 6823. |
| **ISRPP-R5** | **Der Aufschlag ist ein `increment` auf die pts-Kostenart, Grundpreis 0.** `<modifier type="increment" field="ecfa-8486-4f6c-c249" value="10">` (Z. 6952) am `selectionEntry` „Powerhouses", dessen eigene `<costs>` **pts 0** setzen (Z. 6964; Casting/Dispel Dice ebenfalls 0). Ohne den `repeat` wäre die Option ein Pauschalpreis von 10 pts; mit ihm kostet sie 10 pts **je gezähltem Schritt**. | Z. 6950–6965. |
| **ISRPP-R6** | **Der Wiederholungsfaktor ist genau die Packzahl.** `value="1"` (Schrittweite, `percentValue="false"` — also absolut, kein Prozentsatz), `repeats="1"` (Anwendungen je Schritt), `roundUp="false"`. Bei *N* gezählten Packs ergibt `N / 1 = N` Schritte × `repeats 1` = **N** Anwendungen; `roundUp` ist ohne Wirkung, weil der Quotient für ganzzahliges *N* ganzzahlig ist. Der Aufschlag ist damit **10 · N**. | Z. 6954. |
| **ISRPP-R7** | **Die fünf Geschwister-Optionen tragen dieselbe Bauform mit anderen Werten.** In derselben Gruppe „Options" steht an jeder Option ein `increment` auf `ecfa-8486-4f6c-c249` mit einem **wortgleichen** `repeat` (nur der `value` des `increment` unterscheidet sich): Powerhouses **10** (Z. 6952/6954), Quadrupedal `d9b9-4315-f6b5-e02e` **5** (Z. 6969/6971), Resilient `b03e-5d16-19d6-d9fa` **12** (Z. 6986/6988), Extra extremities `d7e7-5079-ecb3-cfa7` **10** (Z. 7003/7005), Brain transplant `8b1c-de3a-982e-e323` **5** (Z. 7020/7022), Trollblood `8d5c-b0df-3935-db73` **15** (Z. 7037/7039). Alle sechs haben Grundpreis **pts 0** und je eine eigene `max 1`-Grenze mit `scope="parent"`. Roster 06 liest die Zelle deshalb **zweifach unabhängig** (5 und 12 statt 10). | Z. 6950–7051. |
| **ISRPP-R8** | **Die Gruppe „Options" erlaubt höchstens zwei Optionen.** `selectionEntryGroup a0a2-1a3d-86d3-4a67` trägt `max 2` (`8fcf-0d32-a63c-37a1`, `scope="parent"`). Roster 06 wählt genau zwei und erreicht die Grenze exakt, ohne sie zu reißen; alle anderen Roster wählen höchstens eine. | Z. 6945–6948. |
| **ISRPP-R9** | **Die Pflicht-Kinder der Einheit, die jedes Roster tragen muss.** „Ogre Pack" `min 1` (`40f9-18a7-a6cf-c6f3`) und „Rat Ogre" `40c5-05e4-da1d-6194` mit `min 1` (`0352-7667-f50c-5eda`) / `max 1` (`b296-d0c8-b18b-b5cd`), beide `scope="parent"`. Jedes Roster wählt genau **einen** Rat Ogre und *N* Packs; ein zweiter Rat Ogre in derselben Einheit wäre nicht baubar. | Z. 6823–6843 und Z. 6897–6901. |
| **ISRPP-R10** | **Alle Punktequellen der benutzten Roster sind bekannt und vollständig.** Die Einheit selbst kostet **pts 0** (Z. 7062–7066), die Aufwertung „Rat Ogre" **pts 0** (Z. 7055–7059), jede der sechs Optionen **pts 0** (s. ISRPP-R7). Der einzige von 0 verschiedene Grundpreis im ganzen benutzten Teilbaum ist das Ogre Pack mit **65** (Z. 6831). Die Summe eines Rosters ist damit `65 · N + Σ(increment · N)`. | Z. 6823–7066. |
| **ISRPP-R11** | **Zwei Einheiten „Mutant Rat Ogres" sind baubar.** Die Einheit trägt — anders als ihre Schwester „Augmented Rat Ogres" `cdcd-2130-f1a3-819d` (Z. 7068, `max 1` `cb6c-f3f2-1690-327d`) — **überhaupt keine** eigenen `<constraints>`. Begrenzt wird nur ihr Kategorie-Slot „Special" `43cc-fc3f-35a7-8d03`; dessen force-skopierte Grenze `16f0-6e5b-55d0-4102` steht bei dem in Roster 07 gesetzten Limit **344 pts** (200 ≤ Limit < 500, ohne Rare und ohne Border Patrols) auf **2** — mit zwei Einheiten exakt erreicht. | Einheit Z. 6778–6822 (kein `<constraints>`-Kind); `categoryLink` Z. 6820; `.gst` Z. 434–541 (Rohwert 3 Z. 436, „Warbands (big)" `set 2` Z. 528). |
| **ISRPP-R12** | **Der Packmaster wird bewusst nicht gewählt — und das kostet nichts.** „Packmaster each pack" `90fa-58e6-5fdf-28c7` trägt `min 1` (`6fda-622a-eae1-fc61`) / `max 1` (`fab5-b1e4-3574-fbb3`) und ist selbst **pts 0**; seine drei Pflicht-Verweise sind ebenfalls **pts 0** (Light Armour `055f-8e4e-f170-35d2`, `.gst` Z. 951; Whip `e92b-3eab-c634-f54a`, Z. 9350; Hand Weapon `abdb-bbd0-41b2-5dff`, `.gst` Z. 1032). Ob eine Engine unbesetzte Pflicht-Anker in die Summe rechnet oder nicht, ist damit **punkteneutral** — die Budget-Aussage bleibt in jedem Fall gültig. Die Grenze `6fda-…` feuert in allen Rostern und wird deshalb weder in `firing` noch in `absent` behauptet. | Z. 6844–6896; `.gst` Z. 951/1032; Z. 9350. |

### Die sechs `repeat`s am selben Rahmen — vollständig gelesen

Alle sechs tragen `field="selections"`, `scope="7a4a-301b-af31-9ee0"`,
`childId="8ea5-88f7-6636-7aaf"`, `value="1"`, `percentValue="false"`,
`shared="true"`, `includeChildSelections="false"`, `includeChildForces="false"`,
`repeats="1"`, `roundUp="false"` — sie unterscheiden sich **allein** im `value`
des Modifikators, den sie wiederholen:

| Z. (Modifier / Repeat) | Option | `increment` auf `ecfa-8486-4f6c-c249` | In diesen Rostern |
|---|---|---|---|
| 6952 / 6954 | Powerhouses `259c-906d-4b40-2b31` | **10** je Pack | 01, 02, 03, 05, 07 (Einheit A) |
| 6969 / 6971 | Quadrupedal `d9b9-4315-f6b5-e02e` | **5** je Pack | 06 |
| 6986 / 6988 | Resilient `b03e-5d16-19d6-d9fa` | **12** je Pack | 06 |
| 7003 / 7005 | Extra extremities `d7e7-5079-ecb3-cfa7` | **10** je Pack | — |
| 7020 / 7022 | Brain transplant `8b1c-de3a-982e-e323` | **5** je Pack | — |
| 7037 / 7039 | Trollblood `8d5c-b0df-3935-db73` | **15** je Pack | — |

**Konsequenz für die Erwartung:** Keine der drei stummen Optionen kommt in
irgendeinem Roster vor, und der „Brain transplant" ist hier bewusst **nie**
gewählt — er würde neben seinem eigenen Aufschlag fünf Sichtbarkeits- und
Merkmals-Gatter mitziehen (siehe das Schwester-Szenario) und den Fall
verwässern.

---

## Was die Roster über den **Rahmen** sagen — und was nicht

| Rahmen | Bezeichneter Knoten in diesen Rostern | Zählwert |
|--------|----------------------------------------|----------|
| `scope="7a4a-301b-af31-9ee0"` (Eintrags-Id) | die Einheit, unter der der Träger hängt | *N* (Packzahl **dieser** Einheit) |
| `scope="unit"` | dieselbe Einheit (nächster Vorfahre mit `type="unit"`, §7.7-Kasten) | identisch |
| `scope="parent"` (am Träger) | die Gruppe „Options" bzw. der Rat Ogre — **nicht** die Einheit | 0 |
| `scope="force"` / `scope="roster"` | das Kontingent bzw. die ganze Liste | *N* bei einer Einheit, **Σ N** bei mehreren |

**Offen deklariert (1) — `unit` vs. Eintrags-Id:** Die Roster können `scope="unit"`
und die ausgeschriebene Eintrags-Id **nicht** voneinander unterscheiden; beide
bezeichnen hier denselben Knoten. Ein Fall, der das könnte, wäre eine „Mutant Rat
Ogres"-Selektion unterhalb einer *anderen* Einheit — der Katalog kennt ihn nicht
(die Einheit ist ein Wurzel-`selectionEntry`, und kein `entryLink` hängt sie
irgendwo darunter). Von `scope="parent"` grenzen die Roster den Rahmen sehr wohl
ab (dort wäre der Zählwert überall 0 und der Aufschlag entfiele ganz), und von
`force`/`roster` grenzt ihn Roster 07 ab.

**Offen deklariert (2) — `includeChildSelections="false"`:** Die Flanke „nur was
**direkt** im Rahmen steht" ist an dieser Datenlage **nicht beobachtbar**. Das
gezählte „Ogre Pack" ist ausschließlich als **direktes** Kind der Einheit
definiert (7 Vorkommen der Id im ganzen Korpus, davon 1 Definition und 6 `childId`
— kein `entryLink` hängt es tiefer ein, ISRPP-R3). Es gibt daher kein legales
Roster, in dem `false` und `true` verschiedene Zählwerte ergäben; beide Lesarten
fallen hier zusammen. Das Szenario behauptet die Flanke deshalb **nicht** und
markiert sie ausdrücklich als Lücke der **Daten**, nicht der Erwartung.

Was die Roster sehr wohl abgrenzen, ist die **Weite** des Rahmens (Roster 07:
die eigene Einheit, nicht das Kontingent) und die **Wiederholung** als solche
(Roster 01–04: der Aufschlag wächst linear mit der Packzahl, statt einmal oder
gar nicht zu greifen).

### Was eine falsche Lesart produzieren würde

Angegeben ist die Summe, die die Fehl-Lesart erzeugt; „**fällt auf**" heißt, dass
die Budget-Erwartung des Rosters dadurch bricht. „unverändert" heißt, dass die
Fehl-Lesart dieses Roster gar nicht berührt (es enthält den betroffenen Träger
nicht).

| Fehl-Lesart | R01 (75/74) | R02 (150/149) | R03 (225/224) | R04 (195/194) | R05 (225/226, still) | R06 (246/245) | R07 (345/344) |
|---|---|---|---|---|---|---|---|
| **Der Wiederholungsfaktor greift nicht** — Id-`scope` nicht aufgelöst, `repeat` verworfen oder `increment` wie ein `set` behandelt ⇒ Modifier wirkt **genau einmal** | 75 — nicht unterscheidbar (*N* = 1) | 140 ⇒ still — **fällt auf** | 205 ⇒ still — **fällt auf** | unverändert | 205 ⇒ still (korrekt, aber unbewiesen) | 212 ⇒ still — **fällt auf** | 335 ⇒ still — **fällt auf** |
| **Der Modifier fällt ganz aus** (Aufschlag 0) | 65 ⇒ still — **fällt auf** | 130 ⇒ still — **fällt auf** | 195 ⇒ still — **fällt auf** | unverändert | 195 ⇒ still | 195 ⇒ still — **fällt auf** | 325 ⇒ still — **fällt auf** |
| **Rahmen zu weit** (Kontingent/Roster statt der Einheit) | unverändert | unverändert | unverändert | unverändert | unverändert | unverändert | 375 statt 345 — **fällt auf** |
| **`shared="true"` als roster-weite Teilung des Eintrags-Rahmens gelesen** | unverändert | unverändert | unverändert | unverändert | unverändert | unverändert | 375 statt 345 — **fällt auf** |
| **`number` nicht ausgewertet** (eine Selektion = ein Pack, in Kosten **und** Zählung) | 75 — nicht unterscheidbar | 75 ⇒ still — **fällt auf** | 75 ⇒ still — **fällt auf** | 65 ⇒ still — **fällt auf** | 75 ⇒ still | 82 ⇒ still — **fällt auf** | 140 ⇒ still — **fällt auf** |
| **Wiederholungsfaktor verdoppelt** (`repeats` und Schritt doppelt gezählt) | 85 statt 75 — **fällt auf** | 170 statt 150 — **fällt auf** | 255 statt 225 — **fällt auf** | unverändert | 255 ⇒ Budget feuert — **fällt auf** | 297 statt 246 — **fällt auf** | 365 statt 345 — **fällt auf** |
| **`childId`-Filter ignoriert** (jede direkte Auswahl im Rahmen zählt: *N* Packs **+** Rat Ogre) | 85 statt 75 — **fällt auf** | 160 statt 150 — **fällt auf** | 235 statt 225 — **fällt auf** | unverändert | 235 ⇒ Budget feuert — **fällt auf** | 263 statt 246 — **fällt auf** | 355 statt 345 — **fällt auf** |
| **Nur ein `repeat`-tragender Modifier je Options-Gruppe angewandt** | unverändert | unverändert | unverändert | unverändert | unverändert | 222 oder 236 ⇒ still — **fällt auf** | unverändert |

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle sieben laufen
gegen **denselben** Datensatz (`.gst` + Skaven `.cat` + Mercenaries `.cat`) und im
**selben** Kontingent „Hell Pit (WD-311)"; sie unterscheiden sich nur in der
Packzahl, in der gewählten Option und im Punktelimit.

| # | Testtitel | Roster-Zustand | Abgeleitete Summe | Limit | Erwartetes Ergebnis | Fixture |
|---|-----------|----------------|-------------------|-------|----------------------|---------|
| 01 | Ein Pack ⇒ Aufschlag **einmal** | 1 Ogre Pack, 1 Rat Ogre, Powerhouses | 65 + 10·1 = **75** | 74 | `budget::ecfa-8486-4f6c-c249` feuert mit **Ist 75 / Grenze 74** | [`01-one-pack-powerhouses.ros`](rosters/01-one-pack-powerhouses.ros) |
| 02 | Zwei Packs ⇒ Aufschlag **zweimal** | wie 01, `number="2"` am Pack | 130 + 10·2 = **150** | 149 | Budget feuert mit **Ist 150 / Grenze 149** | [`02-two-packs-powerhouses.ros`](rosters/02-two-packs-powerhouses.ros) |
| 03 | Drei Packs ⇒ Aufschlag **dreimal** | wie 01, `number="3"` am Pack | 195 + 10·3 = **225** | 224 | Budget feuert mit **Ist 225 / Grenze 224** | [`03-three-packs-powerhouses.ros`](rosters/03-three-packs-powerhouses.ros) |
| 04 | Nullpunkt ohne Option | 3 Packs, 1 Rat Ogre, **keine** Option | 195 + 0 = **195** | 194 | Budget feuert mit **Ist 195 / Grenze 194**; Differenz zu 03 = exakt 30 | [`04-three-packs-no-option.ros`](rosters/04-three-packs-no-option.ros) |
| 05 | Gegenprobe: Limit **über** der Summe | byte-gleich zu 03, Limit 226 | **225** | 226 | Budget bleibt **still** (`absent`) | [`05-three-packs-powerhouses-within-budget.ros`](rosters/05-three-packs-powerhouses-within-budget.ros) |
| 06 | **Zweite Lesart**: zwei Optionen, andere Werte | 3 Packs, Quadrupedal (5) **und** Resilient (12) | 195 + 5·3 + 12·3 = **246** | 245 | Budget feuert mit **Ist 246 / Grenze 245**; Gruppengrenze `max 2` exakt erreicht | [`06-three-packs-quadrupedal-and-resilient.ros`](rosters/06-three-packs-quadrupedal-and-resilient.ros) |
| 07 | **Der Rahmen ist die eigene Einheit** | Einheit A: 2 Packs + Powerhouses; Einheit B: 3 Packs, keine Option | (130 + 20) + 195 = **345** | 344 | Budget feuert mit **Ist 345 / Grenze 344**; ein kontingentweiter Rahmen ergäbe 375 | [`07-two-units-frame-per-unit.ros`](rosters/07-two-units-frame-per-unit.ros) |

### Herleitung der Zahlen

`bound` ist stets das im Roster gesetzte `costLimit` der pts-Kostenart
`ecfa-8486-4f6c-c249`; `actual` ist die aus den Katalogdaten gerechnete
Gesamtsumme:

- **Bausteine (ISRPP-R10):** Einheit 0, Rat Ogre 0, jede Option 0,
  Ogre Pack **65** je Stück.
- **Aufschlag (ISRPP-R5/R6):** `increment · N`, mit *N* = Anzahl der Ogre Packs
  **derselben** Einheit.
- 01: 65·1 + 10·1 = **75** — 02: 65·2 + 10·2 = **150** — 03/05: 65·3 + 10·3 = **225**
  — 04: 65·3 = **195** — 06: 65·3 + 5·3 + 12·3 = **246** —
  07: (65·2 + 10·2) + 65·3 = 150 + 195 = **345**.

Die drei Stützstellen 01/02/03 (75/150/225) legen die Gerade eindeutig fest:
Steigung 75 pts je Pack, Achsenabschnitt 0. Roster 04 zerlegt die Steigung in
ihre beiden Summanden (65 Modellkosten, 10 Aufschlag), ohne von der
Modellkosten-Annahme abzuhängen: die Differenz 225 − 195 = 30 ist **allein** der
Aufschlag für drei Packs.

---

### Bewusst nicht Teil des Verletzungsberichts

| Facette | Warum nicht als feuernde Grenze / Assertion erwartet |
|---------|------------------------------------------------------|
| **Der `repeat` selbst** | Ein `repeat` ist keine `constraint`. Der Verletzungsbericht kodiert zählende Grenzen, keine Wiederholungsfaktoren — die Zelle ist nur mittelbar beobachtbar, über die Punktesumme. |
| **`includeChildSelections="false"`** | An dieser Datenlage nicht von `true` unterscheidbar (siehe „Offen deklariert (2)"): das gezählte Ogre Pack existiert ausschließlich als direktes Kind des Rahmens. Ein Roster, das die Flanke prüfte, ließe sich aus diesem Katalog nicht bauen. |
| **Die Pflicht „Packmaster each pack"** `6fda-622a-eae1-fc61` | Feuert in **allen** Rostern (kein Roster wählt den Packmaster, und ohne „Brain transplant" bleibt der geschriebene `min 1` stehen). Das ist die Zelle des Schwester-Szenarios [`greater-than-id-scope-brain-transplant`](../greater-than-id-scope-brain-transplant/README.md) und nicht diese; sie steht deshalb weder in `firing` noch in `absent`. Punkteneutral ist sie ohnehin (ISRPP-R12). |
| **Der `entryLink`-Unterbau des Packmasters** (Light Armour `5551-…`/`6844-…`, Whip `8459-…`/`c15f-…`, Hand Weapon `e2ab-…`/`268c-…`) | Kein Roster wählt den Packmaster; ob eine Engine Pflichten **unterhalb** eines unbesetzten Pflicht-Ankers meldet, ist eine Aussage über die Anker-Kaskade, nicht über diese Zelle. Alle drei kosten 0 pts. |
| **Die Kategorie-Grenze „Special"** `16f0-6e5b-55d0-4102` | Sie ist punkteskaliert (`.gst` Z. 434–541) und steht bei den kleinen Limits dieses Szenarios (< 200 pts in Roster 01/02/04) auf **0** — sie feuert dort, obwohl das Roster fachlich in Ordnung ist. Die Zählsemantik force-skopierter Kategoriegrenzen ist eine **eigene** Zelle mit eigenen Szenarien; sie wird hier weder in `firing` noch in `absent` behauptet. |
| **General- und Core-Pflichten des Kontingents** | Sie feuern in allen Rostern, weil bewusst weder ein General noch eine Core-Einheit gewählt ist — jede zusätzliche Auswahl würde die Punktesumme verwässern, die hier die ganze Aussage trägt. |
| **Merkmalswirkungen der gewählten Optionen** (Powerhouses S+1, Quadrupedal Mv+1, Resilient T+1) | Merkmalswerte sind nicht Teil des Verletzungsberichts und berühren die Punkte nicht. Sie sind über `capabilities.infoElements[].characteristics` beobachtbar und im Schwester-Szenario bereits gepinnt; hier bleiben sie unbehauptet, damit der Fall die Kostenzelle isoliert. |
| **`capabilities` in allen Rostern** | Die Aussage dieses Szenarios ist eine **Summe**, kein Slot-Zustand; Roster 07 trägt zudem **jede** benutzte Definition zweimal unter demselben `frameDefId`, eine Auswahl über `defId` + `frameDefId` träfe dort zwei Slots, und der `path` eines Slots ist aus den Katalogdaten nicht ableitbar. Das Manifest behauptet deshalb nur `firing`/`absent` und `diagnostics`. |
| **Eine Diagnose *für* den Id-`scope`** (Anwesenheit) | Aus den erlaubten Quellen nicht entscheidbar: die Formatspezifikation regelt fail-closed-Verhalten samt Diagnose ausdrücklich nur für `primary-catalogue` und für `unit` ohne umschließende Einheit. Behauptet wird nur die **Abwesenheit** von `UNRESOLVED_SCOPE` für `7a4a-301b-af31-9ee0` — der Rahmen ist in jedem Roster ein realer Vorfahre jedes Trägers und damit auflösbar. |

---

## Abgleich mit dem Engine-Bericht (Runner-Verifikation)

Die oben aus den Katalogdaten **abgeleiteten** Erwartungen treffen die Engine erst
im **Runner-Lauf** — der separate Verifikationsschritt, der nicht zur (blinden)
Autorenschaft gehört (siehe
[ADR 0033](../../adr/0033-evaluator-e2e-manifest-runner-und-black-box-autorenschaft.md)).
Abweichungen sind zu **untersuchen**, nicht durch Anpassen der Erwartung
wegzudefinieren. Die erwartungsgemäß heiklen Stellen:

1. **ISRPP-R1** — ob ein Id-wertiger `scope` an einem *Repeat* überhaupt als
   Eintrags-Rahmen erkannt wird. Die Präzedenz betrifft bisher nur die
   `condition`
   ([`greater-than-id-scope-brain-transplant`](../greater-than-id-scope-brain-transplant/README.md))
   und die Schlüsselwort-Rahmen `unit`/`parent` an einem Repeat
   ([`unit-scope-repeat-knight-markup`](../unit-scope-repeat-knight-markup/README.md),
   [`parent-repeat-model-include-children`](../parent-repeat-model-include-children/README.md)).
   Fällt der Rahmen still aus, greift der Modifikator einmal oder gar nicht —
   Roster 01–03 machen beides sichtbar.
2. **ISRPP-R4** — der Rahmen ist ein **Vorfahre** des Trägers, und das gezählte
   Ziel steht in einem **Geschwister-Zweig** des Trägers, nicht unter ihm. Eine
   Auswertung, die vom Träger aus nur nach unten sucht, zählt hier 0.
3. **ISRPP-R6** — dass der Faktor **linear** mit der Packzahl wächst und nicht
   bei 1 stehen bleibt. Die drei Stützstellen 75/150/225 unterscheiden „einmal",
   „gar nicht" und „je Pack" eindeutig.
4. **Roster 07** — die Weite des Rahmens **und** die Frage, ob `shared="true"`
   einen Eintrags-Rahmen roster-weit teilt. Beide Fehl-Lesarten verschieben die
   Summe von 345 auf 375.
5. **Roster 05** — die Gegenrichtung: eine Summe, die **zu groß** gerechnet wird,
   fällt nur hier auf, weil alle anderen Roster ihr Limit knapp **unter** der
   Summe führen.
6. **ISRPP-R7 / Roster 06** — dass **zwei** wiederholte Modifikatoren derselben
   Bauform nebeneinander wirken und jeder seinen eigenen `value` behält
   (5 und 12, nicht zweimal derselbe Wert).

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Spielsystem WHFB 6th definitive | `0d13-7737-ea86-4662` |
| Katalog **Skaven** (rev 1, Z. 2) | `cac6-5f02-f95d-a403` |
| Bibliothek **Mercenaries** (per `catalogueLink` `4f16-8437-4e47-58a8`, Z. 11452) | `fc47-8392-a6c8-452a` |
| ForceEntry „Hell Pit (WD-311)" (einziges Kontingent, in dem die Einheit sichtbar ist; Z. 184) | `9f0b-5346-a3bc-b5fe` |
| SelectionEntry „Mutant Rat Ogres" (Ziel des Id-`scope`, `hidden="true"`, pts 0; Z. 6778) | `7a4a-301b-af31-9ee0` |
| — dessen `categoryLink` „Special" (`primary="true"`, Z. 6820) → Kategorie | `6a45-fd16-99d7-277b` → `43cc-fc3f-35a7-8d03` |
| SelectionEntry „Ogre Pack" (Ziel der `childId`, `type="model"`, **65 pts**; min 1 / max -1; Z. 6823) | `8ea5-88f7-6636-7aaf` — `40f9-18a7-a6cf-c6f3` / `f4c1-c87e-2fcf-5ce9` |
| SelectionEntry „Packmaster each pack" (min 1 / max 1, pts 0; nie gewählt; Z. 6844) | `90fa-58e6-5fdf-28c7` — `6fda-622a-eae1-fc61` / `fab5-b1e4-3574-fbb3` |
| — dessen Pflicht-Verweise (alle pts 0, nie erreicht) | Light Armour `055f-8e4e-f170-35d2` / Whip `e92b-3eab-c634-f54a` / Hand Weapon `abdb-bbd0-41b2-5dff` |
| SelectionEntry „Rat Ogre" (min 1 / max 1, pts 0; Träger der Options-Gruppe; Z. 6897) | `40c5-05e4-da1d-6194` — `0352-7667-f50c-5eda` / `b296-d0c8-b18b-b5cd` |
| SelectionEntryGroup „Options" (max 2; Z. 6945) | `a0a2-1a3d-86d3-4a67` — `8fcf-0d32-a63c-37a1` |
| — Option **„Powerhouses"** (pts 0, `increment 10` + `repeat`, max 1; Z. 6950) | `259c-906d-4b40-2b31` — `c161-77b3-0542-5ff1` |
| — Option **„Quadrupedal"** (pts 0, `increment 5` + `repeat`, max 1; Z. 6967) | `d9b9-4315-f6b5-e02e` — `9155-53b8-0a0e-9b94` |
| — Option **„Resilient"** (pts 0, `increment 12` + `repeat`, max 1; Z. 6984) | `b03e-5d16-19d6-d9fa` — `d83c-1177-f544-0764` |
| — Option „Extra extremities" (pts 0, `increment 10`, max 1; nie gewählt; Z. 7001) | `d7e7-5079-ecb3-cfa7` — `3836-686c-435d-6ac8` |
| — Option „Brain transplant" (pts 0, `increment 5`, max 1; nie gewählt; Z. 7018) | `8b1c-de3a-982e-e323` — `14e8-5762-d2d0-ee18` |
| — Option „Trollblood" (pts 0, `increment 15`, max 1; nie gewählt; Z. 7035) | `8d5c-b0df-3935-db73` — `01af-64b4-bcee-cfdb` |
| Kostenart „pts" (`field` des Modifikators **und** Kostenart des Roster-`costLimit`) | `ecfa-8486-4f6c-c249` |
| Roster-weite Budget-Regel (die Beobachtungsstelle) | `budget::ecfa-8486-4f6c-c249` |
| Kategorie „Special" (`.gst` Z. 434) — Grenze, punkteskaliert (Z. 436/439/528) | `43cc-fc3f-35a7-8d03` — `16f0-6e5b-55d0-4102` |
| Schwester-Einheit „Augmented Rat Ogres" (`max 1`, Kontrast zu ISRPP-R11; Z. 7068) | `cdcd-2130-f1a3-819d` — `cb6c-f3f2-1690-327d` |
| „Border Patrols rules" (Gatter des Ogre-Pack-Maximums; nie benutzt) | `4e15-0353-165f-5528` |
