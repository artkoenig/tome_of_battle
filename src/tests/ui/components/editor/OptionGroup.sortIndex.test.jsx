/**
 * Issue 0133, Kriterium 5 — in `OptionGroup.jsx` ersetzt `sortIndex` die
 * bisherige reine Kostensortierung: Optionen MIT `sortIndex` erscheinen
 * zuerst, aufsteigend sortiert. Optionen OHNE `sortIndex` werden danach
 * angehängt und bleiben untereinander in Katalogreihenfolge (der Reihenfolge
 * von `group.items`) — nicht mehr nach Punktkosten sortiert, weil deren
 * effektiver Wert modifikatorabhängig ist und sich mit jeder Auswahl ändern
 * kann; ein Sortierschlüssel, der beim Bearbeiten wandert, ließ Zeilen ohne
 * eigenes Zutun des Nutzers springen.
 *
 * Aufbau: dieselbe echte Zwei-Stufen-Fassade (`prepareDataset` + `evaluate`)
 * und dasselbe Komponenten-Testmuster (manuell konstruierte `group`-Struktur,
 * `capabilities` aus dem echten Bericht) wie `OptionGroup.evaluator.test.jsx`.
 * Reihenfolge wird über die DOM-Position der gerenderten Options-Zeilen
 * innerhalb der Gruppe geprüft.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OptionGroupHarness as OptionGroupComponent } from '../../../../tests/test-utils/editorHarness';
import { createSubSelectionOperationsMock } from '../../../../tests/test-utils/subSelectionOperationsMock';
import { prepareDataset, evaluate } from '../../../../domain/evaluator/evaluator.js';
import { toEvaluatorRoster } from '../../../../domain/evaluation/rosterAdapter.js';

vi.mock('lucide-react', () => ({
  ChevronDown: () => <span data-testid="icon-chevron-down" />,
  ChevronRight: () => <span data-testid="icon-chevron-right" />,
  Plus: () => <span data-testid="icon-plus" />,
  Minus: () => <span data-testid="icon-minus" />,
  Info: () => <span data-testid="icon-info" />,
  BookOpen: () => <span data-testid="icon-book" />,
}));

vi.mock('../../../../domain/rules/rulesLookup', () => ({ getRuleUrl: () => null }));
vi.mock('../../../../ui/viewmodels/SettingsContext', () => ({
  useSettings: () => ({ whfb6LinkingEnabled: false }),
}));

const GAME_SYSTEM_ID = 'gs-main';
const FORCE_DEF_ID = 'force-main';
const HERO_ID = 'entry-hero';
const COST_TYPE_ID = 'cost-pts';
const GROUP_ID = 'grp-weapons';
const HERO_PATH = '0/0';

// Ohne sortIndex, in Katalogreihenfolge deklariert: Sword vor Axe — und mit
// Kosten 4/9, damit eine (fehlerhaft) verbliebene Kostensortierung Axe VOR
// Sword stellen würde. Bleibt es bei Sword vor Axe, sortiert die Komponente
// nach Katalogreihenfolge, nicht nach Kosten.
const SWORD_ID = 'opt-sword';
const AXE_ID = 'opt-axe';
// Mit sortIndex, Kosten 10/1 — sortIndex ersetzt die Kostensortierung: Dagger (1) vor Mace (2).
const MACE_ID = 'opt-mace';
const DAGGER_ID = 'opt-dagger';

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
  <gameSystem id="${GAME_SYSTEM_ID}" name="Test System">
    <costTypes><costType id="${COST_TYPE_ID}" name="pts" defaultCostLimit="-1"/></costTypes>
  </gameSystem>`;

const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-main" name="Main Catalogue" gameSystemId="${GAME_SYSTEM_ID}">
    <forceEntries><forceEntry id="${FORCE_DEF_ID}" name="Main Force"/></forceEntries>
    <selectionEntries>
      <selectionEntry id="${HERO_ID}" name="Hero" type="unit">
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="50"/></costs>
        <selectionEntryGroups>
          <selectionEntryGroup id="${GROUP_ID}" name="Weapons">
            <selectionEntries>
              <selectionEntry id="${SWORD_ID}" name="Sword" type="upgrade">
                <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="4"/></costs>
              </selectionEntry>
              <selectionEntry id="${AXE_ID}" name="Axe" type="upgrade">
                <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="9"/></costs>
              </selectionEntry>
              <selectionEntry id="${MACE_ID}" name="Mace" type="upgrade" sortIndex="2">
                <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="10"/></costs>
              </selectionEntry>
              <selectionEntry id="${DAGGER_ID}" name="Dagger" type="upgrade" sortIndex="1">
                <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="1"/></costs>
              </selectionEntry>
            </selectionEntries>
          </selectionEntryGroup>
        </selectionEntryGroups>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

function appSystem() {
  return {
    id: 'system-uuid',
    name: 'Test System',
    rawXmls: {
      gst: [{ name: 'test.gst', content: GAME_SYSTEM_XML }],
      cat: [{ name: 'main.cat', content: CATALOGUE_XML }],
    },
  };
}

function appRoster() {
  return {
    id: 'roster-uuid',
    name: 'Test Roster',
    systemId: 'system-uuid',
    catalogueId: 'cat-main',
    costLimit: 1000,
    costLimitType: COST_TYPE_ID,
    forces: [
      {
        id: 'force-uuid-1',
        forceEntryId: FORCE_DEF_ID,
        catalogueId: 'cat-main',
        selections: [
          { id: 'sel-hero', name: 'Hero', entryLinkId: null, selectionEntryId: HERO_ID, number: 1, category: null, selections: [] },
        ],
      },
    ],
  };
}

/** Auswertung über die ECHTE Fassade — die einzige Quelle der Erwartungen. */
function evaluation(roster) {
  const prepared = prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [CATALOGUE_XML] });
  const { evalRoster, pathBySelectionId } = toEvaluatorRoster(roster);
  const report = evaluate(prepared, evalRoster);
  return { capabilities: report.capabilities, pathBySelectionId };
}

// Zählung über das App-Roster (bestehender Prop-Vertrag von OptionGroup).
const getSubSelectionCount = () => 0;

// Gruppen-STRUKTUR (Mitgliedschaft) — Grenzen bewusst nicht hier, sondern im Bericht
// (Muster aus `OptionGroup.evaluator.test.jsx`).
const WEAPONS_GROUP = {
  id: GROUP_ID,
  name: 'Weapons',
  constraints: [],
  items: [
    { option: { id: SWORD_ID } },
    { option: { id: AXE_ID } },
    { option: { id: MACE_ID } },
    { option: { id: DAGGER_ID } },
  ],
};

function renderGroup() {
  const roster = appRoster();
  const { capabilities } = evaluation(roster);
  const selection = roster.forces[0].selections[0];
  const utils = render(
    <OptionGroupComponent
      group={WEAPONS_GROUP}
      selection={selection}
      selectionPath={HERO_PATH}
      capabilities={capabilities}
      system={appSystem()}
      roster={roster}
      getSubSelectionCount={getSubSelectionCount}
      subSelectionOperations={createSubSelectionOperationsMock()}
      getOptionDescription={() => ''}
      activeCatalogue={{ id: 'cat-main' }}
      setActiveInfo={vi.fn()}
      onHoverEnter={vi.fn()}
      onHoverMove={vi.fn()}
      onHoverLeave={vi.fn()}
      onShowRule={vi.fn()}
    />
  );
  return { ...utils, capabilities };
}

/** Die Namen der gerenderten Options-Zeilen in DOM-Reihenfolge. */
function rowOrder(container) {
  return Array.from(container.querySelectorAll('.option-group-items .sub-selection-row .sub-selection-option-name'))
    .map(el => el.textContent.trim());
}

describe('OptionGroup: sortIndex ersetzt die Kostensortierung für getaggte Optionen, Katalogreihenfolge für den Rest (Issue 0133, Kriterium 5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Vorbedingung gegen den echten Bericht: Mace/Dagger tragen sortIndex, Sword/Axe nicht — und Sword ist billiger als Axe', () => {
    const { capabilities } = renderGroup();
    const capOf = (defId) => {
      for (const [path, cap] of capabilities) {
        if (path.startsWith(`${HERO_PATH}/`) && cap.defId === defId) return cap;
      }
      return undefined;
    };
    expect(capOf(MACE_ID)?.sortIndex).toBe(2);
    expect(capOf(DAGGER_ID)?.sortIndex).toBe(1);
    expect(capOf(SWORD_ID)?.sortIndex).toBeNull();
    expect(capOf(AXE_ID)?.sortIndex).toBeNull();
    // Die Kosten liegen bewusst GEGEN die Katalogreihenfolge: eine
    // (fehlerhaft) verbliebene Kostensortierung würde Axe vor Sword stellen.
    expect(capOf(SWORD_ID)?.costs?.[COST_TYPE_ID]).toBe(4);
    expect(capOf(AXE_ID)?.costs?.[COST_TYPE_ID]).toBe(9);
  });

  it('getaggte Optionen (Dagger sortIndex 1, Mace sortIndex 2) erscheinen zuerst, aufsteigend sortiert', () => {
    const { container } = renderGroup();
    fireEvent.click(screen.getByText('Weapons'));

    const order = rowOrder(container);

    expect(order.slice(0, 2)).toEqual(['Dagger', 'Mace']);
  });

  it('ungetaggte Optionen (Sword, Axe) werden HINTER den getaggten angehängt, in Katalogreihenfolge (Sword vor Axe) statt nach Kosten (Axe kostet mehr als Sword)', () => {
    const { container } = renderGroup();
    fireEvent.click(screen.getByText('Weapons'));

    const order = rowOrder(container);

    expect(order.slice(2)).toEqual(['Sword', 'Axe']);
  });

  it('die vollständige Reihenfolge: Dagger, Mace, Sword, Axe (nicht die Kosten-Reihenfolge Axe, Sword, Mace, Dagger)', () => {
    const { container } = renderGroup();
    fireEvent.click(screen.getByText('Weapons'));

    expect(rowOrder(container)).toEqual(['Dagger', 'Mace', 'Sword', 'Axe']);
  });
});
