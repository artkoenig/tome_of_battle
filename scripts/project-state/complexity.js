/**
 * Reine Ermittlung der zyklomatischen Komplexitaet, des Maintainability Index (MI)
 * und der ISO 25010 / SIG Risikoprofile (ohne Dateizugriff, damit sie testbar bleibt).
 * Eingabe ist der Quelltext, Ausgabe die Komplexitaet & Risikoprofile.
 *
 * Der Syntaxbaum, die Funktionserkennung und die Namensregel liegen im geteilten
 * {@link module:project-state/tsSource}; hier bleibt nur das Zaehlen der
 * Verzweigungspunkte und die Risikoprofil-Aggregation.
 *
 * @module project-state/complexity
 */
import ts from 'typescript';

import { createSourceFile, isFunctionLike, lineOf, functionName } from './tsSource.js';
import { moduleFromPath } from './coverage.js';

/** Wie viele der komplexesten Funktionen der Bericht hoechstens auffuehrt. */
export const DEFAULT_MAX_COMPLEX_FUNCTIONS = 15;

/** Grundkomplexitaet einer Funktion ohne jeden Verzweigungspunkt (ein Pfad). */
const BASE_COMPLEXITY = 1;
const COMPLEXITY_DECIMALS = 1;

/**
 * Categorizes cyclomatic complexity V(G) into ISO 25010 / SIG risk bands:
 * - low (1-5)
 * - moderate (6-10)
 * - high (11-25)
 * - veryHigh (>25)
 *
 * @param {number} complexity
 * @returns {'low' | 'moderate' | 'high' | 'veryHigh'}
 */
export function categorizeRisk(complexity) {
  if (complexity <= 5) return 'low';
  if (complexity <= 10) return 'moderate';
  if (complexity <= 25) return 'high';
  return 'veryHigh';
}

/**
 * @typedef {object} FunctionComplexity
 * @property {string} name
 * @property {string} path
 * @property {number} startLine   1-basiert
 * @property {number} endLine     1-basiert
 * @property {number} loc         Zeilenanzahl der Funktion
 * @property {number} complexity  zyklomatische Komplexitaet (>= 1)
 * @property {'low' | 'moderate' | 'high' | 'veryHigh'} riskCategory
 * @property {number} maintainabilityIndex normiert auf 0..100
 */

/**
 * @typedef {object} RiskProfile
 * @property {number} lowLoc
 * @property {number} moderateLoc
 * @property {number} highLoc
 * @property {number} veryHighLoc
 * @property {number} lowPercent
 * @property {number} moderatePercent
 * @property {number} highPercent
 * @property {number} veryHighPercent
 */

/**
 * @typedef {object} ModuleComplexity
 * @property {string} module
 * @property {number} functionCount
 * @property {number} totalLoc
 * @property {number} totalComplexity
 * @property {number} averageComplexity  auf eine Nachkommastelle gerundet
 * @property {number} maxComplexity
 * @property {number} maintainabilityIndex
 * @property {RiskProfile} riskProfile
 */

/**
 * Findet je Funktion im Quelltext ihre zyklomatische Komplexitaet, LOC & MI.
 *
 * @param {string} source
 * @param {{ path?: string }} [options]
 * @returns {FunctionComplexity[]}  absteigend nach Komplexitaet, bei Gleichstand nach Startzeile
 */
export function findFunctionComplexities(source, { path = '' } = {}) {
  if (!source) return [];

  const sourceFile = createSourceFile(source, path);
  /** @type {FunctionComplexity[]} */
  const found = [];

  const visit = (node) => {
    if (isFunctionLike(node)) {
      const startLine = lineOf(sourceFile, node.getStart(sourceFile));
      const endLine = lineOf(sourceFile, node.getEnd());
      const loc = Math.max(1, endLine - startLine + 1);
      const complexity = BASE_COMPLEXITY + countDecisionPoints(node);
      const riskCategory = categorizeRisk(complexity);
      const maintainabilityIndex = calculateMI(node, sourceFile, complexity, loc);

      found.push({
        name: functionName(node, sourceFile),
        path,
        startLine,
        endLine,
        loc,
        complexity,
        riskCategory,
        maintainabilityIndex,
      });
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);

  return found.sort((a, b) => b.complexity - a.complexity || a.startLine - b.startLine);
}

/**
 * Verdichtet den Produktivcode zu Komplexitaet je Modul, System-Gesamtrisikoprofil
 * und der Liste der komplexesten Funktionen ueber alle Dateien.
 *
 * @param {ReadonlyArray<{ path: string, source: string }>} files
 * @param {{ maxFunctions?: number }} [options]
 * @returns {{ modules: ModuleComplexity[], overall: { maintainabilityIndex: number, riskProfile: RiskProfile, functionCount: number, totalLoc: number, averageComplexity: number, maxComplexity: number }, mostComplex: FunctionComplexity[] }}
 */
export function aggregateComplexity(files, { maxFunctions = DEFAULT_MAX_COMPLEX_FUNCTIONS } = {}) {
  /** @type {Map<string, { functionCount: number, totalLoc: number, totalComplexity: number, maxComplexity: number, sumMI: number, riskLoc: Record<string, number> }>} */
  const byModule = new Map();
  /** @type {FunctionComplexity[]} */
  const all = [];

  const globalRiskLoc = { low: 0, moderate: 0, high: 0, veryHigh: 0 };
  let globalTotalLoc = 0;
  let globalTotalComplexity = 0;
  let globalMaxComplexity = 0;
  let globalSumMI = 0;

  for (const { path, source } of files ?? []) {
    const module = moduleFromPath(path);
    const bucket = byModule.get(module) ?? {
      functionCount: 0,
      totalLoc: 0,
      totalComplexity: 0,
      maxComplexity: 0,
      sumMI: 0,
      riskLoc: { low: 0, moderate: 0, high: 0, veryHigh: 0 },
    };

    for (const fn of findFunctionComplexities(source, { path })) {
      bucket.functionCount += 1;
      bucket.totalLoc += fn.loc;
      bucket.totalComplexity += fn.complexity;
      bucket.maxComplexity = Math.max(bucket.maxComplexity, fn.complexity);
      bucket.sumMI += fn.maintainabilityIndex;
      bucket.riskLoc[fn.riskCategory] += fn.loc;

      globalTotalLoc += fn.loc;
      globalTotalComplexity += fn.complexity;
      globalMaxComplexity = Math.max(globalMaxComplexity, fn.complexity);
      globalSumMI += fn.maintainabilityIndex;
      globalRiskLoc[fn.riskCategory] += fn.loc;

      all.push(fn);
    }
    byModule.set(module, bucket);
  }

  const modules = [...byModule.entries()]
    .map(([module, bucket]) => ({
      module,
      functionCount: bucket.functionCount,
      totalLoc: bucket.totalLoc,
      totalComplexity: bucket.totalComplexity,
      averageComplexity: averageOf(bucket.totalComplexity, bucket.functionCount),
      maxComplexity: bucket.maxComplexity,
      maintainabilityIndex: bucket.functionCount > 0 ? Math.round(bucket.sumMI / bucket.functionCount) : 100,
      riskProfile: computeRiskProfile(bucket.riskLoc, bucket.totalLoc),
    }))
    .sort((a, b) => b.totalComplexity - a.totalComplexity || a.module.localeCompare(b.module));

  const mostComplex = all
    .sort((a, b) => b.complexity - a.complexity || a.startLine - b.startLine)
    .slice(0, maxFunctions);

  const overall = {
    functionCount: all.length,
    totalLoc: globalTotalLoc,
    totalComplexity: globalTotalComplexity,
    averageComplexity: averageOf(globalTotalComplexity, all.length),
    maxComplexity: globalMaxComplexity,
    maintainabilityIndex: all.length > 0 ? Math.round(globalSumMI / all.length) : 100,
    riskProfile: computeRiskProfile(globalRiskLoc, globalTotalLoc),
  };

  return { modules, overall, mostComplex };
}

function computeRiskProfile(riskLocMap, totalLoc) {
  if (totalLoc === 0) {
    return { lowLoc: 0, moderateLoc: 0, highLoc: 0, veryHighLoc: 0, lowPercent: 100, moderatePercent: 0, highPercent: 0, veryHighPercent: 0 };
  }

  const lowPercent = Number(((riskLocMap.low / totalLoc) * 100).toFixed(1));
  const moderatePercent = Number(((riskLocMap.moderate / totalLoc) * 100).toFixed(1));
  const highPercent = Number(((riskLocMap.high / totalLoc) * 100).toFixed(1));
  const veryHighPercent = Number(((riskLocMap.veryHigh / totalLoc) * 100).toFixed(1));

  return {
    lowLoc: riskLocMap.low,
    moderateLoc: riskLocMap.moderate,
    highLoc: riskLocMap.high,
    veryHighLoc: riskLocMap.veryHigh,
    lowPercent,
    moderatePercent,
    highPercent,
    veryHighPercent,
  };
}

/** Durchschnitt auf eine Nachkommastelle; ohne Funktionen per Definition 0. */
function averageOf(total, count) {
  if (count === 0) return 0;
  return Number((total / count).toFixed(COMPLEXITY_DECIMALS));
}

/**
 * Standard SEI Maintainability Index formula (normiert auf 0..100)
 */
function calculateMI(functionNode, sourceFile, complexity, loc) {
  const { operators, operands } = countHalstead(functionNode, sourceFile);
  const n1 = operators.total;
  const n2 = operands.total;
  const eta1 = operators.unique.size;
  const eta2 = operands.unique.size;

  const N = n1 + n2;
  const eta = eta1 + eta2;

  const volume = N > 0 && eta > 1 ? N * Math.log2(eta) : 1;
  const rawMI = 171 - 5.2 * Math.log(Math.max(1, volume)) - 0.23 * complexity - 16.2 * Math.log(Math.max(1, loc));

  return Math.max(0, Math.min(100, Math.round((rawMI * 100) / 171)));
}

function countHalstead(functionNode, sourceFile) {
  const operators = { total: 0, unique: new Set() };
  const operands = { total: 0, unique: new Set() };

  const walk = (node) => {
    if (isFunctionLike(node) && node !== functionNode) return;

    if (ts.isIdentifier(node)) {
      operands.total += 1;
      operands.unique.add(node.getText(sourceFile));
    } else if (ts.isStringLiteral(node) || ts.isNumericLiteral(node) || node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword) {
      operands.total += 1;
      operands.unique.add(node.getText(sourceFile));
    } else if (ts.isToken(node)) {
      operators.total += 1;
      operators.unique.add(ts.SyntaxKind[node.kind]);
    }

    ts.forEachChild(node, walk);
  };

  walk(functionNode);
  return { operators, operands };
}

/**
 * Zaehlt die Verzweigungspunkte innerhalb einer Funktion, ohne in verschachtelte
 * Funktionen abzusteigen -- deren Verzweigungspunkte gehoeren zu ihnen selbst.
 *
 * @param {ts.Node} functionNode
 * @returns {number}
 */
function countDecisionPoints(functionNode) {
  let count = 0;
  const walk = (node) => {
    if (isDecisionPoint(node)) count += 1;
    ts.forEachChild(node, (child) => {
      if (isFunctionLike(child)) return; // gehoert zur verschachtelten Funktion
      walk(child);
    });
  };
  ts.forEachChild(functionNode, (child) => {
    if (isFunctionLike(child)) return;
    walk(child);
  });
  return count;
}

function isDecisionPoint(node) {
  return (
    ts.isIfStatement(node) ||
    ts.isForStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isWhileStatement(node) ||
    ts.isDoStatement(node) ||
    ts.isCaseClause(node) ||
    ts.isCatchClause(node) ||
    ts.isConditionalExpression(node) ||
    isLogicalAndOr(node)
  );
}

function isLogicalAndOr(node) {
  return (
    ts.isBinaryExpression(node) &&
    (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
      node.operatorToken.kind === ts.SyntaxKind.BarBarToken)
  );
}
