---
status: backlog
branch:
pr:
---

# Documentation corrections found while verifying the DDD review

## Goal

The verification pass over [`docs/ddd-review-2026-08.md`](../ddd-review-2026-08.md) turned up
statements in the project's own documentation that are **wrong today**, independent of any of its
findings and independent of whether those findings are ever implemented. They are collected here
because none of them is worth an issue alone and each is a one-to-three-line edit. Two of the
review's own "observations" resolve into this issue rather than into work: both were verified and
neither deserves a change to the code.

**1. `rosterSelectionFactory.js` is described as something it is not.**
`docs/project-map.md:71` and `.claude/rules/areas/roster.md` both list
`src/contexts/armylist/application/rosterSelectionFactory.js` among the write use cases and assert of
them: *"Each is a plain function from roster to roster; `system` and the report's `slots` are handed
in (ADR-0039)."* It is neither. Its three exports are two Roster queries (`catalogueIdOfForce`,
`catalogueIdContaining`) and a four-line currying helper over the real factory in
`model/selectionFactory.js`. Nothing is handed in to it: `resolveEntry` is a static import from
`../model/index.js` and `system` is an ordinary parameter — the file has zero application-layer
dependencies. Name it separately as the shared binding of the model's selection factory plus two
roster catalogue-id queries.

*(Observation A of the review, resolved: no move. The file is 53 lines with 3 commits, breaks no
rule, creates no cycle, and no gate can hold the fix — cast has no vocabulary for "a query belongs in
`model/`, a command in `application/`". ADR-0037's own driver applies: "Kein Umbau um seiner selbst
willen". If it ever moves it should ride on issue 0198, which already opens all three importers; the
recipe is recorded there.)*

**2. `.claude/rules/areas/application.md` does not state its own discriminator.** Five other modules
in `application/` also import nothing but `../model/*` and stay there because they are use cases —
commands from roster to roster. That is the real rule and it is unwritten, which is how a query ended
up in the command folder. Add one line: *"`application/` holds use cases — commands from roster to
roster. A pure query over the Roster aggregate belongs in `model/`, even when its only caller is a
use case."*

**3. `.claude/rules/areas/evaluator.md` says nothing about file size, and a future reader will look
there.** The review claimed the engine "has no size discipline" and proposed splitting
`catalogReader.js` along a read/merge/resolve seam. That proposal is **void**: `catalogReader.js` has
exactly one export (`parseCatalogue:1273`) over 58 helpers, and the split already exists as
`datasetPreparation.js` + `catalogSet.js` + `resolver.js` — `datasetPreparation.js:2-4` names it
verbatim. `report.js` (916) and `resolver.js` (825) likewise export one function each; line count
measures the problem's size, not the module's. Record the position instead of opening work: line
count is not this folder's metric, export count is; and the one genuine grab bag is `evalTree.js`
(1 475 lines, **16** unrelated exports, and at 29 commits in eight weeks the most-edited non-UI file
in `src/`), whose named seam — to be taken when it next resists a change, not before — is the five
traversal generators plus `pathOf` at `:1400-1475`.

*(Observation B of the review, resolved: no issue. Cutting the repo's hottest file for tidiness is
maximum merge exposure for zero runtime, and a "soft ceiling" is unenforceable — `forge-lint` has no
line-count check.)*

**4. `docs/ddd-review-2026-08.md` itself carries claims the verification disproved** and must not
stand as written: the share is 38.4 % rather than 39 % (its table omits `evaluator.js` at 479 lines
and `main.jsx` at 95) and the basis is JS/JSX only; the `catalogReader.js` sentence above; "the
review's own measure" in T5, which cast cannot express; the four T7 invariants of which one survives;
"six UI modules" in T1, which is eleven with a third answer; and "no second deletion path exists" for
T4. Correct them in place rather than leaving a document that reads as verified when it is not.

**5. The language rule contradicts the practice.** `.claude/rules/areas/docs.md:10` says *"Doku,
Issues und Commit-Nachrichten sind deutsch, Code und Bezeichner englisch."* But `docs/glossary.md`,
`docs/project-map.md`, `README.md`, both DDD reviews and every issue from 0186 onwards are English,
and the session rules say English for every file. Two agents were caught by this and drafted
differently because of it. Decide it once and make the rule say what is done — whichever way it goes.

**6. `docs/adr/0002-data-flow-and-indexeddb-storage.md:30`** names
`src/domain/evaluation/useEvaluation.js`, a path two renames out of date. ADRs are not rewritten, but
a stale *path* in one is a defect rather than a decision; correct the path, leave the decision.

No code change. No version bump — documentation is neither a fix nor a feature.

## Acceptance criteria

- AC1: Neither `docs/project-map.md` nor `.claude/rules/areas/roster.md` calls `rosterSelectionFactory.js` a write use case or a roster-to-roster function. | verify: `bash -c '! grep -n "rosterSelectionFactory" docs/project-map.md .claude/rules/areas/roster.md | grep -qi "use case\|roster to roster"'`
- AC2: `.claude/rules/areas/application.md` states the use-case/query discriminator. | verify: `bash -c 'grep -qi "query over the Roster aggregate\|Abfrage" .claude/rules/areas/application.md'`
- AC3: `.claude/rules/areas/evaluator.md` records the export-count-not-line-count position, names the existing read/merge/resolve split so it is not proposed again, and names `evalTree.js` as the exception with its seam. | verify: `bash -c 'grep -q "datasetPreparation" .claude/rules/areas/evaluator.md && grep -q "evalTree" .claude/rules/areas/evaluator.md'`
- AC4: `docs/ddd-review-2026-08.md` states 38.4 % on a named basis and no longer claims the `catalogReader.js` split, the cast `react` rule, four violable roster invariants, six cost-type modules or a second roster-deletion path. | verify: `bash -c 'grep -q "38.4" docs/ddd-review-2026-08.md && ! grep -q "does two jobs (read, then merge and resolve)" docs/ddd-review-2026-08.md'`
- AC5: Every finding in the review names the issue that carries it, so the document and the tracker cannot drift apart. | verify: `bash -c 'test "$(grep -coE "019[3-9]|020[0-2]" docs/ddd-review-2026-08.md)" -ge 8'`
- AC6: `.claude/rules/areas/docs.md` states the language actually used, and no other rule file contradicts it. | verify: `bash -c 'grep -n "deutsch\|German\|English" .claude/rules/areas/docs.md'` — read the result, it must match the tree
- AC7: `docs/adr/0002-…md:30` names a path that exists. | verify: `bash -c '! grep -q "src/domain/evaluation" docs/adr/0002-data-flow-and-indexeddb-storage.md'`
- AC8: Every relative link in the touched documents resolves. | verify: `bash -c 'cd docs && grep -ohrE "\]\([^)#]+\.md\)" project-map.md ddd-review-2026-08.md | tr -d "])" | sed "s/^(//" | while read -r p; do [ -e "$p" ] || [ -e "../$p" ] || exit 1; done'`
- AC9: No file outside `docs/` and `.claude/rules/` changed. | verify: `bash -c 'test -z "$(git diff --name-only main... | grep -vE "^(docs/|\.claude/rules/)")"'`
- AC10: The gates stay green. | verify: `bash -c 'forge-lint && forge-typecheck && forge-test'`

## Out of scope

- Moving `rosterSelectionFactory.js`. Recorded as a recipe in issue 0198, to be taken there or not
  at all.
- Splitting any engine file, including `evalTree.js`. The note says when, not now.
- `docs/glossary.md:12-13` mis-attributing "`ui` is a bounded context" to ADR-0042 — that is issue
  0196 (AC10), which needs the context map to point at.
- `docs/battlescribe-data-format.md:170` claiming cost types are `.gst`/library only — issue 0195
  (AC14), where the evidence lives.
- Any ADR decision, status or content beyond the one stale path in ADR-0002.
- Rewriting historic issue files under `docs/issues/`. They are a record.

## Open questions

1. **German or English for documentation, issues and commit messages?** The rule says one thing and
   every recent file does the other. This issue writes down whatever is decided; it does not decide
   it. If the answer is German, the scope grows considerably and that should become its own issue
   rather than riding along here.
2. Is correcting a stale *path* inside an accepted ADR acceptable, or are ADRs immutable once
   accepted? If the latter, drop AC7 and note the path in the project map instead.
