import '../types.js';

/**
 * Traversierungs-Primitive des Roster-Baums.
 *
 * Der Roster-Baum (`roster.forces[].selections[].selections[]…`) ist die zentrale
 * Datenstruktur der Anwendung. Dieses Modul hält die Rekursion über ihn an genau
 * einer Stelle, sodass eine Formänderung — etwa eine zusätzliche
 * Verschachtelungsebene — nicht in jedem Aufrufer nachgezogen werden muss.
 *
 * Alle Primitiven sind rein und frei von React: Sie lesen den Baum, mutieren ihn
 * nie und geben bei abbildenden Operationen neue Knoten zurück.
 */

/**
 * Die einzige Stelle, an der der Fall „keine Kind-Selections" behandelt wird.
 * Geteilte, eingefrorene Instanz, damit ein fehlendes `selections`-Feld über
 * Aufrufe hinweg identitätsgleich bleibt und Identitätsvergleiche tragen.
 */
const NO_SELECTIONS = Object.freeze([]);

/** Effektive Anzahl einer Selection, wenn sie kein `number` trägt. */
const IMPLICIT_SELECTION_COUNT = 1;

/** Prädikat, das jede Selection akzeptiert (Vorgabe für {@link countSelections}). */
const MATCHES_EVERY_SELECTION = () => true;

/**
 * Die Kind-Selections eines Baumknotens. Knoten ist jede Struktur mit einem
 * `selections`-Feld — eine Selection ebenso wie eine Force, die die Wurzel ihres
 * eigenen Teilbaums bildet.
 * @param {{selections?: import('../types.js').Selection[]}|null|undefined} node
 * @returns {import('../types.js').Selection[]} nie `null`/`undefined`
 */
export function childSelectionsOf(node) {
  return node?.selections ?? NO_SELECTIONS;
}

/**
 * Die Wurzel-Selections des gesamten Rosters: die obersten Selections aller
 * Forces, zu einer Liste verflacht.
 * @param {import('../types.js').Roster|null|undefined} roster
 * @returns {import('../types.js').Selection[]}
 */
export function rootSelectionsOf(roster) {
  return (roster?.forces ?? NO_SELECTIONS).flatMap(force => childSelectionsOf(force));
}

/**
 * Die eigene Anzahl einer Selection, unabhängig von ihrem Elternknoten. Fehlt
 * `number`, zählt die Selection einfach.
 * @param {import('../types.js').Selection} selection
 * @returns {number}
 */
export function ownCountOf(selection) {
  return selection?.number || IMPLICIT_SELECTION_COUNT;
}

/**
 * Die effektive Anzahl einer Selection im Baum: ihre eigene Anzahl,
 * multipliziert mit der effektiven Anzahl ihres Elternknotens.
 * @param {import('../types.js').Selection} selection
 * @param {number} parentCount effektive Anzahl des Elternknotens
 */
export function effectiveCountOf(selection, parentCount) {
  return ownCountOf(selection) * parentCount;
}

/**
 * Tiefensuche in Präorder über einen Selection-Wald.
 *
 * `visit` liefert den Kontext zurück, mit dem die Kinder des besuchten Knotens
 * besucht werden. So wandert nach unten akkumulierender Zustand (effektive
 * Anzahl, Katalog-Id, Elternknoten) mit der Traversierung, statt in jedem
 * Aufrufer von Hand durch eine eigene Rekursion gefädelt zu werden.
 *
 * @param {import('../types.js').Selection[]|null|undefined} selections
 * @param {(selection: import('../types.js').Selection, context: any) => any} visit
 * @param {any} [rootContext] Kontext der obersten Ebene
 */
export function traverseSelectionTree(selections, visit, rootContext) {
  for (const selection of selections ?? NO_SELECTIONS) {
    const childContext = visit(selection, rootContext);
    traverseSelectionTree(childSelectionsOf(selection), visit, childContext);
  }
}

/**
 * Faltung eines Teilbaums in Postorder: Erst werden die Kinder gefaltet, dann
 * verbindet `combine` deren Ergebnisse mit dem eigenen Knoten. `descend` leitet
 * aus einem Knoten den Kontext seiner Kinder ab.
 *
 * Deckt die Fälle ab, in denen ein Knotenergebnis aus den Ergebnissen seiner
 * Kinder entsteht — Gesamtkosten eines Teilbaums, Serialisierung geschachtelter
 * XML-Elemente.
 *
 * @param {import('../types.js').Selection} selection Wurzel des Teilbaums
 * @param {{descend?: (selection: any, context: any) => any, combine: (selection: any, context: any, childResults: any[]) => any}} handlers
 * @param {any} [context] Kontext der Wurzel
 */
export function foldSelectionTree(selection, handlers, context) {
  const { descend, combine } = handlers;
  const childContext = descend ? descend(selection, context) : context;
  const childResults = childSelectionsOf(selection).map(
    child => foldSelectionTree(child, handlers, childContext)
  );
  return combine(selection, context, childResults);
}

/**
 * Sucht eine Selection beliebiger Tiefe anhand ihrer Id.
 * @returns {import('../types.js').Selection|null}
 */
export function findSelectionById(selections, selectionId) {
  if (!selectionId) return null;
  for (const selection of selections ?? NO_SELECTIONS) {
    if (selection.id === selectionId) return selection;
    const foundInSubtree = findSelectionById(childSelectionsOf(selection), selectionId);
    if (foundInSubtree) return foundInSubtree;
  }
  return null;
}

/**
 * Sucht eine Selection beliebiger Tiefe im gesamten Roster anhand ihrer Id.
 * @returns {import('../types.js').Selection|null}
 */
export function findSelectionInRoster(roster, selectionId) {
  return findSelectionById(rootSelectionsOf(roster), selectionId);
}

/**
 * True, sobald irgendeine Selection im Wald — auf beliebiger Tiefe — das
 * Prädikat erfüllt. Bricht beim ersten Treffer ab.
 */
export function someSelection(selections, predicate) {
  return (selections ?? NO_SELECTIONS).some(
    selection => predicate(selection) || someSelection(childSelectionsOf(selection), predicate)
  );
}

/**
 * True, sobald die Selection selbst oder einer ihrer Nachfahren das Prädikat
 * erfüllt. Der Teilbaum schließt seine Wurzel mit ein.
 */
export function someSelectionInSubtree(selection, predicate) {
  return selection ? someSelection([selection], predicate) : false;
}

/**
 * Summiert die effektive Anzahl (`number`) der Selections, die `predicate`
 * erfüllen. `includeChildSelections` steuert, ob geschachtelte Selections
 * mitzählen; ohne die Option wird nur die übergebene Ebene gezählt.
 */
export function countSelections(selections, { includeChildSelections = false, predicate = MATCHES_EVERY_SELECTION } = {}) {
  return (selections ?? NO_SELECTIONS).reduce((sum, selection) => {
    const ownCount = predicate(selection) ? (selection.number || IMPLICIT_SELECTION_COUNT) : 0;
    const nestedCount = includeChildSelections
      ? countSelections(childSelectionsOf(selection), { includeChildSelections, predicate })
      : 0;
    return sum + ownCount + nestedCount;
  }, 0);
}

/**
 * Bildet einen Teilbaum unter Wahrung der Immutabilität ab: Die Kinder werden
 * zuerst abgebildet, dann erzeugt `transform` aus Knoten und bereits
 * abgebildeten Kindern den Ersatzknoten. Der Eingabebaum bleibt unberührt.
 *
 * @param {import('../types.js').Selection} selection
 * @param {(selection: any, mappedChildren: any[]) => any} transform
 */
export function mapSelectionTree(selection, transform) {
  const mappedChildren = childSelectionsOf(selection).map(child => mapSelectionTree(child, transform));
  return transform(selection, mappedChildren);
}

/** Neue Liste, in der der Eintrag an `index` durch `node` ersetzt ist. */
function withReplacedAt(nodes, index, node) {
  return nodes.map((item, position) => (position === index ? node : item));
}

/**
 * Ersetzt die — eindeutige — Selection mit `selectionId` beliebiger Tiefe durch
 * `replaceSelection(selection)` und gibt einen neuen Wald zurück. Unberührte
 * Teilbäume behalten ihre Referenz (Structural Sharing); findet sich keine
 * passende Selection, wird die Eingabeliste unverändert zurückgegeben, sodass
 * Aufrufer „nichts geändert" an der Identität erkennen.
 *
 * @param {import('../types.js').Selection[]|null|undefined} selections
 * @param {string} selectionId
 * @param {(selection: import('../types.js').Selection) => import('../types.js').Selection} replaceSelection
 */
export function replaceSelectionById(selections, selectionId, replaceSelection) {
  const nodes = selections ?? NO_SELECTIONS;
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index];
    if (node.id === selectionId) {
      return withReplacedAt(nodes, index, replaceSelection(node));
    }
    const currentChildren = childSelectionsOf(node);
    const updatedChildren = replaceSelectionById(currentChildren, selectionId, replaceSelection);
    if (updatedChildren !== currentChildren) {
      return withReplacedAt(nodes, index, { ...node, selections: updatedChildren });
    }
  }
  return selections;
}
