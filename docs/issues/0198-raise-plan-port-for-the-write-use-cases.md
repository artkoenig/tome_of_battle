---
status: backlog
branch:
pr:
---

# A raise-plan port for the write use cases, and the read-model door narrows

## Goal

Findings T2 and T3 of [`docs/ddd-review-2026-08.md`](../ddd-review-2026-08.md). T3 falls out of T2,
so they share an issue.

**The seam.** The write use cases of `armylist` are functionally dependent on `SlotIndex`, a
`ruleengine` type, and name it `Object` at five of six places:
`src/contexts/armylist/application/raiseUnit.js:66,86` (`@param {Object} slots`), used at `:71` as
`slots.findChildSlot(slots.pathOfForce(forceId), defId)?.raiseMembers ?? []`; and
`subSelectionUseCases.js:47,64,88`, used at `:50` as
`slots.findDescendantSlot(slots.pathOfSelection(selectionId), defId)?.raiseMembers ?? []`.
`mandatoryListRules.js:28` does not even pretend: it imports the read model for real.

**Three consequences, all verified, and the third is the one that matters.**

- The typecheck holds nothing — but the reason is sharper than "untyped". JSDoc `{Object}` is
  treated as `any` **only because `noImplicitAny` is off**; with the flag, the same line yields
  `TS2339: Property 'findChildSlot' does not exist on type 'Object'`.
- `tsconfig.json` excludes `**/*.test.js`, `**/*.test.jsx` and `src/tests/test-utils`, **and** the
  three use-case tests build their `slots` stub by hand as a duck object (`createSlots` in
  `raiseUnit.test.js:13-20` and `subSelectionUseCases.test.js:13-20`, `slotsOf` in
  `mandatoryListRules.test.js:45-50`). So **renaming `SlotIndex.findChildSlot` breaks production and
  leaves the entire suite green** — the stub still carries the old name, and the typecheck sees
  neither production (`any`) nor test (excluded). That is the damage.
- The graph does not show it either: cast does **not** treat a JSDoc `import(...)` type reference as
  an edge. `rosterCommandBindings.js:31`, `useMandatoryListRuleAutoAdd.js:23` and
  `editor/useUnitCard.js` all name `SlotIndex` in JSDoc and none is counted.

**The true port surface is two and a half times what the review proposed.** Not two methods but
five (`pathOfForce`, `pathOfSelection`, `findChildSlot`, `findDescendantSlot`, `slotOfSelection`),
three capability fields (`raiseMembers`, `name`, `costs`) and one whole-object pass-through. The
proposed `membersFor(forceId, defId)` cannot express `subSelectionUseCases.js:50` at all. In the
list's own vocabulary (`docs/glossary.md` assigns `slot`, `capability`, `report` to **ruleengine**;
`raise` belongs to **armylist**) that becomes **three** members:

| Port member | Covers | Replaces |
|---|---|---|
| `membersRaisedInForce(forceId, defId)` | `raiseUnit.js:71` | `pathOfForce` + `findChildSlot` + `.raiseMembers` |
| `membersRaisedUnderSelection(unitSelectionId, defId)` | `subSelectionUseCases.js:50` | `pathOfSelection` + `findDescendantSlot` + `.raiseMembers` |
| `mandatoryListRuleGapsInForce(forceId)` | `mandatoryListRules.js:59` | `pathOfForce` + `findMissingMandatoryListRules` + `.capabilities` |

`system` needs **no** port: its two uses (`createSelectionFactory`, `findEntryInSystem`) both target
`armylist/model/`, so it never crosses a context boundary. Its `{Object}` typing at 10 places in 7
files is `noImplicitAny` debt, not this issue.

**Port or a typed import — the counter-position, and why the port wins narrowly.** Replacing
`{Object}` with `import('../../ruleengine/readmodel/index.js').SlotIndex` costs five JSDoc lines,
zero callers, zero tests, and buys the typecheck **exactly as well as a port does**; cast and oxlint
stay at zero; `mandatoryListRules.js:37` already does it with a green gate. The port wins on three
things and the typecheck is not among them. First, the typed import works only because cast is
blind: it does not hold the boundary, it evades the check — and ADR-0039 rejected precisely this
shape, because "'liest nur, leitet nichts ab' keine prüfbare Bedingung ist" (`:79-80`) and because
"die eine erlaubte Kante die Ausnahme normalisiert" (`:81-82`). An edge that never appears in the
graph is worse than an allowed one: it makes the graph a lie. Second, T3 does not fall out with a
typed import — `mandatoryListRules.js:28` is a real value import and would remain. Third, the
hand-stubbed tests are replaced by three named questions plus one adapter test built on a real
`SlotIndex.fromMaps` fixture, which validates. **Be honest in review: the port buys no protection
against a rename that a typed parameter would not also buy. It moves the break to one place instead
of three.**

**T3, and it can go further than proposed.** `cast edges --from kontexte --to readmodel-fassade`
returns exactly one edge, at `mandatoryListRules.js:28`. Of the 16 edges into the door, 13 come from
`src/ui/viewmodels/`, 1 from `kontexte`, 2 from `src/tests/test-utils/`. The review proposed
narrowing `lesemodell-die-eine-tuer` from `**` to `src/ui/**`; **`src/ui/viewmodels/**` is correct**,
because `allowed` entries act globally and the `**` form silently disables `komponente-kein-bericht`
(`src/ui/components/** -> src/contexts/ruleengine/**`) for the door as well. The two
`src/tests/test-utils/*.jsx` do not break: no `forbidden` rule targets `readmodel-fassade` from the
`tests` layer, so they need no exception.

**Do not create `src/composition/`.** Two premises in the review were wrong: cast reports
`unassigned 5` today (all outside `src/`), not 0, and `layers.json:13` catches everything with
`"src/**": "app"` — so a new folder would land in layer `app`, which carries **no forbidden rule at
all** and would be entirely unregulated. Regulating it costs one layer entry and five rules for two
functions. The adapter goes to `src/ui/viewmodels/raisePlanAdapter.js`, where
`capabilityEntries.js` already sits for exactly the same reason, at zero configuration cost.

Cut into three sequential increments: **1** port typedef, adapter, `raiseUnit`,
`subSelectionUseCases`; **2** `mandatoryListRules` (the read-model import falls); **3** the cast
rule, the four area notes, ADR 0043, glossary and project map. No version bump.

## Acceptance criteria

- AC1: `src/contexts/armylist/ports/raisePlanPort.js` exists and declares exactly the three members `membersRaisedInForce`, `membersRaisedUnderSelection`, `mandatoryListRuleGapsInForce`. | verify: `bash -c 'test "$(grep -c "@property {(" src/contexts/armylist/ports/raisePlanPort.js)" -eq 3'`
- AC2: No module under `src/contexts/armylist/` imports `src/contexts/ruleengine/` — neither as a value nor as a JSDoc type. | verify: `bash -c '! grep -rqn ruleengine src/contexts/armylist/'`
- AC3: No use case under `src/contexts/armylist/application/` names `slots` or a `SlotIndex` method. | verify: `bash -c '! grep -rqnE "slots|findChildSlot|findDescendantSlot|pathOfForce|pathOfSelection|slotOfSelection" src/contexts/armylist/application/'`
- AC4: `.cast/rules.json` allows the read-model door only from `src/ui/viewmodels/**`. | verify: `bash -c 'node -e "const r=require(\"./.cast/rules.json\");const e=r.allowed.filter(a=>a.name===\"lesemodell-die-eine-tuer\");process.exit(e.length===1&&e[0].from===\"src/ui/viewmodels/**\"?0:1)"'`
- AC5: The edge `kontexte -> readmodel-fassade` is gone and cast is green. | verify: `forge-lint`
- AC6: The typecheck is green and holds the port — a deliberately mistyped port method in a use case fails it. | verify: `forge-typecheck`
- AC7: The adapter has its own test proving all three port members against a real `SlotIndex.fromMaps` fixture. | verify: `forge-test --run src/tests/ui/viewmodels/raisePlanAdapter`
- AC8: The use-case tests still render nothing and stub only the port. | verify: `forge-test --run src/tests/contexts/armylist`
- AC9: The editor session, the `.ros` import and roster creation still fill the §9.9 mandatory rules unchanged. | verify: `forge-test --run src/tests/ui/viewmodels`
- AC10: The full suite is green apart from the pinned red scenarios in `docs/testing/campaign-state.json`. | verify: `forge-test`
- AC11: The raise path in the running app is unchanged. | verify: `node e2e/ui.test.js`
- AC12: No dead export and no unused file from port or adapter. | verify: `npm run knip`
- AC13: ADR 0043 exists, continues ADR-0039 and has its row in `docs/adr/README.md`. | verify: `bash -c 'grep -q 0043 docs/adr/README.md'`
- AC14: The area notes no longer claim `slots` is `Object` or that the door is open to everyone. | verify: `bash -c '! grep -rqn "typed as .Object\|von überall importiert werden darf" .claude/rules/areas/'`

## Out of scope

- `src/contexts/armylist/model/rosterSerialization.js:98,179,188,203` (`slots.slotOfSelection`,
  `capability.name`, `capability.costs`). A display/export question, a different port. After this
  issue it is the **only** place under `src/contexts/armylist/` still touching `SlotIndex`, which is
  why AC2/AC3 are cut at the import graph and at `application/` rather than at "armylist knows no
  slots".
- `@param {Object} system` at 10 places in 7 files — `noImplicitAny` debt, no second port.
- Turning `noImplicitAny` on. Its own issue, folder by folder.
- `src/composition/` as its own layer. Recommendation: do not create it.
- Any rename inside `ruleengine`. `SlotIndex` stays; the port translates, it does not rename.
- The other findings of the review.

## Open questions

1. **`rosterSerialization` stays out.** Afterwards one place in the write model still knows the slot
   index, as `{slots: Object}`. Leave it, bring it along as a second `RosterExportView` port
   (+1 port, +1 adapter, a changed `exportRosterToXml` signature, +3 tests), or make it a follow-up?
   Recommendation: follow-up.
2. **`useRosterState.mandatoryAutoAdd.test.js`** mocks an *internal* `ruleengine` module today and
   supplies `entry` with it; after the change the use case resolves `entry` itself. May that file be
   rewritten (mock on `raisePlanAdapter`), or must its AC wording be preserved verbatim?
3. **Identity stability.** `raisePlanOf(slots)` returns a new object per call, so in
   `useRosterState.js` it **must** be `useMemo(…, [slots])` — otherwise the
   `useMandatoryListRuleAutoAdd` effect runs on every render and walks every force. No infinite
   loop, but wasteful. Should AC9 gain a render-count test?
4. **The name.** `RaisePlan` / *Aushebe-Plan* is a new domain term and needs a `docs/glossary.md`
   row. Alternatives: `RaiseAdvice`, `RaiseOracle`, `ReportQuestions`.
5. **Narrowing to `src/ui/viewmodels/**` rather than `src/ui/**`** restores `komponente-kein-bericht`
   for the door. If a component should ever read the report, that becomes a deliberate rule-change
   commit. Agreed?
6. **Is ADR 0043 required?** The port changes nothing about ADR-0039's decision but everything about
   its execution, and two area notes record today's state as intent. Or does continuing 0039's
   status suffice?
7. **The minimal alternative is real and should be rejected explicitly, not skipped:** replace
   `{Object}` with the `SlotIndex` type in `raiseUnit.js` and `subSelectionUseCases.js`, leave
   `mandatoryListRules.js` alone, drop T3. Cost S, gain: the typecheck. Loss: T3 stays, the graph
   keeps hiding the edge, the tests stay hand-stubbed.
