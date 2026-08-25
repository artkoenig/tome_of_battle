/**
 * Issue 0121, Task 7 — UnitSelectionCard:
 * - die Einheitenkosten der Karte kommen aus `capability.totalCosts` des
 *   Slots (aufgeloest ueber `pathBySelectionId`), nicht mehr aus
 *   `calculateRosterCosts` des Solvers (Kriterium „Kosten-Anzeigen"),
 * - die Profil-Sektion (Mini-Profil) kommt aus `capability.infoElements`,
 *   nicht mehr aus `collectUnitProfilesAndRules` (Kriterium „Profile/Regeln");
 *   die Gruppierung nach Profiltyp bleibt die bestehende Observable
 *   (Statblock-Tabelle mit Merkmals-Spalten; weitere Profiltypen als eigene
 *   Tabelle mit Typ-Ueberschrift).
 * (test-first; die neue Implementierung existiert noch nicht.)
 *
 * ── Falsifizierbarkeits-Entscheidung (markiert) ──────────────────────────────
 * `calculateRosterCosts` und `collectUnitProfilesAndRules` sind GIFT-Stubs
 * (999999 bzw. POISON-PROFILE): liest die Karte noch den Solver, erscheinen
 * die Giftwerte. Capabilities/Pfade kommen aus der ECHTEN Fassade; jeder Test
 * prueft seine Vorbedingung per Guard-Assert gegen den echten Bericht. Die
 * infoElements-Form wurde per Wegwerf-Skript gegen die echte Fassade
 * verifiziert (Profil mit profileTypeName + characteristics [{name, value}],
 * Regel mit text).
 *
 * Die Karte erhaelt `capabilities` und `pathBySelectionId` bereits heute als
 * Props — es gibt keine neue Prop-Vertragsentscheidung.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { UnitSelectionCardHarness as UnitSelectionCard } from '../../../../tests/test-utils/editorHarness';
import { prepareDataset, evaluate } from '../../../../domain/evaluator/evaluator.js';
import { toEvaluatorRoster } from '../../../../contexts/ruleengine/acl/rosterAdapter.js';

vi.mock('lucide-react', () => ({
  Trash2: () => <span data-testid="icon-trash" />,
  Copy: () => <span data-testid="icon-copy" />,
  AlertTriangle: () => <span data-testid="icon-alert" />,
  MoreVertical: () => <span data-testid="icon-more" />,
  ReceiptText: () => <span data-testid="icon-receipt" />,
}));

vi.mock('../../../../ui/components/editor/BottomSheet', () => ({
  default: ({ isOpen, children }) => (isOpen ? <div data-testid="sheet">{children}</div> : null),
}));

// Der Konfigurator (nur im Editier-Zustand) und die Chips sind eigene
// Baustellen mit eigenen Tests; hier zaehlt die Karte selbst.
vi.mock('../../../../ui/components/editor/SelectionConfigurator', () => ({
  default: () => <div data-testid="selection-configurator" />,
}));
vi.mock('../../../../ui/components/editor/UnitChips', () => ({
  UnitUpgradesChips: () => null,
  UnitRulesChips: () => null,
}));

// Der Solver ist mit Issue 0121 geloescht; der fruehere Gift-Stub auf seine
// Fassade hat damit keinen Gegenstand mehr — dass die Anzeige aus dem Bericht
// kommt, ist jetzt strukturell garantiert.

// ── Synthetischer Datensatz (rawXmls-Muster wie useEvaluation.test.js) ───────
//
// Warrior ×2 (10 pts je Instanz → totalCosts 20) mit einem Statblock-Profil
// (Typ „Profile": Mv 4, WS 3), einem Waffen-Profil (Typ „Weapon":
// Strength 4, per infoLink) und einer Regel „Bravery".

const GAME_SYSTEM_ID = 'gs-main';
const FORCE_DEF_ID = 'force-main';
const WARRIOR_ID = 'entry-warrior';
const COST_TYPE_ID = 'cost-pts';
const WARRIOR_POINTS = 10;

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
  <gameSystem id="${GAME_SYSTEM_ID}" name="Test System">
    <costTypes>
      <costType id="${COST_TYPE_ID}" name="pts" defaultCostLimit="-1"/>
    </costTypes>
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
    <sharedRules>
      <rule id="rule-brave" name="Bravery">
        <description>Never flees the battlefield.</description>
      </rule>
    </sharedRules>
    <selectionEntries>
      <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit">
        <infoLinks>
          <infoLink id="il-prof" name="Warrior" targetId="prof-warrior" type="profile"/>
          <infoLink id="il-sword" name="Longsword" targetId="prof-longsword" type="profile"/>
          <infoLink id="il-rule" name="Bravery" targetId="rule-brave" type="rule"/>
        </infoLinks>
        <costs>
          <cost name="pts" typeId="${COST_TYPE_ID}" value="${WARRIOR_POINTS}"/>
        </costs>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

const GAME_SYSTEM_FILE = { name: 'test.gst', content: GAME_SYSTEM_XML };
const CATALOGUE_FILE = { name: 'main.cat', content: CATALOGUE_XML };

function appSystem() {
  return {
    id: 'system-uuid',
    name: 'Test System',
    catalogues: [{ id: 'cat-main', name: 'Main Catalogue' }],
    rawXmls: { gst: [GAME_SYSTEM_FILE], cat: [CATALOGUE_FILE] },
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
  return { capabilities: report.capabilities, pathBySelectionId };
}

function renderCard({ capabilities, pathBySelectionId }) {
  const roster = appRoster();
  return render(
    <UnitSelectionCard
      selection={roster.forces[0].selections[0]}
      selectedRosterSelection={null}
      setSelectedRosterSelection={vi.fn()}
      roster={roster}
      system={appSystem()}
      violations={[]}
      capabilities={capabilities}
      pathBySelectionId={pathBySelectionId}
      costTypeLabel="Pkt"
      removeUnit={vi.fn()}
      copyUnit={vi.fn()}
      subSelectionOperations={{}}
      activeCatalogue={{ id: 'cat-main', name: 'Main Catalogue' }}
    />
  );
}

const headerTexts = (container) =>
  Array.from(container.querySelectorAll('.profile-table th')).map(th => th.textContent.trim());

describe('UnitSelectionCard: Kosten und Profil-Sektion aus dem Faehigkeitsdatensatz (Issue 0121, Task 7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('zeigt die Einheitenkosten aus capability.totalCosts (20 Pkt), nicht den Solver-Giftwert', () => {
    const { capabilities, pathBySelectionId } = evaluation();
    // Guard gegen den echten Bericht: der Slot der Auswahl traegt totalCosts 20.
    const path = pathBySelectionId.get('sel-warrior');
    expect(capabilities.get(path).totalCosts).toMatchObject({ [COST_TYPE_ID]: 2 * WARRIOR_POINTS });

    const { container } = renderCard({ capabilities, pathBySelectionId });

    const cost = container.querySelector('.selection-node-cost');
    expect(cost, 'Kostenanzeige der Karte').not.toBeNull();
    expect(cost.textContent.replace(/\s+/g, ' ').trim()).toBe('20 Pkt');
    expect(container.textContent).not.toContain('999999');
  });

  it('rendert den Statblock aus capability.infoElements: Merkmals-Spalten mit effektiven Werten', () => {
    const { capabilities, pathBySelectionId } = evaluation();
    // Guard: der Slot fuehrt das Statblock-Profil mit seinen Merkmalen.
    const path = pathBySelectionId.get('sel-warrior');
    const infoElements = capabilities.get(path).infoElements;
    expect(infoElements).toEqual(expect.arrayContaining([
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

    const { container } = renderCard({ capabilities, pathBySelectionId });

    const headers = headerTexts(container);
    expect(headers).toContain('Mv');
    expect(headers).toContain('WS');
    const cellTexts = Array.from(container.querySelectorAll('.profile-table td')).map(td => td.textContent.trim());
    expect(cellTexts).toContain('4');
    expect(cellTexts).toContain('3');
  });

  it('gruppiert nach Profiltyp (bestehende Observable): das Waffen-Profil steht als eigene Tabelle mit Typ-Ueberschrift', () => {
    const { capabilities, pathBySelectionId } = evaluation();
    // Guard: der Slot fuehrt auch das Weapon-Profil.
    const path = pathBySelectionId.get('sel-warrior');
    expect(capabilities.get(path).infoElements).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'profile', name: 'Longsword', profileTypeName: 'Weapon' }),
    ]));

    const { container } = renderCard({ capabilities, pathBySelectionId });

    expect(headerTexts(container)).toContain('Weapon');
    expect(container.textContent).toContain('Longsword');
  });

  it('zeigt das Solver-Giftprofil nicht: die Profil-Sektion haengt nicht mehr an collectUnitProfilesAndRules', () => {
    const { container } = renderCard(evaluation());

    expect(container.textContent).not.toContain('POISON-PROFILE');
    expect(container.textContent).not.toContain('999');
  });
});
