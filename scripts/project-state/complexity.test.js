import { describe, it, expect } from 'vitest';
import { findFunctionComplexities, aggregateComplexity, DEFAULT_MAX_COMPLEX_FUNCTIONS } from './complexity.js';

/** Komplexitaet der (einzigen) Funktion im Quelltext. */
function complexityOf(source) {
  const found = findFunctionComplexities(source);
  expect(found).toHaveLength(1);
  return found[0].complexity;
}

describe('project-state/complexity', () => {
  describe('findFunctionComplexities', () => {
    it('gives a branchless function the base complexity of 1', () => {
      expect(complexityOf(['function f() {', '  return 1;', '}'].join('\n'))).toBe(1);
    });

    it('counts each decision-point kind once', () => {
      // if(+1) + for(+1) + while(+1) + case(+1) + catch(+1) + &&(+1) + ||(+1) + ?:(+1) = base 1 + 8 = 9
      const source = [
        'function f(a, b, xs) {',
        '  if (a) {}',
        '  for (const x of xs) {}',
        '  while (b) { break; }',
        '  switch (a) { case 1: break; }',
        '  try { a(); } catch (e) {}',
        '  const g = a && b;',
        '  const h = a || b;',
        '  return a ? 1 : 2;',
        '}',
      ].join('\n');
      expect(complexityOf(source)).toBe(9);
    });

    it('counts for-in and do-while as loops too', () => {
      const source = [
        'function f(obj) {',
        '  for (const k in obj) {}',
        '  do { obj(); } while (false);',
        '}',
      ].join('\n');
      expect(complexityOf(source)).toBe(3); // base 1 + for-in + do-while
    });

    it('attributes a nested function\'s branches to the nested function, not the outer', () => {
      const source = [
        'function outer(a) {',
        '  if (a) {}',
        '  const inner = (b) => {',
        '    if (b) {}',
        '    return b || a;',
        '  };',
        '  return inner;',
        '}',
      ].join('\n');
      const found = findFunctionComplexities(source);
      const outer = found.find((entry) => entry.name === 'outer');
      const inner = found.find((entry) => entry.name === 'inner');
      expect(outer.complexity).toBe(2); // base 1 + own if only
      expect(inner.complexity).toBe(3); // base 1 + if + ||
    });

    it('names an arrow function after its binding and falls back to anonymous', () => {
      const bound = findFunctionComplexities('const compute = (a) => (a ? 1 : 2);');
      expect(bound[0].name).toBe('compute');
      const anon = findFunctionComplexities('register(function (a) { return a && a; });');
      expect(anon[0].name).toBe('(anonym)');
    });

    it('sorts by complexity descending, then by start line', () => {
      const source = [
        'function simple() { return 1; }',
        'function branchy(a, b) { return a && b; }',
      ].join('\n');
      const names = findFunctionComplexities(source).map((entry) => entry.name);
      expect(names).toEqual(['branchy', 'simple']);
    });

    it('tolerates empty or missing source', () => {
      expect(findFunctionComplexities('')).toEqual([]);
      expect(findFunctionComplexities(undefined)).toEqual([]);
    });
  });

  describe('aggregateComplexity', () => {
    const files = [
      { path: 'src/solver/a.js', source: 'function a(x) { return x && x; }' }, // 2
      { path: 'src/solver/b.js', source: 'function b(x) { if (x) {} return x ? 1 : 2; }' }, // 3
      { path: 'src/parser/c.js', source: 'function c() { return 1; }' }, // 1
    ];

    it('aggregates total, average and max complexity per module', () => {
      const { modules } = aggregateComplexity(files);
      const solver = modules.find((entry) => entry.module === 'src/solver');
      expect(solver).toEqual({
        module: 'src/solver',
        functionCount: 2,
        totalComplexity: 5,
        averageComplexity: 2.5,
        maxComplexity: 3,
      });
    });

    it('sorts modules by total complexity descending', () => {
      const names = aggregateComplexity(files).modules.map((entry) => entry.module);
      expect(names).toEqual(['src/solver', 'src/parser']);
    });

    it('lists the most complex functions across all files, capped', () => {
      const { mostComplex } = aggregateComplexity(files, { maxFunctions: 2 });
      expect(mostComplex).toHaveLength(2);
      expect(mostComplex[0]).toMatchObject({ name: 'b', path: 'src/solver/b.js', complexity: 3 });
      expect(mostComplex[1]).toMatchObject({ name: 'a', complexity: 2 });
    });

    it('exposes a sensible default cap and empty result for no files', () => {
      expect(DEFAULT_MAX_COMPLEX_FUNCTIONS).toBeGreaterThan(0);
      expect(aggregateComplexity([])).toEqual({ modules: [], mostComplex: [] });
      expect(aggregateComplexity(undefined)).toEqual({ modules: [], mostComplex: [] });
    });
  });
});
