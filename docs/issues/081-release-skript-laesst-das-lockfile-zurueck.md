---
status: active
branch: claude/new-session-jnwa1m
pr:
---

# Das Release-Skript lässt das Lockfile zurück

## Intent

`node scripts/release.js <bump>` schreibt die neue Version nur nach
`package.json`. `package-lock.json` führt dieselbe Version an zwei Stellen
(`.version` und `.packages[""].version`) und bleibt unberührt. Beide Dateien
driften damit bei jedem Release auseinander.

Belegt am aktuellen `main`: `package.json` steht auf `1.9.0`,
`package-lock.json` auf `1.8.2`. Praktische Folge: ein `npm install` schreibt
das Lockfile stillschweigend um und macht damit jeden frisch aufgesetzten
Arbeitsbaum schmutzig — der Diff jeder unbeteiligten Arbeit trägt eine
Versionsänderung mit, die niemand gemacht hat.

Gewünschtes Ergebnis: nach einem Release-Lauf nennen `package.json` und
`package-lock.json` dieselbe Version, und ein `npm install` direkt danach
lässt den Arbeitsbaum sauber.

Acceptance criteria:

1. Nach `node scripts/release.js <patch|minor|X.Y.Z>` nennen `package.json`
   und beide Versionsstellen in `package-lock.json` dieselbe Version.
2. Ein `npm install` unmittelbar nach einem Release-Lauf hinterlässt keine
   Änderung an `package-lock.json` (`git status` sauber).
3. Der bestehende Rückstand ist eingeholt: `package-lock.json` nennt die
   Version, die `package.json` nennt.

## Plan

## Tasks

## Decisions

- **Herkunft:** Nebenbefund während Issue 076. Dort fiel auf, dass ein
  `npm install` im frischen Cloud-Arbeitsbaum `package-lock.json` von `1.8.2`
  auf `1.9.0` zog, ohne dass etwas an den Abhängigkeiten geändert wurde. Die
  Änderung wurde aus dem Diff von 076 zurückgenommen, weil sie dessen Absicht
  nicht dient.
- **Ursache belegt:** `scripts/release.js:46-52` (`writePackageVersion`)
  liest, ändert und schreibt ausschließlich `PACKAGE_JSON_PATH`.

## Log

- 2026-07-28 test-author: 7 black-box CLI tests in `scripts/release-lockfile.test.js`
  (temp-dir copies of the script, child-process runs; plus a repo-state test
  pinning criterion 3). All 7 proven failing for the intended reason before
  implementation.
- 2026-07-28 implementer: `writeLockfileVersion` in `scripts/release.js`
  (both lockfile spots, npm's 2-space/trailing-newline format, silent no-op
  without a lockfile); real lockfile caught up 1.8.2 → 1.9.0 by hand.
  `npx vitest run` 211 files / 2150 tests exit 0; lint, typecheck exit 0.
- 2026-07-28 review round 1 (fresh context): 0 findings, all criteria met.
  Extra facts: real `npm install` leaves the lockfile byte-identical (md5
  equal); JSON round-trip of the 216 KB lockfile is byte-identical; red-check
  confirmed the tests failed on the pre-fix script. Non-finding observations:
  empty Log (fixed by this entry); `scripts/release.js:4-5` cites a CLAUDE.md
  section title that has since been renamed — pre-existing, outside intent,
  left for the human.

## Checkpoints

### Before implementation

- Does this match what was asked? Yes — the three criteria cover exactly the
  observed drift: script writes both files, `npm install` stays clean, and the
  existing 1.9.0/1.8.2 backlog is caught up.
- What surprised me? A test file for the script already exists
  (`scripts/release.test.js`), and the script deliberately separates pure
  version computation from file I/O — the new behaviour slots into the I/O
  side.
- What am I assuming without having verified it? That updating the two
  documented lockfile spots (`.version`, `.packages[""].version`) directly in
  JS is sufficient — no `npm version` subprocess needed — and that the
  lockfile stays format v3 with exactly those two spots for the root package.

### Before the PR

- Does this match what was asked? Yes — all three criteria verified by tests
  and by the reviewer's independent runs; diff confined to `scripts/release.js`,
  `package-lock.json`, the new test file and this tracker file.
- What surprised me? Nothing in the change itself; the JSON round-trip of the
  real lockfile being byte-identical removed the main rewrite-fidelity risk.
- What am I assuming without having verified it? That future npm versions keep
  the 2-space/trailing-newline lockfile format the tests pin — if npm changes
  it, the repo-state test will say so. No version bump: build-script chore,
  nothing user-visible.

## Retro
