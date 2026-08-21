/**
 * Die Ankreuz-Zustaende aus dem Bericht (Issue 0156, AC2).
 *
 * Die Ankreuzliste rendert genau diese Felder: `checked` (Haken),
 * `mandatory` (Zeile gesperrt), `isContainer` (Unteroptionen) und `isBinary`
 * (Schalter statt Mengen-Adder) — `ListRuleChecklist.jsx`. Was hier nicht
 * behauptet wird, faellt in der Oberfläche lautlos aus.
 */
import { describe, it, expect } from 'vitest';
import { SlotIndex } from './slotIndex.js';
import { resolveListRuleGroupFromReport } from './listRuleGroups.js';

const CATEGORY = 'cat-list-rules';

/** Ein Faehigkeits-Datensatz des Berichts, wie ihn ein Kategorie-Slot traegt. */
const capabilityOf = (overrides = {}) => ({
  name: 'Regel',
  defId: 'def',
  targetDefId: null,
  anchorKind: 'offerAnchor',
  isIndependentSubUnit: false,
  isHidden: false,
  isListRule: true,
  isMandatoryListRule: false,
  primaryCategoryId: CATEGORY,
  effectiveMax: 1,
  ...overrides,
});

/**
 * Ein Kontingent `"0"` mit zwei angebotenen Listenregeln; `"0/0"` ist Pflicht
 * und fuehrt einen Unter-Slot, `"0/1"` ist frei und kinderlos.
 */
const reportCapabilities = () =>
  new Map([
    ['0/0', capabilityOf({ name: 'Pflichtregel', defId: 'rule-a', isMandatoryListRule: true })],
    ['0/0/0', capabilityOf({ name: 'Unteroption', defId: 'sub-a', primaryCategoryId: null })],
    ['0/1', capabilityOf({ name: 'Freie Regel', defId: 'rule-b', effectiveMax: 3 })],
  ]);

const stateByName = (states) => new Map(states.map((state) => [state.name, state]));

describe('resolveListRuleGroupFromReport: Zustaende der Ankreuzliste', () => {
  it('hakt genau die Regeln an, unter deren Slot-Pfad eine Selektion steht', () => {
    const selection = { selectionId: 's-1' };
    const { isListRuleGroup, states } = resolveListRuleGroupFromReport(
      SlotIndex.fromMaps({ capabilities: reportCapabilities() }),
      '0',
      CATEGORY,
      { selectionByPath: new Map([['0/0', selection]]) },
    );

    expect(isListRuleGroup).toBe(true);
    const byName = stateByName(states);
    expect(byName.get('Pflichtregel').checked).toBe(true);
    expect(byName.get('Pflichtregel').selection).toBe(selection);
    expect(byName.get('Freie Regel').checked).toBe(false);
    expect(byName.get('Freie Regel').selection).toBeNull();
  });

  it('laesst ohne Selektionen jede Regel unangehakt', () => {
    const { states } = resolveListRuleGroupFromReport(SlotIndex.fromMaps({ capabilities: reportCapabilities() }), '0', CATEGORY);

    expect(states.map((state) => state.checked)).toEqual([false, false]);
  });

  it('meldet als mandatory genau die Regeln mit isMandatoryListRule', () => {
    const { states } = resolveListRuleGroupFromReport(SlotIndex.fromMaps({ capabilities: reportCapabilities() }), '0', CATEGORY);

    const byName = stateByName(states);
    expect(byName.get('Pflichtregel').mandatory).toBe(true);
    expect(byName.get('Freie Regel').mandatory).toBe(false);
  });

  it('meldet als isContainer nur die Regel, deren Slot eigene Unter-Slots fuehrt', () => {
    const { states } = resolveListRuleGroupFromReport(SlotIndex.fromMaps({ capabilities: reportCapabilities() }), '0', CATEGORY);

    const byName = stateByName(states);
    expect(byName.get('Pflichtregel').isContainer).toBe(true);
    expect(byName.get('Freie Regel').isContainer).toBe(false);
  });

  it('ist binaer bis zu einem wirksamen Hoechstmass von 1, darueber Mengen-Adder', () => {
    const capabilities = reportCapabilities();
    capabilities.set('0/2', capabilityOf({ name: 'Unbeschraenkt', defId: 'rule-c', effectiveMax: null }));
    const { states } = resolveListRuleGroupFromReport(SlotIndex.fromMaps({ capabilities }), '0', CATEGORY);

    const byName = stateByName(states);
    expect(byName.get('Pflichtregel').isBinary).toBe(true);
    expect(byName.get('Freie Regel').isBinary).toBe(false);
    expect(byName.get('Unbeschraenkt').isBinary).toBe(true);
  });

  it('liefert fuer eine Kategorie ohne reine Listenregeln keine Zustaende', () => {
    const capabilities = reportCapabilities();
    capabilities.set('0/1', capabilityOf({ name: 'Einheit', defId: 'unit', isListRule: false }));
    const result = resolveListRuleGroupFromReport(SlotIndex.fromMaps({ capabilities }), '0', CATEGORY);

    expect(result).toEqual({ isListRuleGroup: false, states: [] });
  });
});
