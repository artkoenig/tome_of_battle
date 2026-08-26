---
status: backlog
branch:
pr:
---

# Every ADR states what holds today, or records when it stopped holding

## Goal

Issues 0205 and 0206 corrected one class of drift each — the vanished gate, the dead `src/domain/`
paths, two wrong rule names, and the one ADR contradicted on domain behaviour. A sweep of all 42
records against today's code and configuration finds that this was a sample, not the set. Twenty-one
ADRs still assert something a reader can check and find false, in seven shapes:

- **Dead paths.** `src/data/…` as a current location, module paths from before the context cut.
- **Dead identifiers.** Functions and components named as the place a rule lives that no longer
  exist anywhere in `src/` — `isSharedQuery`, `getEffectiveCategoryLinks`,
  `collectUnitProfilesAndRules`, `DebugEntryEditorModal`, `resolveScopeAnchor`,
  `collectListRuleStates`, and a hook file named `useRoster.js`.
- **Dead rule and layer names.** `daten-kein-rueckgriff`, `solver-nur-ueber-fassade` and the layer
  `anzeige-ableitungen` are cited as if they could be looked up; none is in `.cast/rules.json` or
  `.cast/layers.json`. The 0205 notes assure a reader that "the checked edges still hold" and leave
  the unlookuppable names in place.
- **Tools that do not exist.** `npm run depcruise`, a workflow `doc-drift-check.yml`, and a
  `pre-push` hook that no checkout installs — `.git/hooks/` holds only samples and
  `core.hooksPath` is unset. The claimed doc-drift workflow is part of why this issue exists.
- **Numbers measured two rebuilds ago.** The ADR that defines the structural gate reports its own
  run as 1235 edges against 17 rules over 554 modules; it is 1300 against 31 over 582 today, moved
  again by issue 0203. 0042's erratum already rejects numbers-in-prose for exactly this reason.
- **Statements the tree contradicts.** The database interface is described with three object stores
  where there are four (`games` is missing); "exactly two modules under `src/contexts/` may name
  `src/platform/`" where there are three ports, one of them named four lines higher in the same
  record; a dependency "Dexie" that appears nowhere in the tree or its history; a structural check
  described as warn-only that has been a blocking CI step since ADR 0041; a claim that `main` is
  always live where ADR 0008 says it is promoted by hand.
- **Records overtaken without a note.** An `Accepted` decision naming a catalogue fork and an index
  format that ADR 0017 and 0018 replaced; an `Accepted` decision routed through a component that
  issue 0121 deleted, where the mechanism that survived works differently.

Two findings sit next to the ADRs rather than in them and belong to this sweep because leaving them
is the risk the sweep exists to remove. `src/platform/battlescribe/schema/PROVENANCE.md:8` instructs
a reader to keep the vendored XSD byte-identical to upstream and pins a hash the file no longer has,
while ADR 0016 records that three constructs were added by hand on purpose — a reader who trusts the
provenance file re-pulls upstream and silently reintroduces the regression of issue 0115. And three
records carry text corruption that predates any drift: a stray `</content>` tag rendered literally on
the published pages, and two sentences that break off mid-clause.

**The correction form is the one issue 0205 established and it is not negotiable here.** An ADR is
the record of a decision at a time. A dated `Nachtrag` maps what changed and names the issue or ADR
that changed it; a statement that was wrong when written is marked as an erratum; a status line
gains a forward reference. Bodies are not rewritten to say something else, and a decision that was
later reversed stays legible as having been taken. Repairing corrupted punctuation and a stray tag is
not a rewrite and is in scope.

No version bump: documentation only.

## Acceptance criteria

- AC1: Each of ADR 0002, 0005, 0007, 0009, 0011, 0012, 0013, 0014, 0016, 0017, 0019, 0020, 0024, 0027, 0037, 0038, 0041, 0042 carries a dated note or erratum covering what the sweep found in it. | verify: `bash -c 'for n in 0002 0005 0007 0009 0011 0012 0013 0014 0016 0017 0019 0020 0024 0027 0037 0038 0041 0042; do grep -qi nachtrag docs/adr/$n-*.md || { echo "missing $n"; exit 1; }; done'`
- AC2: No ADR cites a cast rule or layer name that cannot be looked up. | verify: `bash -c '! grep -rqE "daten-kein-rueckgriff|solver-nur-ueber-fassade|anzeige-ableitungen|roster-keine-evaluation-abhaengigkeit" docs/adr/'`
- AC3: Every cast rule name an ADR quotes as current exists in `.cast/rules.json`, checked by name and not by sample. | verify: manual read during review, listing the names checked
- AC4: No ADR presents a script or workflow the repository does not have. | verify: `bash -c '! grep -rqE "npm run depcruise|doc-drift-check" docs/adr/'`
- AC4b: No ADR relies on a `pre-push` hook as an enforcement step; where the hook is part of the recorded decision it is marked as never having been installed. | verify: manual read of every hit of `grep -rn pre-push docs/adr/`
- AC5: No ADR names an identifier as the place a rule lives when no module under `src/` defines it. | verify: `bash -c 'for n in isSharedQuery getEffectiveCategoryLinks collectUnitProfilesAndRules DebugEntryEditorModal resolveScopeAnchor collectListRuleStates; do grep -rq "$n" docs/adr/ && ! grep -rq "$n" src --include=*.js --include=*.jsx && { echo "stale $n"; exit 1; }; done; true'`
- AC6: The record defining the structural gate no longer reports a measurement that a later change invalidates — the numbers are dropped, dated, or replaced by the command that produces them. | verify: manual read of `docs/adr/0041-cast-als-strukturpruefer.md`
- AC7: The data-layer record names four object stores. | verify: `bash -c 'grep -q games docs/adr/0002-data-flow-and-indexeddb-storage.md'`
- AC8: The context-cut record no longer counts two port modules where three exist, and no longer names a dependency the tree never had. | verify: `bash -c 'grep -q "play/ports" docs/adr/0042-schnitt-nach-fachlichkeit-bounded-contexts-und-ports.md && ! grep -qi dexie docs/adr/0042-schnitt-nach-fachlichkeit-bounded-contexts-und-ports.md'`
- AC9: The toolchain record describes the structural check as the blocking CI step it is, and knip as the warn-only one. | verify: manual read of `docs/adr/0024-statik-toolchain-oxlint-knip-dependency-cruiser.md` against `.github/workflows/ci.yml:41-43,60-61`
- AC10: `PROVENANCE.md` and ADR 0016 agree — the deliberate hand-additions are stated where a reader re-pulling upstream will meet them, and the pin matches the file or is removed as unmaintainable. | verify: `bash -c 'test "$(sha256sum src/platform/battlescribe/schema/*.xsd | cut -c1-16)" = "$(grep -oE "[0-9a-f]{16}" src/platform/battlescribe/schema/PROVENANCE.md | head -1)" || ! grep -qE "[0-9a-f]{64}" src/platform/battlescribe/schema/PROVENANCE.md'`
- AC11: No ADR renders broken on the published pages — the stray closing tag is gone and the two truncated sentences read as sentences. | verify: `bash -c '! grep -rq "</content>" docs/adr/'`
- AC12: `docs/adr/README.md` shows for every ADR the status its own file shows. | verify: manual read
- AC13: No body was rewritten to say something other than what was decided; every correction is a note, an erratum, a forward reference, or a repair of corrupted text. | verify: manual read of the diff during review
- AC14: Nothing outside `docs/` and the one provenance file changed, and the gates are green. | verify: `bash -c 'git diff --name-only 0aa7788 | grep -vE "^docs/|^src/platform/battlescribe/schema/PROVENANCE.md" | grep -q . && exit 1; forge-test && forge-lint && forge-typecheck'`

## Out of scope

- Writing the `doc-drift-check.yml` workflow, or any other gate that would hold this sweep in place.
  Removing a false claim is this issue; building the thing it claimed is a decision of its own.
- ADR 0032 B1 and the corrections landed by issues 0205 and 0206 — already done, not to be redone.
- Any source change. The XSD itself is not touched; only the record beside it.
- New ADRs for decisions taken since. A missing record is not a wrong record.
- `docs/project-map.md` and the area notes — issue 0202 owns those.
