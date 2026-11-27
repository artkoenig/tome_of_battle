[BSData-Formatreferenz](../../battlescribe-data-format.md) › Bausteine

# 7.6 Constraint

Ein `constraint` ist eine **Grenze** (Minimum oder Maximum). Er definiert *was* gezählt wird
(`field`), in *welchem Bezugsrahmen* (`scope`) und *welche Grenze* (`type`/`value`).

```xml
<constraint field="selections" scope="parent" value="1.0" type="max"
            id="61ef-db9b-f468-886e"
            percentValue="false" shared="true"
            includeChildSelections="false" includeChildForces="false"/>
```

| Attribut | Werte | Bedeutung |
|----------|-------|-----------|
| `type` | `min` \| `max` | Untere oder obere Grenze. |
| `field` | `selections` \| `forces` \| *`<costTypeId>`* | Was gezählt/summiert wird: Anzahl Auswahlen, Anzahl Forces oder die Summe einer Kostenart. |
| `scope` | `parent` \| `roster` \| `force` \| `self` \| `unit` \| `primary-catalogue` \| *eine Vorfahren-Id* | Bezugsrahmen der Zählung (`unit` = die umschließende Einheit, siehe den [Kasten in §7.7](modifier.md#scopeunit-und-scopeancestor--die-umschließende-einheit-und-die-vorfahrenkette); `primary-catalogue` ist kein Zählrahmen, siehe den Kasten unten). Jeder Wert, der keines dieser Schlüsselwörter ist, ist eine **Vorfahren-Id**: die eines Eintrags, einer Gruppe, eines `forceEntry` oder einer Kategorie. Ein Literal `scope="category"` gibt es **nicht** — die Wiki-Formulierung *„any Category"* meint eine Kategorie-**Id**. Die Schlüsselwörter `model-or-unit` und `primary-category` kommen nur an Conditions vor, siehe den [Kasten in §7.7](modifier.md#scopeprimary-category-und-scopemodel-or-unit--die-primäre-kategorie-und-der-weitere-typ-rahmen). |
| `value` | Zahl | Der Grenzwert (`-1.0` = unbegrenzt, siehe den Sentinel-Kasten unten). |
| `percentValue` | `true`/`false` | Ob `value` als Prozentsatz zu interpretieren ist. |
| `shared` | `true`/`false` | Ob der gezählte Wert über alle Link-Instanzen geteilt wird oder pro Instanz gilt. `true`: die Summe umfasst **alle** Auswahlen dieses shared entry im Roster; `false`: sie wird **je Verweis-Instanz** gerechnet ([BSData-Wiki, *Data structure overview*](https://github.com/BSData/catalogue-development/wiki/Data-structure-overview)). |
| `includeChildSelections` | `true`/`false` | Ob verschachtelte Auswahlen mitgezählt werden. `false` zählt *„just `scope`'s `field`"* — also eingeschränkt, **nicht** leer. |
| `includeChildForces` | `true`/`false` | Ob untergeordnete Forces mitgezählt werden. `false` rechnet *„only from parent force selections"* — die Auswahlen des eigenen Kontingents zählen also weiter mit. |

**Beispiel „ein Punkte-Budget pro Auswahl"** — Magische Gegenstände dürfen zusammen höchstens
100 Punkte kosten (`field` ist die *Punkte*-Kostenart, nicht `selections`):

```xml
<constraint field="ecfa-8486-4f6c-c249" scope="parent" value="100.0" type="max"
            id="f1bd-eb3b-6dad-d76c"
            percentValue="false" shared="true"
            includeChildSelections="false" includeChildForces="false"/>
```

**Beispiel „genau eins"** — kombiniere `min=1` und `max=1` (Handwaffe ist Pflicht, aber nur einmal):

```xml
<constraints>
  <constraint field="selections" scope="parent" value="1.0" type="min" id="3036-9f59-6708-d4a6" … />
  <constraint field="selections" scope="parent" value="1.0" type="max" id="7125-8869-4634-890f" … />
</constraints>
```

> **Regeln:**
> - **Gezählt werden die Auswahlen *unterhalb* des Trägers der Grenze**, nicht der Träger selbst.
>   Der `scope` sagt nur, in welchem Rahmen summiert wird — die Quelle: der `scope` entscheide,
>   *„which entity should sum up all `field`'s values **of descendant selections of this
>   constraint's parent entry**"*
>   ([*Data structure overview*](../../bsdata-catalogue-development-wiki/Data-structure-overview.md),
>   Abschnitt *Constraint*). Eine Grenze an einer `selectionEntryGroup` zählt damit **ihre
>   Mitglieder**, nicht die Gruppe.
> - `scope="parent"` vergleicht aufgelöste **Ziel-IDs**, nicht `entryLinkId`s.
> - `scope="force"` zählt ein **Eintrags**-Ziel **pro Detachment**, ein **Kategorie**-Ziel **armeeweit**
>   (Ziel-Typ-Regel, [§7.7](modifier.md#77-modifier-condition-condition-group-repeat) / ADR 0029).
> - Die `id` eines `constraint`s ist wichtig: **Modifier adressieren einen Constraint über dessen `id`**,
>   um dessen `value` dynamisch zu ändern (siehe nächster Abschnitt).

> **Sentinel `-1` = „unbegrenzt" — nur als hingeschriebener Wert.** Upstream ist der Sentinel
> nirgends dokumentiert ([§15](../reference/source-gaps.md#15-lücken-der-quelle)); aus den Daten belegt und in Issue 079
> entschieden gilt: `-1` bedeutet „unbegrenzt" genau dort, wo er **hingeschrieben** steht — am
> `value` eines `constraint`s, am `value` eines `set`-Modifiers auf einen Constraint, an
> `defaultCostLimit` ([§5.3](../files/game-system.md#53-cost-types-kostenarten)) und am eingestellten
> Roster-`costLimit` (Issue 0096; dieselbe Aufzählung wie in
> [§15](../reference/source-gaps.md#15-lücken-der-quelle)). Reale Kataloge nutzen beide Richtungen:
> `set value="-1"` hebt eine konkrete Grenze auf, und ein Rohwert `-1` wird per bedingtem `set`
> auf einen konkreten Deckel gezogen (Border-Patrols-Muster). Ein **errechneter** negativer Wert
> (`increment`/`decrement`/`multiply`) ist dagegen **nie** unbegrenzt — ein Max, das rechnerisch
> auf `-1` fällt, heißt „nichts erlaubt", nicht „alles erlaubt". Arithmetik auf einer unbegrenzten
> Grenze lässt sie unbegrenzt; ein späterer `set` auf einen konkreten Wert überschreibt.

## `scope="primary-catalogue"` — das Armeebuch, kein Zählrahmen

> Upstream ist dieses Schlüsselwort **nirgends** dokumentiert: das Wiki zählt
> `parent|roster|force|primary category` und Vorfahren-Ids auf, die XSD typt `scope` als nackten
> String (`Catalogue.xsd:426`). Aus den Daten belegt und in Issue 077 entschieden gilt:
> **`primary-catalogue` bezeichnet das Armeebuch — den `<catalogue id=…>`, aus dem das umschließende
> Kontingent stammt.** Die Frage lautet nicht „wie viele?", sondern „ist es dieses?"; der Rahmen ist
> deshalb kein Zählrahmen, sondern eine **Identitätsprüfung** gegen die in `childId` genannte
> Katalog-Wurzel-Id. Drei Belege aus den eingefrorenen Fixture-Katalogen
> (`src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive/`, 27 Vorkommen: 7 in der `.gst`,
> 20 in `Mercenaries (…).cat`):
> - Alle 27 stehen an einer `condition` (`instanceOf`/`notInstanceOf`, `field="selections"`), nie
>   an einem `constraint` oder `repeat`, und **jede** `childId` ist eine Katalog-Wurzel-Id
>   (`731d-5b13-2a92-5427` = Ogre Kingdoms, `4049-c46d-7f80-44fb` = Orcs and Goblins,
>   `4d73-5ab0-9020-403c` = Vampire Counts). Keine dieser Ids benennt irgendwo einen Eintrag,
>   eine Kategorie oder ein Kontingent.
> - Nur unter dieser Deutung lesen sich die Regeln richtig: Maneaters kosten außerhalb einer
>   Ogerarmee einen Rare-Slot extra und sind in der Ogerarmee versteckt; Kampagnen-Einträge der
>   `.gst` werden nur für benannte Armeebücher sichtbar.
> - Der Autor sagt es selbst: die Bedingung an `categoryEntry "Chariot"` trägt den Kommentar
>   „Tomb Kings may have more than one Chariot" an einem `notInstanceOf childId="…"
>   childName="Tomb Kings"`; auch die übrigen `childName` sind Armeebuch-Namen.
>
> Die Semantik der Engine (`src/contexts/ruleengine/engine/query.js`) folgt daraus: Treffer ⇒ 1, anderes Armeebuch
> ⇒ 0, `childId` leer (Prozent-Nenner „alles im Rahmen") ⇒ 1, denn der Rahmen hat genau **einen**
> Katalog. `shared="false"` verengt ihn nicht — ein Katalog wird durch eine Instanz nicht enger.
> Eine `childId`, deren Katalog im Datensatz gar nicht geladen ist, ist ein schlichter
> Nicht-Treffer und kein Datenfehler. Lässt sich das Armeebuch nicht bestimmen — keine
> umschließende Force, oder ihre Definition steht in der `.gst` statt in einem Armeebuch —, meldet
> die Engine `unresolvedScope` und wertet fail-closed, statt still ein Armeebuch anzunehmen.
> Welches Kontingent gemeint ist, entscheidet der Standort der Query; **welcher Katalog** ein
> Kontingent deklariert hat, kommt aus der Herkunft seiner Definition, nicht aus dem
> `catalogueId`-Attribut der `.ros` (Issue 077, Decisions).
