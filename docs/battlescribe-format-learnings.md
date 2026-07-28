# Learnings aus der BSData-Formatdokumentation

Die Community-Dokumentation des Battlescribe-Formats liegt als Submodul unter
[`docs/bsdata-catalogue-development-wiki/`](bsdata-catalogue-development-wiki/)
(Quelle: <https://github.com/BSData/catalogue-development/wiki>). Die zentrale
Seite ist `Data-structure-overview.md`.

Dieses Dokument ist **kein Ersatz** für jene Seiten und wiederholt sie nicht.
Es hält fest, was sie für **unsere Engine** bedeuten: wo wir übereinstimmen, wo
wir nachweislich abweichen, und wo die Quelle schweigt. Für die Beschreibung des
Formats selbst gilt weiterhin
[`battlescribe-data-format.md`](battlescribe-data-format.md).

Aktualisieren: `git submodule update --remote docs/bsdata-catalogue-development-wiki`.

## 1. Eine Grenze zählt die Nachfahren ihres Trägers

> `Scope` — one of `parent|roster|force|primary category` or any type of
> ancestor identifier, this decides which entity should sum up all `field`'s
> values **of descendant selections of this constraint's parent entry**.
>
> — `Data-structure-overview.md`, Abschnitt *Constraint*

Der letzte Halbsatz ist der wichtigste Satz der ganzen Seite. Gezählt werden
**die Auswahlen unterhalb des Trägers der Grenze**, nicht der Träger selbst. Der
`scope` sagt nur, *in welchem Rahmen* summiert wird.

**Folge für eine Grenze an einer `selectionEntryGroup`:** Sie zählt die
Mitglieder der Gruppe, nicht die Gruppe. Unsere Engine zählt heute die eigene
Id des Gruppenknotens — belegt in Issue `083` an der Gruppe „Magic Armour"
(`76e2c1c8`, `max 1`), die bei zwei gewählten Mitgliedern schweigt.

## 2. `shared` entscheidet, ob über Verweis-Instanzen hinweg gezählt wird

> [`Shared?`] if checked, the constrained value is a sum of all selections of
> this shared entry in roster in total; if unchecked, the sum is calculated for
> a given entry link instance.
>
> — ebenda

Damit ist die Frage entschieden, die Issue `076` aufwarf: Bei `shared="true"`
— dem XSD-Vorgabewert — werden **alle** Vorkommen des Ziel-Eintrags
zusammengezählt, auch wenn sie über verschiedene `entryLink`s hereinkamen. Die
Constraint-Schicht zählt deshalb die aufgelöste **Ziel-Id**, nicht die Id des
einzelnen Verweises. `shared="false"` bindet dagegen an die eine
Verweis-Instanz.

Das Wiki nennt als Ursprung der Erklärung eine Auskunft des
Battlescribe-Entwicklers:
<https://github.com/BSData/wh40k-7th-edition/issues/2880>.

## 3. Die beiden `include`-Flags schalten nicht auf „nichts"

> `And all child selections?` whether constrained value is just `scope`'s
> `field` (unchecked), or a sum of all descendant selections (checked).
>
> `And all child forces?` whether constrained value is calculated **only from
> parent force selections** (unchecked), or all of its descendant forces too
> (checked).
>
> — ebenda

„Unchecked" heißt **eingeschränkt**, nicht **leer**. Insbesondere zählt
`includeChildForces="false"` weiterhin die Auswahlen des eigenen Kontingents.

**Folge:** Eine Grenze mit `scope="roster"`, `shared="true"` und beiden Flags
auf `false` muss die Vorkommen im Roster zählen — nicht 0. Unsere Engine liefert
0, weil sie nur den Basis-Eimer des Rahmens summiert. Das ist die erste Hälfte
von Issue `083`.

## 4. Ein Modifikator am Verweis wirkt auf das Ziel

> A modifier may change the properties of its parent or the `Value` of its
> parent's Constraints. If the parent is a Link, it may instead change the
> properties of the **link's target** or the `Value` of the **link's**
> Constraints.
>
> — ebenda, Abschnitt *Modifier*

Bemerkenswert asymmetrisch: die *Eigenschaften* gehen ans Ziel, die
*Grenzwerte* bleiben beim Verweis.

## 5. Ein `entryLink` zeigt nur auf geteilte Einträge desselben Katalogs

> The target must be from the **shared** lists contained in the same catalogue.
> Because of game-system level import, that also includes shared entries from
> *game system* catalogue, as they are imported on almost equal rights as
> catalogue-defined ones (but read-only).
>
> — ebenda, Abschnitt *Entry Link*

Ein Verweis und sein Ziel liegen also immer im selben Katalog oder das Ziel im
Grundregelwerk. Ein Roster, das einen Verweis aus Katalog X benennt, ist gegen
einen Datensatz ohne X schlicht nicht auswertbar — dass die Ziel-Id zufällig im
Grundregelwerk auflöst, macht es nicht gültig. Das entschärft den in Issue `076`
(Befund F3) notierten Verlust des `entryId`-Rückfalls: der scheinbar
verlorene Fall war nie ein gültiger.

Ebenfalls dort, für Kontingente:

> All selections within must originate from a single catalogue.
>
> — ebenda, Abschnitt *Force Entry*

## 6. `type` ist Metadaten, kein Auswahlbegriff

> `Type` — can be one of `upgrade|model|unit`, this is a **metadata-like
> property that doesn't directly impact Roster Edit View**, but might impact
> how given selection is displayed in Roster Display View, and also is taken
> into account for roster statistics e.g. *model count*.
>
> — ebenda, Abschnitt *Selection Entry*

Relevant für Issue `078`: Der Typ ist eine Eigenschaft des Eintrags. Das Wiki
sagt **nicht**, ob ein `entryLink` den Typ seines Ziels erbt.

## 7. Bedingungen: `ancestor` verträgt nur `instanceOf`

> `Type` — one of `less than|greater than|equal to|at least|at most|instance
> of|not instance of`. … Where `Scope` is `Ancestor`, only `instance of|not
> instance of` are valid.
>
> — ebenda, Abschnitt *Condition*

Der Bezugsrahmen einer Bedingung ist reicher als der einer Grenze:
`parent|ancestor|roster|force|primary category`, dazu jeder Vorfahre, jede
Kategorie und jedes Kontingent.

## 8. `defaultSelection` und `collective`

Eine `selectionEntryGroup` kann ein `Default Selection` benennen:

> an optional field referencing child `SE`, that will be automatically selected
> when this group's parent is selected, **in the amount equal to `constraint`
> with `min` type and value greater than 0**.

`collective` hat zwei Wirkungen (eigene Seite `Collective-Entries.md`):
Gleichartige Kinder fallen im Roster zu einem Posten zusammen, **und** alle
Geschwister-Instanzen desselben Elternteils müssen dieselbe Anzahl tragen.
Die Seite warnt ausdrücklich vor der zweiten Wirkung als Fehlerquelle.

## Was die Quelle **nicht** sagt

Wichtig für uns, weil hier keine Autorität existiert und wir selbst entscheiden
müssen:

- **Die `.ros`-Struktur ist undokumentiert.** Die Abschnitte *Roster*, *Force*
  und *Selection* stehen als `TODO` in der Datei. Es gibt damit **keine**
  Aussage darüber, welche Id (`entryId`, `entryLinkId`, `entryGroupId`) die
  Identität einer Auswahl trägt — genau die offene Frage aus Issue `076`.
- **Ob eine Grenze am Verweis oder am Ziel gilt**, steht nirgends explizit;
  belegt ist nur, dass ein Verweis eigene `Constraint`s tragen darf und dass
  ein Modifikator am Verweis dessen Grenzwerte ändert.
- **Modifikator-Typen `add` und `remove`** sind nicht dokumentiert. Die Seite
  kennt nur `Increment|Decrement|Set|Append`, obwohl reale Kataloge `add`/
  `remove` für Kategorien verwenden.
- **`scope="primary-catalogue"`** taucht in der Aufzählung nicht auf — die
  Seite nennt `primary category`. Die offene Frage aus Issue `077` bleibt
  offen.
- **`value="-1"`** als „unbegrenzt" ist nicht dokumentiert (Issue `079`).
- Die Seite trägt am Ende selbst den Hinweis `TODO: Update to 2.02` — sie
  beschreibt einen älteren Stand als die heutigen Kataloge.

## Was daraus folgt

| Erkenntnis | Wirkung |
|---|---|
| §2 `shared="true"` zählt über Verweise hinweg | bestätigt die Constraint-Änderung aus Issue `076` |
| §1 Grenze zählt die Nachfahren ihres Trägers | macht die Gruppen-Hälfte von Issue `083` zum belegten Fehler |
| §3 `include`-Flags schalten nicht auf „nichts" | macht die `scope="roster"`-Hälfte von Issue `083` zum belegten Fehler |
| §5 Verweis und Ziel im selben Katalog | entschärft Befund F3 aus Issue `076` |
| Lücke `.ros` | die Adapter-Frage aus Issue `076` muss ohne Quelle entschieden werden |
| Lücke `primary-catalogue`, `-1` | Issues `077` und `079` finden hier keine Antwort |
