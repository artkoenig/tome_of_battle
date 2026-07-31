---
status: backlog
branch:
pr:
---

# Pflicht-`min` am Wurzel-`entryLink` wird katalogfremd erzwungen (z. B. Ogerbullen in Nicht-Oger-Liste)

## Intent

Ein Nutzer meldet, dass die Pflicht-Meldung „The army still needs a 'Bulls'"
in einer **Nicht-Oger-Liste** erscheint (z. B. Vampire Counts, Orcs and
Goblins), obwohl diese Armee gar keine Ogerbullen führt oder führen kann.

**Ursachenkette (per Code-Lektüre und bestehender Issue-Historie ermittelt,
noch nicht mit eigener Repro/Test belegt):**

1. Issue 62 und dessen Child-Issue 01 (beide *resolved*) haben ermittelt,
   dass „Ogre Bulls" in der Definitive Edition als Wurzel-`entryLink` (nicht
   als `selectionEntry`) in `Ogre Kingdoms.cat` kodiert ist, mit einer
   force-skopierten `min`-Constraint (Basis 0, per Link-Modifier auf 1
   angehoben, gegated auf `notInstanceOf` des `forceEntry` „Ironskin Tribe").
2. Issue 0085 (*done*, PR #171) hat dafür gesorgt, dass ein solcher
   Wurzel-`entryLink` überhaupt ein Pflicht-Phantom erzeugt.
3. Issue 0098 (*done*, PR #183, bereits in `main`/im aktuellen Branch) hat
   Katalog-Scope-Filterung eingeführt, damit Wurzel-Einträge aus Katalog B
   nicht in ein Roster leaken, das nur Katalog A führt — **nimmt aber
   `DefinitionKind.ENTRY_LINK` (und `CATEGORY`) bewusst von dieser Filterung
   aus** (`src/evaluator/evalTree.js`, Zeilen ~458–460 und ~477–479:
   `def.kind === DefinitionKind.ENTRY_LINK || isInCatalogueScope(...)`). Die
   Ausnahme ist dokumentiert und begründet: reale Kataloge nutzen
   Wurzel-`entryLink`s legitim, um katalogfremde geteilte Einheiten jeder
   Armee anzubieten (z. B. „Mercenaries"/„Regiment of Renown" aus
   `Mercenaries.cat`), belegt über die echten E2E-Szenarien
   `offer-and-category-slots` (Regel OCS-R2) und `violation-classification`
   (Regel VCC-R11), die bei einer pauschalen Filterung brechen würden.

**Konsequenz:** Weil die Ogerbullen-Pflicht selbst über einen `entryLink`
kodiert ist, fällt sie unter dieselbe Ausnahme wie das legitime
Angebots-Idiom — das Pflicht-Phantom für „Ogre Bulls" ist **nicht**
katalog-skopiert und feuert für jedes Roster im selben Datensatz, das nicht
gerade die „Ironskin Tribe"-Variante der Oger ist, einschließlich völlig
armeefremder Listen (Vampire Counts, Orcs and Goblins), sobald
`Ogre Kingdoms.cat` Teil desselben geladenen Datensatzes ist — was der
Importer zulässt (mehrere `.cat`-Dateien eines Bundles gleichzeitig
auswählbar, siehe Issue 0098, Decisions).

Die Ausnahme in Issue 0098 wurde nur gegen Katalog-`entryLink`s **ohne**
Pflicht-`min` (reine Angebots-/MAX-Idiome) geprüft — ein Wurzel-`entryLink`
mit Pflicht-`min` wurde nie gegen die Katalog-Scope-Filterung getestet. Der
genaue Lösungsweg (z. B. eine feinere Unterscheidung zwischen
„Angebot" und „Pflicht-Erzwingung" bei `ENTRY_LINK`) ist hier bewusst offen
gelassen und gehört in `## Plan`/`## Decisions`.

Fund entstanden aus einer Chat-Untersuchung nach Nutzer-Meldung („in einer
nicht Oger-Liste sehe ich immer noch 'the army still needs a bulls'"),
bislang **nicht** mit eigener minimaler Fixture/Test reproduziert — das ist
Teil dieses Issues (Vorgehen „zuerst reproduzieren" wie bei Issue 62/0085).

Acceptance criteria:

1. Ein Wurzel-`entryLink` mit effektiver Pflicht-`min` (roster- oder
   force-skopiert), dessen deklarierender Katalog nicht zum
   Katalog-Fußabdruck eines gegebenen Rosters gehört, erzeugt in diesem
   Roster **keinen** Verstoß.
2. Das bestehende, als korrekt verifizierte katalogübergreifende
   Angebots-Idiom für Wurzel-`entryLink`s **ohne** Pflicht-`min` (z. B.
   Mercenaries/Regiment of Renown) bleibt unverändert funktionsfähig — die
   bestehenden E2E-Szenarien `offer-and-category-slots` (OCS-R2) und
   `violation-classification` (VCC-R11) bleiben grün.
3. Ein Wurzel-`entryLink` mit Pflicht-`min`, dessen deklarierender Katalog
   **zum** Katalog-Fußabdruck des Rosters gehört (z. B. eine echte
   Oger-Kingdoms-Liste ohne Bullen), meldet weiterhin korrekt den Verstoß —
   der Fix aus Issue 62/0085 wird nicht zurückgedreht.
4. Zuerst reproduziert: eine minimale Fixture/ein minimaler Test (oder die
   Wiederverwendung der echten Definitive-Edition-Daten Ogre Kingdoms +
   Vampire Counts) zeigt den Bug (heute: Verstoß feuert fälschlich in einem
   Nicht-Oger-Roster) vor dem Fix rot, danach grün.
5. Die bestehende Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt.

## Plan

## Tasks

## Decisions

## Log

## Checkpoints

### Before implementation

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
