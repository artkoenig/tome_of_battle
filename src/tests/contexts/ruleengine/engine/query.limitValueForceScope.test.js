/**
 * Fassaden-Regressionswache fuer den ganzen Pfad einer `limit::<id>`-Bedingung
 * mit `scope="force"` (Issue 0147): Katalog-Leser -> Bedingung -> `set`-Modifier
 * -> Constraint -> Bericht. Das Muster ist en miniature das reale
 * `Border Patrol (500pts)`-Beispiel des Szenarios
 * `docs/testing/equal-to-force-points-limit-border-patrol` — dieses File
 * dupliziert absichtlich einen Teil davon: das Szenario ist Black-Box-Autorenschaft
 * und kann sich mit der Kampagne verschieben, die Engine braucht ihre eigene
 * fixturfreie Sicherung fuer den ganzen Pfad.
 *
 * `.ros` deklariert sein Budget nur an der Roster-Wurzel: ein Scope `force`
 * loest deshalb auf denselben Wert wie `roster` auf, sofern der Force-Rahmen
 * aufloesbar ist. Fehlt das Budget ganz (kein `costLimits`), bleibt die Regel
 * fail-closed — still `effectiveMin 0` UND eine `UNRESOLVED_BUDGET_LIMIT`-Diagnose,
 * nie eine unbemerkt falsche 0.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate as evaluateDataset, prepareDataset } from '../../../../contexts/ruleengine/evaluator.js';
import { DiagnosticKind } from '../../../../contexts/ruleengine/engine/model.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const PTS = 'pts-id';
const FORCE = 'force-standard';
const ENTRY = 'entry-border-patrol';
const MIN_ID = 'min-border-patrol';

const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
<catalogue id="cat-force-scope-limit" name="Force Scope Limit Catalogue">
  <forceEntries>
    <forceEntry id="${FORCE}" name="Standard"/>
  </forceEntries>
  <selectionEntries>
    <selectionEntry id="${ENTRY}" name="Border Patrol (500pts)" type="upgrade" hidden="false">
      <constraints>
        <constraint id="${MIN_ID}" type="min" value="0" field="selections" scope="parent"/>
      </constraints>
      <modifiers>
        <modifier type="set" value="1" field="${MIN_ID}">
          <conditions>
            <condition type="equalTo" value="500" field="limit::${PTS}" scope="force" childId="any"
              shared="true" includeChildSelections="true" includeChildForces="true"/>
          </conditions>
        </modifier>
      </modifiers>
    </selectionEntry>
  </selectionEntries>
</catalogue>`;

/** Ein Roster mit dem Kontingent, dem belegten Eintrag und (optional) einem Budget. */
function rosterAt(budget) {
  const roster = {
    forces: [{ defId: FORCE, count: 1, children: [{ defId: ENTRY, count: 1, children: [] }] }],
  };
  if (budget !== undefined) roster.costLimits = [{ costTypeId: PTS, value: budget }];
  return roster;
}

function evaluate(budget) {
  return evaluateDataset(prepareDataset({ catalogues: [CATALOGUE_XML] }), rosterAt(budget));
}

/** Der belegte Slot des Eintrags (der einzige Anker vom `anchorKind` `occupied`). */
function occupiedSlotOf(report) {
  return [...report.capabilities.values()].find(
    capability => capability.defId === ENTRY && capability.anchorKind === 'occupied',
  );
}

/** Die `UNRESOLVED_BUDGET_LIMIT`-Diagnosen des Berichts. */
function unresolvedBudgetLimitDiagnosticsOf(report) {
  return (report.diagnostics ?? []).filter(
    diagnostic => diagnostic.kind === DiagnosticKind.UNRESOLVED_BUDGET_LIMIT,
  );
}

describe('limit::<id> mit scope="force": das Border-Patrol-Muster en miniature (Issue 0147)', () => {
  it('bei Budget genau 500 hebt der Modifier die eigene Mindestgrenze auf 1, ohne Diagnose', () => {
    const report = evaluate(500);

    expect(occupiedSlotOf(report)).toMatchObject({ effectiveMin: 1 });
    expect(unresolvedBudgetLimitDiagnosticsOf(report)).toEqual([]);
  });

  it('bei Budget 499 bleibt die Grenze bei der Basis 0, weiterhin ohne Diagnose', () => {
    // `equalTo` ist kein `atMost`: das knapp verfehlte Budget loest den `set`
    // nicht aus, aber die Bedingung IST aufgeloest — keine Diagnose.
    const report = evaluate(499);

    expect(occupiedSlotOf(report)).toMatchObject({ effectiveMin: 0 });
    expect(unresolvedBudgetLimitDiagnosticsOf(report)).toEqual([]);
  });

  it('ohne costLimits im Roster bleibt die Grenze bei 0 UND meldet UNRESOLVED_BUDGET_LIMIT', () => {
    // Ein Budget, das wirklich nicht aufloesbar ist (hier: gar nicht deklariert),
    // muss fail-closed bleiben statt still 0 zu beantworten.
    const report = evaluate(undefined);

    expect(occupiedSlotOf(report)).toMatchObject({ effectiveMin: 0 });
    expect(unresolvedBudgetLimitDiagnosticsOf(report)).not.toEqual([]);
  });
});
