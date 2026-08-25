---
status: backlog
branch:
pr:
---

# Cut src/ by subject: bounded contexts, shared kernels and ports

## Goal

`src/` is layered by technology (`ui`/`domain`/`data`) and the layering holds: `cast report
--root src` finds 492 modules, 2021 edges and **0 cycles**, `cast check` finds 0 violations
against 17 rules. What it is not is cut by subject. `src/domain/` is one drawer for five
different subject areas, and `src/domain/services/` imports Dexie and JSZip directly, so the
domain depends on the infrastructure rather than the other way round.

This issue performs the structural half of `docs/ddd-assessment-and-refactoring-plan.md`
(findings F3 and F4): five bounded contexts, two shared kernels, one platform layer reachable
only through two port modules. It moves modules and rewrites imports. It changes **no
behaviour** and writes no new logic — the model changes are issues 0188 to 0192.

The move is not a sketch. Three cast plans are checked in under `.cast/plans/` and the target
numbers come from `cast plan simulate .cast/plans/ddd-3-contexts-ports.json --root src`:
modules 492 -> 495, edges 1172 -> 1172, cycles 0 -> 0, `domain` and `data` dissolve,
`shared` ends with fan-out **0**, and `contexts -> platform` narrows from 17 domain modules to
7 edges out of two ports.

Two constraints the simulation established and that the run must not "improve" on:

- `domain/types.js` goes to `shared/rostermodel/`, **not** to `shared/battlescribe/`. It is our
  own list vocabulary; the ACL exists to translate between the two.
- `services/dataEvents.js` goes to `shared/events/`. Placed in `armylist` it immediately creates
  `contexts/catalog -> contexts/armylist` and breaks AC5.

The part that is easy to forget and expensive to skip: all 17 rules in `.cast/rules.json` are
written against today's paths. After the move each of their globs matches nothing and the gate
would report green while guarding nothing. The rule rewrite belongs in the same increment as the
move it guards, never after it.

Cut into three increments, in this order. Increments 1 and 2 are shippable but do not settle the
metrics on their own — `cast plan simulate` rejects each standalone on the instability criterion,
which is an artefact of a shrinking layer losing its dependents before its dependencies, not a
structural fault. Only after increment 3 does `domain` reach instability 0.00.

1. **Shared kernels.** `data/parser/schema/battlescribeSchema.generated.js` ->
   `shared/battlescribe/`, `domain/types.js` -> `shared/rostermodel/`,
   `services/dataEvents.js` -> `shared/events/`. Drops the 7 schema edges out of
   `domain -> data` (17 -> 10).
2. **Read-model facade.** `domain/evaluation/{rosterAdapter,evaluationCache}.js` ->
   `contexts/ruleengine/acl/`, the remaining nine modules -> `contexts/ruleengine/readmodel/`
   behind a single `index.js`. The 25 view-model edges that reach 9 different internals today
   are redirected onto that one entry point.
3. **Contexts and ports.** `domain/roster/**` -> `contexts/armylist/model/`,
   `domain/evaluator/**` -> `contexts/ruleengine/{evaluator.js,engine/}`, services ->
   `contexts/{armylist,catalog}/application/`, `domain/rules/**` -> `contexts/rulebook/`,
   `data/**` -> `platform/{persistence,battlescribe}/`, and the two ports
   (`armylist/ports/storagePort.js`, `catalog/ports/catalogRepository.js`) as the only modules
   under `contexts/**` that may import `platform/**`.

The operation list per increment is in the plan files; `cast` is the source of truth for what
moves where, not this text.

## Acceptance criteria

- AC1: The layers `src/domain/` and `src/data/` no longer exist; `src/contexts/`, `src/shared/` and `src/platform/` do. | verify: `bash -c 'test ! -d src/domain && test ! -d src/data && test -d src/contexts && test -d src/shared && test -d src/platform'`
- AC2: The two shared kernels sit where the simulation put them. | verify: `bash -c 'test -f src/shared/rostermodel/types.js && test -f src/shared/battlescribe/battlescribeSchema.generated.js && test -f src/shared/events/dataEvents.js'`
- AC3: `shared/` depends on nothing — no import out of it into a context, the platform or the UI. | verify: `bash -c '! grep -rqE "from .[^\"]*(contexts|platform|ui)/" src/shared'`
- AC4: Only the two port modules reach the platform from inside a context. | verify: `bash -c 'f=$(grep -rlE "from .[^\"]*platform/" src/contexts | grep -v "/ports/" || true); test -z "$f" || { echo "$f"; exit 1; }'`
- AC5: No context imports another context. | verify: `bash -c 'bad=0; for a in armylist ruleengine catalog rulebook; do for b in armylist ruleengine catalog rulebook; do [ "$a" = "$b" ] && continue; if grep -rqE "from .[^\"]*contexts/$b/" "src/contexts/$a" 2>/dev/null; then echo "$a -> $b"; bad=1; fi; done; done; exit $bad'`
- AC6: The read model has exactly one door: no module outside `contexts/ruleengine/` names a read-model or ACL module other than `readmodel/index.js`. | verify: `bash -c 'hits=$(grep -rhoE "contexts/ruleengine/(readmodel|acl)/[a-zA-Z]+" src/ui src/contexts/armylist src/contexts/catalog src/contexts/rulebook 2>/dev/null | grep -v "readmodel/index" || true); test -z "$hits" || { echo "$hits" | sort -u; exit 1; }'`
- AC7: The evaluator keeps its single entry point — nothing outside `contexts/ruleengine/` imports `engine/`. | verify: `bash -c '! grep -rqE "contexts/ruleengine/engine/" src/ui src/contexts/armylist src/contexts/catalog src/contexts/rulebook'`
- AC8: `.cast/layers.json` and `.cast/rules.json` are rewritten for the new tree: the 17 rules keep their intent under new globs, #5 and #15 are deleted as subsumed, and the six new rules N1-N6 from the plan document are present. The gate is green and actually finds edges to check. | verify: `bash -c 'npm run cast 2>&1 | tee /dev/stderr | grep -qE "0 violations \(0 errors\) in [0-9]+ module edges against 2[0-9] rules"'`
- AC9: Behaviour is unchanged — the full suite passes. | verify: `forge-test`
- AC10: Types, lint and build stay green. | verify: `bash -c 'forge-typecheck && forge-lint && forge-build'`
- AC11: The Puppeteer app E2E still passes, since every UI import path changed. | verify: `node e2e/ui.test.js`
- AC12: `docs/project-map.md` describes the new tree, and an ADR records the cut by subject and supersedes ADR 0037/0040 where they name the old directories. | verify: `bash -c 'grep -q "src/contexts/" docs/project-map.md && ls docs/adr/00*-*context*.md >/dev/null 2>&1'`

## Out of scope

- Every model change. The aggregate keeps its anaemic shape, the write commands stay in
  `src/ui/viewmodels/rosterCommands.js`, the mandatory-list-rule effect stays a React effect,
  and `gameState` stays in the roster. Those are issues 0188, 0189 and 0190; mixing them into
  this move would make the diff unreviewable.
- Splitting or merging any module beyond the four splits the plan names (the read-model facade
  and the two ports). Renaming files, tidying exports and "while I am here" cleanups are not
  part of this.
- `src/ui/` keeps its place and its internal structure. Only its import paths change.
- A version bump. Nothing a user can see changes (`.claude/rules/forge.md`: never for
  refactoring).
- Moving `RosterFileError` out of `rosterTransfer.js`. That is issue 0187, and until it lands
  the rule `armylist/model/** -> armylist/application/**` cannot be switched on.
