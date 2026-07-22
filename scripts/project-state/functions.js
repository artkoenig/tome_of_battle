/**
 * Reine Ermittlung ueberlanger Funktionen (ohne Dateizugriff, damit sie testbar
 * bleibt). Eingabe ist der Quelltext einer Datei, Ausgabe die Funktionen, die
 * einen Grenzwert an Zeilen ueberschreiten.
 *
 * Der Syntaxbaum, die Funktionserkennung und die Namensregel liegen im geteilten
 * {@link module:project-state/tsSource}; hier bleibt nur das Messen der Laenge.
 *
 * Verschachtelte Funktionen werden einzeln gemeldet; die Laenge der aeusseren
 * schliesst die inneren mit ein, so wie ein Leser sie auch am Stueck vor sich hat.
 *
 * @module project-state/functions
 */
import ts from 'typescript';

import { createSourceFile, isFunctionLike, lineOf, functionName } from './tsSource.js';

/** Ab wie vielen Zeilen eine Funktion als ueberlang gilt. */
export const DEFAULT_LONG_FUNCTION_LINES = 50;

/**
 * @typedef {object} LongFunction
 * @property {string} name
 * @property {string} path
 * @property {number} startLine  1-basiert
 * @property {number} endLine    1-basiert
 * @property {number} lineCount
 */

/**
 * Findet alle Funktionen im Quelltext, die den Grenzwert ueberschreiten.
 *
 * @param {string} source
 * @param {{ path?: string, limit?: number }} [options]
 * @returns {LongFunction[]}  absteigend nach Laenge, bei Gleichstand nach Startzeile
 */
export function findLongFunctions(source, { path = '', limit = DEFAULT_LONG_FUNCTION_LINES } = {}) {
  const sourceFile = createSourceFile(source, path);

  /** @type {LongFunction[]} */
  const found = [];

  const visit = (node) => {
    if (isFunctionLike(node)) {
      const measured = measureFunction(node, sourceFile, path);
      if (measured.lineCount > limit) found.push(measured);
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);

  return found.sort((a, b) => b.lineCount - a.lineCount || a.startLine - b.startLine);
}

/** @returns {LongFunction} */
function measureFunction(node, sourceFile, path) {
  const startLine = lineOf(sourceFile, node.getStart(sourceFile));
  const endLine = lineOf(sourceFile, node.end);
  return {
    name: functionName(node, sourceFile),
    path,
    startLine,
    endLine,
    lineCount: endLine - startLine + 1,
  };
}
