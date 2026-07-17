Status: ready-for-agent
Type: feature
Blocked by: None

## Description
# PRD: GitHub Issue Triage

## Problem Statement / Bug Description
`.github/workflows/issue_agent.yml` + `scripts/github_issue_agent.py` currently
triage newly opened GitHub issues via a direct Anthropic API call and, once a
human posts an approval keyword (`/approve`, `approved`, `genehmigt`, …) and
passes an authorization check, hand off to `claude-code-action` to implement
the change directly and open a PR that closes the issue.

The maintainer wants read-only pre-analysis support only: automatic
clarification of unclear reports via follow-up questions, analysis of bug
reports, and a signal (a GitHub label) when a report deserves their attention
— nothing more. No local main-issue is to be created from a GitHub report, no
implementation, no PR. The current script's direct-implementation handoff
(and its approval/authorization gate, which exists only to guard that
handoff) is now unwanted scope entirely, and its LLM calls run on the paid
Anthropic API when a free-tier model is more than sufficient for this
low-stakes classification task.

## Solution
Strip the workflow down to triage + clarification + attention-labeling only,
and switch the LLM call to the Gemini API free tier.

Concretely:
- `analyze_issue` keeps its existing job — decide whether the report is clear
  and, if not, which follow-up questions to ask — but its output shape changes
  from today's `{labels, is_clear, questions, implementation_plan}` to
  `{is_clear, questions, needs_attention}`. `needs_attention` is a plain
  boolean: true when the agent judges the report to be a plausible bug or a
  well-formed feature request worth the maintainer's attention.
- The clarification loop is unchanged in spirit (single edited bot comment,
  keyed on the same marker-string convention as today): on `issues.opened` and
  on every non-bot `issue_comment.created`, the script re-runs `analyze_issue`
  with the full comment history and updates the bot comment.
- The approval/authorization gate is removed entirely (`is_agent_requested`,
  `analyze_comment`, `is_authorized`, `find_implementation_plan`,
  `build_implementation_prompt`, the `should_implement`/`implementation_prompt`
  GITHUB_OUTPUT, and the second `claude-code-action` workflow step). Nothing
  the script does is privileged enough anymore to need a human gate: it only
  ever posts/edits one comment and adds/removes one label.
- The single fixed label `needs-attention` is a terminal, one-way marker: the
  script checks for its presence **before** doing anything else (before
  calling the Gemini API at all) and, if present, exits immediately without
  analyzing or commenting — once flagged, the maintainer has taken over and
  the agent stops reacting to that issue entirely, including to further
  comments. If not present and the current run's verdict is `needs_attention
  = true`, the label is added via `issue.add_to_labels`. No freeform/arbitrary
  labels, no category/priority/effort/duplicate-check labels, and no code
  path ever removes the label again.
- The workflow's `contents: write` and `pull-requests: write` permissions are
  dropped; only `issues: write` remains, since nothing writes to the
  repository content anymore.
- The LLM client switches from `anthropic.Anthropic` /
  `claude-opus-4-8` to the `google-genai` package calling
  `gemini-3.1-flash-lite` (current free-tier Flash-Lite model per
  [ai.google.dev](https://ai.google.dev/gemini-api/docs/models) — verify the
  exact model id and client call pattern against current official docs at
  implementation time, since Google's API surface — e.g. the newer
  "Interactions API" — is still evolving). The already-existing
  `GEMINI_API_KEY` GitHub secret (orphaned since the earlier migration to
  Anthropic, commit `d2ab463`) is reactivated as the workflow's env var; no
  new secret needs to be created.

This is a pure reduction and provider swap — no relationship to the local
`docs/issues/` tracker is introduced; GitHub issue triage and the local
main-issue tracker remain two fully separate systems.

## User Stories / Requirements
1. As the maintainer, I want a newly reported GitHub issue that is unclear to
   be automatically asked clarifying follow-up questions, so I don't have to
   do that back-and-forth myself.
2. As the maintainer, I want bug reports and feature requests analyzed
   automatically and labeled `needs-attention` when the agent judges they're
   worth looking at, so I can filter my GitHub issue list without reading
   every report in full first.
3. As the maintainer, I do not want any local main-issue, branch, or PR
   created as a side effect of this — GitHub issue triage stays entirely
   separate from the local issue tracker.
4. As the maintainer, I want this to run on a free-tier LLM API, since the
   analysis is simple enough not to justify paid-API cost.
5. As the maintainer, once an issue has been labeled `needs-attention`, I want
   the agent to stop reacting to it entirely (no more analysis, no more
   comments), since at that point I'm handling it myself and further
   automated comments would just be noise.

## Technical Decisions
- **Affected Modules:** `.github/workflows/issue_agent.yml`,
  `scripts/github_issue_agent.py` (in-place rework, not a new workflow file).
- **Technical Clarifications / Architectural Decisions:**
  - ADR 0007 updated to document this workflow (previously undocumented) with
    its actual, reduced scope (see `docs/adr/0007-ci-cd-workflow.md`, section
    "4. GitHub-Issue-Triage").
  - No approval/authorization gate: every issue event (open or human comment)
    is analyzed and acted on automatically; the only actions taken (editing
    one comment, syncing one label) are low-risk and fully reversible.
  - No relationship to `tracker.py` or the local `docs/issues/` tracker exists
    in this workflow at all.
- **API Contracts / Data Models:**
  - `analyze_issue` output: `{is_clear: bool, questions: list[str],
    needs_attention: bool}`.
  - Label taxonomy: exactly one fixed label, `needs-attention`, applied once
    and never removed by this script. Its presence is also the short-circuit
    condition checked at the top of every run.

## Testing Decisions
- **Modules to Test:** `scripts/github_issue_agent.py`.
- **Test Interfaces (Seams):**
  - `analyze_issue(client, issue_title, issue_body, comment_history) ->
    {is_clear, questions, needs_attention}` — unit-tested via a mocked Gemini
    client (same treatment as today's mocked Anthropic client, provider
    swapped).
  - `has_attention_label(issue_labels: list[str]) -> bool` — new pure
    function, the short-circuit check run before any analysis; unit-tested
    directly.
  - `create_or_edit_agent_comment(...)` — thin I/O wrapper, not unit-tested,
    verified via manual/integration check, as today.
  - Adding the `needs-attention` label itself is plain I/O with no separate
    decision logic to isolate — no dedicated seam.
  - This is net-new Python test coverage: no `scripts/test_*.py` exists today
    for `github_issue_agent.py` (the repo's `python3 -m unittest discover -s
    scripts -p 'test_*.py'` currently discovers nothing for it).

## Out of Scope
- Any local main-issue/child-issue creation, branch creation, or PR creation
  from a GitHub-reported issue (fully removed from scope, not deferred).
- Category, priority, effort-estimate, or duplicate-detection labels/analysis.
- Any change to the shared `issue-tracker` skill format or to the
  `global-agents-config-and-skills` repo.
- Bootstrapping Claude Code skills/subagents into the GitHub Actions runner.
- Writing Python tests for the previously-existing (now removed) approval/
  authorization/implementation-handoff code paths.

## Acceptance Criteria
- [ ]

## Comments
