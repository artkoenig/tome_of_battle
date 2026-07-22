import { describe, it, expect } from 'vitest';
import { countCodeLines, aggregateLoc } from './loc.js';

describe('project-state/loc', () => {
  describe('countCodeLines', () => {
    it('counts non-empty lines and ignores blank ones', () => {
      const source = ['const a = 1;', '', '   ', 'const b = 2;'].join('\n');
      expect(countCodeLines(source)).toBe(2);
    });

    it('counts a comment line -- comments are not stripped', () => {
      const source = ['// a note', 'const a = 1;'].join('\n');
      expect(countCodeLines(source)).toBe(2);
    });

    it('tolerates empty or missing source', () => {
      expect(countCodeLines('')).toBe(0);
      expect(countCodeLines(undefined)).toBe(0);
    });
  });

  describe('aggregateLoc', () => {
    it('sums lines per module (directory) and overall', () => {
      const files = [
        { path: 'src/solver/points.js', source: 'a\nb\nc' },
        { path: 'src/solver/facade.js', source: 'a\nb' },
        { path: 'src/parser/xml.js', source: 'a' },
      ];
      const { modules, totalLines } = aggregateLoc(files);

      expect(totalLines).toBe(6);
      expect(modules).toEqual([
        { module: 'src/solver', fileCount: 2, lines: 5 },
        { module: 'src/parser', fileCount: 1, lines: 1 },
      ]);
    });

    it('sorts modules by lines descending, then by name', () => {
      const files = [
        { path: 'src/b/one.js', source: 'a\nb' },
        { path: 'src/a/one.js', source: 'a\nb' },
        { path: 'src/c/one.js', source: 'a\nb\nc' },
      ];
      const names = aggregateLoc(files).modules.map((entry) => entry.module);
      expect(names).toEqual(['src/c', 'src/a', 'src/b']);
    });

    it('returns an empty result for no files', () => {
      expect(aggregateLoc([])).toEqual({ modules: [], totalLines: 0 });
      expect(aggregateLoc(undefined)).toEqual({ modules: [], totalLines: 0 });
    });
  });
});
