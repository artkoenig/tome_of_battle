import { describe, it, expect, vi } from 'vitest';
import React, { memo } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

import {
  RosterCommandsProvider,
  RosterReportProvider,
  useRosterCommands,
  useRosterReport,
} from '../../../ui/viewmodels/rosterContexts';
import { useRosterState } from '../../../ui/viewmodels/useRosterState';

/**
 * Issue 0162, AC1 and AC2 — the two contexts of ADR-0038 and the promise that
 * justifies splitting them: a consumer that hangs on the command context alone
 * keeps the very same context value across a roster edit and therefore does not
 * render again. The proof needs a memoized consumer: without it every consumer
 * would render again simply because its parent did, and the context would prove
 * nothing.
 *
 * The editor here runs against `system = null`, so the report is the stable
 * empty evaluation — the edit under test is a rename, which needs no catalogue.
 */

function makeRoster() {
  return { id: 'r1', name: 'first', catalogueId: 'cat1', forces: [{ id: 'f1', selections: [] }] };
}

/** Hangs on the command context only — and counts how often it renders. */
function makeRenameButton(renderCounter, seenValues) {
  return memo(function RenameButton() {
    const commands = useRosterCommands();
    renderCounter.count += 1;
    seenValues.push(commands);
    return (
      <button type="button" onClick={() => commands.updateRosterName('renamed')}>
        rename
      </button>
    );
  });
}

/** Hangs on the report context — and shows what it sees. */
const RosterName = memo(function RosterName() {
  const { roster, report } = useRosterReport();
  return (
    <p data-testid="name">
      {roster?.name} / {report.violations.length}
    </p>
  );
});

function renderEditor() {
  const renderCounter = { count: 0 };
  const seenValues = [];
  const RenameButton = makeRenameButton(renderCounter, seenValues);

  function Editor() {
    const { roster, report, commands } = useRosterState(makeRoster(), null, vi.fn());
    return (
      <RosterCommandsProvider commands={commands}>
        <RosterReportProvider report={report} roster={roster}>
          <RenameButton />
          <RosterName />
        </RosterReportProvider>
      </RosterCommandsProvider>
    );
  }

  render(<Editor />);
  return { renderCounter, seenValues };
}

describe('the roster contexts', () => {
  it('serves commands and report to their consumers', () => {
    const { seenValues } = renderEditor();

    expect(screen.getByText('rename')).toBeTruthy();
    expect(screen.getByTestId('name').textContent).toContain('first');
    expect(typeof seenValues[0].raiseUnit).toBe('function');
  });

  it('keeps the command context value identical across a roster edit, so its consumer does not render again', () => {
    const { renderCounter, seenValues } = renderEditor();
    expect(renderCounter.count).toBe(1);

    fireEvent.click(screen.getByText('rename'));

    expect(screen.getByTestId('name').textContent).toContain('renamed');
    expect(renderCounter.count).toBe(1);
    expect(seenValues).toHaveLength(1);
  });

  it('rejects a consumer without its provider', () => {
    const Orphan = () => {
      useRosterCommands();
      return null;
    };
    const OrphanReport = () => {
      useRosterReport();
      return null;
    };
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<Orphan />)).toThrow(/RosterCommandsProvider/);
    expect(() => render(<OrphanReport />)).toThrow(/RosterReportProvider/);

    consoleError.mockRestore();
  });
});
