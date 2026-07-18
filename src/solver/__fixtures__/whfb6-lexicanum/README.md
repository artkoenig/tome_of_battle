# Fixture: WHFB6 Lexicanum Imperialis (Quirk-Anker)

Kleine, verbatim übernommene Auszüge aus dem neuen WHFB6-Datensatz
[lexicanum-imperialis/Warhammer-Fantasy-Battles-6th-Definitive-edition](https://github.com/lexicanum-imperialis/Warhammer-Fantasy-Battles-6th-Definitive-edition).
Sie verankern `src/solver/systemQuirks.test.js` in **echten** Katalogdaten der
neuen `gameSystemId` `0d13-7737-ea86-4662` (ADR-0017), statt in erfundenen IDs.

## Herkunft

- Quelle: Branch `master`, abgerufen am 2026-07-17.
- `quirk-anchors.gst.xml` — Verbatim-Auszug aus
  `Warhammer Fantasy Battles (6th definitive edition).gst`:
  die `gameSystem`-Wurzel, die `categoryEntry`-Definitionen **Heroes**
  (`c16b-f319-2c62-2c12`) und **Characters** (`7a1c-d611-c2dc-def1`) sowie der
  General-`selectionEntry` (`1b7c-2c90-6d96-28c9`), jeweils unverändert samt ihrer
  Constraints/Modifier. Nur die umschließenden Container-Elemente
  (`categoryEntries`, `sharedSelectionEntries`) wurden auf diese Einträge reduziert.
- `characters-max-force.cat.xml` — Verbatim-Auszug aus
  `Lizardmen (6th definitive edition).cat`: die reale `forceEntry` „Red Host",
  unverändert samt der Heroes- und Characters-`categoryLink`s.
- `vampire-selfscope-bloodline.cat.xml` — Reduzierter Verbatim-Auszug aus
  `Vampire Counts (6th definitive edition).cat` (abgerufen 2026-07-18): der reale
  „Vampire Count"-`selectionEntry` (`6822-0110-a7c9-cbb0`) mit seinem realen
  infoLink-Charakteristik-Modifier (WS +2), dessen `instanceOf`-Bedingung
  `scope` == der **eigenen** Entry-ID trägt (Selbst-Scope-Idiom), sowie dem
  realen `category-add`-Modifier, der die Blood-Dragon-Kategorie erst bei
  gewählter Blutlinie zuweist. Unbeteiligte Sub-Gruppen wurden entfernt und die
  Blutlinie als minimaler Upgrade-`selectionEntry` ergänzt (Details im Datei-Kopf).

## Wozu

Die Quirk-Funktionen (`getInheritedCategoryMaxSource`, `isQuirkGeneralEntryId`)
kodieren vier IDs des neuen Datensatzes fest. Der Test extrahiert dieselben IDs
aus diesen echten Auszügen und prüft, dass die Quirk-Funktionen sie korrekt
verdrahten. Driften die hartkodierten IDs von den realen Katalog-IDs ab, schlägt
der Test fehl.

`vampire-selfscope-bloodline.cat.xml` verankert
`src/solver/modifierEvaluator.selfScope.test.js`: Der Solver muss eine
`instanceOf`-Bedingung, deren `scope` die eigene Entry-ID ist, als Suche im
eigenen (Effektiv-Kategorie-)Teilbaum auswerten. Ohne diese Auswertung greift
der Blutlinien-Charakteristik-Modifier nie. Von den **422** `instanceOf`-
Bedingungen des echten Katalogs folgen **14** diesem Selbst-Scope-Muster,
verteilt auf drei Vampir-Charaktereinträge (Vampire Lord, Vampire Count,
Vampire Thrall); alle betreffen Blutlinien-Kategorien (Blood Dragon, Necrarch,
Strigoi).

`characters-max-force.cat.xml` belegt zusätzlich die strukturelle Voraussetzung
des `inheritedCategoryMax`-Quirks: Die **Characters**-`categoryLink` trägt einen
force-weiten `max`-Constraint (punkteskaliert über Modifier), die
**Heroes**-`categoryLink` trägt **keinen** eigenen `max`-Constraint — dieselbe
Konstellation wie in der alten Ergofarg-Quelle, weshalb der Quirk gültig bleibt.

## Validierungsbefund (Grundlage des Quirk-Eintrags)

Über **alle 18** Kataloge und die `.gst` des neuen Datensatzes geprüft:

- Die **Heroes**-`categoryLink` trägt in **keinem** Kontingent einen eigenen
  `max`-Constraint.
- Die **Characters**-`categoryLink` trägt nur in drei armeespezifischen
  Sonderkontingenten (Dwarfs 2001, Forces of Chaos, Lizardmen „Red Host") einen
  force-weiten `max`-Constraint.
- Jede Helden-Einheit ist zugleich der **Characters**-Kategorie zugeordnet
  (Heroes ⊆ Characters), daher liefert das Erben der Characters-Grenze für Heroes
  korrekte (nie falsch-positive) Ergebnisse.
- Der General-`selectionEntry` `1b7c-2c90-6d96-28c9` existiert unverändert unter
  dem Namen „General".

Ergebnis: Beide Werte des alten Quirk-Eintrags gelten für den neuen Datensatz
weiter; die category-/entry-IDs sind zwischen alter und neuer Quelle identisch.

## Update-Politik

Eingefroren. Diese Auszüge werden nicht automatisch mit dem Upstream-Repo oder
dem Katalog-Fork synchronisiert; sie dokumentieren den Stand, gegen den der
Quirk-Eintrag validiert wurde.
