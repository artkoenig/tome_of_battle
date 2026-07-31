import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SelectionConfigurator from './SelectionConfigurator';
import { createSubSelectionOperationsMock } from '../../test-utils/subSelectionOperationsMock';
import { processImportedData } from '../../parser/xmlParser.js';
import { prepareDataset, evaluate } from '../../evaluator/evaluator.js';
import { toEvaluatorRoster } from '../../evaluation/rosterAdapter.js';

/**
 * Issue 0131 — die beiden Kriterien, fuer die die whfb6-Fixture-Kataloge KEINEN
 * Fall hergeben, an einem synthetischen Katalog:
 *
 * - Kriterium 6: Container im Container. Ueber „Ogre Kingdoms", „Orcs and
 *   Goblins" und „Vampire Counts" hinweg enthaelt kein Container-Gruppe eine
 *   weitere Container-Gruppe (43 Container, 0 verschachtelte) — der Fall ist
 *   nur synthetisch erreichbar.
 * - Kriterium 4, zweiter Satz: „ein Container, dessen Mitglieder saemtlich
 *   wegfallen, laesst nichts auf der Karte zurueck". Statisch existiert auch
 *   dieser Fall in den Fixtures nicht.
 *
 * Der Katalog laeuft durch dieselbe Produktionsnaht wie die echten
 * (`processImportedData` → `toEvaluatorRoster` → `prepareDataset`/`evaluate` →
 * `SelectionConfigurator`); nur die zwei peripheren Nahtstellen sind gestubbt.
 *
 * Bauplan des Katalogs:
 *   Hero
 *   ├─ „Outer Container" (Punktebudget 60)            ← Container
 *   │   └─ „Inner Container" (Punktebudget 30)        ← Container IM Container
 *   │       └─ „Leaf Choice" (max 1)                  ← haelt die Optionen
 *   │           ├─ Gem (10)
 *   │           └─ Orb (12)
 *   ├─ „Vanishing Container" (Punktebudget 20)        ← Container
 *   │   └─ „Ghost" (hidden) mit Phantom (hidden)      ← faellt vollstaendig weg
 *   ├─ „Barren" (Punktebudget 20, ohne jedes Kind)    ← Gruppe ganz ohne Inhalt
 *   └─ „Plain" (max 1) mit Rod (6)                    ← gewoehnliche Optionsgruppe
 */

vi.mock('lucide-react', () => ({
  ChevronDown: () => <span data-testid="icon-chevron-down" />,
  ChevronRight: () => <span data-testid="icon-chevron-right" />,
  Plus: () => <span data-testid="icon-plus" />,
  Minus: () => <span data-testid="icon-minus" />,
  Info: ({ onClick, ...rest }) => <span data-testid="icon-info" onClick={onClick} {...rest} />,
  BookOpen: ({ onClick, ...rest }) => <span data-testid="icon-book" onClick={onClick} {...rest} />,
}));

vi.mock('../../data/rulesLookup', () => ({ getRuleUrl: () => null }));
vi.mock('../../contexts/SettingsContext', () => ({
  useSettings: () => ({ whfb6LinkingEnabled: false }),
}));

const COST_TYPE_ID = 'cost-pts';
const OUTER_GROUP_ID = 'grp-outer';
const INNER_LINK_ID = 'link-inner';
const LEAF_LINK_ID = 'link-leaf';
const VANISH_GROUP_ID = 'grp-vanish';
const BARREN_GROUP_ID = 'grp-barren';
const PLAIN_GROUP_ID = 'grp-plain';
const HERO_PATH = '0/0';

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
<gameSystem id="gs-main" name="Test System">
  <costTypes><costType id="${COST_TYPE_ID}" name="pts" defaultCostLimit="-1"/></costTypes>
</gameSystem>`;

const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
<catalogue id="cat-main" name="Main Catalogue" gameSystemId="gs-main">
  <forceEntries><forceEntry id="force-main" name="Main Force"/></forceEntries>
  <sharedSelectionEntryGroups>
    <selectionEntryGroup id="grp-inner" name="Inner Container" hidden="false" collective="false" import="true">
      <constraints>
        <constraint field="${COST_TYPE_ID}" scope="parent" value="30" type="max" id="lim-inner" percentValue="false" shared="true" includeChildSelections="false" includeChildForces="false"/>
      </constraints>
      <entryLinks>
        <entryLink id="${LEAF_LINK_ID}" name="Leaf Choice" hidden="false" collective="false" import="true" targetId="grp-leaf" type="selectionEntryGroup"/>
      </entryLinks>
    </selectionEntryGroup>
    <selectionEntryGroup id="grp-leaf" name="Leaf Choice" hidden="false" collective="false" import="true">
      <constraints>
        <constraint field="selections" scope="parent" value="1" type="max" id="lim-leaf" percentValue="false" shared="true" includeChildSelections="false" includeChildForces="false"/>
      </constraints>
      <selectionEntries>
        <selectionEntry id="opt-gem" name="Gem" type="upgrade"><costs><cost name="pts" typeId="${COST_TYPE_ID}" value="10"/></costs></selectionEntry>
        <selectionEntry id="opt-orb" name="Orb" type="upgrade"><costs><cost name="pts" typeId="${COST_TYPE_ID}" value="12"/></costs></selectionEntry>
      </selectionEntries>
    </selectionEntryGroup>
    <selectionEntryGroup id="grp-ghost" name="Ghost" hidden="true" collective="false" import="true">
      <selectionEntries>
        <selectionEntry id="opt-phantom" name="Phantom" type="upgrade" hidden="true"><costs><cost name="pts" typeId="${COST_TYPE_ID}" value="4"/></costs></selectionEntry>
      </selectionEntries>
    </selectionEntryGroup>
  </sharedSelectionEntryGroups>
  <selectionEntries>
    <selectionEntry id="entry-hero" name="Hero" type="unit">
      <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="50"/></costs>
      <selectionEntryGroups>
        <selectionEntryGroup id="${OUTER_GROUP_ID}" name="Outer Container" hidden="false" collective="false" import="true">
          <constraints>
            <constraint field="${COST_TYPE_ID}" scope="parent" value="60" type="max" id="lim-outer" percentValue="false" shared="true" includeChildSelections="false" includeChildForces="false"/>
          </constraints>
          <entryLinks>
            <entryLink id="${INNER_LINK_ID}" name="Inner Container" hidden="false" collective="false" import="true" targetId="grp-inner" type="selectionEntryGroup"/>
          </entryLinks>
        </selectionEntryGroup>
        <selectionEntryGroup id="${VANISH_GROUP_ID}" name="Vanishing Container" hidden="false" collective="false" import="true">
          <constraints>
            <constraint field="${COST_TYPE_ID}" scope="parent" value="20" type="max" id="lim-vanish" percentValue="false" shared="true" includeChildSelections="false" includeChildForces="false"/>
          </constraints>
          <entryLinks>
            <entryLink id="link-ghost" name="Ghost" hidden="false" collective="false" import="true" targetId="grp-ghost" type="selectionEntryGroup"/>
          </entryLinks>
        </selectionEntryGroup>
        <selectionEntryGroup id="${BARREN_GROUP_ID}" name="Barren" hidden="false" collective="false" import="true">
          <constraints>
            <constraint field="${COST_TYPE_ID}" scope="parent" value="20" type="max" id="lim-barren" percentValue="false" shared="true" includeChildSelections="false" includeChildForces="false"/>
          </constraints>
        </selectionEntryGroup>
        <selectionEntryGroup id="${PLAIN_GROUP_ID}" name="Plain" hidden="false" collective="false" import="true">
          <constraints>
            <constraint field="selections" scope="parent" value="1" type="max" id="lim-plain" percentValue="false" shared="true" includeChildSelections="false" includeChildForces="false"/>
          </constraints>
          <selectionEntries>
            <selectionEntry id="opt-rod" name="Rod" type="upgrade"><costs><cost name="pts" typeId="${COST_TYPE_ID}" value="6"/></costs></selectionEntry>
          </selectionEntries>
        </selectionEntryGroup>
      </selectionEntryGroups>
    </selectionEntry>
  </selectionEntries>
</catalogue>`;

const appSystem = () => processImportedData(
  [{ name: 'test.gst', content: GAME_SYSTEM_XML }],
  [{ name: 'main.cat', content: CATALOGUE_XML }],
).system;

const appRoster = () => ({
  id: 'roster-uuid',
  name: 'Test Roster',
  systemId: 'system-uuid',
  catalogueId: 'cat-main',
  costLimit: 1000,
  costLimitType: COST_TYPE_ID,
  forces: [{
    id: 'force-uuid-1',
    forceEntryId: 'force-main',
    catalogueId: 'cat-main',
    selections: [{
      id: 'sel-hero', name: 'Hero', entryLinkId: null, selectionEntryId: 'entry-hero',
      number: 1, category: null, selections: [],
    }],
  }],
});

function renderCard() {
  const system = appSystem();
  const roster = appRoster();
  const prepared = prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [CATALOGUE_XML] });
  const { evalRoster, pathBySelectionId } = toEvaluatorRoster(roster);
  const { capabilities } = evaluate(prepared, evalRoster);
  const view = render(
    <SelectionConfigurator
      selection={roster.forces[0].selections[0]}
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
  return { ...view, capabilities, pathBySelectionId };
}

// ── DOM-Hilfen: rein beobachtend (identisch zur Integrationsdatei) ───────────

const ownHeader = (section) => {
  const header = section.querySelector('.option-group-header');
  return header && header.closest('.option-group') === section ? header : null;
};

function labelOf(section) {
  const header = ownHeader(section);
  if (!header) return '';
  const title = header.querySelector('.text-ui-title') || header;
  const limit = title.querySelector('.option-group-limit');
  const full = title.textContent || '';
  return (limit ? full.replace(limit.textContent, '') : full).trim();
}

function limitTextOf(section) {
  const header = ownHeader(section);
  const limit = header && header.querySelector('.option-group-limit');
  return limit ? limit.textContent.trim() : '';
}

const sectionsOf = (root) => [...root.querySelectorAll('.option-group')];
const sectionByLabel = (root, label) => sectionsOf(root).find(s => labelOf(s) === label);
const enclosingSection = (section) => section.parentElement?.closest('.option-group') ?? null;
const topLevelSections = (root) => sectionsOf(root).filter(s => enclosingSection(s) === null);
const ownRows = (section) =>
  [...section.querySelectorAll('.sub-selection-row')].filter(r => r.closest('.option-group') === section);

function expandAll(root, rounds = 8) {
  for (let i = 0; i < rounds; i += 1) {
    const collapsed = sectionsOf(root).filter(s => {
      const header = ownHeader(s);
      return header && header.querySelector('[data-testid="icon-chevron-right"]');
    });
    if (collapsed.length === 0) return;
    collapsed.forEach(s => fireEvent.click(ownHeader(s)));
  }
}

function capabilityUnder(capabilities, parentPath, defId) {
  for (const [slotPath, capability] of capabilities) {
    if (slotPath.startsWith(`${parentPath}/`) && capability.defId === defId) return capability;
  }
  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────

describe('Kriterium 6 — ein Container im Container behaelt die Tiefe des Katalogs', () => {
  test('„Leaf Choice" liegt in „Inner Container", und der wiederum in „Outer Container"', () => {
    const { container, capabilities, pathBySelectionId } = renderCard();

    // Vorbedingung am echten Bericht: alle drei Gruppen haben einen Anker.
    expect(pathBySelectionId.get('sel-hero')).toBe(HERO_PATH);
    expect(capabilityUnder(capabilities, HERO_PATH, OUTER_GROUP_ID))
      .toMatchObject({ anchorKind: 'groupAnchor', effectiveMax: 60 });
    expect(capabilityUnder(capabilities, HERO_PATH, INNER_LINK_ID))
      .toMatchObject({ anchorKind: 'groupAnchor', effectiveMax: 30 });
    expect(capabilityUnder(capabilities, HERO_PATH, LEAF_LINK_ID))
      .toMatchObject({ anchorKind: 'groupAnchor', effectiveMax: 1 });

    expandAll(container);

    const outer = sectionByLabel(container, 'Outer Container');
    const inner = sectionByLabel(container, 'Inner Container');
    const leaf = sectionByLabel(container, 'Leaf Choice');
    expect(outer, 'Abschnitt "Outer Container"').toBeTruthy();
    expect(inner, 'Abschnitt "Inner Container"').toBeTruthy();
    expect(leaf, 'Abschnitt "Leaf Choice"').toBeTruthy();

    expect(enclosingSection(inner), '"Inner Container" haengt am "Outer Container"').toBe(outer);
    expect(enclosingSection(leaf), '"Leaf Choice" haengt am "Inner Container"').toBe(inner);
  });

  test('nicht auf eine Ebene eingeebnet: nur der aeussere Container steht auf oberster Ebene', () => {
    const { container } = renderCard();
    expandAll(container);

    const topLevelLabels = topLevelSections(container).map(labelOf);
    expect(topLevelLabels).toContain('Outer Container');
    expect(topLevelLabels, '"Inner Container" ist kein Geschwister').not.toContain('Inner Container');
    expect(topLevelLabels, '"Leaf Choice" ist kein Geschwister').not.toContain('Leaf Choice');
  });

  test('die Optionen der innersten Gruppe sind deren direkte Zeilen — samt eigener Grenze', () => {
    const { container } = renderCard();
    expandAll(container);

    const leaf = sectionByLabel(container, 'Leaf Choice');
    expect(leaf).toBeTruthy();
    expect(limitTextOf(leaf)).toMatch(/Max:\s*1/);
    expect(limitTextOf(sectionByLabel(container, 'Inner Container'))).toMatch(/0\s*\/\s*30/);

    const rowTexts = ownRows(leaf).map(r => r.textContent);
    expect(rowTexts.some(t => t.includes('Gem')), 'Gem ist eine direkte Zeile von "Leaf Choice"').toBe(true);
    expect(rowTexts.some(t => t.includes('Orb')), 'Orb ist eine direkte Zeile von "Leaf Choice"').toBe(true);
    expect(screen.getByText('Gem').closest('.option-group')).toBe(leaf);
  });
});

describe('Kriterium 4 — nichts Leeres bleibt auf der Karte zurueck', () => {
  test('ein Container, dessen einziges Mitglied wegfaellt, rendert gar keinen Abschnitt', () => {
    const { container, capabilities } = renderCard();

    // Vorbedingung: der Container selbst ist im Bericht angeboten (sichtbarer
    // Gruppen-Anker mit Budget 20) — sein Mitglied „Ghost" dagegen nicht.
    expect(capabilityUnder(capabilities, HERO_PATH, VANISH_GROUP_ID))
      .toMatchObject({ anchorKind: 'groupAnchor', effectiveMax: 20, isHidden: false });

    expandAll(container);

    expect(sectionByLabel(container, 'Vanishing Container'), 'Abschnitt des leeren Containers').toBeUndefined();
    expect(screen.queryByText('Ghost'), '"Ghost" erscheint nicht').toBeNull();
    expect(screen.queryByText('Phantom'), '"Phantom" erscheint nicht').toBeNull();
  });

  test('eine Gruppe ganz ohne Kinder rendert gar keinen Abschnitt', () => {
    const { container, capabilities } = renderCard();

    expect(capabilityUnder(capabilities, HERO_PATH, BARREN_GROUP_ID))
      .toMatchObject({ anchorKind: 'groupAnchor', effectiveMax: 20, isHidden: false });

    expandAll(container);

    expect(sectionByLabel(container, 'Barren'), 'Abschnitt der kinderlosen Gruppe').toBeUndefined();
  });

  test('kein Abschnitt der Karte bleibt ohne Optionszeilen und ohne Mitgliedsgruppen', () => {
    const { container } = renderCard();
    expandAll(container);

    const empty = sectionsOf(container)
      .filter(s => ownRows(s).length === 0 && s.querySelectorAll('.option-group').length === 0)
      .map(labelOf);

    expect(empty, 'leere Abschnitte auf der Karte').toEqual([]);
  });
});

describe('Kriterium 5 — eine gewoehnliche Optionsgruppe neben Containern bleibt unverschachtelt', () => {
  test('„Plain" steht auf oberster Ebene und zeigt Rod als direkte Zeile', () => {
    const { container, capabilities } = renderCard();

    expect(capabilityUnder(capabilities, HERO_PATH, PLAIN_GROUP_ID))
      .toMatchObject({ anchorKind: 'groupAnchor', effectiveMax: 1 });

    expandAll(container);

    const plain = sectionByLabel(container, 'Plain');
    expect(plain).toBeTruthy();
    expect(enclosingSection(plain), '"Plain" ist nicht verschachtelt').toBeNull();
    expect(plain.querySelectorAll('.option-group').length, '"Plain" haelt keine Mitgliedsgruppen').toBe(0);
    expect(ownRows(plain).map(r => r.textContent).some(t => t.includes('Rod'))).toBe(true);
  });
});
