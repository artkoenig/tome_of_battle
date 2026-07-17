import os
import sys
from dataclasses import dataclass
from pathlib import Path

from google import genai
from google.genai import types
from pydantic import BaseModel

MODEL = "gemini-3.1-flash-lite"
GUIDELINE_FILES = [".agents/AGENTS.md", ".agents/validation_insights.md"]

RESPONSE_MIME_TYPE_JSON = "application/json"

NEEDS_ATTENTION_LABEL = "needs-attention"
NEEDS_ATTENTION_LABEL_COLOR = "d93f0b"

AGENT_COMMENT_MARKER = "<!-- issue-agent:clarification -->"

ISSUE_COMMENT_EVENT = "issue_comment"

ANALYSIS_SYSTEM_INSTRUCTION = (
    "You are a triage assistant for a software project. Judge a reported GitHub "
    "issue and return a structured JSON response matching the given schema. "
    "Both is_clear and needs_attention are your own judgement. When the report "
    "is not clear, write comment_body as a complete clarification message "
    "(greeting, the specific follow-up questions, and a closing sentence "
    "asking the reporter to reply with the missing details). Detect the "
    "predominant language of the whole conversation (issue title, body, and "
    "all comments) and write the entire comment_body in that language; default "
    "to English when the language is ambiguous or mixed."
)


class IssueAnalysis(BaseModel):
    is_clear: bool
    needs_attention: bool
    comment_body: str


@dataclass(frozen=True)
class AgentConfig:
    api_key: str
    github_token: str
    event_name: str
    issue_number: int
    repo_owner: str
    repo_name: str
    comment_body: str
    comment_author: str


def load_agent_config() -> AgentConfig:
    """Reads and validates the environment variables the agent needs to run.

    Raises ValueError if a required variable is missing.
    """
    raw_values = {
        "GEMINI_API_KEY": os.getenv("GEMINI_API_KEY"),
        "GITHUB_TOKEN": os.getenv("GITHUB_TOKEN"),
        "ISSUE_NUMBER": os.getenv("ISSUE_NUMBER"),
        "REPO_OWNER": os.getenv("REPO_OWNER"),
        "REPO_NAME": os.getenv("REPO_NAME"),
    }
    missing = [name for name, value in raw_values.items() if not value]
    if missing:
        raise ValueError(f"Missing required environment variables: {', '.join(missing)}")

    return AgentConfig(
        api_key=raw_values["GEMINI_API_KEY"],
        github_token=raw_values["GITHUB_TOKEN"],
        event_name=os.getenv("ISSUE_EVENT", ""),
        issue_number=int(raw_values["ISSUE_NUMBER"]),
        repo_owner=raw_values["REPO_OWNER"],
        repo_name=raw_values["REPO_NAME"],
        comment_body=os.getenv("COMMENT_BODY", ""),
        comment_author=os.getenv("COMMENT_AUTHOR", ""),
    )


def is_bot_author(login: str) -> bool:
    return "bot" in (login or "").lower()


def read_guidelines() -> str:
    parts = []
    for path in GUIDELINE_FILES:
        p = Path(path)
        if p.exists():
            parts.append(f"### {path}\n{p.read_text()}")
    return "\n\n".join(parts) if parts else "No project guidelines found."


def has_attention_label(issue_labels: list[str]) -> bool:
    return NEEDS_ATTENTION_LABEL in issue_labels


def ensure_label(repo, name: str, color: str) -> None:
    from github.GithubException import UnknownObjectException  # deferred: only the live GitHub I/O path needs PyGithub

    try:
        repo.get_label(name)
    except UnknownObjectException:
        repo.create_label(name, color)


def create_or_edit_agent_comment(issue, comment_body: str, existing_comments: list) -> None:
    for c in existing_comments:
        c_author = c.user.login if c.user else ""
        if is_bot_author(c_author) and AGENT_COMMENT_MARKER in c.body:
            print(f"Editing existing agent comment #{c.id}")
            c.edit(comment_body)
            return

    print("Creating new agent comment")
    issue.create_comment(comment_body)


def analyze_issue(client: genai.Client, issue_title: str, issue_body: str, comments: list[str]) -> IssueAnalysis:
    comments_str = "\n---\n".join(comments) if comments else "No discussion comments."
    prompt = f"""
Analyze this GitHub issue and its conversation comments as a project maintainer would during triage.

CRITICAL DIRECTIVE: The original Issue Title and Issue Description define the primary goal. The comments and discussion should only be used to clarify requirements or resolve ambiguity, never to derail the core goal of the issue.

Decide two things:
- is_clear: true only if the report contains enough concrete information to be actionable without further input. If it does not, set is_clear to false and write comment_body as a complete clarification message containing the specific follow-up questions needed to make it actionable.
- needs_attention: true if the report is a plausible bug or a well-formed feature request that deserves the maintainer's attention; false for noise, spam, or reports that are too vague to be plausible.

Project guidelines (for context on what this project is about):
{read_guidelines()}

Issue Title: {issue_title}
Issue Description:
{issue_body}

Recent comments/discussion:
{comments_str}
"""
    response = client.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=ANALYSIS_SYSTEM_INSTRUCTION,
            response_mime_type=RESPONSE_MIME_TYPE_JSON,
            response_schema=IssueAnalysis,
        ),
    )
    return IssueAnalysis.model_validate_json(response.text)


def build_clarification_comment(comment_body: str) -> str:
    """Appends the invisible marker to Gemini's generated comment body.

    The comment body is passed through unmodified so its language is preserved;
    the marker lets create_or_edit_agent_comment recognize the agent's own
    prior comment independently of that language.
    """
    return f"{comment_body}\n\n{AGENT_COMMENT_MARKER}"


def fetch_issue(config: AgentConfig):
    from github import Github, Auth  # deferred: only the live GitHub I/O path needs PyGithub

    auth = Auth.Token(config.github_token)
    g = Github(auth=auth)
    repo = g.get_repo(f"{config.repo_owner}/{config.repo_name}")
    issue = repo.get_issue(config.issue_number)
    return repo, issue


def skip_if_already_needs_attention(issue) -> bool:
    label_names = [label.name for label in issue.labels]
    if has_attention_label(label_names):
        print(
            f"Issue #{issue.number} already carries '{NEEDS_ATTENTION_LABEL}'. "
            "The maintainer handles it manually from here. Exiting without any action."
        )
        return True
    return False


def skip_if_bot_comment(config: AgentConfig) -> bool:
    if config.event_name != ISSUE_COMMENT_EVENT:
        return False

    print(f"Processing comment from {config.comment_author}: {config.comment_body}")
    if is_bot_author(config.comment_author):
        print(f"Comment is from a bot/agent ({config.comment_author}). Exiting early.")
        return True
    return False


def triage_issue(client: genai.Client, repo, issue, issue_comments: list) -> None:
    comments_bodies = [c.body for c in issue_comments]

    print(f"Analyzing issue #{issue.number}: {issue.title}")
    analysis = analyze_issue(client, issue.title, issue.body, comments_bodies)
    print(f"Analysis result: {analysis}")

    if analysis.needs_attention:
        ensure_label(repo, NEEDS_ATTENTION_LABEL, NEEDS_ATTENTION_LABEL_COLOR)
        issue.add_to_labels(NEEDS_ATTENTION_LABEL)

    if not analysis.is_clear:
        create_or_edit_agent_comment(issue, build_clarification_comment(analysis.comment_body), issue_comments)


def main():
    try:
        config = load_agent_config()
    except ValueError as exc:
        print(exc)
        sys.exit(1)

    repo, issue = fetch_issue(config)

    if skip_if_already_needs_attention(issue):
        sys.exit(0)

    client = genai.Client(api_key=config.api_key)

    issue_comments = list(issue.get_comments())

    if skip_if_bot_comment(config):
        sys.exit(0)

    triage_issue(client, repo, issue, issue_comments)


if __name__ == "__main__":
    main()
