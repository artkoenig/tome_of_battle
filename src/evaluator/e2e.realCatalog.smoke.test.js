/**
 * Rauchtest der Fassade `evaluate()` gegen einen **realen** WHFB6-Katalog
 * (`src/solver/__fixtures__/whfb6/Ogre Kingdoms.cat`, Definitive-Edition-Daten).
 * Er liest die echten Katalog-Bytes (kein Nachbau) und prueft, dass die Engine
 * darueber einen Bericht liefert, **ohne zu stuerzen** — an einem echten
 * Domaenenfall: der armeeweiten Pflichteinheit „Bulls" (Ogerbullen), deren reale
 * `min`-Grenze (`field="selections" scope="roster" value="1"`) beim Fehlen
 * anschlaegt und bei Vorhandensein erfuellt ist.
 *
 * ── Bewusste Grenze (kein Fake): nur EIN Katalog, keine Katalog-Importe ──────────
 * `evaluate()` nimmt **einen** Katalog-XML-String. Ein reales WHFB6-Datenset ist
 * ein `.gst`-Spielsystem plus mehrere `.cat`-Kataloge mit **katalog-uebergreifenden
 * Importen und Link-Ketten** (`entryLinks`, `sharedSelectionEntries`,
 * `catalogueLinks`) — eine Nahtstelle, die Slice 01 der Resolver bewusst
 * ausgeklammert hat (`resolver.js`). Dieser Test loest deshalb **nur** die direkt
 * unter der Katalog-Wurzel stehenden `selectionEntries`/`categoryEntries` auf; die
 * `.gst`- und die per Link importierten Definitionen bleiben aussen vor. Ebenso
 * nutzt das echte XML das volle Battlescribe-Vokabular (`condition@type`,
 * `modifier@type`), das der engine-eigene Leser (eigenes Vokabular `op`/`operation`)
 * nicht deckt — solche Elemente werden als **Diagnose** gemeldet, nie still
 * verschluckt, und lassen die Auswertung nicht stuerzen. Vollstaendiger
 * Mehr-Katalog-Import bleibt kuenftige Arbeit.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate } from './evaluator.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

// Reale Katalog-Bytes, relativ zum Projekt-Wurzelverzeichnis (dem cwd des
// Testlaufs) aufgeloest — wie die uebrigen Fixture-lesenden Tests des Projekts.
const REAL_CATALOGUE_PATH = resolve('src/solver/__fixtures__/whfb6/Ogre Kingdoms.cat');
const REAL_CATALOGUE_XML = readFileSync(REAL_CATALOGUE_PATH, 'utf8');

// Die reale Definitions-Id des „Bulls"-Trupps im Ogre-Kingdoms-Katalog.
const REAL_BULLS_ID = '7754-8b3d-df99-d2d5';

/** True, wenn der Bericht eine Verletzung mit der „Bulls"-Definition als Anker traegt. */
function hasBullsViolation(report) {
  return report.violations.some(violation => violation.anchor.defId === REAL_BULLS_ID);
}

describe('E2E-Rauchtest: reale WHFB6-Katalogdatei (Ogre Kingdoms, ein Katalog)', () => {
  it('liefert einen strukturell vollstaendigen Bericht, ohne zu stuerzen', () => {
    const report = evaluate(REAL_CATALOGUE_XML, { forces: [] });

    expect(Array.isArray(report.violations)).toBe(true);
    expect(report.capabilities).toBeInstanceOf(Map);
    expect(Array.isArray(report.diagnostics)).toBe(true);
  });

  it('schlaegt die reale Pflichteinheit „Bulls" an, wenn die Armee leer ist', () => {
    const report = evaluate(REAL_CATALOGUE_XML, { forces: [] });

    const bullsViolation = report.violations.find(violation => violation.anchor.defId === REAL_BULLS_ID);
    expect(bullsViolation).toMatchObject({
      anchor: { defId: REAL_BULLS_ID, name: 'Bulls' },
      actual: 0,
      bound: 1,
    });
  });

  it('erfuellt die reale Pflichteinheit, sobald ein „Bulls"-Trupp in der Armee steht', () => {
    const report = evaluate(REAL_CATALOGUE_XML, {
      forces: [{ defId: REAL_BULLS_ID, count: 1, children: [] }],
    });

    expect(hasBullsViolation(report)).toBe(false);
  });
});
