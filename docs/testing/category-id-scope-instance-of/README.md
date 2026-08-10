# E2E-Regeln & Testkatalog: Kategorie-Id im `scope` einer **Condition** — der nächste Vorfahre, kein Nachfahre

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln, IDs und
Erwartungswerte sind **ausschliesslich aus den Katalogdaten** des
**upstream**-Fixture-Satzes (`src/__fixtures__/whfb6/`) und der
Formatspezifikation ([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md),
§7.6/§7.7/§8) abgeleitet. Die Roster-Form folgt der an diesem Satz bereits
verifizierten Gestalt (direktes `entryId`, `entryLinkId=""`, verschachtelte
`selections` mit `number`) aus
[`vampire-bloodlines-ergofang`](../vampire-bloodlines-ergofang/README.md), das
gegen dieselbe `.gst`/`.cat` läuft.

- Spielsystem: `Warhammer Fantasy Battle 6th edition.gst`
  (`6d8e-38d9-3c69-febf`, rev 8) — einziges Kontingent: `forceEntry`
  **„Standard "** `7d9d-6c8d-4ea0-b7ad` (`:61`, das Schluss-Leerzeichen im Namen
  steht so im Katalog).
- Armeebuch: `Vampire Counts.cat` (`ea4b-9294-3427-1fc1`, rev 10,
  `gameSystemId="6d8e-38d9-3c69-febf"`, `gameSystemRevision="8"`).
- **Keine** weitere `.cat`: der upstream-Vampire-Counts-Katalog trägt **kein**
  `<catalogueLinks>` (0 Treffer im ganzen Satz), anders als die Definitive
  Edition mit ihrer Mercenaries-Abhängigkeit.

> **Warum der upstream-Satz und nicht die Definitive Edition?** Genau dieselbe
> Einheit — der Vampire Lord `b77b-88d5-5e80-e178` — trägt in **beiden**
> Katalogen am **selben** `infoLink` `e0f2-8568-15f0-a384` bedingte
> Merkmals-Modifikatoren. Verschieden ist nur, **wo** die Clan-Kategorie steht:
>
> | | Definitive Edition (`src/evaluator/__fixtures__/whfb6-definitive/`) | **upstream** (`src/__fixtures__/whfb6/`, dieses Szenario) |
> |---|---|---|
> | Bedingung | `scope="b77b-88d5-5e80-e178"` (**Eintrags**-Id = die Einheit selbst), `childId="<Clan-Kategorie>"` | `scope="<Clan-Kategorie>"`, `childId="model"` |
> | Kategorie kommt an die Einheit … | per `modifier add field="category"` **an der Einheit** | **gar nicht** — nur per `categoryLink` an der Blutlinien-Aufwertung **darunter** |
> | Rahmen löst auf? | **ja** (der Träger ist sein eigener Vorfahre) | **nein** (kein Vorfahre trägt die Kategorie) |
> | Folge | WS/A ändern sich je Blutlinie ([`nested-modifier-group`](../nested-modifier-group/README.md)) | WS/A bleiben **unverändert** — dieses Szenario |
>
> Die beiden Szenarien sind damit die **positive** und die **negative** Richtung
> derselben Rahmenregel, gepinnt an derselben Einheit.

---

## Die Regel (In-World)

Nennt der `scope` einer Query eine **Kategorie-Id**, dann ist der Bezugsrahmen
der **nächste Vorfahre der tragenden Auswahl — die tragende Auswahl
eingeschlossen —, der diese Kategorie trägt**. Die Quelle nennt die Vorfahren-Ids
in einem Atemzug mit den Literalen:

> `Scope` - one of `parent|roster|force|primary category` **or any type of
> ancestor identifier**, this decides which entity should sum up all `field`'s
> values of descendant selections of this constraint's parent entry.
> — [BSData-Wiki, *Data structure overview*, Abschnitt *Constraint*](../../bsdata-catalogue-development-wiki/Data-structure-overview.md)

Die XSD trägt `scope` an der gemeinsamen `QueryBase` und typt es als nackten
String; sie unterscheidet `scope` **nicht** nach Query-Art
([§7.7-Kasten „Ziel-Typ-Regel"](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat):
*„das Datenformat (XSD `QueryBase`) unterscheidet `scope` nicht nach Query-Art"*).
Was für den `constraint` gilt, gilt also wortgleich für die `condition` — und
genau diese Übertragung nagelt dieses Szenario fest. Die
**Constraint**-Ausprägung ist bereits gepinnt in
[`category-scope-ancestor-frame`](../category-scope-ancestor-frame/README.md)
(CSAF-R1/R2/R3), an einem anderen Datensatz.

Drei Folgerungen:

1. Eine Kategorie-Id im `scope` ist **kein armeeweiter Filter**. Dass irgendwo im
   Kontingent eine Auswahl mit dieser Kategorie steht, ist ohne Belang, solange
   sie nicht **Vorfahre** der tragenden Auswahl ist.
2. Ein **Nachfahre** löst den Rahmen erst recht nicht auf. Die Vorfahrenrelation
   ist eine Kette **nach oben**
   ([§7.7-Kasten](../../battlescribe-data-format.md#scope-unit-ancestor):
   *„die gesamte strikte Kette, Kontingente eingeschlossen"*); „unter mir hängt
   etwas mit dieser Kategorie" ist keine Vorfahren-Aussage.
3. Löst der Rahmen nicht auf, **hält die Bedingung nicht** — der gegattete
   Modifikator wirkt nicht. Nicht „hält trivial", nicht „hält mit Zählwert 0 und
   deshalb bei `value="0"` doch": ohne Rahmen gibt es nichts zu prüfen. Das ist
   die fail-closed-Richtung, die die Formatspezifikation an den beiden Stellen
   vorgibt, wo sie einen unauflösbaren Rahmen überhaupt regelt
   ([`primary-catalogue`](../../battlescribe-data-format.md#scope-primary-catalogue),
   [`unit` ohne umschliessende Einheit](../../battlescribe-data-format.md#scope-unit-ancestor)).

---

## Der Träger: die drei gegatteten Merkmals-Modifikatoren des Vampire Lord

`Vampire Counts.cat:1301-1334` (vollständig, nur um Kosten gekürzt):

```xml
<selectionEntry id="b77b-88d5-5e80-e178" name="Vampire Lord" … type="unit">
  <constraints>
    <constraint field="selections" scope="roster" value="1.0" … id="a7c9-5fec-592a-3716" type="max"/>
  </constraints>
  <infoLinks>
    <infoLink id="e0f2-8568-15f0-a384" name="Vampire Lord"
              targetId="ff43-329c-048a-f374" type="profile">          <!-- :1306 -->
      <modifierGroups>
        <modifierGroup>                                               <!-- :1308 äussere Klammer, BEDINGUNGSLOS -->
          <modifiers>
            <modifier type="increment" field="f95b-da01-0578-3bdc" value="2">   <!-- WS +2 -->
              <conditions>
                <condition field="selections" scope="4cae-a20e-8374-b6cb" value="0.0"
                           percentValue="false" shared="true"
                           includeChildSelections="false" includeChildForces="false"
                           childId="model" type="instanceOf"/>         <!-- :1312  Blood Dragon -->
              </conditions>
            </modifier>
            <modifier type="decrement" field="f95b-da01-0578-3bdc" value="2">   <!-- WS -2 -->
              <conditions>
                <condition … scope="fc4b-a86d-5897-9e4c" … childId="model" type="instanceOf"/>
              </conditions>                                            <!-- :1317  Necrach -->
            </modifier>
          </modifiers>
          <modifierGroups>
            <modifierGroup>                                            <!-- :1322 innere Klammer -->
              <conditions>
                <condition … scope="bf30-4ff0-a4d8-3909" … childId="model" type="instanceOf"/>
              </conditions>                                            <!-- :1324  Strigoi -->
              <modifiers>
                <modifier type="increment" field="6b9f-c8fe-8998-27e3" value="1"/>  <!-- A +1 -->
              </modifiers>
            </modifierGroup>
          </modifierGroups>
        </modifierGroup>
      </modifierGroups>
    </infoLink>
  </infoLinks>
  <categoryLinks>                                                      <!-- :1335-1339 -->
    <categoryLink id="39e1-e476-eaff-58d1" targetId="d024-d25b-a9b4-73b6" primary="false"/>
    <categoryLink id="bf07-6d8b-b2e4-b984" targetId="d024-d25b-a9b4-73b6" primary="true"/>
    <categoryLink id="6f29-1df0-dca2-034c" targetId="7a1c-d611-c2dc-def1" primary="false"/>
  </categoryLinks>
  …
</selectionEntry>
```

Das geteilte Profil `ff43-329c-048a-f374` „Vampire Lord" (`:4971-4983`,
`typeId="a54a-7f00-29bf-12b1"` „Profile") schreibt: Mv 6, **WS 8**, BS 6, S 5,
T 5, W 4, I 8, **A 5**, Ld 10.

### Der Befund: die drei `scope`-Kategorien sind nur **unter** der Einheit zu haben

Die drei `scope`-Ids sind `categoryEntry`-Elemente **desselben** Katalogs
(`:11-13`): Necrach `fc4b-a86d-5897-9e4c`, Blood Dragon `4cae-a20e-8374-b6cb`,
Strigoi `bf30-4ff0-a4d8-3909`. Sie kommen im ganzen Satz auf **genau zwei**
Wegen an eine Auswahl:

| Weg | Fundstellen | Wirkt auf |
|-----|-------------|-----------|
| `modifier type="add" field="category"` | **nirgends** — `field="category"` hat im ganzen upstream-Satz **13 Treffer, davon 7 in `Ogre Kingdoms.cat` und 6 in `Orcs and Goblins.cat`, 0 in `Vampire Counts.cat` und 0 in der `.gst`** | — |
| `categoryLink targetId="<Clan>"` | ausschliesslich an den **Blutlinien-Aufwertungen** innerhalb der je-Charakter-Gruppen „Bloodline" | die Aufwertung selbst |

Für den **Vampire Lord** heisst das konkret: die Kategorie-Träger sind die fünf
Mitglieder seiner Gruppe „Bloodline" `01b8-338b-6b92-e37f` (`:1372`) —
Von Carstein `a13a-36f6-00d9-4ae6` (`:1378`), Necrach `5a11-4f11-3806-c00c`
(`:1518`, `categoryLink` `86dc-9021-f073-6dec` → `fc4b…`), Blood Dragon
`0158-ed16-cbbf-6a78` (`:1602`, `categoryLink` `85db-e156-f433-69e1` → `4cae…`),
Strigoi `ef7a-5896-8856-076b` (`:1763`, `categoryLink` `261b-6e13-782f-68c1` →
`bf30…`) und Lahmia `20cf-d4a7-041d-43f4` (`:1783`).

Die Vorfahrenkette der Bedingung lautet dagegen:

```
condition  →  infoLink e0f2-…  →  selectionEntry "Vampire Lord" b77b-…
           →  forceEntry "Standard " 7d9d-…  →  Roster
```

Keines dieser vier Glieder trägt jemals `4cae…`, `fc4b…` oder `bf30…`:

- **Vampire Lord:** `categoryLink`s nur Lord `d024-d25b-a9b4-73b6` (zweimal, eine
  davon `primary="true"`) und Characters `7a1c-d611-c2dc-def1` (`:1335-1339`);
  die Einheit trägt **keine** `<modifiers>` (`:1301-1920` gelesen: auf
  `<constraints>` folgen `<infoLinks>`, `<categoryLinks>`, `<selectionEntries>`,
  `<selectionEntryGroups>`, `<entryLinks>`, `<costs>` — kein `<modifiers>` auf
  Entitätsebene).
- **Kontingent „Standard "** `7d9d-6c8d-4ea0-b7ad`: seine sieben `categoryLink`s
  (`.gst:63`, `:87`, `:88`, `:139`, `:177`, `:215`, `:250`) zielen auf Lord,
  Heroes, Core, Special, Rare, Characters und Special Characters — die drei
  Clan-Ids kommen in der `.gst` **überhaupt nicht** vor.
- **Roster:** trägt keine Kategorien.

**Der Kategorie-Rahmen löst also in keinem baubaren Roster auf** — und die
Blutlinie, die der Spieler wählt, steht immer **unter**, nie **über** der
Einheit.

> **Die In-World-Absicht — und wie derselbe Katalog sie zwei Zeilen weiter
> korrekt ausdrückt.** Gemeint war offenkundig „hat dieser Vampir die Blutlinie
> X?". Genau diese Frage stellt derselbe Katalog an der Gruppe „Wizard Level"
> desselben Vampire Lord **richtig herum** — Kategorie in `childId`, Rahmen in
> `scope`:
>
> ```xml
> <condition field="selections" scope="parent" value="0.0" … childId="4cae-a20e-8374-b6cb"
>            includeChildSelections="true" type="greaterThan"/>   <!-- :1879, :1896 -->
> ```
>
> (am `decrement` der Casting-Dice-Kosten von „Wizard level 2" `42d9-cebe-18d5-cdbd`
> bzw. „Wizard level 3" `649a-8bc1-fb66-ed73`). Dort zählt `scope="parent"`
> **einschliesslich verschachtelter Auswahlen** die Blood-Dragon-Kategorie unter
> dem Vampir — und trifft. Bei den Merkmals-Modifikatoren am `infoLink` hat der
> Autor Rahmen und Ziel vertauscht (`childId="model"`, Kategorie im `scope`).
> Dieses Szenario prüft die **Datenlage**, nicht die Absicht. Dieselbe
> Autoren-Verwechslung, in der Constraint-Ausprägung, ist der Gegenstand von
> [`category-scope-ancestor-frame`](../category-scope-ancestor-frame/README.md);
> auch im upstream-Satz steht sie mehrfach (`:872`, `:1081`, `:1150`, `:1259`,
> `:1419`, `:1559`, `:1664`, `:1824`, …: `constraint … scope="bf30-4ff0-a4d8-3909"
> value="0" type="max"` an den „Mounts (Stirgoi cannot chose this)"-Gruppen).

### Warum die Lesart unter **beiden** denkbaren `instanceOf`-Deutungen dieselbe ist

`childId="model"` ist ein **Typ-Keyword**, keine Id
([§7.7](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat):
*„`childId`: … eine Ziel-ID, ein Typ-Keyword (`model`, `unit`, `upgrade`) oder
`any`"*). Für `scope="<Id>" + instanceOf` beschreibt die Formatspezifikation die
Bauform als **selbst-gegatet**
([§7.7-Kasten „zwei Kodierungen"](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat)):
die Id steht im `scope`, `childId` ist leer oder ein Platzhalter. Damit bleiben
zwei Lesarten offen:

| Lesart | Was geprüft wird | Ergebnis in **jedem** dieser Roster |
|---|---|---|
| **(a) Rahmen + Identitätsprüfung** | löse den Rahmen auf den nächsten Vorfahren mit der Kategorie auf, prüfe ihn dann gegen `childId="model"` | Rahmen löst **nicht** auf ⇒ hält nicht |
| **(b) selbst-gegatet** | hält genau dann, wenn ein Vorfahre die Kategorie trägt (`childId` Platzhalter) | **kein** Vorfahre trägt sie ⇒ hält nicht |

Beide Lesarten fallen hier zusammen — die Erwartung dieses Szenarios ist von der
offenen Frage also **unabhängig**. (Zur Vollständigkeit: unter (a) käme selbst
ein aufgelöster Rahmen nicht durch, denn der Vampire Lord ist
`type="unit"`, nicht `model`.) `value="0.0"` ist bei `instanceOf` ohne Wirkung
(§7.6/§7.7: *„Bei `instanceOf`/`notInstanceOf` ohne Wirkung"*) — eine Lesart als
Zahlvergleich „0 Auswahlen ⇒ trifft zu" ist damit ausgeschlossen.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **CISI-R1** | Der `scope` einer `condition` darf eine **Kategorie-Id** nennen; der Rahmen ist dann der **nächste Vorfahre der tragenden Auswahl — sie eingeschlossen —, der diese Kategorie trägt**. Dieselbe Regel wie beim `constraint`. | `Vampire Counts.cat:1312/1317/1324` — `condition … scope="4cae-a20e-8374-b6cb"` / `"fc4b-a86d-5897-9e4c"` / `"bf30-4ff0-a4d8-3909"`, alle drei `categoryEntry` desselben Katalogs (`:11-13`). Wiki-Zitat oben (*„or any type of ancestor identifier"*); XSD-`QueryBase` unterscheidet `scope` nicht nach Query-Art ([§7.7](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat)). Präzedenz für die Constraint-Ausprägung: CSAF-R1 in [`category-scope-ancestor-frame`](../category-scope-ancestor-frame/README.md). |
| **CISI-R2** | Eine Kategorie, die nur ein **Nachfahre** trägt, löst den Rahmen **nicht** auf. Die Blutlinie hängt *unter* dem Vampire Lord, nicht *über* ihm. | Gruppe „Bloodline" `01b8-338b-6b92-e37f` (`:1372`) ist Kind des `selectionEntry` `b77b-88d5-5e80-e178` (`:1301`); die Clan-`categoryLink`s hängen an ihren Mitgliedern (`:1520`, `:1604`, `:1765`, `:1785`). Vorfahrenrelation = Kette nach oben ([§7.7-Kasten](../../battlescribe-data-format.md#scope-unit-ancestor)). Präzedenz für „Geschwister/Nicht-Vorfahre zählt nicht": CSAF-R3. |
| **CISI-R3** | **Kein** Vorfahre der Bedingung trägt jemals eine der drei Clan-Kategorien — der Rahmen löst in keinem baubaren Roster auf. | Vampire Lord `categoryLink`s nur `d024-d25b-a9b4-73b6` (×2) und `7a1c-d611-c2dc-def1` (`:1335-1339`); **kein** `modifier field="category"` im ganzen Katalog (13 Treffer im Satz, alle in `Ogre Kingdoms.cat`/`Orcs and Goblins.cat`); Kontingent `7d9d-6c8d-4ea0-b7ad` (`.gst:61-252`) und `.gst` insgesamt ohne jede Erwähnung von `4cae…`/`fc4b…`/`bf30…`. |
| **CISI-R4** | Ein **nicht auflösbarer** Rahmen lässt die Bedingung **nicht halten** — der gegattete Modifikator wirkt nicht. Die geschriebenen Merkmalswerte stehen. | Fail-closed-Richtung der Formatspezifikation an ihren geregelten Stellen: [`primary-catalogue`](../../battlescribe-data-format.md#scope-primary-catalogue) (*„wertet fail-closed, statt still ein Armeebuch anzunehmen"*) und [`unit` ohne umschliessende Einheit](../../battlescribe-data-format.md#scope-unit-ancestor). Analog CSAF-R2: *„der Rahmen löst nicht auf, die Grenze feuert nie"*. |
| **CISI-R5** | Ausgangswerte sind die des geteilten Profils; erwartet werden also **WS 8** und **A 5** in **jedem** Roster. | `profile ff43-329c-048a-f374` „Vampire Lord" (`:4971-4983`, `typeId="a54a-7f00-29bf-12b1"`): `characteristic` WS `f95b-da01-0578-3bdc` = **8**, A `6b9f-c8fe-8998-27e3` = **5**. Merkmalstypen aus der `.gst` (`:15`, `:21`). |
| **CISI-R6** | `instanceOf` ist eine **Identitätsprüfung**, kein Zahlvergleich — `value="0.0"` ist wirkungslos. | [§7.7-Tabelle](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat), Zeile `percentValue`: *„Bei `instanceOf`/`notInstanceOf` ohne Wirkung"*. Präzedenz: NMG-R7 in [`nested-modifier-group`](../nested-modifier-group/README.md). |
| **CISI-R7** | Die **äussere** `modifierGroup` (`:1308`) ist bedingungslos und darf ihre Kinder weder unterdrücken noch pauschal anwenden; die innere (`:1322`) trägt allein die Strigoi-Bedingung. | `:1307-1332` vollständig gelesen: Kinder der äusseren Klammer sind `<modifiers>` (`:1309-1320`) und `<modifierGroups>` (`:1321-1330`), sonst nichts — kein `<conditions>`, `<conditionGroups>`, `<repeats>`, auch nicht **hinter** den Kindern (Fallstrick §7.7). Präzedenz: NMG-R1/R3. |
| **CISI-R8** | Die Pflicht-Gruppe „Bloodline" des Vampire Lord zählt ihre **Mitglieder**: `min 1` / `max 1`, `scope="parent"`. | `selectionEntryGroup` `01b8-338b-6b92-e37f` (`:1372`) mit `constraint … scope="parent" value="1.0" includeChildSelections="false" id="6c3a-e4ae-3667-440f" type="max"` (`:1374`) und `… id="e251-f353-704b-836a" type="min"` (`:1375`). [§7.6-Regelkasten](../../battlescribe-data-format.md#76-constraint): *„Eine Grenze an einer `selectionEntryGroup` zählt … **ihre Mitglieder**"*. Präzedenz: ERG-R1 in [`vampire-bloodlines-ergofang`](../vampire-bloodlines-ergofang/README.md) (dieselbe Gruppenform am Vampire **Count**), VBL-R2, NMG-R9. |

> **Korrektur an einem Nachbarszenario.**
> [`vampire-bloodlines-ergofang`](../vampire-bloodlines-ergofang/README.md)
> behauptet in seiner Vergleichstabelle für den upstream-Katalog „**keine**
> Profil-Modifikatoren; Bloodline schaltet Ausrüstung/Powers frei". Das ist am
> XML nicht haltbar: die Profil-Modifikatoren **existieren** (`:1310`, `:1315`,
> `:1327` am Vampire Lord; `:1927`, `:1932`, `:1944` wortgleich am Vampire Count
> `6822-0110-a7c9-cbb0`) — sie **wirken** nur nicht, weil ihr Kategorie-Rahmen
> nicht auflöst. Der Endzustand ist derselbe, die Begründung nicht; dieses
> Szenario pinnt die Begründung.

### Was eine Fehl-Lesart produzieren würde

Die Roster sind so gebaut, dass jede naheliegende Fehl-Lesart des
Kategorie-`scope` in mindestens einem Fall **sichtbar** wird:

| Fehl-Lesart | Roster 01 | Roster 02 (Blood Dragon) | Roster 03 (Strigoi) | Roster 04 (Necrach) | Roster 05 (beide) |
|---|---|---|---|---|---|
| Rahmen = **Kontingent/Roster, gefiltert auf die Kategorie** (armeeweite Lesart) | still (korrekt, aber unbewiesen) | WS **10** — **fällt auf** | A **6** — **fällt auf** | WS **6** — **fällt auf** | WS **10** *und* A **6** — **fällt auf** |
| Rahmen = **Nachfahren-Suche** („trägt irgendetwas unter mir die Kategorie?") | still | WS **10** — **fällt auf** | A **6** — **fällt auf** | WS **6** — **fällt auf** | **fällt auf** |
| Kategorie im `scope` **ignoriert** (Rahmen = `parent`/`self`, Bedingung hält immer) | WS 8+2−2 = 8, aber A **6** — **fällt auf** | dito — **fällt auf** | dito — **fällt auf** | dito — **fällt auf** | dito — **fällt auf** |
| Unaufgelöster Rahmen ⇒ **Zählwert 0**, `value="0"` als Zahlvergleich gelesen | WS 8 (±2), A **6** — **fällt auf** | **fällt auf** | **fällt auf** | **fällt auf** | **fällt auf** |
| Verschachtelte `modifierGroup` **gar nicht betreten** | still (A bliebe 5 — korrekt aus falschem Grund) | still | still | still | still — **nicht** unterscheidbar; das pinnt [`nested-modifier-group`](../nested-modifier-group/README.md) an der Definitive Edition, wo die Klammer wirkt |
| Gruppengrenze zählt **alle Kinder der Einheit** statt der Gruppenmitglieder | `e251…` bliebe still (4 Kinder ≥ 1) — **fällt auf** | `6c3a…` feuerte (4 Kinder > 1) — **fällt auf** | dito — **fällt auf** | dito — **fällt auf** | dito |

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle fünf laufen
gegen **denselben** Datensatz (`.gst` + `Vampire Counts.cat`) und **dasselbe**
Kontingent `7d9d-6c8d-4ea0-b7ad`.

**Die Pflicht-Kinder des Vampire Lord sind in allen fünf Rostern enthalten**,
damit ausser der jeweils untersuchten Grenze nichts an der Einheit selbst
unerfüllt bleibt:

| Pflicht | Grenze | im Roster |
|---|---|---|
| `selectionEntry` „Handweapon" `6abf-e08f-6480-cd58` (`:1341`) | `min 1` `d830-89e1-7573-92e7` / `max 1` `b157-2f40-f533-4d60` | 1 × |
| `selectionEntry` „Lord hero choice extra cost" `42c5-9ebc-7493-89ef` (`:1355`) | `min 1` `0780-5a76-9d51-e9ea` / `max 1` `b4f7-612f-aac4-65e6` | 1 × |
| `selectionEntryGroup` „Wizard Level" `b8ff-7e47-2614-1ecd` (`:1869`) | `min 1` `9c66-4f74-2201-82ec` / `max 1` `efbf-d87a-fa58-aa0f` | „Wizard level 2" `42d9-cebe-18d5-cdbd` — die im Katalog als `defaultSelectionEntryId` hinterlegte Option |
| `selectionEntryGroup` „Bloodline" `01b8-338b-6b92-e37f` (`:1372`) | `min 1` `e251-f353-704b-836a` / `max 1` `6c3a-e4ae-3667-440f` | **je Roster verschieden — das ist die Variable** |
| `selectionEntry` „Full plate armour" `64f1-879e-d9d4-7d78` (`:1607`), Pflicht-Kind **der Blood-Dragon-Blutlinie** | `min 1` `5615-adeb-c92c-4022` / `max 1` `616c-b4f1-bd23-8306` | in Roster 02/05 (nur dort ist Blood Dragon gewählt) |

Strigoi (`ef7a-…`) und Necrach (`5a11-…`) haben **keine** Pflicht-Kinder: unter
ihnen steht nur je eine Gruppe „Magic and Traits" mit einer reinen
Punkte-Obergrenze (`fafe-179a-a8c3-7d3c` bzw. `7b24-fd16-b53d-2f16`) und — bei
Necrach — eine Mounts-Gruppe (`bd66-2ca7-7967-b341`) mit reinen `max`-Grenzen.

> **Assertion-Fokus:** der Slot des Vampire Lord (`expect.capabilities`:
> effektiver Name und die Merkmalswerte WS/A des Profil-Vorkommens) sowie die
> beiden Grenzen der Gruppe „Bloodline". Andere Armeeaufbau-Diagnosen dürfen
> zusätzlich auftreten und sind hier ohne Belang — namentlich die
> roster-weite General-Pflicht `1077-7379-f142-f382` (`.gst:56`; der Vampire
> Lord bietet „General" nur als optionalen `entryLink` `943e-5789-86d0-1f2d` an,
> der bewusst weggelassen ist), die Core-Pflicht `9636-e6ed-b522-1f4a`
> (`.gst:136`, `min 2` roster-weit) und die punkteskalierende Lord-Obergrenze
> `ffea-b24a-0cdf-781e` (`.gst:84`, per `set 0` unterhalb 2000 Punkten). Die
> Roster tragen bewusst **kein** `costLimits` und bleiben minimal, damit die
> Bedingungs-Semantik isoliert sichtbar ist.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | Keine Blutlinie — die Grundlinie | Vampire Lord + Pflicht-Kinder, Gruppe „Bloodline" **leer**. Keine Clan-Kategorie im ganzen Roster. | **CISI-R4/R5:** Slot heisst `Vampire Lord`, das Profil-Vorkommen trägt **WS 8** und **A 5**. **CISI-R8:** `e251-f353-704b-836a` feuert **Ist 0 / Grenze 1**; `6c3a-e4ae-3667-440f` **absent**. Ebenso **absent**: `a7c9-5fec-592a-3716`, `9c66-4f74-2201-82ec`, `efbf-d87a-fa58-aa0f`, `d830-89e1-7573-92e7`, `0780-5a76-9d51-e9ea`. | [`01-vampire-lord-no-bloodline.ros`](rosters/01-vampire-lord-no-bloodline.ros) |
| 02 | Blood Dragon — die Kategorie steht im Roster, aber **unter** der Einheit | wie 01, Gruppe „Bloodline" = **Blood Dragon** `0158-ed16-cbbf-6a78` + dessen Pflicht-Kind Full plate armour. | **CISI-R2/R3/R4:** trotz vorhandener Kategorie `4cae…` greift der `increment` **nicht** — **WS bleibt 8**, A bleibt 5. Alle genannten Grenzen **absent** (auch `5615-adeb-c92c-4022`, `616c-b4f1-bd23-8306`). | [`02-vampire-lord-blood-dragon.ros`](rosters/02-vampire-lord-blood-dragon.ros) |
| 03 | Strigoi — dasselbe für die **innere** Klammer | wie 01, Gruppe „Bloodline" = **Strigoi** `ef7a-5896-8856-076b`. | **CISI-R2/R7:** der `increment` auf A in der inneren `modifierGroup` greift **nicht** — **A bleibt 5**, WS bleibt 8. Grenzen **absent**. | [`03-vampire-lord-strigoi.ros`](rosters/03-vampire-lord-strigoi.ros) |
| 04 | Necrach — die Gegenrichtung | wie 01, Gruppe „Bloodline" = **Necrach** `5a11-4f11-3806-c00c`. | **CISI-R2:** der `decrement` greift **nicht** — **WS bleibt 8** (nicht 6). Eine armeeweite Fehl-Lesart fällt hier nach *unten* auf, in Roster 02 nach *oben*; die beiden zusammen schliessen ein „Merkmal wird nie geschrieben"-Alibi aus. | [`04-vampire-lord-necrach.ros`](rosters/04-vampire-lord-necrach.ros) |
| 05 | Beide Blutlinien zugleich — der schärfste Kontrast | Bewusst regelwidrig: **Blood Dragon *und* Strigoi** in derselben Gruppe (+ Full plate armour). | **CISI-R8:** `6c3a-e4ae-3667-440f` feuert **Ist 2 / Grenze 1**; `e251…` **absent**. **CISI-R4:** die Merkmalswerte bleiben trotzdem **WS 8 / A 5** — eine armeeweite Lesart läge hier bei WS 10 **und** A 6 zugleich. | [`05-vampire-lord-blood-dragon-and-strigoi.ros`](rosters/05-vampire-lord-blood-dragon-and-strigoi.ros) |

### Herleitung der Zahlen

- **Merkmalswerte (alle fünf Roster):** aus dem geteilten Profil
  `ff43-329c-048a-f374` unverändert übernommen — WS `f95b-da01-0578-3bdc` = `8`,
  A `6b9f-c8fe-8998-27e3` = `5` (CISI-R5). Kein Modifikator adressiert diese
  beiden Merkmale ausserhalb der drei gegatteten Konstrukte am `infoLink`
  `e0f2-8568-15f0-a384`; deren Rahmen löst nicht auf (CISI-R3/R4).
- **Slot-Name (alle fünf Roster):** `Vampire Lord` — der Katalogname
  (`:1301`, ohne Schluss-Leerzeichen, anders als in der Definitive Edition), und
  die Einheit trägt keinen `name`-Modifikator.
- **`e251-f353-704b-836a`** (`min`, `value="1"`, `field="selections"`,
  `scope="parent"`, Träger = Gruppe `01b8…`): gezählt werden die **Mitglieder
  der Gruppe** im Rahmen der Elternauswahl. Roster 01: **Ist 0** ⇒ feuert gegen
  Grenze **1**. Roster 02/03/04: ein Mitglied ⇒ still. Roster 05: zwei ⇒ still.
  Handweapon, Lord hero choice extra cost und Wizard level 2 sind **keine**
  Mitglieder von `01b8…` und zählen nicht mit.
- **`6c3a-e4ae-3667-440f`** (`max`, `value="1"`, sonst identisch): Roster 05
  hat zwei Gruppenmitglieder ⇒ **Ist 2 / Grenze 1**. Roster 01-04: 0 bzw. 1 ⇒
  still.
- **`a7c9-5fec-592a-3716`** (`max 1`, `scope="roster"` an der Einheit,
  `:1303`): je Roster genau **ein** Vampire Lord ⇒ still.
- **`5615-adeb-c92c-4022` / `616c-b4f1-bd23-8306`** (`min 1`/`max 1`,
  `scope="parent"` an „Full plate armour"): in Roster 02/05 genau eine Instanz
  unter der Blood-Dragon-Blutlinie ⇒ still. In den übrigen Rostern ist die
  Blutlinie nicht gewählt, ihr Pflicht-Kind also gar nicht im Baum — deshalb
  stehen die beiden Ids dort **nicht** in `absent`.

---

## Bewusst **nicht** Gegenstand dieses Szenarios

| Facette | Warum nicht |
|---------|-------------|
| **Die Bedingungen als feuernde Grenze** | Eine `condition` ist keine zählende Schranke; der Verletzungsbericht kodiert Grenzen (`constraint`), nicht Bedingungen. Ihre Wirkung ist hier **ausschliesslich** über `expect.capabilities` (Merkmalswerte) beobachtbar — deshalb steht in `firing`/`absent` keine Id der drei Konstrukte (sie tragen ohnehin keine). |
| **Kategoriezugehörigkeit als eigene Aussage** | Der Bericht kodiert keine Mitgliedschaften. Die Clan-Kategorie tritt hier nur als *nicht* gefundener Rahmen auf. |
| **Sichtbarkeit (`hidden`)** | Im upstream-Katalog ist die clan-spezifische Ausrüstung **strukturell** modelliert (die Optionen existieren nur unter den erlaubten Blutlinien) statt per `hidden`; wo doch gegated wird, geschieht es über die kategorie-skopierten `max 0`-Grenzen der „Mounts (Stirgoi cannot chose this)"-Gruppen. Verfügbarkeit ist keine zählende Schranke — gleiche Abgrenzung wie ERG-R3/R4 in [`vampire-bloodlines-ergofang`](../vampire-bloodlines-ergofang/README.md) und VBL-R4/R5 in [`vampire-bloodlines`](../vampire-bloodlines/README.md). |
| **Die kategorie-skopierten `constraint`s desselben Katalogs** (`43c3-a379-1697-a83c`, `9516-26e4-62c4-1d45`, `beeb-4678-df2e-635e`, `4f70-4e8d-eb0b-bbdf`, `6afc-566e-34d4-d35c`, …) | Wortgleich zu den in [`category-scope-ancestor-frame`](../category-scope-ancestor-frame/README.md) gepinnten. **Hinweis für später:** anders als dort liegen sie hier **innerhalb** der Blutlinien-Aufwertung — die Mounts-Gruppe unter „Strigoi" gibt es gar nicht, die unter Blood Dragon/Necrach/Lahmia/Von Carstein hat einen Strigoi-Vorfahren nie. Der Rahmen löst also auch hier nicht auf; ein eigener Fall entstünde daraus nicht. |
| **Der Kosten-`decrement` an „Wizard level 2"/„Wizard level 3"** (`:1877`, `:1894`), dessen `condition` `scope="parent" childId="4cae…" includeChildSelections="true"` in Roster 02/05 **hält** | Punktekosten sind nicht Gegenstand dieses Szenarios; die Stelle ist oben nur als Beleg geführt, dass derselbe Katalog die Frage „hat dieser Vampir Blutlinie X?" an anderer Stelle mit Kategorie in `childId` korrekt stellt. Ein Kosten-Szenario müsste zusätzlich das Roster-Budget festlegen. |
| **Der wortgleiche Zwilling am Vampire Count** `6822-0110-a7c9-cbb0` (`:1921-1951`, `infoLink` `a106-4a05-36ea-cb01` → Profil `fabd-ef67-72f5-6b3f`) | Zeichengleich gebaut (`:1929`/`:1934`/`:1941` entsprechen `:1312`/`:1317`/`:1324`) und mit identischer Datenlage — als Beleg oben aufgeführt, aber nicht als eigenes Roster: brächte keinen neuen Fall, nur Wiederholung. Der **Vampire Thrall** trägt dieses Muster **nicht**: die sechs Vorkommen von `condition … scope="<Clan-Kategorie>" childId="model"` im ganzen Satz verteilen sich vollständig auf Lord (3) und Count (3). |
| **Eine Gegenprobe „Rahmen löst auf"** (ein Roster, in dem ein Vorfahre die Kategorie *trägt* und der Modifikator deshalb greift) | Im upstream-Satz **nicht baubar**: die drei Clan-Kategorien erreichen eine Auswahl nur per `categoryLink` an einer Blutlinien-Aufwertung, und die steht immer *unter* dem Vampir. Ein `modifier field="category"` existiert im Vampire-Counts-Katalog nicht. Die positive Richtung deckt stattdessen [`nested-modifier-group`](../nested-modifier-group/README.md) an derselben Einheit im Definitive-Satz ab (dort `scope="b77b-88d5-5e80-e178"` + `add category` an der Einheit). |
| **Eine Diagnose für den nicht auflösbaren Kategorie-Rahmen** (etwa `UNRESOLVED_SCOPE` mit `scope="4cae-a20e-8374-b6cb"`) | Aus den erlaubten Quellen **nicht entscheidbar**: die Formatspezifikation regelt fail-closed samt Diagnose ausdrücklich nur für `primary-catalogue` und für `unit` ohne umschliessende Einheit; für eine Kategorie-Id im `scope`, die auf keinen Vorfahren passt, sagt sie nichts. Dieses Szenario fordert deshalb **weder** die Anwesenheit **noch** die Abwesenheit einer solchen Diagnose — nur, dass der Modifikator **nicht wirkt**. Gleiche Auslassung und gleiche Begründung wie in [`category-scope-ancestor-frame`](../category-scope-ancestor-frame/README.md). |

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Spielsystem „Warhammer Fantasy Battle 6th edition" (`.gst:2`, rev 8) | `6d8e-38d9-3c69-febf` |
| Katalog „Vampire Counts" (`.cat:2`, rev 10, ohne `catalogueLinks`) | `ea4b-9294-3427-1fc1` |
| `publication` „Vampire Counts Army book" (`:7`) | `8e66-3042-1d6b-fa6b` |
| Kontingent „Standard " (`.gst:61`) | `7d9d-6c8d-4ea0-b7ad` |
| Einheit „Vampire Lord" (`:1301`) — Träger | `b77b-88d5-5e80-e178` |
| — Eigengrenze `max 1` `scope="roster"` (`:1303`) | `a7c9-5fec-592a-3716` |
| — `categoryLink`s „Lord" (×2, eine `primary`) / „Characters" (`:1336-1338`) | `39e1-e476-eaff-58d1`, `bf07-6d8b-b2e4-b984` → `d024-d25b-a9b4-73b6` / `6f29-1df0-dca2-034c` → `7a1c-d611-c2dc-def1` |
| — `infoLink` „Vampire Lord" (`:1306`) → geteiltes Profil (`:4971`) | `e0f2-8568-15f0-a384` → `ff43-329c-048a-f374` |
| — äussere `modifierGroup`, bedingungslos (`:1308-1331`) | — (`modifierGroup` trägt keine `id`) |
| — innere `modifierGroup`, Strigoi-gegated (`:1322-1329`) | — (dito) |
| — Pflicht-Kind „Handweapon" (`:1341`; `min` / `max`) | `6abf-e08f-6480-cd58` — `d830-89e1-7573-92e7` / `b157-2f40-f533-4d60` |
| — Pflicht-Kind „Lord hero choice extra cost" (`:1355`; `min` / `max`) | `42c5-9ebc-7493-89ef` — `0780-5a76-9d51-e9ea` / `b4f7-612f-aac4-65e6` |
| — Pflicht-Gruppe „Wizard Level" (`:1869`, `defaultSelectionEntryId="42d9-cebe-18d5-cdbd"`; `min` / `max`) | `b8ff-7e47-2614-1ecd` — `9c66-4f74-2201-82ec` / `efbf-d87a-fa58-aa0f` |
| — — gewählte Option „Wizard level 2" (`:1875`) / Alternative „Wizard level 3" (`:1892`) | `42d9-cebe-18d5-cdbd` / `649a-8bc1-fb66-ed73` |
| — Pflicht-Gruppe „Bloodline" (`:1372`; `max` `:1374` / `min` `:1375`) | `01b8-338b-6b92-e37f` — `6c3a-e4ae-3667-440f` / `e251-f353-704b-836a` |
| — — „Von Carstein" (`:1378`) | `a13a-36f6-00d9-4ae6` |
| — — „Necrach" (`:1518`), `categoryLink` `86dc-9021-f073-6dec` → Necrach | `5a11-4f11-3806-c00c` |
| — — „Blood Dragon" (`:1602`), `categoryLink` `85db-e156-f433-69e1` → Blood Dragon | `0158-ed16-cbbf-6a78` |
| — — — dessen Pflicht-Kind „Full plate armour" (`:1607`; `max` / `min`) | `64f1-879e-d9d4-7d78` — `616c-b4f1-bd23-8306` / `5615-adeb-c92c-4022` |
| — — „Strigoi" (`:1763`), `categoryLink` `261b-6e13-782f-68c1` → Strigoi | `ef7a-5896-8856-076b` |
| — — „Lahmia" (`:1783`), `categoryLink` `7798-c791-d208-9a34` → Lahmia | `20cf-d4a7-041d-43f4` |
| — optionaler `entryLink` „General" (`:1913`, bewusst weggelassen) | `943e-5789-86d0-1f2d` → `1b7c-2c90-6d96-28c9` |
| `categoryEntry` „Necrach" / „Blood Dragon" / „Strigoi" (`:11-13`) — die drei `scope`-Ids | `fc4b-a86d-5897-9e4c` / `4cae-a20e-8374-b6cb` / `bf30-4ff0-a4d8-3909` |
| `categoryEntry` „Von Carstein" / „Lahmia" (`:10`, `:14`) | `ff24-ca11-afd5-865b` / `c872-4b18-1aad-6953` |
| Kategorie „Lord" / „Characters" / „Heroes" (`.gst:45`, `:51`, `:46`) | `d024-d25b-a9b4-73b6` / `7a1c-d611-c2dc-def1` / `c16b-f319-2c62-2c12` |
| Profil-Typ „Profile" (`.gst:12`) | `a54a-7f00-29bf-12b1` |
| Merkmal WS (`.gst:15`) / A (`.gst:21`) | `f95b-da01-0578-3bdc` / `6b9f-c8fe-8998-27e3` |
| Kostenart „pts" (`.gst:7`) | `ecfa-8486-4f6c-c249` |
| Zusatz-Diagnosen ohne Belang: General-Pflicht (`.gst:56`) / Core-Pflicht (`.gst:136`) / Lord-Obergrenze (`.gst:84`) | `1077-7379-f142-f382` / `9636-e6ed-b522-1f4a` / `ffea-b24a-0cdf-781e` |
| Wortgleicher Zwilling „Vampire Count" (`:1921`) mit `infoLink` (`:1923`) → Profil | `6822-0110-a7c9-cbb0` — `a106-4a05-36ea-cb01` → `fabd-ef67-72f5-6b3f` |
