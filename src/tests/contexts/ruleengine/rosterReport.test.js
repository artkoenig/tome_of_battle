import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import fs from 'fs';
import path from 'path';

import { useRosterReportModel } from '../../../contexts/ruleengine/readmodel/rosterReport';
import { processImportedData } from '../../../platform/battlescribe/xmlParser';
import { buildRoster } from '../../../contexts/armylist/model/createRoster';

/**
 * Issue 0162, AC5 — der Bericht, den der Bericht-Kontext aus ADR-0038
 * weitergibt, ist identitätsstabil: zwei Renderdurchläufe ohne Roster-Änderung
 * liefern dasselbe Objekt. Erst ein neues Roster-Objekt erzeugt einen neuen
 * Bericht.
 *
 * Nichts ist gemockt: die echten Fixture-Kataloge werden geparst und über
 * `evaluateAppRoster` ausgewertet — die Stabilität, die hier geprüft wird, ist
 * die des Produktionspfades, nicht die eines Leer-Ergebnisses.
 */

const DEFINITIVE_DIR = path.resolve('src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive');
const DEFINITIVE_GST = 'Warhammer Fantasy Battles (6th definitive edition).gst';
const VAMPIRE_COUNTS_CAT = 'Vampire Counts (6th definitive edition).cat';

function loadFixtureRoster() {
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
  return { system, roster };
}

describe('useRosterReportModel', () => {
  it('returns the same report object across two renders without a roster change', () => {
    const { system, roster } = loadFixtureRoster();

    const { result, rerender } = renderHook(() => useRosterReportModel(system, roster));
    const firstReport = result.current;
    rerender();

    expect(result.current).toBe(firstReport);
  });

  it('carries the evaluation fields and the derived unresolved selections', () => {
    const { system, roster } = loadFixtureRoster();

    const { result } = renderHook(() => useRosterReportModel(system, roster));

    expect(result.current.slots.capabilities).toBeInstanceOf(Map);
    expect(result.current.slots.pathByForceId.size).toBeGreaterThan(0);
    expect(result.current.unresolvedSelections).toEqual([]);
  });

  it('returns a new report object once the roster object changes', () => {
    const { system, roster } = loadFixtureRoster();

    const { result, rerender } = renderHook(
      ({ currentRoster }) => useRosterReportModel(system, currentRoster),
      { initialProps: { currentRoster: roster } }
    );
    const firstReport = result.current;
    rerender({ currentRoster: { ...roster, name: 'renamed' } });

    expect(result.current).not.toBe(firstReport);
  });
});
