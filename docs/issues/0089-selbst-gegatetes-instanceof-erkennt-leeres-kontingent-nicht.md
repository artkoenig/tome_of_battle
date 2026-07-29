---
status: active
branch: claude/new-session-jnwa1m-0089
pr:
---

# Selbst-gegatetes `instanceOf` erkennt ein leeres Kontingent nicht

## Intent

`docs/battlescribe-data-format.md` §7.7 beschreibt zwei gleichbedeutende
Kodierungen der Prüfung „ist das Kontingent eine Instanz dieses Detachments":
kanonisch (`scope="force" childId="<forceId>"`) und selbst-gegatet
(`scope="<forceId>"`, `childId` leer). Die Auswertung soll eine
forceEntry-Instanz-Prüfung daran erkennen, dass `scope` **oder** `childId` auf
eine reale `forceEntry`-Id auflöst.

Diese Erkennung existiert nicht: eine forceEntry-Id in `scope` läuft durch
`nearestAncestorWithDefId` (`src/evaluator/query.js:74`) und zählt dann mit
Ziel `null` „alles im Rahmen" — Kontingent-Knoten tragen zum `null`-Ziel aber
nichts bei (`src/evaluator/countIndex.js`). Die selbst-gegatete Form
degeneriert so zur Selektionszählung: ein **gewähltes, aber leeres**
Sonderheer gilt als „nicht Instanz seiner selbst".

Repro (Audit 2026-07-28, gegen die echte Fassade): Vampire-Counts-Idiom
„eigenes Punktelimit" (§5.6) — `min` über `limit::pts`, per Modifier mit
`instanceOf scope="<eigene forceId>"` angehoben. Force gewählt mit einer
Einheit → Verstoß feuert (korrekt); Force gewählt, aber leer → kein Verstoß
(Regel still nicht durchgesetzt). Ein `notInstanceOf` in dieser Kodierung
feuert auf einem leeren Kontingent entsprechend fälschlich. Die kanonische
Form funktioniert auch leer (Kontroll-Repro).

Acceptance criteria:

1. Eine `instanceOf`-Condition mit `scope="<forceId>"` (ohne `childId`) hält
   für jeden Knoten innerhalb eines Kontingents dieser Definition — auch wenn
   das Kontingent leer ist.
2. `notInstanceOf` in derselben Kodierung hält auf einem leeren Kontingent
   dieser Definition **nicht**.
3. Beide Kodierungen aus §7.7 liefern in denselben Szenarien dasselbe
   Ergebnis.
4. Die bestehende Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt.

## Plan

## Tasks

## Decisions

- **Herkunft:** Intensiv-Audit der Reinraum-Engine gegen die BSData-Doku im
  Repo (2026-07-28), Fund mit ausgeführtem Repro gegen die echte Fassade.

## Log

- 2026-07-29 test-author: `src/evaluator/query.selfGatedInstanceOf.test.js`,
  23 tests — 6 RED (self-gated empty-force instanceOf/notInstanceOf + the 4
  AC3 equivalence cases involving the empty force), 17 green pins/controls
  (one-unit case, other-force boundary both ops, all 8 canonical-encoding
  controls incl. empty force, unknown-scope-id fail-closed pin). Modeled on
  the §5.6 Vampire-Counts idiom (forceEntry-own min over `limit::pts` +
  entry-level cost surcharge probe). Open, unpinned: id collision
  (forceEntry id that is also an entry/category id — likely impossible);
  whether the fixed recognition still emits `unresolvedScope` for a real
  forceEntry id seen from another force (only the violation outcome is
  pinned there).
- 2026-07-29 implementer: single file `resolver.js` (+67/−3) —
  `normalizeForceInstanceCondition` rewrites self-gated instanceOf/
  notInstanceOf (scope = id resolving to a FORCE definition, childId empty)
  to the canonical encoding at resolve time; frame/target come from the
  unchanged canonical path. Deliberately NOT in query.js: query never sees
  the condition type, and §7.7 ties the recognition to the instance check —
  counting conditions with force-id scopes keep their meaning. Unknown ids
  keep UNRESOLVED_SCOPE; keywords excluded first. 23/23 target green; suite
  211 files / 2166 tests exit 0 (no manifest expectation changed);
  puppeteer E2E exit 0; lint/typecheck 0. Noted improvements/edges: spurious
  UNRESOLVED_SCOPE from another force is gone (strictly more correct,
  unpinned); nested-force edge now behaves canonical (no coverage, noted).

## Checkpoints

### Before implementation

- Does this match what was asked? Yes — teach the query layer to recognize a
  forceEntry-instance check when `scope` OR `childId` resolves to a real
  forceEntry id, so the self-gated encoding stops degenerating to a
  selection count of 0 on empty forces.
- What surprised me? The canonical form already works even on empty forces —
  so the semantics ("is this node inside an instance of that force
  definition") exist; only the recognition path for the self-gated spelling
  is missing.
- What am I assuming without having verified it? That the recognition can
  live in `resolveSharedFrame`/query scope resolution without disturbing
  entry-id and category-id scopes (an id that is BOTH would be a catalog
  error — the test-author should flag if the criteria leave that collision
  undecided), and that `instanceOf`'s membership predicate (`actual > 0`)
  can be fed a force-count instead of a selection count for this case.

### Before the PR

- Does this match what was asked? Yes — both encodings equivalent by
  construction (normalization to canonical), empty forces recognized, one
  fresh-context round with zero findings; reds proven real on origin/main.
- What surprised me? The right seam was the resolver, not the query layer —
  §7.7 ties the recognition to the CONDITION KIND, which query() never
  sees; checkpoint 1's assumption was wrong and the Log records why.
- What am I assuming without having verified it? That counting conditions
  with force-id scopes keep their old meaning relies on the kind-set guard
  alone (reviewer: no test exercises that combination — coverage note for
  a future run). No version bump: evaluator not wired to the UI (session
  precedent).

- 2026-07-29 review round 1 (fresh context): 0 findings; red-on-main proof
  6/17 exact; immutability verified (rewrite before deep-freeze,
  idempotent, immutability suite green); blast radius traced — no
  diagnostic carries a rewritten scope, childId-set and canonical paths
  untouched, nested-force edge behaves canonical. Two coverage
  observations recorded: the counting-kind exclusion is unpinned; the
  parser collapses `childId="any"` to missing (pre-existing), so that
  spelling is normalized too (§7.7-consistent).

## Retro
