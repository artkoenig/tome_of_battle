---
status: backlog
branch:
pr:
---

# Pflichteinheit als Wurzel-`entryLink` erzeugt keinen Verstoß

## Intent

`docs/battlescribe-data-format.md` §9.9 beschreibt zwei gleichwertige
Kodierungen der armeeweiten Pflichteinheit: der `min`-Constraint hängt an einem
Wurzel-`selectionEntry` **oder** an einem Wurzel-`entryLink` (Basis `min="0"`,
per Link-Modifier angehoben — so codiert die „Definitive Edition" die
Ogerbullen-Pflicht). Die Auswertung soll beide Wurzelformen einsammeln; fehlt
die Zieleinheit ganz, entsteht ein blockierender Verstoß.

Die Engine sammelt nur die `selectionEntry`-Form ein:
`PHANTOM_DEFINITION_KINDS` (`src/evaluator/resolver.js:73`) enthält kein
`ENTRY_LINK`, und `collectRootDefinitions` (`resolver.js:125`) bricht bei einem
Wurzel-Link sofort ab — samt seiner Kinder. Ein Wurzel-`entryLink` mit
`min ≥ 1` (`scope="roster"` oder `"force"`) bekommt deshalb kein
Pflicht-Phantom; sein Angebots-Anker ist per ADR-0035 nie berichtsfähig.
Ergebnis: eine Liste ohne die Pflichteinheit meldet **null** Verstöße.

Repro (Audit 2026-07-28, Skript im Scratchpad des Audits): Katalog mit
Wurzel-`entryLink` auf ein shared Entry, `min=1 scope="roster"`, leeres Roster
→ 0 Verstöße; identischer Constraint an einem Wurzel-`selectionEntry` → 1
Verstoß (Kontrolle).

Acceptance criteria:

1. Ein Wurzel-`entryLink` mit effektivem `min > 0` (`scope="roster"` oder
   `"force"`), dessen Zieleinheit im jeweiligen Rahmen fehlt, erzeugt einen
   blockierenden Verstoß (Ist 0 gegen die Grenze).
2. Ausgewertet werden dabei die Grenzen **und Modifier des Links**, nicht die
   des Ziels (§9.9): die bedingte Anhebung von Basis `min=0` auf 1 greift, und
   ohne erfüllte Bedingung entsteht kein Verstoß.
3. Führt ein Katalog dieselbe Pflicht in beiden Wurzelformen, wird über die
   Ziel-Id entdoppelt: genau ein Verstoß (§9.9).
4. Die bestehende Suite bleibt grün — mit Kommando, Umfang und Exit-Code
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
