---
status: backlog
branch:
pr:
---

# Format facts documented only in ADRs belong in the bsdata documentation

## Intent

Issue 0105 made `docs/battlescribe-data-format.md` the canonical, precedent
reference for the BattleScribe format. The ADR sweep (issue 0105, criterion 5)
found format facts that live **only** in ADRs — under the new precedence
architecture they belong in the doc, with the ADRs pointing at it:

- ADR 0003: modifier **document order** (`increment 2` then `set 5` ⇒ 5);
  `shared` never affects `scope="parent"`; cost-type ids are non-standardized
  (GUIDs vs. `points`, no reserved points id).
- ADR 0028: the `{this}` token and BattleScribe's rendering of it — the doc
  does not cover text tokens at all.
- ADR 0011: `.ros` structural semantics (`::`-paths, embedded totals, nested
  `<forces>`) — the doc's §15 explicitly declares `.ros` a source gap.
- ADR 0029: the repeat formula `floor/ceil(n / value) · repeats` is more
  precise than the doc's prose.

Acceptance criteria:

1. When the bsdata documentation is read, it contains the facts listed above
   (or records, per fact, why it deliberately does not).
2. When the owning ADRs are read afterwards, they reference the doc for these
   facts instead of being their only carrier.

## Plan

## Tasks

## Decisions

## Log

## Checkpoints

### Before implementation

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
