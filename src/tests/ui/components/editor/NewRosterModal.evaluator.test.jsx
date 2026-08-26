/**
 * Issue 0121, Task 7 — NewRosterModal wechselt die Datenquellen vom Solver auf
 * die Datensatz-Beschreibung des Evaluators (test-first; die neue
 * Implementierung existiert noch nicht).
 *
 * Intention:
 * - Katalog-Auswahl aus `describeSystem(system).catalogues` — Bibliotheken
 *   (`isLibrary`) werden gefiltert.
 * - Kostenarten/Limit-Label aus `description.costTypes`; die Vorgabe-Grenze
 *   der Limit-Kostenart (`defaultCostLimit`) ist der Vorschlag im Zahlenfeld.
 * - Kontingent-Auswahl aus `description.creatableForces` — ausgeblendete
 *   Kontingente (`isHidden`) werden gefiltert.
 * - KEIN `getPlayableCatalogues`/`resolveCostLimitLabel`/
 *   `getAvailableForceEntries` aus dem Solver mehr.
 *
 * ── Falsifizierbarkeits-Entscheidung (markiert) ──────────────────────────────
 * Die Solver-Quellen sind als Spies mit GIFT-Werten gestubbt: liest die
 * Komponente noch den Solver, erscheinen `POISON-…`-Texte statt der Werte der
 * echten Datensatz-Beschreibung, und die Spy-Asserts schlagen an. Die
 * erwarteten Beschreibung-Werte wurden per Wegwerf-Skript gegen die ECHTE
 * Fassade verifiziert (describeDataset: catalogues mit isLibrary,
 * creatableForces mit isHidden, costTypes mit defaultLimit).
 *
 * ── Vertragsentscheidungen (markiert) ────────────────────────────────────────
 * - Die Props des Modals bleiben (isOpen, onClose, onCreate, systems); die
 *   `systems` sind App-System-Objekte MIT `rawXmls` — die Beschreibung kommt
 *   aus den rohen XMLs, nicht aus solver-geparsten Feldern.
 * - „defaultCostLimit als Vorschlag": deklariert die Limit-Kostenart (die
 *   erste Kostenart des Systems, wie heute im Modal kommentiert) eine
 *   Vorgabe-Grenze, ist sie der vorbelegte Wert des Zahlenfelds; ohne
 *   deklarierte Grenze (fehlend oder Sentinel -1) bleibt der bisherige
 *   Vorgabewert DEFAULT_ROSTER_COST_LIMIT (2000).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import NewRosterModal from '../../../../ui/components/editor/NewRosterModal';
import { DEFAULT_ROSTER_COST_LIMIT } from '../../../../contexts/armylist/model/rosterDefaults';

vi.mock('lucide-react', () => ({
  X: () => <span data-testid="icon-x" />,
}));

// Der Solver ist mit Issue 0121 geloescht; der fruehere Gift-Stub auf seine
// Fassade hat damit keinen Gegenstand mehr — dass die Anzeige aus dem Bericht
// kommt, ist jetzt strukturell garantiert.

// ── Synthetischer Datensatz (rawXmls-Muster wie rosterReportOf.test.js) ───────

const GAME_SYSTEM_ID = 'gs-main';
const COST_TYPE_ID = 'cost-pts';
const DEFAULT_LIMIT_FROM_DATASET = 1500;

/** Spielsystem, dessen Limit-Kostenart eine Vorgabe-Grenze deklariert. */
const GAME_SYSTEM_XML_WITH_DEFAULT_LIMIT = `<?xml version="1.0" encoding="utf-8"?>
  <gameSystem id="${GAME_SYSTEM_ID}" name="Test System">
    <costTypes>
      <costType id="${COST_TYPE_ID}" name="pts" defaultCostLimit="${DEFAULT_LIMIT_FROM_DATASET}"/>
    </costTypes>
  </gameSystem>`;

/** Spielsystem ohne deklarierte Vorgabe-Grenze (Sentinel -1 = unbegrenzt). */
const GAME_SYSTEM_XML_UNLIMITED = `<?xml version="1.0" encoding="utf-8"?>
  <gameSystem id="${GAME_SYSTEM_ID}" name="Test System">
    <costTypes>
      <costType id="${COST_TYPE_ID}" name="pts" defaultCostLimit="-1"/>
    </costTypes>
  </gameSystem>`;

const MAIN_CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-main" name="Main Catalogue" gameSystemId="${GAME_SYSTEM_ID}">
    <forceEntries>
      <forceEntry id="force-main" name="Main Force"/>
      <forceEntry id="force-hidden" name="Hidden Force" hidden="true"/>
    </forceEntries>
  </catalogue>`;

const LIBRARY_CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-lib" name="Shared Library" gameSystemId="${GAME_SYSTEM_ID}" library="true"/>`;

function appSystem(gameSystemXml = GAME_SYSTEM_XML_WITH_DEFAULT_LIMIT) {
  return {
    id: 'system-uuid',
    name: 'Test System',
    rawXmls: {
      gst: [{ name: 'test.gst', content: gameSystemXml }],
      cat: [
        { name: 'main.cat', content: MAIN_CATALOGUE_XML },
        { name: 'lib.cat', content: LIBRARY_CATALOGUE_XML },
      ],
    },
  };
}

const renderModal = (systems) =>
  render(<NewRosterModal isOpen onClose={vi.fn()} onCreate={vi.fn()} systems={systems} />);

const selectOfField = (labelText) =>
  screen.getByText(labelText).closest('.form-field').querySelector('select');

const enabledOptionNames = (select) =>
  Array.from(select.querySelectorAll('option'))
    .filter(option => !option.disabled)
    .map(option => option.textContent);

describe('NewRosterModal: Datenquellen aus der Datensatz-Beschreibung des Evaluators (Issue 0121, Task 7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bietet die spielbaren Kataloge aus description.catalogues an — Bibliotheken gefiltert, kein Solver-Wert', () => {
    renderModal([appSystem()]);

    const catalogueSelect = selectOfField('Katalog / Fraktion');
    expect(enabledOptionNames(catalogueSelect)).toEqual(['Main Catalogue']);
    expect(screen.queryByText('Shared Library')).toBeNull();
    expect(screen.queryByText('POISON-CATALOGUE')).toBeNull();
    expect(catalogueSelect.value).toBe('cat-main');
  });

  it('bietet die anlegbaren Kontingente aus description.creatableForces an — isHidden gefiltert, kein Solver-Wert', () => {
    renderModal([appSystem()]);

    const forceSelect = selectOfField('Armeestruktur / Kontingent');
    expect(enabledOptionNames(forceSelect)).toEqual(['Main Force']);
    expect(screen.queryByText('Hidden Force')).toBeNull();
    expect(screen.queryByText('POISON-FORCE')).toBeNull();
    expect(forceSelect.value).toBe('force-main');
  });

  it('zeigt das Limit-Label aus description.costTypes (Klartext-Name der Kostenart), nicht aus resolveCostLimitLabel', () => {
    const { container } = renderModal([appSystem()]);

    const suffix = container.querySelector('.input-suffix-label');
    expect(suffix.textContent.trim()).toBe('pts');
    expect(screen.queryByText('POISON-LABEL')).toBeNull();
  });

  it('Vertragsentscheidung: die deklarierte Vorgabe-Grenze (defaultCostLimit 1500) ist der Vorschlag im Zahlenfeld', () => {
    const { container } = renderModal([appSystem(GAME_SYSTEM_XML_WITH_DEFAULT_LIMIT)]);

    const limitInput = container.querySelector('input[type="number"]');
    expect(Number(limitInput.value)).toBe(DEFAULT_LIMIT_FROM_DATASET);
  });

  it('Rand: ohne deklarierte Vorgabe-Grenze (Sentinel -1) bleibt der bisherige Vorgabewert 2000', () => {
    const { container } = renderModal([appSystem(GAME_SYSTEM_XML_UNLIMITED)]);

    const limitInput = container.querySelector('input[type="number"]');
    expect(Number(limitInput.value)).toBe(DEFAULT_ROSTER_COST_LIMIT);
  });

  // Der frühere Gift-Stub-Test steht hier nicht mehr: Der Solver ist mit
  // Issue 0121 gelöscht, seine Funktionen können gar nicht mehr gerufen
  // werden. Eine Assertion darauf könnte nicht fehlschlagen und würde
  // Sicherheit vortäuschen. Dass die Anzeige aus dem Bericht kommt, prüfen
  // die Fälle darüber an ihren Werten.
});
