import { readFileSync } from 'fs';
import { describe, it, expect, beforeAll } from 'vitest';
import { JSDOM } from 'jsdom';
import { parseCatalogueXML } from '../parser/xmlParser.js';
import { findMissingMandatoryListRuleSelections } from './listRules.js';
import { getUnitOptions } from './optionsCollector.js';

// JSDOM provides DOMParser for the parser in the Node test environment.
beforeAll(() => {
  const jsdomObj = new JSDOM();
  globalThis.DOMParser = jsdomObj.window.DOMParser;
  globalThis.XMLSerializer = jsdomObj.window.XMLSerializer;
});

const FIXTURE_DIR = './src/__fixtures__/whfb6-lexicanum';

// ---------------------------------------------------------------------------
// Issue 0153 — «„Pure of Heart" wird bei Hochelfen in die Armeeliste gesetzt
// statt am Helden gewählt».
//
// The mandatory-list-rule sweep used to count `catalogue.sharedSelectionEntries`
// among a catalogue's ROOT pools. A shared definition is not a root entry: it is
// reachable only through an `entryLink` and appears solely in its place
// (docs/battlescribe-data-format.md §9.9 names exactly two root encodings for an
// army-wide duty — root `selectionEntry` and root `entryLink`; the clean-room
// engine already draws the same line in src/evaluator/resolver.js,
// `collectArmyLevelCandidates`).
//
// The High Elf honour "Pure of Heart" is the case that exposed it: it satisfies
// every other feature of `isUnconditionalMandatoryListRule` (type `upgrade`, no
// own sub-choices, own `min value="1" scope="roster"`), yet lives only in
// `sharedSelectionEntries` and hangs off no root — only off the shared group
// "Honours", which the four heroes' "Magic and Honors" group links. The sweep
// therefore reported it as missing, and `useRoster`'s auto-add committed it as a
// force-level row in the army list instead of leaving it to be chosen on a hero.
//
// This file works the REAL catalogue data (reduced verbatim excerpt, see the
// fixture's own header), so the case stands on the actual XML structure rather
// than on a hand-shaped literal. `listRules.mandatoryPredicate.test.js` carries
// the schema-shaped cases for the same criteria.
// ---------------------------------------------------------------------------
describe('findMissingMandatoryListRuleSelections — geteilte Definitionen sind kein Wurzel-Pool (Issue 0153)', () => {
  const CATALOGUE_ID = 'b59c-7ff5-fb34-405e';
  const PURE_OF_HEART_ID = 'd0ce-b0c4-fcc1-6cac';
  const INTRIGUE_AT_COURT_ID = 'a4dc-9040-d98e-7bc1';

  let system;
  let catalogue;
  beforeAll(() => {
    const xml = readFileSync(`${FIXTURE_DIR}/high-elves-shared-honour.cat.xml`, 'utf-8');
    catalogue = parseCatalogueXML(xml);
    system = { id: '0d13-7737-ea86-4662', catalogues: [catalogue] };
  });

  const emptyForce = () => ({ id: 'force-1', catalogueId: CATALOGUE_ID, selections: [] });

  it('trägt die Ehre „Pure of Heart" wirklich nur geteilt und nur über die Gruppe „Honours"', () => {
    // Guards the fixture itself: were the entry ever a root entry, the assertions
    // below would pass for the wrong reason.
    expect(catalogue.sharedSelectionEntries.map(e => e.id)).toContain(PURE_OF_HEART_ID);
    expect(catalogue.selectionEntries.map(e => e.id)).not.toContain(PURE_OF_HEART_ID);
    expect((catalogue.entryLinks || []).map(l => l.targetId)).not.toContain(PURE_OF_HEART_ID);

    const honours = catalogue.sharedSelectionEntryGroups.find(g => g.id === '45a3-3e65-6c49-5cc0');
    expect(honours.entryLinks.map(l => l.targetId)).toContain(PURE_OF_HEART_ID);
  });

  it('setzt „Pure of Heart" nicht als fehlende Pflicht-Listenregel in ein frisches Kontingent', () => {
    const missing = findMissingMandatoryListRuleSelections(system, catalogue, emptyForce());
    expect(missing.map(m => m.resolved.id)).not.toContain(PURE_OF_HEART_ID);
  });

  it('findet weiter die echte Wurzel-Pflichtregel des Katalogs („Intrigue at Court")', () => {
    // Its roster-scoped `min` sits at 0 in the catalogue and its own modifier
    // raises it to 1 while the force holds neither Prince nor Commander — the
    // state of a fresh, empty force. Proves the sweep is still awake after the
    // shared pool was dropped.
    const missing = findMissingMandatoryListRuleSelections(system, catalogue, emptyForce());
    expect(missing.map(m => m.resolved.id)).toEqual([INTRIGUE_AT_COURT_ID]);
  });

  it('bietet die Ehre weiter am Helden an — Commander → „Magic and Honors" → „Honours"', () => {
    // The other half of the issue: the honour must stay reachable where it
    // belongs. Dropping the shared pool from the ROOT sweep must not touch the
    // path that brings the shared entry in — the hero's group `entryLink`.
    const commander = { id: 'sel-commander', selectionEntryId: 'dd92-a190-b470-c5ab', selections: [] };
    const options = getUnitOptions(system, CATALOGUE_ID, commander);

    // The offered item is the group's `entryLink` (30b5-…) onto the shared entry.
    const honour = options.find(o => o.option?.targetId === PURE_OF_HEART_ID);
    expect(honour, '„Pure of Heart" muss am Commander wählbar sein').toBeTruthy();
    expect(honour.option.name).toBe('Pure of Heart');
    expect(honour.groupName).toBe('Honours');
    expect(honour.groupAncestors.map(a => a.name)).toContain('Magic and Honors');
  });
});
