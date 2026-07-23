import { describe, it, expect } from 'vitest';
import {
  findFunctionComplexities,
  aggregateComplexity,
  categorizeRisk,
  DEFAULT_MAX_COMPLEX_FUNCTIONS,
} from './complexity.js';

describe('project-state/complexity', () => {
  describe('categorizeRisk', () => {
    it('categorizes complexity into ISO 25010 / SIG risk bands', () => {
      expect(categorizeRisk(1)).toBe('low');
      expect(categorizeRisk(5)).toBe('low');
      expect(categorizeRisk(6)).toBe('moderate');
      expect(categorizeRisk(10)).toBe('moderate');
      expect(categorizeRisk(11)).toBe('high');
      expect(categorizeRisk(25)).toBe('high');
      expect(categorizeRisk(26)).toBe('veryHigh');
    });
  });

  describe('findFunctionComplexities', () => {
    it('gives a branchless function the base complexity of 1 and low risk', () => {
      const found = findFunctionComplexities(['function f() {', '  return 1;', '}'].join('\n'));
      expect(found[0]).toMatchObject({
        name: 'f',
        complexity: 1,
        riskCategory: 'low',
        loc: 3,
      });
      expect(found[0].maintainabilityIndex).toBeGreaterThan(50);
    });

    it('counts each decision-point kind once', () => {
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
      const found = findFunctionComplexities(source);
      expect(found[0].complexity).toBe(9);
      expect(found[0].riskCategory).toBe('moderate');
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
      expect(outer.complexity).toBe(2);
      expect(inner.complexity).toBe(3);
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

    it('aggregates total, average, MI and SIG risk profiles per module and overall', () => {
      const { modules, overall } = aggregateComplexity(files);
      const solver = modules.find((entry) => entry.module === 'src/solver');
      expect(solver).toMatchObject({
        module: 'src/solver',
        functionCount: 2,
        totalComplexity: 5,
        averageComplexity: 2.5,
        maxComplexity: 3,
      });
      expect(solver.riskProfile.lowPercent).toBe(100);
      expect(solver.maintainabilityIndex).toBeGreaterThan(0);

      expect(overall.functionCount).toBe(3);
      expect(overall.riskProfile.lowPercent).toBe(100);
      expect(overall.maintainabilityIndex).toBeGreaterThan(0);
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
      const empty = aggregateComplexity([]);
      expect(empty.modules).toEqual([]);
      expect(empty.mostComplex).toEqual([]);
      expect(empty.overall.functionCount).toBe(0);
    });
  });
});
