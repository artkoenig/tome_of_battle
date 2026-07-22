/**
 * Reine Ermittlung der zyklomatischen Komplexitaet (ohne Dateizugriff, damit sie
 * testbar bleibt). Eingabe ist der Quelltext, Ausgabe die Komplexitaet je Funktion.
 *
 * Der Syntaxbaum, die Funktionserkennung und die Namensregel liegen im geteilten
 * {@link module:project-state/tsSource}; hier bleibt nur das Zaehlen der
 * Verzweigungspunkte.
 *
 * Zyklomatische Komplexitaet (McCabe) = 1 + Zahl der Verzweigungspunkte einer
 * Funktion: `if`, `for`/`for-in`/`for-of`, `while`/`do-while`, `case`, `catch`,
 * `&&`, `||`, `?:`. Anders als bei den Funktionslaengen zaehlt eine verschachtelte
 * Funktion ihre eigenen Verzweigungspunkte selbst; die aeussere Funktion zaehlt
 * sie nicht mit -- so summiert sich die Modul-Komplexitaet nicht doppelt.
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
 * @typedef {object} FunctionComplexity
 * @property {string} name
 * @property {string} path
 * @property {number} startLine   1-basiert
 * @property {number} complexity  zyklomatische Komplexitaet (>= 1)
 */

/**
 * @typedef {object} ModuleComplexity
 * @property {string} module
 * @property {number} functionCount
 * @property {number} totalComplexity
 * @property {number} averageComplexity  auf eine Nachkommastelle gerundet
 * @property {number} maxComplexity
 */

/**
 * Findet je Funktion im Quelltext ihre zyklomatische Komplexitaet.
 *
 * @param {string} source
 * @param {{ path?: string }} [options]
 * @returns {FunctionComplexity[]}  absteigend nach Komplexitaet, bei Gleichstand nach Startzeile
 */
export function findFunctionComplexities(source, { path = '' } = {}) {
  const sourceFile = createSourceFile(source, path);

  /** @type {FunctionComplexity[]} */
  const found = [];

  const visit = (node) => {
    if (isFunctionLike(node)) {
      found.push({
        name: functionName(node, sourceFile),
        path,
        startLine: lineOf(sourceFile, node.getStart(sourceFile)),
        complexity: BASE_COMPLEXITY + countDecisionPoints(node),
      });
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);

  return found.sort((a, b) => b.complexity - a.complexity || a.startLine - b.startLine);
}

/**
 * Verdichtet den Produktivcode zu Komplexitaet je Modul und der Liste der
 * komplexesten Funktionen ueber alle Dateien.
 *
 * @param {ReadonlyArray<{ path: string, source: string }>} files
 * @param {{ maxFunctions?: number }} [options]
 * @returns {{ modules: ModuleComplexity[], mostComplex: FunctionComplexity[] }}
 */
export function aggregateComplexity(files, { maxFunctions = DEFAULT_MAX_COMPLEX_FUNCTIONS } = {}) {
  /** @type {Map<string, { functionCount: number, totalComplexity: number, maxComplexity: number }>} */
  const byModule = new Map();
  /** @type {FunctionComplexity[]} */
  const all = [];

  for (const { path, source } of files ?? []) {
    const module = moduleFromPath(path);
    const bucket = byModule.get(module) ?? { functionCount: 0, totalComplexity: 0, maxComplexity: 0 };
    for (const fn of findFunctionComplexities(source, { path })) {
      bucket.functionCount += 1;
      bucket.totalComplexity += fn.complexity;
      bucket.maxComplexity = Math.max(bucket.maxComplexity, fn.complexity);
      all.push(fn);
    }
    byModule.set(module, bucket);
  }

  const modules = [...byModule.entries()]
    .map(([module, bucket]) => ({
      module,
      functionCount: bucket.functionCount,
      totalComplexity: bucket.totalComplexity,
      averageComplexity: averageOf(bucket.totalComplexity, bucket.functionCount),
      maxComplexity: bucket.maxComplexity,
    }))
    .sort((a, b) => b.totalComplexity - a.totalComplexity || a.module.localeCompare(b.module));

  const mostComplex = all
    .sort((a, b) => b.complexity - a.complexity || a.startLine - b.startLine)
    .slice(0, maxFunctions);

  return { modules, mostComplex };
}

/** Durchschnitt auf eine Nachkommastelle; ohne Funktionen per Definition 0. */
function averageOf(total, count) {
  if (count === 0) return 0;
  return Number((total / count).toFixed(COMPLEXITY_DECIMALS));
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
