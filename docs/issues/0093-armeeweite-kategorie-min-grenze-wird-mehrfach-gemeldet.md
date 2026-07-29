---
status: active
branch: claude/new-session-jnwa1m-0093
pr:
---

# Armeeweite Kategorie-Min-Grenze wird mehrfach gemeldet

## Intent

Eine `categoryEntry` mit `min`-Grenze (`scope="roster"`) wird doppelt
verankert: als roster-weites Pflicht-Phantom
(`synthesizeMandatoryPhantoms`, `src/evaluator/evalTree.js:259` — für eine
Kategorie-Definition ist `countInstances` immer 0) **und** an jedem
Kategorie-Anker jeder Force, deren `categoryLink` die Grenzen der Kategorie
erbt (`resolver.js:641`, Vererbung per `link.resolved`). Die
Constraint-Schicht wertet alle Grenzen an allen Ankern aus, ohne Entdopplung.

Folge: eine unerfüllte armeeweite Kategorie-Pflicht („genau ein General",
§5.5) erscheint 1 + n-mal in der Meldungsliste (Wurzel-Phantom plus je
Force). `docs/battlescribe-data-format.md` §9.9 verlangt für dieselbe Pflicht
in mehreren Formen ausdrücklich Entdopplung über die Ziel-Id („genau ein
Verstoß"); das Urteil selbst ist korrekt, die Mehrfachmeldung ein
Berichtsfehler.

Acceptance criteria:

1. Eine unerfüllte armeeweite Kategorie-Grenze erzeugt genau **eine**
   Verletzung, unabhängig davon, wie viele Forces die Kategorie verlinken.
2. Force-weite Kategorie-Grenzen (echtes `scope="force"`-Zählen je
   Kontingent) bleiben je Kontingent gemeldet — keine Über-Entdopplung.
3. Der Fähigkeitsdatensatz jedes Kategorie-Slots bleibt vollständig (die
   Entdopplung betrifft nur die Meldungsliste).
4. Die bestehende Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt.

## Plan

## Tasks

## Decisions

- **Herkunft:** Intensiv-Audit der Reinraum-Engine gegen die BSData-Doku im
  Repo (2026-07-28); Mechanismus am Code verifiziert, Auftreten hängt davon
  ab, ob Forces die betroffene Kategorie verlinken.

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
