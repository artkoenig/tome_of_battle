/**
 * Issue 0145, increment 2 — "An unmet obligation renders as outstanding on
 * every render path". A row whose slot carries `isMandatoryUnmet: true`
 * stops rendering as taken (checked/disabled) and a click on it or on its row
 * writes the option into the roster (criterion 3); a met mandatory row still
 * renders taken and still cannot be removed (criterion 4); the three render
 * paths — group checkbox, group radio, standalone (quantity stepper included)
 * — agree with each other and with the section header above them
 * (criteria 5 and 6).
 *
 * Fahren wird durch die Produktionsnaht (`processImportedData` liefert das
 * System-Objekt mit den geparsten `catalogues` — `getUnitOptions` liest
 * `system.catalogues`, ohne sie legt jede Zeile standalone an und die
 * Gruppen-Zweige blieben ungeprüft) und ein **handgebautes** App-Roster,
 * damit eine Pflicht gezielt offen bleiben kann. `getUnitOptions` wird —
 * anders als in der Evaluator-Schwesterdatei — NICHT gestubbt, damit die
 * Gruppen aus der echten Katalog-Struktur entstehen.
 *
 * Sechs Ausprägungen unter einer Einheit (Held):
 * - `min 1`/`max 1` außerhalb jeder Gruppe, fehlt im Roster → Standalone,
 *   offen;
 * - dieselbe Form in einer Gruppe ohne eigenes Max → Gruppen-Checkbox, offen;
 * - dieselbe Form in einer Gruppe mit `max 1` → Gruppen-Radio, offen (diese
 *   Form kommt in den Fixture-Katalogen nicht vor — sie existiert nur hier);
 * - je ein erfüllter Zwilling der drei obigen Formen;
 * - eine Gruppe, deren eigener Anker ein unerfülltes Minimum trägt und eine
 *   offene Pflicht-Zeile hält (Kriterium 6);
 * - ein `min 2`/`max 2` Mengensteller, fehlt im Roster, in einer Gruppe →
 *   Gruppen-Mengensteller, offen, und sein erfüllter Zwilling bei Menge 2.
 *
 * Jeder Fall prüft seine eigene Vorbedingung zuerst gegen den echten Bericht.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SelectionConfiguratorHarness as SelectionConfigurator } from '../../test-utils/editorHarness';
import { createSubSelectionOperationsMock } from '../../test-utils/subSelectionOperationsMock';
import { prepareDataset, evaluate } from '../../evaluator/evaluator.js';
import { toEvaluatorRoster } from '../../evaluation/rosterAdapter.js';
import { processImportedData } from '../../parser/xmlParser.js';

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

// ── Synthetischer Datensatz ────────────────────────────────────────────────

const GAME_SYSTEM_ID = 'gs-main';
const FORCE_DEF_ID = 'force-main';
const HERO_ID = 'entry-hero';
const COST_TYPE_ID = 'cost-pts';
const HERO_PATH = '0/0';

const STANDALONE_UNMET_ID = 'opt-standalone-unmet';
const STANDALONE_MET_ID = 'opt-standalone-met';

const GROUP_CHECKBOX_ID = 'grp-checkbox';
const GC_UNMET_ID = 'opt-gc-unmet';
const GC_MET_ID = 'opt-gc-met';

const GROUP_RADIO_UNMET_ID = 'grp-radio-unmet';
const RADIO_UNMET_ID = 'opt-radio-unmet';
const GROUP_RADIO_MET_ID = 'grp-radio-met';
const RADIO_MET_ID = 'opt-radio-met';

const STEPPER_GROUP_ID = 'grp-stepper';
const STEPPER_UNMET_ID = 'opt-stepper-unmet';
const STEPPER_MET_ID = 'opt-stepper-met';

const ERR_GROUP_ID = 'grp-err';
const ERR_MANDATORY_ID = 'opt-err-mandatory';

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
          <selectionEntry id="${STANDALONE_UNMET_ID}" name="StandaloneUnmet" type="upgrade">
            <constraints>
              <constraint type="min" value="1" field="selections" scope="parent" shared="true" id="c-standalone-unmet-min" includeChildSelections="false"/>
              <constraint type="max" value="1" field="selections" scope="parent" shared="true" id="c-standalone-unmet-max" includeChildSelections="false"/>
            </constraints>
            <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="1"/></costs>
          </selectionEntry>
          <selectionEntry id="${STANDALONE_MET_ID}" name="StandaloneMet" type="upgrade">
            <constraints>
              <constraint type="min" value="1" field="selections" scope="parent" shared="true" id="c-standalone-met-min" includeChildSelections="false"/>
              <constraint type="max" value="1" field="selections" scope="parent" shared="true" id="c-standalone-met-max" includeChildSelections="false"/>
            </constraints>
            <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="1"/></costs>
          </selectionEntry>
        </selectionEntries>
        <selectionEntryGroups>
          <selectionEntryGroup id="${GROUP_CHECKBOX_ID}" name="GroupCheckbox">
            <selectionEntries>
              <selectionEntry id="${GC_UNMET_ID}" name="GcUnmet" type="upgrade">
                <constraints>
                  <constraint type="min" value="1" field="selections" scope="parent" shared="true" id="c-gc-unmet-min" includeChildSelections="false"/>
                  <constraint type="max" value="1" field="selections" scope="parent" shared="true" id="c-gc-unmet-max" includeChildSelections="false"/>
                </constraints>
                <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="1"/></costs>
              </selectionEntry>
              <selectionEntry id="${GC_MET_ID}" name="GcMet" type="upgrade">
                <constraints>
                  <constraint type="min" value="1" field="selections" scope="parent" shared="true" id="c-gc-met-min" includeChildSelections="false"/>
                  <constraint type="max" value="1" field="selections" scope="parent" shared="true" id="c-gc-met-max" includeChildSelections="false"/>
                </constraints>
                <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="1"/></costs>
              </selectionEntry>
            </selectionEntries>
          </selectionEntryGroup>
          <selectionEntryGroup id="${GROUP_RADIO_UNMET_ID}" name="GroupRadioUnmet">
            <constraints>
              <constraint type="max" value="1" field="selections" scope="parent" shared="true" id="c-radio-unmet-group-max" includeChildSelections="false"/>
            </constraints>
            <selectionEntries>
              <selectionEntry id="${RADIO_UNMET_ID}" name="RadioUnmet" type="upgrade">
                <constraints>
                  <constraint type="min" value="1" field="selections" scope="parent" shared="true" id="c-radio-unmet-min" includeChildSelections="false"/>
                  <constraint type="max" value="1" field="selections" scope="parent" shared="true" id="c-radio-unmet-max" includeChildSelections="false"/>
                </constraints>
                <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="1"/></costs>
              </selectionEntry>
            </selectionEntries>
          </selectionEntryGroup>
          <selectionEntryGroup id="${GROUP_RADIO_MET_ID}" name="GroupRadioMet">
            <constraints>
              <constraint type="max" value="1" field="selections" scope="parent" shared="true" id="c-radio-met-group-max" includeChildSelections="false"/>
            </constraints>
            <selectionEntries>
              <selectionEntry id="${RADIO_MET_ID}" name="RadioMet" type="upgrade">
                <constraints>
                  <constraint type="min" value="1" field="selections" scope="parent" shared="true" id="c-radio-met-min" includeChildSelections="false"/>
                  <constraint type="max" value="1" field="selections" scope="parent" shared="true" id="c-radio-met-max" includeChildSelections="false"/>
                </constraints>
                <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="1"/></costs>
              </selectionEntry>
            </selectionEntries>
          </selectionEntryGroup>
          <selectionEntryGroup id="${STEPPER_GROUP_ID}" name="StepperGroup">
            <selectionEntries>
              <selectionEntry id="${STEPPER_UNMET_ID}" name="StepperUnmet" type="upgrade">
                <constraints>
                  <constraint type="min" value="2" field="selections" scope="parent" shared="true" id="c-stepper-unmet-min" includeChildSelections="false"/>
                  <constraint type="max" value="2" field="selections" scope="parent" shared="true" id="c-stepper-unmet-max" includeChildSelections="false"/>
                </constraints>
                <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="1"/></costs>
              </selectionEntry>
              <selectionEntry id="${STEPPER_MET_ID}" name="StepperMet" type="upgrade">
                <constraints>
                  <constraint type="min" value="2" field="selections" scope="parent" shared="true" id="c-stepper-met-min" includeChildSelections="false"/>
                  <constraint type="max" value="2" field="selections" scope="parent" shared="true" id="c-stepper-met-max" includeChildSelections="false"/>
                </constraints>
                <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="1"/></costs>
              </selectionEntry>
            </selectionEntries>
          </selectionEntryGroup>
          <selectionEntryGroup id="${ERR_GROUP_ID}" name="ErrGroup">
            <constraints>
              <constraint type="min" value="2" field="selections" scope="parent" shared="true" id="c-err-group-min" includeChildSelections="false"/>
              <constraint type="max" value="5" field="selections" scope="parent" shared="true" id="c-err-group-max" includeChildSelections="false"/>
            </constraints>
            <selectionEntries>
              <selectionEntry id="${ERR_MANDATORY_ID}" name="ErrMandatory" type="upgrade">
                <constraints>
                  <constraint type="min" value="1" field="selections" scope="parent" shared="true" id="c-err-mandatory-min" includeChildSelections="false"/>
                  <constraint type="max" value="1" field="selections" scope="parent" shared="true" id="c-err-mandatory-max" includeChildSelections="false"/>
                </constraints>
                <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="1"/></costs>
              </selectionEntry>
            </selectionEntries>
          </selectionEntryGroup>
        </selectionEntryGroups>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

/**
 * App-System-Objekt mit den geparsten `catalogues` (Shape aus
 * `processImportedData`), memoisiert — `getUnitOptions` liest
 * `system.catalogues`; ohne sie legt der Konfigurator jede Zeile standalone
 * an und die Gruppen-Zweige (Checkbox/Radio) blieben ungeprüft.
 */
let cachedAppSystem;
function appSystem() {
  if (!cachedAppSystem) {
    cachedAppSystem = processImportedData(
      [{ name: 'test.gst', content: GAME_SYSTEM_XML }],
      [{ name: 'main.cat', content: CATALOGUE_XML }],
    ).system;
  }
  return cachedAppSystem;
}

/**
 * App-Roster: die "met"-Zwillinge (StandaloneMet, GcMet, RadioMet, StepperMet
 * ×2) sind im Roster vorhanden; die "unmet"-Formen (StandaloneUnmet, GcUnmet,
 * RadioUnmet, StepperUnmet, ErrMandatory) fehlen — ihre Pflicht bleibt offen.
 */
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
            id: 'sel-hero',
            name: 'Hero',
            entryLinkId: null,
            selectionEntryId: HERO_ID,
            number: 1,
            category: null,
            selections: [
              { id: 'sel-standalone-met', name: 'StandaloneMet', entryLinkId: null, selectionEntryId: STANDALONE_MET_ID, number: 1, selections: [] },
              { id: 'sel-gc-met', name: 'GcMet', entryLinkId: null, selectionEntryId: GC_MET_ID, number: 1, selections: [] },
              { id: 'sel-radio-met', name: 'RadioMet', entryLinkId: null, selectionEntryId: RADIO_MET_ID, number: 1, selections: [] },
              { id: 'sel-stepper-met', name: 'StepperMet', entryLinkId: null, selectionEntryId: STEPPER_MET_ID, number: 2, selections: [] },
            ],
          },
        ],
      },
    ],
  };
}

/** Auswertung über die ECHTE Fassade — die einzige Quelle der Erwartungen. */
function evaluation(roster) {
  const prepared = prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [CATALOGUE_XML] });
  const { evalRoster, pathBySelectionId } = toEvaluatorRoster(roster);
  const report = evaluate(prepared, evalRoster);
  return { capabilities: report.capabilities, pathBySelectionId };
}

/** Capability unterhalb des Hero-Pfads per Definitions-Id. */
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

let sharedRoster;

function renderConfigurator(operations) {
  const roster = sharedRoster;
  const { capabilities, pathBySelectionId } = evaluation(roster);
  const selection = roster.forces[0].selections[0];
  render(
    <SelectionConfigurator
      selection={selection}
      capabilities={capabilities}
      pathBySelectionId={pathBySelectionId}
      system={appSystem()}
      roster={roster}
      subSelectionOperations={operations}
      activeCatalogue={{ id: 'cat-main' }}
      handleMouseEnter={vi.fn()}
      handleMouseMove={vi.fn()}
      handleMouseLeave={vi.fn()}
      setActiveInfo={vi.fn()}
      onShowRule={vi.fn()}
    />
  );
  return { capabilities, pathBySelectionId, selection };
}

/** Klappt die benannte Gruppe auf, falls die erwartete Option noch fehlt. */
function ensureExpanded(groupName, expectedOptionName) {
  if (screen.queryByText(expectedOptionName) === null) {
    fireEvent.click(screen.getByText(groupName));
  }
}

/** Die Zeile einer benannten Option. */
function rowOf(name, groupName) {
  if (groupName) ensureExpanded(groupName, name);
  return screen.getByText(name).closest('.sub-selection-row');
}

// ── DOM-Hilfen für den Abschnitts-Kopf (Muster aus `groupMembership.fixtureSweep`) ──

const ownHeader = (section) => {
  const header = section.querySelector('.option-group-header');
  return header && header.closest('.option-group') === section ? header : null;
};
const sectionsOf = (root) => [...root.querySelectorAll('.option-group')];
function sectionByLabel(root, name) {
  return sectionsOf(root).find(s => {
    const header = ownHeader(s);
    if (!header) return false;
    const title = header.querySelector('.text-ui-title') || header;
    return (title.textContent || '').trim().startsWith(name);
  }) ?? null;
}

describe('SelectionConfigurator: eine offene Pflicht rendert nicht angehakt und schreibt beim Klick (Issue 0145, Kriterien 3-6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sharedRoster = appRoster();
  });

  // ── Gruppen-Checkbox ────────────────────────────────────────────────────

  it('Gruppen-Checkbox, offen: nicht angehakt, nicht gesperrt, Klick auf Schalter und Zeile schreiben je increaseCount', () => {
    const operations = createSubSelectionOperationsMock();
    const { capabilities, selection } = renderConfigurator(operations);
    expect(capabilityOf(capabilities, GC_UNMET_ID)).toMatchObject({ isMandatoryUnmet: true, isBlocked: false });

    const row = rowOf('GcUnmet', 'GroupCheckbox');
    const checkbox = row.querySelector('input[type="checkbox"]');
    expect(checkbox, 'Pflicht-Option rendert als Checkbox').not.toBeNull();
    expect(checkbox.checked).toBe(false);
    expect(checkbox.disabled).toBe(false);

    fireEvent.click(checkbox);
    expect(operations.increaseCount.mock.calls.some(
      call => call[0] === selection.id && identifiesOption(call[1], GC_UNMET_ID),
    )).toBe(true);
    expect(operations.decreaseCount).not.toHaveBeenCalled();

    operations.increaseCount.mockClear();
    fireEvent.click(row);
    expect(operations.increaseCount.mock.calls.some(
      call => call[0] === selection.id && identifiesOption(call[1], GC_UNMET_ID),
    )).toBe(true);
    expect(operations.decreaseCount).not.toHaveBeenCalled();
  });

  it('Gruppen-Checkbox, erfüllt: angehakt, gesperrt, kein Klick entfernt sie', () => {
    const operations = createSubSelectionOperationsMock();
    const { capabilities, selection } = renderConfigurator(operations);
    expect(capabilityOf(capabilities, GC_MET_ID)).toMatchObject({ isMandatoryUnmet: false });

    const row = rowOf('GcMet', 'GroupCheckbox');
    const checkbox = row.querySelector('input[type="checkbox"]');
    expect(checkbox.checked).toBe(true);
    expect(checkbox.disabled).toBe(true);

    fireEvent.click(checkbox);
    fireEvent.click(row);
    expect(operations.decreaseCount).not.toHaveBeenCalled();
    expect(operations.increaseCount.mock.calls.some(
      call => identifiesOption(call[1], GC_MET_ID),
    )).toBe(false);
  });

  // ── Gruppen-Radio ───────────────────────────────────────────────────────

  it('Gruppen-Radio, offen: nicht angehakt, nicht gesperrt, Klick auf Schalter und Zeile schreiben je increaseCount', () => {
    const operations = createSubSelectionOperationsMock();
    const { capabilities, selection } = renderConfigurator(operations);
    expect(capabilityOf(capabilities, RADIO_UNMET_ID)).toMatchObject({ isMandatoryUnmet: true, isBlocked: false });
    expect(capabilityOf(capabilities, GROUP_RADIO_UNMET_ID)).toMatchObject({ anchorKind: 'groupAnchor', effectiveMax: 1 });

    const row = rowOf('RadioUnmet', 'GroupRadioUnmet');
    const radio = row.querySelector('input[type="radio"]');
    expect(radio, 'Pflicht-Option in Einzelwahl-Gruppe rendert als Radio').not.toBeNull();
    expect(radio.checked).toBe(false);
    expect(radio.disabled).toBe(false);

    fireEvent.click(radio);
    expect(operations.increaseCount.mock.calls.some(
      call => call[0] === selection.id && identifiesOption(call[1], RADIO_UNMET_ID),
    )).toBe(true);
    expect(operations.decreaseCount).not.toHaveBeenCalled();

    operations.increaseCount.mockClear();
    fireEvent.click(row);
    expect(operations.increaseCount.mock.calls.some(
      call => call[0] === selection.id && identifiesOption(call[1], RADIO_UNMET_ID),
    )).toBe(true);
    expect(operations.decreaseCount).not.toHaveBeenCalled();
  });

  it('Gruppen-Radio, erfüllt: angehakt, gesperrt, kein Klick entfernt sie', () => {
    const operations = createSubSelectionOperationsMock();
    const { capabilities } = renderConfigurator(operations);
    expect(capabilityOf(capabilities, RADIO_MET_ID)).toMatchObject({ isMandatoryUnmet: false });

    const row = rowOf('RadioMet', 'GroupRadioMet');
    const radio = row.querySelector('input[type="radio"]');
    expect(radio.checked).toBe(true);
    expect(radio.disabled).toBe(true);

    fireEvent.click(radio);
    fireEvent.click(row);
    expect(operations.decreaseCount).not.toHaveBeenCalled();
    expect(operations.increaseCount.mock.calls.some(
      call => identifiesOption(call[1], RADIO_MET_ID),
    )).toBe(false);
  });

  // ── Standalone (außerhalb jeder Gruppe) ────────────────────────────────

  it('Standalone, offen: nicht angehakt, nicht gesperrt, Klick auf Schalter und Zeile schreiben je increaseCount', () => {
    const operations = createSubSelectionOperationsMock();
    const { capabilities, selection } = renderConfigurator(operations);
    expect(capabilityOf(capabilities, STANDALONE_UNMET_ID)).toMatchObject({ isMandatoryUnmet: true, isBlocked: false });

    const row = rowOf('StandaloneUnmet');
    const checkbox = row.querySelector('input[type="checkbox"]');
    expect(checkbox, 'Standalone-Pflicht rendert als Checkbox').not.toBeNull();
    expect(checkbox.checked).toBe(false);
    expect(checkbox.disabled).toBe(false);

    fireEvent.click(checkbox);
    expect(operations.increaseCount.mock.calls.some(
      call => call[0] === selection.id && identifiesOption(call[1], STANDALONE_UNMET_ID),
    )).toBe(true);
    expect(operations.decreaseCount).not.toHaveBeenCalled();

    operations.increaseCount.mockClear();
    fireEvent.click(row);
    expect(operations.increaseCount.mock.calls.some(
      call => call[0] === selection.id && identifiesOption(call[1], STANDALONE_UNMET_ID),
    )).toBe(true);
    expect(operations.decreaseCount).not.toHaveBeenCalled();
  });

  it('Standalone, erfüllt: angehakt, gesperrt, kein Klick entfernt sie', () => {
    const operations = createSubSelectionOperationsMock();
    const { capabilities } = renderConfigurator(operations);
    expect(capabilityOf(capabilities, STANDALONE_MET_ID)).toMatchObject({ isMandatoryUnmet: false });

    const row = rowOf('StandaloneMet');
    const checkbox = row.querySelector('input[type="checkbox"]');
    expect(checkbox.checked).toBe(true);
    expect(checkbox.disabled).toBe(true);

    fireEvent.click(checkbox);
    fireEvent.click(row);
    expect(operations.decreaseCount).not.toHaveBeenCalled();
    expect(operations.increaseCount.mock.calls.some(
      call => identifiesOption(call[1], STANDALONE_MET_ID),
    )).toBe(false);
  });

  // ── Mengensteller (Gruppen-Kontext) ─────────────────────────────────────

  it('Mengensteller, offen (Menge 0): "+" aktiv, Klick auf "+" und auf die Zeile schreiben je increaseCount', () => {
    const operations = createSubSelectionOperationsMock();
    const { capabilities, selection } = renderConfigurator(operations);
    expect(capabilityOf(capabilities, STEPPER_UNMET_ID)).toMatchObject({ isMandatoryUnmet: true, current: 0 });

    const row = rowOf('StepperUnmet', 'StepperGroup');
    const plusButton = row.querySelector('.quantity-control button:last-child');
    expect(plusButton, 'Mengensteller (min 2 / max 2) wird als Mengensteller bedient').not.toBeNull();
    expect(plusButton.disabled).toBe(false);

    fireEvent.click(plusButton);
    expect(operations.increaseCount.mock.calls.some(
      call => call[0] === selection.id && identifiesOption(call[1], STEPPER_UNMET_ID),
    )).toBe(true);

    operations.increaseCount.mockClear();
    fireEvent.click(row);
    expect(operations.increaseCount.mock.calls.some(
      call => call[0] === selection.id && identifiesOption(call[1], STEPPER_UNMET_ID),
    )).toBe(true);
  });

  it('Mengensteller, erfüllt (Menge 2): "-" gesperrt, ein Klick darauf schreibt nichts', () => {
    const operations = createSubSelectionOperationsMock();
    const { capabilities } = renderConfigurator(operations);
    expect(capabilityOf(capabilities, STEPPER_MET_ID)).toMatchObject({ isMandatoryUnmet: false, current: 2 });

    const row = rowOf('StepperMet', 'StepperGroup');
    const minusButton = row.querySelector('.quantity-control button:first-child');
    expect(minusButton, 'Mengensteller (min 2 / max 2) wird als Mengensteller bedient').not.toBeNull();
    expect(minusButton.disabled).toBe(true);

    fireEvent.click(minusButton);
    expect(operations.decreaseCount.mock.calls.some(
      call => identifiesOption(call[1], STEPPER_MET_ID),
    )).toBe(false);
  });

  // ── Kriterium 6: Gruppen-Fehler-Kopfzeile widerspricht keiner Zeile ─────

  it('Kriterium 6: unerfülltes Gruppen-Minimum trägt die Fehler-Auszeichnung, und keine Zeile im Abschnitt ist angehakt', () => {
    const operations = createSubSelectionOperationsMock();
    const { capabilities } = renderConfigurator(operations);
    expect(capabilityOf(capabilities, ERR_GROUP_ID)).toMatchObject({ anchorKind: 'groupAnchor', effectiveMin: 2 });
    expect(capabilityOf(capabilities, ERR_MANDATORY_ID)).toMatchObject({ isMandatoryUnmet: true });

    ensureExpanded('ErrGroup', 'ErrMandatory');
    const section = sectionByLabel(document.body, 'ErrGroup');
    expect(section, 'Abschnitt "ErrGroup" steht auf der Karte').toBeTruthy();
    const header = ownHeader(section);
    expect(header.className).toContain('option-group-header--error');

    const controls = [...section.querySelectorAll('input[type="checkbox"], input[type="radio"]')];
    expect(controls.length).toBeGreaterThan(0);
    expect(controls.some(c => c.checked)).toBe(false);
  });
});
