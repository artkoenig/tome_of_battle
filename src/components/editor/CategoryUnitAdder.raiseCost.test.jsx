/**
 * Der Aushebe-Dialog zeigt den **Aushebepreis**, nicht nur die Eigenkosten des
 * Eintrags: was eine Einheit kostet, wenn sie mit ihren Pflicht-Unterauswahlen
 * ausgehoben wird.
 *
 * Bei einer Einheit, deren Punkte an ihren Modellen hängen — im echten
 * Vampirfürsten-Katalog die Regel, nicht die Ausnahme: „Grave Guard" trägt
 * selbst 0 Punkte, seine 10 Pflicht-Modelle 12 Punkte je Stück — meldete der
 * Bericht am Angebots-Anker `costs` 0, und der Dialog zeigte deshalb gar
 * keinen Preis an (`points > 0` blendet 0 aus).
 *
 * Seam: die **echten** Fixtures (`src/__fixtures__/whfb6/`) durch
 * `processImportedData` und die echte Evaluator-Fassade
 * (`prepareDataset`/`evaluate`/`toEvaluatorRoster`) — der Punkt dieser Fälle
 * ist gerade diese Katalogdaten. Jeder Fall prüft seine Annahme zuerst gegen
 * den echten Bericht (Guard-Assert), bevor er das DOM liest; der
 * Übereinstimmungs-Fall hebt zusätzlich über die echte Selektions-Fabrik aus
 * und vergleicht gegen deren Preis, statt gegen eine handgerechnete Zahl.
 */

import fs from 'fs';
import path from 'path';
import React from 'react';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import CategoryUnitAdder from './CategoryUnitAdder';
import { processImportedData } from '../../parser/xmlParser.js';
import { prepareDataset, evaluate } from '../../evaluator/evaluator.js';
import { toEvaluatorRoster } from '../../evaluation/rosterAdapter.js';
import { resolveEntry, findEntryInSystem } from '../../roster';
import { getSelectionTotalCost, TOP_LEVEL_PARENT_COUNT } from '../../roster/rosterCounter.js';
import { createSelectionFromDef } from '../../roster/selectionFactory.js';

vi.mock('lucide-react', () => ({
  Plus: () => <span data-testid="icon-plus" />,
  X: () => <span data-testid="icon-x" />,
}));

// Die Kinder der BottomSheet inline rendern, sobald sie offen ist (kein Portal).
vi.mock('./BottomSheet', () => ({
  default: ({ isOpen, children }) => (isOpen ? <div data-testid="sheet">{children}</div> : null),
}));

const FIXTURE_DIR = path.resolve(process.cwd(), 'src/__fixtures__/whfb6');
const GAME_SYSTEM_XML = fs.readFileSync(
  path.join(FIXTURE_DIR, 'Warhammer Fantasy Battle 6th edition.gst'), 'utf-8');
const CATALOGUE_XML = fs.readFileSync(path.join(FIXTURE_DIR, 'Vampire Counts.cat'), 'utf-8');

/** Kategorien des Spielsystems, an denen die beiden Fälle hängen. */
const SPECIAL_CATEGORY_ID = '43cc-fc3f-35a7-8d03';
const HEROES_CATEGORY_ID = 'c16b-f319-2c62-2c12';

/** Der Slot-Pfad des einen Kontingents (Pfad-Schema der Fassade). */
const FORCE_PATH = '0';

// Der Fixture-Parse dominiert die Laufzeit — einmal je Datei, nicht je Fall.
let system;
let catalogue;
let costTypeId;
let roster;
let capabilities;

beforeAll(() => {
  ({ system } = processImportedData(
    [{ name: 'whfb6.gst', content: GAME_SYSTEM_XML }],
    [{ name: 'Vampire Counts.cat', content: CATALOGUE_XML }],
  ));
  catalogue = system.catalogues[0];
  costTypeId = system.costTypes[0].id;
  const forceEntry = system.forceEntries[0];
  roster = {
    id: 'roster-uuid',
    name: 'Test Roster',
    systemId: system.id,
    catalogueId: catalogue.id,
    costLimit: 2000,
    costLimitType: costTypeId,
    forces: [{
      id: 'force-uuid-1',
      forceEntryId: forceEntry.id,
      catalogueId: catalogue.id,
      selections: [],
    }],
  };
  const prepared = prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [CATALOGUE_XML] });
  const { evalRoster } = toEvaluatorRoster(roster);
  capabilities = evaluate(prepared, evalRoster).capabilities;
});

/** Die Capability eines Angebots unter dem Kontingent, per Anzeigenamen. */
function offerNamed(name) {
  for (const [path_, capability] of capabilities) {
    if (!path_.startsWith(`${FORCE_PATH}/`)) continue;
    if (capability.name === name) return capability;
  }
  return undefined;
}

/** Der Preis, den das tatsächliche Ausheben über die Selektions-Fabrik anlegt. */
function costOfActuallyRecruiting(defId) {
  const entry = findEntryInSystem(system, defId, catalogue.id);
  const selection = createSelectionFromDef({
    system, resolveEntry, catalogueId: catalogue.id, entry,
  });
  return getSelectionTotalCost(selection, costTypeId, TOP_LEVEL_PARENT_COUNT, {
    system, roster, currentCatalogueId: catalogue.id,
  });
}

function renderAdder(categoryId, categoryName) {
  cleanup();
  render(
    <CategoryUnitAdder
      categoryId={categoryId}
      categoryName={categoryName}
      capabilities={capabilities}
      forcePath={FORCE_PATH}
      forceCatalogueId={catalogue.id}
      system={system}
      activeCatalogue={catalogue}
      roster={roster}
      costTypeLabel="Pkt"
      costLimitType={costTypeId}
      addUnit={vi.fn()}
    />
  );
  fireEvent.click(screen.getByTitle(`${categoryName} ausheben`));
}

/** Die Zeile eines Kandidaten im geöffneten Dialog. */
function rowOf(name) {
  return screen.getByText(name).closest('.popover-item');
}

describe('CategoryUnitAdder: Aushebepreis statt bloßer Eigenkosten', () => {
  it('zeigt den Preis einer Einheit, deren Punkte an ihren Pflicht-Modellen hängen (Grave Guard)', () => {
    // Guard gegen den echten Bericht: der Eintrag selbst kostet nichts — genau
    // deshalb stand hier bisher gar kein Preis.
    const graveGuard = offerNamed('Grave Guard');
    expect(graveGuard).toMatchObject({ anchorKind: 'offerAnchor', isHidden: false });
    expect(graveGuard.costs?.[costTypeId] ?? 0).toBe(0);

    renderAdder(SPECIAL_CATEGORY_ID, 'Special');

    expect(rowOf('Grave Guard').textContent).toMatch(/\+\s?120\s?Pkt/);
  });

  it('der angezeigte Preis ist der, den das Ausheben tatsächlich anlegt', () => {
    const graveGuard = offerNamed('Grave Guard');
    const actual = costOfActuallyRecruiting(graveGuard.defId);
    // Die Fabrik legt 10 Pflicht-Modelle à 12 Punkten an; die Zahl steht hier
    // nicht als Konstante, sondern kommt aus derselben Fabrik wie beim Klick.
    expect(actual).toBeGreaterThan(0);

    renderAdder(SPECIAL_CATEGORY_ID, 'Special');

    expect(rowOf('Grave Guard').textContent).toMatch(new RegExp(`\\+\\s?${actual}\\s?Pkt`));
  });

  it('sortiert nach dem Aushebepreis, nicht nach den Eigenkosten', () => {
    // Alle vier Spezial-Angebote tragen Eigenkosten 0; ohne die
    // Pflicht-Unterauswahlen wäre ihre Reihenfolge beliebig.
    for (const name of ['Grave Guard', 'Black Knights', 'Spirit Host', 'Fell Bats']) {
      expect(offerNamed(name).costs?.[costTypeId] ?? 0).toBe(0);
    }

    renderAdder(SPECIAL_CATEGORY_ID, 'Special');

    const shown = [...document.querySelectorAll('.popover-item-name')].map(node => node.textContent);
    const byRaiseCost = ['Grave Guard', 'Black Knights', 'Spirit Host', 'Fell Bats']
      .sort((a, b) => costOfActuallyRecruiting(offerNamed(b).defId)
        - costOfActuallyRecruiting(offerNamed(a).defId));
    expect(shown.filter(name => byRaiseCost.includes(name))).toEqual(byRaiseCost);
  });

  it('KONTROLLE: eine Einheit ohne Pflicht-Unterauswahl behält ihre Eigenkosten aus dem Bericht (Wight Lord)', () => {
    const wightLord = offerNamed('Wight Lord');
    const ownCost = wightLord.costs?.[costTypeId] ?? 0;
    expect(ownCost).toBeGreaterThan(0);

    renderAdder(HEROES_CATEGORY_ID, 'Heroes');

    expect(rowOf('Wight Lord').textContent).toMatch(new RegExp(`\\+\\s?${ownCost}\\s?Pkt`));
  });
});
