---
status: backlog
branch:
pr:
---

# Verweisketten zählen nicht unter der transitiv aufgelösten Ziel-Id

## Intent

Die eigene Architektur-Doku (`docs/evaluator-architecture.md` §4.4) verlangt:
„for linkedId in **linkChainOf**(node.def): keys.add(…)" — ein Knoten zählt
unter seiner ganzen Verweis-Kette. `docs/battlescribe-data-format.md`
(§3.4/§7.6) verlangt Vergleiche über aufgelöste Ziel-Ids.

`targetsOf` (`src/evaluator/countIndex.js:111`) registriert aber nur die
Ein-Hop-`targetId`, nie `resolved.id` bzw. die Kette. Der Resolver folgt
Link-auf-Link-Ketten dagegen vollständig (`followEntryLink`,
`src/evaluator/resolver.js:228`) — die Engine erlaubt Ketten also, zählt sie
aber nicht konsistent. Auch `constraints.js:73` zählt nur die
Ein-Hop-`targetId` des Anker-Verweises.

Repro (Audit 2026-07-28, gegen die echte Fassade): `link-outer → link-inner →
shared-final`; Condition `childId="shared-final"` an einem anderen Eintrag.
Auswahl über `link-outer` → Modifier feuert **nicht**; Auswahl über
`link-inner` (ein Hop) → feuert.

Acceptance criteria:

1. Eine über eine Verweiskette beliebiger Länge gesetzte Auswahl zählt unter
   jeder Id der Kette (Link-Ids und finale Ziel-Id): das Repro feuert auch
   über `link-outer`.
2. Eine Grenze an einem Ketten-Verweis zählt gegen die transitiv aufgelöste
   Ziel-Id.
3. Die bestehende Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt.

## Plan

## Tasks

## Decisions

- **Herkunft:** Intensiv-Audit der Reinraum-Engine gegen die BSData-Doku im
  Repo (2026-07-28), Fund mit ausgeführtem Repro gegen die echte Fassade.
  Ketten sind in den Fixture-Daten selten — Priorität entsprechend.

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
