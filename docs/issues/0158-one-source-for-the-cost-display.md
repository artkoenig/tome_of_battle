---
status: backlog
branch:
pr:
---

# One source for the cost display

## Goal

The cost type a roster is measured in, its label and the extra-resource totals are read
from one place — the report and the dataset description — so the second, catalogue-side
implementation of the same lookups disappears and no screen can show a different answer
than its neighbour.

## Acceptance criteria

- AC1 Every screen that names a cost type, shows a limit label or lists extra resources reads them from the report side; the catalogue-side equivalents no longer exist and nothing imports them. | verify: forge-lint
- AC2 No file imports both implementations, because there is only one. | verify: forge-test
- AC3 The displayed labels and totals are unchanged for a roster of the frozen corpus, including a dataset whose author hides a cost type and one where the roster carries no configured limit type. | verify: forge-test --run src/components
- AC4 The exported roster keeps the cost type it carries today. | verify: forge-test --run src/utils
- AC5 All four wrappers are green. | verify: forge-test

## Out of scope

- What the report computes as a cost — unchanged here.
- The display paths and the write model — their own issues.
- A version bump: no user-visible change is intended.
