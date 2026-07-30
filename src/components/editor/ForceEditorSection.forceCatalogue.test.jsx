/**
 * Issue 0121, Task 19 (Kriterium 5) — das Armeebuch **des Kontingents** kommt
 * auch wirklich bis zum Aushebe-Dialog.
 *
 * `CategoryUnitAdder.forceCatalogue.test.jsx` schreibt fest, wie der Dialog
 * filtert, **wenn** er die Katalog-Id seines Kontingents bekommt. Diese Datei
 * schliesst die Luecke davor: der Weg vom Kontingent zum Dialog. Ohne sie waere
 * ein Filter denkbar, der richtig rechnet und nie die richtige Eingabe sieht —
 * genau die Sorte Fehler, die F1 hervorgebracht hat (Korrektur am falschen
 * Rand).
 *
 * Beobachtet wird die Stuetze `forceCatalogueId` (Vertrag aus Task 19) an dem
 * Dialog, den die Kategorie-Sektion dieses Kontingents rendert.
 * `RosterCategorySection` laeuft dabei **echt** — welchen Weg die Id nimmt
 * (durchgereicht oder in der Sektion abgeleitet), legt der Test nicht fest.
 *
 * Harness-Muster: `ForceEditorSection.test.jsx` und
 * `RosterCategorySection.test.jsx` (Schreibmodell `../../roster` gestubbt, damit
 * unter Test allein die Komposition steht).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ForceEditorSection from './ForceEditorSection';

vi.mock('lucide-react', () => ({
  ChevronDown: () => <span data-testid="icon-chevron-down" />,
  ChevronRight: () => <span data-testid="icon-chevron-right" />,
}));

const mockCollectUnreachableArmyWideSelectors = vi.fn(() => []);

// Ein Stub-Satz fuer BEIDE Komponenten der Kette (`ForceEditorSection` und die
// echte `RosterCategorySection` importieren aus demselben Modul).
vi.mock('../../roster', () => ({
  computeRosterCounts: () => ({ selectionCounts: {}, categoryCounts: {} }),
  findForceEntryById: (system, id) => system?.forceEntries?.find(fe => fe.id === id) ?? null,
  collectUnreachableArmyWideSelectors: (...args) => mockCollectUnreachableArmyWideSelectors(...args),
  childSelectionsOf: (force) => force.selections || [],
  isCategoryLinkHidden: () => false,
  isEntryPrimaryInCategory: () => true,
  resolveListRuleGroup: () => ({ isListRuleGroup: false, states: [] }),
}));

/** Der Dialog als Beobachter: er meldet, welche Katalog-Id bei ihm ankommt. */
const receivedProps = [];
vi.mock('./CategoryUnitAdder', () => ({
  default: (props) => {
    receivedProps.push(props);
    return <button data-testid={`adder-${props.categoryId ?? 'army-wide'}`}>Hinzufügen</button>;
  },
}));
vi.mock('./AutoFillSuggestions', () => ({ default: () => <div data-testid="auto-fill" /> }));
vi.mock('./RosterValidationPanel', () => ({ default: () => <div data-testid="validation-panel" /> }));
vi.mock('./UnitCardList', () => ({ default: () => <div data-testid="unit-card-list" /> }));
vi.mock('./ListRuleChecklist', () => ({ default: () => <div data-testid="list-rule-checklist" /> }));

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

const renderForce = (force) => render(
  <ForceEditorSection
    force={force}
    forcePath="0"
    system={system}
    roster={roster}
    activeCatalogue={{ id: PRIMARY_CATALOGUE_ID }}
    violations={[]}
    unresolvedSelections={[]}
    capabilities={new Map()}
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
    mockCollectUnreachableArmyWideSelectors.mockReturnValue([]);
  });

  it('ein verbuendetes Kontingent gibt dem Dialog SEINEN Katalog, nicht den der Liste', () => {
    renderForce({
      id: 'force-allied',
      forceEntryId: 'fe-1',
      catalogueId: ALLIED_CATALOGUE_ID,
      selections: [],
    });

    expect(screen.getByTestId(`adder-${CATEGORY_ID}`)).toBeDefined();
    expect(categoryAdderProps().forceCatalogueId).toBe(ALLIED_CATALOGUE_ID);
  });

  it('das Primaer-Kontingent gibt dem Dialog den Katalog der Liste', () => {
    renderForce({
      id: 'force-primary',
      forceEntryId: 'fe-1',
      catalogueId: PRIMARY_CATALOGUE_ID,
      selections: [],
    });

    expect(categoryAdderProps().forceCatalogueId).toBe(PRIMARY_CATALOGUE_ID);
  });

  it('Rand: Kontingent ohne eigenen Katalog — der Dialog bekommt keinen FREMDEN Katalog', () => {
    // Mit einer Auswahl in der Kategorie, damit die Sektion auch ohne
    // auffindbaren Kontingent-Katalog erscheint (sonst blendet sie sich aus —
    // bestehendes Verhalten, das dieser Fall nicht mitprueft).
    renderForce({
      id: 'force-without-catalogue',
      forceEntryId: 'fe-1',
      catalogueId: null,
      selections: [{ id: 'sel-1', name: 'Irgendwas', category: CATEGORY_ID }],
    });

    // Erlaubt sind nur „nichts" (der Dialog faellt selbst auf den aktiven
    // Katalog zurueck) oder der Katalog der Liste — nie der eines anderen Buchs.
    const received = categoryAdderProps().forceCatalogueId ?? null;
    expect([null, PRIMARY_CATALOGUE_ID]).toContain(received);
  });
});
