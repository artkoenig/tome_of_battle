Status: backlog
Type: fix
Blocked by: None

## Description

A bloodline-gated profile modifier does not reach the unit's profile display.
The user builds a Vampire Count in the 6th edition "definitive" Vampire Counts
catalogue, picks the Blood Dragon bloodline, and the profile table still shows
the unmodified base characteristics.

The data behind the report is in the repository as a frozen fixture, so the case
is reproducible without any catalogue download:

- `src/evaluator/__fixtures__/whfb6-definitive/Vampire Counts (6th definitive edition).cat`
- `selectionEntry` **Vampire Count** `6822-0110-a7c9-cbb0`, line 3124 ff.
- `infoLink a106-4a05-36ea-cb01` → shared profile `fabd-ef67-72f5-6b3f`
- the profile carries a `modifierGroup` whose members change WS
  (`f95b-da01-0578-3bdc`), Sv (`f1be-…`), Sv+ (`d4a9-…`) and A (`6b9f-…`)
- every member is gated by a `condition type="instanceOf"` on the Blood Dragon
  **category** `4cae-a20e-8374-b6cb`, which the unit only carries after the
  force-wide bloodline choice adds that category through a `category add`
  modifier

A reduced verbatim excerpt of the same IDs lives at
`src/__fixtures__/whfb6-lexicanum/vampire-selfscope-bloodline.cat.xml:24-70`.

Two facts from the grounding sweep, as observations and not as a prescribed fix:

1. The profile table in `src/components/editor/UnitSelectionCard.jsx:180-190`
   and `src/components/play/PlayUnitDetails.jsx:112` is fed exclusively by the
   evaluator report (`capability.infoElements`), per ADR 0034. The legacy
   `src/roster/profileCollector.js` no longer feeds it, even though its own unit
   tests for this exact bloodline case pass
   (`src/roster/modifierEvaluator.selfScope.test.js:179+`). A green legacy test
   therefore proves nothing about what the user sees.
2. `docs/testing/modifier-characteristic-value/README.md` names two shapes as
   deliberately uncovered by the existing E2E scenarios: `instanceOf` with
   `scope="unit"` on characteristic fields, and non-numeric `set` values such as
   `5+` or `24"` under those same gates. Both shapes are what the bloodline
   modifiers use.

Out of scope, to be recorded and not fixed here: `SelectionConfigurator.jsx:96-104`
and `upgradeDetails.jsx:62-93` read raw base characteristics off `resolveEntry`
with no modifier layer at all, and `UnitChips.jsx:41` still uses the legacy
collector. Those are separate display paths and separate issues.

## Acceptance Criteria
- [ ] The unit profile display shows the modified characteristic value whenever a profile modifier's condition holds for that unit.
- [ ] With the frozen `whfb6-definitive` Vampire Counts fixture, a Vampire Count in a force that has chosen the Blood Dragon bloodline reports WS as the catalogue base value plus 2, and reports the Sv, Sv+ and A values the same `modifierGroup` sets.
- [ ] The same Vampire Count in a force without that bloodline still reports the unmodified base values.
- [ ] A non-numeric characteristic value written by a gated `set` modifier, such as an armour save `5+`, reaches the display unchanged in form.
- [ ] A gated modifier whose condition uses `scope="unit"` is evaluated against the unit, not silently dropped.
- [ ] Every scope a condition on a characteristic modifier may name is evaluated against the node it names, and none is silently dropped; derive the closed list of scope values from `docs/battlescribe-data-format.md` and the Battlescribe XSD rather than from the existing code.
- [ ] Each scope value in that closed list is either covered by a test or listed in this file with the reason it cannot be covered from the catalogue data present in the repository.
- [ ] The regression is pinned by a test that exercises the path the user actually sees — the evaluator report and the component fed by it — and not only the legacy `profileCollector`.
- [ ] `npm test` passes, and the evaluator E2E suite passes.

## Comments
- Reported in German: "Profilwert-Modifikatoren z.B. bei Bloodlines werden ignoriert". The reporter confirmed the symptom is in the unit's profile display, not in rule validation, and named the "definitive edition" Vampire catalogue.
- Related, already resolved against the *old* solver and not a substitute for this fix: `docs/issues/24-charakteristik-modifier-z-b-st-rke-je-vampir-blutlinie-werden-nicht-angewendet/issue.md`.
- Relevant ADRs: 0030 (stand-alone Reinraum evaluator), 0034 (the report is the sole source for the UI), 0029, 0032, 0033 (E2E manifest runner and black-box authorship).
