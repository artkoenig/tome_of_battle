/**
 * Gemeinsame, bewusst generische Testdaten für die Solver-Fassade.
 *
 * Bewusst kein echter Armee-Datensatz (ADR-0003): ein minimales Kunstsystem
 * ("Test Grimdark System") mit genau den Kontingent-, Kategorie- und
 * Gruppenlimits, die die Solver-Tests belegen wollen.
 *
 * Jede Funktion liefert eine **frische** Struktur. Der Solver legt Caches
 * (`_entryCache`) an den Katalogen ab und einige Aufrufe (z. B.
 * `syncRosterSelectionsWithSystem`) mutieren das Roster — geteilte
 * Modulkonstanten würden Tests voneinander abhängig machen (FIRST:
 * *Independent*).
 */

export const POINTS = 'pts';
export const SYSTEM_COST_LIMIT = 2000;

export const CATALOGUE_ID = 'cat-marines';
export const FORCE_ENTRY_ID = 'force-patrol';
export const FORCE_ID = 'f1';

export const CATEGORY_ID = {
  hq: 'cat-hq',
  troops: 'cat-troops',
  characters: 'cat-characters'
};

export const ENTRY_ID = {
  general: '1b7c-2c90-6d96-28c9',
  captain: 'unit-captain',
  tacticalSquad: 'unit-tactical',
  vampire: 'unit-vampire',
  shaman: 'unit-shaman',
  showSpells: 'upgrade-show-spells',
  gazeOfMork: 'spell-gaze',
  fistOfGork: 'spell-fist',
  swordOfBattle: 'item-sword',
  shieldOfGrace: 'item-shield',
  lanceOfDoom: 'item-lance'
};

export const GROUP_ID = {
  magicItems: 'group-magic-items',
  littleWaaagh: 'group-little-waaagh'
};

export const CONSTRAINT_ID = {
  charactersMax: 'limit-char-max',
  tacticalSquadMax: 'limit-tactical',
  magicItemsPointsMax: 'limit-magic-items',
  showSpellsMax: 'limit-show-spells'
};

/** Punktkosten der Katalogeinträge — Testerwartungen rechnen damit. */
export const UNIT_COST = {
  captain: 100,
  tacticalSquad: 150,
  vampire: 80,
  shaman: 80
};

export const ITEM_COST = {
  swordOfBattle: 30,
  shieldOfGrace: 15,
  lanceOfDoom: 25
};

/** Punktebudget der Magic-Items-Gruppe des Vampirs. */
export const MAGIC_ITEMS_POINTS_MAX = 50;

/** Kategorielimits des Kontingents „Patrol Force". */
export const FORCE_LIMIT = {
  hqMin: 1,
  hqMax: 2,
  troopsMin: 1,
  troopsMax: 3,
  charactersMax: 1,
  /** Wert, auf den ein `set`-Modifier `charactersMax` unterhalb des Systemlimits hebt. */
  charactersMaxBelowSystemLimit: 3
};

/** Maximale Zahl gleicher Tactical Squads je Kontingent. */
export const TACTICAL_SQUAD_MAX = 2;

export function createGrimdarkSystem() {
  return {
    id: 'sys-123',
    name: 'Test Grimdark System',
    costTypes: [
      { id: POINTS, name: 'Points', defaultCostLimit: SYSTEM_COST_LIMIT }
    ],
    categoryEntries: [
      { id: CATEGORY_ID.hq, name: 'HQ' },
      { id: CATEGORY_ID.troops, name: 'Troops' },
      { id: CATEGORY_ID.characters, name: 'Characters' }
    ],
    forceEntries: [
      {
        id: FORCE_ENTRY_ID,
        name: 'Patrol Force',
        categoryLinks: [
          {
            id: 'cl-hq',
            targetId: CATEGORY_ID.hq,
            name: 'HQ Link',
            constraints: [
              { type: 'min', value: FORCE_LIMIT.hqMin, scope: 'force' },
              { type: 'max', value: FORCE_LIMIT.hqMax, scope: 'force' }
            ]
          },
          {
            id: 'cl-troops',
            targetId: CATEGORY_ID.troops,
            name: 'Troops Link',
            constraints: [
              { type: 'min', value: FORCE_LIMIT.troopsMin, scope: 'force' },
              { type: 'max', value: FORCE_LIMIT.troopsMax, scope: 'force' }
            ]
          },
          {
            id: 'cl-characters',
            targetId: CATEGORY_ID.characters,
            name: 'Characters Link',
            constraints: [
              { id: CONSTRAINT_ID.charactersMax, type: 'max', value: FORCE_LIMIT.charactersMax, scope: 'force' }
            ],
            // Unterhalb des Systemlimits von 2000 Punkten sind mehr Charaktere erlaubt.
            modifiers: [
              {
                type: 'set',
                field: CONSTRAINT_ID.charactersMax,
                value: String(FORCE_LIMIT.charactersMaxBelowSystemLimit),
                valueObject: FORCE_LIMIT.charactersMaxBelowSystemLimit,
                conditions: [
                  { field: `limit::${POINTS}`, type: 'lessThan', value: SYSTEM_COST_LIMIT }
                ]
              }
            ]
          }
        ]
      }
    ],
    catalogues: [
      {
        id: CATALOGUE_ID,
        name: 'Space Marines',
        selectionEntries: [
          {
            id: ENTRY_ID.general,
            name: 'General'
          },
          {
            id: ENTRY_ID.captain,
            name: 'Space Marine Captain',
            costs: [{ typeId: POINTS, value: UNIT_COST.captain }],
            categoryLinks: [{ targetId: CATEGORY_ID.hq }, { targetId: CATEGORY_ID.characters }]
          },
          {
            id: ENTRY_ID.tacticalSquad,
            name: 'Tactical Squad',
            costs: [{ typeId: POINTS, value: UNIT_COST.tacticalSquad }],
            categoryLinks: [{ targetId: CATEGORY_ID.troops }],
            constraints: [
              { id: CONSTRAINT_ID.tacticalSquadMax, type: 'max', value: TACTICAL_SQUAD_MAX, field: 'selections', scope: 'parent' }
            ]
          },
          {
            id: ENTRY_ID.vampire,
            name: 'Vampire Thrall',
            costs: [{ typeId: POINTS, value: UNIT_COST.vampire }],
            categoryLinks: [{ targetId: CATEGORY_ID.hq }, { targetId: CATEGORY_ID.characters }],
            selectionEntryGroups: [
              {
                id: GROUP_ID.magicItems,
                name: 'Magic Items',
                constraints: [
                  { id: CONSTRAINT_ID.magicItemsPointsMax, type: 'max', value: MAGIC_ITEMS_POINTS_MAX, field: POINTS, scope: 'parent' }
                ],
                selectionEntries: [
                  { id: ENTRY_ID.swordOfBattle, name: 'Sword of Battle', costs: [{ typeId: POINTS, value: ITEM_COST.swordOfBattle }] },
                  { id: ENTRY_ID.shieldOfGrace, name: 'Shield of Grace', costs: [{ typeId: POINTS, value: ITEM_COST.shieldOfGrace }] },
                  { id: ENTRY_ID.lanceOfDoom, name: 'Lance of Doom', costs: [{ typeId: POINTS, value: ITEM_COST.lanceOfDoom }] }
                ]
              }
            ]
          },
          {
            id: ENTRY_ID.shaman,
            name: 'Orc Shaman',
            costs: [{ typeId: POINTS, value: UNIT_COST.shaman }],
            categoryLinks: [{ targetId: CATEGORY_ID.hq }],
            selectionEntries: [
              {
                id: ENTRY_ID.showSpells,
                name: 'Show Spells',
                constraints: [
                  { id: CONSTRAINT_ID.showSpellsMax, type: 'max', value: 1, field: 'selections', scope: 'parent' }
                ],
                selectionEntryGroups: [
                  {
                    id: GROUP_ID.littleWaaagh,
                    name: 'LittleWaaagh',
                    selectionEntries: [
                      { id: ENTRY_ID.gazeOfMork, name: '1. Gaze of Mork', costs: [{ typeId: POINTS, value: 0 }] },
                      { id: ENTRY_ID.fistOfGork, name: '2. Fist of Gork', costs: [{ typeId: POINTS, value: 0 }] }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  };
}

/** Die Pflichtauswahl „General", die jede Einheit des Testsystems tragen kann. */
export function createGeneralSelection(id = 'sel-general') {
  return { id, selectionEntryId: ENTRY_ID.general, name: 'General', number: 1 };
}

export function createCaptainSelection({ id = 'sel-cap', selections = [createGeneralSelection()] } = {}) {
  return {
    id,
    selectionEntryId: ENTRY_ID.captain,
    name: 'Space Marine Captain',
    number: 1,
    category: CATEGORY_ID.hq,
    costs: [{ typeId: POINTS, value: UNIT_COST.captain }],
    selections
  };
}

export function createTacticalSquadSelection({ id = 'sel-tac', name = 'Tactical Squad', selections = [] } = {}) {
  return {
    id,
    selectionEntryId: ENTRY_ID.tacticalSquad,
    name,
    number: 1,
    category: CATEGORY_ID.troops,
    costs: [{ typeId: POINTS, value: UNIT_COST.tacticalSquad }],
    selections
  };
}

/** Vampir mit den übergebenen Magic-Item-Einträgen als Unterauswahlen. */
export function createVampireSelection({ id = 'sel-vampire', itemEntryIds = [] } = {}) {
  const itemSelections = itemEntryIds.map((entryId, index) => ({
    id: `sel-item-${index + 1}`,
    selectionEntryId: entryId,
    name: entryId,
    number: 1
  }));

  return {
    id,
    selectionEntryId: ENTRY_ID.vampire,
    name: 'Vampire Thrall',
    number: 1,
    category: CATEGORY_ID.hq,
    costs: [{ typeId: POINTS, value: UNIT_COST.vampire }],
    selections: [...itemSelections, createGeneralSelection()]
  };
}

export function createRoster({ name = 'Test Roster', costLimit = 1000, selections = [] } = {}) {
  return {
    name,
    costLimit,
    costLimitType: POINTS,
    forces: [
      {
        id: FORCE_ID,
        forceEntryId: FORCE_ENTRY_ID,
        catalogueId: CATALOGUE_ID,
        selections
      }
    ]
  };
}

/**
 * Regelkonformes Roster: erfüllt HQ-Min und Troops-Min und bleibt unter allen
 * Kategorie- und Punktelimits.
 */
export function createValidRoster({ name = 'Strike Force Alpha', costLimit = 1000 } = {}) {
  return createRoster({
    name,
    costLimit,
    selections: [createCaptainSelection(), createTacticalSquadSelection()]
  });
}
