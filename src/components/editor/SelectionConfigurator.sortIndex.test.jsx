/**
 * Issue 0130, Kriterien 3-4 — `SelectionConfigurator.buildSections()` sortiert
 * Abschnitte (Gruppen-Anker-Sektionen wie eigenständige Options-Zeilen)
 * primär aufsteigend nach `sortIndex` (eine Gruppen-Sektion nutzt den
 * `sortIndex` ihrer `selectionEntryGroup`, eine eigenständige Options-Zeile
 * den ihrer `selectionEntry`/`entryLink`-Capability). Sektionen ohne
 * `sortIndex` werden danach angehängt, in der bisherigen, aus dem
 * Bericht/Slot-Ablauf abgeleiteten Reihenfolge (unverändert gegenüber heute).
 *
 * "Heute" ist dabei NICHT die reine Typ-Reihenfolge von `readSelectionChildren`
 * (erst `selectionEntry`, dann `selectionEntryGroup`, dann `entryLink`),
 * sondern die tatsächliche Slot-Reihenfolge des Berichts: ein Gruppen-Anker
 * entsteht in Baumphase 1 (`synthesizeGroupAnchors`, `evalTree.js`) und damit
 * VOR jedem Angebots-Anker seiner Optionen (Baumphase 2, `offer.js`) —
 * unabhängig von der Elementart. Verifiziert gegen den echten Bericht in
 * jedem Test (kein angenommener, sondern der tatsächlich gemessene
 * Ist-Zustand vor der Implementierung).
 *
 * Kriterium 3 (geteilter Nummerierungsraum): ein `entryLink` und eine
 * `selectionEntryGroup` unter demselben Rahmen teilen sich dieselbe
 * Zählfolge — ein niedriger `sortIndex` am `entryLink` muss ihn vor eine
 * `selectionEntryGroup` mit höherem `sortIndex` stellen, OBWOHL die Gruppe in
 * der heutigen Slot-Reihenfolge (Baumphase 1 vor Baumphase 2) immer VOR dem
 * Verweis erscheint. Eine Implementierung, die nur INNERHALB jeder
 * Ankerart/Herkunft sortiert und die bisherige Grundreihenfolge sonst
 * beibehält, fiele hier durch — genau das prüft dieser Test.
 *
 * Aufbau: dieselbe echte Zwei-Stufen-Fassade (`prepareDataset` + `evaluate`)
 * und dasselbe rawXmls-App-System/-Roster-Muster wie
 * `SelectionConfigurator.evaluator.test.jsx`; Reihenfolge wird über die
 * DOM-Position der gerenderten Abschnitte innerhalb des Sektionscontainers
 * geprüft (kein Rechnen der Reihenfolge in der UI — nur Ablesen aus dem DOM).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import SelectionConfigurator from './SelectionConfigurator';
import { createSubSelectionOperationsMock } from '../../test-utils/subSelectionOperationsMock';
import { prepareDataset, evaluate } from '../../evaluator/evaluator.js';
import { toEvaluatorRoster } from '../../evaluation/rosterAdapter.js';

vi.mock('lucide-react', () => ({
  ChevronDown: () => <span data-testid="icon-chevron-down" />,
  ChevronRight: () => <span data-testid="icon-chevron-right" />,
  Plus: () => <span data-testid="icon-plus" />,
  Minus: () => <span data-testid="icon-minus" />,
  Info: () => <span data-testid="icon-info" />,
  BookOpen: () => <span data-testid="icon-book" />,
}));

vi.mock('../../data/rulesLookup', () => ({ getRuleUrl: () => null }));
vi.mock('../../contexts/SettingsContext', () => ({
  useSettings: () => ({ whfb6LinkingEnabled: false }),
}));

const GAME_SYSTEM_ID = 'gs-main';
const FORCE_DEF_ID = 'force-main';
const HERO_ID = 'entry-hero';
const COST_TYPE_ID = 'cost-pts';
const HERO_PATH = '0/0';

// sortIndex="0" — der Grenzfall "0 ist ein gültiger, falsy-wertiger Index".
const ZERO_ENTRY_ID = 'opt-zero';
// sortIndex="1" — der entryLink, der trotz Typ-Reihenfolge vor der Gruppe stehen muss.
const LINK_ID = 'link-one';
const LINK_TARGET_ID = 'shared-linked';
// sortIndex="2" — die Gruppe, die der Link (Kriterium 3) überholen muss.
const GROUP_ID = 'grp-two';
const GROUP_ITEM_ID = 'opt-in-group';
// Ohne sortIndex, in Dokumentreihenfolge deklariert: Alpha, dann Zeta (ungültiger
// sortIndex, zählt als "kein sortIndex"), dann Delta — die Reihenfolge dieser drei
// untereinander darf sich nicht ändern (Kriterium 4, Fallback-Regel).
const ALPHA_ID = 'opt-alpha';
const ZETA_ID = 'opt-zeta';
const DELTA_ID = 'opt-delta';

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
  <gameSystem id="${GAME_SYSTEM_ID}" name="Test System">
    <costTypes><costType id="${COST_TYPE_ID}" name="pts" defaultCostLimit="-1"/></costTypes>
  </gameSystem>`;

const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-main" name="Main Catalogue" gameSystemId="${GAME_SYSTEM_ID}">
    <forceEntries><forceEntry id="${FORCE_DEF_ID}" name="Main Force"/></forceEntries>
    <sharedSelectionEntries>
      <selectionEntry id="${LINK_TARGET_ID}" name="LinkTarget" type="upgrade">
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="1"/></costs>
      </selectionEntry>
    </sharedSelectionEntries>
    <selectionEntries>
      <selectionEntry id="${HERO_ID}" name="Hero" type="unit">
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="50"/></costs>
        <selectionEntries>
          <selectionEntry id="${ALPHA_ID}" name="Alpha" type="upgrade">
            <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="1"/></costs>
          </selectionEntry>
          <selectionEntry id="${ZETA_ID}" name="Zeta" type="upgrade" sortIndex="abc">
            <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="1"/></costs>
          </selectionEntry>
          <selectionEntry id="${DELTA_ID}" name="Delta" type="upgrade">
            <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="1"/></costs>
          </selectionEntry>
          <selectionEntry id="${ZERO_ENTRY_ID}" name="ZeroTagged" type="upgrade" sortIndex="0">
            <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="1"/></costs>
          </selectionEntry>
        </selectionEntries>
        <selectionEntryGroups>
          <selectionEntryGroup id="${GROUP_ID}" name="TwoGroup" sortIndex="2">
            <constraints>
              <constraint type="max" value="1" field="selections" scope="parent" shared="true" id="limit-two-group-max" includeChildSelections="false"/>
            </constraints>
            <selectionEntries>
              <selectionEntry id="${GROUP_ITEM_ID}" name="InGroup" type="upgrade">
                <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="1"/></costs>
              </selectionEntry>
            </selectionEntries>
          </selectionEntryGroup>
        </selectionEntryGroups>
        <entryLinks>
          <entryLink id="${LINK_ID}" name="OneLink" targetId="${LINK_TARGET_ID}" sortIndex="1">
            <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="1"/></costs>
          </entryLink>
        </entryLinks>
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

function evaluation(roster) {
  const prepared = prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [CATALOGUE_XML] });
  const { evalRoster, pathBySelectionId } = toEvaluatorRoster(roster);
  const report = evaluate(prepared, evalRoster);
  return { capabilities: report.capabilities, pathBySelectionId };
}

function renderConfigurator() {
  const roster = appRoster();
  const { capabilities, pathBySelectionId } = evaluation(roster);
  const selection = roster.forces[0].selections[0];
  const utils = render(
    <SelectionConfigurator
      selection={selection}
      capabilities={capabilities}
      pathBySelectionId={pathBySelectionId}
      system={appSystem()}
      roster={roster}
      subSelectionOperations={createSubSelectionOperationsMock()}
      activeCatalogue={{ id: 'cat-main' }}
      handleMouseEnter={vi.fn()}
      handleMouseMove={vi.fn()}
      handleMouseLeave={vi.fn()}
      setActiveInfo={vi.fn()}
      onShowRule={vi.fn()}
    />
  );
  return utils;
}

/**
 * Die Reihenfolge der obersten Abschnitte als Namensliste, abgelesen aus der
 * DOM-Position der direkten Kinder des Sektionscontainers (keine Berechnung —
 * nur Textinhalt des jeweils ersten Namens-Kandidaten je Kind).
 */
function sectionOrder(container, candidateNames) {
  const flush = container.querySelector('.sub-selection-group--flush');
  return Array.from(flush.children)
    .map(el => el.textContent.trim())
    .map(text => candidateNames.find(name => text.startsWith(name)))
    .filter(Boolean);
}

describe('SelectionConfigurator.buildSections: Reihenfolge nach sortIndex (Issue 0130, Kriterien 3-4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sortiert die mit sortIndex getaggten Abschnitte aufsteigend VOR den ungetaggten Rest', () => {
    const { container } = renderConfigurator();

    const order = sectionOrder(container, ['ZeroTagged', 'OneLink', 'TwoGroup', 'Alpha', 'Zeta', 'Delta']);

    expect(order).toEqual(['ZeroTagged', 'OneLink', 'TwoGroup', 'Alpha', 'Zeta', 'Delta']);
  });

  it('Kriterium 3: der entryLink (sortIndex 1) steht trotz Typ-Reihenfolge VOR der Gruppe (sortIndex 2) — geteilter Nummerierungsraum', () => {
    const { container } = renderConfigurator();

    const order = sectionOrder(container, ['OneLink', 'TwoGroup']);

    expect(order).toEqual(['OneLink', 'TwoGroup']);
  });

  it('sortIndex="0" zählt als gültiger, niedrigster Index (nicht als "kein sortIndex")', () => {
    const { container } = renderConfigurator();

    const order = sectionOrder(container, ['ZeroTagged', 'OneLink', 'TwoGroup']);

    expect(order[0]).toBe('ZeroTagged');
  });

  it('Kriterium 4 (Fallback): der ungetaggte Rest wird HINTER den getaggten Abschnitten angehängt, in seiner bisherigen Reihenfolge', () => {
    const { container } = renderConfigurator();

    // Heute (Ist-Zustand vor der Implementierung) steht die Gruppe VOR Alpha
    // (Baumphase 1 vor Baumphase 2, siehe Kopfkommentar) — mit sortIndex muss
    // sie dagegen HINTER den getaggten Abschnitten und HINTER dem restlichen,
    // aber in ihrer eigenen unveränderten Relativordnung verbleibenden Rest
    // (Alpha vor Zeta vor Delta) folgen, weil sie selbst getaggt ist.
    const order = sectionOrder(container, ['ZeroTagged', 'OneLink', 'TwoGroup', 'Alpha', 'Zeta', 'Delta']);

    expect(order.slice(3)).toEqual(['Alpha', 'Zeta', 'Delta']);
    expect(order.slice(0, 3)).toEqual(['ZeroTagged', 'OneLink', 'TwoGroup']);
  });

  it('ein ungültiger sortIndex ("abc", Zeta) zählt als "kein sortIndex": er wird NICHT an den Anfang gezogen, sondern bleibt im ungetaggten Rest', () => {
    const { container } = renderConfigurator();

    const order = sectionOrder(container, ['ZeroTagged', 'OneLink', 'TwoGroup', 'Alpha', 'Zeta', 'Delta']);

    // Zeta muss hinter allen drei getaggten Abschnitten stehen — heute (vor der
    // Implementierung) liegt es dank Baumphase 2 zwar schon hinter der Gruppe,
    // aber VOR OneLink (einem Angebots-Anker derselben Phase in Slot-Reihenfolge);
    // mit sortIndex muss es hinter ALLEN DREI getaggten Abschnitten liegen.
    expect(order.indexOf('Zeta')).toBeGreaterThan(order.indexOf('OneLink'));
    expect(order.indexOf('Zeta')).toBeGreaterThan(order.indexOf('ZeroTagged'));
    expect(order.indexOf('Zeta')).toBeGreaterThan(order.indexOf('TwoGroup'));
  });
});
