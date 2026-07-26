/**
 * Bericht (`docs/evaluator-architecture.md` §3.6/§4.8).
 *
 * Der Bericht ist die **einzige** Quelle der Auswertungsergebnisse (Leitprinzip
 * 2). Er traegt zwei Sichten auf denselben, genau einmal ausgewerteten Stand:
 *
 * - **Verletzungen** fuer die Validierungsanzeige (das volle Ergebnis-Tripel je
 *   angeschlagener Grenze),
 * - je auswaehlbarem Slot einen **Faehigkeitsdatensatz** (`SlotCapability`) fuer
 *   die UI-Steuerung: Definitions-ID und **effektiver** Anzeigename, effektives
 *   min/max, aktueller Stand, Restspielraum, die Pflicht-/Gesperrt-/Versteckt-Flags,
 *   das Merkmal „Wert nicht stabil", die **Autor-Meldungen** des Katalogs und die
 *   **effektiven Merkmalswerte** seiner Info-Elemente,
 * - **Diagnosen** (Aufloesung, Oszillation, erschoepftes Rundenbudget, Null-Nenner).
 *
 * Dazu die reinen **UI-Projektions-Lookups**, die ausschliesslich den Bericht
 * lesen und keine Regel erneut auswerten (§4.8, Leitprinzip 3): die UI rechnet
 * nie selbst, sie projiziert nur den einen Bericht.
 */

import { ConstraintKind } from './model.js';
import { selectableSlotsOf, pathOf, infoCarriersOf } from './evalTree.js';

/** Der Normalfall: die Auswertung ist konvergiert, kein Slot ist instabil. */
const NO_UNSTABLE_NODES = new Set();

/**
 * Projiziert ein Constraint-Ergebnis auf eine Verletzungsmeldung. Sie traegt neben
 * dem Ergebnis-Tripel die **Herleitung** des Grenzwerts: Basiswert und die
 * Schritte, die ihn veraendert haben. Daraus liest sich ohne zweite Auswertung ab,
 * *warum* die Grenze auf diesem Wert steht (ADR-0027).
 */
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
    derivation: result.derivation ?? null,
  };
}

/**
 * Die **effektiven Merkmale** eines Slots: je Info-Element (Profil oder
 * Info-Verweis) seine Charakteristikwerte, nachdem die Modifikatoren gewirkt haben.
 * Der Traeger wird per ID mitgefuehrt, weil derselbe Merkmalstyp an mehreren
 * Profilen eines Slots haengen kann und ein Modifikator immer genau eines davon
 * trifft — naemlich das, an dem er haengt.
 */
function characteristicsOf(node, effective) {
  const entries = [];
  for (const carrier of infoCarriersOf(node.def)) {
    for (const { typeId, value } of effective.characteristicEntriesOf(node, carrier)) {
      entries.push({ carrierId: carrier.id, typeId, value });
    }
  }
  return entries;
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
 * Pflicht-unerfuellt unter dem MIN, versteckt aus dem effektiven Zustand. Name,
 * Merkmale und Autor-Meldungen kommen ebenfalls aus dem effektiven Zustand — die
 * Oberflaeche liest damit den Stand *nach* allen greifenden Modifikatoren, ohne
 * selbst zu rechnen (§4.8, Leitprinzip 3).
 *
 * `isValueUnstable` sagt: dieser Slot lag in der Menge, deren zaehlrelevante Werte
 * in der Fixpunktschleife nicht zur Ruhe kamen — seine Zahlen sind eine
 * Momentaufnahme der letzten Runde, keine gesicherte Aussage. Das Merkmal ist von
 * den drei anderen unabhaengig und schliesst keines aus; bei konvergierenden Daten
 * ist es an jedem Slot `false`.
 */
function toCapability(node, results, effective, unstableNodes) {
  const minResult = findResult(results, node, ConstraintKind.MIN);
  const maxResult = findResult(results, node, ConstraintKind.MAX);
  return {
    node,
    defId: node.def.id,
    name: effective.nameOf(node),
    effectiveMin: minResult === null ? null : minResult.bound,
    effectiveMax: maxResult === null ? null : maxResult.bound,
    current: maxResult?.actual ?? minResult?.actual ?? 0,
    headroom: headroomOf(maxResult),
    isMandatoryUnmet: minResult !== null && !minResult.satisfied,
    isBlocked: maxResult !== null && maxResult.actual >= maxResult.bound,
    isHidden: effective.isHidden(node),
    isValueUnstable: unstableNodes.has(node),
    authorMessages: effective.authorMessagesOf(node),
    characteristics: characteristicsOf(node, effective),
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
 * @param {{ budgetViolations?: object[], unstableNodes?: Set<object> }} [extras]
 *   `budgetViolations`: die roster-weiten Budget-Verletzungen (`budget.js`, Regel
 *   „Armee zu teuer") in Constraint-Ergebnis-Form. Sie fliessen in **dieselbe**
 *   `violations`-Liste und durch **dieselbe** Projektion wie die Katalog-Grenzen,
 *   tragen aber einen synthetischen roster-weiten Anker; sie sind keine anwaehlbaren
 *   Slots und erzeugen daher keinen Faehigkeitsdatensatz.
 *   `unstableNodes`: die Knoten, deren zaehlrelevante Werte in der Fixpunktschleife
 *   nicht zur Ruhe kamen (`fixpoint.js`). Ihr Faehigkeitsdatensatz wird als
 *   „Wert nicht stabil" markiert, damit die Unsicherheit am betroffenen Slot steht.
 * @returns {{ violations: object[], capabilities: Map<string, object>, diagnostics: object[] }}
 */
export function buildReport(root, effective, results, diagnostics, extras = {}) {
  const { budgetViolations = [], unstableNodes = NO_UNSTABLE_NODES } = extras;

  const capabilities = new Map();
  for (const node of selectableSlotsOf(root)) {
    capabilities.set(pathOf(node), toCapability(node, results, effective, unstableNodes));
  }
  return {
    violations: [...results, ...budgetViolations].filter(result => !result.satisfied).map(toViolation),
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
