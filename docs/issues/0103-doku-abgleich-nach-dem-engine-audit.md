---
status: done
branch: claude/new-session-jnwa1m-0103
pr: https://github.com/artkoenig/tome_of_battle/pull/153
---

# Doku-Abgleich nach dem Engine-Audit

## Intent

Das Engine-Audit (2026-07-28) hat drei Stellen gefunden, an denen die
Dokumente selbst driften oder einander widersprechen. Reines Doku-Issue;
kein Produktivcode.

1. **`docs/evaluator-architecture.md` §4.1 ist stale:** das
   `CountedField`-Enum nennt `FORCE_COUNT` nicht, obwohl die eigene
   `LimitMeasure`-Aufzählung und der Code (`model.js`, `field="forces"`) ihn
   führen. Der Code ist richtig, die Doku hinkt.
2. **`append`-Trennzeichen:** das BSData-Wiki sagt „a space is implicitly
   added", `docs/battlescribe-data-format.md` §7.7 sagt „ohne `join` wird
   ohne Trennzeichen zusammengefügt". Die Engine folgt der Projekt-Doku
   (reale Daten setzen `join` immer explizit, 62 Vorkommen). Der Widerspruch
   gehört in der Projekt-Doku benannt und entschieden.
3. **Rechenregel §7.5 (`child.number * parent.number`):** die Engine
   multipliziert Stückzahlen nicht durch die Elternkette
   (`countIndex.js`, `contributionOf`). Mit absoluten `.ros`-Stückzahlen ist
   das konsistent — die `.ros`-Semantik ist laut §15 aber selbst eine
   Doku-Lücke. Die Regel gehört präzisiert: für welche Zahlenbasis
   (Katalog-Constraints vs. `.ros`-`number`) sie gilt und was die Engine
   voraussetzt; hängt am Roster-Vertrag (Issue 084).
4. **§3.2/§7.2 erwähnen den ADR-0032-Override nicht:** §3.2 verlangt
   Kontext-Threading („der `catalogueId`-Kontext muss mitgeführt werden"),
   §7.2 die Katalog-Lokalität des Link-Ziels. ADR-0032 überstimmt beides
   bewusst (Global-by-ID über eine flache Tabelle, Kollisions-Guard als
   Sicherheitsnetz) — die Format-Doku nennt den Override an diesen Stellen
   aber nicht. Nach der Projektregel „wenn Dokument und Entscheidung
   auseinanderlaufen, ist das Dokument veraltet" gehört der Verweis in beide
   Abschnitte.

Acceptance criteria:

1. `docs/evaluator-architecture.md` §4.1 führt `FORCE_COUNT` (und stimmt
   damit mit `LimitMeasure` und dem Code überein).
2. `docs/battlescribe-data-format.md` §7.7 benennt den Wiki-Widerspruch zum
   `append`-Trennzeichen und die geltende Entscheidung samt Beleg.
3. §7.5 sagt eindeutig, auf welche Zahlenbasis sich die Rechenregel bezieht
   und was die Engine vom `.ros`-`number` voraussetzt; der Querverweis auf
   Issue 084 steht dabei.
4. §3.2 und §7.2 benennen den bewussten ADR-0032-Override (Global-by-ID
   statt Kontext-Threading/Katalog-Lokalität) mit Verweis auf das ADR und
   dessen Kollisions-Diagnose.
5. Kein Produktivcode ändert sich (Diff-Beleg); es gibt nichts auszuführen —
   die Review des Diffs gegen dieses Intent ist die einzige Prüfung.

## Plan

## Tasks

## Decisions

- **Herkunft:** Intensiv-Audit der Reinraum-Engine gegen die BSData-Doku im
  Repo (2026-07-28).

## Log

- 2026-07-28 implementer: both docs edited, every audit claim re-verified at
  the code first. Surprise (recorded per rulebook): the audit's "62
  occurrences, real data always sets `join`, difference latent" was inexact —
  62 `join=` total, 6 inert on `set`-modifiers, and of 57 `append` modifiers
  exactly one (`Mercenaries (6th definitive edition).cat:4817`) has no
  `join`, so the wiki divergence is visible there (`Name*` vs `Name *`), not
  latent. §7.7 now carries the corrected evidence; the governing decision
  (project-doc semantics) is unaffected. Verified anchors: `model.js:40-45`
  (`FORCE_COUNT`), `modifiers.js:78-79` (`join ?? ''`), `countIndex.js:69-77`
  (no parent-chain multiplication), ADR-0032 diagnostics
  `DUPLICATE_DEFINITION` + `MISSING_CATALOGUE_DEPENDENCY`.
- 2026-07-28 review round 1 (fresh context, the only check for this change):
  2 minor findings, both fixed — (1) §7.7 evidence claimed "reale
  Definitive-Edition-Kataloge" while the counts hold only for the frozen
  fixture subset (4 `.cat` + 1 `.gst` of 17 catalogues); scoping now names
  the fixture path. (2) case error in the §7.2 box ("ein fehlender
  Ziel-Katalog" → "einen fehlenden"). All five criteria judged met; every
  countable claim independently re-verified (62/57/56/1 counts, wiki line
  359, `NO_JOIN`, `contributionOf`, ADR-0032 diagnostics). Non-findings
  noted: ADR-0003:47 and §10 repeat the §7.5 rule without the new caveat
  (true on their catalogue basis, no contradiction).
- 2026-07-28 review round 2 (fresh context, whole intent): 1 minor finding,
  fixed — the §7.2 box attributed both diagnostics to "der Guard";
  `MISSING_CATALOGUE_DEPENDENCY` is raised by the facade's dataset
  preparation (`datasetPreparation.js:57`), not the resolver's collision
  guard. Sentence now attributes each diagnostic to its mechanism. All five
  criteria met; all counts and quotes re-verified independently a second
  time. Trend 2 → 1.
- 2026-07-28 out of scope, left for the human (AC 5 forbids code changes):
  `src/evaluator/model.js:34-35` JSDoc quotes the old §4.1 enum and is now
  the stale copy of the pair.

## Checkpoints

### Before implementation

- Does this match what was asked? Yes — four localized documentation
  corrections, each falsifiable by reading the named section against the code
  or ADR it must agree with.
- What surprised me? Point 3 touches a genuine open question (the `.ros`
  number semantics, issue 084) — the criterion deliberately asks only for a
  precise statement of what the engine assumes plus the cross-reference, not
  for resolving 084.
- What am I assuming without having verified it? The audit's code claims
  (`FORCE_COUNT` in `model.js`, `contributionOf` not multiplying through the
  parent chain, 62 explicit `join` occurrences, wiki wording on `append`).
  The implementer must re-verify each against code/data before writing, and
  the reviewer re-checks. Nothing to run for this change (docs only) — per
  invariant 2 there are no tests to write; the fresh-context diff review is
  the only check (criterion 5 says exactly this).

### Before the PR

- Does this match what was asked? Yes — all four doc corrections in place,
  three review rounds (2 → 1 → 0 findings), every countable claim verified
  independently three times; diff confined to the two docs plus this file.
- What surprised me? The audit's §7.7 evidence was itself imprecise (one
  join-less `append` exists, making the wiki divergence visible, not
  latent) — the doc now carries the corrected, fixture-scoped evidence.
- What am I assuming without having verified it? That the fixture subset
  (4 of 17 Definitive-Edition catalogues) is representative enough for the
  §7.7 evidence — the doc now says exactly this instead of claiming more.
  No version bump: docs only, nothing user-visible in the app.

## Retro

- The "re-verify every audit claim before writing" instruction to the
  implementer paid off directly: it caught the inexact §7.7 evidence before
  it landed in a reference document.
- Three review rounds for a docs change felt heavy but was right: rounds 1
  and 2 each found something real in text that had no other check, and each
  fix touched a criteria file, so the no-waiver rule applied. Convergence
  2 → 1 → 0.
- Follow-up candidates for the human: stale JSDoc `model.js:34-35` (old
  §4.1 enum quote); §10 / ADR-0003 repeat the §7.5 rule without the new
  caveat (currently consistent, but a cross-reference would harden it).
