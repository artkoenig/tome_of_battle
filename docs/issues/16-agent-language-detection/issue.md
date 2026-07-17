Status: resolved
Type: feature
Blocked by: None

## Description
# PRD: Agent Language Detection

## Problem Statement / Bug Description
The GitHub Issue Agent (`scripts/github_issue_agent.py`) always responds in
English, regardless of the language the issue or its comments are written in.
This is hardcoded in two places: the Gemini system instruction explicitly
requires "every question you raise must be written in English", and
`build_clarification_comment` wraps whatever questions Gemini returns in a
fixed English greeting/closing template. For a project whose own
documentation and target audience are German, an issue opened in German gets
an English clarification comment back — an avoidable mismatch between the
reporter's language and the agent's response.

## Solution
Let Gemini determine the predominant language of the whole conversation
(issue title, body, and all comments — it already receives the full thread on
every call) and generate the entire user-facing clarification comment body in
that language, instead of Python assembling an English template around
separately-generated question strings. If the language is ambiguous or mixed,
Gemini defaults to English.

The internal bookkeeping that lets the agent recognize and edit its own prior
clarification comment (currently a visible English text fragment used as a
marker) is decoupled from the visible, now-localized comment text: an
invisible HTML comment marker, appended by Python after Gemini's generated
text, takes over that role so comment-language never affects
create-vs-edit detection.

## User Stories / Requirements
1. As an issue reporter writing in German, I want the agent's clarification
   comment to be in German, so I don't have to context-switch languages to
   understand what's being asked of me.
2. As the maintainer, I want an ambiguous or mixed-language thread to still
   get a a sensible response, so I want Gemini to fall back to English rather
   than guessing wrong or failing.
3. As the maintainer, I want the agent to keep editing its existing
   clarification comment instead of creating duplicates, so I want the
   create-vs-edit detection to keep working regardless of the comment's
   language.

## Technical Decisions
- Affected Modules: `scripts/github_issue_agent.py`,
  `scripts/test_github_issue_agent.py`.
- Technical Clarifications / Architectural Decisions:
  - The `IssueAnalysis` schema drops `questions: list[str]` in favor of a
    single `comment_body: str`, generated fully by Gemini (greeting,
    questions, and closing sentence all included), since `questions` had no
    other consumer than the template it's replacing (avoids keeping two
    representations of the same content in sync).
  - The system instruction changes from a hardcoded "must be written in
    English" requirement to: detect and respond in the predominant language
    of the full conversation (title, body, comments); default to English
    when the language is ambiguous or mixed. No separate language-detection
    library or API call is introduced — detection stays inside the existing
    Gemini call.
  - `AGENT_COMMENT_MARKER` changes from a visible, English sentence fragment
    embedded in the displayed comment to an invisible HTML comment (e.g.
    `<!-- issue-agent:clarification -->`), appended by Python after Gemini's
    `comment_body`. `create_or_edit_agent_comment`'s
    `is_bot_author(...) and AGENT_COMMENT_MARKER in c.body` check is
    unchanged in structure, only the marker's value/visibility changes — this
    is what keeps edit-vs-create detection language-independent.
  - `build_clarification_comment` is simplified from a template-builder
    (interpolating a `questions` list into English boilerplate) to a
    pass-through that takes Gemini's `comment_body` and appends the marker,
    unmodified otherwise.
  - `is_clear` and `needs_attention` remain plain booleans driving control
    flow (whether to comment, whether to label) and are unaffected by
    language — they stay machine-facing, not shown to the user.
- API Contracts / Data Models:
  - `IssueAnalysis`: `is_clear: bool`, `needs_attention: bool`,
    `comment_body: str` (replaces `questions: list[str]`).

## Testing Decisions
- Modules to Test: `scripts/github_issue_agent.py` via
  `scripts/test_github_issue_agent.py`, using the existing
  `build_gemini_client(payload)` mock helper — no new test infrastructure.
- Test Interfaces (Seams):
  1. `analyze_issue(client, title, body, comments) -> IssueAnalysis` — same
     seam, asserted against the new 3-field schema.
  2. `build_clarification_comment(comment_body: str) -> str` — new,
     simplified seam; verify it passes non-English text (e.g. German with
     umlauts) through unmodified and appends the invisible marker.
  3. `create_or_edit_agent_comment` — same seam; verify edit-vs-create
     detection still works using the new invisible marker, independent of
     the comment body's language.
  4. System instruction content — a lightweight assertion that the hardcoded
     "must be written in English" requirement is gone, replaced by
     conversation-language detection with an English fallback, to guard
     against silent regression.

## Out of Scope
- Any language-detection mechanism outside of Gemini's own judgment (e.g. a
  dedicated NLP/langdetect library, or explicit ISO-639-1 language codes as a
  separate schema field).
- Localizing anything other than the clarification comment — the
  `needs-attention` GitHub label name/color, log output, and commit/PR text
  stay as they are.
- Per-commenter language switching mid-thread (e.g. always matching only the
  very latest comment's language) — Gemini judges the conversation's
  predominant language holistically instead.

## Acceptance Criteria
- [ ]

## Comments
- Vierachsige Verifikation (testing skill) durchgeführt: Standards PASS (0 blockierend, 7 vorbestehende Codebasis-Befunde außerhalb des Diffs), Spec 0 Abweichungen, Tests grün (406 Vitest + 25 Python), Docs 0 echte Inkonsistenzen. Main-Issue vollständig umgesetzt über sein einziges Child-Issue 01-agent-language-detection.
