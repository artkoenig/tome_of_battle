Status: resolved
Type: feature
Blocked by: None

## Description
Implement the full PRD from the parent main-issue (`16-agent-language-detection`)
in one pass:

- Change `IssueAnalysis`: drop `questions: list[str]`, add `comment_body: str`.
- Update the Gemini system instruction so it no longer hardcodes English;
  instead it detects the predominant language of the whole conversation
  (issue title, body, all comments) and generates the entire clarification
  comment body (greeting, questions, closing) in that language, defaulting to
  English when the language is ambiguous or mixed.
- Change `AGENT_COMMENT_MARKER` from a visible English sentence fragment to
  an invisible HTML comment (e.g. `<!-- issue-agent:clarification -->`),
  appended by Python after Gemini's `comment_body` — so create-vs-edit
  detection in `create_or_edit_agent_comment` stays language-independent.
- Simplify `build_clarification_comment` to a pass-through that takes
  `comment_body` and appends the marker, no longer interpolating a
  `questions` list into an English template.
- `is_clear` and `needs_attention` stay plain booleans, unaffected by
  language.

## Acceptance Criteria
- [ ] `IssueAnalysis` has `is_clear: bool`, `needs_attention: bool`,
      `comment_body: str` (no `questions` field).
- [ ] The system instruction no longer requires English; it instructs
      Gemini to detect the conversation's predominant language and write the
      full comment in it, with an English fallback when ambiguous.
- [ ] `build_clarification_comment(comment_body) -> str` passes non-English
      text (e.g. German with umlauts) through unmodified and appends the
      invisible marker.
- [ ] `create_or_edit_agent_comment` still correctly edits vs. creates using
      the new invisible marker, independent of the comment body's language.
- [ ] `scripts/test_github_issue_agent.py` is updated for the new schema and
      seams (see the four test seams in the main-issue's PRD).

## Comments
- Implemented full PRD: IssueAnalysis now carries comment_body (no questions); system instruction detects conversation language with English fallback; marker is an invisible HTML comment appended by build_clarification_comment; tests updated for new schema and seams. Suite green (25 tests).
