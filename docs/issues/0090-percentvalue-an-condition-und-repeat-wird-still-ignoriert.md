---
status: active
branch: claude/new-session-jnwa1m-0090
pr:
---

# `percentValue` an Condition und Repeat wird still ignoriert

## Intent

Das BSData-Wiki (*Data structure overview*, Abschnitte *Condition* und
*Repeat*) dokumentiert `percentValue` für beide: „if checked, `Value` will be
interpreted as percentage". Die vendored XSD führt das Attribut an der
gemeinsamen `QueryBase` — es gilt also für Constraint, Condition **und**
Repeat.

Der Leser liest es nur an Constraints (`readConstraint`,
`src/evaluator/catalogReader.js:259`); `readCondition` und `readRepeat`
übergehen das Attribut **ohne Diagnose**. Eine Prozent-Condition wird damit
als Absolutwert verglichen: `condition type="greaterThan" value="25"
percentValue="true" field="<pts>"` („mehr als 25 % der Punkte") feuert ab 26
Punkten, unabhängig von der Armeegröße. Das widerspricht dem engine-eigenen
Grundsatz „nichts wird still verschluckt" (`docs/evaluator-architecture.md`
§4).

In den Fixture-Katalogen kommt `percentValue="true"` an Conditions/Repeats
derzeit nicht vor (grep-verifiziert) — der Fehler ist latent, aber ein
importierter Community-Katalog kann ihn jederzeit auslösen.

Acceptance criteria:

1. Eine Condition mit `percentValue="true"` vergleicht gegen den Prozentsatz
   des im Rahmen gezählten Nenners (dieselbe Nenner-Konvention wie bei
   Prozent-Grenzen, inkl. Null-Nenner-Behandlung) statt gegen den
   Absolutwert.
2. Ein Repeat mit `percentValue="true"` leitet seine Schrittzahl entsprechend
   prozentual ab.
3. Solange die Auswertung Prozent an Condition/Repeat nicht trägt, entsteht
   stattdessen eine Diagnose — nie eine stille Absolut-Deutung. (Volle
   Unterstützung erfüllt dieses Kriterium trivial.)
4. Die bestehende Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt.

## Plan

## Tasks

## Decisions

- **Herkunft:** Intensiv-Audit der Reinraum-Engine gegen die BSData-Doku im
  Repo (2026-07-28); Codepfad verifiziert, Vorkommen in Fixtures per grep
  ausgeschlossen (latent).

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
