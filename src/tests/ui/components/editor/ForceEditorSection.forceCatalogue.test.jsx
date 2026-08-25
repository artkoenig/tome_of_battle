/**
 * Issue 0156 — der Aushebe-Dialog bekommt die **Slots seines Kontingents**, und
 * sonst nichts zur Herkunft.
 *
 * `CategoryUnitAdder.forceCatalogue.test.jsx` schreibt fest, wie der Dialog aus
 * dem Bericht filtert. Diese Datei schliesst die Luecke davor: der Weg vom
 * Kontingent zum Dialog. Frueher lief er ueber die Katalog-Id des Kontingents
 * (`forceCatalogueId`); seit die Herkunfts-Entscheidung im Bericht steht
 * (`capability.isForeignCatalogue`), laeuft er ueber den **Slot-Pfad** des
 * Kontingents — bekaeme der Dialog den falschen Pfad, saehe er die Slots eines
 * fremden Kontingents und damit dessen Herkunfts-Entscheidungen.
 * `RosterCategorySection` laeuft dabei **echt**.
 *
 * Harness-Muster: `ForceEditorSection.test.jsx` und
 * `RosterCategorySection.test.jsx` (Schreibmodell `../../roster` gestubbt, damit
 * unter Test allein die Komposition steht).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ForceEditorSectionHarness as ForceEditorSection } from '../../../../tests/test-utils/harnesses/ForceEditorSectionHarness';

vi.mock('lucide-react', () => ({
  ChevronDown: () => <span data-testid="icon-chevron-down" />,
  ChevronRight: () => <span data-testid="icon-chevron-right" />,
}));

// Ein Stub-Satz fuer BEIDE Komponenten der Kette (`ForceEditorSection` und die
// echte `RosterCategorySection` importieren aus demselben Modul).
vi.mock('../../../../contexts/armylist/model', () => ({
  findForceEntryById: (system, id) => system?.forceEntries?.find(fe => fe.id === id) ?? null,
  findEntryInSystem: (_system, entryId) => ({ id: entryId }),
  childSelectionsOf: (force) => force.selections || [],
}));

/** Der Dialog als Beobachter: er meldet, welche Katalog-Id bei ihm ankommt. */
const receivedProps = [];
vi.mock('../../../../ui/components/editor/CategoryUnitAdder', () => ({
  default: (props) => {
    receivedProps.push(props);
    return <button data-testid={`adder-${props.categoryId ?? 'army-wide'}`}>Hinzufügen</button>;
  },
}));
vi.mock('../../../../ui/components/editor/AutoFillSuggestions', () => ({ default: () => <div data-testid="auto-fill" /> }));
vi.mock('../../../../ui/components/editor/RosterValidationPanel', () => ({ default: () => <div data-testid="validation-panel" /> }));
vi.mock('../../../../ui/components/editor/UnitCardList', () => ({ default: () => <div data-testid="unit-card-list" /> }));
vi.mock('../../../../ui/components/editor/ListRuleChecklist', () => ({ default: () => <div data-testid="list-rule-checklist" /> }));

const CATEGORY_ID = 'cat-special';
const PRIMARY_CATALOGUE_ID = 'cat-own';
const ALLIED_CATALOGUE_ID = 'cat-ally';

const system = {
  categoryEntries: [{ id: CATEGORY_ID, name: 'Special' }],
  catalogues: [
    { id: PRIMARY_CATALOGUE_ID, name: 'Vampire Counts', selectionEntries: [{ id: 'entry-own' }] },
    { id: ALLIED_CATALOGUE_ID, name: 'Ogre Kingdoms', selectionEntries: [{ id: 'entry-ally' }] },
  ],
  forceEntries: [{
    id: 'fe-1',
    categoryLinks: [{ id: 'cl-special', targetId: CATEGORY_ID, name: 'Special' }],
  }],
};

const roster = { catalogueId: PRIMARY_CATALOGUE_ID, costLimitType: 'cost-pts' };

// Der Bericht dieses Kontingents: ein Angebots-Slot, dessen effektive
// Primaer-Kategorie die Kategorie der Sektion ist. Daran erkennt die Sektion,
// dass die Kategorie ein bedienbarer Slot ist und erscheint (Issue 0156).
const capabilities = new Map([
  ['0/0', {
    anchorKind: 'offerAnchor',
    isIndependentSubUnit: false,
    defId: 'entry-own',
    targetDefId: null,
    name: 'Irgendwas',
    primaryCategoryId: CATEGORY_ID,
    isHidden: false,
  }],
]);

const renderForce = (force) => render(
  <ForceEditorSection
    force={force}
    forcePath="0"
    system={system}
    roster={roster}
    activeCatalogue={{ id: PRIMARY_CATALOGUE_ID }}
    violations={[]}
    unresolvedSelections={[]}
    capabilities={capabilities}
    pathBySelectionId={new Map()}
    costTypeLabel="Pkt"
    addUnit={vi.fn()}
    removeUnit={vi.fn()}
    subSelectionOperations={{}}
    unitCardContext={{}}
    isRuleGroupExpanded={() => false}
    onToggleRuleGroup={vi.fn()}
    onShowRule={vi.fn()}
    extraResources={[]}
    onPlay={vi.fn()}
  />
);

/** Die Stuetzen des Kategorie-Dialogs dieses Kontingents. */
function categoryAdderProps() {
  const props = receivedProps.filter((entry) => entry.categoryId === CATEGORY_ID);
  expect(props.length, 'Kategorie-Dialog gerendert').toBeGreaterThan(0);
  return props[props.length - 1];
}

describe('ForceEditorSection: der Aushebe-Dialog kennt das Armeebuch seines Kontingents (Issue 0121, Task 19)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    receivedProps.length = 0;
  });

  it('ein verbuendetes Kontingent gibt dem Dialog den Slot-Pfad SEINES Kontingents', () => {
    renderForce({
      id: 'force-allied',
      forceEntryId: 'fe-1',
      catalogueId: ALLIED_CATALOGUE_ID,
      selections: [],
    });

    expect(screen.getByTestId(`adder-${CATEGORY_ID}`)).toBeDefined();
    expect(categoryAdderProps().forcePath).toBe('0');
    expect(categoryAdderProps().forceId).toBe('force-allied');
  });

  it('die Sektion entscheidet die Herkunft nicht mehr selbst — keine Katalog-Stuetze am Dialog', () => {
    renderForce({
      id: 'force-primary',
      forceEntryId: 'fe-1',
      catalogueId: PRIMARY_CATALOGUE_ID,
      selections: [],
    });

    expect(categoryAdderProps().forceCatalogueId).toBeUndefined();
  });

  it('Rand: Kontingent ohne eigenen Katalog — der Dialog bekommt weiterhin seine Slots', () => {
    // Mit einer Auswahl in der Kategorie, damit die Sektion auch ohne
    // auffindbaren Kontingent-Katalog erscheint (sonst blendet sie sich aus —
    // bestehendes Verhalten, das dieser Fall nicht mitprueft).
    renderForce({
      id: 'force-without-catalogue',
      forceEntryId: 'fe-1',
      catalogueId: null,
      selections: [{ id: 'sel-1', name: 'Irgendwas', category: CATEGORY_ID }],
    });

    // Ohne Armeebuch am Kontingent bleibt der Weg derselbe: der Dialog bekommt
    // den Slot-Pfad dieses Kontingents und liest die Herkunft dort ab.
    expect(categoryAdderProps().forcePath).toBe('0');
  });
});
