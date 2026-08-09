---
status: done
branch: claude/evaluator-engine-completion-s5blv9
pr:
---

# `conditionGroup type="not"` ist unlesbar und sperrt reale Modifikatoren

## Intent

Der Katalog-Leser kennt nur die Gruppen-Typen `and` und `or`
(`ConditionGroupKind`, `src/parser/schema/battlescribeSchema.generated.js:64–67`).
Das eingefrorene Vampire-Counts-Fixture enthält aber 2×
`<conditionGroup type="not">`
(`src/evaluator/__fixtures__/whfb6-definitive/Vampire Counts (6th definitive
edition).cat:10779` und `:12380`) — beide am `set`-Modifikator, der die
Min-Grenze `8461-3eab-e5ac-1636` für „Army of the Lichemaster" auf 1 hebt
(Pflichteinheit im Sonderheer).

Seit Issue 0087 werten Modifikatoren mit unlesbarem Wächter fail-closed:
der Modifikator feuert nie, die Pflicht bleibt bei 0. Das erzeugt keine
falschen Verstöße (nur erlaubend), unterschreitet aber die im Katalog
kodierte Regel — und kein E2E-Szenario beobachtet den Fall (Fund des
Reviews in Issue 0087, 2026-07-29).

Zu klären: die Semantik von `type="not"` (Negation — welche Verknüpfung
der Mitglieder?) aus Referenzprogramm/Wiki/Daten belegen, den Leser um den
Typ erweitern und den Lichemaster-Fall als Test festhalten.

Acceptance criteria:

1. Die Semantik von `conditionGroup type="not"` ist aus Quelle oder Daten
   belegt und als Entscheidung festgehalten.
2. Der Leser liest `type="not"`-Gruppen; die beiden Fixture-Vorkommen
   erzeugen keine `unsupportedConditionGroup`-Diagnose mehr und der
   Lichemaster-Modifikator feuert gemäß der belegten Semantik.
3. Die bestehende Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt.

## Plan

## Tasks

## Decisions

- **Herkunft:** Review-Beobachtung außerhalb der Kriterien im Run von
  Issue 0087 (2026-07-29).

## Log

- **2026-07-31 — umgesetzt.** Semantik entschieden und belegt: eine
  `not`-Gruppe hält, wenn **keines** ihrer Mitglieder hält — die exakte
  De-Morgan-Duale zu `or` und damit die strengere der beiden denkbaren
  Lesarten (`NOT(OR(…))` gegen `NOT(AND(…))`), passend zur fail-closed-
  Richtung der Engine. Auf den realen Daten ist die Wahl nicht beobachtbar:
  beide Fundstellen tragen genau ein Mitglied, wo jede Lesart dieselbe
  schlichte Negation ergibt. Festgehalten in
  `docs/battlescribe-data-format.md` §7.7 (eigener Kasten) und §15
  (Lückentabelle).
- Die vendorte `Catalogue.xsd` kennt den Wert jetzt (ADR 0016, Revision
  2026-07-31); die SSOT `battlescribeSchema.generated.js` ist neu erzeugt.
  Die Auswertung liegt als Registry `CONDITION_GROUP_COMBINATORS`
  (`modifiers.js`) vor statt als Fallunterscheidung — der zweiseitige
  SSOT-Deckungstest (`enumHandlerCoverage.test.js`) hält sie vollständig.
- Wirkung an echten Daten: die beiden Pflichteinheiten des Sonderheeres
  „Army of the Lichemaster" (Heinrich Kemmler `8461-3eab-e5ac-1636`, Krell
  `60a8-5b49-6b81-7c84`) werden jetzt gefordert; vorher blieb die Pflicht
  fail-closed bei 0 und keine `unsupportedConditionGroup`-Diagnose mehr.
- Tests: `groups.test.js` (vier Fälle inkl. der realen Form
  „not(and(...))"), E2E-Szenario `condition-group-not`. Lauf:
  `npx vitest run src/evaluator` — grün.

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
