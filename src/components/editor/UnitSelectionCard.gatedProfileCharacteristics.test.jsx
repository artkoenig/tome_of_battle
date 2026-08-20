/**
 * Issue 81, Increment 1 — die gegatterten Profilwert-Modifikatoren der
 * Blood-Dragon-Blutlinie erreichen die Profil-Tabelle der Karte
 * (Kriterien 1, 2, 4; Kriterium 8: der Pfad, den der Anwender wirklich sieht —
 * der Fassaden-Bericht UND die davon gespeiste Komponente, nicht nur der
 * alte `profileCollector`).
 *
 * Aufgebaut aus zwei bestehenden Mustern: den Props und Mocks aus
 * `UnitSelectionCard.evaluator.test.jsx` (die Karte erhaelt `capabilities`
 * und `pathBySelectionId` bereits als Props) und der echten Produktionsnaht
 * aus `SelectionConfigurator.groupMembership.test.jsx`
 * (`processImportedData` + `prepareDataset`/`evaluate` auf denselben zwei
 * XML-Texten der frozen `whfb6-definitive`-Fixture, beides in `beforeAll`).
 *
 * Das App-Roster ist von Hand gebaut, in der Form, die `rosterAdapter` liest
 * — nicht ueber `createSelectionFromDef`, denn der Fall braucht nur die zwei
 * Auswahlen Vampire Count + Bloodlines/Blood Dragon, keinen vollen
 * Katalogbaum.
 */

import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { UnitSelectionCardHarness as UnitSelectionCard } from '../../test-utils/editorHarness';
import { processImportedData } from '../../parser/xmlParser.js';
import { prepareDataset, evaluate } from '../../evaluator/evaluator.js';
import { toEvaluatorRoster } from '../../evaluation/rosterAdapter.js';

vi.mock('lucide-react', () => ({
  Trash2: () => <span data-testid="icon-trash" />,
  Copy: () => <span data-testid="icon-copy" />,
  AlertTriangle: () => <span data-testid="icon-alert" />,
  MoreVertical: () => <span data-testid="icon-more" />,
  ReceiptText: () => <span data-testid="icon-receipt" />,
}));

vi.mock('./BottomSheet', () => ({
  default: ({ isOpen, children }) => (isOpen ? <div data-testid="sheet">{children}</div> : null),
}));

vi.mock('./SelectionConfigurator', () => ({
  default: () => <div data-testid="selection-configurator" />,
}));
vi.mock('./UnitChips', () => ({
  UnitUpgradesChips: () => null,
  UnitRulesChips: () => null,
}));

const CATALOG_DIR = path.resolve('src/evaluator/__fixtures__/whfb6-definitive');
const GST_FILE = 'Warhammer Fantasy Battles (6th definitive edition).gst';
const CAT_FILE = 'Vampire Counts (6th definitive edition).cat';

// `<catalogue id="...">` der Vampire-Counts-`.cat`.
const CATALOGUE_ID = '4d73-5ab0-9020-403c';
const PTS = 'ecfa-8486-4f6c-c249';
// `<forceEntry name="Standard (VC-AB)">`.
const STANDARD_FORCE_ID = 'e989-15b8-7eb6-9668';
const VAMPIRE_COUNT_ID = '6822-0110-a7c9-cbb0';
const BLOODLINES_ID = 'a56a-eb32-5a45-16fd';
const BLOOD_DRAGON_ID = '9fd9-e05c-ffcb-2c4d';

let gstContent;
let catContent;
let system;
let prepared;

beforeAll(() => {
  gstContent = fs.readFileSync(path.join(CATALOG_DIR, GST_FILE), 'utf8');
  catContent = fs.readFileSync(path.join(CATALOG_DIR, CAT_FILE), 'utf8');
  system = processImportedData(
    [{ name: GST_FILE, content: gstContent }],
    [{ name: CAT_FILE, content: catContent }],
  ).system;
  prepared = prepareDataset({ gameSystem: gstContent, catalogues: [catContent] });
});

/** Das App-Roster in der Form, die `rosterAdapter` liest — mit oder ohne Bloodline. */
function appRoster({ withBloodDragon }) {
  const vampireCount = {
    id: 'sel-vc',
    name: 'Vampire Count',
    entryLinkId: null,
    selectionEntryId: VAMPIRE_COUNT_ID,
    number: 1,
    category: null,
    selections: [],
  };
  const selections = [vampireCount];
  if (withBloodDragon) {
    selections.push({
      id: 'sel-bloodlines',
      name: 'Bloodlines',
      entryLinkId: null,
      selectionEntryId: BLOODLINES_ID,
      number: 1,
      category: null,
      selections: [
        {
          id: 'sel-bd',
          name: 'Bloodline of Clan Blood Dragon',
          entryLinkId: null,
          selectionEntryId: BLOOD_DRAGON_ID,
          number: 1,
          category: null,
          selections: [],
        },
      ],
    });
  }
  return {
    catalogueId: CATALOGUE_ID,
    name: 'Test Roster',
    costLimit: 3000,
    costLimitType: PTS,
    forces: [{ id: 'force-1', forceEntryId: STANDARD_FORCE_ID, catalogueId: CATALOGUE_ID, selections }],
  };
}

/** Auswertung ueber die ECHTE Fassade — die einzige Quelle der Erwartungen. */
function evaluation({ withBloodDragon }) {
  const roster = appRoster({ withBloodDragon });
  const { evalRoster, pathBySelectionId } = toEvaluatorRoster(roster);
  const report = evaluate(prepared, evalRoster);
  return { roster, capabilities: report.capabilities, pathBySelectionId };
}

function renderCard({ roster, capabilities, pathBySelectionId }) {
  return render(
    <UnitSelectionCard
      selection={roster.forces[0].selections[0]}
      selectedRosterSelection={null}
      setSelectedRosterSelection={vi.fn()}
      roster={roster}
      system={system}
      violations={[]}
      capabilities={capabilities}
      pathBySelectionId={pathBySelectionId}
      costTypeLabel="Pkt"
      removeUnit={vi.fn()}
      copyUnit={vi.fn()}
      subSelectionOperations={{}}
      activeCatalogue={system.catalogues[0]}
    />
  );
}

/**
 * Der Wert der Zelle unter der Kopfzeile `headerName`, in der ersten
 * Daten-Zeile des Statblock-`.profile-table` — nach Spalten-INDEX, nicht durch
 * Scannen aller Zellen (der Wert '9' kommt auch als Ld-Wert vor).
 */
function statblockCellByHeader(container, headerName) {
  const table = container.querySelector('.profile-table');
  const headerCells = Array.from(table.querySelectorAll('thead th'));
  const columnIndex = headerCells.findIndex((th) => th.textContent.trim() === headerName);
  expect(columnIndex, `Kopfzeile ${headerName} fehlt im Statblock`).toBeGreaterThanOrEqual(0);
  const firstDataRow = table.querySelector('tbody tr');
  const cell = firstDataRow.querySelectorAll('td')[columnIndex];
  return cell.textContent.trim();
}

describe('UnitSelectionCard: gegatterte Profilwert-Modifikatoren der Blood-Dragon-Blutlinie erreichen die Statblock-Tabelle (Issue 81)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('zeigt WS "9" und Sv "4+" mit gewaehlter Blood-Dragon-Blutlinie (Kriterien 1, 2, 4)', () => {
    const evaluationResult = evaluation({ withBloodDragon: true });
    // Guard gegen den echten Bericht: der Slot traegt die veraenderten Werte.
    const path = evaluationResult.pathBySelectionId.get('sel-vc');
    const capability = evaluationResult.capabilities.get(path);
    const profileEntry = capability.infoElements.find(
      (element) => element.kind === 'profile' && element.id === 'a106-4a05-36ea-cb01',
    );
    expect(profileEntry.characteristics.find((c) => c.name === 'WS').value).toBe('9');
    expect(profileEntry.characteristics.find((c) => c.name === 'Sv').value).toBe('4+');

    const { container } = renderCard(evaluationResult);

    expect(statblockCellByHeader(container, 'WS')).toBe('9');
    expect(statblockCellByHeader(container, 'Sv')).toBe('4+');
  });

  it('KONTROLLE: zeigt WS "7" und Sv "7" ohne Blutlinie (Kriterium 3)', () => {
    const evaluationResult = evaluation({ withBloodDragon: false });

    const { container } = renderCard(evaluationResult);

    expect(statblockCellByHeader(container, 'WS')).toBe('7');
    expect(statblockCellByHeader(container, 'Sv')).toBe('7');
  });
});
