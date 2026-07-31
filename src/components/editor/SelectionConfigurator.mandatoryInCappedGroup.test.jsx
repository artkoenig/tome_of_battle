import React from 'react';
import { describe, test, expect, beforeAll, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import SelectionConfigurator from './SelectionConfigurator';
import { createSubSelectionOperationsMock } from '../../test-utils/subSelectionOperationsMock';
import { processImportedData } from '../../parser/xmlParser.js';
import { resolveEntry } from '../../roster/catalogResolver.js';
import { createSelectionFromDef } from '../../roster/selectionFactory.js';
import { rootSelectionsOf } from '../../roster/rosterTree.js';
import { prepareDataset, evaluate } from '../../evaluator/evaluator.js';
import { toEvaluatorRoster } from '../../evaluation/rosterAdapter.js';

/**
 * Issue 0140, Kriterium 6 — „Die Wahl einer Option, die in eine Gruppe zieht,
 * loest dieselbe Schreiboperation an derselben Zielselektion aus wie vor dieser
 * Aenderung."
 *
 * Diese Datei haelt den Fall fest, den die bestehenden Kriterium-6-Tests nicht
 * erreichen: eine **Pflicht-Zeile** (`anchorKind: "mandatoryPhantom"`,
 * `effectiveMin: 1`), die in eine Gruppe **mit Obergrenze** zieht.
 * `Blood Drinker` und `Frostblade` liegen in `Magic Weapons (VC)`, einer Gruppe
 * ohne `max` — sie nehmen den Radio-Zweig nie.
 *
 * Gemessener Fall: `Lore of Necromancy` (Link `09ca-8236-8226-79c0`) auf dem
 * `Master Necromancer` (`4ee2-ac3a-3cc6-11af`) der Vampire Counts definitive
 * edition. Der Katalog gibt der umschliessenden Gruppe
 * `<selectionEntryGroup name="Lores of Magic" id="3e50-5f62-a177-304d">` eine
 * `max 1 selections`-Grenze (`.cat:2041`), der Link selbst traegt
 * `min 1 selections` (`.cat:2046`) — es ist eine Pflichtwahl ohne Alternative,
 * denn die Schwester `Lore of Death` ist per Modifikator versteckt.
 *
 * **Vorher** (`origin/main`, `0598752`) stand die Zeile ausserhalb jeder Gruppe;
 * ein Klick auf ihren Schalter schrieb **nichts**. Kriterium 6 verlangt genau
 * dies auch nach der Aenderung: dieselbe Schreiboperation — also keine.
 *
 * Gefahren wird durch die Produktionsnaht (processImportedData →
 * createSelectionFromDef → toEvaluatorRoster → prepareDataset/evaluate →
 * SelectionConfigurator), wie in
 * `SelectionConfigurator.groupMembership.test.jsx`; nur Regel-Link-Nachschlag
 * und Settings-Kontext sind gestubbt.
 *
 * Beobachtet wird, WELCHE Operation der Klick ausloest — nicht, wie der
 * Konfigurator zu seinem Schalter kommt.
 *
 * Dazu kommt eine Zusicherung ueber den *angezeigten* Zustand: die Pflichtwahl
 * ist genommen, ihr Schalter also angehakt. Kein nummeriertes Kriterium des
 * Issues entscheidet das; es ist eine ausdrueckliche Setzung des Koordinators,
 * weil Schreiben und Anzeige hier ein Defekt in einem Zweig sind und eine
 * Pflichtwahl sonst sichtbar ungenommen aussieht. Auf `origin/main` (`0598752`)
 * stand dort `<input disabled type="checkbox" checked>`.
 *
 * **Nicht** zugesichert ist `disabled`: das ist nur EIN Weg, nicht zu
 * schreiben — dass nichts geschrieben wird, halten die Klick-Tests bereits
 * fest, und ein aktiver Schalter, der nichts tut, genuegt Kriterium 6 ebenso.
 */

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

const CATALOG_DIR = path.resolve('src/evaluator/__fixtures__/whfb6-definitive');
const GST_FILE = 'Warhammer Fantasy Battles (6th definitive edition).gst';
const CAT_FILE = 'Vampire Counts (6th definitive edition).cat';
const PTS = 'ecfa-8486-4f6c-c249';
const STANDARD_FORCE_ID = 'e989-15b8-7eb6-9668';   // <forceEntry name="Standard (VC-AB)">

const LORE_OF_NECROMANCY = 'Lore of Necromancy';
const LORES_OF_MAGIC = 'Lores of Magic';

const MASTER_NECROMANCER = '4ee2-ac3a-3cc6-11af';
const NECROMANCY_LINK_ID = '09ca-8236-8226-79c0';   // entryLink in Gruppe 3e50-5f62-a177-304d

/**
 * Die fuenf Karten der Vampire Counts definitive edition, auf denen dieselbe
 * Gestalt vorkommt: eine Pflichtzeile `Lore of Necromancy` in einer
 * `Lores of Magic`-Gruppe mit `max 1`.
 */
const CARDS_WITH_MANDATORY_LORE = [
  { name: 'Master Necromancer', id: MASTER_NECROMANCER },
  { name: '0-1 Vampire Lord', id: 'b77b-88d5-5e80-e178' },
  { name: 'Vampire Count', id: '6822-0110-a7c9-cbb0' },
  { name: 'Zacharias the Everliving', id: '1c05-5813-2f0c-f878' },
  { name: 'Sethep, the Merciless', id: '5cd5-ef10-90c3-cd40' },
];

let system;
let catalogue;
let prepared;

beforeAll(() => {
  const gstContent = fs.readFileSync(path.join(CATALOG_DIR, GST_FILE), 'utf8');
  const catContent = fs.readFileSync(path.join(CATALOG_DIR, CAT_FILE), 'utf8');
  system = processImportedData(
    [{ name: GST_FILE, content: gstContent }],
    [{ name: CAT_FILE, content: catContent }],
  ).system;
  catalogue = system.catalogues[0];
  prepared = prepareDataset({ gameSystem: gstContent, catalogues: [catContent] });
});

function buildRoster(unitId) {
  const entry = catalogue.selectionEntries.find(e => e.id === unitId);
  expect(entry, `Einheit ${unitId} steht im Katalog`).toBeTruthy();
  const unit = createSelectionFromDef({ system, resolveEntry, catalogueId: catalogue.id, entry });
  return {
    catalogueId: catalogue.id,
    name: 'test',
    costLimit: 3000,
    costLimitType: PTS,
    forces: [{ id: 'force-1', forceEntryId: STANDARD_FORCE_ID, catalogueId: catalogue.id, selections: [unit] }],
  };
}

/** Eine frisch ausgehobene Karte, voll aufgeklappt. */
function renderCard(unitId, operations = createSubSelectionOperationsMock()) {
  const roster = buildRoster(unitId);
  const { evalRoster, pathBySelectionId } = toEvaluatorRoster(roster);
  const { capabilities } = evaluate(prepared, evalRoster);
  const selection = rootSelectionsOf(roster)[0];
  const view = render(
    <SelectionConfigurator
      selection={selection}
      capabilities={capabilities}
      pathBySelectionId={pathBySelectionId}
      system={system}
      roster={roster}
      subSelectionOperations={operations}
      activeCatalogue={catalogue}
      handleMouseEnter={vi.fn()}
      handleMouseMove={vi.fn()}
      handleMouseLeave={vi.fn()}
      setActiveInfo={vi.fn()}
      onShowRule={vi.fn()}
    />
  );
  expandAll(view.container);
  return { ...view, capabilities, pathBySelectionId, selection, operations };
}

// ── DOM-Hilfen: rein beobachtend (Muster aus Issue 0131/0140) ────────────────

const ownHeader = (section) => {
  const header = section.querySelector('.option-group-header');
  return header && header.closest('.option-group') === section ? header : null;
};

function labelOf(section) {
  const header = ownHeader(section);
  if (!header) return '';
  const title = header.querySelector('.text-ui-title') || header;
  const limit = title.querySelector('.option-group-limit');
  const full = title.textContent || '';
  return (limit ? full.replace(limit.textContent, '') : full).trim();
}

const sectionsOf = (root) => [...root.querySelectorAll('.option-group')];
const allRows = (root) => [...root.querySelectorAll('.sub-selection-row')];
const nameOfRow = (row) => row.querySelector('.sub-selection-option-name')?.textContent.trim() ?? '';
const rowsNamed = (root, name) => allRows(root).filter(r => nameOfRow(r) === name);

function expandAll(root, rounds = 12) {
  for (let i = 0; i < rounds; i += 1) {
    const collapsed = sectionsOf(root).filter(s => {
      const header = ownHeader(s);
      return header && header.querySelector('[data-testid="icon-chevron-right"]');
    });
    if (collapsed.length === 0) return;
    collapsed.forEach(s => fireEvent.click(ownHeader(s)));
  }
}

/** Der Slot des Berichts unter `parentPath` mit diesem Namen (getrimmt). */
function capabilityNamed(capabilities, parentPath, name) {
  for (const [slotPath, capability] of capabilities) {
    if (!slotPath.startsWith(`${parentPath}/`)) continue;
    if ((capability.name || '').trim() === name) return capability;
  }
  return undefined;
}

/** Ein Argument lesbar machen, ohne ganze Selektionsbaeume auszuschreiben. */
const showArg = (a) =>
  (a && typeof a === 'object') ? `{${a.id ?? a.defId ?? Object.keys(a).join(',')}}` : String(a);

/** Alle ausgeloesten Schreiboperationen als lesbare Liste. */
const writesOf = (operations) =>
  Object.entries(operations).flatMap(([name, fn]) =>
    fn.mock.calls.map(call => `${name}(${call.map(showArg).join(', ')})`));

/** Der Wahlschalter einer Zeile — Radio oder Checkbox, je nach Gruppe. */
const controlOf = (row) => row.querySelector('input[type="radio"], input[type="checkbox"]');

// ─────────────────────────────────────────────────────────────────────────────

describe('Kriterium 6 — eine Pflichtzeile in einer begrenzten Gruppe schreibt weiterhin nichts', () => {
  test(`"${LORE_OF_NECROMANCY}" auf dem Master Necromancer: der Klick auf den Schalter loest keine Schreiboperation aus`, () => {
    const operations = createSubSelectionOperationsMock();
    const { container, capabilities, pathBySelectionId, selection } = renderCard(MASTER_NECROMANCER, operations);

    // Vorbedingung am echten Bericht: eine Pflichtwahl, nicht versteckt.
    const unitPath = pathBySelectionId.get(selection.id);
    expect(capabilityNamed(capabilities, unitPath, LORE_OF_NECROMANCY), 'der Bericht kennt den Slot')
      .toMatchObject({
        anchorKind: 'mandatoryPhantom',
        effectiveMin: 1,
        effectiveMax: 1,
        isHidden: false,
        defId: NECROMANCY_LINK_ID,
      });

    // Vorbedingung am DOM: genau eine Zeile, mit einem Schalter.
    const rows = rowsNamed(container, LORE_OF_NECROMANCY);
    expect(rows, `"${LORE_OF_NECROMANCY}" steht genau einmal auf der Karte`).toHaveLength(1);
    const control = controlOf(rows[0]);
    expect(control, `"${LORE_OF_NECROMANCY}" hat einen Wahlschalter`).toBeTruthy();

    fireEvent.click(control);

    // Vor der Aenderung schrieb dieser Klick nichts — dabei muss es bleiben.
    expect(writesOf(operations), 'Schreiboperationen nach dem Klick auf die Pflichtzeile').toEqual([]);
  });

  test(`Wiederholung: zweimal auf "${LORE_OF_NECROMANCY}" geklickt schreibt immer noch nichts`, () => {
    const operations = createSubSelectionOperationsMock();
    const { container } = renderCard(MASTER_NECROMANCER, operations);

    const control = controlOf(rowsNamed(container, LORE_OF_NECROMANCY)[0]);
    expect(control, `"${LORE_OF_NECROMANCY}" hat einen Wahlschalter`).toBeTruthy();

    fireEvent.click(control);
    fireEvent.click(control);

    expect(writesOf(operations), 'Schreiboperationen nach zwei Klicks').toEqual([]);
  });

  test.each(CARDS_WITH_MANDATORY_LORE.filter(c => c.id !== MASTER_NECROMANCER))(
    'dieselbe Gestalt auf "$name": der Klick auf die Pflichtzeile loest keine Schreiboperation aus',
    ({ id }) => {
      const operations = createSubSelectionOperationsMock();
      const { container, capabilities, pathBySelectionId, selection } = renderCard(id, operations);

      const unitPath = pathBySelectionId.get(selection.id);
      expect(capabilityNamed(capabilities, unitPath, LORE_OF_NECROMANCY), 'der Bericht kennt den Slot')
        .toMatchObject({ anchorKind: 'mandatoryPhantom', effectiveMin: 1, isHidden: false });

      const rows = rowsNamed(container, LORE_OF_NECROMANCY);
      expect(rows, `"${LORE_OF_NECROMANCY}" steht genau einmal auf der Karte`).toHaveLength(1);
      const control = controlOf(rows[0]);
      expect(control, `"${LORE_OF_NECROMANCY}" hat einen Wahlschalter`).toBeTruthy();

      fireEvent.click(control);

      expect(writesOf(operations), 'Schreiboperationen nach dem Klick auf die Pflichtzeile').toEqual([]);
    },
  );

  test(`Grenzfall: die Pflichtzeile liegt im Abschnitt "${LORES_OF_MAGIC}" und ist dort die einzige Zeile — trotzdem schreibt ihr Schalter nichts`, () => {
    const operations = createSubSelectionOperationsMock();
    const { container } = renderCard(MASTER_NECROMANCER, operations);

    // Die Gruppe mit `max 1` ist der Grund, aus dem die Zeile ueberhaupt zum
    // Radio wird: erst ihre Grenze fuehrt in den Radio-Zweig.
    const row = rowsNamed(container, LORE_OF_NECROMANCY)[0];
    expect(row, `"${LORE_OF_NECROMANCY}" steht auf der Karte`).toBeTruthy();
    const holder = row.closest('.option-group');
    expect(holder, `"${LORE_OF_NECROMANCY}" steht in einem Abschnitt`).toBeTruthy();
    expect(labelOf(holder)).toBe(LORES_OF_MAGIC);

    fireEvent.click(controlOf(row));

    expect(writesOf(operations), `Schreiboperationen nach dem Klick in "${LORES_OF_MAGIC}"`).toEqual([]);
  });
});
