---
status: backlog
branch:
pr:
---

# cast replaces dependency-cruiser

## Goal

dependency-cruiser is the project's structural checker in two independent places: it is the
blocking half of the lint gate, and it is the graph source the status report reads. cast is
installed and answers on the same wrapper contract, so the project should carry one graph tool,
not two. Every boundary the current config enforces is carried over — the ADR-0037 layer rules,
the ADR-0038 ViewModel rules, the Reinraum boundary and the evaluator facade — but ported at
`severity: "warn"` first, so the sites cast finds are counted and reported before anyone decides
to make them blocking. The cycle and orphan checks are dropped rather than translated: both were
warn-only, cast has no rule type for either, and orphans are already covered elsewhere. Note for
the warn phase: the facade and Reinraum boundaries stay blocking through the `no-restricted-imports`
mirror in the oxlint config, but the layer rules are unenforced until a follow-up switches them to
`error`.

## Acceptance criteria

- AC1: The project carries a cast rule set holding a counterpart for every dependency-cruiser rule except the cycle and the orphan check, each at `severity: "warn"`, with the test-file exemption and the facade exception preserved. | verify: `node -e 'const r=JSON.parse(require("fs").readFileSync(".cast/rules.json","utf8"));const n=(r.forbidden||[]).map(x=>x.name);const need=["schichtung-parser-kein-rueckgriff","ableitungen-nur-in-viewmodels","viewmodel-keine-komponente","komponente-kein-bericht","viewmodel-keine-datenschicht","ui-nicht-auf-daten","daten-kein-rueckgriff","fachlogik-kein-rueckgriff","keine-i18n-unter-ui","evaluator-keine-roster-abhaengigkeit","roster-keine-evaluator-abhaengigkeit","roster-keine-evaluation-abhaengigkeit","evaluation-keine-roster-abhaengigkeit","evaluator-nur-ueber-fassade"];const miss=need.filter(x=>!n.includes(x));const hard=(r.forbidden||[]).filter(x=>x.severity!=="warn").map(x=>x.name);if(miss.length||hard.length){console.error("missing:",miss.join(",")||"-","not warn:",hard.join(",")||"-");process.exit(1)}'`
- AC2: The lint gate runs the cast check where it ran dependency-cruiser, and passes. | verify: `bash -c 'grep -q cast .forge/config.json && ! grep -q depcruise .forge/config.json && forge-lint'`
- AC3: An ADR records cast as the project's structural checker, why the cycle and orphan checks were dropped, and how many sites each warn rule finds at the time of the switch, so the later decision to make them blocking has a number to stand on. | verify: `bash -c 'grep -rliE "(^|[^a-z])cast([^a-z]|$)" docs/adr/ | grep -q .'`
- AC4: dependency-cruiser is gone: no dependency, no npm script, no config file, no CI step, and no source comment or project rule still pointing at it. | verify: `bash -c 'grep -rniE "depcruise|dependency-cruiser" package.json .forge/config.json .github/workflows/ src/ scripts/ .claude/rules/ && exit 1; if test -e .dependency-cruiser.cjs; then echo "config file still present"; exit 1; fi; exit 0'`
- AC5: The status report builds its module graph from cast and names the cast check as its structure gate, with its own tests passing. | verify: `bash -c 'grep -q cast scripts/project-state/gates.js && forge-test --run scripts/project-state'`
- AC6: The project rules, the project map and the README name cast as the structural checker. | verify: `bash -c 'grep -q cast .claude/rules/forge.md && grep -q cast docs/project-map.md && grep -q cast README.md'`

## Out of scope

- Switching any ported rule from `warn` to `error`, and writing a baseline for the sites it finds. That decision follows this issue, on the counts it reports.
- Replacing the cycle and the orphan check with anything. Cycles stay visible through the cast map, orphans through knip.
- Rewriting the historical ADRs that name dependency-cruiser as the tool of their day.
- The `no-restricted-imports` mirror in the oxlint config, which keeps its rules unchanged.
- A version bump: nothing a user of the app can see changes.
