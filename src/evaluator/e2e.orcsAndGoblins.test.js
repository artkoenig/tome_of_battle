/**
 * Reale E2E-Szenarien der **Orcs-and-Goblins**-Armee (ADR-0032): das Roster wird
 * end-to-end gegen die echten Definitive-Edition-Daten ausgewertet — die `.gst`,
 * die Orcs-and-Goblins-`.cat` **und** ihre gemeinsame `Mercenaries`-Abhaengigkeit.
 *
 * Geprueft werden dieselben, im **Spielsystem** definierten Pflichtregeln
 * „General" (force-scope min 1) und „Core" (force-scope min 2) — sie gelten fuer
 * jede Armee gleich und sind daher die sicheren Anker (bekannte, verifizierte IDs
 * und Grenzwerte, siehe `__fixtures__/realCatalogs.js`): sie schlagen im leeren
 * Kontingent an, und eine bekannt-regelkonforme Liste erzeugt keine falsche
 * Verletzung. Zusaetzlich wird belegt, dass die per Verweis importierten
 * Definitionen — auch kataloguebergreifend ueber Mercenaries — beruecksichtigt
 * werden und nicht fälschlich als unaufgelöst erscheinen.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate } from './evaluator.js';
import { DiagnosticKind } from './model.js';
import { selection, force, roster, violationsOf, violationOf, countDiagnostics } from './__fixtures__/e2eRoster.js';
import {
  orcsAndGoblinsDataset,
  orcsAndGoblinsDatasetWithoutMercenaries,
  ORCS_AND_GOBLINS_FORCE_ID,
  ORCS_AND_GOBLINS_CORE_UNIT_IDS,
  MERCENARIES_CATALOGUE_ID,
  MERCENARIES_ONLY_ENTRY_ID,
  GENERAL_MIN_ID,
  GENERAL_CATEGORY_ID,
  GENERAL_CATEGORY_NAME,
  GENERAL_MIN_VALUE,
  GENERAL_DESIGNATOR_ID,
  CORE_MIN_ID,
  CORE_CATEGORY_ID,
  CORE_CATEGORY_NAME,
  CORE_MIN_BASE_VALUE,
} from './__fixtures__/realCatalogs.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const emptyForce = () => roster(force(ORCS_AND_GOBLINS_FORCE_ID, []));

/** Eine bekannt-regelkonforme Liste: General-Aufwertung + zwei Core-Einheiten. */
const conformingArmy = () =>
  roster(force(ORCS_AND_GOBLINS_FORCE_ID, [
    selection(GENERAL_DESIGNATOR_ID),
    ...ORCS_AND_GOBLINS_CORE_UNIT_IDS.map(id => selection(id)),
  ]));

describe('E2E Orcs and Goblins: armeeweite Pflichtregeln General und Core', () => {
  it('schlaegt bei leerem Kontingent fuer General (min 1) und Core (min 2) an', () => {
    const report = evaluate(orcsAndGoblinsDataset(), emptyForce());

    expect(violationOf(report, GENERAL_MIN_ID)).toMatchObject({
      anchor: { defId: GENERAL_CATEGORY_ID, name: GENERAL_CATEGORY_NAME },
      actual: 0,
      bound: GENERAL_MIN_VALUE,
    });
    expect(violationOf(report, CORE_MIN_ID)).toMatchObject({
      anchor: { defId: CORE_CATEGORY_ID, name: CORE_CATEGORY_NAME },
      actual: 0,
      bound: CORE_MIN_BASE_VALUE,
    });
  });

  it('erzeugt fuer eine bekannt-regelkonforme Liste keine falsche General- oder Core-Verletzung', () => {
    const report = evaluate(orcsAndGoblinsDataset(), conformingArmy());

    expect(violationsOf(report, GENERAL_MIN_ID)).toHaveLength(0);
    expect(violationsOf(report, CORE_MIN_ID)).toHaveLength(0);
  });
});

describe('E2E Orcs and Goblins: kataloguebergreifende Auflösung ueber Mercenaries', () => {
  it('loest mit vollstaendiger Quelle alle per Verweis importierten Definitionen auf', () => {
    const report = evaluate(orcsAndGoblinsDataset(), emptyForce());

    expect(countDiagnostics(report, DiagnosticKind.DANGLING_ENTRY_LINK)).toBe(0);
    expect(countDiagnostics(report, DiagnosticKind.DANGLING_INFO_LINK)).toBe(0);
    expect(countDiagnostics(report, DiagnosticKind.MISSING_CATALOGUE_DEPENDENCY)).toBe(0);
  });

  it('meldet die fehlende Mercenaries-Abhaengigkeit als Diagnose und laesst ihren Verweis baumeln', () => {
    const report = evaluate(orcsAndGoblinsDatasetWithoutMercenaries(), emptyForce());

    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({
        kind: DiagnosticKind.MISSING_CATALOGUE_DEPENDENCY,
        targetId: MERCENARIES_CATALOGUE_ID,
      }),
    );
    // Der nur ueber Mercenaries erreichbare Verweis („Pikemen") baumelt ohne die Quelle.
    const danglingMercenariesEntry = report.diagnostics.filter(
      diagnostic =>
        diagnostic.kind === DiagnosticKind.DANGLING_ENTRY_LINK && diagnostic.targetId === MERCENARIES_ONLY_ENTRY_ID,
    );
    expect(danglingMercenariesEntry.length).toBeGreaterThan(0);
  });
});
