import React from 'react';
import { readFileSync } from 'fs';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlayUnitDetails from './PlayUnitDetails';
import { parseCatalogueXML } from '../../parser/xmlParser.js';

// End-to-end renderer coverage for infoGroups (slice 04): a profile bundled
// through an inline infoGroup must actually reach a rendered profile table.
// Unlike the unit tests in PlayUnitDetails.test.jsx, the solver is NOT mocked
// here, so the real bridge (collectUnitProfilesAndRules -> resolveEntry ->
// groupProfilesByType) is exercised against a schema-valid fixture. Only the
// chip sub-components are stubbed, to avoid their SettingsContext dependency and
// keep the assertion focused on the profile tables.
vi.mock('lucide-react', () => ({
  Plus: () => <span data-testid="icon-plus" />,
  Minus: () => <span data-testid="icon-minus" />,
  ReceiptText: (props) => <span data-testid="icon-receipt-text" {...props} />,
}));

vi.mock('../editor/UnitChips', () => ({
  UnitUpgradesChips: () => <div data-testid="unit-upgrades-chips" />,
  UnitRulesChips: () => <div data-testid="unit-rules-chips" />,
}));

const catalogueXml = readFileSync(
  './src/solver/__fixtures__/generic/generic-infogroups.cat',
  'utf-8'
);
const catalogue = parseCatalogueXML(catalogueXml);
const system = { id: 'sys-generic-1', name: 'Generic Test System', catalogues: [catalogue] };

function makeProps() {
  const selection = {
    id: 'sel-guardian',
    name: 'Arcane Guardian',
    selectionEntryId: 'unit-guardian',
    number: 1,
    selections: [],
  };
  return {
    selection,
    system,
    roster: {
      id: 'roster-1',
      catalogueId: catalogue.id,
      costLimitType: 'pts',
      forces: [{ id: 'force-1', catalogueId: catalogue.id, selections: [selection] }],
    },
    gameState: { wounds: {} },
    handleAdjustWound: vi.fn(),
    handleMouseEnter: vi.fn(),
    handleMouseLeave: vi.fn(),
    setSaveSummaryData: vi.fn(),
    setSaveSummaryOpen: vi.fn(),
    onShowRule: vi.fn(),
  };
}

describe('PlayUnitDetails infoGroup-bundled profiles', () => {
  it('renders a weapon profile that is bundled through an inline infoGroup', () => {
    render(<PlayUnitDetails {...makeProps()} />);

    // "Arcane Staff" lives only inside the unit's <infoGroups>; it appears only
    // if the infoGroup is parsed, flattened and rendered as its own type table.
    expect(screen.getByText('Arcane Staff')).toBeTruthy();
    expect(screen.getByText('Weapon')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
  });

  it('still renders the unit stat block alongside the bundled profile', () => {
    render(<PlayUnitDetails {...makeProps()} />);

    // The directly-declared unit profile ("Move: 6") must remain visible.
    expect(screen.getByText('Move')).toBeTruthy();
    expect(screen.getByText('6')).toBeTruthy();
  });
});
