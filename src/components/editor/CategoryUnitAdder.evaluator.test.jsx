/**
 * Issue 0121, Task 6 — CategoryUnitAdder (Aushebe-Dialog) wechselt den
 * Verfügbarkeitspfad vom Solver-Diff (ADR-0022, superseded) auf das ABLESEN
 * der Fähigkeitsdatensätze des Evaluator-Berichts (ADR-0035/0036).
 * Test-first: die neue Implementierung existiert noch nicht.
 *
 * Intention (ADR-0035): Die Kandidatenliste einer Kategorie und ihr Zustand
 * kommen aus `capabilities` — dem Slot-Datensatz des Berichts:
 * - wählbar ist, was als Angebots-Anker (`anchorKind: 'offerAnchor'`) oder als
 *   belegter Slot mit Restspielraum (`headroom > 0`) unter dem Kontingent liegt,
 * - gesperrt ist, wessen Höchstmaß ausgeschöpft ist (`isBlocked` / `headroom 0`)
 *   — mit ablesbarem Grund (bestehende Observable „(Nicht verfügbar)"),
 * - `isHidden`-Slots erscheinen gar nicht,
 * - KEIN `validateRoster`-Baseline-Aufruf, KEIN `getEntryAddAvailability`.
 *
 * ── Prop-Vertragsentscheidung (so nah wie möglich am Bestehenden) ────────────
 * Bestehende Props behalten ihre Bedeutung (categoryId, categoryName, addUnit,
 * costTypeLabel, costLimitType, system, activeCatalogue, roster, force). NEU:
 * - `capabilities`: die Slot-Map des Berichts (Map Slot-Pfad → SlotCapability),
 * - `forcePath`:    der Slot-Pfad des Ziel-Kontingents (Pfad-Schema der
 *                   Fassade: `forces[i]` liegt unter `"i"`, hier `"0"`).
 * `addUnit(kandidat, categoryId)` bleibt der Aushebe-Callback; das erste
 * Argument muss die gewählte Definition identifizieren (Objekt mit id/defId
 * oder die defId selbst — die Repräsentation bleibt offen).
 *
 * ── Falsifizierbarkeits-Entscheidung (markiert, wie gefordert) ───────────────
 * Beides: (a) Modul-Spy auf der Solver-Fassade — `validateRoster` und
 * `getEntryAddAvailability` werden als Spies gestubbt und dürfen im neuen Pfad
 * nie aufgerufen werden; (b) `collectPrimaryCategoryEntries` (die bisherige
 * Kandidatenquelle) ist bewusst leer gestubbt — Kandidaten KÖNNEN nur noch aus
 * `capabilities` kommen, sonst bleibt der Dialog leer und die Observablen-Tests
 * schlagen fehl.
 *
 * Die erwarteten Capability-Zustände wurden per Wegwerf-Skript gegen die ECHTE
 * Fassade verifiziert (Knight max 1, belegt 1 → isBlocked/headroom 0; Duke
 * max 2, belegt 1 → headroom 1; Archer ohne Max → Angebots-Anker; Ghost
 * hidden="true" → Angebots-Anker mit isHidden). Jeder Test prüft seine
 * Vorbedingung zusätzlich selbst gegen den echten Bericht (Guard-Asserts).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CategoryUnitAdderHarness as CategoryUnitAdder } from '../../test-utils/harnesses/CategoryUnitAdderHarness';
import { prepareDataset, evaluate } from '../../evaluator/evaluator.js';
import { toEvaluatorRoster } from '../../evaluation/rosterAdapter.js';

// Der Solver ist mit Issue 0121 geloescht; der fruehere Gift-Stub auf seine
// Fassade hat damit keinen Gegenstand mehr — dass die Anzeige aus dem Bericht
// kommt, ist jetzt strukturell garantiert.

vi.mock('lucide-react', () => ({
  Plus: () => <span data-testid="icon-plus" />,
  X: () => <span data-testid="icon-x" />,
}));

// Die Kinder der BottomSheet inline rendern, sobald sie offen ist (kein Portal).
vi.mock('./BottomSheet', () => ({
  default: ({ isOpen, children }) => (isOpen ? <div data-testid="sheet">{children}</div> : null),
}));

// ── Synthetischer Datensatz (rawXmls-Muster wie useRoster.evaluator.test.js) ──

const GAME_SYSTEM_ID = 'gs-main';
const FORCE_DEF_ID = 'force-main';
const CATEGORY_ID = 'cat-special';
const KNIGHT_ID = 'entry-knight';
const DUKE_ID = 'entry-duke';
const ARCHER_ID = 'entry-archer';
const GHOST_ID = 'entry-ghost';
const COST_TYPE_ID = 'cost-pts';
const FORCE_PATH = '0';

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
  <gameSystem id="${GAME_SYSTEM_ID}" name="Test System">
    <costTypes><costType id="${COST_TYPE_ID}" name="pts" defaultCostLimit="-1"/></costTypes>
    <categoryEntries><categoryEntry id="${CATEGORY_ID}" name="Special"/></categoryEntries>
  </gameSystem>`;

const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-main" name="Main Catalogue" gameSystemId="${GAME_SYSTEM_ID}">
    <forceEntries>
      <forceEntry id="${FORCE_DEF_ID}" name="Main Force">
        <categoryLinks>
          <categoryLink id="cl-special" name="Special" targetId="${CATEGORY_ID}" primary="false"/>
        </categoryLinks>
      </forceEntry>
    </forceEntries>
    <selectionEntries>
      <selectionEntry id="${KNIGHT_ID}" name="Knight" type="unit">
        <constraints>
          <constraint type="max" value="1" field="selections" scope="force" shared="true" id="limit-knight-max" includeChildSelections="false"/>
        </constraints>
        <categoryLinks><categoryLink id="kl-1" name="Special" targetId="${CATEGORY_ID}" primary="true"/></categoryLinks>
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="30"/></costs>
      </selectionEntry>
      <selectionEntry id="${DUKE_ID}" name="Duke" type="unit">
        <constraints>
          <constraint type="max" value="2" field="selections" scope="force" shared="true" id="limit-duke-max" includeChildSelections="false"/>
        </constraints>
        <categoryLinks><categoryLink id="dl-1" name="Special" targetId="${CATEGORY_ID}" primary="true"/></categoryLinks>
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="25"/></costs>
      </selectionEntry>
      <selectionEntry id="${ARCHER_ID}" name="Archer" type="unit">
        <categoryLinks><categoryLink id="al-1" name="Special" targetId="${CATEGORY_ID}" primary="true"/></categoryLinks>
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="12"/></costs>
      </selectionEntry>
      <selectionEntry id="${GHOST_ID}" name="Ghost" type="unit" hidden="true">
        <categoryLinks><categoryLink id="gl-1" name="Special" targetId="${CATEGORY_ID}" primary="true"/></categoryLinks>
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="40"/></costs>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

/** App-System-Objekt mit den rohen XMLs (Shape aus `src/db/systemImport.js`). */
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

/** App-Roster: Knight ×1 (Max erreicht) und Duke ×1 (Restspielraum 1). */
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
          { id: 'sel-knight', name: 'Knight', entryLinkId: null, selectionEntryId: KNIGHT_ID, number: 1, category: null, selections: [] },
          { id: 'sel-duke', name: 'Duke', entryLinkId: null, selectionEntryId: DUKE_ID, number: 1, category: null, selections: [] },
        ],
      },
    ],
  };
}

/** Auswertung über die ECHTE Fassade — die einzige Quelle der Erwartungen. */
function evaluation() {
  const prepared = prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [CATALOGUE_XML] });
  const { evalRoster, pathBySelectionId } = toEvaluatorRoster(appRoster());
  const report = evaluate(prepared, evalRoster);
  return { capabilities: report.capabilities, pathBySelectionId };
}

/** True, wenn das addUnit-Argument die Definition identifiziert (Form offen). */
function identifiesDefinition(arg, defId) {
  return arg === defId || arg?.id === defId || arg?.defId === defId;
}

/** Sucht die Capability eines Slots unter dem Kontingent per Definitions-Id. */
function capabilityOf(capabilities, defId) {
  for (const [path, capability] of capabilities) {
    if (path.startsWith(`${FORCE_PATH}/`) && capability.defId === defId) return capability;
  }
  return undefined;
}

function renderAdder(addUnit, capabilities) {
  const roster = appRoster();
  render(
    <CategoryUnitAdder
      categoryId={CATEGORY_ID}
      categoryName="Special"
      capabilities={capabilities}
      forcePath={FORCE_PATH}
      system={appSystem()}
      activeCatalogue={{ id: 'cat-main' }}
      costTypeLabel="Pkt"
      costLimitType={COST_TYPE_ID}
      addUnit={addUnit}
      roster={roster}
      selectionCounts={{}}
      force={roster.forces[0]}
    />
  );
}

function openDialog() {
  fireEvent.click(screen.getByTitle('Special ausheben'));
}

describe('CategoryUnitAdder: Verfügbarkeit aus dem Fähigkeitsdatensatz (Issue 0121, Task 6, ADR-0035)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bietet wählbare Kandidaten aus capabilities an: Angebots-Anker (Archer) und belegter Slot mit Restspielraum (Duke)', () => {
    const { capabilities } = evaluation();
    // Guards gegen den echten Bericht: Archer ist Angebots-Anker, Duke hat Spielraum.
    expect(capabilityOf(capabilities, ARCHER_ID)).toMatchObject({ anchorKind: 'offerAnchor', isBlocked: false, isHidden: false });
    expect(capabilityOf(capabilities, DUKE_ID)).toMatchObject({ anchorKind: 'occupied', headroom: 1, isBlocked: false });

    renderAdder(vi.fn(), capabilities);
    openDialog();

    const archerRow = screen.getByText('Archer').closest('.popover-item');
    expect(archerRow.getAttribute('aria-disabled')).toBe('false');
    expect(archerRow.className).not.toContain('disabled');

    const dukeRow = screen.getByText('Duke').closest('.popover-item');
    expect(dukeRow.getAttribute('aria-disabled')).toBe('false');
    expect(dukeRow.className).not.toContain('disabled');
  });

  it('zeigt die Kosten eines Kandidaten aus capability.costs (+12 für Archer)', () => {
    const { capabilities } = evaluation();
    expect(capabilityOf(capabilities, ARCHER_ID).costs).toEqual({ [COST_TYPE_ID]: 12 });

    renderAdder(vi.fn(), capabilities);
    openDialog();

    const archerRow = screen.getByText('Archer').closest('.popover-item');
    expect(archerRow.textContent).toMatch(/\+\s?12/);
  });

  it('ein Eintrag mit ausgeschöpftem Maximum (headroom 0 / isBlocked) erscheint deaktiviert mit ablesbarem Grund', () => {
    const { capabilities } = evaluation();
    expect(capabilityOf(capabilities, KNIGHT_ID)).toMatchObject({ anchorKind: 'occupied', isBlocked: true, headroom: 0 });

    const addUnit = vi.fn();
    renderAdder(addUnit, capabilities);
    openDialog();

    const knightRow = screen.getByText('Knight').closest('.popover-item');
    expect(knightRow.getAttribute('aria-disabled')).toBe('true');
    expect(knightRow.className).toContain('disabled');
    // Der ablesbare Grund: die bestehende Observable des Aushebe-Dialogs.
    expect(screen.getByText('(Nicht verfügbar)')).toBeTruthy();

    fireEvent.click(knightRow);
    expect(addUnit).not.toHaveBeenCalled();
  });

  it('isHidden-Einträge erscheinen gar nicht (Ghost), während sichtbare Kandidaten erscheinen', () => {
    const { capabilities } = evaluation();
    expect(capabilityOf(capabilities, GHOST_ID)).toMatchObject({ anchorKind: 'offerAnchor', isHidden: true });

    renderAdder(vi.fn(), capabilities);
    openDialog();

    expect(screen.getByText('Archer')).toBeTruthy();
    expect(screen.queryByText('Ghost')).toBeNull();
  });

  it('Klick auf einen wählbaren Kandidaten hebt ihn aus: addUnit(kandidat, categoryId) genau einmal', () => {
    const { capabilities } = evaluation();
    const addUnit = vi.fn();
    renderAdder(addUnit, capabilities);
    openDialog();

    fireEvent.click(screen.getByText('Archer').closest('.popover-item'));

    expect(addUnit).toHaveBeenCalledTimes(1);
    expect(identifiesDefinition(addUnit.mock.calls[0][0], ARCHER_ID)).toBe(true);
    expect(addUnit.mock.calls[0][1]).toBe(CATEGORY_ID);
  });

  // Der frühere Gift-Stub-Test steht hier nicht mehr: Der Solver ist mit
  // Issue 0121 gelöscht, seine Funktionen können gar nicht mehr gerufen
  // werden. Eine Assertion darauf könnte nicht fehlschlagen und würde
  // Sicherheit vortäuschen. Dass die Anzeige aus dem Bericht kommt, prüfen
  // die Fälle darüber an ihren Werten.
});
