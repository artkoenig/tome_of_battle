import os
import sys
import json
from pathlib import Path
from typing import List

import anthropic
from github import Github, Auth

MODEL = "claude-opus-4-8"
GUIDELINE_FILES = [".agents/AGENTS.md", ".agents/validation_insights.md"]

ISSUE_ANALYSIS_SCHEMA = {
    "type": "object",
    "properties": {
        "labels": {"type": "array", "items": {"type": "string"}},
        "is_clear": {"type": "boolean"},
        "questions": {"type": "array", "items": {"type": "string"}},
        "implementation_plan": {"type": "string"},
    },
    "required": ["labels", "is_clear", "questions", "implementation_plan"],
    "additionalProperties": False,
}


def read_guidelines() -> str:
    parts = []
    for path in GUIDELINE_FILES:
        p = Path(path)
        if p.exists():
            parts.append(f"### {path}\n{p.read_text()}")
    return "\n\n".join(parts) if parts else "No project guidelines found."


def create_or_edit_agent_comment(issue, comment_body: str, existing_comments: List):
    for c in existing_comments:
        c_author = c.user.login.lower() if c.user else ""
        if "bot" in c_author or "github-actions" in c_author:
            if "Implementation Plan:" in c.body or "needs clarification on the following questions:" in c.body:
                print(f"Editing existing agent comment #{c.id}")
                c.edit(comment_body)
                return

    print("Creating new agent comment")
    issue.create_comment(comment_body)


def analyze_issue(client: anthropic.Anthropic, issue_title: str, issue_body: str, comments: List[str]) -> dict:
    comments_str = "\n---\n".join(comments) if comments else "No discussion comments."
    prompt = f"""
You are an expert developer assistant.
Analyze this GitHub issue and its conversation comments against the codebase to find the concrete root cause of the problem and describe the exact code changes needed.
Both the clarification questions and the implementation plan MUST be written in English.

CRITICAL DIRECTIVE: The original Issue Title and Issue Description define the primary goal. You must never lose sight of this original goal. The comments and discussion should only be used to clarify requirements, resolve ambiguity, or adjust implementation details, but they must never derail the core goal of the issue.

Project guidelines (comply with all architectural, design, and coding rules described here):
{read_guidelines()}

Issue Title: {issue_title}
Issue Description:
{issue_body}

Recent comments/discussion:
{comments_str}
"""
    response = client.messages.create(
        model=MODEL,
        max_tokens=8000,
        thinking={"type": "adaptive"},
        system=(
            "You are an expert developer assistant. Analyze the issue and return a structured JSON response "
            "matching the given schema."
        ),
        output_config={"format": {"type": "json_schema", "schema": ISSUE_ANALYSIS_SCHEMA}},
        messages=[{"role": "user", "content": prompt}],
    )
    text = next(b.text for b in response.content if b.type == "text")
    return json.loads(text)


def main():
    api_key = os.getenv("ANTHROPIC_API_KEY")
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
    client = anthropic.Anthropic(api_key=api_key)

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

    labels = analysis.get("labels", [])
    for label in labels:
        try:
            repo.get_label(label)
        except Exception:
            repo.create_label(label, "f29513")
        issue.add_to_labels(label)

    is_clear = analysis.get("is_clear", False)
    if not is_clear:
        try:
            repo.get_label("needs-clarification")
        except Exception:
            repo.create_label("needs-clarification", "e61919")
        issue.add_to_labels("needs-clarification")

        questions = analysis.get("questions", [])
        questions_md = "\n".join([f"- {q}" for q in questions])
        comment_body = (
            f"👋 Hello! To start the implementation, the agent needs clarification on the following questions:\n\n{questions_md}\n\n"
            f"Please reply directly to this ticket.\n\n"
            f"💬 *Note: To trigger the agent in subsequent comments, please use `/agent`.*"
        )
        create_or_edit_agent_comment(issue, comment_body, issue_comments)
    else:
        for label in issue.labels:
            if label.name == "needs-clarification":
                issue.remove_from_labels("needs-clarification")

        comment_body = (
            f"📋 **Implementation Plan:**\n\n{analysis.get('implementation_plan', '')}\n\n"
            f"---\n"
            f"Please reply with **'Approved'** (or `/approve`) to start the implementation.\n\n"
            f"💬 *Note: To trigger the agent in subsequent comments, please use `/agent`.*"
        )
        create_or_edit_agent_comment(issue, comment_body, issue_comments)


if __name__ == "__main__":
    main()
