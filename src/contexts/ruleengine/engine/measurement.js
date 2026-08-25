/**
 * Die **Selbstmessung** der Engine (Issue 0138): sie stoppt ihre eigenen
 * Teilschritte und reicht das Ergebnis als Metadata ueber die Fassade nach
 * aussen.
 *
 * ── Warum die Messung hier drin liegt ────────────────────────────────────────
 * Frueher baute das Messverfahren (`scripts/lib/evaluator-measurement.js`) die
 * Pipeline der Fassade von aussen nach, um ihre Abschnitte einzeln stoppen zu
 * koennen — eine zweite, unabhaengig gepflegte Kopie der Aufrufreihenfolge, die
 * driftete, sobald sich die Fassade aenderte. Wer die Abschnitte einer
 * Auswertung kennt, ist die Auswertung selbst; also misst sie sich selbst, und
 * das Messgeraet liest nur noch ab.
 *
 * ── Opt-in, damit der Normalpfad bleibt, was er ist ──────────────────────────
 * Gemessen wird **nur** unter `{ measure: true }`. Ohne das Flag laeuft kein
 * Zeitgeber: {@link NO_MEASUREMENT} ist ein Schreiber, der nichts schreibt und
 * den „gemessenen" Abschnitt schlicht ausfuehrt. Der bestehende Aufrufer bekommt
 * damit denselben Rueckgabewert wie zuvor, ohne ein zusaetzliches Feld
 * (`docs/evaluator-architecture.md` §2, Leitprinzip 1).
 *
 * ── Was die Engine liefert, und was nicht ────────────────────────────────────
 * Sie liefert **Rohgroessen**: je Abschnitt eine Dauer, den Ausgang der
 * Fixpunktschleife und die Knotenzahlen des Auswertungsbaums. Sie summiert
 * nichts, bildet keinen Median und kennt keine Schwellen — Aufwaermlaeufe,
 * Wiederholungen, Median und Abnahmeschwellen sind Mess-Politik und bleiben im
 * Messgeraet.
 */

import { AnchorKind, DiagnosticKind } from './model.js';
import { allNodes } from './evalTree.js';

/**
 * Die getrennt ausgewiesenen Abschnitte einer Auswertung, in der Reihenfolge der
 * Fassade. {@link MeasuredPhase.PREPARATION} faellt in `prepareDataset` an — dem
 * eigenen ersten Schritt der zweistufigen Fassade —, die uebrigen drei in
 * `evaluate`; `POST_PASS` ist dabei der einmalige Nach-Durchlauf ueber die
 * synthetischen Anker.
 */
export const MeasuredPhase = Object.freeze({
  PREPARATION: 'preparation',
  ITERATED_EVALUATION: 'iteratedEvaluation',
  POST_PASS: 'postPass',
  CONSTRAINTS_AND_REPORT: 'constraintsAndReport',
});

/**
 * Die Metadata eines **gemessenen Vorlaufs** — nur die eine Dauer, weil bei der
 * Vorbereitung nichts anderes anfaellt.
 *
 * @typedef {object} PreparationMeasurement
 * @property {Record<string, number>} phases  je Abschnitt seine Dauer in Millisekunden.
 */

/**
 * Die Metadata einer **gemessenen Auswertung**: die Dauern ihrer drei Abschnitte,
 * der Ausgang der Fixpunktschleife und die Knotenzahlen des Auswertungsbaums.
 * Bewusst **ohne** Gesamtdauer — das Summieren ist Mess-Politik.
 *
 * @typedef {object} EvaluationMeasurement
 * @property {Record<string, number>} phases  je Abschnitt seine Dauer in Millisekunden.
 * @property {{ rounds: number, converged: boolean, nonConvergence: object|null }} fixpoint
 *   Rundenzahl, Konvergenz und — falls die Schleife nicht zur Ruhe kam — die
 *   Diagnose, die sagt warum (`null` bei Konvergenz).
 * @property {{ total: number, real: number, synthetic: number, byAnchorKind: Record<string, number> }} tree
 *   die Knoten des Auswertungsbaums, getrennt nach real und synthetisch und nach
 *   Ankerart aufgeschluesselt.
 */

/** Die beiden Befunde, mit denen die Fixpunktschleife ihre Nichtkonvergenz meldet. */
const NON_CONVERGENCE_KINDS = Object.freeze([
  DiagnosticKind.OSCILLATION,
  DiagnosticKind.ROUND_BUDGET_EXHAUSTED,
]);

/**
 * Die Nichtkonvergenz-Diagnose der Fixpunktschleife, oder `null` bei Konvergenz.
 *
 * Abgelesen statt nachgebildet: die Diagnose *ist* der Befund und traegt ihre
 * Einzelheiten (Zykluslaenge der Oszillation bzw. erschoepftes Rundenbudget)
 * bereits mit sich.
 */
function nonConvergenceOf(fixpointDiagnostics) {
  return fixpointDiagnostics.find(entry => NON_CONVERGENCE_KINDS.includes(entry.kind)) ?? null;
}

/**
 * Zaehlt die Knoten des Auswertungsbaums, getrennt nach realen und synthetischen,
 * und schluesselt sie nach ihrer **Ankerart** auf (belegt / Pflicht-Phantom /
 * Gruppen-Anker / Kategorie-Anker / Angebots-Anker).
 *
 * Die Ankerart wird am Knoten **abgelesen** (`node.anchorKind`), nicht aus
 * Elternschaft und Definitionsart erraten — sonst entstuende eine zweite Wahrheit
 * ueber die Herkunft eines Ankers. Sie ist die Groesse, an der der Zuwachs des
 * Angebots gegenueber der Grundlinie ablesbar wird (ADR-0036).
 *
 * Modul-intern: nach aussen tritt die Zaehlung allein als `measurement.tree` des
 * Berichts auf — es gibt keinen zweiten Weg zu ihr.
 *
 * @param {object} root  Wurzel des Auswertungsbaums.
 * @returns {{ total: number, real: number, synthetic: number, byAnchorKind: Record<string, number> }}
 */
function describeTree(root) {
  let real = 0;
  let synthetic = 0;
  const byAnchorKind = Object.fromEntries(Object.values(AnchorKind).map(kind => [kind, 0]));
  for (const node of allNodes(root)) {
    if (node.isPhantom) synthetic += 1;
    else real += 1;
    byAnchorKind[node.anchorKind] += 1;
  }
  return { total: real + synthetic, real, synthetic, byAnchorKind };
}

/**
 * Der Schreiber des Normalpfads: er misst nichts, notiert nichts und haengt
 * nichts an. Ein „gemessener" Abschnitt ist schlicht sein eigener Aufruf, eine
 * Kennzahl entsteht gar nicht erst, und das Ergebnis geht unveraendert durch —
 * **kein** `performance.now()`, **kein** zusaetzliches Feld (Kriterium 4 der
 * Issue 0138).
 */
const NO_MEASUREMENT = Object.freeze({
  /**
   * @template T
   * @param {string} _phase  der Abschnitt, der hier gerade nicht gestoppt wird.
   * @param {() => T} run
   * @returns {T}
   */
  phase(_phase, run) {
    return run();
  },
  /** Nimmt den Ausgang der Fixpunktschleife entgegen und verwirft ihn. */
  noteFixpoint() {},
  /** Nimmt die Baumwurzel entgegen und zaehlt sie nicht — der Baum wird nie durchlaufen. */
  noteTree() {},
  /**
   * @template T
   * @param {T} target
   * @returns {T} unveraendert — der Rueckgabewert des Normalpfads.
   */
  attachTo(target) {
    return target;
  },
});

/**
 * Ein Schreiber, der wirklich misst: er stoppt jeden Abschnitt, nimmt die
 * Kennzahlen entgegen und haengt beides als **ein** Feld `measurement` an das
 * Ergebnis.
 *
 * Die Gestalt der Metadata steht damit an genau einer Stelle:
 * `{ phases: { <Abschnitt>: <ms> }, fixpoint: { rounds, converged,
 * nonConvergence }, tree: { total, real, synthetic, byAnchorKind } }` — der
 * aufbereitete Datensatz traegt davon nur `phases`, weil bei ihm nichts anderes
 * anfaellt.
 */
function createMeasurement() {
  /** @type {Record<string, number>} */
  const phases = {};
  /** @type {Record<string, object>} */
  const notes = {};
  return {
    phase(phase, run) {
      const startedAt = performance.now();
      const value = run();
      phases[phase] = performance.now() - startedAt;
      return value;
    },
    noteFixpoint({ rounds, converged, diagnostics }) {
      notes.fixpoint = { rounds, converged, nonConvergence: nonConvergenceOf(diagnostics) };
    },
    noteTree(root) {
      notes.tree = describeTree(root);
    },
    attachTo(target) {
      target.measurement = { phases, ...notes };
      return target;
    },
  };
}

/**
 * Waehlt den Schreiber anhand der Aufrufoptionen: **nur** das ausdrueckliche
 * `{ measure: true }` schaltet die Messung ein. Fehlende Optionen, ein leeres
 * Optionsobjekt und `{ measure: false }` fuehren alle auf den Normalpfad — ein
 * Optionsobjekt allein ist kein Opt-in.
 *
 * @param {{ measure?: boolean }} [options]
 * @returns {{ phase: Function, noteFixpoint: Function, noteTree: Function, attachTo: Function }}
 */
export function measurementFor(options) {
  return options?.measure === true ? createMeasurement() : NO_MEASUREMENT;
}
