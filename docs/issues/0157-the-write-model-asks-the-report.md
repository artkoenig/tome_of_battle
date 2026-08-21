---
status: done
branch: claude/issue-157-og3nst
pr: 251
---

# The write model asks the report

## Goal

What a recruit writes into the roster — which mandatory members come with it, which
mandatory list rules a fresh roster receives — follows the evaluation report instead of a
second reading of the catalogue, and with its last consumer gone the old evaluation core
(modifier evaluation, query counting, entry visibility and the counting context that only
fed them) is deleted.

## Acceptance criteria

- AC1 Recruiting a unit produces the same selection tree as today for the frozen catalogue corpus — the same mandatory members, the same counts, the same conditional obligations — with the obligation read from the report rather than from catalogue constraints. | verify: forge-test --run src/roster
- AC2 A fresh roster receives exactly the mandatory list rules it receives today, and none that the report does not call mandatory in the chosen army list. | verify: forge-test --run src/hooks
- AC3 The estimate shown before recruiting and the cost of the recruited selection still agree, and both come from one source. | verify: forge-test
- AC4 The modules that only existed to evaluate catalogue data outside the evaluator no longer exist, and nothing imports them. The dead cost helpers in the same layer go with them. | verify: forge-lint
- AC5 The area note for the roster layer describes the layer that remains: what it still does, and that evaluation is not part of it.
- AC6 All four wrappers are green. | verify: forge-test

## Out of scope

- The display paths of the editor — the sibling issue lands first; this one may not be finished before it.
- The cost display's two sources — its own issue.
- The import pipeline and the catalogue-update reconciliation, which keep their own catalogue access.
- A version bump: no user-visible change is intended.
