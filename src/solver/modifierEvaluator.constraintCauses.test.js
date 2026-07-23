import { describe, test, expect } from 'vitest';
import {
  evaluateConstraint,
  resolveConditionTrigger,
  evaluateConstraintWithCauses,
  getModifiedConstraintValue
} from './modifierEvaluator.js';

// Ursachen-Herleitung im Solver (ADR 0027): Die Constraint-Auswertung liefert neben dem
// Endwert die aktiv beitragenden bedingten Modifier, und eine reine Funktion löst deren
// Bedingung auf die benennbare auslösende Auswahl auf. Getestet werden die zwei framework-
// freien Nahtstellen (Seam 1 + 2) sowie ihr Zusammenspiel — ohne Anzeige/Formatierung.

const CONSTRAINT_ID = 'con-weapons-max';
const CATALOGUE_ID = 'cat-cause';
const BATTLE_STANDARD_ID = 'entry-battle-standard';
const WAR_HORN_ID = 'entry-war-horn';
const CATEGORY_ID = 'cat-elites';
const TYPE_KEYWORD_CHILD_ID = 'model';

const BASE_MAX = 5;

const constraint = () => ({ id: CONSTRAINT_ID, value: BASE_MAX });

// Bedingung „diese Auswahl ist im Roster vorhanden", aufgelöst über selectionCounts,
// damit Seam 1 ohne ein volles Spielsystem auskommt.
const presenceCondition = (childId) => ({ type: 'atLeast', value: 1, field: 'selections', childId });

const conditionalDecrement = (childId, amount) => ({
  type: 'decrement',
  field: CONSTRAINT_ID,
  valueObject: amount,
  conditions: [presenceCondition(childId)]
});

const unconditionalDecrement = (amount) => ({
  type: 'decrement',
  field: CONSTRAINT_ID,
  valueObject: amount
});

// Minimales System nur zur Namensauflösung: benennbare Auswahlen plus eine Kategorie
// (die keine wählbare Auswahl ist) und keine Nennung des Typ-Schlüsselworts „model".
const buildSystem = () => ({
  id: 'sys-cause',
  catalogues: [
    {
      id: CATALOGUE_ID,
      categoryEntries: [{ id: CATEGORY_ID, name: 'Elites' }],
      selectionEntries: [
        { id: BATTLE_STANDARD_ID, name: 'Battle Standard Bearer', type: 'upgrade' },
        { id: WAR_HORN_ID, name: 'War Horn', type: 'upgrade' }
      ]
    }
  ]
});

const nameResolutionCtx = (extra = {}) => ({ system: buildSystem(), parentCatalogueId: CATALOGUE_ID, ...extra });

describe('evaluateConstraint — Endwert plus beitragende bedingte Modifier (Seam 1)', () => {
  test('reiner Basiswert: Endwert unverändert, keine beitragenden Modifier', () => {
    const { value, contributingConditionalModifiers } = evaluateConstraint(constraint(), []);

    expect(value).toBe(BASE_MAX);
    expect(contributingConditionalModifiers).toEqual([]);
  });

  test('der Endwert bleibt identisch zu getModifiedConstraintValue', () => {
    const modifiers = [conditionalDecrement(BATTLE_STANDARD_ID, 2), unconditionalDecrement(1)];
    const ctx = { selectionCounts: { [BATTLE_STANDARD_ID]: 1 } };

    const { value } = evaluateConstraint(constraint(), modifiers, ctx);

    expect(value).toBe(getModifiedConstraintValue(constraint(), modifiers, ctx));
    expect(value).toBe(BASE_MAX - 2 - 1);
  });

  test('unbedingter Modifier verändert den Wert, zählt aber nicht als beitragend', () => {
    const { value, contributingConditionalModifiers } = evaluateConstraint(constraint(), [unconditionalDecrement(2)]);

    expect(value).toBe(BASE_MAX - 2);
    expect(contributingConditionalModifiers).toEqual([]);
  });

  test('bedingter Modifier mit erfüllter Bedingung, der den Wert ändert, ist beitragend', () => {
    const modifier = conditionalDecrement(BATTLE_STANDARD_ID, 2);

    const { contributingConditionalModifiers } = evaluateConstraint(constraint(), [modifier], {
      selectionCounts: { [BATTLE_STANDARD_ID]: 1 }
    });

    expect(contributingConditionalModifiers).toEqual([modifier]);
  });

  test('bedingter Modifier mit unerfüllter Bedingung wirkt nicht und zählt nicht', () => {
    const modifier = conditionalDecrement(BATTLE_STANDARD_ID, 2);

    const { value, contributingConditionalModifiers } = evaluateConstraint(constraint(), [modifier], {
      selectionCounts: {}
    });

    expect(value).toBe(BASE_MAX);
    expect(contributingConditionalModifiers).toEqual([]);
  });

  test('bedingter Modifier, der den Wert nicht verändert, zählt nicht als beitragend', () => {
    const unchangingSet = {
      type: 'set',
      field: CONSTRAINT_ID,
      valueObject: BASE_MAX,
      conditions: [presenceCondition(BATTLE_STANDARD_ID)]
    };

    const { value, contributingConditionalModifiers } = evaluateConstraint(constraint(), [unchangingSet], {
      selectionCounts: { [BATTLE_STANDARD_ID]: 1 }
    });

    expect(value).toBe(BASE_MAX);
    expect(contributingConditionalModifiers).toEqual([]);
  });

  test('ganze Kette: mehrere beitragende bedingte Modifier in Dokumentreihenfolge', () => {
    const first = conditionalDecrement(BATTLE_STANDARD_ID, 2);
    const second = conditionalDecrement(WAR_HORN_ID, 3);

    const { value, contributingConditionalModifiers } = evaluateConstraint(constraint(), [first, second], {
      selectionCounts: { [BATTLE_STANDARD_ID]: 1, [WAR_HORN_ID]: 1 }
    });

    expect(value).toBe(BASE_MAX - 2 - 3);
    expect(contributingConditionalModifiers).toEqual([first, second]);
  });
});

describe('resolveConditionTrigger — Bedingung → benennbare Auswahl oder „nicht auflösbar" (Seam 2)', () => {
  test('childId einer wählbaren Auswahl → Katalog-Id und -Name', () => {
    const trigger = resolveConditionTrigger(presenceCondition(BATTLE_STANDARD_ID), nameResolutionCtx());

    expect(trigger).toEqual({ entryId: BATTLE_STANDARD_ID, name: 'Battle Standard Bearer' });
  });

  test('Bedingung ohne childId (reiner Vergleich) → nicht auflösbar', () => {
    const comparison = { type: 'lessThan', value: 2000, field: 'limit::pts' };

    expect(resolveConditionTrigger(comparison, nameResolutionCtx())).toBeNull();
  });

  test('childId benennt eine Kategorie statt einer wählbaren Auswahl → nicht auflösbar', () => {
    expect(resolveConditionTrigger(presenceCondition(CATEGORY_ID), nameResolutionCtx())).toBeNull();
  });

  test('childId ist ein Typ-Schlüsselwort („model") → nicht auflösbar', () => {
    expect(resolveConditionTrigger(presenceCondition(TYPE_KEYWORD_CHILD_ID), nameResolutionCtx())).toBeNull();
  });

  test('childId zeigt auf einen unbekannten Eintrag → nicht auflösbar', () => {
    expect(resolveConditionTrigger(presenceCondition('entry-does-not-exist'), nameResolutionCtx())).toBeNull();
  });

  test('ohne System im Kontext ist keine Auflösung möglich → nicht auflösbar', () => {
    expect(resolveConditionTrigger(presenceCondition(BATTLE_STANDARD_ID), {})).toBeNull();
  });
});

describe('evaluateConstraintWithCauses — Ursachen der ganzen Kette, dedupliziert', () => {
  const causesCtx = (selectionCounts) => nameResolutionCtx({ selectionCounts });

  test('ein beitragender bedingter Modifier → eine benennbare Ursache', () => {
    const modifier = { type: 'set', field: CONSTRAINT_ID, valueObject: 0, conditions: [presenceCondition(BATTLE_STANDARD_ID)] };

    const { value, causes } = evaluateConstraintWithCauses(constraint(), [modifier], causesCtx({ [BATTLE_STANDARD_ID]: 1 }));

    expect(value).toBe(0);
    expect(causes).toEqual([{ entryId: BATTLE_STANDARD_ID, name: 'Battle Standard Bearer' }]);
  });

  test('reiner Basiswert und unbedingter Modifier erzeugen keine Ursache', () => {
    const { causes } = evaluateConstraintWithCauses(constraint(), [unconditionalDecrement(1)], causesCtx({}));

    expect(causes).toEqual([]);
  });

  test('mehrere beitragende Modifier → mehrere Ursachen in Reihenfolge (ganze Kette)', () => {
    const modifiers = [conditionalDecrement(BATTLE_STANDARD_ID, 2), conditionalDecrement(WAR_HORN_ID, 3)];

    const { causes } = evaluateConstraintWithCauses(constraint(), modifiers, causesCtx({ [BATTLE_STANDARD_ID]: 1, [WAR_HORN_ID]: 1 }));

    expect(causes).toEqual([
      { entryId: BATTLE_STANDARD_ID, name: 'Battle Standard Bearer' },
      { entryId: WAR_HORN_ID, name: 'War Horn' }
    ]);
  });

  test('zwei Modifier, die dieselbe Auswahl nennen, ergeben nur eine Ursache', () => {
    const modifiers = [conditionalDecrement(BATTLE_STANDARD_ID, 1), conditionalDecrement(BATTLE_STANDARD_ID, 1)];

    const { causes } = evaluateConstraintWithCauses(constraint(), modifiers, causesCtx({ [BATTLE_STANDARD_ID]: 1 }));

    expect(causes).toEqual([{ entryId: BATTLE_STANDARD_ID, name: 'Battle Standard Bearer' }]);
  });

  test('über conditionGroups gegateter Modifier → Ursache aus der verschachtelten Bedingung', () => {
    const groupGatedSet = {
      type: 'set',
      field: CONSTRAINT_ID,
      valueObject: 0,
      conditionGroups: [{ type: 'and', conditions: [presenceCondition(BATTLE_STANDARD_ID)] }]
    };

    const { value, causes } = evaluateConstraintWithCauses(constraint(), [groupGatedSet], causesCtx({ [BATTLE_STANDARD_ID]: 1 }));

    expect(value).toBe(0);
    expect(causes).toEqual([{ entryId: BATTLE_STANDARD_ID, name: 'Battle Standard Bearer' }]);
  });

  test('bedingt verändert, aber nicht auflösbar (reiner Vergleich) → keine Ursache', () => {
    const modifier = {
      type: 'set',
      field: CONSTRAINT_ID,
      valueObject: 0,
      conditions: [{ type: 'lessThan', value: 2000, field: 'limit::pts' }]
    };

    const { value, causes } = evaluateConstraintWithCauses(constraint(), [modifier], nameResolutionCtx());

    expect(value).toBe(0);
    expect(causes).toEqual([]);
  });
});
