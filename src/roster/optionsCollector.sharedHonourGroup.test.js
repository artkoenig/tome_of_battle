import { describe, it, expect } from 'vitest';
import { getUnitOptions } from './optionsCollector.js';
import { resolveEntry } from './catalogResolver.js';
import { createSelectionFromDef } from './selectionFactory.js';

/**
 * Issue 0153 — Kriterium 3: eine geteilte Ehrung bleibt dort wählbar, wo der
 * Katalog sie tatsächlich anbietet. Fixture in der realen Form von
 * "High Elves (6th definitive edition).cat": „Pure of Heart"
 * (d0ce-b0c4-fcc1-6cac) steht nur in sharedSelectionEntries, angeboten über
 * genau eine Stelle — die geteilte Gruppe „Honours" (45a3-3e65-6c49-5cc0) —
 * die ein Charakter-selectionEntry per entryLink vom Typ
 * "selectionEntryGroup" einbindet. Dies ist der Gegenpol zu Kriterium 1
 * (listRules.mandatoryPredicate.test.js): die Ehrung darf nicht auf
 * Kontingent-Ebene erzwungen werden, muss aber am Charakter weiterhin
 * angeboten und wählbar sein.
 */

const CATALOGUE_ID = 'cat-high-elves';
const CHARACTER_ID = 'char-hero';
const HONOURS_GROUP_ID = '45a3-3e65-6c49-5cc0';
const PURE_OF_HEART_ID = 'd0ce-b0c4-fcc1-6cac';
const HONOUR_LINK_ID = 'link-pure-of-heart';

const system = {
  id: 'sys-high-elves',
  catalogues: [{
    id: CATALOGUE_ID,
    selectionEntries: [{
      id: CHARACTER_ID,
      name: 'Hero',
      type: 'unit',
      entryLinks: [
        { id: 'link-honours', targetId: HONOURS_GROUP_ID, type: 'selectionEntryGroup' },
      ],
    }],
    sharedSelectionEntryGroups: [{
      id: HONOURS_GROUP_ID,
      name: 'Honours',
      entryLinks: [
        { id: HONOUR_LINK_ID, targetId: PURE_OF_HEART_ID, type: 'selectionEntry' },
      ],
    }],
    sharedSelectionEntries: [{
      id: PURE_OF_HEART_ID,
      name: 'Pure of Heart',
      type: 'upgrade',
      constraints: [
        { id: 'c-max-roster', type: 'max', value: 1, scope: 'roster' },
        { id: 'c-max-parent', type: 'max', value: 1, scope: 'parent' },
        {
          id: 'c-min-roster', type: 'min', value: 1, scope: 'roster',
          includeChildSelections: true, includeChildForces: true,
        },
      ],
    }],
  }],
};

describe('eine geteilte Ehrung bleibt am Charakter wählbar, der die Gruppe verlinkt (Issue 0153, Kriterium 3)', () => {
  const characterSelection = { selectionEntryId: CHARACTER_ID, selections: [] };

  it('bietet Pure of Heart über die Gruppe Honours an', () => {
    const options = getUnitOptions(system, CATALOGUE_ID, characterSelection);
    const honourOption = options.find(o => o.option.targetId === PURE_OF_HEART_ID);

    expect(honourOption).toBeDefined();
    expect(honourOption.groupName).toBe('Honours');
  });

  it('lässt sich wählen: die Rekrutierung erzeugt eine Auswahl "Pure of Heart" über den Link', () => {
    const options = getUnitOptions(system, CATALOGUE_ID, characterSelection);
    const honourOption = options.find(o => o.option.targetId === PURE_OF_HEART_ID);

    const selection = createSelectionFromDef({
      system, resolveEntry, catalogueId: CATALOGUE_ID, entry: honourOption.option,
    });

    expect(selection.name).toBe('Pure of Heart');
    expect(selection.entryLinkId).toBe(HONOUR_LINK_ID);
  });
});
