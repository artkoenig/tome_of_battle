import os
import sys
import json
from pathlib import Path

from google import genai
from google.genai import types
from pydantic import BaseModel

MODEL = "gemini-3.1-flash-lite"
GUIDELINE_FILES = [".agents/AGENTS.md", ".agents/validation_insights.md"]

RESPONSE_MIME_TYPE_JSON = "application/json"

NEEDS_ATTENTION_LABEL = "needs-attention"
NEEDS_ATTENTION_LABEL_COLOR = "d93f0b"

AGENT_COMMENT_MARKER = "needs clarification on the following questions:"

ANALYSIS_SYSTEM_INSTRUCTION = (
    "You are a triage assistant for a software project. Judge a reported GitHub "
    "issue and return a structured JSON response matching the given schema. "
    "Both is_clear and needs_attention are your own judgement; every question "
    "you raise must be written in English."
)


class IssueAnalysis(BaseModel):
    is_clear: bool
    questions: list[str]
    needs_attention: bool


def read_guidelines() -> str:
    parts = []
    for path in GUIDELINE_FILES:
        p = Path(path)
        if p.exists():
            parts.append(f"### {path}\n{p.read_text()}")
    return "\n\n".join(parts) if parts else "No project guidelines found."


def ensure_label(repo, name: str, color: str) -> None:
    try:
        repo.get_label(name)
    except Exception:
        repo.create_label(name, color)


def create_or_edit_agent_comment(issue, comment_body: str, existing_comments: list) -> None:
    for c in existing_comments:
        c_author = c.user.login.lower() if c.user else ""
        is_agent_author = "bot" in c_author or "github-actions" in c_author
        if is_agent_author and AGENT_COMMENT_MARKER in c.body:
            print(f"Editing existing agent comment #{c.id}")
            c.edit(comment_body)
            return

    print("Creating new agent comment")
    issue.create_comment(comment_body)


def analyze_issue(client: genai.Client, issue_title: str, issue_body: str, comments: list[str]) -> dict:
    comments_str = "\n---\n".join(comments) if comments else "No discussion comments."
    prompt = f"""
Analyze this GitHub issue and its conversation comments as a project maintainer would during triage.

CRITICAL DIRECTIVE: The original Issue Title and Issue Description define the primary goal. The comments and discussion should only be used to clarify requirements or resolve ambiguity, never to derail the core goal of the issue.

Decide two things:
- is_clear: true only if the report contains enough concrete information to be actionable without further input. If it does not, set is_clear to false and list the specific follow-up questions (in English) needed to make it actionable.
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
    return json.loads(response.text)


def build_clarification_comment(questions: list[str]) -> str:
    questions_md = "\n".join([f"- {q}" for q in questions])
    return (
        f"👋 Hello! Before this issue can be picked up, the agent {AGENT_COMMENT_MARKER}\n\n"
        f"{questions_md}\n\n"
        f"Please reply directly to this ticket with the missing details."
    )


def main():
    from github import Github, Auth  # deferred: only the live GitHub I/O path needs PyGithub

    api_key = os.getenv("GEMINI_API_KEY")
    github_token = os.getenv("GITHUB_TOKEN")
    event_name = os.getenv("ISSUE_EVENT")
    issue_number_str = os.getenv("ISSUE_NUMBER")
    repo_owner = os.getenv("REPO_OWNER")
    repo_name = os.getenv("REPO_NAME")
    comment_body = os.getenv("COMMENT_BODY", "")
    comment_author = os.getenv("COMMENT_AUTHOR", "")

    if not api_key or not github_token or not issue_number_str or not repo_owner or not repo_name:
        print("Missing required environment variables.")
        sys.exit(1)

    issue_number = int(issue_number_str)
    client = genai.Client(api_key=api_key)

    auth = Auth.Token(github_token)
    g = Github(auth=auth)
    repo = g.get_repo(f"{repo_owner}/{repo_name}")
    issue = repo.get_issue(issue_number)

    issue_comments = list(issue.get_comments())
    comments_bodies = [c.body for c in issue_comments]

    if event_name == "issue_comment":
        print(f"Processing comment from {comment_author}: {comment_body}")

        comment_author_lower = comment_author.lower()
        if "bot" in comment_author_lower or "github-actions" in comment_author_lower:
            print(f"Comment is from a bot/agent ({comment_author}). Exiting early.")
            sys.exit(0)

    print(f"Analyzing issue #{issue_number}: {issue.title}")

    analysis = analyze_issue(client, issue.title, issue.body, comments_bodies)
    print(f"Analysis result: {analysis}")

    if analysis.get("needs_attention", False):
        ensure_label(repo, NEEDS_ATTENTION_LABEL, NEEDS_ATTENTION_LABEL_COLOR)
        issue.add_to_labels(NEEDS_ATTENTION_LABEL)

    if not analysis.get("is_clear", False):
        questions = analysis.get("questions", [])
        create_or_edit_agent_comment(issue, build_clarification_comment(questions), issue_comments)


if __name__ == "__main__":
    main()
