/**
 * Tests der reinen Dokument-Aggregation `mergeCatalogues` (ADR-0032): sie fuehrt
 * die je-Dokument-Sammlungen mehrerer gelesener Dokumente in der uebergebenen
 * Reihenfolge zu **einem** katalog-foermigen Aggregat zusammen — ohne
 * Auflösungslogik.
 */

import { describe, it, expect } from 'vitest';
import { mergeCatalogues } from './catalogSet.js';

/** Ein minimales gelesenes Dokument mit je einem markierten Eintrag/Info/Diagnose. */
function documentWith(tag) {
  return {
    entries: [{ id: `${tag}-entry` }],
    forces: [{ id: `${tag}-force` }],
    categories: [{ id: `${tag}-category` }],
    sharedEntries: [{ id: `${tag}-shared` }],
    infos: [{ id: `${tag}-info` }],
    diagnostics: [{ kind: `${tag}-diagnostic` }],
  };
}

describe('mergeCatalogues: Aggregation mehrerer Dokumente zu einem Aggregat', () => {
  it('konkateniert jede Sammlung dokumentweise in der uebergebenen Reihenfolge', () => {
    const merged = mergeCatalogues([documentWith('gst'), documentWith('cat')]);

    expect(merged.entries).toEqual([{ id: 'gst-entry' }, { id: 'cat-entry' }]);
    expect(merged.forces).toEqual([{ id: 'gst-force' }, { id: 'cat-force' }]);
    expect(merged.categories).toEqual([{ id: 'gst-category' }, { id: 'cat-category' }]);
    expect(merged.sharedEntries).toEqual([{ id: 'gst-shared' }, { id: 'cat-shared' }]);
    expect(merged.infos).toEqual([{ id: 'gst-info' }, { id: 'cat-info' }]);
    expect(merged.diagnostics).toEqual([{ kind: 'gst-diagnostic' }, { kind: 'cat-diagnostic' }]);
  });

  it('fuellt fehlende Sammlungen eines Dokuments mit einer leeren Liste (kein Absturz)', () => {
    const merged = mergeCatalogues([{ entries: [{ id: 'only-entry' }] }, {}]);

    expect(merged.entries).toEqual([{ id: 'only-entry' }]);
    expect(merged.forces).toEqual([]);
    expect(merged.sharedEntries).toEqual([]);
    expect(merged.diagnostics).toEqual([]);
  });

  it('liefert fuer eine leere Dokumentliste ein Aggregat aus leeren Sammlungen', () => {
    const merged = mergeCatalogues([]);

    expect(merged).toEqual({
      entries: [],
      forces: [],
      categories: [],
      sharedEntries: [],
      infos: [],
      profileTypes: [],
      diagnostics: [],
    });
  });
});
