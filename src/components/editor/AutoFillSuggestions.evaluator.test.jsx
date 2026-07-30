/**
 * Issue 0121, Task 6 — AutoFillSuggestions speist seine Vorschläge aus den
 * Pflicht-Signalen des Evaluator-Berichts (ADR-0035) statt aus Solver-Suchen.
 * Test-first: die neue Implementierung existiert noch nicht.
 *
 * Intention (ADR-0035): Vorschläge kommen aus dem Bericht —
 * - ein Pflicht-Phantom (`anchorKind: 'mandatoryPhantom'`, fehlende
 *   Pflichtauswahl) erzeugt einen Vorschlag, der die fehlende Auswahl beim
 *   Namen nennt,
 * - eine belegte Auswahl unter ihrem Minimum (`isMandatoryUnmet` am belegten
 *   Slot) erzeugt ebenfalls einen Vorschlag,
 * - bloß Wählbares ohne Pflicht-Signal (Angebots-Anker, `isMandatoryUnmet`
 *   false) erzeugt KEINEN Vorschlag,
 * - sind alle Pflichten erfüllt, verschwinden die Vorschläge.
 *
 * ── Prop-Vertragsentscheidung (so nah wie möglich am Bestehenden) ────────────
 * NEU: `capabilities` (die Slot-Map des Berichts) ersetzt das
 * roster/system/activeCatalogue/remainingPoints-Solver-Geflecht als
 * Vorschlagsquelle; `subSelectionOperations` und `costTypeLabel` bleiben.
 *
 * ── Falsifizierbarkeits-Entscheidung (markiert) ──────────────────────────────
 * Rein über die Observablen: die Komponente erhält bewusst KEINE
 * Solver-Eingaben (kein roster/system/remainingPoints) — Vorschläge können
 * ausschließlich aus den Pflicht-Signalen der `capabilities` entstehen. Ein
 * Modul-Spy ist hier nicht falsifizierbar (der Alt-Pfad bricht ohne seine
 * Eingaben schon vor jedem Solver-Aufruf ab) und entfällt deshalb.
 *
 * Die erwarteten Capability-Zustände wurden per Wegwerf-Skript gegen die ECHTE
 * Fassade verifiziert (General min 1, fehlt → mandatoryPhantom/unmet; Warrior
 * min 3, belegt 1 → occupied/unmet; Scout ohne Pflicht → offerAnchor, nicht
 * unmet; erfüllte Variante → nirgends unmet). Jeder Test prüft seine
 * Vorbedingung zusätzlich selbst gegen den echten Bericht.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import AutoFillSuggestions from './AutoFillSuggestions';
import { createSubSelectionOperationsMock } from '../../test-utils/subSelectionOperationsMock';
import { prepareDataset, evaluate } from '../../evaluator/evaluator.js';
import { toEvaluatorRoster } from '../../evaluation/rosterAdapter.js';

vi.mock('lucide-react', () => ({
  Sparkles: () => <span data-testid="icon-sparkles" />,
  Plus: () => <span data-testid="icon-plus" />,
  Wand2: () => <span data-testid="icon-wand" />,
}));

// ── Synthetischer Datensatz (rawXmls-Muster wie useRoster.evaluator.test.js) ──

const GAME_SYSTEM_ID = 'gs-main';
const FORCE_DEF_ID = 'force-main';
const GENERAL_ID = 'entry-general';
const WARRIOR_ID = 'entry-warrior';
const SCOUT_ID = 'entry-scout';
const COST_TYPE_ID = 'cost-pts';

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
  <gameSystem id="${GAME_SYSTEM_ID}" name="Test System">
    <costTypes><costType id="${COST_TYPE_ID}" name="pts" defaultCostLimit="-1"/></costTypes>
  </gameSystem>`;

const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-main" name="Main Catalogue" gameSystemId="${GAME_SYSTEM_ID}">
    <forceEntries><forceEntry id="${FORCE_DEF_ID}" name="Main Force"/></forceEntries>
    <selectionEntries>
      <selectionEntry id="${GENERAL_ID}" name="General" type="unit">
        <constraints>
          <constraint type="min" value="1" field="selections" scope="force" shared="true" id="limit-general-min" includeChildSelections="false"/>
        </constraints>
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="80"/></costs>
      </selectionEntry>
      <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit">
        <constraints>
          <constraint type="min" value="3" field="selections" scope="force" shared="true" id="limit-warrior-min" includeChildSelections="false"/>
        </constraints>
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="10"/></costs>
      </selectionEntry>
      <selectionEntry id="${SCOUT_ID}" name="Scout" type="unit">
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="15"/></costs>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

/** App-Roster mit offenen Pflichten: Warrior ×1 (min 3), General fehlt ganz. */
function rosterWithUnmetMandatories() {
  return {
    id: 'roster-unmet',
    costLimit: 1000,
    costLimitType: COST_TYPE_ID,
    forces: [
      {
        id: 'force-uuid-1',
        forceEntryId: FORCE_DEF_ID,
        catalogueId: 'cat-main',
        selections: [
          { id: 'sel-warrior', name: 'Warrior', entryLinkId: null, selectionEntryId: WARRIOR_ID, number: 1, selections: [] },
        ],
      },
    ],
  };
}

/** App-Roster mit erfüllten Pflichten: General ×1, Warrior ×3. */
function rosterWithMetMandatories() {
  return {
    id: 'roster-met',
    costLimit: 1000,
    costLimitType: COST_TYPE_ID,
    forces: [
      {
        id: 'force-uuid-1',
        forceEntryId: FORCE_DEF_ID,
        catalogueId: 'cat-main',
        selections: [
          { id: 'sel-general', name: 'General', entryLinkId: null, selectionEntryId: GENERAL_ID, number: 1, selections: [] },
          { id: 'sel-warrior', name: 'Warrior', entryLinkId: null, selectionEntryId: WARRIOR_ID, number: 3, selections: [] },
        ],
      },
    ],
  };
}

/** Auswertung über die ECHTE Fassade — die einzige Quelle der Erwartungen. */
function capabilitiesOf(roster) {
  const prepared = prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [CATALOGUE_XML] });
  const { evalRoster } = toEvaluatorRoster(roster);
  return evaluate(prepared, evalRoster).capabilities;
}

/** Capability per Definitions-Id (die Slot-Pfade liegen alle unter der Force „0"). */
function capabilityOf(capabilities, defId) {
  for (const capability of capabilities.values()) {
    if (capability.defId === defId) return capability;
  }
  return undefined;
}

function renderSuggestions(capabilities) {
  return render(
    <AutoFillSuggestions
      capabilities={capabilities}
      subSelectionOperations={createSubSelectionOperationsMock()}
      costTypeLabel="Pkt"
    />
  );
}

describe('AutoFillSuggestions: Vorschläge aus den Pflicht-Signalen des Berichts (Issue 0121, Task 6, ADR-0035)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ein Pflicht-Phantom (General fehlt) erzeugt einen Vorschlag — bloß Wählbares ohne Pflicht (Scout) nicht', () => {
    const capabilities = capabilitiesOf(rosterWithUnmetMandatories());
    // Guards gegen den echten Bericht.
    expect(capabilityOf(capabilities, GENERAL_ID)).toMatchObject({ anchorKind: 'mandatoryPhantom', isMandatoryUnmet: true });
    expect(capabilityOf(capabilities, SCOUT_ID)).toMatchObject({ anchorKind: 'offerAnchor', isMandatoryUnmet: false });

    renderSuggestions(capabilities);

    expect(screen.getByText('General')).toBeTruthy();
    expect(screen.queryByText('Scout')).toBeNull();
  });

  it('eine belegte Auswahl unter ihrem Minimum (Warrior 1 von 3, isMandatoryUnmet) erzeugt einen Vorschlag', () => {
    const capabilities = capabilitiesOf(rosterWithUnmetMandatories());
    expect(capabilityOf(capabilities, WARRIOR_ID)).toMatchObject({
      anchorKind: 'occupied', isMandatoryUnmet: true, effectiveMin: 3, current: 1,
    });

    renderSuggestions(capabilities);

    expect(screen.getByText('Warrior')).toBeTruthy();
  });

  it('erfüllte Pflichten: die Vorschläge verschwinden (Rand: kein unerfülltes Minimum im Bericht)', () => {
    // Erst der offene Fall (positiver Nachweis, schlägt fehl, solange die
    // Vorschläge nicht aus dem Bericht kommen) …
    const unmet = renderSuggestions(capabilitiesOf(rosterWithUnmetMandatories()));
    expect(screen.getByText('General')).toBeTruthy();
    unmet.unmount();

    // … dann derselbe Datensatz mit erfüllten Pflichten: nirgends isMandatoryUnmet.
    const capabilities = capabilitiesOf(rosterWithMetMandatories());
    for (const capability of capabilities.values()) {
      expect(capability.isMandatoryUnmet).toBe(false);
    }

    renderSuggestions(capabilities);
    expect(screen.queryByText('General')).toBeNull();
    expect(screen.queryByText('Warrior')).toBeNull();
    expect(screen.queryByText('Scout')).toBeNull();
  });
});
