---
paths:
  - "src/roster/**"
  - "src/evaluation/**"
  - "src/db/**"
---

# Write model, bridge and persistence

`src/roster/` builds and rewrites the selection tree. `src/evaluation/` translates it for the
evaluator. `src/db/` persists it in IndexedDB.

- `src/roster/` is **structural only** — it never judges a roster (ADR 0011). A rule check that
  creeps in here duplicates the evaluator and will drift from it.
- No import of `src/evaluator/**` from `src/roster/**`, in either direction; the rule is blocking
  in `forge-lint`. Anything that needs both belongs in `src/evaluation/`.
- `src/roster/index.js` is a convenience barrel, not an enforced facade — do not rely on it to hide
  a module.
- `evaluateAppRoster` in `src/evaluation/` is the single memoized seam; adding a second call path
  into the evaluator silently defeats `evaluationCache.js`.
- A change to the persisted shape in `src/db/database.js` needs a migration — existing users carry
  their IndexedDB across releases (ADR 0002).
- `src/roster/` still holds a legacy `no-circular` warning (`modifierEvaluator → queryEngine →
  rosterCounter`). It is a warning by design; do not add a second one.
