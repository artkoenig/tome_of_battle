import { describe, it, expect } from 'vitest';
import {
  buildImportGraph,
  findCycles,
  findLayerViolations,
  parseCastGraphPath,
  DEFAULT_LAYERS,
} from './graph.js';

describe('project-state/graph', () => {
  describe('parseCastGraphPath', () => {
    it('cuts the path out of the report line cast scan actually prints', () => {
      expect(parseCastGraphPath('554 modules scanned into /tmp/cast/wt-head-6a58/graph.json\n')).toBe(
        '/tmp/cast/wt-head-6a58/graph.json',
      );
    });

    it('takes the last line that yields a path, ignoring progress lines before it', () => {
      const stdout = 'scanning javascript\n12 modules scanned into /tmp/cast/a/graph.json\n';
      expect(parseCastGraphPath(stdout)).toBe('/tmp/cast/a/graph.json');
    });

    it('accepts a bare path as well, so a terser output format keeps the graph', () => {
      expect(parseCastGraphPath('  /tmp/cast/a/graph.json  ')).toBe('/tmp/cast/a/graph.json');
    });

    it('yields no path when the output holds none', () => {
      expect(parseCastGraphPath('nothing to scan')).toBe('');
      expect(parseCastGraphPath('')).toBe('');
    });
  });

  describe('buildImportGraph', () => {
    it('turns the cast modules into a sorted, deduplicated adjacency list', () => {
      const castModules = [
        {
          id: 'src/a.js',
          edges: [
            { to: 'src/c.js', resolution: 'module' },
            { to: 'src/b.js', resolution: 'module' },
            { to: 'src/b.js', resolution: 'module' },
          ],
        },
      ];
      expect(buildImportGraph(castModules)).toEqual({ 'src/a.js': ['src/b.js', 'src/c.js'] });
    });

    it('drops external packages, unresolved and opaque imports', () => {
      const castModules = [
        {
          id: 'src/a.js',
          edges: [
            { target: 'node:fs', to: null, resolution: 'external' },
            { target: './missing.js', to: null, resolution: 'unresolved' },
            { target: 'path.join(dir, name)', to: null, resolution: 'opaque' },
            { to: 'src/b.js', resolution: 'module' },
          ],
        },
      ];
      expect(buildImportGraph(castModules)).toEqual({ 'src/a.js': ['src/b.js'] });
    });

    it('tolerates missing input', () => {
      expect(buildImportGraph(undefined)).toEqual({});
    });
  });

  describe('findCycles', () => {
    it('finds no cycle in an acyclic graph', () => {
      const graph = { 'a.js': ['b.js'], 'b.js': ['c.js'], 'c.js': [] };
      expect(findCycles(graph)).toEqual([]);
    });

    it('detects a two-module cycle', () => {
      const graph = { 'a.js': ['b.js'], 'b.js': ['a.js'] };
      expect(findCycles(graph)).toEqual([['a.js', 'b.js']]);
    });

    it('detects a self-import as a cycle', () => {
      const graph = { 'a.js': ['a.js'] };
      expect(findCycles(graph)).toEqual([['a.js']]);
    });

    it('detects a larger strongly connected component', () => {
      const graph = {
        'a.js': ['b.js'],
        'b.js': ['c.js'],
        'c.js': ['a.js'],
        'd.js': ['c.js'],
      };
      expect(findCycles(graph)).toEqual([['a.js', 'b.js', 'c.js']]);
    });

    it('returns the members of each cycle sorted, and the cycles sorted among each other', () => {
      const graph = {
        'x.js': ['y.js'],
        'y.js': ['x.js'],
        'a.js': ['b.js'],
        'b.js': ['a.js'],
      };
      expect(findCycles(graph)).toEqual([
        ['a.js', 'b.js'],
        ['x.js', 'y.js'],
      ]);
    });

    it('tolerates an empty or missing graph', () => {
      expect(findCycles({})).toEqual([]);
      expect(findCycles(undefined)).toEqual([]);
    });
  });

  describe('findLayerViolations', () => {
    it('flags a deeper layer importing a higher one', () => {
      const graph = { 'src/data/parser/read.js': ['src/ui/components/View.jsx'] };
      const violations = findLayerViolations(graph);
      expect(violations).toEqual([
        {
          from: 'src/data/parser/read.js',
          to: 'src/ui/components/View.jsx',
          fromLayer: 'parser',
          toLayer: 'components',
        },
      ]);
    });

    it('accepts a higher layer importing a deeper one', () => {
      const graph = { 'src/ui/components/View.jsx': ['src/data/parser/read.js'] };
      expect(findLayerViolations(graph)).toEqual([]);
    });

    it('ignores imports between modules outside the known layers', () => {
      const graph = { 'scripts/tool.js': ['scripts/helper.js'] };
      expect(findLayerViolations(graph)).toEqual([]);
    });

    it('exposes the default layer order from deep to high', () => {
      expect(DEFAULT_LAYERS.map((layer) => layer.name)).toEqual(['parser', 'roster', 'components']);
    });
  });
});
