import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

import { rosterReportOf } from '../../../contexts/ruleengine/readmodel/rosterReport';
import { processImportedData } from '../../../platform/battlescribe/xmlParser';
import { buildRoster } from '../../../contexts/armylist/model/createRoster';

/**
 * Issue 0162, AC5, verschärft durch Issue 0194 — der Bericht, den der
 * Bericht-Kontext aus ADR-0038 weitergibt, ist identitätsstabil: zwei
 * **getrennte Aufrufe** ohne Roster-Änderung liefern dasselbe Objekt, nicht nur
 * zwei Renderdurchläufe derselben Montierung. Erst ein neues Roster-Objekt
 * erzeugt einen neuen Bericht. Der Cache ist eine WeakMap über der Auswertung
 * (`rosterReport.js`), also gilt die Stabilität über Ansichtswechsel hinweg —
 * genau das, was ein `useMemo` nicht leisten konnte.
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

describe('rosterReportOf', () => {
  it('returns the same report object across two separate calls without a roster change', () => {
    const { system, roster } = loadFixtureRoster();

    const firstReport = rosterReportOf(system, roster);

    expect(rosterReportOf(system, roster)).toBe(firstReport);
  });

  it('shares one report across unrelated callers — the editor and play mode see one object', () => {
    const { system, roster } = loadFixtureRoster();

    // Ansicht auf, Ansicht zu, andere Ansicht auf: kein gemeinsamer Zustand,
    // nur dieselben beiden Objekte.
    const inEditor = rosterReportOf(system, roster);
    const inPlayMode = rosterReportOf(system, roster);

    expect(inPlayMode).toBe(inEditor);
    expect(inPlayMode.slots).toBe(inEditor.slots);
    expect(inPlayMode.unresolvedSelections).toBe(inEditor.unresolvedSelections);
  });

  it('carries the evaluation fields and the derived unresolved selections', () => {
    const { system, roster } = loadFixtureRoster();

    const report = rosterReportOf(system, roster);

    expect(report.slots.capabilities).toBeInstanceOf(Map);
    expect(report.slots.pathByForceId.size).toBeGreaterThan(0);
    expect(report.unresolvedSelections).toEqual([]);
  });

  it('is frozen — no consumer can write into the shared bundle', () => {
    const { system, roster } = loadFixtureRoster();

    expect(Object.isFrozen(rosterReportOf(system, roster))).toBe(true);
  });

  it('returns a new report object once the roster object changes', () => {
    const { system, roster } = loadFixtureRoster();

    const firstReport = rosterReportOf(system, roster);

    expect(rosterReportOf(system, { ...roster, name: 'renamed' })).not.toBe(firstReport);
  });
});
