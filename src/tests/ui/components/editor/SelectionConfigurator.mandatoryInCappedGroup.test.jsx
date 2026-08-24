import React from 'react';
import { describe, test, expect, beforeAll, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import { SelectionConfiguratorHarness as SelectionConfigurator } from '../../../../shared/test-utils/editorHarness';
import { createSubSelectionOperationsMock } from '../../../../shared/test-utils/subSelectionOperationsMock';
import { processImportedData } from '../../../../data/parser/xmlParser.js';
import { resolveEntry } from '../../../../domain/roster/catalogResolver.js';
import { createSelectionFromDef } from '../../../../domain/roster/selectionFactory.js';
import { rootSelectionsOf } from '../../../../domain/roster/rosterTree.js';
import { prepareDataset, evaluate } from '../../../../domain/evaluator/evaluator.js';
import { toEvaluatorRoster } from '../../../../domain/evaluation/rosterAdapter.js';

/**
 * Issue 0143, Kriterium 6 — „Die Wahl einer Option, die in eine Gruppe zieht,
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
 * Die fruehere Zusicherung ueber den *angezeigten* Zustand — die Pflichtwahl
 * sei genommen, ihr Schalter also angehakt (`<input disabled type="checkbox"
 * checked>` auf `origin/main`, `0598752`) — ist mit Issue 0147 (`dce8b91`)
 * ueberholt: Kein nummeriertes Kriterium des Issues hatte das je entschieden;
 * es war eine ausdrueckliche Setzung des Koordinators, solange „angehakt"
 * fuer jede Pflichtwahl galt, egal ob genommen oder offen. Issue 0145 dreht
 * genau das um — eine Pflicht, die der Roster nicht haelt, rendert NICHT mehr
 * angehakt (Kriterium 3) — also traegt diese Setzung nicht mehr. In diesem
 * konkreten Fall stellt sich die Frage ohnehin nicht mehr: `Lore of
 * Necromancy` liegt in einer per Modifikator versteckten Gruppe und erscheint
 * gar nicht mehr auf der Karte (siehe die Assertions unten).
 */

vi.mock('lucide-react', () => ({
  ChevronDown: () => <span data-testid="icon-chevron-down" />,
  ChevronRight: () => <span data-testid="icon-chevron-right" />,
  Plus: () => <span data-testid="icon-plus" />,
  Minus: () => <span data-testid="icon-minus" />,
  Info: ({ onClick, ...rest }) => <span data-testid="icon-info" onClick={onClick} {...rest} />,
  BookOpen: ({ onClick, ...rest }) => <span data-testid="icon-book" onClick={onClick} {...rest} />,
}));

vi.mock('../../../../data/rules/rulesLookup', () => ({ getRuleUrl: () => null }));
vi.mock('../../../../ui/viewmodels/SettingsContext', () => ({
  useSettings: () => ({ whfb6LinkingEnabled: false }),
}));

const CATALOG_DIR = path.resolve('src/domain/evaluator/__fixtures__/whfb6-definitive');
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

// ── DOM-Hilfen: rein beobachtend (Muster aus Issue 0131/0143) ────────────────

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

describe('Eine Pflichtzeile in einer VERSTECKTEN Gruppe wird weder gefordert noch gezeigt', () => {
  // Umgeschrieben mit Issue 0147. Die Vorgaengerfassung nahm an, der Slot sei
  // sichtbar (`isHidden: false`) — das war die Folge einer Luecke der Engine:
  // die Sichtbarkeits-Klammer einer `selectionEntryGroup` erreichte nur den
  // Angebots-Anker, nicht die belegte Auswahl und nicht das Pflicht-Phantom.
  //
  // Der Katalog sagt es deutlich: alle acht `Lores of Magic`-Gruppen der
  // Vampire Counts definitive edition tragen `hidden="true"` **ohne**
  // Aufdeck-Modifikator (z. B. `3e50-5f62-a177-304d`, `.cat:2041`). Nach
  // `docs/battlescribe-data-format.md` §8 versteckt eine versteckte Gruppe,
  // was sie haelt — und die Min-Grenze einer effektiv versteckten Entitaet
  // wird nicht validiert. Die Zeile gehoert also gar nicht auf die Karte, und
  // die Pflicht darf nicht als offen gemeldet werden.
  //
  // Kriterium 6 aus Issue 0143 („die Wahl schreibt dieselbe Operation wie
  // zuvor — also keine") bleibt damit erfuellt, und zwar strenger: es gibt
  // nichts zu klicken. Genau das haelt dieser Test fest.

  test.each(CARDS_WITH_MANDATORY_LORE)(
    `auf "$name" fuehrt der Bericht "${LORE_OF_NECROMANCY}" als verstecktes Pflicht-Phantom`,
    ({ id }) => {
      const { capabilities, pathBySelectionId, selection } = renderCard(id);

      const unitPath = pathBySelectionId.get(selection.id);
      expect(capabilityNamed(capabilities, unitPath, LORE_OF_NECROMANCY), 'der Bericht kennt den Slot')
        .toMatchObject({ anchorKind: 'mandatoryPhantom', effectiveMin: 1, isHidden: true });
    },
  );

  test.each(CARDS_WITH_MANDATORY_LORE)(
    `auf "$name" steht "${LORE_OF_NECROMANCY}" nicht auf der Karte`,
    ({ id }) => {
      const { container } = renderCard(id);

      expect(rowsNamed(container, LORE_OF_NECROMANCY), `"${LORE_OF_NECROMANCY}" bleibt draussen`).toHaveLength(0);
    },
  );

  test(`weder die Gruppe "${LORES_OF_MAGIC}" noch ihre Zeile erzeugt eine Schreiboperation`, () => {
    const operations = createSubSelectionOperationsMock();
    const { container } = renderCard(MASTER_NECROMANCER, operations);

    // Das Aufklappen aller Abschnitte (in `renderCard`) hat bereits jede
    // sichtbare Kopfzeile angeklickt; geschrieben werden darf dabei nichts.
    expect(sectionsOf(container).map(labelOf), `"${LORES_OF_MAGIC}" ist kein Abschnitt der Karte`)
      .not.toContain(LORES_OF_MAGIC);
    expect(writesOf(operations), 'Schreiboperationen beim Aufbau der Karte').toEqual([]);
  });

  test('der Slot bleibt mit seiner Grenze im Bericht — versteckt heisst nicht abwesend', () => {
    // ADR-0035: Verstecktes wird materialisiert und markiert, nicht weggelassen.
    // Nur die Pflicht wird nicht mehr eingefordert.
    const { capabilities, pathBySelectionId, selection } = renderCard(MASTER_NECROMANCER);
    const unitPath = pathBySelectionId.get(selection.id);

    expect(capabilityNamed(capabilities, unitPath, LORE_OF_NECROMANCY)).toMatchObject({
      defId: NECROMANCY_LINK_ID,
      effectiveMin: 1,
      effectiveMax: 1,
      isHidden: true,
    });
  });
});
