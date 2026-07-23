/**
 * Reine Zusammenbau-Logik des Projektzustandsberichts: aus den bereits erhobenen
 * Rohdaten entsteht hier das {@link import('./renderReport.js').ReportModel}, das
 * {@link module:project-state/renderReport} zu HTML rendert.
 *
 * Diese Funktion ist bewusst frei von I/O -- kein `git`, kein Dateizugriff, kein
 * Prozessaufruf. Die Raender (Gates ausfuehren, Dateien lesen, Refs beschaffen)
 * liegen im Orchestrator {@link module:project-state/generate} und reichen ihre
 * Ergebnisse hier als reine Daten herein. Dadurch ist der eigentliche Zusammenbau
 * ueber injizierte Eingaben testbar, ohne echten `git`-, `vitest`- oder
 * Netzzugriff (PRD 54, "Testing Decisions").
 *
 * Die einzelnen Auswertungen (Gate-Klassifikation, Abdeckung, Funktionslaengen,
 * Graph, offene Vorgaenge) stammen aus den reinen Modulen daneben; hier laufen sie
 * nur zu einem Modell zusammen.
 *
 * @module project-state/buildReportModel
 */
import { buildGateStates, GateStatus, GateEnforcement } from './gates.js';
import { aggregateCoverage } from './coverage.js';
import { aggregateLoc } from './loc.js';
import { aggregateComplexity } from './complexity.js';
import { collectOpenIssues } from './issues.js';

/** Beschriftungen der Kennzahlen -- an einer Stelle, damit sie nicht als Magie im Code liegen. */
const METRIC_LABELS = Object.freeze({
  openIssues: 'Open issues',
  blockingGates: 'Blocking gates',
  notRunGates: 'Gates not run',
  totalLines: 'Total lines of code',
});

const METRIC_HINTS = Object.freeze({
  blockingGates: 'fail CI on findings',
  notRunGates: 'tool did not run -- no green result',
  totalLines: 'non-empty lines in production code',
});

/**
 * @typedef {object} SourceFile  Eine bereits eingelesene Quelldatei.
 * @property {string} path    Pfad relativ zur Projektwurzel (fuer die Anzeige).
 * @property {string} source  Vollstaendiger Quelltext.
 */

/**
 * @typedef {object} ReportModelInput  Die von aussen erhobenen Rohdaten.
 * @property {string} [generatedAt]  Fertiger Anzeigetext des Erhebungszeitpunkts.
 * @property {string} [title]
 * @property {Record<string, import('./gates.js').GateRun>} [gateRuns]  Rohergebnisse je Gate-Id.
 * @property {object|null} [workflowJob]  Der geparste CI-Job (fuer die Gate-Wirksamkeit).
 * @property {Record<string, object>} [coverageFinal]  Inhalt von `coverage-final.json`.
 * @property {string} [rootPath]  Projektwurzel, aus den Coverage-Pfaden entfernt.
 * @property {ReadonlyArray<SourceFile>} [sources]  Produktivcode fuer LOC und Komplexitaet.
 * @property {ReadonlyArray<import('./issues.js').IssueRef>} [issueRefs]  Erreichbare Refs.
 * @property {(refName: string, filePath: string) => (string|null)} [showFile]  Injizierter Lesezugriff.
 */

/**
 * Baut aus den erhobenen Rohdaten das reine Datenmodell des Berichts.
 *
 * @param {ReportModelInput} input
 * @returns {import('./renderReport.js').ReportModel}
 */
export function buildReportModel({
  generatedAt = '',
  title,
  gateRuns = {},
  workflowJob = null,
  coverageFinal = {},
  rootPath = '',
  sources = [],
  issueRefs = [],
  showFile = () => null,
} = {}) {
  const gates = buildGateStates({ workflowJob, runs: gateRuns });
  const coverage = aggregateCoverage(coverageFinal, { rootPath });
  const { moduleMetrics, totalLines } = buildSizeFacts(sources);
  const { issues: openIssues, unreadable } = collectOpenIssues(issueRefs, showFile);
  const metrics = buildMetrics({ gates, openIssues, totalLines });

  return {
    title,
    generatedAt,
    gates,
    metrics,
    coverage,
    moduleMetrics,
    openIssues,
    unreadableIssues: unreadable,
    branchScope: { scannedRefs: issueRefs.map((ref) => ref.name) },
  };
}

/**
 * Verbindet Codeumfang (LOC) und zyklomatische Komplexitaet je Modul zu einer
 * gemeinsamen Kennzahlenreihe -- beide sind Aggregate ueber dieselben Module, und
 * der Bericht zeigt sie in einer Tabelle nebeneinander.
 *
 * @param {ReadonlyArray<SourceFile>} sources
 * @returns {{
 *   moduleMetrics: import('./renderReport.js').ModuleMetric[],
 *   totalLines: number,
 * }}
 */
function buildSizeFacts(sources) {
  const loc = aggregateLoc(sources);
  const complexity = aggregateComplexity(sources);
  const complexityByModule = new Map(complexity.modules.map((entry) => [entry.module, entry]));

  const moduleMetrics = loc.modules.map((locModule) => {
    const moduleComplexity = complexityByModule.get(locModule.module);
    return {
      module: locModule.module,
      fileCount: locModule.fileCount,
      lines: locModule.lines,
      functionCount: moduleComplexity?.functionCount ?? 0,
      totalComplexity: moduleComplexity?.totalComplexity ?? 0,
      averageComplexity: moduleComplexity?.averageComplexity ?? 0,
      maxComplexity: moduleComplexity?.maxComplexity ?? 0,
    };
  });

  return { moduleMetrics, totalLines: loc.totalLines };
}

/**
 * Die Kennzahlen des Healthchecks: knappe Zahlen, die einen Blick auf den Zustand
 * geben, ohne dass man die Tabellen darunter lesen muss.
 *
 * @param {object} input
 * @param {ReadonlyArray<import('./gates.js').GateState>} input.gates
 * @param {ReadonlyArray<import('./issues.js').OpenIssue>} input.openIssues
 * @param {number} input.totalLines
 * @returns {import('./renderReport.js').Metric[]}
 */
function buildMetrics({ gates, openIssues, totalLines }) {
  const blockingGates = gates.filter((gate) => gate.enforcement === GateEnforcement.Blocking).length;
  const notRunGates = gates.filter((gate) => gate.status === GateStatus.NotRun).length;

  return [
    { label: METRIC_LABELS.openIssues, value: openIssues.length },
    { label: METRIC_LABELS.blockingGates, value: `${blockingGates}/${gates.length}`, hint: METRIC_HINTS.blockingGates },
    withOptionalHint(
      { label: METRIC_LABELS.notRunGates, value: notRunGates },
      notRunGates > 0 ? METRIC_HINTS.notRunGates : undefined,
    ),
    { label: METRIC_LABELS.totalLines, value: totalLines, hint: METRIC_HINTS.totalLines },
  ];
}

/** @param {import('./renderReport.js').Metric} metric @param {string|undefined} hint */
function withOptionalHint(metric, hint) {
  return hint ? { ...metric, hint } : metric;
}
