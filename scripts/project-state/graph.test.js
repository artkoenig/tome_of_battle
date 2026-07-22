import { describe, it, expect } from 'vitest';
import { buildImportGraph, findCycles, findLayerViolations, DEFAULT_LAYERS } from './graph.js';

describe('project-state/graph', () => {
  describe('buildImportGraph', () => {
    it('turns the cruiser module report into a sorted, deduplicated adjacency list', () => {
      const cruiserModules = [
        {
          source: 'src/a.js',
          dependencies: [
            { resolved: 'src/c.js' },
            { resolved: 'src/b.js' },
            { resolved: 'src/b.js' },
          ],
        },
      ];
      expect(buildImportGraph(cruiserModules)).toEqual({ 'src/a.js': ['src/b.js', 'src/c.js'] });
    });

    it('drops core modules and imports that could not be resolved', () => {
      const cruiserModules = [
        {
          source: 'src/a.js',
          dependencies: [
            { resolved: 'fs', coreModule: true },
            { resolved: 'missing', couldNotResolve: true },
            { resolved: 'src/b.js' },
            { coreModule: false, couldNotResolve: false },
          ],
        },
      ];
      expect(buildImportGraph(cruiserModules)).toEqual({ 'src/a.js': ['src/b.js'] });
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
      const graph = { 'src/parser/read.js': ['src/components/View.jsx'] };
      const violations = findLayerViolations(graph);
      expect(violations).toEqual([
        {
          from: 'src/parser/read.js',
          to: 'src/components/View.jsx',
          fromLayer: 'parser',
          toLayer: 'components',
        },
      ]);
    });

    it('accepts a higher layer importing a deeper one', () => {
      const graph = { 'src/components/View.jsx': ['src/parser/read.js'] };
      expect(findLayerViolations(graph)).toEqual([]);
    });

    it('ignores imports between modules outside the known layers', () => {
      const graph = { 'scripts/tool.js': ['scripts/helper.js'] };
      expect(findLayerViolations(graph)).toEqual([]);
    });

    it('exposes the default layer order from deep to high', () => {
      expect(DEFAULT_LAYERS.map((layer) => layer.name)).toEqual(['parser', 'solver', 'components']);
    });
  });
});
