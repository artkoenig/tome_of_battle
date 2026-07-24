import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate } from './evaluator.js';

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit (wie im Skeleton-Test).
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

// ── Eigene, minimale Fixtures (ADR-0030: eigenes Datenmodell, eigene Fixtures) ──
// Diese Scheibe (Issue 02) verbreitert die Grenz-Oberflaeche: MIN- und
// MAX-Grenzen ueber Selektionsanzahl *und* Kostensummen (Kostenart per ID)
// sowie Prozentgrenzen mit einer zentralen Rundungskonvention.

const WARRIOR_DEF_ID = 'entry-warrior';
const ARCHER_DEF_ID = 'entry-archer';
const POINTS_COST_ID = 'cost-points-guid';
const MANA_COST_ID = 'cost-mana-guid';

/** Baut ein Roster mit gegebenen Instanzanzahlen je Eintrag. */
function roster(forces) {
  return { forces };
}

describe('MIN-Grenzen (Selektionsanzahl)', () => {
  const MIN_WARRIORS = 3;
  const MIN_WARRIORS_LIMIT_ID = 'min-warriors';
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-min" name="Min Catalogue">
      <selectionEntries>
        <selectionEntry id="${WARRIOR_DEF_ID}" name="Warrior" type="unit">
          <constraints>
            <constraint id="${MIN_WARRIORS_LIMIT_ID}" type="min" value="${MIN_WARRIORS}" field="selections" scope="roster"/>
          </constraints>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('meldet eine Verletzung mit Ist/Grenze/Delta, wenn die Anzahl unter der MIN-Grenze liegt', () => {
    const under = MIN_WARRIORS - 1;

    const report = evaluate(CATALOGUE_XML, roster([{ defId: WARRIOR_DEF_ID, count: under, children: [] }]));

    expect(report.violations).toHaveLength(1);
    expect(report.violations[0]).toEqual({
      limitId: MIN_WARRIORS_LIMIT_ID,
      anchor: { defId: WARRIOR_DEF_ID, name: 'Warrior' },
      actual: under,
      bound: MIN_WARRIORS,
      delta: MIN_WARRIORS - under,
    });
  });

  it('meldet keine Verletzung, wenn die Anzahl die MIN-Grenze genau erreicht', () => {
    const report = evaluate(CATALOGUE_XML, roster([{ defId: WARRIOR_DEF_ID, count: MIN_WARRIORS, children: [] }]));

    expect(report.violations).toHaveLength(0);
  });

  it('meldet keine Verletzung, wenn die Anzahl die MIN-Grenze ueberschreitet', () => {
    const report = evaluate(CATALOGUE_XML, roster([{ defId: WARRIOR_DEF_ID, count: MIN_WARRIORS + 1, children: [] }]));

    expect(report.violations).toHaveLength(0);
  });
});

describe('Grenzen ueber Kostensummen (Kostenart per ID)', () => {
  const WARRIOR_POINTS = 13;
  const WARRIOR_MANA = 7;
  const MAX_POINTS = 25;
  const MAX_POINTS_LIMIT_ID = 'max-points';
  // Der Eintrag traegt zwei Kostenarten; die Grenze zaehlt nur die Punkte-Art
  // (per ID), nie die Mana-Art — obwohl beide am selben Eintrag haengen.
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-cost" name="Cost Catalogue">
      <selectionEntries>
        <selectionEntry id="${WARRIOR_DEF_ID}" name="Warrior" type="unit">
          <costs>
            <cost name="Points" typeId="${POINTS_COST_ID}" value="${WARRIOR_POINTS}"/>
            <cost name="Mana" typeId="${MANA_COST_ID}" value="${WARRIOR_MANA}"/>
          </costs>
          <constraints>
            <constraint id="${MAX_POINTS_LIMIT_ID}" type="max" value="${MAX_POINTS}" field="${POINTS_COST_ID}" scope="roster"/>
          </constraints>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('wertet gegen die korrekte Kostenart aus und meldet Ist/Grenze/Delta bei Ueberschreitung', () => {
    const count = 2; // 2 * 13 = 26 Punkte > 25

    const report = evaluate(CATALOGUE_XML, roster([{ defId: WARRIOR_DEF_ID, count, children: [] }]));

    expect(report.violations).toHaveLength(1);
    expect(report.violations[0]).toEqual({
      limitId: MAX_POINTS_LIMIT_ID,
      anchor: { defId: WARRIOR_DEF_ID, name: 'Warrior' },
      actual: WARRIOR_POINTS * count,
      bound: MAX_POINTS,
      delta: MAX_POINTS - WARRIOR_POINTS * count,
    });
  });

  it('meldet keine Verletzung, wenn die Kostensumme innerhalb der Grenze bleibt', () => {
    const count = 1; // 13 Punkte <= 25

    const report = evaluate(CATALOGUE_XML, roster([{ defId: WARRIOR_DEF_ID, count, children: [] }]));

    expect(report.violations).toHaveLength(0);
  });
});

describe('Prozentgrenzen (aus dem Nenner des Bezugsrahmens abgeleitet)', () => {
  const HALF_LIMIT_ID = 'max-half-of-roster';
  // MAX 50 % der Selektionsanzahl im Roster, verankert am Warrior.
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-percent" name="Percent Catalogue">
      <selectionEntries>
        <selectionEntry id="${WARRIOR_DEF_ID}" name="Warrior" type="unit">
          <constraints>
            <constraint id="${HALF_LIMIT_ID}" type="max" value="50" percentValue="true" field="selections" scope="roster"/>
          </constraints>
        </selectionEntry>
        <selectionEntry id="${ARCHER_DEF_ID}" name="Archer" type="unit"/>
      </selectionEntries>
    </catalogue>`;

  it('leitet den Grenzwert aus dem Nenner ab und meldet eine Verletzung bei Ueberschreitung', () => {
    // Nenner (alle Selektionen) = 3 + 1 = 4 → Grenze = round(4 * 50/100) = 2.
    const report = evaluate(CATALOGUE_XML, roster([
      { defId: WARRIOR_DEF_ID, count: 3, children: [] },
      { defId: ARCHER_DEF_ID, count: 1, children: [] },
    ]));

    expect(report.violations).toHaveLength(1);
    expect(report.violations[0]).toEqual({
      limitId: HALF_LIMIT_ID,
      anchor: { defId: WARRIOR_DEF_ID, name: 'Warrior' },
      actual: 3,
      bound: 2,
      delta: -1,
    });
  });

  it('rundet den Grenzwert kaufmaennisch auf (round half up), nicht ab', () => {
    // Nenner = 3 + 2 = 5 → 5 * 50/100 = 2.5 → round half up = 3.
    // Bei Abrunden (floor -> 2) waere Warrior mit 3 verletzt; hier nicht.
    const report = evaluate(CATALOGUE_XML, roster([
      { defId: WARRIOR_DEF_ID, count: 3, children: [] },
      { defId: ARCHER_DEF_ID, count: 2, children: [] },
    ]));

    expect(report.violations).toHaveLength(0);
  });
});

describe('Prozentgrenze mit Nenner 0 (Annahme A4)', () => {
  const MANA_SHARE_LIMIT_ID = 'max-mana-share';
  // Prozentgrenze auf eine Kostenart, die im Roster niemand traegt → Nenner 0.
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-zero" name="Zero Denominator Catalogue">
      <selectionEntries>
        <selectionEntry id="${WARRIOR_DEF_ID}" name="Warrior" type="unit">
          <costs>
            <cost name="Points" typeId="${POINTS_COST_ID}" value="10"/>
          </costs>
          <constraints>
            <constraint id="${MANA_SHARE_LIMIT_ID}" type="max" value="50" percentValue="true" field="${MANA_COST_ID}" scope="roster"/>
          </constraints>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('erzeugt keine Verletzung, sondern eine Null-Nenner-Diagnose', () => {
    const report = evaluate(CATALOGUE_XML, roster([{ defId: WARRIOR_DEF_ID, count: 2, children: [] }]));

    expect(report.violations).toHaveLength(0);
    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({ kind: 'zeroDenominator', limitId: MANA_SHARE_LIMIT_ID })
    );
  });
});
