/**
 * Geteilte TypeScript-Syntaxbaum-Bausteine fuer die quelltext-analysierenden
 * Berichtsmodule ({@link module:project-state/functions} misst Funktionslaengen,
 * {@link module:project-state/complexity} die zyklomatische Komplexitaet). Beide
 * bauen denselben Syntaxbaum auf, erkennen dieselben Funktionsformen und benennen
 * anonyme Funktionen nach derselben Regel -- dieser Baustein haelt das an einer
 * Stelle, statt es je Modul zu wiederholen.
 *
 * Gemessen wird bewusst ueber den Syntaxbaum des TypeScript-Compilers statt ueber
 * Textsuche: Schluesselwoerter in Zeichenketten, regulaeren Ausdruecken oder
 * Kommentaren machen jede textuelle Zaehlung falsch, und `tsc` laeuft in diesem
 * Projekt ohnehin als Typecheck-Gate.
 *
 * @module project-state/tsSource
 */
import ts from 'typescript';

const JSX_EXTENSIONS = ['.jsx', '.tsx'];
const FALLBACK_FILE_NAME = 'source.js';
const ANONYMOUS_FUNCTION_NAME = '(anonym)';

/**
 * Baut den Syntaxbaum eines Quelltexts. Die Dateiendung entscheidet ueber die
 * JSX-Behandlung; ein leerer Pfad faellt auf einen neutralen Namen zurueck.
 *
 * @param {string} source
 * @param {string} [path]
 * @returns {ts.SourceFile}
 */
export function createSourceFile(source, path = '') {
  return ts.createSourceFile(
    path || FALLBACK_FILE_NAME,
    source ?? '',
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    scriptKindFor(path),
  );
}

/** Ob ein Knoten eine der erkannten Funktionsformen ist. */
export function isFunctionLike(node) {
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

/** 1-basierte Zeilennummer einer Position im Quelltext. */
export function lineOf(sourceFile, position) {
  return sourceFile.getLineAndCharacterOfPosition(position).line + 1;
}

/**
 * Name einer Funktion. Anonyme Funktionsausdruecke und Pfeilfunktionen tragen den
 * Namen dessen, woran sie gebunden sind -- sonst waeren gerade die im modernen
 * JavaScript ueblichen Formen alle namenlos.
 *
 * `node` bleibt bewusst untypisiert: der Zugriff auf `node.name`/`node.parent`
 * gilt nur fuer die Deklarationsformen, die `ts.Node` in der Basis nicht kennt.
 *
 * @param {ts.SourceFile} sourceFile
 * @returns {string}
 */
export function functionName(node, sourceFile) {
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

function scriptKindFor(path) {
  return JSX_EXTENSIONS.some((extension) => path.endsWith(extension)) ? ts.ScriptKind.JSX : ts.ScriptKind.JS;
}
