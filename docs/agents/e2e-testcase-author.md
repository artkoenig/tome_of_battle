# E2E test-case author: the black-box scenario writer

End-to-end test cases for the Reinraum evaluator (`src/evaluator/`) are authored
by a dedicated **black-box** subagent, `e2e-testcase-author`
(`.claude/agents/e2e-testcase-author.md`). This document describes what that
agent does, why it is deliberately blind to the engine, and how its output plugs
into the manifest-driven runner. The architectural decision behind it is
[ADR 0033](../adr/0033-evaluator-e2e-manifest-runner-und-black-box-autorenschaft.md).

## When it runs

Whenever a new evaluator rule needs an E2E fixture — for example after a new
engine rule is added or a bug is fixed — the work of writing the scenario is
**delegated to `e2e-testcase-author`**, not done in the main conversation. The
agent is given the domain rule to pin down (in plain language) and a slug for the
new scenario directory. It never runs code and never talks to the user; it reads,
it writes scenario files, and it hands back a short summary.

## Why black-box

The agent is **blind to the evaluator's implementation** on purpose. It derives
what a scenario should assert from the Battlescribe **data** and its **format
specification**, never from the engine code. If an author peeks at
`src/evaluator/*.js`, they write a test that mirrors whatever the engine
currently does — cementing its bugs as "expected" — instead of a test that pins
the behavior the catalog data actually demands. Keeping the author independent of
the engine is what lets the test genuinely challenge the engine rather than echo
it.

## Allowed sources (the read allow-list)

The agent may read **exclusively**:

1. **The data-format specification** — `docs/battlescribe-data-format.md`.
2. **The vendored schema and its ADRs** — `src/parser/schema/Catalogue.xsd` and
   the domain ADRs `0003`, `0011`, `0016`, `0031`.
3. **The real catalog fixtures** — everything under
   `src/evaluator/__fixtures__/whfb6-definitive/` (the `.gst`/`.cat` XML the
   runner loads). This is catalog **data**, not engine code.
4. **Existing scenarios** as the format template — everything under
   `docs/testing/**`.

### Forbidden sources

The exclusion is an allow-list, not a blanket "never touch `src/`" rule — the
catalog data itself lives under `src/`. Concretely, the agent must **never** read
any part of `src/` **except** the catalog fixtures above, and in particular
**never `src/evaluator/*.js`** (the engine, its facade, its query/join layers, or
any other evaluator/app source). It has no Bash tool, so the read allow-list
cannot be bypassed via the shell. If a question feels answerable only by reading
engine code, that is the signal it is about to infer an expectation from the
implementation — it answers from the catalog XML and the format spec instead, or
stops and reports the gap.

## The deliverable — three artifacts per scenario

For each rule, the agent produces a complete scenario under
`docs/testing/<scenario>/` that the runner discovers and executes on its own:

1. **Minimal `.ros` roster(s)** under `rosters/` — the smallest rosters that make
   the constraint fire (and that legally satisfy it), using the real roster shape
   verified in existing scenarios.
2. **The scenario `README.md`** — the derived rules with their catalog-data
   evidence, a per-roster catalog, and a "Verifizierte Bausteine" table of the
   element ids relied on, in the German style of
   `docs/testing/vampire-bloodlines/README.md`.
3. **The machine-readable manifest `scenario.json`** — the single source of truth
   the runner consumes (contract below).

The agent does **not** write the runner and does **not** write any `.test.js`:
those touch source and belong to the engine side, not to authorship. Its output
is data and prose only.

## The manifest contract (`scenario.json`)

The manifest is the machine-readable expectation, fillable from the catalog data
alone. Its authoritative shape lives in the header doc-comment of
[`src/evaluator/e2e.testcatalog.test.js`](../../src/evaluator/e2e.testcatalog.test.js)
and in `docs/testing/vampire-bloodlines/scenario.json`. In outline:

```json
{
  "schemaVersion": 1,
  "name": "<scenario>",
  "description": "<plain-language summary>",
  "dataset": {
    "gameSystem": "<repo-root-relative path to the .gst>",
    "catalogues": ["<repo-root-relative path to a .cat>", "..."]
  },
  "rosters": [
    {
      "file": "rosters/<name>.ros",
      "description": "<plain-language summary of this roster's state>",
      "dataset": { "...": "OPTIONAL per-roster override of the scenario dataset" },
      "expect": {
        "firing": [
          { "limitId": "<constraint-id>", "actual": 0, "bound": 1, "count": 2 }
        ],
        "absent": ["<constraint-id>", "..."],
        "messages": [
          {
            "origin": "derivedLimit|authorMessage",
            "limitId": "<constraint id — derivedLimit only>",
            "anchorDefId": "<definition id of the anchor>",
            "anchorPath": "<slot path — last resort>",
            "text": "<message text — selector AND assertion for an author message>",
            "count": 0,
            "severity": "error|warning|info",
            "anchorName": "<effective display name of the anchor>",
            "anchorKind": "occupied|mandatoryPhantom|groupAnchor|categoryAnchor|offerAnchor|roster",
            "isValueUnstable": false,
            "limitKind": "min|max",
            "measure": "selectionCount|forceCount|costSum|budgetLimit|rosterBudget",
            "costTypeId": "<costType id, or null>",
            "isPercent": false,
            "scopeKind": "roster|force|parent|self|entryId|categoryId",
            "scopeTargetId": "<id, or null>",
            "actual": 0, "bound": 1, "delta": 1,
            "causes": [
              { "witnessDefId": "<id>", "witnessName": "<catalog name>",
                "modifierKind": "set|increment|decrement|multiply", "value": 0 }
            ]
          }
        ],
        "capabilities": [
          {
            "defId": "<definition id of the slot itself — for a link slot, the link>",
            "targetDefId": "<id the link points at — the category of a category anchor>",
            "anchorKind": "occupied|mandatoryPhantom|groupAnchor|categoryAnchor|offerAnchor",
            "frameDefId": "<definition id of the enclosing contingent or parent selection>",
            "path": "<slot path — only when the selectors above still leave it ambiguous>",
            "name": "<expected effective display name>",
            "current": 0,
            "effectiveMin": null,
            "effectiveMax": 3,
            "headroom": 3,
            "isHidden": false,
            "isBlocked": false,
            "isMandatoryUnmet": false,
            "authorMessages": [{ "severity": "error|warning|info", "text": "<catalog text>" }],
            "infoElements": [
              {
                "id": "<profile, rule or infoLink id — the OCCURRENCE>",
                "kind": "profile|rule",
                "name": "<effective display name>",
                "profileTypeId": "<profileType id — profiles only>",
                "profileTypeName": "<its plain-text name — profiles only>",
                "text": "<the rule's <description> — rules only>",
                "characteristics": [
                  { "typeId": "<characteristicType id>", "name": "<its plain-text name>", "value": "<effective value>" }
                ]
              }
            ],
            "infoElementsAbsent": ["<id that must NOT appear in this slot's projection>"]
          }
        ],
        "diagnostics": {
          "present": [{ "kind": "<DiagnosticKind>", "targetId": "<id>", "minCount": 1 }],
          "absent": [{ "kind": "<DiagnosticKind>", "targetId": "<id>" }]
        }
      }
    }
  ]
}
```

Key points of the contract:

- **Dataset paths** are repo-root-relative; `catalogues` is ordered and must
  include every `.cat` the rosters need (including those pulled in via
  `catalogueLink`, e.g. the shared Mercenaries dependency).
- **Roster-level `dataset` override** — a roster may declare its own `dataset`
  (same shape) to check the *same* build against a *different* set, e.g. **without**
  the Mercenaries dependency, to prove a "missing dependency" diagnostic.
- **`expect.firing`** lists limit-ids that MUST fire, each with `actual`/`bound`.
  Optional `count` requires the limit to fire *exactly* that many times (one anchor
  per contingent, §7.7).
- **`expect.absent`** lists limit-ids that MUST NOT fire.
- **`expect.messages`** (optional) asserts what a single message *is*, in domain terms.
  The report carries **one** message list holding both kinds, told apart by the
  mandatory `origin` discriminator: `derivedLimit` (the engine derived it from an
  unsatisfied `<constraint>`, or from its own "army too expensive" budget rule) and
  `authorMessage` (a `<modifier type="add" field="error"|"warning"|"info">` whose
  conditions hold). `origin` decides which fields a message even carries — the limit
  fields are absent on an author message, `text` is absent on a derived one.
  - **Selecting the meant message.** `origin` plus, as needed, `limitId`,
    `anchorDefId`, `anchorPath` or — for an author message — the exact `text`. It
    must hit exactly one, unless `count` states how many; `count: 0` demands absence.
  - **`limitKind` / `measure` / `costTypeId` / `isPercent`** — *what kind* of limit
    it is: `min` or `max`, over the selection count (`field="selections"`), a cost
    sum (`field="<costType id>"`), the contingent count (`field="forces"`), the
    configured cost limit (`field="limit::<costType id>"`), or the engine's own
    roster budget. For a percent constraint the reported `bound` is the derived
    absolute number, while the derivation describes the percentage.
  - **`scopeKind` / `scopeTargetId`** — *what kind* of reference frame. The raw
    `scope` attribute is a keyword **or** an id, and one cannot tell by looking; the
    report says which, so a scenario states `entryId` vs `categoryId` explicitly.
  - **`anchorKind`** — where it hangs. `roster` is carried only by the army-too-expensive
    rule; an `offerAnchor` never carries a message at all, though its capability
    record still lists its `authorMessages`.
  - **`severity`** — a derived message is always `error`; an author message keeps the
    severity its modifier's `field` names.
  - **`causes`** — the triggering selections (ADR-0027): a limit modifier that carried
    conditions, actually changed the number, and whose condition names a selectable
    entry (via `childId`, counting `field="selections"`, actually present). A modifier
    without conditions is not a cause, and a condition aimed at a category or at
    `childId="model"` yields none — nothing is invented. This assertion is **complete**
    and order-free; `[]` demands that the message names no cause.
  - **`text`** — for an author message, the catalog wording, NOT translated and NOT
    reworded, but with the BattleScribe token `{this}` replaced by the entry's
    **effective** display name. An unknown token stays verbatim.
- **`expect.capabilities`** (optional) asserts what a single slot *is*, not only which
  limits fire on it. A **slot** is every place a selection *can* stand — whether
  something stands there or not: the report carries one capability record per
  occupied selection, per mandatory anchor, per group anchor, per category of a
  contingent, **and per selectable-but-unchosen definition** (the *offer*). Per slot:
  - **Selecting the meant slot.** Name it with `defId` (the slot's own definition —
    for a **link** slot that is the link itself, e.g. the `categoryLink`, not the
    category) or with `targetDefId` (what the link points at — the *category* of a
    category anchor, the entry behind an `entryLink`); at least one of the two is
    mandatory. Because the same definition is usually both occupied in one
    contingent and offered in another, narrow it further with `anchorKind`
    (`occupied` | `mandatoryPhantom` | `groupAnchor` | `categoryAnchor` |
    `offerAnchor`) and/or `frameDefId` (the id of the enclosing contingent or parent
    selection). Fall back to the positional `path` only when those still leave it
    ambiguous — the runner reports an ambiguity rather than silently picking one.
  - **`current` / `effectiveMin` / `effectiveMax` / `headroom`** — the slot's numbers
    in its frame: what is there now, the effective bounds (`null` = no such bound;
    a `max` with the catalog's "unlimited" value counts as absent, not as 0), and
    what still fits. All derived from the constraint declared in the XML and the
    roster's structure.
  - **`isHidden` / `isBlocked` / `isMandatoryUnmet`** — availability is *read off*
    this record, never computed: hidden is what a `field="hidden"` modifier switched
    off, blocked is a maximum that is used up, mandatory-unmet is a minimum that is
    not reached. A locked or hidden slot is still **present and marked** — a missing
    record would be indistinguishable from a forgotten one.
  - **`name`** — the **effective** display name, i.e. after every `field="name"`
    modifier that fires (`set` replaces it, `append`/`prepend` join with the
    modifier's `join` attribute, or without a separator when it has none).
  - **`authorMessages`** — the catalog's own messages at that slot, from
    `type="add" field="error"|"warning"|"info"` modifiers. This assertion is
    **complete** for that slot (order does not matter): `[]` demands that no author
    message fires there. `text` is the catalog text verbatim.
  - **`infoElements`** — the **profiles and rule texts that apply to this slot**, as
    a **subset**: name only the ones the scenario pins down. The list holds the
    slot's own info elements **and those of its occupied sub-selections** (inherited),
    in document order; an element that is itself hidden, or that hangs on a hidden
    node, is **not** in it. `id` is mandatory and names the **occurrence**: the
    `<profile>`/`<rule>` itself, or — when the slot pulls a shared element in — the
    `<infoLink>`, because a linked element appears **at the link's position** and
    under the link's name. An `<infoLink>` pointing at an `<infoGroup>` contributes
    the group's *members*, not an entry of its own. A profile entry carries its
    `profileTypeId`/`profileTypeName` and its `characteristics` (again a subset);
    `typeId` is the `<characteristicType>` id from the game system's `<profileTypes>`,
    the same id a characteristic modifier names in its `field`, and `value` is the
    **effective** value after every modifier that fires. A rule entry carries its
    `text` — the verbatim `<description>` (`null` when the rule has none). *Verbatim
    means byte-exact:* 57 of the 660 `<description>` elements in the Vampire Counts
    catalog contain **non-breaking spaces (U+00A0)**, which render like ordinary
    spaces but are not. Copy the characters as they stand, or pin the rule down with
    its `id`/`name` and leave `text` unasserted rather than transcribing it by eye.
    "Hidden" here is the **effective** visibility: the base `hidden="true"` of the
    catalog element, overridden by a `field="hidden"` modifier on that same element
    when its conditions hold.
  - **`infoElementsAbsent`** — the counter-statement: a list of occurrence ids that
    must **not** appear in that slot's projection. `infoElements` alone is a subset
    assertion and therefore never notices a *missing* entry, so the two rules that
    are about absence — "hidden stays out" and "a link to an `<infoGroup>` carries no
    entry of its own" — are only checkable through this key.
- **`expect.diagnostics`** (optional) asserts over `report.diagnostics`: `present`
  requires diagnostics of a given `DiagnosticKind` (optionally narrowed by
  `targetId`/`defId`, with a `minCount`), `absent` forbids them.
- The expectation is **selective, not exhaustive**: beyond the ids/kinds named,
  it makes no claim. Other army-build diagnoses (general/core requirements, points
  limits) may additionally occur without breaking a case.

Both `actual` and `bound` are derived from the catalog XML and the roster the
agent built — `bound` is the constraint's `value`, `actual` is what the roster's
structure produces under the constraint's scope — **never** from an engine run or
its source.

## How the runner consumes the manifests

The two halves fit together at runtime, with no shared code between author and
engine beyond the manifest:

1. The runner `src/evaluator/e2e.testcatalog.test.js` scans `docs/testing/` and
   picks up every subdirectory that carries a `scenario.json`.
2. For each roster in a manifest it loads the declared `dataset` (the roster-level
   override, else the scenario dataset), parses the `.ros`, and calls the public
   facade `evaluate`.
3. It checks the resulting report's `violations` against `expect.firing` /
   `expect.absent` and its `diagnostics` against `expect.diagnostics`, generating
   one dynamic test case per roster.

So the author declares *what* each roster should assert (in data), and the runner
supplies *how* it is executed and checked (in code) — the two never see each
other's internals, which is exactly the independence the black-box premise buys.

## Companion catalog and consistency

Every scenario is also summarised in non-technical language in the
[Testkatalog](../testkatalog-evaluator-e2e.md). Catalog and scenario stock are
kept identical **by hand** — there is deliberately no generator and no CI gate
(see the catalog's "Pflege-Regel" and ADR 0006). Whoever adds, renames, or removes
a scenario or roster updates the catalog in the same step.
