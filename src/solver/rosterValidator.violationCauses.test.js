import { describe, test, expect } from 'vitest';
import { validateRoster } from './validator.js';
import {
  CATEGORY_ID,
  FORCE_LIMIT,
  createGrimdarkSystem,
  createRoster,
  createCaptainSelection
} from './__fixtures__/grimdarkSystem.js';

// Ende-zu-Ende-Beleg der Ursachen am Fehlerobjekt (ADR 0027): Der Validator hängt an einen
// Verstoß, dessen verletzter Grenzwert durch einen bedingten Modifier verändert wurde, die
// aufgelösten, sprachfreien Ursachen — und nur dann. Anzeige/Formatierung ist nicht Teil
// dieser Slice (Slice 02); geprüft wird ausschließlich das Feld am ValidationError.

const POINTS = 'pts-cause';
const CATALOGUE_ID = 'cat-cause';
const FORCE_ENTRY_ID = 'force-cause';
const HQ_CATEGORY_ID = 'cat-hq-cause';
const COMMANDER_ID = 'entry-commander';
const BATTLE_STANDARD_ID = 'entry-battle-standard';
const LONG_BOW_ID = 'entry-long-bow';
const LONG_BOW_MAX_ID = 'con-long-bow-max';

const BATTLE_STANDARD_NAME = 'Battle Standard Bearer';
const LONG_BOW_BASE_MAX = 1;

// Modifier, der die Waffen-Obergrenze auf 0 setzt, sobald im selben Kommandeur ein
// Battle Standard Bearer gewählt ist — die reale Konstellation aus dem PRD.
const battleStandardGatedMaxToZero = () => ({
  type: 'set',
  field: LONG_BOW_MAX_ID,
  value: '0',
  valueObject: 0,
  conditions: [{ type: 'atLeast', value: 1, field: 'selections', scope: 'parent', childId: BATTLE_STANDARD_ID }]
});

// Unbedingter Autoren-Hinweis (`field="error"`) am Kommandeur: erzeugt eine
// `modifier-error`-Meldung, die niemals ein Ursachen-Feld tragen darf.
const AUTHOR_ERROR_TEXT = 'Commander must join a unit.';
const authorErrorModifier = () => ({ type: 'set', field: 'error', value: AUTHOR_ERROR_TEXT });

function buildCauseSystem() {
  return {
    id: 'sys-cause',
    costTypes: [{ id: POINTS, name: 'pts', defaultCostLimit: 2000 }],
    categoryEntries: [{ id: HQ_CATEGORY_ID, name: 'HQ' }],
    forceEntries: [{ id: FORCE_ENTRY_ID, name: 'Host', categoryLinks: [] }],
    catalogues: [
      {
        id: CATALOGUE_ID,
        name: 'Cause Catalogue',
        selectionEntries: [
          {
            id: COMMANDER_ID,
            name: 'Commander',
            type: 'unit',
            categoryLinks: [{ targetId: HQ_CATEGORY_ID }],
            modifiers: [authorErrorModifier()],
            selectionEntries: [
              { id: BATTLE_STANDARD_ID, name: BATTLE_STANDARD_NAME, type: 'upgrade' },
              {
                id: LONG_BOW_ID,
                name: 'Long Bow',
                type: 'upgrade',
                constraints: [
                  { id: LONG_BOW_MAX_ID, type: 'max', value: LONG_BOW_BASE_MAX, field: 'selections', scope: 'parent' }
                ],
                modifiers: [battleStandardGatedMaxToZero()]
              }
            ]
          }
        ]
      }
    ]
  };
}

function longBowSelection(id) {
  return { id, selectionEntryId: LONG_BOW_ID, name: 'Long Bow', number: 1 };
}

function battleStandardSelection() {
  return { id: 'sel-standard', selectionEntryId: BATTLE_STANDARD_ID, name: BATTLE_STANDARD_NAME, number: 1 };
}

function buildRoster(commanderChildren) {
  return {
    name: 'Cause Roster',
    costLimit: 2000,
    costLimitType: POINTS,
    forces: [
      {
        id: 'f-cause',
        forceEntryId: FORCE_ENTRY_ID,
        catalogueId: CATALOGUE_ID,
        selections: [
          {
            id: 'sel-commander',
            selectionEntryId: COMMANDER_ID,
            name: 'Commander',
            number: 1,
            category: HQ_CATEGORY_ID,
            selections: commanderChildren
          }
        ]
      }
    ]
  };
}

const entryMaxErrors = (errors) => errors.filter(error => error.type === 'entry-max');

describe('validateRoster — Ursachen an bedingt verändertem Grenzwert (ADR 0027)', () => {
  test('ein bedingt auf 0 gesetzter Grenzwert trägt die auslösende Auswahl als Ursache', () => {
    const roster = buildRoster([battleStandardSelection(), longBowSelection('sel-long-bow')]);

    const errors = validateRoster(roster, buildCauseSystem());
    const [longBowViolation] = entryMaxErrors(errors);

    expect(longBowViolation).toBeDefined();
    expect(longBowViolation.selectionId).toBe('sel-long-bow');
    expect(longBowViolation.causes).toEqual([{ entryId: BATTLE_STANDARD_ID, name: BATTLE_STANDARD_NAME }]);
  });

  test('ein reiner Basiswert-Verstoß (unbedingt) trägt kein Ursachen-Feld', () => {
    // Ohne Battle Standard bleibt die Obergrenze beim Basiswert 1; zwei Long Bows
    // verletzen sie, ohne dass ein bedingter Modifier gegriffen hätte.
    const roster = buildRoster([longBowSelection('sel-long-bow-1'), longBowSelection('sel-long-bow-2')]);

    const errors = validateRoster(roster, buildCauseSystem());
    const [longBowViolation] = entryMaxErrors(errors);

    expect(longBowViolation).toBeDefined();
    expect(longBowViolation).not.toHaveProperty('causes');
  });

  test('Autoren-Meldungen (modifier-error) bleiben ohne Ursachen-Feld', () => {
    const roster = buildRoster([battleStandardSelection(), longBowSelection('sel-long-bow')]);

    const errors = validateRoster(roster, buildCauseSystem());
    const authorError = errors.find(error => error.type === 'modifier-error' && error.message === AUTHOR_ERROR_TEXT);

    expect(authorError).toBeDefined();
    expect(authorError).not.toHaveProperty('causes');
  });
});

describe('validateRoster — nicht auflösbare Ursache entfällt (ADR 0027)', () => {
  test('ein bedingt, aber nur per Vergleich veränderter Grenzwert trägt kein Ursachen-Feld', () => {
    // Der charactersMax-Modifier hebt die Obergrenze bedingt (Punktelimit < 2000) von 1 auf 3;
    // seine Bedingung zeigt auf keine benennbare Auswahl, also bleibt der Verstoß ohne Ursache.
    const overLimit = FORCE_LIMIT.charactersMaxBelowSystemLimit + 1;
    const captains = Array.from({ length: overLimit }, (_, index) =>
      createCaptainSelection({ id: `sel-cap-${index + 1}` })
    );
    const roster = createRoster({ costLimit: 1000, selections: captains });

    const errors = validateRoster(roster, createGrimdarkSystem());
    const charactersMax = errors.find(
      error => error.type === 'category-max' && error.categoryId === CATEGORY_ID.characters
    );

    expect(charactersMax).toBeDefined();
    expect(charactersMax.messageParams.count).toBe(FORCE_LIMIT.charactersMaxBelowSystemLimit);
    expect(charactersMax).not.toHaveProperty('causes');
  });
});
