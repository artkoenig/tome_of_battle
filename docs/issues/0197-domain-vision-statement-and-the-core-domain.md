---
status: backlog
branch:
pr:
---

# A domain vision statement: name the core domain, and close the workspace question

## Goal

Finding S2 of [`docs/ddd-review-2026-08.md`](../ddd-review-2026-08.md). Nothing in the project says
which part of its model is the asset, so nothing can arbitrate "is this worth it?". A grep for
*core domain / Kerndomäne / domain vision / distillation / subdomain / value proposition* across
`docs/`, `README.md`, `.claude/` and `.agents/` returns the review itself and one unrelated use of
"distillation" in `docs/project-map.md:125`.

**The sharpened problem is not that the tree is unlabelled — it is that two contradictory implicit
answers are on record and neither is entitled to settle it.**

- `docs/ddd-assessment-and-refactoring-plan.md:124,128` labels **two** contexts `Core`
  (`armylist - building a list`, `ruleengine - judging a list`). Two cores is the same as none.
- Effort and product intent point opposite ways. Effort says engine: **10 858 lines, 38.4 % of the
  28 255 production JS/JSX lines**, 26 modules, 104 test files, 124 E2E scenarios under
  `docs/testing/`, 22 of 92 issue folders. Product intent says the opposite: **all five
  `docs/PRD-*.md` — the form this project reserves for decisions that must fall before the code —
  are about the editor, play mode, catalogue updates, `.ros` serialization and rule URLs. Not one
  is about the engine.** The engine has consumed the most code and produced the fewest product
  decisions.

(The review's headline said 39 %; the correct figure is 38.4 %, because its table omits
`src/contexts/ruleengine/evaluator.js` at 479 lines and `src/main.jsx` at 95. It also counts JS/JSX
only — with the 3 601 lines of CSS under `src/ui/`, the engine is 34.0 % and `ui` is the largest
area at 41.0 %. The document must say which basis it uses.)

The material to write from is already gathered and needs no further investigation: the landing page
lead in `docs/index.html` ("Forge Your Legend … draft, customize, and manage your tabletop armies
with instant point calculation and full offline access"), its seven feature headings with
"Powerful Rules Validation Engine" fourth of seven, `README.md:3-8` and `:29-30`, and — decisively —
ADR-0030's own driver: *"Korrektes Verhalten wird ausschließlich aus den BattleScribe-Daten und dem
Reinraum-Modell abgeleitet"* (`:116-119`), with ADR-0033 handing scenario authorship to a black-box
subagent working from catalogue data only.

**A recommendation, not a decision — the issue must not pre-fill it.** The reviewing agent's reading
is that the core is `armylist` with `play` as its second half, and the engine is a **Cohesive
Mechanism**, not the core and not a generic subdomain: a core domain is where the business makes
distinctive decisions, and here nobody may decide what a correct evaluation is — the specification
is external, closed and versioned (XSD v2.03). "Generic" is wrong because no shelf sells this. The
counter-case is real and must be stated in the document: correctness is what separates this app from
a notes file, the project already threw away a working engine over it, and by Evans's *what could
you not buy?* test the engine wins outright. Whichever way it goes, the document must spell out that
classifying the engine as a mechanism is a statement about **where product judgement is exercised**,
not a licence to spend less on correctness — otherwise it will be misread.

**Close the workspace extraction (S2.2) in writing rather than leaving it open.** It is not a close
call, and the reason is one the review never looked at: the engine's single import out of itself is
`src/shared/battlescribe/battlescribeSchema.generated.js`, which **five production modules outside
the engine** also import and whose sharing ADR-0031 decided on purpose, to avoid the drift class
learned from ADR-0016. Duplicating it reverses that ADR; a second package must carry the vendored
XSD, `scripts/generate-schema-module.js` and its guard test. On top of that: 104 test files
importing 23 engine internals directly, a 12 MB fixture corpus addressed by string literal from 13
outside files, seven configuration rewrites (`.cast/layers.json`, `.cast/rules.json`,
`.oxlintrc.json`, `tsconfig.json`, `knip.json`, `vitest.config.js`, `package.json`), an unverified
assumption about whether cast resolves across a workspace boundary, and 319 files naming the path.
All of it to replace two already-clean, already-`error` gates with a third. Record the cost, name
the condition that would reopen it (a second consumer, or publication), and close it.

Deliverable: `docs/domain-vision.md`, one page, ≤ 90 lines. No ADR — this records intent and is
revised as insight arrives; `docs/adr/README.md`'s process would over-freeze it. No code change, no
version bump.

## Acceptance criteria

- AC1: `docs/domain-vision.md` exists and is at most 90 lines. | verify: `bash -c 'test -f docs/domain-vision.md && test "$(wc -l < docs/domain-vision.md)" -le 90'`
- AC2: It carries the six required sections — what the app is for, what the user gets that BattleScribe does not, the core domain, the classification of every context, what follows, and what it does not mean. | verify: `bash -c 'test "$(grep -c "^## " docs/domain-vision.md)" -ge 6'`
- AC3: Exactly one context is named as the core domain. | verify: `bash -c 'test "$(grep -ciE "^\*\*(Core domain|Kerndomäne)" docs/domain-vision.md)" -eq 1'`
- AC4: The classification table has a row for every context plus `platform` and `ui`. | verify: `bash -c 'for c in armylist ruleengine play catalog rulebook platform ui; do grep -q "$c" docs/domain-vision.md || exit 1; done'`
- AC5: The document argues from the sources rather than asserting — it cites at least the landing page, the README and ADR-0030. | verify: `bash -c 'grep -q index.html docs/domain-vision.md && grep -q README.md docs/domain-vision.md && grep -q 0030 docs/domain-vision.md'`
- AC6: The workspace extraction is recorded as assessed and closed, with the ADR-0031 conflict named and a reopening condition stated. | verify: `bash -c 'grep -qiE "workspace|npm package" docs/domain-vision.md && grep -q 0031 docs/domain-vision.md'`
- AC7: `docs/ddd-assessment-and-refactoring-plan.md` no longer leaves two contexts labelled `Core` without a pointer to the vision statement. | verify: `bash -c 'grep -q domain-vision.md docs/ddd-assessment-and-refactoring-plan.md'`
- AC8: README and project map link the document. | verify: `bash -c 'grep -q domain-vision.md README.md && grep -q domain-vision.md docs/project-map.md'`
- AC9: Every relative link in the new document resolves. | verify: `bash -c 'cd docs && grep -oE "\]\([^)#]+\.md\)" domain-vision.md | tr -d "])" | sed "s/^(//" | while read -r p; do [ -e "$p" ] || [ -e "../$p" ] || exit 1; done'`
- AC10: The corrected share figure replaces "39 %" in the review, with the two missing rows added and the JS/JSX-only basis stated. | verify: `bash -c 'grep -q "38.4" docs/ddd-review-2026-08.md'`
- AC11: No production or configuration file changed. | verify: `bash -c 'test -z "$(git diff --name-only main... | grep -vE "^(docs/|README\.md)")"'`
- AC12: The gates stay green. | verify: `bash -c 'forge-lint && forge-typecheck && forge-test'`

Terminology must match `docs/glossary.md`; no automated check covers that, so it is a deliberate
read during review rather than an AC hidden behind a command that does not check it.

## Out of scope

- Moving the engine to an npm workspace, splitting the shared kernel into a package, relocating
  `scripts/generate-schema-module.js` or the vendored XSD. Assessed, rejected, recorded.
- Moving the 104 engine test files or the 12 MB fixture corpus. Worth its own issue on the merits —
  the engine folder would become self-contained and the string-literal fixture paths would get one
  home — but it must not be smuggled in as preparation for an extraction that is not happening.
- Any rebalancing of effort, any new feature, any change to `src/contexts/armylist/` the conclusion
  might suggest. The document names where attention belongs; it does not spend it.
- A new ADR, and any change to ADR-0016/0030/0031. Their decisions stand and are quoted.
- The context map (0196) — a sibling and, by the review's ordering, a prerequisite.

## Open questions

Only the owner can answer these; the issue must not pre-fill them.

1. **Which context is the core?** Recommendation above; the counter-case is argued with it.
2. **Is `play` part of the core or supporting?** It is 258 lines and a fresh context, while "Ready
   at the Gaming Table" is a headline claim. If the vision names it core, that gap becomes a plan.
3. **Does `docs/index.html` still say what is meant?** The whole value-proposition argument rests on
   a page no test covers. If it is stale it should be corrected first, or the vision is derived from
   marketing copy nobody re-read.
4. **Is the two-`Core` line in the first assessment a considered position or shorthand?** If
   considered, the vision overrules a real prior decision and should say so.
5. **Is the engine ever intended to be published or reused?** The only thing that flips the
   extraction verdict.
6. **Can "the engine is not the core" be read without hearing "the engine gets less care"?** If
   not, name the core and stop, without ranking the mechanism at all.
