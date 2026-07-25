/**
 * End-to-End-Test der Fassade `evaluate({ gameSystem, catalogues }, roster)` gegen
 * die **echten**, vollstaendigen Definitive-Edition-Katalogdaten (`.gst` + Ogre-
 * `.cat` + ihre `Mercenaries`-Abhaengigkeit, ADR-0032). Belegt an genau den Daten,
 * die ein Nutzer beim Import erlebt, die **Auflösungs-Fähigkeit** der Engine —
 * nicht die Regel-Semantik einzelner Armeen (die Domaenen-Szenarien
 * Bulls/Tyrant/O&G/VC ziehen in Scheibe 02 ein).
 *
 * Der Nachweis: alle mitgegebenen Quellen fliessen in **eine** globale
 * `id → Definition`-Tabelle; per Verweis importierte Definitionen — auch
 * kataloguebergreifend aus Mercenaries — loesen auf, statt fälschlich als
 * unaufgelöst zu erscheinen. Fehlt die Abhaengigkeit, ist das eine Diagnose, kein
 * Absturz.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate } from './evaluator.js';
import { DiagnosticKind } from './model.js';
import {
  ogreDataset,
  ogreDatasetWithoutMercenaries,
  MERCENARIES_CATALOGUE_ID,
  MERCENARIES_ONLY_ENTRY_ID,
} from './__fixtures__/realCatalogs.js';

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit — das Primitiv, das der
// eigene XML-Leser der Engine nutzt (wie in den uebrigen Evaluator-Tests).
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const EMPTY_ARMY = { forces: [] };

/** Anzahl der Diagnosen der gegebenen Art im Bericht. */
function countDiagnostics(report, kind) {
  return report.diagnostics.filter(diagnostic => diagnostic.kind === kind).length;
}

/** Anzahl der baumelnden `entryLink`-Diagnosen auf eine bestimmte Ziel-Id. */
function danglingEntryLinksFor(report, targetId) {
  return report.diagnostics.filter(
    diagnostic => diagnostic.kind === DiagnosticKind.DANGLING_ENTRY_LINK && diagnostic.targetId === targetId,
  ).length;
}

describe('E2E: echte DE-Daten, kataloguebergreifende Auflösung (Ogre + gst + Mercenaries)', () => {
  it('liefert fuer eine leere Armee einen strukturell vollstaendigen Bericht, ohne zu stuerzen', () => {
    const report = evaluate(ogreDataset(), EMPTY_ARMY);

    expect(Array.isArray(report.violations)).toBe(true);
    expect(report.capabilities).toBeInstanceOf(Map);
    expect(Array.isArray(report.diagnostics)).toBe(true);
  });

  it('loest alle per Verweis importierten Definitionen auf — kein Verweis erscheint fälschlich als unaufgelöst', () => {
    const report = evaluate(ogreDataset(), EMPTY_ARMY);

    // Mit der vollstaendigen Quelle (gst + Ogre + Mercenaries) loesen saemtliche
    // `entryLink`/`infoLink`-Ziele ueber die eine globale Tabelle auf.
    expect(countDiagnostics(report, DiagnosticKind.DANGLING_ENTRY_LINK)).toBe(0);
    expect(countDiagnostics(report, DiagnosticKind.DANGLING_INFO_LINK)).toBe(0);
    expect(countDiagnostics(report, DiagnosticKind.MISSING_CATALOGUE_DEPENDENCY)).toBe(0);
  });

  it('loest eine nur ueber Mercenaries erreichbare Definition auf — Beleg der kataloguebergreifenden catalogueLink-Auflösung', () => {
    const withMercenaries = evaluate(ogreDataset(), EMPTY_ARMY);
    const withoutMercenaries = evaluate(ogreDatasetWithoutMercenaries(), EMPTY_ARMY);

    // Derselbe reale Verweis (Dogs-of-War „Pikemen") baumelt ohne die Mercenaries-
    // Quelle und loest mit ihr auf — nur die kataloguebergreifende Auflösung schliesst ihn.
    expect(danglingEntryLinksFor(withoutMercenaries, MERCENARIES_ONLY_ENTRY_ID)).toBeGreaterThan(0);
    expect(danglingEntryLinksFor(withMercenaries, MERCENARIES_ONLY_ENTRY_ID)).toBe(0);
  });

  it('meldet die fehlende Mercenaries-Abhaengigkeit als Diagnose statt eines Absturzes', () => {
    const report = evaluate(ogreDatasetWithoutMercenaries(), EMPTY_ARMY);

    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({
        kind: DiagnosticKind.MISSING_CATALOGUE_DEPENDENCY,
        targetId: MERCENARIES_CATALOGUE_ID,
      }),
    );
    // Trotz der unaufgeloesten Verweise bleibt der Bericht strukturell vollstaendig.
    expect(Array.isArray(report.violations)).toBe(true);
    expect(report.capabilities).toBeInstanceOf(Map);
  });
});
