---
status: backlog
branch:
pr:
---

# `set` mit `<repeat>` ist idempotent — die Doku-Lesart impliziert Wachstum

## Intent

Das kanonische `.gst`-Beispiel in `docs/battlescribe-data-format.md` §7.7
(Core-Slots der Force „Standard") kombiniert `modifier type="set" value="6"`
mit einem `<repeat>` je 1000 Punkte; die dokumentierte Lesart: „ab 5000
Punkten setze sie auf 6 **und erhöhe je weitere 1000 Punkte**."

Die Engine wendet `set` idempotent an: `setValue` ignoriert den
Wiederholungsfaktor (`src/evaluator/modifiers.js:339`), das effektive Max
bleibt bei jedem Budget ≥ 5000 exakt 6. Repro (Audit 2026-07-28): Basis
`max=1`, `set 6` mit Repeat je 1000 `limit::pts`, Budget 7000 →
`effectiveMax` 6 statt (laut Lesart) ≈ 8.

Was das BattleScribe-Referenzprogramm bei einem wiederholenden `set`
tatsächlich tut, ist in keiner Quelle im Repo autoritativ belegt — die Doku
ist aber als kanonische Referenz deklariert, und Code und Doku widersprechen
sich. Zu klären und anzugleichen; die Klärung gehört als Entscheidung ins
Issue, die unterlegene Seite (Code oder Doku-Lesart) wird korrigiert.

Acceptance criteria:

1. Die Semantik von `set` + `<repeat>` ist geklärt (Referenzprogramm bzw.
   Referenz-Tools gegen die realen `.gst`-Daten) und als Entscheidung mit
   Quelle festgehalten.
2. Engine und `docs/battlescribe-data-format.md` §7.7 sagen danach dasselbe;
   die geltende Semantik ist durch einen Test am kanonischen
   `.gst`-Beispiel (Budget ≥ 5000) gepinnt.
3. Die bestehende Suite bleibt grün — mit Kommando, Umfang und Exit-Code
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
