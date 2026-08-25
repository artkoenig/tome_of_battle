import { describe, test, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { processImportedData } from '../../../platform/battlescribe/xmlParser.js';
import { resolveEntry } from '../../../contexts/armylist/model/catalogResolver.js';
import { createSelectionFromDef } from '../../../contexts/armylist/model/selectionFactory.js';
import { prepareDataset, evaluate } from '../../../contexts/ruleengine/evaluator.js';
import { toEvaluatorRoster } from '../../../contexts/ruleengine/acl/rosterAdapter.js';
import { SlotIndex } from '../../../contexts/ruleengine/readmodel/slotIndex.js';
import EXPECTED_TREES from '../../../contexts/ruleengine/readmodel/__fixtures__/recruit-trees-pre-0157.json';

/**
 * Issue 0157, Kriterium 1 — das Ausheben legt denselben Auswahlbaum an wie vor
 * der Umstellung, ueber ALLE 208 Einheiten der sechs Fixture-Kataloge.
 *
 * Die Erwartung in `__fixtures__/recruit-trees-pre-0157.json` ist der **eingefrorene
 * Befund des Standes vor dieser Aenderung** (Commit 0bb5aa2): dort las die Fabrik
 * die Pflicht selbst aus den Constraints (`mandatoryChildrenOf` +
 * `getMinConstraintValue` mit dem Modifier-Kontext des leeren Kontingents), heute
 * nennt sie der Bericht (`capability.raiseMembers`). Die Datei wurde mit der alten
 * Fabrik erzeugt und ist damit die einzige Stelle, an der "wie heute" ueberhaupt
 * nachpruefbar bleibt — sie wird nie neu erzeugt, sondern gilt.
 *
 * Der Durchlauf ist der Produktionspfad des Aushebens
 * (`useRoster.addUnit`): das Angebot des leeren Kontingents auswerten, den
 * Slot der Einheit darin suchen und seine `raiseMembers` der Fabrik geben.
 */

const DEFINITIVE_DIR = path.resolve('src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive');
const LEGACY_DIR = path.resolve('src/tests/__fixtures__/whfb6');
const DEFINITIVE_GST = 'Warhammer Fantasy Battles (6th definitive edition).gst';
const LEGACY_GST = 'Warhammer Fantasy Battle 6th edition.gst';
const PTS = 'ecfa-8486-4f6c-c249';

/** Dieselben sechs Kataloge wie die Sweep-Dateien — zusammen 208 Einheiten. */
const CATALOGUES = [
  { dir: DEFINITIVE_DIR, gst: DEFINITIVE_GST, cat: 'Vampire Counts (6th definitive edition).cat' },
  { dir: DEFINITIVE_DIR, gst: DEFINITIVE_GST, cat: 'Orcs and goblins (6th definitive edition).cat' },
  { dir: DEFINITIVE_DIR, gst: DEFINITIVE_GST, cat: 'Ogre Kingdoms (6th definitive edition).cat' },
  { dir: LEGACY_DIR, gst: LEGACY_GST, cat: 'Vampire Counts.cat' },
  { dir: LEGACY_DIR, gst: LEGACY_GST, cat: 'Orcs and Goblins.cat' },
  { dir: LEGACY_DIR, gst: LEGACY_GST, cat: 'Ogre Kingdoms.cat' },
];

const EXPECTED_UNITS = 208;

/**
 * Name, Anzahl und Kinder eines Teilbaums — die Reihenfolge der Kinder ist
 * normalisiert, weil sie nicht Teil der Zusicherung ist (der Konfigurator
 * ordnet die Zeilen selbst).
 */
function shapeOf(selection) {
  return {
    name: selection.name,
    number: selection.number,
    children: (selection.selections || [])
      .map(shapeOf)
      .sort((a, b) => `${a.name}${a.number}`.localeCompare(`${b.name}${b.number}`)),
  };
}

/** Ein Teilbaum als Text — ein Unterschied liest sich damit als Zeile. */
function textOf(shape, depth = 0) {
  return [
    `${'  '.repeat(depth)}${shape.name} x${shape.number}`,
    ...shape.children.map(child => textOf(child, depth + 1)),
  ].join('\n');
}

/** Der ausgehobene Baum je `<Katalog> / <Einheit>`. */
const recruited = new Map();

beforeAll(() => {
  for (const spec of CATALOGUES) {
    const gstContent = fs.readFileSync(path.join(spec.dir, spec.gst), 'utf8');
    const catContent = fs.readFileSync(path.join(spec.dir, spec.cat), 'utf8');
    const { system } = processImportedData(
      [{ name: spec.gst, content: gstContent }],
      [{ name: spec.cat, content: catContent }],
    );
    const catalogue = system.catalogues[0];
    const prepared = prepareDataset({ gameSystem: gstContent, catalogues: [catContent] });
    const forceEntryId = (catalogue.forceEntries?.[0] ?? system.forceEntries?.[0])?.id;

    const emptyForceRoster = {
      catalogueId: catalogue.id, name: 'test', costLimit: 3000, costLimitType: PTS,
      forces: [{ id: 'force-1', forceEntryId, catalogueId: catalogue.id, selections: [] }],
    };
    const adapted = toEvaluatorRoster(emptyForceRoster);
    const offer = evaluate(prepared, adapted.evalRoster).capabilities;
    const offerForcePath = adapted.pathByForceId.get('force-1');

    for (const entry of (catalogue.selectionEntries || []).filter(e => e.type === 'unit')) {
      const unit = createSelectionFromDef({
        system, resolveEntry, catalogueId: catalogue.id, entry,
        mandatoryMembers: SlotIndex.fromMaps({ capabilities: offer }).findChildSlot(offerForcePath, entry.id)?.raiseMembers ?? [],
      });
      recruited.set(`${spec.cat} / ${entry.name}`, unit === null ? null : shapeOf(unit));
    }
  }
}, 600000);

describe('Issue 0157, Kriterium 1 — der ausgehobene Baum des eingefrorenen Korpus', () => {
  test('Positivkontrolle: der Durchlauf deckt jede Einheit der Erwartung ab', () => {
    expect(recruited.size, 'ausgehobene Einheiten').toBe(EXPECTED_UNITS);
    expect(Object.keys(EXPECTED_TREES).length, 'Einheiten der eingefrorenen Erwartung').toBe(EXPECTED_UNITS);
    const missing = Object.keys(EXPECTED_TREES).filter(where => !recruited.has(where));
    expect(missing, 'Einheiten der Erwartung ohne Durchlauf').toEqual([]);
  });

  test('Positivkontrolle: die Erwartung ist nicht leer — viele Einheiten bringen Pflicht-Mitglieder mit', () => {
    // Gemessen: 194 der 208 Einheiten legen mindestens ein Pflicht-Mitglied an.
    // Die Schwelle steht als Untergrenze, der gemessene Wert im Kommentar.
    const withMembers = Object.values(EXPECTED_TREES).filter(tree => (tree?.children ?? []).length > 0);
    expect(withMembers.length, 'Einheiten mit Pflicht-Mitgliedern').toBeGreaterThanOrEqual(100);
  });

  test('jede Einheit hebt denselben Baum aus wie vor der Umstellung', () => {
    const offenders = [];
    for (const [where, expected] of Object.entries(EXPECTED_TREES)) {
      const actual = recruited.get(where) ?? null;
      const expectedText = expected === null ? 'null' : textOf(expected);
      const actualText = actual === null ? 'null' : textOf(actual);
      if (expectedText !== actualText) {
        offenders.push(`${where}\n--- vorher\n${expectedText}\n--- jetzt\n${actualText}`);
      }
    }
    expect(offenders, 'Einheiten mit veraendertem Aushebe-Baum').toEqual([]);
  });
});
