import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRosterState } from '../../../ui/viewmodels/useRosterState';
import { processImportedData } from '../../../data/parser/xmlParser';
import { buildRoster } from '../../../domain/roster/createRoster';
import { formatViolation } from '../../../ui/i18n/violationMessages';

/**
 * Issue 0140 — "Eine Pflicht-Listenregel mit Kosten wird nicht automatisch
 * gesetzt", at the seam where the user actually notices it: a freshly created
 * contingent, the real (unmocked) sweep in `src/domain/roster/listRules.js`, the real
 * auto-add effect in `useRosterState.js` and the real evaluator report behind
 * `useEvaluation`.
 *
 * Nothing is mocked here on purpose. The sibling file
 * `useRosterState.mandatoryAutoAdd.test.js` (Issue 0138) stubs
 * `findMissingMandatoryListRuleSelections` to drive the effect WIRING; this file
 * is the opposite end — it drives the whole chain from catalogue XML to the
 * report, because Issue 0140's criteria 2 and 5 are statements about what the
 * user sees in a real contingent, not about the wiring.
 *
 * The catalogue is synthetic (catalogues are fetched at runtime and are not in
 * the repository), but its central entry reproduces the real ergofang
 * `High Elf.cat` entry `a4dc-9040-d98e-7bc1` shape-for-shape, as verified in the
 * issue: root `selectionEntry`, `type="upgrade"`, `hidden="false"`, no
 * `selectionEntries`/`entryLinks`/`selectionEntryGroups`, `min value=1
 * scope="roster"` AND `max value=1 scope="roster"`, costs `pts=0`,
 * `" Casting Dice"=2`, `" Dispel Dice"=2`, and a single `categoryLink` with
 * `primary="false"` (so the entry has NO primary category at all).
 *
 * Alongside it sit the five ineligible shapes criterion 3 names — all
 * deliberately cost-free, so nothing but the feature under test can explain
 * their staying out.
 */

// ── Ids ─────────────────────────────────────────────────────────────────────

const GAME_SYSTEM_ID = 'gs-whfb6-ergofang';
const CATALOGUE_ID = 'cat-high-elf';
const FORCE_DEF_ID = 'force-high-elf-army';

/** The real entry this issue is about. */
const WHO_IS_THE_GENERAL_ID = 'a4dc-9040-d98e-7bc1';
const WHO_IS_THE_GENERAL_NAME =
  'Who Is the general? Nobody knows, roll the dice to see what it shows.';
const WHO_IS_THE_GENERAL_MIN_LIMIT_ID = 'min-who-is-the-general';

const PTS_ID = 'ecfa-8486-4f6c-c249';
const CASTING_DICE_ID = 'fcec-2340-6368-a2ba';
const DISPEL_DICE_ID = '6001-b2bf-4529-c07d';

const CASTING_DICE_COST = 2;
const DISPEL_DICE_COST = 2;

const GENERAL_CATEGORY_ID = 'cat-general';

const SPEARMEN_ID = 'entry-spearmen';
const SPEARMEN_POINTS = 100;

/** The five shapes criterion 3 keeps out — every one of them cost-free. */
const INELIGIBLE_IDS = [
  'neg-sub-choice',
  'neg-no-min',
  'neg-scope-missing',
  'neg-scope-parent',
  'neg-min-zero',
];

// ── Catalogue data ──────────────────────────────────────────────────────────

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
  <gameSystem id="${GAME_SYSTEM_ID}" name="Warhammer Fantasy Battles (ergofang)">
    <costTypes>
      <costType id="${PTS_ID}" name="pts" defaultCostLimit="-1"/>
      <costType id="${CASTING_DICE_ID}" name=" Casting Dice" defaultCostLimit="-1"/>
      <costType id="${DISPEL_DICE_ID}" name=" Dispel Dice" defaultCostLimit="-1"/>
    </costTypes>
    <categoryEntries>
      <categoryEntry id="${GENERAL_CATEGORY_ID}" name="General"/>
    </categoryEntries>
    <forceEntries>
      <forceEntry id="${FORCE_DEF_ID}" name="High Elf Army"/>
    </forceEntries>
  </gameSystem>`;

const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="${CATALOGUE_ID}" name="High Elf" gameSystemId="${GAME_SYSTEM_ID}">
    <selectionEntries>

      <!-- The real ergofang entry: mandatory army-wide, no sub-choice, costed. -->
      <selectionEntry id="${WHO_IS_THE_GENERAL_ID}" name="${WHO_IS_THE_GENERAL_NAME}" type="upgrade" hidden="false">
        <constraints>
          <constraint type="min" value="1.0" field="selections" scope="roster" shared="true" id="${WHO_IS_THE_GENERAL_MIN_LIMIT_ID}" includeChildSelections="false"/>
          <constraint type="max" value="1.0" field="selections" scope="roster" shared="true" id="max-who-is-the-general" includeChildSelections="false"/>
        </constraints>
        <costs>
          <cost name="pts" typeId="${PTS_ID}" value="0.0"/>
          <cost name=" Casting Dice" typeId="${CASTING_DICE_ID}" value="${CASTING_DICE_COST}.0"/>
          <cost name=" Dispel Dice" typeId="${DISPEL_DICE_ID}" value="${DISPEL_DICE_COST}.0"/>
        </costs>
        <categoryLinks>
          <categoryLink id="cl-who-is-the-general" name="General" targetId="${GENERAL_CATEGORY_ID}" primary="false"/>
        </categoryLinks>
      </selectionEntry>

      <!-- Criterion 3, shape 1: its own follow-on choice. -->
      <selectionEntry id="neg-sub-choice" name="Bloodlines" type="upgrade" hidden="false">
        <constraints>
          <constraint type="min" value="1.0" field="selections" scope="roster" shared="true" id="min-neg-sub-choice" includeChildSelections="false"/>
        </constraints>
        <selectionEntryGroups>
          <selectionEntryGroup id="grp-neg-sub-choice" name="Vampiric Bloodline"/>
        </selectionEntryGroups>
      </selectionEntry>

      <!-- Criterion 3, shape 2: no min constraint at all. -->
      <selectionEntry id="neg-no-min" name="Battle Standard Bearer" type="upgrade" hidden="false">
        <constraints>
          <constraint type="max" value="1.0" field="selections" scope="roster" shared="true" id="max-neg-no-min" includeChildSelections="false"/>
        </constraints>
      </selectionEntry>

      <!-- Criterion 3, shape 3: min >= 1 with no scope written (parses to "parent"). -->
      <selectionEntry id="neg-scope-missing" name="Instance-level minimum" type="upgrade" hidden="false">
        <constraints>
          <constraint type="min" value="1.0" field="selections" shared="true" id="min-neg-scope-missing" includeChildSelections="false"/>
        </constraints>
      </selectionEntry>

      <!-- Criterion 3, shape 4: min >= 1 with scope="parent". -->
      <selectionEntry id="neg-scope-parent" name="Container-relative minimum" type="upgrade" hidden="false">
        <constraints>
          <constraint type="min" value="1.0" field="selections" scope="parent" shared="true" id="min-neg-scope-parent" includeChildSelections="false"/>
        </constraints>
      </selectionEntry>

      <!-- Criterion 3, shape 5: effective min below 1 — a real opt-in switch. -->
      <selectionEntry id="neg-min-zero" name="Allow experimental rules?" type="upgrade" hidden="false">
        <constraints>
          <constraint type="min" value="0.0" field="selections" scope="roster" shared="true" id="min-neg-min-zero" includeChildSelections="false"/>
        </constraints>
      </selectionEntry>

      <!-- An ordinary, freely chosen unit — the yardstick for criterion 5. -->
      <selectionEntry id="${SPEARMEN_ID}" name="Spearmen" type="unit" hidden="false">
        <costs>
          <cost name="pts" typeId="${PTS_ID}" value="${SPEARMEN_POINTS}.0"/>
        </costs>
      </selectionEntry>

    </selectionEntries>
  </catalogue>`;

/** The app system object: parsed catalogues AND the raw XMLs the report reads. */
function appSystem() {
  const { system } = processImportedData(
    [{ name: 'whfb.gst', content: GAME_SYSTEM_XML }],
    [{ name: 'high-elf.cat', content: CATALOGUE_XML }]
  );
  system.rawXmls = {
    gst: [{ name: 'whfb.gst', content: GAME_SYSTEM_XML }],
    cat: [{ name: 'high-elf.cat', content: CATALOGUE_XML }],
  };
  return system;
}

/** A contingent as the create-roster dialog produces it: `selections` starts empty. */
function freshlyCreatedRoster() {
  return buildRoster(
    { name: 'New High Elf Army', systemId: 'system-uuid', catId: CATALOGUE_ID, forceEntryId: FORCE_DEF_ID, limit: 2000 },
    { costTypes: [{ id: PTS_ID }], forceEntries: [{ id: FORCE_DEF_ID }] }
  );
}

/** The same contingent, but pre-existing: created before this change shipped. */
function preExistingRoster(selections = []) {
  const roster = freshlyCreatedRoster();
  roster.forces[0].selections = selections;
  return roster;
}

/** A hand-made selection of the entry — how a manual pick would look. */
function manualSelectionOfTheEntry() {
  return {
    id: 'sel-manual',
    name: WHO_IS_THE_GENERAL_NAME,
    entryLinkId: null,
    selectionEntryId: WHO_IS_THE_GENERAL_ID,
    number: 1,
    category: null,
    selections: [],
  };
}

function render(roster, isFreshRoster) {
  return renderHook(() => useRosterState(roster, appSystem(), vi.fn(), undefined, isFreshRoster));
}

const rootEntryIds = (result) =>
  result.current.roster.forces[0].selections.map(s => s.selectionEntryId ?? s.entryLinkId);

/**
 * The i18n key `formatViolation` picks for a violation, with the plural suffix
 * the translate layer appends for the `count` parameter — i.e. exactly the key
 * the issue names, `validation.evaluator.selectionCount.min.roster_one`.
 */
function messageKeyOf(violation) {
  return formatViolation(violation, (key, params) =>
    `${key}${params.count === 1 ? '_one' : '_other'}`);
}

/** Every blocking message the report raises about one particular catalogue entry. */
function messageKeysAbout(result, defId) {
  return result.current.report.violations
    .filter(violation => violation.anchor?.defId === defId)
    .map(messageKeyOf);
}

const MIN_ROSTER_ONE_KEY = 'validation.evaluator.selectionCount.min.roster_one';

// ── Criterion 2: the fresh contingent ───────────────────────────────────────

describe('AC2: a newly created High Elf contingent carries the costed mandatory rule', () => {
  it('has the entry in force.selections without the user doing anything', () => {
    const { result } = render(freshlyCreatedRoster(), true);

    expect(rootEntryIds(result)).toContain(WHO_IS_THE_GENERAL_ID);
  });

  it('no longer raises "The army still needs a …" for it', () => {
    const { result } = render(freshlyCreatedRoster(), true);

    expect(messageKeysAbout(result, WHO_IS_THE_GENERAL_ID)).not.toContain(MIN_ROSTER_ONE_KEY);
  });

  it('adds it exactly once, not once per render pass', () => {
    const { result } = render(freshlyCreatedRoster(), true);

    const occurrences = rootEntryIds(result).filter(id => id === WHO_IS_THE_GENERAL_ID);
    expect(occurrences).toHaveLength(1);
  });

  it('AC2 edge: adds it although its only categoryLink is primary="false" — it has no primary category', () => {
    const { result } = render(freshlyCreatedRoster(), true);

    const selection = result.current.roster.forces[0].selections
      .find(s => s.selectionEntryId === WHO_IS_THE_GENERAL_ID);
    expect(selection, 'the entry without a primary category must still be added').toBeDefined();
    expect(selection.category ?? null).toBeNull();
  });

  it('AC2/AC3: adds that entry and nothing else — the five ineligible shapes stay out', () => {
    const { result } = render(freshlyCreatedRoster(), true);

    expect(rootEntryIds(result)).toEqual([WHO_IS_THE_GENERAL_ID]);
  });

  it('AC3: each ineligible shape individually stays out of the fresh contingent', () => {
    const { result } = render(freshlyCreatedRoster(), true);

    for (const ineligibleId of INELIGIBLE_IDS) {
      expect(rootEntryIds(result), `${ineligibleId} must not be auto-added`).not.toContain(ineligibleId);
    }
  });
});

// ── Criterion 4: a pre-existing roster is never changed retroactively ────────

describe('AC4: a roster that existed before this change is left alone', () => {
  it('the fresh contingent gains the entry while the pre-existing one does not', () => {
    const { result: fresh } = render(freshlyCreatedRoster(), true);
    const { result: existing } = render(preExistingRoster(), false);

    expect(rootEntryIds(fresh)).toContain(WHO_IS_THE_GENERAL_ID);
    expect(rootEntryIds(existing)).not.toContain(WHO_IS_THE_GENERAL_ID);
  });

  it('the pre-existing roster keeps the blocking message it had before — a manual fix as ever', () => {
    const { result } = render(preExistingRoster(), false);

    expect(rootEntryIds(result)).toEqual([]);
    expect(messageKeysAbout(result, WHO_IS_THE_GENERAL_ID)).toContain(MIN_ROSTER_ONE_KEY);
  });

  it('an omitted fresh-marker is the safe default: nothing is added', () => {
    const { result } = renderHook(() => useRosterState(preExistingRoster(), appSystem(), vi.fn()));

    expect(result.current.roster.forces[0].selections).toEqual([]);
  });
});

// ── Criterion 5: the auto-added entry's costs count like any other's ─────────

describe('AC5: the costs of the auto-added entry count in the report', () => {
  it('the fresh contingent reports its 2 Casting Dice and 2 Dispel Dice', () => {
    const { result } = render(freshlyCreatedRoster(), true);

    expect(result.current.report.costTotals).toEqual({
      [PTS_ID]: 0,
      [CASTING_DICE_ID]: CASTING_DICE_COST,
      [DISPEL_DICE_ID]: DISPEL_DICE_COST,
    });
  });

  it('reports exactly what the same selection reports when it was there all along — no special handling', () => {
    const { result: autoAdded } = render(freshlyCreatedRoster(), true);
    const { result: manuallyPresent } = render(preExistingRoster([manualSelectionOfTheEntry()]), false);

    expect(autoAdded.current.report.costTotals).toEqual(manuallyPresent.current.report.costTotals);
  });

  it('its costs add to the costs of a unit chosen afterwards rather than replacing them', () => {
    const system = appSystem();
    const spearmen = system.catalogues[0].selectionEntries.find(e => e.id === SPEARMEN_ID);
    const { result } = renderHook(
      () => useRosterState(freshlyCreatedRoster(), system, vi.fn(), undefined, true)
    );

    act(() => {
      result.current.commands.addUnit(spearmen, null);
    });

    expect(result.current.report.costTotals).toEqual({
      [PTS_ID]: SPEARMEN_POINTS,
      [CASTING_DICE_ID]: CASTING_DICE_COST,
      [DISPEL_DICE_ID]: DISPEL_DICE_COST,
    });
  });
});

// ── Criterion 5, the budgeted cost type ─────────────────────────────────────

/**
 * Points is the one cost type a roster is budgeted in, so it is the one whose
 * costs can produce a cost-limit violation. The entry above carries `pts=0`, so
 * nothing there drives an auto-added POINTS cost through the report. Criterion 5
 * admits no special handling of an auto-added entry's costs, so if such an entry
 * pushes the army over its limit, the report must say so exactly as it would for
 * a selection the user picked.
 *
 * No real catalogue entry in either configured source carries points on a
 * mandatory root list rule (the issue measured this), so this fixture is
 * deliberately synthetic — the criterion is about the absence of special
 * handling, not about a catalogue that exists today.
 */
const DWARF_SYSTEM_ID = 'gs-whfb6-definitive';
const DWARF_CATALOGUE_ID = 'cat-dwarfs';
const DWARF_FORCE_DEF_ID = 'force-dwarf-army';
const DWARF_RULES_ID = 'forces-of-dwarfs-army-rules';
const DWARF_RULES_NAME = "Forces of Dwarfs' Army Rules";
const DWARF_RULES_POINTS = 150;
const DWARF_RULES_DISPEL_DICE = 2;

const DWARF_GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
  <gameSystem id="${DWARF_SYSTEM_ID}" name="Warhammer Fantasy Battles (definitive)">
    <costTypes>
      <costType id="${PTS_ID}" name="pts" defaultCostLimit="-1"/>
      <costType id="${DISPEL_DICE_ID}" name=" Dispel Dice" defaultCostLimit="-1"/>
    </costTypes>
    <forceEntries>
      <forceEntry id="${DWARF_FORCE_DEF_ID}" name="Dwarf Army"/>
    </forceEntries>
  </gameSystem>`;

const DWARF_CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="${DWARF_CATALOGUE_ID}" name="Dwarfs" gameSystemId="${DWARF_SYSTEM_ID}">
    <selectionEntries>
      <selectionEntry id="${DWARF_RULES_ID}" name="${DWARF_RULES_NAME}" type="upgrade" hidden="false">
        <constraints>
          <constraint type="min" value="1.0" field="selections" scope="force" shared="true" id="min-forces-of-dwarfs" includeChildSelections="false"/>
        </constraints>
        <costs>
          <cost name="pts" typeId="${PTS_ID}" value="${DWARF_RULES_POINTS}.0"/>
          <cost name=" Dispel Dice" typeId="${DISPEL_DICE_ID}" value="${DWARF_RULES_DISPEL_DICE}.0"/>
        </costs>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

function dwarfSystem() {
  const { system } = processImportedData(
    [{ name: 'whfb-definitive.gst', content: DWARF_GAME_SYSTEM_XML }],
    [{ name: 'dwarfs.cat', content: DWARF_CATALOGUE_XML }]
  );
  system.rawXmls = {
    gst: [{ name: 'whfb-definitive.gst', content: DWARF_GAME_SYSTEM_XML }],
    cat: [{ name: 'dwarfs.cat', content: DWARF_CATALOGUE_XML }],
  };
  return system;
}

function dwarfRoster(limit, selections = []) {
  const roster = buildRoster(
    { name: 'New Dwarf Army', systemId: 'system-uuid', catId: DWARF_CATALOGUE_ID, forceEntryId: DWARF_FORCE_DEF_ID, limit },
    { costTypes: [{ id: PTS_ID }], forceEntries: [{ id: DWARF_FORCE_DEF_ID }] }
  );
  roster.forces[0].selections = selections;
  return roster;
}

/** A hand-made selection of the points-costed rule — how a manual pick would look. */
function manualDwarfSelection() {
  return {
    id: 'sel-manual-dwarf',
    name: DWARF_RULES_NAME,
    entryLinkId: null,
    selectionEntryId: DWARF_RULES_ID,
    number: 1,
    category: null,
    selections: [],
  };
}

function renderDwarf(roster, isFreshRoster) {
  return renderHook(() => useRosterState(roster, dwarfSystem(), vi.fn(), undefined, isFreshRoster));
}

/** The report's cost-limit violations for the roster's budgeted cost type. */
function pointsBudgetViolations(result) {
  return result.current.report.violations.filter(
    violation => violation.limit?.measure === 'rosterBudget'
      && violation.limit?.kind === 'max'
      && violation.limit?.costTypeId === PTS_ID
  );
}

const GENEROUS_LIMIT = 2000;
const TIGHT_LIMIT = 100;

describe('AC5: an auto-added entry with a POINTS cost counts against the budget like any other', () => {
  it('its points reach the report totals', () => {
    const { result } = renderDwarf(dwarfRoster(GENEROUS_LIMIT), true);

    expect(rootEntryIds(result)).toContain(DWARF_RULES_ID);
    expect(result.current.report.costTotals[PTS_ID]).toBe(DWARF_RULES_POINTS);
    expect(result.current.report.costTotals[DISPEL_DICE_ID]).toBe(DWARF_RULES_DISPEL_DICE);
  });

  it('under a generous limit the report raises no cost-limit violation (control)', () => {
    const { result } = renderDwarf(dwarfRoster(GENEROUS_LIMIT), true);

    expect(pointsBudgetViolations(result)).toEqual([]);
  });

  it('pushing the army over its cost limit is reported, not exempted', () => {
    const { result } = renderDwarf(dwarfRoster(TIGHT_LIMIT), true);

    const violations = pointsBudgetViolations(result);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      severity: 'error',
      actual: DWARF_RULES_POINTS,
      bound: TIGHT_LIMIT,
    });
  });

  it('reports the very same overrun as when the user had picked the entry themselves', () => {
    const { result: autoAdded } = renderDwarf(dwarfRoster(TIGHT_LIMIT), true);
    const { result: manuallyPresent } = renderDwarf(dwarfRoster(TIGHT_LIMIT, [manualDwarfSelection()]), false);

    expect(autoAdded.current.report.costTotals).toEqual(manuallyPresent.current.report.costTotals);
    expect(pointsBudgetViolations(autoAdded).map(v => ({ actual: v.actual, bound: v.bound })))
      .toEqual(pointsBudgetViolations(manuallyPresent).map(v => ({ actual: v.actual, bound: v.bound })));
  });
});
