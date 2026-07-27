/**
 * Der Bezugsrahmen `scope="primary-catalogue"` (Issue 77,
 * `docs/battlescribe-data-format.md` §7.7) — **kein Zaehlrahmen**, sondern die
 * Frage „ist der Armee-Katalog des Kontingents, in dem dieser Knoten sitzt, der
 * genannte Katalog?".
 *
 * Zwei Nahtstellen werden hier festgenagelt:
 *
 * 1. **das Query-Primitiv** (`query.js`) — die Antwort `1`/`0`, ihre
 *    Flag-Unabhaengigkeit, der {@link UNRESOLVED_QUERY}-Sentinel, wenn der
 *    primaere Katalog nicht entscheidbar ist, und die Diagnose dazu: gemeldet
 *    **wenn eine Regel fragt**, und dann in jedem Fall — auch ueber gar keinem
 *    Kontingent;
 * 2. **die Join-Schicht** (`evalTree.js`) — die Bindung je Kontingent gegen die
 *    Kataloge des Datensatzes, an **jedem** Knoten in derselben Form.
 *
 * Dazu die Wirkung durch die oeffentliche Fassade: dieselbe Auswahl in zwei
 * verschiedenen Kontingenten muss ein **gegenlaeufiges** Ergebnis liefern — nur
 * dieser Kontrast belegt, dass der Rahmen ueberhaupt gelesen wurde.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate, prepareDataset } from './evaluator.js';
import { parseCatalogue } from './catalogReader.js';
import { mergeCatalogues } from './catalogSet.js';
import { resolveCatalogue } from './resolver.js';
import { buildEvalTree, primaryCatalogueOf, allNodes } from './evalTree.js';
import { buildIndex } from './countIndex.js';
import { createBaseEffectiveState } from './effectiveState.js';
import { query, createQueryContext } from './query.js';
import {
  SELECTION_COUNT,
  costSumField,
  ScopeKeyword,
  UNRESOLVED_QUERY,
  DiagnosticKind,
  PrimaryCatalogueUnresolvedReason,
} from './model.js';

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit (wie in den uebrigen
// Evaluator-Tests). Der eigene XML-Leser der Engine nutzt genau dieses Primitiv.
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

// ── Eigene, minimale Fixtures (ADR-0030) ─────────────────────────────────────
// Zwei Armee-Kataloge und eine geteilte Bibliothek — die Anordnung, in der der
// Bezugsrahmen in den echten Daten vorkommt: die gegatete Regel steht in der
// Bibliothek, fragt aber nach der Armee, die den Eintrag anwirbt.

const ARMY_A_CATALOGUE_ID = 'cat-army-a';
const ARMY_B_CATALOGUE_ID = 'cat-army-b';
const LIBRARY_CATALOGUE_ID = 'cat-library';
const UNKNOWN_CATALOGUE_ID = 'cat-not-in-dataset';

const FORCE_A_ID = 'force-a';
const FORCE_B_ID = 'force-b';
const MERCENARY_ID = 'entry-mercenary';
const MERCENARY_MAX_ID = 'limit-mercenary-max';

const MERCENARY_MAX = 1;
const UNLIMITED_VALUE = -1;
const CHOSEN_MERCENARIES = 2;

/**
 * Die Bibliothek: ein Soeldner-Eintrag mit einer Kontingent-Obergrenze, die ein
 * Modifikator **nur in Armee A** auf unbegrenzt hebt.
 */
const LIBRARY_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="${LIBRARY_CATALOGUE_ID}" name="Shared Library" library="true">
    <selectionEntries>
      <selectionEntry id="${MERCENARY_ID}" name="Mercenary" type="unit">
        <constraints>
          <constraint id="${MERCENARY_MAX_ID}" type="max" value="${MERCENARY_MAX}" field="selections" scope="force" shared="true"/>
        </constraints>
        <modifiers>
          <modifier type="set" field="${MERCENARY_MAX_ID}" value="${UNLIMITED_VALUE}">
            <conditions>
              <condition type="instanceOf" field="selections" scope="primary-catalogue" childId="${ARMY_A_CATALOGUE_ID}" value="1" shared="true"/>
            </conditions>
          </modifier>
        </modifiers>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

const ARMY_A_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="${ARMY_A_CATALOGUE_ID}" name="Army A">
    <forceEntries><forceEntry id="${FORCE_A_ID}" name="Force A"/></forceEntries>
  </catalogue>`;

const ARMY_B_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="${ARMY_B_CATALOGUE_ID}" name="Army B">
    <forceEntries><forceEntry id="${FORCE_B_ID}" name="Force B"/></forceEntries>
  </catalogue>`;

/** Der Datensatz traegt **beide** Armee-Kataloge — die Antwort kann also nicht daher stammen, welcher geladen ist. */
const DATASET = { catalogues: [ARMY_A_XML, ARMY_B_XML, LIBRARY_XML] };

/** Ein Kontingent mit seinem Armee-Katalog und den gewaehlten Soeldnern. */
function force(forceDefId, catalogueId, mercenaryCount = CHOSEN_MERCENARIES) {
  return {
    defId: forceDefId,
    catalogueId,
    count: 1,
    children: [{ defId: MERCENARY_ID, count: mercenaryCount, children: [] }],
  };
}

/** Die Verletzungen der Soeldner-Obergrenze im Bericht eines Rosters. */
function mercenaryViolationsOf(forces) {
  const report = evaluate(prepareDataset(DATASET), { forces });
  return {
    report,
    violations: report.violations.filter(violation => violation.limitId === MERCENARY_MAX_ID),
  };
}

describe('primary-catalogue: die Bedingung wird gegen den Armee-Katalog des Kontingents entschieden', () => {
  it('hebt die Grenze in der genannten Armee auf unbegrenzt — sie feuert nicht', () => {
    const { violations } = mercenaryViolationsOf([force(FORCE_A_ID, ARMY_A_CATALOGUE_ID)]);

    expect(violations).toHaveLength(0);
  });

  it('laesst die Grenze in einer anderen Armee stehen — sie feuert', () => {
    const { violations } = mercenaryViolationsOf([force(FORCE_B_ID, ARMY_B_CATALOGUE_ID)]);

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ actual: CHOSEN_MERCENARIES, bound: MERCENARY_MAX });
  });

  it('beantwortet den Rahmen je Kontingent: zwei Kontingente in einem Roster, genau eine Verletzung', () => {
    const { violations } = mercenaryViolationsOf([
      force(FORCE_A_ID, ARMY_A_CATALOGUE_ID),
      force(FORCE_B_ID, ARMY_B_CATALOGUE_ID),
    ]);

    // Eine je-Roster- oder je-Datensatz-Antwort ergaebe zwangslaeufig 0 oder 2.
    expect(violations).toHaveLength(1);
  });

  it('meldet fuer ein entscheidbares Kontingent weder eine unaufloesbare Rahmen- noch eine Katalog-Diagnose', () => {
    const { report } = mercenaryViolationsOf([force(FORCE_A_ID, ARMY_A_CATALOGUE_ID)]);

    expect(report.diagnostics.filter(entry => entry.kind === DiagnosticKind.UNRESOLVED_SCOPE)).toHaveLength(0);
    expect(report.diagnostics.filter(entry => entry.kind === DiagnosticKind.UNRESOLVED_PRIMARY_CATALOGUE)).toHaveLength(0);
  });
});

describe('primary-catalogue: ein nicht entscheidbares Kontingent wird gemeldet und wertet fail-closed', () => {
  it('meldet ein Kontingent ohne Katalog-Angabe — und die Grenze bleibt stehen', () => {
    const { report, violations } = mercenaryViolationsOf([
      { defId: FORCE_A_ID, count: 1, children: [{ defId: MERCENARY_ID, count: CHOSEN_MERCENARIES, children: [] }] },
    ]);

    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({
        kind: DiagnosticKind.UNRESOLVED_PRIMARY_CATALOGUE,
        forceDefId: FORCE_A_ID,
        reason: PrimaryCatalogueUnresolvedReason.NOT_DECLARED,
      }),
    );
    // Fail-closed: die `instanceOf`-Bedingung haelt nicht, der Modifikator greift nicht.
    expect(violations).toHaveLength(1);
  });

  it('meldet eine Katalog-Angabe, die keinen Katalog des Datensatzes benennt', () => {
    const { report } = mercenaryViolationsOf([force(FORCE_A_ID, UNKNOWN_CATALOGUE_ID)]);

    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({
        kind: DiagnosticKind.UNRESOLVED_PRIMARY_CATALOGUE,
        forceDefId: FORCE_A_ID,
        catalogueId: UNKNOWN_CATALOGUE_ID,
        reason: PrimaryCatalogueUnresolvedReason.UNKNOWN_CATALOGUE,
      }),
    );
  });

  it('meldet **nur, wenn eine Regel fragt** — ein Kontingent ohne solche Regel hat keinen Mangel', () => {
    // Derselbe Fehler im Roster (Kontingent ohne Katalog-Angabe), aber ein
    // Datensatz **ohne** die Bibliothek: keine Regel benutzt den Bezugsrahmen. Dann
    // ist die fehlende Angabe folgenlos, und der Bericht wirft dem Kontingent
    // nichts vor — dasselbe Verhalten wie bei der nicht aufloesbaren Kostengrenze,
    // die erst erscheint, wenn jemand fragt.
    const report = evaluate(prepareDataset({ catalogues: [ARMY_A_XML, ARMY_B_XML] }), {
      forces: [{ defId: FORCE_A_ID, count: 1, children: [] }],
    });

    expect(report.diagnostics.filter(entry => entry.kind === DiagnosticKind.UNRESOLVED_PRIMARY_CATALOGUE)).toHaveLength(0);
  });
});

// ── Das Query-Primitiv selbst ────────────────────────────────────────────────

/**
 * Baut Baum und Index eines Rosters — ueber denselben Vorlauf wie die Fassade
 * (lesen → zusammenfuehren → aufloesen) — und liefert einen Query-Kontext am
 * Soeldner-Knoten des ersten Kontingents.
 */
function contextAtMercenary(forces) {
  const documents = DATASET.catalogues.map(parseCatalogue);
  const resolved = resolveCatalogue(mergeCatalogues(documents));
  const catalogueIds = new Set(documents.map(document => document.id));
  const { root, diagnostics: joinDiagnostics } = buildEvalTree(resolved, { forces }, catalogueIds);
  const index = buildIndex(root, createBaseEffectiveState(root));
  const diagnostics = [];
  const mercenaryNode = root.children[0].children[0];
  return {
    ctx: createQueryContext({ node: mercenaryNode, root, index, categoryIds: resolved.categoryIds, diagnostics }),
    diagnostics,
    joinDiagnostics,
    mercenaryNode,
  };
}

describe('query: der Bezugsrahmen primary-catalogue antwortet ohne Zaehlung', () => {
  const ANSWER_YES = 1;
  const ANSWER_NO = 0;

  it('antwortet 1, wenn der primaere Katalog der genannte ist', () => {
    const { ctx, diagnostics } = contextAtMercenary([force(FORCE_A_ID, ARMY_A_CATALOGUE_ID)]);

    expect(query(ctx, SELECTION_COUNT, ScopeKeyword.PRIMARY_CATALOGUE, ARMY_A_CATALOGUE_ID, { shared: true }))
      .toBe(ANSWER_YES);
    expect(diagnostics).toHaveLength(0);
  });

  it('antwortet 0, wenn er ein anderer ist — „nein" ist eine Antwort, keine Unaufloesbarkeit', () => {
    const { ctx, diagnostics } = contextAtMercenary([force(FORCE_B_ID, ARMY_B_CATALOGUE_ID)]);

    expect(query(ctx, SELECTION_COUNT, ScopeKeyword.PRIMARY_CATALOGUE, ARMY_A_CATALOGUE_ID, { shared: true }))
      .toBe(ANSWER_NO);
    expect(diagnostics).toHaveLength(0);
  });

  it('gibt dieselbe Antwort unter jeder Flag-Kombination — der Rahmen ist keine Zaehlmenge', () => {
    const { ctx } = contextAtMercenary([force(FORCE_A_ID, ARMY_A_CATALOGUE_ID)]);

    for (const shared of [true, false]) {
      for (const includeChildSelections of [true, false]) {
        for (const includeChildForces of [true, false]) {
          const flags = { shared, includeChildSelections, includeChildForces };
          expect(query(ctx, SELECTION_COUNT, ScopeKeyword.PRIMARY_CATALOGUE, ARMY_A_CATALOGUE_ID, flags))
            .toBe(ANSWER_YES);
        }
      }
    }
  });

  it('meldet ein anderes Feld als die Selektionszaehlung, statt es als Identitaetsfrage zu beantworten', () => {
    const { ctx, diagnostics } = contextAtMercenary([force(FORCE_A_ID, ARMY_A_CATALOGUE_ID)]);

    const result = query(ctx, costSumField('any-cost-type'), ScopeKeyword.PRIMARY_CATALOGUE, ARMY_A_CATALOGUE_ID, { shared: true });

    expect(result).toBe(UNRESOLVED_QUERY);
    expect(diagnostics).toContainEqual(
      expect.objectContaining({ kind: DiagnosticKind.UNSUPPORTED_FIELD, scope: ScopeKeyword.PRIMARY_CATALOGUE }),
    );
  });

  it('liefert den Sentinel — nicht 0 — wenn der primaere Katalog nicht entscheidbar ist', () => {
    const { ctx } = contextAtMercenary([force(FORCE_A_ID, UNKNOWN_CATALOGUE_ID)]);

    expect(query(ctx, SELECTION_COUNT, ScopeKeyword.PRIMARY_CATALOGUE, ARMY_A_CATALOGUE_ID, { shared: true }))
      .toBe(UNRESOLVED_QUERY);
  });

  it('meldet den unentscheidbaren Fall an der fragenden Stelle — der Baumbau meldet ihn nicht', () => {
    const { ctx, diagnostics, joinDiagnostics } = contextAtMercenary([force(FORCE_A_ID, UNKNOWN_CATALOGUE_ID)]);

    query(ctx, SELECTION_COUNT, ScopeKeyword.PRIMARY_CATALOGUE, ARMY_A_CATALOGUE_ID, { shared: true });

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        kind: DiagnosticKind.UNRESOLVED_PRIMARY_CATALOGUE,
        forceDefId: FORCE_A_ID,
        catalogueId: UNKNOWN_CATALOGUE_ID,
        reason: PrimaryCatalogueUnresolvedReason.UNKNOWN_CATALOGUE,
      }),
    );
    // Der Baumbau bindet, er klagt nicht an: ohne fragende Regel bliebe es still.
    expect(joinDiagnostics.filter(entry => entry.kind === DiagnosticKind.UNRESOLVED_PRIMARY_CATALOGUE)).toHaveLength(0);
  });

  it('meldet auch **ausserhalb** eines Kontingents — dort entstuende die Antwort sonst ohne jede Diagnose', () => {
    // Die Wurzel steht ueber keinem Kontingent (wie der Anker einer roster-weiten
    // Pflichtgrenze). Der Baumbau kann diesen Fall nicht melden: er kennt nur
    // Kontingente. Ohne die Meldung an der fragenden Stelle bliebe hier eine
    // unbeantwortbare Abfrage voellig stumm.
    const { ctx, diagnostics } = contextAtMercenary([force(FORCE_A_ID, ARMY_A_CATALOGUE_ID)]);
    const rootContext = { ...ctx, node: ctx.root };

    const answer = query(rootContext, SELECTION_COUNT, ScopeKeyword.PRIMARY_CATALOGUE, ARMY_A_CATALOGUE_ID, { shared: true });

    expect(answer).toBe(UNRESOLVED_QUERY);
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        kind: DiagnosticKind.UNRESOLVED_PRIMARY_CATALOGUE,
        reason: PrimaryCatalogueUnresolvedReason.NO_ROSTER_FORCE,
      }),
    );
  });
});

describe('evalTree: der primaere Katalog haengt am Kontingent, nicht am einzelnen Knoten', () => {
  it('liefert fuer jeden Knoten den Katalog seines umschliessenden Kontingents', () => {
    const { mercenaryNode } = contextAtMercenary([force(FORCE_A_ID, ARMY_A_CATALOGUE_ID)]);

    expect(primaryCatalogueOf(mercenaryNode)).toEqual({ id: ARMY_A_CATALOGUE_ID, unresolved: null });
    expect(primaryCatalogueOf(mercenaryNode.parent)).toEqual({ id: ARMY_A_CATALOGUE_ID, unresolved: null });
  });

  it('sagt ueber keinem Kontingent nicht nur „keine Id", sondern **warum**', () => {
    const { ctx } = contextAtMercenary([force(FORCE_A_ID, ARMY_A_CATALOGUE_ID)]);

    // Die Wurzel gehoert zu keiner Armee. Ein blosses `null` hiesse hier zugleich
    // „noch nicht gebunden", „kein Kontingent" und „nicht aufloesbar" — die Bindung
    // traegt deshalb den Grund mit, aus dem die Diagnose entsteht.
    expect(primaryCatalogueOf(ctx.root)).toEqual({
      id: null,
      unresolved: {
        forceDefId: null,
        catalogueId: null,
        reason: PrimaryCatalogueUnresolvedReason.NO_ROSTER_FORCE,
      },
    });
  });

  it('gibt jedem Knoten dieselbe Form — auch dem Anker, der zu keinem Kontingent gehoert', () => {
    const { ctx } = contextAtMercenary([force(FORCE_A_ID, ARMY_A_CATALOGUE_ID)]);

    for (const node of allNodes(ctx.root)) {
      expect(Object.keys(primaryCatalogueOf(node)).sort()).toEqual(['id', 'unresolved']);
      // Genau eines der beiden Felder ist besetzt.
      expect(primaryCatalogueOf(node).id === null).toBe(primaryCatalogueOf(node).unresolved !== null);
    }
  });
});
