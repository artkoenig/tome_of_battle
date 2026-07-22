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
import { findLongFunctions, DEFAULT_LONG_FUNCTION_LINES } from './functions.js';
import { buildImportGraph, findCycles, findLayerViolations, DEFAULT_LAYERS } from './graph.js';
import { collectOpenIssues } from './issues.js';

/** Wie viele der laengsten Funktionen der Bericht hoechstens auffuehrt. */
export const DEFAULT_MAX_LONG_FUNCTIONS = 15;

/** Beschriftungen der Kennzahlen -- an einer Stelle, damit sie nicht als Magie im Code liegen. */
const METRIC_LABELS = Object.freeze({
  openIssues: 'Offene Vorgaenge',
  blockingGates: 'Blockierende Gates',
  notRunGates: 'Nicht angelaufene Gates',
  longFunctions: 'Ueberlange Funktionen',
  importCycles: 'Import-Zyklen',
});

const METRIC_HINTS = Object.freeze({
  blockingGates: 'lassen die CI bei Befunden scheitern',
  notRunGates: 'Werkzeug kam nicht zur Auswertung -- kein gruenes Ergebnis',
});

/**
 * @typedef {object} SourceFile  Eine bereits eingelesene Quelldatei fuer die Funktionslaengen.
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
 * @property {ReadonlyArray<SourceFile>} [sources]  Produktivcode fuer die Funktionslaengen.
 * @property {number} [longFunctionLimit]  Ab wie vielen Zeilen eine Funktion als lang gilt.
 * @property {number} [maxLongFunctions]  Obergrenze der aufgefuehrten langen Funktionen.
 * @property {ReadonlyArray<object>} [cruiserModules]  Modulbericht von dependency-cruiser.
 * @property {ReadonlyArray<{ name: string, prefix: string }>} [layers]  Schichtung fuer Verstoesse.
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
  longFunctionLimit = DEFAULT_LONG_FUNCTION_LINES,
  maxLongFunctions = DEFAULT_MAX_LONG_FUNCTIONS,
  cruiserModules = [],
  layers = DEFAULT_LAYERS,
  issueRefs = [],
  showFile = () => null,
} = {}) {
  const gates = buildGateStates({ workflowJob, runs: gateRuns });
  const coverage = aggregateCoverage(coverageFinal, { rootPath });
  const longFunctions = collectLongFunctions(sources, longFunctionLimit, maxLongFunctions);
  const structure = buildStructureFacts(cruiserModules, layers);
  const { issues: openIssues, unreadable } = collectOpenIssues(issueRefs, showFile);
  const metrics = buildMetrics({ gates, openIssues, longFunctions, structure, longFunctionLimit });

  return {
    title,
    generatedAt,
    assessment: deriveOverallAssessment(gates),
    gates,
    metrics,
    coverage,
    longFunctions,
    structure,
    openIssues,
    unreadableIssues: unreadable,
    branchScope: { scannedRefs: issueRefs.map((ref) => ref.name) },
  };
}

/**
 * Die laengsten Funktionen ueber alle Quelldateien hinweg, absteigend sortiert
 * und auf die Obergrenze gekuerzt.
 *
 * @param {ReadonlyArray<SourceFile>} sources
 * @param {number} limit
 * @param {number} max
 * @returns {import('./functions.js').LongFunction[]}
 */
function collectLongFunctions(sources, limit, max) {
  const all = sources.flatMap(({ path, source }) => findLongFunctions(source, { path, limit }));
  return all.sort((a, b) => b.lineCount - a.lineCount || a.startLine - b.startLine).slice(0, max);
}

/**
 * @param {ReadonlyArray<object>} cruiserModules
 * @param {ReadonlyArray<{ name: string, prefix: string }>} layers
 * @returns {import('./renderReport.js').StructureFacts}
 */
function buildStructureFacts(cruiserModules, layers) {
  const graph = buildImportGraph(cruiserModules);
  return {
    moduleCount: Object.keys(graph).length,
    dependencyCount: countEdges(graph),
    cycles: findCycles(graph),
    layerViolations: findLayerViolations(graph, layers),
  };
}

/** @param {import('./graph.js').ImportGraph} graph */
function countEdges(graph) {
  return Object.values(graph).reduce((sum, targets) => sum + targets.length, 0);
}

/**
 * Die Kennzahlen des Healthchecks: knappe Zahlen, die einen Blick auf den Zustand
 * geben, ohne dass man die Tabellen darunter lesen muss.
 *
 * @param {object} input
 * @param {ReadonlyArray<import('./gates.js').GateState>} input.gates
 * @param {ReadonlyArray<import('./issues.js').OpenIssue>} input.openIssues
 * @param {ReadonlyArray<import('./functions.js').LongFunction>} input.longFunctions
 * @param {import('./renderReport.js').StructureFacts} input.structure
 * @param {number} input.longFunctionLimit
 * @returns {import('./renderReport.js').Metric[]}
 */
function buildMetrics({ gates, openIssues, longFunctions, structure, longFunctionLimit }) {
  const blockingGates = gates.filter((gate) => gate.enforcement === GateEnforcement.Blocking).length;
  const notRunGates = gates.filter((gate) => gate.status === GateStatus.NotRun).length;

  return [
    { label: METRIC_LABELS.openIssues, value: openIssues.length },
    { label: METRIC_LABELS.blockingGates, value: `${blockingGates}/${gates.length}`, hint: METRIC_HINTS.blockingGates },
    withOptionalHint(
      { label: METRIC_LABELS.notRunGates, value: notRunGates },
      notRunGates > 0 ? METRIC_HINTS.notRunGates : undefined,
    ),
    { label: METRIC_LABELS.longFunctions, value: longFunctions.length, hint: `ueber ${longFunctionLimit} Zeilen` },
    { label: METRIC_LABELS.importCycles, value: structure.cycles.length },
  ];
}

/** @param {import('./renderReport.js').Metric} metric @param {string|undefined} hint */
function withOptionalHint(metric, hint) {
  return hint ? { ...metric, hint } : metric;
}

/**
 * Beschriftungen der abgeleiteten Urteils-Fakten -- an einer Stelle, damit sie
 * nicht als Magie im Code liegen.
 */
const VERDICT_FACT_LABELS = Object.freeze({
  blockingPassed: 'Bestandene blockierende Gates',
  warningFindings: 'Nur-Hinweis-Gates mit Befunden',
  notRun: 'Nicht angelaufene Gates',
});

/**
 * Zaehlt die Gates je betrachteter Eigenschaft. Das ist die reine, gemessene
 * Faktenbasis des Gesamturteils -- keine Deutung, nur Abzaehlen der bereits von
 * {@link buildGateStates} klassifizierten Zustaende.
 *
 * @param {ReadonlyArray<import('./gates.js').GateState>} gates
 */
function countGateFacts(gates) {
  const isBlocking = (gate) => gate.enforcement === GateEnforcement.Blocking;
  const isWarning = (gate) => gate.enforcement === GateEnforcement.Warning;
  const hasStatus = (status) => (gate) => gate.status === status;

  return {
    blockingTotal: gates.filter(isBlocking).length,
    blockingPassed: gates.filter((gate) => isBlocking(gate) && hasStatus(GateStatus.Passed)(gate)).length,
    blockingFindings: gates.filter((gate) => isBlocking(gate) && hasStatus(GateStatus.Findings)(gate)).length,
    blockingNotRun: gates.filter((gate) => isBlocking(gate) && hasStatus(GateStatus.NotRun)(gate)).length,
    warningFindings: gates.filter((gate) => isWarning(gate) && hasStatus(GateStatus.Findings)(gate)).length,
    notRunTotal: gates.filter(hasStatus(GateStatus.NotRun)).length,
  };
}

/**
 * Die Kopfzeile des Urteils nennt den schwerwiegendsten gemessenen Zustand der
 * blockierenden Gates zuerst: erst Befunde (die die CI scheitern lassen), dann
 * ein nicht angelaufenes Gate, sonst der gruene Fall.
 *
 * @param {ReturnType<typeof countGateFacts>} facts
 * @returns {string}
 */
function deriveVerdictHeadline(facts) {
  if (facts.blockingTotal === 0) return 'Keine blockierenden Gates erfasst';
  if (facts.blockingFindings > 0) {
    return `${facts.blockingFindings} von ${facts.blockingTotal} blockierenden Gates melden Befunde`;
  }
  if (facts.blockingNotRun > 0) {
    return `${facts.blockingNotRun} von ${facts.blockingTotal} blockierenden Gates sind nicht angelaufen`;
  }
  return `Alle ${facts.blockingTotal} blockierenden Gates bestehen`;
}

/**
 * Erzeugt das Gesamturteil ausschliesslich aus den gemessenen Gate-Zustaenden --
 * eine reine Funktion ohne hand-gepflegten Text, sodass die Anzeige der
 * Gate-Tabelle nie widersprechen kann (ADR 0022: Anzeige leitet sich aus der
 * Quelle ab). Die Kopfzeile nennt den Zustand auf einen Blick, die Fakten sind
 * die nackten Zahlen dahinter.
 *
 * @param {ReadonlyArray<import('./gates.js').GateState>} gates
 * @returns {import('./renderReport.js').OverallAssessment}
 */
export function deriveOverallAssessment(gates) {
  const facts = countGateFacts(gates);
  return {
    headline: deriveVerdictHeadline(facts),
    facts: [
      `${VERDICT_FACT_LABELS.blockingPassed}: ${facts.blockingPassed} von ${facts.blockingTotal}`,
      `${VERDICT_FACT_LABELS.warningFindings}: ${facts.warningFindings}`,
      `${VERDICT_FACT_LABELS.notRun}: ${facts.notRunTotal}`,
    ],
  };
}
