---
status: active
branch: claude/evaluator-ergofang-daten-ni8js9
pr:
---

# Extend the fixture corpus to every rule construct the upstream catalogues hold

## Goal

Bring the eight catalogue books that carry the rule constructs the frozen
corpus does not hold into the two fixture sets, so the evaluator coverage
campaign can pin them. This issue only moves the data and re-baselines the
bookkeeping; closing the cells is the campaign's work and out of scope here.

## Context

- The coverage campaign closed on 2026-08-11 with 105 of 105 cells covered, but
  the corpus it measured is 5 of 18 books of the definitive set and 3 of 16
  books of the ergofang set.
- Measured against both complete upstream repositories, the full definitive set
  holds 127 cells and the full ergofang set 55; together they hold 25 cells the
  campaign has not covered.
- Seven definitive books and one ergofang book carry all 25 of those cells. The
  remaining 26 books of the two repositories add no further cell — this is
  computed, not estimated, so the small set loses no coverage against the full
  data.
- The corpus directories are fixed in `scripts/lib/evaluator-coverage-corpus.js`
  as `CORPUS_DIRS`; a book is in the corpus exactly when it lies in one of them.

## Acceptance criteria

- Copy these seven files verbatim from
  `artkoenig/Warhammer-Fantasy-Battles-6th-Definitive-edition` at commit
  `4a558216aabea1719d15c8f45bf52b6ee0cd5e3e` into
  `src/evaluator/__fixtures__/whfb6-definitive/`:
  `The Empire`, `Bretonnia`, `Dark Elves`, `Dwarfs (2005)`, `Skaven`,
  `Lizardmen` and `Forces of Chaos` — each with its
  ` (6th definitive edition).cat` suffix. That commit is the one the fixture's
  README already pins, and the five files already in the directory are
  byte-identical to it.

- Copy `Dogs of War.cat` verbatim from
  `artkoenig/Warhammer-Fantasy-6th-edition` at commit
  `9c7203c94221a4a98d5c1ffcfcfaedafe7d6d233` into `src/__fixtures__/whfb6/`.

- Leave the nine files already in the two directories byte-identical, and
  change nothing else about them.

- Record the new provenance in both fixture READMEs. State in
  `src/__fixtures__/whfb6/README.md` that `Dogs of War.cat` comes from the
  current upstream head while the other three books predate the whitespace
  cleanup of issue 11, so the directory now carries two vintages. State in both
  READMEs why these books are there: they carry rule constructs no other book
  of their set carries.

- `node scripts/evaluator-coverage-inventory.js` reports 17 corpus files, 130
  cells, 105 covered and 25 uncovered, and exits 1. Commit the regenerated
  `docs/testing/worklist.json` with its 25 entries.

- `npx vitest run scripts/lib/evaluator-coverage-corpus.test.js` passes. Its
  baselines are written for the nine-file corpus and have to be recomputed
  from the extended corpus: the file counts of case 21 (17 in total, 12
  definitive and 5 in the other set), the per-kind occurrence totals of case
  22, the distinct `repeat|` cell count of R7 and the landmark occurrence
  counts of R8. Recompute each from the corpus itself; case 22's own comment
  names the `grep` that arbitrates a mismatch.

- Raise the `beforeAll` hook timeout of that test file. Parsing 17 files
  instead of 9 takes the hook past vitest's 10-second default, which fails the
  whole file before a single case runs.

- `npm test` passes. It includes the puppeteer app E2E, whose harness
  `scripts/lib/e2e-harness.js` zips every `.cat`/`.gst` of
  `src/__fixtures__/whfb6/`, so the app under test now ships one army book
  more. Fix any fallout in the app E2E rather than by keeping the book out.

- Take a screenshot of any app view whose content changed through the added
  book, and put it in the pull request.

## Out of scope

- Pinning or closing any of the 25 uncovered cells. Phase A of the campaign
  authors the scenarios and phase B changes the engine; both run after this
  issue lands.
- Any change under `docs/testing/` other than the regenerated `worklist.json`.
- Any change to production code under `src/`.
- Adding further books. Exactly these eight are required and sufficient.

## Decisions

- Only the eight named books enter the repository, not the two complete
  upstream sets. The remaining 26 books add no cell, and the smaller set keeps
  the corpus parse — which every inventory run and the drift guard pay for —
  as short as it can be.
- `Dogs of War.cat` has to come from the ergofang set: `childId="upgrade"`
  occurs three times there and nowhere in the definitive set, so its cell is
  unreachable without that book.
- The check commands for this issue are `npm test` and
  `node scripts/evaluator-coverage-inventory.js`.
- No version bump. Test fixtures change nothing a user can see.

## INC-4 — Re-baseline sweep report

### Method

Scope was established per claim by reproducing its original figure over the file
set that existed when the claim was written (git `8af0316` held exactly the five
old definitive files) and then re-measuring the identical rule over the enlarged
corpus (12 files in `src/evaluator/__fixtures__/whfb6-definitive/`, 5 in
`src/__fixtures__/whfb6/`). Every "Vorkommen der Zelle" figure comes from the
campaign's own extractor, `extractCells()` of `scripts/lib/evaluator-coverage-cells.js`
over `loadCorpus(CORPUS_DIRS)` of `scripts/lib/evaluator-coverage-corpus.js`. A
claim scoped to a scenario's own dataset (the catalogue files its `scenario.json`
loads) was checked but not edited: those datasets did not change.

### docs/evaluator-architecture.md

- **A1 — moved, edited.** §3.4 "Träger": "alle 101" characteristic modifiers on
  `<profile>` (30) or `<infoLink>` (71) and "keiner" on a `selectionEntry` →
  360 over the twelve definitive files (48 profile, 311 infoLink, 1
  selectionEntry); 366 over all seventeen (48 / 317 / 1). The design decision
  ("er trifft genau das Profil, an dem er steht") is unchanged; a marker
  sentence now records the single counter-case.
- **A2 — moved, edited.** §3.6: `{this}` at 7 sites → 13 sites, still the only
  token that occurs, every one a `modifier/@value` of a message modifier
  (`error` 9, `warning` 3, `info` 1).
- **A3 — moved, edited.** §3.6 info projection: "neun Info-Elemente
  `hidden="true"`" → 23 (2 profile, 17 infoLink, 3 rule, 1 infoGroup);
  "dreizehn `hidden`-Modifikatoren … an einem Profil oder Info-Verweis" → 39
  carried by an info element (2 profile, 33 infoLink, 3 rule, 1 infoGroup), 38
  over the twelve definitive files. Note: the old "dreizehn" does not reproduce
  under the "profile or infoLink" reading (that gave 15 in the old set); it
  reproduces only as the infoLink-only count, so the corrected sentence states
  the split explicitly. The base-hidden carrier re-shown by a conditional
  `set hidden=false` now holds 21 times (9 before), all conditional.
- **A4 — confirmed unchanged, no edit.** §3.2, the three Border-Patrols
  categories of the definitive `.gst` (`d36d-5455-9f4d-3100`,
  `f672-d9d4-a601-479a`, `942b-0309-8845-e11c`) still carry exactly one
  constraint each (`max`, `scope=parent`, `value=-1`), and none of the 64
  `forceEntry` elements in the corpus links them.
- **A5 — confirmed unchanged, no edit.** The "97–99,5 %" preparation share is
  measured by `scripts/measure-evaluator.js` / `-browser.js` over datasets named
  in the scenario manifests, so added books do not enter it.

### docs/testkatalog-evaluator-e2e.md

- **B1 — moved, edited.** "Datengrundlage": only `vampire-bloodlines-ergofang`
  was named as using `src/__fixtures__/whfb6/` → five scenarios do
  (`vampire-bloodlines-ergofang`, `category-id-scope-instance-of`,
  `decrement-cost-bloodline-casting-dice`,
  `parent-max-enchanted-items-per-bearer`, `roster-min-general-armywide`). The
  added books did not cause this one; it went stale as scenarios were added.
- **B2 — moved, edited.** `nested-modifier-group`: "nicht baubar — alle drei
  verschachtelten Fundstellen haben eine unbedingte äußere Klammer" → 14 outer
  brackets in the twelve definitive files (Vampire Counts 3, Lizardmen 3,
  Skaven 8), 16 over all seventeen, and two of them are conditional — both on
  the `selectionEntry` "Saurus Warriors" (`2258-e16e-24dd-6e85`, Lizardmen),
  gated `equalTo scope="force" childId="859a-ac18-878a-600b"`. The case is
  buildable now and deliberately not built here.
- **B3 — moved, edited.** `condition-group-not`: "das einzige reale Vorkommen im
  Datensatz" → two identical modifiers in this scenario's dataset (Heinrich
  Kemmler `595f-a4e4-5cbc-dab4`, Krell `2d17-c7be-5fd6-f1a3`) and four
  `conditionGroup type="not"` in the corpus (plus Lizardmen
  `56e7-0e42-990f-bbdf`, Skaven `2849-41f5-0ee5-0ad9`). All four carry exactly
  one member, so the "not group with more than one member" case stays
  unbuildable and the scenario's conclusion stands.
- **B4 — confirmed unchanged, no edit.** `position="-1"` still occurs exactly
  once in the whole corpus (Vampire Counts, the `append` on
  `f1e6-8816-26e0-8a70`).
- **B5 — confirmed unchanged, no edit.** `a59d-2ddb-429c-1aca` still occurs
  exactly twice over seventeen files, both as `modifier/@field` of a `set`
  modifier on a Vampire-Counts Lord `categoryLink`, and never as `id=`.
- **B6 — confirmed unchanged, no edit.** The cell
  `condition|atLeast|parent|selectionCount|child=any` still has 2 occurrences,
  both in the definitive Vampire Counts; `c791-87b9-b00a-ddb4` still occurs
  exactly once (its own definition) and no `entryLink` points at it.
- **B7 — confirmed unchanged, no edit.** Cell
  `condition|notInstanceOf|unit|selectionCount|child=id` still 2, both in the
  definitive Vampire Counts, both naming a category.
- **B8 — confirmed unchanged, no edit.** Cell `modifier|append|characteristic`
  still 2, both on profile `6484-4a1a-e62b-2ce1`.
- **B9 — confirmed unchanged, dataset-scoped, no edit.** The "Orc boyz" category
  as sole carrier in the dataset; "orc needs chariot" as sole carrier; "Bully
  Bully" without a `categoryLink` in the whole dataset; `ce6e-afde-2ed1-aac2`
  defined nowhere in the loaded dataset (still true for that dataset — see
  finding R13 for what the corpus now holds); `{this}` against the effective
  name not testable with these catalogue data (re-measured corpus-wide and still
  not buildable: of the 13 `{this}` modifiers exactly one sits on a carrier that
  also carries a `field="name"` modifier, the "0-1 Amazon Serpent Priestess" the
  document already names); the nested `forceEntry` case (re-measured
  corpus-wide: no `forceEntry` in the seventeen files is nested inside another,
  so it stays unbuildable); the lowering half not buildable on these catalogue
  data.
- **B10 — out of scope.** The overview table's totals (roster cases, scenario
  rows) count scenarios under `docs/testing/`, not fixture content, and were not
  verified in this sweep.

### docs/adr/0036-angebots-anker-als-blaetter-in-einer-zweiten-baumphase.md

- **C1 — moved, edited.** The "Negativ" bullet's absence claim ("Ein Fall dafür
  ist in den Fixture-Katalogen nicht belegt") → three attested cases, all against
  the `forceEntry` "War of Vengeance (DW1-AB)" (`d18e-88cd-44b8-f527`) of the
  added book Dwarfs (2005): the root `entryLink`s "Ruglud's Armoured Orcs"
  (`8a22-be92-5feb-16e8`, Orcs and goblins), "Mengil Manhide's Manflayers"
  (`bbaf-7b5e-6800-7d50`, Dark Elves) and "Tichi Huichi's Raiders"
  (`a532-46a4-3c3c-d689`, Lizardmen), each with an entirely unconditional
  `modifierGroup` doing `add category = Special` (`43cc-fc3f-35a7-8d03`) and
  `remove category = Rare`. Over the five old definitive files: 0 cases. The
  decision (Option 2, base categories) is unchanged; the ADR's own instruction
  to record such a case was followed.
- **C2 — confirmed unchanged, no edit.** The ADR's measurement table (node
  counts 23→139 / 49→319 / 42→304 and the millisecond figures) and the
  "99,1–99,5 %" share come from `scripts/measure-evaluator.js` over named
  datasets, which the added books do not enter.

### Findings reported, not acted on

1. **A1** — the enlarged corpus holds one characteristic modifier carried by a
   `selectionEntry` rather than by an info element ("Champion" in
   `Forces of Chaos (6th definitive edition).cat`, `increment value="1"
   field="6b9f-c8fe-8998-27e3"` under an `atLeast` condition, beside an
   identical modifier on the entry's own `infoLink` "Champion"
   `c735-563a-a91e-7513`). The architecture document's rule "der Knoten ist nie
   sein Träger" now has a counter-case in the data; the engine rule was not
   changed and the decision was not revised.
2. **B2** — the "inner condition holds, outer fails" case that
   `nested-modifier-group` calls unbuildable is buildable from Lizardmen's
   "Saurus Warriors". No scenario was authored.
3. **C1** — ADR 0036's base-category approximation now has an attested case;
   already recorded in the ADR itself as it instructs.

### docs/testing report — scenario README claims the enlarged corpus falsified

Not edited: these documents are frozen by ADR 0033 and the black-box authorship
boundary. Listed so the maintainer can commission the correction.

- **R1** `author-message-tokens/README.md:33` — "In allen fuenf Fixture-Dateien
  kommt `{this}` genau siebenmal vor" → twelve definitive files, 13 occurrences
  (added: Dark Elves 2, Dwarfs (2005) 2, Lizardmen 1, Skaven 1). Its neighbours
  `:120` ("kein unbekanntes Token") and `:140`/`:228` ("genau ein Fall mit
  `field=name`-Modifikator und `{this}`") were re-measured and still hold.
- **R2** `modifier-effective-name/README.md:75` — "`type="prepend"` … kein
  einziges Mal … 0 Treffer" → 5 occurrences, all `field="name"` (Dark Elves 1,
  Dwarfs (2005) 3, Skaven 1); the cell `modifier|prepend|name` is attested now
  and the declared gap is buildable from an added book.
  (`append-characteristic-zacharias-spell:192`, "prepend auf ein Merkmalsfeld",
  is still 0 and stands.)
- **R3** `category-id-scope-instance-of/README.md:147` — "`field="category"` hat
  im ganzen upstream-Satz 13 Treffer, davon 7 in `Ogre Kingdoms.cat` und 6 in
  `Orcs and Goblins.cat`" → 52 in that five-file set; `Dogs of War.cat` alone
  carries 39. Falsified by the book INC-1 added.
- **R4** `nested-modifier-group/README.md:54-70`, the whole "Datenlage" section —
  "5 Dateien, 86 `<modifierGroups>`-Elemente" → twelve definitive files with 262
  (272 corpus-wide); "genau dreimal direktes Kind eines `<modifierGroup>`" → 14
  in the definitive files, 16 corpus-wide; "an keiner Stelle folgt ihm
  `<conditions>`" → two outer brackets on Lizardmen's "Saurus Warriors" are
  conditional, so the gap this README declares is buildable (same finding as B2).
- **R5** `condition-group-not/README.md:203` — "beide Fundstellen tragen genau
  ein Mitglied" → four occurrences (Vampire Counts 2, Lizardmen 1, Skaven 1);
  each still carries exactly one member, so the conclusion stands and only the
  count is stale.
- **R6** `not-instance-of-force-gate/README.md:97` (NIF-R10) — "Die Zelle ist im
  Korpus neunfach belegt — vier im Ogre-Katalog, fünf im
  Vampire-Counts-Katalog" → 30 occurrences across nine books (cell
  `condition|notInstanceOf|force|selectionCount|child=id`).
- **R7** `at-least-self-model-count/README.md:36` — "Das Konstrukt kommt in den
  Fixture-Katalogen 32× vor (15× Orcs and goblins, …)" → 103 across ten books
  (cell `condition|atLeast|self|selectionCount|child=model`).
- **R8** `equal-to-force-toggle-count-gotrek/README.md:33` — "Diese Zelle kommt
  im ganzen Fixture-Korpus genau einmal vor" → 84 occurrences (cell
  `condition|equalTo|force|selectionCount|child=id`: Lizardmen 32, Skaven 18,
  The Empire 18, Dark Elves 12, Bretonnia 3, Mercenaries 1). Its `:35` "der fünf
  Dateien" is stale too, and Gotrek's id `ef9d-ae15-cc43-f2d6`, once unique to
  Mercenaries, now also occurs in Bretonnia, Dwarfs (2005) and The Empire, so
  EFTC-R1 ("nirgends legal wählbar") deserves the maintainer's re-check.
- **R9** `equal-to-ancestor-id-scope-mount-gate/README.md:231` — "die Suche nach
  `equalTo` mit Id-`scope` liefert im ganzen Korpus genau ein Vorkommen" → 6
  (cell `condition|equalTo|id|selectionCount|child=id`: The Empire 4,
  Bretonnia 1, Orcs and goblins 1). `:132` still says "Volltextsuche über die 5
  Fixture-Dateien" (now twelve), though the id `febe-2170-775b-0d13` it counts is
  unchanged at 2 in the definitive set; `:140`'s id `c3c3-a80c-e026-200f` now
  also occurs twice in Bretonnia.
- **R10** `at-least-roster-points-limit/README.md:155` — "Die weiteren
  Fundstellen desselben Konstrukts (30 in der `.gst`, 1 in `Mercenaries`, 1
  weitere in O&G)" → 37 occurrences (cell
  `condition|atLeast|roster|limitValue|child=any`); Bretonnia adds four.
- **R11** `instance-of-parent-sky-chariot-gate/README.md:343` — "Einziges
  weiteres parent-skopiertes `notInstanceOf` im Korpus
  (`Mercenaries (…).cat:4101`)" → a second one exists now in Forces of Chaos
  (cell `condition|notInstanceOf|parent|selectionCount|child=id`: 1 → 2).
- **R12** `ancestor-scope-instance-of/README.md:136` — "`410e-ed97-ecf8-cfa4`
  existiert **nirgends** im Datensatz (hängender Verweis)" → still true for that
  scenario's dataset, but the id now occurs four times in Bretonnia, so the
  sentence is false under a corpus-wide reading. Scope-dependent.
- **R13** `modifier-unresolved-target-inert/README.md:58-61` and `:200` — "Die
  einzigen Vorkommen der Id im gesamten Datensatz sind ihre eigenen vier
  Verweise" and "Ein zweites Vorkommen derselben Konstruktion gibt es im Korpus
  nicht" → `ce6e-afde-2ed1-aac2` now has nine hits: the four Orcs-and-goblins
  modifiers plus, in Bretonnia, one more `decrement` modifier on the same id and
  four `<cost name="Army Composition" typeId="ce6e-afde-2ed1-aac2" value="0"/>`
  elements. No file declares a `costType` with that id (the corpus holds ten
  `costType` elements and none is this one), so the scenario's conclusion — an
  unresolved target is inert — stands; what falls is its enumeration, and an
  independent counter-check at a second carrier is buildable now.
- **R14 — systematic staleness.** Seven scenario READMEs describe the definitive
  fixture directory as five files ("alle fünf Datendateien", "die 5
  Fixture-Dateien", "In allen fuenf Fixture-Dateien"): `author-message-tokens`,
  `append-characteristic-zacharias-spell`, `modifier-effective-name`,
  `equal-to-ancestor-id-scope-mount-gate`, `equal-to-force-toggle-count-gotrek`,
  `instance-of-parent-sky-chariot-gate`, `parent-max-include-child-selections`.
  It is twelve now.
- **R15 — flagged, not falsified.** `greater-than-parent-upgrade-gate/README.md:25-27`
  claims "die **einzigen beiden** `greaterThan`/`scope="parent"`-Modifier des
  Fixture-Korpus **ohne** `<repeats>`". Under a plain reading (distinct
  modifiers gated by such a condition and carrying no `<repeats>`) the
  population was already 20 in the nine-file corpus and is 140 now, so the claim
  reproduces under neither corpus; the maintainer has to re-derive the reading
  it meant.
- **R16 — confirmed unchanged**, named so the report reads as a check and not a
  sample: `at-least-parent-any-reveal` ALP-R9 (cell still 2,
  `c791-87b9-b00a-ddb4` still one hit, still unreferenced),
  `not-instance-of-unit-category-gate` NIUC-R5 (`017d-3857-a815-782f` still 6
  hits, `5c44-3a90-6b26-bc32` still 3, no category modifier names either),
  `not-instance-of-parent-ironskin-tribe` NIOP-R5 (`7ff5-9e55-c594-4b40` still
  exactly 3 hits, still no `categoryLink`),
  `append-characteristic-zacharias-spell` (position exactly once;
  append-on-characteristic still 2), `equal-to-force-points-limit-border-patrol`
  (`2066-082d-a465-4baf` still once; the `equalTo`/`scope="force"` budget cell
  still 1), `parent-max-include-child-selections` PMICS-R7 (both ids still only
  as `constraint id`), `parent-costsum-magic-items-budget`
  (`2dd3-546b-146e-ce63` still addressed by no modifier),
  `modifier-group-repeats` and `modifier-group-repeats-grave-markers` (the
  unconditional bracket with `<repeats>` is still the corpus's only one).

### Limit of the method

The README pass grepped every line of every `docs/testing/*/README.md` for
corpus-scope markers (Korpus, Fixture-Kataloge/-Dateien/-Satz/-Datensatz,
Volltextsuche, whfb6-definitive, nirgends, Treffer, Fundstelle, einzige, "alle
fünf") and machine-checked every catalogue id named on such a line against the
seven added definitive books and Dogs of War, plus a cell-level re-measurement
for every "Vorkommen der Zelle" claim. A claim that names no id, no cell and no
countable construct was read but cannot be machine-checked.
