/**
 * Issue 0121, Task 6 — SelectionConfigurator baut die Gruppen-/Optionsliste
 * einer Selection aus den Slots des Evaluator-Berichts unterhalb ihres Pfads
 * (`pathBySelectionId`) und reicht `capabilities`/Slot-Kontext an OptionGroup
 * durch (ADR-0035/0036). Test-first: die neue Implementierung existiert nicht.
 *
 * Intention (ADR-0035):
 * - die Options-/Gruppenliste einer Selection entsteht aus den Slots unterhalb
 *   ihres Slot-Pfads: belegte Slots, Pflicht-Phantome, Gruppen-Anker und
 *   Angebots-Anker erscheinen; Slots FREMDER Selektionen erscheinen nicht,
 * - der Zustand der Slots wird durchgereicht: am Maximum → nicht erhöhbar,
 *   Restspielraum → erhöhbar, versteckt → unsichtbar, offene Pflicht → NICHT
 *   angehakt und beschreibbar (Issue 0145, Kriterium 3).
 *
 * ── Prop-Vertragsentscheidung (so nah wie möglich am Bestehenden) ────────────
 * Bestehende Props behalten ihre Bedeutung (selection, subSelectionOperations,
 * system, roster, activeCatalogue, Handler). NEU:
 * - `capabilities`:      die Slot-Map des Berichts,
 * - `pathBySelectionId`: Map App-Selection-UUID → Slot-Pfad (Roster-Adapter) —
 *   daraus ergibt sich der Pfad der konfigurierten Selection.
 *
 * ── Falsifizierbarkeits-Entscheidung (markiert) ──────────────────────────────
 * Rein über die Observablen; die bisherige Solver-Options-Sammlung ist bewusst
 * leer gestubbt (`getUnitOptions` → []) und die Solver-Auflösung inert
 * (`resolveEntry`/`findEntryInSystem` → null): die Liste KANN nur noch aus den
 * Slots des Berichts entstehen — ein Rückfall auf den Solver bleibt sichtbar
 * (leerer Konfigurator).
 *
 * Die erwarteten Capability-Zustände wurden per Wegwerf-Skript gegen die ECHTE
 * Fassade verifiziert (unter Hero „0/0": Shield belegt/blockiert, Banner
 * belegt/Spielraum 2, Helm-Pflicht-Phantom, Gruppen-Anker „Weapons",
 * Angebots-Anker Sword/Axe/Cloak[hidden]; unter Squire „0/1": Angebots-Anker
 * Lance). Jeder Test prüft seine Vorbedingung selbst gegen den echten Bericht.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SelectionConfiguratorHarness as SelectionConfigurator } from '../../../shared/test-utils/editorHarness';
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
const SQUIRE_ID = 'entry-squire';
const SHIELD_ID = 'opt-shield';
const BANNER_ID = 'opt-banner';
const CLOAK_ID = 'opt-cloak';
const HELM_ID = 'opt-helm';
const SWORD_ID = 'opt-sword';
const AXE_ID = 'opt-axe';
const LANCE_ID = 'opt-lance';
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
      <selectionEntry id="${SQUIRE_ID}" name="Squire" type="unit">
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="20"/></costs>
        <selectionEntries>
          <selectionEntry id="${LANCE_ID}" name="Lance" type="upgrade">
            <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="4"/></costs>
          </selectionEntry>
        </selectionEntries>
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
 * App-Roster: Hero (Shield ×2, Banner ×1, Helm-Pflicht offen, Weapons leer)
 * und daneben Squire — dessen Options-Slots (Lance) gehören NICHT in den
 * Konfigurator des Hero.
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
              { id: 'sel-shield', name: 'Shield', entryLinkId: null, selectionEntryId: SHIELD_ID, number: 2, selections: [] },
              { id: 'sel-banner', name: 'Banner', entryLinkId: null, selectionEntryId: BANNER_ID, number: 1, selections: [] },
            ],
          },
          { id: 'sel-squire', name: 'Squire', entryLinkId: null, selectionEntryId: SQUIRE_ID, number: 1, category: null, selections: [] },
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

/** Capability eines Slots unterhalb eines Pfads per Definitions-Id. */
function capabilityUnder(capabilities, parentPath, defId) {
  for (const [path, capability] of capabilities) {
    if (path.startsWith(`${parentPath}/`) && capability.defId === defId) return capability;
  }
  return undefined;
}

/** True, wenn das Operations-Argument die Options-Definition identifiziert. */
function identifiesOption(arg, defId) {
  return arg === defId || arg?.id === defId || arg?.defId === defId;
}

function renderConfigurator(operations) {
  const roster = appRoster();
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

describe('SelectionConfigurator: Optionsliste aus den Slots unter dem Selection-Pfad (Issue 0121, Task 6, ADR-0035)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('zeigt die Slots unterhalb des Hero-Pfads: belegte Optionen, Pflicht-Phantom und Gruppen-Anker', () => {
    const { capabilities, pathBySelectionId } = renderConfigurator(createSubSelectionOperationsMock());
    // Guards gegen den echten Bericht.
    expect(pathBySelectionId.get('sel-hero')).toBe(HERO_PATH);
    expect(capabilityUnder(capabilities, HERO_PATH, SHIELD_ID)).toMatchObject({ anchorKind: 'occupied' });
    expect(capabilityUnder(capabilities, HERO_PATH, BANNER_ID)).toMatchObject({ anchorKind: 'occupied' });
    expect(capabilityUnder(capabilities, HERO_PATH, HELM_ID)).toMatchObject({ anchorKind: 'mandatoryPhantom', isMandatoryUnmet: true });
    expect(capabilityUnder(capabilities, HERO_PATH, WEAPONS_GROUP_ID)).toMatchObject({ anchorKind: 'groupAnchor', effectiveMax: 1 });

    expect(screen.getByText('Shield')).toBeTruthy();
    expect(screen.getByText('Banner')).toBeTruthy();
    expect(screen.getByText('Helm')).toBeTruthy();
    expect(screen.getByText('Weapons')).toBeTruthy();
  });

  it('zeigt die Angebots-Anker der Weapons-Gruppe (Sword/Axe), aber keine versteckten Slots (Cloak)', () => {
    const { capabilities } = renderConfigurator(createSubSelectionOperationsMock());
    expect(capabilityUnder(capabilities, HERO_PATH, SWORD_ID)).toMatchObject({ anchorKind: 'offerAnchor', isHidden: false });
    expect(capabilityUnder(capabilities, HERO_PATH, CLOAK_ID)).toMatchObject({ anchorKind: 'offerAnchor', isHidden: true });

    ensureExpanded('Weapons', 'Sword');
    expect(screen.getByText('Sword')).toBeTruthy();
    expect(screen.getByText('Axe')).toBeTruthy();
    expect(screen.queryByText('Cloak')).toBeNull();
  });

  it('Slots fremder Selektionen erscheinen nicht: Lance (unter Squire) gehört nicht in den Hero-Konfigurator', () => {
    const { capabilities } = renderConfigurator(createSubSelectionOperationsMock());
    // Guard: Lance ist ein realer Angebots-Anker — aber unter dem Squire-Pfad.
    expect(capabilityUnder(capabilities, '0/1', LANCE_ID)).toMatchObject({ anchorKind: 'offerAnchor' });
    expect(capabilityUnder(capabilities, HERO_PATH, LANCE_ID)).toBeUndefined();

    // Positive Kontrolle (schlägt fehl, solange die Liste nicht aus Slots entsteht) …
    expect(screen.getByText('Banner')).toBeTruthy();
    // … und die Abgrenzung: fremde Slots bleiben draußen.
    expect(screen.queryByText('Lance')).toBeNull();
    expect(screen.queryByText('Squire')).toBeNull();
  });

  it('reicht den Slot-Zustand durch: Banner (Spielraum) erhöhbar, Shield (am Maximum) nicht', () => {
    const operations = createSubSelectionOperationsMock();
    const { capabilities, selection } = renderConfigurator(operations);
    expect(capabilityUnder(capabilities, HERO_PATH, BANNER_ID)).toMatchObject({ headroom: 2, isBlocked: false });
    expect(capabilityUnder(capabilities, HERO_PATH, SHIELD_ID)).toMatchObject({ headroom: 0, isBlocked: true });

    const bannerRow = screen.getByText('Banner').closest('.sub-selection-row');
    const bannerPlus = bannerRow.querySelector('.quantity-control button:last-child');
    expect(bannerPlus, 'Banner (max 3) wird als Mengen-Stepper bedient').not.toBeNull();
    expect(bannerPlus.disabled).toBe(false);
    fireEvent.click(bannerPlus);
    expect(operations.increaseCount.mock.calls.some(
      call => call[0] === selection.id && identifiesOption(call[1], BANNER_ID),
    )).toBe(true);

    const shieldRow = screen.getByText('Shield').closest('.sub-selection-row');
    const shieldPlus = shieldRow.querySelector('.quantity-control button:last-child');
    expect(shieldPlus, 'Shield (max 2) wird als Mengen-Stepper bedient').not.toBeNull();
    expect(shieldPlus.disabled).toBe(true);
  });

  it('die offene Pflicht (Helm, isMandatoryUnmet) rendert nicht angehakt und schreibt beim Klick (Issue 0145, Kriterium 3)', () => {
    const operations = createSubSelectionOperationsMock();
    const { selection } = renderConfigurator(operations);

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
});
