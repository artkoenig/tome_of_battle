/**
 * Issue 0121, Task 6 — OptionGroup liest den Zustand seiner Optionen aus den
 * Fähigkeitsdatensätzen des Evaluator-Berichts (ADR-0035/0036) statt aus
 * Solver-Messungen. Test-first: die neue Implementierung existiert noch nicht.
 *
 * Intention (ADR-0035): Optionen einer Gruppe — belegte Slots UND
 * Angebots-Anker — samt Zustand aus `capabilities`:
 * - eine wählbare Option mit Restspielraum (`headroom > 0`) ist erhöhbar,
 * - eine Option am Maximum (`isBlocked` / `headroom 0`) ist nicht erhöhbar,
 * - eine versteckte Option (`isHidden`) erscheint nicht,
 * - eine offene Pflicht (`isMandatoryUnmet`, Pflicht-Phantom) rendert als
 *   NICHT angehakte, NICHT gesperrte Checkbox, und ein Klick darauf oder auf
 *   die Zeile schreibt die Option in den Roster (Issue 0145, Kriterium 3) —
 *   ein Klick angehakt/gesperrt zu belassen war der Defekt, der behoben wird,
 * - eine Einzelwahl-Gruppe (Gruppen-Anker mit `effectiveMax 1`) wird als
 *   Einzelwahl (Radio) bedient — auch der Tausch bei belegter Gruppe,
 * - Options-Kosten kommen aus `capability.costs`.
 *
 * ── Prop-Vertragsentscheidung (so nah wie möglich am Bestehenden) ────────────
 * `group` bleibt die STRUKTUR der Gruppe ({ id, name, items: [{ option }] });
 * `selection`, `subSelectionOperations`, `getSubSelectionCount` usw. behalten
 * ihre Bedeutung. NEU:
 * - `capabilities`:  die Slot-Map des Berichts (Map Slot-Pfad → SlotCapability),
 * - `selectionPath`: der Slot-Pfad der Träger-Auswahl (aus `pathBySelectionId`).
 * Zustand, Name, Kosten und Gruppen-Grenze werden unter `selectionPath`
 * abgelesen (Options-Slots per defId/targetDefId, die Gruppen-Grenze am
 * Gruppen-Anker mit defId === group.id). `group` trägt bewusst KEINE
 * Constraints mehr — die Grenzen stehen im Bericht.
 *
 * ── Falsifizierbarkeits-Entscheidung (markiert) ──────────────────────────────
 * Rein über die Observablen; zusätzlich sind die bisherigen Solver-Quellen der
 * Options-Auflösung inert gestubbt (`resolveEntry`/`findEntryInSystem` → null,
 * `computeRosterCounts` → leer): Namen und Zustände KÖNNEN nur noch aus
 * `capabilities` kommen — ein Rückfall auf den Solver bleibt sichtbar (leere
 * Gruppe).
 *
 * Die erwarteten Capability-Zustände wurden per Wegwerf-Skript gegen die ECHTE
 * Fassade verifiziert (Shield max 2, belegt 2 → isBlocked; Banner max 3,
 * belegt 1 → headroom 2; Cloak hidden → isHidden; Helm min 1/max 1, fehlt →
 * mandatoryPhantom mit isMandatoryUnmet; Gruppen-Anker „Weapons" mit
 * effectiveMax 1; Sword-Angebots-Anker mit costs {pts: 7}). Jeder Test prüft
 * seine Vorbedingung zusätzlich selbst gegen den echten Bericht.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OptionGroupHarness as OptionGroupComponent } from '../../../shared/test-utils/editorHarness';
import { createSubSelectionOperationsMock } from '../../../shared/test-utils/subSelectionOperationsMock';
import { prepareDataset, evaluate } from '../../../domain/evaluator/evaluator.js';
import { toEvaluatorRoster } from '../../../domain/evaluation/rosterAdapter.js';

vi.mock('lucide-react', () => ({
  ChevronDown: () => <span data-testid="icon-chevron-down" />,
  ChevronRight: () => <span data-testid="icon-chevron-right" />,
  Plus: () => <span data-testid="icon-plus" />,
  Minus: () => <span data-testid="icon-minus" />,
  Info: ({ onClick, ...rest }) => <span data-testid="icon-info" onClick={onClick} {...rest} />,
  BookOpen: ({ onClick, ...rest }) => <span data-testid="icon-book" onClick={onClick} {...rest} />,
}));

vi.mock('../../../data/rules/rulesLookup', () => ({ getRuleUrl: () => null }));
vi.mock('../../contexts/SettingsContext', () => ({
  useSettings: () => ({ whfb6LinkingEnabled: false }),
}));
// Der Solver ist mit Issue 0121 geloescht; der fruehere Gift-Stub auf seine
// Fassade hat damit keinen Gegenstand mehr — dass die Anzeige aus dem Bericht
// kommt, ist jetzt strukturell garantiert.

// ── Synthetischer Datensatz (rawXmls-Muster wie useRoster.evaluator.test.js) ──

const GAME_SYSTEM_ID = 'gs-main';
const FORCE_DEF_ID = 'force-main';
const HERO_ID = 'entry-hero';
const SHIELD_ID = 'opt-shield';
const BANNER_ID = 'opt-banner';
const CLOAK_ID = 'opt-cloak';
const HELM_ID = 'opt-helm';
const SWORD_ID = 'opt-sword';
const AXE_ID = 'opt-axe';
const WEAPONS_GROUP_ID = 'grp-weapons';
const COST_TYPE_ID = 'cost-pts';
const HERO_PATH = '0/0';

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
        <selectionEntries>
          <selectionEntry id="${SHIELD_ID}" name="Shield" type="upgrade">
            <constraints>
              <constraint type="max" value="2" field="selections" scope="parent" shared="true" id="limit-shield-max" includeChildSelections="false"/>
            </constraints>
            <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="3"/></costs>
          </selectionEntry>
          <selectionEntry id="${BANNER_ID}" name="Banner" type="upgrade">
            <constraints>
              <constraint type="max" value="3" field="selections" scope="parent" shared="true" id="limit-banner-max" includeChildSelections="false"/>
            </constraints>
            <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="10"/></costs>
          </selectionEntry>
          <selectionEntry id="${CLOAK_ID}" name="Cloak" type="upgrade" hidden="true">
            <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="5"/></costs>
          </selectionEntry>
          <selectionEntry id="${HELM_ID}" name="Helm" type="upgrade">
            <constraints>
              <constraint type="min" value="1" field="selections" scope="parent" shared="true" id="limit-helm-min" includeChildSelections="false"/>
              <constraint type="max" value="1" field="selections" scope="parent" shared="true" id="limit-helm-max" includeChildSelections="false"/>
            </constraints>
            <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="2"/></costs>
          </selectionEntry>
        </selectionEntries>
        <selectionEntryGroups>
          <selectionEntryGroup id="${WEAPONS_GROUP_ID}" name="Weapons">
            <constraints>
              <constraint type="max" value="1" field="selections" scope="parent" shared="true" id="limit-weapons-max" includeChildSelections="false"/>
            </constraints>
            <selectionEntries>
              <selectionEntry id="${SWORD_ID}" name="Sword" type="upgrade">
                <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="7"/></costs>
              </selectionEntry>
              <selectionEntry id="${AXE_ID}" name="Axe" type="upgrade">
                <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="5"/></costs>
              </selectionEntry>
            </selectionEntries>
          </selectionEntryGroup>
        </selectionEntryGroups>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

/** App-System-Objekt mit den rohen XMLs (Shape aus `src/data/db/systemImport.js`). */
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

/**
 * App-Roster: Hero mit Shield ×2 (Max erreicht) und Banner ×1 (Spielraum 2);
 * Helm (Pflicht) fehlt, die Weapons-Gruppe ist leer.
 */
function appRoster(heroSubSelections) {
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
            id: 'sel-hero',
            name: 'Hero',
            entryLinkId: null,
            selectionEntryId: HERO_ID,
            number: 1,
            category: null,
            selections: heroSubSelections,
          },
        ],
      },
    ],
  };
}

const GEAR_SUBSELECTIONS = [
  { id: 'sel-shield', name: 'Shield', entryLinkId: null, selectionEntryId: SHIELD_ID, number: 2, selections: [] },
  { id: 'sel-banner', name: 'Banner', entryLinkId: null, selectionEntryId: BANNER_ID, number: 1, selections: [] },
];

const AXE_SUBSELECTIONS = [
  { id: 'sel-axe', name: 'Axe', entryLinkId: null, selectionEntryId: AXE_ID, number: 1, selections: [] },
];

/** Auswertung über die ECHTE Fassade — die einzige Quelle der Erwartungen. */
function evaluation(roster) {
  const prepared = prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [CATALOGUE_XML] });
  const { evalRoster, pathBySelectionId } = toEvaluatorRoster(roster);
  const report = evaluate(prepared, evalRoster);
  return { capabilities: report.capabilities, pathBySelectionId };
}

/** Capability eines Slots unterhalb des Hero-Pfads per Definitions-Id. */
function capabilityOf(capabilities, defId) {
  for (const [path, capability] of capabilities) {
    if (path.startsWith(`${HERO_PATH}/`) && capability.defId === defId) return capability;
  }
  return undefined;
}

/** True, wenn das Operations-Argument die Options-Definition identifiziert. */
function identifiesOption(arg, defId) {
  return arg === defId || arg?.id === defId || arg?.defId === defId;
}

// Zählung über das App-Roster (bestehender Prop-Vertrag von OptionGroup).
const getSubSelectionCount = (unitSelection, optionEntryId) => {
  const count = (list) => (list ?? []).reduce(
    (sum, sub) =>
      sum
      + (((sub.entryLinkId || sub.selectionEntryId) === optionEntryId) ? (sub.number || 1) : 0)
      + count(sub.selections),
    0,
  );
  return count(unitSelection.selections);
};

// Gruppen-STRUKTUR (Mitgliedschaft) — Grenzen bewusst nicht hier, sondern im Bericht.
const WEAPONS_GROUP = {
  id: WEAPONS_GROUP_ID,
  name: 'Weapons',
  constraints: [],
  items: [{ option: { id: SWORD_ID } }, { option: { id: AXE_ID } }],
};
const GEAR_GROUP = {
  id: 'grp-gear-ui',
  name: 'Gear',
  constraints: [],
  items: [
    { option: { id: SHIELD_ID } },
    { option: { id: BANNER_ID } },
    { option: { id: CLOAK_ID } },
    { option: { id: HELM_ID } },
  ],
};

function renderGroup({ group, roster, operations }) {
  const { capabilities } = evaluation(roster);
  const selection = roster.forces[0].selections[0];
  render(
    <OptionGroupComponent
      group={group}
      selection={selection}
      selectionPath={HERO_PATH}
      capabilities={capabilities}
      system={appSystem()}
      roster={roster}
      getSubSelectionCount={getSubSelectionCount}
      subSelectionOperations={operations}
      getOptionDescription={() => ''}
      activeCatalogue={{ id: 'cat-main' }}
      setActiveInfo={vi.fn()}
      onHoverEnter={vi.fn()}
      onHoverMove={vi.fn()}
      onHoverLeave={vi.fn()}
      onShowRule={vi.fn()}
    />
  );
  return { capabilities, selection };
}

/**
 * Stellt sicher, dass die Optionen der Gruppe sichtbar sind: klappt die Gruppe
 * per Kopfzeile auf, falls die erwartete Option noch nicht im DOM steht (ob
 * eine Gruppe mit Bestand automatisch aufklappt, bleibt Verhalten der
 * Komponente — beide Wege sind zulässig).
 */
function ensureExpanded(groupName, expectedOptionName) {
  if (screen.queryByText(expectedOptionName) === null) {
    fireEvent.click(screen.getByText(groupName));
  }
}

describe('OptionGroup: Options-Zustand aus dem Fähigkeitsdatensatz (Issue 0121, Task 6, ADR-0035)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('eine wählbare Option mit Restspielraum (Banner, headroom 2) ist erhöhbar', () => {
    const roster = appRoster(GEAR_SUBSELECTIONS);
    const operations = createSubSelectionOperationsMock();
    const { capabilities, selection } = renderGroup({ group: GEAR_GROUP, roster, operations });
    expect(capabilityOf(capabilities, BANNER_ID)).toMatchObject({ anchorKind: 'occupied', headroom: 2, isBlocked: false });

    ensureExpanded('Gear', 'Banner');
    const bannerRow = screen.getByText('Banner').closest('.sub-selection-row');
    const plusButton = bannerRow.querySelector('.quantity-control button:last-child');
    expect(plusButton, 'Banner (max 3) wird als Mengen-Stepper bedient').not.toBeNull();
    expect(plusButton.disabled).toBe(false);

    fireEvent.click(plusButton);
    expect(operations.increaseCount).toHaveBeenCalledTimes(1);
    expect(operations.increaseCount.mock.calls[0][0]).toBe(selection.id);
    expect(identifiesOption(operations.increaseCount.mock.calls[0][1], BANNER_ID)).toBe(true);
  });

  it('eine Option am Maximum (Shield, headroom 0 / isBlocked) ist nicht erhöhbar', () => {
    const roster = appRoster(GEAR_SUBSELECTIONS);
    const operations = createSubSelectionOperationsMock();
    const { capabilities } = renderGroup({ group: GEAR_GROUP, roster, operations });
    expect(capabilityOf(capabilities, SHIELD_ID)).toMatchObject({ anchorKind: 'occupied', headroom: 0, isBlocked: true });

    ensureExpanded('Gear', 'Shield');
    const shieldRow = screen.getByText('Shield').closest('.sub-selection-row');
    const plusButton = shieldRow.querySelector('.quantity-control button:last-child');
    expect(plusButton, 'Shield (max 2) wird als Mengen-Stepper bedient').not.toBeNull();
    expect(plusButton.disabled).toBe(true);

    fireEvent.click(plusButton);
    fireEvent.click(shieldRow);
    const increaseCalls = operations.increaseCount.mock.calls;
    expect(increaseCalls.some(call => identifiesOption(call[1], SHIELD_ID))).toBe(false);
  });

  it('eine versteckte Option (Cloak, isHidden) erscheint gar nicht — sichtbare Nachbarn schon', () => {
    const roster = appRoster(GEAR_SUBSELECTIONS);
    const { capabilities } = renderGroup({ group: GEAR_GROUP, roster, operations: createSubSelectionOperationsMock() });
    expect(capabilityOf(capabilities, CLOAK_ID)).toMatchObject({ anchorKind: 'offerAnchor', isHidden: true });

    ensureExpanded('Gear', 'Banner');
    expect(screen.getByText('Banner')).toBeTruthy();
    expect(screen.queryByText('Cloak')).toBeNull();
  });

  it('eine offene Pflicht (Helm, isMandatoryUnmet am Pflicht-Phantom) rendert nicht angehakt und schreibt beim Klick (Issue 0145, Kriterium 3)', () => {
    const roster = appRoster(GEAR_SUBSELECTIONS);
    const operations = createSubSelectionOperationsMock();
    const { capabilities, selection } = renderGroup({ group: GEAR_GROUP, roster, operations });
    expect(capabilityOf(capabilities, HELM_ID)).toMatchObject({ anchorKind: 'mandatoryPhantom', isMandatoryUnmet: true, effectiveMin: 1 });

    ensureExpanded('Gear', 'Helm');
    const helmRow = screen.getByText('Helm').closest('.sub-selection-row');
    const checkbox = helmRow.querySelector('input[type="checkbox"]');
    expect(checkbox, 'Pflicht-Option rendert als Checkbox').not.toBeNull();
    expect(checkbox.checked).toBe(false);
    expect(checkbox.disabled).toBe(false);

    fireEvent.click(checkbox);
    expect(operations.increaseCount.mock.calls.some(
      call => call[0] === selection.id && identifiesOption(call[1], HELM_ID),
    )).toBe(true);
    expect(operations.decreaseCount).not.toHaveBeenCalled();

    operations.increaseCount.mockClear();
    fireEvent.click(helmRow);
    expect(operations.increaseCount.mock.calls.some(
      call => call[0] === selection.id && identifiesOption(call[1], HELM_ID),
    )).toBe(true);
    expect(operations.decreaseCount).not.toHaveBeenCalled();
  });

  it('Options-Kosten kommen aus capability.costs (+7 für Sword)', () => {
    const roster = appRoster(GEAR_SUBSELECTIONS);
    const { capabilities } = renderGroup({ group: WEAPONS_GROUP, roster, operations: createSubSelectionOperationsMock() });
    expect(capabilityOf(capabilities, SWORD_ID).costs).toEqual({ [COST_TYPE_ID]: 7 });

    ensureExpanded('Weapons', 'Sword');
    const swordRow = screen.getByText('Sword').closest('.sub-selection-row');
    expect(swordRow.textContent).toMatch(/\+\s?7/);
  });

  it('eine Einzelwahl-Gruppe (Gruppen-Anker effectiveMax 1) wird als Einzelwahl (Radio) bedient', () => {
    const roster = appRoster(GEAR_SUBSELECTIONS);
    const operations = createSubSelectionOperationsMock();
    const { capabilities, selection } = renderGroup({ group: WEAPONS_GROUP, roster, operations });
    expect(capabilityOf(capabilities, WEAPONS_GROUP_ID)).toMatchObject({ anchorKind: 'groupAnchor', effectiveMax: 1 });

    ensureExpanded('Weapons', 'Sword');
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);

    const swordRadio = screen.getByText('Sword').closest('.sub-selection-row').querySelector('input[type="radio"]');
    fireEvent.click(swordRadio);
    expect(operations.increaseCount).toHaveBeenCalledTimes(1);
    expect(operations.increaseCount.mock.calls[0][0]).toBe(selection.id);
    expect(identifiesOption(operations.increaseCount.mock.calls[0][1], SWORD_ID)).toBe(true);
  });

  it('Einzelwahl-Tausch: bei belegter Gruppe (Axe gewählt) wählt der Sword-Radio um statt zu blockieren', () => {
    const roster = appRoster(AXE_SUBSELECTIONS);
    const operations = createSubSelectionOperationsMock();
    const { capabilities, selection } = renderGroup({ group: WEAPONS_GROUP, roster, operations });
    // Guard: die Gruppe ist ausgeschöpft (current 1 von max 1) — Tausch, kein Hinzufügen.
    expect(capabilityOf(capabilities, WEAPONS_GROUP_ID)).toMatchObject({ anchorKind: 'groupAnchor', effectiveMax: 1, current: 1 });
    expect(capabilityOf(capabilities, AXE_ID)).toMatchObject({ anchorKind: 'occupied' });

    ensureExpanded('Weapons', 'Sword');
    const swordRadio = screen.getByText('Sword').closest('.sub-selection-row').querySelector('input[type="radio"]');
    fireEvent.click(swordRadio);

    expect(operations.increaseCount.mock.calls.some(
      call => call[0] === selection.id && identifiesOption(call[1], SWORD_ID),
    )).toBe(true);
    expect(operations.decreaseCount.mock.calls.some(
      call => call[0] === selection.id && identifiesOption(call[1], AXE_ID),
    )).toBe(true);
  });
});
