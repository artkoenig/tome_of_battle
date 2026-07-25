import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate } from './evaluator.js';

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit (wie in den Parser-/
// Solver-Tests). Der eigene XML-Leser der Engine nutzt genau dieses Primitiv.
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

// ── Eigene, minimale Fixture (ADR-0030: eigenes Datenmodell, eigene Fixtures) ──
// Ein Eintrag mit einer MAX-Grenze von 2 auf die Selektionsanzahl im Roster.
const WARRIOR_DEF_ID = 'entry-warrior';
const MAX_WARRIORS_LIMIT_ID = 'max-warriors';
const MAX_WARRIORS = 2;

const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
<catalogue id="cat-skeleton" name="Walking Skeleton Catalogue">
  <selectionEntries>
    <selectionEntry id="${WARRIOR_DEF_ID}" name="Warrior" type="unit">
      <constraints>
        <constraint id="${MAX_WARRIORS_LIMIT_ID}" type="max" value="${MAX_WARRIORS}" field="selections" scope="roster"/>
      </constraints>
    </selectionEntry>
  </selectionEntries>
</catalogue>`;

/** Baut ein Roster mit einer einzelnen Warrior-Instanz gegebener Anzahl. */
function rosterWithWarriorCount(count) {
  return { forces: [{ defId: WARRIOR_DEF_ID, count, children: [] }] };
}

describe('evaluate (Walking Skeleton)', () => {
  it('ist ueber die Fassade als reine Funktion aufrufbar und liefert einen Bericht', () => {
    const report = evaluate(CATALOGUE_XML, rosterWithWarriorCount(MAX_WARRIORS));

    expect(report).toHaveProperty('violations');
    expect(report).toHaveProperty('diagnostics');
    expect(Array.isArray(report.violations)).toBe(true);
    expect(Array.isArray(report.diagnostics)).toBe(true);
  });

  it('meldet eine Verletzung mit Ist-Wert, Grenzwert, Delta und Bezugsinstanz, wenn MAX ueberschritten ist', () => {
    const overLimit = MAX_WARRIORS + 1;

    const report = evaluate(CATALOGUE_XML, rosterWithWarriorCount(overLimit));

    expect(report.violations).toHaveLength(1);
    expect(report.violations[0]).toEqual({
      limitId: MAX_WARRIORS_LIMIT_ID,
      anchor: { defId: WARRIOR_DEF_ID, name: 'Warrior' },
      actual: overLimit,
      bound: MAX_WARRIORS,
      delta: MAX_WARRIORS - overLimit,
    });
  });

  it('meldet keine Verletzung, wenn die Anzahl genau der MAX-Grenze entspricht', () => {
    const report = evaluate(CATALOGUE_XML, rosterWithWarriorCount(MAX_WARRIORS));

    expect(report.violations).toHaveLength(0);
  });

  it('meldet keine Verletzung, wenn die Anzahl unter der MAX-Grenze liegt', () => {
    const report = evaluate(CATALOGUE_XML, rosterWithWarriorCount(MAX_WARRIORS - 1));

    expect(report.violations).toHaveLength(0);
  });

  it('erzeugt eine Diagnose statt eines Absturzes, wenn eine Definition fehlt', () => {
    const report = evaluate(CATALOGUE_XML, { forces: [{ defId: 'unknown-entry', count: 1, children: [] }] });

    expect(report.violations).toHaveLength(0);
    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({ kind: 'unresolvedDefinition', defId: 'unknown-entry' })
    );
  });

  it('ist seiteneffektfrei: gleicher Input liefert gleichen Bericht und mutiert das Roster nicht', () => {
    const roster = rosterWithWarriorCount(MAX_WARRIORS + 1);
    const rosterSnapshot = JSON.stringify(roster);

    const first = evaluate(CATALOGUE_XML, roster);
    const second = evaluate(CATALOGUE_XML, roster);

    expect(first).toEqual(second);
    expect(JSON.stringify(roster)).toBe(rosterSnapshot);
  });
});
