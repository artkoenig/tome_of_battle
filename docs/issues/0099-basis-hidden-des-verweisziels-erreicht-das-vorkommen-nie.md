---
status: active
branch: claude/new-session-jnwa1m-0099
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

- 2026-07-28 test-author:
  `src/evaluator/effectiveState.baseHiddenInheritance.test.js`, 11 tests —
  2 RED (base-hidden inheritance direct + transitive), 9 green as explicit
  PIN/KONTROLLE (each with a comment naming the fix mistake it guards
  against, e.g. explicit `hidden="false"` on the link must keep beating the
  target's true). Observable: `capability.isHidden` on the occupied slot via
  the facade, same point as `report.test.js`. Open edges left unpinned
  (undecided by criteria): link-modifier vs target-modifier precedence with
  opposite values; base `hidden` of an intermediate link in a chain.
- 2026-07-28 implementer: dual-carrier seam — `readEntryBase` emits
  `hiddenAttribute` (`true|false|undefined`) beside the unchanged boolean
  `isHidden` (consumers verified: `datasetDescription.js:89`, exact-shape
  pins in `infoElements.test.js`, architecture-doc `InfoElement` record);
  `baseHiddenOf` reads the tri-state, existing `?? ` chain reaches the
  target. Transitive case free via `followEntryLink` flattening; the
  intermediate-link edge stays behaviour-free as recorded. Surprise per
  rulebook: first sentinel choice `null` broke 3 exact-shape `toEqual` pins
  (`toEqual` ignores undefined props, not null) — switched to `undefined`,
  no test touched. 11/11 target green; suite 211 files / 2154 tests exit 0;
  puppeteer E2E exit 0; lint/typecheck exit 0.

## Checkpoints

### Before implementation

- Does this match what was asked? Yes — preserve the XML distinction
  "attribute not set" vs. "false set" through the reader so the existing
  inheritance rule in `effectiveState.js` (own before inherited) can
  actually fire; the intent names the dead fallback (`baseHiddenOf`) and
  the cause (reader materializes `isHidden` with default false).
- What surprised me? The fix direction is already designed in the code —
  the fallback chain exists, only the reader starves it. That makes this a
  reader-contract change, not an inheritance-logic change.
- What am I assuming without having verified it? That changing the reader
  to emit `undefined` for an absent `hidden` attribute does not break
  consumers that read `isHidden` as a strict boolean elsewhere (the
  test-author and implementer must check all readers of `isHidden`), and
  that transitive chains (link → link → target) resolve through the
  existing `resolved` pointers.

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
