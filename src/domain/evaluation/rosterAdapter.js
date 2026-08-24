/**
 * Roster-Adapter (Issue 0121): uebersetzt das App-Roster (IndexedDB-Modell,
 * `src/domain/types.js`) in den Eingabevertrag der Evaluator-Fassade
 * (`src/domain/evaluator/evaluator.js`, `@param roster`) und liefert daneben die
 * Zuordnung App-Selection-UUID → Slot-Pfad des Berichts.
 *
 * Abbildungsregeln:
 *
 * - Force → `{ defId: forceEntryId, count: 1, children }`, dazu `catalogueId`,
 *   wenn das App-Kontingent sein Armeebuch nennt (`Force.catalogueId`, Issue
 *   0140). Die Fassade nimmt die Angabe je Kontingent-Knoten entgegen und
 *   filtert damit Pflichten und Wurzel-Angebote fremder Armeebuecher weg, wo
 *   die Katalogdaten selbst keine Herkunft hergeben. Gelesen wird **nur**
 *   `force.catalogueId`, ohne Rueckfall auf `roster.catalogueId`: das ist das
 *   Buch der **Liste**, und einem verbuendeten Kontingent ohne eigene Angabe
 *   schluege es das falsche Buch zu — aktiv falsch gefiltert waere schlechter
 *   als ungefiltert. Ein Kontingent **ohne** Armeebuch-Id geht wie bisher ohne
 *   die Angabe durch; dann entscheidet allein der Herkunftsindex aus den
 *   Katalogdaten.
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
 * `pathBySelectionId` und `pathByForceId` entstehen nach dem Pfad-Schema des
 * Berichts (`@returns` der Fassade, `pathOf` in `src/domain/evaluator/evalTree.js`):
 * der Pfad eines belegten Slots ist die `/`-verkettete Folge der
 * Eingabe-Indizes — `forces[i]` → `"i"`, dessen j-te Selektion → `"i/j"`, usw.
 * Die Indizes bleiben stabil, weil die Engine alle synthetischen Anker nur
 * **hinter** die bestehenden Kinder haengt. Die Zuordnungen, die
 * {@link toEvaluatorRoster} liefert, gelten unter derselben Bedingung wie am
 * Fassaden-Rand dokumentiert: jede `defId` loest auf (keine
 * `unresolvedDefinition`-Diagnose im Bericht).
 *
 * Weil der Adapter Aufloesbarkeit nicht kennen kann — dazu braucht es den
 * Datensatz —, sind die Zuordnungen als eigene reine Funktion herausgezogen:
 * {@link slotPathsOf} baut sie mit einer Menge zu ueberspringender `defId`s.
 * Wer Roster **und** Bericht hat (`evaluateAppRoster`, die eine
 * App-Auswertung), baut sie damit neu, sobald der Bericht unaufloesbare
 * Definitionen meldet. Der **Eingabebaum bleibt davon unberuehrt**: die
 * unaufloesbaren Knoten gehen weiter an die Engine, sonst gaebe es die
 * Diagnose gar nicht.
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
 * @property {string} [catalogueId]  nur am Kontingent-Knoten: dessen Armeebuch.
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
 * Die Definitions-Id, unter der eine App-Selection uebergeben wird —
 * Link-Id-Regel (Issue 084): der Verweis identifiziert die Auswahl, nicht sein
 * Ziel; kein Rueckfall.
 *
 * @param {import('../../domain/types.js').Selection} selection
 * @returns {string}
 */
const defIdOf = (selection) => selection.entryLinkId ?? selection.selectionEntryId;

/** Die leere Ueberspringmenge: alles loest auf (der Normalfall). */
const NOTHING_SKIPPED = new Set();

/**
 * Uebersetzt die Selektionen einer Ebene rekursiv in Evaluator-Knoten.
 *
 * @param {import('../../domain/types.js').Selection[]} selections
 * @returns {EvalInstanceNode[]}
 */
function toChildren(selections) {
  return (selections ?? []).map((selection) => ({
    defId: defIdOf(selection),
    count: selection.number,
    children: toChildren(selection.selections),
  }));
}

/**
 * Traegt je App-Selection-UUID einer Ebene den Slot-Pfad ein und steigt ab.
 * Eine Selektion, deren `defId` in `skippedDefIds` steht, bekommt **keinen**
 * Index und keinen Eintrag — sie und ihr **ganzer Teilbaum** entfallen, genau
 * wie in der Engine (`attachInstance` haengt einen unaufloesbaren Knoten samt
 * Teilbaum nicht in den Auswertungsbaum).
 *
 * @param {import('../../domain/types.js').Selection[]} selections
 * @param {string} parentPath  Slot-Pfad des Elternknotens (Force oder Selection).
 * @param {ReadonlySet<string>} skippedDefIds
 * @param {Map<string, string>} into
 */
function collectSelectionPaths(selections, parentPath, skippedDefIds, into) {
  let index = 0;
  for (const selection of selections ?? []) {
    if (skippedDefIds.has(defIdOf(selection))) continue;
    const path = `${parentPath}/${index}`;
    index += 1;
    into.set(selection.id, path);
    collectSelectionPaths(selection.selections, path, skippedDefIds, into);
  }
}

/**
 * Die Zuordnungen App-Selection-UUID → Slot-Pfad und Force-UUID → Slot-Pfad des
 * Berichts, gebaut **ohne** die Definitionen, die der Datensatz nicht kennt.
 *
 * Reine Funktion ueber dem App-Roster: sie zaehlt dieselben Kind-Indizes durch
 * wie die Engine beim Aufbau des Auswertungsbaums — und laesst dabei genau die
 * Knoten aus, die auch die Engine auslaesst. Ohne diese Auslassung ruecken alle
 * Geschwister **hinter** einer unaufloesbaren Auswahl um eine Position vor, und
 * jede von ihnen zeigte auf den Faehigkeitsdatensatz ihres Nachbarn (Befund B2).
 * Fuer Kontingente gilt dasselbe eine Stockwerk hoeher: ein Kontingent, dessen
 * `forceEntryId` nicht aufloest, **fehlt** in `pathByForceId`, und jedes
 * folgende rueckt einen Index auf.
 *
 * Die Menge ist genau richtig, nicht bloss eine Naeherung: die Diagnose
 * `unresolvedDefinition` entsteht ausschliesslich fuer Roster-Instanzknoten, und
 * eine `defId` loest datensatzweit auf oder eben nicht — die Menge der
 * gemeldeten `defId`s ist damit die Menge der weggefallenen Definitionen.
 *
 * @param {import('../../domain/types.js').Roster|null|undefined} roster  das App-Roster; wird nicht mutiert.
 * @param {ReadonlySet<string>} [skippedDefIds]  die Definitions-Ids, die der
 *   Datensatz nicht kennt (leer = alles loest auf).
 * @returns {{ pathBySelectionId: Map<string, string>, pathByForceId: Map<string, string> }}
 */
export function slotPathsOf(roster, skippedDefIds = NOTHING_SKIPPED) {
  /** @type {Map<string, string>} */
  const pathBySelectionId = new Map();
  /** @type {Map<string, string>} */
  const pathByForceId = new Map();
  let index = 0;
  for (const force of roster?.forces ?? []) {
    // Ein unaufloesbares Kontingent nimmt sich und seinen Auswahlen den Pfad —
    // dieselbe Regel wie fuer eine Auswahl, denn die Engine haengt auch ein
    // Kontingent nur ueber `attachInstance` an.
    if (skippedDefIds.has(force.forceEntryId)) continue;
    const path = String(index);
    index += 1;
    if (force.id !== null && force.id !== undefined) pathByForceId.set(force.id, path);
    collectSelectionPaths(force.selections, path, skippedDefIds, pathBySelectionId);
  }
  return { pathBySelectionId, pathByForceId };
}

/**
 * Uebersetzt ein App-Roster in den Eingabevertrag der Evaluator-Fassade.
 *
 * @param {import('../../domain/types.js').Roster} roster  das App-Roster; wird nicht mutiert.
 * @returns {{ evalRoster: EvalRoster, pathBySelectionId: Map<string, string>, pathByForceId: Map<string, string> }}
 *   `evalRoster` fuer `evaluate(prepared, evalRoster)`; `pathBySelectionId`
 *   ordnet jeder App-Selection-UUID den Slot-Pfad zu, unter dem der Bericht
 *   (`report.capabilities`) den belegten Slot fuehrt; `pathByForceId` tut
 *   dasselbe fuer die Kontingente.
 */
export function toEvaluatorRoster(roster) {
  // Die naive Zuordnung: leere Ueberspringmenge. Sie gilt genau dann, wenn jede
  // `defId` aufloest — und wird bei einer `unresolvedDefinition`-Diagnose vom
  // Aufrufer neu gebaut (`evaluateAppRoster`, {@link slotPathsOf}).
  const { pathBySelectionId, pathByForceId } = slotPathsOf(roster, NOTHING_SKIPPED);

  const forces = (roster.forces ?? []).map((force) => {
    /** @type {EvalInstanceNode} */
    const node = {
      defId: force.forceEntryId,
      count: 1,
      children: toChildren(force.selections),
    };
    // Das Armeebuch des Kontingents geht nur mit, wenn das App-Kontingent eines
    // nennt: ein fehlendes, ein `null`- und ein **leeres** Feld sind derselbe
    // Fall — „keine Angabe" —, und der Vertrag der Fassade laesst das Feld dann
    // ganz weg. Der leere String ist kein Randfall aus der Theorie: der
    // `.ros`-Export schreibt `catalogueId=""` fuer ein Kontingent ohne Buch
    // (`rosterSerialization.js`), ein Export/Import-Umlauf liefert ihn also.
    if (force.catalogueId) node.catalogueId = force.catalogueId;
    return node;
  });

  /** @type {EvalRoster} */
  const evalRoster = { forces };

  // Ohne eingestellte Kostenart gibt es keine Grenze zu uebersetzen; `-1`
  // (= unbegrenzt) ist dagegen ein Wert und geht unveraendert durch.
  if (roster.costLimitType !== null && roster.costLimitType !== undefined) {
    evalRoster.costLimits = [{ costTypeId: roster.costLimitType, value: roster.costLimit }];
  }

  return { evalRoster, pathBySelectionId, pathByForceId };
}
