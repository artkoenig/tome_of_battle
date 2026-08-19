import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { collectPrimaryCategoryEntries } from './entryVisibility.js';
import { processImportedData } from '../parser/xmlParser';
import { buildRoster } from '../utils/createRoster';

/**
 * Issue 0155 — a contingent instance gate (`instanceOf`/`notInstanceOf` against a
 * `forceEntry`) decides what a list offers, and its `value` must not enter that
 * decision (BSData §7.7, `docs/battlescribe-data-format.md`). Grounded in the real
 * Definitive-Edition "Orcs and goblins" catalogue, whose gates are written with
 * `value="0"` — the encoding that used to be read as a second negation and put the
 * Giant into Special in the standard list while hiding the Trolls there entirely.
 *
 * Nothing is mocked: `processImportedData` parses the frozen fixture `.gst`/`.cat`,
 * `buildRoster` builds the contingent, and `collectPrimaryCategoryEntries` is the very
 * call the "+" adder of a category section makes.
 */

const DEFINITIVE_DIR = path.resolve('src/evaluator/__fixtures__/whfb6-definitive');
const DEFINITIVE_GST = 'Warhammer Fantasy Battles (6th definitive edition).gst';
const ORCS_AND_GOBLINS_CAT = 'Orcs and goblins (6th definitive edition).cat';

const RARE = 'e94b-6a54-8779-cd60';
const SPECIAL = '43cc-fc3f-35a7-8d03';

const STANDARD = '2bfa-e64a-7123-895f'; // Standard (OG-AB)
const NIGHT_GOBLIN_HORDE = 'c248-eea0-b5c1-857b'; // Night Goblin Horde (OG-AB)
const MOUNTAIN_WAAAGH = 'a2fa-6a0e-8c17-373c'; // Mountain or Troll Country Waaagh! (OG-AB)
const NOMADIC_WAAAGH = '1f55-c922-66d8-08ef'; // Nomadic Badlands Waaagh! (OG-AB)
const SNOTLING_HORDE = '03cc-8a3f-abd4-3c03'; // Snotling Horde (OG-AB)
const NIGHT_GOBLIN_HORDE_CJ = '9f70-0506-b8c7-f2c4'; // Night Goblin Horde (CJ#46)

/** Parses the fixture pair once — the parse dominates the runtime of this file. */
const parsed = (() => {
  const gstContent = fs.readFileSync(path.join(DEFINITIVE_DIR, DEFINITIVE_GST), 'utf8');
  const catContent = fs.readFileSync(path.join(DEFINITIVE_DIR, ORCS_AND_GOBLINS_CAT), 'utf8');
  const { system } = processImportedData(
    [{ name: DEFINITIVE_GST, content: gstContent }],
    [{ name: ORCS_AND_GOBLINS_CAT, content: catContent }],
  );
  return { system, catalogue: system.catalogues[0] };
})();

/** The names a category section offers in the given contingent. */
function offeredNames(forceEntryId, categoryId) {
  const { system, catalogue } = parsed;
  const roster = buildRoster(
    { name: 'test roster', systemId: system.id, catId: catalogue.id, forceEntryId, limit: 3000 },
    { costTypes: system.costTypes, forceEntries: [{ id: forceEntryId }] }
  );
  const force = roster.forces[0];
  return collectPrimaryCategoryEntries(system, catalogue, categoryId, { roster, force })
    .map(({ entry, resolved }) => entry.name || resolved.name);
}

describe('Kontingent-Instanzbedingung mit value="0" (Orcs and Goblins, Definitive Edition)', () => {
  it('bietet den Giant in der Standardliste unter Rare an, nicht unter Special', () => {
    expect(offeredNames(STANDARD, RARE)).toContain('Giant');
    expect(offeredNames(STANDARD, SPECIAL)).not.toContain('Giant');
  });

  it('bietet den Giant im Mountain or Troll Country Waaagh! unter Special an, nicht unter Rare', () => {
    expect(offeredNames(MOUNTAIN_WAAAGH, SPECIAL)).toContain('Giant');
    expect(offeredNames(MOUNTAIN_WAAAGH, RARE)).not.toContain('Giant');
  });

  it('bietet die Trolls in der Standardliste unter Rare an', () => {
    expect(offeredNames(STANDARD, RARE)).toContain('Trolls');
  });

  it.each([
    ['Night Goblin Horde (OG-AB)', NIGHT_GOBLIN_HORDE],
    ['Mountain or Troll Country Waaagh! (OG-AB)', MOUNTAIN_WAAAGH],
    ['Nomadic Badlands Waaagh! (OG-AB)', NOMADIC_WAAAGH],
    ['Snotling Horde (OG-AB)', SNOTLING_HORDE],
    ['Night Goblin Horde (CJ#46)', NIGHT_GOBLIN_HORDE_CJ],
  ])('bietet die Trolls in "%s" nicht an', (_name, forceEntryId) => {
    expect(offeredNames(forceEntryId, RARE)).not.toContain('Trolls');
    expect(offeredNames(forceEntryId, SPECIAL)).not.toContain('Trolls');
  });
});
