/**
 * Issue 0121, Task 18 (Kriterien 3 und 5) — auch ein **Kontingent** hat einen
 * Slot-Pfad, und der kommt aus der korrigierten Zuordnung.
 *
 * Loest ein Kontingent nicht auf, haengt die Engine es nicht in den Baum
 * (Diagnose `unresolvedDefinition`) — alle **folgenden** Kontingente fuehrt der
 * Bericht dann unter einem um eins kleineren Pfad. Wer den Pfad eines
 * Kontingents aus dem rohen Eingabe-Index nimmt, greift fuer jedes folgende
 * Kontingent ins Leere: keine Aushebe-Kandidaten, keine Kategorie-Grenzen,
 * stillschweigend.
 *
 * **Vertrag (im Auftrag festgelegt, nicht hier erfunden):** die Zuordnung heisst
 * `pathByForceId` — `Map<force.id, slotPfad>` — und steht neben
 * `pathBySelectionId` im Ergebnis **beider** Raender, die die Oberflaeche
 * benutzt (durch Lesen verifiziert, 2026-07-30):
 *
 * - `useEvaluation(system, roster)` — Rand des Editors (`src/hooks/useRoster.js`
 *   → `RosterEditor` → `ForceEditorSection`);
 * - `evaluateAppRoster(system, roster)` — Rand des `.ros`-Exports
 *   (`src/roster/rosterSerialization.js`).
 *
 * Sollverhalten:
 * 1. Der Pfad, unter dem die Oberflaeche die Slots eines Kontingents sucht, ist
 *    der Pfad, unter dem der Bericht sie **fuehrt**.
 * 2. Ein Kontingent, das selbst nicht aufloest, **fehlt** in der Map.
 * 3. Ohne unaufloesbares Kontingent: `"0"`, `"1"`, … wie heute.
 *
 * Fixture-Muster: `evaluationCache.unresolvedSlotPaths.test.js` (synthetischer
 * Datensatz aus `rawXmls`, **echte** Fassade).
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { evaluateAppRoster } from './evaluationCache.js';
import { useEvaluation } from './useEvaluation.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

// ── Synthetischer Datensatz ─────────────────────────────────────────────────

const GAME_SYSTEM_ID = 'gs-main';
const COST_TYPE_ID = 'cost-pts';
const FIRST_FORCE_DEF_ID = 'force-main';
const SECOND_FORCE_DEF_ID = 'force-second';
const THIRD_FORCE_DEF_ID = 'force-third';
const ALPHA_ID = 'entry-alpha';
const BETA_ID = 'entry-beta';

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
  <gameSystem id="${GAME_SYSTEM_ID}" name="Test System">
    <costTypes>
      <costType id="${COST_TYPE_ID}" name="pts" defaultCostLimit="-1"/>
    </costTypes>
  </gameSystem>`;

const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-main" name="Main Catalogue" gameSystemId="${GAME_SYSTEM_ID}">
    <forceEntries>
      <forceEntry id="${FIRST_FORCE_DEF_ID}" name="Main Force"/>
      <forceEntry id="${SECOND_FORCE_DEF_ID}" name="Second Force"/>
      <forceEntry id="${THIRD_FORCE_DEF_ID}" name="Third Force"/>
    </forceEntries>
    <selectionEntries>
      <selectionEntry id="${ALPHA_ID}" name="Alpha" type="unit">
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="11"/></costs>
      </selectionEntry>
      <selectionEntry id="${BETA_ID}" name="Beta" type="unit">
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="77"/></costs>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

function appSystem() {
  return {
    id: 'system-uuid',
    name: 'Test System',
    rawXmls: {
      gst: [{ name: 'test.gst', content: GAME_SYSTEM_XML }],
      cat: [{ name: 'main.cat', content: CATALOGUE_XML }],
    },
  };
}

function selection(id, selectionEntryId) {
  return {
    id,
    name: id,
    entryLinkId: null,
    selectionEntryId,
    number: 1,
    category: null,
    selections: [],
  };
}

/** Ein Kontingent mit **eigener** App-Id (Schluessel von `pathByForceId`). */
function force(id, forceEntryId, selections = []) {
  return { id, forceEntryId, catalogueId: 'cat-main', selections };
}

function appRoster(forces) {
  return {
    id: 'roster-uuid',
    name: 'Test Roster',
    systemId: 'system-uuid',
    catalogueId: 'cat-main',
    costLimit: 10000,
    costLimitType: COST_TYPE_ID,
    forces,
  };
}

// ── Die beiden Raender ──────────────────────────────────────────────────────

const editorEdge = (system, roster) =>
  renderHook(({ s, r }) => useEvaluation(s, r), { initialProps: { s: system, r: roster } })
    .result.current;

const exportEdge = (system, roster) => evaluateAppRoster(system, roster);

const EDGES = [
  ['useEvaluation (Editor)', editorEdge],
  ['evaluateAppRoster (.ros-Export)', exportEdge],
];

/** Vorbedingung: die Engine meldet die Diagnose wirklich. */
function expectUnresolved(result, defIds) {
  expect(
    result.diagnostics
      .filter((entry) => entry.kind === 'unresolvedDefinition')
      .map((entry) => entry.defId),
  ).toEqual(defIds);
}

describe.each(EDGES)('pathByForceId — Rand: %s (Issue 0121, Task 18)', (_name, evaluateAtEdge) => {
  const evaluateRoster = (roster) => evaluateAtEdge(appSystem(), roster);

  it('ohne unaufloesbares Kontingent: "0", "1", "2" wie heute', () => {
    const result = evaluateRoster(appRoster([
      force('force-uuid-a', FIRST_FORCE_DEF_ID, [selection('sel-alpha', ALPHA_ID)]),
      force('force-uuid-b', SECOND_FORCE_DEF_ID, [selection('sel-beta', BETA_ID)]),
      force('force-uuid-c', THIRD_FORCE_DEF_ID),
    ]));

    expect(result.diagnostics).toEqual([]);
    expect(result.pathByForceId).toBeInstanceOf(Map);
    expect([...result.pathByForceId.entries()]).toEqual([
      ['force-uuid-a', '0'],
      ['force-uuid-b', '1'],
      ['force-uuid-c', '2'],
    ]);
  });

  it('jeder gefuehrte Pfad zeigt auf den Slot GENAU dieses Kontingents (Name/Definition des Berichts)', () => {
    const result = evaluateRoster(appRoster([
      force('force-uuid-a', FIRST_FORCE_DEF_ID),
      force('force-uuid-b', SECOND_FORCE_DEF_ID),
    ]));

    expect(result.capabilities.get(result.pathByForceId.get('force-uuid-a')))
      .toMatchObject({ defId: FIRST_FORCE_DEF_ID, name: 'Main Force' });
    expect(result.capabilities.get(result.pathByForceId.get('force-uuid-b')))
      .toMatchObject({ defId: SECOND_FORCE_DEF_ID, name: 'Second Force' });
  });

  it('unaufloesbares erstes Kontingent: das zweite findet seine Slots (Pfad "0", nicht "1")', () => {
    const result = evaluateRoster(appRoster([
      force('force-uuid-gone', 'force-vanished', [selection('sel-alpha', ALPHA_ID)]),
      force('force-uuid-b', SECOND_FORCE_DEF_ID, [selection('sel-beta', BETA_ID)]),
    ]));
    expectUnresolved(result, ['force-vanished']);

    const secondPath = result.pathByForceId.get('force-uuid-b');
    expect(secondPath).toBe('0');
    expect(result.capabilities.get(secondPath))
      .toMatchObject({ defId: SECOND_FORCE_DEF_ID, name: 'Second Force' });
  });

  it('ein Kontingent, das selbst nicht aufloest, fehlt in der Map — kein fremder Pfad', () => {
    const result = evaluateRoster(appRoster([
      force('force-uuid-gone', 'force-vanished', [selection('sel-alpha', ALPHA_ID)]),
      force('force-uuid-b', SECOND_FORCE_DEF_ID, [selection('sel-beta', BETA_ID)]),
    ]));
    expectUnresolved(result, ['force-vanished']);

    expect(result.pathByForceId.has('force-uuid-gone')).toBe(false);
  });

  it('Rand: MEHRERE unaufloesbare Kontingente — die uebrigen ruecken zusammen auf', () => {
    const result = evaluateRoster(appRoster([
      force('force-uuid-gone-1', 'force-vanished-1'),
      force('force-uuid-a', FIRST_FORCE_DEF_ID),
      force('force-uuid-gone-2', 'force-vanished-2'),
      force('force-uuid-b', SECOND_FORCE_DEF_ID),
    ]));
    expectUnresolved(result, ['force-vanished-1', 'force-vanished-2']);

    expect([...result.pathByForceId.entries()]).toEqual([
      ['force-uuid-a', '0'],
      ['force-uuid-b', '1'],
    ]);
  });

  it('Rand: LETZTES Kontingent unaufloesbar — es fehlt, die davor bleiben unveraendert', () => {
    const result = evaluateRoster(appRoster([
      force('force-uuid-a', FIRST_FORCE_DEF_ID),
      force('force-uuid-gone', 'force-vanished'),
    ]));
    expectUnresolved(result, ['force-vanished']);

    expect([...result.pathByForceId.entries()]).toEqual([['force-uuid-a', '0']]);
  });

  it('Rand: JEDES Kontingent unaufloesbar — die Map ist leer', () => {
    const result = evaluateRoster(appRoster([
      force('force-uuid-gone-1', 'force-vanished-1'),
      force('force-uuid-gone-2', 'force-vanished-2'),
    ]));
    expectUnresolved(result, ['force-vanished-1', 'force-vanished-2']);

    expect(result.pathByForceId).toBeInstanceOf(Map);
    expect(result.pathByForceId.size).toBe(0);
  });

  it('Rand: Roster ohne Kontingente — leere Map, kein Throw', () => {
    const result = evaluateRoster(appRoster([]));

    expect(result.pathByForceId).toBeInstanceOf(Map);
    expect(result.pathByForceId.size).toBe(0);
  });

  it('Rand: roster null (Leer-Ergebnis) — leere Map, kein Throw', () => {
    const result = evaluateAtEdge(appSystem(), null);

    expect(result.pathByForceId).toBeInstanceOf(Map);
    expect(result.pathByForceId.size).toBe(0);
  });
});

describe('Editor-Rand und Export-Rand liefern dieselbe Kontingent-Zuordnung (Issue 0121, Task 18)', () => {
  function bothEdges(buildRoster) {
    return {
      fromEditor: editorEdge(appSystem(), buildRoster()),
      fromExport: exportEdge(appSystem(), buildRoster()),
    };
  }

  it('mit unaufloesbarem Kontingent: identische pathByForceId', () => {
    const buildRoster = () => appRoster([
      force('force-uuid-gone', 'force-vanished', [selection('sel-alpha', ALPHA_ID)]),
      force('force-uuid-b', SECOND_FORCE_DEF_ID, [selection('sel-beta', BETA_ID)]),
    ]);
    const { fromEditor, fromExport } = bothEdges(buildRoster);
    expectUnresolved(fromEditor, ['force-vanished']);

    // Erst der Gegenstand (sonst waeren zwei fehlende Zuordnungen „gleich"),
    // dann die Gleichheit.
    expect(fromEditor.pathByForceId?.size).toBe(1);
    expect(fromEditor.pathByForceId).toEqual(fromExport.pathByForceId);
  });

  it('ohne Diagnose: identische pathByForceId (und nicht leer — der Vergleich hat Gegenstand)', () => {
    const buildRoster = () => appRoster([
      force('force-uuid-a', FIRST_FORCE_DEF_ID),
      force('force-uuid-b', SECOND_FORCE_DEF_ID),
    ]);
    const { fromEditor, fromExport } = bothEdges(buildRoster);

    expect(fromEditor.pathByForceId.size).toBe(2);
    expect(fromEditor.pathByForceId).toEqual(fromExport.pathByForceId);
  });
});
