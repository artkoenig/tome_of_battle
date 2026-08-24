/**
 * Issue 0121, Task 2 — produktiver Roster-Adapter `toEvaluatorRoster`
 * (`src/domain/evaluation/rosterAdapter.js`, existiert noch nicht; test-first).
 *
 * Der Adapter uebersetzt das App-Roster (IndexedDB-Modell, `src/domain/types.js`) in
 * den Eingabevertrag der Evaluator-Fassade (`src/domain/evaluator/evaluator.js`,
 * `@param roster`) und liefert daneben `pathBySelectionId`: die Zuordnung
 * App-Selection-UUID → Slot-Pfad des Berichts.
 *
 * Massgebliche Regeln aus der Intention:
 * - Force → `{ defId: forceEntryId, count: 1, children }`;
 *   Selection → `{ defId: entryLinkId || selectionEntryId, count: number,
 *   children }`. Link-Id-Regel (Issue 084): eine ueber einen `entryLink`
 *   gesetzte Auswahl geht unter der **Link**-Id, nie unter der Ziel-Id —
 *   kein Rueckfall.
 * - `costLimits = [{ costTypeId: roster.costLimitType, value:
 *   roster.costLimit }]`; `-1` (= unbegrenzt) wird unveraendert durchgereicht.
 * - Verschachtelte `selections` werden vollstaendig rekursiv abgebildet.
 * - Der Adapter ist rein: das App-Roster wird nicht mutiert.
 *
 * Vertragsentscheidungen dieses Tests (in der Intention offen gelassen,
 * hier festgelegt und im Testnamen markiert):
 * - Fehlender `costLimitType` (null/undefined) ⇒ KEINE costLimits-Zeile;
 *   ob `costLimits` dann `[]` oder ganz fehlt, laesst der Test offen
 *   (die Fassade behandelt beides gleich: leeres Budget).
 * - Leere Selektionsliste ⇒ keine Kind-Zeilen; ob `children` `[]` oder
 *   fehlend ist, laesst der Test offen.
 * - `pathBySelectionId` darf eine `Map` oder ein einfaches Objekt sein;
 *   der Test liest beide Formen (Helfer `pathFor`).
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { prepareDataset, evaluate } from '../../../domain/evaluator/evaluator.js';
import { toEvaluatorRoster } from '../../../domain/evaluation/rosterAdapter.js';

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit (Konvention der
// Evaluator-Tests, z. B. `evaluator.rosterContract.test.js`).
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

// ── App-Roster-Bausteine (Shape aus src/domain/types.js) ───────────────────────────

/** Eine App-Selection mit allen Pflichtfeldern aus `src/domain/types.js`. */
function appSelection({
  id,
  name = 'Selection',
  entryLinkId = null,
  selectionEntryId,
  number = 1,
  selections = [],
}) {
  return { id, name, entryLinkId, selectionEntryId, number, category: null, selections };
}

/** Eine App-Force mit allen Pflichtfeldern aus `src/domain/types.js`. */
function appForce({ id, forceEntryId, catalogueId = 'cat-main', selections = [] }) {
  return { id, forceEntryId, catalogueId, selections };
}

/** Ein vollstaendiges App-Roster mit allen Pflichtfeldern aus `src/domain/types.js`. */
function appRoster({
  costLimit = 1500,
  costLimitType = 'cost-pts',
  forces = [],
} = {}) {
  return {
    id: 'roster-uuid',
    name: 'Test Roster',
    systemId: 'system-uuid',
    catalogueId: 'cat-main',
    costLimit,
    costLimitType,
    forces,
  };
}

// ── Helfer ──────────────────────────────────────────────────────────────────

/**
 * Reduziert einen Knoten des Evaluator-Rosters auf die vertraglich geforderten
 * Felder (`defId`, `count`, rekursiv `children`). So prueft der Vergleich die
 * Abbildung exakt, ohne zusaetzliche Felder des Adapters zu verbieten;
 * fehlendes `children` und `[]` gelten als gleich (Vertragsentscheidung, s. o.).
 */
function normalizeNode(node) {
  return {
    defId: node.defId,
    count: node.count,
    children: (node.children ?? []).map(normalizeNode),
  };
}

/** Liest einen Slot-Pfad aus `pathBySelectionId` — Map oder einfaches Objekt. */
function pathFor(pathBySelectionId, selectionId) {
  return pathBySelectionId instanceof Map
    ? pathBySelectionId.get(selectionId)
    : pathBySelectionId?.[selectionId];
}

// ═════════════════════════════════════════════════════════════════════════════
// Kriterium 1: Strukturabbildung
// ═════════════════════════════════════════════════════════════════════════════

describe('toEvaluatorRoster: Strukturabbildung App-Roster → Evaluator-Vertrag', () => {
  it('bildet eine Force auf { defId: forceEntryId, count: 1 } ab', () => {
    const { evalRoster } = toEvaluatorRoster(
      appRoster({ forces: [appForce({ id: 'force-uuid-1', forceEntryId: 'force-def-a' })] }),
    );

    expect(evalRoster.forces).toHaveLength(1);
    expect(evalRoster.forces[0]).toMatchObject({ defId: 'force-def-a', count: 1 });
  });

  it('bildet eine verweislose Selection auf { defId: selectionEntryId, count: number } ab', () => {
    const { evalRoster } = toEvaluatorRoster(
      appRoster({
        forces: [
          appForce({
            id: 'force-uuid-1',
            forceEntryId: 'force-def-a',
            selections: [
              appSelection({ id: 'sel-uuid-1', selectionEntryId: 'entry-warrior', number: 3 }),
            ],
          }),
        ],
      }),
    );

    expect(evalRoster.forces[0].children).toHaveLength(1);
    expect(evalRoster.forces[0].children[0]).toMatchObject({ defId: 'entry-warrior', count: 3 });
  });

  it('Link-Id-Regel (Issue 084): eine per entryLink gesetzte Selection geht unter der Link-Id, nie unter der Ziel-Id', () => {
    const { evalRoster } = toEvaluatorRoster(
      appRoster({
        forces: [
          appForce({
            id: 'force-uuid-1',
            forceEntryId: 'force-def-a',
            selections: [
              appSelection({
                id: 'sel-uuid-1',
                entryLinkId: 'link-shield',
                selectionEntryId: 'shared-shield',
                number: 1,
              }),
            ],
          }),
        ],
      }),
    );

    const child = evalRoster.forces[0].children[0];
    expect(child.defId).toBe('link-shield');
    // Kein Rueckfall auf die Ziel-Id — auch nicht zusaetzlich daneben.
    expect(child.defId).not.toBe('shared-shield');
    expect(evalRoster.forces[0].children).toHaveLength(1);
  });

  it('nutzt die selectionEntryId nur, wenn kein Verweis im Spiel ist (entryLinkId null)', () => {
    const { evalRoster } = toEvaluatorRoster(
      appRoster({
        forces: [
          appForce({
            id: 'force-uuid-1',
            forceEntryId: 'force-def-a',
            selections: [
              appSelection({
                id: 'sel-uuid-1',
                entryLinkId: null,
                selectionEntryId: 'entry-warrior',
                number: 1,
              }),
            ],
          }),
        ],
      }),
    );

    expect(evalRoster.forces[0].children[0].defId).toBe('entry-warrior');
  });

  it('bildet ein Roster ohne Forces auf leere forces ab (Rand: leeres Roster)', () => {
    const { evalRoster } = toEvaluatorRoster(appRoster({ forces: [] }));

    expect(evalRoster.forces).toEqual([]);
  });

  it('erhaelt mehrere Forces in ihrer Reihenfolge, jede mit count 1', () => {
    const { evalRoster } = toEvaluatorRoster(
      appRoster({
        forces: [
          appForce({ id: 'force-uuid-1', forceEntryId: 'force-def-a' }),
          appForce({ id: 'force-uuid-2', forceEntryId: 'force-def-b' }),
        ],
      }),
    );

    expect(evalRoster.forces.map(normalizeNode)).toEqual([
      { defId: 'force-def-a', count: 1, children: [] },
      { defId: 'force-def-b', count: 1, children: [] },
    ]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Kriterium 2: Kostengrenzen
// ═════════════════════════════════════════════════════════════════════════════

describe('toEvaluatorRoster: Kostengrenzen', () => {
  it('bildet costLimitType/costLimit auf genau eine costLimits-Zeile ab', () => {
    const { evalRoster } = toEvaluatorRoster(
      appRoster({ costLimitType: 'cost-pts', costLimit: 1500 }),
    );

    expect(evalRoster.costLimits).toEqual([{ costTypeId: 'cost-pts', value: 1500 }]);
  });

  it('reicht -1 (= unbegrenzt) unveraendert durch', () => {
    const { evalRoster } = toEvaluatorRoster(
      appRoster({ costLimitType: 'cost-pts', costLimit: -1 }),
    );

    expect(evalRoster.costLimits).toEqual([{ costTypeId: 'cost-pts', value: -1 }]);
  });

  it('Vertragsentscheidung: costLimitType null ⇒ keine costLimits-Zeile', () => {
    const { evalRoster } = toEvaluatorRoster(
      appRoster({ costLimitType: null, costLimit: 1500 }),
    );

    expect(evalRoster.costLimits ?? []).toEqual([]);
  });

  it('Vertragsentscheidung: costLimitType undefined ⇒ keine costLimits-Zeile', () => {
    const roster = appRoster({ costLimit: 1500 });
    delete roster.costLimitType;

    const { evalRoster } = toEvaluatorRoster(roster);

    expect(evalRoster.costLimits ?? []).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Kriterium 3: Rekursion
// ═════════════════════════════════════════════════════════════════════════════

describe('toEvaluatorRoster: Rekursion ueber verschachtelte Selektionen', () => {
  it('bildet zwei Verschachtelungsebenen vollstaendig als children ab (inkl. Link-Id-Regel in der Tiefe)', () => {
    const { evalRoster } = toEvaluatorRoster(
      appRoster({
        forces: [
          appForce({
            id: 'force-uuid-1',
            forceEntryId: 'force-def-a',
            selections: [
              appSelection({
                id: 'sel-warrior',
                selectionEntryId: 'entry-warrior',
                number: 2,
                selections: [
                  appSelection({
                    id: 'sel-champion',
                    selectionEntryId: 'entry-champion',
                    number: 1,
                    selections: [
                      appSelection({
                        id: 'sel-shield',
                        entryLinkId: 'link-shield',
                        selectionEntryId: 'shared-shield',
                        number: 1,
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    );

    expect(evalRoster.forces.map(normalizeNode)).toEqual([
      {
        defId: 'force-def-a',
        count: 1,
        children: [
          {
            defId: 'entry-warrior',
            count: 2,
            children: [
              {
                defId: 'entry-champion',
                count: 1,
                children: [{ defId: 'link-shield', count: 1, children: [] }],
              },
            ],
          },
        ],
      },
    ]);
  });

  it('Vertragsentscheidung: leere Selektionsliste ⇒ keine Kind-Zeilen (children leer oder fehlend)', () => {
    const { evalRoster } = toEvaluatorRoster(
      appRoster({
        forces: [
          appForce({
            id: 'force-uuid-1',
            forceEntryId: 'force-def-a',
            selections: [
              appSelection({ id: 'sel-uuid-1', selectionEntryId: 'entry-warrior', number: 1 }),
            ],
          }),
        ],
      }),
    );

    expect(evalRoster.forces[0].children[0].children ?? []).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Kriterium 4: pathBySelectionId — Integration gegen die echte Fassade
// ═════════════════════════════════════════════════════════════════════════════

// Kleiner synthetischer Datensatz nach dem Muster der Evaluator-Tests: ein
// Kontingent, eine Wurzel-Einheit mit verschachteltem Kind, ein geteilter
// Eintrag, erreichbar allein ueber einen `entryLink`.
const GAME_SYSTEM_ID = 'gs-main';
const FORCE_DEF_ID = 'force-main';
const WARRIOR_ID = 'entry-warrior';
const CHAMPION_ID = 'entry-champion';
const LINK_ID = 'link-shield';
const TARGET_ID = 'shared-shield';
const COST_TYPE_ID = 'cost-pts';

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
    </forceEntries>
    <selectionEntries>
      <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit">
        <selectionEntries>
          <selectionEntry id="${CHAMPION_ID}" name="Champion" type="upgrade"/>
        </selectionEntries>
      </selectionEntry>
    </selectionEntries>
    <entryLinks>
      <entryLink id="${LINK_ID}" name="Shield" targetId="${TARGET_ID}" type="selectionEntry"/>
    </entryLinks>
    <sharedSelectionEntries>
      <selectionEntry id="${TARGET_ID}" name="Shield" type="upgrade"/>
    </sharedSelectionEntries>
  </catalogue>`;

/**
 * Ein App-Roster mit allen drei geforderten Konstellationen:
 * - zwei Instanzen desselben Eintrags als getrennte App-Selektionen
 *   (`sel-warrior-1`, `sel-warrior-2`),
 * - eine verschachtelte Selektion (`sel-champion` unter `sel-warrior-1`),
 * - eine ueber einen entryLink gesetzte Selektion (`sel-shield`).
 */
function integrationAppRoster() {
  return appRoster({
    costLimit: 10000,
    costLimitType: COST_TYPE_ID,
    forces: [
      appForce({
        id: 'force-uuid-1',
        forceEntryId: FORCE_DEF_ID,
        selections: [
          appSelection({
            id: 'sel-warrior-1',
            selectionEntryId: WARRIOR_ID,
            number: 1,
            selections: [
              appSelection({ id: 'sel-champion', selectionEntryId: CHAMPION_ID, number: 1 }),
            ],
          }),
          appSelection({ id: 'sel-warrior-2', selectionEntryId: WARRIOR_ID, number: 1 }),
          appSelection({
            id: 'sel-shield',
            entryLinkId: LINK_ID,
            selectionEntryId: TARGET_ID,
            number: 1,
          }),
        ],
      }),
    ],
  });
}

/** Erwartete Katalog-Definition je App-Selection-UUID (Link-Id-Regel inklusive). */
const EXPECTED_DEF_ID_BY_SELECTION_ID = {
  'sel-warrior-1': WARRIOR_ID,
  'sel-warrior-2': WARRIOR_ID,
  'sel-champion': CHAMPION_ID,
  'sel-shield': LINK_ID,
};

describe('toEvaluatorRoster: pathBySelectionId gegen den echten Bericht der Fassade', () => {
  /** Ein Durchlauf Adapter → Fassade, den sich die Integrations-Tests teilen. */
  function adaptAndEvaluate() {
    const prepared = prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [CATALOGUE_XML] });
    const { evalRoster, pathBySelectionId } = toEvaluatorRoster(integrationAppRoster());
    const report = evaluate(prepared, evalRoster);
    return { report, pathBySelectionId };
  }

  it('das uebersetzte Roster wird von der Engine ohne unresolvedDefinition-Diagnose angenommen', () => {
    const { report } = adaptAndEvaluate();

    expect(
      report.diagnostics.filter(diagnostic => diagnostic.kind === 'unresolvedDefinition'),
    ).toEqual([]);
  });

  it('liefert fuer JEDE App-Selection-UUID einen Pfad, der als Schluessel in capabilities existiert', () => {
    const { report, pathBySelectionId } = adaptAndEvaluate();

    for (const selectionId of Object.keys(EXPECTED_DEF_ID_BY_SELECTION_ID)) {
      const path = pathFor(pathBySelectionId, selectionId);
      expect(path, `Pfad fuer ${selectionId}`).toBeDefined();
      expect(report.capabilities.has(path), `capabilities-Schluessel fuer ${selectionId}: ${path}`).toBe(true);
    }
  });

  it('die Capability am Pfad traegt je Selection die erwartete defId und ist ein belegter Slot', () => {
    const { report, pathBySelectionId } = adaptAndEvaluate();

    for (const [selectionId, expectedDefId] of Object.entries(EXPECTED_DEF_ID_BY_SELECTION_ID)) {
      const capability = report.capabilities.get(pathFor(pathBySelectionId, selectionId));
      expect(capability?.defId, `defId am Slot von ${selectionId}`).toBe(expectedDefId);
      // "belegt": der Wortlaut des Berichts-Vokabulars (AnchorKind.OCCUPIED der
      // Engine; die Fassade exportiert das Enum nicht, der String ist der
      // Berichtswert). Ein Angebots-Anker derselben defId waere die falsche
      // Zuordnung.
      expect(capability?.anchorKind, `anchorKind am Slot von ${selectionId}`).toBe('occupied');
    }
  });

  it('zwei Instanzen desselben Eintrags: beide UUIDs zeigen auf existierende, korrekte Slots (Zusammenfassung erlaubt)', () => {
    const { report, pathBySelectionId } = adaptAndEvaluate();

    const pathA = pathFor(pathBySelectionId, 'sel-warrior-1');
    const pathB = pathFor(pathBySelectionId, 'sel-warrior-2');

    // Beide muessen aufloesen — fasst die Engine gleiche Definitionen in einem
    // Slot zusammen, duerfen die Pfade identisch sein; gefordert ist die
    // defId-Korrektheit je Pfad, nicht die Eindeutigkeit.
    for (const path of [pathA, pathB]) {
      expect(path).toBeDefined();
      expect(report.capabilities.has(path)).toBe(true);
      expect(report.capabilities.get(path).defId).toBe(WARRIOR_ID);
    }
  });

  it('die verschachtelte Selektion zeigt auf einen anderen Slot als ihre Eltern-Selektion', () => {
    const { pathBySelectionId } = adaptAndEvaluate();

    // Champion und Warrior sind verschiedene Definitionen — ihre Slots koennen
    // nie zusammenfallen.
    expect(pathFor(pathBySelectionId, 'sel-champion')).not.toBe(
      pathFor(pathBySelectionId, 'sel-warrior-1'),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Kriterium 5: Reinheit — der Adapter mutiert das App-Roster nicht
// ═════════════════════════════════════════════════════════════════════════════

/** Friert ein Objekt samt aller erreichbaren Kinder ein. */
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

describe('toEvaluatorRoster: Reinheit', () => {
  it('arbeitet auf einem tief eingefrorenen App-Roster ohne Fehler', () => {
    const frozen = deepFreeze(integrationAppRoster());

    expect(() => toEvaluatorRoster(frozen)).not.toThrow();
  });

  it('laesst das App-Roster vor/nach dem Aufruf tief-gleich (kein Einschreiben von Ergebnissen)', () => {
    const roster = integrationAppRoster();
    const before = structuredClone(roster);

    toEvaluatorRoster(roster);

    expect(roster).toEqual(before);
  });
});
