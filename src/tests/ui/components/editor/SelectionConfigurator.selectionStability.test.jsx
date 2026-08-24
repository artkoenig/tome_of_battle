/**
 * Regression: Auswaehlen einer Option darf weder ihre eigene Gruppen-Sektion
 * noch eine Nachbar-Sektion verschieben (gemeldeter Fehler nach Issue 0133,
 * Kriterium 5 — siehe `OptionGroup.sortIndex.test.jsx`: dort war der
 * Kosten-Fallback INNERHALB einer Gruppe das Problem; hier geht es um die
 * Position der Abschnitte SELBST in `SelectionConfigurator.buildSections`).
 *
 * Wurzel des Fehlers: `buildSections` ordnete Abschnitte bislang nach der
 * Baumreihenfolge des Berichts (`childSlotsOf`) statt nach der Katalogstruktur.
 * Diese Baumreihenfolge haengt aber bereits ausgewaehlte Instanzen (Baumphase 1,
 * Roster-Einfuegereihenfolge) VOR alle Gruppen- und Angebots-Anker (Baumphase 2,
 * Katalogreihenfolge) — zwei verschiedene Ordnungsraeume hintereinander. Eine
 * noch leere Gruppe stand an ihrer Katalogposition; sobald man eine ihrer
 * Optionen waehlte, sprang die ganze Gruppen-Sektion an die Position der
 * gerade ausgewaehlten Instanz — vor jede noch leere Nachbar-Gruppe, ganz
 * gleich, wo sie im Katalog steht.
 *
 * Aufbau: dieselbe echte Zwei-Stufen-Fassade (`prepareDataset` + `evaluate`)
 * und dasselbe ueber `processImportedData` aufgeloeste App-System/-Roster-
 * Muster wie `SelectionConfigurator.containerGroups.nesting.test.jsx` — ein
 * bloss `rawXmls` tragendes System liefert `getUnitOptions` nichts, und genau
 * dessen (jetzt massgebliche) Katalogstruktur soll dieser Test pruefen. Zwei
 * Roster derselben Katalog-Fixture — einmal ohne, einmal mit einer bereits
 * getroffenen Auswahl in "Weapons" — und ein Vergleich der Abschnitts-/
 * Zeilenreihenfolge zwischen beiden Renderns (kein Klick, keine
 * Zustandsaenderung zur Laufzeit noetig).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { SelectionConfiguratorHarness as SelectionConfigurator } from '../../../../shared/test-utils/editorHarness';
import { createSubSelectionOperationsMock } from '../../../../shared/test-utils/subSelectionOperationsMock';
import { processImportedData } from '../../../../data/parser/xmlParser.js';
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

vi.mock('../../../../data/rules/rulesLookup', () => ({ getRuleUrl: () => null }));
vi.mock('../../../../ui/viewmodels/SettingsContext', () => ({
  useSettings: () => ({ whfb6LinkingEnabled: false }),
}));

const GAME_SYSTEM_ID = 'gs-main';
const FORCE_DEF_ID = 'force-main';
const HERO_ID = 'entry-hero';
const COST_TYPE_ID = 'cost-pts';

// "Armour" steht im Katalog VOR "Weapons" — ohne jede Auswahl muessen die
// Abschnitte deshalb in genau dieser Reihenfolge erscheinen.
const ARMOUR_GROUP_ID = 'grp-armour';
const HELMET_ID = 'opt-helmet';
const SHIELD_ID = 'opt-shield';
const WEAPONS_GROUP_ID = 'grp-weapons';
const SWORD_ID = 'opt-sword';
const AXE_ID = 'opt-axe';

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
          <selectionEntryGroup id="${ARMOUR_GROUP_ID}" name="Armour">
            <constraints>
              <constraint type="max" value="1" field="selections" scope="parent" shared="true" id="limit-armour-max" includeChildSelections="false"/>
            </constraints>
            <selectionEntries>
              <selectionEntry id="${HELMET_ID}" name="Helmet" type="upgrade">
                <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="3"/></costs>
              </selectionEntry>
              <selectionEntry id="${SHIELD_ID}" name="Shield" type="upgrade">
                <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="6"/></costs>
              </selectionEntry>
            </selectionEntries>
          </selectionEntryGroup>
          <selectionEntryGroup id="${WEAPONS_GROUP_ID}" name="Weapons">
            <constraints>
              <constraint type="max" value="1" field="selections" scope="parent" shared="true" id="limit-weapons-max" includeChildSelections="false"/>
            </constraints>
            <selectionEntries>
              <selectionEntry id="${SWORD_ID}" name="Sword" type="upgrade">
                <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="5"/></costs>
              </selectionEntry>
              <selectionEntry id="${AXE_ID}" name="Axe" type="upgrade">
                <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="20"/></costs>
              </selectionEntry>
            </selectionEntries>
          </selectionEntryGroup>
        </selectionEntryGroups>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

// `processImportedData` statt eines bloss rawXmls-tragenden Objekts: die
// Katalogstruktur (`getUnitOptions`) braucht die tatsaechlich aufgeloesten
// Definitionen, um Mitgliedschaft und Reihenfolge zu liefern — genau das
// Verhalten, das dieser Test gegen die Baumreihenfolge des Berichts absichert
// (Muster aus `SelectionConfigurator.containerGroups.nesting.test.jsx`).
const appSystem = () => processImportedData(
  [{ name: 'test.gst', content: GAME_SYSTEM_XML }],
  [{ name: 'main.cat', content: CATALOGUE_XML }],
).system;

/** `withAxeSelected`: haengt "Axe" (in Weapons) als bereits getroffene Auswahl unter den Hero. */
function appRoster({ withAxeSelected = false } = {}) {
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
          {
            id: 'sel-hero', name: 'Hero', entryLinkId: null, selectionEntryId: HERO_ID,
            number: 1, category: null,
            selections: withAxeSelected
              ? [{ id: 'sel-axe', name: 'Axe', entryLinkId: null, selectionEntryId: AXE_ID, number: 1, category: null, selections: [] }]
              : [],
          },
        ],
      },
    ],
  };
}

function renderConfigurator(roster) {
  const system = appSystem();
  const prepared = prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [CATALOGUE_XML] });
  const { evalRoster, pathBySelectionId } = toEvaluatorRoster(roster);
  const { capabilities } = evaluate(prepared, evalRoster);
  const selection = roster.forces[0].selections[0];
  return render(
    <SelectionConfigurator
      selection={selection}
      capabilities={capabilities}
      pathBySelectionId={pathBySelectionId}
      system={system}
      roster={roster}
      subSelectionOperations={createSubSelectionOperationsMock()}
      activeCatalogue={system.catalogues[0]}
      handleMouseEnter={vi.fn()}
      handleMouseMove={vi.fn()}
      handleMouseLeave={vi.fn()}
      setActiveInfo={vi.fn()}
      onShowRule={vi.fn()}
    />
  );
}

/** Reihenfolge der obersten Abschnitte, an ihrem Titeltext abgelesen (DOM-Position, kein Rechnen). */
function sectionOrder(container) {
  const flush = container.querySelector('.sub-selection-group--flush');
  return Array.from(flush.children)
    .map(el => el.textContent.trim())
    .map(text => ['Armour', 'Weapons'].find(name => text.startsWith(name)))
    .filter(Boolean);
}

describe('SelectionConfigurator.buildSections: eine Auswahl verschiebt keine Abschnitts-Position', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ohne Auswahl stehen die Abschnitte in Katalogreihenfolge: Armour vor Weapons', () => {
    const { container } = renderConfigurator(appRoster({ withAxeSelected: false }));

    expect(sectionOrder(container)).toEqual(['Armour', 'Weapons']);
  });

  it('mit einer getroffenen Auswahl in Weapons bleibt die Reihenfolge unveraendert: Armour weiterhin vor Weapons', () => {
    const { container } = renderConfigurator(appRoster({ withAxeSelected: true }));

    // Vor der Katalogreihenfolge-Sortierung sprang "Weapons" hier an die
    // erste Stelle, sobald "Axe" gewaehlt war — die gewaehlte Instanz haengt
    // im Baum vor jedem noch unbelegten Gruppen-Anker.
    expect(sectionOrder(container)).toEqual(['Armour', 'Weapons']);
  });

  it('innerhalb von Weapons bleibt Sword vor Axe (Katalogreihenfolge), obwohl Axe gewaehlt ist und mehr kostet', () => {
    const { container } = renderConfigurator(appRoster({ withAxeSelected: true }));

    const weaponsSection = Array.from(container.querySelectorAll('.option-group'))
      .find(section => {
        const header = section.querySelector('.option-group-header');
        return header && header.closest('.option-group') === section && header.textContent.startsWith('Weapons');
      });
    expect(weaponsSection).toBeTruthy();
    // Eine Gruppe mit bereits getroffener Auswahl ist von Haus aus aufgeklappt.

    const rowNames = Array.from(weaponsSection.querySelectorAll('.sub-selection-row .sub-selection-option-name'))
      .map(el => el.textContent.trim());
    expect(rowNames).toEqual(['Sword', 'Axe']);
  });
});
