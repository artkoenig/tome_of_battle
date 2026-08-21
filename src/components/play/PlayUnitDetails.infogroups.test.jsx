import React from 'react';
import { readFileSync } from 'fs';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlayUnitDetails from './PlayUnitDetails';
import { evaluateAppRoster } from '../../evaluation/evaluationCache.js';

// End-to-end renderer coverage for infoGroups (slice 04, umgestellt mit Issue
// 0121, Task 7): a profile bundled through an inline infoGroup must actually
// reach a rendered profile table. The profile source is the evaluator report
// (`capability.infoElements` via the real facade over `evaluateAppRoster`),
// exercised against the schema-valid fixture — not a hand-built capability.
// Only the chip sub-components are stubbed, to avoid their SettingsContext
// dependency and keep the assertion focused on the profile tables.
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
  './src/__fixtures__/generic/generic-infogroups.cat',
  'utf-8'
);

// Minimales Spielsystem: das Fixture-Katalog deklariert seine profileTypes
// selbst; das Kontingent kommt aus der .gst, damit die Auswertung einen
// aufloesbaren Force-Anker hat.
const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
  <gameSystem id="sys-generic-1" name="Generic Test System">
    <forceEntries><forceEntry id="force-main" name="Main Force"/></forceEntries>
  </gameSystem>`;

const system = {
  id: 'system-uuid',
  name: 'Generic Test System',
  catalogues: [{ id: 'cat-generic-1', name: 'Generic InfoGroups Catalogue' }],
  rawXmls: {
    gst: [{ name: 'generic.gst', content: GAME_SYSTEM_XML }],
    cat: [{ name: 'generic-infogroups.cat', content: catalogueXml }],
  },
};

function makeProps() {
  const selection = {
    id: 'sel-guardian',
    name: 'Arcane Guardian',
    selectionEntryId: 'unit-guardian',
    entryLinkId: null,
    number: 1,
    selections: [],
  };
  const roster = {
    id: 'roster-1',
    systemId: 'system-uuid',
    catalogueId: 'cat-generic-1',
    costLimitType: null,
    costLimit: -1,
    forces: [{ id: 'force-1', forceEntryId: 'force-main', catalogueId: 'cat-generic-1', selections: [selection] }],
  };

  // Die echte Fassade liefert den Fähigkeitsdatensatz des Slots.
  const { slots } = evaluateAppRoster(system, roster);

  return {
    selection,
    system,
    roster,
    slots,
    getUnitCurrentWounds: (_selectionId, totalMaxWounds) => totalMaxWounds,
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
    const props = makeProps();
    // Guard gegen den echten Bericht: der Slot führt das gebündelte Profil.
    const capability = props.slots.slotOfSelection({ id: 'sel-guardian' });
    expect(capability?.infoElements).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'profile', name: 'Arcane Staff', profileTypeName: 'Weapon' }),
    ]));

    render(<PlayUnitDetails {...props} />);

    // "Arcane Staff" lives only inside the unit's <infoGroups>; it appears only
    // if the infoGroup is read, flattened into the report and rendered as its
    // own type table.
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
