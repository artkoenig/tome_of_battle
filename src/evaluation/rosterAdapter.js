/**
 * Roster-Adapter (Issue 0121): uebersetzt das App-Roster (IndexedDB-Modell,
 * `src/types.js`) in den Eingabevertrag der Evaluator-Fassade
 * (`src/evaluator/evaluator.js`, `@param roster`) und liefert daneben die
 * Zuordnung App-Selection-UUID → Slot-Pfad des Berichts.
 *
 * Abbildungsregeln:
 *
 * - Force → `{ defId: forceEntryId, count: 1, children }`.
 * - Selection → `{ defId: entryLinkId || selectionEntryId, count: number,
 *   children }`. Das ist die **Link-Id-Regel** (Issue 084, dokumentiert am
 *   Fassaden-Rand): eine ueber einen `entryLink` gesetzte Auswahl geht unter
 *   der Id des **Verweises**, nie unter der Ziel-Id — ohne Rueckfall. Nur so
 *   gelten die am Verweis deklarierten Grenzen.
 * - `costLimits = [{ costTypeId: roster.costLimitType, value: roster.costLimit }]`;
 *   `-1` (= unbegrenzt) wird unveraendert durchgereicht (Sentinel-Regel,
 *   `docs/battlescribe-data-format.md` §7.6). Ohne `costLimitType` entsteht
 *   keine Zeile — die Fassade behandelt ein leeres `costLimits` als leeres
 *   Budget.
 *
 * `pathBySelectionId` entsteht im selben Durchlauf nach dem Pfad-Schema des
 * Berichts (`@returns` der Fassade, `pathOf` in `src/evaluator/evalTree.js`):
 * der Pfad eines belegten Slots ist die `/`-verkettete Folge der
 * Eingabe-Indizes — `forces[i]` → `"i"`, dessen j-te Selektion → `"i/j"`, usw.
 * Die Indizes bleiben stabil, weil die Engine alle synthetischen Anker nur
 * **hinter** die bestehenden Kinder haengt. Die Zuordnung gilt unter derselben
 * Bedingung wie am Fassaden-Rand dokumentiert: jede `defId` loest auf (keine
 * `unresolvedDefinition`-Diagnose im Bericht).
 *
 * Der Adapter ist rein: das App-Roster wird gelesen, nie mutiert.
 */

/**
 * Ein Knoten des Evaluator-Instanzbaums (Vertrag der Fassade, `@param roster`
 * an `evaluate`).
 *
 * @typedef {Object} EvalInstanceNode
 * @property {string} defId
 * @property {number} count
 * @property {EvalInstanceNode[]} children
 */

/**
 * Das Evaluator-Roster: Instanzbaum plus eingestellte Kostengrenzen.
 *
 * @typedef {Object} EvalRoster
 * @property {EvalInstanceNode[]} forces
 * @property {Array<{ costTypeId: string, value: number }>} [costLimits]
 */

/**
 * Uebersetzt die Selektionen einer Ebene rekursiv in Evaluator-Knoten und
 * traegt dabei je App-Selection-UUID den Slot-Pfad ein.
 *
 * @param {import('../types.js').Selection[]} selections
 * @param {string} parentPath  Slot-Pfad des Elternknotens (Force oder Selection).
 * @param {Map<string, string>} pathBySelectionId
 * @returns {EvalInstanceNode[]}
 */
function toChildren(selections, parentPath, pathBySelectionId) {
  return (selections ?? []).map((selection, index) => {
    const path = `${parentPath}/${index}`;
    pathBySelectionId.set(selection.id, path);
    return {
      // Link-Id-Regel (Issue 084): der Verweis identifiziert die Auswahl,
      // nicht sein Ziel — kein Rueckfall.
      defId: selection.entryLinkId ?? selection.selectionEntryId,
      count: selection.number,
      children: toChildren(selection.selections, path, pathBySelectionId),
    };
  });
}

/**
 * Uebersetzt ein App-Roster in den Eingabevertrag der Evaluator-Fassade.
 *
 * @param {import('../types.js').Roster} roster  das App-Roster; wird nicht mutiert.
 * @returns {{ evalRoster: EvalRoster, pathBySelectionId: Map<string, string> }}
 *   `evalRoster` fuer `evaluate(prepared, evalRoster)`; `pathBySelectionId`
 *   ordnet jeder App-Selection-UUID den Slot-Pfad zu, unter dem der Bericht
 *   (`report.capabilities`) den belegten Slot fuehrt.
 */
export function toEvaluatorRoster(roster) {
  /** @type {Map<string, string>} */
  const pathBySelectionId = new Map();

  const forces = (roster.forces ?? []).map((force, index) => ({
    defId: force.forceEntryId,
    count: 1,
    children: toChildren(force.selections, String(index), pathBySelectionId),
  }));

  /** @type {EvalRoster} */
  const evalRoster = { forces };

  // Ohne eingestellte Kostenart gibt es keine Grenze zu uebersetzen; `-1`
  // (= unbegrenzt) ist dagegen ein Wert und geht unveraendert durch.
  if (roster.costLimitType !== null && roster.costLimitType !== undefined) {
    evalRoster.costLimits = [{ costTypeId: roster.costLimitType, value: roster.costLimit }];
  }

  return { evalRoster, pathBySelectionId };
}
