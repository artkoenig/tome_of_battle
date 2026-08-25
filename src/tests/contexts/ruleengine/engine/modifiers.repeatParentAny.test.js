import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';

import { evaluate as evaluateDataset, prepareDataset } from '../../../../contexts/ruleengine/evaluator.js';
import { AnchorKind } from '../../../../contexts/ruleengine/engine/model.js';

// JSDOM provides DOMParser for the Node test run (as in the rest of the
// evaluator tests). The engine's own XML reader relies on exactly this
// primitive.
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

/**
 * Coverage cell
 * `repeat|selectionCount|parent|child=any|repeats=1|s=true|ics=false|icf=false|roundUp=false|pct=false`
 * (Issue 0147, unit-test-track round).
 *
 * The corpus's only occurrence of a repeat with `childId="any"` is `Grappling
 * Hooks` (`6eac-4ed9-4511-ff14`, a shared `selectionEntry` of
 * `src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive/Warhammer Fantasy Battles (6th
 * definitive edition).gst`) — unreachable from any roster, since nothing in
 * the corpus links to it and the game system declares no `forceEntries`. That
 * is why this cell is pinned on a synthetic dataset instead of a `.ros`
 * fixture.
 *
 * The synthetic catalogue below reproduces the construct verbatim (same
 * `<repeat>` attributes as `Grappling Hooks`) on a carrier that IS reachable,
 * so every reading below can be crossed by roster shape alone:
 * - the modifier applies once per `value` counted selections of the frame —
 *   a frame count of 0, 1 and 2 must move the modified value by 0, 1 and 2
 *   applications (cases 1-4 cross two full repetitions);
 * - the counting frame of `scope="parent"` is the selection that HOLDS the
 *   carrier (the unit), never the carrier itself and never the enclosing
 *   `selectionEntryGroup` (case 6);
 * - `childId="any"` counts any selection of that frame, whatever entry it
 *   came from (cases 3, 4, 7);
 * - the carrier counts in its own frame (case 2), and with
 *   `includeChildSelections="false"` only the frame's direct children count,
 *   so a grandchild under the carrier is excluded (case 6) — both readings
 *   carried over unchanged from `docs/testing/at-least-parent-any-reveal`
 *   (rule ALP-R5: the carrier counts itself; rule ALP-R2: only direct
 *   children count with the flag false), which pins the same scope/childId
 *   pair on the condition axis from real catalogue data;
 * - `field="selections"` counts selection QUANTITIES, not the number of XML
 *   selection elements (case 5).
 *
 * A frame count of 0 is observable only at the carrier's own OFFER anchor
 * (case 1): once the carrier is selected, it always counts itself under
 * "any" (rule ALP-R5), so an occupied carrier can never show a zero-count
 * reading — the offer anchor is the only slot where the frame can be
 * genuinely empty.
 *
 * PIN (heute gruen): the engine already applies every reading below
 * correctly for the repeat axis (it shares the same frame-counting logic the
 * condition axis was corrected to in `countIndex.frameOwnAnyTarget.test.js`,
 * Issue 0147 defect 2) — no engine change was needed to make this file pass.
 * Each case still discriminates a specific wrong reading (see the comments
 * inline); a value collected against a wrong reading is left in a code
 * comment on the case it would break.
 */

const FORCE_ID = 'force-army';
const UNIT_ID = 'entry-unit';
const GROUP_ID = 'group-gear';
const GROUP_MAX_ID = 'limit-group-gear-max';
const HOOKS_ID = 'entry-hooks';
const ROPE_ID = 'entry-rope';
const SHIELD_ID = 'entry-shield';
const TORCH_ID = 'entry-torch';
const POINTS_ID = 'cost-points';

const HOOKS_BASE_COST = 5;

// The carrier (`entry-hooks`) sits inside a group (`group-gear`, its own
// `max` constraint synthesises a group anchor that no case here observes) —
// a roster never names the group, so the carrier is always a direct child of
// the unit node in every roster below. Two plain sibling upgrades outside
// the group (`entry-shield`, `entry-torch`) and a nested child of the
// carrier (`entry-rope`) supply the frame's other selections. No
// `<costTypes>` declaration is needed: `cost-points` resolves because it
// occurs in a `<costs>` element, which is enough for `capability.costs`.
const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-repeat-parent-any" name="Repeat Parent Any Catalogue">
    <forceEntries>
      <forceEntry id="${FORCE_ID}" name="Army"/>
    </forceEntries>
    <selectionEntries>
      <selectionEntry id="${UNIT_ID}" name="Unit" type="unit">
        <selectionEntryGroups>
          <selectionEntryGroup id="${GROUP_ID}" name="Gear">
            <constraints>
              <constraint id="${GROUP_MAX_ID}" type="max" value="5" field="selections" scope="parent"
                          shared="true" includeChildSelections="false" includeChildForces="false"/>
            </constraints>
            <selectionEntries>
              <selectionEntry id="${HOOKS_ID}" name="Grappling Hooks" type="upgrade">
                <costs>
                  <cost name="Points" typeId="${POINTS_ID}" value="${HOOKS_BASE_COST}"/>
                </costs>
                <modifiers>
                  <modifier type="increment" field="${POINTS_ID}" value="1">
                    <repeats>
                      <repeat field="selections" scope="parent" value="1" percentValue="false"
                              shared="true" includeChildSelections="false" includeChildForces="false"
                              childId="any" repeats="1" roundUp="false"/>
                    </repeats>
                  </modifier>
                </modifiers>
                <selectionEntries>
                  <selectionEntry id="${ROPE_ID}" name="Rope" type="upgrade">
                    <costs>
                      <cost name="Points" typeId="${POINTS_ID}" value="0"/>
                    </costs>
                  </selectionEntry>
                </selectionEntries>
              </selectionEntry>
            </selectionEntries>
          </selectionEntryGroup>
        </selectionEntryGroups>
        <selectionEntries>
          <selectionEntry id="${SHIELD_ID}" name="Shield" type="upgrade"/>
          <selectionEntry id="${TORCH_ID}" name="Torch" type="upgrade"/>
        </selectionEntries>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

/** Evaluates the fixed synthetic catalogue above against one roster. */
function evaluate(roster) {
  return evaluateDataset(prepareDataset({ catalogues: [CATALOGUE_XML] }), roster);
}

/**
 * The capability record of a definition id at exactly the given anchor kind
 * (`AnchorKind.OCCUPIED` for a selected slot, `AnchorKind.OFFER_ANCHOR` for
 * an unselected one) — so an occupied slot can never silently answer for an
 * anchor, or the other way round.
 */
function capabilityAt(report, defId, anchorKind) {
  for (const capability of report.capabilities.values()) {
    if (capability.defId === defId && capability.anchorKind === anchorKind) {
      return capability;
    }
  }
  return null;
}

/** A force with one selected unit whose direct children are the given roster nodes. */
function armyWithUnit(children = []) {
  return {
    forces: [{
      defId: FORCE_ID,
      count: 1,
      children: [{ defId: UNIT_ID, count: 1, children }],
    }],
  };
}

function node(defId, count = 1, children = []) {
  return { defId, count, children };
}

describe('Wiederholter `increment` mit scope="parent" childId="any" (Grappling-Hooks-Konstruktion)', () => {
  it('feuert keine Anwendung bei leerem Elternrahmen — der Angebots-Anker traegt den unveraenderten Basiswert', () => {
    const report = evaluate(armyWithUnit([]));

    // A wrong reading that fired the repeat unconditionally once would give 6.
    const hooks = capabilityAt(report, HOOKS_ID, AnchorKind.OFFER_ANCHOR);
    expect(hooks).not.toBeNull();
    expect(hooks.costs[POINTS_ID]).toBe(HOOKS_BASE_COST);
  });

  it('zaehlt den Traeger im eigenen Rahmen mit — eine Auswahl bringt genau eine Anwendung', () => {
    const report = evaluate(armyWithUnit([node(HOOKS_ID)]));

    // A wrong reading that excluded the carrier from its own frame would give 5.
    const hooks = capabilityAt(report, HOOKS_ID, AnchorKind.OCCUPIED);
    expect(hooks).not.toBeNull();
    expect(hooks.costs[POINTS_ID]).toBe(HOOKS_BASE_COST + 1);
  });

  it('zaehlt eine fremde Geschwister-Auswahl unter childId="any" als zweite Anwendung, quer ueber zwei Wiederholungen', () => {
    const report = evaluate(armyWithUnit([node(HOOKS_ID), node(SHIELD_ID)]));

    // A wrong reading that fired only one application ever, or that a
    // foreign entry did not count under childId="any", would both give 6.
    const hooks = capabilityAt(report, HOOKS_ID, AnchorKind.OCCUPIED);
    expect(hooks.costs[POINTS_ID]).toBe(HOOKS_BASE_COST + 2);
  });

  it('zaehlt eine dritte, andersartige Auswahl als dritte Anwendung — childId="any" unterscheidet keine Eintraege', () => {
    const report = evaluate(armyWithUnit([node(HOOKS_ID), node(SHIELD_ID), node(TORCH_ID)]));

    // A wrong reading that dropped the second foreign entry would give 7.
    const hooks = capabilityAt(report, HOOKS_ID, AnchorKind.OCCUPIED);
    expect(hooks.costs[POINTS_ID]).toBe(HOOKS_BASE_COST + 3);
  });

  it('zaehlt die Stueckzahl einer Auswahl, nicht die Zahl ihrer XML-Selektionselemente', () => {
    const report = evaluate(armyWithUnit([node(HOOKS_ID), node(SHIELD_ID, 2)]));

    // Frame count = 1 (hooks) + 2 (shield's own quantity) = 3 applications.
    // A wrong reading counting XML selection elements instead of quantities
    // would give 7 (1 hooks + 1 shield element).
    const hooks = capabilityAt(report, HOOKS_ID, AnchorKind.OCCUPIED);
    expect(hooks.costs[POINTS_ID]).toBe(HOOKS_BASE_COST + 3);
  });

  it('zaehlt den Rahmen als die den Traeger haltende Auswahl (die Einheit) — weder der Traeger selbst noch das Enkelkind darunter zaehlen extra', () => {
    // Frame is the unit; its direct children are hooks and shield (2 total).
    // The nested rope under hooks (quantity 3) must NOT count, since
    // includeChildSelections="false" excludes it, and the group anchor must
    // never stand in for the frame either. Four wrong readings this case
    // discriminates at once: 10 with includeChildSelections="true" semantics
    // (1 + 3 + 1); 9 if the frame were the carrier itself with its own share
    // (1 + 3); 8 if the frame were the carrier without its own share (3); 5
    // if the frame were the group-gear anchor.
    const report = evaluate(armyWithUnit([node(HOOKS_ID, 1, [node(ROPE_ID, 3)]), node(SHIELD_ID)]));

    const hooks = capabilityAt(report, HOOKS_ID, AnchorKind.OCCUPIED);
    expect(hooks.costs[POINTS_ID]).toBe(HOOKS_BASE_COST + 2);
  });

  it('zaehlt eine fremde Auswahl auch am eigenen Angebots-Anker des unausgewaehlten Traegers', () => {
    const report = evaluate(armyWithUnit([node(SHIELD_ID)]));

    // A wrong reading where a foreign entry did not count under the null
    // (offer-anchor) target would give 5.
    const hooks = capabilityAt(report, HOOKS_ID, AnchorKind.OFFER_ANCHOR);
    expect(hooks).not.toBeNull();
    expect(hooks.costs[POINTS_ID]).toBe(HOOKS_BASE_COST + 1);
  });
});
