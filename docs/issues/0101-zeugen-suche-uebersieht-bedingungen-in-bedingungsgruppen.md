---
status: backlog
branch:
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

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
