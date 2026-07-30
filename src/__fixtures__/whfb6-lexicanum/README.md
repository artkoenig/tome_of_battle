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
- `special-characters-hint.cat.xml` — Reduzierter Verbatim-Auszug aus
  `Bretonnia (6th definitive edition).cat` (abgerufen 2026-07-19): der reale
  „The Green Knight"-`selectionEntry` (`e9d1-eb9d-7c44-f777`) mit seinem realen
  `field="error"`-Hinweistext-Modifier („Please enable \"Allow special
  characters?\"", ausgelöst solange weniger als eine „Allow special
  characters?"-Auswahl im Kontingent liegt) und dem begleitenden `set`-Modifier
  auf sein roster-weites `max`-Limit. Der referenzierte Schalter (`8923-5946-7b10-8957`)
  lebt real im `.gst`-Katalog und ist hier als minimaler Upgrade-Eintrag ergänzt
  (Details im Datei-Kopf).
- `vampire-selfscope-bloodline.cat.xml` — Reduzierter Verbatim-Auszug aus
  `Vampire Counts (6th definitive edition).cat` (abgerufen 2026-07-18): der reale
  „Vampire Count"-`selectionEntry` (`6822-0110-a7c9-cbb0`) mit seinem realen
  infoLink-Charakteristik-Modifier (WS +2), dessen `instanceOf`-Bedingung
  `scope` == der **eigenen** Entry-ID trägt (Selbst-Scope-Idiom), sowie dem
  realen `category-add`-Modifier, der die Blood-Dragon-Kategorie erst bei
  gewählter Blutlinie zuweist. Unbeteiligte Sub-Gruppen wurden entfernt und die
  Blutlinie als minimaler Upgrade-`selectionEntry` ergänzt (Details im Datei-Kopf).
- `vampire-coast-force-limit.cat.xml` — Reduzierter Verbatim-Auszug aus
  `Vampire Counts (6th definitive edition).cat` (abgerufen 2026-07-19): die beiden
  realen Sonderheer-`forceEntry`s „Army of the Lichemaster (WD#309-UK)"
  (`f37a-a93e-fa22-61a8`) und „Vampire Coast (WD#306-UK)" (`bf46-ee85-7c10-ba98`),
  jeweils samt ihrer forceEntry-eigenen Punktelimit-`constraint`
  (`type="min" field="limit::ecfa-8486-4f6c-c249" scope="roster"`, Basis 0) und des
  eigengegateten `set`-Modifiers, der diese beim Wählen des Sonderheeres auf 2000
  anhebt. Nur die umschließenden Container wurden auf `forceEntries` reduziert.
- `empire-name-modifier.cat.xml` — Reduzierter Verbatim-Auszug aus
  `The Empire (6th definitive edition).cat` (abgerufen 2026-07-19): die beiden
  realen Kern-Einheiten „Halberdiers" (`569f-7be3-1aa2-004f`) und „Spearmen"
  (`1db9-88b7-80ef-40d5`) mit je einem realen `infoLink` auf das geteilte
  „Empire soldier"-Profil (`b777-4b66-0f67-d717`, ebenfalls real, aus
  `sharedProfiles`) samt dem unbedingten `type="set" field="name"`-Modifier, der
  den Profilnamen je Einheit umbenennt. Nur die umschließenden Container
  (`selectionEntries`, `sharedProfiles`) wurden auf diese Einträge reduziert.
- `dwarfs-traditional-army-multiply.cat.xml` — Reduzierter Verbatim-Auszug aus
  `Dwarfs (2001) (6th definitive edition).cat` (abgerufen 2026-07-19): der reale
  „Organ Gun"-`selectionEntry` (`79c9-6f85-479d-909a`) mit seinem realen
  `type="multiply"`-Kosten-Modifier („Traditional Army", DW1-AB S.53), der die
  pts-Kosten verdoppelt, sobald König Alrik Ranulfsson (`e4c5-f4d5-a169-aaa7`,
  auf id/name/costs reduziert) im Heer steht. Ein zweiter, unbeteiligter
  `hidden`-Modifier sowie `modifierGroups`/eigene `constraints` wurden entfernt.
- `ogre-bulls-mandatory-entrylink.cat.xml` — Reduzierter Verbatim-Auszug aus
  `Ogre Kingdoms (6th definitive edition).cat` (abgerufen 2026-07-23): der reale
  „Ogre Bulls"-**Wurzel-`entryLink`** (`d82e-111e-89b9-2be1`, targetId
  `7754-8b3d-df99-d2d5`) samt seiner realen `modifierGroups`, der force-scoped
  `min`-Constraint am Link (`32ed-26da-3f27-5c04`, Basis 0) und des `add category`-
  Modifiers, dazu die beiden realen `forceEntry`s „Standard (OK-AB)"
  (`729f-9246-5cd3-5044`) und „Ironskin Tribe (WD#309-UK)" (`8711-ed16-2a44-7251`)
  mit ihren `categoryLink`s sowie die `categoryEntry`s „Bully Bully"
  (`735e-2da1-6356-2fdb`) und „Core" (`64bf-efb4-9978-26df`). **Rekonstruiert**
  (nicht verbatim) ist allein das Ziel-`selectionEntry` `7754-8b3d-df99-d2d5`: die
  geteilte „Ogre Bulls"-Einheit lebt real in einem Library-Katalog außerhalb dieser
  `.cat` und ist hier als minimaler Kern-Unit-Eintrag nachgebildet, damit der Link
  aufgelöst und gezählt werden kann.

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

`special-characters-hint.cat.xml` verankert
`src/solver/rosterValidator.messageModifiers.test.js`: Der Solver muss einen
`field="error"/"warning"/"info"`-Modifier, dessen Bedingung zutrifft, als
Validierungseintrag mit dem passenden Schweregrad melden — `error` blockiert das
Spielen, `warning`/`info` erscheinen rein informativ. Über 17 Kataloge + `.gst`
tragen **163** solcher Hinweistext-Modifier reale Klartext-Hinweise an den Spieler.

`vampire-coast-force-limit.cat.xml` verankert
`src/solver/rosterValidator.forceEntryRosterLimit.test.js`: Der Validator muss die
forceEntry-eigene Punktelimit-Constraint eines gewählten Sonderheeres durchsetzen —
unter 2000 Punkten ungültig, ab 2000 gültig, ein normales Kontingent unberührt. Von
allen 18 Katalogen tragen ausschließlich diese **2** `forceEntry`s ein solches
eigenes `limit::<costTypeId>`-Muster.

`ogre-bulls-mandatory-entrylink.cat.xml` verankert
`src/solver/rosterValidator.mandatoryEntryLinkSelector.test.js`: Der Validator muss
einen armeeweiten Pflichtselektor auch dann erzwingen, wenn er als Wurzel-`entryLink`
(statt als Wurzel-`selectionEntry`) codiert ist. Die Pflicht steckt in der
force-scoped `min`-Constraint **am Link**, die der „Standard"-Modifier der Gruppe
(gegatet auf `notInstanceOf` Ironskin Tribe) von 0 auf 1 anhebt. Test: Standard-Armee
ohne Ogerbullen → blockierender `force-selector-min`; mit einer Ogerbullen-Einheit →
kein Verstoß; Ironskin-Tribe-Armee → kein Verstoß (der Link-min bleibt 0).

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
