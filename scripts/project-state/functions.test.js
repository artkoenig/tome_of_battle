import { describe, it, expect } from 'vitest';
import { findLongFunctions, DEFAULT_LONG_FUNCTION_LINES } from './functions.js';

describe('project-state/functions', () => {
  const LIMIT = 3;

  it('reports a function that exceeds the limit and ignores a short one', () => {
    const source = [
      'function short() { return 1; }',
      'function long() {',
      '  const a = 1;',
      '  const b = 2;',
      '  const c = 3;',
      '  return a + b + c;',
      '}',
    ].join('\n');

    const found = findLongFunctions(source, { limit: LIMIT });
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ name: 'long', startLine: 2, endLine: 7, lineCount: 6 });
  });

  it('does not report a function whose length equals the limit (strictly greater only)', () => {
    const source = ['function exact() {', '  const a = 1;', '}'].join('\n');
    expect(findLongFunctions(source, { limit: LIMIT })).toEqual([]);
  });

  it('reports nested functions individually, and the outer length includes the inner', () => {
    const source = [
      'function outer() {',
      '  function inner() {',
      '    const a = 1;',
      '    const b = 2;',
      '    return a + b;',
      '  }',
      '  return inner();',
      '}',
    ].join('\n');

    const found = findLongFunctions(source, { limit: LIMIT });
    const names = found.map((entry) => entry.name);
    expect(names).toContain('outer');
    expect(names).toContain('inner');

    const outer = found.find((entry) => entry.name === 'outer');
    const inner = found.find((entry) => entry.name === 'inner');
    expect(outer.lineCount).toBeGreaterThan(inner.lineCount);
  });

  it('names an arrow function after the binding it is assigned to', () => {
    const source = [
      'const compute = () => {',
      '  const a = 1;',
      '  const b = 2;',
      '  const c = 3;',
      '  return a + b + c;',
      '};',
    ].join('\n');

    const found = findLongFunctions(source, { limit: LIMIT });
    expect(found).toHaveLength(1);
    expect(found[0].name).toBe('compute');
  });

  it('falls back to an anonymous marker for an unbound function expression', () => {
    const source = [
      'register(function () {',
      '  const a = 1;',
      '  const b = 2;',
      '  const c = 3;',
      '});',
    ].join('\n');

    const found = findLongFunctions(source, { limit: LIMIT });
    expect(found).toHaveLength(1);
    expect(found[0].name).toBe('(anonym)');
  });

  it('sorts findings by length descending, then by start line', () => {
    const source = [
      'function big() {',
      '  const a = 1;',
      '  const b = 2;',
      '  const c = 3;',
      '  const d = 4;',
      '  return a + b + c + d;',
      '}',
      'function small() {',
      '  const a = 1;',
      '  const b = 2;',
      '  return a + b;',
      '}',
    ].join('\n');

    const names = findLongFunctions(source, { limit: LIMIT }).map((entry) => entry.name);
    expect(names).toEqual(['big', 'small']);
  });

  it('threads the file path into every finding', () => {
    const source = ['function long() {', '  const a = 1;', '  const b = 2;', '  return a;', '}'].join('\n');
    const found = findLongFunctions(source, { path: 'src/solver/points.js', limit: LIMIT });
    expect(found[0].path).toBe('src/solver/points.js');
  });

  it('exposes a sensible default limit and uses it when none is given', () => {
    expect(DEFAULT_LONG_FUNCTION_LINES).toBeGreaterThan(0);
    const shortSource = ['function tiny() {', '  return 1;', '}'].join('\n');
    expect(findLongFunctions(shortSource)).toEqual([]);
  });

  it('tolerates empty or missing source', () => {
    expect(findLongFunctions('')).toEqual([]);
    expect(findLongFunctions(undefined)).toEqual([]);
  });
});
