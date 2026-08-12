---
status: done
branch: claude/evaluator-ergofang-daten-ni8js9
pr: https://github.com/artkoenig/tome_of_battle/pull/211
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

## Log

- 2026-08-12 — Closed: merged as PR #211 (`d7a313b`). The corpus now holds the
  seven definitive-edition books and `Dogs of War.cat`, and the campaign that
  measured against it closed at 130 of 130 cells. Bookkeeping only; the status
  line was never flipped.
