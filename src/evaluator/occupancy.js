/**
 * Die **Belegung** je Slot (`docs/evaluator-architecture.md` §4.8): wie viel an
 * dieser Stelle tatsaechlich steht — gezaehlt aus dem Zaehlindex und **unabhaengig
 * von jeder Grenze**.
 *
 * Sie ist der Ist-Stand, den der Faehigkeitsdatensatz eines Slots ausweist, solange
 * keine Grenze ein Ergebnis beisteuert. Vorher las der Bericht den Ist-Stand
 * ausschliesslich aus dem Ergebnis einer Grenze und fiel sonst auf 0 zurueck — eine
 * Zahl, die dann nichts ueber das Roster sagte, sondern nur darueber, welche Grenzen
 * zufaellig ein Ergebnis hatten. Zwei Wege fuehren dorthin, und beide sind haeufig:
 * eine **unbegrenzt** erklaerte Obergrenze gilt gar nicht und liefert deshalb kein
 * Ergebnis (`constraints.js`), und eine Grenze **ohne Antwort** wird fail-closed
 * nicht verglichen (Issue 77, `unevaluatedLimitKinds`). Die Zaehlung ist von beidem
 * unberuehrt: sie steht im Index, ob eine Grenze sie liest oder nicht (Issue 82).
 *
 * ── Was genau gezaehlt wird ──────────────────────────────────────────────────
 * **Was an der Stelle des Slots steht**, also im Rahmen, unter dem er haengt, unter
 * der Id, die er nennt ({@link import('./identity.js').countingTargetIdOf}):
 *
 * - **Rahmen** ist der Elternknoten (`scope="parent"`) — der Rahmen, *worunter* der
 *   Slot haengt. Er ist fuer jede Ankerart derselbe: ein belegter Slot steht in ihm,
 *   ein Angebots-, Kategorie-, Gruppen- oder Pflicht-Anker benennt eine Definition
 *   *in* ihm. Deshalb meldet ein Angebots-Slot, an dem schon drei Vorkommen stehen,
 *   auch 3 — und nicht 0, wie es die eigene Instanzanzahl eines Ankers (er hat
 *   keine) ergaebe.
 * - **Ohne die `includeChild…`-Flags**, also nur der unmittelbare Rahmen: gezaehlt
 *   wird, was an dieser Stelle steht, nicht was irgendwo darunter liegt.
 * - **Messgroesse** ist die Anzahl — Selektionen, bei einem Kontingent-Slot
 *   Kontingente. Das ist die Einheit, in der an einem Slot hinzugefuegt und
 *   weggenommen wird, und genau die, die der Vorrang der ausgewiesenen Grenze
 *   (`report.js`, `MEASURE_PRECEDENCE`) aus demselben Grund vorn fuehrt. Eine
 *   Kostensumme waere hier keine Alternative, sondern eine andere Frage: sie sagt
 *   nicht, wie viel an der Stelle steht.
 *
 * Die Belegung ersetzt **nie** den Ist-Wert einer ausgewiesenen Grenze. Weist der
 * Slot eine Grenze aus, gilt deren Ist-Wert — er traegt deren Messgroesse und deren
 * Bezugsrahmen, und nur so passen `effectiveMin`/`effectiveMax`, `current` und
 * `headroom` zueinander (Main-Issue 76). Die Belegung tritt allein dort an, wo gar
 * keine Grenze etwas ausweist und die Frage nach der Einheit deshalb offen ist.
 *
 * Gezaehlt wird ueber das Query-Primitiv, die alleinige Zaehlstelle der Engine
 * (`query.js`) — nicht mit einem zweiten Zugriff in den Index.
 */

import { SELECTION_COUNT, FORCE_COUNT, ScopeKeyword, isUnresolvedQuery } from './model.js';
import { allNodes } from './evalTree.js';
import { countingTargetIdOf } from './identity.js';
import { query, createQueryContext } from './query.js';

/**
 * Die Flags der Belegungs-Zaehlung: keine. Gezaehlt wird der unmittelbare Rahmen
 * (siehe Kopf). `shared` bleibt dabei ohne Wirkung — `scope="parent"` ist bereits an
 * die Bezugsinstanz gebunden und geht ihm vor (ADR-0003 §4, `query.js`).
 */
const IMMEDIATE_FRAME_ONLY = Object.freeze({
  shared: false,
  includeChildSelections: false,
  includeChildForces: false,
});

/**
 * Das gezaehlte Feld eines Slots: die Anzahl der Kontingente an einem
 * Kontingent-Slot, sonst die Anzahl der Selektionen — dieselbe Unterscheidung, die
 * die Messgroessen `forceCount` und `selectionCount` treffen.
 */
function countedFieldOf(node) {
  return node.isForce ? FORCE_COUNT : SELECTION_COUNT;
}

/**
 * Zaehlt die Belegung jedes Slots des Baums.
 *
 * Aufzurufen **nach** Baumphase 2 (`offer.js`), damit auch die Angebots-Anker eine
 * Belegung tragen, und gegen denselben finalen Zaehlindex, aus dem die Grenzen
 * ausgewertet werden — sonst spraechen die Zahlen eines Berichts von zwei Staenden.
 *
 * @param {object} root  Wurzel des Auswertungsbaums.
 * @param {{ get: Function }} index  der finale Zaehlindex (`countIndex.js`).
 * @param {Set<string>} categoryIds  die bekannten Kategorie-IDs — an den
 *   Query-Kontext durchgereicht, wie ihn jede andere Zaehlstelle bekommt.
 * @returns {Map<object, number>} die Belegung je Knoten.
 */
export function buildOccupancyIndex(root, index, categoryIds) {
  const occupancy = new Map();
  // Die Belegungs-Query kann in diesem Stand keine Antwort verfehlen: ihr Rahmen ist
  // der Elternknoten (jeder Slot hat einen), und ihr Feld ist eine Anzahl. Bliebe sie
  // dennoch ohne Antwort, waere eine Annahme dieses Moduls gebrochen — dann ist zu
  // melden statt still zu zaehlen. Die Diagnosen der Query sind deshalb kein
  // verschluckter Befund: jede von ihnen faellt mit genau diesem Sentinel zusammen.
  const unusedDiagnostics = [];
  for (const node of allNodes(root)) {
    const ctx = createQueryContext({ node, root, index, categoryIds, diagnostics: unusedDiagnostics });
    const count = query(ctx, countedFieldOf(node), ScopeKeyword.PARENT, countingTargetIdOf(node.def), IMMEDIATE_FRAME_ONLY);
    if (isUnresolvedQuery(count)) {
      throw new Error(`Slot ohne zaehlbare Belegung: ${node.def?.id}`);
    }
    occupancy.set(node, count);
  }
  return occupancy;
}

/**
 * Die Belegung eines Slots. Ein Slot ohne Eintrag ist kein „nichts steht hier",
 * sondern ein Zaehlstand, der nie gebildet wurde — etwa weil die Belegung gegen
 * einen aelteren Baum gezaehlt wurde als den, den der Bericht projiziert. Das wird
 * gemeldet, statt als 0 genau den Ersatzwert zurueckzubringen, den dieses Modul
 * abschafft.
 *
 * @param {Map<object, number>} occupancy  das Ergebnis von {@link buildOccupancyIndex}.
 * @param {object} node  der Slot.
 * @returns {number} die Belegung.
 */
export function occupancyOf(occupancy, node) {
  const count = occupancy.get(node);
  if (count === undefined) {
    throw new Error(`Slot ohne gezaehlte Belegung: ${node.def?.id}`);
  }
  return count;
}
