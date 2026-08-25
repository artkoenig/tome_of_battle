import React from 'react';
import { describe, test, expect, beforeAll, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import { SelectionConfiguratorHarness as SelectionConfigurator } from '../../../../tests/test-utils/editorHarness';
import { createSubSelectionOperationsMock } from '../../../../tests/test-utils/subSelectionOperationsMock';
import { processImportedData } from '../../../../data/parser/xmlParser.js';
import { resolveEntry } from '../../../../domain/roster/catalogResolver.js';
import { createSelectionFromDef } from '../../../../domain/roster/selectionFactory.js';
import { rootSelectionsOf } from '../../../../domain/roster/rosterTree.js';
import { prepareDataset, evaluate } from '../../../../domain/evaluator/evaluator.js';
import { toEvaluatorRoster } from '../../../../contexts/ruleengine/acl/rosterAdapter.js';

/**
 * Issue 0143, Kriterium 2 und 4 (und der Breitentest zu Kriterium 7) — ueber
 * ALLE Einheiten der sechs Fixture-Kataloge.
 *
 * Jede Einheit (`type="unit"`) der drei Kataloge unter
 * `src/domain/evaluator/__fixtures__/whfb6-definitive/` und der drei unter
 * `src/tests/__fixtures__/whfb6/` wird als frisch ausgehobene Karte durch die
 * Produktionsnaht gerendert (processImportedData → createSelectionFromDef →
 * toEvaluatorRoster → prepareDataset/evaluate → SelectionConfigurator), voll
 * aufgeklappt und beobachtet. Das sind 208 Karten; der Durchlauf steht einmal
 * in `beforeAll`, damit jedes Kriterium seine eigene, unabhaengig lesbare
 * Zusicherung bekommt.
 *
 * Kriterium 4 ist ein Vorher/Nachher-Vergleich. Er ist hier als eigenstaendige
 * Zusicherung ausgedrueckt, die vorher wie nachher gelten muss: **die Zeilen
 * der Karte sind das Angebot des Berichts** — der Bericht ist von dieser
 * Aenderung nicht beruehrt, also bricht jede hinzugefuegte oder verlorene Zeile
 * diese Gleichheit. Damit braucht es kein eingefrorenes Erzeugnis des heutigen
 * Standes. Zwei Zusicherungen, weil eine Karte auch Zeilen fremder Rahmen
 * zeigen kann (die Unter-Auswahl einer belegten Zeile rendert eingerueckt in
 * `.nested-option-block`):
 *
 *   1. Die Zeilen der Einheit selbst — alle ausserhalb jedes
 *      `.nested-option-block` — sind **genau** die nicht versteckten
 *      Options-Anker unter ihrem eigenen Slot-Pfad.
 *   2. Jede Zeile der Karte, eingerueckte eingeschlossen, benennt eine Option,
 *      die der Bericht irgendwo unter dieser Karte anbietet. Keine Zeile
 *      entsteht aus dem Nichts.
 */

vi.mock('lucide-react', () => ({
  ChevronDown: () => <span data-testid="icon-chevron-down" />,
  ChevronRight: () => <span data-testid="icon-chevron-right" />,
  Plus: () => <span data-testid="icon-plus" />,
  Minus: () => <span data-testid="icon-minus" />,
  Info: ({ onClick, ...rest }) => <span data-testid="icon-info" onClick={onClick} {...rest} />,
  BookOpen: ({ onClick, ...rest }) => <span data-testid="icon-book" onClick={onClick} {...rest} />,
}));

vi.mock('../../../../domain/rules/rulesLookup', () => ({ getRuleUrl: () => null }));
vi.mock('../../../../ui/viewmodels/SettingsContext', () => ({
  useSettings: () => ({ whfb6LinkingEnabled: false }),
}));

const DEFINITIVE_DIR = path.resolve('src/domain/evaluator/__fixtures__/whfb6-definitive');
const LEGACY_DIR = path.resolve('src/tests/__fixtures__/whfb6');
const DEFINITIVE_GST = 'Warhammer Fantasy Battles (6th definitive edition).gst';
const LEGACY_GST = 'Warhammer Fantasy Battle 6th edition.gst';
const PTS = 'ecfa-8486-4f6c-c249';

/** Die sechs Kataloge, die das Issue nennt — zusammen 208 Einheiten. */
const CATALOGUES = [
  { dir: DEFINITIVE_DIR, gst: DEFINITIVE_GST, cat: 'Vampire Counts (6th definitive edition).cat' },
  { dir: DEFINITIVE_DIR, gst: DEFINITIVE_GST, cat: 'Orcs and goblins (6th definitive edition).cat' },
  { dir: DEFINITIVE_DIR, gst: DEFINITIVE_GST, cat: 'Ogre Kingdoms (6th definitive edition).cat' },
  { dir: LEGACY_DIR, gst: LEGACY_GST, cat: 'Vampire Counts.cat' },
  { dir: LEGACY_DIR, gst: LEGACY_GST, cat: 'Orcs and Goblins.cat' },
  { dir: LEGACY_DIR, gst: LEGACY_GST, cat: 'Ogre Kingdoms.cat' },
];

const EXPECTED_CARDS = 208;

/** Die Ankerarten, deren Slots als Options-Zeilen erscheinen (ADR-0035/0036). */
const OPTION_ANCHOR_KINDS = new Set(['occupied', 'offerAnchor', 'mandatoryPhantom']);

// ── DOM-Hilfen: rein beobachtend (Muster aus Issue 0131) ─────────────────────

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
const enclosingSection = (section) => section.parentElement?.closest('.option-group') ?? null;
const childSections = (section) => sectionsOf(section).filter(s => enclosingSection(s) === section);
const ownRows = (section) =>
  [...section.querySelectorAll('.sub-selection-row')].filter(r => r.closest('.option-group') === section);
const nameOfRow = (row) => row.querySelector('.sub-selection-option-name')?.textContent.trim() ?? '';
const allRows = (root) => [...root.querySelectorAll('.sub-selection-row')];
/** Die Zeilen des Rahmens der Karte selbst — nicht die einer belegten Unter-Auswahl. */
const ownFrameRows = (root) => allRows(root).filter(r => !r.closest('.nested-option-block'));

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

// ── Das Angebot des Berichts, unabhaengig vom Konfigurator gelesen ───────────

/** Alle Selection-Ids eines Einheiten-Teilbaums (jede ist ein Rahmen). */
function selectionIdsOf(selection, into = []) {
  into.push(selection.id);
  (selection.selections || []).forEach(child => selectionIdsOf(child, into));
  return into;
}

/** Die unmittelbaren Kind-Slots eines Rahmen-Pfads. */
function childSlots(capabilities, framePath) {
  const found = [];
  for (const [slotPath, capability] of capabilities) {
    if (!slotPath.startsWith(`${framePath}/`)) continue;
    if (slotPath.slice(framePath.length + 1).includes('/')) continue;
    found.push(capability);
  }
  return found;
}

/**
 * Die Namen der Optionen, die der Bericht unter einem Rahmen anbietet: jeder
 * nicht versteckte Options-Anker, je Definition einmal.
 */
function offeredUnder(capabilities, framePath) {
  const names = [];
  const seen = new Set();
  for (const capability of childSlots(capabilities, framePath)) {
    if (capability.isHidden) continue;
    if (!OPTION_ANCHOR_KINDS.has(capability.anchorKind)) continue;
    if (seen.has(capability.defId)) continue;
    seen.add(capability.defId);
    names.push((capability.name || '').trim());
  }
  return names;
}

/** Dasselbe ueber alle Rahmen der Karte — die Einheit und ihre Unter-Auswahlen. */
function offeredAnywhere(capabilities, pathBySelectionId, selection) {
  const names = [];
  for (const id of selectionIdsOf(selection)) {
    const framePath = pathBySelectionId.get(id);
    if (framePath === undefined) continue;
    names.push(...offeredUnder(capabilities, framePath));
  }
  return names;
}

// ── Der Durchlauf ────────────────────────────────────────────────────────────

function loadCatalogue({ dir, gst, cat }) {
  const gstContent = fs.readFileSync(path.join(dir, gst), 'utf8');
  const catContent = fs.readFileSync(path.join(dir, cat), 'utf8');
  const system = processImportedData(
    [{ name: gst, content: gstContent }],
    [{ name: cat, content: catContent }],
  ).system;
  const catalogue = system.catalogues[0];
  return {
    system,
    catalogue,
    prepared: prepareDataset({ gameSystem: gstContent, catalogues: [catContent] }),
    // Die definitive Edition fuehrt ihre Kontingente im Katalog, die aeltere im Spielsystem.
    forceEntryId: (catalogue.forceEntries?.[0] ?? system.forceEntries?.[0])?.id,
  };
}

const sorted = (names) => [...names].sort();

/** Ein Befund je Karte, gesammelt in einem einzigen Renderlauf. */
const cards = [];

beforeAll(() => {
  for (const spec of CATALOGUES) {
    const { system, catalogue, prepared, forceEntryId } = loadCatalogue(spec);
    expect(forceEntryId, `Kontingent fuer ${spec.cat}`).toBeTruthy();

    for (const entry of (catalogue.selectionEntries || []).filter(e => e.type === 'unit')) {
      const unit = createSelectionFromDef({ system, resolveEntry, catalogueId: catalogue.id, entry });
      const roster = {
        catalogueId: catalogue.id,
        name: 'test',
        costLimit: 3000,
        costLimitType: PTS,
        forces: [{ id: 'force-1', forceEntryId, catalogueId: catalogue.id, selections: [unit] }],
      };
      const { evalRoster, pathBySelectionId } = toEvaluatorRoster(roster);
      const { capabilities } = evaluate(prepared, evalRoster);
      const selection = rootSelectionsOf(roster)[0];
      const { container } = render(
        <SelectionConfigurator
          selection={selection}
          capabilities={capabilities}
          pathBySelectionId={pathBySelectionId}
          system={system}
          roster={roster}
          subSelectionOperations={createSubSelectionOperationsMock()}
          activeCatalogue={catalogue}
          handleMouseEnter={vi.fn()}
          handleMouseMove={vi.fn()}
          handleMouseLeave={vi.fn()}
          setActiveInfo={vi.fn()}
          onShowRule={vi.fn()}
        />
      );
      expandAll(container);

      const sections = sectionsOf(container);
      cards.push({
        where: `${spec.cat} / ${entry.name}`,
        sectionCount: sections.length,
        untitledCount: sections.filter(s => labelOf(s) === '').length,
        barrenLabels: sections
          .filter(s => ownRows(s).length === 0 && childSections(s).length === 0)
          .map(labelOf),
        ownFrameRows: sorted(ownFrameRows(container).map(nameOfRow)),
        offeredAtUnit: sorted(offeredUnder(capabilities, pathBySelectionId.get(selection.id))),
        allRows: sorted(allRows(container).map(nameOfRow)),
        offeredAnywhere: sorted(offeredAnywhere(capabilities, pathBySelectionId, selection)),
      });
      cleanup();
    }
  }
}, 600000);

// ─────────────────────────────────────────────────────────────────────────────

describe('Issue 0143 — alle Einheiten der sechs Fixture-Kataloge', () => {
  test('der Durchlauf deckt die 208 Einheitenkarten ab und rendert Abschnitte (Positivkontrolle)', () => {
    expect(cards).toHaveLength(EXPECTED_CARDS);
    expect(cards.filter(c => c.sectionCount > 0).length,
      'Karten mit mindestens einem Abschnitt').toBeGreaterThan(100);
  });

  test('Kriterium 2 — keine Einheitenkarte rendert einen Abschnitt mit leerem Titel', () => {
    const offenders = cards
      .filter(c => c.untitledCount > 0)
      .map(c => `${c.where}: ${c.untitledCount}`);
    expect(offenders, 'Karten mit titellosen Abschnitten').toEqual([]);
    expect(cards.reduce((sum, c) => sum + c.untitledCount, 0),
      'titellose Abschnitte insgesamt').toBe(0);
  });

  test('Kriterium 4 — jede Karte zeigt fuer die Einheit selbst genau die Optionen, die der Bericht ihr anbietet', () => {
    const offenders = cards
      .filter(c => JSON.stringify(c.ownFrameRows) !== JSON.stringify(c.offeredAtUnit))
      .map(c => ({
        where: c.where,
        nurAufDerKarte: c.ownFrameRows.filter(n => !c.offeredAtUnit.includes(n)),
        nurImBericht: c.offeredAtUnit.filter(n => !c.ownFrameRows.includes(n)),
      }));
    expect(offenders, 'Karten, deren Zeilen vom Angebot des Berichts abweichen').toEqual([]);
  });

  test('Kriterium 4 — auch eingerueckt entsteht keine Zeile, die der Bericht nicht anbietet', () => {
    const offenders = cards
      .filter(c => c.allRows.some(n => !c.offeredAnywhere.includes(n)))
      .map(c => `${c.where}: ${JSON.stringify(c.allRows.filter(n => !c.offeredAnywhere.includes(n)))}`);
    expect(offenders, 'Karten mit Zeilen ohne Angebot im Bericht').toEqual([]);
  });

  test('Kriterium 7 — keine Karte rendert einen Abschnitt ohne Zeilen UND ohne Mitgliedsgruppen', () => {
    const offenders = cards
      .filter(c => c.barrenLabels.length > 0)
      .map(c => `${c.where}: ${JSON.stringify(c.barrenLabels)}`);
    expect(offenders, 'Karten mit inhaltslosen Abschnitten').toEqual([]);
  });
});
