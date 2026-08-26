/**
 * Issue 0085, increment 1, criterion 5 — `CategoryUnitAdder` (the raise
 * dialog) shows the RAISE cost of a candidate — the effective own cost of one
 * instance plus its mandatory children's raise cost — instead of the own
 * cost, both in the printed price and in the descending sort of its
 * candidates. Test-first: `capability.raiseCosts` does not exist yet, so
 * `Regiment` — whose points hang entirely on its mandatory model child —
 * prints no price at all today.
 *
 * Seam: the synthetic seam of `CategoryUnitAdder.evaluator.test.jsx` — an
 * inline `GAME_SYSTEM_XML`/`CATALOGUE_XML`, driven through the real facade
 * (`prepareDataset` + `evaluate`) and `toEvaluatorRoster`, `lucide-react` and
 * `./BottomSheet` stubbed and nothing else.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CategoryUnitAdderHarness as CategoryUnitAdder } from '../../../../tests/test-utils/harnesses/CategoryUnitAdderHarness';
import { prepareDataset, evaluate } from '../../../../contexts/ruleengine/evaluator.js';
import { toEvaluatorRoster } from '../../../../contexts/ruleengine/acl/rosterAdapter.js';

vi.mock('lucide-react', () => ({
  Plus: () => <span data-testid="icon-plus" />,
  X: () => <span data-testid="icon-x" />,
}));

vi.mock('../../../../ui/components/editor/BottomSheet', () => ({
  default: ({ isOpen, children }) => (isOpen ? <div data-testid="sheet">{children}</div> : null),
}));

const GAME_SYSTEM_ID = 'gs-main';
const FORCE_DEF_ID = 'force-main';
const CATEGORY_ID = 'cat-special';
const REGIMENT_ID = 'entry-regiment';
const MODEL_ID = 'entry-model';
const CHAMPION_ID = 'entry-champion';
const COST_TYPE_ID = 'cost-pts';
const FORCE_PATH = '0';

const REGIMENT_MODEL_MIN = 10;
const REGIMENT_MODEL_POINTS = 12;
const REGIMENT_RAISE_POINTS = REGIMENT_MODEL_MIN * REGIMENT_MODEL_POINTS; // 120
const CHAMPION_POINTS = 60;

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
  <gameSystem id="${GAME_SYSTEM_ID}" name="Test System">
    <costTypes><costType id="${COST_TYPE_ID}" name="pts" defaultCostLimit="-1"/></costTypes>
    <categoryEntries><categoryEntry id="${CATEGORY_ID}" name="Special"/></categoryEntries>
  </gameSystem>`;

const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-main" name="Main Catalogue" gameSystemId="${GAME_SYSTEM_ID}">
    <forceEntries>
      <forceEntry id="${FORCE_DEF_ID}" name="Main Force">
        <categoryLinks>
          <categoryLink id="cl-special" name="Special" targetId="${CATEGORY_ID}" primary="false"/>
        </categoryLinks>
      </forceEntry>
    </forceEntries>
    <selectionEntries>
      <selectionEntry id="${REGIMENT_ID}" name="Regiment" type="unit">
        <categoryLinks><categoryLink id="rl-1" name="Special" targetId="${CATEGORY_ID}" primary="true"/></categoryLinks>
        <selectionEntries>
          <selectionEntry id="${MODEL_ID}" name="Regiment Model" type="model">
            <constraints>
              <constraint id="limit-model-min" type="min" value="${REGIMENT_MODEL_MIN}" field="selections" scope="parent"/>
            </constraints>
            <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="${REGIMENT_MODEL_POINTS}"/></costs>
          </selectionEntry>
        </selectionEntries>
      </selectionEntry>
      <selectionEntry id="${CHAMPION_ID}" name="Champion" type="unit">
        <categoryLinks><categoryLink id="cl-1" name="Special" targetId="${CATEGORY_ID}" primary="true"/></categoryLinks>
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="${CHAMPION_POINTS}"/></costs>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

/** App-System-Objekt mit den rohen XMLs (Shape aus `src/platform/persistence/systemImport.js`). */
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

/** App-Roster: ein leeres Kontingent — beide Kandidaten sind reine Angebote. */
function appRoster() {
  return {
    id: 'roster-uuid',
    name: 'Test Roster',
    systemId: 'system-uuid',
    catalogueId: 'cat-main',
    costLimit: 1000,
    costLimitType: COST_TYPE_ID,
    forces: [{ id: 'force-uuid-1', forceEntryId: FORCE_DEF_ID, catalogueId: 'cat-main', selections: [] }],
  };
}

/** Auswertung ueber die ECHTE Fassade — die einzige Quelle der Erwartungen. */
function evaluation() {
  const prepared = prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [CATALOGUE_XML] });
  const { evalRoster, pathBySelectionId } = toEvaluatorRoster(appRoster());
  const report = evaluate(prepared, evalRoster);
  return { capabilities: report.capabilities, pathBySelectionId };
}

/** Sucht die Capability eines Slots unter dem Kontingent per Definitions-Id. */
function capabilityOf(capabilities, defId) {
  for (const [path, capability] of capabilities) {
    if (path.startsWith(`${FORCE_PATH}/`) && capability.defId === defId) return capability;
  }
  return undefined;
}

function renderAdder(raiseUnit, capabilities) {
  const roster = appRoster();
  render(
    <CategoryUnitAdder
      categoryId={CATEGORY_ID}
      categoryName="Special"
      capabilities={capabilities}
      forcePath={FORCE_PATH}
      system={appSystem()}
      activeCatalogue={{ id: 'cat-main' }}
      costTypeLabel="pts"
      costLimitType={COST_TYPE_ID}
      raiseUnit={raiseUnit}
      roster={roster}
      selectionCounts={{}}
      force={roster.forces[0]}
    />
  );
}

function openDialog() {
  fireEvent.click(screen.getByTitle('Special ausheben'));
}

/** Das tiefste (blattnahe) Element unter `row`, dessen Text exakt `text` ist. */
function exactTextNode(row, text) {
  const matches = [...row.querySelectorAll('*')].filter(el => el.textContent.trim() === text);
  return matches.sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length)[0] ?? null;
}

describe('CategoryUnitAdder: der Aushebe-Dialog zeigt den Aushebe-Preis statt des Eigenpreises (Issue 0085)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('zeigt +120 pts fuer Regiment, dessen Preis am Pflicht-Modell haengt (heute: gar kein Preis)', () => {
    const { capabilities } = evaluation();
    // Guard gegen den echten Bericht: Regiment traegt keine eigenen Kosten,
    // sein Aushebe-Preis liegt bei 120.
    expect(capabilityOf(capabilities, REGIMENT_ID).costs?.[COST_TYPE_ID] ?? 0).toBe(0);
    expect(capabilityOf(capabilities, REGIMENT_ID).raiseCosts?.[COST_TYPE_ID]).toBe(REGIMENT_RAISE_POINTS);

    renderAdder(vi.fn(), capabilities);
    openDialog();

    const regimentRow = screen.getByText('Regiment').closest('.popover-item');
    expect(exactTextNode(regimentRow, `+${REGIMENT_RAISE_POINTS} pts`), 'kein Element mit exakt „+120 pts"').not.toBeNull();
    expect(regimentRow.textContent).not.toMatch(/from/i);
  });

  it('sortiert absteigend nach dem Aushebe-Preis: Regiment (120) vor Champion (60)', () => {
    const { capabilities } = evaluation();
    expect(capabilityOf(capabilities, REGIMENT_ID).raiseCosts?.[COST_TYPE_ID]).toBe(REGIMENT_RAISE_POINTS);
    expect(capabilityOf(capabilities, CHAMPION_ID).raiseCosts?.[COST_TYPE_ID]).toBe(CHAMPION_POINTS);

    renderAdder(vi.fn(), capabilities);
    openDialog();

    const items = [...screen.getByTestId('sheet').querySelectorAll('.popover-item')];
    const names = items.map(item => item.textContent);
    const regimentIndex = names.findIndex(text => text.includes('Regiment'));
    const championIndex = names.findIndex(text => text.includes('Champion'));

    expect(regimentIndex).toBeGreaterThanOrEqual(0);
    expect(championIndex).toBeGreaterThanOrEqual(0);
    expect(regimentIndex).toBeLessThan(championIndex);
  });

  it('KONTROLLE: Champion (ohne Pflicht-Kinder) zeigt weiterhin genau +60 pts', () => {
    const { capabilities } = evaluation();
    expect(capabilityOf(capabilities, CHAMPION_ID).raiseCosts?.[COST_TYPE_ID]).toBe(CHAMPION_POINTS);

    renderAdder(vi.fn(), capabilities);
    openDialog();

    const championRow = screen.getByText('Champion').closest('.popover-item');
    expect(exactTextNode(championRow, `+${CHAMPION_POINTS} pts`), 'kein Element mit exakt „+60 pts"').not.toBeNull();
  });
});
