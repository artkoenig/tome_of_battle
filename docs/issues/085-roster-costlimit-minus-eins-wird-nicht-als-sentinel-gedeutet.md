---
status: backlog
branch:
pr:
---

# Roster-costLimit -1 wird nicht als Sentinel gedeutet

## Intent

Issue 079 hat den Battlescribe-Sentinel `-1` („unbegrenzt") für
*Katalogdaten* an genau eine benannte Quelle gebunden
(`src/evaluator/model.js`, `unlimitedFromSentinel`). Die *Roster*-Seite
blieb außen vor: ein im `.ros` hingeschriebenes `costLimit value="-1"`
läuft in `src/evaluator/budget.js` (~Z. 97–99, via `rosterBudget.js`)
ungedeutet als Zahl durch. BattleScribe-Exporte schreiben `-1.0` für
„kein Limit" — die Engine ergäbe daraus eine Budget-Verletzung
„Summe > -1" statt „kein Limit". Gefunden von der Review-Runde 2 zu
Issue 079; vorbestehend, von deren Diff unberührt.

Acceptance criteria:

1. Aus dem Format-Dokument und echten `.ros`-Daten ist belegt, dass
   `costLimit value="-1"` im Roster „kein Limit" bedeutet.
2. Ein Roster mit `costLimit value="-1"` erzeugt keine Budget-Verletzung,
   unabhängig von der Punktsumme.
3. Die Deutung läuft über die eine benannte Sentinel-Quelle aus Issue 079;
   kein neues `-1`-Literal in der auswertenden Schicht.
4. Ein Test pinnt das Verhalten (Unit oder Szenario, je nach Datenlage).

## Plan

## Tasks

## Decisions

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
