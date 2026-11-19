# E2E-Regeln & Testkatalog: Vorfahren-Id im `scope` einer `equalTo`-Condition — das Reittier-Gatter des Black Orc Bigboss

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln,
Constraint-Ids und Erwartungswerte sind **ausschließlich aus den Katalogdaten**
der *6th Definitive Edition* (`src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive/`) und
der Formatspezifikation
([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md),
§5.5/§5.6, §7.6, §7.7, §8) abgeleitet. Die Roster-Form ist an den bereits
verifizierten Szenarien nachgebildet (direktes `entryId`, `entryLinkId` als leeres
Attribut, verschachtelte `selections` mit `number`).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armeebuch: `Orcs and goblins (6th definitive edition).cat`
  (`4049-c46d-7f80-44fb`, rev 1) — Kontingente **„Grimgor's 'Ardboyz (SoC)"**
  `1821-fbd1-0d96-2d88` (Z. 147) und **„Standard (OG-AB)"** `2bfa-e64a-7123-895f`
  (Z. 47)
- Bibliothek: `Mercenaries (6th definitive edition).cat`
  (`fc47-8392-a6c8-452a`) — per `catalogueLink` `b066-2f8e-11ee-1dce`
  (`Orcs and goblins (…).cat:14916`) erklärte Abhängigkeit des Armeebuchs

Zeilenangaben ohne Dateipräfix beziehen sich auf
`Orcs and goblins (6th definitive edition).cat`.

> **Assertion-Form:** Je Roster ein `expect.capabilities[]`-Eintrag auf dem Slot
> der Aufwertung „Additional Hero choice" (`defId` = `e3cf-e551-eb3d-852e`,
> `frameDefId` = die tragende Einheit) mit `current` / `effectiveMin` /
> `effectiveMax`, dazu `expect.firing` / `expect.absent` für die beiden Grenzen
> `7198-b57b-4d7b-6c52` (min) und `8a24-9eaa-7a36-19d9` (max) sowie für die
> Kategorie- und Nachbargrenzen, die die Roster berühren. Die `condition` selbst
> ist **keine** zählende Grenze und taucht im Verletzungsbericht nie auf;
> beobachtbar ist allein ihre Wirkung auf die beiden Constraint-Werte — und,
> mittelbar, auf den Ist-Stand der Kategorie-Anker. Weitere
> Armeeaufbau-Diagnosen (General-/Core-Pflicht des Kontingents, Punktebudget)
> dürfen zusätzlich auftreten; die Erwartung ist selektiv.

---

## Die Regel (In-World)

Der Autor schreibt sie selbst in den Katalog, als `<comment>` am ersten
Modifikator (Z. 1242):

> (SoC, p.58) „Black Orc Warbosses and Black Orc Big Bosses only count as a
> further Hero choice if they have a mount of any type."

Modelliert ist das als Aufwertung **„Additional Hero choice"**
(`e3cf-e551-eb3d-852e`, Z. 1229) unterhalb der Einheit **„Black Orc Bigboss"**
(`febe-2170-775b-0d13`, Z. 1181): eine Aufwertung ohne `<costs>`, die
`categoryLinks` auf **Heroes** und **Characters** trägt und per `min 1`/`max 1`
**genau einmal** zu nehmen ist — es sei denn, die Einheit hat **kein** Reittier,
dann fallen beide Grenzen auf **0**.

Die Klammer, die das entscheidet (Z. 1238–1255), ist ein `and` aus **zwei**
Bedingungen:

```xml
<modifierGroups>
  <modifierGroup type="and">
    <modifiers>
      <modifier type="set" value="0" field="7198-b57b-4d7b-6c52">
        <comment>(SoC, p.58) "…only count as a further Hero choice if they have a mount of any type."</comment>
      </modifier>
      <modifier type="set" value="0" field="8a24-9eaa-7a36-19d9"/>
    </modifiers>
    <conditionGroups>
      <conditionGroup type="and">
        <conditions>
          <condition type="equalTo" value="0" field="selections"
                     scope="febe-2170-775b-0d13" childId="8a7a-d454-ad84-6f7e"
                     shared="true" includeChildSelections="true"/>
          <condition type="instanceOf" value="1" field="selections" scope="force"
                     childId="1821-fbd1-0d96-2d88" shared="true"
                     includeChildSelections="true"/>
        </conditions>
      </conditionGroup>
    </conditionGroups>
  </modifierGroup>
</modifierGroups>
```

---

## Was die Formatspezifikation über die Zelle sagt

- **Der `scope` darf eine Vorfahren-Id sein.** Die Aufzählung in
  [§7.6](../../battlescribe/building-blocks/constraint.md#76-constraint)
  (`parent | roster | force | category | self | unit | primary-catalogue`) ist
  keine abschließende Liste von Literalen: die Quelle zählt neben
  `parent|roster|force|primary category` ausdrücklich **Vorfahren-Ids** mit, und
  die XSD typt `scope` als nackten String (`Catalogue.xsd:426`, zitiert im
  [§7.6-Kasten](../../battlescribe/building-blocks/constraint.md#scopeprimary-catalogue--das-armeebuch-kein-zählrahmen)). Die
  Constraint-Ausprägung dieses Mechanismus — mit einer **Kategorie**-Id — pinnt
  das Nachbarszenario
  [`category-scope-ancestor-frame`](../category-scope-ancestor-frame/README.md)
  fest („der nächste Vorfahre, kein armeeweiter Rahmen"); die
  Ketten-Ausprägung `scope="ancestor"` das Szenario
  [`ancestor-scope-instance-of`](../ancestor-scope-instance-of/README.md). **Hier**
  steht eine **Eintrags**-Id in einer **Condition** — der nächste Vorfahre mit
  dieser Id, und das ist die tragende Einheit selbst.
- **Der Rahmen sagt nur, *wo* summiert wird.** Gezählt werden „`field`'s values
  of descendant selections" — hier also die Auswahlen unterhalb des Rahmens, die
  auf die `childId` passen ([§7.6-Regelkasten](../../battlescribe/building-blocks/constraint.md#76-constraint)).
  `childId="8a7a-d454-ad84-6f7e"` benennt die `selectionEntryGroup` „Mounts",
  `includeChildSelections="true"` nimmt auch verschachtelte Auswahlen mit.
- **`equalTo` ist exakte Gleichheit, nicht „mindestens".** Die Vergleichsarten
  sind in §7.7 aufgezählt (`lessThan`, `greaterThan`, `equalTo`, `notEqualTo`,
  `atLeast`, `atMost`, …); ein `equalTo 0` hält bei 0 und bei keinem anderen
  Zählwert. Präzedenz für die Trennung von `atLeast`:
  [`equal-to-force-toggle-count-gotrek`](../equal-to-force-toggle-count-gotrek/README.md).
- **`type="set"` auf `field="<constraint-id>"` ersetzt** den Wert dieses
  Constraints, solange die Bedingungen halten; halten sie nicht, bleibt der
  **geschriebene** Rohwert stehen (§7.7/§7.6).
- **Eine `modifierGroup` ist die Klammer** „dieselbe Bedingung an mehreren
  Modifiern" — gleichwertig dazu, sie an jedem einzelnen zu wiederholen (§7.7).
  Wer fragt „gattert der Katalog das überhaupt?", muss `<modifiers>` **und**
  `<modifierGroups>` durchsuchen.
- **`conditionGroup type="and"`** fordert **beide** Bedingungen; fällt eine, fällt
  die ganze Klammer (§7.7).
- **Sichtbarkeit vor Mindestmaß:** Min-Grenzen einer effektiv versteckten Entität
  werden **nicht** validiert (§5.6, verallgemeinert in §8). Vor jeder
  Min-Behauptung muss also feststehen, dass weder die Einheit noch die Aufwertung
  im betreffenden Kontingent versteckt ist — siehe **EAISM-R8**.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **EAISM-R1** | **Die beiden Grenzen und ihre Rohwerte.** Die Aufwertung „Additional Hero choice" `e3cf-e551-eb3d-852e` trägt genau zwei eigene Grenzen: `<constraint type="min" value="1" field="selections" scope="parent" shared="true" id="7198-b57b-4d7b-6c52" includeChildSelections="false"/>` und dieselbe Form als `type="max" value="1"` mit `id="8a24-9eaa-7a36-19d9"`. Ohne Modifikator gilt also **genau eine** solche Aufwertung je Bigboss (Muster „genau eins", §7.6). | Z. 1229 (`selectionEntry`, inline unter der Einheit, **kein** `entryLink`), Z. 1231/1232 (`constraints`). |
| **EAISM-R2** | **Der `scope` ist eine Vorfahren-Id, kein Schlüsselwort.** `scope="febe-2170-775b-0d13"` benennt den `selectionEntry` „Black Orc Bigboss" — dieselbe Einheit, unter der die Aufwertung inline steht. Die Id benennt **kein** Kontingent, **keine** Kategorie und **keinen** Verweis; sie kommt im Korpus 2× vor: als Definition (Z. 1181) und in genau diesem `scope` (Z. 1249). | Volltextsuche über die 5 Fixture-Dateien nach `febe-2170-775b-0d13`. `forceEntry`-Ids des Katalogs: Z. 47/62/75/88/110/123/136/147/162 — keine davon ist `febe-…`. |
| **EAISM-R3** | **Gezählt wird die Mounts-Gruppe dieser Einheit.** `childId="8a7a-d454-ad84-6f7e"` ist die `selectionEntryGroup` „Mounts" des Bigboss. Sie bietet drei Reittiere an: `selectionEntry` „Boar" `fd20-5671-fbd8-0523` (16 pts), `selectionEntry` „Chariot" `fd09-1ed9-f010-04dc` (0 pts, `categoryLinks` Special + Chariot) und den `entryLink` „Wyvern" `5ddb-5bfd-a86d-4ff6` (`hidden="true"`, nur im Kontingent „Mountain or Troll Country Waaagh!" eingeblendet). Die Roster wählen den **Boar** — das schlichteste Mitglied, ohne eigene `categoryLinks`. | Gruppe Z. 1359; Mitglieder Z. 1365 / Z. 1378 / Z. 1394. Die Id `8a7a-…` kommt im Korpus 2× vor: Definition (Z. 1359) und `childId` (Z. 1249). |
| **EAISM-R4** | **`equalTo 0` hält nur bei exakt 0 Reittieren.** Kein Reittier ⇒ Zählwert 0 ⇒ die Bedingung hält; ein Boar ⇒ Zählwert 1 ⇒ sie hält nicht. Ein `atLeast 0` an derselben Stelle hielte in **beiden** Fällen — genau darin unterscheiden sich Roster 01 und 03. | Bedingung Z. 1249 (`type="equalTo" value="0"`). Vergleichsarten: §7.7. |
| **EAISM-R5** | **Halten beide Bedingungen, fallen beide Grenzen auf 0.** Die `modifierGroup` trägt zwei `set`-Modifikatoren, deren `field` je eine der Constraint-Ids aus EAISM-R1 nennt. Effektiv gilt dann `min 0` **und** `max 0`: die Aufwertung ist weder Pflicht noch erlaubt. | Modifikatoren Z. 1241 (`set 0` auf `7198-…`) und Z. 1244 (`set 0` auf `8a24-…`); die Klammerbedingungen Z. 1246–1253 gelten für beide. |
| **EAISM-R6** | **Die zweite Halbklammer ist eine Kontingent-Prüfung.** `instanceOf value="1" scope="force" childId="1821-fbd1-0d96-2d88"` ist die **kanonische** Kodierung einer `forceEntry`-Instanzprüfung (§7.7-Kasten): `1821-…` ist das `forceEntry` „Grimgor's 'Ardboyz (SoC)". In jedem anderen Kontingent fällt die `and`-Klammer, unabhängig vom Reittier. | Bedingung Z. 1250; `forceEntry` Z. 147 (`publicationId="d2ec-…"`, `page="58"` — dieselbe Buchseite wie der Autoren-Kommentar). |
| **EAISM-R7** | **Der Bigboss ist in beiden benutzten Kontingenten wählbar.** Sein `set hidden="true"`-Modifikator ist auf die Sonderheere `c248-…` (Night Goblin Horde), `59e1-…` (Savage Orc Horde), `b26c-…` (Common Goblin Horde), `03cc-…` (Snotling Horde), `9f70-…` (Night Goblin Horde CJ#46) sowie auf `atLeast 1` Selektionen des Sondercharakters „Grom the Paunch" `5653-1e8a-640d-fc56` gegattert. Weder `1821-…` noch `2bfa-…` steht in dieser Liste, und keines der Roster enthält Grom. | Modifikator Z. 1452–1468; `forceEntry`s Z. 147 / Z. 47; `selectionEntry` „Grom the Paunch of Misty Mountain" Z. 8397 (`hidden="true"`). |
| **EAISM-R8** | **Die Aufwertung selbst ist nie versteckt** — ihr Mindestmaß ist also überhaupt validierbar (§5.6/§8). Sie trägt `hidden="false"` und **keinen** `field="hidden"`-Modifikator, weder in `<modifiers>` (sie hat keine) noch in ihrer `<modifierGroup>` (dort stehen ausschließlich die zwei Constraint-`set`s). Kontrast im selben Eintrag: die Geschwister „Shield", „Additional hand weapon", „Great Weapon", „Spear" tragen sehr wohl `set hidden="true"` (BSB-Gatter) — das Muster fehlt hier also nicht aus Nachlässigkeit. | Aufwertung Z. 1229–1256 (vollständig). Geschwister-`hidden`-Modifikatoren Z. 1221, 1274, 1295, 1316. |
| **EAISM-R9** | **Die Aufwertung ist ein Kategorie-Träger.** Sie trägt `categoryLink f0ef-f989-71af-8321 → c16b-f319-2c62-2c12` („Heroes") und `categoryLink 5ad5-4a72-28c3-edf2 → 7a1c-d611-c2dc-def1` („Characters"), beide `primary="false"`. Ihre Wahl erhöht damit den Ist-Stand **beider** Kategorie-Anker des Kontingents um 1 — das ist die „further Hero choice" des Regeltexts, in Daten gegossen. | `categoryLinks` Z. 1234–1237. Kategorie-Anker je Kontingent: `categoryLink` Heroes `1f4a-2cfd-d554-d6d8` / Characters `a8af-cd48-a633-9f00` (Z. 154/152, Grimgor) bzw. `3b7e-2aff-641b-2e7a` / `a541-7b89-797d-8285` (Z. 54/52, Standard). |
| **EAISM-R10** | **Die Kategoriegrenzen selbst werden in keinem Roster gerissen.** „Heroes" trägt `max -1` (`7fca-63fb-63d2-9dad`, `scope="force"`) — unbegrenzt, der Sentinel steht **hingeschrieben** (§7.6); kein Modifikator im Korpus adressiert diese Id. „Characters" trägt `max 3` (`c3c3-a80c-e026-200f`, `scope="force"`), punkteskaliert per `set`: `<200 ⇒ 1`, `200–499 ⇒ 2`, `2000–2999 ⇒ 4`, … — bei dem in allen Rostern gesetzten `costLimit` **1000 pts** greift **keiner** dieser Modifikatoren, es bleibt der Rohwert **3**. Höchststand in den Rostern: 3 (Roster 06) — exakt erreicht, nicht überschritten. | `.gst` Z. 366–371 (Heroes), Z. 641–720 (Characters, alle sieben `set`-Modifikatoren); `<costLimits>` je Roster. Volltextsuche nach `7fca-…`/`c3c3-…`: nur `.gst`. |
| **EAISM-R11** | **Die Nachbargrenzen der Einheit bleiben in allen Rostern still** und taugen deshalb als Negativ-Anker: Mounts-Gruppe `max 1` (`b1f4-515f-23ef-a9d8`) — höchstens ein Reittier je Bigboss; Mounts-Gruppe `min 0` (`a90d-4ca4-299a-1a72`) — nur im Kontingent „Nomadic Badlands Waaagh!" `1f55-c922-66d8-08ef` per `set 1` gehoben, das hier nie vorkommt; Boar `max 1` (`6aab-cec4-e779-f7f6`); Pflichtwaffe „Choppa" `min 1` (`50f1-d94f-dc4a-b808`) — in **jedem** Roster gewählt; Punktegrenze der Einheit `max -1` (`137d-0a2a-e477-e1a8`) — nur unter „Border Patrols rules" `4e15-0353-165f-5528` auf 125 gesetzt, in keinem Roster vorhanden. | Z. 1361 / 1362 (+ Modifikator Z. 1408) / 1367 / 1196 / 1477 (+ Modifikator Z. 1469). „Border Patrols rules": `.gst` Z. 17584 (`hidden="true"`). |

### Was die Roster über den **Rahmen** sagen — und was nicht

Der `scope` benennt hier die Einheit, unter der die tragende Aufwertung
**unmittelbar** hängt. Damit fallen in dieser Datenlage mehrere Rahmen zusammen:

| Rahmen | Bezeichneter Knoten in diesen Rostern | Zählwert |
|--------|----------------------------------------|----------|
| `scope="febe-2170-775b-0d13"` (Vorfahren-Id) | der Bigboss, unter dem die Aufwertung steht | 0 bzw. 1 |
| `scope="parent"` | derselbe Bigboss (die Aufwertung ist sein direktes Kind) | identisch |
| `scope="unit"` | derselbe Bigboss (nächster Vorfahre mit `type="unit"`, §7.7-Kasten) | identisch |

**Konsequenz, offen deklariert:** Die Roster 01–05 pinnen das **Zählergebnis** im
Rahmen der tragenden Einheit — sie können `parent`, `unit` und die Vorfahren-Id
**nicht** voneinander unterscheiden. Ein solcher Fall wäre nur mit einem Bigboss
**unterhalb** einer anderen Einheit baubar; der Katalog kennt ihn nicht (der
Bigboss ist ein Wurzel-`selectionEntry`, Z. 1181, und wird von keinem `entryLink`
unter eine andere Einheit gehängt).

Was Roster 06 sehr wohl abgrenzt, ist die **Weite** des Rahmens: `febe-…`
bezeichnet die **jeweils eigene** Einheit, nicht „irgendwo im Kontingent". Mit
zwei Bigbosses — einer ohne, einer mit Reittier — muss die Bedingung für den
einen halten und für den anderen fallen. Ein kontingent- oder rosterweiter
Zählrahmen (oder ein `shared="true"`, das den `scope="parent"`-Zähler roster-weit
teilt) fällt dort auf.

### Was eine falsche Lesart produzieren würde

| Fehl-Lesart | Roster 01 | Roster 03 | Roster 05 | Roster 06 |
|---|---|---|---|---|
| **Vorfahren-Id im `scope` nicht aufgelöst** ⇒ Bedingung fällt ⇒ min bleibt 1 | `7198-…` feuert **Ist 0 / Grenze 1** — **fällt auf** | still (feuert ohnehin korrekt) | still (feuert ohnehin korrekt) | `7198-…` feuert — **fällt auf** |
| **Vorfahren-Id im `scope` nicht aufgelöst** ⇒ Bedingung als *wahr* behandelt ⇒ min/max fallen auf 0 | still (korrekt, aber unbewiesen) | `7198-…` feuert **nicht** — **fällt auf** | `7198-…` feuert **nicht** — **fällt auf** | still |
| **`equalTo` wie `atLeast` gelesen** (0 ≤ 1 hielte auch mit Reittier) | still | `7198-…` feuert **nicht** — **fällt auf** | still | `7198-…` feuert **nicht** — **fällt auf** |
| **Rahmen zu weit** (Kontingent/Roster statt der benannten Einheit) | still | still | still | `7198-…` feuert für Bigboss A — **fällt auf** |
| **`and`-Klammer als `or` gelesen** (Kontingentprüfung genügt nicht) | still | still | `7198-…` feuert **nicht** — **fällt auf** | still |
| **Kategorie-Links der Aufwertung ignoriert** | still | still | still | Heroes/Characters melden `current` 2 statt 3 — **fällt auf** (ebenso in 02/04: 1 statt 2) |

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle sechs laufen
gegen **denselben** Datensatz (`.gst` + Orcs and Goblins `.cat` + Mercenaries
`.cat`) und tragen dasselbe Punktelimit **1000 pts**; 01 ↔ 02, 03 ↔ 04 und
01 ↔ 05 unterscheiden sich in jeweils **genau einem** Detail.

| # | Testtitel | Kontingent | Roster-Zustand | Erwartetes Ergebnis des Evaluators | Fixture |
|---|-----------|------------|----------------|-------------------------------------|---------|
| 01 | Kein Reittier ⇒ kein Heldenplatz | `1821-…` Grimgor's 'Ardboyz | Bigboss + Choppa. Kein Reittier, Aufwertung **nicht** gewählt. | **EAISM-R4/R5:** `7198-…` **und** `8a24-…` **absent**; der Slot meldet `effectiveMin 0`, `effectiveMax 0`, `current 0`. Kategorie-Anker: Heroes 1, Characters 1. | [`01-grimgor-no-mount-upgrade-unselected.ros`](rosters/01-grimgor-no-mount-upgrade-unselected.ros) |
| 02 | Kein Reittier, Aufwertung trotzdem gewählt | `1821-…` | Wie 01, **plus** „Additional Hero choice". | Die auf **0** gesetzte Obergrenze wird als Verletzung sichtbar: `8a24-…` feuert **Ist 1 / Grenze 0**; `7198-…` bleibt **absent**. Kategorie-Anker steigen auf Heroes 2 / Characters 2 (**EAISM-R9**). | [`02-grimgor-no-mount-upgrade-selected-max-zero.ros`](rosters/02-grimgor-no-mount-upgrade-selected-max-zero.ros) |
| 03 | Reittier ⇒ Pflicht bleibt stehen | `1821-…` | Wie 01, **plus** ein **Boar**. Aufwertung nicht gewählt. | **EAISM-R4:** Zählwert 1 ≠ 0, die Klammer fällt, die Rohwerte bleiben: `7198-…` feuert **Ist 0 / Grenze 1**, `8a24-…` **absent**; Slot: `effectiveMin 1`, `effectiveMax 1`, `isMandatoryUnmet true`. | [`03-grimgor-boar-upgrade-unselected-min-one.ros`](rosters/03-grimgor-boar-upgrade-unselected-min-one.ros) |
| 04 | Reittier + Heldenplatz ⇒ legal | `1821-…` | Wie 03, **plus** „Additional Hero choice". | Positive Kontrolle: beide Grenzen **absent**, Slot `current 1`, `effectiveMin 1`, `effectiveMax 1`, `headroom 0`. Belegt, dass die Stille in 01 an den **gesetzten** Werten liegt, nicht an einem gar nicht bewerteten Slot. | [`04-grimgor-boar-upgrade-selected-legal.ros`](rosters/04-grimgor-boar-upgrade-selected-legal.ros) |
| 05 | **Kontrolle:** anderes Kontingent | `2bfa-…` Standard (OG-AB) | **Baugleich zu 01**; einziger Unterschied ist das `entryId` der `<force>`. | **EAISM-R6:** Die `equalTo`-Hälfte hält (0 Reittiere), die `instanceOf`-Hälfte nicht — die `and`-Klammer fällt: `7198-…` feuert **Ist 0 / Grenze 1**, `8a24-…` **absent**. | [`05-standard-force-no-mount-min-one.ros`](rosters/05-standard-force-no-mount-min-one.ros) |
| 06 | **Der Rahmen ist je Einheit** | `1821-…` | **Zwei** Bigbosses: A ohne Reittier und ohne Aufwertung, B mit Boar **und** Aufwertung. | Für A hält die Klammer (0/0, nichts gewählt), für B fällt sie (1/1, eine Aufwertung): **beide** Grenzen **absent**. Kategorie-Anker Heroes 3 / Characters 3 (letzterer trifft seine Grenze 3 exakt). | [`06-grimgor-two-bigbosses-frame-per-unit.ros`](rosters/06-grimgor-two-bigbosses-frame-per-unit.ros) |

### Herleitung der Zahlen

`bound` ist stets der **wirksame** Wert des Constraints: entweder der
geschriebene `value` (`7198-…`: `1`; `8a24-…`: `1`) oder der per `set`
ersetzte (`0`, wenn die Klammer hält). `actual` folgt aus dem Roster-Aufbau
unter `scope="parent"` — gezählt werden die Selektionen der Aufwertung im Rahmen
des jeweiligen Bigboss:

- **01:** Klammer hält ⇒ `min 0`/`max 0`; 0 Selektionen ⇒ 0 ≥ 0 und 0 ≤ 0, beide still.
- **02:** Klammer hält ⇒ `max 0`; 1 Selektion ⇒ **Ist 1 / Grenze 0**.
- **03/05:** Klammer fällt ⇒ `min 1`; 0 Selektionen ⇒ **Ist 0 / Grenze 1**.
- **04:** Klammer fällt ⇒ `min 1`/`max 1`; 1 Selektion ⇒ beide erfüllt.
- **06:** A: Klammer hält ⇒ 0/0 bei 0 Selektionen; B: Klammer fällt ⇒ 1/1 bei 1
  Selektion. Beide still.

Der Ist-Stand der **Kategorie-Anker** folgt aus **EAISM-R9** und den
`categoryLinks` der Einheit (Heroes primär `ce7a-a22f-e34b-a6d1`, Characters
`cbb7-2a81-f1eb-4939`, Z. 1188–1192): je Bigboss 1, je gewählter Aufwertung
1 weiterer — die Kategoriegrenzen zählen `scope="force"` mit
`includeChildSelections="true"`, verschachtelte Aufwertungen zählen also mit
(§7.6/§5.5). Choppa und Boar tragen **keine** `categoryLinks` und zählen nicht mit.

---

### Bewusst nicht Teil des Verletzungsberichts

| Facette | Warum nicht als feuernde Grenze / Assertion erwartet |
|---------|------------------------------------------------------|
| **Die `condition` selbst** | Eine `condition` ist keine `constraint`. Der Verletzungsbericht kodiert zählende Grenzen, keine Bedingungen — die Zelle ist nur mittelbar über die gesetzten Constraint-Werte und über die Slot-Projektion beobachtbar. |
| **Sichtbarkeit** (`field="hidden"`) — der Bigboss ist in fünf Sonderheeren verborgen (Z. 1452–1468), seine Waffen- und Schild-Optionen bei einem Battle-Standard-Bearer (Z. 1221 ff.), das Reittier „Wyvern" außerhalb des Mountain-Kontingents (Z. 1394). | Verfügbarkeit, keine zählende Schranke. Sie ist hier nur **Voraussetzung** der Min-Behauptung (EAISM-R7/R8, §5.6/§8), nicht die geprüfte Aussage. In den Rostern wird sie ausschließlich als `isHidden: false` am Slot der Aufwertung mitgepinnt. |
| **Der Autoren-Kommentar** (`<comment>` am `set`-Modifikator, Z. 1242) | Ein `<comment>` ist Dokumentation, kein `field="error"/"warning"/"info"` — er erzeugt **keine** Meldung im Bericht (Abgrenzung zu [`author-message-severity`](../author-message-severity/README.md)). |
| **`anchorKind` des Slots der Aufwertung** | Ob ein Slot mit gehobener Pflicht als `mandatoryPhantom` und derselbe Slot mit `min 0` als `offerAnchor` geführt wird, ist eine Aussage über die Slot-Taxonomie der Engine, nicht über die Katalogdaten. Das Manifest benennt den Slot deshalb über `defId` + `frameDefId` und behauptet die Herkunftsart nicht (Präzedenz: [`not-instance-of-force-gate`](../not-instance-of-force-gate/README.md)). |
| **Der Slot der Aufwertung in Roster 06** | Dort steht **dieselbe** Definition zweimal unter **demselben** `frameDefId` (zwei Bigbosses). Eine `capabilities`-Auswahl über `defId` + `frameDefId` träfe zwei Slots; der `path` eines Slots ist aus den Katalogdaten nicht ableitbar. Roster 06 behauptet deshalb nur `firing`/`absent` und die Kategorie-Anker. |
| **General- und Core-Pflichten des Kontingents** (`.gst`: General `min 1`/`max 1` `1077-7379-f142-f382` / `d818-c60d-b1f8-8aaa`; Core `min 2` `35c2-d478-392a-aeb1`) | Sie feuern in **allen** Rostern, weil bewusst weder ein General noch eine Core-Einheit gewählt ist — jede zusätzliche Auswahl würde den Fall verwässern. Die Erwartung ist selektiv; diese Ids stehen deshalb weder in `firing` noch in `absent`. |
| **Der Zwilling „Black Orc Warboss"** aus demselben Regeltext | Der Katalog modelliert die Regel **nur** am Bigboss: die Suche nach `equalTo` mit Id-`scope` liefert im ganzen Korpus **genau ein** Vorkommen (Z. 1249). Ein zweiter Träger existiert schlicht nicht. |
| **Eine Diagnose für den Id-`scope`** (etwa `UNRESOLVED_SCOPE`) | Aus den erlaubten Quellen nicht entscheidbar: die Formatspezifikation regelt fail-closed-Verhalten samt Diagnose ausdrücklich nur für `primary-catalogue` ([§7.6-Kasten](../../battlescribe/building-blocks/constraint.md#scopeprimary-catalogue--das-armeebuch-kein-zählrahmen)) und für `unit` ohne umschließende Einheit ([§7.7-Kasten](../../battlescribe/building-blocks/modifier.md#scopeunit-und-scopeancestor--die-umschließende-einheit-und-die-vorfahrenkette)). Hier ist der Rahmen ohnehin in jedem Roster auflösbar (die Aufwertung steht immer unter ihrem Bigboss). Das Szenario fordert **weder** Anwesenheit **noch** Abwesenheit einer solchen Diagnose. |

---

## Abgleich mit dem Engine-Bericht (Runner-Verifikation)

Die oben aus den Katalogdaten **abgeleiteten** Erwartungen treffen die Engine erst
im **Runner-Lauf** — der separate Verifikationsschritt, der nicht zur (blinden)
Autorenschaft gehört (siehe
[ADR 0033](../../adr/0033-evaluator-e2e-manifest-runner-und-black-box-autorenschaft.md)).
Abweichungen sind zu **untersuchen**, nicht durch Anpassen der Erwartung
wegzudefinieren. Die erwartungsgemäß heiklen Stellen:

1. **EAISM-R2/R4** — ob ein Id-wertiger `scope` an einer *Condition* überhaupt als
   Vorfahren-Rahmen erkannt wird (statt als unbekanntes Schlüsselwort still
   zu scheitern). Roster 01 unterscheidet beides maximal: die richtige Lesart
   liefert „hält" (Grenzen 0/0, alles still), jede Fehl-Lesart entweder eine
   feuernde Pflicht (01) oder eine fehlende (03/05).
2. **EAISM-R5** — dass **beide** `set`-Modifikatoren der `modifierGroup`
   gemeinsam gattert werden. Feuerte in 02 die Obergrenze nicht, wäre der
   zweite Modifikator (ohne eigenen `<comment>`) unter den Tisch gefallen.
3. **`effectiveMin: 0` statt `null`** in 01/02: der Katalog schreibt `min 1` hin
   und der Modifikator **ersetzt** den Wert durch `0` — es existiert also ein
   Mindestmaß mit dem Wert 0, nicht „kein Mindestmaß". Dieselbe Unterscheidung
   wie in [`not-instance-of-force-gate`](../not-instance-of-force-gate/README.md).
4. **Roster 06** — die Weite des Rahmens **und** die Frage, ob `shared="true"`
   einen `scope="parent"`-Zähler roster-weit teilt. Beide Fehl-Lesarten machen
   dort eine Grenze sichtbar, die nach den Daten still bleiben muss.
5. **Die Kategorie-Anker** (EAISM-R9/R10) — dass eine **verschachtelte**
   Aufwertung mit `categoryLinks` in den force-skopierten Kategoriezähler
   eingeht (`includeChildSelections="true"`). Meldet der Heroes-Anker in 02/04
   `current 1` statt `2`, ist genau die In-World-Regel „counts as a further Hero
   choice" nicht abgebildet.

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Spielsystem WHFB 6th definitive | `0d13-7737-ea86-4662` |
| Katalog **Orcs and Goblins** (rev 1, Z. 2) | `4049-c46d-7f80-44fb` |
| Bibliothek **Mercenaries** (per `catalogueLink` `b066-2f8e-11ee-1dce`, Z. 14916) | `fc47-8392-a6c8-452a` |
| ForceEntry „Grimgor's 'Ardboyz (SoC)" (Ziel der `instanceOf`-Hälfte, Z. 147) | `1821-fbd1-0d96-2d88` |
| ForceEntry „Standard (OG-AB)" (Kontrolle, Z. 47) | `2bfa-e64a-7123-895f` |
| SelectionEntry „Black Orc Bigboss" (Ziel des Id-`scope`, Z. 1181) | `febe-2170-775b-0d13` |
| — dessen `categoryLink`s Characters / Heroes (primär) / Orc (Z. 1188–1192) | `cbb7-2a81-f1eb-4939` / `ce7a-a22f-e34b-a6d1` / `9d88-9758-596f-213d` |
| — dessen Pflichtwaffe „Choppa" (Z. 1194) mit min 1 / max 1 | `fc44-61e2-499b-da8d` — `50f1-d94f-dc4a-b808` / `3260-5a0e-a9d0-3b47` |
| — dessen Punktegrenze `max -1` (Z. 1477, nur unter „Border Patrols" auf 125) | `137d-0a2a-e477-e1a8` |
| SelectionEntry „Additional Hero choice" (Träger beider Grenzen, Z. 1229) | `e3cf-e551-eb3d-852e` |
| — die gegatterten Grenzen (min 1 / max 1, `scope="parent"`, Z. 1231/1232) | `7198-b57b-4d7b-6c52` / `8a24-9eaa-7a36-19d9` |
| — deren `set 0`-Modifikatoren (Z. 1241/1244) in der `modifierGroup` Z. 1238–1255 | — |
| — die `equalTo`-Bedingung mit Vorfahren-Id im `scope` (Z. 1249) | `scope="febe-2170-775b-0d13"`, `childId="8a7a-d454-ad84-6f7e"` |
| — die `instanceOf`-Bedingung auf das Kontingent (Z. 1250) | `childId="1821-fbd1-0d96-2d88"` |
| — deren `categoryLink`s Heroes / Characters (Z. 1235/1236) | `f0ef-f989-71af-8321` / `5ad5-4a72-28c3-edf2` |
| SelectionEntryGroup „Mounts" (Ziel der `childId`, Z. 1359) | `8a7a-d454-ad84-6f7e` |
| — deren Grenzen max 1 (Z. 1361) / min 0 (Z. 1362, `set 1` nur bei `1f55-…`, Z. 1408) | `b1f4-515f-23ef-a9d8` / `a90d-4ca4-299a-1a72` |
| — Mitglied „Boar" (16 pts, max 1; in 03/04/06 gewählt, Z. 1365) | `fd20-5671-fbd8-0523` — `6aab-cec4-e779-f7f6` |
| — Mitglied „Chariot" (0 pts, max 1; nicht benutzt, Z. 1378) | `fd09-1ed9-f010-04dc` — `44ff-3763-b1c1-3f3b` |
| — Mitglied `entryLink` „Wyvern" (`hidden="true"`, Z. 1394) | `5ddb-5bfd-a86d-4ff6` → `b184-b03c-693b-53b1` |
| Kategorie „Heroes" (`.gst` Z. 366) — Grenze `max -1`, `scope="force"` (Z. 368) | `c16b-f319-2c62-2c12` — `7fca-63fb-63d2-9dad` |
| Kategorie „Characters" (`.gst` Z. 641) — Grenze `max 3`, punkteskaliert (Z. 644) | `7a1c-d611-c2dc-def1` — `c3c3-a80c-e026-200f` |
| Kategorie-`categoryLink`s der Kontingente (Heroes / Characters) | Grimgor: `1f4a-2cfd-d554-d6d8` / `a8af-cd48-a633-9f00` — Standard: `3b7e-2aff-641b-2e7a` / `a541-7b89-797d-8285` |
| Kostenart „pts" (Roster-`costLimit` 1000) | `ecfa-8486-4f6c-c249` |
| Kontingent „Nomadic Badlands Waaagh! (OG-AB)" (hebt die Mounts-Pflicht; nie benutzt, Z. 123) | `1f55-c922-66d8-08ef` |
| Sondercharakter „Grom the Paunch" (Teil des `hidden`-Gatters; nie benutzt, Z. 8397) | `5653-1e8a-640d-fc56` |
| „Border Patrols rules" (Teil der Punkte-/Kategorie-Gatter; nie benutzt, `.gst` Z. 17584) | `4e15-0353-165f-5528` |
