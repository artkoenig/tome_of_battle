import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useForceSection } from './useForceSection';
import { createRosterProviderWrapper, createEmptyRosterReport } from '../../test-utils/rosterProviders';

/**
 * ViewModel-Tests der Kontingent-Sektion (Issue 0164): welche Kategorien sie
 * aufmacht, welche armeeweiten Selektoren eine eigene Sektion bekommen und was
 * unter „Sonstiges" landet.
 */

const FORCE_ENTRY_ID = 'fe-1';
const SYSTEM = {
  forceEntries: [{
    id: FORCE_ENTRY_ID,
    categoryLinks: [
      { id: 'cl-core', targetId: 'cat-core', name: 'Kern' },
      { id: 'cl-hero', targetId: 'cat-heroes', name: 'Helden' },
    ],
  }],
  catalogues: [{
    id: 'cat-main',
    selectionEntries: [{ id: 'e-bloodline', name: 'Blutlinie aus dem Katalog' }],
  }],
};

const renderForce = ({ capabilities = new Map(), selections = [], catalogueId = 'cat-main' } = {}) => {
  const force = { id: 'f1', forceEntryId: FORCE_ENTRY_ID, catalogueId, selections };
  return renderHook(() => useForceSection({ force, forcePath: '0' }), {
    wrapper: createRosterProviderWrapper({
      report: createEmptyRosterReport({ capabilities }),
      roster: { catalogueId: 'cat-main', forces: [force] },
      system: SYSTEM,
      activeCatalogue: { id: 'cat-main' },
    }),
  });
};

/** Ein armeeweiter Pflicht-Selektor: sichtbar, mit wirksamem Minimum, ohne Kontingent-Kategorie. */
const armyWideSlot = (over = {}) => ({
  anchorKind: 'occupied',
  defId: 'e-bloodline',
  targetDefId: null,
  name: 'Blutlinie',
  isHidden: false,
  effectiveMin: 1,
  effectiveMax: 1,
  categoryIds: ['cat-bloodline'],
  ...over,
});

describe('useForceSection', () => {
  it('nennt die Kategorie-Verweise der Kontingent-Definition', () => {
    const { result } = renderForce();

    expect(result.current.categoryLinks.map(link => link.targetId))
      .toEqual(['cat-core', 'cat-heroes']);
  });

  it('ohne auflösbare Kontingent-Definition bleibt die Sektion leer statt zu reißen', () => {
    const force = { id: 'f1', forceEntryId: 'fe-verschwunden', selections: [] };
    const { result } = renderHook(() => useForceSection({ force, forcePath: null }), {
      wrapper: createRosterProviderWrapper({
        report: createEmptyRosterReport(),
        roster: { catalogueId: 'cat-main', forces: [force] },
        system: SYSTEM,
      }),
    });

    expect(result.current.categoryLinks).toEqual([]);
    expect(result.current.armyWideEntries).toEqual([]);
  });

  it('ohne armeeweite Pflicht-Slots gibt es keine armeeweite Sektion', () => {
    const { result } = renderForce({
      capabilities: new Map([['0/0', armyWideSlot({ categoryIds: ['cat-core'] })]]),
    });

    expect(result.current.armyWideEntries).toEqual([]);
  });

  it('löst einen armeeweiten Selektor auf seinen Katalog-Eintrag auf und sammelt seine Auswahlen', () => {
    const { result } = renderForce({
      capabilities: new Map([['0/0', armyWideSlot()]]),
      selections: [
        { id: 'sel-core', category: 'cat-core' },
        { id: 'sel-blood', selectionEntryId: 'e-bloodline', category: 'cat-core' },
      ],
    });

    expect(result.current.armyWideEntries)
      .toEqual([{ id: 'e-bloodline', name: 'Blutlinie aus dem Katalog' }]);
    expect(result.current.armyWideSelections.map(s => s.id)).toEqual(['sel-blood']);
  });

  it('sammelt Auswahlen ohne Kontingent-Kategorie unter „Sonstiges", armeeweite aber nicht', () => {
    const { result } = renderForce({
      capabilities: new Map([['0/0', armyWideSlot()]]),
      selections: [
        { id: 'sel-core', category: 'cat-core' },
        { id: 'sel-fremd', category: 'cat-unbekannt' },
        { id: 'sel-blood', selectionEntryId: 'e-bloodline', category: 'cat-unbekannt' },
      ],
    });

    expect(result.current.uncategorizedSelections.map(s => s.id)).toEqual(['sel-fremd']);
  });
});
