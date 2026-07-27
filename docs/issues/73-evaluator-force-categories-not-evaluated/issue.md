Status: resolved
Type: fix
Blocked by: None

## Description
Evaluator: Force categories not evaluated

## Acceptance Criteria
- [ ]

## Comments
- PO-Sichtung: Umsetzung liegt bereits auf main. Commit 4f042d3 (PR #136, 'fix(evaluator): isolate force count from selection count') aendert src/evaluator/{catalogReader,countIndex,model,query}.js und diese issue.md; field='forces' wird dort von field='selections' getrennt gezaehlt. Nur der Status war nicht nachgezogen.
