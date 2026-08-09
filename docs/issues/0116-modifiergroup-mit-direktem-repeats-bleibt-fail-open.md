---
status: done
branch: claude/evaluator-engine-completion-s5blv9
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

- **2026-07-31 — umgesetzt.** Entschieden: Gruppen-Repeats werden
  **ausgewertet**, nicht gesperrt. Der Faktor der Klammer multipliziert sich
  in jedem Mitglied auf dessen eigenen Faktor (`gateWithin`/`applyModifier`,
  `modifiers.js`); die Diagnose `UNSUPPORTED_MODIFIER_GROUP_REPEAT` entfällt
  ersatzlos, weil es die Grenze nicht mehr gibt.
- **Nebenbefund, mit korrigiert:** mehrere `<repeat>` **einer** Liste
  addieren ihre Anwendungen, sie multiplizieren sie nicht. Der Entwurf
  (`docs/evaluator-architecture.md` §4.6) sagte „Produkt"; die einzige
  Mehrfach-Fundstelle aller Fixture-Kataloge widerlegt das und schreibt ihre
  Regel im Klartext daneben — „Grave markers" (Vampire Counts): „two Grave
  markers, **plus an additional Grave marker for each** Vampire Count **or**
  Vampire Lord in the army". Als Produkt gelesen fiel der Aufschlag auf 0,
  sobald eine der beiden Einheiten fehlte. Nachgemessen an echten Daten:
  0 Vampire/0 Lords → min=max=2, 1/0 → 3, 2/1 → 5 — genau der Regeltext.
- Doku nachgezogen: `docs/battlescribe-data-format.md` §7.7
  (`modifierGroup`-Abschnitt) und §15 (Lückentabelle),
  `docs/evaluator-architecture.md` §4.6.
- Tests: `groups.test.js` (Lesen ohne Diagnose, Wiederholung, Faktor 0,
  Summe statt Produkt, Verschachtelung), E2E-Szenario
  `modifier-group-repeats`. Lauf: `npx vitest run src/evaluator` — grün.

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
