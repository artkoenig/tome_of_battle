---
status: backlog
branch:
pr:
---

# Unblock the Renovate PR: hold TypeScript below 7 and make the JSZip mock constructible

## Goal

The grouped Renovate PR "Update all dependencies" (#284) goes green, so that Node 26, vitest 5, jsdom 31 and the pinned GitHub Action digests can land. It fails today for two reasons only. First, TypeScript 7 breaks the typecheck (299 errors) and the project-state scripts, and that migration has its own issue (0205). Second, vitest 5 refuses to `new` a `vi.fn()` whose implementation is an arrow function, which breaks the JSZip mock in the Importer component test. This issue keeps Renovate on TypeScript 6.x until 0205 lands and makes the mock work under vitest 3 and 5 alike.

## Acceptance criteria

- AC1: `renovate.json` carries a `packageRules` entry that restricts `typescript` to `<7` (`allowedVersions`), with a `description` that names issue 0205 as the reason and as the place where the rule is removed again. The existing "all dependencies" group stays as it is. | verify: node -e "const r=require('./renovate.json');const p=r.packageRules.find(x=>(x.matchPackageNames||[]).includes('typescript'));if(!p||p.allowedVersions!=='<7')process.exit(1)"
- AC2: The `jszip` mock in `src/tests/ui/components/Importer.test.jsx` gives `vi.fn()` an implementation that can be called with `new` (a `function` or `class`, not an arrow), so "8. Export & Delete Actions" and "13. Failed Export Action" pass under vitest 5. They must still pass on the vitest version currently on `main`. | verify: forge-test --run src/tests/ui/components/Importer.test.jsx
- AC3: The full suite stays green on `main`. | verify: forge-test
- AC4: After the merge, Renovate rebuilds #284 without the TypeScript bump, and its `lint-and-test` check passes. Check this by hand on the PR.

## Out of scope

- The TypeScript 7 migration itself: JSDoc `object` annotations and the compiler API in `scripts/project-state/` (issue 0205).
- Editing the Renovate branch or PR #284 directly. Renovate regenerates it from `main`.
- Any other dependency pin or Renovate grouping change.
