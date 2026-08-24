/**
 * Issue 0085, increment 1 — the raise cost of a slot (`raiseCosts`).
 *
 * Tested intent (from the issue's acceptance criteria, test-first — the field
 * does not exist yet):
 *  1. Every `SlotCapability` carries `raiseCosts: Record<costTypeId, number>`
 *     beside `costs` and `totalCosts`: the effective own cost of one instance
 *     plus, for every MANDATORY child of that slot, that child's raise cost
 *     times the child's EFFECTIVE minimum count, applied recursively.
 *  2. `costs` and `totalCosts` keep their present meaning.
 *  3. The raise cost reads EFFECTIVE values only — cost modifiers and
 *     modifiers on the mandatory-minimum bound that hold in the current state.
 *  4. A slot with no mandatory children reports `raiseCosts` deep-equal to
 *     `costs`.
 *  5. The raise cost terminates on catalogue data that links in a cycle.
 *
 * Every catalogue below is a minimal inline XML template, one rule per case
 * (suite convention, `src/domain/evaluator/CLAUDE.md`). Expected numbers are derived
 * by hand from the catalogue values, never from engine source.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate as evaluateDataset, prepareDataset } from '../../../domain/evaluator/evaluator.js';
import { AnchorKind } from '../../../domain/evaluator/model.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

/** Wertet einen einzelnen synthetischen Katalog ueber die zweistufige Fassade aus. */
function evaluate(catalogueXml, roster) {
  return evaluateDataset(prepareDataset({ catalogues: [catalogueXml] }), roster);
}

/** Der (erste) Faehigkeitsdatensatz einer Definitions-Id, gleich welcher Ankerart. */
function slotByDefId(report, defId) {
  return [...report.capabilities.values()].find(capability => capability.defId === defId);
}

/** Der Angebots-Anker-Slot einer Definitions-Id. */
function offerAnchorByDefId(report, defId) {
  return [...report.capabilities.values()].find(
    capability => capability.defId === defId && capability.anchorKind === AnchorKind.OFFER_ANCHOR,
  );
}

const FORCE_ID = 'force-army';
const POINTS_ID = 'cost-points';

// ─────────────────────────────────────────────────────────────────────────────
// Kriterium 4 (KONTROLLE): ohne Pflicht-Kinder ist raiseCosts === costs.
// ─────────────────────────────────────────────────────────────────────────────

describe('Kriterium 4 (KONTROLLE): ein Slot ohne Pflicht-Kinder zeigt denselben Preis wie heute', () => {
  const ARCHER_ID = 'entry-archer';
  const ARCHER_POINTS = 7;

  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-raise-archer" name="Raise Cost Archer Catalogue">
      <costTypes><costType id="${POINTS_ID}" name="pts"/></costTypes>
      <forceEntries><forceEntry id="${FORCE_ID}" name="Army"/></forceEntries>
      <selectionEntries>
        <selectionEntry id="${ARCHER_ID}" name="Archer" type="unit">
          <costs><cost name="pts" typeId="${POINTS_ID}" value="${ARCHER_POINTS}"/></costs>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('KONTROLLE: raiseCosts entspricht costs an einem Eintrag ohne Kinder', () => {
    const report = evaluate(CATALOGUE_XML, { forces: [{ defId: FORCE_ID, count: 1, children: [] }] });
    const anchor = offerAnchorByDefId(report, ARCHER_ID);

    expect(anchor.raiseCosts).toEqual({ [POINTS_ID]: ARCHER_POINTS });
    expect(anchor.raiseCosts).toEqual(anchor.costs);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Kriterium 1 + 4: eine Einheit ohne eigene Kosten, deren Preis an ihrem
// Pflicht-Modell-Kind haengt (der gemeldete Grave-Guard-Fall).
// ─────────────────────────────────────────────────────────────────────────────

describe('Kriterium 1: die Aushebe-Kosten haengen am Pflicht-Kind, wenn die Einheit selbst keine traegt', () => {
  const REGIMENT_ID = 'entry-regiment';
  const MODEL_ID = 'entry-model';
  const MIN_ID = 'limit-model-min';
  const MODEL_POINTS = 12;
  const MODEL_MIN = 10;

  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-raise-regiment" name="Raise Cost Regiment Catalogue">
      <costTypes><costType id="${POINTS_ID}" name="pts"/></costTypes>
      <forceEntries><forceEntry id="${FORCE_ID}" name="Army"/></forceEntries>
      <selectionEntries>
        <selectionEntry id="${REGIMENT_ID}" name="Regiment" type="unit">
          <selectionEntries>
            <selectionEntry id="${MODEL_ID}" name="Model" type="model">
              <constraints>
                <constraint id="${MIN_ID}" type="min" value="${MODEL_MIN}" field="selections" scope="parent"/>
              </constraints>
              <costs><cost name="pts" typeId="${POINTS_ID}" value="${MODEL_POINTS}"/></costs>
            </selectionEntry>
          </selectionEntries>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('traegt 120 (10 × 12) als raiseCosts, waehrend costs und totalCosts bei 0 bleiben', () => {
    const report = evaluate(CATALOGUE_XML, { forces: [{ defId: FORCE_ID, count: 1, children: [] }] });
    const anchor = offerAnchorByDefId(report, REGIMENT_ID);

    // Kriterium 2: die Bedeutung von costs/totalCosts bleibt unveraendert —
    // das macht den Fall vor der Aenderung rot.
    expect(anchor.costs?.[POINTS_ID] ?? 0).toBe(0);
    expect(anchor.totalCosts?.[POINTS_ID] ?? 0).toBe(0);
    expect(anchor.raiseCosts[POINTS_ID]).toBe(MODEL_MIN * MODEL_POINTS);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Kriterium 1, „rekursiv angewendet": drei Ebenen, jede mit eigenem Pflicht-Kind.
// ─────────────────────────────────────────────────────────────────────────────

describe('Kriterium 1: der Aushebe-Preis rechnet sich rekursiv ueber mehrere Ebenen', () => {
  const REGIMENT_ID = 'entry-regiment-r3';
  const MODEL_ID = 'entry-model-r3';
  const HARNESS_ID = 'entry-harness-r3';
  const MODEL_MIN_ID = 'limit-model-min-r3';
  const HARNESS_MIN_ID = 'limit-harness-min-r3';

  const REGIMENT_POINTS = 4;
  const MODEL_MIN = 2;
  const MODEL_POINTS = 5;
  const HARNESS_MIN = 3;
  const HARNESS_POINTS = 1;

  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-raise-recursive" name="Raise Cost Recursive Catalogue">
      <costTypes><costType id="${POINTS_ID}" name="pts"/></costTypes>
      <forceEntries><forceEntry id="${FORCE_ID}" name="Army"/></forceEntries>
      <selectionEntries>
        <selectionEntry id="${REGIMENT_ID}" name="Regiment" type="unit">
          <costs><cost name="pts" typeId="${POINTS_ID}" value="${REGIMENT_POINTS}"/></costs>
          <selectionEntries>
            <selectionEntry id="${MODEL_ID}" name="Model" type="model">
              <constraints>
                <constraint id="${MODEL_MIN_ID}" type="min" value="${MODEL_MIN}" field="selections" scope="parent"/>
              </constraints>
              <costs><cost name="pts" typeId="${POINTS_ID}" value="${MODEL_POINTS}"/></costs>
              <selectionEntries>
                <selectionEntry id="${HARNESS_ID}" name="Harness" type="upgrade">
                  <constraints>
                    <constraint id="${HARNESS_MIN_ID}" type="min" value="${HARNESS_MIN}" field="selections" scope="parent"/>
                  </constraints>
                  <costs><cost name="pts" typeId="${POINTS_ID}" value="${HARNESS_POINTS}"/></costs>
                </selectionEntry>
              </selectionEntries>
            </selectionEntry>
          </selectionEntries>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('Model traegt 8 (5 + 3×1), Regiment traegt 20 (4 + 2×8)', () => {
    const roster = {
      forces: [{
        defId: FORCE_ID,
        count: 1,
        children: [{
          defId: REGIMENT_ID,
          count: 1,
          children: [{
            defId: MODEL_ID,
            count: MODEL_MIN,
            children: [{ defId: HARNESS_ID, count: HARNESS_MIN, children: [] }],
          }],
        }],
      }],
    };
    const report = evaluate(CATALOGUE_XML, roster);

    const model = slotByDefId(report, MODEL_ID);
    expect(model.raiseCosts[POINTS_ID]).toBe(MODEL_POINTS + HARNESS_MIN * HARNESS_POINTS); // 8

    const regiment = slotByDefId(report, REGIMENT_ID);
    expect(regiment.raiseCosts[POINTS_ID])
      .toBe(REGIMENT_POINTS + MODEL_MIN * (MODEL_POINTS + HARNESS_MIN * HARNESS_POINTS)); // 20
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Kriterium 3: die effektiven Kosten (nach einem feuernden Modifikator).
// ─────────────────────────────────────────────────────────────────────────────

describe('Kriterium 3: der Aushebe-Preis liest effektive Kosten — ein feuernder Modifikator schlaegt durch', () => {
  const REGIMENT_ID = 'entry-regiment-mod';
  const MODEL_ID = 'entry-model-mod';
  const MIN_ID = 'limit-model-min-mod';
  const FORCE_A_ID = 'force-a';
  const FORCE_B_ID = 'force-b';
  const MODEL_MIN = 10;
  const MODEL_POINTS = 12;
  const MODIFIED_MODEL_POINTS = 5;

  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-raise-cost-modifier" name="Raise Cost Modifier Catalogue">
      <costTypes><costType id="${POINTS_ID}" name="pts"/></costTypes>
      <forceEntries>
        <forceEntry id="${FORCE_A_ID}" name="Force A"/>
        <forceEntry id="${FORCE_B_ID}" name="Force B"/>
      </forceEntries>
      <selectionEntries>
        <selectionEntry id="${REGIMENT_ID}" name="Regiment" type="unit">
          <selectionEntries>
            <selectionEntry id="${MODEL_ID}" name="Model" type="model">
              <constraints>
                <constraint id="${MIN_ID}" type="min" value="${MODEL_MIN}" field="selections" scope="parent"/>
              </constraints>
              <costs><cost name="pts" typeId="${POINTS_ID}" value="${MODEL_POINTS}"/></costs>
              <modifiers>
                <modifier type="set" value="${MODIFIED_MODEL_POINTS}" field="${POINTS_ID}">
                  <conditions>
                    <condition type="instanceOf" value="1" field="selections" scope="force" childId="${FORCE_A_ID}" shared="true"/>
                  </conditions>
                </modifier>
              </modifiers>
            </selectionEntry>
          </selectionEntries>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('unter Kontingent A (Modifikator feuert): 50 (10 × 5) statt 120', () => {
    const report = evaluate(CATALOGUE_XML, { forces: [{ defId: FORCE_A_ID, count: 1, children: [] }] });
    const anchor = offerAnchorByDefId(report, REGIMENT_ID);

    expect(anchor.raiseCosts[POINTS_ID]).toBe(MODEL_MIN * MODIFIED_MODEL_POINTS);
  });

  it('unter Kontingent B (Modifikator feuert nicht): 120 (10 × 12), der Katalog-Grundwert', () => {
    const report = evaluate(CATALOGUE_XML, { forces: [{ defId: FORCE_B_ID, count: 1, children: [] }] });
    const anchor = offerAnchorByDefId(report, REGIMENT_ID);

    expect(anchor.raiseCosts[POINTS_ID]).toBe(MODEL_MIN * MODEL_POINTS);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Kriterium 3: die effektive Mindestanzahl (nach einem feuernden Modifikator).
// ─────────────────────────────────────────────────────────────────────────────

describe('Kriterium 3: der Aushebe-Preis liest die effektive Mindestanzahl — ein Modifikator auf die Grenze schlaegt durch', () => {
  const REGIMENT_ID = 'entry-regiment-min';
  const MODEL_ID = 'entry-model-min';
  const MIN_ID = 'limit-model-min-eff';
  const MODEL_POINTS = 12;
  const MODIFIED_MIN = 3;

  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-raise-min-modifier" name="Raise Cost Min Modifier Catalogue">
      <costTypes><costType id="${POINTS_ID}" name="pts"/></costTypes>
      <forceEntries><forceEntry id="${FORCE_ID}" name="Army"/></forceEntries>
      <selectionEntries>
        <selectionEntry id="${REGIMENT_ID}" name="Regiment" type="unit">
          <selectionEntries>
            <selectionEntry id="${MODEL_ID}" name="Model" type="model">
              <constraints>
                <constraint id="${MIN_ID}" type="min" value="10" field="selections" scope="parent"/>
              </constraints>
              <costs><cost name="pts" typeId="${POINTS_ID}" value="${MODEL_POINTS}"/></costs>
              <modifiers>
                <modifier type="set" field="${MIN_ID}" value="${MODIFIED_MIN}"/>
              </modifiers>
            </selectionEntry>
          </selectionEntries>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('rechnet mit der modifizierten Mindestanzahl 3 statt der Katalog-Grenze 10: 36 (3 × 12)', () => {
    const report = evaluate(CATALOGUE_XML, { forces: [{ defId: FORCE_ID, count: 1, children: [] }] });
    const anchor = offerAnchorByDefId(report, REGIMENT_ID);

    expect(anchor.raiseCosts[POINTS_ID]).toBe(MODIFIED_MIN * MODEL_POINTS);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Randfall: eine auf 0 modifizierte Mindestanzahl traegt nichts mehr bei.
// ─────────────────────────────────────────────────────────────────────────────

describe('Randfall: eine auf 0 modifizierte Mindestanzahl macht das Kind wieder unverbindlich', () => {
  const REGIMENT_ID = 'entry-regiment-zero';
  const MODEL_ID = 'entry-model-zero';
  const MIN_ID = 'limit-model-min-zero';

  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-raise-min-zero" name="Raise Cost Min Zero Catalogue">
      <costTypes><costType id="${POINTS_ID}" name="pts"/></costTypes>
      <forceEntries><forceEntry id="${FORCE_ID}" name="Army"/></forceEntries>
      <selectionEntries>
        <selectionEntry id="${REGIMENT_ID}" name="Regiment" type="unit">
          <selectionEntries>
            <selectionEntry id="${MODEL_ID}" name="Model" type="model">
              <constraints>
                <constraint id="${MIN_ID}" type="min" value="10" field="selections" scope="parent"/>
              </constraints>
              <costs><cost name="pts" typeId="${POINTS_ID}" value="12"/></costs>
              <modifiers>
                <modifier type="set" field="${MIN_ID}" value="0"/>
              </modifiers>
            </selectionEntry>
          </selectionEntries>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('das Kind traegt nichts bei: raiseCosts entspricht costs', () => {
    const report = evaluate(CATALOGUE_XML, { forces: [{ defId: FORCE_ID, count: 1, children: [] }] });
    const anchor = offerAnchorByDefId(report, REGIMENT_ID);

    expect(anchor.raiseCosts).toEqual(anchor.costs);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Randfall: mehrere Pflicht-Kinder mit mehreren Kostenarten.
// ─────────────────────────────────────────────────────────────────────────────

describe('Randfall: mehrere Pflicht-Kinder tragen ihre jeweiligen Kostenarten bei — und was nur der Elter deklariert, bleibt eigen', () => {
  const PARENT_ID = 'entry-parent-multi';
  const MEMBER_A_ID = 'entry-member-a-multi';
  const MEMBER_B_ID = 'entry-member-b-multi';
  const MIN_A_ID = 'limit-member-a-min';
  const MIN_B_ID = 'limit-member-b-min';
  const GOLD_ID = 'cost-gold';
  const MANA_ID = 'cost-mana';

  const PARENT_POINTS = 1;
  const PARENT_MANA = 9;
  const MEMBER_A_MIN = 2;
  const MEMBER_A_POINTS = 3;
  const MEMBER_B_MIN = 1;
  const MEMBER_B_POINTS = 2;
  const MEMBER_B_GOLD = 5;

  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-raise-multi-cost" name="Raise Cost Multi Cost Type Catalogue">
      <costTypes>
        <costType id="${POINTS_ID}" name="pts"/>
        <costType id="${GOLD_ID}" name="gold"/>
        <costType id="${MANA_ID}" name="mana"/>
      </costTypes>
      <forceEntries><forceEntry id="${FORCE_ID}" name="Army"/></forceEntries>
      <selectionEntries>
        <selectionEntry id="${PARENT_ID}" name="Parent" type="unit">
          <costs>
            <cost name="pts" typeId="${POINTS_ID}" value="${PARENT_POINTS}"/>
            <cost name="mana" typeId="${MANA_ID}" value="${PARENT_MANA}"/>
          </costs>
          <selectionEntries>
            <selectionEntry id="${MEMBER_A_ID}" name="Member A" type="model">
              <constraints>
                <constraint id="${MIN_A_ID}" type="min" value="${MEMBER_A_MIN}" field="selections" scope="parent"/>
              </constraints>
              <costs><cost name="pts" typeId="${POINTS_ID}" value="${MEMBER_A_POINTS}"/></costs>
            </selectionEntry>
            <selectionEntry id="${MEMBER_B_ID}" name="Member B" type="model">
              <constraints>
                <constraint id="${MIN_B_ID}" type="min" value="${MEMBER_B_MIN}" field="selections" scope="parent"/>
              </constraints>
              <costs>
                <cost name="pts" typeId="${POINTS_ID}" value="${MEMBER_B_POINTS}"/>
                <cost name="gold" typeId="${GOLD_ID}" value="${MEMBER_B_GOLD}"/>
              </costs>
            </selectionEntry>
          </selectionEntries>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('summiert jede Kostenart, die irgendein Kind traegt, und behaelt eine reine Elter-Kostenart unveraendert', () => {
    const report = evaluate(CATALOGUE_XML, { forces: [{ defId: FORCE_ID, count: 1, children: [] }] });
    const anchor = offerAnchorByDefId(report, PARENT_ID);

    expect(anchor.raiseCosts).toEqual({
      [POINTS_ID]: PARENT_POINTS + MEMBER_A_MIN * MEMBER_A_POINTS + MEMBER_B_MIN * MEMBER_B_POINTS, // 9
      [GOLD_ID]: MEMBER_B_MIN * MEMBER_B_GOLD, // 5 — nur von Member B deklariert
      [MANA_ID]: PARENT_MANA, // 9 — nur vom Elter deklariert, kein Kind traegt bei
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Kriterium 5: der Aushebe-Preis terminiert auf einem Zyklus.
// ─────────────────────────────────────────────────────────────────────────────

describe('Kriterium 5: der Aushebe-Preis terminiert auf Katalogdaten mit einem Zyklus', () => {
  const A_ID = 'entry-cycle-a';
  const B_ID = 'entry-cycle-b';
  const ROOT_LINK_ID = 'link-cycle-root';
  const A_TO_B_LINK_ID = 'link-a-to-b';
  const B_TO_A_LINK_ID = 'link-b-to-a';
  const A_POINTS = 5;

  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-raise-cycle" name="Raise Cost Cycle Catalogue">
      <costTypes><costType id="${POINTS_ID}" name="pts"/></costTypes>
      <forceEntries><forceEntry id="${FORCE_ID}" name="Army"/></forceEntries>
      <entryLinks>
        <entryLink id="${ROOT_LINK_ID}" name="A" targetId="${A_ID}" type="selectionEntry"/>
      </entryLinks>
      <sharedSelectionEntries>
        <selectionEntry id="${A_ID}" name="A" type="unit">
          <costs><cost name="pts" typeId="${POINTS_ID}" value="${A_POINTS}"/></costs>
          <entryLinks>
            <entryLink id="${A_TO_B_LINK_ID}" name="B" targetId="${B_ID}" type="selectionEntry">
              <constraints>
                <constraint type="min" value="1" field="selections" scope="parent"/>
              </constraints>
            </entryLink>
          </entryLinks>
        </selectionEntry>
        <selectionEntry id="${B_ID}" name="B" type="unit">
          <entryLinks>
            <entryLink id="${B_TO_A_LINK_ID}" name="A" targetId="${A_ID}" type="selectionEntry">
              <constraints>
                <constraint type="min" value="1" field="selections" scope="parent"/>
              </constraints>
            </entryLink>
          </entryLinks>
        </selectionEntry>
      </sharedSelectionEntries>
    </catalogue>`;

  it('liefert eine endliche Zahl statt zu haengen oder den Stapel zu sprengen', () => {
    const report = evaluate(CATALOGUE_XML, { forces: [{ defId: FORCE_ID, count: 1, children: [] }] });
    const anchor = offerAnchorByDefId(report, ROOT_LINK_ID);

    expect(anchor).toBeTruthy();
    expect(Number.isFinite(anchor.raiseCosts[POINTS_ID])).toBe(true);
  }, 5000);
});

// ─────────────────────────────────────────────────────────────────────────────
// Kriterium 9 (KONTROLLE): Optionslisten (belegte, nicht-verpflichtende Slots)
// bleiben bei ihrem eigenen Preis.
// ─────────────────────────────────────────────────────────────────────────────

describe('Kriterium 9 (KONTROLLE): eine optionale Kindauswahl zeigt weiterhin ihren eigenen Preis', () => {
  const REGIMENT_ID = 'entry-regiment-opt';
  const UPGRADE_ID = 'entry-upgrade-opt';
  const UPGRADE_POINTS = 6;

  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-raise-optional" name="Raise Cost Optional Catalogue">
      <costTypes><costType id="${POINTS_ID}" name="pts"/></costTypes>
      <forceEntries><forceEntry id="${FORCE_ID}" name="Army"/></forceEntries>
      <selectionEntries>
        <selectionEntry id="${REGIMENT_ID}" name="Regiment" type="unit">
          <selectionEntries>
            <selectionEntry id="${UPGRADE_ID}" name="Banner" type="upgrade">
              <constraints>
                <constraint type="max" value="1" field="selections" scope="parent"/>
              </constraints>
              <costs><cost name="pts" typeId="${POINTS_ID}" value="${UPGRADE_POINTS}"/></costs>
            </selectionEntry>
          </selectionEntries>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('KONTROLLE: raiseCosts der optionalen Option entspricht ihren costs', () => {
    const roster = { forces: [{ defId: FORCE_ID, count: 1, children: [{ defId: REGIMENT_ID, count: 1, children: [] }] }] };
    const report = evaluate(CATALOGUE_XML, roster);
    const upgrade = slotByDefId(report, UPGRADE_ID);

    expect(upgrade.raiseCosts).toEqual(upgrade.costs);
    expect(upgrade.raiseCosts).toEqual({ [POINTS_ID]: UPGRADE_POINTS });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Kriterium 10 (KONTROLLE): ein Angebot bleibt ausserhalb jeder Summe.
// ─────────────────────────────────────────────────────────────────────────────

describe('Kriterium 10 (KONTROLLE): ein Angebot traegt zu keiner Summe bei und meldet keine Verletzung', () => {
  const REGIMENT_ID = 'entry-regiment-offer-only';
  const MODEL_ID = 'entry-model-offer-only';
  const MIN_ID = 'limit-model-offer-only-min';

  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-raise-offer-only" name="Raise Cost Offer Only Catalogue">
      <costTypes><costType id="${POINTS_ID}" name="pts"/></costTypes>
      <forceEntries><forceEntry id="${FORCE_ID}" name="Army"/></forceEntries>
      <selectionEntries>
        <selectionEntry id="${REGIMENT_ID}" name="Regiment" type="unit">
          <selectionEntries>
            <selectionEntry id="${MODEL_ID}" name="Model" type="model">
              <constraints>
                <constraint id="${MIN_ID}" type="min" value="10" field="selections" scope="parent"/>
              </constraints>
              <costs><cost name="pts" typeId="${POINTS_ID}" value="12"/></costs>
            </selectionEntry>
          </selectionEntries>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  it('KONTROLLE: costTotals bleibt 0 und keine Verletzung nennt den unausgewaehlten Slot', () => {
    const report = evaluate(CATALOGUE_XML, { forces: [{ defId: FORCE_ID, count: 1, children: [] }] });

    expect(report.costTotals?.[POINTS_ID]).toBe(0);
    expect(report.violations.some(violation => violation.defId === REGIMENT_ID || violation.defId === MODEL_ID)).toBe(false);
  });
});
