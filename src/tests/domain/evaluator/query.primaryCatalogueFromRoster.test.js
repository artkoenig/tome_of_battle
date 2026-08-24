/**
 * Failing-test pin fuer Issue 0140, Kriterium 6: der Bezugsrahmen
 * `primary-catalogue` beantwortet dieselbe Frage aus derselben Quelle — traegt
 * ein Kontingent des Rosters seine Armeebuch-Id, loest der Rahmen darueber auf,
 * statt ihn als `unresolvedScope` zu melden.
 *
 * Aufbau und Beobachtungspunkt sind die von `query.primaryCatalogueScope.test.js`
 * (Issue 077): eine Einheit mit Kostengrenze genau auf ihrem Basiswert und einem
 * auf `scope="primary-catalogue"` gegateten Kosten-Aufschlag. Haelt die
 * Bedingung, feuert der Modifikator und die Grenze wird verletzt — der
 * Verstoss im Bericht ist damit der sichtbare Beweis der Antwort. Der zweite
 * Beobachtungspunkt ist die Diagnose `unresolvedScope` selbst.
 *
 * Der Unterschied zu Issue 077: dort stand das Kontingent in einer `.cat` und
 * der Herkunftsindex konnte antworten. Hier steht es in der **Spielsystemdatei**
 * — der Index kann prinzipiell nicht antworten, und heute faellt der Rahmen
 * deshalb fail-closed aus (`unresolvedScope`, Ergebnis 0). Kriterium 6 verlangt,
 * dass die Angabe des Rosters an dieser Stelle dieselbe Antwort liefert wie
 * ueberall sonst in der Engine.
 *
 * Der PIN „Kontingent aus der `.gst` bleibt fail-closed" aus Issue 077
 * (`query.primaryCatalogueScope.test.js`) bleibt gueltig — er gilt fuer ein
 * Roster **ohne** Armeebuch-Id, und genau das pinnt hier die Regressions-Wache
 * zu Kriterium 4 noch einmal am selben Datensatz.
 *
 * ── Rangfolge (revidierte Entscheidung) ─────────────────────────────────────
 * Wo der Herkunftsindex antwortet, gilt **er**; die Angabe des Rosters fuellt
 * nur die Luecke. Beleg ist ein Black-Box-Szenario zu genau diesem Rahmen:
 * `docs/testing/primary-catalogue-scope`, Roster
 * `10-vampire-force-with-ogre-catalogueid-attribute.ros` — „Das Armeebuch kommt
 * aus der Herkunft der Force-DEFINITION, nicht aus dem Roster-Attribut."
 *
 * Zur Namenswahl `catalogueId` am Kontingent-Knoten des Eingabe-Rosters siehe
 * den Kopf von `crossCatalog.rosterDeclaredCatalogue.test.js`.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate, prepareDataset } from '../../../domain/evaluator/evaluator.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

/** Das Schluesselwort, so wie es in den Katalogdaten steht. */
const PRIMARY_CATALOGUE = 'primary-catalogue';

const GAME_SYSTEM_ID = 'gs-0140-primary';
const POINTS_ID = 'cost-points-0140';
const CATALOGUE_A_ID = 'cat-a-0140-primary';
const CATALOGUE_B_ID = 'cat-b-0140-primary';

/** Das Kontingent der **Spielsystemdatei** — der Fall des Issues. */
const GST_FORCE_ID = 'gst-force-0140-primary';
/** Ein Kontingent, das Armeebuch B in seiner eigenen `.cat` deklariert. */
const B_OWN_FORCE_ID = 'b-own-force-0140-primary';

const ALPHA_ID = 'entry-alpha-0140';
const MAX_ALPHA_ID = 'max-alpha-points-0140';

const UNIT_POINTS = 10;
const SURCHARGE = 5;
/** Die Grenze liegt auf dem Basiswert: nur ein feuernder Modifikator verletzt sie. */
const VIOLATING_POINTS = UNIT_POINTS + SURCHARGE;

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
  <gameSystem id="${GAME_SYSTEM_ID}" name="Test System">
    <costTypes><costType id="${POINTS_ID}" name="pts"/></costTypes>
    <forceEntries><forceEntry id="${GST_FORCE_ID}" name="System Force"/></forceEntries>
  </gameSystem>`;

/** Armeebuch A: die Einheit mit dem gegateten Aufschlag. */
function catalogueA(conditionXml) {
  return `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="${CATALOGUE_A_ID}" name="Army A" gameSystemId="${GAME_SYSTEM_ID}" library="false">
      <selectionEntries>
        <selectionEntry id="${ALPHA_ID}" name="Alpha" type="unit">
          <costs><cost name="Points" typeId="${POINTS_ID}" value="${UNIT_POINTS}"/></costs>
          <constraints>
            <constraint id="${MAX_ALPHA_ID}" type="max" value="${UNIT_POINTS}" field="${POINTS_ID}" scope="roster"/>
          </constraints>
          <modifiers>
            <modifier type="increment" field="${POINTS_ID}" value="${SURCHARGE}">
              <conditions>${conditionXml}</conditions>
            </modifier>
          </modifiers>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;
}

/** Armeebuch B: nur sein eigenes Kontingent — die Einheit kommt aus A. */
const CATALOGUE_B_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="${CATALOGUE_B_ID}" name="Army B" gameSystemId="${GAME_SYSTEM_ID}" library="false">
    <forceEntries><forceEntry id="${B_OWN_FORCE_ID}" name="Own Force of B"/></forceEntries>
  </catalogue>`;

/** Die Bedingung „das Armeebuch des Kontingents ist `catalogueId`". */
function primaryCatalogueCondition(type, catalogueId) {
  return `<condition type="${type}" value="1" field="selections" scope="${PRIMARY_CATALOGUE}"`
    + ` childId="${catalogueId}" shared="true"/>`;
}

/**
 * Wertet den Zwei-Armeebuch-Datensatz aus: ein Kontingent mit der Einheit
 * Alpha, wahlweise mit Armeebuch-Id am Kontingent-Knoten.
 */
function evaluateWith(conditionXml, forceDefId, catalogueId) {
  const children = [{ defId: ALPHA_ID, count: 1, children: [] }];
  const force = catalogueId === undefined
    ? { defId: forceDefId, count: 1, children }
    : { defId: forceDefId, count: 1, catalogueId, children };
  return evaluate(
    prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [catalogueA(conditionXml), CATALOGUE_B_XML] }),
    { forces: [force] },
  );
}

/** Die Verletzungen des Berichts zu einer Grenz-Id. */
function violationsOf(report, limitId) {
  return report.violations.filter(violation => violation.limitId === limitId);
}

/** Die `unresolvedScope`-Diagnosen des Berichts zu einem Bezugsrahmen. */
function unresolvedScopeOf(report, scope) {
  return (report.diagnostics ?? []).filter(
    diagnostic => diagnostic.kind === 'unresolvedScope' && diagnostic.scope === scope,
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Kriterium 6: das Kontingent stammt aus der .gst, das Roster nennt sein Buch
// ═════════════════════════════════════════════════════════════════════════════

describe('Kriterium 6: primary-catalogue loest ueber die Armeebuch-Id des Rosters auf', () => {
  it('instanceOf auf das genannte Armeebuch haelt — der Aufschlag feuert', () => {
    const report = evaluateWith(
      primaryCatalogueCondition('instanceOf', CATALOGUE_A_ID), GST_FORCE_ID, CATALOGUE_A_ID,
    );

    const violations = violationsOf(report, MAX_ALPHA_ID);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ actual: VIOLATING_POINTS, bound: UNIT_POINTS });
  });

  it('und der Bericht traegt KEINE unresolvedScope-Diagnose fuer diesen Rahmen', () => {
    const report = evaluateWith(
      primaryCatalogueCondition('instanceOf', CATALOGUE_A_ID), GST_FORCE_ID, CATALOGUE_A_ID,
    );

    expect(unresolvedScopeOf(report, PRIMARY_CATALOGUE)).toEqual([]);
  });

  it('instanceOf auf ein ANDERES Armeebuch haelt nicht — kein Aufschlag, und trotzdem keine Diagnose', () => {
    // 0 ist hier eine Antwort, kein Datenfehler (Antwortvertrag Issue 077).
    const report = evaluateWith(
      primaryCatalogueCondition('instanceOf', CATALOGUE_B_ID), GST_FORCE_ID, CATALOGUE_A_ID,
    );

    expect(violationsOf(report, MAX_ALPHA_ID)).toHaveLength(0);
    expect(unresolvedScopeOf(report, PRIMARY_CATALOGUE)).toEqual([]);
  });

  it('notInstanceOf auf das eigene Armeebuch haelt NICHT — der Rahmen ist aufgeloest, nicht leer', () => {
    // Der schaerfste der vier Faelle: heute liefert der fail-closed Zweig 0, und
    // `notInstanceOf` haelt bei 0 — der Aufschlag feuert also faelschlich.
    const report = evaluateWith(
      primaryCatalogueCondition('notInstanceOf', CATALOGUE_A_ID), GST_FORCE_ID, CATALOGUE_A_ID,
    );

    expect(violationsOf(report, MAX_ALPHA_ID)).toHaveLength(0);
  });

  it('notInstanceOf auf ein anderes Armeebuch haelt — der Aufschlag feuert', () => {
    const report = evaluateWith(
      primaryCatalogueCondition('notInstanceOf', CATALOGUE_B_ID), GST_FORCE_ID, CATALOGUE_A_ID,
    );

    expect(violationsOf(report, MAX_ALPHA_ID)).toHaveLength(1);
    expect(unresolvedScopeOf(report, PRIMARY_CATALOGUE)).toEqual([]);
  });
});

describe('Kriterium 6, Rand: der Herkunftsindex schlaegt auch hier die Angabe des Rosters', () => {
  // Dieselbe Entscheidung wie fuer die Pflichten („Decisions" des Issues,
  // revidiert): Kontingent in Armeebuch B **deklariert**, Roster behauptet A —
  // es gilt B. Der Beleg ist ein Black-Box-Szenario, das genau diesen
  // Bezugsrahmen prueft: `docs/testing/primary-catalogue-scope`, Roster 10 —
  // „Das Armeebuch kommt aus der Herkunft der Force-DEFINITION, nicht aus dem
  // Roster-Attribut."
  it('instanceOf auf das vom Index gemeldete B haelt', () => {
    const report = evaluateWith(
      primaryCatalogueCondition('instanceOf', CATALOGUE_B_ID), B_OWN_FORCE_ID, CATALOGUE_A_ID,
    );

    expect(violationsOf(report, MAX_ALPHA_ID)).toHaveLength(1);
  });

  it('instanceOf auf das im Roster behauptete A haelt NICHT', () => {
    const report = evaluateWith(
      primaryCatalogueCondition('instanceOf', CATALOGUE_A_ID), B_OWN_FORCE_ID, CATALOGUE_A_ID,
    );

    expect(violationsOf(report, MAX_ALPHA_ID)).toHaveLength(0);
  });

  it('und der Rahmen bleibt in beiden Lagen aufgeloest — keine unresolvedScope-Diagnose', () => {
    const hit = evaluateWith(
      primaryCatalogueCondition('instanceOf', CATALOGUE_B_ID), B_OWN_FORCE_ID, CATALOGUE_A_ID,
    );

    expect(unresolvedScopeOf(hit, PRIMARY_CATALOGUE)).toEqual([]);
  });
});

describe('Kriterium 6, Rand: eine dem Datensatz unbekannte Armeebuch-Id zaehlt wie keine Angabe', () => {
  // Entscheidung des Issues: die Angabe faellt weg, es gilt der Herkunftsindex —
  // und schweigt auch der, bleibt es beim fail-closed `unresolvedScope`.
  const UNKNOWN_CATALOGUE_ID = 'cat-not-loaded-0140-primary';

  it('Kontingent aus der .gst: weiterhin fail-closed mit unresolvedScope', () => {
    const report = evaluateWith(
      primaryCatalogueCondition('instanceOf', CATALOGUE_A_ID), GST_FORCE_ID, UNKNOWN_CATALOGUE_ID,
    );

    expect(violationsOf(report, MAX_ALPHA_ID)).toHaveLength(0);
    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({ kind: 'unresolvedScope', scope: PRIMARY_CATALOGUE }),
    );
  });

  it('Kontingent aus einer .cat: es faellt auf den Herkunftsindex zurueck — B antwortet', () => {
    const report = evaluateWith(
      primaryCatalogueCondition('instanceOf', CATALOGUE_B_ID), B_OWN_FORCE_ID, UNKNOWN_CATALOGUE_ID,
    );

    expect(violationsOf(report, MAX_ALPHA_ID)).toHaveLength(1);
    expect(unresolvedScopeOf(report, PRIMARY_CATALOGUE)).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Kriterium 4 (Regressions-Wache) fuer denselben Bezugsrahmen
// ═════════════════════════════════════════════════════════════════════════════

describe('Kriterium 4: ohne Armeebuch-Id am Kontingent bleibt primary-catalogue unveraendert', () => {
  it('Kontingent aus der .gst ohne Armeebuch-Id: weiterhin fail-closed mit unresolvedScope', () => {
    // Regressions-Wache, heute gruen — sie haelt den PIN aus Issue 077 fest:
    // ohne Angabe des Rosters gibt es kein Armeebuch zu vergleichen.
    const report = evaluateWith(
      primaryCatalogueCondition('instanceOf', CATALOGUE_A_ID), GST_FORCE_ID, undefined,
    );

    expect(violationsOf(report, MAX_ALPHA_ID)).toHaveLength(0);
    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({ kind: 'unresolvedScope', scope: PRIMARY_CATALOGUE }),
    );
  });

  it('Kontingent aus einer .cat ohne Armeebuch-Id: der Herkunftsindex antwortet wie bisher', () => {
    // Regressions-Wache, heute gruen: das Kontingent steht in Armeebuch B, also
    // haelt `instanceOf B` und der Rahmen bleibt ohne Diagnose.
    const report = evaluateWith(
      primaryCatalogueCondition('instanceOf', CATALOGUE_B_ID), B_OWN_FORCE_ID, undefined,
    );

    expect(violationsOf(report, MAX_ALPHA_ID)).toHaveLength(1);
    expect(unresolvedScopeOf(report, PRIMARY_CATALOGUE)).toEqual([]);
  });
});
