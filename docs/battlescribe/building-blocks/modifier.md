[BSData-Formatreferenz](../../battlescribe-data-format.md) › Bausteine

# 7.7 Modifier, Condition, Condition Group, Repeat

Ein `modifier` **ändert** eine Eigenschaft des Elternelements oder den Wert eines Constraints.

| `modifier`-Attribut | Werte | Bedeutung |
|---------------------|-------|-----------|
| `type` | `increment` \| `decrement` \| `set` \| `append` \| `prepend` \| `multiply` \| `add` \| `remove` \| `set-primary` \| `unset-primary` | Operation. `increment`/`decrement`/`set`/`multiply` für numerische Felder, `append`/`prepend`/`set` für Text, `add`/`remove` für Kategoriezugehörigkeit (`field="category"`), `set-primary`/`unset-primary` für das `primary`-Flag eines Kategorie-Links. |
| `field` | *Constraint-`id`* \| *`<costTypeId>`* \| `hidden` \| `name` \| `category` \| `error` \| `warning` \| `info` \| *`<characteristicTypeId>`* | Was geändert wird. `category` (zusammen mit `add`/`remove`) ändert die Kategoriezugehörigkeit zur Laufzeit. `error`/`warning`/`info` (zusammen mit `type="add"`) tragen keinen Feldwert, sondern einen Klartext-Hinweis für den Spieler (siehe unten). |
| `value` | Zahl/Text | Der anzuwendende Wert. Bei `append`/`prepend` der anzufügende Text. |
| `join` | Text (optional, nur `append`/`prepend`) | Trennzeichen zwischen dem bestehenden Namen und dem angehängten/vorangestellten Text. **Wird verbatim übernommen, nicht angenommen** — reale Kataloge nutzen neben einem einfachen Leerzeichen auch NBSP (`&#160;`) und `"&#160;+&#160;"`. Fehlt das Attribut, wird ohne Trennzeichen zusammengefügt (siehe den Widerspruchs-Kasten unten). |
| `scope` | Bezugsrahmen (optional, **nicht schema-definiert**) | Auf *welches* Element der Modifier wirken soll, statt auf seinen Träger — siehe den Kasten unten. |

> **`scope` an einem `modifier` — in der `Catalogue.xsd` nicht definiert, in echten Daten belegt.**
> Die vendored `Catalogue.xsd` dieses Projekts kennt kein `scope`-Attribut an `<modifier>`; sie führt
> es nur an `constraint`, `condition` und `repeat`. Belegt ist es trotzdem: **8 Vorkommen** in den
> 12 eingefrorenen Fixture-Katalogen (`src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive/`), davon 7×
> `scope="unit"` und 1× `scope="force"`. Beispiel `<modifier type="add" field="category"
> value="4990-1770-2328-effd" scope="unit"/>` an „Mark of Slaanesh" (`Dark Elves` 5×,
> `Vampire Counts` 1×) — die Absicht ist erkennbar: die Kategorie „Slaanesh" soll die **Einheit**
> bekommen, nicht das tragende Upgrade.
>
> **Der Evaluator setzt das nicht um, aber er verschweigt es nicht** (Issue 0102, Punkt 9). Ein
> Modifikator wirkt in dieser Engine an dem Element, an dem er hängt
> ([`docs/evaluator-architecture.md`](../../evaluator-architecture.md) §3.4, „Träger") — eine Regel, die aus
> den Daten belegt ist und an der die ganze Effektiv-Werte-Schicht hängt. Ein abweichender `scope`
> erzeugt deshalb beim Lesen die Diagnose `unsupportedModifierScope` (mit Träger, Feld, Wert und
> Rahmen), und der rohe Wert steht als `scope` am Modifikator im aufbereiteten Datensatz. Der
> Modifikator wirkt weiterhin am Träger — sichtbar falsch statt still falsch.

> **Widerspruch zum Wiki (`append` ohne `join`):** Das Wiki behauptet für `Append`: *„A space is
> implicitly added between `Field` and `Value`"*
> ([*Data structure overview*](../../bsdata-catalogue-development-wiki/Data-structure-overview.md),
> Abschnitt *Modifier*). Hier gilt die Entscheidung dieses Dokuments: **Fehlt `join`, wird ohne
> Trennzeichen zusammengefügt** — kein implizites Leerzeichen. Die Engine folgt dieser Semantik
> (`src/contexts/ruleengine/engine/modifiers.js`: fehlendes `join` ⇒ leerer Trenner). Beleg aus den im Repo
> eingefrorenen Definitive-Edition-Katalogen (`src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive/`,
> 11 `.cat` + 1 `.gst`; 121 `join`-Vorkommen insgesamt, davon 15 wirkungslos an
> `set`-Modifiern; 5 stehen an `prepend`-Modifiern, wo der Trenner wirkt
> (`src/contexts/ruleengine/engine/modifiers.js`, `prependOrder`)): 101 von 119 `append`-Modifiern setzen `join`
> explizit (Leerzeichen, NBSP oder
> `"&#160;+&#160;"`) — dort ist der Unterschied latent. Die 18 `append` ohne `join`
> (`Mercenaries` 1, `Skaven` 4, `The Empire` 13; Beispiel
> `Mercenaries`, `<modifier type="append" value="*" field="name"/>`) machen ihn sichtbar:
> nach dieser Entscheidung wird `*` direkt angefügt (`Name*`), nach dem Wiki mit Leerzeichen
> (`Name *`).

> **Nicht offiziell spezifiziert (`multiply`, `prepend`, `join`):** Diese drei Konstrukte sind in
> keiner bekannten `BSData/schemas`-Version definiert — geprüft bis einschließlich der
> unveröffentlichten `vNext`-Version. Sie werden dennoch vom BattleScribe-Referenzprogramm
> akzeptiert und von aktiv gepflegten Datensätzen (Lexicanum Imperialis' „Definitive Edition")
> real genutzt. Die vendorte `Catalogue.xsd` dieses Projekts wurde deshalb bewusst und dokumentiert
> um sie erweitert (siehe [ADR 0016](../../adr/0016-battlescribe-xsd-als-vendored-konformitaetsquelle.md),
> Revision 2026-07-19).

**`field="error"`/`"warning"`/`"info"` — Klartext-Hinweise an den Spieler.** Ein `modifier
type="add" field="error"` (analog `"warning"`/`"info"`), dessen `<conditions>`/`<conditionGroups>`
zutreffen, ist kein Wert-Modifier, sondern eine kontextabhängige Nachricht an den Spieler — `value`
trägt den Nachrichtentext. `error` verhält sich wie ein regulärer Regelverstoß (blockiert die
Roster als ungültig); `warning`/`info` sind rein informativ. Beispiel (Bretonnia/Dark Elves):

```xml
<modifier type="add" value="Please enable &quot;Allow special characters?&quot;" field="error">
  <conditions>
    <condition type="lessThan" value="1" field="selections" scope="force"
               childId="8923-5946-7b10-8957" shared="true" includeChildSelections="true"/>
  </conditions>
</modifier>
```

Ein Modifier kann **bedingt** (`<conditions>` / `<conditionGroups>`) und/oder **wiederholend**
(`<repeats>`) sein.

## `condition` — eine Voraussetzung

| `condition`-Attribut | Bedeutung |
|----------------------|-----------|
| `type` | Vergleich: `lessThan`, `greaterThan`, `equalTo`, `notEqualTo`, `atLeast`, `atMost`, `instanceOf`, `notInstanceOf`; dazu `greaterThanOrEqualTo`, 1× in den Fixture-Katalogen belegt (`src/tests/__fixtures__/whfb6/Orcs and Goblins.cat`) und upstream nicht dokumentiert. |
| `field` | Was verglichen wird — z. B. `selections`, eine Kostenart oder `limit::<costTypeId>` (das **Kostenlimit** der Roster). |
| `scope` | Bezugsrahmen. Die **geschlossene** Liste der Schlüsselwörter: `roster`, `force`, `parent`, `self`, `unit` (die umschließende Einheit) und `model-or-unit` (das nächste Modell **oder** die nächste Einheit) als Zählrahmen; `ancestor` (die Vorfahrenkette, nur mit `instanceOf`/`notInstanceOf`), `primary-catalogue` (das Armeebuch des umschließenden Kontingents, [Kasten in §7.6](constraint.md#scopeprimary-catalogue--das-armeebuch-kein-zählrahmen)) und `primary-category` (die primäre Kategorie der tragenden Auswahl) als Prüfungen. Siehe die Kästen zu [`unit`/`ancestor`](#scopeunit-und-scopeancestor--die-umschließende-einheit-und-die-vorfahrenkette) und zu [`primary-category`/`model-or-unit`](#scopeprimary-category-und-scopemodel-or-unit--die-primäre-kategorie-und-der-weitere-typ-rahmen). Jeder andere Wert ist eine **Vorfahren-Id** (Eintrag, Gruppe, `forceEntry`, Kategorie). |
| `childId` | *Was* gezählt wird: eine Ziel-ID, ein Typ-Keyword (`model`, `unit`, `upgrade`) oder `any`. |
| `value` | Vergleichswert. |
| `percentValue` | `true`/`false` — ob `value` als **Prozentsatz** des im Rahmen gezählten Nenners zu lesen ist (die XSD trägt das Attribut an der gemeinsamen `QueryBase`, es gilt also für Constraint, Condition und Repeat gleichermaßen; gleiche Nenner- und Rundungskonvention wie bei Prozent-Grenzen, [§7.6](constraint.md#76-constraint)). Bei `instanceOf`/`notInstanceOf` ohne Wirkung (Wiki: *„has no effect"*). |
| `shared` | Ob über alle Instanzen des Eintrags im Roster gezählt wird (`true`) oder nur über die eine Instanz, an der die Condition hängt (`false`). Vorgabewert laut XSD ist `true`. |
| `includeChildSelections` | Wenn `true`, werden auch **unterhalb** des Scope-Ziels verschachtelte Auswahlen mitgezählt, nicht nur dessen direkte Kinder (BattleScribe `QueryBase`-Attribut). |

> **Domänenregel (Kategorie-Zähler, Ziel-Typ-Regel):** Zählt eine Query ein Kategorie-Ziel
> (z. B. „maximal 3 Helden"), werden die Kategorie-Zähler **über alle Forces hinweg aggregiert**
> ausgelesen — nicht isoliert pro Force. Das gilt **einheitlich für alle Query-Arten** (Constraint,
> Condition, Repeat): das Datenformat (XSD `QueryBase`) unterscheidet `scope` nicht nach Query-Art,
> also entscheidet der **Ziel-Typ** den Bezugsrahmen — ein `scope="force"`-Eintragsziel zählt pro
> Detachment, ein Kategorie-Ziel armeeweit. Sonst schlagen dynamische Limits fehl, sobald dieselbe
> Kategorie in mehreren Detachments vorkommt. Umgesetzt an genau einer Stelle (`resolveScopeAnchor`,
> ADR 0029).

> **`instanceOf`/`notInstanceOf` gegen eine `forceEntry` — zwei Kodierungen.** Eine Condition, die
> prüft „ist das Kontingent eine Instanz dieses Detachments" (z. B. eine armeespezifische Variante),
> kann die `forceEntry`-Id auf **zwei** Wegen benennen, und beide kommen real vor:
> - **Selbst-gegatet:** die Id steht direkt in `scope` (`scope="<forceId>"`), `childId` bleibt leer
>   oder trägt `"any"` — so gatet in den Fixture-Katalogen das Orcs-and-Goblins-Sonderheer
>   „Mountain or Troll Country Waaagh!" seine Regeln (`scope="<forceId>" childId="any"`). Das
>   „eigene Punktelimit" aus [§5.6](../files/game-system.md#56-force-entries-detachments) nutzt dagegen die
>   **kanonische** Kodierung (`scope="force"` + eigene Id in `childId`), wie die realen
>   Vampire-Counts-Sonderheere belegen.
> - **Kanonisch:** `scope="force"` trägt das Literal-Keyword, die Id steht in `childId`
>   (`scope="force" childId="<forceId>"`) — so gatet die „Definitive Edition" z. B. ihre
>   Standard-vs.-Ironskin-Tribe-Regeln (`notInstanceOf` Ironskin Tribe).
>
> Beide bedeuten dasselbe. Die Auswertung erkennt eine `forceEntry`-Instanz-Prüfung daran, dass
> `scope` **oder** `childId` auf eine reale `forceEntry`-Id auflöst (das Literal `"force"` tut das
> nicht) — sonst fiele die kanonische Form fälschlich in die selektionsweise Zählung zurück.

## `scope="unit"` und `scope="ancestor"` — die umschließende Einheit und die Vorfahrenkette

> Das Wiki zählt `ancestor` in der Scope-Aufzählung auf (gültig nur mit
> `instanceOf`/`notInstanceOf`), beschreibt seine Semantik aber nicht; `unit` ist upstream gar nicht
> dokumentiert. Reale Kataloge nutzen beide (Fixture-Kataloge der Definitive Edition: `scope="unit"`
> 337×, `scope="ancestor"` 33×). Aus den Daten belegt und in Issue 086 entschieden:
>
> - **`unit` ist ein regulärer Zählrahmen:** der nächste Vorfahre — den Träger der Query
>   **eingeschlossen** — mit `type="unit"`; steht die Einheit per `entryLink` im Baum, zählt der
>   rohe Typ ihres transitiv aufgelösten Ziels (dieselbe Erb-Regel wie beim Typ-Keyword-Zählen,
>   Issue 078). Das idiomatische Muster ist der **Kostenaufschlag je Modell** (Mercenaries):
>   `<repeat field="selections" scope="unit" childId="model"/>` an einer Option zählt die Modelle
>   der umschließenden Einheit. Ohne umschließende Einheit wertet die Engine fail-closed
>   (`unresolvedScope`) statt still zu raten.
> - **`ancestor` ist kein Zählrahmen**, sondern — wie `primary-catalogue` — eine Prüfung: eine
>   `instanceOf`-Condition hält genau dann, wenn **irgendein** Vorfahre der tragenden Auswahl
>   (die gesamte strikte Kette, Kontingente eingeschlossen) auf die `childId` auflöst —
>   über seine Definitions-Id, seine Link-Ziel-Id, eine seiner **effektiven** Kategorien oder
>   seinen rohen Typ; `notInstanceOf` invers. Alle 33 Fixture-Vorkommen benennen
>   **Kategorie-Ids** („Characters", „Battle standard bearer", „Slaanesh",
>   „Slaanesh [DARK ELVES]") — die
>   Prüfung braucht also die effektiven Kategorien, nicht nur Definitions-Ids. Die Zähl-Flags
>   (`shared`, `includeChild…`) sind ohne Wirkung: eine Vorfahrenkette wird durch eine Instanz
>   nicht enger.

## `scope="primary-category"` und `scope="model-or-unit"` — die primäre Kategorie und der weitere Typ-Rahmen

> Das Wiki nennt *„primary category"* in seiner Scope-Aufzählung, ohne ihm eine Semantik zu geben;
> `model-or-unit` kennt es gar nicht. Die XSD hilft nicht: sie typisiert `scope` an der gemeinsamen
> `QueryBase` als bloßes `xs:string` (`Catalogue.xsd:426`) und schränkt nichts ein. Reale Kataloge
> nutzen beide, wenn auch selten (Fixture-Kataloge der Definitive Edition:
> `scope="primary-category"` 4×, `scope="model-or-unit"` 2×). Aus den Daten belegt und in Issue 081
> entschieden:
>
> - **`primary-category` ist kein Zählrahmen**, sondern — wie `primary-catalogue` — eine
>   **Identitätsprüfung:** hält genau dann, wenn die `childId` die **primäre** Kategorie des
>   nächsten Vorfahren benennt, der überhaupt eine trägt (den Träger der Query eingeschlossen,
>   die Roster-Wurzel ausgenommen). Trägt eine Auswahl die Kategorie nur mit `primary="false"`,
>   hält die Prüfung **nicht**. Belegt in `Forces of Chaos (6th definitive edition).cat`
>   (Zeilen 12679, 13024, 13062, 13093): alle vier sind `instanceOf field="selections"`
>   mit `childId="e94b-6a54-8779-cd60"` (die `.gst`-Kategorie *Rare*) und hängen am geteilten
>   Reittier-Eintrag *Juggernaut of Khorne* (`ba34-87a0-8cd2-c77d`), der selbst nur
>   `categoryLink Khorne primary="false"` trägt — die Auflösung muss also **steigen**. Die fünf
>   verlinkenden Träger unterscheiden genau richtig: der *Daemonic Chariot of Khorne* führt
>   *Rare* als `primary="true"` (die Prüfung hält, und die vier `set`-Modifier blenden T, Ld, BS
>   und W des Zugtiers auf `-` aus), *BloodCrushers* führen *Special*, der *Lord of Chaos*
>   *Lord*, der *Daemonic Herald* *Heroes* (die Prüfung hält nicht). Die Zähl-Flags sind ohne
>   Wirkung: eine primäre Kategorie wird durch eine Instanz nicht enger. `childId="any"` (bzw.
>   kein Ziel) trifft immer — der Rahmen hat genau eine primäre Kategorie. Trägt kein Knoten der
>   Kette eine, wertet die Engine fail-closed (`unresolvedScope`).
> - **`model-or-unit` ist ein regulärer Zählrahmen**, die exakte Verallgemeinerung von `unit`:
>   der nächste Vorfahre — den Träger der Query **eingeschlossen** — mit rohem `type="model"`
>   **oder** `type="unit"`; für einen `entryLink` zählt wieder der rohe Typ seines transitiv
>   aufgelösten Ziels (dieselbe Erb-Regel wie bei `unit`). Belegt in
>   `Lizardmen (6th definitive edition).cat` (Zeilen 4939, 4967): beide sind
>   `instanceOf field="selections" childId="7b73-1714-155f-8f67"` (die Kategorie *Red Crested
>   Skink*) mit `includeChildSelections="true"` und schalten die versteckten Aufwertungen
>   *Skavenpelt* und *Sign of Sotek* per `set hidden="false"` frei; die Kategorie hängt sowohl an
>   der Einheit *Red Crested Skinks* als auch an der Aufwertung *Red Crests*. Ohne Modell und
>   ohne Einheit über sich wertet die Engine fail-closed (`unresolvedScope`) — außer an einem
>   engine-eigenen Anker, genau wie bei `unit`.

## `conditionGroup` — Verknüpfung mehrerer Bedingungen

Gruppiert Bedingungen mit `type="and"` oder `type="or"` zu komplexer Logik. Eine `and`-Gruppe
hält, wenn **alle** ihre Mitglieder (Bedingungen *und* Untergruppen) halten, eine `or`-Gruppe,
wenn **mindestens eines** hält.

> **`type="not"` — nicht offiziell spezifiziert.** Weder das Wiki noch eine bekannte
> `BSData/schemas`-Version kennt diesen Gruppentyp; die vendorte `Catalogue.xsd` dieses Projekts
> wurde bewusst und dokumentiert um ihn erweitert (wie zuvor um `multiply`/`prepend`/`join`, siehe
> [ADR 0016](../../adr/0016-battlescribe-xsd-als-vendored-konformitaetsquelle.md)). Belegt ist er allein
> durch reale Kataloge: die Definitive Edition nutzt ihn 4× in drei Armeebüchern — `Vampire Counts`
> 2×, `Lizardmen` 1×, `Skaven` 1× —, jedes Mal am `set`-Modifier, der die Pflicht-Untergrenze einer
> Sonderheer-Einheit hebt, abhängig von einer Kampagnen-Ausnahme („Army of the Lichemaster":
> Heinrich Kemmler `8461-3eab-e5ac-1636`, Krell `60a8-5b49-6b81-7c84`; „Red Host (LUS)": Tehenhauin;
> „Bubonic Court of Nurglitch (LUS)").
>
> **Entscheidung dieses Projekts (Issue 0115):** eine `not`-Gruppe hält genau dann, wenn **keines**
> ihrer Mitglieder hält — die exakte De-Morgan-Duale zu `or`. Damit ist `not` die strengere der
> beiden denkbaren Lesarten (`NOT(OR(…))` gegen `NOT(AND(…))`) und folgt der fail-closed-Richtung
> der übrigen Auswertung. Auf den realen Daten ist die Wahl **nicht beobachtbar**: alle vier
> Fundstellen tragen genau *ein* Mitglied (eine `and`-Untergruppe), wo jede Lesart dieselbe
> schlichte Negation ergibt.

```xml
<!-- Vampire Counts: Kemmler ist Pflicht im Lichemaster-Heer, AUSSER in der
     Kampagnenvariante unter 2000 Punkten -->
<modifier type="set" value="1" field="8461-3eab-e5ac-1636">
  <conditionGroups>
    <conditionGroup type="and">
      <conditions>
        <condition type="instanceOf" field="selections" scope="force"
                   childId="f37a-a93e-fa22-61a8" … />   <!-- Army of the Lichemaster -->
      </conditions>
      <conditionGroups>
        <conditionGroup type="not">
          <conditionGroups>
            <conditionGroup type="and">
              <conditions>
                <condition type="lessThan" value="2000" field="limit::…" scope="roster" … />
                <condition type="atLeast" value="1" field="selections" scope="force"
                           childId="14fb-dd39-08e7-cbde" … />   <!-- Kampagne -->
              </conditions>
            </conditionGroup>
          </conditionGroups>
        </conditionGroup>
      </conditionGroups>
    </conditionGroup>
  </conditionGroups>
</modifier>
```

## `repeat` — Modifier mehrfach anwenden

Ähnlich einer Condition, bewirkt aber, dass der Modifier **mehrfach** angewendet wird (z. B. „+1
Slot je 1000 Punkte"). Attribute u. a. `repeats` (wie oft pro Treffer), `roundUp` und
`percentValue` (die Schrittweite `value` als Prozentsatz des Rahmen-Nenners, wie bei der
Condition oben).

## `modifierGroup` — eine bedingte Klammer um mehrere Modifier

Neben `<modifiers>` trägt fast jede Entität ein optionales `<modifierGroups>`
(`Catalogue.xsd:107`). Ein `modifierGroup` erweitert dieselbe Basis wie ein `modifier`
(`ModifierBase` — also `<conditions>`, `<conditionGroups>`, `<repeats>`), enthält aber
statt eines Feldwerts wieder `<modifiers>` und beliebig tief geschachtelte
`<modifierGroups>` (`Catalogue.xsd:523-538`). Die Bedingungen der Klammer gelten für
**alle** Modifier darin; die Klammer ist damit die Kurzform für „dieselbe Bedingung an
mehreren Modifiern" — semantisch gleichwertig dazu, sie an jedem einzelnen zu
wiederholen.

Dasselbe gilt für ihre **`<repeats>`** (Issue 0116): der Wiederholungsfaktor der Klammer
multipliziert sich in jedem Modifier darin auf dessen eigenen Faktor. Real genutzt in
`Vampire Counts` („Grave markers": `+1` auf zwei Grenzen, wiederholt je gezähltem Vampir
im Kontingent).

```xml
<selectionEntry name="Full Plate Armour" hidden="true" id="3869-2f40-dd21-6971" …>
  <modifierGroups>
    <modifierGroup type="and">
      <conditions>
        <!-- führt die Armee die Blutlinie „Blood Dragon"? -->
        <condition type="atLeast" value="1" field="selections" scope="force"
                   childId="9fd9-e05c-ffcb-2c4d" shared="true" includeChildSelections="true"/>
      </conditions>
      <modifiers>
        <modifier type="set" value="false" field="hidden"/>
        <modifier type="set" value="1" field="b381-5bd3-4720-6f9a"/>
      </modifiers>
    </modifierGroup>
  </modifierGroups>
</selectionEntry>
```

> **Nicht im Wiki dokumentiert:** Modifier-Gruppen kommen im BSData-Wiki **an keiner
> Stelle** vor (0 Treffer im ganzen Submodul, Stand `f4949c3`, 2026-01-27); sein
> Abschnitt *Modifier* kennt als Kinder nur Conditions, Condition Groups und Repeats.
> Belegt sind sie allein durch die XSD und die realen Kataloge (siehe [§15](../reference/source-gaps.md#15-lücken-der-quelle)).

> **Fallstrick beim Lesen von Katalogdaten:** Ein Modifier steht **entweder** in
> `<modifiers>` **oder** in einem `<modifierGroup>` — Kataloge nutzen beides
> nebeneinander. Wer eine Frage der Art „gattert dieser Katalog den Eintrag
> überhaupt?" durch Suchen beantwortet, muss **beide** Orte durchsuchen. Das Beispiel
> oben ist genau der Fall: das obige `hidden="true"` sieht ohne die `modifierGroup`
> nach einem Datenfehler aus, ist aber ein sauberes Blutlinien-Gatter (Issue 0135,
> Korrektur).

## Vollständiges Beispiel (aus dem `.gst`, Force „Standard")

Der erlaubte Maximalwert der Kategorie **Core** skaliert mit dem Punktelimit der Armee. Der Modifier
adressiert per `field="9636-e6ed-b522-1f4a"` die **`id` eines Constraints** und ändert dessen Wert
abhängig vom Kostenlimit `limit::ecfa-8486-4f6c-c249` (der pts-Kostenart):

```xml
<categoryLink id="a87e-de8e-ade8-cae0" name="Core" targetId="64bf-efb4-9978-26df" primary="false">
  <modifiers>
    <!-- +1 (increment) wenn 2000–2999 Punkte -->
    <modifier type="increment" field="9636-e6ed-b522-1f4a" value="1.0">
      <conditions>
        <condition field="limit::ecfa-8486-4f6c-c249" scope="roster" type="greaterThan"
                   value="1999.0" childId="model"
                   percentValue="false" shared="true"
                   includeChildSelections="false" includeChildForces="false"/>
      </conditions>
      <conditionGroups>
        <conditionGroup type="and">
          <conditions>
            <condition field="limit::ecfa-8486-4f6c-c249" scope="roster" type="lessThan"
                       value="3000.0" childId="model" … />
          </conditions>
        </conditionGroup>
      </conditionGroups>
    </modifier>

    <!-- setze auf 6 und wiederhole je 1000 Punkte, ab 5000 Punkten -->
    <modifier type="set" field="9636-e6ed-b522-1f4a" value="6.0">
      <repeats>
        <repeat field="limit::ecfa-8486-4f6c-c249" scope="roster" value="1000.0"
                childId="model" repeats="1" roundUp="false"
                percentValue="false" shared="true"
                includeChildSelections="false" includeChildForces="false"/>
      </repeats>
      <conditions>
        <condition field="limit::ecfa-8486-4f6c-c249" scope="roster" type="greaterThan"
                   value="4999.0" childId="model" … />
      </conditions>
    </modifier>
  </modifiers>
</categoryLink>
```

Lesart: „Wenn das Punktelimit zwischen 2000 und 2999 liegt, erhöhe die Core-Obergrenze um 1; ab 5000
Punkten setze sie auf 6." Der `<repeat>` am zweiten Modifier bleibt dabei **wirkungslos**.

> **Ein wiederholter `set` wächst nicht (Issue 0095).** Eine frühere Fassung dieses Absatzes las
> den zweiten Modifier als „setze auf 6 **und erhöhe je weitere 1000 Punkte**". Das ist eine
> Über-Lesung des XML: `set` schreibt einen Wert, und denselben Wert ein zweites Mal zu schreiben
> ändert nichts — genau darin unterscheidet es sich von `increment`/`decrement`/`multiply`, deren
> Wirkung der Wiederholungsfaktor vervielfacht. Es gibt keine Lesart, in der wiederholtes Setzen
> eines *konstanten* `value` einen wachsenden Wert ergäbe; wer eine Staffel will, schreibt einen
> `set` **und** einen wiederholenden `increment`. Die Engine folgt dem
> (`src/contexts/ruleengine/engine/modifiers.js`, `setValue` ignoriert den Faktor; gepinnt in
> `modifiers.test.js`), und die Katalogdaten sind an dieser Stelle schlicht ungenau: die
> Core-Obergrenze bleibt bei jedem Budget ≥ 5000 exakt 6.
>
> Upstream ist die Frage **nicht** entschieden — das Wiki sagt zum `repeat` nur, er lasse den
> Modifier „multiple times" greifen, ohne einen Fall für `set` zu nennen ([§15](../reference/source-gaps.md#15-lücken-der-quelle)).

Ein Modifier kann auch `field="hidden"` setzen, um Einträge/Kategorielinks kontextabhängig ein- oder
auszublenden (in diesem Projekt ausgewertet allein von `src/contexts/ruleengine/engine/`; die Oberflaeche liest
das `isHidden` des Berichts).
