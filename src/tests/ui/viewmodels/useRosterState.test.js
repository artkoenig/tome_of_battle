import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import fs from 'fs';
import path from 'path';

import { useRosterState } from '../../../ui/viewmodels/useRosterState';
import { processImportedData } from '../../../platform/battlescribe/xmlParser';
import { buildRoster } from '../../../contexts/armylist/model/createRoster';

/**
 * Issue 0162, AC1 and AC2 — `useRosterState` holds the roster, the UI selection
 * and the commands, and hands them out in three bundles split by how often they
 * change (ADR-0038). The commands keep their identity across a roster edit;
 * roster, report and selection do not, by design.
 *
 * The recruit path runs through the real fixture catalogue (nothing mocked but
 * the save callback), because `addUnit` asks the report for the obligation a
 * raise carries (Issue 0157) and a report-less seam would create a bare
 * selection.
 */

const DEFINITIVE_DIR = path.resolve('src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive');
const DEFINITIVE_GST = 'Warhammer Fantasy Battles (6th definitive edition).gst';
const VAMPIRE_COUNTS_CAT = 'Vampire Counts (6th definitive edition).cat';

function loadFixture() {
  const gstContent = fs.readFileSync(path.join(DEFINITIVE_DIR, DEFINITIVE_GST), 'utf8');
  const catContent = fs.readFileSync(path.join(DEFINITIVE_DIR, VAMPIRE_COUNTS_CAT), 'utf8');
  const { system } = processImportedData(
    [{ name: DEFINITIVE_GST, content: gstContent }],
    [{ name: VAMPIRE_COUNTS_CAT, content: catContent }],
  );
  system.rawXmls = {
    gst: [{ name: DEFINITIVE_GST, content: gstContent }],
    cat: [{ name: VAMPIRE_COUNTS_CAT, content: catContent }],
  };
  const catalogue = system.catalogues[0];
  const forceEntryId = (catalogue.forceEntries?.[0] ?? system.forceEntries?.[0])?.id;
  const roster = buildRoster(
    { name: 'test roster', systemId: system.id, catId: catalogue.id, forceEntryId, limit: 3000 },
    { costTypes: system.costTypes, forceEntries: [{ id: forceEntryId }] }
  );
  const entry = catalogue.selectionEntries.find(e => e.selectionEntries?.length || e.entryLinks?.length)
    ?? catalogue.selectionEntries[0];
  return { system, roster, entry };
}

describe('useRosterState', () => {
  it('returns the roster, the report, the selection and the commands', () => {
    const { system, roster } = loadFixture();

    const { result } = renderHook(() => useRosterState(roster, system, vi.fn()));

    expect(result.current.roster.name).toBe('test roster');
    expect(result.current.report.slots.capabilities).toBeInstanceOf(Map);
    expect(result.current.report.unresolvedSelections).toEqual([]);
    expect(result.current.selectedRosterSelection).toBeNull();
    expect(Object.keys(result.current.commands).sort()).toEqual([
      'addUnit', 'copyUnit', 'redo', 'removeUnit', 'save',
      'subSelectionOperations', 'undo', 'updateRosterName',
    ]);
    expect(result.current.canUndo).toBe(false);
  });

  it('recruits through addUnit and selects what it created', () => {
    const { system, roster, entry } = loadFixture();

    const { result } = renderHook(() => useRosterState(roster, system, vi.fn()));
    act(() => {
      result.current.commands.addUnit(entry, null);
    });

    const created = result.current.roster.forces[0].selections[0];
    expect(created).toBeTruthy();
    expect(result.current.selectedRosterSelection).toBe(created);
    expect(result.current.canUndo).toBe(true);
  });

  it('keeps the commands bundle identical across a roster edit', () => {
    const { system, roster, entry } = loadFixture();

    const { result } = renderHook(() => useRosterState(roster, system, vi.fn()));
    const commandsBefore = result.current.commands;
    const reportBefore = result.current.report;

    act(() => {
      result.current.commands.addUnit(entry, null);
    });

    expect(result.current.commands).toBe(commandsBefore);
    expect(result.current.commands.subSelectionOperations)
      .toBe(commandsBefore.subSelectionOperations);
    expect(result.current.report).not.toBe(reportBefore);
  });

  it('renames the roster through the stable command captured before the edit', () => {
    const { system, roster } = loadFixture();

    const { result } = renderHook(() => useRosterState(roster, system, vi.fn()));
    const { updateRosterName } = result.current.commands;

    act(() => {
      updateRosterName('first');
    });
    act(() => {
      updateRosterName('second');
    });

    expect(result.current.roster.name).toBe('second');
  });
});
