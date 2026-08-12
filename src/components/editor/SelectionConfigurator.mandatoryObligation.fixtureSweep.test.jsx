import React from 'react';
import { describe, test, expect, beforeAll, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
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
 * Issue 0145, increment 2, Kriterien 3, 4 und 6 — über ALLE Einheiten der
 * sechs Fixture-Kataloge.
 *
 * Diese Datei kopiert den Durchlauf aus
 * `SelectionConfigurator.groupMembership.fixtureSweep.test.jsx` (Issue 0143)
 * statt ihn zu erweitern — jene Datei ist der eingefrorene Befund von 0143 und
 * bleibt unverändert grün. Der Durchlauf steht hier ein zweites Mal, weil
 * diese Datei je Zeile zusätzlich den Kontroll-Zustand (angehakt/gesperrt/
 * Menge) UND das Ergebnis eines Klicks braucht, was 0143 nicht misst.
 *
 * Population (208 Einheitenkarten), pro Zeile ermittelt:
 * - der Kontroll-Typ (Checkbox/Radio/Mengensteller/kein Kontroll-Element —
 *   letzteres die *Add*-Zeile einer unabhängigen Unter-Einheit),
 * - `checked`/`disabled` bzw. bei einem Mengensteller die Menge und die
 *   `-`/`+`-Sperrung,
 * - der zugehörige Bericht-Slot (per getrimmtem Zeilennamen unter JEDEM
 *   Rahmen der Karte aufgelöst — Muster `offeredUnder`/`childSlots` aus der
 *   0143-Sweep-Datei): `effectiveMin`, `effectiveMax`, `isMandatoryUnmet`,
 *   `isBlocked`,
 * - für jede Pflicht-Zeile zusätzlich, im selben Durchlauf: das Ergebnis
 *   eines Klicks auf den Kontroll-Schalter UND auf die Zeile selbst, mit der
 *   Operations-Attrappe der Karte (zwischen den beiden Klicks geleert).
 *
 * Je Abschnitt, dessen Kopfzeile `option-group-header--error` trägt, werden
 * zusätzlich die Kontroll-Elemente der unmittelbaren Zeilen erfasst
 * (Kriterium 6).
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

const DEFINITIVE_DIR = path.resolve('src/evaluator/__fixtures__/whfb6-definitive');
const LEGACY_DIR = path.resolve('src/__fixtures__/whfb6');
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
const ownRows = (section) =>
  [...section.querySelectorAll('.sub-selection-row')].filter(r => r.closest('.option-group') === section);
const nameOfRow = (row) => row.querySelector('.sub-selection-option-name')?.textContent.trim() ?? '';
const allRows = (root) => [...root.querySelectorAll('.sub-selection-row')];

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

/** Kontroll-Typ einer Zeile und ihr Zustand — rein aus dem DOM gelesen. */
function controlStateOf(row) {
  const checkbox = row.querySelector('input[type="checkbox"]');
  if (checkbox) return { kind: 'checkbox', checked: checkbox.checked, disabled: checkbox.disabled, el: checkbox };
  const radio = row.querySelector('input[type="radio"]');
  if (radio) return { kind: 'radio', checked: radio.checked, disabled: radio.disabled, el: radio };
  const stepper = row.querySelector('.quantity-control');
  if (stepper) {
    const buttons = stepper.querySelectorAll('button');
    const minusButton = buttons[0] ?? null;
    const plusButton = buttons[buttons.length - 1] ?? null;
    const quantityText = stepper.querySelector('.quantity-value')?.textContent?.trim();
    return {
      kind: 'stepper',
      quantity: quantityText === undefined ? undefined : Number(quantityText),
      minusDisabled: minusButton?.disabled ?? null,
      plusDisabled: plusButton?.disabled ?? null,
      minusButton,
      plusButton,
    };
  }
  return { kind: 'none' };
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
 * Name → Capability über ALLE Rahmen der Karte (Einheit und ihre
 * Unter-Auswahlen), nicht versteckte Options-Anker, je Name der erste Treffer.
 * Dasselbe Auflösungsmuster wie `offeredUnder`/`offeredAnywhere` der
 * 0143-Sweep-Datei, hier Capability statt Name zurückgegeben.
 */
function capabilityByNameAcrossFrames(capabilities, pathBySelectionId, selection) {
  const byName = new Map();
  for (const id of selectionIdsOf(selection)) {
    const framePath = pathBySelectionId.get(id);
    if (framePath === undefined) continue;
    for (const capability of childSlots(capabilities, framePath)) {
      if (capability.isHidden) continue;
      if (!OPTION_ANCHOR_KINDS.has(capability.anchorKind)) continue;
      const name = (capability.name || '').trim();
      if (!byName.has(name)) byName.set(name, capability);
    }
  }
  return byName;
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
    forceEntryId: (catalogue.forceEntries?.[0] ?? system.forceEntries?.[0])?.id,
  };
}

/** Ein Zeilen-Befund je gerenderter Zeile, über die ganze Population. */
const rows = [];
/** Ein Befund je Abschnitt mit Fehler-Auszeichnung. */
const errorSections = [];

beforeAll(() => {
  let cardCount = 0;
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
      const operations = createSubSelectionOperationsMock();
      const { container } = render(
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
      expandAll(container);
      cardCount += 1;
      const where = `${spec.cat} / ${entry.name}`;

      const byName = capabilityByNameAcrossFrames(capabilities, pathBySelectionId, selection);

      for (const row of allRows(container)) {
        const name = nameOfRow(row);
        const capability = byName.get(name);
        if (!capability) continue; // keine Zeile ohne Angebot im Bericht (siehe 0143-Sweep)
        const control = controlStateOf(row);
        const isMandatory = capability.effectiveMin === capability.effectiveMax && capability.effectiveMin > 0;

        let writes = null;
        if (isMandatory) {
          writes = { increaseOnControl: false, increaseOnRow: false, decreaseCalled: false };
          const controlEl = control.kind === 'stepper' ? control.plusButton : control.el;
          if (controlEl) {
            operations.increaseCount.mockClear();
            operations.decreaseCount.mockClear();
            fireEvent.click(controlEl);
            writes.increaseOnControl = operations.increaseCount.mock.calls.length > 0;
            if (operations.decreaseCount.mock.calls.length > 0) writes.decreaseCalled = true;

            operations.increaseCount.mockClear();
            operations.decreaseCount.mockClear();
            fireEvent.click(row);
            writes.increaseOnRow = operations.increaseCount.mock.calls.length > 0;
            if (operations.decreaseCount.mock.calls.length > 0) writes.decreaseCalled = true;
          } else {
            // Keine Kontroll-Zeile (z. B. *Add*-Button einer unabhaengigen
            // Unter-Einheit) — nur die Nichtentfernbarkeit wird geprueft.
            operations.decreaseCount.mockClear();
            const button = row.querySelector('button');
            fireEvent.click(button ?? row);
            writes.decreaseCalled = operations.decreaseCount.mock.calls.length > 0;
          }
        }

        rows.push({
          where,
          name,
          control,
          effectiveMin: capability.effectiveMin,
          effectiveMax: capability.effectiveMax,
          isMandatoryUnmet: capability.isMandatoryUnmet,
          isBlocked: capability.isBlocked,
          isMandatory,
          writes,
        });
      }

      for (const section of sectionsOf(container)) {
        const header = ownHeader(section);
        if (!header || !header.className.includes('option-group-header--error')) continue;
        errorSections.push({
          where,
          label: labelOf(section),
          controls: ownRows(section).map(r => controlStateOf(r)),
        });
      }

      cleanup();
    }
  }
  expect(cardCount).toBe(EXPECTED_CARDS);
}, 600000);

// ─────────────────────────────────────────────────────────────────────────────

describe('Issue 0145, increment 2 — alle Einheiten der sechs Fixture-Kataloge', () => {
  test('Positivkontrolle: die unerfuellte Pflicht-Population ist nicht leer', () => {
    // Gemessen auf diesem Stand: 73 Zeilen auf 32 Karten (70 Checkboxen,
    // 3 Mengensteller, keine Radios) — vor Issue 0147 waren es 83; 0147 hat
    // die Lores-of-Magic-Zeilen versteckt, inc-1 hat zwei weitere erfuellt.
    // Die Schwelle steht bewusst als Untergrenze, nicht als exakte Zahl — ein
    // exakter Treffer waere Geisel jeder kuenftigen Evaluator-Aenderung.
    const unmet = rows.filter(r => r.isMandatoryUnmet === true);
    expect(unmet.length, 'Zeilen mit isMandatoryUnmet').toBeGreaterThanOrEqual(50);
    expect(new Set(unmet.map(r => r.where)).size, 'Karten mit mindestens einer offenen Pflicht').toBeGreaterThan(0);
  });

  test('Kriterium 3 (Anzeige): keine Zeile mit isMandatoryUnmet rendert angehakt', () => {
    const offenders = rows
      .filter(r => r.isMandatoryUnmet === true && (r.control.kind === 'checkbox' || r.control.kind === 'radio') && r.control.checked)
      .map(r => `${r.where} / ${r.name}`);
    expect(offenders, 'offen gemeldete, aber angehakte Zeilen').toEqual([]);
  });

  test('Kriterium 3 (Schreiben): jede offene Pflicht-Zeile schreibt increaseCount, keine schreibt decreaseCount', () => {
    const unmet = rows.filter(r => r.isMandatoryUnmet === true);
    const notBlocked = unmet.filter(r => r.isBlocked === false);
    expect(notBlocked.length, 'offene, nicht blockierte Pflicht-Zeilen').toBe(unmet.length);

    const missingOnControl = unmet.filter(r => !r.writes?.increaseOnControl).map(r => `${r.where} / ${r.name}`);
    const missingOnRow = unmet.filter(r => !r.writes?.increaseOnRow).map(r => `${r.where} / ${r.name}`);
    const wroteDecrease = unmet.filter(r => r.writes?.decreaseCalled).map(r => `${r.where} / ${r.name}`);
    expect(missingOnControl, 'Klick auf den Schalter schreibt kein increaseCount').toEqual([]);
    expect(missingOnRow, 'Klick auf die Zeile schreibt kein increaseCount').toEqual([]);
    expect(wroteDecrease, 'ein Klick loeste faelschlich decreaseCount aus').toEqual([]);
  });

  test('Kriterium 4 (Anzeige): jede erfuellte Pflicht-Zeile rendert angehakt/gesperrt bzw. am Minimum mit gesperrtem "-"', () => {
    const met = rows.filter(r => r.isMandatory && r.isMandatoryUnmet === false);
    // Gemessen: 281 Zeilen — 255 Checkbox, 7 Radio, 12 Mengensteller, 7 ohne
    // Kontroll-Element (Add-Button unabhaengiger Unter-Einheiten). Die letzte
    // Gruppe wird hier an der Abwesenheit eines Kontroll-Elements erkannt und
    // von der Anzeige-Zusicherung ausgenommen — fuer sie zaehlt nur, dass
    // kein Klick sie entfernt (naechster Test).
    const withControl = met.filter(r => r.control.kind !== 'none');
    const offenders = withControl.filter(r => {
      if (r.control.kind === 'checkbox' || r.control.kind === 'radio') {
        return !(r.control.checked === true && r.control.disabled === true);
      }
      if (r.control.kind === 'stepper') {
        return !(r.control.quantity === r.effectiveMin && r.control.minusDisabled === true);
      }
      return false;
    }).map(r => `${r.where} / ${r.name}`);
    expect(offenders, 'erfuellte Pflicht-Zeilen, die nicht als genommen rendern').toEqual([]);
  });

  test('Kriterium 4 (kein Entfernen): kein Klick auf eine erfuellte Pflicht-Zeile loest decreaseCount aus', () => {
    const met = rows.filter(r => r.isMandatory && r.isMandatoryUnmet === false);
    const offenders = met.filter(r => r.writes?.decreaseCalled).map(r => `${r.where} / ${r.name}`);
    expect(offenders, 'erfuellte Pflicht-Zeilen, die sich entfernen liessen').toEqual([]);
  });

  test.each([
    ['Vampire Counts (6th definitive edition).cat / Zacharias the Everliving', 'Zombie Dragon'],
    ['Vampire Counts (6th definitive edition).cat / Zacharias the Everliving', 'Magic Level 4'],
    ['Orcs and goblins (6th definitive edition).cat / Wurrzag Ud Ura Zahubu', 'Level 4 Shaman'],
    ["Orcs and goblins (6th definitive edition).cat / Grom the Paunch of Misty Mountain", "Grom's Chariot"],
    ["Orcs and goblins (6th definitive edition).cat / Grom the Paunch of Misty Mountain", 'The Axe of Grom: Elf-Biter'],
    ['Orcs and goblins (6th definitive edition).cat / Azhag the Slaughterer', 'Level 2 Shaman'],
    ['Orcs and goblins (6th definitive edition).cat / Morglum Necksnapper', "Bulak's Bloody Armour (Magic Armour)"],
    ['Orcs and goblins (6th definitive edition).cat / 0-1 Hill Goblins', 'Hand Weapon'],
  ])('Kriterium 4, die vom Issue benannte Zeile "%s" auf "%s" rendert angehakt und gesperrt', (where, name) => {
    const match = rows.find(r => r.where === where && r.name === name);
    expect(match, `Zeile "${name}" auf "${where}" steht im Durchlauf`).toBeTruthy();
    expect(match.isMandatoryUnmet, `"${name}" auf "${where}" ist erfuellt`).toBe(false);
    expect(match.control.checked, `"${name}" auf "${where}" ist angehakt`).toBe(true);
    expect(match.control.disabled, `"${name}" auf "${where}" ist gesperrt`).toBe(true);
  });

  test('Kriterium 6: kein Kontroll-Element in einem Abschnitt mit Fehler-Auszeichnung ist angehakt', () => {
    // Gemessen: 2 Abschnitte im ganzen Korpus, beide die "Herd"-Gruppe von
    // "Night Goblin Squig Herd" (Gruppen-Anker min 10, current 3), beide nur
    // nicht angehakte Checkboxen plus die Mengensteller-Zeile "Night Goblin"
    // bei Menge 3. Ein Mengensteller zaehlt hier bewusst NICHT als "genommen":
    // er hat keinen angehakt/nicht-angehakt-Zustand, sein eigener Slot
    // (min 3, erfuellt) ist zufrieden — der Fehler der Kopfzeile ist das
    // unerfuellte Minimum der GRUPPE (10), nicht ein Widerspruch der Karte.
    expect(errorSections.length, 'Abschnitte mit Fehler-Auszeichnung').toBeGreaterThanOrEqual(1);
    const offenders = errorSections
      .flatMap(s => s.controls.map(c => ({ ...c, where: s.where, label: s.label })))
      .filter(c => (c.kind === 'checkbox' || c.kind === 'radio') && c.checked)
      .map(c => `${c.where} / ${c.label}`);
    expect(offenders, 'angehakte Kontroll-Elemente in einem fehlerhaft ausgezeichneten Abschnitt').toEqual([]);
  });
});
