import os
import sys
import json
import subprocess
import re
import asyncio
from github import Github
from google.antigravity import Agent, LocalAgentConfig, CapabilitiesConfig
from typing import List

def parse_json_response(text: str) -> dict:
    # Erste Bereinigung von Markdown-Codeblöcken
    match = re.search(r"```json\s*(.*?)\s*```", text, re.DOTALL | re.IGNORECASE)
    if match:
        text = match.group(1)
    else:
        match = re.search(r"```\s*(.*?)\s*```", text, re.DOTALL)
        if match:
            text = match.group(1)

    text = text.strip()

    # Fallback: Falls Text außerhalb der Klammern steht, extrahiere nur das JSON-Objekt
    if not (text.startswith("{") and text.endswith("}")):
        start_idx = text.find("{")
        end_idx = text.rfind("}")
        if start_idx != -1 and end_idx != -1:
            text = text[start_idx:end_idx + 1]

    try:
        return json.loads(text)
    except Exception as e:
        print(f"Error parsing JSON response: {e}\nRaw response:\n{text}")
        raise e

def is_agent_requested(comment_body: str) -> bool:
    if not comment_body:
        return False
    body_lower = comment_body.lower()

    direct_triggers = ["/agent", "@github-actions", "/approve", "/close", "/cancel", "/resolve"]
    for trigger in direct_triggers:
        if trigger in body_lower:
            return True

    keywords = ["approved", "genehmigt", "resolved", "erledigt", "solved"]
    for kw in keywords:
        pattern = rf"(?<![\w-]){re.escape(kw)}(?![\w-])"
        if re.search(pattern, body_lower):
            return True

    return False

def create_or_edit_agent_comment(issue, comment_body: str, existing_comments: List):
    # Nutze die bereits geladene Liste an Kommentaren statt eines erneuten API-Abrufs
    for c in existing_comments:
        c_author = c.user.login.lower() if c.user else ""
        if "bot" in c_author or "github-actions" in c_author:
            if "Implementation Plan:" in c.body or "needs clarification on the following questions:" in c.body:
                print(f"Editing existing agent comment #{c.id}")
                c.edit(comment_body)
                return

    print("Creating new agent comment")
    issue.create_comment(comment_body)

async def analyze_issue(issue_title: str, issue_body: str, comments: List[str]) -> dict:
    comments_str = "\n---\n".join(comments) if comments else "No discussion comments."
    prompt = f"""
You are an expert developer assistant.
Analyze this GitHub issue and its conversation comments against the codebase to find the concrete root cause of the problem and describe the exact code changes needed.
Both the clarification questions and the implementation plan MUST be written in English.

CRITICAL DIRECTIVE: The original Issue Title and Issue Description define the primary goal. You must never lose sight of this original goal. The comments and discussion should only be used to clarify requirements, resolve ambiguity, or adjust implementation details, but they must never derail the core goal of the issue.

Please consult the project guidelines in '.agents/AGENTS.md' and '.agents/validation_insights.md' to ensure your analysis complies with all architectural, design, and coding rules (such as styling, component structure, React/Vite best practices, and DB synchronization guidelines).

Issue Title: {issue_title}
Issue Description:
{issue_body}

Recent comments/discussion:
{comments_str}

You must output your analysis strictly in JSON format matching this schema:
{{
  "labels": ["list of labels to apply, e.g., 'bug', 'feature', 'chore'"],
  "is_clear": true or false,
  "questions": ["list of clarification questions in English if is_clear is false, otherwise empty"],
  "implementation_plan": "markdown implementation plan describing what to change and in which files. Keep it concise.",
  "files_to_read": ["list of relative file paths in the repo that need to be read to implement"],
  "files_to_modify": ["list of relative file paths in the repo that will be modified or created"]
}}

Do not include any explanation or extra text outside the JSON. Return only the JSON block (it can be wrapped in a markdown ```json ``` code block).
"""
    config = LocalAgentConfig(
        system_instructions=(
            "You are an expert developer assistant. Analyze the issue and return a structured JSON response. "
            "Do not include any conversation or explanation outside the JSON."
        ),
        capabilities=CapabilitiesConfig(allow_writes=True)
    )
    async with Agent(config) as agent:
        response = await agent.chat(prompt)
        text = ""
        async for token in response:
            text += token
        return parse_json_response(text)

async def analyze_comment(issue_title: str, issue_body: str, comment_body: str, comment_author: str, comments: List[str]) -> dict:
    comments_history = "\n---\n".join(comments[-10:]) if comments else "No previous comments."
    prompt = f"""
You are an expert developer assistant. Analyze the latest comment on this GitHub issue in the context of the entire conversation.

Issue Title: {issue_title}
Issue Description:
{issue_body}

Recent conversation history (oldest to newest):
{comments_history}

Latest Comment by {comment_author}:
{comment_body}

Determine the user's intent. The intent can be:
- "approve": The user explicitly approves the implementation plan (e.g. "/approve", "Approved", "Genehmigt", "Go ahead", "Start implementation").
- "close": The user wants to close, cancel, or resolve the issue (e.g. "Das hat sich erledigt", "resolved", "close", "cancel", "erledigt", "fertig", "solved", "no longer needed").
- "none": A question, feedback, clarification, or general discussion.

You must output your analysis strictly in JSON format matching this schema:
{{
  "intent": "approve" or "close" or "none",
  "reply": "a brief response in English to post on the issue if closing or approving, otherwise empty"
}}

Do not include any explanation or extra text outside the JSON. Return only the JSON block (it can be wrapped in a markdown ```json ``` code block).
"""
    config = LocalAgentConfig(
        system_instructions=(
            "You are an expert developer assistant. Analyze the latest comment and return a structured JSON response. "
            "Do not include any conversation or explanation outside the JSON."
        )
    )
    async with Agent(config) as agent:
        response = await agent.chat(prompt)
        text = ""
        async for token in response:
            text += token
        return parse_json_response(text)

async def main():
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

    g = Github(github_token)
    repo = g.get_repo(f"{repo_owner}/{repo_name}")
    issue = repo.get_issue(issue_number)

    # Einmalig abrufen und als Liste cachen, um API-Limits zu sparen
    issue_comments = list(issue.get_comments())
    comments_bodies = [c.body for c in issue_comments]

    comment_analysis = None

    if event_name == "issue_comment":
        print(f"Processing comment from {comment_author}: {comment_body}")

        comment_author_lower = comment_author.lower()
        if "bot" in comment_author_lower or "github-actions" in comment_author_lower:
            print(f"Comment is from a bot/agent ({comment_author}). Exiting early.")
            sys.exit(0)

        if not is_agent_requested(comment_body):
            print("Comment does not address/request the agent. Exiting early.")
            sys.exit(0)

        comment_res = await analyze_comment(issue.title, issue.body, comment_body, comment_author, comments_bodies)
        comment_intent = comment_res.get("intent", "none")
        comment_reply = comment_res.get("reply", "")
        print(f"Comment analysis: {comment_intent}")

        # Sicherer Berechtigungs-Check für externe User
        try:
            permission = repo.get_collaborator_permission(comment_author)
            has_write_access = permission in ["admin", "write"]
        except Exception:
            has_write_access = False

        is_owner = comment_author.lower() == repo_owner.lower()
        is_authorized = has_write_access or is_owner

        if comment_intent == "close":
            if not is_authorized:
                print(f"User {comment_author} is not authorized to close the issue.")
                sys.exit(0)

            issue.create_comment(comment_reply if comment_reply else "🔒 Issue closed by agent as resolved.")
            issue.edit(state="closed")
            print("Issue closed successfully.")
            sys.exit(0)

        elif comment_intent == "approve":
            if not is_authorized:
                print(f"User {comment_author} is not authorized to approve implementations.")
                sys.exit(0)

            print("Implementation approved. Starting code generation workflow...")

            labels_to_add = ["approved"]
            for label in issue.labels:
                if label.name == "needs-clarification":
                    issue.remove_from_labels("needs-clarification")
            issue.add_to_labels(*labels_to_add)

            issue_comment = issue.create_comment(comment_reply if comment_reply else "🚀 **Approval granted.** The implementation agent is starting the changes...")

            try:
                # Git User-Konfiguration für CI/CD Umgebungen setzen
                subprocess.run(["git", "config", "user.name", "github-actions[bot]"], check=True)
                subprocess.run(["git", "config", "user.email", "github-actions[bot]@users.noreply.github.com"], check=True)

                branch_name = f"issue-{issue_number}"
                subprocess.run(["git", "checkout", "-b", branch_name], check=True)

                print("Running implement_issue_agent.py...")
                result = subprocess.run(
                    ["python", "scripts/implement_issue_agent.py", str(issue_number)],
                    capture_output=True,
                    text=True
                )
                print(result.stdout)
                if result.returncode != 0:
                    print(result.stderr)
                    raise Exception(f"Implementation agent failed: {result.stderr}")

                status_res = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True)
                if not status_res.stdout.strip():
                    issue_comment.edit("⚠️ The agent did not make any changes to the code.")
                    sys.exit(0)

                subprocess.run(["git", "add", "."], check=True)
                subprocess.run(["git", "commit", "-m", f"Implement changes for Issue #{issue_number}"], check=True)

                subprocess.run(["git", "push", "origin", branch_name, "--force"], check=True)

                pr = repo.create_pull(
                    title=f"Resolve #{issue_number}: {issue.title}",
                    body=f"This PR automatically implements the approved plan for #{issue_number}.\n\nCloses #{issue_number}",
                    head=branch_name,
                    base="main"
                )

                issue_comment.edit(f"✅ **Implementation successfully completed!**\nThe Pull Request was created: {pr.html_url}\n\nPlease review the changes and merge the PR on GitHub.")

            except Exception as e:
                issue_comment.edit(f"❌ **Implementation failed:**\n```\n{str(e)}\n```\nPlease contact a developer.")
                sys.exit(1)
            return

        comment_analysis = comment_intent

    if event_name == "issues" or comment_analysis == "none":
        print(f"Analyzing issue #{issue_number}: {issue.title}")

        analysis = await analyze_issue(issue.title, issue.body, comments_bodies)
        print(f"Analysis result: {analysis}")

        labels = analysis.get("labels", [])
        for label in labels:
            try:
                repo.get_label(label)
            except:
                repo.create_label(label, "f29513")
            issue.add_to_labels(label)

        is_clear = analysis.get("is_clear", False)
        if not is_clear:
            try:
                repo.get_label("needs-clarification")
            except:
                repo.create_label("needs-clarification", "e61919")
            issue.add_to_labels("needs-clarification")

            for label in issue.labels:
                if label.name == "approved":
                    issue.remove_from_labels("approved")

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

            files_to_read = analysis.get("files_to_read", [])
            files_to_modify = analysis.get("files_to_modify", [])
            metadata = {
                "files_to_read": files_to_read if files_to_read else [],
                "files_to_modify": files_to_modify if files_to_modify else []
            }
            comment_body = (
                f"📋 **Implementation Plan:**\n\n{analysis.get('implementation_plan', '')}\n\n"
                f"\n\n"
                f"---\n"
                f"Please reply with **'Approved'** (or `/approve`) to start the implementation.\n\n"
                f"💬 *Note: To trigger the agent in subsequent comments, please use `/agent`.*"
            )
            create_or_edit_agent_comment(issue, comment_body, issue_comments)

if __name__ == "__main__":
    asyncio.run(main())