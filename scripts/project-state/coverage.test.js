import { describe, it, expect } from 'vitest';
import { aggregateCoverage, moduleFromPath } from './coverage.js';

describe('project-state/coverage', () => {
  describe('moduleFromPath', () => {
    it('returns the directory of a file relative to the project root', () => {
      expect(moduleFromPath('/repo/src/solver/points.js', '/repo')).toBe('src/solver');
    });

    it('marks a file at the root with "."', () => {
      expect(moduleFromPath('/repo/index.js', '/repo')).toBe('.');
    });

    it('normalizes backslash separators', () => {
      expect(moduleFromPath('C:\\repo\\src\\parser\\read.js', 'C:/repo')).toBe('src/parser');
    });
  });

  describe('aggregateCoverage', () => {
    it('groups files by their directory and sums the hit counts per module', () => {
      const coverageFinal = {
        '/repo/src/solver/a.js': {
          s: { 0: 1, 1: 0 },
          b: {},
          f: { 0: 2 },
        },
        '/repo/src/solver/b.js': {
          s: { 0: 3 },
          b: {},
          f: { 0: 0 },
        },
      };

      const [solver] = aggregateCoverage(coverageFinal, { rootPath: '/repo' });
      expect(solver.module).toBe('src/solver');
      expect(solver.fileCount).toBe(2);
      expect(solver.statements).toEqual({ covered: 2, total: 3, percent: 66.7 });
      expect(solver.functions).toEqual({ covered: 1, total: 2, percent: 50 });
    });

    it('flattens per-branch hit arrays before counting', () => {
      const coverageFinal = {
        '/repo/src/parser/x.js': {
          s: {},
          b: { 0: [1, 0], 1: [1, 1] },
          f: {},
        },
      };

      const [parser] = aggregateCoverage(coverageFinal, { rootPath: '/repo' });
      expect(parser.branches).toEqual({ covered: 3, total: 4, percent: 75 });
    });

    it('reports full coverage for a metric with no measurable entries (no 0/0 division)', () => {
      const coverageFinal = {
        '/repo/src/parser/empty.js': { s: {}, b: {}, f: {} },
      };

      const [parser] = aggregateCoverage(coverageFinal, { rootPath: '/repo' });
      expect(parser.statements).toEqual({ covered: 0, total: 0, percent: 100 });
      expect(parser.branches.percent).toBe(100);
      expect(parser.functions.percent).toBe(100);
    });

    it('sorts modules by name', () => {
      const coverageFinal = {
        '/repo/src/solver/a.js': { s: { 0: 1 }, b: {}, f: {} },
        '/repo/src/parser/a.js': { s: { 0: 1 }, b: {}, f: {} },
        '/repo/src/components/a.js': { s: { 0: 1 }, b: {}, f: {} },
      };

      const modules = aggregateCoverage(coverageFinal, { rootPath: '/repo' }).map((entry) => entry.module);
      expect(modules).toEqual(['src/components', 'src/parser', 'src/solver']);
    });

    it('returns an empty list for empty or missing input', () => {
      expect(aggregateCoverage({})).toEqual([]);
      expect(aggregateCoverage(undefined)).toEqual([]);
    });
  });
});
