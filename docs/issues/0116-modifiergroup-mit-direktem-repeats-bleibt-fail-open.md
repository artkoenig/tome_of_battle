---
status: backlog
branch:
pr:
---

# `modifierGroup` mit direktem `<repeats>` bleibt fail-open

## Intent

Eine `<modifierGroup>` mit direktem `<repeats>`-Kind wird vom Leser nicht
unterstützt: `readModifierGroup` meldet nur
`unsupportedModifierGroupRepeat` und wendet die Mitglieds-Modifikatoren
**einmal unbedingt** an — dieselbe „feuert anders als kodiert"-Form, die
Issue 0087 für die Wächter einzelner Modifikatoren geschlossen hat. Die
Kriterien von 0087 nannten nur Conditions/Condition-Gruppen/Repeats eines
Modifikators; die Gruppen-Repeats blieben bewusst außen vor
(Review-Beobachtung im Run von 0087, 2026-07-29).

Realer Fall: „Grave markers" (Vampire Counts, 1 Vorkommen im Fixture).

Zu entscheiden: Gruppen-Repeats fachlich unterstützen (Wiederholung der
Mitglieder je Zählung) oder — bis dahin — die Gruppe fail-closed sperren
(`hasUnreadableGuard`-Muster aus 0087), statt einmal unbedingt anzuwenden.

Acceptance criteria:

1. Es ist entschieden und belegt, ob Gruppen-Repeats ausgewertet oder
   fail-closed gesperrt werden.
2. Eine `modifierGroup` mit `<repeats>` wendet ihre Mitglieder nicht mehr
   einmal unbedingt an; die Diagnose bleibt erhalten.
3. Die bestehende Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt.

## Plan

## Tasks

## Decisions

- **Herkunft:** Review-Beobachtung außerhalb der Kriterien im Run von
  Issue 0087 (2026-07-29).

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
