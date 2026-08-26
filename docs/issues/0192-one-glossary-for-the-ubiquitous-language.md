---
status: done
branch: claude/issues-186-192-r1f86s
pr:
---

# One glossary: decide per term whether the code or the prose is right

## Goal

Finding F7 of `docs/ddd-assessment-and-refactoring-plan.md`. This project has a rich domain
language — raising a unit into a contingent, an offer, an occupied slot, a mandatory list rule —
but it is spoken twice: in German in the comments and documentation, in BattleScribe's English
in the identifiers. Measured over `src/` without tests:

| prose | occurrences | code | occurrences |
|---|---|---|---|
| `Kontingent` | 364 | `Force` | 320 |
| `Angebot` | 124 | `Slot` / `offer` | 355 |

Every reader translates twice, and a term can drift on one side without the other noticing —
the reason `docs/project-map.md` warns that where it and an ADR disagree, the ADR is right and
the map is stale.

The fix is not "translate everything". It is one decision per term, written down once:

1. Collect the terms that carry meaning in this domain — contingent/force, offer/slot, raise,
   occupied, list rule, army-wide, upgrade, sub-unit, cost limit, category.
2. For each, decide whether the name is the BattleScribe term (because the format defines it and
   `docs/battlescribe-data-format.md` is the reference) or this project's own term (because the
   app means something narrower or different).
3. Write the decision into one glossary in `docs/`, with the losing term named as the synonym so
   a search finds it.
4. Rename in code where the decision went against the current identifier.

Where the BattleScribe term wins, the German prose keeps its word but the glossary makes the
mapping explicit — that is cheaper than renaming 364 comment occurrences and loses nothing.

Deliberately last of the eight measures: it is the cheapest and the least urgent, and doing it
after issues 0186 to 0191 means renaming inside a tree that is already cut by subject, where a
term belongs to a context and its scope is obvious.

## Acceptance criteria

- AC1: A glossary exists in `docs/`, one row per term: the chosen name, the synonym it replaces, the context it belongs to, and one sentence of meaning. | verify: `bash -c 'test -f docs/glossary.md && test $(grep -c "^|" docs/glossary.md) -ge 10'`
- AC2: Every term in the glossary names the context it belongs to. | verify: `bash -c 'grep -qE "armylist|ruleengine|catalog|play|rulebook" docs/glossary.md'`
- AC3: Where the decision went against the current identifier, the rename has happened — no term appears in code under a name the glossary rejects. | verify: `forge-test`
- AC4: The glossary is required reading where it matters: `CLAUDE.md`/`.agents/AGENTS.md` names it, and the relevant area notes link it. | verify: `bash -c 'grep -q "glossary" .agents/AGENTS.md'`
- AC5: `docs/battlescribe-data-format.md` stays the authority for the format's own terms; the glossary points at it rather than restating it. | verify: `bash -c 'grep -q "battlescribe-data-format" docs/glossary.md'`
- AC6: Behaviour is unchanged — the full suite passes. | verify: `forge-test`
- AC7: Types, lint and build stay green. | verify: `bash -c 'forge-typecheck && forge-lint && forge-build'`
- AC8: The app is unchanged in the browser. | verify: `node e2e/ui.test.js`

## Out of scope

- Translating the German documentation into English or the reverse. The language of the prose is
  not the subject; the double vocabulary is.
- Renaming anything inside `contexts/ruleengine/engine/`. The engine speaks the format's
  language on purpose (ADR-0031/0032), and 122 test files pin its terms.
- User-visible strings. Those live in `src/ui/i18n/locales/` and are a translation question, not
  a naming one.
- Renaming for style — shorter names, consistent casing, file names. Only terms that carry
  domain meaning are in scope.
- A version bump.
