# Catalog fork CI: revision bump & catpkg generation

Tooling for the **Lexicanum catalog fork** (see
[ADR-0017](../../docs/adr/0017-lexicanum-katalog-fork-mit-eigener-revision-ci.md)),
delivered and tested here in `army_builder` but meant to run in the *fork repository*,
not in this app.

## Why this exists

The upstream Lexicanum repository does not maintain BattleScribe's `revision`
convention and ships no `catpkg.json`. Empirically verified: `Skaven.cat` gained a new
`entryLink` ("Ice Trolls") between releases `0.0.6` and `0.0.6.20260711` while its
`revision` stayed `"1"` in both. The app's silent updater
(`src/db/catalogUpdate.js`) only ever notices an update through a strictly higher
`revision` ("higher wins", per ADR-0014). Without help, no imported system would ever
see a Lexicanum update.

This tooling generates that signal in the fork: on every upstream sync it detects, per
file, whether content that matters changed (not merely the `revision` attribute
itself), bumps `revision` when it did, and regenerates `catpkg.json` in the format the
app already consumes (`id`, `name`, `type`, `revision`, `sourceSha256`).

## Contents

| File | Role |
| --- | --- |
| `catalogRevision.js` | Pure, framework-free logic: content-change detection, revision bumping, catpkg building. |
| `generate-catpkg.js` | CLI entry point. Wires fs + git into the pure logic. Run this in the fork. |
| `revision-bump-and-catpkg.workflow.yml` | GitHub Actions workflow **template** for the fork. |
| `catalogRevision.test.js` | Unit tests plus a regression test on the real Skaven `0.0.6 → 0.0.6.20260711` diff. |
| `__fixtures__/` | The two real Skaven catalog versions backing the regression test. |

## How the revision decision works

For each catalog file, comparing its version before the sync (`previous`) to the
just-synced version (`incoming`):

- **No previous version** → brand-new file, passed through untouched.
- **Content unchanged** (differs only in `revision`, or not at all) → the fork's
  previous revision is preserved, so an upstream revision *reset* can never claw a
  client's revision back down.
- **Content changed** → `revision` is set to one above both the previous and the
  incoming revision, guaranteeing it is strictly greater than anything a client may
  already hold — exactly what "higher wins" needs to fire.

Files stay byte-identical to upstream apart from the `revision` attribute, so
change detection is a revision-normalised byte comparison — it catches every real edit
and ignores a bare revision difference.

## Running it locally in the fork

```bash
# From the fork repo root, after syncing upstream:
node scripts/catalog-fork/generate-catpkg.js [--dir <path>] [--base <ref>]
```

`--base` (or `CATALOG_SYNC_BASE_REF`) is the git ref holding the pre-sync state;
it defaults to the parent commit (`HEAD^`). The workflow supplies the push event's
`before` SHA.

> These scripts are ES modules and the fork carries no `package.json`, so they rely on
> Node's automatic ESM syntax detection. Run them on Node ≥ 22.7 — the CI workflow pins
> Node 25.

## Manual steps to activate this in the fork (outside this issue)

This issue delivers and tests the tooling only. Wiring it into the actual fork
(`lexicanum-imperialis` fork under `artkoenig`) is a manual step, because the fork is a
separate repository this tracker does not reach:

1. **Copy the tooling into the fork.** Copy `catalogRevision.js` and
   `generate-catpkg.js` into the fork at `scripts/catalog-fork/` (the path the workflow
   template expects). No npm dependencies are needed — the scripts use only Node
   built-ins.
2. **Place the workflow file.** Copy `revision-bump-and-catpkg.workflow.yml` into the
   fork as `.github/workflows/revision-bump-and-catpkg.yml`. It targets the fork's
   default branch `main` (ADR-0017 / issue 05); adjust the `branches:` filter only if
   the fork uses a different default branch.
3. **Enable GitHub Actions in the fork.** GitHub disables Actions in forks by default
   (ADR-0014). Under *Settings → Actions → General*, allow workflows to run; otherwise
   no gate fires.
4. **Allow the workflow to push.** The template requests `permissions: contents:
   write`. If the fork's default `GITHUB_TOKEN` is read-only (org policy) or the branch
   is protected against the Actions bot, supply a PAT with push rights instead.
5. **Verify once.** After the first upstream sync push, confirm the workflow committed a
   `catpkg.json` and any bumped `revision` attributes back to the branch.
