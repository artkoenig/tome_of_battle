# Plan — Architecture, Testability, and Extensibility Review

This plan outlines the steps to perform a comprehensive audit and review of the Tabletop army list builder application.

## Objectives
1. **R1. Architecture Analysis**: Analyze modules, imports, data flows, and code size to identify monolithic patterns, coupling, and separation of concerns.
2. **R2. Testability Assessment**: Map existing test coverage, find untested critical paths, and suggest test infrastructure unification and refactoring of hard-to-test code.
3. **R3. Extensibility Evaluation**: Assess coupling to Battlescribe, ease of adding new features/systems, and state management scalability.
4. **R4. Prioritized Recommendations**: Provide at least 8 concrete, prioritized improvements with severity, effort, and benefits.

## Steps
### Phase 1: Codebase Analysis
- [ ] Spawn `teamwork_preview_explorer` to inspect files, imports, data flow, and tests.
- [ ] Catalog all files in `src/`, measure LOC, map dependency graph.
- [ ] Trace Battlescribe XML data flow through parsing, validation, state, and UI.
- [ ] Map test files, runners, and coverage.
- [ ] Identify untested critical paths, coupling points, and hard-to-test patterns.

### Phase 2: Report Drafting
- [ ] Synthesize findings from the Explorer.
- [ ] Construct the dependency graph (mermaid format) and flow sequence diagram.
- [ ] Document specific files, LOC (>400 LOC breakdowns), coupling points (with line ranges).
- [ ] Map test coverage matrix and draft a test unification recommendation.
- [ ] Formulate 3 extensibility scenarios and assess state scaling.
- [ ] Compile 8+ prioritized recommendations with severity, effort, benefit, and file references.

### Phase 3: Verification & Delivery
- [ ] Spawn a `teamwork_preview_worker` to run the existing test suite and verify `npm test` passes successfully.
- [ ] Deliver the final review report as a structured markdown file.
