---
status: done
branch: claude/fillup-50-punkte-022y0r
pr:
---

# „Fill up" belongs to the last 50 points, not to the first 500

## Intent

The editor's *Fill up* panel (`AutoFillSuggestions`) answers one question:
**what still fits into the remaining points?** That is an endgame question — it
matters when a list is nearly done and a handful of points is left over.

The panel showed up at exactly the opposite moment. Issue 0135 made it appear
when the gap to the configured points value was **50 points or more**
(`AutoFillSuggestions.jsx`, `MIN_REMAINING_POINTS`), so an empty 2000-point
list opened with a *Fill up* panel listing dozens of candidates, while a list
37 points short of its target — the one case where the panel is genuinely
useful — showed nothing at all. With a large gap the question is not "what
still fits" but "which units do I even want", and that is what the recruit
dialog is for.

The threshold is therefore an upper bound, not a lower one.

## Acceptance criteria

1. Without a points ceiling (no limit cost type, or points value 0) the panel
   does not appear. *(unchanged, Issue 0135 criterion 1)*
2. With a gap of **more than 50** points the panel does not appear — and
   neither does it at a gap of 0 or when the list is over its limit.
3. With a gap of **1 to 50** points the panel appears and names the remaining
   sum in the limit cost type. It stays visible even when nothing fits into
   that sum; a hint then replaces the list. *(unchanged from Issue 0135 apart
   from the span)*
4. Everything the panel suggests inside that span is unchanged: only what the
   report lists as selectable, nothing hidden or exhausted, cost > 0 and at
   most the remaining sum, own army book / game system / library only, sorted
   by cost descending, eight visible and the rest expandable.

## Result

`AutoFillSuggestions.jsx`: `MIN_REMAINING_POINTS` became
`FILL_UP_WINDOW_POINTS`, and both places that read it — the suggestion filter
and the panel's visibility — now test `0 < remainingPoints <= 50` instead of
`remainingPoints >= 50`. Nothing else in the component changed; the suggestion
rules, the apply mechanics and the origin filter are untouched.

Tests:

- `AutoFillSuggestions.evaluator.test.jsx` — criteria 2 and 3 rewritten to the
  new edges (51 and 300 → no panel; 50 and 1 → panel). The synthetic data sets
  are scaled down to the new span (remaining sum 50 instead of 300, prices
  accordingly), so criteria 4 to 10 keep pinning exactly the same promises
  inside the panel's new field of view.
- `RosterEditor.autofill.test.jsx` — the same three criteria on app level, at
  the new edges: 290 → gap 50 → panel; 291 → gap 51 → none; 540 → gap 300 →
  none (the reported case); 240 → gap 0 → none.

## Log

- 2026-08-12 — Status corrected: the work landed on `main` with 8233414 (PR #225), which is also the last commit touching this file. Only the status line was stale.
