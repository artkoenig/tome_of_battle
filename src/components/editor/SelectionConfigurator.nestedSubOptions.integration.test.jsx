import React from 'react';
import { describe, test, expect, beforeAll, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import SelectionConfigurator from './SelectionConfigurator';
import { createSubSelectionOperationsMock } from '../../test-utils/subSelectionOperationsMock';
import { processImportedData } from '../../parser/xmlParser.js';
import { resolveEntry } from '../../solver/catalogResolver.js';
import { createSelectionFromDef } from '../../solver/selectionFactory.js';
import { replaceSelectionById, rootSelectionsOf } from '../../solver/rosterTree.js';
import { withChangedOptionCount } from '../../solver/subSelectionEditing.js';
import { getUnitOptions } from '../../solver/optionsCollector.js';

// Issue 57/05 — the visual counterpart to the 57/04 data-model fix, exercised through the
// REAL editor against the REAL Vampire Counts catalogue. The same shape as the reported
// Empire Captain case: Master Necromancer → group "Mounts" → upgrade-type mount "Nightmare"
// → nested "Barding". With the mount chosen, Barding is re-emitted with the mount's roster
// selection as its owner. The editor must render Barding indented directly beneath the
// mount's row, not as a separate top-level section on the same level.
//
// Only the two peripheral seams are stubbed (rule-link lookup and the settings context);
// the solver facade, the grouping and the nesting logic all run for real.

vi.mock('../../data/rulesLookup', () => ({
  getRuleUrl: () => null,
}));

vi.mock('../../contexts/SettingsContext', () => ({
  useSettings: () => ({ whfb6LinkingEnabled: false }),
}));

const CATALOG_DIR = path.resolve('src/solver/__fixtures__/whfb6');
const GST_FILE = 'Warhammer Fantasy Battle 6th edition.gst';
const CAT_FILE = 'Vampire Counts.cat';

const MASTER_NECROMANCER_ID = '4ee2-ac3a-3cc6-11af';
const NIGHTMARE_LINK_ID = 'ba19-24a1-412f-569e';
const BARDING_ID = '3fa3-1556-3275-1f71';

let system;
let catalogueId;

beforeAll(() => {
  const gstContent = fs.readFileSync(path.join(CATALOG_DIR, GST_FILE), 'utf8');
  const cat = { name: CAT_FILE, content: fs.readFileSync(path.join(CATALOG_DIR, CAT_FILE), 'utf8') };
  system = processImportedData([{ name: 'gst', content: gstContent }], [cat]).system;
  catalogueId = system.catalogues[0].id;
});

const buildNecromancerRoster = () => {
  const necroEntry = system.catalogues[0].selectionEntries.find(e => e.id === MASTER_NECROMANCER_ID);
  const unit = createSelectionFromDef({ system, resolveEntry, catalogueId, entry: necroEntry, categoryId: 'characters' });
  return { catalogueId, name: 'test', forces: [{ id: 'force-1', catalogueId, selections: [unit] }] };
};

// Mirrors useRoster.subSelectionOperations.increaseCount incl. the 57/04 fix: the edit
// targets the collected option's ownerSelectionId when present, else the unit itself.
const selectOption = (roster, collectedOption) => {
  const unitId = rootSelectionsOf(roster)[0].id;
  const targetId = collectedOption.ownerSelectionId || unitId;
  const roots = replaceSelectionById(rootSelectionsOf(roster), targetId, node => ({
    ...node,
    selections: withChangedOptionCount(
      node.selections || [], collectedOption.option.id, 1,
      () => createSelectionFromDef({ system, resolveEntry, catalogueId, entry: collectedOption.option })
    )
  }));
  return { ...roster, forces: [{ ...roster.forces[0], selections: roots }] };
};

const renderConfigurator = (roster) =>
  render(
    <SelectionConfigurator
      selection={rootSelectionsOf(roster)[0]}
      system={system}
      roster={roster}
      subSelectionOperations={createSubSelectionOperationsMock()}
      activeCatalogue={system.catalogues[0]}
      handleMouseEnter={vi.fn()}
      handleMouseMove={vi.fn()}
      handleMouseLeave={vi.fn()}
      setActiveInfo={vi.fn()}
      onShowRule={vi.fn()}
    />
  );

describe('SelectionConfigurator nests a re-emitted sub-option under its parent row (Issue 57/05)', () => {
  test('Barding renders indented beneath the chosen mount, not as a top-level section', () => {
    // getUnitOptions re-emits a sub-option only once its parent is selected, so we select
    // the mount and then Barding, exactly as the user path does.
    let roster = buildNecromancerRoster();
    // The configurator collects options itself; here we only need the ids to drive edits.
    const optionsOf = (r) => getUnitOptions(system, catalogueId, rootSelectionsOf(r)[0]);

    roster = selectOption(roster, optionsOf(roster).find(o => o.option.id === NIGHTMARE_LINK_ID));
    roster = selectOption(roster, optionsOf(roster).find(o => o.option.id === BARDING_ID));

    const { container } = renderConfigurator(roster);

    // Barding is on screen and lives inside a nested (indented) block, not at the top level.
    const bardingLabel = screen.getByText('Barding');
    const nestedBlock = bardingLabel.closest('.nested-option-block');
    expect(nestedBlock).not.toBeNull();

    // It sits below the top-level Mounts section, which itself is NOT nested.
    const topLevelContainer = container.querySelector('.sub-selection-group--flush');
    expect(topLevelContainer).not.toBeNull();
    expect(nestedBlock.parentElement).not.toBe(null);

    const mountsHeader = screen.getByText('Mounts');
    expect(mountsHeader.closest('.nested-option-block')).toBeNull();

    // The nested block is a descendant of the top-level container (indented within it),
    // proving Barding is a child of the parent row rather than a sibling section.
    expect(topLevelContainer.contains(nestedBlock)).toBe(true);
  });
});
