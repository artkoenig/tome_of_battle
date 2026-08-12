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

- 2026-08-12 (re-check, independent probe) — **Reproduces, both criteria, with a
  control in the same run.** Synthetic catalogue `link-outer -> link-inner ->
  shared-final`, facade only. The roster occurrence must name the LINK as its
  definition (`defId: 'link-outer'`); naming the target id counts directly and
  measures nothing.
  - Criterion 1: probe entry with `max 0` lifted to 5 by a modifier gated on
    `atLeast 1 selections scope="roster" childId="shared-final"`. Occurrence as
    `shared-final` -> effectiveMax 5, as `link-inner` (one hop) -> 5, as
    `link-outer` (two hops) -> **0**. No diagnostic in any of the three.
  - Criterion 2: `min 1` + `max 1` at the link, target standing twice as the
    plain entry. At the one-hop link (control): `chain-max` fires, actual 2
    bound 1. At the chain link: `chain-max` **silent**, and `chain-min` fires
    with **actual 0** although the target stands twice — the chain link counts
    nothing at all under its resolved target.

- 2026-08-12 — Reproduced on the current tree, both criteria, through the
  facade (`evaluate(prepareDataset({catalogues:[xml]}), roster)`) on a synthetic
  catalogue `link-outer -> link-inner -> shared-final`.
  - Criterion 1: a probe entry carries `max 0` lifted to 5 by a modifier gated
    on `atLeast 1 selections scope="force" childId="shared-final"`. Choosing the
    child directly gives effectiveMax 5, choosing it through `link-inner` (one
    hop) gives 5, choosing it through `link-outer` (two hops) gives **0** — the
    gate does not see the chain, and no diagnostic is raised.
  - Criterion 2: a `max 1 scope="roster"` at `link-outer` against two
    occurrences of the resolved target (one direct, one through `link-inner`)
    reports **no** violation at all.
  Cause unchanged since the file was written: `targetsOf`
  (`src/evaluator/countIndex.js:159-170`) pushes `node.def.targetId` — the one
  hop — and `resolved.type`, but never `resolved.id` nor the intermediate link
  ids. `offer.js:97` and `resolver.js:215` do add `resolved.id`, so the counting
  layer is the only one that stops at one hop.

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
