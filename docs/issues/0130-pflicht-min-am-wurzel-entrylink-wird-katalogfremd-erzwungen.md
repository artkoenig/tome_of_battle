---
status: done
branch: claude/army-bulls-non-oger-list-h79w6u
pr: https://github.com/artkoenig/tome_of_battle/pull/185
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

- **Herkunft & präzisierte Ursache** (Default, eigene Untersuchung der echten
  Fixture-Daten unter `src/evaluator/__fixtures__/whfb6-definitive/`, nicht
  nur der bisherigen Issue-Logs): `Vampire Counts (6th definitive
  edition).cat` und `Orcs and goblins (6th definitive edition).cat` deklarieren
  **je einen eigenen** Wurzel-`entryLink` namens „Ogre Bulls" (Ids
  `21f4-c979-396b-c02a` bzw. `0612-9f28-e986-2bce`), die auf **dasselbe**
  geteilte Ziel `7754-8b3d-df99-d2d5` zeigen wie Ogre Kingdoms' eigener
  „Ogre Bulls"-Link (`d82e-111e-89b9-2be1`) — dasselbe Idiom wie Rhinox
  Riders/Maneaters (jede Armee bietet die geteilte Mercenaries-Einheit über
  einen eigenen Link an). Entscheidend: **nur** der Ogre-Kingdoms-Link trägt
  eine eigene Pflicht-`min`-Constraint (`32ed-26da-3f27-5c04`, `scope=force`,
  Basis 0, per Modifier auf 1 angehoben, gegated auf `notInstanceOf`
  Kontingent „Ironskin Tribe" `8711-ed16-2a44-7251`); die Links aus Vampire
  Counts und Orcs and Goblins tragen **keine** eigene Constraint.
- **Präzisierter Fix-Ort** (Default, aus obiger Untersuchung): Das
  Pflicht-Phantom in `synthesizeMandatoryPhantoms`
  (`src/evaluator/evalTree.js`, ROSTER-Zweig ~Z. 455–463, FORCE-Zweig
  ~Z. 473–482) hängt an der **eigenen** `def.id` des deklarierenden Links
  (`d82e-111e-89b9-2be1`), nicht am geteilten Ziel. Der unbedingte
  `def.kind === DefinitionKind.ENTRY_LINK`-Bypass von `isInCatalogueScope`
  (aus Issue 0098) lässt dieses Phantom deshalb für **jedes** Kontingent im
  Datensatz feuern, unabhängig vom Katalog. Der Fix entfernt den Bypass **nur**
  im Pflicht-Phantom-Pfad (`evalTree.js`) — **nicht** in `offer.js`s eigenem
  `ENTRY_LINK`-Bypass, der für das reine Angebot (Rhinox Riders/Maneaters/
  Manbiters, alle ohne eigene Pflicht-Constraint) unverändert katalogfremd
  bleiben muss. `sourceIdByDefId` bildet `d82e-111e-89b9-2be1` auf Ogre
  Kingdoms' eigene Katalog-Id (`731d-5b13-2a92-5427`) ab — `isInCatalogueScope`
  greift damit nur noch für Kontingente, deren Katalog-Fußabdruck Ogre
  Kingdoms enthält.
- **Bestehende Tests geprüft, keine Kollision** (Default, eigene Verifikation):
  `crossCatalog.rootEntryScope.test.js` (Issue 0098) deckt nur
  `selectionEntry`/`forceEntry`/`CATEGORY`-Skopierung ab, nie `entryLink`.
  `rootEntryLinkMandatory*.test.js` (Issue 0085) nutzen ausnahmslos
  Ein-Katalog-Datensätze, wo Eigen-Skopus unabhängig vom Fix immer zutrifft.
  Kein bestehender Test pinnt das alte katalogfremde Verhalten für die eigene
  Pflicht-Constraint eines Wurzel-`entryLink` fest.
- **Nächster Schritt** (Default): E2E-`.ros`-Szenario wird an den
  `e2e-testcase-author`-Subagenten delegiert (CLAUDE.md-Pflicht für
  Evaluator-E2E-Fälle), danach der `evalTree.js`-Fix umgesetzt, bis das
  Szenario grün ist.
- **Kein Versions-Bump** (Antwort des Menschen, 2026-07-31): Der Fix ist zwar
  nutzersichtbar (die Phantom-Pflichtmeldung feuert nicht mehr fälschlich in
  armeefremden Listen), und nach CLAUDE.md wäre ein Patch-Bump
  1.9.3 → 1.9.4 vorzuschlagen gewesen. Auf die Nachfrage hin hat der Mensch
  entschieden: **keine Versionsupdates**. `package.json` bleibt bei 1.9.3;
  `scripts/release.js` wird für dieses Issue nicht ausgeführt.

## Log

- 2026-08-12 — Closed: the fix and its scenario are in `main` (PR #185). The
  unconditional `ENTRY_LINK` bypass is gone from `synthesizeMandatoryPhantoms`
  (`src/evaluator/evalTree.js:510-536`), `docs/testing/root-entrylink-mandatory-catalogue-scope`
  exists with its four rosters, and `src/evaluator/evaluator.ergofangForeignMandates.test.js`
  additionally pins the reported case on real data: an empty Vampire Counts
  contingent reports only the game system's two mandates, never Ogre Kingdoms'
  "needs a Bulls". The status line was simply never flipped.

- **Szenario-Autorenschaft:** `e2e-testcase-author` (black-box, nur
  Katalog-XML) angesetzt für `root-entrylink-mandatory-catalogue-scope`. Der
  Agent leitete unabhängig dieselbe Struktur her, die schon oben unter
  Decisions steht: Ogre Kingdoms' eigener Wurzel-`entryLink` „Ogre Bulls"
  (`d82e-111e-89b9-2be1`, Constraint `32ed-26da-3f27-5c04`) gegenüber Vampire
  Counts' und Orcs and Goblins' je eigenen, constraint-losen Links auf
  dasselbe geteilte Mercenaries-Ziel. Ergebnis:
  `docs/testing/root-entrylink-mandatory-catalogue-scope/` (4 Roster,
  `README.md`, `scenario.json`) sowie die Pflege-Aktualisierung von
  `docs/testkatalog-evaluator-e2e.md`.
- `npm install` war zuerst nötig (kein `node_modules` in dieser Session).
- **Zuerst rot reproduziert:** `npx vitest run
  src/evaluator/e2e.testcatalog.test.js -t
  "root-entrylink-mandatory-catalogue-scope"` → 2 fehlgeschlagen / 2 bestanden.
  Roster 01 (Ogre, ohne Bulls) und 02 (Ogre, mit Bulls) bestanden bereits (die
  vorbestehende, korrekte Ogre-Kingdoms-eigene Erzwingung aus Issue 62/0085).
  Roster 03 (Vampire Counts) und 04 (Orcs and Goblins) schlugen fehl — der Bug
  reproduzierte exakt wie diagnostiziert: das Pflicht-Phantom feuerte für
  Kontingente aus fremden Armeebüchern.
- **Fix umgesetzt** in `src/evaluator/evalTree.js`,
  `synthesizeMandatoryPhantoms`: der unbedingte
  `def.kind === DefinitionKind.ENTRY_LINK`-Bypass von `isInCatalogueScope`
  wurde in beiden Schleifen (ROSTER- und FORCE-Rahmen, vormals ~Z. 458 und
  477) entfernt — die Pflicht-`min`-Constraint eines Wurzel-`entryLink` wird
  jetzt genau wie bei `ENTRY`/`FORCE` katalog-skopiert geprüft. `offer.js`s
  eigener, unbedingter `ENTRY_LINK`-Bypass in `candidatesFor` blieb
  unangetastet — der betrifft reines Angebot (Rhinox Riders/Maneaters/
  Manbiters-Idiom) und muss unbedingt bleiben. Der Kopfkommentar über
  `synthesizeMandatoryPhantoms` wurde auf die neue, engere Regel umgeschrieben
  und verweist auf Issue 0130.
- **Szenario erneut gelaufen:** alle 4 Roster grün.
- **Volle Evaluator-Suite:** `npx vitest run src/evaluator` → 68 Testdateien,
  864 Tests, alle bestanden, Exit 0. Keine Regression — insbesondere
  `rootEntryLinkMandatory*.test.js` (Issue 0085, Ein-Katalog-Datensätze) und
  `crossCatalog.rootEntryScope.test.js` (Issue 0098,
  `selectionEntry`/`forceEntry`/`CATEGORY`-Skopierung) blieben grün, ohne dass
  dort etwas geändert werden musste — Beleg, dass der engere Fix wirklich
  eng ist.
- `npm run lint` (oxlint) Exit 0. `npm run typecheck` (tsc --noEmit) Exit 0.
- **Umfang der Änderung:** ausschließlich `src/evaluator/evalTree.js`
  (Produktivcode) sowie
  `docs/testing/root-entrylink-mandatory-catalogue-scope/` und
  `docs/testkatalog-evaluator-e2e.md` (E2E-Testdaten/-Katalog) betroffen — laut
  CLAUDE.md genügt bei einer Änderung ausschließlich innerhalb
  `src/evaluator/` die Evaluator-Testebene; der volle `npm test` (inkl.
  Puppeteer-E2E unter `e2e/`) war nicht erforderlich und wurde nicht
  ausgeführt.

## Checkpoints

### Before implementation

- **Does this match what was asked?** Ja — die Akzeptanzkriterien verlangen
  genau das: Pflicht-`min` eines Wurzel-`entryLink` bleibt auf seinen
  deklarierenden Katalog skopiert (AC1/AC3), das Angebots-Idiom für
  `entryLink`s ohne Pflicht-`min` bleibt unangetastet (AC2), zuerst
  reproduziert (AC4), Suite grün (AC5).
- **Was hat überrascht?** Dass Vampire Counts und Orcs and Goblins bereits
  jeweils einen eigenen, constraint-losen Wurzel-`entryLink` auf genau
  dasselbe geteilte „Ogre Bulls"-Ziel wie Ogre Kingdoms deklarieren — der Bug
  ist also nicht "eine geteilte Definition leakt", sondern "die Constraint
  EINES bestimmten Katalogs an seinem eigenen Link wird unbedingt von jeder
  Skopierung ausgenommen, unabhängig vom deklarierenden Katalog".
- **Was nehme ich ungeprüft an?** Dass kein anderer realer Katalog im
  Fixture-Satz seine eigene Pflicht-`min` direkt an einem Wurzel-`entryLink`
  befestigt wie Ogre Kingdoms (nur für die vier whfb6-definitive-Fixtures im
  Repo verifiziert, nicht für BSData-Kataloge im Allgemeinen).

### Before the PR

- **Does this match what was asked?** Ja, alle 5 Akzeptanzkriterien erfüllt
  und verifiziert: AC1 (Roster 03/04 feuern nicht mehr), AC2 (`offer.js`
  unangetastet, `primary-catalogue-scope`-Szenario für Rhinox Riders/Maneaters
  blieb im vollen Suite-Lauf grün), AC3 (Roster 01/02 Regressionswache feuert/
  löscht weiterhin korrekt), AC4 (rot-vorher/grün-nachher über das neue
  Szenario belegt), AC5 (68 Dateien/864 Tests, Lint, Typecheck alle Exit 0).
- **Was hat überrascht?** Wie klein die eigentliche Code-Änderung ausfiel
  (zwei entfernte `||`-Klauseln), nachdem die wahre Ursache — das Phantom
  hängt an der eigenen `def.id` des deklarierenden Links, nicht am geteilten
  Ziel — einmal genau feststand.
- **Was nehme ich ungeprüft an?** Dass dies die einzige Stelle im Evaluator
  ist, an der `DefinitionKind.ENTRY_LINK` einen unbedingten
  Katalog-Scope-Bypass für einen *Pflicht*- (statt *Angebots*-)Pfad bekommt —
  `offer.js`s eigene `entryLink`-Ausnahme wurde geprüft und als andere, weiter
  korrekte Angelegenheit bestätigt (Angebot, keine Erzwingung), aber keine
  erschöpfende Suche nach jedem `ENTRY_LINK`-Sonderfall im gesamten Evaluator
  wurde über die zwei von dieser Untersuchung betroffenen Dateien
  (`evalTree.js`, `offer.js`) hinaus durchgeführt.

## Retro

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
