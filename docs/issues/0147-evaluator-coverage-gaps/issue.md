---
status: active
branch: claude/evaluator-abschluss-kampagne-2bsuve
pr:
---

# Evaluator gaps pinned by the coverage campaign

## Goal

Close the last open cell of the evaluator coverage campaign. Unlike every
earlier round of this issue, this round is not driven by a red E2E scenario: the
construct it covers cannot be reached by any catalogue-admissible roster, so the
maintainer decided it is covered on the synthetic unit-test track under
`src/evaluator/` instead. Write that test, make it pass, and record the cell as
covered.

## Context

- The campaign's coverage bookkeeping lives in `docs/testing/worklist.json`
  (generated), `docs/testing/covered-cells.json` (the manual record) and
  `docs/testing/campaign-state.json` (the campaign driver's state).
- `node scripts/evaluator-coverage-inventory.js` regenerates the worklist from
  the corpus and the manual record. Exit code 1 means the worklist is not empty,
  exit 0 means every occurring cell is covered or waived, exit 2 is an
  operational failure.
- `npx vitest run src/evaluator` runs the evaluator suite including the
  manifest-driven E2E runner `src/evaluator/e2e.testcatalog.test.js`.

## Acceptance criteria

- The cell
  `repeat|selectionCount|parent|child=any|repeats=1|s=true|ics=false|icf=false|roundUp=false|pct=false`
  is covered by a new unit test under `src/evaluator/`, built on a synthetic
  dataset — not on a roster against the frozen corpus, because the only
  occurrence of the construct is unreachable there (see "The construct" below).

- The test pins the repetition semantics the construct demands, and each of
  these separately, so a single wrong reading cannot pass it:
  - The modifier is applied **once per `value` counted selections** of the
    repeat, so a frame count of 0, 1 and 2 must move the modified value by 0, 1
    and 2 applications. Cross at least two repetitions.
  - The counting frame of `scope="parent"` is the **selection that holds the
    carrier**, not the carrier itself and not a group.
  - `childId="any"` counts **any** selection in that frame, whatever entry it
    came from.
  - The carrier counts in its own frame. This is not a new decision: the green
    scenario `docs/testing/at-least-parent-any-reveal` pins it from real catalog
    data for the same scope/childId pair (rule ALP-R5 in its README, roster
    `04-wolf-lord-selected-self-reveal.ros`), and rule ALP-R2 there pins that
    with `includeChildSelections="false"` only the frame's direct children
    count. Carry both readings over to the repeat axis; do not invent a
    different one.
  - `field="selections"` counts the selection **quantities**, not the number of
    XML selection elements — a single child node with `number="2"` counts 2.

- `docs/testing/covered-cells.json` carries a new entry for that cell whose
  `evidence` names the new test file and whose `rationale` says why the cell is
  covered by a module test rather than by a scenario. The file's own `_comment`
  admits a module test as evidence; this is the first entry that uses it.

- `node scripts/evaluator-coverage-inventory.js` exits **0** afterwards, and the
  regenerated `docs/testing/worklist.json` is committed in the same commit as
  the coverage record, so the drift guard
  `npx vitest run scripts/lib/evaluator-coverage-corpus.test.js` passes.

- `npx vitest run src/evaluator` ends with no failing case.

- If the engine turns out to evaluate the construct differently from what the
  criteria above demand, fix the engine — the test is the specification here,
  exactly as a scenario is in the earlier rounds.

## The construct

`Grappling Hooks` (`6eac-4ed9-4511-ff14`), a shared `selectionEntry` of the game
system `src/evaluator/__fixtures__/whfb6-definitive/Warhammer Fantasy Battles
(6th definitive edition).gst`, carries the corpus's only repeat with
`childId="any"`:

```xml
<selectionEntry id="6eac-4ed9-4511-ff14" name="Grappling Hooks" type="upgrade">
  <comment>1p/model</comment>
  <modifiers>
    <modifier type="increment" field="ecfa-8486-4f6c-c249" value="1">
      <repeats>
        <repeat field="selections" scope="parent" value="1" percentValue="false"
                shared="true" includeChildSelections="false"
                includeChildForces="false" childId="any" repeats="1"
                roundUp="false"/>
      </repeats>
    </modifier>
  </modifiers>
  <constraints>
    <constraint field="selections" scope="parent" value="1" ... id="5eeb-1234-13f4-dba5" type="max"/>
  </constraints>
</selectionEntry>
```

The entry's own base cost is 0 pts; the increment raises it by 1 pt per counted
selection of the parent frame. It is unreachable in this corpus: its id occurs
exactly once — at its own definition — nothing links it, it carries no
`categoryLink`, and the game system declares no `forceEntries`. That is why a
`.ros` fixture cannot pin it and a synthetic dataset must.

## Decisions

- The check commands for this issue are `npx vitest run src/evaluator`,
  `node scripts/evaluator-coverage-inventory.js` and
  `npx vitest run scripts/lib/evaluator-coverage-corpus.test.js`.
- The maintainer decided on 2026-08-11 to cover this cell on the unit-test track
  rather than waive it as untestable, because the entry models a real rule of
  the game — 1 point per grappling hook and rope, one per model of a skirmishing
  infantry unit — which matches the entry's own comment `1p/model`. The missing
  incoming link is an upstream data gap, not a meaningless construct. The
  decision is recorded in `docs/testing/campaign-state.json` under
  `parkedQuestions`.
- This round may write `docs/testing/covered-cells.json` and the regenerated
  `docs/testing/worklist.json`, which earlier rounds of this issue put out of
  scope. The coverage record is the deliverable here, and there is no scenario
  to carry it.
- No version bump inside the campaign; the maintainer decides that when the
  campaign branch merges.

## Out of scope

- Changing, weakening or deleting any scenario under `docs/testing/<slug>/` —
  the `.ros` files, `scenario.json` and `README.md` of every scenario are the
  specification.
- Authoring new E2E scenarios; the coverage campaign's phase A does that.
- `docs/testing/campaign-state.json` — it belongs to the campaign driver.
- Any change outside `src/evaluator/`, its unit tests, and the two coverage
  bookkeeping files named above.
