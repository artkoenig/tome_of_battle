/**
 * Reine Ermittlung ueberlanger Funktionen (ohne Dateizugriff, damit sie testbar
 * bleibt). Eingabe ist der Quelltext einer Datei, Ausgabe die Funktionen, die
 * einen Grenzwert an Zeilen ueberschreiten.
 *
 * Gemessen wird ueber den Syntaxbaum des bereits vorhandenen TypeScript-Compilers
 * statt ueber Klammernzaehlen: Klammern in Zeichenketten, regulaeren Ausdruecken
 * oder Kommentaren machen jede textuelle Zaehlung falsch, und `tsc` laeuft in
 * diesem Projekt ohnehin als Typecheck-Gate.
 *
 * Verschachtelte Funktionen werden einzeln gemeldet; die Laenge der aeusseren
 * schliesst die inneren mit ein, so wie ein Leser sie auch am Stueck vor sich
 * hat.
 */
import ts from 'typescript';

/** Ab wie vielen Zeilen eine Funktion als ueberlang gilt. */
export const DEFAULT_LONG_FUNCTION_LINES = 50;

const JSX_EXTENSIONS = ['.jsx', '.tsx'];
const FALLBACK_FILE_NAME = 'source.js';
const ANONYMOUS_FUNCTION_NAME = '(anonym)';

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
  const sourceFile = ts.createSourceFile(
    path || FALLBACK_FILE_NAME,
    source ?? '',
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    scriptKindFor(path),
  );

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

function scriptKindFor(path) {
  return JSX_EXTENSIONS.some((extension) => path.endsWith(extension)) ? ts.ScriptKind.JSX : ts.ScriptKind.JS;
}

function isFunctionLike(node) {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)
  );
}

/** @returns {LongFunction} */
function measureFunction(node, sourceFile, path) {
  const startLine = lineOf(sourceFile, node.getStart(sourceFile));
  const endLine = lineOf(sourceFile, node.end);
  return {
    name: nameOf(node, sourceFile),
    path,
    startLine,
    endLine,
    lineCount: endLine - startLine + 1,
  };
}

function lineOf(sourceFile, position) {
  return sourceFile.getLineAndCharacterOfPosition(position).line + 1;
}

/**
 * Name einer Funktion. Anonyme Funktionsausdruecke und Pfeilfunktionen tragen
 * den Namen dessen, woran sie gebunden sind -- sonst waeren gerade die im
 * modernen JavaScript ueblichen Formen alle namenlos.
 */
function nameOf(node, sourceFile) {
  if (ts.isConstructorDeclaration(node)) return 'constructor';
  if (node.name) return node.name.getText(sourceFile);

  const parent = node.parent;
  const boundName =
    parent &&
    (ts.isVariableDeclaration(parent) ||
      ts.isPropertyAssignment(parent) ||
      ts.isPropertyDeclaration(parent) ||
      ts.isBindingElement(parent))
      ? parent.name
      : null;

  return boundName ? boundName.getText(sourceFile) : ANONYMOUS_FUNCTION_NAME;
}
