# E2E-Regeln & Testkatalog: `min` an einer `categoryEntry` mit `scope="roster"` — die armeeweite Kategorie-Pflicht

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln, IDs und
Erwartungswerte sind **ausschliesslich aus den Katalogdaten** des
**upstream**-Fixture-Satzes (`src/tests/__fixtures__/whfb6/`) und der
Formatspezifikation ([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md),
§5.5/§7.6/§8) abgeleitet. Die Roster-Form folgt der an diesem Satz bereits
verifizierten Gestalt (direktes `entryId`, `entryLinkId=""`, verschachtelte
`selections` mit `number`, `entryGroupId` bei Gruppenmitgliedern) aus
[`parent-max-enchanted-items-per-bearer`](../parent-max-enchanted-items-per-bearer/README.md)
und [`category-id-scope-instance-of`](../category-id-scope-instance-of/README.md),
die gegen dieselbe `.gst`/`.cat` laufen.

- Spielsystem: `Warhammer Fantasy Battle 6th edition.gst`
  (`6d8e-38d9-3c69-febf`, rev 8) — einziges Kontingent: `forceEntry`
  **„Standard "** `7d9d-6c8d-4ea0-b7ad` (`.gst:61`, das Schluss-Leerzeichen im
  Namen steht so im Katalog).
- Armeebuch: `Vampire Counts.cat` (`ea4b-9294-3427-1fc1`, rev 10,
  `gameSystemId="6d8e-38d9-3c69-febf"`, `gameSystemRevision="8"`).
- **Keine** weitere `.cat`: der upstream-Vampire-Counts-Katalog trägt **kein**
  `<catalogueLinks>`.

> ## ⚠ Zwei Fixture-Sätze, **dieselbe** Constraint-Id, **verschiedener** `scope`
>
> Die Ids `1077-7379-f142-f382` und `d818-c60d-b1f8-8aaa` existieren in **beiden**
> Sätzen — mit unterschiedlichen Attributen:
>
> | | **upstream** (`src/tests/__fixtures__/whfb6/`, **dieses Szenario**) | Definitive Edition (`src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive/`) |
> |---|---|---|
> | Fundstelle | `Warhammer Fantasy Battle 6th edition.gst:53-57` | `Warhammer Fantasy Battles (6th definitive edition).gst:721-725` |
> | `scope` beider Grenzen | **`roster`** | **`force`** |
> | `value` | `1.0` | `1` |
> | übrige Attribute | `field="selections" percentValue="false" shared="true" includeChildSelections="true" includeChildForces="true"` | wortgleich |
>
> Dieses Szenario nennt in `dataset` deshalb **ausschliesslich** upstream-Dateien,
> damit die Erwartung gegen die `scope="roster"`-Ausprägung auflöst. Die Sätze
> dürfen in einem Szenario **nie** gemischt werden. Die `scope="force"`-Ausprägung
> derselben Ids ist andernorts gepinnt (z. B.
> [`ogre-kingdoms`](../ogre-kingdoms/README.md),
> [`vampire-counts`](../vampire-counts/README.md)) — jene Szenarien laufen
> vollständig auf dem Definitive-Satz.
>
> **Hinweis:** Für ein **Kategorie**-Ziel fallen beide `scope`-Werte im Ergebnis
> zusammen — §7.7 (ADR 0029): *„ein `scope="force"`-Constraint mit **Eintrags**-Ziel
> zählt pro Detachment, mit **Kategorie**-Ziel armeeweit"*. Genau diese armeeweite
> Zählung ist der Gegenstand hier; `scope="roster"` schreibt sie unmittelbar hin.

---

## Der Träger: die Kategorie „General" und ihre zwei Grenzen

`Warhammer Fantasy Battle 6th edition.gst:53-58`, vollständig:

```xml
<categoryEntry id="a37e-7207-de6d-acb0" name="General" hidden="false">
  <constraints>
    <constraint field="selections" scope="roster" value="1.0" percentValue="false" shared="true"
                includeChildSelections="true" includeChildForces="true"
                id="d818-c60d-b1f8-8aaa" type="max"/>          <!-- :55 -->
    <constraint field="selections" scope="roster" value="1.0" percentValue="false" shared="true"
                includeChildSelections="true" includeChildForces="true"
                id="1077-7379-f142-f382" type="min"/>          <!-- :56 -->
  </constraints>
</categoryEntry>
```

Mehr trägt die Kategorie nicht: **kein** `modifier` im ganzen upstream-Satz
adressiert `d818-c60d-b1f8-8aaa` oder `1077-7379-f142-f382` (je genau **ein**
Treffer im Satz — die Deklaration selbst). Beide Grenzen sind damit statisch:
`bound` = **1**, unabhängig von Punktelimit, Kontingentzahl und Armeebuch.

### Wer die Kategorie trägt — aufgelöst über die Id, nie über den Namen

`a37e-7207-de6d-acb0` kommt im gesamten upstream-Satz an genau **zwei** Stellen
vor (Volltextsuche über alle `.gst`/`.cat`):

| Fundstelle | Bedeutung |
|---|---|
| `.gst:53` | die `categoryEntry`-Definition selbst |
| `.gst:638` | `categoryLink id="b6a9-2d67-cff3-dde7" name="General" hidden="false" targetId="a37e-7207-de6d-acb0" primary="false"` |

Dieser eine `categoryLink` hängt an der gst-geteilten Aufwertung

```xml
<selectionEntry id="1b7c-2c90-6d96-28c9" name="General" hidden="false"
                collective="false" import="true" type="upgrade">   <!-- .gst:633, in <sharedSelectionEntries> (:254) -->
  <constraints>
    <constraint field="selections" scope="parent" value="1.0" percentValue="false" shared="true"
                includeChildSelections="false" includeChildForces="false"
                id="5b30-f604-aa3b-1c34" type="max"/>              <!-- :635 -->
  </constraints>
  <categoryLinks>
    <categoryLink id="b6a9-2d67-cff3-dde7" name="General" hidden="false"
                  targetId="a37e-7207-de6d-acb0" primary="false"/> <!-- :638 -->
  </categoryLinks>
  <costs>… 0 pts, 2 Casting Dice, 2 Dispel Dice …</costs>
</selectionEntry>
```

**Es gibt keinen zweiten Weg in die Kategorie:** kein `modifier type="add"
field="category"` mit dieser Id, kein weiterer `categoryLink`. „Welche Einheit
General sein darf" ist im upstream-Satz allein über `entryLink`s auf
`1b7c-2c90-6d96-28c9` ausgedrückt — in `Vampire Counts.cat` an sechs Stellen
(`:970` Master Necromancer, `:1293` Necromancer, `:1913` Vampire Lord, `:2346`
Vampire Count, `:2659` Vampire Thrall, `:3139` Manfred von Carstein).

### Die Aufwertung ist wirklich **angeboten** (kein `hidden`-Vorbehalt)

§5.6 verbietet, die Mindestgrenzen einer effektiv **versteckten** Entität zu
validieren. Dieser Vorbehalt greift hier **nicht**:

| Glied der Kette | `hidden` | Modifikator auf `hidden`? |
|---|---|---|
| `categoryEntry` „General" `a37e-…` (`.gst:53`) | `false` | keiner (die `categoryEntry` trägt nur `<constraints>`) |
| `selectionEntry` „General" `1b7c-…` (`.gst:633`) | `false` | keiner (Kinder sind nur `constraints`, `categoryLinks`, `costs`) |
| `entryLink` `509d-c95d-3792-4e44` (`.cat:1293`) | `false` | keiner (leeres Element, self-closing) |
| Träger `selectionEntry` „Necromancer" `b5d8-…` (`.cat:1187`) | `false` | keiner |

Die Pflicht ist also für den Nutzer erfüllbar — die `min`-Grenze darf und muss
gemeldet werden.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **RMGA-R1** | Eine `constraint` an einer **`categoryEntry`** zählt die Auswahlen, die **dieser Kategorie angehören**. Der Träger der Grenze ist die Kategorie; gezählt wird, was ihr per `categoryLink` zugeordnet ist. | `.gst:53-57`; [§5.5](../../battlescribe-data-format.md#55-category-entries-kategorien): *„Hier erzwingt die Kategorie ‚General' per `min=1`/`max=1`, dass **genau ein** General in der Armee steht — komplett sprachneutral, allein über die verlinkte Kategorie-ID."* [§7.6-Regelkasten](../../battlescribe-data-format.md#76-constraint): *„Gezählt werden die Auswahlen **unterhalb** des Trägers der Grenze."* |
| **RMGA-R2** | `scope="roster"` + `includeChildForces="true"` macht daraus eine **armeeweite** Pflicht: gezählt wird über **alle** Kontingente hinweg, nicht je Kontingent. | `.gst:55/:56` — beide Grenzen `scope="roster" includeChildSelections="true" includeChildForces="true"`. [§7.6-Tabelle](../../battlescribe-data-format.md#76-constraint) zu `includeChildForces`; [§5.6-Regelkasten](../../battlescribe-data-format.md#56-force-entries-detachments) / §7.7 (ADR 0029): Kategorie-Ziel zählt **armeeweit**. |
| **RMGA-R3** | Die Untergrenze ist **`min 1`** und feuert bei **Ist 0** — auch dann, wenn im Roster gar keine Auswahl der Kategorie instanziiert ist (die Kategorie selbst ist immer da, sie ist im Spielsystem deklariert). | `.gst:56` `type="min" value="1.0"`. Präzedenz für „`min` feuert auf einer leeren Kategorie": OK-R1 in [`ogre-kingdoms`](../ogre-kingdoms/README.md) (Roster 01, `1077-…`, Ist 0). |
| **RMGA-R4** | Die Obergrenze ist **`max 1`** (`d818-c60d-b1f8-8aaa`) und feuert bei **Ist 2** — im selben, armeeweiten Rahmen. Min und Max sind Geschwister an derselben `categoryEntry`: was das eine erfüllt, lässt das andere schweigen und umgekehrt. | `.gst:55` `type="max" value="1.0"`, sonst attributgleich zu `:56`. |
| **RMGA-R5** | `bound` ist in **allen** Rostern **1**: kein `modifier` im Satz adressiert die beiden Constraint-Ids. | Volltextsuche über `src/tests/__fixtures__/whfb6/`: `d818-c60d-b1f8-8aaa` und `1077-7379-f142-f382` haben je **genau einen** Treffer — die Deklaration in `.gst:55` bzw. `:56`. Kein `modifier field="d818-…"`/`"1077-…"`. |
| **RMGA-R6** | Der einzige Kategorie-Träger im Satz ist die gst-geteilte Aufwertung `1b7c-2c90-6d96-28c9`; jede ihrer Instanzen zählt **1** zur Kategorie. Auflösung strikt über die Id. | `.gst:633` + `categoryLink` `b6a9-2d67-cff3-dde7` (`.gst:638`); genau zwei Vorkommen von `a37e-7207-de6d-acb0` im ganzen Satz. [§3.1](../../battlescribe-data-format.md#31-ids-und-namen): *„Beziehungen … werden ausschliesslich über IDs / `categoryLinks` aufgelöst, nie über Namensgleichheit."* |
| **RMGA-R7** | Die **Eigengrenze** der Aufwertung (`5b30-f604-aa3b-1c34`, `max 1`, `scope="parent"`) ist eine **andere** Aussage: höchstens ein „General" **je Trägereinheit**. Zwei Generale an zwei verschiedenen Einheiten lassen sie schweigen — die armeeweite `d818-…` dagegen nicht. | `.gst:635`. Rahmen-Regel für `scope="parent"` gepinnt in [`parent-max-enchanted-items-per-bearer`](../parent-max-enchanted-items-per-bearer/README.md) (PMEI: `shared="true"` weitet den Eltern-Rahmen nicht aufs Roster aus). |
| **RMGA-R8** | Die Mindestgrenze ist **nicht** durch `hidden` entwertet: Kategorie, geteilte Definition, `entryLink` und Trägereinheit sind alle `hidden="false"` und tragen keinen `hidden`-Modifikator. | Tabelle oben; [§5.6-Regelkasten](../../battlescribe-data-format.md#56-force-entries-detachments): *„dessen Mindestgrenzen dürfen **nicht** validiert werden"* — Voraussetzung liegt hier nicht vor. |

### Der Träger der Roster: Necromancer `b5d8-db21-a4b7-9e94` (`.cat:1187`)

Bewusst **nicht** der Vampire Lord: der trägt eine Pflicht-Gruppe „Bloodline"
und eine punkteskalierende Lord-Obergrenze und brächte fremdes Rauschen mit. Der
Necromancer ist der kleinste vollständig bestückbare Kategorie-Träger:

| Bestandteil | Id | Grenzen |
|---|---|---|
| `selectionEntry` „Necromancer" (`:1187`), `primary` → Heroes `c16b-f319-2c62-2c12`, zusätzlich Characters `7a1c-d611-c2dc-def1` | `b5d8-db21-a4b7-9e94` | **keine** eigene `constraint` — beliebig oft baubar |
| Pflicht-Kind „Handweapon" (`:1196`) | `dca8-37d5-c64a-db33` | `min 1` `2525-273c-d3f1-cd1f` / `max 1` `846e-7221-e02a-201f`, `scope="parent"` |
| Pflicht-Gruppe „Wizard Level" (`:1228`, `defaultSelectionEntryId="fa17-5cb0-9c97-4db6"`) | `0c4e-627e-e499-f135` | `min 1` `03cf-1c4e-cf6f-0dad` / `max 1` `45f9-d1c8-4fce-347c`, `scope="parent"` |
| — gewählte Option „Wizard level 1" (`:1234`) | `fa17-5cb0-9c97-4db6` | `max 1` `c1c6-801e-dae2-3841` |
| optionaler `entryLink` „General" (`:1293`) → gst-geteilte Aufwertung | `509d-c95d-3792-4e44` → `1b7c-2c90-6d96-28c9` | die Variable dieses Szenarios |

Die Gruppe „Magic Items" (`:1212`) und die Gruppe „Mounts" (`:1256`) tragen nur
`max`-Grenzen und bleiben in allen Rostern leer.

### Was eine Fehl-Lesart produzieren würde

| Fehl-Lesart | Roster 01 | Roster 02 | Roster 03 | Roster 04 | Roster 05 |
|---|---|---|---|---|---|
| `min` einer **leeren** Kategorie wird gar nicht geprüft (Seeding-Lücke) | `1077-…` **fehlt** — **fällt auf** | still (korrekt) | still | still | still |
| Rahmen = **je Kontingent** statt armeeweit | gleich | gleich | gleich | `1077-…` feuerte für Kontingent 2 — **fällt auf** | `d818-…` bliebe still (1 je Kontingent) — **fällt auf** |
| Kategoriezugehörigkeit über den **Namen** statt über `targetId` aufgelöst | ggf. gleich | ggf. gleich | ggf. gleich | ggf. gleich | ggf. gleich (im Satz heissen `categoryEntry`, `categoryLink`, `selectionEntry` und `entryLink` alle „General" — die Namensgleichheit deckt den Fehler zu; deshalb ist sie hier **kein** Prüfziel, s. u.) |
| `scope="parent"` der Eigengrenze roster-weit gelesen (`shared="true"` missdeutet) | — | still | `5b30-…` feuerte mit Ist 2 — **fällt auf** | still | `5b30-…` feuerte mit Ist 2 — **fällt auf** |
| `max` und `min` verwechselt | `d818-…` feuerte statt `1077-…` — **fällt auf** | still | `1077-…` feuerte — **fällt auf** | still | `1077-…` feuerte — **fällt auf** |

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle fünf laufen
gegen **denselben** Datensatz (`.gst` + `Vampire Counts.cat`) und dasselbe
`forceEntry` `7d9d-6c8d-4ea0-b7ad`; die Roster 04/05 instanziieren es **zweimal**
als Geschwister-Kontingente.

> **Assertion-Fokus:** die beiden Grenzen der Kategorie „General"
> (`1077-7379-f142-f382`, `d818-c60d-b1f8-8aaa`), als Kontrast die parent-skopierte
> Eigengrenze `5b30-f604-aa3b-1c34` und die Pflichten der Trägereinheit. Andere
> Armeeaufbau-Diagnosen dürfen zusätzlich auftreten und sind hier ohne Belang —
> namentlich die roster-weite **Core-Pflicht** `9636-e6ed-b522-1f4a`
> (`.gst:136`, `min 2`; die Roster enthalten bewusst keine Core-Einheit) und die
> punkteskalierende **Characters**-Obergrenze `9ecc-0180-3f98-d6c2` (`.gst:247`;
> per `set 3` unterhalb 2000 Punkten, von höchstens zwei Necromancern nie
> gerissen). Die Roster tragen bewusst **kein** `costLimits` und bleiben minimal.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|----------------|-------------------------------------------------------|---------|
| 01 | Kein General — die Pflicht | Ein Kontingent, ein Necromancer mit seinen beiden Pflicht-Kindern, **ohne** die General-Aufwertung. Keine Auswahl des Rosters trägt `a37e-…`. | **RMGA-R1/R2/R3:** `1077-7379-f142-f382` feuert mit **Ist 0 / Grenze 1**. `d818-c60d-b1f8-8aaa` **absent** (bei Ist 0 unmöglich). Die Pflichten der Einheit (`2525-…`, `03cf-…`) und ihre Obergrenzen (`846e-…`, `45f9-…`) **absent**. | [`01-no-general-min-fires.ros`](rosters/01-no-general-min-fires.ros) |
| 02 | Genau ein General — legal | wie 01, zusätzlich die Aufwertung `1b7c-2c90-6d96-28c9` unter dem Necromancer. | **RMGA-R3/R4:** Ist 1 — **beide** Kategoriegrenzen **absent**, ebenso die Eigengrenze `5b30-…`. Das ist die Gegenprobe, die Test 01 vom Alibi „meldet grundsätzlich alles" trennt. | [`02-one-general-legal.ros`](rosters/02-one-general-legal.ros) |
| 03 | Zwei Generale in einem Kontingent | Zwei Necromancer, **jeder** mit einer eigenen General-Aufwertung. | **RMGA-R4:** `d818-c60d-b1f8-8aaa` feuert mit **Ist 2 / Grenze 1**; `1077-…` **absent**. **RMGA-R7:** `5b30-f604-aa3b-1c34` **absent** — je Eltern-Rahmen steht genau eine Aufwertung. | [`03-two-generals-one-force-max-fires.ros`](rosters/03-two-generals-one-force-max-fires.ros) |
| 04 | Zwei Kontingente, **ein** General — der Rahmen-Entscheider | Kontingent 1: Necromancer **mit** General. Kontingent 2: Necromancer **ohne**. | **RMGA-R2:** armeeweit Ist 1 ⇒ `1077-…` **absent**, `d818-…` **absent**. Eine je-Kontingent gerechnete Lesart liesse die Pflicht für Kontingent 2 mit Ist 0 feuern. | [`04-two-forces-one-general-min-silent.ros`](rosters/04-two-forces-one-general-min-silent.ros) |
| 05 | Zwei Kontingente, **je ein** General | Beide Kontingente mit je einem Necromancer **mit** General. | **RMGA-R2/R4:** armeeweit Ist 2 ⇒ `d818-c60d-b1f8-8aaa` feuert **Ist 2 / Grenze 1**; `1077-…` **absent**. Gegenrichtung zu 04: je Kontingent gerechnet wäre nichts zu beanstanden. | [`05-two-forces-two-generals-max-fires.ros`](rosters/05-two-forces-two-generals-max-fires.ros) |

### Herleitung der Zahlen

- **`bound` = 1** in allen fünf Rostern, für **beide** Grenzen: der geschriebene
  `value="1.0"` (`.gst:55`, `:56`); kein Modifikator adressiert die Ids
  (RMGA-R5).
- **`actual` von `1077-7379-f142-f382`** = Anzahl der Auswahlen der Kategorie
  `a37e-…` im **ganzen Roster**. Roster 01: **0** ⇒ feuert. Roster 02/04: **1** ⇒
  still. Roster 03/05: **2** ⇒ still (eine `min`-Grenze feuert nicht nach oben).
- **`actual` von `d818-c60d-b1f8-8aaa`**: Roster 03 und 05 je **2** ⇒ feuert
  gegen Grenze 1. Roster 01 (**0**), 02 und 04 (**1**) ⇒ still.
- **`actual` je General-Auswahl** = 1: jede Auswahl trägt `number="1"`, und die
  Trägereinheit ebenfalls — die Durchmultiplikation der Elternkette
  ([§7.5](../../battlescribe-data-format.md#75-cost--cost-type)) ändert an
  1 × 1 = 1 nichts. Genau deshalb tragen alle Selektionen dieser Fixtures
  `number="1"`: die Zählung soll aus der **Struktur** kommen, nicht aus einer
  Stückzahl, deren `.ros`-Semantik die Quelle offen lässt
  ([§15](../../battlescribe-data-format.md#15-lücken-der-quelle)).
- **`5b30-f604-aa3b-1c34`** (`max 1`, `scope="parent"` an `1b7c-…`): in den
  Rostern 02–05 hält jeder Necromancer genau **eine** General-Aufwertung ⇒ Ist 1
  je Eltern-Rahmen ⇒ still. In Roster 01 ist die Aufwertung gar nicht im Baum;
  die Id steht dort deshalb **nicht** in `absent`.
- **`2525-273c-d3f1-cd1f` / `03cf-1c4e-cf6f-0dad`** (`min 1` Handweapon bzw.
  Gruppe „Wizard Level"): in **jedem** Roster ist je Necromancer genau ein
  Handweapon und genau ein „Wizard level 1" gewählt ⇒ Ist 1 ⇒ still. Ihre
  `max`-Gegenstücke `846e-7221-e02a-201f` / `45f9-d1c8-4fce-347c` ebenso.

---

## Bewusst **nicht** Gegenstand dieses Szenarios

| Facette | Warum nicht |
|---------|-------------|
| **Sichtbarkeit (`hidden`)** | Keine der beteiligten Entitäten ist versteckt oder wird per Modifikator versteckt (Tabelle oben). Verfügbarkeit ist ohnehin keine zählende Schranke und nicht Teil des Verletzungsberichts — gleiche Abgrenzung wie VBL-R4/R5 in [`vampire-bloodlines`](../vampire-bloodlines/README.md). Der `hidden`-Vorbehalt aus §5.6 ist hier geprüft und **nicht einschlägig**; er wird nicht als eigener Fall gebaut, weil der upstream-Satz keinen versteckten Kategorie-Träger anbietet. |
| **Kategoriezugehörigkeit als eigene Aussage im Bericht** | Der Verletzungsbericht kodiert Grenzen, keine Mitgliedschaften. Die Zugehörigkeit tritt hier nur mittelbar auf — als Zählwert der beiden Grenzen. |
| **Namensauflösung als Prüfziel** | Im upstream-Satz heissen `categoryEntry`, `categoryLink`, `selectionEntry` und alle `entryLink`s gleichermassen „General". Eine namensbasierte Fehlauflösung wäre an diesem Datensatz **nicht sichtbar** — die Regel (§3.1: Auflösung über die Id) ist hier belegt, aber nicht falsifizierbar. Ein Szenario dafür bräuchte zwei gleichnamige Kategorien mit verschiedenen Ids. |
| **Das Punktelimit und die punkteskalierenden Grenzen** (`ffea-b24a-0cdf-781e`, `9636-e6ed-b522-1f4a`, `9ecc-0180-3f98-d6c2`, `32a8-c5ab-9c08-b656`, `6167-0493-f2af-4b0a`) | Die Roster tragen bewusst **kein** `costLimits`, damit die Kategorie-Zählung isoliert sichtbar ist. Die Core-Pflicht `9636-…` feuert in allen fünf Rostern (Ist 0 / Grenze 2) und ist ausdrücklich toleriert; sie steht in keinem `firing`- und in keinem `absent`-Feld. Punkteskalierung ist Gegenstand eigener Szenarien. |
| **Ein `max`-Fall mit `number="2"` an **einer** Auswahl** | Zwei Exemplare unter **einem** Elternteil rissen zugleich die parent-skopierte Eigengrenze `5b30-…` und vermengten die beiden Aussagen. Roster 03 trennt sie sauber über zwei Träger. |
| **Verschachtelte (Unter-)Kontingente** | `includeChildForces="true"` wird hier über **Geschwister**-Kontingente belegt (Roster 04/05). Das upstream-Spielsystem deklariert genau **ein** `forceEntry` (`.gst:60-253`) ohne verschachtelte `forceEntries`; ein echtes Unter-Kontingent ist im Satz nicht baubar. |
| **Die Definitive-Edition-Ausprägung derselben Ids (`scope="force"`)** | Anderer Fixture-Satz. Das Mischen zweier Sätze in einem Szenario würde die Erwartung gegen die falsche Constraint-Ausprägung auflösen (Kasten oben). |

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Spielsystem „Warhammer Fantasy Battle 6th edition" (`.gst:2`, rev 8) | `6d8e-38d9-3c69-febf` |
| Katalog „Vampire Counts" (`.cat:2`, rev 10, ohne `catalogueLinks`) | `ea4b-9294-3427-1fc1` |
| Kontingent „Standard " (`.gst:61`) — einziges `forceEntry` des Satzes | `7d9d-6c8d-4ea0-b7ad` |
| **`categoryEntry` „General"** (`.gst:53`, `hidden="false"`) | `a37e-7207-de6d-acb0` |
| — Obergrenze `max 1`, `field="selections" scope="roster" shared="true" includeChildSelections="true" includeChildForces="true"` (`.gst:55`) | `d818-c60d-b1f8-8aaa` |
| — Untergrenze `min 1`, attributgleich (`.gst:56`) | `1077-7379-f142-f382` |
| Geteilte Aufwertung „General" (`.gst:633`, `sharedSelectionEntries` `.gst:254`, `type="upgrade"`, `hidden="false"`) | `1b7c-2c90-6d96-28c9` |
| — deren Eigengrenze `max 1`, `scope="parent"` (`.gst:635`) | `5b30-f604-aa3b-1c34` |
| — deren `categoryLink` → „General" (`.gst:638`) — der **einzige** im Satz | `b6a9-2d67-cff3-dde7` |
| Einheit „Necromancer" (`.cat:1187`, keine eigene `constraint`) — Träger | `b5d8-db21-a4b7-9e94` |
| — `categoryLink`s Heroes (`primary`) / Characters (`.cat:1192-1193`) | `9395-7ad9-f060-64bf` → `c16b-f319-2c62-2c12` / `1047-7bbc-2f5e-78fe` → `7a1c-d611-c2dc-def1` |
| — Pflicht-Kind „Handweapon" (`.cat:1196`; `min` `:1199` / `max` `:1198`) | `dca8-37d5-c64a-db33` — `2525-273c-d3f1-cd1f` / `846e-7221-e02a-201f` |
| — Pflicht-Gruppe „Wizard Level" (`.cat:1228`, `defaultSelectionEntryId`; `min` `:1230` / `max` `:1231`) | `0c4e-627e-e499-f135` — `03cf-1c4e-cf6f-0dad` / `45f9-d1c8-4fce-347c` |
| — — gewählte Option „Wizard level 1" (`.cat:1234`; `max` `:1236`) | `fa17-5cb0-9c97-4db6` — `c1c6-801e-dae2-3841` |
| — optionaler `entryLink` „General" (`.cat:1293`, `hidden="false"`, ohne eigene Grenzen) | `509d-c95d-3792-4e44` → `1b7c-2c90-6d96-28c9` |
| Weitere `entryLink`s auf dieselbe Aufwertung im Katalog (nicht genutzt) | `5c57-5cd6-a17c-1d0c` (`:970`), `943e-5789-86d0-1f2d` (`:1913`), `05bd-c070-04e3-1b9b` (`:2346`), `b029-6b8a-cfd8-bdef` (`:2659`), `00bd-d8e5-9feb-0d1c` (`:3139`) |
| Kategorie „Heroes" / „Characters" / „Core" (`.gst:46`, `:51`, `:47`) | `c16b-f319-2c62-2c12` / `7a1c-d611-c2dc-def1` / `64bf-efb4-9978-26df` |
| Zusatz-Diagnosen ohne Belang: Core-Pflicht (`.gst:136`) / Characters-Obergrenze (`.gst:247`) / Lord-Obergrenze (`.gst:84`) | `9636-e6ed-b522-1f4a` / `9ecc-0180-3f98-d6c2` / `ffea-b24a-0cdf-781e` |
| Kostenart „pts" (`.gst:7`) | `ecfa-8486-4f6c-c249` |
