---
status: backlog
branch:
pr:
---

# A context map: name every relationship between the contexts, and what it obliges

## Goal

Finding S1 of [`docs/ddd-review-2026-08.md`](../ddd-review-2026-08.md). Nothing in `docs/` or
`.claude/` states a relationship between two bounded contexts in DDD's vocabulary — a grep for
*upstream/downstream, shared kernel, customer/supplier, conformist, anticorruption layer, open host
service, published language, separate ways* returns only the two DDD reviews, which
`docs/project-map.md:130-136` itself marks as proposals rather than accepted architecture.
ADR-0042 defines the cut and the ports; it names not one relationship.
`.claude/rules/areas/contexts.md` comes closest and is a rule file, not a map.

That matters because the relationships exist and each carries an obligation nobody has written
down. A conformist relationship means the downstream absorbs every upstream rename — and the UI does:
`slot` appears 215 times under `src/ui/`, `capability` 243, `offer` 22. A customer/supplier
relationship means the downstream's needs are supposed to factor into the upstream's planning, which
is exactly the conversation issue 0198 is missing. A shared kernel means an edit needs both owners'
consent, and this project has **three** of them, each with a different membership — which is where
the most expensive obligations in the tree actually sit.

**Write it from the code, not from the review's table, which is wrong in seven places.** The
corrections, each verified:

1. **`ui` is not a bounded context — it is a layer, and the composition root.** ADR-0042's target
   tree lists exactly five directories under `src/contexts/` and `src/ui/` is not among them;
   ADR-0037 makes `UI → Fachlogik → Daten` a one-way *layer* direction; `.cast/layers.json` puts
   `src/ui/**` in layer `ui` and `.cast/rules.json` carries `fachlogik-kein-rueckgriff | kontexte ->
   ui | error`. There is no `kontext-intern-ui` allowance because there is no ui context, and
   `src/ui/` legitimately imports all five (44/13/5/3/1 import statements for
   armylist/ruleengine/catalog/play/rulebook). The consequence is the map's central, load-bearing
   statement: **every inter-context relationship except the single import at
   `src/contexts/armylist/application/mandatoryListRules.js:28` is physically realized in a
   viewmodel**, because contexts may not import each other.
   *Defect found on the way:* `docs/glossary.md:12-13` attributes "the bounded context (`armylist`,
   …, `ui`)" to ADR-0042, which says no such thing. By CLAUDE.md precedence the glossary line is
   wrong — AC10.
2. Row 1's evidence is off: **13** modules under `src/ui/viewmodels/` import the read-model door, 7
   of them under `viewmodels/editor/`, and `raiseMembers` appears **0** times in `src/ui/`.
3. Row 2 is understated. Besides the `slots` argument there is a real import
   (`mandatoryListRules.js:28`), the only cross-context import in `src/contexts/`. The supplier side
   has a name the review never gives it: `readmodel/index.js:1-12` declares itself "die einzige Tür
   nach draußen" and `.cast/rules.json` allows `** -> readmodel-fassade` while forbidding everything
   behind it — that is an **Open Host Service**, and the report it publishes (ADR-0034) is the
   **Published Language**.
4. Row 3 has the wrong shape: there is no dependency in either direction, so it is not an ordered
   pair. Correct: **Separate Ways** between `play` and `armylist`, with both **downstream of a
   shared kernel** (`src/shared/rostermodel/types.js`) — two relationships, not one. Lines drift
   too: `game.js:7` names `rosterId` the only coupling, `:118` records the refusal to import,
   `selectionIdsOf` is `:123-133`.
5. Row 4 is too narrow. The XSD's downstream is not `platform/battlescribe` alone: the generated
   artifact lives in the shared kernel and is read by 4 modules under `armylist/model/` and 3 under
   `ruleengine/engine/`, so a foreign version bump lands inside **two contexts** at once. Name the
   mechanism: `src/platform/battlescribe/schema/PROVENANCE.md`, `npm run generate:schema`, the drift
   guard at `scripts/generate-schema-module.test.js:12`.
6. Row 5 collapses two relationships. With **our own forks** it is genuinely Customer/Supplier — the
   fork's CI exists to serve this app (ADR-0014/0017). With the **community data behind them**
   (Ergofarg, Lexicanum) it is **Conformist**; ADR-0017 explicitly rejects the "upstream we forked
   from" framing for Lexicanum.
7. Three rows are missing: **`rulebook`** and its partner **6th.whfb.app** (ADR-0012, one consumer
   at `src/ui/viewmodels/useRuleUrl.js:2`, coupled by a display-name string, index crawled at build
   time); **`catalog` → `armylist`** and **`catalog` → `ruleengine`**, real supplier relationships
   with no import edge, realized by handing the parsed `system` through the composition root; and
   **the three shared kernels**.

Also corrected: the review says "link it from the ADR index". `.claude/rules/areas/docs.md` reserves
that table for ADRs. Link from ADR-0042's body, `docs/project-map.md` and
`.claude/rules/areas/contexts.md` instead. It is a plain doc, not an ADR: it decides nothing and an
ADR would duplicate 0042 against ADR-0001's no-duplication rule.

Deliverable: `docs/context-map.md` — vocabulary key, a mermaid diagram distinguishing real imports
(solid) from UI-mediated flows (dashed), the relationship table, one "What it obliges" section per
relationship, and a closing table naming the rows that rot silently. No code change. No version bump.

## Acceptance criteria

- AC1: `docs/context-map.md` exists. | verify: `test -f docs/context-map.md`
- AC2: All five contexts and all four outside partners are named. | verify: `bash -c 'for n in armylist ruleengine catalog rulebook play XSD Ergofarg Lexicanum 6th.whfb.app; do grep -q "$n" docs/context-map.md || exit 1; done'`
- AC3: The DDD relationship patterns are named in DDD's own words. | verify: `bash -c 'for p in Upstream Downstream "Shared Kernel" "Customer/Supplier" Conformist "Anticorruption Layer" "Open Host Service" "Published Language" "Separate Ways"; do grep -qi "$p" docs/context-map.md || exit 1; done'`
- AC4: Every row is backed by evidence — at least 8 `path:line` citations and at least 10 ADR references. | verify: `bash -c 'test "$(grep -coE "\.(js|jsx|json):[0-9]+" docs/context-map.md)" -ge 8 && test "$(grep -coE "ADR.0[0-9]{3}" docs/context-map.md)" -ge 10'`
- AC5: Every relationship carries an obligation paragraph — at least 9. | verify: `bash -c 'test "$(grep -c "What it oblige" docs/context-map.md)" -ge 9'`
- AC6: A mermaid diagram is present with the five contexts, the four partners and `src/ui/`. | verify: `bash -c 'awk "/^\`\`\`mermaid/,/^\`\`\`$/" docs/context-map.md | grep -q armylist'`
- AC7: The map does not restate ADR-0042 — no directory table, and it links to the ADR. | verify: `bash -c 'grep -q "0042-schnitt-nach-fachlichkeit" docs/context-map.md && ! grep -qE "ports/(storagePort|catalogRepository)\.js" docs/context-map.md'`
- AC8: Every relative link resolves on disk. | verify: `bash -c 'cd docs && grep -oE "\]\([^)#]+\)" context-map.md | tr -d "])" | sed "s/^(//" | grep -v "^http" | while read -r p; do [ -e "$p" ] || exit 1; done'`
- AC9: The map is reachable from the project map, from ADR-0042 and from the contexts area note. | verify: `bash -c 'grep -q context-map.md docs/project-map.md && grep -q context-map.md docs/adr/0042-schnitt-nach-fachlichkeit-bounded-contexts-und-ports.md && grep -q context-map.md .claude/rules/areas/contexts.md'`
- AC10: `docs/glossary.md` no longer attributes "`ui` is a bounded context" to ADR-0042. | verify: `bash -c '! grep -qE "\`ui\`\), per \[ADR-0042" docs/glossary.md'`
- AC11: The claims about the code are true at merge time — one cross-context import, the forbidden reverse edges, the door's consumer count. | verify: `bash -c 'test "$(grep -rn "from .\.\./\.\./\(armylist\|ruleengine\|catalog\|rulebook\|play\)/" src/contexts --include=*.js | wc -l)" -eq 1 && grep -q evaluator-keine-roster-abhaengigkeit .cast/rules.json && test "$(grep -rlE "from .[^\x27]*ruleengine/readmodel/index" src/ui | wc -l)" -eq 13'`
- AC12: The gates stay green. | verify: `bash -c 'forge-lint && forge-test && forge-typecheck && forge-build'`
- AC13: No code change — only documentation and the contexts area note are touched. | verify: `bash -c 'test -z "$(git diff --name-only main... | grep -vE "^(docs/|\.claude/rules/)")"'`

## Out of scope

- **No code change.** Not the `@param {Object}` typing (0198), not the duplicated cost rule (0195),
  not the cross-aggregate policy in a hook (0193). The map *names* those debts as obligations; it
  does not pay them.
- No new ADR and no status change to an existing one — only the cross-reference bullet in ADR-0042.
- **No declaration of the core domain.** That is 0197 and it is a decision, not a description. The
  map deliberately says nothing about where to spend effort.
- No cast rule, no test, no link checker to hold the map. Making the silently-rotting rows
  machine-held is a worthwhile follow-up; the map's closing table is what makes that follow-up
  arguable.
- Not a translation of the German ADRs — the map points at them.

## Open questions

1. `.claude/rules/areas/docs.md:10` says documentation is German, but `docs/glossary.md`,
   `docs/project-map.md`, `README.md` and both DDD reviews are English. The rule looks stale rather
   than the practice. Confirm the language, and fix the rule either way (issue 0202).
2. ADR-0042 is `Accepted`; the proposed cross-reference bullet is a pointer, not a change of
   decision. If ADRs should be immutable once accepted, drop that bullet and relax AC9.
3. "Customer/Supplier" for `armylist → ruleengine` asserts a process that does not exist — there is
   no forum in which one context's needs reach the other's planning, because both are the same
   person. The map states the pattern the *code* implements. Soften to "Customer/Supplier in
   structure, conformist in practice"?
4. Jekyll serves `docs/` and does not render mermaid without a plugin, though GitHub's repository
   view does. Does the Pages rendering matter here?
