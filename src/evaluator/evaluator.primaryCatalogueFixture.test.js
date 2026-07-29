/**
 * Issue 077, Kriterium 2 an den **echten** Katalogdaten des Repos
 * (`src/evaluator/__fixtures__/whfb6-definitive/`).
 *
 * Der Fund des Issues ist an genau diesem Datensatz reproduziert: eine
 * Auswertung von `.gst` + Ogre Kingdoms + Mercenaries gegen ein Ogre-Roster
 * meldet heute **9** Diagnosen `{kind:'unresolvedScope', scope:'primary-catalogue'}`
 * (Issue 077, Log vom 2026-07-29). Kriterium 2 verlangt, dass diese Diagnose
 * fuer diesen Bezugsrahmen entfaellt — die Regel wird ausgewertet statt
 * fail-closed uebergangen.
 *
 * Gepinnt wird ausschliesslich die **Abwesenheit** dieser einen Diagnose-Art,
 * nicht die Zahl der Verletzungen: welche der 27 Katalogregeln danach feuern,
 * ist Sache des E2E-Szenarios (ADR 0033, Kriterium 3), nicht dieses Moduls.
 *
 * Das Muster ist das von `evalTree.unlinkedCategoryMixedScope.test.js`
 * („keine Diagnose dieser Art"), an echten Daten gefahren wie
 * `evaluator.describeDataset.test.js`.
 *
 * Bemerkenswert und bewusst so gepinnt: unter den heute 9 Ziel-Ids stehen
 * Katalog-Ids, die in diesem Datensatz gar nicht geladen sind (z. B. Vampire
 * Counts). Der Antwortvertrag (Issue 077, Plan) behandelt sie als schlichten
 * Nicht-Treffer — Ergebnis 0, ohne Diagnose —, nicht als Datenfehler.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate, prepareDataset } from './evaluator.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const FIXTURE_DIR = join(process.cwd(), 'src/evaluator/__fixtures__/whfb6-definitive');

/** Liest eine Fixture-Katalogdatei als XML-Text. */
function fixture(fileName) {
  return readFileSync(join(FIXTURE_DIR, fileName), 'utf8');
}

// Ogre Kingdoms braucht die Mercenaries-`.cat` (deklarierter `catalogueLink`);
// dort stehen 20 der 27 `primary-catalogue`-Vorkommen, sieben weitere in der `.gst`.
const OGRE_DATASET = {
  gameSystem: fixture('Warhammer Fantasy Battles (6th definitive edition).gst'),
  catalogues: [
    fixture('Ogre Kingdoms (6th definitive edition).cat'),
    fixture('Mercenaries (6th definitive edition).cat'),
  ],
};

// `<forceEntry name="Standard (OK-AB)">` der Ogre-`.cat` — ein leeres
// Kontingent genuegt: die Regeln haengen an Angeboten und Grenzen, nicht an
// einer bestimmten Auswahl.
const OGRE_STANDARD_FORCE_ID = '729f-9246-5cd3-5044';
const OGRE_ROSTER = { forces: [{ defId: OGRE_STANDARD_FORCE_ID, count: 1, children: [] }] };

// Die echten Kataloge sind gross; die Auswertung ist eine reine Funktion und
// wird deshalb einmal fuer alle Faelle gebildet.
const REPORT = evaluate(prepareDataset(OGRE_DATASET), OGRE_ROSTER);

/** Die `unresolvedScope`-Diagnosen des Berichts zu einem Bezugsrahmen. */
function unresolvedScopeOf(report, scope) {
  return report.diagnostics.filter(
    diagnostic => diagnostic.kind === 'unresolvedScope' && diagnostic.scope === scope,
  );
}

describe('Kriterium 2 an echten Katalogdaten: primary-catalogue wird ausgewertet', () => {
  it('die Ogre-Auswertung meldet keine unresolvedScope-Diagnose fuer primary-catalogue (heute: 9)', () => {
    expect(unresolvedScopeOf(REPORT, 'primary-catalogue')).toEqual([]);
  });

  it('KONTROLLE: der Bericht entsteht ueberhaupt — Verletzungen und Diagnosen sind Listen', () => {
    expect(Array.isArray(REPORT.violations)).toBe(true);
    expect(Array.isArray(REPORT.diagnostics)).toBe(true);
  });
});
