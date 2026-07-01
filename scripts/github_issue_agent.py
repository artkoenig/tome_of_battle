import os
import sys
import json
import subprocess
import re
import time
from github import Github
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from typing import List

def generate_content_with_retry(client, model, contents, config, max_retries=5):
    for attempt in range(max_retries):
        try:
            return client.models.generate_content(
                model=model,
                contents=contents,
                config=config
            )
        except Exception as e:
            err_msg = str(e)
            if "429" in err_msg or "Please retry in" in err_msg or "ResourceExhausted" in err_msg:
                # Exponential backoff base: 5s, 10s, 20s, 40s, 80s
                wait_time = 2.0 ** attempt * 5.0
                match = re.search(r"Please retry in (\d+(?:\.\d+)?)\s*s?", err_msg)
                if match:
                    try:
                        wait_time = float(match.group(1)) + 2.0
                    except ValueError:
                        pass
                print(f"Gemini API 429 rate limit hit. Waiting {wait_time:.2f} seconds before retrying (Attempt {attempt + 1}/{max_retries})...")
                time.sleep(wait_time)
                continue
            else:
                raise e
    raise Exception(f"Failed to generate content after {max_retries} retries due to rate limits.")

import xml.etree.ElementTree as ET

def extract_relevant_xml_nodes(xml_content, keywords):
    if not keywords:
        return ""
    try:
        # Battlescribe XML files have namespaces, so we might need to handle them
        ET.register_namespace("", "http://www.battlescribe.net/schema/catalogueSchema")
        ET.register_namespace("", "http://www.battlescribe.net/schema/gameSystemSchema")
        root = ET.fromstring(xml_content)
    except Exception as e:
        print(f"Error parsing XML: {e}")
        return xml_content[:5000]

    matched_nodes = []
    
    # We want to find nodes that have a 'name' attribute matching one of our keywords
    def traverse(node):
        name = node.get("name", "").lower()
        matched = False
        if name:
            for kw in keywords:
                if kw in name:
                    matched = True
                    break
                    
        if matched:
            new_node = ET.Element(node.tag, node.attrib)
            
            # Copy important direct children but strip namespaces from tags when checking
            for child in node:
                tag_name = child.tag
                if '}' in tag_name:
                    tag_name = tag_name.split('}', 1)[1]
                if tag_name in ["constraints", "costs", "profiles", "modifiers", "rules", "conditions", "conditionGroups", "characteristics", "characteristic", "categoryLinks", "selectionEntries", "entryLinks"]:
                    new_node.append(child)
            matched_nodes.append(new_node)
            
        for child in node:
            traverse(child)

    traverse(root)
    
    if not matched_nodes:
        return "No matching nodes found in catalog."
        
    res = []
    for node in matched_nodes[:50]: # Limit to top 50 nodes to avoid blowing up token limit
        try:
            node_str = ET.tostring(node, encoding="utf-8").decode("utf-8")
            res.append(node_str)
        except Exception as e:
            res.append(f"<!-- Error serializing node: {e} -->")
            
    return "\n".join(res)

def get_core_file_contents():
    contents = {}
    for root, dirs, filenames in os.walk("."):
        dirs_to_exclude = ['node_modules', 'dist', '.git', '.agents', '.gemini', 'coverage']
        dirs[:] = [d for d in dirs if d not in dirs_to_exclude]
        for f in filenames:
            path = os.path.relpath(os.path.join(root, f), ".")
            if (f.endswith('.js') or f.endswith('.jsx') or f == 'package.json') and not '.test.' in f:
                if any(x in f for x in ['stress', 'walkthrough', 'generate_screenshots', 'verify_revert']):
                    continue
                try:
                    with open(path, 'r', encoding='utf-8') as file_obj:
                        contents[path] = file_obj.read()
                except Exception as e:
                    print(f"Error reading {path}: {e}")
    return contents

def find_relevant_catalogs(issue_title: str, issue_body: str):
    text = f"{issue_title} {issue_body}".lower()
    words = set(re.findall(r"\b[a-z]{4,}\b", text))
    
    contents = {}
    catalog_dir = "catalogs"
    if not os.path.exists(catalog_dir):
        return contents
        
    cat_files = []
    for root, dirs, filenames in os.walk(catalog_dir):
        for f in filenames:
            path = os.path.relpath(os.path.join(root, f), ".")
            if f.endswith('.gst'):
                try:
                    with open(path, 'r', encoding='utf-8') as file_obj:
                        raw_content = file_obj.read()
                    pruned = extract_relevant_xml_nodes(raw_content, words)
                    if pruned.strip() and "No matching nodes found" not in pruned:
                        contents[path] = pruned
                        print(f"GST file included (pruned): {path}")
                except Exception as e:
                    print(f"Error reading GST {path}: {e}")
            elif f.endswith('.cat'):
                cat_files.append(path)
                
    matched_cats = []
    for path in cat_files:
        try:
            with open(path, 'r', encoding='utf-8') as file_obj:
                content = file_obj.read()
                matches = sum(1 for w in words if w in content.lower())
                if matches > 0:
                    matched_cats.append((path, matches))
        except Exception as e:
            print(f"Error reading CAT {path}: {e}")
            
    matched_cats.sort(key=lambda x: x[1], reverse=True)
    top_cats = [path for path, _ in matched_cats[:2]]
    print(f"Top relevant CAT files matched: {top_cats}")
    
    for path in top_cats:
        try:
            with open(path, 'r', encoding='utf-8') as file_obj:
                raw_content = file_obj.read()
            pruned = extract_relevant_xml_nodes(raw_content, words)
            if pruned.strip():
                contents[path] = pruned
                print(f"CAT file included (pruned): {path}")
        except Exception as e:
            print(f"Error reading matched CAT {path}: {e}")
            
    return contents

# Define structured output schemas
class IssueAnalysis(BaseModel):
    labels: List[str] = Field(description="List of labels to apply, e.g. ['bug', 'feature', 'chore']")
    is_clear: bool = Field(description="True if the requirements are clear and complete. False otherwise.")
    questions: List[str] = Field(description="Clarification questions if requirements are not clear. Empty if is_clear is true.")
    implementation_plan: str = Field(description="Markdown implementation plan describing what to change and in which files. Empty if is_clear is false.")
    files_to_read: List[str] = Field(default=[], description="List of relative file paths in the repo that the implementation agent needs to read.")
    files_to_modify: List[str] = Field(default=[], description="List of relative file paths in the repo that will be modified or created.")

class CommentAnalysis(BaseModel):
    intent: str = Field(description="The intent of the comment. One of: 'approve' (user wants to approve the plan), 'close' (user wants to close the issue because it is resolved/done/no longer needed), or 'none' (general discussion or question).")
    reply: str = Field(description="A brief response in English to post on the issue if closing or approving. Empty if intent is 'none'.")

def analyze_issue(issue_title: str, issue_body: str, current_comments: List[str], core_files: dict):
    client = genai.Client()
    comments_str = "\n---\n".join(current_comments)
    files_context = ""
    for path, content in core_files.items():
        files_context += f"\n--- FILE: {path} ---\n{content}\n"
        
    prompt = f"""
You are an expert developer assistant.
Analyze this GitHub issue and its conversation comments against the codebase to find the concrete root cause of the problem and describe the exact code changes needed.
Both the clarification questions and the implementation plan MUST be written in English.

Issue Title: {issue_title}
Issue Description:
{issue_body}

Recent comments/discussion:
{comments_str}

Here are the relevant source code files and catalog data from the repository:
{files_context}

Please categorize the issue (e.g. bug, feature, chore) and generate either:
1. A list of clarification questions in English if the request is ambiguous, lacks context, or is incomplete.
2. A detailed implementation plan in English if the requirements are completely clear.
   Crucially, this plan must identify the exact files, lines, and describe the precise code modifications needed to resolve the issue, rather than generic debugging instructions.
   Also specify which files the implementation agent needs to read (files_to_read) and which files will be modified or created (files_to_modify).
"""

    response = generate_content_with_retry(
        client,
        model='gemini-2.5-flash',
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=IssueAnalysis,
            temperature=0.2,
        ),
    )
    return IssueAnalysis.model_validate_json(response.text)

def analyze_comment(issue_title: str, issue_body: str, comment_body: str, comment_author: str):
    client = genai.Client()
    prompt = f"""
You are an expert developer assistant. Analyze the latest comment on this GitHub issue.

Issue Title: {issue_title}
Issue Description:
{issue_body}

Latest Comment by {comment_author}:
{comment_body}

Determine the user's intent. The intent can be:
- "approve": The user explicitly approves the implementation plan (e.g. "/approve", "Approved", "Genehmigt", "Go ahead", "Start implementation").
- "close": The user wants to close, cancel, or resolve the issue (e.g. "Das hat sich erledigt", "resolved", "close", "cancel", "erledigt", "fertig", "solved", "no longer needed").
- "none": A question, feedback, clarification, or general discussion.

If the intent is 'close', generate a polite confirmation message in English stating that the issue is being closed.
If the intent is 'approve', generate a brief confirmation in English.
Otherwise, leave 'reply' empty.
"""

    response = generate_content_with_retry(
        client,
        model='gemini-2.5-flash',
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=CommentAnalysis,
            temperature=0.1,
        ),
    )
    return CommentAnalysis.model_validate_json(response.text)

def main():
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

    comment_analysis = None

    if event_name == "issue_comment":
        print(f"Processing comment from {comment_author}: {comment_body}")
        
        comment_analysis = analyze_comment(issue.title, issue.body, comment_body, comment_author)
        print(f"Comment analysis: {comment_analysis.intent}")
        
        permission = repo.get_collaborator_permission(comment_author)
        has_write_access = permission in ["admin", "write"]
        is_owner = comment_author.lower() == repo_owner.lower()
        is_authorized = has_write_access or is_owner

        if comment_analysis.intent == "close":
            if not is_authorized:
                print(f"User {comment_author} is not authorized to close the issue.")
                sys.exit(0)
            
            issue.create_comment(comment_analysis.reply if comment_analysis.reply else "🔒 Issue closed by agent as resolved.")
            issue.edit(state="closed")
            print("Issue closed successfully.")
            sys.exit(0)

        elif comment_analysis.intent == "approve":
            if not is_authorized:
                print(f"User {comment_author} is not authorized to approve implementations.")
                sys.exit(0)
                
            print("Implementation approved. Starting code generation workflow...")
            
            labels_to_add = ["approved"]
            for label in issue.labels:
                if label.name == "needs-clarification":
                    issue.remove_from_labels("needs-clarification")
            issue.add_to_labels(*labels_to_add)

            issue_comment = issue.create_comment(comment_analysis.reply if comment_analysis.reply else "🚀 **Approval granted.** The implementation agent is starting the changes...")
            
            try:
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

    if event_name == "issues" or (comment_analysis and comment_analysis.intent == "none"):
        print(f"Analyzing issue #{issue_number}: {issue.title}")
        
        comments = [c.body for c in issue.get_comments()]
        context_files = get_core_file_contents()
        catalog_files = find_relevant_catalogs(issue.title, issue.body)
        context_files.update(catalog_files)
        
        analysis = analyze_issue(issue.title, issue.body, comments, context_files)
        print(f"Analysis result: {analysis}")
        
        for label in analysis.labels:
            try:
                repo.get_label(label)
            except:
                repo.create_label(label, "f29513")
            issue.add_to_labels(label)
            
        if not analysis.is_clear:
            try:
                repo.get_label("needs-clarification")
            except:
                repo.create_label("needs-clarification", "e61919")
            issue.add_to_labels("needs-clarification")
            
            for label in issue.labels:
                if label.name == "approved":
                    issue.remove_from_labels("approved")
            
            questions_md = "\n".join([f"- {q}" for q in analysis.questions])
            comment_body = f"👋 Hello! To start the implementation, the agent needs clarification on the following questions:\n\n{questions_md}\n\nPlease reply directly to this ticket."
            issue.create_comment(comment_body)
        else:
            for label in issue.labels:
                if label.name == "needs-clarification":
                    issue.remove_from_labels("needs-clarification")
                    
            metadata = {
                "files_to_read": analysis.files_to_read if analysis.files_to_read else [],
                "files_to_modify": analysis.files_to_modify if analysis.files_to_modify else []
            }
            comment_body = (
                f"📋 **Implementation Plan:**\n\n{analysis.implementation_plan}\n\n"
                f"<!-- METADATA: {json.dumps(metadata)} -->\n\n"
                f"---\nPlease reply with **'Approved'** (or `/approve`) to start the implementation."
            )
            issue.create_comment(comment_body)

if __name__ == "__main__":
    main()
