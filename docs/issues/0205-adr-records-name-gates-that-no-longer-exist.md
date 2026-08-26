---
status: backlog
branch:
pr:
---

# ADR records name a gate and paths that no longer exist

## Goal

Nine architecture decision records tell a reader today that the structural gate of this project is
`.dependency-cruiser.cjs`. That file was removed with commit 997d49f when cast replaced the tool
(ADR 0041), and `docs/adr/0024-statik-toolchain-oxlint-knip-dependency-cruiser.md` — the record that
chose it, still `Accepted`, still describing it as one of three pillars at `:79-93` and `:139` — has
no forward reference to its successor. `0006:33`, `0030:18,101`, `0037:22,72,106,187`, `0038:96`
and `0039:46` all name it as the gate in force. A reader following any of them looks for a file that
is not there and, worse, believes an edge is held that nothing holds.

Four more statements are simply wrong on today's tree, each verified:

1. `0039:47` names the cast rule `roster-keine-evaluation-abhaengigkeit`. No such name exists;
   `.cast/rules.json:94` has `roster-keine-evaluator-abhaengigkeit`, and the opposite direction is
   `evaluation-keine-roster-abhaengigkeit`. `0041:133` repeats the same wrong name in its violation
   table. A rule cited under a name that does not exist cannot be looked up.
2. `0042:72` states `.cast/rules.json` contains 23 rules. It contains 26 `forbidden` and 18
   `allowed`.
3. `0042:73` glosses `kontext-kein-fremder-kontext` as "no context imports another", while
   `src/contexts/armylist/application/mandatoryListRules.js:28` imports the read model's door. The
   rule is not violated — `lesemodell-die-eine-tuer` and `.claude/rules/areas/contexts.md` allow
   exactly that one edge — but the ADR's prose omits the exception, so the code reads as a breach of
   its own architecture.
4. `0033:10,12,60` links `src/domain/evaluator/` and two test paths under it. None exists; the
   runner lives under `src/contexts/ruleengine/engine/`. `0002:30` names
   `src/domain/evaluation/useEvaluation.js`, two renames out of date.

**How to correct them is the substance of this issue, not a detail.** An ADR is the record of a
decision at a time; rewriting its body erases the decision and leaves a forgery. `0040:5-6` already
shows the form that works: a dated header note mapping the old paths to today's, body untouched.
Every correction here takes that shape — a header note, a status line, or a forward reference to the
superseding ADR — except where the statement was wrong on the day it was written (the rule name in
`0039:47`, the count in `0042:72`, the missing exception in `0042:73`), which is an erratum and may be
corrected in place with the correction marked as such. That distinction also answers open question 2
of issue 0202, which asks whether an accepted ADR may be touched at all.

This is the ADR half of the same sweep issue 0202 runs over `docs/project-map.md` and the area
notes. It could not be folded in: 0202's out of scope is explicit — "Any ADR decision, status or
content beyond the one stale path in ADR-0002" (`:99`) — and its AC7 already owns that one path, so
`0002:30` stays with 0202 and this issue leaves it alone.

No version bump: documentation only.

## Acceptance criteria

- AC1: No ADR presents `.dependency-cruiser.cjs` as a gate in force. Each of the nine records either carries a note that cast replaced it or, where the mention is the historical decision itself, a forward reference to ADR 0041. | verify: manual read of every hit of `grep -rln dependency-cruiser docs/adr/`
- AC2: ADR 0024 names its successor in its status line. | verify: `bash -c 'sed -n "1,12p" docs/adr/0024-statik-toolchain-oxlint-knip-dependency-cruiser.md | grep -q 0041'`
- AC3: Every cast rule name cited in an ADR exists in `.cast/rules.json` — the two citations of the non-existent `roster-keine-evaluation-abhaengigkeit` are corrected. | verify: `bash -c '! grep -rq "roster-keine-evaluation-abhaengigkeit" docs/adr/'`
- AC4: No ADR states a rule count that contradicts `.cast/rules.json`, and the count is either dropped or expressed so it cannot go stale again. | verify: manual read of `docs/adr/0042-schnitt-nach-fachlichkeit-bounded-contexts-und-ports.md`
- AC5: ADR 0042 names the read model's door as the one sanctioned cross-context edge. | verify: `bash -c 'grep -q "mandatoryListRules\|lesemodell-die-eine-tuer" docs/adr/0042-schnitt-nach-fachlichkeit-bounded-contexts-und-ports.md'`
- AC6: No ADR links a path under `src/domain/` as a current location; where the path is part of the recorded decision it is marked as historical. | verify: manual read of every hit of `grep -rn "src/domain/" docs/adr/`
- AC7: `docs/adr/README.md` shows the same status for an ADR as the ADR's own file, and its table renders unbroken (the stray blank line before the 0037 row at `README.md:47` is gone). | verify: manual read
- AC8: No ADR body was rewritten to say something other than what was decided — every correction is a note, a status line, a forward reference, or a marked erratum. | verify: manual read of the diff during review
- AC9: Nothing outside `docs/` changed. | verify: `bash -c '! git diff --name-only origin/main | grep -qv "^docs/"'`

## Out of scope

- `docs/adr/0002-…:30` — issue 0202 owns it (its AC7).
- `docs/project-map.md` and `.claude/rules/areas/*.md` — issue 0202 owns those too, except the one
  line issue 0203 changes in `areas/evaluator.md`.
- ADR 0032 B1, which is not stale but contradicted on a matter of domain behaviour. It has its own
  issue, because it needs a decision and not an edit.
- Writing new ADRs for decisions taken since. A record that is missing is not a record that is wrong.
- Any change to `.cast/rules.json`, `.oxlintrc.json` or a source file.
