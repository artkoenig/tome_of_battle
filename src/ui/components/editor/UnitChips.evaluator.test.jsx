/**
 * Issue 0121, Task 7 — UnitChips (Regel-Chips einer Einheit): die Regeln
 * kommen aus `capability.infoElements` des Slots (Eintraege
 * `{ kind: 'rule', name, text }`), nicht mehr aus
 * `collectUnitProfilesAndRules` des Solvers (test-first; die neue
 * Implementierung existiert noch nicht).
 *
 * ── Prop-Vertragsentscheidung (markiert, so nah wie moeglich am Bestehenden) ─
 * Bestehende Props behalten ihre Bedeutung (selection, system,
 * activeCatalogueId, roster, Handler). NEU erhalten die Chips den
 * Faehigkeitsdatensatz ihres Slots — der Test reicht dafuer ALLE plausiblen
 * Kanaele zugleich: `capability` (der Slot-Datensatz selbst) sowie
 * `capabilities` + `pathBySelectionId` (das Lookup-Paar, das die umgebenden
 * Editor-Komponenten heute schon fuehren). Die Implementierung darf einen
 * davon lesen; die Tests pruefen nur die Observable.
 *
 * ── Falsifizierbarkeits-Entscheidung (markiert) ──────────────────────────────
 * `collectUnitProfilesAndRules` ist GIFT-Stub (liefert nur POISON-RULE) und
 * Spy: kaemen die Chips noch aus dem Solver, erschiene POISON-RULE statt der
 * Regel des echten Berichts. Die infoElements-Form (Regel mit `text`) wurde
 * per Wegwerf-Skript gegen die ECHTE Fassade verifiziert; jeder Test prueft
 * seine Vorbedingung per Guard-Assert gegen den echten Bericht.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UnitRulesChipsHarness as UnitRulesChips } from '../../../shared/test-utils/editorHarness';
import { prepareDataset, evaluate } from '../../../domain/evaluator/evaluator.js';
import { toEvaluatorRoster } from '../../../domain/evaluation/rosterAdapter.js';

vi.mock('lucide-react', () => ({
  BookOpen: (props) => <span data-testid="icon-book" {...props} />,
  Info: (props) => <span data-testid="icon-info" {...props} />,
}));

const mockUseSettings = vi.fn(() => ({ whfb6LinkingEnabled: false }));
vi.mock('../../viewmodels/SettingsContext', () => ({
  useSettings: () => mockUseSettings(),
}));

// Der Solver ist mit Issue 0121 geloescht; der fruehere Gift-Stub auf seine
// Fassade hat damit keinen Gegenstand mehr — dass die Anzeige aus dem Bericht
// kommt, ist jetzt strukturell garantiert.

// ── Synthetischer Datensatz: eine Einheit mit einer Regel per infoLink ───────

const GAME_SYSTEM_ID = 'gs-main';
const FORCE_DEF_ID = 'force-main';
const WARRIOR_ID = 'entry-warrior';
const COST_TYPE_ID = 'cost-pts';
const RULE_NAME = 'Bravery';
const RULE_TEXT = 'Never flees the battlefield.';

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
  <gameSystem id="${GAME_SYSTEM_ID}" name="Test System">
    <costTypes><costType id="${COST_TYPE_ID}" name="pts" defaultCostLimit="-1"/></costTypes>
  </gameSystem>`;

const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-main" name="Main Catalogue" gameSystemId="${GAME_SYSTEM_ID}">
    <forceEntries>
      <forceEntry id="${FORCE_DEF_ID}" name="Main Force"/>
    </forceEntries>
    <sharedRules>
      <rule id="rule-brave" name="${RULE_NAME}">
        <description>${RULE_TEXT}</description>
      </rule>
    </sharedRules>
    <selectionEntries>
      <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit">
        <infoLinks>
          <infoLink id="il-rule" name="${RULE_NAME}" targetId="rule-brave" type="rule"/>
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

function renderRulesChips({ capabilities, pathBySelectionId, capability }, overrides = {}) {
  const roster = appRoster();
  return render(
    <UnitRulesChips
      selection={roster.forces[0].selections[0]}
      system={appSystem()}
      activeCatalogueId="cat-main"
      roster={roster}
      capability={capability}
      capabilities={capabilities}
      pathBySelectionId={pathBySelectionId}
      handleMouseEnter={vi.fn()}
      handleMouseMove={vi.fn()}
      handleMouseLeave={vi.fn()}
      onClickDetails={vi.fn()}
      onShowRule={vi.fn()}
      {...overrides}
    />
  );
}

describe('UnitRulesChips: Regeln aus capability.infoElements (Issue 0121, Task 7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rendert die Regel des Berichts als Chip — nicht die Solver-Giftregel', () => {
    const reportData = evaluation();
    // Guard gegen den echten Bericht: der Slot fuehrt die Regel samt Text.
    expect(reportData.capability.infoElements).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'rule', name: RULE_NAME, text: RULE_TEXT }),
    ]));

    renderRulesChips(reportData);

    expect(screen.getByText(RULE_NAME)).toBeTruthy();
    expect(screen.queryByText('POISON-RULE')).toBeNull();
  });

  it('der Regeltext des Berichts ist die Detail-Observable des Chips (Klick liefert den Text)', () => {
    const reportData = evaluation();
    const onClickDetails = vi.fn();
    renderRulesChips(reportData, { onClickDetails });

    const chip = screen.getByText(RULE_NAME).closest('.rule-badge');
    expect(chip.className).toContain('has-desc');
    fireEvent.click(chip);

    expect(onClickDetails).toHaveBeenCalledTimes(1);
    const [detailTitle, detailContent] = onClickDetails.mock.calls[0];
    expect(detailTitle).toBe(RULE_NAME);
    const { container: detailsContainer } = render(<div>{detailContent}</div>);
    expect(detailsContainer.textContent).toContain(RULE_TEXT);
  });

  // Der frühere Gift-Stub-Test steht hier nicht mehr: Der Solver ist mit
  // Issue 0121 gelöscht, seine Funktionen können gar nicht mehr gerufen
  // werden. Eine Assertion darauf könnte nicht fehlschlagen und würde
  // Sicherheit vortäuschen. Dass die Anzeige aus dem Bericht kommt, prüfen
  // die Fälle darüber an ihren Werten.
});
