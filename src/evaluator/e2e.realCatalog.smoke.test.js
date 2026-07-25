/**
 * Rauchtest der Fassade `evaluate()` gegen einen **realen** WHFB6-Katalog
 * (`src/solver/__fixtures__/whfb6/Ogre Kingdoms.cat`, Definitive-Edition-Daten).
 * Er liest die echten Katalog-Bytes (kein Nachbau) und belegt an echten
 * Domaenenfaellen, dass die Engine reale Kataloge **auswertet** — nicht nur
 * syntaktisch akzeptiert — ohne zu stuerzen:
 *
 * - **Grenze**: die armeeweite Pflichteinheit „Bulls" (Ogerbullen), deren reale
 *   `min`-Grenze (`field="selections" scope="roster" value="1"`) beim Fehlen
 *   anschlaegt und bei Vorhandensein erfuellt ist.
 * - **Modifikator**: der reale `set`-Modifikator auf der armeeweiten „Tyrant"-
 *   Obergrenze (`<modifier type="set" field="cb1c-…" value="0.0"/>`) senkt deren
 *   effektiven Wert im Bericht von `1` auf `0`, sobald „Dogs of War" im Roster steht.
 * - **Bedingung**: die reale Bedingung dieses Modifikators
 *   (`<condition type="greaterThan" value="0.0" field="selections" childId="a1bc-…"
 *   scope="roster"/>` — „Dogs of War"-Auswahlen im Roster > 0) steuert, **ob** die
 *   Grenze als Regel greift: ohne „Dogs of War" ist der eine erlaubte „Tyrant"
 *   regelkonform, mit „Dogs of War" verletzt er die auf `0` gesenkte Grenze.
 *
 * ── Bewusste Grenze (kein Fake): nur EIN Katalog, keine Katalog-Importe ──────────
 * `evaluate()` nimmt **einen** Katalog-XML-String. Ein reales WHFB6-Datenset ist
 * ein `.gst`-Spielsystem plus mehrere `.cat`-Kataloge mit **katalog-uebergreifenden
 * Importen und Link-Ketten** (`entryLinks`, `sharedSelectionEntries`,
 * `catalogueLinks`) — eine Nahtstelle, die Slice 01 der Resolver bewusst
 * ausgeklammert hat (`resolver.js`). Dieser Test loest deshalb **nur** die direkt
 * unter der Katalog-Wurzel stehenden `selectionEntries`/`categoryEntries` auf; die
 * `.gst`- und die per Link importierten Definitionen bleiben aussen vor. Der
 * engine-eigene Leser liest das echte Battlescribe-Vokabular kanonisch
 * (`condition@type`, `modifier@type`/`field`); ein `field`, das auf eine nicht
 * mit-aufgeloeste Definition verweist, wird als **Diagnose** gemeldet, nie still
 * verschluckt, und laesst die Auswertung nicht stuerzen. Vollstaendiger
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

// Die reale Definitions-Id des „Tyrant"-Kommandanten und die Constraint-Id seiner
// armeeweiten Obergrenze (`<constraint … type="max"/>`).
const REAL_TYRANT_ID = '2679-58f4-1771-662d';
const REAL_TYRANT_MAX_ID = 'cb1c-3389-8f55-d6c6';

// Die reale Definitions-Id des Eintrags, der die „Dogs of War"-Kategorie traegt.
// Die Bedingung des „Tyrant"-Modifikators zaehlt „Dogs of War"-Auswahlen im Roster;
// steht dieser Eintrag im Roster, ist die Bedingung erfuellt.
const REAL_DOGS_OF_WAR_ID = 'aa6a-68b4-a6ae-4abc';

// Basiswert der „Tyrant"-Obergrenze im Katalog (`<constraint … value="1.0"/>`) und
// der Wert, auf den der reale `set`-Modifikator sie bei erfuellter Bedingung senkt
// (`<modifier type="set" … value="0.0"/>`).
const TYRANT_BASE_MAX = 1;
const TYRANT_MODIFIED_MAX = 0;

// Ein einzelner „Tyrant" ohne bzw. mit einer „Dogs of War"-Auswahl im Roster —
// die beiden Zustaende, zwischen denen die reale Bedingung den Modifikator schaltet.
const ROSTER_TYRANT_ALONE = { forces: [{ defId: REAL_TYRANT_ID, count: 1, children: [] }] };
const ROSTER_TYRANT_WITH_DOGS_OF_WAR = {
  forces: [
    { defId: REAL_TYRANT_ID, count: 1, children: [] },
    { defId: REAL_DOGS_OF_WAR_ID, count: 1, children: [] },
  ],
};

/** True, wenn der Bericht eine Verletzung mit der „Bulls"-Definition als Anker traegt. */
function hasBullsViolation(report) {
  return report.violations.some(violation => violation.anchor.defId === REAL_BULLS_ID);
}

/** Der Faehigkeitsdatensatz des realen (nicht-Phantom-) Slots der gegebenen Definition. */
function realSlotByDefId(report, defId) {
  for (const capability of report.capabilities.values()) {
    if (capability.node.def?.id === defId && !capability.node.isPhantom) {
      return capability;
    }
  }
  return null;
}

/** Die Verletzung des Berichts mit der gegebenen Definition als Anker, oder `null`. */
function violationByDefId(report, defId) {
  return report.violations.find(violation => violation.anchor.defId === defId) ?? null;
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

describe('E2E-Rauchtest: reale Auswertung von Modifikator und Bedingung (Ogre Kingdoms)', () => {
  it('ein echter `set`-Modifikator senkt die effektive „Tyrant"-Obergrenze im Bericht', () => {
    const withoutDogsOfWar = evaluate(REAL_CATALOGUE_XML, ROSTER_TYRANT_ALONE);
    const withDogsOfWar = evaluate(REAL_CATALOGUE_XML, ROSTER_TYRANT_WITH_DOGS_OF_WAR);

    // Ohne „Dogs of War" greift der Modifikator nicht: die Grenze traegt ihren Basiswert.
    expect(realSlotByDefId(withoutDogsOfWar, REAL_TYRANT_ID).effectiveMax).toBe(TYRANT_BASE_MAX);
    // Mit „Dogs of War" feuert der reale `set`-Modifikator und veraendert den
    // effektiven Grenzwert im Bericht — das ist tatsaechliche Auswertung, nicht bloss
    // Syntax-Akzeptanz.
    expect(realSlotByDefId(withDogsOfWar, REAL_TYRANT_ID).effectiveMax).toBe(TYRANT_MODIFIED_MAX);
  });

  it('eine echte Bedingung steuert, ob die „Tyrant"-Obergrenze als Regel greift', () => {
    const withoutDogsOfWar = evaluate(REAL_CATALOGUE_XML, ROSTER_TYRANT_ALONE);
    const withDogsOfWar = evaluate(REAL_CATALOGUE_XML, ROSTER_TYRANT_WITH_DOGS_OF_WAR);

    // Bedingung „Dogs of War > 0" falsch: der eine erlaubte „Tyrant" ist regelkonform,
    // die Grenze greift nicht.
    expect(violationByDefId(withoutDogsOfWar, REAL_TYRANT_ID)).toBeNull();
    // Bedingung wahr: der Modifikator senkt die Grenze auf 0, der vorhandene „Tyrant"
    // verletzt sie nun — die Regel greift erst, weil die reale Bedingung haelt.
    expect(violationByDefId(withDogsOfWar, REAL_TYRANT_ID)).toMatchObject({
      limitId: REAL_TYRANT_MAX_ID,
      anchor: { defId: REAL_TYRANT_ID, name: 'Tyrant' },
      actual: 1,
      bound: TYRANT_MODIFIED_MAX,
    });
  });
});
