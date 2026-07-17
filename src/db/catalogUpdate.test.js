import { test, expect, beforeAll, describe } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  findOutdatedCatalogFiles,
  updateSystemFromCatalogIndex,
  buildRawFileUrl,
  deriveRevisionState,
  REVISION_STATE,
} from './catalogUpdate';

beforeAll(() => {
  const dom = new JSDOM();
  globalThis.DOMParser = dom.window.DOMParser;
});

const GAME_SYSTEM_ID = 'sys-1';
const CATALOGUE_ID = 'cat-1';

function makeIndex({ gameSystemRevision = 9, catalogueRevision = 14 } = {}) {
  return {
    repositoryFiles: [
      { id: GAME_SYSTEM_ID, name: 'Sys', type: 'gamesystem', revision: gameSystemRevision },
      { id: CATALOGUE_ID, name: 'Faction', type: 'catalogue', revision: catalogueRevision },
    ],
  };
}

function makeStoredSystem({ systemRevision = 8, catalogueRevision = 13 } = {}) {
  return {
    id: GAME_SYSTEM_ID,
    name: 'Sys',
    revision: systemRevision,
    catalogues: [{ id: CATALOGUE_ID, name: 'Faction', revision: catalogueRevision }],
  };
}

describe('findOutdatedCatalogFiles (pure revision comparison)', () => {
  test('"higher wins": a stored file below the remote revision is outdated', () => {
    const outdated = findOutdatedCatalogFiles(makeIndex(), makeStoredSystem());
    expect(outdated).toEqual([
      { type: 'gamesystem', fileName: 'Sys.gst' },
      { type: 'catalogue', fileName: 'Faction.cat' },
    ]);
  });

  test('a tie (equal revisions) is not outdated', () => {
    const index = makeIndex({ gameSystemRevision: 9, catalogueRevision: 14 });
    const system = makeStoredSystem({ systemRevision: 9, catalogueRevision: 14 });
    expect(findOutdatedCatalogFiles(index, system)).toEqual([]);
  });

  test('a stored file above the remote revision (self-uploaded) stays untouched', () => {
    const index = makeIndex({ gameSystemRevision: 9, catalogueRevision: 14 });
    const system = makeStoredSystem({ systemRevision: 20, catalogueRevision: 30 });
    expect(findOutdatedCatalogFiles(index, system)).toEqual([]);
  });

  test('missing stored revision (pre-revision legacy data) counts as outdated', () => {
    const system = makeStoredSystem();
    system.revision = undefined;
    system.catalogues[0].revision = undefined;

    const outdated = findOutdatedCatalogFiles(makeIndex(), system);
    expect(outdated.map((f) => f.fileName)).toEqual(['Sys.gst', 'Faction.cat']);
  });

  test('a system whose id the index does not know is left entirely untouched', () => {
    const system = makeStoredSystem();
    system.id = 'unknown-system';
    expect(findOutdatedCatalogFiles(makeIndex(), system)).toEqual([]);
  });

  test('a catalogue whose id the index does not know is not included', () => {
    const index = {
      repositoryFiles: [
        { id: GAME_SYSTEM_ID, name: 'Sys', type: 'gamesystem', revision: 8 },
      ],
    };
    const system = makeStoredSystem({ systemRevision: 8 });
    expect(findOutdatedCatalogFiles(index, system)).toEqual([]);
  });

  test('builds the raw URL from the fork base, URL-encoding the file name', () => {
    expect(buildRawFileUrl('Orcs and Goblins.cat')).toBe(
      'https://raw.githubusercontent.com/artkoenig/Warhammer-Fantasy-6th-edition/master/Orcs%20and%20Goblins.cat'
    );
  });
});

describe('deriveRevisionState (available vs. locally stored, "higher wins")', () => {
  const AVAILABLE_REVISION = 10;

  test('not stored locally at all -> new', () => {
    expect(deriveRevisionState(AVAILABLE_REVISION, null)).toBe(REVISION_STATE.NEW);
    expect(deriveRevisionState(AVAILABLE_REVISION, undefined)).toBe(REVISION_STATE.NEW);
  });

  test('stored at the same revision -> current', () => {
    expect(deriveRevisionState(AVAILABLE_REVISION, { revision: 10 })).toBe(REVISION_STATE.CURRENT);
  });

  test('stored below the available revision -> outdated', () => {
    expect(deriveRevisionState(AVAILABLE_REVISION, { revision: 7 })).toBe(REVISION_STATE.OUTDATED);
  });

  test('stored above the available revision (self-uploaded) -> ahead', () => {
    expect(deriveRevisionState(AVAILABLE_REVISION, { revision: 12 })).toBe(REVISION_STATE.AHEAD);
  });

  test('stored without a revision field (pre-revision legacy data) -> outdated', () => {
    expect(deriveRevisionState(AVAILABLE_REVISION, { revision: undefined })).toBe(REVISION_STATE.OUTDATED);
    expect(deriveRevisionState(AVAILABLE_REVISION, {})).toBe(REVISION_STATE.OUTDATED);
  });
});

const gstV9 = `<?xml version="1.0" encoding="UTF-8"?>
<gameSystem id="sys-1" name="Sys" revision="9">
  <categoryEntries><categoryEntry id="c-hq" name="HQ" /></categoryEntries>
</gameSystem>`;

const catV14 = `<?xml version="1.0" encoding="UTF-8"?>
<catalogue id="cat-1" name="Faction" revision="14" gameSystemId="sys-1" />`;

function makeStoredSystemWithRawXmls() {
  return {
    ...makeStoredSystem(),
    rawXmls: {
      gst: [{ name: 'Sys.gst', content: '<gameSystem id="sys-1" name="Sys" revision="8" />' }],
      cat: [{ name: 'Faction.cat', content: '<catalogue id="cat-1" name="Faction" revision="13" gameSystemId="sys-1" />' }],
    },
  };
}

function makeFetchText(fileContentsByName) {
  return async (url) => {
    const match = Object.keys(fileContentsByName).find((name) =>
      url.includes(encodeURIComponent(name))
    );
    if (match) return fileContentsByName[match];
    throw new Error(`Unexpected fetch: ${url}`);
  };
}

describe('updateSystemFromCatalogIndex (orchestration via injected fetch)', () => {
  test('a successful update re-parses fetched files and carries the new revisions', async () => {
    const system = makeStoredSystemWithRawXmls();
    const fetchText = makeFetchText({ 'Sys.gst': gstV9, 'Faction.cat': catV14 });

    const updated = await updateSystemFromCatalogIndex(system, makeIndex(), fetchText);

    expect(updated).not.toBeNull();
    expect(updated.revision).toBe(9);
    expect(updated.catalogues[0].revision).toBe(14);
    expect(updated.rawXmls.gst[0].content).toBe(gstV9);
    expect(updated.rawXmls.cat[0].content).toBe(catV14);
  });

  test('only the outdated files are fetched, not the whole catalog set', async () => {
    // Game system already current; only the catalogue is behind.
    const index = makeIndex({ gameSystemRevision: 8, catalogueRevision: 14 });
    const system = makeStoredSystemWithRawXmls();
    const requestedUrls = [];
    const fetchText = async (url) => {
      requestedUrls.push(url);
      return catV14;
    };

    const updated = await updateSystemFromCatalogIndex(system, index, fetchText);

    expect(requestedUrls).toHaveLength(1);
    expect(requestedUrls[0]).toContain('Faction.cat');
    expect(updated.catalogues[0].revision).toBe(14);
  });

  test('a failed fetch returns null and leaves the stored system untouched', async () => {
    const system = makeStoredSystemWithRawXmls();
    const originalRawXmls = system.rawXmls;
    const fetchText = async () => {
      throw new Error('offline');
    };

    const result = await updateSystemFromCatalogIndex(system, makeIndex(), fetchText);

    expect(result).toBeNull();
    expect(system.rawXmls).toBe(originalRawXmls);
  });

  test('unparsable remote data returns null (silent), keeping stored data', async () => {
    const system = makeStoredSystemWithRawXmls();
    const fetchText = makeFetchText({ 'Sys.gst': '<notAGameSystem />', 'Faction.cat': catV14 });

    const result = await updateSystemFromCatalogIndex(system, makeIndex(), fetchText);

    expect(result).toBeNull();
  });

  test('no index means no update attempt', async () => {
    const system = makeStoredSystemWithRawXmls();
    const fetchText = async () => {
      throw new Error('should not be called');
    };

    expect(await updateSystemFromCatalogIndex(system, null, fetchText)).toBeNull();
  });
});
