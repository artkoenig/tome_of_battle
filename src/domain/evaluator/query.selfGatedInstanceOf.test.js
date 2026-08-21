/**
 * Issue 0089: Selbst-gegatetes `instanceOf` erkennt ein leeres Kontingent nicht.
 *
 * BSData §7.7 kennt **zwei gleichbedeutende Kodierungen** der Prüfung „ist das
 * Kontingent eine Instanz dieses Detachments":
 *
 * - **Selbst-gegatet:** die forceEntry-Id steht direkt in `scope`
 *   (`scope="<forceId>"`), `childId` bleibt leer — das Idiom des „eigenen
 *   Punktelimits" aus §5.6 (Vampire-Counts-Sonderheere: eine `min`-Grenze über
 *   `limit::<pts>`, per Modifikator angehoben, gegatet auf die eigene Id).
 * - **Kanonisch:** `scope="force"` trägt das Literal-Keyword, die Id steht in
 *   `childId` (`scope="force" childId="<forceId>"`).
 *
 * Beide bedeuten dasselbe: Die Auswertung soll eine forceEntry-Instanz-Prüfung
 * daran erkennen, dass `scope` **oder** `childId` auf eine reale forceEntry-Id
 * auflöst. Insbesondere hält `instanceOf` für jeden Knoten **innerhalb** eines
 * Kontingents dieser Definition — auch wenn das Kontingent **leer** gewählt ist
 * (AC1); `notInstanceOf` hält dort dann **nicht** (AC2); beide Kodierungen
 * liefern in denselben Szenarien dasselbe Ergebnis (AC3).
 *
 * Beobachtet wird über die Fassade (wie in `compare.instanceOf.test.js` /
 * `violationClassification.test.js`): hält die Bedingung, feuert der Modifikator
 * und hebt eine Grenze, deren Verletzung im Bericht sichtbar wird.
 *
 * Offene Frage (bewusst NICHT gepinnt): eine Id, die zugleich forceEntry und
 * etwas anderes (Eintrag/Kategorie) benennt — die Kriterien lassen diese
 * Kollision unentschieden; in realen Katalogen kommt sie mutmaßlich nicht vor.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate as evaluateDataset, prepareDataset } from './evaluator.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

/** Wertet einen einzelnen synthetischen Katalog aus (ADR-0032: Datensatz-Form). */
function evaluate(catalogXml, roster) {
  return evaluateDataset(prepareDataset({ catalogues: [catalogXml] }), roster);
}

const POINTS_COST_ID = 'cost-points';
const FORCE_SPECIAL_ID = 'force-sonderheer';
const FORCE_OTHER_ID = 'force-standard';
const UNIT_ID = 'entry-unit';

// Die forceEntry-eigene Grenze (§5.6): `min` über `limit::pts`, Basis 0, per
// Modifikator auf MIN_POINTS angehoben, wenn die instanceOf-Bedingung hält.
const MIN_LIMIT_ID = 'min-own-points';
const MIN_POINTS = 2000;
// Eingestelltes Punktelimit unterhalb von MIN_POINTS: feuert der Modifikator,
// wird die angehobene Mindestgrenze verletzt (actual = BUDGET < bound = MIN_POINTS).
const BUDGET = 1000;

// Der Eintrags-seitige Beobachtungspunkt: eine Kostengrenze am Unit, verletzt
// genau dann, wenn der bedingte Kosten-Modifikator feuert (wie in
// `compare.instanceOf.test.js`).
const MAX_COST_ID = 'max-unit-points';
const UNIT_POINTS = 10;
const SURCHARGE = 5;

/**
 * Die beiden §7.7-Kodierungen derselben Prüfung, je als Condition-XML-Fabrik.
 * `value="1"` ist die belegte Form (nicht schwellwertig, siehe
 * `compare.instanceOf.test.js`).
 */
const ENCODINGS = [
  {
    name: 'selbst-gegatet (scope="<forceId>", ohne childId)',
    condition: op =>
      `<condition type="${op}" value="1" field="selections" scope="${FORCE_SPECIAL_ID}" shared="true"/>`,
  },
  {
    name: 'kanonisch (scope="force" childId="<forceId>")',
    condition: op =>
      `<condition type="${op}" value="1" field="selections" scope="force" childId="${FORCE_SPECIAL_ID}" shared="true"/>`,
  },
];

/**
 * Katalog mit dem Sonderheer (eigenes Punktelimit, §5.6-Idiom), einem zweiten
 * Kontingent und einem Unit, dessen Kosten ein Modifikator anhebt — beide
 * Modifikatoren gegatet auf dieselbe Condition `conditionXml`.
 */
function catalogue(conditionXml) {
  return `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-selfgated" name="Self-gated instanceOf Catalogue">
      <forceEntries>
        <forceEntry id="${FORCE_SPECIAL_ID}" name="Sonderheer">
          <constraints>
            <constraint id="${MIN_LIMIT_ID}" type="min" value="0" field="limit::${POINTS_COST_ID}" scope="roster"/>
          </constraints>
          <modifiers>
            <modifier type="increment" field="${MIN_LIMIT_ID}" value="${MIN_POINTS}">
              <conditions>${conditionXml}</conditions>
            </modifier>
          </modifiers>
        </forceEntry>
        <forceEntry id="${FORCE_OTHER_ID}" name="Standard"/>
      </forceEntries>
      <selectionEntries>
        <selectionEntry id="${UNIT_ID}" name="Unit" type="unit">
          <costs>
            <cost name="Points" typeId="${POINTS_COST_ID}" value="${UNIT_POINTS}"/>
          </costs>
          <constraints>
            <constraint id="${MAX_COST_ID}" type="max" value="${UNIT_POINTS}" field="${POINTS_COST_ID}" scope="roster"/>
          </constraints>
          <modifiers>
            <modifier type="increment" field="${POINTS_COST_ID}" value="${SURCHARGE}">
              <conditions>${conditionXml}</conditions>
            </modifier>
          </modifiers>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;
}

const COST_LIMITS = [{ costTypeId: POINTS_COST_ID, value: BUDGET }];

/** Sonderheer gewählt, aber LEER — der Kernfall des Audits. */
const LEERES_SONDERHEER = {
  costLimits: COST_LIMITS,
  forces: [{ defId: FORCE_SPECIAL_ID, count: 1, children: [] }],
};

/** Sonderheer gewählt mit genau einer Einheit. */
const SONDERHEER_MIT_EINHEIT = {
  costLimits: COST_LIMITS,
  forces: [{
    defId: FORCE_SPECIAL_ID,
    count: 1,
    children: [{ defId: UNIT_ID, count: 1, children: [] }],
  }],
};

/**
 * Die Einheit steht im ANDEREN Kontingent; das Sonderheer ist daneben (leer)
 * gewählt. Die Prüfung ist rahmen-relativ: für die Einheit ist ihr Kontingent
 * keine Instanz des Sonderheers — auch wenn eines im Roster existiert.
 */
const EINHEIT_IM_ANDEREN_KONTINGENT = {
  costLimits: COST_LIMITS,
  forces: [
    { defId: FORCE_OTHER_ID, count: 1, children: [{ defId: UNIT_ID, count: 1, children: [] }] },
    { defId: FORCE_SPECIAL_ID, count: 1, children: [] },
  ],
};

/** Die Verletzungen des Berichts zu einer Grenz-Id. */
function violationsOf(report, limitId) {
  return report.violations.filter(message => message.limitId === limitId);
}

for (const encoding of ENCODINGS) {
  describe(`instanceOf gegen die forceEntry — ${encoding.name}`, () => {
    const CATALOGUE = catalogue(encoding.condition('instanceOf'));

    // AC1 (Kernfall, heute rot in der selbst-gegateten Kodierung; die kanonische
    // ist die KONTROLLE): Ein gewähltes, aber leeres Sonderheer IST eine Instanz
    // seiner selbst — das Mindest-Punktelimit muss auch dann durchgesetzt werden.
    it('haelt am eigenen Limit eines LEEREN gewaehlten Sonderheers — das Mindest-Punktelimit feuert', () => {
      const report = evaluate(CATALOGUE, LEERES_SONDERHEER);

      const violations = violationsOf(report, MIN_LIMIT_ID);
      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({ actual: BUDGET, bound: MIN_POINTS });
    });

    // PIN (laut Audit heute schon gruen): mit einer Einheit im Sonderheer feuert
    // das Limit bereits — die Reparatur des Leer-Falls darf das nicht brechen.
    it('haelt am eigenen Limit eines Sonderheers MIT einer Einheit — das Mindest-Punktelimit feuert (PIN)', () => {
      const report = evaluate(CATALOGUE, SONDERHEER_MIT_EINHEIT);

      const violations = violationsOf(report, MIN_LIMIT_ID);
      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({ actual: BUDGET, bound: MIN_POINTS });
    });

    // AC1-Rahmengrenze (PIN): auch ein Selektions-Knoten INNERHALB des
    // Sonderheers ist "in einer Instanz" — der Kosten-Modifikator feuert.
    it('haelt an einer Einheit INNERHALB des Sonderheers — der Kosten-Modifikator feuert (PIN)', () => {
      const report = evaluate(CATALOGUE, SONDERHEER_MIT_EINHEIT);

      const violations = violationsOf(report, MAX_COST_ID);
      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({ actual: UNIT_POINTS + SURCHARGE, bound: UNIT_POINTS });
    });

    // AC1-Rahmengrenze (PIN): im ANDEREN Kontingent ist die Einheit keine
    // Instanz — die Erkennung darf nicht ueberschiessen und dort feuern.
    it('haelt NICHT an einer Einheit im anderen Kontingent — kein Kosten-Modifikator (PIN)', () => {
      const report = evaluate(CATALOGUE, EINHEIT_IM_ANDEREN_KONTINGENT);

      expect(violationsOf(report, MAX_COST_ID)).toHaveLength(0);
    });
  });

  describe(`notInstanceOf gegen die forceEntry — ${encoding.name}`, () => {
    const CATALOGUE = catalogue(encoding.condition('notInstanceOf'));

    // AC2 (Kernfall, heute rot in der selbst-gegateten Kodierung: die leere
    // Zaehlung laesst notInstanceOf faelschlich halten): Ein leeres Sonderheer
    // ist sehr wohl eine Instanz seiner selbst — notInstanceOf haelt dort NICHT.
    it('haelt NICHT am eigenen Limit eines LEEREN gewaehlten Sonderheers — kein Mindest-Punktelimit', () => {
      const report = evaluate(CATALOGUE, LEERES_SONDERHEER);

      expect(violationsOf(report, MIN_LIMIT_ID)).toHaveLength(0);
    });

    // PIN: mit einer Einheit haelt notInstanceOf heute schon nicht.
    it('haelt NICHT am eigenen Limit eines Sonderheers MIT einer Einheit (PIN)', () => {
      const report = evaluate(CATALOGUE, SONDERHEER_MIT_EINHEIT);

      expect(violationsOf(report, MIN_LIMIT_ID)).toHaveLength(0);
    });

    // AC2-Rahmengrenze (PIN): an einer Einheit innerhalb des Sonderheers haelt
    // notInstanceOf nicht.
    it('haelt NICHT an einer Einheit INNERHALB des Sonderheers — kein Kosten-Modifikator (PIN)', () => {
      const report = evaluate(CATALOGUE, SONDERHEER_MIT_EINHEIT);

      expect(violationsOf(report, MAX_COST_ID)).toHaveLength(0);
    });

    // AC2-Rahmengrenze (PIN): im ANDEREN Kontingent haelt notInstanceOf — der
    // Kosten-Modifikator feuert dort.
    it('haelt an einer Einheit im anderen Kontingent — der Kosten-Modifikator feuert (PIN)', () => {
      const report = evaluate(CATALOGUE, EINHEIT_IM_ANDEREN_KONTINGENT);

      const violations = violationsOf(report, MAX_COST_ID);
      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({ actual: UNIT_POINTS + SURCHARGE, bound: UNIT_POINTS });
    });
  });
}

// ── AC3: beide Kodierungen liefern in denselben Szenarien dasselbe Ergebnis ──

describe('AC3: selbst-gegatete und kanonische Kodierung sind gleichbedeutend', () => {
  const SCENARIOS = [
    { name: 'leeres Sonderheer', roster: LEERES_SONDERHEER },
    { name: 'Sonderheer mit einer Einheit', roster: SONDERHEER_MIT_EINHEIT },
    { name: 'Einheit im anderen Kontingent (Sonderheer leer daneben)', roster: EINHEIT_IM_ANDEREN_KONTINGENT },
  ];

  /** Welche der beiden beobachteten Grenzen im Bericht gefeuert haben. */
  function firedLimits(report) {
    return {
      minOwnPoints: violationsOf(report, MIN_LIMIT_ID).length,
      maxUnitPoints: violationsOf(report, MAX_COST_ID).length,
    };
  }

  const [SELF_GATED, CANONICAL] = ENCODINGS;

  for (const op of ['instanceOf', 'notInstanceOf']) {
    for (const scenario of SCENARIOS) {
      it(`${op}: „${scenario.name}" — gleiche Verletzungen in beiden Kodierungen`, () => {
        const selfGated = evaluate(catalogue(SELF_GATED.condition(op)), scenario.roster);
        const canonical = evaluate(catalogue(CANONICAL.condition(op)), scenario.roster);

        expect(firedLimits(selfGated)).toEqual(firedLimits(canonical));
      });
    }
  }
});

// ── Kante: eine unbekannte Id im Scope bleibt fail-closed unaufgeloest ───────

describe('unbekannte Scope-Id: bleibt auf dem fail-closed UNRESOLVED_SCOPE-Pfad (PIN)', () => {
  const GHOST_ID = 'force-gibt-es-nicht';
  // Dieselbe selbst-gegatete Form, aber mit einer Id, die KEINE Definition des
  // Datensatzes benennt: die forceEntry-Erkennung darf sie nicht verschlucken.
  const CATALOGUE = catalogue(
    `<condition type="instanceOf" value="1" field="selections" scope="${GHOST_ID}" shared="true"/>`,
  );

  it('die Bedingung haelt nicht (kein Modifikator), und der Bericht traegt die unresolvedScope-Diagnose', () => {
    const report = evaluate(CATALOGUE, SONDERHEER_MIT_EINHEIT);

    expect(violationsOf(report, MAX_COST_ID)).toHaveLength(0);
    expect(violationsOf(report, MIN_LIMIT_ID)).toHaveLength(0);
    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({ kind: 'unresolvedScope', scope: GHOST_ID }),
    );
  });
});
