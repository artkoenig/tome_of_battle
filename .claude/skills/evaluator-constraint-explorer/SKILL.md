---
name: evaluator-constraint-explorer
description: Schließt die Evaluator-Abdeckung Zelle für Zelle aus den Katalogdaten — findet Constraint-Kombinationen, die noch kein Szenario festnagelt. Use this skill when the user asks to close evaluator coverage, to work the coverage worklist, or to find untested constraint combinations in the catalog data.
user-invocable: true
---

# Evaluator Constraint Explorer

## 1. What this skill does

This skill closes evaluator coverage cell by cell, data-first. The catalog corpus says which rule constructs exist, the coverage inventory says which of them no scenario pins yet, and this loop pins the next one with a black-box E2E scenario. The search starts from the data and never from a hypothesis about the engine code. That inversion is what ADR 0033 asks for: scenarios are authored from the catalog data alone, so they challenge the engine instead of mirroring it.

## 2. Preconditions

- Read `docs/battlescribe-data-format.md` before the first cell. It is the canonical vocabulary of every axis in a cell key and takes precedence over the ADRs.
- Work on a feature branch. If the current branch is the repository default branch, create one first.
- Never create a git worktree. The campaign driver owns the branch.
- Complete exactly one cell per invocation. The caller re-invokes for the next one, and the per-run cap belongs to the campaign driver, not here.

## 3. Step 1 — run the inventory

Run `node scripts/evaluator-coverage-inventory.js` from the repository root. Read its exit code as the script's own header defines it:

- `0` — every occurring cell is covered or waived. There is nothing to do: report that and stop.
- `1` — the worklist is not empty. **This is the loop's normal state, not a failure.** Continue.
- `2` — an operational failure (missing corpus directory, `parsererror`, unreadable JSON). Stop and report it; do not work around it.

A tool wrapper that flags exit 1 as an error must not be read as a failure.

`WARNING` lines do not change the exit code. Act on one only when it names a scenario this loop just wrote: `WARNING manifest id names no constraint in the corpus` means the manifest's `limitId` is wrong, and `WARNING manifest id names a corpus constraint outside the scenario's dataset` means its `dataset` and its expectation disagree. Send such a scenario back to the author subagent before committing it. A `WARNING stale covered key` names a `covered-cells.json` entry the corpus no longer holds: report it and do not silently delete it.

## 4. Step 2 — take the next cell

Read `docs/testing/worklist.json`. Its `cells` are sorted heaviest first (`sortCells`: occurrences descending, then key ascending), so the next cell is the first entry that is not parked in `docs/testing/campaign-state.json` and has no scenario in progress.

Each record carries `key` (the pipe-delimited cell key), `kind` (`constraint | condition | conditionGroup | modifier | modifierGroup | repeat | repeatList`), `axes`, `occurrences`, `files` (occurrence count per corpus file), and `examples[]` with `file`, `ancestor` (`tag`, `id` and `name` of the nearest named catalog element the construct hangs on) and `raw` (the element's own attributes). `examples[]` is the whole address a scenario author needs: jsdom exposes no line numbers, so the ancestor id is the handle.

Prefer an example under `src/evaluator/__fixtures__/whfb6-definitive/`. Where every occurrence of a cell sits under `src/__fixtures__/whfb6/`, the scenario author cannot read it — its allow-list in `docs/agents/e2e-testcase-author.md` covers the definitive corpus only. Park such a cell with the question whether the allow-list should be extended to the upstream corpus, and take the next cell.

## 5. Step 3 — derive the rule the cell demands, from data only

Use these sources and only these: the catalog XML the example names, `docs/battlescribe-data-format.md`, `src/parser/schema/Catalogue.xsd`, and the BSData wiki submodule under `docs/bsdata-catalogue-development-wiki/`.

Never open `src/evaluator/*.js` in this mode. A rule read off the engine cements the engine's bugs as expectations.

The output of this step is one plain-language sentence — what the catalog data demands of a correct evaluator for this construct — plus the evidence: the file, the ancestor entry id and name, and the element's attributes. Where that sentence cannot be justified from those sources, park the cell (step 8) and continue with the next one.

## 6. Step 4 — delegate the scenario to `e2e-testcase-author`

Delegate the scenario to the `e2e-testcase-author` subagent; never write it in the main conversation. Its premise (`docs/agents/e2e-testcase-author.md`) takes `rule` (required, plain language), `scenario_name` (required, the slug of the new directory under `docs/testing/`) and an optional dataset hint.

Choose a kebab-case slug that describes the construct, in the style of the existing directories (`modifier-group-repeats`, `condition-group-not`), and check that `docs/testing/<slug>/` does not exist yet.

The delegation prompt carries the rule sentence, the slug, the dataset hint (the `gameSystem` and `catalogues` paths the example's file implies), the catalog evidence from `examples[]`, and which manifest key must carry the expectation. It carries **no** engine code, no engine output and no statement about what the engine currently does; quoting any of that into the prompt destroys the black-box premise the whole campaign rests on.

Which manifest key pins which kind of cell:

- `constraint` → `expect.firing` / `expect.absent` with the constraint's `limitId`, `actual` and `bound`. Only this kind is credited automatically, because `coveredKeysFromManifests` resolves manifest `limitId`s against the roster's dataset.
- `condition` / `conditionGroup` → two rosters that make the gated constraint or modifier fire and not fire, so the condition's own semantics is what the pair distinguishes.
- `modifier` / `modifierGroup` → `expect.capabilities` (`name`, `isHidden`, `effectiveMin` / `effectiveMax`, `characteristics`, `infoElements`) or, for a `field="error"|"warning"|"info"` modifier, `expect.messages` with `origin: "authorMessage"`.
- `repeat` / `repeatList` → `expect.capabilities` on the slot whose bound or value the repetition moves, with a roster whose count crosses at least two repetitions.

The author reports back a summary, including any gap that made it stop. A gap it reports is a park (step 8), not a reason to write the scenario yourself.

## 7. Step 5 — run the evaluator tests

Run exactly `npx vitest run src/evaluator`. The change touches only `docs/testing/`, which that suite consumes, so no other suite is run here.

Isolate the new scenario's cases with `npx vitest run src/evaluator/e2e.testcatalog.test.js -t "Szenario: <slug>"` — the runner names its dynamic cases `Szenario: <manifest.name>` and, per roster, `<label>: Bericht entspricht der deklarierten Erwartung`.

Only failures naming the new scenario decide green or red. Other evaluator failures are the campaign's already-pinned gaps: they are neither this cell's result nor this skill's to fix. `CLAUDE.md`'s "all unit tests must pass" is suspended for exactly those pinned red scenarios recorded in `docs/testing/campaign-state.json`, each of which phase B closes.

## 8. Step 6 — green: keep the scenario and mark the cell covered

**Never change a scenario's expectations to make the engine pass, and never soften, delete or narrow an assertion for that purpose.** That rule is what separates this loop from a rubber stamp. Correct a wrong expectation only when the *catalog data* proves it wrong, and then through the author subagent, with the corrected derivation written into the scenario README.

Mark the cell covered:

1. Re-run `node scripts/evaluator-coverage-inventory.js`.
2. If the cell has left the worklist, the manifest derivation already credits it (that happens for `constraint` cells pinned by a `limitId`); add no manual entry, because `covered-cells.json`'s own `_comment` reserves manual entries for cells no manifest `limitId` can attest.
3. Otherwise append to `docs/testing/covered-cells.json`: `{ "key": "<cell key>", "evidence": ["docs/testing/<slug>"], "rationale": "<which roster and which assertion pin it>" }`, then run the inventory again so `docs/testing/worklist.json` is regenerated from the new record. Only `key` is read by the tooling; `evidence` and `rationale` are for the human reader.

Update `docs/testkatalog-evaluator-e2e.md` in the same step: the catalog and the scenario stock are kept identical by hand, in German, with no generator and no CI gate.

Commit everything of the cell together — the scenario directory, `covered-cells.json`, the regenerated `worklist.json` and the Testkatalog entry — in one commit, for example `test(coverage): pin <cell key> with scenario <slug>`.

Verify the bookkeeping with `npx vitest run scripts/lib/evaluator-coverage-corpus.test.js`; its drift guard recomputes the worklist from the corpus and deep-equals the committed file, so a forgotten regeneration is caught there.

Never delete a committed green scenario. Campaign progress is monotone.

## 9. Step 7 — red: pin the gap

A red scenario stays exactly as it is. Deleting it, or weakening it, throws away the only evidence of the gap.

Mark the cell covered by the same rule as a green one: covered means *pinned by a scenario*, not *passing*. A red cell left in the worklist would be handed out again on the next invocation and the loop would never finish phase A, while a red `constraint` cell leaves the worklist automatically through the manifest derivation — the two kinds must not diverge. The `rationale` says the scenario is red and points at the `pinnedGaps` entry.

Append the phase-B task to `pinnedGaps` in `docs/testing/campaign-state.json`:

```json
{
  "cellKey": "<pipe-delimited cell key>",
  "scenario": "docs/testing/<slug>",
  "failingCases": ["<vitest case label>", "..."],
  "pinnedAt": "YYYY-MM-DD",
  "status": "open",
  "note": "<what the catalog data demands, one sentence>"
}
```

Commit that entry with the scenario, the coverage record, the regenerated worklist and the Testkatalog entry. Report the gap in the run summary: the cell, the scenario, the failing case labels and what the catalog data demands.

## 10. Step 8 — park an underivable cell

Park a cell when its intended semantics cannot be derived from the catalog data, the BSData wiki or the XSD; when the author subagent reports a gap it could not close; or when the cell occurs only in the corpus outside the author's allow-list.

Append to `parkedQuestions` in `docs/testing/campaign-state.json`:

```json
{
  "cellKey": "<cell key>",
  "question": "<one question a human can answer without opening a file>",
  "sourcesChecked": ["docs/battlescribe-data-format.md §…", "src/parser/schema/Catalogue.xsd", "docs/bsdata-catalogue-development-wiki/…"],
  "parkedAt": "YYYY-MM-DD",
  "status": "open",
  "answer": null
}
```

Commit it and continue with the next cell in the same invocation. Skip a parked cell in step 2 while its `status` is `open`. Phrase the question so a human can answer it without opening a file. The human's answer is written into the entry's `answer` with `status: "answered"`; a cell whose question is answered is picked up again like any other worklist entry, and the answer is quoted into the delegation prompt as part of the rule.

Waive — never park — a cell that is genuinely untestable, meaning the construct is outside the format specification and has no catalog-derivable semantics at all. A waiver is a `covered-cells.json` entry with `"evidence": ["waived"]` and a rationale, exactly like the existing `condition|greaterThanOrEqualTo|…` entry. Park is temporary and waive is permanent; do not waive to get rid of a question.

The campaign driver may add further top-level keys of its own to `campaign-state.json`. Touch only `pinnedGaps` and `parkedQuestions`, and never rewrite another agent's entry.

## 11. Secondary mode — the engine-code hypothesis search

Use this mode only for a suspected semantics bug inside a cell the worklist already counts as covered. It never finds uncovered cells: the worklist is the only source of new cells.

The flow: analyse `src/evaluator/` thoroughly, form a hypothesis grounded in that analysis about a case the engine gets wrong, confirm the construct really occurs in the corpus, and delegate the scenario as in step 4.

Two rules carry over from the primary mode. The delegation prompt still carries only a data-derived rule and never engine code or engine output. The resulting scenario is kept whether it is green or red — a green one because progress is monotone, a red one as a pinned gap under step 7. This is a deliberate departure from the earlier version of this skill, which deleted a passing test; do not restore that behaviour.

## 12. Never

- Never change a scenario's expectations to make the engine pass.
- Never delete or weaken a committed scenario.
- Never write scenario files in the main conversation instead of delegating.
- Never read `src/evaluator/*.js` in the primary mode, and never quote engine code or engine output into a delegation prompt in either mode.
- Never change production code under `src/evaluator/` — that is phase B's work.
- Never propose a version bump for this work: scenarios and tooling are not user-facing.
