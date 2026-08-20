---
status: done
branch: claude/issues-156-157-158-pyrqfd
pr: 249
---

# Display paths read the report, not the catalogue

## Goal

Every screen of the roster editor draws what it shows from the evaluation report alone
— which category section exists and is visible, which list rules it offers and which are
ticked, which army-wide selectors are offered, whether a group is single choice or
repeatable, which options a carrier exposes and in which order, which profiles a chip
shows — so that the second evaluation of the same catalogue data that survived the UI
cutover no longer decides anything a user sees.

## Acceptance criteria

- AC1 No component, hook or util evaluates catalogue modifiers, conditions or constraints. Whether a category section appears, whether it is a list-rule checklist, which rules are ticked, which army-wide selectors are offered, whether a group is single choice, whether an option repeats within its group, which profiles a chip shows, and whether a selection is a list rule rather than a unit — each answer comes from the report.
- AC2 The rendered result is unchanged for the frozen catalogue corpus: same sections, same checklist states, same option rows in the same order, same profile tables, same chips. | verify: forge-test --run src/components
- AC3 The option rows of a carrier keep a stable order that does not change when an option inside a group is selected, and the order is the catalogue's — the report carries what the UI needs for it. | verify: forge-test --run src/components/editor
- AC4 An entry from a foreign army book is still absent from the recruit dialog, decided by the report rather than by a filter in the component. | verify: forge-test --run src/components/editor
- AC5 Whether a sub-selection is an independent sub-unit is answered once, from the report, for every screen that asks it today. | verify: forge-test
- AC6 All four wrappers are green, and the app E2E renders every touched view. | verify: forge-test

## Out of scope

- The write model: what a recruit writes into the roster, and the automatic setting of missing mandatory list rules, are the sibling issue.
- The cost display and its two sources — its own issue.
- The import pipeline and the catalogue-update reconciliation.
- Any catalogue data fix.
- A version bump: no user-visible change is intended.
