/**
 * Bericht (`docs/evaluator-architecture.md` §3.6/§4.8).
 *
 * Der Bericht ist die **einzige** Quelle der Auswertungsergebnisse (Leitprinzip
 * 2). Er traegt zwei Sichten auf denselben, genau einmal ausgewerteten Stand:
 *
 * - **Verletzungen** fuer die Validierungsanzeige (das volle Ergebnis-Tripel je
 *   angeschlagener Grenze),
 * - je auswaehlbarem Slot einen **Faehigkeitsdatensatz** (`SlotCapability`) fuer
 *   die UI-Steuerung: effektives min/max, aktueller Stand, Restspielraum sowie
 *   die Pflicht-/Gesperrt-/Versteckt-Flags und die bedingten Hinweise,
 * - **Diagnosen** (Aufloesung, Nichtkonvergenz, Null-Nenner).
 *
 * Dazu die reinen **UI-Projektions-Lookups**, die ausschliesslich den Bericht
 * lesen und keine Regel erneut auswerten (§4.8, Leitprinzip 3): die UI rechnet
 * nie selbst, sie projiziert nur den einen Bericht.
 */

import { LimitKind } from './model.js';
import { selectableSlotsOf, pathOf } from './evalTree.js';

/** Projiziert ein Constraint-Ergebnis auf eine Verletzungsmeldung. */
function toViolation(result) {
  return {
    limitId: result.limit.id,
    anchor: {
      defId: result.anchor.def.id,
      name: result.anchor.def.name,
    },
    actual: result.actual,
    bound: result.bound,
    delta: result.delta,
  };
}

/**
 * Das Ergebnis der Grenze gegebener Art (MIN/MAX) am Knoten, oder `null`, wenn
 * der Knoten keine solche (nicht suspendierte) Grenze traegt.
 */
function findResult(results, node, kind) {
  return results.find(result => result.anchor === node && result.limit.kind === kind) ?? null;
}

/**
 * Der Restspielraum eines Slots: `max(0, Grenzwert − Ist-Wert)`, wenn eine
 * MAX-Grenze besteht. Ohne MAX-Grenze gibt es keine Obergrenze und damit keinen
 * Restspielraum (`null`).
 */
function headroomOf(maxResult) {
  return maxResult === null ? null : Math.max(0, maxResult.bound - maxResult.actual);
}

/**
 * Baut den Faehigkeitsdatensatz eines Slots aus seinen MIN-/MAX-Ergebnissen und
 * dem effektiven Zustand. Der aktuelle Stand kommt bevorzugt aus der MAX-, sonst
 * der MIN-Grenze; traegt der Slot keine (nicht suspendierte) Grenze, ist er 0.
 * Die Flags sind konsistent zu den ausgewerteten Grenzen: gesperrt am MAX,
 * Pflicht-unerfuellt unter dem MIN, versteckt aus dem effektiven Zustand.
 */
function toCapability(node, results, effective) {
  const minResult = findResult(results, node, LimitKind.MIN);
  const maxResult = findResult(results, node, LimitKind.MAX);
  return {
    node,
    effectiveMin: minResult === null ? null : minResult.bound,
    effectiveMax: maxResult === null ? null : maxResult.bound,
    current: maxResult?.actual ?? minResult?.actual ?? 0,
    headroom: headroomOf(maxResult),
    isMandatoryUnmet: minResult !== null && !minResult.satisfied,
    isBlocked: maxResult !== null && maxResult.actual >= maxResult.bound,
    isHidden: effective.isHidden(node),
    notes: effective.notesOf(node),
  };
}

/**
 * Baut den Bericht aus dem Auswertungsbaum, dem effektiven Zustand, den
 * Constraint-Ergebnissen und den gesammelten Diagnosen. Je auswaehlbarem Slot
 * (reale Knoten plus Phantom-Pflichtslots) entsteht ein Faehigkeitsdatensatz,
 * abgelegt unter dem stabilen Pfad des Slots ({@link pathOf}).
 *
 * @param {object} root  Wurzel des Evaluationsbaums.
 * @param {import('./effectiveState.js').EffectiveState} effective  effektiver Zustand.
 * @param {object[]} results  Ergebnisse von `evaluateConstraints`.
 * @param {object[]} diagnostics  alle waehrend der Auswertung gesammelten Diagnosen.
 * @returns {{ violations: object[], capabilities: Map<string, object>, diagnostics: object[] }}
 */
export function buildReport(root, effective, results, diagnostics) {
  const capabilities = new Map();
  for (const node of selectableSlotsOf(root)) {
    capabilities.set(pathOf(node), toCapability(node, results, effective));
  }
  return {
    violations: results.filter(result => !result.satisfied).map(toViolation),
    capabilities,
    diagnostics,
  };
}

// ── UI-Projektions-Lookups: reine Bericht-Leser, keine Regelauswertung (§4.8) ──

/**
 * True, wenn der Slot am gegebenen Pfad auswaehlbar ist: weder versteckt noch
 * gesperrt. Ein unbekannter Pfad ist kein auswaehlbarer Slot (`false`).
 */
export function isSelectable(report, path) {
  const capability = report.capabilities.get(path);
  return capability !== undefined && !capability.isHidden && !capability.isBlocked;
}

/**
 * Der Restspielraum des Slots am gegebenen Pfad (`headroom`): wie viele weitere
 * Auswahlen die MAX-Grenze noch zulaesst. `null`, wenn der Slot keine MAX-Grenze
 * traegt oder der Pfad unbekannt ist.
 */
export function remainingAllowed(report, path) {
  return report.capabilities.get(path)?.headroom ?? null;
}

/**
 * Die offenen Pflichtslots des Berichts: alle Faehigkeitsdatensaetze, deren
 * MIN-Grenze unerfuellt ist (`isMandatoryUnmet`).
 */
export function mandatoryOpenSlots(report) {
  return [...report.capabilities.values()].filter(capability => capability.isMandatoryUnmet);
}
