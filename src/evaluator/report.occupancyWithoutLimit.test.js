/**
 * Issue 0147, increment 2 — occupancy on a slot with no evaluable limit.
 *
 * Superseded rule: before this increment, `SlotCapability.current` is only
 * ever fed from a limit's evaluated result — a MIN or a MAX. A slot with no
 * limit at all, or with only an unbounded one (raw `-1`, never suspended by
 * a `set`), carries no such result and today falls back to `current: 0`,
 * whatever is actually selected under it. No existing unit test in this
 * suite pins that "no result ⇒ 0" rule: every `current` assertion elsewhere
 * sits on a slot that carries a MIN or a MAX (see `report.test.js`,
 * `evalTree.unlinkedCategoryParentScope.test.js`). This file pins the rule
 * that supersedes it: `current` counts actual occupancy of the anchor's
 * frame regardless of whether a limit produced a result — the fallback a
 * result would report anyway, made to hold even without one.
 *
 * docs/issues/0147-evaluator-coverage-gaps/issue.md, acceptance criterion 2:
 * an unconditional `set-primary field="category"` secures membership on its
 * own, with no `categoryLink` and no `add`. The category's anchor — which
 * today counts only linked members — must count that membership too, and
 * this is the concrete unit-level case where the missing occupancy shows:
 * the category anchor of an unconditionally-linked category with no bound
 * (or no constraint at all) never got a limit result to read `current` from.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate as evaluateDataset, prepareDataset } from './evaluator.js';
import { AnchorKind } from './model.js';

// jsdom supplies DOMParser for the Node test run (convention shared by every
// evaluator test file); the engine's own XML reader relies on exactly this
// primitive.
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

/**
 * Evaluates a single synthetic catalogue over the two-stage public facade
 * (convention shared by every evaluator test file: prepare, then evaluate).
 */
function evaluate(catalogXml, roster) {
  return evaluateDataset(prepareDataset({ catalogues: [catalogXml] }), roster);
}

/** The occupied (really selected) slot of a definition id — or null. */
function occupiedSlotOf(report, defId) {
  for (const capability of report.capabilities.values()) {
    if (capability.defId === defId && capability.anchorKind === AnchorKind.OCCUPIED) {
      return capability;
    }
  }
  return null;
}

/** The offer anchor (offered, not selected) of a definition id — or null. */
function offerSlotOf(report, defId) {
  for (const capability of report.capabilities.values()) {
    if (capability.defId === defId && capability.anchorKind === AnchorKind.OFFER_ANCHOR) {
      return capability;
    }
  }
  return null;
}

/** The category anchor of a category id, matched by `targetDefId` (convention: report.test.js). */
function categoryAnchorOf(report, categoryId) {
  return [...report.capabilities.values()].find(
    capability => capability.anchorKind === AnchorKind.CATEGORY_ANCHOR && capability.targetDefId === categoryId,
  );
}

/** The violations that fired for one limit id. */
function violationsOf(report, limitId) {
  return report.violations.filter(violation => violation.limitId === limitId);
}

/**
 * The limit must fire: at least one violation, and EVERY one carries the
 * expected actual/bound pair. Deliberately silent on the COUNT of violations
 * — how many anchors a shared limit reports through is report form, not
 * counting semantics (convention: constraints.carrierDescendants.test.js).
 */
function expectFiring(report, limitId, { actual, bound }) {
  const violations = violationsOf(report, limitId);
  expect(violations.length, `limit ${limitId} must fire`).toBeGreaterThanOrEqual(1);
  for (const violation of violations) {
    expect(violation, `every violation of ${limitId} carries actual/bound`).toMatchObject({ actual, bound });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cases 1, 2, 7: a category anchor whose only constraint is unbounded still
// counts its members.
// ─────────────────────────────────────────────────────────────────────────────

describe('category anchor with an unbounded limit counts its members instead of staying at 0', () => {
  const FORCE_ID = 'force-standard';
  const CAT_ID = 'cat-elite';
  const LIMIT_ID = 'limit-elite-max';
  const MEMBER_ID = 'entry-member';
  const OTHER_ID = 'entry-other';

  // The category's only constraint carries raw value -1 (unbounded, §7.6
  // sentinel) — no MIN/MAX ever produces a firing result here.
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-unlimited-category" name="Unlimited Category Catalogue">
      <categoryEntries>
        <categoryEntry id="${CAT_ID}" name="Elite"/>
      </categoryEntries>
      <forceEntries>
        <forceEntry id="${FORCE_ID}" name="Standard">
          <categoryLinks>
            <categoryLink id="link-elite" name="Elite" targetId="${CAT_ID}">
              <constraints>
                <constraint id="${LIMIT_ID}" type="max" value="-1" field="selections" scope="parent"/>
              </constraints>
            </categoryLink>
          </categoryLinks>
        </forceEntry>
      </forceEntries>
      <selectionEntries>
        <selectionEntry id="${MEMBER_ID}" name="Member" type="unit">
          <categoryLinks>
            <categoryLink targetId="${CAT_ID}"/>
          </categoryLinks>
        </selectionEntry>
        <selectionEntry id="${OTHER_ID}" name="Other" type="unit"/>
      </selectionEntries>
    </catalogue>`;

  function army(children) {
    return { forces: [{ defId: FORCE_ID, count: 1, children }] };
  }

  it('case 1: reports current 1 for one member, and leaves effectiveMax/headroom null; the unbounded limit never fires', () => {
    const report = evaluate(CATALOGUE_XML, army([{ defId: MEMBER_ID, count: 1, children: [] }]));

    expect(report.diagnostics).toEqual([]);
    expect(categoryAnchorOf(report, CAT_ID)).toMatchObject({
      current: 1,
      effectiveMax: null,
      headroom: null,
    });
    expect(violationsOf(report, LIMIT_ID)).toEqual([]);
  });

  it('case 2 (counter-case): a selection with no membership in the category leaves the anchor at current 0', () => {
    const report = evaluate(CATALOGUE_XML, army([{ defId: OTHER_ID, count: 1, children: [] }]));

    expect(report.diagnostics).toEqual([]);
    expect(categoryAnchorOf(report, CAT_ID)).toMatchObject({ current: 0 });
  });

  it('case 7 (edge): two members in the same force give the anchor current 2, not a boolean-ish 1', () => {
    const report = evaluate(CATALOGUE_XML, army([{ defId: MEMBER_ID, count: 2, children: [] }]));

    expect(report.diagnostics).toEqual([]);
    expect(categoryAnchorOf(report, CAT_ID)).toMatchObject({ current: 2 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Case 3: membership secured by `set-primary` alone — the unit-level mirror of
// scenario set-primary-category-membership.
// ─────────────────────────────────────────────────────────────────────────────

describe('set-primary alone secures membership in the category anchor (unit-level mirror of scenario set-primary-category-membership)', () => {
  const FORCE_ID = 'force-standard';
  const CAT_ID = 'cat-regiment-of-renown';
  const KATHLEEN_ID = 'entry-kathleen';

  // No categoryLink to the category at all — the ONLY thing that ties
  // Kathleen to it is the unconditional set-primary modifier.
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-set-primary-membership" name="Set Primary Membership Catalogue">
      <categoryEntries>
        <categoryEntry id="${CAT_ID}" name="Regiment of Renown"/>
      </categoryEntries>
      <forceEntries>
        <forceEntry id="${FORCE_ID}" name="Standard">
          <categoryLinks>
            <categoryLink id="link-regiment" name="Regiment of Renown" targetId="${CAT_ID}"/>
          </categoryLinks>
        </forceEntry>
      </forceEntries>
      <selectionEntries>
        <selectionEntry id="${KATHLEEN_ID}" name="Kathleen" type="unit">
          <modifiers>
            <modifier type="set-primary" field="category" value="${CAT_ID}"/>
          </modifiers>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('reports the category anchor at current 1, and the unit slot itself carries the category as membership and as primary', () => {
    const report = evaluate(CATALOGUE_XML, {
      forces: [{ defId: FORCE_ID, count: 1, children: [{ defId: KATHLEEN_ID, count: 1, children: [] }] }],
    });

    expect(report.diagnostics).toEqual([]);
    expect(categoryAnchorOf(report, CAT_ID)).toMatchObject({ current: 1 });
    const own = occupiedSlotOf(report, KATHLEEN_ID);
    expect(own).not.toBeNull();
    expect(own.categoryIds).toContain(CAT_ID);
    expect(own.primaryCategoryId).toBe(CAT_ID);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Case 4: regression guard — where a limit DOES produce a result, that result
// still wins over the occupancy fallback, even when it disagrees with the
// carrier-local count.
// ─────────────────────────────────────────────────────────────────────────────

describe('regression guard: an evaluated limit result still wins over the occupancy fallback', () => {
  const FORCE_ID = 'force-main';
  const HERO_ID = 'entry-hero';
  const RELIC_LINK_A_ID = 'link-relic-a';
  const RELIC_LINK_B_ID = 'link-relic-b';
  const SHARED_RELIC_ID = 'shared-relic';
  const RELIC_ROSTER_MAX_ID = 'max-one-relic-in-roster';

  // A shared target reached by two different heroes through two different
  // entryLinks, with a roster-wide max: its `actual` counts EVERY occurrence
  // army-wide, not the one occurrence under any single hero
  // (pattern shared with constraints.carrierDescendants.test.js).
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-limit-wins-over-probe" name="Limit Wins Over Probe Catalogue">
      <forceEntries>
        <forceEntry id="${FORCE_ID}" name="Main Force"/>
      </forceEntries>
      <selectionEntries>
        <selectionEntry id="${HERO_ID}" name="Hero" type="unit">
          <entryLinks>
            <entryLink id="${RELIC_LINK_A_ID}" name="Relic (Door A)" targetId="${SHARED_RELIC_ID}" type="selectionEntry"/>
            <entryLink id="${RELIC_LINK_B_ID}" name="Relic (Door B)" targetId="${SHARED_RELIC_ID}" type="selectionEntry"/>
          </entryLinks>
        </selectionEntry>
      </selectionEntries>
      <sharedSelectionEntries>
        <selectionEntry id="${SHARED_RELIC_ID}" name="Relic" type="upgrade" import="true" hidden="false" collective="false">
          <constraints>
            <constraint type="max" value="1" field="selections" scope="roster" shared="true" id="${RELIC_ROSTER_MAX_ID}" percentValue="false" includeChildSelections="false" includeChildForces="false"/>
          </constraints>
        </selectionEntry>
      </sharedSelectionEntries>
    </catalogue>`;

  it('reports the army-wide actual of the limit at a carrier that only holds one occurrence itself', () => {
    const report = evaluate(CATALOGUE_XML, {
      forces: [{
        defId: FORCE_ID,
        count: 1,
        children: [
          { defId: HERO_ID, count: 1, children: [{ defId: RELIC_LINK_A_ID, count: 1, children: [] }] },
          { defId: HERO_ID, count: 1, children: [{ defId: RELIC_LINK_B_ID, count: 1, children: [] }] },
        ],
      }],
    });

    expect(report.diagnostics).toEqual([]);
    expectFiring(report, RELIC_ROSTER_MAX_ID, { actual: 2, bound: 1 });
    // Under its own hero there is exactly one occurrence — an occupancy probe
    // limited to that frame would read 1. The limit's result counts
    // army-wide: current must stay 2, proving the fallback did not take over
    // a slot that already has a result.
    const slotA = occupiedSlotOf(report, RELIC_LINK_A_ID);
    expect(slotA).not.toBeNull();
    expect(slotA.current).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Case 5: the ordinary occupied slot with no constraint at all — the biggest
// population this rule changes.
// ─────────────────────────────────────────────────────────────────────────────

describe('occupied slot with no constraint at all reports its real count', () => {
  const FORCE_ID = 'force-plain';
  const UNIT_ID = 'entry-unconstrained';

  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-unconstrained-slot" name="Unconstrained Slot Catalogue">
      <forceEntries>
        <forceEntry id="${FORCE_ID}" name="Plain"/>
      </forceEntries>
      <selectionEntries>
        <selectionEntry id="${UNIT_ID}" name="Unit" type="unit"/>
      </selectionEntries>
    </catalogue>`;

  it('reports current 3 (today: 0) for three instances selected directly under the force, with no MIN/MAX anywhere', () => {
    const report = evaluate(CATALOGUE_XML, {
      forces: [{ defId: FORCE_ID, count: 1, children: [{ defId: UNIT_ID, count: 3, children: [] }] }],
    });

    expect(report.diagnostics).toEqual([]);
    const capability = occupiedSlotOf(report, UNIT_ID);
    expect(capability).not.toBeNull();
    expect(capability.current).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Case 6: edge — an offered, unchosen slot must stay empty. Protects the
// offer-anchor expectations of docs/testing/offer-and-category-slots/.
// ─────────────────────────────────────────────────────────────────────────────

describe('edge: an offered but unchosen slot stays at current 0', () => {
  const FORCE_ID = 'force-plain';
  const UNIT_ID = 'entry-unselected';

  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-offer-anchor-stays-empty" name="Offer Anchor Stays Empty Catalogue">
      <forceEntries>
        <forceEntry id="${FORCE_ID}" name="Plain"/>
      </forceEntries>
      <selectionEntries>
        <selectionEntry id="${UNIT_ID}" name="Unit" type="unit"/>
      </selectionEntries>
    </catalogue>`;

  it('reports the offer anchor of a definition offered but not selected as current 0, not the count of some other frame', () => {
    const report = evaluate(CATALOGUE_XML, {
      forces: [{ defId: FORCE_ID, count: 1, children: [] }],
    });

    expect(report.diagnostics).toEqual([]);
    const offerAnchor = offerSlotOf(report, UNIT_ID);
    expect(offerAnchor).not.toBeNull();
    expect(offerAnchor.current).toBe(0);
  });
});
