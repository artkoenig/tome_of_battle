---
status: active
branch: claude/new-session-jnwa1m-0092
pr:
---

# Kategorie nur mit Max-Grenze wird nie ausgewertet

## Intent

`docs/battlescribe-data-format.md` §5.5/§5.6: Grenzen können direkt an der
`categoryEntry`-Definition hängen und gelten dann, ohne dass ein
`categoryLink` sie wiederholt — „Eine Auswertung, die nur
`categoryLink`-Grenzen liest, würde diese Limits still nicht durchsetzen."

Die Engine verankert Kategorie-Grenzen an zwei Stellen: Kategorie-Anker
entstehen nur für die `categoryLink`s einer Force
(`synthesizeForceCategoryAnchors`, `src/evaluator/evalTree.js:302`), und
Pflicht-Phantome nur für Definitionen mit **Min**-Grenze
(`hasMinLimitInFrame`, `evalTree.js:227`). Eine `categoryEntry`, die **nur
eine Max-Grenze** trägt und von keiner Force verlinkt ist, bekommt damit
keinerlei Anker — ihre Grenze wird still nie ausgewertet.

Repro (Audit 2026-07-28, gegen die echte Fassade): `categoryEntry` mit nur
`max=1 scope="roster" includeChildSelections="true"`, zwei Member im Roster →
0 Verstöße; Kontrolle mit zusätzlichem `min` → der Max-Verstoß erscheint
(huckepack auf dem Min-Phantom). Klassische „0–1"-Kodierungen (max ohne min)
sind genau dieses Muster.

Acceptance criteria:

1. Eine `categoryEntry` mit ausschließlich Max-Grenze(n) (`scope="roster"`
   oder `"force"`) wird auch dann ausgewertet, wenn keine Force sie per
   `categoryLink` führt: das Repro meldet Ist 2 gegen Grenze 1.
2. Min- und Max-Grenzen derselben Kategorie liefern unabhängig davon, ob die
   Kategorie zusätzlich verlinkt ist, dieselben Ergebnisse.
3. Es entstehen dadurch keine zusätzlichen Doppelmeldungen (Abgrenzung zu
   Issue 0093).
4. Die bestehende Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt.

## Plan

## Tasks

## Decisions

- **Default (unanswered, human asleep) — scenario pins vs. issue criteria:**
  `docs/testing/army-standard-bearer/scenario.json` pinned limit
  `2a1d-03a1-b48c-64ad` as `absent` in rosters 02/03/04, justified by a
  "Domänenkonvention" that on inspection records the engine limitation this
  issue fixes (the README itself says the limit should hold in-world).
  Decision: the issue's criteria (doc §5.5/§5.6) win; the
  `e2e-testcase-author` — owner of `docs/testing/` — re-derives the
  expectation from the catalog data alone, each changed pin individually
  justified. If the human disagrees, reverting the scenario commit restores
  the old pins.
- **Anchor design (final, after two fix loops — supersedes the first
  formulation, which review round 1 refuted):** unlinked category anchors
  are synthesized once per frame (roster: root; force: first force, since
  the target-type rule §7.7 lifts category targets army-wide), and each
  anchor carries a `limitScopeFilter` so it evaluates ONLY its frame's
  limits (`evaluableLimitsOf`, read by the constraint layer). Exclusions:
  a category linked by any force gets no own anchor at all; the ROSTER
  frame counts as covered by any unfiltered phantom of the definition
  anywhere in the tree (phantoms piggyback roster limits from any
  location); the FORCE frame only by a phantom actually under a force (a
  root phantom yields unresolvedScope there, not coverage).

- **Herkunft:** Intensiv-Audit der Reinraum-Engine gegen die BSData-Doku im
  Repo (2026-07-28), Fund mit ausgeführtem Repro gegen die echte Fassade.

## Log

- 2026-07-28 test-author:
  `src/evaluator/evalTree.unlinkedCategoryMax.test.js`, 10 tests — 5 RED
  (roster repro, force scope, empty-second-force edge, criterion-2 max-only
  equivalence, criterion-3 single-violation pin), 5 green pins/controls
  (0–1 satisfied case, min+max equivalence, linked max-only stays single,
  min-only phantom, min+max piggyback). Criterion-2 equivalence compares
  deduplicated (limitId, actual, bound) tuple sets — slot identity
  excluded, 0093's known min duplication not pinned either way. Force-scope
  ambiguity resolved by probing the min analogue (anchors per force); no
  open questions left.
- 2026-07-28 implementer: `synthesizeUnlinkedCategoryAnchors` in
  `evalTree.js` (+ docstring updates in `model.js`, `report.js`,
  architecture doc §3.2). 10/10 target tests green; lint/typecheck 0;
  puppeteer E2E green. BLOCKED on criterion 4: 3 pre-existing pins in
  `e2e.testcatalog.test.js` (scenario army-standard-bearer, limit `2a1d`
  "darf nicht feuern") fail — they pin the pre-fix behaviour; routed to
  the e2e-testcase-author per the Decisions default. Surprise recorded:
  the test-author's "min analogue anchors per force" probe note was
  misleading — the target-type rule makes any category anchor army-wide,
  so single-anchor is the only design their own empty-second-force test
  admits.
- 2026-07-28 e2e-testcase-author (black-box, data only): re-derived limit
  `2a1d` for rosters 02/03/04 of `army-standard-bearer` — fires 2/1, 2/1,
  1/0 (Border Patrols sets bound 0); scenario.json + README updated, the
  withdrawn "Domänenkonvention" documented as a former engine limitation.
  Flagged but out of scope: sibling parent-scope limit `6935` would
  plausibly fire in roster 03 under the same §5.5 reading — left pinned
  absent, marked "offener Punkt" in the README for the human. Full suite
  after the update: `npx vitest run` 211 files / 2153 tests, exit 0.
- 2026-07-28/29 review round 1 (fresh context): criteria 1/2/4 met,
  **criterion 3 violated** — mixed-scope limits on one unlinked category
  duplicated (roster-max twice + spurious unresolvedScope; min-roster twice
  with a force anchor present); "No double report possible" refuted. Plus
  doc finding (§3.2 pointer to wrong §, condition described too narrowly).
  Fix loop 1: test-author pinned 7 mixed-scope tests (5 red), implementer
  added the per-anchor frame cut (`limitScopeFilter`/`evaluableLimitsOf`,
  constraint layer reads it), doc fixed → 7/7 + 10/10, suite 2160 exit 0.
  Implementer flagged the mirror topology min-force + max-roster as still
  duplicating → fix loop 2: test-author pinned 3 tests (2 red), implementer
  corrected the roster-frame exclusion (any UNFILTERED phantom of the def
  anywhere covers the roster frame; force frame still only phantoms under a
  force) → 3/3, all 20 category tests green, suite 213 files / 2163 tests
  exit 0, lint/typecheck 0. Residual noted (pre-existing, not additional):
  a root phantom evaluating a cross-frame force limit still emits
  unresolvedScope — same before the change.

## Checkpoints

### Before implementation

- Does this match what was asked? Yes — anchor unlinked, max-only category
  definitions so their limits are evaluated; the min-phantom path shows the
  mechanism already exists for min limits.
- What surprised me? The asymmetry itself: `hasMinLimitInFrame` deliberately
  filters to min limits, so the fix is likely widening that predicate (or a
  sibling anchor source) rather than new machinery.
- What am I assuming without having verified it? That widening anchor
  synthesis to max-only categories does not double-report categories that
  ARE linked (criterion 3 — the interplay with force category anchors and
  with issue 0093's known min duplication needs care), and that the
  criterion-2 equivalence is observable through the existing report shape.
  The or-frame question (roster vs force scope for an unlinked category in
  a force frame) may hold edges the criteria do not decide — test-author
  should flag, not guess.

### Before the PR

- Does this match what was asked? Yes — all four criteria met after two fix
  loops; round 2 probed 12 topologies against the pre-change baseline and
  found no new duplicate; suite 213 files / 2163 tests exit 0, E2E and
  scenario runner green.
- What surprised me? Criterion 3 was the whole issue: the first "no double
  report possible" design duplicated in two mixed-scope topologies the
  original tests didn't cover. The per-frame limit filter plus asymmetric
  phantom-coverage rule is the design the tests finally admit. Also: an E2E
  scenario had pinned the bug as a "Domänenkonvention".
- What am I assuming without having verified it? That the human ratifies
  the scenario re-derivation (revert path recorded in Decisions) and the
  "offener Punkt" on sibling limit 6935/roster 03. No version bump:
  evaluator not wired to the UI (session precedent); measure-evaluator and
  knip exit 1 are pre-existing on origin/main, verified by the reviewer.

## Retro
