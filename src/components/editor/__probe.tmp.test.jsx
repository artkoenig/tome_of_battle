import React from 'react';
import { describe, test, expect, beforeAll, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
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

const CATALOG_DIR = path.resolve('src/__fixtures__/whfb6');
const GST_FILE = 'Warhammer Fantasy Battle 6th edition.gst';
const CAT_FILE = 'Ogre Kingdoms.cat';
const PTS = 'ecfa-8486-4f6c-c249';
const TYRANT_ID = '2679-58f4-1771-662d';
const WALL_LINK = '6256-a750-b3ce-c4fe';
const WALL_SHARED = '54ba-f80e-6e83-19ea';

let system, catalogueId, prepared, forceEntryId;
beforeAll(() => {
  const gst = fs.readFileSync(path.join(CATALOG_DIR, GST_FILE), 'utf8');
  const cat = fs.readFileSync(path.join(CATALOG_DIR, CAT_FILE), 'utf8');
  system = processImportedData([{ name: GST_FILE, content: gst }], [{ name: CAT_FILE, content: cat }]).system;
  catalogueId = system.catalogues[0].id;
  prepared = prepareDataset({ gameSystem: gst, catalogues: [cat] });
  forceEntryId = system.forceEntries[0].id;
});

function buildRoster(idForm) {
  const entry = system.catalogues[0].selectionEntries.find(e => e.id === TYRANT_ID);
  const unit = createSelectionFromDef({ system, resolveEntry, catalogueId, entry, categoryId: 'characters' });
  unit.selections.push({
    id: 'sel-wallcrusher',
    name: 'Wallcrusher',
    entryLinkId: idForm === 'link' ? WALL_LINK : null,
    selectionEntryId: idForm === 'link' ? null : WALL_SHARED,
    number: 1,
    category: null,
    selections: [],
  });
  return {
    catalogueId, name: 'test', costLimit: 2000, costLimitType: PTS,
    forces: [{ id: 'force-1', forceEntryId, catalogueId, selections: [unit] }],
  };
}

function renderCard(roster) {
  const { evalRoster, pathBySelectionId } = toEvaluatorRoster(roster);
  const report = evaluate(prepared, evalRoster);
  const selection = rootSelectionsOf(roster)[0];
  const view = render(
    <SelectionConfigurator
      selection={selection}
      capabilities={report.capabilities}
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
  return { ...view, report, pathBySelectionId, selection };
}

const ownHeader = (s) => {
  const h = s.querySelector('.option-group-header');
  return h && h.closest('.option-group') === s ? h : null;
};
function labelOf(s) {
  const h = ownHeader(s); if (!h) return '';
  const t = h.querySelector('.text-ui-title') || h;
  const l = t.querySelector('.option-group-limit');
  const f = t.textContent || '';
  return (l ? f.replace(l.textContent, '') : f).trim();
}
const sectionsOf = (root) => [...root.querySelectorAll('.option-group')];
const isExpanded = (s) => !!ownHeader(s)?.querySelector('[data-testid="icon-chevron-down"]');

function dump(container, label) {
  console.log(`--- ${label} ---`);
  sectionsOf(container).forEach(s => console.log(`  section "${labelOf(s)}" expanded=${isExpanded(s)}`));
  console.log('  has Wallcrusher text:', container.textContent.includes('Wallcrusher'));
}

describe('probe', () => {
  test('link id form', () => {
    const roster = buildRoster('link');
    const { container, report, pathBySelectionId } = renderCard(roster);
    const unitPath = pathBySelectionId.get(rootSelectionsOf(roster)[0].id);
    console.log('unitPath', unitPath, 'wallPath', pathBySelectionId.get('sel-wallcrusher'));
    const cap = report.capabilities.get(pathBySelectionId.get('sel-wallcrusher'));
    console.log('wall capability', JSON.stringify(cap));
    dump(container, 'LINK ID, initial');
    const row = [...container.querySelectorAll('.sub-selection-row')].find(r => r.textContent.includes('Wallcrusher'));
    console.log('  wall row control checked:', row?.querySelector('input')?.checked, 'type', row?.querySelector('input')?.type);
    expect(true).toBe(true);
  });

  test('shared id form', () => {
    const roster = buildRoster('shared');
    const { container, report, pathBySelectionId } = renderCard(roster);
    console.log('wallPath', pathBySelectionId.get('sel-wallcrusher'));
    console.log('diagnostics', JSON.stringify(report.diagnostics ?? report.violations?.slice?.(0, 3) ?? null));
    dump(container, 'SHARED ID, initial');
    // manually expand everything to see what the post-fix DOM would look like
    for (let i = 0; i < 8; i += 1) {
      const collapsed = sectionsOf(container).filter(s => ownHeader(s)?.querySelector('[data-testid="icon-chevron-right"]'));
      if (!collapsed.length) break;
      collapsed.forEach(s => fireEvent.click(ownHeader(s)));
    }
    dump(container, 'SHARED ID, after manual expandAll');
    const row = [...container.querySelectorAll('.sub-selection-row')].find(r => r.textContent.includes('Wallcrusher'));
    console.log('  wall row present:', !!row, 'checked:', row?.querySelector('input')?.checked, 'group:', row && labelOf(row.closest('.option-group')));
    expect(true).toBe(true);
  });
});
