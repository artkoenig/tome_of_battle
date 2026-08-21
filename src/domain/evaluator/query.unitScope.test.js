/**
 * Issue 0086, Kriterium 1 und 4: der Bezugsrahmen `unit`.
 *
 * Die Regel in einem Satz (Issue 0086, Decisions „Semantik `unit`"): der
 * Zaehlrahmen einer Query mit `scope="unit"` ist der **naechste Vorfahre — den
 * Knoten selbst eingeschlossen — mit rohem `type="unit"`**; bei einem
 * `entryLink` zaehlt der rohe Typ seines transitiv aufgeloesten Ziels. Ohne
 * solchen Vorfahren bleibt es fail-closed: `unresolvedScope` + Zaehlwert 0.
 *
 * Beobachtet wird an zwei Naehten:
 * - dem Query-Primitiv direkt (wie `query.matrix.test.js`) fuer die
 *   Rahmen-Aufloesung selbst, und
 * - der Fassade (`evaluate`/`prepareDataset`, wie
 *   `query.primaryCatalogueScope.test.js`) fuer das belegte Mercenaries-Idiom
 *   „Kostenaufschlag je Modell" (`<repeat field="selections" scope="unit"
 *   childId="model"/>`, Issue 0086, Intent).
 *
 * Alle Erwartungen sind aus Intent und Decisions des Issues abgeleitet, nicht
 * aus dem heutigen Verhalten von `query.js`. Kriterium 4 (unbekanntes
 * Schluesselwort bleibt diagnostiziert) pinnt Bestand und darf schon gruen sein.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate as evaluateDataset, prepareDataset } from './evaluator.js';
import { parseCatalogue } from './catalogReader.js';
import { resolveCatalogue } from './resolver.js';
import { buildEvalTree } from './evalTree.js';
import { buildIndex } from './countIndex.js';
import { createBaseEffectiveState } from './effectiveState.js';
import { query, createQueryContext } from './query.js';
import { SELECTION_COUNT } from './model.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

/** Das Schluesselwort, wie es in den Katalogdaten steht (130 Fixture-Vorkommen). */
const UNIT_SCOPE = 'unit';
/** Das Typ-Schluesselwort-Ziel der Mercenaries-Form (`childId="model"`). */
const MODEL_KEYWORD = 'model';

// Alle 130 Fixture-Vorkommen tragen `shared="true"` (Issue 0086, Decisions);
// die Mercenaries-Repeat-Form laesst die include-Flags auf ihren Vorgaben.
const FIXTURE_FLAGS = { shared: true, includeChildSelections: false, includeChildForces: false };

// ─────────────────────────────────────────────────────────────────────────────
// Teil A — das Query-Primitiv: die Rahmen-Aufloesung selbst.
//
// Instanzbaum (Anzahl in Klammern):
//
//   root
//   ├─ regiment A (1)            [type="unit"]
//   │  ├─ trooper (5)            [type="model"]
//   │  └─ option (1)             ← Bezugsinstanz der meisten Faelle
//   ├─ regiment B (1)            [type="unit"]   ← Geschwister-Einheit
//   │  └─ trooper (3)
//   ├─ legion-link (1)           [entryLink → regiment, Ziel-Typ "unit"]
//   │  ├─ trooper (4)
//   │  └─ option (1)
//   └─ option (1)                ← ohne umschliessende Einheit
// ─────────────────────────────────────────────────────────────────────────────

const REGIMENT = 'entry-regiment';
const TROOPER = 'entry-trooper';
const OPTION = 'entry-option';
const LEGION_LINK = 'link-legion';

const PRIMITIVE_CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
<catalogue id="cat-unit-scope" name="Unit Scope Catalogue">
  <selectionEntries>
    <selectionEntry id="${REGIMENT}" name="Regiment" type="unit">
      <selectionEntries>
        <selectionEntry id="${TROOPER}" name="Trooper" type="model"/>
        <selectionEntry id="${OPTION}" name="Option" type="upgrade"/>
      </selectionEntries>
    </selectionEntry>
  </selectionEntries>
  <entryLinks>
    <entryLink id="${LEGION_LINK}" name="Legion" type="selectionEntry" targetId="${REGIMENT}"/>
  </entryLinks>
</catalogue>`;

const PRIMITIVE_ROSTER = {
  forces: [
    {
      defId: REGIMENT, count: 1, children: [
        { defId: TROOPER, count: 5, children: [] },
        { defId: OPTION, count: 1, children: [] },
      ],
    },
    {
      defId: REGIMENT, count: 1, children: [
        { defId: TROOPER, count: 3, children: [] },
      ],
    },
    {
      defId: LEGION_LINK, count: 1, children: [
        { defId: TROOPER, count: 4, children: [] },
        { defId: OPTION, count: 1, children: [] },
      ],
    },
    { defId: OPTION, count: 1, children: [] },
  ],
};

/** Baut die Auswertungs-Stufen bis zum Index und liefert Wurzel + Kontextfabrik. */
function primitiveSetup() {
  const resolved = resolveCatalogue(parseCatalogue(PRIMITIVE_CATALOGUE_XML));
  const { root } = buildEvalTree(resolved, PRIMITIVE_ROSTER);
  const index = buildIndex(root, createBaseEffectiveState(root));
  const diagnostics = [];
  const ctxAt = node =>
    createQueryContext({ node, root, index, categoryIds: resolved.categoryIds, diagnostics });
  return { root, ctxAt, diagnostics };
}

describe('scope="unit" am Query-Primitiv: der Zaehlrahmen ist die umschliessende Einheit', () => {
  it('eine Option in Einheit A zaehlt die Modelle GENAU dieser Einheit (5) — nicht die der Geschwister-Einheit (3), nicht armeeweit (12), nicht 0', () => {
    const { root, ctxAt } = primitiveSetup();
    const optionInRegimentA = root.children[0].children[1];

    const result = query(ctxAt(optionInRegimentA), SELECTION_COUNT, UNIT_SCOPE, MODEL_KEYWORD, FIXTURE_FLAGS);

    expect(result).toBe(5);
  });

  it('Selbst-Einschluss: traegt die EINHEIT selbst die Query, ist sie ihr eigener Rahmen (5 Modelle)', () => {
    // Decisions: „naechster Vorfahre — den Knoten selbst eingeschlossen — mit
    // rohem type=unit".
    const { root, ctxAt } = primitiveSetup();
    const regimentA = root.children[0];

    const result = query(ctxAt(regimentA), SELECTION_COUNT, UNIT_SCOPE, MODEL_KEYWORD, FIXTURE_FLAGS);

    expect(result).toBe(5);
  });

  it('steht die Einheit per entryLink im Baum, zaehlt der rohe Typ des transitiv aufgeloesten Ziels (4 Modelle)', () => {
    const { root, ctxAt } = primitiveSetup();
    const optionInLinkedLegion = root.children[2].children[1];

    const result = query(ctxAt(optionInLinkedLegion), SELECTION_COUNT, UNIT_SCOPE, MODEL_KEYWORD, FIXTURE_FLAGS);

    expect(result).toBe(4);
  });

  it('ohne umschliessende Einheit bleibt es fail-closed: 0 und unresolvedScope', () => {
    const { root, ctxAt, diagnostics } = primitiveSetup();
    const freeStandingOption = root.children[3];

    const result = query(ctxAt(freeStandingOption), SELECTION_COUNT, UNIT_SCOPE, MODEL_KEYWORD, FIXTURE_FLAGS);

    expect(result).toBe(0);
    expect(diagnostics).toContainEqual(
      expect.objectContaining({ kind: 'unresolvedScope', scope: UNIT_SCOPE }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Teil B — die Fassade: das Mercenaries-Idiom „Kostenaufschlag je Modell".
//
// Nachgebaut nach dem realen Muster (Mercenaries-`.cat`, Manbiters → Shield):
// ein `repeat` mit `scope="unit" childId="model"` an einer Option laesst deren
// Kosten-Modifikator je Modell der umschliessenden Einheit einmal feuern.
// Beobachtet wie in `query.primaryCatalogueScope.test.js`: die Kostengrenze
// liegt exakt auf dem Basiswert, nur der feuernde Aufschlag verletzt sie.
// ─────────────────────────────────────────────────────────────────────────────

const POINTS_ID = 'cost-points';
const SHIELD_ID = 'entry-shield';
const WARBAND_ID = 'entry-warband';
const GRUNT_ID = 'entry-grunt';
const MAX_SHIELD_POINTS_ID = 'max-shield-points';
const SHIELD_BASE_POINTS = 10;
const PER_MODEL_SURCHARGE = 1;
const MODELS_IN_OWN_UNIT = 5;
const MODELS_IN_SIBLING_UNIT = 3;
/** Erwartete Schild-Kosten: Basis + 1 je Modell der EIGENEN Einheit. */
const EXPECTED_SHIELD_POINTS = SHIELD_BASE_POINTS + MODELS_IN_OWN_UNIT * PER_MODEL_SURCHARGE;

// Die Geschwister-Einheit ist bewusst eine ANDERE Definition ohne Schild-Angebot,
// damit ausschliesslich die eine Schild-Instanz die Grenze traegt.
const REPEAT_CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
<catalogue id="cat-unit-repeat" name="Unit Repeat Catalogue">
  <selectionEntries>
    <selectionEntry id="${REGIMENT}" name="Regiment" type="unit">
      <selectionEntries>
        <selectionEntry id="${TROOPER}" name="Trooper" type="model"/>
        <selectionEntry id="${SHIELD_ID}" name="Shield" type="upgrade">
          <costs><cost name="Points" typeId="${POINTS_ID}" value="${SHIELD_BASE_POINTS}"/></costs>
          <constraints>
            <constraint id="${MAX_SHIELD_POINTS_ID}" type="max" value="${SHIELD_BASE_POINTS}" field="${POINTS_ID}" scope="roster"/>
          </constraints>
          <modifiers>
            <modifier type="increment" field="${POINTS_ID}" value="${PER_MODEL_SURCHARGE}">
              <repeats>
                <repeat value="1" repeats="1" field="selections" scope="unit" childId="model" shared="true" roundUp="false"/>
              </repeats>
            </modifier>
          </modifiers>
        </selectionEntry>
      </selectionEntries>
    </selectionEntry>
    <selectionEntry id="${WARBAND_ID}" name="Warband" type="unit">
      <selectionEntries>
        <selectionEntry id="${GRUNT_ID}" name="Grunt" type="model"/>
      </selectionEntries>
    </selectionEntry>
  </selectionEntries>
</catalogue>`;

/** Regiment (5 Modelle + Schild) neben einer Warband (3 Modelle). */
const REPEAT_ROSTER = {
  forces: [
    {
      defId: REGIMENT, count: 1, children: [
        { defId: TROOPER, count: MODELS_IN_OWN_UNIT, children: [] },
        { defId: SHIELD_ID, count: 1, children: [] },
      ],
    },
    {
      defId: WARBAND_ID, count: 1, children: [
        { defId: GRUNT_ID, count: MODELS_IN_SIBLING_UNIT, children: [] },
      ],
    },
  ],
};

/** Regiment ohne eigene Modelle — die 3 der Warband duerfen nicht einsickern. */
const REPEAT_ROSTER_NO_OWN_MODELS = {
  forces: [
    { defId: REGIMENT, count: 1, children: [{ defId: SHIELD_ID, count: 1, children: [] }] },
    {
      defId: WARBAND_ID, count: 1, children: [
        { defId: GRUNT_ID, count: MODELS_IN_SIBLING_UNIT, children: [] },
      ],
    },
  ],
};

/** Die Verletzungen des Berichts zu einer Grenz-Id. */
function violationsOf(report, limitId) {
  return report.violations.filter(message => message.limitId === limitId);
}

/** Die `unresolvedScope`-Diagnosen des Berichts zu einem Bezugsrahmen. */
function unresolvedScopeOf(report, scope) {
  return (report.diagnostics ?? []).filter(
    diagnostic => diagnostic.kind === 'unresolvedScope' && diagnostic.scope === scope,
  );
}

/** Wertet den Repeat-Katalog gegen das gegebene Roster aus. */
function evaluateRepeat(roster) {
  return evaluateDataset(prepareDataset({ catalogues: [REPEAT_CATALOGUE_XML] }), roster);
}

describe('Kriterium 1 an der Fassade: der Pro-Modell-Aufschlag rechnet mit den Modellen der eigenen Einheit', () => {
  it('5 eigene Modelle: der Schild kostet Basis + 5 — nicht Basis (0 Treffer), nicht Basis + 8 (armeeweit), nicht Basis + 3 (Geschwister)', () => {
    const report = evaluateRepeat(REPEAT_ROSTER);

    const violations = violationsOf(report, MAX_SHIELD_POINTS_ID);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ actual: EXPECTED_SHIELD_POINTS, bound: SHIELD_BASE_POINTS });
  });

  it('und der Bericht traegt dabei keine unresolvedScope-Diagnose fuer scope="unit" mehr', () => {
    const report = evaluateRepeat(REPEAT_ROSTER);

    expect(unresolvedScopeOf(report, UNIT_SCOPE)).toEqual([]);
  });

  it('ohne eigene Modelle bleibt der Aufschlag aus — die Modelle der Geschwister-Einheit zaehlen nicht', () => {
    const report = evaluateRepeat(REPEAT_ROSTER_NO_OWN_MODELS);

    expect(violationsOf(report, MAX_SHIELD_POINTS_ID)).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Kriterium 4 — Regressionsschutz: ein frei erfundenes Schluesselwort (keine
// Id, kein bekanntes Keyword) bleibt fail-closed diagnostiziert. Dieser Fall
// pinnt Bestand und darf schon gruen sein.
// ─────────────────────────────────────────────────────────────────────────────

describe('Kriterium 4: ein weiterhin unbekanntes Scope-Schluesselwort bleibt diagnostiziert', () => {
  const INVENTED_SCOPE = 'flock-of-seagulls';

  it('liefert 0 und eine unresolvedScope-Diagnose — kein stilles Raten', () => {
    const { root, ctxAt, diagnostics } = primitiveSetup();
    const optionInRegimentA = root.children[0].children[1];

    const result = query(ctxAt(optionInRegimentA), SELECTION_COUNT, INVENTED_SCOPE, MODEL_KEYWORD, FIXTURE_FLAGS);

    expect(result).toBe(0);
    expect(diagnostics).toContainEqual(
      expect.objectContaining({ kind: 'unresolvedScope', scope: INVENTED_SCOPE }),
    );
  });
});
