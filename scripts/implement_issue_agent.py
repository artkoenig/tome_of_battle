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

# Define structured schemas
class FilesToInspect(BaseModel):
    paths: List[str] = Field(description="List of file paths you want to read to understand how to solve the issue. Return an empty list if you have read all necessary files.")

class FileModification(BaseModel):
    path: str = Field(description="Relative path of the file to create or modify.")
    content: str = Field(description="The complete new content of the file.")

class CodeEdits(BaseModel):
    files: List[FileModification] = Field(description="List of files to write or modify.")

def get_file_list():
    files = []
    for root, dirs, filenames in os.walk("."):
        dirs_to_exclude = ['node_modules', 'dist', '.git', '.agents', '.gemini', 'coverage']
        dirs[:] = [d for d in dirs if d not in dirs_to_exclude]
        for f in filenames:
            if f.endswith('.js') or f.endswith('.jsx') or f.endswith('.css') or f.endswith('.html') or f == 'package.json':
                files.append(os.path.relpath(os.path.join(root, f), "."))
    return files

def main():
    if len(sys.argv) < 2:
        print("Usage: python implement_issue_agent.py <issue_number>")
        sys.exit(1)

    issue_number = int(sys.argv[1])

    # Load environment variables
    api_key = os.getenv("GEMINI_API_KEY")
    github_token = os.getenv("GITHUB_TOKEN")
    repo_owner = os.getenv("REPO_OWNER")
    repo_name = os.getenv("REPO_NAME")

    if not api_key or not github_token or not repo_owner or not repo_name:
        print("Missing required environment variables.")
        sys.exit(1)

    g = Github(github_token)
    repo = g.get_repo(f"{repo_owner}/{repo_name}")
    issue = repo.get_issue(issue_number)

    comments = [c.body for c in issue.get_comments()]
    plan = ""
    for c in reversed(comments):
        if "Implementation Plan:" in c:
            plan = c
            break

    print(f"Starting implementation for Issue #{issue_number}: {issue.title}")
    
    client = genai.Client()

    repo_files = get_file_list()
    files_tree = "\n".join(repo_files)

    import re
    import time
    
    # Extract metadata containing files to inspect
    files_to_read = []
    metadata_match = re.search(r"<!-- METADATA: (.*?) -->", plan, re.DOTALL)
    if metadata_match:
        try:
            metadata = json.loads(metadata_match.group(1))
            files_to_read = metadata.get("files_to_read", [])
            print(f"Metadata found. Files to read: {files_to_read}")
        except Exception as e:
            print(f"Error parsing metadata: {e}")
            
    # Fallback to parsing markdown links in the plan
    if not files_to_read:
        print("No metadata found, fallback to parsing markdown links...")
        for match in re.finditer(r"\[.*?\]\(file:///(.*?)\)", plan):
            path = match.group(1)
            if "/Workspace/army_builder/" in path:
                rel_path = path.split("/Workspace/army_builder/")[-1]
                if os.path.exists(rel_path) and rel_path not in files_to_read:
                    files_to_read.append(rel_path)
            elif os.path.exists(path) and path not in files_to_read:
                files_to_read.append(path)
                
    print(f"Final files to read: {files_to_read}")
    
    inspected_files = {}
    issue_text = f"{issue.title} {issue.body}".lower()
    keywords = set(re.findall(r"\b[a-z]{4,}\b", issue_text))
    
    for path in files_to_read:
        if os.path.exists(path):
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                if path.endswith('.cat') or path.endswith('.gst'):
                    pruned_content = extract_relevant_xml_nodes(content, keywords)
                    inspected_files[path] = pruned_content
                    print(f"Loaded and pruned context file: {path} (size: {len(pruned_content)})")
                else:
                    inspected_files[path] = content
                    print(f"Loaded context file: {path}")
            except Exception as e:
                print(f"Error reading file {path}: {e}")

    print("Generating code edits...")
    prompt = f"""
You are an expert React and Node.js developer.
Your task is to implement the changes specified in the APPROVED implementation plan for issue #{issue_number}.
DO NOT perform any independent analysis of the problem or make decisions outside of the plan. Statically and strictly follow the plan steps.

CRITICAL DIRECTIVE: The core objective is defined by the Issue Title and Issue Description. The Approved Implementation Plan provides the steps to achieve this objective. Ensure the implementation directly resolves the original goal without getting distracted by unrelated details.

Issue Title: {issue.title}
Issue Description:
{issue.body}

Approved Implementation Plan:
{plan}

Here are the contents of the relevant files in the repository:
"""
    for path, content in inspected_files.items():
        prompt += f"\n--- FILE: {path} ---\n{content}\n"

    # Load and inject project guidelines (AGENTS.md and validation_insights.md)
    guidelines = ""
    for path in [".agents/AGENTS.md", ".agents/validation_insights.md"]:
        if os.path.exists(path):
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    guidelines += f"\n--- GUIDELINES ({path}) ---\n{f.read()}\n"
            except Exception as e:
                print(f"Error reading guidelines {path}: {e}")
    if guidelines:
        prompt += f"\nHere are the project guidelines and validation insights you must adhere to:\n{guidelines}\n"

    prompt += """
Please generate all necessary file modifications or new files to implement the changes.
Make sure the code matches the design guidelines of the project, compiles, and includes tests if necessary.
Provide the modifications in a JSON structure containing a list of files with their path and complete new file content.
"""

    response = generate_content_with_retry(
        client,
        model='gemini-2.5-flash',
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=CodeEdits,
            temperature=0.1,
        ),
    )
    
    edits = CodeEdits.model_validate_json(response.text)
    
    for file_mod in edits.files:
        path = file_mod.path
        os.makedirs(os.path.dirname(path), exist_ok=True)
        print(f"Writing to {path}...")
        with open(path, 'w') as f:
            f.write(file_mod.content)

    print("Running tests...")
    
    for test_iteration in range(4):
        test_res = subprocess.run(["npm", "test"], capture_output=True, text=True)
        if test_res.returncode == 0:
            print("All tests passed successfully!")
            break
            
        print(f"Test failure in iteration {test_iteration + 1}:")
        print(test_res.stdout)
        print(test_res.stderr)
        
        print("Waiting 2 seconds before requesting fix from Gemini API...")
        time.sleep(2.0)
        
        current_modifications = ""
        for file_mod in edits.files:
            if os.path.exists(file_mod.path):
                with open(file_mod.path, 'r') as f:
                    current_modifications += f"\n--- FILE: {file_mod.path} ---\n{f.read()}\n"

        prompt = f"""
The changes you wrote failed compile or tests.
Here are the current modified files:
{current_modifications}

Here is the test output and compiler error details:
Stdout:
{test_res.stdout}

Stderr:
{test_res.stderr}

Please analyze the errors, fix the code, and output the corrected file contents.
Return a JSON list of the complete files that need modifications.
"""
        response = generate_content_with_retry(
            client,
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=CodeEdits,
                temperature=0.1,
            ),
        )
        
        edits = CodeEdits.model_validate_json(response.text)
        for file_mod in edits.files:
            path = file_mod.path
            os.makedirs(os.path.dirname(path), exist_ok=True)
            print(f"Rewriting fixed code to {path}...")
            with open(path, 'w') as f:
                f.write(file_mod.content)

    final_test_res = subprocess.run(["npm", "test"], capture_output=True, text=True)
    if final_test_res.returncode != 0:
        print("Tests are still failing. Raising exception.")
        print(final_test_res.stdout)
        print(final_test_res.stderr)
        sys.exit(1)
        
    print("Implementation agent completed successfully.")
    sys.exit(0)

if __name__ == "__main__":
    main()
