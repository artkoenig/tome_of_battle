/**
 * Issue 0121, Task 17 (Kriterien 3 und 5) — die Pfadkorrektur wirkt an **jedem**
 * Rand, an dem die Oberflaeche eine App-Selection-UUID einem Slot-Pfad zuordnet.
 *
 * Hintergrund: Die Engine haengt eine Instanz, deren `defId` der Datensatz nicht
 * kennt, **nicht** in den Auswertungsbaum (Diagnose `unresolvedDefinition`) —
 * samt Teilbaum. Wer die Pfade naiv aus den Kind-Indizes des App-Rosters zaehlt,
 * ordnet deshalb jede Auswahl **hinter** einer verlorenen dem
 * Faehigkeitsdatensatz ihres Nachbarn zu: fremder Name, fremde Kosten, fremde
 * Verfuegbarkeit (Befund B2 der Pruefrunde 2, in Runde 3 als F1 wieder da).
 *
 * **Die Raender, verifiziert durch Lesen des Produktivcodes (2026-07-30):**
 *
 * - `rosterReportOf(system, roster)` — der Rand des **Editors**:
 *   `src/ui/viewmodels/useRosterState.js:68` liest daraus `pathBySelectionId` und reicht es
 *   ueber `RosterEditor` an jede Einheitenkarte weiter; `PlayMode.jsx:29` liest
 *   denselben Hook.
 * - `evaluateAppRoster(system, roster)` — der Rand des **`.ros`-Exports**:
 *   `src/contexts/armylist/model/rosterSerialization.js:88` loest darueber Namen und Kosten je
 *   Selektion auf.
 *
 * Beide Raender bauen Adapter und `evaluate` heute **getrennt** zusammen. Diese
 * Datei schreibt deshalb dasselbe Sollverhalten fuer beide fest **und** bindet
 * sie aneinander: fuer dieselbe Eingabe dieselbe Zuordnung. Genau deren
 * Auseinanderlaufen war der Defekt.
 *
 * Sollverhalten (ortsfrei formuliert), wenn der Bericht eine
 * `unresolvedDefinition`-Diagnose fuehrt:
 *
 * 1. Eine Auswahl, deren `defId` der Datensatz nicht kennt, hat **keinen** Pfad.
 * 2. Die Kinder einer solchen Auswahl haben ebenfalls keinen Pfad.
 * 3. Jede **aufloesbare** Auswahl zeigt auf den Faehigkeitsdatensatz, der **ihr**
 *    gehoert — ihr Name, ihre Kosten, ihre Verfuegbarkeit.
 * 4. Ohne Diagnose aendert sich nichts gegenueber heute.
 *
 * Fixture-Muster: `evaluationCache.evaluator.test.js` /
 * `evaluationCache.unresolvedSlotPaths.test.js` (synthetischer Datensatz aus
 * `rawXmls`, **echte** Fassade). Die erwarteten Zahlen folgen
 * `docs/battlescribe-data-format.md` §7.5 (Kosten) und §7.6 (`scope="force"`
 * zaehlt ein Eintrags-Ziel je Kontingent).
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluateAppRoster } from '../../../contexts/ruleengine/acl/evaluationCache.js';
import { rosterReportOf } from '../../../contexts/ruleengine/readmodel/rosterReport.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

// ── Synthetischer Datensatz ─────────────────────────────────────────────────

const GAME_SYSTEM_ID = 'gs-main';
const COST_TYPE_ID = 'cost-pts';
const FORCE_DEF_ID = 'force-main';
const SECOND_FORCE_DEF_ID = 'force-second';
const ALPHA_ID = 'entry-alpha';
const BETA_ID = 'entry-beta';
const WARRIOR_ID = 'entry-warrior';
const SWORD_ID = 'entry-sword';
const SHIELD_ID = 'entry-shield';

const ALPHA_POINTS = 11;
const BETA_POINTS = 77;
const SWORD_POINTS = 3;
const SHIELD_POINTS = 5;

/** Alpha traegt eine max-1-Grenze je Kontingent, Beta gar keine — daran wird
 *  „ihre Verfuegbarkeit" unterscheidbar (§7.6: `scope="force"` zaehlt ein
 *  Eintrags-Ziel je Kontingent). */
const ALPHA_MAX = 1;

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
  <gameSystem id="${GAME_SYSTEM_ID}" name="Test System">
    <costTypes>
      <costType id="${COST_TYPE_ID}" name="pts" defaultCostLimit="-1"/>
    </costTypes>
  </gameSystem>`;

const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-main" name="Main Catalogue" gameSystemId="${GAME_SYSTEM_ID}">
    <forceEntries>
      <forceEntry id="${FORCE_DEF_ID}" name="Main Force"/>
      <forceEntry id="${SECOND_FORCE_DEF_ID}" name="Second Force"/>
    </forceEntries>
    <selectionEntries>
      <selectionEntry id="${ALPHA_ID}" name="Alpha" type="unit">
        <constraints>
          <constraint type="max" value="${ALPHA_MAX}" field="selections" scope="force" shared="true" id="limit-alpha-max" includeChildSelections="false"/>
        </constraints>
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="${ALPHA_POINTS}"/></costs>
      </selectionEntry>
      <selectionEntry id="${BETA_ID}" name="Beta" type="unit">
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="${BETA_POINTS}"/></costs>
      </selectionEntry>
      <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit">
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="10"/></costs>
        <selectionEntries>
          <selectionEntry id="${SWORD_ID}" name="Sword" type="upgrade">
            <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="${SWORD_POINTS}"/></costs>
          </selectionEntry>
          <selectionEntry id="${SHIELD_ID}" name="Shield" type="upgrade">
            <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="${SHIELD_POINTS}"/></costs>
          </selectionEntry>
        </selectionEntries>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

/** Das App-System-Objekt mit den rohen XMLs (Shape aus `src/platform/persistence/systemImport.js`). */
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

/** Eine App-Selection (Shape aus `src/shared/rostermodel/types.js`). */
function selection(id, selectionEntryId, selections = []) {
  return {
    id,
    name: id,
    entryLinkId: null,
    selectionEntryId,
    number: 1,
    category: null,
    selections,
  };
}

/** Ein Kontingent des Test-Rosters. */
function force(forceEntryId, selections) {
  return { forceEntryId, selections };
}

/** Ein App-Roster aus beliebig vielen Kontingenten. */
function appRoster(forces) {
  return {
    id: 'roster-uuid',
    name: 'Test Roster',
    systemId: 'system-uuid',
    catalogueId: 'cat-main',
    costLimit: 10000,
    costLimitType: COST_TYPE_ID,
    forces: forces.map((entry, index) => ({
      id: `force-uuid-${index}`,
      catalogueId: 'cat-main',
      ...entry,
    })),
  };
}

// ── Die beiden Raender, die die Oberflaeche benutzt ──────────────────────────

/** Der Rand des Editors: `useRosterState` → `rosterReportOf` → jede Einheitenkarte. */
const editorEdge = (system, roster) => rosterReportOf(system, roster);

/** Der Rand des `.ros`-Exports: `rosterSerialization` → `evaluateAppRoster`. */
const exportEdge = (system, roster) => evaluateAppRoster(system, roster);

const EDGES = [
  ['rosterReportOf (Editor)', editorEdge],
  ['evaluateAppRoster (.ros-Export)', exportEdge],
];

/**
 * Der Faehigkeitsdatensatz, den die Oberflaeche fuer diese App-Selection liest:
 * `pathBySelectionId` → `capabilities`. `undefined`, wenn kein Pfad gefuehrt
 * wird oder der Pfad ins Leere zeigt.
 */
function capabilityFor(result, selectionId) {
  const path = result.slots.pathBySelectionId.get(selectionId);
  return path === undefined ? undefined : result.slots.capabilities.get(path);
}

/** Vorbedingung jedes Falls: die Engine meldet die Diagnose wirklich. */
function expectUnresolved(result, defIds) {
  expect(
    result.diagnostics
      .filter((entry) => entry.kind === 'unresolvedDefinition')
      .map((entry) => entry.defId),
  ).toEqual(defIds);
}

/** Alpha: eigener Name, eigene Kosten, eigene Verfuegbarkeit (max 1, ausgeschoepft). */
const ALPHA_FACTS = {
  defId: ALPHA_ID,
  name: 'Alpha',
  costs: { [COST_TYPE_ID]: ALPHA_POINTS },
  effectiveMax: ALPHA_MAX,
  isBlocked: true,
};

/** Beta: eigener Name, eigene Kosten, keine Grenze — also nicht gesperrt. */
const BETA_FACTS = {
  defId: BETA_ID,
  name: 'Beta',
  costs: { [COST_TYPE_ID]: BETA_POINTS },
  effectiveMax: null,
  isBlocked: false,
};

describe.each(EDGES)(
  'Slot-Pfade bei einer unaufloesbaren Auswahl — Rand: %s (Issue 0121, Task 17)',
  (_name, evaluateAtEdge) => {
    const evaluateRoster = (roster) => evaluateAtEdge(appSystem(), roster);

    /** Die Reproduktion des Befunds: `sel-gone` vor `sel-alpha` und `sel-beta`. */
    function rosterWithLostFirstSelection() {
      return appRoster([
        force(FORCE_DEF_ID, [
          selection('sel-gone', 'entry-vanished'),
          selection('sel-alpha', ALPHA_ID),
          selection('sel-beta', BETA_ID),
        ]),
      ]);
    }

    it('die unaufloesbare Auswahl selbst hat keinen Pfad', () => {
      const result = evaluateRoster(rosterWithLostFirstSelection());
      expectUnresolved(result, ['entry-vanished']);

      expect(result.slots.pathBySelectionId.has('sel-gone')).toBe(false);
    });

    it('jede aufloesbare Auswahl hinter der verlorenen zeigt auf IHREN Datensatz — Name, Kosten, Verfuegbarkeit', () => {
      const result = evaluateRoster(rosterWithLostFirstSelection());
      expectUnresolved(result, ['entry-vanished']);

      expect(capabilityFor(result, 'sel-alpha')).toMatchObject(ALPHA_FACTS);
      expect(capabilityFor(result, 'sel-beta')).toMatchObject(BETA_FACTS);
    });

    it('auch die Kinder der unaufloesbaren Auswahl haben keinen Pfad', () => {
      const result = evaluateRoster(appRoster([
        force(FORCE_DEF_ID, [
          selection('sel-gone', 'entry-vanished', [selection('sel-gone-child', SWORD_ID)]),
          selection('sel-alpha', ALPHA_ID),
          selection('sel-beta', BETA_ID),
        ]),
      ]));
      expectUnresolved(result, ['entry-vanished']);

      expect(result.slots.pathBySelectionId.has('sel-gone')).toBe(false);
      expect(result.slots.pathBySelectionId.has('sel-gone-child')).toBe(false);
      expect(capabilityFor(result, 'sel-alpha')).toMatchObject(ALPHA_FACTS);
      expect(capabilityFor(result, 'sel-beta')).toMatchObject(BETA_FACTS);
    });

    it('eine unaufloesbare Unter-Auswahl verschiebt die Geschwister der tieferen Ebene nicht', () => {
      const result = evaluateRoster(appRoster([
        force(FORCE_DEF_ID, [
          selection('sel-warrior', WARRIOR_ID, [
            selection('sel-opt-gone', 'opt-vanished'),
            selection('sel-sword', SWORD_ID),
            selection('sel-shield', SHIELD_ID),
          ]),
          selection('sel-beta', BETA_ID),
        ]),
      ]));
      expectUnresolved(result, ['opt-vanished']);

      expect(result.slots.pathBySelectionId.has('sel-opt-gone')).toBe(false);
      expect(capabilityFor(result, 'sel-sword')).toMatchObject({
        defId: SWORD_ID,
        name: 'Sword',
        costs: { [COST_TYPE_ID]: SWORD_POINTS },
      });
      expect(capabilityFor(result, 'sel-shield')).toMatchObject({
        defId: SHIELD_ID,
        name: 'Shield',
        costs: { [COST_TYPE_ID]: SHIELD_POINTS },
      });
      expect(capabilityFor(result, 'sel-beta')).toMatchObject(BETA_FACTS);
    });

    it('Rand: als LETZTES Geschwister hat die unaufloesbare Auswahl ebenfalls keinen Pfad', () => {
      const result = evaluateRoster(appRoster([
        force(FORCE_DEF_ID, [
          selection('sel-alpha', ALPHA_ID),
          selection('sel-gone', 'entry-vanished'),
        ]),
      ]));
      expectUnresolved(result, ['entry-vanished']);

      expect(result.slots.pathBySelectionId.has('sel-gone')).toBe(false);
      expect(capabilityFor(result, 'sel-alpha')).toMatchObject(ALPHA_FACTS);
    });

    it('Rand: MEHRERE unaufloesbare Auswahlen unter denselben Geschwistern verschieben nichts', () => {
      const result = evaluateRoster(appRoster([
        force(FORCE_DEF_ID, [
          selection('sel-gone-1', 'entry-vanished-1'),
          selection('sel-alpha', ALPHA_ID),
          selection('sel-gone-2', 'entry-vanished-2'),
          selection('sel-beta', BETA_ID),
        ]),
      ]));
      expectUnresolved(result, ['entry-vanished-1', 'entry-vanished-2']);

      expect(result.slots.pathBySelectionId.has('sel-gone-1')).toBe(false);
      expect(result.slots.pathBySelectionId.has('sel-gone-2')).toBe(false);
      expect(capabilityFor(result, 'sel-alpha')).toMatchObject(ALPHA_FACTS);
      expect(capabilityFor(result, 'sel-beta')).toMatchObject(BETA_FACTS);
    });

    it('ein unaufloesbares KONTINGENT nimmt seinen Auswahlen den Pfad, das folgende bleibt richtig', () => {
      const result = evaluateRoster(appRoster([
        force('force-vanished', [selection('sel-in-gone-force', ALPHA_ID)]),
        force(SECOND_FORCE_DEF_ID, [selection('sel-beta', BETA_ID)]),
      ]));
      expectUnresolved(result, ['force-vanished']);

      expect(result.slots.pathBySelectionId.has('sel-in-gone-force')).toBe(false);
      expect(capabilityFor(result, 'sel-beta')).toMatchObject(BETA_FACTS);
    });

    it('kein gefuehrter Pfad zeigt auf einen fremden oder leeren Slot (Invariante ueber den ganzen Bestand)', () => {
      const result = evaluateRoster(appRoster([
        force(FORCE_DEF_ID, [
          selection('sel-gone', 'entry-vanished', [selection('sel-gone-child', SWORD_ID)]),
          selection('sel-warrior', WARRIOR_ID, [
            selection('sel-opt-gone', 'opt-vanished'),
            selection('sel-sword', SWORD_ID),
          ]),
          selection('sel-beta', BETA_ID),
        ]),
      ]));
      expectUnresolved(result, ['entry-vanished', 'opt-vanished']);

      const expectedDefIdBySelectionId = {
        'sel-warrior': WARRIOR_ID,
        'sel-sword': SWORD_ID,
        'sel-beta': BETA_ID,
      };
      expect([...result.slots.pathBySelectionId.keys()].sort())
        .toEqual(Object.keys(expectedDefIdBySelectionId).sort());
      for (const [selectionId, defId] of Object.entries(expectedDefIdBySelectionId)) {
        expect(capabilityFor(result, selectionId), selectionId)
          .toMatchObject({ defId, anchorKind: 'occupied' });
      }
    });

    it('ohne Diagnose aendert sich nichts: jede Auswahl aller Ebenen zeigt auf ihren eigenen Slot', () => {
      const result = evaluateRoster(appRoster([
        force(FORCE_DEF_ID, [
          selection('sel-alpha', ALPHA_ID),
          selection('sel-warrior', WARRIOR_ID, [
            selection('sel-sword', SWORD_ID),
            selection('sel-shield', SHIELD_ID),
          ]),
          selection('sel-beta', BETA_ID),
        ]),
      ]));

      expect(result.diagnostics).toEqual([]);
      expect(capabilityFor(result, 'sel-alpha')).toMatchObject(ALPHA_FACTS);
      expect(capabilityFor(result, 'sel-warrior')).toMatchObject({ defId: WARRIOR_ID, name: 'Warrior' });
      expect(capabilityFor(result, 'sel-sword')).toMatchObject({ defId: SWORD_ID, name: 'Sword' });
      expect(capabilityFor(result, 'sel-shield')).toMatchObject({ defId: SHIELD_ID, name: 'Shield' });
      expect(capabilityFor(result, 'sel-beta')).toMatchObject(BETA_FACTS);
    });
  },
);

// ═════════════════════════════════════════════════════════════════════════════
// Die Naht: beide Raender liefern fuer DIESELBE Eingabe DIESELBE Zuordnung.
// Genau ihr Auseinanderlaufen war der Defekt (F1) — dieser Block bindet sie
// aneinander, unabhaengig davon, welche Zuordnung die richtige ist.
// ═════════════════════════════════════════════════════════════════════════════

describe('Editor-Rand und Export-Rand liefern dieselbe Zuordnung (Issue 0121, Task 17)', () => {
  /** Beide Raender auf strukturgleiche, aber getrennte Eingaben angesetzt. */
  function bothEdges(buildRoster) {
    return {
      fromEditor: editorEdge(appSystem(), buildRoster()),
      fromExport: exportEdge(appSystem(), buildRoster()),
    };
  }

  it('mit unaufloesbarer Auswahl: identische pathBySelectionId', () => {
    const buildRoster = () => appRoster([
      force(FORCE_DEF_ID, [
        selection('sel-gone', 'entry-vanished', [selection('sel-gone-child', SWORD_ID)]),
        selection('sel-alpha', ALPHA_ID),
        selection('sel-beta', BETA_ID),
      ]),
    ]);
    const { fromEditor, fromExport } = bothEdges(buildRoster);
    expectUnresolved(fromEditor, ['entry-vanished']);

    expect(fromEditor.slots.pathBySelectionId).toEqual(fromExport.slots.pathBySelectionId);
  });

  it('mit unaufloesbarem Kontingent: identische pathBySelectionId', () => {
    const buildRoster = () => appRoster([
      force('force-vanished', [selection('sel-in-gone-force', ALPHA_ID)]),
      force(SECOND_FORCE_DEF_ID, [selection('sel-beta', BETA_ID)]),
    ]);
    const { fromEditor, fromExport } = bothEdges(buildRoster);
    expectUnresolved(fromEditor, ['force-vanished']);

    expect(fromEditor.slots.pathBySelectionId).toEqual(fromExport.slots.pathBySelectionId);
  });

  it('ohne Diagnose: identische pathBySelectionId (und nicht leer — der Vergleich hat Gegenstand)', () => {
    const buildRoster = () => appRoster([
      force(FORCE_DEF_ID, [
        selection('sel-alpha', ALPHA_ID),
        selection('sel-beta', BETA_ID),
      ]),
    ]);
    const { fromEditor, fromExport } = bothEdges(buildRoster);

    expect(fromEditor.slots.pathBySelectionId.size).toBeGreaterThan(0);
    expect(fromEditor.slots.pathBySelectionId).toEqual(fromExport.slots.pathBySelectionId);
  });
});
