/**
 * Issue 0121, Task 11 (Kriterium 6) — die Rettung eines Systems **ohne**
 * gespeichertes Roh-XML darf keine Kataloge verlieren.
 *
 * Hintergrund: Ein System, das vor App-Version 1.8.2 importiert wurde, hat kein
 * `system.rawXmls`; seit dem Cutover beurteilt die Engine ein Roster aber genau
 * daraus. Die Nachruestung holt deshalb die Dateien von der Katalogquelle nach —
 * aber nur die, **die der catpkg-Index kennt** (`findAllCatalogFiles`), parst
 * daraus ein frisches System und speichert es ueber den Altbestand. Kennt der
 * Index einen gespeicherten Katalog nicht, verliert der Nutzer diesen Katalog
 * dauerhaft und erfaehrt nichts davon.
 *
 * Sollverhalten, das diese Datei festschreibt:
 *
 * - Kennt der Index **alle** gespeicherten Kataloge und die `.gst`, laeuft die
 *   Nachruestung: danach traegt das gespeicherte System `rawXmls.gst` und **alle**
 *   Kataloge, `unrecoverable` bleibt leer.
 * - Fehlt dem Index **irgendein** gespeicherter Katalog (oder die `.gst` selbst),
 *   bleibt der Altbestand **unangetastet** — kein `saveSystem` mit reduzierter
 *   Katalogliste, das zurueckgegebene System traegt weiterhin alle Kataloge — und
 *   das System erscheint in `unrecoverable` mit `{ id, name }`.
 * - Ein System **mit** `rawXmls` verhaelt sich unveraendert: reiner
 *   Revisionsvergleich; ein Katalog, den der Index nicht kennt, ist kein Grund
 *   fuer irgendetwas.
 *
 * Nicht hier, weil schon abgedeckt (`migrations.test.js`): das System ohne
 * konfigurierte Quelle bzw. ohne Netz und der fehlgeschlagene `fetchText`.
 *
 * Aufbau: Fake-`fetchText`/`saveSystem`-Mechanik und Fixture-Stil aus
 * `migrations.test.js` / `catalogUpdate.test.js`.
 */

import { test, expect, vi, beforeEach, describe } from 'vitest';
import { JSDOM } from 'jsdom';

vi.mock('../../../platform/persistence/database', () => ({
  saveSystem: vi.fn(),
}));

import { saveSystem } from '../../../platform/persistence/database';
import { runSystemMigrations } from '../../../platform/persistence/migrations';

const jsdomObj = new JSDOM();
globalThis.DOMParser = jsdomObj.window.DOMParser;
globalThis.XMLSerializer = jsdomObj.window.XMLSerializer;

// Der stored system wird gegen den Index seiner **eigenen** Quelle aktualisiert
// (ADR 0018), gefunden ueber die `gameSystemId` — daher die echte Lexicanum-Id.
const LEXICANUM_SYSTEM_ID = '0d13-7737-ea86-4662';
const GAME_SYSTEM_NAMESPACE = 'http://www.battlescribe.net/schema/gameSystemSchema';
const CATALOGUE_NAMESPACE = 'http://www.battlescribe.net/schema/catalogueSchema';

const SYSTEM_NAME = 'Legacy WHFB';
const GST_FILE_NAME = 'Legacy WHFB.gst';
const CATALOGUE_A = { id: 'cat-a', name: 'Faction A', revision: 3, fileName: 'Faction A.cat' };
const CATALOGUE_B = { id: 'cat-b', name: 'Faction B', revision: 4, fileName: 'Faction B.cat' };

const gstXml = `<?xml version="1.0" encoding="UTF-8"?>
<gameSystem id="${LEXICANUM_SYSTEM_ID}" name="${SYSTEM_NAME}" revision="9" xmlns="${GAME_SYSTEM_NAMESPACE}"/>`;

const catalogueXml = (catalogue) => `<?xml version="1.0" encoding="UTF-8"?>
<catalogue id="${catalogue.id}" name="${catalogue.name}" revision="${catalogue.revision}"
           gameSystemId="${LEXICANUM_SYSTEM_ID}" xmlns="${CATALOGUE_NAMESPACE}"/>`;

/**
 * Ein catpkg-Index. `catalogues` sind die Katalogeintraege, die der Index kennt;
 * `withGameSystem: false` laesst die `.gst` selbst weg.
 */
function makeIndex({ catalogues = [CATALOGUE_A, CATALOGUE_B], withGameSystem = true } = {}) {
  const repositoryFiles = [];
  if (withGameSystem) {
    repositoryFiles.push({
      id: LEXICANUM_SYSTEM_ID,
      name: SYSTEM_NAME,
      path: GST_FILE_NAME,
      type: 'gamesystem',
      revision: 9,
    });
  }
  for (const catalogue of catalogues) {
    repositoryFiles.push({
      id: catalogue.id,
      name: catalogue.name,
      path: catalogue.fileName,
      type: 'catalogue',
      revision: catalogue.revision,
    });
  }
  return { repositoryFiles };
}

/** Fake-Netz: der Index unter catpkg.json, die Dateien unter ihrem Dateinamen. */
function makeFetchText(index) {
  const filesByName = new Map([
    [GST_FILE_NAME, gstXml],
    [CATALOGUE_A.fileName, catalogueXml(CATALOGUE_A)],
    [CATALOGUE_B.fileName, catalogueXml(CATALOGUE_B)],
  ]);
  return vi.fn(async (url) => {
    if (url.endsWith('catpkg.json')) return JSON.stringify(index);
    for (const [name, content] of filesByName) {
      if (url.includes(encodeURIComponent(name))) return content;
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
}

/** Das Alt-System: gespeicherte Metadaten auf Indexstand, aber **kein** `rawXmls`. */
function legacySystem({ catalogues = [CATALOGUE_A, CATALOGUE_B] } = {}) {
  return {
    id: LEXICANUM_SYSTEM_ID,
    name: SYSTEM_NAME,
    revision: 9,
    catalogues: catalogues.map(({ id, name, revision }) => ({ id, name, revision })),
  };
}

const catalogueIdsOf = (system) => (system.catalogues ?? []).map((catalogue) => catalogue.id);

/** Die Katalog-Ids jedes ueber `saveSystem` geschriebenen Systems, in Aufrufreihenfolge. */
const savedCatalogueIds = () => saveSystem.mock.calls.map(([system]) => catalogueIdsOf(system));

beforeEach(() => {
  saveSystem.mockReset();
  saveSystem.mockResolvedValue({});
});

describe('Nachruestung eines Systems ohne Roh-XML (Kriterium 6)', () => {
  test('der Index kennt alle gespeicherten Kataloge: das System traegt danach .gst und ALLE Kataloge', async () => {
    const systems = [legacySystem()];
    const fetchText = makeFetchText(makeIndex());

    const { systems: migrated, failures, unrecoverable } = await runSystemMigrations(systems, fetchText);

    expect(failures).toEqual([]);
    expect(unrecoverable).toEqual([]);
    expect(migrated[0].rawXmls?.gst?.[0]?.content).toBe(gstXml);
    expect(catalogueIdsOf(migrated[0])).toEqual([CATALOGUE_A.id, CATALOGUE_B.id]);
    // Auch das Gespeicherte traegt beide Kataloge — nicht nur das Rueckgabeobjekt.
    expect(savedCatalogueIds()).toEqual([[CATALOGUE_A.id, CATALOGUE_B.id]]);
  });

  test('ein System ohne Kataloge wird nachgeruestet (leere Liste ist kein fehlender Katalog)', async () => {
    const systems = [legacySystem({ catalogues: [] })];
    const fetchText = makeFetchText(makeIndex({ catalogues: [] }));

    const { migrated, unrecoverable } = await runSystemMigrations(systems, fetchText).then((result) => ({
      migrated: result.systems,
      unrecoverable: result.unrecoverable,
    }));

    expect(unrecoverable).toEqual([]);
    expect(migrated[0].rawXmls?.gst?.[0]?.content).toBe(gstXml);
    expect(catalogueIdsOf(migrated[0])).toEqual([]);
  });

  test('der Index kennt einen gespeicherten Katalog nicht: der Altbestand behaelt ALLE Kataloge', async () => {
    const systems = [legacySystem()];
    const fetchText = makeFetchText(makeIndex({ catalogues: [CATALOGUE_A] }));

    const { systems: migrated } = await runSystemMigrations(systems, fetchText);

    // Nichts darf mit reduzierter Katalogliste ueber den Altbestand gespeichert werden.
    for (const ids of savedCatalogueIds()) {
      expect(ids).toEqual([CATALOGUE_A.id, CATALOGUE_B.id]);
    }
    expect(catalogueIdsOf(migrated[0])).toEqual([CATALOGUE_A.id, CATALOGUE_B.id]);
  });

  test('der Index kennt einen gespeicherten Katalog nicht: das System wird als unrettbar gemeldet', async () => {
    const systems = [legacySystem()];
    const fetchText = makeFetchText(makeIndex({ catalogues: [CATALOGUE_A] }));

    const { failures, unrecoverable } = await runSystemMigrations(systems, fetchText);

    expect(failures).toEqual([]);
    expect(unrecoverable).toEqual([{ id: LEXICANUM_SYSTEM_ID, name: SYSTEM_NAME }]);
  });

  test('der Index kennt keinen der gespeicherten Kataloge: Altbestand unangetastet und unrettbar gemeldet', async () => {
    const systems = [legacySystem()];
    const fetchText = makeFetchText(makeIndex({ catalogues: [] }));

    const { systems: migrated, unrecoverable } = await runSystemMigrations(systems, fetchText);

    for (const ids of savedCatalogueIds()) {
      expect(ids).toEqual([CATALOGUE_A.id, CATALOGUE_B.id]);
    }
    expect(catalogueIdsOf(migrated[0])).toEqual([CATALOGUE_A.id, CATALOGUE_B.id]);
    expect(unrecoverable).toEqual([{ id: LEXICANUM_SYSTEM_ID, name: SYSTEM_NAME }]);
  });

  test('der Index kennt die .gst selbst nicht: Altbestand unangetastet und unrettbar gemeldet', async () => {
    const systems = [legacySystem()];
    const fetchText = makeFetchText(makeIndex({ withGameSystem: false }));

    const { systems: migrated, unrecoverable } = await runSystemMigrations(systems, fetchText);

    expect(migrated[0].rawXmls).toBeUndefined();
    expect(catalogueIdsOf(migrated[0])).toEqual([CATALOGUE_A.id, CATALOGUE_B.id]);
    expect(unrecoverable).toEqual([{ id: LEXICANUM_SYSTEM_ID, name: SYSTEM_NAME }]);
  });
});

describe('Ein System MIT Roh-XML bleibt reiner Revisionsvergleich (Kriterium 6)', () => {
  test('ein dem Index unbekannter Katalog ist kein Grund fuer irgendetwas', async () => {
    const stored = {
      ...legacySystem(),
      rawXmls: {
        gst: [{ name: GST_FILE_NAME, content: gstXml }],
        cat: [
          { name: CATALOGUE_A.fileName, content: catalogueXml(CATALOGUE_A) },
          { name: CATALOGUE_B.fileName, content: catalogueXml(CATALOGUE_B) },
        ],
      },
    };
    // Der Index kennt die `.gst` auf gespeichertem Stand und Katalog B gar nicht.
    const fetchText = makeFetchText(makeIndex({ catalogues: [CATALOGUE_A] }));

    const { systems: migrated, failures, unrecoverable } = await runSystemMigrations([stored], fetchText);

    expect(failures).toEqual([]);
    expect(unrecoverable).toEqual([]);
    expect(catalogueIdsOf(migrated[0])).toEqual([CATALOGUE_A.id, CATALOGUE_B.id]);
    expect(migrated[0].rawXmls.cat).toHaveLength(2);
  });
});
