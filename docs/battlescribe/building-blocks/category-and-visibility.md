[BSData-Formatreferenz](../../battlescribe-data-format.md) › Bausteine

# 8. Kategorien & Sichtbarkeit

- **`primary="true"`** bestimmt den **Anzeige-Bucket** in der Roster-UI (genau eine pro Eintrag).
- **`primary="false"`** sind unsichtbare Tag-Kategorien für die Validierung.
- **`hidden`** blendet eine Entität aus; per Modifier `field="hidden"` kann die Sichtbarkeit
  **dynamisch** werden (z. B. „Reittier X nur sichtbar, wenn Held Y gewählt"). Die Min-Grenzen
  einer effektiv versteckten Entität werden **nicht** validiert — die §5.6-Regel, per
  Projektentscheidung (Issue 0088) verallgemeinert auf alle Ankerarten; wird die Entität per
  Modifier wieder sichtbar, greifen sie wieder. Max-Grenzen gelten unabhängig von der Sichtbarkeit.
- **Eine versteckte Entität, die trotzdem im Roster liegt, ist ein Fehler.** Das ist die
  Gegenrichtung zur Zeile darüber und steht wörtlich in der Quelle: eine versteckte Entität ist dem
  Nutzer nicht sichtbar, „and any already selected entries will cause error showing up in error list
  in Roster Editor" ([BSData-Wiki, *Props: Hidden*](../../bsdata-catalogue-development-wiki/Data-structure-overview.md)).
  Typisch entsteht das beim Wechsel einer Armee-Variante, der die Altauswahl liegen lässt. Maßgeblich
  ist wie bei der Min-Unterdrückung das **eigene** effektive `hidden` der Auswahl (Basis-Attribut,
  `hidden`-Modifier, Verweis-ODER-Ziel und jede sie klammernde versteckte Gruppe) — ein versteckter
  Vorfahr meldet für sich, nicht für seine Kinder; und wird die Definition per Modifier wieder
  sichtbar, verschwindet die Meldung. Der Evaluator führt sie als eigene Herkunft
  `hiddenSelection` in derselben Meldungsliste (Issue 0119).
- **`hidden` an einem `entryLink` und an seinem Ziel wirken zusammen (ODER).** Ein Vorkommen ist
  versteckt, wenn der Verweis **oder** die verwiesene Definition versteckt ist; ein `hidden`-Modifier
  an einer der beiden Seiten schlägt beide Basiswerte. Das ist die Grundlage des häufigsten
  Gatter-Musters der Kataloge: die **geteilte** Definition trägt `hidden="true"` plus einen bedingten
  `set hidden="false"`, und jeder `entryLink` auf sie trägt (wie Battlescribe es immer schreibt)
  `hidden="false"`. Würde das `hidden="false"` des Verweises dem Ziel vorgehen, wäre das Gatter
  wirkungslos — belegt an den DE-Katalogen des Repos: 63 der 72 geteilten Definitionen mit
  `hidden="true"` gattern genau so (gezählt werden die *direkten* Kinder von
  `<sharedSelectionEntries>` / `<sharedSelectionEntryGroups>` mit `hidden="true"`, verschachtelte
  nicht, und davon die, deren eigene Spanne einen `<modifier field="hidden" value="false">` trägt;
  der Aufdeck-Modifikator steht dabei mal in `<modifiers>`,
  mal in einem bedingten `<modifierGroup>` — siehe den Fallstrick-Kasten in §7.7), und
  **kein** `entryLink` (0 von 5542) lässt das Attribut weg.
  *Projektentscheidung, keine Quellenaussage:* weder XSD noch BSData-Wiki legen die Komposition
  fest; sie ist aus den Daten erschlossen (Issue 0135, nimmt die gegenteilige Hälfte von Issue 0099
  zurück).
- **Eine versteckte `selectionEntryGroup` versteckt, was sie hält.** Die Gruppe ist der einzige Ort,
  an dem ihre Member dem Nutzer angeboten werden — ist sie „not visible to the user"
  ([BSData-Wiki, *Props: Hidden*](../../bsdata-catalogue-development-wiki/Data-structure-overview.md)), ist
  es keine ihrer Optionen. Verschachtelte Gruppen wirken kumulativ, und ein `hidden`-Modifier an der
  Gruppe deckt ihre Optionen wieder mit auf. Kataloge verlassen sich darauf: die Rüstungsgruppe des
  Vampirs (`66f2-d6a1-420c-5a39`) ist `hidden="true"` und wird nur für die Blutlinien Blood Dragon
  und Von Carstein aufgedeckt — ihre Member (`Heavy Armour`, `Light Armour`) tragen selbst kein
  `hidden` (Issue 0132/0135).
- **Laufzeit-dynamische Kategoriezugehörigkeit.** Die Kategorie-Links eines Eintrags sind nicht
  zwingend statisch: Modifier mit `type="add"`/`type="remove"` und `field="category"` fügen eine
  Kategoriezugehörigkeit bedingt hinzu bzw. entfernen sie, und `type="set-primary"`/`type="unset-primary"`
  schalten das `primary`-Flag eines Kategorie-Links kontextabhängig um. **`set-primary` sichert
  dabei zugleich die Mitgliedschaft** (Projektentscheidung, Issue 0100): die benannte Kategorie
  wird Teil der effektiven Kategorien, auch wenn der Eintrag sie nicht per `categoryLink` führt.
  Andernfalls bliebe der Modifier wirkungslos, sobald er — wie real üblich — eine Kategorie
  benennt, in die der Eintrag erst umgegliedert werden soll: `'Kathleen' Halftank`
  (`Ogre Kingdoms`) trägt einen unbedingten `set-primary` auf „Regiment of Renown" **ohne**
  begleitendes `add category`, und die Einheit *ist* ein Regiment of Renown. `unset-primary`
  löscht dagegen nur das Flag; die Mitgliedschaft bleibt, denn zählrelevant ist allein sie. **Sämtliche** kategorie-abhängige
  Logik muss deshalb die **effektiven** (nach Modifier-Anwendung gültigen) Kategorie-Links auswerten, nicht
  die rohen Katalog-Links — sowohl die Zähler-/Validierungs-Logik (im Evaluator,
  `effectiveState.js`) als auch die **UI-Einsortierung** (Aushebe-Dialog,
  Sektions-Sichtbarkeit, armeeweite Selektoren; via `getEffectiveEntryCategoryLinks` /
  `isEntryPrimaryInCategory`; beide lesen heute den Bericht, `capability.categoryIds` /
  `capability.primaryCategoryId`, ADR-0034). Ein häufiger Fall: ein Katalog importiert
  per `entryLink` eine Einheit aus einem verlinkten Bibliothekskatalog und gliedert sie per `set-primary`
  in eine eigene Kategorie um — würde nur der statische Link gelesen, verschwände die Einheit aus der UI.
- Beziehungen zwischen Einträgen und Kategorien werden **ausschließlich über `categoryLinks`/IDs**
  aufgelöst — nie über Namen.

Von der „keine hartkodierten Sprach-Strings"-Regel gibt es **keine Ausnahme**.
