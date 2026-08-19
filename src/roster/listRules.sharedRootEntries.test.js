import { describe, it, expect } from 'vitest';
import { findMissingMandatoryListRuleSelections } from './listRules.js';

/**
 * Issue 0153 — "Pure of Heart landet auf der Armee statt auf einem Helden".
 *
 * `findMissingMandatoryListRuleSelections` las bis hierher auch die
 * `sharedSelectionEntries` eines Katalogs als Wurzel-Pool. Ein geteilter
 * Eintrag ist aber keine Wurzel-Auswahl: er ist ausschliesslich ueber einen
 * Verweis erreichbar und erscheint allein an dessen Stelle (BSData-Doku §7.2).
 * Traegt er dennoch einen eigenen `min`-Constraint mit `scope="roster"`, setzte
 * die automatische Pflicht-Listenregel ihn ohne jede Nutzerwahl ins Kontingent.
 *
 * Die Fixtures bilden die reale Gestalt aus
 * `src/evaluator/__fixtures__/whfb6-definitive/High Elves (6th definitive
 * edition).cat` nach:
 *
 * - `sharedSelectionEntries` > `selectionEntry` "Pure of Heart"
 *   (`d0ce-b0c4-fcc1-6cac`, type `upgrade`, ohne Kinder, ohne
 *   `categoryLinks`, `min` value 1 `scope="roster"`),
 * - erreichbar allein ueber den `entryLink` `30b5-bd1a-60e2-2354` in der
 *   geteilten Gruppe "Honours" (`45a3-3e65-6c49-5cc0`), die die Helden
 *   Prince/Archmage/Commander/Mage einbinden.
 *
 * Echte (ungemockte) `catalogResolver.js`/`entryVisibility.js` tragen den Lauf
 * — wie in `listRules.mandatoryPredicate.test.js`; dieses File mockt nichts.
 */

const CATALOGUE_ID = 'b59c-7ff5-fb34-405e';

/** Der geteilte Eintrag "Pure of Heart" in seiner realen Gestalt. */
const pureOfHeart = () => ({
  id: 'd0ce-b0c4-fcc1-6cac',
  name: 'Pure of Heart',
  type: 'upgrade',
  hidden: false,
  costs: [{ typeId: 'ecfa-8486-4f6c-c249', value: 0 }],
  constraints: [
    { id: '4720-59d3-07c4-68b3', type: 'max', value: 1, scope: 'roster' },
    { id: '69ac-892d-a730-545d', type: 'max', value: 1, scope: 'parent' },
    { id: '82ef-69c7-f459-5e20', type: 'min', value: 1, scope: 'roster' },
  ],
});

/** Der Held "Prince", der die geteilte Gruppe "Honours" per Verweis einbindet. */
const prince = () => ({
  id: 'f42c-be6f-8a5d-7199',
  name: 'Prince',
  type: 'unit',
  hidden: false,
  costs: [{ typeId: 'ecfa-8486-4f6c-c249', value: 140 }],
  constraints: [],
  selectionEntryGroups: [{
    id: 'a686-83d6-bfa2-3535',
    name: 'Magic and Honors',
    entryLinks: [{
      id: 'c7fa-d10c-2cea-bfa2',
      name: 'Honours',
      type: 'selectionEntryGroup',
      targetId: '45a3-3e65-6c49-5cc0',
    }],
  }],
});

/** Die geteilte Gruppe "Honours" — sie fuehrt den Verweis auf "Pure of Heart". */
const honours = () => ({
  id: '45a3-3e65-6c49-5cc0',
  name: 'Honours',
  entryLinks: [{
    id: '30b5-bd1a-60e2-2354',
    name: 'Pure of Heart',
    type: 'selectionEntry',
    targetId: 'd0ce-b0c4-fcc1-6cac',
  }],
});

const buildSystem = () => ({
  id: '0d13-7737-ea86-4662',
  catalogues: [{
    id: CATALOGUE_ID,
    name: 'High Elves',
    selectionEntries: [prince()],
    entryLinks: [],
    sharedSelectionEntries: [pureOfHeart()],
    sharedSelectionEntryGroups: [honours()],
  }],
});

const emptyForce = () => ({ id: 'force-1', catalogueId: CATALOGUE_ID, selections: [] });

describe('findMissingMandatoryListRuleSelections — geteilte Eintraege sind keine Wurzel-Angebote (Issue 0153)', () => {
  it('setzt "Pure of Heart" nicht auf Armee-Ebene, obwohl der geteilte Eintrag min>=1 mit scope="roster" traegt', () => {
    const system = buildSystem();
    const missing = findMissingMandatoryListRuleSelections(system, system.catalogues[0], emptyForce());
    expect(missing.map(m => m.resolved.id)).toEqual([]);
  });

  it('KONTROLLE: derselbe Eintrag als echter Wurzel-Eintrag bleibt eine Pflicht-Listenregel', () => {
    const system = buildSystem();
    system.catalogues[0].selectionEntries = [prince(), pureOfHeart()];
    system.catalogues[0].sharedSelectionEntries = [];
    const missing = findMissingMandatoryListRuleSelections(system, system.catalogues[0], emptyForce());
    expect(missing.map(m => m.resolved.id)).toEqual(['d0ce-b0c4-fcc1-6cac']);
  });
});
