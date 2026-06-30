import os
import sys
import json
import subprocess
from github import Github
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from typing import List

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
    for c in comments:
        if "Implementation Plan:" in c:
            plan = c
            break

    print(f"Starting implementation for Issue #{issue_number}: {issue.title}")
    
    client = genai.Client()

    repo_files = get_file_list()
    files_tree = "\n".join(repo_files)

    inspected_files = {}
    
    for iteration in range(4):
        prompt = f"""
You are an expert React and Node.js developer. You are implementing the approved plan for issue #{issue_number}.

Issue Title: {issue.title}
Issue Description:
{issue.body}

Approved Implementation Plan:
{plan}

Here is the list of files in the repository:
{files_tree}

Here are the files you have inspected so far:
"""
        for path, content in inspected_files.items():
            prompt += f"\n--- FILE: {path} ---\n{content}\n"

        prompt += "\nBased on the issue description, plan, and files tree, do you need to inspect the contents of any other files to write the correct solution? If yes, list their paths. If no (you have all information to write the changes), return an empty list."

        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=FilesToInspect,
                temperature=0.1,
            ),
        )
        
        req = FilesToInspect.model_validate_json(response.text)
        print(f"Iteration {iteration + 1}: Files requested: {req.paths}")
        
        if not req.paths:
            break
            
        for path in req.paths:
            if path in repo_files and os.path.exists(path):
                try:
                    with open(path, 'r') as f:
                        inspected_files[path] = f.read()
                except Exception as e:
                    print(f"Error reading file {path}: {e}")
            else:
                print(f"Requested file does not exist or is excluded: {path}")

    print("Generating code edits...")
    prompt = f"""
You are an expert React and Node.js developer. Implement the solution for the issue #{issue_number}.

Issue Title: {issue.title}
Issue Description:
{issue.body}

Approved Implementation Plan:
{plan}

Here are the files you have inspected:
"""
    for path, content in inspected_files.items():
        prompt += f"\n--- FILE: {path} ---\n{content}\n"

    prompt += """
Please generate all necessary file modifications or new files to implement the changes.
Make sure the code matches the design guidelines of the project, compiles, and includes tests if necessary.
Provide the modifications in a JSON structure containing a list of files with their path and complete new file content.
"""

    response = client.models.generate_content(
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
    
    for test_iteration in range(3):
        test_res = subprocess.run(["npm", "test"], capture_output=True, text=True)
        if test_res.returncode == 0:
            print("All tests passed successfully!")
            break
            
        print(f"Test failure in iteration {test_iteration + 1}:")
        print(test_res.stdout)
        print(test_res.stderr)
        
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
        response = client.models.generate_content(
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
