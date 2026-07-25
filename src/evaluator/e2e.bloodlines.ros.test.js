/**
 * E2E-Charakterisierung der handgeschriebenen **Bloodline-`.ros`-Fixtures**
 * (`docs/testing/vampire-bloodlines/` und `.../vampire-bloodlines-ergofang/`) gegen
 * die oeffentliche Fassade `evaluate` — Black-Box: das Roster wird aus der `.ros`-XML
 * in den Instanzbaum `{defId,count,children}` uebersetzt, ausgewertet, und der
 * Verletzungsbericht gegen das **verifizierte tatsaechliche** Engine-Verhalten
 * geprueft (siehe die „Engine-Lauf"-Abschnitte der beiden README-Dateien).
 *
 * Bewusst gepinnt wird, was die Engine tut:
 *   - force-skopierte Pflicht (Bloodlines min 1) **feuert**;
 *   - parent-/gruppen-skopierte Zaehl-Constraints (max 1 Clan; per-Charakter
 *     min/max) **feuern** ueber den Gruppen-Anker-Mechanismus (Issue 68);
 *   - `hidden`/Profil erzeugen keine Verletzung (nicht Teil des Berichts).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate } from './evaluator.js';
import { violationsOf, violationOf } from './__fixtures__/e2eRoster.js';
import { vampireCountsDataset } from './__fixtures__/realCatalogs.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

// ── ergofang-Datensatz (eigenstaendige VC-`.cat`, keine Mercenaries-Abhaengigkeit) ──
const ERG_DIR = 'src/solver/__fixtures__/whfb6';
const ergofangDataset = () => ({
  gameSystem: readFileSync(resolve(ERG_DIR, 'Warhammer Fantasy Battle 6th edition.gst'), 'utf8'),
  catalogues: [readFileSync(resolve(ERG_DIR, 'Vampire Counts.cat'), 'utf8')],
});

// ── `.ros`-XML -> Instanzbaum ({defId,count,children}) ──────────────────────────
function childSelections(el) {
  const out = [];
  for (const child of [...el.children]) {
    if (child.tagName !== 'selections') continue;
    for (const sel of [...child.children]) {
      if (sel.tagName !== 'selection') continue;
      out.push({
        defId: sel.getAttribute('entryId'),
        count: Number(sel.getAttribute('number') || '1'),
        children: childSelections(sel),
      });
    }
  }
  return out;
}
function rosterFromRos(path) {
  const xml = readFileSync(resolve(path), 'utf8');
  const doc = new dom.window.DOMParser().parseFromString(xml, 'application/xml');
  const forces = [...doc.getElementsByTagName('force')].map(forceEl => ({
    defId: forceEl.getAttribute('entryId'),
    count: 1,
    children: childSelections(forceEl),
  }));
  return { forces };
}

const DEF = 'docs/testing/vampire-bloodlines/rosters';
const ERG = 'docs/testing/vampire-bloodlines-ergofang/rosters';

// Verifizierte Constraint-Ids (siehe README „Verifizierte Bausteine")
const VBL_R1_MIN = '4a0a-b107-e726-da32'; // Bloodlines min 1, scope=force
const VBL_R2_MAX = '39c7-f615-17db-7016'; // max 1 Clan, scope=parent (Gruppe)
const ERG_R1_MIN = '56c1-3e68-6f24-3768'; // Count-Bloodline min 1, scope=parent
const ERG_R1_MAX = '6d0c-37c1-e5f6-b88d'; // Count-Bloodline max 1, scope=parent

describe('E2E Bloodlines (Definitive-Katalog): Roster-Fixtures gegen evaluate', () => {
  it('01 legal: erzeugt keine Bloodline-Verletzung (VBL-R1/R2 erfuellt)', () => {
    const report = evaluate(vampireCountsDataset(), rosterFromRos(`${DEF}/01-bloodline-legal.ros`));
    expect(violationsOf(report, VBL_R1_MIN)).toHaveLength(0);
    expect(violationsOf(report, VBL_R2_MAX)).toHaveLength(0);
  });

  it('02 fehlende Bloodline: force-skopierte Pflicht min 1 feuert (VBL-R1)', () => {
    const report = evaluate(vampireCountsDataset(), rosterFromRos(`${DEF}/02-missing-bloodline-illegal.ros`));
    expect(violationOf(report, VBL_R1_MIN)).toMatchObject({ actual: 0, bound: 1 });
  });

  // Gruppen-skopierte Zaehl-Constraints (max 1 auf der `selectionEntryGroup`,
  // scope=parent) feuern jetzt: die Join-Schicht synthetisiert je Gruppe einen
  // Gruppen-Anker und zaehlt die Member ueber das Query-Primitiv (Issue 68).
  it('03 zwei Clans: max 1 (parent/Gruppe) feuert', () => {
    const report = evaluate(vampireCountsDataset(), rosterFromRos(`${DEF}/03-two-clans-in-one-bloodlines-illegal.ros`));
    expect(violationOf(report, VBL_R2_MAX)).toMatchObject({ actual: 2, bound: 1 });
  });

  // hidden (VBL-R4/R5) und Profil (VBL-R6) sind nicht Teil des Verletzungsberichts.
  it.each([
    ['04-strigoi-hides-magic-selection.ros'],
    ['05-blood-dragon-reveals-thrall-armour.ros'],
    ['06-lahmia-visibility-baseline.ros'],
    ['07-profile-blood-dragon-count.ros'],
    ['08-profile-necrarch-count.ros'],
    ['09-profile-strigoi-count.ros'],
  ])('%s: erzeugt keine Bloodline-Verletzung (hidden/Profil nicht im Bericht)', file => {
    const report = evaluate(vampireCountsDataset(), rosterFromRos(`${DEF}/${file}`));
    expect(violationsOf(report, VBL_R1_MIN)).toHaveLength(0);
    expect(violationsOf(report, VBL_R2_MAX)).toHaveLength(0);
  });
});

describe('E2E Bloodlines (ergofang-Katalog): Roster-Fixtures gegen evaluate', () => {
  it('e01 legal / e04 mischbar / e06 legal: keine Bloodline-Verletzung', () => {
    for (const file of ['e01-bloodline-legal.ros', 'e04-mixed-bloodlines-legal.ros', 'e06-blood-dragon-armour-and-magic-legal.ros']) {
      const report = evaluate(ergofangDataset(), rosterFromRos(`${ERG}/${file}`));
      expect(violationsOf(report, ERG_R1_MIN)).toHaveLength(0);
      expect(violationsOf(report, ERG_R1_MAX)).toHaveLength(0);
    }
  });

  // Per-Charakter min/max, scope=parent (wie Definitive VBL-R2): feuert jetzt
  // ueber den Gruppen-Anker (Issue 68).
  it('e02 fehlende Bloodline: min 1 (parent) feuert', () => {
    const report = evaluate(ergofangDataset(), rosterFromRos(`${ERG}/e02-missing-bloodline-illegal.ros`));
    expect(violationOf(report, ERG_R1_MIN)).toMatchObject({ actual: 0, bound: 1 });
  });

  it('e03 zwei Bloodlines: max 1 (parent) feuert', () => {
    const report = evaluate(ergofangDataset(), rosterFromRos(`${ERG}/e03-two-bloodlines-on-one-character-illegal.ros`));
    expect(violationOf(report, ERG_R1_MAX)).toMatchObject({ actual: 2, bound: 1 });
  });

  // ERG-R3/R4 (clan-spezifische Ausruestung) ist Verfuegbarkeit, keine Verletzung.
  it('e05 Strigoi + Ruestung: keine Verletzung (Verfuegbarkeit nicht im Bericht)', () => {
    const report = evaluate(ergofangDataset(), rosterFromRos(`${ERG}/e05-strigoi-with-armour-unavailable.ros`));
    expect(violationsOf(report, ERG_R1_MIN)).toHaveLength(0);
    expect(violationsOf(report, ERG_R1_MAX)).toHaveLength(0);
  });
});
