---
status: active
branch: claude/tests-eigenes-modul-9qihbk
pr:
---

# Restructure src into ui/domain/data/tests layers

## Goal

`src` is organized into four self-contained layers — `ui`, `domain`, `data`, `tests` — with
`shared` gone entirely, `data/services` and `data/rules` reclassified into `domain`, and every
test file relocated into a mirrored `src/tests/` tree, without changing any module's actual
runtime behavior or dependency direction.

## Acceptance criteria

- AC1: `src/shared` no longer exists; every former `shared/*` file (`types.js`,
  `constants/views.js`, `test-utils/*`, `__fixtures__/*`) has moved to `domain`, `ui`, or `tests`
  respectively. | verify: test ! -d src/shared
- AC2: Every `*.test.*`/`*.spec.*` file under `src` lives under `src/tests/`, mirroring its
  original layer subtree; none remain colocated with source outside `src/tests/`. | verify: test -z "$(find src -path src/tests -prune -o \( -iname '*.test.*' -o -iname '*.spec.*' \) -print)"
- AC3: `src/data/services` and `src/data/rules` no longer exist; their contents live under
  `src/domain/services` and `src/domain/rules`. | verify: test ! -d src/data/services && test ! -d src/data/rules
- AC4: The area rule for the relocated services module reflects its new path, so the note still
  loads for whoever works there. | verify: grep -q 'src/domain/services' .claude/rules/areas/services.md
- AC5: A new ADR records the reclassification of `data/services` and `data/rules` from Daten to
  Fachlogik, amends/supersedes ADR 0037 (the 0029→0030 pattern), and is indexed in
  `docs/adr/README.md`.
- AC6: `docs/project-map.md`'s layer and folder tables reflect the new structure (services/rules
  under domain, `shared` removed, `tests` module documented). | verify: grep -q 'src/tests/' docs/project-map.md
- AC7: forge-lint passes, including the dependency-cruiser layer rules covering the moved paths
  (no silent blind spot where a moved directory stops matching any layer). | verify: forge-lint
- AC8: forge-typecheck passes, including JSDoc `@param {import(...)}` type-path references across
  every moved file. | verify: forge-typecheck
- AC9: forge-test passes, with vitest discovering and running every relocated test file and the
  i18n test setup loading from its new path. | verify: forge-test
- AC10: forge-build passes, including the rules-index.json codegen script writing to its new
  location. | verify: forge-build
- AC11: Re-running the cast module-graph check on the post-move `src` tree shows no new
  dependency cycle.

## Out of scope

- `src/main.jsx` and `src/index.css` — documented convention, stay at the root of `src`.
- Any behavior change: this is a pure relocation of files and import paths, not a refactor of
  what any module does.
- `e2e/ui.test.js` (the Puppeteer app E2E) — lives outside `src`, already excluded from
  forge-test, untouched by this move.
