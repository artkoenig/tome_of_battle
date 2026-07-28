---
status: backlog
branch:
pr:
---

# Basis-`hidden` des Verweisziels erreicht das Vorkommen nie

## Intent

Ein shared Entry mit `hidden="true"`, das per `entryLink` ohne eigenes
`hidden`-Attribut eingebunden wird, gilt am Vorkommen als sichtbar. Der
Fallback existiert im Code, ist aber toter Code: `baseHiddenOf`
(`src/evaluator/effectiveState.js:79`, `own?.isHidden ?? target?.isHidden ??
false`) erreicht den `target`-Zweig nie, weil der Leser `isHidden` an jedem
Element als konkreten Boolean materialisiert (`readEntryBase`,
`src/evaluator/catalogReader.js:508`, Default `false`).

Ein `hidden`-**Modifier** am Ziel propagiert dagegen korrekt (die
Ziel-Modifikatoren laufen mit dem Knoten als Träger). Nur das statische
Basis-Attribut geht verloren. Repro (Audit 2026-07-28): shared Entry
`hidden="true"`, Link ohne `hidden` → Capability meldet `isHidden: false`.

Die gewollte Semantik (Link-Attribut überschreibt Ziel, sonst erbt das
Vorkommen das Ziel-`hidden`) ist die im Code angelegte Erb-Regel „eigene
Angaben gehen vor den geerbten" (`effectiveState.js:63`); XML kann „Attribut
nicht gesetzt" von „false gesetzt" unterscheiden — der Leser wirft diese
Unterscheidung derzeit weg.

Acceptance criteria:

1. Ein Vorkommen über einen `entryLink` **ohne** eigenes `hidden`-Attribut
   übernimmt das Basis-`hidden` seines (transitiv aufgelösten) Ziels: das
   Repro meldet `isHidden: true`.
2. Ein am Link explizit gesetztes `hidden` (true **oder** false) geht dem
   Ziel vor.
3. `hidden`-Modifikatoren behalten ihren Vorrang vor beiden Basiswerten.
4. Die bestehende Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt.

## Plan

## Tasks

## Decisions

- **Herkunft:** Intensiv-Audit der Reinraum-Engine gegen die BSData-Doku im
  Repo (2026-07-28), Fund mit ausgeführtem Repro gegen die echte Fassade.

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
