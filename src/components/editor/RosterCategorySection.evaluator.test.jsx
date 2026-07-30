/**
 * Issue 0121, Task 7 — Kategorie-Grenzen: der Zaehl-Chip einer Kategorie
 * (CategoryCountBadge) speist sich aus dem categoryAnchor-Slot des
 * Evaluator-Berichts (`current`, `effectiveMin`, `effectiveMax`) statt aus
 * `getCategoryDisplayLimits` + `formatConstraintLimit` des Solvers
 * (test-first; die neue Implementierung existiert noch nicht).
 *
 * Getestet an der RosterCategorySection — der Stelle, die den Chip heute aus
 * dem Solver fuettert. Die bestehende Anzeige-Observable bleibt (aus den
 * bestehenden Badge-/Section-Tests gelesen): `{n}` ohne wirksame Grenzen,
 * `{n} / Min: {m}`, `{n} / Min: {m}, Max: {M}`.
 *
 * ── Falsifizierbarkeits-Entscheidung (markiert) ──────────────────────────────
 * `getCategoryDisplayLimits` und `formatConstraintLimit` sind GIFT-Stubs
 * (777/888 bzw. POISON-Prefix) UND Spies, die nie mehr laufen duerfen;
 * `forceCategoryCounts` ist bewusst leer — der Ist-Stand `n` KANN nur noch aus
 * `capability.current` kommen. Capabilities kommen aus der ECHTEN Fassade;
 * jeder Test prueft seine Vorbedingung per Guard-Assert gegen den echten
 * Bericht (verifiziert per Wegwerf-Skript: min 2/max 5 → effectiveMin 2,
 * effectiveMax 5, current 2; ohne Grenzen → effectiveMin/effectiveMax null).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import RosterCategorySection from './RosterCategorySection';
import { prepareDataset, evaluate } from '../../evaluator/evaluator.js';
import { toEvaluatorRoster } from '../../evaluation/rosterAdapter.js';

vi.mock('lucide-react', () => ({
  ChevronDown: () => <span data-testid="icon-chevron-down" />,
  ChevronRight: () => <span data-testid="icon-chevron-right" />,
}));

vi.mock('./CategoryUnitAdder', () => ({
  default: ({ categoryId }) => <button data-testid={`adder-${categoryId}`}>Hinzufügen</button>,
}));
vi.mock('./ListRuleChecklist', () => ({
  default: () => <div data-testid="list-rule-checklist" />,
}));
vi.mock('./UnitCardList', () => ({
  default: () => <div data-testid="unit-card-list" />,
}));

const getCategoryDisplayLimitsSpy = vi.fn(() => ({
  minValue: 777,
  maxValue: 888,
  minConstraint: { type: 'min' },
  maxConstraint: { type: 'max' },
}));
const formatConstraintLimitSpy = vi.fn((value) => `POISON${value}`);

vi.mock('../../solver/validator', async (importOriginal) => ({
  ...(await importOriginal()),
  getCategoryDisplayLimits: (...args) => getCategoryDisplayLimitsSpy(...args),
  formatConstraintLimit: (...args) => formatConstraintLimitSpy(...args),
  // Nicht unter Test (Sichtbarkeit/Listenregeln): benigne Stubs wie im
  // bestehenden RosterCategorySection.test.jsx.
  isCategoryLinkHidden: () => false,
  isEntryPrimaryInCategory: () => true,
  resolveListRuleGroup: () => ({ isListRuleGroup: false, states: [] }),
}));

// ── Synthetischer Datensatz (per Wegwerf-Skript gegen die Fassade geprueft) ──
//
// Kontingent mit zwei Kategorie-Links: „Special" mit min 2 / max 5 und „Open"
// ohne Grenzen. Warrior ×2 in „Special" → categoryAnchor Special:
// current 2, effectiveMin 2, effectiveMax 5; Open: current 0, beide null.

const GAME_SYSTEM_ID = 'gs-main';
const FORCE_DEF_ID = 'force-main';
const CATEGORY_SPECIAL = 'cat-special';
const CATEGORY_OPEN = 'cat-open';
const WARRIOR_ID = 'entry-warrior';
const COST_TYPE_ID = 'cost-pts';
const FORCE_PATH = '0';

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
  <gameSystem id="${GAME_SYSTEM_ID}" name="Test System">
    <costTypes><costType id="${COST_TYPE_ID}" name="pts" defaultCostLimit="-1"/></costTypes>
    <categoryEntries>
      <categoryEntry id="${CATEGORY_SPECIAL}" name="Special"/>
      <categoryEntry id="${CATEGORY_OPEN}" name="Open"/>
    </categoryEntries>
  </gameSystem>`;

const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-main" name="Main Catalogue" gameSystemId="${GAME_SYSTEM_ID}">
    <forceEntries>
      <forceEntry id="${FORCE_DEF_ID}" name="Main Force">
        <categoryLinks>
          <categoryLink id="cl-special" name="Special" targetId="${CATEGORY_SPECIAL}" primary="false">
            <constraints>
              <constraint type="min" value="2" field="selections" scope="force" shared="true" id="limit-special-min" includeChildSelections="true"/>
              <constraint type="max" value="5" field="selections" scope="force" shared="true" id="limit-special-max" includeChildSelections="true"/>
            </constraints>
          </categoryLink>
          <categoryLink id="cl-open" name="Open" targetId="${CATEGORY_OPEN}" primary="false"/>
        </categoryLinks>
      </forceEntry>
    </forceEntries>
    <selectionEntries>
      <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit">
        <categoryLinks>
          <categoryLink id="wl-1" name="Special" targetId="${CATEGORY_SPECIAL}" primary="true"/>
        </categoryLinks>
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="10"/></costs>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

function appSystem() {
  return {
    id: 'system-uuid',
    name: 'Test System',
    categoryEntries: [
      { id: CATEGORY_SPECIAL, name: 'Special' },
      { id: CATEGORY_OPEN, name: 'Open' },
    ],
    catalogues: [{ id: 'cat-main', name: 'Main Catalogue', selectionEntries: [{ id: WARRIOR_ID }] }],
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
          {
            id: 'sel-warrior',
            name: 'Warrior',
            entryLinkId: null,
            selectionEntryId: WARRIOR_ID,
            number: 2,
            category: CATEGORY_SPECIAL,
            selections: [],
          },
        ],
      },
    ],
  };
}

/** Auswertung ueber die ECHTE Fassade — die einzige Quelle der Erwartungen. */
function evaluation() {
  const prepared = prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [CATALOGUE_XML] });
  const { evalRoster, pathBySelectionId } = toEvaluatorRoster(appRoster());
  const report = evaluate(prepared, evalRoster);
  return { capabilities: report.capabilities, pathBySelectionId };
}

/** Der categoryAnchor-Slot einer Kategorie unter dem Kontingent. */
function categoryAnchorOf(capabilities, categoryId) {
  for (const [path, capability] of capabilities) {
    if (!path.startsWith(`${FORCE_PATH}/`)) continue;
    if (capability.anchorKind !== 'categoryAnchor') continue;
    if (capability.targetDefId === categoryId || capability.defId === categoryId) return capability;
  }
  return undefined;
}

function renderSection(categoryLink, { capabilities, pathBySelectionId }) {
  const roster = appRoster();
  return render(
    <RosterCategorySection
      categoryLink={categoryLink}
      force={roster.forces[0]}
      forcePath={FORCE_PATH}
      forceDef={null}
      system={appSystem()}
      roster={roster}
      activeCatalogue={{ id: 'cat-main', name: 'Main Catalogue' }}
      violations={[]}
      capabilities={capabilities}
      pathBySelectionId={pathBySelectionId}
      selectionCounts={{}}
      forceCategoryCounts={{}}
      costTypeLabel="Pkt"
      addUnit={vi.fn()}
      removeUnit={vi.fn()}
      subSelectionOperations={{}}
      unitCardContext={{}}
      isRuleGroupExpanded={false}
      onToggleRuleGroup={vi.fn()}
      onShowRule={vi.fn()}
    />
  );
}

const SPECIAL_LINK = { id: 'cl-special', targetId: CATEGORY_SPECIAL, name: 'Special' };
const OPEN_LINK = { id: 'cl-open', targetId: CATEGORY_OPEN, name: 'Open' };

const badgeTextOf = (container) =>
  container.querySelector('span.badge')?.textContent.replace(/\s+/g, ' ').trim();

describe('RosterCategorySection: Zaehl-Chip aus dem categoryAnchor-Slot (Issue 0121, Task 7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('zeigt Ist-Stand und beide Grenzen aus dem categoryAnchor (2 / Min: 2, Max: 5)', () => {
    const reportData = evaluation();
    // Guard gegen den echten Bericht: der Anker traegt die erwarteten Werte.
    expect(categoryAnchorOf(reportData.capabilities, CATEGORY_SPECIAL)).toMatchObject({
      current: 2,
      effectiveMin: 2,
      effectiveMax: 5,
    });

    const { container } = renderSection(SPECIAL_LINK, reportData);

    expect(badgeTextOf(container)).toBe('2 / Min: 2, Max: 5');
  });

  it('Rand: eine Kategorie ohne wirksame Grenzen (effectiveMin/effectiveMax null) zeigt nur den Ist-Stand', () => {
    const reportData = evaluation();
    expect(categoryAnchorOf(reportData.capabilities, CATEGORY_OPEN)).toMatchObject({
      current: 0,
      effectiveMin: null,
      effectiveMax: null,
    });

    const { container } = renderSection(OPEN_LINK, reportData);

    expect(badgeTextOf(container)).toBe('0');
  });

  it('ruft die Solver-Grenzenanzeige nicht mehr auf: kein getCategoryDisplayLimits, kein formatConstraintLimit (Modul-Spy)', () => {
    const { container } = renderSection(SPECIAL_LINK, evaluation());

    expect(getCategoryDisplayLimitsSpy).not.toHaveBeenCalled();
    expect(formatConstraintLimitSpy).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain('POISON');
    expect(container.textContent).not.toContain('777');
    expect(container.textContent).not.toContain('888');
  });
});
