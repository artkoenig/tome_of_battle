---
status: done
branch: claude/new-session-jnwa1m-0099
pr: https://github.com/artkoenig/tome_of_battle/pull/156
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

- **Accepted default (review round 1, finding 1a):** the inheritance runs
  through the shared `baseHiddenOf`, so `infoLink` and `categoryLink`
  occurrences now also inherit their target's base hidden. Unasked-for but
  consistent with the declared rule (own before inherited); the reviewer
  could not construct a wrong result. Accepted rather than special-cased —
  surfaced to the human in the PR; if unwanted, a follow-up issue can
  narrow it.

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
- 2026-07-28 review round 1 (fresh context): all four criteria met; reds
  proven real against origin/main in a scratch worktree (2 failed / 9
  passed, exactly the criterion-1 pair); test file untouched since
  authoring; perf measurement exit 0 (6.3 ms). 1 low finding, split:
  (1a) silent widening to infoLink/categoryLink — triaged as accepted
  default (see Decisions); (1b) §4.1 record omits the load-bearing
  `hiddenAttribute` — fixed: the EntryBase comment and the record now name
  the tri-state and why it exists.
- 2026-07-28 review round 2 (fresh context, whole intent): criteria all met;
  doc addition verified true against all 11 `readEntryBase` call sites;
  reds re-proven on origin/main; full `npm test` (unit + puppeteer E2E)
  exit 0. 1 low finding outside the intent: `hidden="0"` (xs:boolean short
  form) reads as "not set" and now inherits instead of overriding —
  pre-existing `readBoolean` limitation, already filed as issue 0102
  point 6; dismissed here with that reference, consequence recorded in
  0102. No in-scope fix applied → no repeat round (tracker-only waiver).

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

- Does this match what was asked? Yes — inheritance works (incl. transitive),
  link attribute and modifiers keep precedence, suite green by exit code;
  two fresh-context rounds, both reds proven real against origin/main.
- What surprised me? The `toEqual`-ignores-undefined-but-not-null asymmetry
  that forced the sentinel choice, and that criterion 2 has a lexical blind
  spot (`hidden="0"`) inherited from `readBoolean` — pre-existing, now with
  a new consequence, dismissed here with reference to issue 0102 point 6
  (where it was already filed; the sharpened consequence is recorded there).
- What am I assuming without having verified it? That no real catalog uses
  `0`/`1` boolean forms (BattleScribe writes true/false; repo fixtures
  grep-clean) — the 0102 run will close that hole for imported community
  catalogs. Widening to infoLink/categoryLink stays an accepted default
  (see Decisions). No version bump: evaluator not wired to the UI.

## Nachtrag (2026-07-31, Issue 0135)

Kriterium 2 ist in seiner **„false"-Haelfte zurueckgenommen**: ein explizites
`hidden="false"` am Verweis geht dem `hidden="true"` des Ziels **nicht** mehr vor.
Grund: Battlescribe schreibt das Attribut an *jedem* `entryLink` (0 von 2302 in den
DE-Fixtures lassen es weg), sodass die hier gebaute Vererbung an echten Katalogen nie
greifen konnte — und die Vorrangregel das gaengigste Gatter-Muster der Kataloge
(geteilte Definition `hidden="true"` + bedingter Aufdeck-Modifikator, 22 von 27
Faellen) ins Gegenteil verkehrte: die gegatterten Inhalte waren immer sichtbar. Die
„true"-Haelfte (`hidden="true"` am Verweis versteckt unabhaengig vom Ziel) und
Kriterium 3 (Modifikatoren schlagen die Basiswerte) gelten unveraendert. Details und
Beleg: [Issue 0135](0135-fremde-magische-gegenstaende-erscheinen-am-vampir.md).

## Retro

- The dual-carrier seam (tri-state beside the boolean) was the right call:
  zero consumer churn, and the naive-OR trap the test-author explicitly
  guarded against never had a chance.
- The reviewer surfacing the `hidden="0"` lexical edge shows the value of
  fresh-context rounds even on a green diff — and the dismiss-with-reference
  triage kept this run from bleeding into 0102's territory.
- Sentinel lesson recorded for future readers: `toEqual` ignores
  undefined-valued properties but not null — `undefined` is the safe
  "absent" sentinel where exact-shape pins exist.
