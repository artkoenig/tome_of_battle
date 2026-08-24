/**
 * Issue 0155 — der Riese der O&G Definitive Edition im Aushebe-Dialog unter
 * "Selten".
 *
 * Befund aus den Katalogdaten (AC1, siehe Issue-Datei): der Riese haengt NICHT
 * als eigener `selectionEntry` im O&G-Armeebuch, sondern als **Wurzel-
 * `entryLink`** `f6b3-0b56-7a09-2dc5` ganz unten in
 * `Orcs and goblins (6th definitive edition).cat`, dessen `targetId`
 * `7645ed71-72bd-4b72-89ab-22571a0a8b0c` in den **Bibliothekskatalog**
 * `Mercenaries (6th definitive edition).cat` zeigt (aufgeloest ueber den
 * `catalogueLink` `b066-2f8e-11ee-1dce` → `fc47-8392-a6c8-452a`). Seine
 * Kategorie kommt nicht vom Ziel, sondern aus den `modifiers` des Links selbst:
 * `set-primary` auf `e94b-6a54-8779-cd60` ("Rare"/"Selten"), `remove` von
 * `ee09-9a50-ad78-9c32` ("Regiment of Renown") — nur in einem
 * "Mountain or Troll Country Waaagh!"-Kontingent verschiebt eine
 * `modifierGroup` ihn nach "Special", und in einem
 * "Nomadic Badlands Waaagh!"-Kontingent setzt ein Modifier `hidden`.
 *
 * Der Fall wird deshalb ueber die ECHTEN Fixture-Kataloge gefahren — das
 * Spielsystem und ALLE Armeebuecher des Korpus, so wie die App den Datensatz
 * einer vollstaendigen Einfuhr baut —, durch die echte Fassade
 * `prepareDataset`/`evaluate`; der Dialog wird gerendert wie in
 * `CategoryUnitAdder.forceCatalogue.test.jsx`.
 */

import React from 'react';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CategoryUnitAdderHarness as CategoryUnitAdder } from '../../../../shared/test-utils/harnesses/CategoryUnitAdderHarness';
import { prepareDataset, evaluate } from '../../../../domain/evaluator/evaluator.js';

vi.mock('lucide-react', () => ({
  Plus: () => <span data-testid="icon-plus" />,
  X: () => <span data-testid="icon-x" />,
}));

vi.mock('../../../../ui/components/editor/BottomSheet', () => ({
  default: ({ isOpen, children }) => (isOpen ? <div data-testid="sheet">{children}</div> : null),
}));

const FIXTURE_DIR = join(process.cwd(), 'src/domain/evaluator/__fixtures__/whfb6-definitive');
const fixture = (fileName) => readFileSync(join(FIXTURE_DIR, fileName), 'utf8');

const GST_FILE = 'Warhammer Fantasy Battles (6th definitive edition).gst';
const GAME_SYSTEM_ID = '0d13-7737-ea86-4662';
const OG_CATALOGUE_ID = '4049-c46d-7f80-44fb';

const OG_STANDARD_FORCE_ID = '2bfa-e64a-7123-895f';
const RARE_CATEGORY_ID = 'e94b-6a54-8779-cd60';
const GIANT_LINK_ID = 'f6b3-0b56-7a09-2dc5';
const GIANT_TARGET_ID = '7645ed71-72bd-4b72-89ab-22571a0a8b0c';
const POINTS_ID = 'ecfa-8486-4f6c-c249';

const FORCE_PATH = '0';

/**
 * ALLE Armeebuecher des Korpus — die Bedingung, unter der der Fehler auftritt:
 * Dunkelelfen, Skaven, Imperium und Vampirfuersten fuehren je einen eigenen
 * Wurzel-`entryLink` auf DASSELBE Riesen-Ziel, und mit ihnen im Datensatz
 * verankerte vor der Behebung ein fremder dieser Links statt des O&G-eigenen.
 */
const CATALOGUE_FILES = readdirSync(FIXTURE_DIR).filter((name) => name.endsWith('.cat')).sort();

/** Der Bericht des leeren Standard-Kontingents — einmal je Datei. */
let capabilities = null;

beforeAll(() => {
  const prepared = prepareDataset({
    gameSystem: fixture(GST_FILE),
    catalogues: CATALOGUE_FILES.map(fixture),
  });
  capabilities = evaluate(prepared, {
    catalogueId: OG_CATALOGUE_ID,
    forces: [{ defId: OG_STANDARD_FORCE_ID, catalogueId: OG_CATALOGUE_ID, count: 1, children: [] }],
  }).capabilities;
  // Der Korpus-Parse dominiert die Laufzeit — der Standard-Hook-Timeout reicht
  // dafuer nicht.
}, 60000);

/** Der Slot-Datensatz einer Definition unmittelbar unter dem Kontingent. */
function capabilityOf(defId) {
  for (const [path, capability] of capabilities) {
    if (path.startsWith(`${FORCE_PATH}/`) && capability.defId === defId) return capability;
  }
  return undefined;
}

/** Die Katalog-Metadaten eines Fixture-Buchs, aus dessen eigenem Wurzelelement. */
function catalogueMetaOf(fileName) {
  const head = fixture(fileName).slice(0, 2000);
  return {
    id: /\bid="([^"]+)"/.exec(head)[1],
    name: /\bname="([^"]+)"/.exec(head)[1],
    isLibrary: /\blibrary="true"/.test(head),
  };
}

/** Das App-System-Objekt: Katalog-Metadaten aller Buecher plus rohe XMLs. */
function appSystem() {
  return {
    id: GAME_SYSTEM_ID,
    name: 'Warhammer Fantasy Battles',
    catalogues: CATALOGUE_FILES.map(catalogueMetaOf),
    rawXmls: {
      gst: [{ name: GST_FILE, content: fixture(GST_FILE) }],
      cat: CATALOGUE_FILES.map((name) => ({ name, content: fixture(name) })),
    },
  };
}

/** Rendert den "Selten"-Aushebe-Dialog des O&G-Standard-Kontingents. */
function renderRareAdder(addUnit = vi.fn()) {
  render(
    <CategoryUnitAdder
      categoryId={RARE_CATEGORY_ID}
      categoryName="Selten"
      capabilities={capabilities}
      forcePath={FORCE_PATH}
      forceCatalogueId={OG_CATALOGUE_ID}
      system={appSystem()}
      activeCatalogue={{ id: OG_CATALOGUE_ID }}
      costTypeLabel="Pkt"
      costLimitType={POINTS_ID}
      addUnit={addUnit}
    />,
  );
  return addUnit;
}

function openDialog() {
  fireEvent.click(screen.getByTitle('Selten ausheben'));
}

/** Die Namen, die der offene Dialog anbietet. */
function offeredNames() {
  return [...document.querySelectorAll('.popover-item-name')]
    .map((row) => row.querySelector('span').textContent);
}

describe('Issue 0155: Der Riese der O&G Definitive Edition steht unter "Selten" zur Wahl', () => {
  it('der Bericht verankert den Wurzel-entryLink des Riesen als seltenen Angebots-Anker des O&G-Kontingents', () => {
    const giant = capabilityOf(GIANT_LINK_ID);

    expect(giant).toMatchObject({
      name: 'Giant',
      targetDefId: GIANT_TARGET_ID,
      anchorKind: 'offerAnchor',
      primaryCategoryId: RARE_CATEGORY_ID,
      sourceId: OG_CATALOGUE_ID,
      isHidden: false,
      isBlocked: false,
    });
  });

  it('der Aushebe-Dialog listet den Riesen unter "Selten"', () => {
    renderRareAdder();
    openDialog();

    expect(offeredNames()).toContain('Giant');
  });

  it('ein Klick auf den Riesen hebt ihn in der Kategorie "Selten" aus', () => {
    const addUnit = renderRareAdder();
    openDialog();

    const row = [...document.querySelectorAll('.popover-item')]
      .find((item) => item.querySelector('.popover-item-name span')?.textContent === 'Giant');
    expect(row).toBeTruthy();
    fireEvent.click(row);

    expect(addUnit).toHaveBeenCalledTimes(1);
    const [entry, categoryId] = addUnit.mock.calls[0];
    expect(categoryId).toBe(RARE_CATEGORY_ID);
    expect(entry.id === GIANT_LINK_ID || entry.targetId === GIANT_TARGET_ID
      || entry.id === GIANT_TARGET_ID).toBe(true);
  });
});
