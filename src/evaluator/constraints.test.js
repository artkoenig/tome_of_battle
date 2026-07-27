import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate as evaluateDataset, prepareDataset } from './evaluator.js';
import { AnchorKind, ConstraintKind, LimitMeasure, MessageOrigin, MessageSeverity, ScopeKind } from './model.js';

/**
 * Wertet einen einzelnen synthetischen Katalog aus. Die Fassade ist zweistufig
 * (Main-Issue 75, Baustein 8): erst den Datensatz aufbereiten, dann auswerten. Der
 * Datensatz hat die Form `{ gameSystem, catalogues }` (ADR-0032); ein Einzelkatalog
 * ohne Spielsystem ist `{ catalogues: [xml] }`.
 */
function evaluate(catalogXml, roster) {
  return evaluateDataset(prepareDataset({ catalogues: [catalogXml] }), roster);
}

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

/**
 * Die Zaehl-Flags einer Grenze ohne eigene Angaben — die XSD-Vorgaben, mit denen
 * die Einordnung einen fehlenden Wert auffuellt (`shared` ist standardmaessig true).
 */
const DEFAULT_SCOPE_FLAGS = {
  shared: true,
  includeChildSelections: false,
  includeChildForces: false,
};

/**
 * Die Einordnung einer abgeleiteten Meldung am belegten Slot (Issue 75/07): jede
 * Verletzung nennt seit dieser Scheibe zusaetzlich ihre Herkunft, ihren
 * Schweregrad, die Art der Grenze mit ihrem Bezugsrahmen und den vollstaendig
 * beschriebenen Anker. Die Erwartungen unten bleiben **erschoepfend** (`toEqual`);
 * dieser Helfer haelt nur den gemeinsamen Teil an einer Stelle.
 */
function derivedAt(defId, name, { measure, kind, scope, isPercent = false, costTypeId = null }) {
  return {
    origin: MessageOrigin.DERIVED_LIMIT,
    severity: MessageSeverity.ERROR,
    anchor: {
      defId,
      name,
      path: '0',
      anchorKind: AnchorKind.OCCUPIED,
      isValueUnstable: false,
    },
    limit: {
      kind,
      measure,
      costTypeId,
      isPercent,
      scope: { kind: scope, targetId: null, flags: DEFAULT_SCOPE_FLAGS },
    },
  };
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
      ...derivedAt(WARRIOR_DEF_ID, 'Warrior', {
        kind: ConstraintKind.MIN,
        measure: LimitMeasure.SELECTION_COUNT,
        scope: ScopeKind.ROSTER,
      }),
      limitId: MIN_WARRIORS_LIMIT_ID,
      actual: under,
      bound: MIN_WARRIORS,
      delta: MIN_WARRIORS - under,
      // Unveraenderter Grenzwert: die Herleitung besteht nur aus ihrem Basiswert.
      derivation: { base: MIN_WARRIORS, steps: [] },
      // Kein bedingter Schritt ⇒ keine benennbare Ursache ⇒ das Feld fehlt (ADR-0027).
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
      // Die Einordnung nennt die Kostenart, gegen die gemessen wurde — ohne sie
      // liesse sich eine Kostensummen-Grenze nicht ihrer Kostenart zuordnen.
      ...derivedAt(WARRIOR_DEF_ID, 'Warrior', {
        kind: ConstraintKind.MAX,
        measure: LimitMeasure.COST_SUM,
        costTypeId: POINTS_COST_ID,
        scope: ScopeKind.ROSTER,
      }),
      limitId: MAX_POINTS_LIMIT_ID,
      actual: WARRIOR_POINTS * count,
      bound: MAX_POINTS,
      delta: MAX_POINTS - WARRIOR_POINTS * count,
      derivation: { base: MAX_POINTS, steps: [] },
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
      // `isPercent` ist der Schluessel zum Verstaendnis der Kette: die Einordnung
      // sagt damit, dass `bound` der abgeleitete Wert und die Kette der Prozentsatz ist.
      ...derivedAt(WARRIOR_DEF_ID, 'Warrior', {
        kind: ConstraintKind.MAX,
        measure: LimitMeasure.SELECTION_COUNT,
        isPercent: true,
        scope: ScopeKind.ROSTER,
      }),
      limitId: HALF_LIMIT_ID,
      actual: 3,
      bound: 2,
      delta: -1,
      // Bei einer Prozentgrenze beschreibt die Herleitung den **Prozentsatz** (50),
      // nicht den daraus abgeleiteten Grenzwert (2) — auf ihn wirkt ein Modifikator.
      derivation: { base: 50, steps: [] },
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

describe('Unbegrenztheit: der Sentinel wird an der Deklaration gedeutet, nicht am Ergebnis', () => {
  const MAX_WARRIORS_LIMIT_ID = 'max-warriors';
  // Beide Schreibweisen des Sentinels kommen in echten Katalogen vor: `-1` in der
  // Definitive Edition, `-1.0` in den aelteren Datensaetzen. Sie stehen hier als
  // **Rohtext**, denn genau die Textform ist es, die numerisch gedeutet werden muss.
  const UNLIMITED_XML = '-1';
  const UNLIMITED_XML_DECIMAL = '-1.0';

  /**
   * Ein Katalog mit genau einer MAX-Grenze (Selektionsanzahl, roster-weit) am
   * Krieger — deklariert mit `declaredValue`, optional veraendert durch die
   * mitgegebenen, bedingungslosen Modifikatoren.
   */
  function catalogueWith(declaredValue, modifiersXml = '') {
    return `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-unlimited" name="Unlimited Catalogue">
        <selectionEntries>
          <selectionEntry id="${WARRIOR_DEF_ID}" name="Warrior" type="unit">
            <constraints>
              <constraint id="${MAX_WARRIORS_LIMIT_ID}" type="max" value="${declaredValue}" field="selections" scope="roster"/>
            </constraints>
            <modifiers>${modifiersXml}</modifiers>
          </selectionEntry>
        </selectionEntries>
      </catalogue>`;
  }

  /** Ein bedingungsloser Modifikator auf die eine MAX-Grenze. */
  function limitModifier(type, value) {
    return `<modifier type="${type}" field="${MAX_WARRIORS_LIMIT_ID}" value="${value}"/>`;
  }

  /** Die Verletzungen der einen MAX-Grenze im Roster mit `count` Kriegern. */
  function violationsOf(catalogueXml, count) {
    const report = evaluate(catalogueXml, roster([{ defId: WARRIOR_DEF_ID, count, children: [] }]));
    return report.violations.filter(violation => violation.limitId === MAX_WARRIORS_LIMIT_ID);
  }

  it('laesst eine mit dem Sentinel deklarierte Grenze nie feuern', () => {
    expect(violationsOf(catalogueWith(UNLIMITED_XML), 99)).toHaveLength(0);
  });

  it('erkennt den Sentinel auch in der Dezimal-Schreibweise der Deklaration', () => {
    expect(violationsOf(catalogueWith(UNLIMITED_XML_DECIMAL), 99)).toHaveLength(0);
  });

  it('macht eine endliche Grenze unbegrenzt, wenn ein Modifikator sie auf den Sentinel setzt', () => {
    const catalogueXml = catalogueWith(1, limitModifier('set', UNLIMITED_XML));

    expect(violationsOf(catalogueXml, 2)).toHaveLength(0);
  });

  it('erkennt den Sentinel auch in der Dezimal-Schreibweise eines Setz-Modifikators', () => {
    const catalogueXml = catalogueWith(1, limitModifier('set', UNLIMITED_XML_DECIMAL));

    expect(violationsOf(catalogueXml, 2)).toHaveLength(0);
  });

  // Kein Katalog im Repo zieht eine Grenze ins Negative — deshalb steht dieser Fall
  // hier als Modultest und nicht als E2E-Szenario (ADR-0033: keine erfundenen
  // Katalogdaten). Er landet bewusst **exakt** auf dem Sentinel: eine Deutung am
  // Ergebnis statt an der Deklaration liesse die schaerfste aller Grenzen still
  // verschwinden.
  it('deutet eine von einem Modifikator ins Negative gezogene Grenze nicht als unbegrenzt', () => {
    const catalogueXml = catalogueWith(1, limitModifier('decrement', 2));

    const violations = violationsOf(catalogueXml, 1);

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ actual: 1, bound: -1 });
  });

  // Ebenfalls unbelegt im Datensatz des Evaluators (122 Grenzen mit dem Sentinel,
  // 36 Ziele arithmetischer Modifikatoren, Schnittmenge leer) — und ebenfalls
  // deshalb ein Modultest: eine Rechnung erklaert nichts, ihr Ergebnis ist immer
  // eine gewoehnliche Zahl.
  it('macht aus einer mit dem Sentinel deklarierten, hochgezaehlten Grenze eine gewoehnliche Zahl', () => {
    const catalogueXml = catalogueWith(UNLIMITED_XML, limitModifier('increment', 2));

    const violations = violationsOf(catalogueXml, 2);

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ actual: 2, bound: 1 });
  });

  it('haelt eine Grenze auch dann fuer eine Zahl, wenn die Rechnung genau auf dem Sentinel landet', () => {
    // 0 - 1 = -1: derselbe Zahlwert wie der Sentinel, aber keine Erklaerung.
    const catalogueXml = catalogueWith(0, limitModifier('decrement', 1));

    const violations = violationsOf(catalogueXml, 1);

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ actual: 1, bound: -1 });
  });

  it('fragt fuer eine unbegrenzte Prozentgrenze keinen Nenner ab und meldet keinen Null-Nenner', () => {
    // Eine unbegrenzte Grenze gilt ohnehin nicht; eine Null-Nenner-Diagnose fuer sie
    // waere ein Befund ueber eine Regel, die gar nicht ausgewertet wird.
    const catalogueXml = `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-unlimited-percent" name="Unlimited Percent Catalogue">
        <selectionEntries>
          <selectionEntry id="${WARRIOR_DEF_ID}" name="Warrior" type="unit">
            <constraints>
              <constraint id="${MAX_WARRIORS_LIMIT_ID}" type="max" value="${UNLIMITED_XML}" percentValue="true" field="${MANA_COST_ID}" scope="roster"/>
            </constraints>
          </selectionEntry>
        </selectionEntries>
      </catalogue>`;

    const report = evaluate(catalogueXml, roster([{ defId: WARRIOR_DEF_ID, count: 1, children: [] }]));

    expect(report.violations).toHaveLength(0);
    expect(report.diagnostics).not.toContainEqual(
      expect.objectContaining({ kind: 'zeroDenominator', limitId: MAX_WARRIORS_LIMIT_ID })
    );
  });
});

describe('Berichtsfaehigkeit: welches Ergebnis als Verletzung gemeldet werden darf', () => {
  const FORCE_DEF_ID = 'force-army';
  const MAX_ARCHERS_LIMIT_ID = 'max-archers';
  const MAX_ARCHERS = 1;
  // Zwei Wurzeldefinitionen mit derselben MAX-Grenzenart: die Bogenschuetzen sind
  // gewaehlt (belegter Slot, berichtsfaehig), die Krieger nur angeboten.
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-reportable" name="Reportable Catalogue">
      <forceEntries>
        <forceEntry id="${FORCE_DEF_ID}" name="Army"/>
      </forceEntries>
      <selectionEntries>
        <selectionEntry id="${ARCHER_DEF_ID}" name="Archer" type="unit">
          <constraints>
            <constraint id="${MAX_ARCHERS_LIMIT_ID}" type="max" value="${MAX_ARCHERS}" field="selections" scope="roster"/>
          </constraints>
        </selectionEntry>
        <selectionEntry id="${WARRIOR_DEF_ID}" name="Warrior" type="unit"/>
      </selectionEntries>
    </catalogue>`;

  /** Ein Kontingent mit `count` Bogenschuetzen; die Krieger bleiben ungewaehlt. */
  function armyWithArchers(count) {
    return roster([{ defId: FORCE_DEF_ID, count: 1, children: [{ defId: ARCHER_DEF_ID, count, children: [] }] }]);
  }

  it('meldet die verletzte Grenze am belegten Slot genau einmal — nicht ein zweites Mal am Angebot', () => {
    // Der Angebots-Anker der Bogenschuetzen entfaellt im belegten Kontingent
    // (Entdopplung); ohne die Berichtsfaehigkeit truege ihn ein anderes Kontingent.
    const report = evaluate(CATALOGUE_XML, armyWithArchers(MAX_ARCHERS + 1));

    expect(report.violations.filter(violation => violation.limitId === MAX_ARCHERS_LIMIT_ID)).toHaveLength(1);
  });

  it('meldet dieselbe Grenze am Angebots-Anker eines zweiten Kontingents nicht noch einmal', () => {
    // Zwei Kontingente: im ersten stehen zu viele Bogenschuetzen, im zweiten sind
    // sie nur angeboten. Die armeeweite Grenze laese dort denselben Ist-Wert.
    const report = evaluate(CATALOGUE_XML, roster([
      { defId: FORCE_DEF_ID, count: 1, children: [{ defId: ARCHER_DEF_ID, count: MAX_ARCHERS + 1, children: [] }] },
      { defId: FORCE_DEF_ID, count: 1, children: [] },
    ]));

    expect(report.violations.filter(violation => violation.limitId === MAX_ARCHERS_LIMIT_ID)).toHaveLength(1);
  });

  it('fuehrt den Angebots-Anker des zweiten Kontingents trotzdem als gesperrten Slot', () => {
    const report = evaluate(CATALOGUE_XML, roster([
      { defId: FORCE_DEF_ID, count: 1, children: [{ defId: ARCHER_DEF_ID, count: MAX_ARCHERS + 1, children: [] }] },
      { defId: FORCE_DEF_ID, count: 1, children: [] },
    ]));

    const offered = [...report.capabilities.values()]
      .find(capability => capability.defId === ARCHER_DEF_ID && capability.anchorKind === AnchorKind.OFFER_ANCHOR);
    expect(offered).toMatchObject({ effectiveMax: MAX_ARCHERS, current: MAX_ARCHERS + 1, isBlocked: true, headroom: 0 });
  });
});
