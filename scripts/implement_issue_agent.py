import os
import sys
import json
import subprocess
import re
import asyncio
from github import Github
from google.antigravity import Agent, LocalAgentConfig, CapabilitiesConfig

async def main():
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

    if not plan:
        print("No implementation plan found in comments.")
        sys.exit(1)

    print(f"Starting implementation for Issue #{issue_number}: {issue.title}")
    
    # Spawn a write-enabled Antigravity Agent to perform the changes and verify
    config = LocalAgentConfig(
        system_instructions=(
            "You are an expert developer assistant. Your task is to implement the approved changes in the codebase. "
            "You must strictly adhere to the guidelines and rules defined in '.agents/AGENTS.md' and '.agents/validation_insights.md'. "
            "You have full write access and command execution capabilities. Verify all changes by running 'npm test' "
            "and fix any compiler or test errors until they pass."
        ),
        capabilities=CapabilitiesConfig() # Enables file editing and shell execution
    )

    prompt = f"""
Issue Title: {issue.title}
Issue Description:
{issue.body}

Approved Implementation Plan:
{plan}

CRITICAL DIRECTIVE: The core objective is defined by the Issue Title and Issue Description. The Approved Implementation Plan provides the steps to achieve this objective. Ensure the implementation directly resolves the original goal without getting distracted by unrelated details.

Please check and adhere to the project rules in '.agents/AGENTS.md' and '.agents/validation_insights.md'.

Please implement the changes in the codebase, and verify that the tests pass successfully by running 'npm test'. Do not stop until all tests pass successfully.
"""

    async with Agent(config) as agent:
        response = await agent.chat(prompt)
        async for token in response:
            sys.stdout.write(token)
            sys.stdout.flush()
        print()

    print("Implementation agent completed successfully.")
    sys.exit(0)

if __name__ == "__main__":
    asyncio.run(main())
