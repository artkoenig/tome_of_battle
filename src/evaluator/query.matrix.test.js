import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { parseCatalogue } from './catalogReader.js';
import { resolveCatalogue } from './resolver.js';
import { buildEvalTree } from './evalTree.js';
import { buildIndex } from './countIndex.js';
import { createBaseEffectiveState } from './effectiveState.js';
import { query, createQueryContext } from './query.js';
import { SELECTION_COUNT, costSumField, ScopeKeyword } from './model.js';

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit (wie in den uebrigen
// Evaluator-Tests). Der eigene XML-Leser der Engine nutzt genau dieses Primitiv.
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

// ─────────────────────────────────────────────────────────────────────────────
// Matrix-Testsuite fuer das Query-Primitiv (die *zweite* Test-Nahtstelle,
// `docs/evaluator-architecture.md` §5 Risiko 2, Issue 03). Sie deckt jede Zelle
// von `shared × includeChildSelections × includeChildForces × Bezugsrahmen-Art`
// mit einem ausfuehrbaren Fall ab und dient als ausfuehrbare Spezifikation der
// Zaehlsemantik.
//
// Alle Faelle zaehlen relativ zu **einer** Bezugsinstanz — der `weapon`-Auswahl
// mit count=3 (unten `WEAPON_W`). Von ihr aus sind self/parent/force/roster
// jeweils verschiedene Rahmen, und Eintrags- wie Kategorie-Ziele lassen sich
// gegeneinander stellen.
//
// Instanzbaum (Anzahl in Klammern; `fa`/`fb` sind Kontingente, tragen selbst 0 bei):
//
//   root
//   └─ fa (Kontingent)
//      ├─ unit (2)   [Kategorie cat, 10 Punkte je Stueck]
//      │  └─ weapon (3)              ← Bezugsinstanz WEAPON_W
//      │     └─ weapon (1)           ← geschachtelt (SCOPE_GEM)
//      └─ fb (geschachteltes Kontingent)
//         └─ unit (5)   [Kategorie cat]
//            └─ weapon (7)
// ─────────────────────────────────────────────────────────────────────────────

const UNIT = 'unit';
const WEAPON = 'weapon';
const FORCE_A = 'fa';
const FORCE_B = 'fb';
const CAT = 'cat';
const POINTS = 'pts';
const UNIT_POINTS = 10;

const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
<catalogue id="cat-matrix" name="Query Matrix Catalogue">
  <categoryEntries>
    <categoryEntry id="${CAT}" name="Cat"/>
  </categoryEntries>
  <forceEntries>
    <forceEntry id="${FORCE_A}" name="Force A">
      <forceEntries>
        <forceEntry id="${FORCE_B}" name="Force B"/>
      </forceEntries>
    </forceEntry>
  </forceEntries>
  <selectionEntries>
    <selectionEntry id="${UNIT}" name="Unit" type="unit">
      <costs>
        <cost name="Points" typeId="${POINTS}" value="${UNIT_POINTS}"/>
      </costs>
      <categoryLinks>
        <categoryLink targetId="${CAT}"/>
      </categoryLinks>
    </selectionEntry>
    <selectionEntry id="${WEAPON}" name="Weapon" type="upgrade"/>
  </selectionEntries>
</catalogue>`;

const ROSTER = {
  forces: [
    {
      defId: FORCE_A, count: 1, children: [
        {
          defId: UNIT, count: 2, children: [
            { defId: WEAPON, count: 3, children: [
              { defId: WEAPON, count: 1, children: [] },
            ] },
          ],
        },
        {
          defId: FORCE_B, count: 1, children: [
            { defId: UNIT, count: 5, children: [
              { defId: WEAPON, count: 7, children: [] },
            ] },
          ],
        },
      ],
    },
  ],
};

/** Baut die Auswertungs-Stufen bis zum Index und liefert Wurzel, Index und Kategorien. */
function buildEvaluation() {
  const catalogue = parseCatalogue(CATALOGUE_XML);
  const resolved = resolveCatalogue(catalogue);
  const { root } = buildEvalTree(resolved, ROSTER);
  // Ohne Modifikatoren gleichen die effektiven Werte den Basiswerten; der Index
  // ueber die Basis-Effektiv-Werte prueft daher dieselbe Zaehlsemantik wie zuvor.
  const index = buildIndex(root, createBaseEffectiveState(root));
  return { root, index, categoryIds: resolved.categoryIds };
}

/** Die Bezugsinstanz WEAPON_W (die weapon-Auswahl mit count=3): fa → unit → weapon. */
function bezugsinstanz(root) {
  return root.children[0].children[0].children[0];
}

/** Erzeugt einen Query-Kontext an der Bezugsinstanz. */
function contextAtBezugsinstanz() {
  const { root, index, categoryIds } = buildEvaluation();
  const diagnostics = [];
  const node = bezugsinstanz(root);
  return { ctx: createQueryContext({ node, root, index, categoryIds, diagnostics }), diagnostics };
}

// Die acht Flag-Kombinationen in fester Reihenfolge; jede Erwartungstabelle unten
// folgt genau dieser Reihenfolge.
const FLAG_COMBOS = [
  { shared: true, includeChildSelections: false, includeChildForces: false },
  { shared: true, includeChildSelections: false, includeChildForces: true },
  { shared: true, includeChildSelections: true, includeChildForces: false },
  { shared: true, includeChildSelections: true, includeChildForces: true },
  { shared: false, includeChildSelections: false, includeChildForces: false },
  { shared: false, includeChildSelections: false, includeChildForces: true },
  { shared: false, includeChildSelections: true, includeChildForces: false },
  { shared: false, includeChildSelections: true, includeChildForces: true },
];

const flagLabel = (flags) =>
  `shared=${flags.shared} incSel=${flags.includeChildSelections} incForces=${flags.includeChildForces}`;

// Ein Fall je Zelle: Bezugsrahmen-Art × acht Flag-Kombinationen. Die
// `expected`-Arrays folgen der Reihenfolge von FLAG_COMBOS und sind von Hand aus
// dem Instanzbaum abgeleitet (die ausfuehrbare Spezifikation).
const FRAME_MATRIX = [
  {
    // self: die Waffe (3) plus ihre direkt geschachtelte Waffe (1) = 4; keine
    // Grenze wird gekreuzt, daher aendern die Flags nichts.
    name: 'self-Rahmen zaehlt weapon',
    scope: ScopeKeyword.SELF, target: WEAPON,
    expected: [4, 4, 4, 4, 4, 4, 4, 4],
  },
  {
    // parent (die unit): eine direkte Waffe (3, base) plus eine geschachtelte
    // (1, nur mit includeChildSelections). parent ist instanzgebunden und
    // ignoriert shared; includeChildForces ist irrelevant.
    name: 'parent-Rahmen zaehlt weapon, includeChildSelections greift',
    scope: ScopeKeyword.PARENT, target: WEAPON,
    expected: [3, 3, 4, 4, 3, 3, 4, 4],
  },
  {
    // force (Kontingent fa): eigene units (2) plus die des Kind-Kontingents fb
    // (5, nur mit includeChildForces). shared=false verengt auf die eigene
    // Instanz (0 units darin).
    name: 'force-Rahmen zaehlt unit pro Kontingent, includeChildForces weitet auf Kind-Kontingente',
    scope: ScopeKeyword.FORCE, target: UNIT,
    expected: [2, 7, 2, 7, 0, 0, 0, 0],
  },
  {
    // roster: alle units armeeweit (2 + 5 = 7); shared=false verengt auf die
    // eigene Instanz (0 units).
    name: 'roster-Rahmen zaehlt unit armeeweit',
    scope: ScopeKeyword.ROSTER, target: UNIT,
    expected: [7, 7, 7, 7, 0, 0, 0, 0],
  },
  {
    // Eintrags-ID als Scope: loest auf den naechsten Vorfahren mit dieser ID
    // (die unit) und verhaelt sich wie parent fuer das weapon-Ziel. shared=false
    // verengt auf die eigene Instanz (weapon-Teilbaum = 4).
    name: 'Eintrags-ID-Rahmen loest auf den naechsten Vorfahren auf',
    scope: UNIT, target: WEAPON,
    expected: [3, 3, 4, 4, 4, 4, 4, 4],
  },
  {
    // Kategorie-ID als Scope: der armeeweite Kategorierahmen (die Wurzel); zaehlt
    // unit armeeweit (7). shared=false verengt auf die eigene Instanz (0).
    name: 'Kategorie-ID-Rahmen zaehlt armeeweit',
    scope: CAT, target: UNIT,
    expected: [7, 7, 7, 7, 0, 0, 0, 0],
  },
];

describe('Query-Matrix: shared × includeChildSelections × includeChildForces × Bezugsrahmen-Art', () => {
  for (const frame of FRAME_MATRIX) {
    describe(frame.name, () => {
      FLAG_COMBOS.forEach((flags, i) => {
        it(`${flagLabel(flags)} → ${frame.expected[i]}`, () => {
          const { ctx } = contextAtBezugsinstanz();

          const result = query(ctx, SELECTION_COUNT, frame.scope, frame.target, flags);

          expect(result).toBe(frame.expected[i]);
        });
      });
    });
  }
});

describe('Ziel-Typ-Regel (BSData §7.7): Kategorie armeeweit, Eintrag pro Kontingent', () => {
  const sharedNoWidening = { shared: true, includeChildSelections: false, includeChildForces: false };

  it('ein Eintrags-Ziel zaehlt im force-Rahmen nur das eigene Kontingent', () => {
    const { ctx } = contextAtBezugsinstanz();

    // fa traegt 2 units; das Kind-Kontingent fb bleibt ohne includeChildForces aussen vor.
    expect(query(ctx, SELECTION_COUNT, ScopeKeyword.FORCE, UNIT, sharedNoWidening)).toBe(2);
  });

  it('ein Kategorie-Ziel zaehlt im force-Rahmen armeeweit ueber alle Kontingente', () => {
    const { ctx } = contextAtBezugsinstanz();

    // Dieselbe Kategorie kommt in fa (2) und fb (5) vor → 7, unabhaengig von includeChildForces.
    expect(query(ctx, SELECTION_COUNT, ScopeKeyword.FORCE, CAT, sharedNoWidening)).toBe(7);
    expect(query(ctx, SELECTION_COUNT, ScopeKeyword.FORCE, CAT, { ...sharedNoWidening, includeChildForces: true })).toBe(7);
  });

  it('ein Kategorie-Ziel weitet NICHT auf, wenn der Scope nicht force ist', () => {
    const { ctx } = contextAtBezugsinstanz();

    // Die Ziel-Typ-Regel gilt nur fuer scope=force (ADR-0003, ADR-0029). Bei
    // scope=self bleibt der Rahmen der Teilbaum der weapon-Bezugsinstanz — der
    // keine Kategorie-cat-Auswahl enthaelt → 0, NICHT der armeeweite Wert 7.
    expect(query(ctx, SELECTION_COUNT, ScopeKeyword.SELF, CAT, sharedNoWidening)).toBe(0);
  });
});

describe('Kostensummen-Ziel (Summe statt Anzahl)', () => {
  it('summiert die Kostenart armeeweit ueber die Ziel-Definition', () => {
    const { ctx } = contextAtBezugsinstanz();

    // 2 units in fa (2×10) + 5 units in fb (5×10) = 70 Punkte armeeweit.
    const result = query(ctx, costSumField(POINTS), ScopeKeyword.ROSTER, UNIT, { shared: true });

    expect(result).toBe((2 + 5) * UNIT_POINTS);
  });
});

describe('Nicht aufloesbarer Bezugsrahmen', () => {
  it('liefert 0 und eine Auflösungs-Diagnose statt einer falschen Zaehlung', () => {
    const { ctx, diagnostics } = contextAtBezugsinstanz();

    const result = query(ctx, SELECTION_COUNT, 'ghost-entry-id', UNIT, { shared: true });

    expect(result).toBe(0);
    expect(diagnostics).toContainEqual(
      expect.objectContaining({ kind: 'unresolvedScope', scope: 'ghost-entry-id' })
    );
  });
});
