---
status: backlog
branch:
pr:
---

# ADR 0032 B1 states the opposite of what the category anchors do

## Goal

`docs/adr/0032-evaluator-loest-mehr-katalog-datensaetze-global-by-id-auf.md:143-148` records, as
point B1 of an `Accepted` decision, that a phantom anchor is synthesised for a `categoryEntry`
**only** where the category carries a MIN limit, and that a category with MAX limits alone stays
"effectively unlimited". The engine does neither half:
`src/contexts/ruleengine/engine/evalTree.js:581-589` hangs an anchor on **every** `categoryLink` of a
force, unconditionally, without looking at a limit at all; `:658` and `:683-684` gate the unlinked
case on `hasAnyLimitInFrame(def, ROSTER|FORCE|PARENT)` — *any* limit in the frame, not a MIN.

This is not a stale path or a typo, and it is not a bug either. The function's own docblock at
`:595-599` states the contrary position deliberately and gives the reason: a MIN limit already gets
its anchor through `synthesizeMandatoryPhantoms`, whereas "eine Kategorie mit ausschliesslich
MAX-Grenzen bliebe ohne diesen Schritt ankerlos und ihre Grenze still unausgewertet (Issue 0092, die
klassische 0–1-Kodierung)"; `:572-574` says the same for the linked case. Issue 0092 is `done`. The
decision recorded in B1 was reversed by that work, and nothing recorded the reversal.

That makes this the one piece of documentation drift in the tree that can mislead about **domain
behaviour** rather than about a path or a tool. A reader who trusts B1 concludes that a MAX-only
category limit is not enforced — the exact defect Issue 0092 fixed — and may "restore" it. The
comment at `:595-599` was written to stop that, which shows the author expected the confusion; it is
in the wrong place to be found by someone reading the ADRs.

What has to be decided, and by a person who knows the domain, is which record now holds. The
evidence says the code: 0092 is closed, the behaviour is reasoned in the source, and B1 describes an
evaluator that would silently drop a documented limit. If that reading holds, B1 needs a dated
amendment naming Issue 0092 and stating what actually happens — or, where the change is judged large
enough, a new ADR superseding 0032 on that point alone, with 0032's status line pointing at it. What
must not happen is the body of B1 being quietly reworded: it recorded a real decision, and a reader
of the history is entitled to see that it was taken and then reversed.

The second half is that nothing stops the drift from recurring. Unconditional anchoring on every
`categoryLink` is an assertion about the shape of the evaluation tree that no criterion names today.
Where a scenario under `docs/testing/` already pins a MAX-only category limit end to end, the ADR
note should name it, so the record and the pin point at each other; where none does, the scenario is
this issue's work, authored black-box from catalogue data.

No version bump: no behaviour changes. The engine already does the right thing.

## Acceptance criteria

- AC1: The reading is settled in writing — either the code is confirmed correct and B1 is amended, or B1 is confirmed correct and a defect issue is opened against `evalTree.js` instead. The issue is not done until one of the two is recorded. | verify: manual read during review
- AC2: ADR 0032 no longer asserts, anywhere a reader meets it first, that MIN is the condition for a category anchor. | verify: manual read of `docs/adr/0032-evaluator-loest-mehr-katalog-datensaetze-global-by-id-auf.md`
- AC3: The correction names Issue 0092 as the reason the decision moved, and is marked as an amendment with its date — B1's original text stays legible as what was decided then. | verify: `bash -c 'grep -q "0092" docs/adr/0032-evaluator-loest-mehr-katalog-datensaetze-global-by-id-auf.md'`
- AC4: Where a new ADR was chosen over an amendment, `0032`'s status line and `docs/adr/README.md` both name it; where an amendment was chosen, neither claims a supersession. | verify: manual read
- AC5: A MAX-only category limit is pinned end to end by a scenario under `docs/testing/` — an existing one where it already covers the case, a newly authored one otherwise — and the ADR note names that scenario by directory. | verify: manual read, then `forge-test --run src/tests/contexts/ruleengine/engine` over the named scenario
- AC6: The engine is untouched — anchoring behaviour is identical before and after. | verify: `bash -c '! git diff --name-only origin/main | grep -q "^src/contexts/ruleengine/engine/" && forge-test --run src/tests/contexts/ruleengine'`
- AC7: Suite and gates green. | verify: `bash -c 'forge-test && forge-lint && forge-typecheck'`

## Out of scope

- Every other ADR correction — issue 0205 owns the dependency-cruiser mentions, the dead
  `src/domain/` paths, the wrong rule name and the wrong rule count.
- Splitting `evalTree.js`. Issue 0202 decided against it for now and named the seam; this issue
  changes no line of it.
- The rest of ADR 0032. Only B1 is contradicted; the global-by-id resolution it decided holds.
- Any change to what the evaluator reports.
