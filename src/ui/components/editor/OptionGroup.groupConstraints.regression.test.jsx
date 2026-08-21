import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OptionGroupHarness as OptionGroupComponent } from '../../../shared/test-utils/editorHarness';
import { createSubSelectionOperationsMock } from '../../../shared/test-utils/subSelectionOperationsMock';

// ─────────────────────────────────────────────────────────────────────────────
// Konsolidierte Regression: bedingte Gruppen-Constraints (Issue 57),
// angepasst an die neue Wirklichkeit aus Issue 0121, Task 6 (ADR-0035).
//
// Diese Datei bündelt die Verhaltensklassen des Rüstung+Schild-Bugs zu EINER
// zusammenhängenden Aussage entlang des Render-Entscheids: die reale
// `OptionGroup` rendert gegen die **Fähigkeitsdatensätze des Berichts** —
// effektive Gruppen-/Options-Grenzen je Slot UND, seit Issue 0156, auch das
// **Wahlverhalten**: `isSingleChoice`/`isMaxRaisable` am Gruppen-Anker,
// `isRepeatableWithinGroup` am Options-Slot. Die statische Erkennung liegt
// damit im Evaluator (`groupBehavior.js`), nicht mehr in der Komponente.
//
// Der historische Bug (roher statt effektiver Constraint-Wert) ist im neuen
// Schnitt strukturell ausgeschlossen — die Komponente rechnet keine effektiven
// Werte mehr, sie liest sie ab. Geprüft wird hier die verbleibende Naht: dass
// die abgelesenen Werte weiterhin dieselben
// Radio-/Checkbox-/Stepper-/Deaktivierungs-Entscheidungen treiben. Wie die
// Engine die effektiven Werte errechnet (bedingte increments, decrements,
// sets), ist in den Evaluator-Tests (`src/domain/evaluator/`) eigens abgedeckt; die
// Slot-Werte hier sind die dort belegten Ergebnisformen des Berichts.
// ─────────────────────────────────────────────────────────────────────────────

// Lucide-Icons zu Test-IDs verflachen (reine Darstellung, nicht der Entscheid).
vi.mock('lucide-react', () => ({
  ChevronDown: () => <span data-testid="icon-chevron-down" />,
  ChevronRight: () => <span data-testid="icon-chevron-right" />,
  Plus: () => <span data-testid="icon-plus" />,
  Minus: () => <span data-testid="icon-minus" />,
  Info: (props) => <span data-testid="icon-info" {...props} />,
  BookOpen: (props) => <span data-testid="icon-book" {...props} />,
}));

// Der Regel-Link-Hook hängt an der Settings-Context-Kette und ist für den
// Render-Entscheid irrelevant — auf „kein Link" stellen.
vi.mock('../../hooks/useRuleUrl', () => ({
  useRuleUrl: () => () => null,
}));

const COST_TYPE_ID = 'pts';
const SELECTION_PATH = '0/0';

// Minimales reales System/Roster: Optionen tragen ihre `id`/`name` direkt,
// sodass `resolveEntry` sie unverändert zurückgibt (nur noch Beiwerk für
// Detailtexte und die statische Wiederholbarkeits-Erkennung).
const system = { id: 'sys-regression', costTypes: [{ id: COST_TYPE_ID, name: 'Punkte' }], catalogues: [] };
const roster = { costLimitType: COST_TYPE_ID, forces: [] };
const activeCatalogue = { id: 'cat-regression' };

const option = (id, name) => ({ option: { id, name } });

const groupMaxConstraint = (id, value) => ({
  id, type: 'max', field: 'selections', scope: 'parent', value,
});

// Genau der Rüstung+Schild-Katalogfall: Gruppe max=1 plus bedingter increment auf
// diese Max-Constraint, an eine Schild-Auswahl gekoppelt (kein <repeat>).
const SHIELD_PRESENT = (shieldId) => ({
  type: 'greaterThan', field: 'selections', scope: 'parent', childId: shieldId, value: 0,
});

/**
 * Slot-Map in Berichtsform: je Eintrag ein Fähigkeitsdatensatz unter einem
 * Pfad direkt unterhalb der Träger-Auswahl (Feldsatz wie `report.js`,
 * `toCapability`; die Wertformen sind durch die Evaluator-Tests belegt).
 */
const capabilityMapOf = (records) => new Map(records.map((record, index) => [
  `${SELECTION_PATH}/${index}`,
  {
    targetDefId: null, frame: { path: SELECTION_PATH, defId: 'unit-link' },
    costs: {}, effectiveMin: null, effectiveMax: null, current: 0, headroom: null,
    isMandatoryUnmet: false, isBlocked: false, isHidden: false,
    isSingleChoice: false, isMaxRaisable: false, isRepeatableWithinGroup: false,
    ...record,
  },
]));

let subSelectionOperations;
let counts;

// Die gewählten Optionen stehen im Roster-Teilbaum der Träger-Auswahl: das
// ViewModel zählt sie dort, statt einen gereichten Zähler zu befragen.
const selectionWithCounts = () => ({
  id: 'sel-unit', entryLinkId: 'unit-link', number: 1,
  selections: Object.entries(counts).flatMap(([optionId, count]) =>
    Array.from({ length: count }, (_, index) => ({
      id: `${optionId}-${index}`, entryLinkId: optionId, number: 1, selections: [],
    }))),
});

const buildProps = (group, capabilities) => ({
  group,
  selection: selectionWithCounts(),
  selectionPath: SELECTION_PATH,
  capabilities,
  system,
  roster,
  subSelectionOperations,
  getOptionDescription: () => '',
  activeCatalogue,
  setActiveInfo: vi.fn(),
  onHoverEnter: vi.fn(),
  onHoverMove: vi.fn(),
  onHoverLeave: vi.fn(),
});

const renderGroup = (group, capabilities) =>
  render(<OptionGroupComponent {...buildProps(group, capabilities)} />);

// Klappt die Gruppe auf, falls sie nicht ohnehin (wegen bestehender Auswahl)
// bereits offen ist — die Optionszeilen erscheinen erst dann.
const expandGroup = (groupName) => {
  if (screen.queryByTestId('icon-chevron-right')) {
    fireEvent.click(screen.getByText(groupName).closest('div'));
  }
};

const rowOf = (optionName) => screen.getByText(optionName).closest('.sub-selection-row');

beforeEach(() => {
  subSelectionOperations = createSubSelectionOperationsMock();
  counts = {};
});

describe('Issue 57 — konsolidierte Regression: bedingte Gruppen-Constraints (Bericht + statische Erkennung)', () => {
  it('(a) Rüstung+Schild: max-hebbare Gruppe rendert als Mehrfachauswahl und beide sind gemeinsam wählbar', () => {
    // max=1 + bedingter increment auf die Gruppen-Max, an das Schild gekoppelt.
    const armourGroup = {
      id: 'grp-armour',
      name: 'Rüstung',
      constraints: [groupMaxConstraint('con-armour-max', 1)],
      modifiers: [{ type: 'increment', field: 'con-armour-max', valueObject: 1, conditions: [SHIELD_PRESENT('opt-shield')] }],
      items: [option('opt-fullplate', 'Volle Rüstung'), option('opt-shield', 'Schild')],
    };

    // Noch KEIN Schild gewählt → der Bericht meldet das effektive Max 1 am
    // Gruppen-Anker. Der Nur-Effektivwert-Blick hätte hier Radios erzwungen
    // (Teufelskreis). Da ein Modifier das Max über 1 heben KANN, muss die
    // Gruppe dennoch als Checkboxen rendern.
    const emptyCapabilities = capabilityMapOf([
      { defId: 'grp-armour', anchorKind: 'groupAnchor', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null, name: 'Rüstung', effectiveMax: 1, current: 0, isMaxRaisable: true },
      { defId: 'opt-fullplate', anchorKind: 'offerAnchor', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null, name: 'Volle Rüstung' },
      { defId: 'opt-shield', anchorKind: 'offerAnchor', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null, name: 'Schild' },
    ]);
    const { unmount } = renderGroup(armourGroup, emptyCapabilities);
    expandGroup('Rüstung');
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
    unmount();

    // Rüstung ist gewählt (Gruppe am nominellen Max); das Anwählen des Schilds
    // darf sie NICHT verdrängen (die alte Radio-Logik hätte genau das getan).
    counts = { 'opt-fullplate': 1 };
    const occupiedCapabilities = capabilityMapOf([
      { defId: 'grp-armour', anchorKind: 'groupAnchor', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null, name: 'Rüstung', effectiveMax: 1, current: 1, isBlocked: true, isMaxRaisable: true },
      { defId: 'opt-fullplate', anchorKind: 'occupied', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null, name: 'Volle Rüstung', current: 1 },
      { defId: 'opt-shield', anchorKind: 'offerAnchor', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null, name: 'Schild' },
    ]);
    renderGroup(armourGroup, occupiedCapabilities); // bestehende Auswahl → klappt automatisch auf
    fireEvent.click(rowOf('Schild'));
    expect(subSelectionOperations.increaseCount)
      .toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-shield' }));
    expect(subSelectionOperations.decreaseCount)
      .not.toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-fullplate' }));
  });

  it('(b) Senkender Fall: sinkt das effektive Max auf 1, wird die Gruppe zum gegenseitigen Ausschluss (Radio)', () => {
    // Basis-Max 2 (Mehrfach), per Modifier auf 1 gesenkt — der Bericht trägt
    // bereits das gesenkte effektive Max. Kein Modifier HEBT über 1 → Einzelwahl.
    const weaponsGroup = {
      id: 'grp-weapons',
      name: 'Waffen',
      constraints: [groupMaxConstraint('con-weapons-max', 2)],
      modifiers: [{ type: 'decrement', field: 'con-weapons-max', valueObject: 1 }],
      items: [option('opt-sword', 'Schwert'), option('opt-axe', 'Axt')],
    };
    const capabilities = capabilityMapOf([
      { defId: 'grp-weapons', anchorKind: 'groupAnchor', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null, name: 'Waffen', effectiveMax: 1, current: 0, isSingleChoice: true },
      { defId: 'opt-sword', anchorKind: 'offerAnchor', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null, name: 'Schwert' },
      { defId: 'opt-axe', anchorKind: 'offerAnchor', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null, name: 'Axt' },
    ]);

    renderGroup(weaponsGroup, capabilities);
    expandGroup('Waffen');
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('(c) Deaktivierung: sinkt das effektive Max auf 0, ist die Gruppe nicht mehr wählbar', () => {
    const mountGroup = {
      id: 'grp-mount',
      name: 'Reittier-Panzerung',
      constraints: [groupMaxConstraint('con-mount-max', 1)],
      modifiers: [{ type: 'set', field: 'con-mount-max', valueObject: 0 }],
      items: [option('opt-barding', 'Rossharnisch')],
    };
    const capabilities = capabilityMapOf([
      { defId: 'grp-mount', anchorKind: 'groupAnchor', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null, name: 'Reittier-Panzerung', effectiveMax: 0, current: 0, isBlocked: true, isSingleChoice: true },
      { defId: 'opt-barding', anchorKind: 'offerAnchor', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null, name: 'Rossharnisch' },
    ]);

    renderGroup(mountGroup, capabilities);
    expandGroup('Reittier-Panzerung');
    const bardingRow = rowOf('Rossharnisch');
    expect(bardingRow.className).toContain('disabled');
    fireEvent.click(bardingRow);
    expect(subSelectionOperations.increaseCount)
      .not.toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-barding' }));
  });

  it('(d) Keine Regression: echte fix-max=1-Gruppe ohne hebenden Modifier bleibt gegenseitig ausschließendes Radio', () => {
    const magicWeapons = {
      id: 'grp-magic-weapons',
      name: 'Magische Waffen',
      constraints: [groupMaxConstraint('con-mw-max', 1)],
      modifiers: [],
      items: [option('opt-flail', 'Flegel'), option('opt-lance', 'Lanze')],
    };
    const emptyCapabilities = capabilityMapOf([
      { defId: 'grp-magic-weapons', anchorKind: 'groupAnchor', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null, name: 'Magische Waffen', effectiveMax: 1, current: 0, isSingleChoice: true },
      { defId: 'opt-flail', anchorKind: 'offerAnchor', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null, name: 'Flegel' },
      { defId: 'opt-lance', anchorKind: 'offerAnchor', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null, name: 'Lanze' },
    ]);

    const { unmount } = renderGroup(magicWeapons, emptyCapabilities);
    expandGroup('Magische Waffen');
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    unmount();

    // Flegel ist gewählt; das Anwählen der Lanze verdrängt ihn (Ausschluss).
    counts = { 'opt-flail': 1 };
    const occupiedCapabilities = capabilityMapOf([
      { defId: 'grp-magic-weapons', anchorKind: 'groupAnchor', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null, name: 'Magische Waffen', effectiveMax: 1, current: 1, isBlocked: true, isSingleChoice: true },
      { defId: 'opt-flail', anchorKind: 'occupied', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null, name: 'Flegel', current: 1 },
      { defId: 'opt-lance', anchorKind: 'offerAnchor', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null, name: 'Lanze' },
    ]);
    renderGroup(magicWeapons, occupiedCapabilities); // bestehende Auswahl → offen
    fireEvent.click(rowOf('Lanze'));
    expect(subSelectionOperations.increaseCount)
      .toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-lance' }));
    expect(subSelectionOperations.decreaseCount)
      .toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-flail' }));
  });

  it('(e) Keine Regression: increment+<repeat> bleibt Mengen-Stepper, die übrige Gruppe bleibt Radio', () => {
    // „Arcane Items"-Muster (§9.7): max=1, aber increment MIT <repeat> auf genau
    // ein Item hebt die Kappe je gewähltem Exemplar → dieses Item ist zählbar,
    // die restliche Gruppe bleibt exklusiv.
    const arcaneItems = {
      id: 'grp-arcane',
      name: 'Arkane Gegenstände',
      constraints: [groupMaxConstraint('con-arcane-max', 1)],
      modifiers: [{ type: 'increment', field: 'con-arcane-max', valueObject: 1, repeat: { childId: 'opt-scroll', value: 1, repeats: 1 } }],
      items: [option('opt-scroll', 'Bannrolle'), option('opt-wand', 'Grauer Stab')],
    };
    const capabilities = capabilityMapOf([
      { defId: 'grp-arcane', anchorKind: 'groupAnchor', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null, name: 'Arkane Gegenstände', effectiveMax: 1, current: 0, isSingleChoice: true },
      { defId: 'opt-scroll', anchorKind: 'offerAnchor', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null, name: 'Bannrolle', isRepeatableWithinGroup: true },
      { defId: 'opt-wand', anchorKind: 'offerAnchor', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null, name: 'Grauer Stab' },
    ]);

    renderGroup(arcaneItems, capabilities);
    expandGroup('Arkane Gegenstände');

    // Grauer Stab bleibt exklusives Radio, Bannrolle wird zum Stepper.
    expect(screen.getAllByRole('radio')).toHaveLength(1);
    const scrollRow = rowOf('Bannrolle');
    const plusButton = scrollRow.querySelector('.quantity-control button:last-child');
    expect(plusButton).not.toBeNull();

    fireEvent.click(plusButton);
    expect(subSelectionOperations.increaseCount)
      .toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-scroll' }));
  });
});
