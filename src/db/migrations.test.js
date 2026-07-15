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
