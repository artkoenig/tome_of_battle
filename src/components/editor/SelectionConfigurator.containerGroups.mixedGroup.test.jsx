import React from 'react';
import { describe, test, expect, beforeAll, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import SelectionConfigurator from './SelectionConfigurator';
import { createSubSelectionOperationsMock } from '../../test-utils/subSelectionOperationsMock';
import { processImportedData } from '../../parser/xmlParser.js';
import { resolveEntry } from '../../roster/catalogResolver.js';
import { createSelectionFromDef } from '../../roster/selectionFactory.js';
import { rootSelectionsOf } from '../../roster/rosterTree.js';
import { prepareDataset, evaluate } from '../../evaluator/evaluator.js';
import { toEvaluatorRoster } from '../../evaluation/rosterAdapter.js';

/**
 * Issue 0131, Kriterium 7 — eine Gruppe, die SOWOHL eigene Optionen ALS AUCH
 * Links auf andere Gruppen haelt, rendert beides in EINEM Abschnitt: die
 * eigenen Optionen als direkte Zeilen, die verlinkten Gruppen darin
 * verschachtelt.
 *
 * Der benannte Fall ist echt: `src/__fixtures__/whfb6/Vampire Counts.cat`,
 * Gruppe „Magic Items" (`040b-d0d0-fe3b-9d13`) unter dem Necromancer
 * (`b5d8-db21-a4b7-9e94`) — vier `entryLink type="selectionEntryGroup"` und ein
 * `entryLink type="selectionEntry"` („Armour of Bone", `171e-1493-43ef-d62a`).
 * Die Gruppe traegt eine eigene Punktegrenze (max 50 pts) und jede der vier
 * verlinkten Gruppen eine `selections`-Grenze, alle fuenf erscheinen also als
 * Anker im Bericht — der Fall ist beobachtbar.
 *
 * Dazu ein synthetischer Katalog fuer die Kante, die der echte Fall nicht
 * hergibt: eine gemischte Gruppe mit MEHREREN eigenen Optionen, von der eine
 * der verlinkten Gruppen selbst ein Container ist (Kriterium 7 × 6).
 *
 * Wie in den Geschwisterdateien laufen beide durch die Produktionsnaht; nur der
 * Regel-Link-Nachschlag und der Settings-Kontext sind gestubbt.
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

// ── DOM-Hilfen: rein beobachtend (identisch zu den Geschwisterdateien) ───────

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

// ── Der echte Fall: Vampire Counts, Necromancer, Gruppe „Magic Items" ────────

const CATALOG_DIR = path.resolve('src/__fixtures__/whfb6');
const GST_FILE = 'Warhammer Fantasy Battle 6th edition.gst';
const VC_FILE = 'Vampire Counts.cat';
const PTS = 'ecfa-8486-4f6c-c249';

const NECROMANCER_ID = 'b5d8-db21-a4b7-9e94';
const MIXED_GROUP_ID = '040b-d0d0-fe3b-9d13';
const ARMOUR_OF_BONE_LINK_ID = '171e-1493-43ef-d62a';
const LINKED_GROUPS = [
  { name: 'Magic Weapons necromancer', id: '0cb4-d9ca-7d7d-fc1e' },
  { name: 'Arcane Items', id: '9f6d-e73b-80a3-cc2b' },
  { name: 'Magic Talisman', id: 'c8c7-28e1-ff5f-7b8f' },
  { name: 'Enchanted Items', id: 'c6f1-4ed3-eb25-9c78' },
];

let vcSystem;
let vcCatalogueId;
let vcPrepared;
let vcForceEntryId;

beforeAll(() => {
  const gstContent = fs.readFileSync(path.join(CATALOG_DIR, GST_FILE), 'utf8');
  const catContent = fs.readFileSync(path.join(CATALOG_DIR, VC_FILE), 'utf8');
  vcSystem = processImportedData(
    [{ name: GST_FILE, content: gstContent }],
    [{ name: VC_FILE, content: catContent }],
  ).system;
  vcCatalogueId = vcSystem.catalogues[0].id;
  vcPrepared = prepareDataset({ gameSystem: gstContent, catalogues: [catContent] });
  vcForceEntryId = vcSystem.forceEntries[0].id;
});

function renderNecromancer() {
  const entry = vcSystem.catalogues[0].selectionEntries.find(e => e.id === NECROMANCER_ID);
  const unit = createSelectionFromDef({
    system: vcSystem, resolveEntry, catalogueId: vcCatalogueId, entry, categoryId: 'characters',
  });
  const roster = {
    catalogueId: vcCatalogueId,
    name: 'test',
    costLimit: 2000,
    costLimitType: PTS,
    forces: [{ id: 'force-1', forceEntryId: vcForceEntryId, catalogueId: vcCatalogueId, selections: [unit] }],
  };
  const { evalRoster, pathBySelectionId } = toEvaluatorRoster(roster);
  const { capabilities } = evaluate(vcPrepared, evalRoster);
  const selection = rootSelectionsOf(roster)[0];
  const view = render(
    <SelectionConfigurator
      selection={selection}
      capabilities={capabilities}
      pathBySelectionId={pathBySelectionId}
      system={vcSystem}
      roster={roster}
      subSelectionOperations={createSubSelectionOperationsMock()}
      activeCatalogue={vcSystem.catalogues[0]}
      handleMouseEnter={vi.fn()}
      handleMouseMove={vi.fn()}
      handleMouseLeave={vi.fn()}
      setActiveInfo={vi.fn()}
      onShowRule={vi.fn()}
    />
  );
  return { ...view, capabilities, pathBySelectionId, selection };
}

describe('Kriterium 7 — gemischte Gruppe: eigene Optionen UND verlinkte Gruppen in einem Abschnitt (Vampire Counts, Necromancer)', () => {
  test('„Magic Items" zeigt „Armour of Bone" als eigene Zeile UND haelt seine vier verlinkten Gruppen im selben Abschnitt', () => {
    const { container, capabilities, pathBySelectionId, selection } = renderNecromancer();

    // Vorbedingung am echten Bericht: die gemischte Gruppe hat einen Anker mit
    // eigenem Punktebudget, die vier verlinkten Gruppen ebenso, und die direkte
    // Option ist ein sichtbarer Slot.
    const unitPath = pathBySelectionId.get(selection.id);
    expect(unitPath).toBe('0/0');
    expect(capabilityUnder(capabilities, unitPath, MIXED_GROUP_ID))
      .toMatchObject({ anchorKind: 'groupAnchor', costLimits: [expect.objectContaining({ bound: 50 })] });
    expect(capabilityUnder(capabilities, unitPath, ARMOUR_OF_BONE_LINK_ID))
      .toMatchObject({ isHidden: false });
    LINKED_GROUPS.forEach(group => {
      expect(capabilityUnder(capabilities, unitPath, group.id), `Anker fuer ${group.name}`)
        .toMatchObject({ anchorKind: 'groupAnchor', effectiveMax: 1 });
    });

    expandAll(container);

    const mixed = sectionByLabel(container, 'Magic Items');
    expect(mixed, 'Abschnitt "Magic Items"').toBeTruthy();
    expect(limitTextOf(mixed)).toMatch(/0\s*\/\s*50/);

    // Die eigene Option bleibt eine direkte Zeile dieses Abschnitts …
    const ownRowTexts = ownRows(mixed).map(r => r.textContent);
    expect(
      ownRowTexts.some(t => t.includes('Armour of Bone')),
      '"Armour of Bone" ist eine direkte Zeile von "Magic Items"',
    ).toBe(true);

    // … und die vier verlinkten Gruppen haengen unmittelbar im selben Abschnitt.
    LINKED_GROUPS.forEach(group => {
      const linked = sectionByLabel(container, group.name);
      expect(linked, `Abschnitt "${group.name}"`).toBeTruthy();
      expect(
        mixed.contains(linked),
        `"${group.name}" liegt im Abschnitt "Magic Items"`,
      ).toBe(true);
      expect(
        enclosingSection(linked),
        `"${group.name}" haengt unmittelbar an "Magic Items"`,
      ).toBe(mixed);
    });
  });

  test('keine der vier verlinkten Gruppen ist ein Geschwister-Abschnitt von „Magic Items"', () => {
    const { container } = renderNecromancer();
    expandAll(container);

    const topLevelLabels = topLevelSections(container).map(labelOf);

    // Positivkontrolle: die gemischte Gruppe und eine gewoehnliche
    // Optionsgruppe des Necromancer bleiben auf oberster Ebene.
    expect(topLevelLabels).toContain('Magic Items');
    expect(topLevelLabels).toContain('Wizard Level');

    LINKED_GROUPS.forEach(group => {
      expect(topLevelLabels, `"${group.name}" ist kein Geschwister von "Magic Items"`)
        .not.toContain(group.name);
    });
  });

  test('die eigene Option landet nicht in einer der verschachtelten Gruppen, sondern bleibt Zeile der gemischten Gruppe selbst', () => {
    const { container } = renderNecromancer();
    expandAll(container);

    const mixed = sectionByLabel(container, 'Magic Items');
    expect(mixed).toBeTruthy();

    const armourRow = screen.getByText('Armour of Bone').closest('.sub-selection-row');
    expect(armourRow, '"Armour of Bone" hat eine Zeile').toBeTruthy();
    expect(
      armourRow.closest('.option-group'),
      '"Armour of Bone" gehoert dem Abschnitt "Magic Items" selbst',
    ).toBe(mixed);

    // Gegenprobe: der Abschnitt haelt tatsaechlich auch Gruppen — sonst waere
    // die Zuordnung oben trivial erfuellt.
    expect(
      mixed.querySelectorAll('.option-group').length,
      '"Magic Items" haelt seine verlinkten Gruppen',
    ).toBe(LINKED_GROUPS.length);
  });
});

// ── Die Kante, die der echte Fall nicht hergibt: mehrere eigene Optionen, ────
// ── und eine der verlinkten Gruppen ist selbst ein Container. ────────────────

const COST_TYPE_ID = 'cost-pts';
const MIXED_BAG_ID = 'grp-mixed-bag';
const GEMS_LINK_ID = 'link-gems';
const RELICS_LINK_ID = 'link-relics';
const AMULETS_LINK_ID = 'link-amulets';
const HERO_PATH = '0/0';

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
<gameSystem id="gs-mixed" name="Test System">
  <costTypes><costType id="${COST_TYPE_ID}" name="pts" defaultCostLimit="-1"/></costTypes>
</gameSystem>`;

const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
<catalogue id="cat-mixed" name="Mixed Catalogue" gameSystemId="gs-mixed">
  <forceEntries><forceEntry id="force-mixed" name="Main Force"/></forceEntries>
  <sharedSelectionEntryGroups>
    <selectionEntryGroup id="grp-gems" name="Gems" hidden="false" collective="false" import="true">
      <constraints>
        <constraint field="selections" scope="parent" value="1" type="max" id="lim-gems" percentValue="false" shared="true" includeChildSelections="false" includeChildForces="false"/>
      </constraints>
      <selectionEntries>
        <selectionEntry id="opt-ruby" name="Ruby" type="upgrade"><costs><cost name="pts" typeId="${COST_TYPE_ID}" value="5"/></costs></selectionEntry>
      </selectionEntries>
    </selectionEntryGroup>
    <selectionEntryGroup id="grp-relics" name="Relics" hidden="false" collective="false" import="true">
      <constraints>
        <constraint field="${COST_TYPE_ID}" scope="parent" value="25" type="max" id="lim-relics" percentValue="false" shared="true" includeChildSelections="false" includeChildForces="false"/>
      </constraints>
      <entryLinks>
        <entryLink id="${AMULETS_LINK_ID}" name="Amulets" hidden="false" collective="false" import="true" targetId="grp-amulets" type="selectionEntryGroup"/>
      </entryLinks>
    </selectionEntryGroup>
    <selectionEntryGroup id="grp-amulets" name="Amulets" hidden="false" collective="false" import="true">
      <constraints>
        <constraint field="selections" scope="parent" value="1" type="max" id="lim-amulets" percentValue="false" shared="true" includeChildSelections="false" includeChildForces="false"/>
      </constraints>
      <selectionEntries>
        <selectionEntry id="opt-charm" name="Charm" type="upgrade"><costs><cost name="pts" typeId="${COST_TYPE_ID}" value="8"/></costs></selectionEntry>
      </selectionEntries>
    </selectionEntryGroup>
  </sharedSelectionEntryGroups>
  <selectionEntries>
    <selectionEntry id="entry-hero" name="Hero" type="unit">
      <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="50"/></costs>
      <selectionEntryGroups>
        <selectionEntryGroup id="${MIXED_BAG_ID}" name="Mixed Bag" hidden="false" collective="false" import="true">
          <constraints>
            <constraint field="${COST_TYPE_ID}" scope="parent" value="40" type="max" id="lim-mixed" percentValue="false" shared="true" includeChildSelections="false" includeChildForces="false"/>
          </constraints>
          <selectionEntries>
            <selectionEntry id="opt-rod" name="Rod" type="upgrade"><costs><cost name="pts" typeId="${COST_TYPE_ID}" value="6"/></costs></selectionEntry>
            <selectionEntry id="opt-wand" name="Wand" type="upgrade"><costs><cost name="pts" typeId="${COST_TYPE_ID}" value="7"/></costs></selectionEntry>
          </selectionEntries>
          <entryLinks>
            <entryLink id="${GEMS_LINK_ID}" name="Gems" hidden="false" collective="false" import="true" targetId="grp-gems" type="selectionEntryGroup"/>
            <entryLink id="${RELICS_LINK_ID}" name="Relics" hidden="false" collective="false" import="true" targetId="grp-relics" type="selectionEntryGroup"/>
          </entryLinks>
        </selectionEntryGroup>
      </selectionEntryGroups>
    </selectionEntry>
  </selectionEntries>
</catalogue>`;

function renderMixedBag() {
  const system = processImportedData(
    [{ name: 'mixed.gst', content: GAME_SYSTEM_XML }],
    [{ name: 'mixed.cat', content: CATALOGUE_XML }],
  ).system;
  const roster = {
    id: 'roster-uuid', name: 'Test Roster', systemId: 'system-uuid', catalogueId: 'cat-mixed',
    costLimit: 1000, costLimitType: COST_TYPE_ID,
    forces: [{
      id: 'force-uuid-1', forceEntryId: 'force-mixed', catalogueId: 'cat-mixed',
      selections: [{
        id: 'sel-hero', name: 'Hero', entryLinkId: null, selectionEntryId: 'entry-hero',
        number: 1, category: null, selections: [],
      }],
    }],
  };
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

describe('Kriterium 7, Kante — mehrere eigene Optionen, und eine verlinkte Gruppe ist selbst ein Container', () => {
  test('„Mixed Bag" haelt beide eigenen Optionen als Zeilen und beide verlinkten Gruppen verschachtelt', () => {
    const { container, capabilities, pathBySelectionId } = renderMixedBag();

    expect(pathBySelectionId.get('sel-hero')).toBe(HERO_PATH);
    expect(capabilityUnder(capabilities, HERO_PATH, MIXED_BAG_ID))
      .toMatchObject({ anchorKind: 'groupAnchor', costLimits: [expect.objectContaining({ bound: 40 })] });
    expect(capabilityUnder(capabilities, HERO_PATH, GEMS_LINK_ID))
      .toMatchObject({ anchorKind: 'groupAnchor', effectiveMax: 1 });
    expect(capabilityUnder(capabilities, HERO_PATH, RELICS_LINK_ID))
      .toMatchObject({ anchorKind: 'groupAnchor', costLimits: [expect.objectContaining({ bound: 25 })] });

    expandAll(container);

    const mixed = sectionByLabel(container, 'Mixed Bag');
    expect(mixed, 'Abschnitt "Mixed Bag"').toBeTruthy();

    const ownRowTexts = ownRows(mixed).map(r => r.textContent);
    ['Rod', 'Wand'].forEach(name => {
      expect(ownRowTexts.some(t => t.includes(name)), `${name} ist eine direkte Zeile`).toBe(true);
    });
    expect(ownRows(mixed), 'genau die beiden eigenen Optionen als Zeilen').toHaveLength(2);

    ['Gems', 'Relics'].forEach(name => {
      const linked = sectionByLabel(container, name);
      expect(linked, `Abschnitt "${name}"`).toBeTruthy();
      expect(enclosingSection(linked), `"${name}" haengt an "Mixed Bag"`).toBe(mixed);
    });
  });

  test('die verschachtelte Container-Gruppe „Relics" haelt ihrerseits „Amulets" — die Tiefe bleibt erhalten', () => {
    const { container, capabilities } = renderMixedBag();

    expect(capabilityUnder(capabilities, HERO_PATH, AMULETS_LINK_ID))
      .toMatchObject({ anchorKind: 'groupAnchor', effectiveMax: 1 });

    expandAll(container);

    const mixed = sectionByLabel(container, 'Mixed Bag');
    const relics = sectionByLabel(container, 'Relics');
    const amulets = sectionByLabel(container, 'Amulets');
    expect(relics, 'Abschnitt "Relics"').toBeTruthy();
    expect(amulets, 'Abschnitt "Amulets"').toBeTruthy();

    expect(enclosingSection(amulets), '"Amulets" haengt an "Relics"').toBe(relics);
    expect(enclosingSection(relics), '"Relics" haengt an "Mixed Bag"').toBe(mixed);
    expect(ownRows(amulets).map(r => r.textContent).some(t => t.includes('Charm'))).toBe(true);

    const topLevelLabels = topLevelSections(container).map(labelOf);
    expect(topLevelLabels).toEqual(['Mixed Bag']);
  });
});
