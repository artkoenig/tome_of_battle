import { describe, it, expect, vi } from 'vitest';
import { transformIndexToSystems, loadAvailableSystemsFromSources } from './catalogSourceIndex';
import { CATALOG_SOURCES } from './catalogUpdate';

const findCatalogue = (system, id) => system.catalogues.find((cat) => cat.id === id);

describe('transformIndexToSystems', () => {
  it('returns an empty list for a missing or empty index', () => {
    expect(transformIndexToSystems(null)).toEqual([]);
    expect(transformIndexToSystems({})).toEqual([]);
    expect(transformIndexToSystems({ repositoryFiles: [] })).toEqual([]);
  });

  it('passes the revision through for the game system and every catalogue', () => {
    const index = {
      repositoryFiles: [
        { id: 'sys-1', name: 'System One', type: 'gamesystem', revision: 5 },
        { id: 'cat-1', name: 'Bravo', type: 'catalogue', revision: 7 },
        { id: 'cat-2', name: 'Alpha', type: 'catalogue', revision: 3 },
      ],
    };

    const [system] = transformIndexToSystems(index);

    expect(system.gst.revision).toBe(5);
    expect(findCatalogue(system, 'cat-1').revision).toBe(7);
    expect(findCatalogue(system, 'cat-2').revision).toBe(3);
  });

  it('sorts the catalogues by name', () => {
    const index = {
      repositoryFiles: [
        { id: 'sys-1', name: 'System One', type: 'gamesystem', revision: 1 },
        { id: 'cat-1', name: 'Bravo', type: 'catalogue', revision: 1 },
        { id: 'cat-2', name: 'Alpha', type: 'catalogue', revision: 1 },
      ],
    };

    const [system] = transformIndexToSystems(index);

    expect(system.catalogues.map((cat) => cat.name)).toEqual(['Alpha', 'Bravo']);
  });

  it('uses the index entry path as the file name, not a name-derived one', () => {
    // Upstream file names are not derivable from the catalogue name (e.g. name
    // "Chaos Dwarfs" vs file "Chaos Dwarves (6th definitive edition).cat").
    const index = {
      repositoryFiles: [
        { id: 'sys-1', name: 'System One', path: 'System One (6th definitive edition).gst', type: 'gamesystem', revision: 5 },
        { id: 'cat-1', name: 'Chaos Dwarfs', path: 'Chaos Dwarves (6th definitive edition).cat', type: 'catalogue', revision: 7 },
      ],
    };

    const [system] = transformIndexToSystems(index);

    expect(system.gst.fileName).toBe('System One (6th definitive edition).gst');
    expect(findCatalogue(system, 'cat-1').fileName).toBe('Chaos Dwarves (6th definitive edition).cat');
  });

  it('falls back to the name plus type extension when the index entry omits the path', () => {
    const index = {
      repositoryFiles: [
        { id: 'sys-1', name: 'System One', type: 'gamesystem', revision: 5 },
        { id: 'cat-1', name: 'Alpha', type: 'catalogue', revision: 7 },
      ],
    };

    const [system] = transformIndexToSystems(index);

    expect(system.gst.fileName).toBe('System One.gst');
    expect(findCatalogue(system, 'cat-1').fileName).toBe('Alpha.cat');
  });

  it('does not throw and yields an undefined revision when the index entry omits it', () => {
    const index = {
      repositoryFiles: [
        { id: 'sys-1', name: 'System One', type: 'gamesystem' },
        { id: 'cat-1', name: 'Alpha', type: 'catalogue' },
      ],
    };

    let systems;
    expect(() => {
      systems = transformIndexToSystems(index);
    }).not.toThrow();

    expect(systems[0].gst.revision).toBeUndefined();
    expect(findCatalogue(systems[0], 'cat-1').revision).toBeUndefined();
  });
});

describe('loadAvailableSystemsFromSources', () => {
  const [firstSource, secondSource] = CATALOG_SOURCES;

  const indexWithSystem = (id, name) => ({
    repositoryFiles: [{ id, name, type: 'gamesystem', revision: 1 }],
  });

  it('merges the systems of every source and tags each with its own raw base URL', async () => {
    const fetchText = vi.fn(async (url) =>
      JSON.stringify(
        url === firstSource.indexUrl ? indexWithSystem('sys-a', 'System A') : indexWithSystem('sys-b', 'System B')
      )
    );

    const { systems, anyIndexReachable } = await loadAvailableSystemsFromSources(fetchText);

    expect(anyIndexReachable).toBe(true);
    expect(systems.map((system) => system.id)).toEqual(['sys-a', 'sys-b']);
    expect(systems[0].rawBaseUrl).toBe(firstSource.rawBaseUrl);
    expect(systems[1].rawBaseUrl).toBe(secondSource.rawBaseUrl);
  });

  it('keeps the reachable source when another source is offline', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchText = vi.fn(async (url) => {
      if (url === firstSource.indexUrl) throw new Error('offline');
      return JSON.stringify(indexWithSystem('sys-b', 'System B'));
    });

    const { systems, anyIndexReachable } = await loadAvailableSystemsFromSources(fetchText);

    expect(anyIndexReachable).toBe(true);
    expect(systems.map((system) => system.id)).toEqual(['sys-b']);
    consoleWarnSpy.mockRestore();
  });

  it('reports no reachable index when every source fails', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchText = vi.fn(async () => {
      throw new Error('offline');
    });

    const { systems, anyIndexReachable } = await loadAvailableSystemsFromSources(fetchText);

    expect(systems).toEqual([]);
    expect(anyIndexReachable).toBe(false);
    consoleWarnSpy.mockRestore();
  });

  it('stays reachable when a source serves an index without any system', async () => {
    const fetchText = vi.fn(async () => JSON.stringify({ repositoryFiles: [] }));

    const { systems, anyIndexReachable } = await loadAvailableSystemsFromSources(fetchText);

    expect(systems).toEqual([]);
    expect(anyIndexReachable).toBe(true);
  });
});
