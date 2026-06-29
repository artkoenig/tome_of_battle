# Plan — Refactor, Test, and Clean Army Builder

This plan outlines the steps to refactor, test, and clean the army_builder application.

## Objectives
1. **R1. Refactoring & Entkopplung**: Refactor large, monolithic files/functions into small, testable modules. Improve component data flow without changing existing behavior.
2. **R2. Testabdeckung**: Increase unit test coverage of the business logic. Verify any changes via tests.
3. **R3. Dead Code & Abhängigkeiten**: Remove unused code and dependencies.
4. **R4. Fachlogik**: Avoid using English or German substrings as keys in parsing or validating.

## Steps
### Phase 1: Setup & Discovery
- [ ] Create agent metadata files (`plan.md`, `progress.md`, `context.md`).
- [ ] Initialize heartbeat cron.
- [ ] Spawn `teamwork_preview_explorer` to perform a comprehensive codebase analysis and locate monoliths, tests, dead code, and dependencies.
- [ ] Receive explorer findings and document architecture and code layout.

### Phase 2: Milestone Decomposition
- [ ] Create `PROJECT.md` at root.
- [ ] Decompose tasks into 3-7 milestones (e.g., refactoring modules, cleaning dead code/dependencies, increasing tests).
- [ ] Define interface contracts between decoupled components.

### Phase 3: Execution & Verification
- [ ] For each milestone, dispatch execution (using Explorer -> Worker -> Reviewer -> Challenger -> Auditor loop or spawning sub-orchestrators).
- [ ] Run unit tests and verify correctness.
- [ ] Gate milestones using Forensic Auditor and ensure cleanliness.

### Phase 4: Final Synthesis & Acceptance
- [ ] Synthesize all work.
- [ ] Run the complete test suite.
- [ ] Generate final reports (dead code removed, refactored components, layout compliance).
- [ ] Report completion to user/Sentinel.
