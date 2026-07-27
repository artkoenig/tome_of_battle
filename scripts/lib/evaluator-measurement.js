/**
 * Messverfahren fuer die Reinraum-Engine (`src/evaluator/`) — **kein
 * Produktivcode**.
 *
 * Es liegt bewusst unter `scripts/` und nicht unter `src/`: es wird nicht
 * ausgeliefert, kein Modul der Anwendung importiert es, und es aendert das
 * Verhalten der Engine nicht. Es ist ein Messgeraet, kein Bestandteil des
 * Messobjekts (Main-Issue 75, `design.md`, „Aufwand messen").
 *
 * ── Warum die Pipeline hier nachgespielt wird ────────────────────────────────
 * Die Fassade `evaluate` liefert genau eine Zahl: die Gesamtdauer. Gefragt sind
 * aber die **getrennten Anteile** — Vorbereitung des Datensatzes, iterierte
 * Auswertung, Nach-Durchlauf, Grenzen und Bericht — und dazu Groessen, die im
 * Bericht gar nicht vorkommen (Knotenzahl, Ausgang der Fixpunktschleife). Beides
 * ist von aussen nicht ablesbar, also ruft {@link measureEvaluation} dieselben
 * Engine-Module in derselben Reihenfolge auf wie die Fassade.
 *
 * Damit aus dieser Nachbildung keine zweite, still auseinanderlaufende Wahrheit
 * wird, gibt es {@link assertMatchesFacade}: sie wertet denselben Fall zusaetzlich
 * ueber die Fassade aus und bricht ab, sobald die beiden Berichte auseinandergehen.
 * Eine Aenderung der Fassaden-Reihenfolge faellt damit sofort auf, statt eine
 * falsche Messung zu erzeugen.
 *
 * ── Die Schwellen stehen vor der Messung fest ────────────────────────────────
 * {@link INTERACTIVE_BUDGET_MS} und {@link TWO_STAGE_PREPARATION_SHARE} sind die
 * in `design.md` vorab festgelegten Abnahmeschwellen der PRD. Sie sind hier
 * benannte Konstanten, damit das Ergebnis die Entscheidung traegt und nicht
 * umgekehrt.
 */

import { PreparedDataset, prepareDataset } from '../../src/evaluator/datasetPreparation.js';
import { buildEvalTree, allNodes } from '../../src/evaluator/evalTree.js';
import { attachOfferAnchors } from '../../src/evaluator/offer.js';
import { extendBaseEffectiveState } from '../../src/evaluator/effectiveState.js';
import { buildIndex } from '../../src/evaluator/countIndex.js';
import { evaluateToFixpoint, applyAnchorPostPass } from '../../src/evaluator/fixpoint.js';
import { evaluateConstraints } from '../../src/evaluator/constraints.js';
import { evaluateRosterBudget } from '../../src/evaluator/budget.js';
import { buildOccupancyIndex } from '../../src/evaluator/occupancy.js';
import { buildReport } from '../../src/evaluator/report.js';
import { createRosterBudget } from '../../src/evaluator/rosterBudget.js';
import { AnchorKind, DiagnosticKind } from '../../src/evaluator/model.js';
import { evaluate } from '../../src/evaluator/evaluator.js';

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

/**
 * Die getrennt ausgewiesenen Abschnitte einer Auswertung. Die Reihenfolge ist die
 * der Fassade; `POST_PASS` ist der einmalige Nach-Durchlauf ueber die synthetischen
 * Anker (siehe {@link measureEvaluation}).
 */
export const MeasuredPhase = Object.freeze({
  PREPARATION: 'preparation',
  ITERATED_EVALUATION: 'iteratedEvaluation',
  POST_PASS: 'postPass',
  CONSTRAINTS_AND_REPORT: 'constraintsAndReport',
});

/** Laeufe, die vor der Messreihe nur zum Warmlaufen dienen (JIT, Speicherlayout). */
export const WARMUP_RUNS = 3;

/** Wiederholungen je Fall, ueber die der Median gebildet wird. */
export const DEFAULT_REPETITIONS = 15;

/** Die beiden Befunde, mit denen die Fixpunktschleife ihre Nichtkonvergenz meldet. */
const NON_CONVERGENCE_KINDS = Object.freeze([
  DiagnosticKind.OSCILLATION,
  DiagnosticKind.ROUND_BUDGET_EXHAUSTED,
]);

/** Die Nichtkonvergenz-Diagnose der Schleife, oder `null` bei Konvergenz. */
function nonConvergenceOf(fixpointDiagnostics) {
  return fixpointDiagnostics.find(entry => NON_CONVERGENCE_KINDS.includes(entry.kind)) ?? null;
}

/**
 * Fuehrt `run` aus und misst seine Dauer.
 *
 * @template T
 * @param {() => T} run  Der zu messende Abschnitt.
 * @returns {{ value: T, durationMs: number }}  Sein Ergebnis und seine Dauer.
 */
function timed(run) {
  const startedAt = performance.now();
  const value = run();
  return { value, durationMs: performance.now() - startedAt };
}

/**
 * Zaehlt die Knoten des Auswertungsbaums, getrennt nach realen und synthetischen,
 * und schluesselt sie nach ihrer **Ankerart** auf (belegt / Pflicht-Phantom /
 * Gruppen-Anker / Kategorie-Anker / Angebots-Anker).
 *
 * Die Ankerart wird am Knoten **abgelesen** (`node.anchorKind`), nicht aus
 * Elternschaft und Definitionsart erraten — sonst entstuende hier eine zweite
 * Wahrheit ueber die Herkunft eines Ankers. Sie ist die Groesse, an der der Zuwachs
 * des Angebots gegenueber der Grundlinie ablesbar wird.
 *
 * @param {object} root  Wurzel des Auswertungsbaums.
 * @returns {{ total: number, real: number, synthetic: number, byAnchorKind: Record<string, number> }}
 */
export function describeTree(root) {
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
 * Misst **einen** vollstaendigen Auswertungslauf und weist seine Abschnitte getrennt
 * aus. Die Aufrufreihenfolge ist die der Fassade `evaluate`; abgesichert wird die
 * Gleichheit ueber {@link assertMatchesFacade}.
 *
 * @param {{ gameSystem?: string, catalogues?: string[] }} dataset  Datensatz wie bei `evaluate`.
 * @param {{ forces?: object[], costLimits?: object[] }} roster  Roster wie bei `evaluate`.
 * @returns {{ phases: Record<string, number>, totalMs: number, tree: object, fixpoint: { rounds: number, converged: boolean }, report: object }}
 */
export function measureEvaluation(dataset, roster) {
  const budget = createRosterBudget(roster.costLimits);

  // (a) Katalog-Vorlauf: lesen → zusammenfuehren → aufloesen. Seit die Fassade
  // zweistufig ist, ist das ihr erster Schritt; die Messung ruft ihn genauso auf
  // und packt sein Ergebnis engine-intern aus, um die folgenden Abschnitte einzeln
  // messen zu koennen.
  const preparation = timed(() => prepareDataset(dataset));
  const { resolved, catalogueIds, diagnostics: datasetDiagnostics } = PreparedDataset.contentsOf(preparation.value);

  // (b) Iterierte Auswertung: Baumphase 1, Fixpunktrunden ueber die realen Knoten,
  // finaler Index.
  const iterated = timed(() => {
    const { root, diagnostics: joinDiagnostics } = buildEvalTree(resolved, roster, catalogueIds);
    const { effective, diagnostics: fixpointDiagnostics, rounds, converged, unstableNodes } =
      evaluateToFixpoint(root, resolved.categoryIds, budget);
    const index = buildIndex(root, effective);
    return {
      root,
      effective,
      index,
      joinDiagnostics,
      fixpointDiagnostics,
      unstableNodes,
      // Der Ausgang der Schleife samt ihres Befunds: konvergiert, oder die eine
      // Nichtkonvergenz-Diagnose (Oszillation mit Zykluslaenge / erschoepftes
      // Rundenbudget). Abgelesen statt nachgebildet — die Diagnose *ist* der Befund.
      fixpoint: { rounds, converged, nonConvergence: nonConvergenceOf(fixpointDiagnostics) },
    };
  });
  const { root, effective, index, joinDiagnostics, fixpointDiagnostics, unstableNodes, fixpoint } = iterated.value;

  // (c) Nach-Durchlauf: **Baumphase 2** (die Angebots-Anker) und die Modifikatoren
  // auf allen synthetischen Ankern, gegen den finalen Index. Sein getrennt
  // ausgewiesener Anteil ist der Beleg dafuer, dass der Nach-Durchlauf den Zuwachs
  // des Angebots aus der Schleife heraushaelt: erst der Vergleich „(b) vorher" gegen
  // „(b)+(c) nachher" macht die Wirkung dieser Entscheidung nachweisbar.
  const postPass = timed(() => {
    extendBaseEffectiveState(effective, attachOfferAnchors(root, resolved));
    return applyAnchorPostPass(root, index, effective, resolved.categoryIds, budget);
  });

  // (d) Grenzen-Auswertung und Berichtsbau.
  const constraintsAndReport = timed(() => {
    const constraintDiagnostics = [];
    const results = evaluateConstraints(root, index, effective, resolved.categoryIds, constraintDiagnostics, budget);
    const budgetViolations = evaluateRosterBudget(index, budget);
    // Die Belegung je Slot — wie in der Fassade nach Baumphase 2 und gegen denselben
    // finalen Index gezaehlt. Sie speist den Faehigkeitsdatensatz und gehoert damit
    // in dieselbe gemessene Phase wie der Berichtsbau.
    const occupancy = buildOccupancyIndex(root, index, resolved.categoryIds);
    const diagnostics = [
      ...datasetDiagnostics,
      ...joinDiagnostics,
      ...fixpointDiagnostics,
      ...postPass.value,
      ...constraintDiagnostics,
    ];
    // `profileTypes` wie in der Fassade mitgeben: ohne sie baute die Messung eine
    // Info-Projektion ohne Klartext-Namen und maesse damit weniger, als die Engine
    // wirklich tut. `categoryIds` aus demselben Grund: ohne sie ordnete die Messung
    // einen ID-Bezugsrahmen als Eintrags- statt als Kategorie-Rahmen ein.
    return buildReport(root, effective, results, occupancy, diagnostics, {
      budgetViolations,
      unstableNodes,
      profileTypes: resolved.profileTypes,
      categoryIds: resolved.categoryIds,
    });
  });

  const phases = {
    [MeasuredPhase.PREPARATION]: preparation.durationMs,
    [MeasuredPhase.ITERATED_EVALUATION]: iterated.durationMs,
    [MeasuredPhase.POST_PASS]: postPass.durationMs,
    [MeasuredPhase.CONSTRAINTS_AND_REPORT]: constraintsAndReport.durationMs,
  };

  return {
    phases,
    totalMs: Object.values(phases).reduce((sum, duration) => sum + duration, 0),
    tree: describeTree(root),
    fixpoint,
    report: constraintsAndReport.value,
  };
}

/**
 * Ein stabiler, vergleichbarer Fingerabdruck eines Berichts: die Verletzungen
 * (sortiert, mit Ist-Wert und Grenze), die Zahl der Faehigkeitsdatensaetze, die
 * Zahl ihrer Info-Elemente und die aufgetretenen Diagnose-Arten. Bewusst keine
 * Knoten-Referenzen — verglichen wird das *Ergebnis*, nicht die Objektidentitaet.
 *
 * Die Info-Elemente gehen mit ein, weil die Info-Projektion sonst still
 * auseinanderlaufen koennte: eine Nachbildung, die dem Berichtsbau die
 * Profiltyp-Deklarationen nicht mitgibt, liefert exakt dieselben Verletzungen und
 * denselben Datensatz-Umfang und waere ohne diese Zahl nicht zu unterscheiden.
 *
 * Aus demselben Grund geht die **Einordnung** jeder Meldung mit ein (Issue 75/07):
 * Herkunft, Schweregrad, Ankerart, Messgroesse, Rahmenart und die Zahl der
 * Ursachen. Eine Nachbildung, die dem Berichtsbau etwa die Kategorie-IDs nicht
 * mitgibt, ordnete einen ID-Bezugsrahmen falsch ein — und liefe ohne diese Felder
 * mit identischem Fingerabdruck still an der Fassade vorbei.
 *
 * @param {{ violations: object[], capabilities: Map<string, object>, diagnostics: object[] }} report
 * @returns {string}
 */
export function reportFingerprint(report) {
  const violations = report.violations
    .map(violation => [
      `${violation.limitId ?? ''}@${violation.anchor?.defId ?? ''}=${violation.actual}/${violation.bound}`,
      violation.origin,
      violation.severity,
      violation.anchor?.anchorKind,
      violation.limit?.measure,
      violation.limit?.scope?.kind,
      (violation.causes ?? []).length,
    ].join('|'))
    .sort();
  const diagnosticKinds = report.diagnostics.map(entry => entry.kind).sort();
  return JSON.stringify({
    violations,
    capabilities: report.capabilities.size,
    infoElements: countInfoElements(report.capabilities),
    diagnosticKinds,
  });
}

/** Die Gesamtzahl der Info-Elemente ueber alle Faehigkeitsdatensaetze eines Berichts. */
function countInfoElements(capabilities) {
  let total = 0;
  for (const capability of capabilities.values()) {
    total += capability.infoElements?.length ?? 0;
  }
  return total;
}

/**
 * Sichert die Nachbildung gegen Abdriften ab: wertet denselben Fall zusaetzlich ueber
 * die Fassade aus und wirft, wenn ihr Bericht von dem der Messung abweicht. Damit
 * misst das Verfahren nie eine Pipeline, die es so nicht mehr gibt.
 *
 * @param {{ gameSystem?: string, catalogues?: string[] }} dataset
 * @param {{ forces?: object[], costLimits?: object[] }} roster
 * @param {object} measuredReport  Der von {@link measureEvaluation} erzeugte Bericht.
 */
export function assertMatchesFacade(dataset, roster, measuredReport) {
  const facadeFingerprint = reportFingerprint(evaluate(prepareDataset(dataset), roster));
  const measuredFingerprint = reportFingerprint(measuredReport);
  if (facadeFingerprint !== measuredFingerprint) {
    throw new Error(
      'Die nachgebildete Pipeline des Messverfahrens weicht von der Fassade `evaluate` ab. ' +
        'Die Messung waere wertlos — gleiche zuerst scripts/lib/evaluator-measurement.js an ' +
        `src/evaluator/evaluator.js an.\n  Fassade: ${facadeFingerprint}\n  Messung: ${measuredFingerprint}`,
    );
  }
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
 * Misst einen Fall: erst warmlaufen, dann die Messreihe, dann der Abgleich gegen die
 * Fassade. Der Abgleich laeuft nach der Messreihe, damit er ihre Zeiten nicht faelscht.
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
  assertMatchesFacade(dataset, roster, runs[runs.length - 1].report);
  return summarizeRuns(runs);
}
