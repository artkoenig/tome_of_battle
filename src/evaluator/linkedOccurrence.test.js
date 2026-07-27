import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';

import { prepareDataset, evaluate } from './evaluator.js';
import { PreparedDataset } from './datasetPreparation.js';
import { buildEvalTree, realNodes } from './evalTree.js';
import { buildIndex } from './countIndex.js';
import { createBaseEffectiveState } from './effectiveState.js';
import { query, createQueryContext } from './query.js';
import { SELECTION_COUNT, ScopeKeyword, DiagnosticKind } from './model.js';

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit (wie in den uebrigen
// Evaluator-Tests). Der eigene XML-Leser der Engine nutzt genau dieses Primitiv.
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

/**
 * **Verweis-Identitaet: die zwei Pfade, die kein E2E-Fall der Fixture-Kataloge
 * erreicht** (ADR-0037, `design.md` Kontrakt 3, Risiko 3).
 *
 * Ein ueber einen `entryLink` gesetztes Vorkommen traegt den **Verweis** als seine
 * Definition. Daraus folgen zwei Aussagen, fuer die die echten Katalogdaten keinen
 * Fall hergeben — die eine, weil dort kein Id-Bezugsrahmen auf ein
 * verweis-getragenes Ziel zeigt, die andere, weil dort keine Verweiskette laenger
 * als zwei Glieder ist. Beide sind trotzdem tragend: die erste ist der
 * Regressionspfad, den der Fix aufreissen wuerde, wenn die Identitaet skalar
 * blieebe; die zweite ist die Verallgemeinerung, ohne die derselbe Fehler eine
 * Ebene tiefer wiederkehrt.
 */

const FORCE_ID = 'force-main';

/** Liest die aufgeloeste Sicht eines Katalogs (engine-intern) fuer die Index-Tests. */
function resolvedViewOf(catalogueXml) {
  return PreparedDataset.contentsOf(prepareDataset({ catalogues: [catalogueXml] })).resolved;
}

// ── Pfad 1: Bezugsrahmen per Eintrags-Id auf ein verweis-getragenes Ziel ────────

const SQUAD_TARGET_ID = 'squad';
const SQUAD_LINK_ID = 'link-squad';
const MEMBER_ID = 'member';
const MIN_MEMBERS_ID = 'min-members';
const REQUIRED_MEMBERS = 2;

/**
 * Ein Regiment bezieht seine Einheit ausschliesslich per `entryLink`; die
 * Mindestgrenze ihres Mitglieds nennt als Bezugsrahmen die **Eintrags-Id des
 * Verweisziels** (`scope="squad"`). Der Rahmenknoten traegt aber den Verweis.
 */
const ENTRY_ID_SCOPE_CATALOGUE = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-entry-id-scope" name="Entry-Id Scope Catalogue">
    <forceEntries>
      <forceEntry id="${FORCE_ID}" name="Main Force"/>
    </forceEntries>
    <selectionEntries>
      <selectionEntry id="regiment" name="Regiment" type="unit">
        <entryLinks>
          <entryLink id="${SQUAD_LINK_ID}" name="Squad (via link)" type="selectionEntry" targetId="${SQUAD_TARGET_ID}"/>
        </entryLinks>
      </selectionEntry>
    </selectionEntries>
    <sharedSelectionEntries>
      <selectionEntry id="${SQUAD_TARGET_ID}" name="Squad" type="unit">
        <selectionEntries>
          <selectionEntry id="${MEMBER_ID}" name="Member" type="model">
            <constraints>
              <constraint id="${MIN_MEMBERS_ID}" type="min" value="${REQUIRED_MEMBERS}" field="selections" scope="${SQUAD_TARGET_ID}"/>
            </constraints>
          </selectionEntry>
        </selectionEntries>
      </selectionEntry>
    </sharedSelectionEntries>
  </catalogue>`;

/** Ein Roster, das die Einheit **ueber den Verweis** setzt, mit `memberCount` Mitgliedern. */
function rosterWithMembers(memberCount) {
  return {
    forces: [{
      defId: FORCE_ID,
      count: 1,
      children: [{
        defId: 'regiment',
        count: 1,
        children: [{
          defId: SQUAD_TARGET_ID,
          linkDefId: SQUAD_LINK_ID,
          count: 1,
          children: [{ defId: MEMBER_ID, count: memberCount, children: [] }],
        }],
      }],
    }],
  };
}

describe('Verweis-Identitaet: ein Bezugsrahmen per Eintrags-Id findet einen verweis-getragenen Rahmen', () => {
  const prepared = prepareDataset({ catalogues: [ENTRY_ID_SCOPE_CATALOGUE] });

  it('loest den Rahmen auf, obwohl der Rahmenknoten die Verweis-Id traegt', () => {
    const report = evaluate(prepared, rosterWithMembers(REQUIRED_MEMBERS));

    // Waere der Rahmen nur unter `def.id` auffindbar, truege der Knoten die
    // Verweis-Id und der Scope liefe ins Leere.
    expect(report.diagnostics.filter(d => d.kind === DiagnosticKind.UNRESOLVED_SCOPE)).toHaveLength(0);
    expect(report.violations.filter(v => v.limitId === MIN_MEMBERS_ID)).toHaveLength(0);
  });

  it('zaehlt im aufgeloesten Rahmen den wirklichen Bestand, nicht 0', () => {
    const report = evaluate(prepared, rosterWithMembers(REQUIRED_MEMBERS - 1));

    // Die scharfe Aussage: ein *unaufgeloester* Rahmen wuerde ebenfalls eine
    // Verletzung melden — aber mit Ist 0. Nur der aufgeloeste Rahmen liest 1.
    const violations = report.violations.filter(v => v.limitId === MIN_MEMBERS_ID);
    expect(violations).toHaveLength(1);
    expect(violations[0].actual).toBe(REQUIRED_MEMBERS - 1);
    expect(violations[0].bound).toBe(REQUIRED_MEMBERS);
  });
});

// ── Pfad 2: eine Verweiskette mit mehr als zwei Gliedern ───────────────────────

const CHAIN_HEAD_ID = 'link-a';
const CHAIN_MIDDLE_ID = 'link-b';
const CHAIN_TAIL_ID = 'link-c';
const CHAIN_TARGET_ID = 'banner';
const CHAIN_TARGET_TYPE = 'upgrade';

/**
 * Eine dreigliedrige Verweiskette `link-a → link-b → link-c → banner`. Die beiden
 * mittleren Glieder liegen in einer geteilten Gruppe: sie sind nur ueber ihre Id
 * erreichbar — genau der Grund, aus dem drei Stichproben (eigene Id, `targetId`,
 * aufgeloestes Ziel) das mittlere Glied verlieren wuerden.
 */
const LINK_CHAIN_CATALOGUE = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-link-chain" name="Link Chain Catalogue">
    <forceEntries>
      <forceEntry id="${FORCE_ID}" name="Main Force"/>
    </forceEntries>
    <selectionEntries>
      <selectionEntry id="unit" name="Unit" type="unit">
        <entryLinks>
          <entryLink id="${CHAIN_HEAD_ID}" name="Banner (via chain)" type="selectionEntry" targetId="${CHAIN_MIDDLE_ID}"/>
        </entryLinks>
      </selectionEntry>
    </selectionEntries>
    <sharedSelectionEntryGroups>
      <selectionEntryGroup id="relay" name="Relay">
        <entryLinks>
          <entryLink id="${CHAIN_MIDDLE_ID}" name="Relay B" type="selectionEntry" targetId="${CHAIN_TAIL_ID}"/>
          <entryLink id="${CHAIN_TAIL_ID}" name="Relay C" type="selectionEntry" targetId="${CHAIN_TARGET_ID}"/>
        </entryLinks>
      </selectionEntryGroup>
    </sharedSelectionEntryGroups>
    <sharedSelectionEntries>
      <selectionEntry id="${CHAIN_TARGET_ID}" name="Banner" type="${CHAIN_TARGET_TYPE}"/>
    </sharedSelectionEntries>
  </catalogue>`;

const CHAIN_ROSTER = {
  forces: [{
    defId: FORCE_ID,
    count: 1,
    children: [{
      defId: 'unit',
      count: 1,
      children: [{ defId: CHAIN_TARGET_ID, linkDefId: CHAIN_HEAD_ID, count: 1, children: [] }],
    }],
  }],
};

/**
 * Zaehlt im Rahmen des Eltern-Knotens (`scope="parent"`) auf das Ziel `targetId` —
 * dasselbe Primitiv, das jede Grenze und jede Bedingung benutzt.
 */
function countInParentFrameOf(node, root, index, targetId) {
  const diagnostics = [];
  const ctx = createQueryContext({ node, root, index, diagnostics });
  return query(ctx, SELECTION_COUNT, ScopeKeyword.PARENT, targetId, { shared: true });
}

describe('Verweis-Identitaet: eine Kette mit mehr als zwei Gliedern ist unter jedem Glied zaehlbar', () => {
  const resolved = resolvedViewOf(LINK_CHAIN_CATALOGUE);
  const { root } = buildEvalTree(resolved, CHAIN_ROSTER);
  const index = buildIndex(root, createBaseEffectiveState(root));
  const occurrence = [...realNodes(root)].find(node => node.def.id === CHAIN_HEAD_ID);

  it('bindet das Vorkommen an den Verweis, ueber den es hereinkam', () => {
    expect(occurrence).toBeDefined();
  });

  it.each([CHAIN_HEAD_ID, CHAIN_MIDDLE_ID, CHAIN_TAIL_ID, CHAIN_TARGET_ID])(
    'zaehlt das Vorkommen unter dem Kettenglied %s',
    linkId => {
      expect(countInParentFrameOf(occurrence, root, index, linkId)).toBe(1);
    },
  );

  it('zaehlt das Vorkommen unter dem Typ seines Kettenendes', () => {
    // Kontrakt 4 durch die ganze Kette: der gezaehlte Typ kommt vom Ziel, nicht
    // von einem der Verweise (die tragen ueberhaupt keinen Eintragstyp).
    expect(countInParentFrameOf(occurrence, root, index, CHAIN_TARGET_TYPE)).toBe(1);
  });

  it('zaehlt es nicht unter einer Id, die nicht zur Kette gehoert', () => {
    expect(countInParentFrameOf(occurrence, root, index, 'unrelated-id')).toBe(0);
  });
});

// ── Kontrakt 8: Id-Ziele und Typ-Ziele liegen in getrennten Schluesselraeumen ──

const KEYWORD_SHAPED_ID = 'model';

/**
 * Ein Eintrag, dessen **Id** zufaellig wie ein Typ-Schluesselwort lautet, waehrend
 * sein Typ ein anderer ist. Faellt beides in einen Schluesselraum, zaehlte diese
 * Auswahl als Modell.
 */
const KEYWORD_SHAPED_ID_CATALOGUE = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-keyword-id" name="Keyword-shaped Id Catalogue">
    <forceEntries>
      <forceEntry id="${FORCE_ID}" name="Main Force"/>
    </forceEntries>
    <selectionEntries>
      <selectionEntry id="${KEYWORD_SHAPED_ID}" name="Not a model" type="${CHAIN_TARGET_TYPE}"/>
    </selectionEntries>
  </catalogue>`;

describe('Verweis-Identitaet: eine Katalog-Id zaehlt nicht als Typ', () => {
  it('laesst eine Auswahl, deren Id wie ein Typ-Schluesselwort lautet, nicht unter diesem Typ zaehlen', () => {
    const resolved = resolvedViewOf(KEYWORD_SHAPED_ID_CATALOGUE);
    const roster = {
      forces: [{ defId: FORCE_ID, count: 1, children: [{ defId: KEYWORD_SHAPED_ID, count: 1, children: [] }] }],
    };
    const { root } = buildEvalTree(resolved, roster);
    const index = buildIndex(root, createBaseEffectiveState(root));
    const occurrence = [...realNodes(root)].find(node => node.def.id === KEYWORD_SHAPED_ID);

    // Der Typ des Eintrags ist `upgrade`: eine Bedingung mit `childId="model"`
    // darf ihn nicht finden, obwohl seine Id genau so lautet.
    expect(countInParentFrameOf(occurrence, root, index, KEYWORD_SHAPED_ID)).toBe(0);
    expect(countInParentFrameOf(occurrence, root, index, CHAIN_TARGET_TYPE)).toBe(1);
  });
});
