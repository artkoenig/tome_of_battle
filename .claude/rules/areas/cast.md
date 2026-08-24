---
paths:
  - ".cast/**"
---

# .cast

The structure gate cast reads (`cast check --root .`, wired into `forge-lint` since ADR 0041,
replacing dependency-cruiser). `cast` resolves via `command -v cast`, else
`${CLAUDE_PLUGIN_ROOT}/bin/cast` — that resolution string is duplicated in `.forge/config.json`'s
`lint` command and must stay in sync if either changes.

- `rules.json`'s `from`/`to` are **one string each** — a layer name from `layers.json` or a raw
  path glob (`**`/`*` only, no brace/char-class alternation, no negation). There is no array form:
  a dependency-cruiser rule with `to: [A, B, C]` cannot be reproduced exactly. Pick the
  architecturally primary single target and document the narrowing (ADR 0041 has the worked
  example for `daten-kein-rueckgriff`, `fachlogik-kein-rueckgriff`, `keine-i18n-unter-ui`).
- `layers.json` is one global glob→name partition, first-match-wins, shared by every rule in the
  same `cast check` run — a module has exactly one canonical layer. Multiple glob *keys* can map
  to the *same* layer name (used here for the `ableitung-ziel` grouping of three specific files,
  and for `evaluator-facade`/`evaluator-intern`/`rest`), but two rules can never see the same
  module under two different layer names — plan the whole partition once, not rule by rule.
- Route `**/*.test.js`/`**/*.test.jsx` to a `test` layer first, and `__fixtures__/**` to its own
  layer before the layer it would otherwise fall into. `.dependency-cruiser.cjs` excluded
  `__fixtures__/` and test files from the whole graph via `options.exclude`/`pathNot`; cast has no
  project-wide exclude, so an unrouted fixture or test file shows up as a real edge and can turn a
  currently-green rule red (hit `scripts/lib/evaluator-measurement-cases.js ->
  src/domain/evaluator/__fixtures__/rosParser.js` this way under `evaluator-nur-ueber-fassade`).
- `cast` has no rule type for import cycles or orphan modules (dependency-cruiser's
  `to: { circular: true }` / `from: { orphan: true }`) — don't try to rebuild `no-circular`/
  `no-orphans` as a rule; that class of finding comes from `cast report`/`cast:map` instead, with
  no severity of its own.
- `cast edges --from <layer> --to <layer> --root .` answers "does this edge exist today" before
  committing to a from/to choice — the fast way to confirm an approximated rule stays green.
- No CI job runs `cast` (ADR 0041): it's a Claude-Code-plugin binary, not an npm package, so a
  GitHub Actions runner can't install it. The structure gate is local/agent-side only, via
  `forge-lint`.
