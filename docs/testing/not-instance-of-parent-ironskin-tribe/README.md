# E2E-Regeln & Testkatalog: `notInstanceOf` mit `scope="parent"` auf eine **Kategorie**, die erst der Verweis erteilt

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln sind
ausschließlich aus den Katalogdaten der *6th Definitive Edition*
(`src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive/`) und der Formatspezifikation
([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md), §7.6
Tabelle *constraint*, §7.7 Tabellen *modifier*/*condition* und Abschnitt
*`modifierGroup`*, §8 *Kategorien & Sichtbarkeit*) abgeleitet; die Roster-Form ist
an den bestehenden Szenarien verifiziert (direktes `entryId`, `entryLinkId=""`
bzw. `entryLinkId=<Verweis-Id>` bei verlinkten Einträgen, verschachtelte
`selections` mit `number`).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armeebuch: `Ogre Kingdoms (6th definitive edition).cat`
  (`731d-5b13-2a92-5427`, rev 2) — enthält beide Kontingente **und** den
  Wurzel-`entryLink`, der die geprüfte Kategorie erteilt
- Bibliothek: `Mercenaries (6th definitive edition).cat`
  (`fc47-8392-a6c8-452a`, `library="true"`, per `catalogueLink`
  `a067-78d5-50a2-affe` eingebunden) — enthält die Einheit, die gegatete
  Aufwertung und die `categoryEntry` „Ironskin"

> **Abgrenzung zu den Nachbarszenarien.** Dieselbe Aufwertung `6c8d-…` wird von
> [`../primary-catalogue-scope/`](../primary-catalogue-scope/README.md) benutzt —
> dort aber, um die **zweite** Bedingung der `and`-Gruppe zu variieren (das
> Armeebuch), und dort wird die Einheit bewusst **ohne** den armeebuch-eigenen
> `entryLink` gewählt, damit die Kategorie-Modifikatoren gar nicht greifen. Dieses
> Szenario ist die exakte Komplementärmenge: es hält das Armeebuch **konstant**
> (alle vier Roster: Ogre Kingdoms) und variiert allein die **erste** Bedingung.
> [`../not-instance-of-force-gate/`](../not-instance-of-force-gate/README.md)
> pinnt dasselbe Konstrukt mit `scope="force"` auf **dasselbe** Kontingent
> `8711-…`; Roster 04 hier trennt die beiden Zellen ausdrücklich voneinander.

---

## Was die Formatspezifikation über `notInstanceOf` + `scope="parent"` sagt

Wörtlich abgeleitet aus §7.6, §7.7 und §8:

- **`scope="parent"` ist die Eltern-Auswahl, und sie wird über *aufgelöste
  Ziel-IDs* bestimmt**, nicht über `entryLinkId`s (§3.4, §7.6: „`scope="parent"`
  vergleicht aufgelöste **Ziel-IDs**").
- **`instanceOf`/`notInstanceOf` sind Prüfungen, keine Zählungen.** Das Ziel wird
  „über seine Definitions-Id, seine Link-Ziel-Id, eine seiner **effektiven**
  Kategorien oder seinen rohen Typ" aufgelöst; `notInstanceOf` ist die Negation.
  Die Zähl-Flags (`shared`, `includeChildSelections`) sind dabei ohne Wirkung —
  eine Identität wird durch eine Instanz nicht enger. `percentValue` ist laut Wiki
  bei `instanceOf` wirkungslos, das `value="1"` der Bedingung folglich ein
  bedeutungsloser Rest (§7.7, Tabelle *condition* und Kasten
  [`scope="unit"`/`scope="ancestor"`](../../battlescribe-data-format.md#scope-unit-ancestor)).
- **Effektive Kategorien (§8):** „Laufzeit-dynamische Kategoriezugehörigkeit …
  Modifier mit `type="add"`/`type="remove"` und `field="category"` fügen eine
  Kategoriezugehörigkeit bedingt hinzu bzw. entfernen sie … **Sämtliche**
  kategorie-abhängige Logik muss deshalb die **effektiven** (nach
  Modifier-Anwendung gültigen) Kategorie-Links auswerten, nicht die rohen
  Katalog-Links." Genau diese Regel ist der Gegenstand des Szenarios.
- **Ein `modifier` am `entryLink` wirkt asymmetrisch** (§7.2): er ändert die
  **Eigenschaften des Ziels**. Die Kategorie-Modifikatoren des Wurzel-Verweises
  ändern also die Kategorien der verlinkten **Einheit**.
- **`modifierGroup`** (§7.7): die Bedingungen der Klammer gelten für **alle**
  Modifier darin; ein Modifier mit **eigenen** Bedingungen prüft zusätzlich seine
  eigenen. Eine bedingungslose Klammer wirkt unbedingt.
- **`set hidden`** und **`set <constraint-id>`** (§7.6/§7.7/§8): hält die
  Bedingung, ersetzt der `value` das Flag bzw. den Grenzwert exakt; hält sie
  nicht, gilt der Rohwert. Die Min-Grenzen einer effektiv **versteckten** Entität
  werden nicht validiert (§5.6/§8, Issue 0088); Max-Grenzen bleiben davon
  unberührt.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

Zeilennummern: `M:` = `Mercenaries (6th definitive edition).cat`,
`O:` = `Ogre Kingdoms (6th definitive edition).cat`,
`G:` = `Warhammer Fantasy Battles (6th definitive edition).gst`.

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **NIOP-R1** | **Der Prüfling ist eine basis-verborgene Null-Punkte-Aufwertung mit zwei eigenen Grenzen.** „Extra Special choice" hängt als inline-`selectionEntry` (kein Verweis) unter der Einheit „Rhinox Riders" und trägt `hidden="true"`, `max 1` und `min 0` — beide `field="selections" scope="parent" shared="true" includeChildSelections="false"` — sowie einen `categoryLink` auf **Special** und 0 pts. | `M:4079` `selectionEntry type="upgrade" name="Extra Special choice" hidden="true" id="6c8d-f6f3-823e-e6a5"` unter `M:4058` `selectionEntry type="unit" name="Rhinox Riders" id="5e33-e510-ba45-933e"`. Grenzen `M:4081` **`f873-6cfe-911e-2c46`** (`max 1`) und `M:4082` **`b830-0538-045e-ee90`** (`min 0`). `categoryLink 1e1e-8b9b-50f2-6565 → 43cc-fc3f-35a7-8d03` (Special, `M:4085`), Kosten `M:4088` = 0 pts. |
| **NIOP-R2** | **Das Gatter ist eine `modifierGroup` mit genau zwei Modifiern und genau zwei Bedingungen.** Hält die `and`-Gruppe, wird `b830-…` per `set` auf **1** gehoben **und** `hidden` auf **false** gesetzt — die Aufwertung ist dann zugleich sichtbar und Pflicht. Hält sie nicht, bleiben beide Rohwerte (`hidden="true"`, `min 0`), und die Aufwertung ist weder sichtbar noch verbindlich. | `M:4092-4107`: `modifierGroup type="and"` → `<modifiers>` `set value="1" field="b830-0538-045e-ee90"` (`M:4095`) und `set value="false" field="hidden"` (`M:4096`); `<conditionGroups>` → `conditionGroup type="and"` (`M:4099`) mit genau zwei `<condition>`. Andere Modifikatoren trägt der Eintrag nicht. |
| **NIOP-R3** | **Bedingung 1 — die geprüfte Zelle:** `type="notInstanceOf" value="1" field="selections" scope="parent" childId="7ff5-9e55-c594-4b40" shared="true" includeChildSelections="true"`. `7ff5-…` ist eine **`categoryEntry`** („Ironskin"), also eine Mitgliedschaftsprüfung mit umgekehrter Polarität auf der **Eltern-Auswahl** — der Einheit `5e33-…`, die die Aufwertung hält. | `M:4101` (die Bedingung); `M:74` `categoryEntry name="Ironskin" id="7ff5-9e55-c594-4b40" hidden="false"` — **ohne** eigene `constraints`, sie zählt also nirgends und kann keine Grenze feuern lassen. |
| **NIOP-R4** | **Bedingung 2 — bewusst konstant gehalten:** `type="instanceOf" value="1" field="selections" scope="primary-catalogue" childId="731d-5b13-2a92-5427"`. `731d-…` ist die **Wurzel-Id des Ogre-Kingdoms-Katalogs**. Weil **alle vier** Roster dieses Szenarios ein Kontingent benutzen, das in ebendiesem Katalog deklariert ist, hält diese Bedingung in allen vier — sie kann also nicht das sein, was das Roster-Paar misst. | `M:4102` (die Bedingung); `O:2` `<catalogue … id="731d-5b13-2a92-5427" name="Ogre Kingdoms" …>`. Beide `forceEntry` der Roster stehen in `O:3090` bzw. `O:3105`, also in diesem Katalog. Die Deutung „`primary-catalogue` = Armeebuch, kein Zählrahmen" ist der [§7.6-Kasten](../../battlescribe-data-format.md#scope-primary-catalogue) und ist in [`../primary-catalogue-scope/`](../primary-catalogue-scope/README.md) eigens gepinnt. |
| **NIOP-R5** | **Die Kategorie „Ironskin" entsteht im gesamten Fixture-Korpus an genau *einer* Stelle** — einem `modifier type="add" field="category"` am Wurzel-`entryLink` des Ogre-Kingdoms-Katalogs, gegatet auf das Kontingent „Ironskin Tribe". Es gibt **keinen** `categoryLink` auf `7ff5-…`, in keiner Datei. Die Mitgliedschaft ist damit **rein dynamisch**: sie kann per Definition nur aus den effektiven Kategorien gelesen werden. | Volltextsuche über `src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive/` nach `7ff5-9e55-c594-4b40`: **drei** Treffer, mehr nicht — `M:74` (die Definition), `M:4101` (die Bedingung aus NIOP-R3) und `O:3256` `<modifier type="add" value="7ff5-9e55-c594-4b40" field="category"/>`. |
| **NIOP-R6** | **Der Wurzel-Verweis gliedert die Einheit je Kontingent um.** `entryLink "Rhinox Riders" c8d5-1198-3d4a-8a67 → 5e33-…` trägt zwei `modifierGroup`s. Die erste ist **bedingungslos** und enthält einen bedingten `set-primary Rare` (`notInstanceOf` Ironskin-Kontingent) plus ein **unbedingtes** `remove Regiment of Renown`. Die zweite ist auf `instanceOf(force, 8711-…)` gegatet und enthält `remove Rare`, `add Special`, `set-primary Special`, **`add Ironskin`** und `remove Regiment of Renown`. | `O:3235-3268`. Erste Klammer `O:3237-3246` (Modifikator-eigene Bedingung `O:3241`), zweite Klammer `O:3247-3259` (Klammer-Bedingung `O:3249`, Kommentar `<comment>Ironskin Tribe</comment>` `O:3251`, `add category` `O:3256`). Zusätzlich `O:3262` ein `set hidden=true`, gegatet auf „Border Patrols rules" `4e15-0353-165f-5528` — in **keinem** Roster gewählt. |
| **NIOP-R7** | **Netto-Wahrheitstabelle der beiden Bedingungen** (Armeebuch stets Ogre Kingdoms): siehe die Tabelle unter dieser Liste. Kurz: **im Kontingent „Standard (OK-AB)" ist „Extra Special choice" sichtbar und Pflicht, im Kontingent „Ironskin Tribe" verborgen und unverbindlich** — und zwar *nur*, wenn die Bedingung die **effektiven** Kategorien der Eltern-Auswahl liest. Eine Auswertung, die nur die `categoryLinks` der Definition `5e33-…` (Rare, Regiment of Renown) liest, hielte `notInstanceOf` in **beiden** Kontingenten und machte die Aufwertung überall zur Pflicht. | NIOP-R2 + NIOP-R5 + NIOP-R6; Formatdoku §8 („Sämtliche kategorie-abhängige Logik muss die **effektiven** … Kategorie-Links auswerten"). |
| **NIOP-R8** | **Die beiden Kontingente unterscheiden sich sonst nicht so, dass es die Zelle verfälscht.** Beide tragen `categoryLink`s auf Lord, Heroes, Core, Special, Rare, Characters, Special Characters, Special list rules, Experimental rules; keiner der `categoryLink`s trägt eigene `constraints`. Das „Standard"-Kontingent hat zusätzlich Mercenaries und Regiment of Renown, das „Ironskin"-Kontingent nicht — beides betrifft nur die Einsortierung, nicht die geprüfte Grenze. **Keines** der beiden `forceEntry` trägt eigene `constraints` oder `modifiers`. | `O:3090-3104` („Standard (OK-AB)" `729f-9246-5cd3-5044`, 11 `categoryLink`s) und `O:3105-3117` („Ironskin Tribe (WD#309-UK)" `8711-ed16-2a44-7251`, 9 `categoryLink`s). |
| **NIOP-R9** | **Kontrolle „gegatetes Geschwister mit anderem Auslöser": „Extra Rare choice"** liegt als zweites inline-`selectionEntry` unter derselben Einheit, ist ebenfalls basis-`hidden="true"` mit `max 1`/`min 0` und derselben Modifikator-Bauform — aber ihre `modifierGroup` ist auf **eine einzige** Bedingung gegatet: `notInstanceOf(primary-catalogue, 731d-…)`. In einer Ogerarmee hält die nicht. Der Slot bleibt darum in **allen vier** Rostern verborgen und bei `min 0`. Das trennt „die Engine deckt unter dieser Einheit pauschal alles auf" von „genau dieses Gatter hat gegriffen". | `M:4109-4133`: `selectionEntry "Extra Rare choice" a97e-5cc9-264b-74f4`, Grenzen `M:4111` **`18c5-ec9f-0857-c0de`** (`max 1`) und `M:4112` **`e575-a5af-7fb3-5930`** (`min 0`), `modifierGroup` `M:4122-4132` mit der einzigen Bedingung `M:4129`. |
| **NIOP-R10** | **Kontrolle „unveränderte Obergrenze": die force-skopierte Höchstzahl der Einheit** steht in einer Ogerarmee auf `-1` (= unbegrenzt, Sentinel [§7.6](../../battlescribe-data-format.md#76-constraint)) und ist damit in allen vier Rostern still — auch das eine Größe, die das Armeebuch und nicht das Kontingent steuert. | `M:4269` `constraint type="max" value="1" field="selections" scope="force" id="47d7-b2ed-39e9-0e60"` an `5e33-…`; `M:4272` `modifier type="set" value="-1" field="47d7-b2ed-39e9-0e60"` mit `condition instanceOf … scope="primary-catalogue" childId="731d-5b13-2a92-5427"` (`M:4274`). |
| **NIOP-R11** | **Die Einheit ist mit einem Modell legal bestückt.** Das Modell trägt `min 1`/`max 3` (`scope="parent"`); `number="1"` erfüllt beides. Beide Grenzen sind in allen vier Rostern still und stehen deshalb in `absent`. | `M:4064` `selectionEntry type="model" name="Rhinox Riders" id="c7a1-044e-39f1-9ad8"`, Grenzen `M:4066` **`3b38-fce2-6218-99da`** (`min 1`) und `M:4067` **`415e-73ce-512b-c125`** (`max 3`), 100 pts (`M:4072`). |
| **NIOP-R12** | **Sichtbarkeit ist Verfügbarkeit, keine zählende Grenze.** Der `set hidden`-Zweig des Gatters gehört deshalb **nicht** in `firing`, sondern in `expect.capabilities[].isHidden`. Dieselbe Abgrenzung wie in [`vampire-bloodlines`](../vampire-bloodlines/README.md) (VBL-R4/R5) und [`not-instance-of-unit-category-gate`](../not-instance-of-unit-category-gate/README.md). | Formatdoku §8; der Verletzungsbericht kodiert zählende Grenzen. |

### Die Wahrheitstabelle (Armeebuch in allen Fällen Ogre Kingdoms `731d-…`)

| Roster | Kontingent | Wurzel-Verweis im `.ros` | effektive Kategorien der Eltern-Auswahl `5e33-…` | Bedingung 1 `notInstanceOf(parent, Ironskin)` | Bedingung 2 `instanceOf(primary-catalogue, OK)` | `and`-Gruppe | `hidden` von `6c8d-…` | `b830-…` |
|---|---|---|---|---|---|---|---|---|
| **01** | Standard `729f-…` | `c8d5-…` | Rare *(primär)* | **hält** | hält | **hält** | `false` | **min 1 → feuert** (Ist 0) |
| **02** | Ironskin `8711-…` | `c8d5-…` | Special *(primär)*, **Ironskin** | hält **nicht** | hält | fällt | `true` | min 0 → still |
| **03** | Standard `729f-…` | `c8d5-…` | Rare *(primär)* | **hält** | hält | **hält** | `false` | min 1 → **erfüllt** (Ist 1), still |
| **04** | Ironskin `8711-…` | *(keiner)* | Rare, Regiment of Renown | **hält** | hält | **hält** | `false` | **min 1 → feuert** (Ist 0) |

*(In allen vier Zeilen entfällt „Regiment of Renown" dort, wo der Verweis benutzt
wird — beide `modifierGroup`s des Verweises entfernen die Kategorie, die erste
sogar unbedingt.)*

### Warum genau diese vier Roster — und warum kein fünftes

Die Zelle `condition|notInstanceOf|parent|selectionCount|child=id` hat drei
plausible Fehl-Lesarten, und je ein Roster-Paar schließt eine aus:

| Fehl-Lesart | Was sie ergäbe | Welches Paar sie ausschließt |
|-------------|----------------|-------------------------------|
| „Lies nur die `categoryLinks` der **Definition**" (statt der effektiven Kategorien) | `01` feuert, **`02` feuert ebenfalls** | **01 ↔ 02** — beide Roster sind bis auf `entryId`/`name` des `<force>` byte-gleich; nur die Laufzeit-Kategorie kann sie unterscheiden. |
| „`scope="parent"` meint in Wahrheit das **Kontingent**" (also `notInstanceOf(force, 8711-…)`) | `02` still, **`04` still** | **02 ↔ 04** — dasselbe Kontingent, nur der Wurzel-Verweis fehlt. Unter der Fehl-Lesart wäre `04` still; abgeleitet feuert es. |
| „Die Untergrenze wurde nie gehoben, das Feuern in `01` kommt woanders her" | `03` müsste `effectiveMin` 0 melden | **01 ↔ 03** — `03` wählt die Aufwertung; die Grenze ist dann *erfüllt* statt abwesend, und `effectiveMin: 1` bei `current: 1` belegt, dass sie wirklich auf 1 steht. |

Ein fünftes Roster („Ironskin-Kontingent **mit** gewählter, aber verborgener
Aufwertung") ist bewusst **nicht** gebaut: ob die Engine eine bereits gewählte,
nun verborgene Selektion als unzulässig meldet, ist eine eigene Frage
(Verfügbarkeit gegen Bestand) und gehört — wie schon in
[`not-instance-of-unit-category-gate`](../not-instance-of-unit-category-gate/README.md)
festgehalten — in ein eigenes Szenario.

### Warum die Roster **keine** `<categories>` führen

Die geprüfte Mitgliedschaft entsteht ausschließlich zur **Laufzeit** (NIOP-R5):
im ganzen Korpus gibt es keinen `categoryLink` auf `7ff5-…`. Ein
`<categories>`-Zwischenspeicher im Roster könnte eine Auswertung, die die
effektiven Kategorien gar nicht berechnet, fälschlich richtig aussehen lassen —
oder umgekehrt eine Kategorie behaupten, die kein Modifikator erteilt hat. Die
vier Roster lassen den Block deshalb ganz weg, wie es auch
[`../primary-catalogue-scope/`](../primary-catalogue-scope/README.md) und
[`../unit-scope-instance-of-category/`](../unit-scope-instance-of-category/README.md)
für dynamisch erteilte Kategorien tun.

### Warum `effectiveMin` und nicht nur das Schweigen der Grenze

In Roster 02 ist `b830-…` aus **zwei** unabhängigen Gründen still: die Grenze
steht auf `min 0` (nichts zu verletzen) **und** ihr Träger ist effektiv
verborgen, wodurch seine Min-Grenzen ohnehin nicht gemeldet werden (§5.6/§8,
Issue 0088 — vgl. OCS-R7 in
[`../offer-and-category-slots/`](../offer-and-category-slots/README.md)). Ein
leeres `firing` beweist dort also für sich genommen gar nichts. Die tragende
Aussage ist deshalb `effectiveMin: 0` am Slot — der Zahlenwert, den nur das
*Nicht*-Greifen des `set 1` erklärt. Spiegelbildlich ist in Roster 03
`effectiveMin: 1` bei `current: 1` die Aussage, die „Grenze steht auf 1 und ist
erfüllt" von „Grenze steht auf 0" trennt.

### Bewusst tolerierte Nebengeräusche (selektive Erwartung)

Die Roster sind minimal: sie enthalten die Einheit, ein Modell und — in Roster 03
— die Aufwertung, sonst nichts. Damit bleiben die übrigen Pflicht-Kinder der
Einheit sowie die armeeweiten Aufbauregeln unerfüllt. Diese Diagnosen sind in
**allen vier** Rostern identisch, stören den Kontrast also nicht, und werden
weder in `firing` noch in `absent` genannt:

| Nebengeräusch | Beleg |
|---------------|-------|
| Pflicht-Waffe „Ogre Club" der Gruppe „Weapons" fehlt | `entryLink 350a-0761-8f26-f1f4 → 8768-377c-88da-c3e8` in `selectionEntryGroup "Weapons" 6f78-bbae-9c02-74dd` (`M:4138`), `min 1` = `554b-25d7-e51d-5998` (`M:4155`) |
| Pflicht-Rüstung der Gruppe „Armour" fehlt | `selectionEntryGroup "Armour" c8c8-cd3b-e591-3c6e` (`M:4161`), `min 1` = `bb09-2c8c-3360-e742` (`M:4164`), `defaultSelectionEntryId="5e63-02b3-0bb5-6136"` |
| Armeeweite Aufbaupflichten (General, Core-Mindestzahl usw.) | `.gst`-`categoryEntries`, z. B. `G:372` Core `min 2` = `35c2-d478-392a-aeb1` (bei `costLimit` 2000 per Modifikator auf 3 gesetzt), `G:721` General |
| Kategorie-Obergrenzen Rare/Special | `G:544` Rare `0a44-2d3f-adfe-f3a1` (bei 2000 pts auf **2** gesetzt), `G:434` Special `16f0-6e5b-55d0-4102` (bei 2000 pts auf **4** gesetzt) — beide von den Rostern weit unterschritten. Das `costLimit` von **2000 pts** ist genau deshalb gesetzt: es legt diese punkteskalierenden Grenzen auf ein definiertes Band fest, während die Roster mit 100 pts weit darunter bleiben. |

### Bewusst ausgelassene Facetten

| Facette | Warum nicht abgedeckt |
|---------|------------------------|
| `notInstanceOf`/`scope="parent"` gegen eine **Definitions-Id** oder ein **Typ-Keyword** | An dieser Fundstelle nicht variierbar: die `childId` benennt eine `categoryEntry`. Nur die Kategorie-Auflösung ist hier beobachtbar. |
| `shared="false"` / `includeChildSelections="false"` an dieser Bedingungsart | Die Bedingung trägt `shared="true" includeChildSelections="true"`; ein zweites Vorkommen mit anderen Flags gibt es zu dieser Zelle nicht. Nach §7.7 sind die Flags bei einer Identitätsprüfung ohnehin wirkungslos — das ist hier eine *Annahme aus der Spezifikation*, kein von diesen Rostern erbrachter Beweis. |
| Der **`hidden`-Zustand als feuernde Grenze** | Der Verletzungsbericht kodiert zählende Grenzen, keine (Un-)Sichtbarkeit (NIOP-R12). Die Aussage steht in `capabilities[].isHidden`. |
| Die **Umgliederung** Rare → Special und das `set-primary` des Verweises | Kategoriezugehörigkeit und Anzeige-Bucket, keine Grenze. Eigene Zellen, abgedeckt von [`../set-primary-category-membership/`](../set-primary-category-membership/README.md) und [`../unconditional-modifier-group/`](../unconditional-modifier-group/README.md). Hier ist allein das `add category 7ff5-…` relevant. |
| `anchorKind` des Slots in Roster **02** | Aus den Katalogdaten nicht ableitbar: die Grenze ist eine `min`-Grenze mit **Wert 0**, und ob ein solcher Träger als Pflicht-Anker oder als Angebots-Anker geführt wird, sagt weder die Formatspezifikation noch der Katalog. Die Erwartung nennt dort deshalb kein `anchorKind` — dieselbe Zurückhaltung wie in [`../not-instance-of-force-gate/`](../not-instance-of-force-gate/README.md). |
| Die Diagnose `UNRESOLVED_SCOPE` | Für `scope="primary-catalogue"` bereits in [`../primary-catalogue-scope/`](../primary-catalogue-scope/README.md) (PCS-R7) gepinnt; hier ist das Armeebuch in allen vier Rostern dasselbe und trägt die Unterscheidung nicht. |

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle vier laufen
gegen **denselben** Datensatz (`.gst` + Ogre Kingdoms + Mercenaries) und
enthalten dieselbe Einheit mit demselben einen Modell; sie unterscheiden sich in
**genau zwei** Attributen: dem `entryId`/`name` des `<force>` und dem
`entryLinkId` der Einheit (plus, in Roster 03, der zusätzlich gewählten
Aufwertung).

> **Assertion-Fokus:** die Grenze `b830-0538-045e-ee90` in `firing`/`absent`, die
> Aufdeckung in `capabilities[].isHidden`/`effectiveMin`. Andere
> Armeeaufbau-Diagnosen (siehe „Nebengeräusche") dürfen zusätzlich auftreten.

| # | Testtitel | Kontingent | Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) | Fixture |
|---|-----------|------------|----------------|----------------------------------------|---------|
| 01 | Kein Ironskin → Pflicht | „Standard (OK-AB)" `729f-…` | Rhinox Riders über den Wurzel-Verweis `c8d5-…`, ein Modell, Aufwertung **nicht** gewählt. | **NIOP-R7:** Die Eltern-Auswahl ist kein Ironskin, `notInstanceOf` hält, die `and`-Gruppe greift → „Extra Special choice" meldet `isHidden: false` und `effectiveMin: 1`; die Grenze **`b830-0538-045e-ee90` feuert mit Ist 0 / Grenze 1**. **NIOP-R9:** „Extra Rare choice" bleibt `isHidden: true`, `effectiveMin: 0`. | [`01-standard-force-parent-not-ironskin-choice-mandatory.ros`](rosters/01-standard-force-parent-not-ironskin-choice-mandatory.ros) |
| 02 | Ironskin → verborgen | „Ironskin Tribe (WD#309-UK)" `8711-…` | Byte-gleich zu 01 bis auf das Kontingent. | **Gekippt zu 01:** Der Verweis erteilt der Eltern-Auswahl die Kategorie Ironskin, `notInstanceOf` hält nicht mehr → `isHidden: true`, **`effectiveMin: 0`**, `b830-…` **still**. Der Kontroll-Slot meldet unverändert `isHidden: true` / `effectiveMin: 0` — er hing nie an diesem Gatter. | [`02-ironskin-force-parent-is-ironskin-choice-hidden.ros`](rosters/02-ironskin-force-parent-is-ironskin-choice-hidden.ros) |
| 03 | Pflicht erfüllt, Aufdeckung bleibt | „Standard (OK-AB)" `729f-…` | Wie 01 **plus** „Extra Special choice" (`number="1"`, 0 pts). | Die Aufdeckung ist unabhängig von der Verletzung beobachtbar: der besetzte Slot meldet `isHidden: false` und weiterhin `effectiveMin: 1`, jetzt bei `current: 1` — die Grenze ist **erfüllt**, nicht abwesend. `f873-…` (max 1) ist ausgeschöpft (`headroom 0`, `isBlocked: true`), feuert aber nicht. | [`03-standard-force-choice-selected-min-satisfied.ros`](rosters/03-standard-force-choice-selected-min-satisfied.ros) |
| 04 | Ironskin-Kontingent, aber kein Ironskin | „Ironskin Tribe (WD#309-UK)" `8711-…` | Wie 02, aber die Einheit steht **ohne** Wurzel-Verweis im Roster (`entryLinkId=""`). | **NIOP-R5:** Ohne den Verweis erteilt niemand die Kategorie → `notInstanceOf` hält wieder → `isHidden: false`, `effectiveMin: 1`, **`b830-…` feuert mit Ist 0 / Grenze 1** — obwohl das Kontingent das Ironskin-Kontingent ist. Trennt `scope="parent"` von `scope="force"`. | [`04-ironskin-force-without-entrylink-choice-mandatory.ros`](rosters/04-ironskin-force-without-entrylink-choice-mandatory.ros) |

---

## Abgleich mit dem Engine-Bericht (Runner-Verifikation)

Die oben aus den Katalogdaten **abgeleiteten** Erwartungen treffen die Engine erst
im **Runner-Lauf** — der separate Verifikationsschritt, der nicht zur (blinden)
Autorenschaft gehört (siehe
[ADR 0033](../../adr/0033-evaluator-e2e-manifest-runner-und-black-box-autorenschaft.md)).
Abweichungen sind zu **untersuchen**, nicht durch Anpassen der Erwartung
wegzudefinieren. Die erwartungsgemäß heiklen Stellen:

1. **Effektive statt roher Kategorien** (NIOP-R7) — ob `notInstanceOf`/`parent`
   die per `add category` am **Verweis** erteilte Kategorie sieht. Sieht sie nur
   die `categoryLinks` der Definition, feuert `b830-…` auch in Roster 02.
2. **Der Modifikator hängt am Link, wirkt aber auf das Ziel** (§7.2) — die
   Kategorie muss an der *Einheit* ankommen, nicht am Verweis-Knoten.
3. **Die Reihenfolge im Ironskin-Zweig** — dieselbe `modifierGroup` entfernt Rare
   und fügt Special **und** Ironskin hinzu. Fiele `add Ironskin` unter den Tisch,
   während `add Special` greift, sähe die Umgliederung richtig aus und das Gatter
   trotzdem falsch.
4. **`scope="parent"` ist nicht `scope="force"`** (Roster 04) — die Bedingung darf
   nicht als Kontingent-Prüfung ausgewertet werden.
5. **Die zweite Bedingung der `and`-Gruppe** — sie hält in allen vier Rostern.
   Fiele sie durch, wäre `b830-…` *überall* still, und Roster 01/04 fielen.
6. **`effectiveMin` am verborgenen Träger** (Roster 02) — der Fähigkeitsdatensatz
   muss die Grenze auch dann tragen, wenn sie wegen der Verborgenheit nicht
   gemeldet wird (OCS-R7).

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Spielsystem WHFB 6th definitive | `0d13-7737-ea86-4662` |
| Armeebuch **Ogre Kingdoms** (`childId` der zweiten Bedingung) | `731d-5b13-2a92-5427` (`O:2`) |
| Bibliothek **Mercenaries** (`library="true"`) | `fc47-8392-a6c8-452a` (`M:2`), eingebunden per `catalogueLink a067-78d5-50a2-affe` (`O:3087`) |
| Kontingent „Standard (OK-AB)" | `729f-9246-5cd3-5044` (`O:3090`) |
| Kontingent „Ironskin Tribe (WD#309-UK)" | `8711-ed16-2a44-7251` (`O:3105`) |
| `categoryEntry` „Ironskin" (`childId` der geprüften Bedingung, ohne `constraints`) | `7ff5-9e55-c594-4b40` (`M:74`) |
| Einheit „Rhinox Riders" (Eltern-Auswahl, in `<sharedSelectionEntries>`) | `5e33-e510-ba45-933e` (`M:4058`) — `categoryLink`s Rare `7a46-8a4a-a23c-cc91` / Regiment of Renown `abed-21d3-2539-e782` (`M:4060-4061`) |
| Modell „Rhinox Riders" | `c7a1-044e-39f1-9ad8` (`M:4064`) — `min 1` `3b38-fce2-6218-99da` / `max 3` `415e-73ce-512b-c125`, 100 pts |
| **Prüfling** „Extra Special choice" (`hidden="true"`, 0 pts) | `6c8d-f6f3-823e-e6a5` (`M:4079`) — `max 1` **`f873-6cfe-911e-2c46`** / `min 0→1` **`b830-0538-045e-ee90`** |
| Gatter des Prüflings (`modifierGroup`, 2 Modifier, 2 Bedingungen) | `M:4092-4107`; Bedingungen `M:4101` (`notInstanceOf`/`parent`/`7ff5-…`) und `M:4102` (`instanceOf`/`primary-catalogue`/`731d-…`) |
| **Kontrolle** „Extra Rare choice" (anderes Gatter, bleibt verborgen) | `a97e-5cc9-264b-74f4` (`M:4109`) — `max 1` `18c5-ec9f-0857-c0de` / `min 0` `e575-a5af-7fb3-5930`, Bedingung `M:4129` |
| Wurzel-`entryLink` „Rhinox Riders" (Ogre Kingdoms) | `c8d5-1198-3d4a-8a67 → 5e33-e510-ba45-933e` (`O:3235`) |
| Der einzige Erzeuger der Kategorie Ironskin im Korpus | `<modifier type="add" value="7ff5-9e55-c594-4b40" field="category"/>` (`O:3256`), in der auf `instanceOf(force, 8711-…)` gegateten `modifierGroup` (`O:3247-3259`) |
| Kategorien der Umgliederung (nur Einsortierung, nicht Gegenstand) | Rare `e94b-6a54-8779-cd60` · Special `43cc-fc3f-35a7-8d03` · Regiment of Renown `ee09-9a50-ad78-9c32` (ohne `constraints`, `M:39`) |
| Force-Obergrenze der Einheit (in einer Ogerarmee per `set -1` aufgehoben) | `47d7-b2ed-39e9-0e60` (`M:4269`), Modifikator `M:4272` |
| Verdeckungs-Gatter des Verweises, das ausgeschlossen bleibt | `set hidden=true` (`O:3262`) per „Border Patrols rules" `4e15-0353-165f-5528` — in keinem Roster gewählt |
| Nicht erfüllte Pflicht-Kinder (identisches Nebengeräusch in allen Rostern) | „Ogre Club" `350a-0761-8f26-f1f4 → 8768-377c-88da-c3e8`, `min 1` `554b-25d7-e51d-5998` · Gruppe „Armour" `c8c8-cd3b-e591-3c6e`, `min 1` `bb09-2c8c-3360-e742` |
| Punkte-Kostenart (`costLimit` 2000 in allen Rostern) | `ecfa-8486-4f6c-c249` |
