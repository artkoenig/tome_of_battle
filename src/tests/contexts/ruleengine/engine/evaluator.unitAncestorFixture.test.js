/**
 * Issue 0086, Kriterium 3 an den **echten** Katalogdaten des Repos
 * (`src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive/`): ueber den Fixture-
 * Datensaetzen entsteht fuer `scope="unit"` und `scope="ancestor"` keine
 * `unresolvedScope`-Diagnose mehr.
 *
 * Das Muster ist das von `evaluator.primaryCatalogueFixture.test.js`. Anders
 * als dort genuegt ein leeres Kontingent hier NICHT: die unit-/ancestor-Querys
 * haengen an Optionen INNERHALB von Einheiten. Beide Roster sind deshalb mit
 * real gesetzten Einheiten samt Kindern bestueckt und per Probelauf
 * (2026-07-29, Test-Autor Issue 0086) verifiziert — sie erzeugen heute
 * nachweislich die Diagnosen:
 *
 * - Vampire Counts, Standard-Kontingent mit Black Knights (5 Modelle) und
 *   Swain → Commander [HIGH ELVES] → Tiranoc Chariot [HIGH ELVES]:
 *   heute 10 × `{kind:'unresolvedScope', scope:'unit'}` (z. B. der
 *   Namens-Modifikator „Black Knights of Bretonnia", `scope="unit"
 *   childId=…`) und 1 × `{kind:'unresolvedScope', scope:'ancestor'}` (der
 *   „As characters mount"-Modifikator des Tiranoc Chariot, `instanceOf
 *   scope="ancestor" childId=7a1c-d611-c2dc-def1` = Kategorie „Characters").
 * - Ogre Kingdoms + Mercenaries, Ogre-Standard-Kontingent mit Manbiters
 *   (20 Modelle + Shield): heute 1 × `{kind:'unresolvedScope', scope:'unit'}`
 *   — das im Issue belegte Mercenaries-Idiom „Kostenaufschlag je Modell"
 *   (`<repeat field="selections" scope="unit" childId="model"/>` am Shield).
 *
 * Gepinnt wird ausschliesslich die **Abwesenheit** dieser einen Diagnose-Art
 * fuer die beiden Bezugsrahmen, nicht die Zahl der Verletzungen: welche
 * Katalogregeln danach feuern, ist Sache der E2E-Szenarien (ADR 0033).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate, prepareDataset } from '../../../../contexts/ruleengine/evaluator.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const FIXTURE_DIR = join(process.cwd(), 'src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive');

/** Liest eine Fixture-Katalogdatei als XML-Text. */
function fixture(fileName) {
  return readFileSync(join(FIXTURE_DIR, fileName), 'utf8');
}

/** Die `unresolvedScope`-Diagnosen des Berichts zu einem Bezugsrahmen. */
function unresolvedScopeOf(report, scope) {
  return report.diagnostics.filter(
    diagnostic => diagnostic.kind === 'unresolvedScope' && diagnostic.scope === scope,
  );
}

// ── Vampire Counts: scope="unit" (84 Vorkommen) und scope="ancestor" (9) ─────

// `<forceEntry name="Standard (VC-AB)">` der Vampire-Counts-`.cat`.
const VC_STANDARD_FORCE_ID = 'e989-15b8-7eb6-9668';
// `<selectionEntry type="unit" name="Black Knights">` — traegt selbst und am
// Modell `scope="unit"`-Conditions (Namens-Modifikator „… of Bretonnia").
const BLACK_KNIGHTS_UNIT_ID = '115c-d87a-35e6-26c9';
const BLACK_KNIGHTS_MODEL_ID = '9252-1ba6-f635-5b22';
// `<selectionEntry type="unit" name="Swain">` → `Commander [HIGH ELVES]` →
// entryLink `Tiranoc Chariot [HIGH ELVES]`; der Chariot traegt den
// `instanceOf scope="ancestor"`-gegateten Modifikator „As characters mount".
const SWAIN_UNIT_ID = 'b920-b398-dc26-7f4d';
const HE_COMMANDER_ID = 'd8e205ee-ee8d-4c18-afc8-cce2dde3f4ff';
const TIRANOC_CHARIOT_LINK_ID = '1e5f8bfa-1bd4-41b5-81e4-c727e5c40ee5';

const VC_DATASET = {
  gameSystem: fixture('Warhammer Fantasy Battles (6th definitive edition).gst'),
  catalogues: [fixture('Vampire Counts (6th definitive edition).cat')],
};

const VC_ROSTER = {
  forces: [{
    defId: VC_STANDARD_FORCE_ID, count: 1, children: [
      {
        defId: BLACK_KNIGHTS_UNIT_ID, count: 1, children: [
          { defId: BLACK_KNIGHTS_MODEL_ID, count: 5, children: [] },
        ],
      },
      {
        defId: SWAIN_UNIT_ID, count: 1, children: [
          {
            defId: HE_COMMANDER_ID, count: 1, children: [
              { defId: TIRANOC_CHARIOT_LINK_ID, count: 1, children: [] },
            ],
          },
        ],
      },
    ],
  }],
};

// Die echten Kataloge sind gross; die Auswertung ist eine reine Funktion und
// wird deshalb einmal fuer alle Faelle gebildet.
const VC_REPORT = evaluate(prepareDataset(VC_DATASET), VC_ROSTER);

describe('Kriterium 3 an echten Katalogdaten: Vampire Counts', () => {
  it('die Auswertung meldet keine unresolvedScope-Diagnose fuer scope="unit" (heute: 10)', () => {
    expect(unresolvedScopeOf(VC_REPORT, 'unit')).toEqual([]);
  });

  it('die Auswertung meldet keine unresolvedScope-Diagnose fuer scope="ancestor" (heute: 1)', () => {
    expect(unresolvedScopeOf(VC_REPORT, 'ancestor')).toEqual([]);
  });

  it('KONTROLLE: der Bericht entsteht ueberhaupt — Verletzungen und Diagnosen sind Listen', () => {
    expect(Array.isArray(VC_REPORT.violations)).toBe(true);
    expect(Array.isArray(VC_REPORT.diagnostics)).toBe(true);
  });
});

// ── Mercenaries: das im Issue belegte Pro-Modell-Idiom (scope="unit") ────────

// `<forceEntry name="Standard (OK-AB)">` der Ogre-`.cat`.
const OGRE_STANDARD_FORCE_ID = '729f-9246-5cd3-5044';
// Ogre-`entryLink` „Manbiters" → Mercenaries-Einheit; Modell und Shield-Link
// der Mercenaries-`.cat` (der Shield traegt den `scope="unit"
// childId="model"`-Repeat des Kostenaufschlags je Modell).
const MANBITERS_LINK_ID = '482c-0d14-dab2-d40e';
const MANBITERS_MODEL_ID = '45ff-9a9c-aa59-8c4c';
const MANBITERS_SHIELD_LINK_ID = 'a7e5-d466-038a-a9d6';

const OGRE_DATASET = {
  gameSystem: fixture('Warhammer Fantasy Battles (6th definitive edition).gst'),
  catalogues: [
    fixture('Ogre Kingdoms (6th definitive edition).cat'),
    fixture('Mercenaries (6th definitive edition).cat'),
  ],
};

const OGRE_ROSTER = {
  forces: [{
    defId: OGRE_STANDARD_FORCE_ID, count: 1, children: [
      {
        defId: MANBITERS_LINK_ID, count: 1, children: [
          { defId: MANBITERS_MODEL_ID, count: 20, children: [] },
          { defId: MANBITERS_SHIELD_LINK_ID, count: 1, children: [] },
        ],
      },
    ],
  }],
};

const OGRE_REPORT = evaluate(prepareDataset(OGRE_DATASET), OGRE_ROSTER);

describe('Kriterium 3 an echten Katalogdaten: Ogre Kingdoms + Mercenaries (Manbiters)', () => {
  it('die Auswertung meldet keine unresolvedScope-Diagnose fuer scope="unit" (heute: 1, der Shield-Repeat)', () => {
    expect(unresolvedScopeOf(OGRE_REPORT, 'unit')).toEqual([]);
  });

  it('KONTROLLE: der Bericht entsteht ueberhaupt — Verletzungen und Diagnosen sind Listen', () => {
    expect(Array.isArray(OGRE_REPORT.violations)).toBe(true);
    expect(Array.isArray(OGRE_REPORT.diagnostics)).toBe(true);
  });
});
