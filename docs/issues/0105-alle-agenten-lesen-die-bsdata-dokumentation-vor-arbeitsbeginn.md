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
5. When any ADR is read, it contains no BattleScribe-format information that
   the bsdata documentation also covers, and none that contradicts it —
   format explanations are replaced by references to the bsdata
   documentation; the ADRs keep only their decisions. (Added by the
   maintainer mid-run.)

## Plan

## Tasks

For criterion 5 (ADR sweep):

- [x] Audit all 36 ADRs against `docs/battlescribe-data-format.md` (three
      parallel researchers, per-ADR passage list: duplicate | contradiction)
- [x] Edit the flagged ADRs: remove format explanations and contradictions,
      keep the decisions, point to the bsdata documentation instead
- [x] Bump the revised ADRs' dates in the ADR index
- [ ] Fresh-context review of the whole intent (criteria 1–5)

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
- Review round 3 (fresh context, whole intent): 1 finding, outside the
  criteria — the ADR index (`docs/adr/README.md`) still dated ADR 0001
  2026-07-05, hiding the new precedence exception from index readers.
  **Fixed:** date bumped to `2026-07-29 (rev.)` per the index's convention.
  All four criteria confirmed met; round 2's dismissal of the link trait
  re-verified independently. Noted tension, no action: the precedence rule
  intentionally lives in both `.agents/AGENTS.md` (criterion 4) and ADR 0001
  (criterion 3) — a future change must move both together.
- ADR sweep for criterion 5 (three parallel researchers over all 36 ADRs vs.
  the bsdata doc): 26 ADRs clean. Format restatements removed and replaced by
  doc references in 0003 (the heavy case: ID rule, cost-type semantics,
  quantity math, force/parent constraint frames, `shared`, top-level parent
  fallback, radio-vs-checkbox, optional upgrades, categories), 0005, 0011,
  0014, 0016, 0018, 0027, 0029, 0031, 0032. One contradiction fixed: ADR 0032
  B2 claimed a `forceEntry` points limit is "not directly expressible" while
  the doc's §5.6 documents the real `limit::` pattern — reworded to the
  engine-model statement. ADR-only facts (not in the doc, no contradiction)
  stayed per the maintainer's instruction; their promotion into the doc is
  filed as issue 0106. The audit's side find — ADR 0031 contradicting ADR
  0030 on the cutover status, outside bsdata scope — is filed as issue 0107.
  Index dates of all ten revised ADRs bumped to 2026-07-29 (rev.).

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

- Does this match what was asked? Yes — the two rules in the one file every
  agent receives (read the bsdata documentation first; it wins over the
  ADRs), the matching exception in ADR 0001, and the sweep of all 36 ADRs
  that removed restated format semantics and the one contradiction, leaving
  decisions plus doc references.
- What surprised me? ADR 0001's "einzige Quelle der Wahrheit" claim (caught
  in round 2, the moment the precedence rule existed), and how concentrated
  the duplication was: 10 of 36 ADRs, with ADR 0003 carrying most of it.
- What am I assuming without having verified it? That the harness injects
  `CLAUDE.md` into every subagent's context (from checkpoint 1). That the
  ADR 0032 B2 rewording — an engine-model statement instead of a format
  claim — matches the evaluator's actual code; the audit compared doc
  against doc only. The wiki submodule stays uninitialized in a fresh
  clone — the rule links it as upstream source only.

## Retro
