/**
 * Issue 0121, Task 7 — PlayUnitDetails: die Profil-Tabellen der Spielkarte
 * kommen aus `capability.infoElements` des Slots, nicht mehr aus
 * `collectUnitProfilesAndRules` des Solvers (test-first; die neue
 * Implementierung existiert noch nicht). Die Gruppierung nach Profiltyp
 * bleibt die bestehende Observable (Statblock zuerst, weitere Profiltypen als
 * eigene Tabelle mit Typ-Ueberschrift).
 *
 * PlayMode/gameState-Interna (Wunden, Runden etc.) bleiben unberuehrt — hier
 * stehen allein die Profil-Quellen unter Test.
 *
 * ── Prop-Vertragsentscheidung (markiert, wie UnitChips.evaluator.test) ───────
 * Bestehende Props behalten ihre Bedeutung. NEU erhaelt die Karte den
 * Faehigkeitsdatensatz ihres Slots — der Test reicht ALLE plausiblen Kanaele
 * zugleich: `capability` sowie `capabilities` + `pathBySelectionId`.
 *
 * ── Falsifizierbarkeits-Entscheidung (markiert) ──────────────────────────────
 * `collectUnitProfilesAndRules` ist GIFT-Stub (nur POISON-PROFILE) und Spy.
 * Die infoElements-Form wurde per Wegwerf-Skript gegen die ECHTE Fassade
 * verifiziert; jeder Test prueft seine Vorbedingung per Guard-Assert gegen den
 * echten Bericht.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { PlayUnitDetailsHarness as PlayUnitDetails } from '../../../../tests/test-utils/editorHarness';
import { prepareDataset, evaluate } from '../../../../domain/evaluator/evaluator.js';
import { toEvaluatorRoster } from '../../../../contexts/ruleengine/acl/rosterAdapter.js';

vi.mock('lucide-react', () => ({
  Plus: () => <span data-testid="icon-plus" />,
  Minus: () => <span data-testid="icon-minus" />,
  ReceiptText: () => <span data-testid="icon-receipt" />,
}));

const mockUseSettings = vi.fn(() => ({ whfb6LinkingEnabled: false }));
vi.mock('../../../../ui/viewmodels/SettingsContext', () => ({
  useSettings: () => mockUseSettings(),
}));

// Die Chips sind eine eigene Baustelle (UnitChips.evaluator.test.jsx).
vi.mock('../../../../ui/components/editor/UnitChips', () => ({
  UnitUpgradesChips: () => null,
  UnitRulesChips: () => null,
}));

// Der Solver ist mit Issue 0121 geloescht; der fruehere Gift-Stub auf seine
// Fassade hat damit keinen Gegenstand mehr — dass die Anzeige aus dem Bericht
// kommt, ist jetzt strukturell garantiert.

// ── Synthetischer Datensatz: Statblock- und Waffen-Profil per infoLink ───────

const GAME_SYSTEM_ID = 'gs-main';
const FORCE_DEF_ID = 'force-main';
const WARRIOR_ID = 'entry-warrior';
const COST_TYPE_ID = 'cost-pts';

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
  <gameSystem id="${GAME_SYSTEM_ID}" name="Test System">
    <costTypes><costType id="${COST_TYPE_ID}" name="pts" defaultCostLimit="-1"/></costTypes>
    <profileTypes>
      <profileType id="pt-profile" name="Profile">
        <characteristicTypes>
          <characteristicType id="ct-mv" name="Mv"/>
          <characteristicType id="ct-ws" name="WS"/>
        </characteristicTypes>
      </profileType>
      <profileType id="pt-weapon" name="Weapon">
        <characteristicTypes>
          <characteristicType id="ct-str" name="Strength"/>
        </characteristicTypes>
      </profileType>
    </profileTypes>
  </gameSystem>`;

const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-main" name="Main Catalogue" gameSystemId="${GAME_SYSTEM_ID}">
    <forceEntries>
      <forceEntry id="${FORCE_DEF_ID}" name="Main Force"/>
    </forceEntries>
    <sharedProfiles>
      <profile id="prof-warrior" name="Warrior" typeId="pt-profile" typeName="Profile">
        <characteristics>
          <characteristic name="Mv" typeId="ct-mv">4</characteristic>
          <characteristic name="WS" typeId="ct-ws">3</characteristic>
        </characteristics>
      </profile>
      <profile id="prof-longsword" name="Longsword" typeId="pt-weapon" typeName="Weapon">
        <characteristics>
          <characteristic name="Strength" typeId="ct-str">4</characteristic>
        </characteristics>
      </profile>
    </sharedProfiles>
    <selectionEntries>
      <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit">
        <infoLinks>
          <infoLink id="il-prof" name="Warrior" targetId="prof-warrior" type="profile"/>
          <infoLink id="il-sword" name="Longsword" targetId="prof-longsword" type="profile"/>
        </infoLinks>
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="10"/></costs>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

function appSystem() {
  return {
    id: 'system-uuid',
    name: 'Test System',
    catalogues: [{ id: 'cat-main', name: 'Main Catalogue' }],
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
            number: 1,
            category: null,
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
  const path = pathBySelectionId.get('sel-warrior');
  return {
    capabilities: report.capabilities,
    pathBySelectionId,
    capability: report.capabilities.get(path),
  };
}

function renderDetails({ capabilities, pathBySelectionId, capability }) {
  const roster = appRoster();
  return render(
    <PlayUnitDetails
      selection={roster.forces[0].selections[0]}
      system={appSystem()}
      roster={roster}
      capability={capability}
      capabilities={capabilities}
      pathBySelectionId={pathBySelectionId}
      getUnitCurrentWounds={() => 1}
      handleAdjustWound={vi.fn()}
      handleMouseEnter={vi.fn()}
      handleMouseLeave={vi.fn()}
      setSaveSummaryData={vi.fn()}
      setSaveSummaryOpen={vi.fn()}
      onShowRule={vi.fn()}
    />
  );
}

const headerTexts = (container) =>
  Array.from(container.querySelectorAll('.profile-table th')).map(th => th.textContent.trim());

describe('PlayUnitDetails: Profil-Tabellen aus capability.infoElements (Issue 0121, Task 7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rendert den Statblock aus den infoElements des Berichts (Merkmals-Spalten mit Werten)', () => {
    const reportData = evaluation();
    // Guard gegen den echten Bericht: der Slot fuehrt das Statblock-Profil.
    expect(reportData.capability.infoElements).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'profile',
        name: 'Warrior',
        profileTypeName: 'Profile',
        characteristics: expect.arrayContaining([
          expect.objectContaining({ name: 'Mv', value: '4' }),
          expect.objectContaining({ name: 'WS', value: '3' }),
        ]),
      }),
    ]));

    const { container } = renderDetails(reportData);

    const headers = headerTexts(container);
    expect(headers).toContain('Mv');
    expect(headers).toContain('WS');
    const cellTexts = Array.from(container.querySelectorAll('.profile-table td')).map(td => td.textContent.trim());
    expect(cellTexts).toContain('4');
    expect(cellTexts).toContain('3');
  });

  it('gruppiert nach Profiltyp (bestehende Observable): das Waffen-Profil als eigene Tabelle mit Typ-Ueberschrift', () => {
    const reportData = evaluation();
    expect(reportData.capability.infoElements).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'profile', name: 'Longsword', profileTypeName: 'Weapon' }),
    ]));

    const { container } = renderDetails(reportData);

    expect(headerTexts(container)).toContain('Weapon');
    expect(container.textContent).toContain('Longsword');
  });

  // Der Gift-Wert kann seit dem Abriss des Solvers (Issue 0121) nicht mehr
  // injiziert werden; geprueft bleibt, was der Nutzer sieht — der Statblock
  // stammt aus den Info-Elementen des Berichts, nicht aus einer Sammlung
  // ueber den Katalog.
  it('zeigt nur die Kennwerte aus dem Bericht', () => {
    const { container } = renderDetails(evaluation());

    expect(container.textContent).not.toContain('POISON-PROFILE');
    expect(container.textContent).toContain('Longsword');
  });
});
