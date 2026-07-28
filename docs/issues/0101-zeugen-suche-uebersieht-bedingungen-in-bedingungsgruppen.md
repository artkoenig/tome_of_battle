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

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
