---
status: backlog
branch:
pr:
---

# Träger-Eigenkosten in entfernten Rahmen: §9.4-Satz überverspricht, Semantik offen

## Intent

Restbefund aus den Review-Runden 2/3 von Issue 0091 (2026-07-29). Der von 0091
ergänzte §9.4-Satz in `docs/battlescribe-data-format.md` — „Ein Träger mit
eigenen Kosten bringt diese in seine Summe ein (Issue 091)." — gilt nicht
unbedingt: Steckt der Träger einer Kostenart-Grenze selbst unter einer anderen
Auswahl und liegt der Bezugsrahmen darüber (z. B. `scope="roster"`), liest
`includeChildSelections="false"` **0** statt der eigenen Trägerkosten — der
eigene Beitrag des Trägers sitzt dort im SELECTION-Eimer (vorbestehende
Eimer-Semantik, von 0091 nicht verändert; Repro der Runde 2:
Force → Unit → Held 50 pts mit `max 100 field=<pts> scope="roster"`,
Item 60 pts → `false`: Ist 0, `true`: Ist 110).
`docs/evaluator-architecture.md` §4.4 beschreibt den Ist-Zustand seit 0091
präzise; §9.4 nicht.

Zweite offene Frage aus Runde 2 (verwandt, gleiche Schicht): zählen mehrere
verschachtelte Vorfahren mit **gemeinsamer** Ziel-Id (gleiche Kategorie,
gleicher roher `type`, gleiche Gruppe) den Beitrag eines Nachfahren einmal je
Rahmen (heutiges Set-Dedup) oder einmal je passendem Vorfahren
(„Summe der aufgerollten Kosten je Treffer")? Beides ist undokumentiert; in
den eingefrorenen Fixture-Katalogen folgenlos (alle realen Kostenart-Grenzen
sind `scope="parent"`).

Zu entscheiden (BSData-Doku hat laut Weisung des Menschen höchste Priorität;
falls sie schweigt, entscheidet der Mensch): Soll `false` in entfernten Rahmen
die Eigenkosten des Trägers lesen (dann Engine-Anpassung), oder ist das
heutige Verhalten gewollt (dann §9.4 um den Nebensatz präzisieren)?

Acceptance criteria:

1. Die Semantik „Eigenkosten des Trägers unter seiner Id in entfernten Rahmen
   bei `includeChildSelections="false"`" ist entschieden und mit Quelle
   (BSData bzw. Entscheid des Menschen) festgehalten.
2. Engine und §9.4 sagen danach dasselbe; die geltende Lesart ist durch einen
   Testfall am Repro der Runde 2 gepinnt (Träger verschachtelt, Rahmen
   darüber, beide Flagstellungen).
3. Die Dedup-Frage (gemeinsame Ziel-Id mehrerer Vorfahren) ist entschieden
   oder ausdrücklich als bewusster Schnitt dokumentiert.
4. Die bestehende Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt.

## Plan

## Tasks

## Decisions

- **Herkunft:** Befund der Review-Runden 2/3 von Issue 0091 (2026-07-29);
  dort außerhalb der Absicht (Regel: geht an den Menschen bzw. ins Backlog),
  deshalb nicht mitbehoben. Repro-Skript der Runde 2:
  `repro-nested-carrier.mjs` (Scratchpad der Session; Aufbau im Intent
  wiedergegeben).

## Log

- 2026-08-12 — Re-measured; **the premise of criterion 1 no longer holds, the
  rest of the issue does.** The round-2 repro rebuilt verbatim (Force -> Unit ->
  Hero 50 pts carrying `max 100 field="pts" scope="roster"`, Hero holds an Item
  of 60 pts) now reads **actual 110 in both flag positions**, not 0 for
  `includeChildSelections="false"`. The reason is `countingFlagsOf`
  (`src/evaluator/constraints.js:91-98`): for a shared, entry-anchored limit at
  `roster` or `force` scope the flag is forced to `true`, so the carrier's own
  costs are in the sum and the §9.4 sentence is true as written. That part of
  the file is stale and needs no work.
  What is left is criterion 3, and it is untouched: two nested ancestors sharing
  one target id (both carrying category `cat-any`, a `max 10 field="pts"
  scope="cat-any"` at the outer one, a 30 pts leaf below the inner one) read
  **actual 30** — today's set-dedup, one contribution per frame. The alternative
  reading (once per matching ancestor, 60) is neither chosen nor ruled out
  anywhere in the documentation, and no test pins the 30.

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
