/**
 * Issue 0153, AC4 — eine Kategorie-Sektion des Kontingents erscheint genau
 * dann, wenn der Katalog für sie ein **Wurzelangebot** kennt, und ist damit
 * deckungsgleich mit dem, was der Hinzufüger („+"-Adder) dort anbietet.
 *
 * ── Falsifizierbarkeits-Entscheidung (markiert) ──────────────────────────────
 * Nichts von `../../roster` und nichts vom Evaluator ist gefälscht: die
 * Sichtbarkeitsprüfung der Sektion läuft über den echten Katalog, der
 * `CategoryUnitAdder` über den echten Bericht der Fassade. Beide Seiten der
 * Deckungsgleichheit werden deshalb an **einer** Beobachtung abgelesen — die
 * Sektion im DOM und der Hinzüfüger-Knopf im DOM (der Adder rendert `null`,
 * solange er nichts anzubieten hat).
 *
 * Der Datensatz stellt die drei Fälle nebeneinander:
 *   - „Heroes"  — Wurzel-`selectionEntry`            → Sektion erscheint
 *   - „Retinue" — Wurzel-`entryLink` auf einen geteilten Eintrag → erscheint
 *   - „Honours" — Eintrag NUR in `sharedSelectionEntries`, allein über den
 *     `entryLink` des Helden erreichbar → Sektion erscheint NICHT
 */

import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import RosterCategorySection from './RosterCategorySection';
import { processImportedData } from '../../parser/xmlParser.js';
import { prepareDataset, evaluate } from '../../evaluator/evaluator.js';
import { toEvaluatorRoster } from '../../evaluation/rosterAdapter.js';

vi.mock('lucide-react', () => ({
  ChevronDown: () => <span data-testid="icon-chevron-down" />,
  ChevronRight: () => <span data-testid="icon-chevron-right" />,
  Plus: () => <span data-testid="icon-plus" />,
  X: () => <span data-testid="icon-x" />,
}));

// Die Kartenliste ist hier ohne Belang — das Kontingent ist leer.
vi.mock('./UnitCardList', () => ({
  default: () => <div data-testid="unit-card-list" />,
}));

const GAME_SYSTEM_ID = 'gs-main';
const FORCE_DEF_ID = 'force-main';
const CATALOGUE_ID = 'cat-main';
const COST_TYPE_ID = 'cost-pts';
const FORCE_PATH = '0';

const CAT_HEROES = 'cat-heroes';
const CAT_RETINUE = 'cat-retinue';
const CAT_HONOURS = 'cat-honours';

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
  <gameSystem id="${GAME_SYSTEM_ID}" name="Test System">
    <costTypes><costType id="${COST_TYPE_ID}" name="pts" defaultCostLimit="-1"/></costTypes>
    <categoryEntries>
      <categoryEntry id="${CAT_HEROES}" name="Heroes"/>
      <categoryEntry id="${CAT_RETINUE}" name="Retinue"/>
      <categoryEntry id="${CAT_HONOURS}" name="Honours"/>
    </categoryEntries>
  </gameSystem>`;

const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="${CATALOGUE_ID}" name="Main Catalogue" gameSystemId="${GAME_SYSTEM_ID}">
    <forceEntries>
      <forceEntry id="${FORCE_DEF_ID}" name="Main Force">
        <categoryLinks>
          <categoryLink id="cl-heroes" name="Heroes" targetId="${CAT_HEROES}" primary="false"/>
          <categoryLink id="cl-retinue" name="Retinue" targetId="${CAT_RETINUE}" primary="false"/>
          <categoryLink id="cl-honours" name="Honours" targetId="${CAT_HONOURS}" primary="false"/>
        </categoryLinks>
      </forceEntry>
    </forceEntries>
    <sharedSelectionEntries>
      <selectionEntry id="shared-honour" name="Pure of Heart" type="upgrade">
        <categoryLinks>
          <categoryLink id="hl-1" name="Honours" targetId="${CAT_HONOURS}" primary="true"/>
        </categoryLinks>
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="5"/></costs>
      </selectionEntry>
      <selectionEntry id="shared-retinue" name="Bodyguard" type="unit">
        <categoryLinks>
          <categoryLink id="rl-1" name="Retinue" targetId="${CAT_RETINUE}" primary="true"/>
        </categoryLinks>
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="20"/></costs>
      </selectionEntry>
    </sharedSelectionEntries>
    <selectionEntries>
      <selectionEntry id="entry-hero" name="Hero" type="unit">
        <categoryLinks>
          <categoryLink id="hl-2" name="Heroes" targetId="${CAT_HEROES}" primary="true"/>
        </categoryLinks>
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="50"/></costs>
        <entryLinks>
          <entryLink id="link-honour-on-hero" name="Pure of Heart" hidden="false"
                     type="selectionEntry" targetId="shared-honour"/>
        </entryLinks>
      </selectionEntry>
    </selectionEntries>
    <entryLinks>
      <entryLink id="link-retinue-root" name="Bodyguard" hidden="false"
                 type="selectionEntry" targetId="shared-retinue"/>
    </entryLinks>
  </catalogue>`;

function appRoster() {
  return {
    id: 'roster-uuid',
    name: 'Test Roster',
    systemId: 'system-uuid',
    catalogueId: CATALOGUE_ID,
    costLimit: 1000,
    costLimitType: COST_TYPE_ID,
    forces: [
      {
        id: 'force-uuid-1',
        forceEntryId: FORCE_DEF_ID,
        catalogueId: CATALOGUE_ID,
        selections: [],
      },
    ],
  };
}

let appSystem;
let capabilities;
let pathBySelectionId;

beforeAll(() => {
  appSystem = processImportedData(
    [{ name: 'test.gst', content: GAME_SYSTEM_XML }],
    [{ name: 'main.cat', content: CATALOGUE_XML }],
  ).system;

  const prepared = prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [CATALOGUE_XML] });
  const adapted = toEvaluatorRoster(appRoster());
  pathBySelectionId = adapted.pathBySelectionId;
  capabilities = evaluate(prepared, adapted.evalRoster).capabilities;
});

/** Die Angebots-Slots des Berichts unter dem Kontingent, je Primär-Kategorie. */
function offeredDefIds(categoryId) {
  const ids = [];
  for (const [path, capability] of capabilities) {
    if (!path.startsWith(`${FORCE_PATH}/`)) continue;
    if (capability.primaryCategoryId !== categoryId) continue;
    if (capability.isHidden) continue;
    ids.push(capability.defId);
  }
  return ids;
}

function renderSection(categoryId, name) {
  const roster = appRoster();
  const catalogue = appSystem.catalogues.find(c => c.id === CATALOGUE_ID);
  return render(
    <RosterCategorySection
      categoryLink={{ id: `cl-${categoryId}`, targetId: categoryId, name }}
      force={roster.forces[0]}
      forcePath={FORCE_PATH}
      forceCatalogueId={CATALOGUE_ID}
      system={appSystem}
      roster={roster}
      activeCatalogue={catalogue}
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

/** Beobachtung: erscheint die Sektion, und bietet der Adder dort etwas an? */
function observe(categoryId, name) {
  const { container } = renderSection(categoryId, name);
  return {
    section: container.querySelector('.roster-category-group') !== null,
    adder: container.querySelector('.category-unit-adder-container button') !== null,
  };
}

describe('RosterCategorySection: Sektion nur für Wurzelangebote (Issue 0153, AC4)', () => {
  it('KONTROLLE: die Kategorie eines Wurzel-selectionEntry erscheint samt Hinzufüger', () => {
    expect(offeredDefIds(CAT_HEROES)).toContain('entry-hero');

    expect(observe(CAT_HEROES, 'Heroes')).toEqual({ section: true, adder: true });
  });

  it('die Kategorie eines an der Wurzel verlinkten geteilten Eintrags erscheint samt Hinzufüger', () => {
    expect(offeredDefIds(CAT_RETINUE).length).toBeGreaterThan(0);

    expect(observe(CAT_RETINUE, 'Retinue')).toEqual({ section: true, adder: true });
  });

  it('die Kategorie eines nur geteilten Eintrags erscheint nicht — der Adder bietet dort nichts an', () => {
    // Vorbedingung am echten Bericht: unter dem Kontingent gibt es für diese
    // Kategorie kein Angebot; „Pure of Heart" ist allein am Helden erreichbar.
    expect(offeredDefIds(CAT_HONOURS)).toEqual([]);

    expect(observe(CAT_HONOURS, 'Honours')).toEqual({ section: false, adder: false });
  });
});
