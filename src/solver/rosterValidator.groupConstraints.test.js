import { describe, test, expect } from 'vitest';
import { validateRoster, getModifiedConstraintValue } from './validator.js';
import {
  POINTS,
  ENTRY_ID,
  ITEM_COST,
  MAGIC_ITEMS_POINTS_MAX,
  createGrimdarkSystem,
  createRoster,
  createTacticalSquadSelection,
  createVampireSelection
} from './__fixtures__/grimdarkSystem.js';

const VIOLATION = {
  groupPointsMax: 'group-points-max',
  groupCountMax: 'group-count-max',
  entryMax: 'entry-max'
};

describe('validateRoster — Punktebudget einer Auswahlgruppe', () => {
  // Die Magic-Items-Gruppe des Vampirs erlaubt 50 Punkte. Schwert (30) + Schild (15)
  // = 45 passen hinein, Schwert (30) + Lanze (25) = 55 nicht. Damit ist zugleich die
  // Auswählbarkeit einzelner Optionen belegt: die Lanze sprengt das Budget, das Schild nicht.
  const createVampireRosterWithItems = itemEntryIds => createRoster({
    name: 'Vampire Army',
    selections: [
      createVampireSelection({ itemEntryIds }),
      createTacticalSquadSelection()
    ]
  });

  test('Schwert und Schild bleiben im Budget und erzeugen keine Verletzung', () => {
    expect(ITEM_COST.swordOfBattle + ITEM_COST.shieldOfGrace).toBeLessThanOrEqual(MAGIC_ITEMS_POINTS_MAX);

    const roster = createVampireRosterWithItems([ENTRY_ID.swordOfBattle, ENTRY_ID.shieldOfGrace]);

    expect(validateRoster(roster, createGrimdarkSystem())).toEqual([]);
  });

  test('Schwert und Lanze sprengen das Budget und melden group-points-max', () => {
    expect(ITEM_COST.swordOfBattle + ITEM_COST.lanceOfDoom).toBeGreaterThan(MAGIC_ITEMS_POINTS_MAX);

    const roster = createVampireRosterWithItems([ENTRY_ID.swordOfBattle, ENTRY_ID.lanceOfDoom]);

    const errors = validateRoster(roster, createGrimdarkSystem());

    expect(errors.some(error => error.type === VIOLATION.groupPointsMax)).toBe(true);
  });
});

describe('validateRoster — durch Modifier angehobene Gruppenlimits', () => {
  const ARCANE_GROUP_ID = 'group-arcane';
  const ARCANE_MAX_CONSTRAINT_ID = 'con-arcane-max';
  const SCROLL_ENTRY_ID = 'item-scroll';
  const STAFF_ENTRY_ID = 'item-staff';
  const BASE_ARCANE_MAX = 1;
  const HQ_CATEGORY_ID = 'cat-hq';
  const FORCE_ENTRY_ID = 'force-1';
  const CATALOGUE_ID = 'cat-1';
  const ROSTER_COST_LIMIT = 2000;
  const SCROLL_COUNT = 2;

  /** Die Gruppe hebt ihr eigenes max je gewählter Schriftrolle um eins an. */
  const selfIncrementingArcaneModifier = childId => ({
    type: 'increment',
    field: ARCANE_MAX_CONSTRAINT_ID,
    value: 1,
    conditions: [{ type: 'greaterThan', value: 0, field: 'selections', scope: 'parent', childId }],
    repeat: { field: 'selections', scope: 'parent', childId, value: 1, repeats: 1 }
  });

  const arcaneMaxConstraint = () => ({
    id: ARCANE_MAX_CONSTRAINT_ID,
    type: 'max',
    value: BASE_ARCANE_MAX,
    field: 'selections',
    scope: 'parent'
  });

  const arcaneItemEntries = () => [
    { id: SCROLL_ENTRY_ID, name: 'Dispel Scroll', costs: [{ typeId: POINTS, value: 25 }] },
    { id: STAFF_ENTRY_ID, name: 'Staff', costs: [{ typeId: POINTS, value: 50 }] }
  ];

  function createArcaneSystem(systemId, wizardEntry) {
    return {
      id: systemId,
      costTypes: [{ id: POINTS, name: 'Points', defaultCostLimit: ROSTER_COST_LIMIT }],
      categoryEntries: [{ id: HQ_CATEGORY_ID, name: 'HQ' }],
      forceEntries: [{
        id: FORCE_ENTRY_ID,
        name: 'Force',
        categoryLinks: [{ id: 'cl-hq', targetId: HQ_CATEGORY_ID, name: 'HQ' }]
      }],
      catalogues: [{ id: CATALOGUE_ID, selectionEntries: [wizardEntry] }]
    };
  }

  function createArcaneRoster(unitSelection) {
    return {
      name: 'r',
      costLimit: ROSTER_COST_LIMIT,
      costLimitType: POINTS,
      catalogueId: CATALOGUE_ID,
      forces: [{
        id: 'f1',
        forceEntryId: FORCE_ENTRY_ID,
        catalogueId: CATALOGUE_ID,
        selections: [unitSelection]
      }]
    };
  }

  const scrollSelection = (id = 'sel-scroll') => ({
    id,
    selectionEntryId: SCROLL_ENTRY_ID,
    name: 'Dispel Scroll',
    number: SCROLL_COUNT,
    costs: [{ typeId: POINTS, value: 25 }]
  });

  test('hebt das Limit einer Gruppe direkt unter der Top-Level-Einheit an', () => {
    // Bei einer Top-Level-Einheit übergibt der Validator selection=Einheit und
    // parentSelection=null. Die parent-bezogene Bedingung muss deshalb auf die
    // Einheit selbst zurückfallen, sonst feuert der Modifier nie.
    const system = createArcaneSystem('sys-arcane', {
      id: 'unit-wizard',
      name: 'Wizard',
      type: 'unit',
      costs: [{ typeId: POINTS, value: 100 }],
      categoryLinks: [{ targetId: HQ_CATEGORY_ID }],
      selectionEntryGroups: [{
        id: ARCANE_GROUP_ID,
        name: 'Arcane Items',
        constraints: [arcaneMaxConstraint()],
        modifiers: [selfIncrementingArcaneModifier(SCROLL_ENTRY_ID)],
        selectionEntries: arcaneItemEntries()
      }]
    });

    const roster = createArcaneRoster({
      id: 'sel-wizard',
      selectionEntryId: 'unit-wizard',
      name: 'Wizard',
      number: 1,
      category: HQ_CATEGORY_ID,
      selections: [scrollSelection()]
    });

    expect(validateRoster(roster, system).some(error => error.type === VIOLATION.groupCountMax)).toBe(false);
  });

  test('berechnet das angehobene Limit so, wie der Validator es auswertet', () => {
    const system = createArcaneSystem('sys-arcane', {
      id: 'unit-wizard',
      name: 'Wizard',
      type: 'unit',
      costs: [{ typeId: POINTS, value: 100 }],
      categoryLinks: [{ targetId: HQ_CATEGORY_ID }],
      selectionEntryGroups: [{
        id: ARCANE_GROUP_ID,
        name: 'Arcane Items',
        constraints: [arcaneMaxConstraint()],
        modifiers: [selfIncrementingArcaneModifier(SCROLL_ENTRY_ID)],
        selectionEntries: arcaneItemEntries()
      }]
    });

    const roster = createArcaneRoster({
      id: 'sel-wizard',
      selectionEntryId: 'unit-wizard',
      name: 'Wizard',
      number: 1,
      category: HQ_CATEGORY_ID,
      selections: [scrollSelection()]
    });

    const modifiers = system.catalogues[0].selectionEntries[0].selectionEntryGroups[0].modifiers;
    const dynamicMax = getModifiedConstraintValue(arcaneMaxConstraint(), modifiers, {
      roster,
      system,
      selectionCounts: {},
      forceCategoryCounts: {},
      selection: roster.forces[0].selections[0],
      parentSelection: null,
      parentCatalogueId: CATALOGUE_ID
    });

    expect(dynamicMax).toBe(BASE_ARCANE_MAX + SCROLL_COUNT);
  });

  test('hebt das Limit an, wenn die Gruppe hinter einer Zwischenauswahl liegt', () => {
    // Reales Empire-Muster „Magic Items Selection": beim Rekursionsschritt ist
    // selection=Zwischenauswahl und parentSelection=Einheit. Der parent-bezogene
    // Modifier muss gegen die Zwischenauswahl auflösen — den echten Eigentümer der
    // Gruppe —, sonst durchsucht er den falschen Behälter.
    const system = createArcaneSystem('sys-arcane-wrapped', {
      id: 'unit-wizard-lord',
      name: 'Wizard Lord',
      type: 'unit',
      costs: [{ typeId: POINTS, value: 100 }],
      categoryLinks: [{ targetId: HQ_CATEGORY_ID }],
      selectionEntries: [{
        id: 'wrapper-magic-items',
        name: 'Magic Items Selection',
        type: 'upgrade',
        selectionEntryGroups: [{
          id: ARCANE_GROUP_ID,
          name: 'Arcane Items',
          constraints: [arcaneMaxConstraint()],
          modifiers: [selfIncrementingArcaneModifier(SCROLL_ENTRY_ID)],
          selectionEntries: arcaneItemEntries()
        }]
      }]
    });

    const roster = createArcaneRoster({
      id: 'sel-wizard-lord',
      selectionEntryId: 'unit-wizard-lord',
      name: 'Wizard Lord',
      number: 1,
      category: HQ_CATEGORY_ID,
      selections: [{
        id: 'sel-wrapper',
        selectionEntryId: 'wrapper-magic-items',
        name: 'Magic Items Selection',
        number: 1,
        selections: [scrollSelection()]
      }]
    });

    expect(validateRoster(roster, system).some(error => error.type === VIOLATION.groupCountMax)).toBe(false);
  });

  test('erkennt einen zweiten entryLink-Alias desselben Gegenstands', () => {
    // Reales Ogre-Kingdoms-Muster „Arcane Items (OK-AB + Common)": eine äußere
    // Wrapper-Gruppe referenziert die Schriftrolle über einen *anderen* entryLink als
    // den tatsächlich gewählten — beide zeigen auf dieselbe Definition. Werden die
    // Aliase nicht als derselbe Gegenstand erkannt, hebt sich das Limit nie.
    const ARMY_SCROLL_LINK_ID = 'link-army-scroll';
    const COMMON_SCROLL_LINK_ID = 'link-common-scroll';
    const WRAPPER_MAX_CONSTRAINT_ID = 'con-wrapper-max';
    const scrollEntryLink = id => ({ id, name: 'Dispel Scroll', targetId: SCROLL_ENTRY_ID, type: 'selectionEntry' });

    const system = {
      id: 'sys-alias',
      costTypes: [{ id: POINTS, name: 'Points', defaultCostLimit: ROSTER_COST_LIMIT }],
      categoryEntries: [{ id: HQ_CATEGORY_ID, name: 'HQ' }],
      forceEntries: [{
        id: FORCE_ENTRY_ID,
        name: 'Force',
        categoryLinks: [{ id: 'cl-hq', targetId: HQ_CATEGORY_ID, name: 'HQ' }]
      }],
      catalogues: [{
        id: CATALOGUE_ID,
        selectionEntries: [
          { id: SCROLL_ENTRY_ID, name: 'Dispel Scroll', costs: [{ typeId: POINTS, value: 25 }] },
          {
            id: 'unit-butcher',
            name: 'Butcher',
            type: 'unit',
            costs: [{ typeId: POINTS, value: 100 }],
            categoryLinks: [{ targetId: HQ_CATEGORY_ID }],
            selectionEntryGroups: [{
              id: 'group-wrapper',
              name: 'Arcane Items (Wrapper)',
              constraints: [{
                id: WRAPPER_MAX_CONSTRAINT_ID,
                type: 'max',
                value: BASE_ARCANE_MAX,
                field: 'selections',
                scope: 'parent'
              }],
              modifiers: [{
                type: 'increment',
                field: WRAPPER_MAX_CONSTRAINT_ID,
                value: 1,
                repeat: {
                  field: 'selections',
                  scope: 'parent',
                  childId: COMMON_SCROLL_LINK_ID,
                  value: 1,
                  repeats: 1
                }
              }],
              entryLinks: [scrollEntryLink(ARMY_SCROLL_LINK_ID)],
              // Spiegelt die ungenutzte Schwestergruppe, die den Common-Alias
              // überhaupt erst auflösbar macht; selbst wird sie nie gewählt.
              selectionEntryGroups: [{
                id: 'group-common',
                name: 'Arcane Items (Common)',
                entryLinks: [scrollEntryLink(COMMON_SCROLL_LINK_ID)]
              }]
            }]
          }
        ]
      }]
    };

    const roster = createArcaneRoster({
      id: 'sel-butcher',
      selectionEntryId: 'unit-butcher',
      name: 'Butcher',
      number: 1,
      category: HQ_CATEGORY_ID,
      selections: [{
        id: 'sel-scroll',
        entryLinkId: ARMY_SCROLL_LINK_ID,
        name: 'Dispel Scroll',
        number: SCROLL_COUNT,
        costs: [{ typeId: POINTS, value: 25 }]
      }]
    });

    expect(validateRoster(roster, system).some(error => error.type === VIOLATION.groupCountMax)).toBe(false);
  });

  test('lässt ein regelkonformes Roster mit wiederholbaren Gegenständen fehlerfrei', () => {
    // Klassische Modifier-Form (field statt scope/childId): die Gruppe zählt ihre
    // eigene Schriftrolle und hebt ihr max entsprechend an.
    const system = {
      id: 'sys-repeatable',
      name: 'Test System Repeatable',
      costTypes: [{ id: POINTS, name: 'Points', defaultCostLimit: ROSTER_COST_LIMIT }],
      categoryEntries: [{ id: HQ_CATEGORY_ID, name: 'HQ' }],
      forceEntries: [{
        id: FORCE_ENTRY_ID,
        name: 'Patrol Force',
        categoryLinks: [{ id: 'cl-hq', targetId: HQ_CATEGORY_ID, name: 'HQ Link' }]
      }],
      catalogues: [{
        id: 'cat-wizard',
        name: 'Wizards',
        selectionEntries: [
          { id: ENTRY_ID.general, name: 'General' },
          {
            id: 'unit-wizard',
            name: 'Wizard Shaman',
            costs: [{ typeId: POINTS, value: 100 }],
            categoryLinks: [{ targetId: HQ_CATEGORY_ID }],
            selectionEntryGroups: [{
              id: ARCANE_GROUP_ID,
              name: 'Arcane Items',
              modifiers: [{
                type: 'increment',
                field: ARCANE_MAX_CONSTRAINT_ID,
                valueObject: 1,
                conditions: [{ field: SCROLL_ENTRY_ID, type: 'greaterThan', value: 0 }],
                repeat: { field: SCROLL_ENTRY_ID, value: 1, repeats: 1 }
              }],
              constraints: [arcaneMaxConstraint()],
              selectionEntries: [
                { id: SCROLL_ENTRY_ID, name: 'Dispel Scroll', costs: [{ typeId: POINTS, value: 25 }] },
                {
                  id: STAFF_ENTRY_ID,
                  name: 'Staff of Sorcery',
                  costs: [{ typeId: POINTS, value: 50 }],
                  constraints: [{ id: 'con-staff-max', type: 'max', value: 1, field: 'selections', scope: 'parent' }]
                }
              ]
            }]
          }
        ]
      }]
    };

    const roster = {
      name: 'Wizard Army',
      costLimit: ROSTER_COST_LIMIT,
      costLimitType: POINTS,
      forces: [{
        id: 'f1',
        forceEntryId: FORCE_ENTRY_ID,
        catalogueId: 'cat-wizard',
        selections: [{
          id: 'sel-wizard',
          selectionEntryId: 'unit-wizard',
          name: 'Wizard Shaman',
          number: 1,
          category: HQ_CATEGORY_ID,
          selections: [
            { id: 'sel-scroll-1', selectionEntryId: SCROLL_ENTRY_ID, name: 'Dispel Scroll', number: SCROLL_COUNT },
            { id: 'sel-staff', selectionEntryId: STAFF_ENTRY_ID, name: 'Staff of Sorcery', number: 1 },
            { id: 'sel-general', selectionEntryId: ENTRY_ID.general, name: 'General', number: 1 }
          ]
        }]
      }]
    };

    expect(validateRoster(roster, system)).toEqual([]);
  });
});

describe('validateRoster — kategoriegebundene Optionslimits', () => {
  // Ein „Schild (nur Blutdrachen)" trägt max=0; ein set-Modifier hebt es auf 1, sobald
  // eine Geschwisterauswahl der Kategorie „Blood Dragon" angehört. Die Bedingung
  // referenziert die Kategorie per childId — das Zählen muss Kategoriezugehörigkeit
  // also über categoryLinks erkennen.
  const BLOOD_DRAGON_CATEGORY_ID = 'cat-blood-dragon';
  const SHIELD_MAX_CONSTRAINT_ID = 'con-shield-max';
  const HQ_CATEGORY_ID = 'cat-hq';
  const CATALOGUE_ID = 'cat-1';
  const SHIELD_ENTRY_ID = 'option-shield';
  const BLOODLINE_ENTRY_ID = 'bloodline-blood-dragon';
  const GATED_MAX = 0;
  const LIFTED_MAX = 1;

  const shieldConstraint = () => ({
    id: SHIELD_MAX_CONSTRAINT_ID,
    type: 'max',
    value: GATED_MAX,
    field: 'selections',
    scope: 'parent'
  });

  function createBloodlineSystem() {
    return {
      id: 'sys-bloodline',
      costTypes: [{ id: POINTS, name: 'Points', defaultCostLimit: 2000 }],
      categoryEntries: [
        { id: HQ_CATEGORY_ID, name: 'HQ' },
        { id: BLOOD_DRAGON_CATEGORY_ID, name: 'Blood Dragon' }
      ],
      forceEntries: [{
        id: 'force-1',
        name: 'Force',
        categoryLinks: [{ id: 'cl-hq', targetId: HQ_CATEGORY_ID, name: 'HQ' }]
      }],
      catalogues: [{
        id: CATALOGUE_ID,
        selectionEntries: [{
          id: 'unit-vampire',
          name: 'Vampire',
          type: 'unit',
          costs: [{ typeId: POINTS, value: 100 }],
          categoryLinks: [{ targetId: HQ_CATEGORY_ID }],
          selectionEntries: [
            {
              id: BLOODLINE_ENTRY_ID,
              name: 'Blood Dragon',
              categoryLinks: [{ targetId: BLOOD_DRAGON_CATEGORY_ID }]
            },
            {
              id: SHIELD_ENTRY_ID,
              name: 'Shield (Blood dragons only)',
              costs: [{ typeId: POINTS, value: 6 }],
              constraints: [shieldConstraint()],
              modifiers: [{
                type: 'set',
                field: SHIELD_MAX_CONSTRAINT_ID,
                value: LIFTED_MAX,
                conditions: [{
                  type: 'greaterThan',
                  value: 0,
                  field: 'selections',
                  scope: 'parent',
                  childId: BLOOD_DRAGON_CATEGORY_ID,
                  includeChildSelections: true
                }]
              }]
            }
          ]
        }]
      }]
    };
  }

  const shieldSelection = () => ({
    id: 'sel-shield',
    selectionEntryId: SHIELD_ENTRY_ID,
    name: 'Shield (Blood dragons only)',
    number: 1,
    costs: [{ typeId: POINTS, value: 6 }]
  });

  const bloodlineSelection = () => ({
    id: 'sel-bloodline',
    selectionEntryId: BLOODLINE_ENTRY_ID,
    name: 'Blood Dragon',
    number: 1
  });

  const createVampireRoster = childSelections => ({
    name: 'r',
    costLimit: 2000,
    costLimitType: POINTS,
    catalogueId: CATALOGUE_ID,
    forces: [{
      id: 'f1',
      forceEntryId: 'force-1',
      catalogueId: CATALOGUE_ID,
      selections: [{
        id: 'sel-vampire',
        selectionEntryId: 'unit-vampire',
        name: 'Vampire',
        number: 1,
        category: HQ_CATEGORY_ID,
        selections: childSelections
      }]
    }]
  });

  const effectiveShieldMax = (roster, system) => getModifiedConstraintValue(
    shieldConstraint(),
    system.catalogues[0].selectionEntries[0].selectionEntries[1].modifiers,
    {
      roster,
      system,
      selectionCounts: {},
      forceCategoryCounts: {},
      selection: roster.forces[0].selections[0],
      parentSelection: null,
      parentCatalogueId: CATALOGUE_ID
    }
  );

  test('ein Blutdrachen-Vampir darf das Schild führen', () => {
    const roster = createVampireRoster([bloodlineSelection(), shieldSelection()]);

    const errors = validateRoster(roster, createBloodlineSystem());

    expect(errors.some(error => error.type === VIOLATION.entryMax)).toBe(false);
  });

  test('das wirksame Limit steigt mit vorhandener Blutlinie auf 1', () => {
    const system = createBloodlineSystem();
    const roster = createVampireRoster([bloodlineSelection(), shieldSelection()]);

    expect(effectiveShieldMax(roster, system)).toBe(LIFTED_MAX);
  });

  test('ohne Blutlinie bleibt das Limit beim Basiswert 0', () => {
    const system = createBloodlineSystem();
    const roster = createVampireRoster([shieldSelection()]);

    expect(effectiveShieldMax(roster, system)).toBe(GATED_MAX);
  });
});
