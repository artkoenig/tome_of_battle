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

- **Herkunft:** Intensiv-Audit der Reinraum-Engine gegen die BSData-Doku im
  Repo (2026-07-28); Codepfad verifiziert.

## Log

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
