import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { parseCatalogue } from './catalogReader.js';
import { resolveCatalogue } from './resolver.js';
import { buildEvalTree } from './evalTree.js';
import { buildIndex } from './countIndex.js';
import { createBaseEffectiveState } from './effectiveState.js';
import { applyAllModifiers } from './modifiers.js';
import { createQueryContext, query } from './query.js';
import { SELECTION_COUNT, DiagnosticKind } from './model.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

// ─────────────────────────────────────────────────────────────────────────────
// Eine **Kategorie-Id als Bezugsrahmen** benennt — wie jede andere Id — einen
// **Vorfahren**, nicht die Wurzel: BSData-Wiki, *Data structure overview*,
// Abschnitt *Constraint*: `Scope` ist „one of parent|roster|force|primary
// category **or any type of ancestor identifier**", und er entscheidet, „which
// entity should sum up all `field`'s values of descendant selections of this
// constraint's parent entry".
//
// Der reale Fall, an dem der armeeweite Rahmen auffiel (Definitive Edition,
// `Vampire Counts`): die Gruppe „Mounts" des Master Necromancer traegt
// `max 0 scope="<Kategorie Strigoi>"` neben `max 1 scope="parent"`. Mit dem
// armeeweiten Rahmen zaehlte die Grenze schlicht alle Reittiere dieser Gruppe im
// ganzen Roster — die Kategorie im `scope` blieb wirkungslos, und jedes erlaubte
// Reittier eines Master Necromancer wurde als Verstoss gemeldet. Mit dem
// Vorfahren-Rahmen greift sie genau dort, wo die Kategorie wirklich haengt.
//
// Instanzbaum der Fixture (Anzahl in Klammern):
//
//   root
//   └─ force
//      ├─ champion (1)          [Kategorie elite — per `add category`-Modifikator]
//      │  └─ mount (1)
//      └─ grunt (1)             [keine Kategorie]
//         └─ mount (1)
// ─────────────────────────────────────────────────────────────────────────────

const FORCE_ID = 'force';
const CHAMPION_ID = 'champion';
const GRUNT_ID = 'grunt';
const MOUNT_ID = 'mount';
const ELITE_CAT_ID = 'cat-elite';
const OTHER_CAT_ID = 'cat-other';

const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
<catalogue id="cat-category-scope" name="Category Scope Catalogue">
  <categoryEntries>
    <categoryEntry id="${ELITE_CAT_ID}" name="Elite"/>
    <categoryEntry id="${OTHER_CAT_ID}" name="Other"/>
  </categoryEntries>
  <forceEntries>
    <forceEntry id="${FORCE_ID}" name="Force"/>
  </forceEntries>
  <selectionEntries>
    <selectionEntry id="${CHAMPION_ID}" name="Champion" type="unit">
      <modifiers>
        <modifier type="add" field="category" value="${ELITE_CAT_ID}"/>
      </modifiers>
      <selectionEntries>
        <selectionEntry id="${MOUNT_ID}" name="Mount" type="upgrade"/>
      </selectionEntries>
    </selectionEntry>
    <selectionEntry id="${GRUNT_ID}" name="Grunt" type="unit">
      <selectionEntries>
        <selectionEntry id="${MOUNT_ID}" name="Mount" type="upgrade"/>
      </selectionEntries>
    </selectionEntry>
  </selectionEntries>
</catalogue>`;

const ROSTER = {
  forces: [{
    defId: FORCE_ID, count: 1, children: [
      { defId: CHAMPION_ID, count: 1, children: [{ defId: MOUNT_ID, count: 1, children: [] }] },
      { defId: GRUNT_ID, count: 1, children: [{ defId: MOUNT_ID, count: 1, children: [] }] },
    ],
  }],
};

const SHARED = { shared: true, includeChildSelections: true, includeChildForces: true };

/** Baut Baum, Index und **effektive** Werte (die `add category`-Modifikatoren wirken). */
function buildEvaluation() {
  const resolved = resolveCatalogue(parseCatalogue(CATALOGUE_XML));
  const { root } = buildEvalTree(resolved, ROSTER);
  const baseIndex = buildIndex(root, createBaseEffectiveState(root));
  const effective = applyAllModifiers(root, baseIndex, resolved.categoryIds, []);
  return { root, index: buildIndex(root, effective), categoryIds: resolved.categoryIds, effective };
}

/** Ein Query-Kontext am Reittier unterhalb der genannten Einheit. */
function contextAtMountUnder(unitDefId) {
  const { root, index, categoryIds, effective } = buildEvaluation();
  const unit = root.children[0].children.find(child => child.def.id === unitDefId);
  const diagnostics = [];
  return {
    ctx: createQueryContext({ node: unit.children[0], root, index, categoryIds, diagnostics, effective }),
    diagnostics,
  };
}

describe('Kategorie-Id als Bezugsrahmen: der naechste Vorfahre mit dieser Kategorie', () => {
  it('loest auf den Vorfahren auf, der die Kategorie effektiv traegt, und zaehlt nur unter ihm', () => {
    const { ctx, diagnostics } = contextAtMountUnder(CHAMPION_ID);

    // Rahmen = der Champion (traegt `elite` effektiv). Unter ihm steht genau ein
    // Reittier — nicht die zwei des ganzen Rosters.
    expect(query(ctx, SELECTION_COUNT, ELITE_CAT_ID, MOUNT_ID, SHARED)).toBe(1);
    expect(diagnostics).toHaveLength(0);
  });

  it('loest nicht auf, wenn kein Vorfahre die Kategorie traegt — fail-closed mit Diagnose', () => {
    const { ctx, diagnostics } = contextAtMountUnder(GRUNT_ID);

    // Der Grunt traegt `elite` nicht; das Reittier des Champion darf hier nicht
    // durchschlagen. Frueher zaehlte dieselbe Query armeeweit — und damit 2.
    expect(query(ctx, SELECTION_COUNT, ELITE_CAT_ID, MOUNT_ID, SHARED)).toBe(0);
    expect(diagnostics).toEqual([
      expect.objectContaining({ kind: DiagnosticKind.UNRESOLVED_SCOPE, scope: ELITE_CAT_ID }),
    ]);
  });

  it('loest nicht auf, wenn die Kategorie im Datensatz zwar existiert, aber an keinem Vorfahren haengt', () => {
    const { ctx } = contextAtMountUnder(CHAMPION_ID);

    expect(query(ctx, SELECTION_COUNT, OTHER_CAT_ID, MOUNT_ID, SHARED)).toBe(0);
  });

  it('zaehlt den Kategorie-Traeger selbst, wenn die Query an ihm haengt (Vorfahre inklusive)', () => {
    const { root, index, categoryIds, effective } = buildEvaluation();
    const champion = root.children[0].children.find(child => child.def.id === CHAMPION_ID);
    const ctx = createQueryContext({ node: champion, root, index, categoryIds, diagnostics: [], effective });

    // Der Traeger selbst ist der naechste Vorfahre mit der Kategorie; in seinem
    // Rahmen steht sein eigenes Reittier.
    expect(query(ctx, SELECTION_COUNT, ELITE_CAT_ID, MOUNT_ID, SHARED)).toBe(1);
  });
});
