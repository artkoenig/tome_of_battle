/**
 * **Fail-closed fuer jeden unaufloesbaren Bezugsrahmen** (Issue 77, AK 4).
 *
 * Ein Rahmen, den die Engine nicht auf einen Rahmenknoten aufloesen kann, liefert
 * **keine Zahl**, sondern den {@link UNRESOLVED_QUERY}-Sentinel. Frueher stand
 * dort `0` — und `notInstanceOf` (`actual === 0`) las das als „trifft zu", sodass
 * eine Regel *gerade dann* feuerte, wenn die Engine ihren Rahmen nicht verstand.
 * Das war keine konservative Auswertung, sondern eine stille Fehlauswertung.
 *
 * Der Fall ist nicht konstruiert: `scope="unit"` kommt im eingefrorenen
 * Definitive-Satz 127-mal an `<condition>` vor (Issue 83). Diese Scheibe behebt
 * Issue 83 **nicht** — sie sorgt dafuer, dass ein solcher Rahmen sichtbar
 * unwirksam bleibt, statt still falsch zu wirken.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate, prepareDataset } from './evaluator.js';
import { parseCatalogue } from './catalogReader.js';
import { resolveCatalogue } from './resolver.js';
import { buildEvalTree } from './evalTree.js';
import { buildIndex } from './countIndex.js';
import { createBaseEffectiveState } from './effectiveState.js';
import { query, createQueryContext } from './query.js';
import { SELECTION_COUNT, UNRESOLVED_QUERY, DiagnosticKind } from './model.js';

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit (wie in den uebrigen
// Evaluator-Tests). Der eigene XML-Leser der Engine nutzt genau dieses Primitiv.
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const CATALOGUE_ID = 'cat-unresolved-scope';
const UNIT_ID = 'entry-unit';
const UNIT_MAX_ID = 'limit-unit-max';

/** Ein Bezugsrahmen, der weder Schluesselwort noch Id einer Definition ist. */
const UNRESOLVABLE_SCOPE = 'unit';

const UNIT_MAX = 1;
const UNLIMITED_VALUE = -1;
const CHOSEN_UNITS = 2;

/**
 * Eine Obergrenze, die ein `notInstanceOf`-Modifikator ueber einen **unaufloesbaren**
 * Bezugsrahmen auf unbegrenzt heben wuerde. Greift der Modifikator, verschwindet die
 * Verletzung — genau daran ist ablesbar, ob die Bedingung faelschlich gehalten hat.
 */
const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="${CATALOGUE_ID}" name="Unresolved Scope Catalogue">
    <selectionEntries>
      <selectionEntry id="${UNIT_ID}" name="Unit" type="unit">
        <constraints>
          <constraint id="${UNIT_MAX_ID}" type="max" value="${UNIT_MAX}" field="selections" scope="roster" shared="true"/>
        </constraints>
        <modifiers>
          <modifier type="set" field="${UNIT_MAX_ID}" value="${UNLIMITED_VALUE}">
            <conditions>
              <condition type="notInstanceOf" field="selections" scope="${UNRESOLVABLE_SCOPE}" childId="${UNIT_ID}" value="1" shared="true"/>
            </conditions>
          </modifier>
        </modifiers>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

const ROSTER = { forces: [{ defId: UNIT_ID, catalogueId: CATALOGUE_ID, count: CHOSEN_UNITS, children: [] }] };

describe('unaufloesbarer Bezugsrahmen: der Sentinel statt einer erfundenen Null', () => {
  it('liefert den Sentinel und meldet den Rahmen als unaufloesbar', () => {
    const catalogue = parseCatalogue(CATALOGUE_XML);
    const resolved = resolveCatalogue(catalogue);
    const { root } = buildEvalTree(resolved, ROSTER);
    const index = buildIndex(root, createBaseEffectiveState(root));
    const diagnostics = [];
    const ctx = createQueryContext({
      node: root.children[0], root, index, categoryIds: resolved.categoryIds, diagnostics,
    });

    const result = query(ctx, SELECTION_COUNT, UNRESOLVABLE_SCOPE, UNIT_ID, { shared: true });

    expect(result).toBe(UNRESOLVED_QUERY);
    expect(diagnostics).toContainEqual(
      expect.objectContaining({ kind: DiagnosticKind.UNRESOLVED_SCOPE, scope: UNRESOLVABLE_SCOPE, targetId: UNIT_ID }),
    );
  });

  it('laesst eine notInstanceOf-Bedingung darueber **nicht** halten — der Modifikator greift nicht', () => {
    const report = evaluate(prepareDataset({ catalogues: [CATALOGUE_XML] }), ROSTER);

    // Haette die Bedingung gehalten, waere die Grenze auf unbegrenzt gesetzt und
    // saeße hier keine Verletzung — der stille Fail-open vor Issue 77.
    expect(report.violations.filter(violation => violation.limitId === UNIT_MAX_ID)).toHaveLength(1);
    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({ kind: DiagnosticKind.UNRESOLVED_SCOPE, scope: UNRESOLVABLE_SCOPE }),
    );
  });
});
