import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { createSourceFile, isFunctionLike, lineOf, functionName } from './tsSource.js';

/** Erste funktionsartige Deklaration im Quelltext, mit ihrem SourceFile. */
function firstFunction(source, path) {
  const sourceFile = createSourceFile(source, path);
  let found = null;
  const visit = (node) => {
    if (found) return;
    if (isFunctionLike(node)) found = node;
    else ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);
  return { node: found, sourceFile };
}

describe('project-state/tsSource', () => {
  it('parses JS and reports 1-based line numbers', () => {
    const source = ['', 'const x = 1;', 'function f() {}'].join('\n');
    const { node, sourceFile } = firstFunction(source);
    expect(node).not.toBeNull();
    expect(lineOf(sourceFile, node.getStart(sourceFile))).toBe(3);
  });

  it('recognises JSX in .jsx files without throwing', () => {
    const source = 'const App = () => <div className="x">hi</div>;';
    const { node } = firstFunction(source, 'src/App.jsx');
    expect(node).not.toBeNull();
    expect(isFunctionLike(node)).toBe(true);
  });

  it('names a declared function, an arrow by its binding, a constructor, and an anonymous fallback', () => {
    const named = firstFunction('function greet() {}');
    expect(functionName(named.node, named.sourceFile)).toBe('greet');

    const arrow = firstFunction('const compute = () => 1;');
    expect(functionName(arrow.node, arrow.sourceFile)).toBe('compute');

    const ctor = firstFunction('class A { constructor() {} }');
    expect(functionName(ctor.node, ctor.sourceFile)).toBe('constructor');

    const anon = firstFunction('register(function () {});');
    expect(functionName(anon.node, anon.sourceFile)).toBe('(anonym)');
  });

  it('tolerates empty or missing source', () => {
    expect(() => createSourceFile('')).not.toThrow();
    expect(() => createSourceFile(undefined)).not.toThrow();
  });
});
