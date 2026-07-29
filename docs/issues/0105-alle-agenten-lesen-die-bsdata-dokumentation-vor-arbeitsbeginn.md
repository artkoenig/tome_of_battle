---
status: active
branch: claude/bsdata-dokumentation-agenten-4ly70h
pr:
---

# All agents read the bsdata documentation before starting work

## Intent

Agents working in this repository routinely touch Battlescribe data (`.gst` /
`.cat` / `.ros`) or code that interprets it, but nothing obliges them to know
the format first. The canonical reference exists —
`docs/battlescribe-data-format.md` — yet only the `e2e-testcase-author` agent
is pointed at it. The maintainer wants a project rule: **every** agent reads
the bsdata documentation before it starts its work.

Acceptance criteria:

1. When an agent receives the project context (`CLAUDE.md`), that context
   contains a rule stating that the bsdata documentation must be read before
   taking up work, naming the canonical document by path.
2. When a reader follows the named path, they land on the canonical bsdata
   reference (`docs/battlescribe-data-format.md`).
3. When the rest of the documentation is checked against the new rule, no
   document contradicts it.
4. When the bsdata documentation and an ADR contradict each other, the
   project context tells the agent which one wins: the bsdata documentation
   takes precedence over the ADRs. (Added by the maintainer mid-run.)

## Plan

## Tasks

## Decisions

- "bsdata documentation" is read as `docs/battlescribe-data-format.md` — the
  file declares itself the canonical bsdata reference for this project, with
  the BSData wiki submodule as its upstream source. Default, unanswered.
- The rule lands in the project rules file (`CLAUDE.md`, a symlink to
  `.agents/AGENTS.md`), because that is the one context every agent — main
  session and subagents alike — receives. No per-agent edits needed; the
  `e2e-testcase-author` already mandates the document as its first allowed
  source. Default, unanswered.

## Log

- Rule added to `.agents/AGENTS.md` (target of the `CLAUDE.md` symlink), as a
  CRITICAL bullet right below the existing ADR reading rule, naming
  `docs/battlescribe-data-format.md` and the wiki submodule as its upstream
  source.
- Doc sweep for contradictions: `README.md:163` and the agent docs already
  point at the same file as the canonical reference — nothing contradicts the
  new rule.
- Review round 1 (fresh context, diff vs. intent): 0 findings. All three
  criteria confirmed met, no scope creep, no flawed logic. Documentation-only
  change — this review is the only check it gets; no suite or analysis
  applies to a markdown rule (nothing to run).
- Maintainer added criterion 4 after the first push: bsdata takes precedence
  over the ADRs. Precedence bullet added to the same section in
  `.agents/AGENTS.md`; same run, same branch.
- Review round 2 (fresh context, whole intent incl. criterion 4): 3 findings.
  Triage:
  1. ADR 0001 ("Die ADRs sind … die einzige Quelle der Wahrheit") contradicts
     the new precedence rule — criterion 3 broken. **Fixed:** an exception
     bullet added to ADR 0001's Single-Source-of-Truth section stating the
     bsdata documentation's precedence.
  2. The issue record still described the pre-criterion-4 state (round-1
     contradiction sweep, checkpoint 2 wording). **Fixed:** record updated —
     this entry and the revised checkpoint 2 below.
  3. Links in `.agents/AGENTS.md` resolve only via the root `CLAUDE.md`
     symlink, 404 when the file is browsed directly. **Dismissed:** the
     pre-existing ADR link on the line above has the same trait; root-relative
     links are the file's established convention, and the root view is the
     intended one.

## Checkpoints

### Before implementation

- Does this match what was asked? Yes — the maintainer asked for a project
  rule that all agents read the bsdata documentation before starting work; a
  CRITICAL rule in the project rules file is the direct form of that.
- What surprised me? `CLAUDE.md` is a symlink to `.agents/AGENTS.md`; edits
  must go to the target. And the `e2e-testcase-author` already requires the
  document, so the new rule generalizes an existing practice.
- What am I assuming without having verified it? That subagents actually
  receive the project `CLAUDE.md` as context (Claude Code injects it; not
  verifiable by exit code from here).

### Before the PR

- Does this match what was asked? Yes — two rules in the one file every agent
  receives: read the bsdata documentation before taking up work, and it takes
  precedence over the ADRs; plus the matching exception in ADR 0001 so no
  document contradicts them.
- What surprised me? ADR 0001's "einzige Quelle der Wahrheit" claim — the
  round-1 sweep passed because the precedence rule did not exist yet; round 2
  caught the contradiction the moment it did.
- What am I assuming without having verified it? Still the single assumption
  from checkpoint 1: that the harness injects `CLAUDE.md` into every
  subagent's context. The wiki submodule is uninitialized in a fresh clone —
  the rule links it as upstream source only, the required read is the
  in-repo file.

## Retro
