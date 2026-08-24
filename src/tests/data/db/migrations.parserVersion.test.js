import { describe, test, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';

vi.mock('../../../data/db/database', () => ({ saveSystem: vi.fn() }));

// Der echte Parser, aber zaehlbar: die Frage dieser Datei ist nicht, *was* geparst
// wird, sondern *wie oft*.
vi.mock('../../../data/parser/xmlParser', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, processImportedData: vi.fn(actual.processImportedData) };
});

import { saveSystem } from '../../../data/db/database';
import { processImportedData } from '../../../data/parser/xmlParser';
import { PARSER_VERSION } from '../../../data/parser/parserVersion';
import { runSystemMigrations } from '../../../data/db/migrations';

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

/** Ein gespeichertes System, wahlweise mit oder ohne Parser-Marker. */
function storedSystem(extra = {}) {
  return {
    id: 'sys-1',
    name: 'Test System',
    rawXmls: { gst: [{ name: 'sys.gst', content: validGst }], cat: [] },
    ...extra,
  };
}

beforeEach(() => {
  saveSystem.mockReset();
  saveSystem.mockImplementation((system) => Promise.resolve(system));
  processImportedData.mockClear();
});

describe('Issue 0168: der Parser-Stand eines gespeicherten Systems', () => {
  test('ein frisch geparstes System traegt den aktuellen Stand', () => {
    const { system } = processImportedData([{ name: 'sys.gst', content: validGst }], []);

    expect(system.parserVersion).toBe(PARSER_VERSION);
  });

  test('ein System auf aktuellem Stand wird nicht neu geparst und nicht geschrieben', async () => {
    const system = storedSystem({ parserVersion: PARSER_VERSION });

    const { systems: migrated, failures } = await runSystemMigrations([system]);

    expect(processImportedData).not.toHaveBeenCalled();
    expect(saveSystem).not.toHaveBeenCalled();
    expect(failures).toEqual([]);
    // Dieselbe Objektidentitaet — daran haengt der Auswertungs-Cache.
    expect(migrated[0]).toBe(system);
  });

  test('ein System mit aelterem Stand wird neu geparst', async () => {
    const system = storedSystem({ parserVersion: PARSER_VERSION - 1 });

    const { systems: migrated } = await runSystemMigrations([system]);

    expect(processImportedData).toHaveBeenCalledTimes(1);
    expect(migrated[0].parserVersion).toBe(PARSER_VERSION);
  });

  test('ein System ohne Marker wird genau einmal neu geparst, danach nie wieder', async () => {
    // Der Bestand eines Nutzers, der die App vor Issue 0168 benutzt hat: kein
    // `parserVersion` im gespeicherten Datensatz.
    const legacy = storedSystem();
    expect(legacy.parserVersion).toBeUndefined();

    const first = await runSystemMigrations([legacy]);

    expect(processImportedData).toHaveBeenCalledTimes(1);
    expect(saveSystem).toHaveBeenCalledTimes(1);
    const migrated = first.systems[0];
    expect(migrated.parserVersion).toBe(PARSER_VERSION);
    // Der Marker ist auch das, was in die IndexedDB geschrieben wurde — sonst
    // faende der naechste Start wieder ein System ohne Marker vor.
    expect(saveSystem.mock.calls[0][0].parserVersion).toBe(PARSER_VERSION);

    // Jeder weitere Startlauf ueber denselben Bestand: nichts mehr zu tun.
    processImportedData.mockClear();
    saveSystem.mockClear();

    const second = await runSystemMigrations(first.systems);
    const third = await runSystemMigrations(second.systems);

    expect(processImportedData).not.toHaveBeenCalled();
    expect(saveSystem).not.toHaveBeenCalled();
    expect(third.systems[0]).toBe(migrated);
  });
});
