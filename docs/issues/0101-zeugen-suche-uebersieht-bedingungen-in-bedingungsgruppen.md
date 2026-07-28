---
status: active
branch: claude/new-session-jnwa1m-0101
pr:
---

# Zeugen-Suche übersieht Bedingungen in Bedingungsgruppen

## Intent

Die Ursachen einer Verletzung werden aus der Herleitungskette gelesen
(ADR-0027, `docs/evaluator-architecture.md` §3.6): ein Kettenschritt braucht
dafür einen **Zeugen** — die benennbare Auswahl hinter einer gehaltenen
Bedingung. Die Zeugen-Suche scannt aber nur direkte Bedingungen:
`witnessOf` liest `[...modifier.conditions, ...gate.conditions]`
(`src/evaluator/modifiers.js:470`), und `gateWithin` (`:474`) akkumuliert nur
`group.conditions` und lässt `group.conditionGroups` fallen.

Ein Modifikator, der **ausschließlich** über eine `<conditionGroup>` (oder
deren Untergruppen) gegatet ist, erhält damit `isConditional=true`, aber nie
einen Zeugen — seine Ursache fehlt im Bericht, obwohl die Bedingung in der
Gruppe genauso benennbar ist. Konkretes Muster:
Rüstung+Schild (`docs/battlescribe-data-format.md` §9.8) mit der
Schild-Bedingung in einer `and`-Gruppe → die Verletzung nennt den Schild
nicht als Auslöser.

Acceptance criteria:

1. Ein Modifikator, dessen einzige haltende Bedingung in einer
   `conditionGroup` (beliebiger Verschachtelungstiefe) liegt, trägt deren
   Zeugen in seinem Kettenschritt.
2. Das §9.8-Muster mit Gruppen-Bedingung liefert im Verletzungsbericht die
   Schild-Auswahl als Ursache.
3. Bedingungen ohne benennbares Ziel bleiben wie bisher zeugenlos (keine
   erfundenen Ursachen, ADR-0027).
4. Die bestehende Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt.

## Plan

## Tasks

## Decisions

- **Default (implementation, or-question):** only conditions that actually
  HELD reach the witness predicate (`heldConditionsOf` skips non-holding
  groups and conditions). A present-but-not-satisfying branch target of an
  `or` group can therefore never become a witness — the conservative
  answer to the recorded open question; single place to change if the
  human decides otherwise.

- **Herkunft:** Intensiv-Audit der Reinraum-Engine gegen die BSData-Doku im
  Repo (2026-07-28); Codepfad verifiziert.

## Log

- 2026-07-28 test-author: `src/evaluator/modifiers.groupWitness.test.js`,
  10 tests — 5 RED (and-group, depth-2 nesting, modifierGroup gate,
  or-group with only-possible witness, §9.8 causes), 5 green pins
  (direct-condition witness, mixed direct+group, two no-invented-witness
  cases, §9.8 harness control without group). Judgment calls recorded: the
  or-group test pins only the unambiguous variant (other branch's target
  absent → held branch's banner is the only possible witness); mixed pins
  the direct condition's witness as non-regression. Open question left
  unpinned: may an or-group name a present-but-not-satisfying branch
  target? Neither issue nor ADR-0027 decides it.
- 2026-07-28 implementer: `modifiers.js` only (+63/−8) —
  `UNCONDITIONAL_GATE`/`gateWithin` carry `conditionGroups`;
  `witnessOf(ctx, conditions, conditionGroups)` searches direct conditions
  first (unchanged precedence), then descends via generator
  `heldConditionsOf` (document order, any depth, unchanged
  `witnessOfCondition` predicate — no new eligibility rules). Docs checked:
  §3.4/§3.6 and ADR-0027 describe the witness generically, no doc change
  needed. 10/10 target green; suite 211 files / 2153 tests exit 0;
  puppeteer E2E exit 0; lint/typecheck exit 0.
- 2026-07-28 review round 1 (fresh context): all four criteria met; reds
  re-proven on origin/main (5/5 exactly as authored); test file untouched;
  E2E manifest scenarios contain no conditionGroup (grep: zero data hits),
  so no expectation changed silently; gate shape module-private. 1 minor
  non-behavioral finding, fixed: the `witnessOf` comment justified the
  throwaway diagnostics list with "bereits gemeldet", which is false for
  or-branches short-circuited at fire time — reworded to the true
  justification (observation-equal to fire time). Behaviour proven
  identical either way. Side fact: `scripts/measure-evaluator.js` exits 1
  on HEAD **and** on origin/main (catalog-prep share of the threshold) —
  pre-existing, decisive reused-dataset line in the noise band; noted for
  the human, not this run's territory.
- 2026-07-28 review round 2 (fresh context, whole intent): all criteria
  met; comment fix verified true against `conditionGroupHolds` semantics;
  reds re-proven; depcruise exit 0. 1 minor finding, dismissed with reason:
  the held-only default has no regression guard (reviewer's mutant —
  unconditional `yield` — survives the suite; distinguishing case: or-group
  with present-but-not-held first branch). Dismissal reason: the underlying
  or-question is deliberately parked as a human decision (see test-author
  log); pinning the default now would freeze an unratified choice. When the
  human ratifies (either way), decision + pin land together — surfaced in
  the PR.

## Checkpoints

### Before implementation

- Does this match what was asked? Yes — extend the witness search
  (`witnessOf`/`gateWithin`, `modifiers.js`) to descend into
  `conditionGroups` recursively, so a group-gated modifier carries a witness
  in its derivation step; ADR-0027's no-invented-causes rule bounds it.
- What surprised me? Nothing yet — the intent names the exact dropped
  branch (`group.conditionGroups` in `gateWithin`).
- What am I assuming without having verified it? That descending into `or`
  groups is as sound as `and` groups for witness purposes (a held `or`
  group's cause is whichever branch held — the criteria say "beliebiger
  Verschachtelungstiefe" without distinguishing; if the semantics of OR
  make a witness ambiguous, the test-author should surface it as a question
  rather than pin a guess).

### Before the PR

- Does this match what was asked? Yes — group-gated modifiers carry their
  witness at any depth, the §9.8 pattern names the shield, no invented
  causes, suite green by exit code; two fresh-context rounds, reds proven
  real both times.
- What surprised me? The or-short-circuit subtlety: the first honest
  justification for the throwaway diagnostics list was wrong even though
  the behaviour was right — and the reviewer's mutant showed how easily an
  unpinned default survives.
- What am I assuming without having verified it? That the conservative
  held-only witness rule is what the human wants for or-groups — recorded
  as default, unguarded by design until ratified. No version bump:
  evaluator not wired to the UI.

## Retro
