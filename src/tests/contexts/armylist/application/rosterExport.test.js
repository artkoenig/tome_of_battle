import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Issue 0193 (Nachbesserung zu AC3): der Export holt seinen Bericht selbst.
 * Vorher zog `useRosterList` ihn aus dem Lesemodell und reichte ihn herein —
 * der zweite Kontext im Bildschirm. Hier ist gepinnt, dass die Reihenfolge
 * (auswerten → serialisieren → packen) ohne React gilt und der Bericht
 * unverändert bei `exportRosterToXml` ankommt.
 */

vi.mock('../../../../contexts/ruleengine/readmodel/index.js', () => ({
  evaluateAppRoster: vi.fn(() => ({ costTotals: { pts: 7 } })),
  findMissingMandatoryListRules: vi.fn(() => []),
}));

vi.mock('../../../../contexts/armylist/model/rosterSerialization.js', () => ({
  exportRosterToXml: vi.fn(() => '<roster/>'),
}));

vi.mock('../../../../contexts/armylist/application/rosterTransfer.js', () => ({
  buildRosterFile: vi.fn(() => Promise.resolve({ blob: new Blob(), fileName: 'Liste.rosz' })),
}));

import { buildRosterExportFile } from '../../../../contexts/armylist/application/rosterExport.js';
import { evaluateAppRoster } from '../../../../contexts/ruleengine/readmodel/index.js';
import { exportRosterToXml } from '../../../../contexts/armylist/model/rosterSerialization.js';
import { buildRosterFile } from '../../../../contexts/armylist/application/rosterTransfer.js';

const system = { id: 'sys-1', name: 'Sys' };
const roster = { id: 'roster-1', name: 'Alte Liste', systemId: 'sys-1' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('buildRosterExportFile', () => {
  it('holt den Bericht selbst und reicht ihn an die Serialisierung weiter', async () => {
    await buildRosterExportFile(roster, system);

    expect(evaluateAppRoster).toHaveBeenCalledWith(system, roster);
    const report = evaluateAppRoster.mock.results.at(-1).value;
    expect(exportRosterToXml).toHaveBeenCalledWith(roster, system, report);
  });

  it('packt den serialisierten Text unter dem Namen der Liste', async () => {
    const { fileName } = await buildRosterExportFile(roster, system);

    expect(buildRosterFile).toHaveBeenCalledWith('Alte Liste', '<roster/>');
    expect(fileName).toBe('Liste.rosz');
  });
});
