---
paths:
  - "src/evaluator/**"
  - "docs/testing/**"
---

# Evaluator (Reinraum)

The clean-room rule engine: `evaluate(catalog, roster) → report`, a pure function and the only
production engine. `docs/battlescribe-data-format.md` is the canonical source for what the data
means; it outranks the ADRs where the two disagree.

- `src/evaluator/evaluator.js` is the **only** legal entry point from outside. Importing any other
  file from outside the folder fails `forge-lint` (dependency-cruiser `evaluator-nur-ueber-fassade`,
  oxlint `no-restricted-imports`) — an `error`, not a warning.
- The folder must not import `src/roster/**`, and `src/roster/**` must not import it. Both
  directions are blocking rules. The bridge is `src/evaluation/rosterAdapter.js`.
- `catalogReader.js` is the evaluator's own XML reader, deliberately separate from
  `src/parser/xmlParser.js`. Changing one never implies changing the other.
- A change confined to this folder only needs `forge-test --run src/evaluator` — that covers the
  unit tests and the manifest-driven E2E runner (`e2e.testcatalog.test.js`, `crossCatalog.test.js`)
  over the scenarios in `docs/testing/`. The full suite is not required.
- New E2E scenarios under `docs/testing/` are **not** written here: they are delegated to the
  `e2e-testcase-author` subagent, which reads catalog data only and never the engine source
  (`.claude/agents/e2e-testcase-author.md`, ADR 0033). Writing one from the engine source makes the
  test mirror the bug instead of catching it.
- The tree is built in phases, and *when* an anchor may be synthesised follows from what the
  phase knows: phase 1 (`buildEvalTree`) sees only the roster's real nodes, phase 2
  (`attachOfferAnchors`, from `evaluator.js`'s post-pass) first answers "is this offered here at
  all?". A rule that depends on being offered belongs after phase 2 — anchors attached there must
  be handed to `extendBaseEffectiveState` alongside the offer anchors, or their bounds start from
  0 instead of the catalogue value.
- `catalogReader.js` does **not** normalise a modifier's `value`: it is the raw attribute string
  (`"1"`), while a constraint's `value` is already a number. A `repeat`'s `field` is a structured
  counted-field object, never an id — only `targetChildId` names an option (`null` for
  `childId="any"`). Anything that reads modifier/repeat data statically must parse for itself.
- A **static, catalogue-shaped** answer the UI needs (a group's single-choice/max-raisable
  behaviour, an option's repeatability, `groupBehavior.js`) belongs in the report next to the
  evaluated bounds, built once per report in `buildReport`'s capability context — not recomputed
  per slot, and never left to a component (ADR-0034). The same holds for an entry's own kind
  (`entryClassification.js`: `isListRule`, `isMandatoryListRule`, `isIndependentSubUnit`) — read
  it through link **and** target (`def.resolved`), since a link carries no `type` of its own.
- A definition's `children` also holds its `categoryLink`s (`catalogReader.js`,
  `readSelectionChildren`). "Has its own sub-choices" therefore has to filter
  `DefinitionKind.CATEGORY_LINK` out — an entry that merely declares a category otherwise counts
  as a container and silently loses `isMandatoryListRule`/`isIndependentSubUnit` (Issue 0157).
- A slot's origin decision (`isForeignCatalogue`) needs three things `buildReport` has no other
  way to know, and they travel as `extras`: `libraryCatalogueIds`, `gameSystemId` and
  `primaryCatalogueByForceDefId`. The force book of a slot is the one `forceCatalogueIdOf`
  answers — the same one the `primary-catalogue` frame reads. A root entry of a foreign book is
  normally filtered out of the tree already (Issue 0140); the report field is the second line for
  the shared-target competition of ADR-0032, so a fixture that wants a `true` here must build
  that case, not two plain books.
- Three rules pin what an unselected entry may report, and each has its own test guarding it:
  an offer anchor never produces a violation (ADR-0035/0036, `isReportableAnchorKind`), a shared
  entry is no root offer and synthesises no mandatory phantom from its own `min` (ADR-0032), and a
  mandatory obligation declared in a foreign army book never fires (`isInCatalogueScope`,
  Issue 0098). Any change to "which absence is reported" hits all three; check them before
  designing, not after the test run.
- A contingent is evaluated against **exactly** its army book, that book's transitive
  `catalogueLink` hull and the game system (`buildCatalogueScopeClosure`/`isInCatalogueScope`,
  Issue 0159, ADR-0032 addendum). No root `entryLink` exemption exists any more: a foreign book's
  link anchors nothing. Alongside it runs the narrower `buildRootImportClosure`/
  `isInRootImportScope` — only `catalogueLink`s with `importRootEntries="true"` — and **that** one
  gates root-level offers (`offer.js`) and the root definitions' mandatory phantoms
  (`synthesizeMandatoryPhantoms`). Shared entries, link targets and categories go through the full
  hull. Picking the wrong one of the two is the mistake here.
- Root-level offers are deduplicated by **target id** (`attachOfferAnchors`/`identityIdsOf` in
  `offer.js`), and the contingent's own book wins the tie. Several army books linking the same
  shared library entry therefore compete for one anchor, and the winner brings its own source and
  its own category modifiers. A bug of the shape "unit missing from one army's dialog" reproduces
  only with the **whole corpus** loaded — with two catalogues it looks correct.
- A synthetic multi-catalogue test fixture that expects a library entry to be offered must give
  the army book an explicit `catalogueLink` to that library (with `importRootEntries="true"` when
  the entry is a root entry). Merely passing the library as a source no longer reaches anything —
  that was the pre-0159 rule, and several UI tests encoded it.
- Effort has a budget: `node scripts/measure-evaluator.js` fails over 100 ms on real catalog data.
  A change that widens a traversal needs that number checked.
  `node scripts/measure-evaluator-browser.js` runs the same measurement in a real browser
  (Puppeteer) and shows how far jsdom's XML reader skews the jsdom figure.
- Report messages are projected to text elsewhere (`src/i18n/violationMessages.js`); a new
  violation kind is only half-done inside this folder.
- The E2E fixture corpus `src/evaluator/__fixtures__/whfb6-definitive/` is a **subset** of the 18
  Definitive-Edition books. A scenario for an army whose `.cat` is missing cannot be written until
  the book is added — check the folder listing before planning one.
- Fetch a missing book verbatim from the commit the fixture README pins, never from `main` and
  never hand-edited:
  `curl -sSL -o "src/evaluator/__fixtures__/whfb6-definitive/<Book> (6th definitive edition).cat" \
  "https://raw.githubusercontent.com/artkoenig/Warhammer-Fantasy-Battles-6th-Definitive-edition/<pinned-commit>/<Book>%20(6th%20definitive%20edition).cat"`
  The exact file name and casing come from the repo's own tree — a wrong case returns a 14-byte
  "404: Not Found" body with HTTP 200 via the raw host, which looks like a successful download.
- Adding a book makes `src/evaluator/__fixtures__/whfb6-definitive/README.md` stale: it states the
  count of books present, which of them are there and why. Update it in the same commit.
- Adding a book also breaks every **frozen corpus figure**, in four places that must move with it
  (measured: one book broke 18 assertions): `scripts/lib/evaluator-coverage-corpus.test.js`
  (file count, the seven per-kind tag totals, landmark occurrence counts, the per-file
  "owns this cell alone" claims), `src/evaluator/evaluator.corpusLinkLocalChildren.test.js`
  (per-file table, totals, contributing-file count), and the suite docs
  `scripts/lib/CLAUDE.md` + the fixture README. Run the **full** `forge-test` for such a change —
  `--run src/evaluator` misses the `scripts/lib` half.
- A "no other file carries this cell" claim is an argument about the **coverage set**, not about
  whatever happens to lie in the folder: a book added for a single scenario is excluded from the
  comparison rather than the claim being deleted.
- `docs/testing/worklist.json` / `covered-cells.json` only move when a book brings a **new cell
  key**; more occurrences of known cells leave them untouched. Check before assuming a
  regeneration is due.
