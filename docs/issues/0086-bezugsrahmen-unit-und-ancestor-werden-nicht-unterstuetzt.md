---
status: backlog
branch:
pr:
---

# Bezugsrahmen `unit` und `ancestor` werden nicht unterstützt

## Intent

Das BSData-Wiki (*Data structure overview*, Abschnitt *Condition*) zählt
`ancestor` als Scope auf; reale Kataloge nutzen zusätzlich `unit`. In den
Fixture-Katalogen der Definitive Edition
(`src/evaluator/__fixtures__/whfb6-definitive/`): `scope="unit"` **130×**,
`scope="ancestor"` **10×**. Die Engine kennt beide nicht: `ScopeKeyword`
(`src/evaluator/model.js:109`) umfasst nur `roster/force/parent/self`; alles
andere fällt in den ID-Zweig von `resolveSharedFrame` (`src/evaluator/query.js:74`),
löst nicht auf und liefert `UNRESOLVED_SCOPE` + Zählwert 0.

Folge: Modifikatoren mit diesen Scopes feuern nie bzw. falsch. Belegtes
Beispiel (Repro aus dem Audit 2026-07-28): das Mercenaries-Idiom „Kostenaufschlag
je Modell" (`<repeat field="selections" scope="unit" childId="model"/>`) zählt
0 — alle so kodierten Pro-Modell-Kostenskalierungen rechnen stumm falsche
Kosten. Bei `lessThan`-/`notInstanceOf`-Conditions wirkt der Zählwert 0 zudem
fail-open.

Nur `primary-catalogue` (27×) ist bereits als Issue 077 erfasst; `unit` und
`ancestor` sind nirgends verzeichnet. Die Semantik laut Referenzprogramm:
`unit` = die umschließende Einheit (der nächste Vorfahre — den Knoten selbst
eingeschlossen — mit `type="unit"`); `ancestor` = die gesamte Vorfahrenkette
(laut Wiki nur mit `instanceOf`/`notInstanceOf` gültig).

Acceptance criteria:

1. Eine Query mit `scope="unit"` löst auf die umschließende Einheit auf: ein
   `repeat`/eine `condition` mit `scope="unit" childId="model"` an einer
   Option innerhalb einer Einheit zählt die Modelle dieser Einheit; der
   Mercenaries-Pro-Modell-Aufschlag rechnet die erwarteten Kosten.
2. Eine `instanceOf`-/`notInstanceOf`-Condition mit `scope="ancestor"` hält
   genau dann, wenn ein Vorfahre (bzw. keiner) auf das benannte Ziel auflöst.
3. Über den Fixture-Datensätzen entsteht für `scope="unit"` und
   `scope="ancestor"` keine `UNRESOLVED_SCOPE`-Diagnose mehr.
4. Ein weiterhin unbekanntes Scope-Schlüsselwort bleibt diagnostiziert (kein
   stilles Raten).
5. Die bestehende Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt.

## Plan

## Tasks

## Decisions

- **Herkunft:** Intensiv-Audit der Reinraum-Engine gegen die BSData-Doku im
  Repo (2026-07-28), Fund mit ausgeführtem Repro und Fixture-Zählung.
- **Abgrenzung:** `scope="primary-catalogue"` bleibt bei Issue 077 und ist
  hier ausdrücklich nicht Gegenstand.

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
