# Context — Army Builder Architecture & Testability Review

## Active Goals
- Review the codebase structure, dependency graph, layering, and data flows.
- Map and evaluate the test suite, coverage, testability, and test data strategy.
- Evaluate extensibility, Battlescribe coupling, and state management scalability.
- Compile 8+ prioritized improvement recommendations.
- Ensure the existing test suite passes without modifications.

## Workspace Information
- Workspace Root: `/Users/artkoenig/Workspace/army_builder`
- Coordination Directory: `/Users/artkoenig/Workspace/army_builder/.agents/orchestrator`
- AGENTS.md Rules:
  - macOS Local: Puppeteer via CLI if browser-testing, but NO code changes are allowed for this review.
  - No auto git push.
  - All unit tests must pass.
