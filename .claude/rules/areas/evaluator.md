---
paths:
  - "src/domain/evaluator/**"
  - "docs/testing/**"
---

# Evaluator (Reinraum)

The clean-room rule engine: `evaluate(catalog, roster) → report`, a pure function and the only
production engine. `docs/battlescribe-data-format.md` is the canonical source for what the data
means; it outranks the ADRs where the two disagree.

- `src/domain/evaluator/evaluator.js` is the **only** legal entry point from outside. Importing any other
  file from outside the folder fails `forge-lint` (dependency-cruiser `evaluator-nur-ueber-fassade`,
  oxlint `no-restricted-imports`) — an `error`, not a warning.
- The folder must not import `src/domain/roster/**`, and `src/domain/roster/**` must not import it. Both
  directions are blocking rules. The bridge is `src/domain/evaluation/rosterAdapter.js`.
- The folder sits in the **Fachlogik layer** of ADR 0037 (`UI → Fachlogik → Daten`). It never
  reaches back into the UI and never imports `src/ui/i18n/` — the report carries ids, the UI
  translates them (dependency-cruiser `fachlogik-kein-rueckgriff`, `keine-i18n-unter-ui`). The
  Reinraum rules above are unaffected by that layering and stay stricter.
- `catalogReader.js` is the evaluator's own XML reader, deliberately separate from
  `src/data/parser/xmlParser.js`. Changing one never implies changing the other.
- A change confined to this folder only needs `forge-test --run src/domain/evaluator` — that covers the
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
- `raiseCosts` and `raiseMembers` are **one** walk (`costProjection.js`,
  `mandatoryMemberDefsOf` in `evalTree.js`): the price of raising a slot and the children raising
  it creates. Two shapes make a child mandatory and they are exclusive per group — an itemised
  member (its **own** parent-scoped MIN, and only inside a group that carries one too) and, where
  no member of the group is obliged itemised, the group's own MIN filled by
  `defaultSelectionEntryId` (else the first member). A group without a MIN obliges nothing at all,
  a MIN inherited from a link's shared target obliges nothing either (`mandatoryMinLimitOf` reads
  `def.limits`, never `limitsOf`), and `isHidden` does not enter into it. Those three are not
  engine taste: they are the reading a recruit has always followed, and
  `src/domain/evaluation/recruitTree.frozenCorpus.test.js` pins the whole 208-unit corpus against the
  tree recruited before Issue 0157 moved the reading here. The write model reads exactly this
  (`src/domain/roster/selectionFactory.js`), so a change here changes what a recruit puts on the table —
  and that sweep fails first.
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
- `infoProjection.js` carries **one** lookup that is not structural: a slot with no rule element at
  all takes the description of the *equally* named rule of its own catalogue
  (`createNamedRuleRegistry`, own catalogue → game system → the rest; Issue 0173). Real books
  declare a magic item's text as an unlinked shared rule — four in the Vampire Counts book alone.
  The registry is built once per report from the dataset's `documents` (they reach `buildReport`
  as the `documents` extra, indexed by `sourceIdByDefId`); the fallback entry carries **no**
  `source`, since the rule hangs on no carrier of the slot. It belongs here and not in the UI:
  the detail block and the unit chips both read `capability.infoElements`, and a UI-side lookup
  reached only one of them.
- Report messages are projected to text elsewhere (`src/ui/i18n/violationMessages.js`); a new
  violation kind is only half-done inside this folder.
- The E2E fixture corpus `src/domain/evaluator/__fixtures__/whfb6-definitive/` is a **subset** of the 18
  Definitive-Edition books. A scenario for an army whose `.cat` is missing cannot be written until
  the book is added — check the folder listing before planning one.
- Fetch a missing book verbatim from the commit the fixture README pins, never from `main` and
  never hand-edited:
  `curl -sSL -o "src/domain/evaluator/__fixtures__/whfb6-definitive/<Book> (6th definitive edition).cat" \
  "https://raw.githubusercontent.com/artkoenig/Warhammer-Fantasy-Battles-6th-Definitive-edition/<pinned-commit>/<Book>%20(6th%20definitive%20edition).cat"`
  The exact file name and casing come from the repo's own tree — a wrong case returns a 14-byte
  "404: Not Found" body with HTTP 200 via the raw host, which looks like a successful download.
- Adding a book makes `src/domain/evaluator/__fixtures__/whfb6-definitive/README.md` stale: it states the
  count of books present, which of them are there and why. Update it in the same commit.
- Adding a book also breaks every **frozen corpus figure**, in four places that must move with it
  (measured: one book broke 18 assertions): `scripts/lib/evaluator-coverage-corpus.test.js`
  (file count, the seven per-kind tag totals, landmark occurrence counts, the per-file
  "owns this cell alone" claims), `src/domain/evaluator/evaluator.corpusLinkLocalChildren.test.js`
  (per-file table, totals, contributing-file count), and the suite docs
  `scripts/lib/CLAUDE.md` + the fixture README. Run the **full** `forge-test` for such a change —
  `--run src/domain/evaluator` misses the `scripts/lib` half.
- A "no other file carries this cell" claim is an argument about the **coverage set**, not about
  whatever happens to lie in the folder: a book added for a single scenario is excluded from the
  comparison rather than the claim being deleted.
- `docs/testing/worklist.json` / `covered-cells.json` only move when a book brings a **new cell
  key**; more occurrences of known cells leave them untouched. Check before assuming a
  regeneration is due.
