/**
 * Messverfahren fuer die Reinraum-Engine (`src/domain/evaluator/`) — **kein
 * Produktivcode**.
 *
 * Es liegt bewusst unter `scripts/` und nicht unter `src/`: es wird nicht
 * ausgeliefert, kein Modul der Anwendung importiert es, und es aendert das
 * Verhalten der Engine nicht. Es ist ein Messgeraet, kein Bestandteil des
 * Messobjekts (Main-Issue 75, „Aufwand messen").
 *
 * ── Gemessen wird von innen, gelesen von aussen ──────────────────────────────
 * Frueher spielte dieses Modul die Pipeline der Fassade nach, um ihre Abschnitte
 * einzeln stoppen zu koennen — eine zweite Kopie der Aufrufreihenfolge, die
 * driftete und mit einem Fingerabdruck-Vergleich gegen genau diese Drift
 * abgesichert werden musste. Seit Issue 0138 misst die Engine ihre Teilschritte
 * **selbst** und liefert das Ergebnis unter `{ measure: true }` als Metadata aus.
 * Dieses Modul ruft deshalb nur noch die Fassade und **liest** ab: Phasendauern,
 * Fixpunkt-Runden, Knotenzahlen. Ein Nachbau, der driften koennte, existiert
 * nicht mehr; entsprechend braucht es keine Absicherung gegen ihn.
 *
 * Was hier bleibt, ist Mess-**Politik**: Aufwaermlaeufe, die Zahl der
 * Wiederholungen, der Median ueber sie, die Summenbildung und die vorab
 * festgelegten Abnahmeschwellen. Die Engine liefert Rohgroessen, dieses Modul
 * entscheidet, was daraus ein Urteil wird.
 *
 * ── Die Schwellen stehen vor der Messung fest ────────────────────────────────
 * {@link INTERACTIVE_BUDGET_MS} und {@link TWO_STAGE_PREPARATION_SHARE} sind die
 * vorab festgelegten Abnahmeschwellen der PRD. Sie sind hier benannte Konstanten,
 * damit das Ergebnis die Entscheidung traegt und nicht umgekehrt.
 */

import { prepareDataset, evaluate, MeasuredPhase } from '../../src/domain/evaluator/evaluator.js';

/**
 * Interaktive Obergrenze: eine vollstaendige Auswertung bleibt darunter, damit
 * eine Roster-Aenderung als unmittelbar wahrgenommen wird (die Auswertung laeuft
 * synchron im UI-Prozess). Wird sie gerissen, ist das ein blockierender Befund,
 * kein Optimierungswunsch.
 */
export const INTERACTIVE_BUDGET_MS = 100;

/**
 * Entscheidungsschwelle fuer die Form der Fassade: macht die Vorbereitung des
 * Datensatzes **mehr als diesen Anteil** einer vollstaendigen Auswertung aus, wird
 * die Fassade zweistufig (der Vorbereitungsschritt wird exportiert und
 * wiederverwendet); sonst bleibt sie einstufig. Erst ab diesem Anteil zahlt die
 * Wiederverwendung die zusaetzliche Vertragsflaeche zurueck.
 */
export const TWO_STAGE_PREPARATION_SHARE = 0.5;

/** Die beiden Formen, zwischen denen die Vorbereitungs-Schwelle entscheidet. */
export const FacadeShape = Object.freeze({
  SINGLE_STAGE: 'einstufig',
  TWO_STAGE: 'zweistufig',
});

/** Laeufe, die vor der Messreihe nur zum Warmlaufen dienen (JIT, Speicherlayout). */
export const WARMUP_RUNS = 3;

/** Wiederholungen je Fall, ueber die der Median gebildet wird. */
export const DEFAULT_REPETITIONS = 15;

/**
 * Das Opt-in, mit dem die Fassade ihre Teilschritte selbst stoppt. Genau **ein**
 * Wert fuer beide Fassaden-Schritte: gemessen wird entweder ganz oder gar nicht.
 */
const MEASURE = Object.freeze({ measure: true });

/**
 * Misst **einen** vollstaendigen Auswertungslauf und weist seine Abschnitte
 * getrennt aus — die Vorbereitung des Datensatzes (erster Fassaden-Schritt) und
 * die drei Abschnitte der Auswertung (zweiter Fassaden-Schritt).
 *
 * Gestoppt hat die Engine; hier wird nur zusammengetragen, was ihre beiden
 * Ergebnisse als Metadata tragen. Die Gesamtdauer ist die Summe der vier
 * Abschnitte — sie zu bilden ist Mess-Politik und steht deshalb hier, nicht in
 * der Engine.
 *
 * @param {{ gameSystem?: string, catalogues?: string[] }} dataset  Datensatz wie bei `evaluate`.
 * @param {{ forces?: object[], costLimits?: object[] }} roster  Roster wie bei `evaluate`.
 * @returns {{ phases: Record<string, number>, totalMs: number, tree: object, fixpoint: { rounds: number, converged: boolean, nonConvergence: object|null }, report: object }}
 */
export function measureEvaluation(dataset, roster) {
  const prepared = prepareDataset(dataset, MEASURE);
  const report = evaluate(prepared, roster, MEASURE);

  // Die vier Abschnitte in der Reihenfolge der Fassade: die Vorbereitung vom
  // aufbereiteten Datensatz, die uebrigen drei vom Bericht.
  const phases = { ...prepared.measurement.phases, ...report.measurement.phases };

  return {
    phases,
    totalMs: Object.values(phases).reduce((sum, duration) => sum + duration, 0),
    // Abgelesen statt nachgezaehlt: Knotenzahlen und der Ausgang der
    // Fixpunktschleife kommen aus derselben Auswertung, deren Zeiten daneben
    // stehen — nicht aus einem zweiten Lauf und nicht aus einer eigenen Zaehlung.
    tree: report.measurement.tree,
    fixpoint: report.measurement.fixpoint,
    report,
  };
}

/**
 * Der Median einer Messreihe. Er (statt des Mittelwerts) traegt das Ergebnis, weil
 * ein einzelner Ausreisser — eine Speicherbereinigung mitten im Lauf — den
 * Mittelwert verschiebt, den Median aber nicht.
 *
 * @param {number[]} values  Mindestens ein Messwert.
 * @returns {number}
 */
export function median(values) {
  if (values.length === 0) {
    throw new Error('Der Median einer leeren Messreihe ist nicht definiert.');
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Prueft, dass alle Laeufe eines Falls dasselbe *Ergebnis* hatten, und liefert die
 * ergebnisseitigen Kennzahlen. Sie sind deterministisch — die Auswertung ist eine
 * reine Funktion ueber Datensatz und Roster —, also ist eine Abweichung ein Fehler
 * des Verfahrens und keine Streuung, die man mitteln duerfte.
 */
function invariantsOf(runs) {
  const [first, ...rest] = runs;
  const asKey = run => `${run.tree.total}/${run.tree.real}/${run.fixpoint.rounds}/${run.fixpoint.converged}`;
  const deviating = rest.find(run => asKey(run) !== asKey(first));
  if (deviating !== undefined) {
    throw new Error(
      `Die Laeufe desselben Falls liefern verschiedene Ergebnisse (${asKey(first)} vs. ${asKey(deviating)}). ` +
        'Die Auswertung ist eine reine Funktion — hier stimmt etwas am Messaufbau nicht.',
    );
  }
  return { tree: first.tree, fixpoint: first.fixpoint };
}

/**
 * Fasst die Laeufe eines Falls zusammen: je Abschnitt der Median, dazu der Median der
 * Gesamtdauer und der Anteil der Vorbereitung daran.
 *
 * @param {Array<{ phases: Record<string, number>, totalMs: number, tree: object, fixpoint: object }>} runs
 * @returns {{ repetitions: number, phases: Record<string, number>, totalMs: number, preparationShare: number, tree: object, fixpoint: object }}
 */
export function summarizeRuns(runs) {
  if (runs.length === 0) {
    throw new Error('Eine Zusammenfassung braucht mindestens einen Lauf.');
  }
  const phases = Object.fromEntries(
    Object.values(MeasuredPhase).map(phase => [phase, median(runs.map(run => run.phases[phase]))]),
  );
  const totalMs = median(runs.map(run => run.totalMs));
  return {
    repetitions: runs.length,
    phases,
    totalMs,
    preparationShare: phases[MeasuredPhase.PREPARATION] / totalMs,
    ...invariantsOf(runs),
  };
}

/**
 * Bewertet eine Zusammenfassung gegen die beiden vorab festgelegten Schwellen.
 *
 * @param {{ totalMs: number, preparationShare: number }} summary
 * @returns {{ withinInteractiveBudget: boolean, facadeShape: string }}
 */
export function assessThresholds({ totalMs, preparationShare }) {
  return {
    withinInteractiveBudget: totalMs < INTERACTIVE_BUDGET_MS,
    facadeShape: preparationShare > TWO_STAGE_PREPARATION_SHARE ? FacadeShape.TWO_STAGE : FacadeShape.SINGLE_STAGE,
  };
}

/**
 * Misst einen Fall: erst warmlaufen, dann die Messreihe.
 *
 * @param {{ gameSystem?: string, catalogues?: string[] }} dataset
 * @param {{ forces?: object[], costLimits?: object[] }} roster
 * @param {{ repetitions?: number }} [options]
 * @returns {{ repetitions: number, phases: Record<string, number>, totalMs: number, preparationShare: number, tree: object, fixpoint: object }}
 */
export function measureCase(dataset, roster, { repetitions = DEFAULT_REPETITIONS } = {}) {
  for (let run = 0; run < WARMUP_RUNS; run++) {
    measureEvaluation(dataset, roster);
  }
  const runs = [];
  for (let run = 0; run < repetitions; run++) {
    runs.push(measureEvaluation(dataset, roster));
  }
  return summarizeRuns(runs);
}
