import { test, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';

vi.mock('./database', () => ({
  saveSystem: vi.fn(),
}));

import { saveSystem } from './database';
import { runSystemMigrations } from './migrations';

const jsdomObj = new JSDOM();
globalThis.DOMParser = jsdomObj.window.DOMParser;
globalThis.XMLSerializer = jsdomObj.window.XMLSerializer;

const validGst = `<?xml version="1.0" encoding="UTF-8"?>
<gameSystem id="sys-1" name="Test System">
  <categoryEntries>
    <categoryEntry id="cat-hq" name="HQ" />
  </categoryEntries>
</gameSystem>
`;

beforeEach(() => {
  saveSystem.mockReset();
  saveSystem.mockResolvedValue({});
});

test('successfully re-processed system produces no failure and is migrated', async () => {
  const systems = [
    { id: 'sys-1', name: 'Test System', rawXmls: { gst: [{ name: 'sys.gst', content: validGst }], cat: [] } }
  ];

  const { systems: migrated, failures } = await runSystemMigrations(systems);

  expect(failures).toEqual([]);
  expect(migrated).toHaveLength(1);
  expect(migrated[0].id).toBe('sys-1');
  expect(saveSystem).toHaveBeenCalledTimes(1);
});

test('a system without stored rawXmls passes through untouched and produces no failure', async () => {
  const systems = [{ id: 'sys-legacy', name: 'Legacy System' }];

  const { systems: migrated, failures } = await runSystemMigrations(systems);

  expect(failures).toEqual([]);
  expect(migrated).toEqual(systems);
  expect(saveSystem).not.toHaveBeenCalled();
});

test('a system whose stored data fails to re-process is reported as a failure, keeps its old data, and is not deleted', async () => {
  const brokenSystem = {
    id: 'sys-broken',
    name: 'Broken System',
    rawXmls: { gst: [{ name: 'broken.gst', content: '<wrongRoot />' }], cat: [] }
  };
  const systems = [brokenSystem];

  const { systems: migrated, failures } = await runSystemMigrations(systems);

  expect(failures).toEqual([{ id: 'sys-broken', name: 'Broken System' }]);
  expect(migrated).toHaveLength(1);
  expect(migrated[0]).toBe(brokenSystem);
  expect(saveSystem).not.toHaveBeenCalled();
});

test('one broken system does not affect the migration of the others', async () => {
  const brokenSystem = {
    id: 'sys-broken',
    name: 'Broken System',
    rawXmls: { gst: [{ name: 'broken.gst', content: '<wrongRoot />' }], cat: [] }
  };
  const goodSystem = {
    id: 'sys-1',
    name: 'Test System',
    rawXmls: { gst: [{ name: 'sys.gst', content: validGst }], cat: [] }
  };

  const { systems: migrated, failures } = await runSystemMigrations([brokenSystem, goodSystem]);

  expect(failures).toEqual([{ id: 'sys-broken', name: 'Broken System' }]);
  expect(migrated.map(s => s.id)).toEqual(['sys-broken', 'sys-1']);
});

// A stored system is refreshed against the index of its own source (ADR 0018), keyed by
// its gameSystemId. These tests therefore use the real Lexicanum id so the source lookup
// engages; the symmetric Ergofarg case is covered separately below. Schema-valid
// (namespace declared) so a fork update passes the import schema advisory that
// updateSystemFromCatalogIndex now applies before parsing (advisory only: it reports,
// it does not block — ADR 0016, Revision 2026-07-18).
const GAME_SYSTEM_NAMESPACE = 'http://www.battlescribe.net/schema/gameSystemSchema';
const LEXICANUM_SYSTEM_ID = '0d13-7737-ea86-4662';
const ERGOFARG_SYSTEM_ID = '6d8e-38d9-3c69-febf';

const outdatedGst = `<?xml version="1.0" encoding="UTF-8"?>
<gameSystem id="${LEXICANUM_SYSTEM_ID}" name="Test System" revision="8" xmlns="${GAME_SYSTEM_NAMESPACE}"/>`;
const currentGst = `<?xml version="1.0" encoding="UTF-8"?>
<gameSystem id="${LEXICANUM_SYSTEM_ID}" name="Test System" revision="9" xmlns="${GAME_SYSTEM_NAMESPACE}"/>`;

const index = {
  repositoryFiles: [
    { id: LEXICANUM_SYSTEM_ID, name: 'Test System', type: 'gamesystem', revision: 9 },
  ],
};

function makeFetchText({ indexPayload = index, gstPayload = currentGst } = {}) {
  return async (url) => {
    if (url.endsWith('catpkg.json')) return JSON.stringify(indexPayload);
    if (url.includes(encodeURIComponent('Test System.gst'))) return gstPayload;
    throw new Error(`Unexpected fetch: ${url}`);
  };
}

test('an outdated stored system is silently updated to the higher revision', async () => {
  const systems = [
    {
      id: LEXICANUM_SYSTEM_ID,
      name: 'Test System',
      revision: 8,
      catalogues: [],
      rawXmls: { gst: [{ name: 'Test System.gst', content: outdatedGst }], cat: [] },
    },
  ];

  const { systems: migrated, failures } = await runSystemMigrations(systems, makeFetchText());

  expect(failures).toEqual([]);
  expect(migrated[0].revision).toBe(9);
  expect(migrated[0].rawXmls.gst[0].content).toBe(currentGst);
  expect(saveSystem).toHaveBeenCalledTimes(1);
});

test('a stored Ergofarg system is updated symmetrically from its own source', async () => {
  // ADR 0018 reinstates active updates for Ergofarg systems: each source's stored
  // systems update against that source's index, keyed by the system's gameSystemId.
  const ergofargOutdatedGst = `<?xml version="1.0" encoding="UTF-8"?>
<gameSystem id="${ERGOFARG_SYSTEM_ID}" name="Ergofarg System" revision="4" xmlns="${GAME_SYSTEM_NAMESPACE}"/>`;
  const ergofargCurrentGst = `<?xml version="1.0" encoding="UTF-8"?>
<gameSystem id="${ERGOFARG_SYSTEM_ID}" name="Ergofarg System" revision="5" xmlns="${GAME_SYSTEM_NAMESPACE}"/>`;
  const ergofargIndex = {
    repositoryFiles: [
      { id: ERGOFARG_SYSTEM_ID, name: 'Ergofarg System', type: 'gamesystem', revision: 5 },
    ],
  };
  const fetchText = async (url) => {
    if (url.endsWith('catpkg.json')) return JSON.stringify(ergofargIndex);
    if (url.includes(encodeURIComponent('Ergofarg System.gst'))) return ergofargCurrentGst;
    throw new Error(`Unexpected fetch: ${url}`);
  };
  const systems = [
    {
      id: ERGOFARG_SYSTEM_ID,
      name: 'Ergofarg System',
      revision: 4,
      catalogues: [],
      rawXmls: { gst: [{ name: 'Ergofarg System.gst', content: ergofargOutdatedGst }], cat: [] },
    },
  ];

  const { systems: migrated, failures } = await runSystemMigrations(systems, fetchText);

  expect(failures).toEqual([]);
  expect(migrated[0].revision).toBe(5);
  expect(migrated[0].rawXmls.gst[0].content).toBe(ergofargCurrentGst);
});

test('a stored system of no configured source is re-parsed but never network-updated', async () => {
  // A self-uploaded system (unknown gameSystemId) has no source to update from: it is
  // kept and re-parsed, and its source index is never even fetched.
  const requestedUrls = [];
  const fetchText = async (url) => {
    requestedUrls.push(url);
    return JSON.stringify(index);
  };
  const systems = [
    { id: 'custom-system', name: 'Custom', catalogues: [], rawXmls: { gst: [{ name: 'c.gst', content: validGst }], cat: [] } },
  ];

  const { failures } = await runSystemMigrations(systems, fetchText);

  expect(failures).toEqual([]);
  expect(requestedUrls).toEqual([]);
  expect(saveSystem).toHaveBeenCalledTimes(1);
});

test('a failed catalog fetch keeps stored data, reports no failure, and does not toast', async () => {
  const storedRawXmls = { gst: [{ name: 'Test System.gst', content: validGst }], cat: [] };
  const systems = [
    { id: LEXICANUM_SYSTEM_ID, name: 'Test System', revision: 8, catalogues: [], rawXmls: storedRawXmls },
  ];
  const failingFetch = async (url) => {
    if (url.endsWith('catpkg.json')) return JSON.stringify(index);
    throw new Error('offline');
  };

  const { systems: migrated, failures } = await runSystemMigrations(systems, failingFetch);

  // No update applied (fetch of the file failed), but the system is still re-parsed
  // from its untouched stored XML — and no failure is reported to the user.
  expect(failures).toEqual([]);
  expect(migrated[0].rawXmls).toBe(storedRawXmls);
});

test('unparsable fetched catalog data falls back silently to the stored system', async () => {
  const storedRawXmls = { gst: [{ name: 'Test System.gst', content: validGst }], cat: [] };
  const systems = [
    { id: LEXICANUM_SYSTEM_ID, name: 'Test System', revision: 8, catalogues: [], rawXmls: storedRawXmls },
  ];

  const { systems: migrated, failures } = await runSystemMigrations(
    systems,
    makeFetchText({ gstPayload: '<notAGameSystem />' })
  );

  expect(failures).toEqual([]);
  expect(migrated[0].rawXmls).toBe(storedRawXmls);
});

test('without an injected fetcher no network update runs (offline-safe default)', async () => {
  const systems = [
    {
      id: LEXICANUM_SYSTEM_ID,
      name: 'Test System',
      revision: 8,
      catalogues: [],
      rawXmls: { gst: [{ name: 'Test System.gst', content: validGst }], cat: [] },
    },
  ];

  const { failures } = await runSystemMigrations(systems);

  expect(failures).toEqual([]);
  expect(saveSystem).toHaveBeenCalledTimes(1);
});
