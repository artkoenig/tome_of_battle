---
status: backlog
branch:
pr:
---

# Huckepack-MAX am Pflicht-Phantom eines Wurzel-Links — Semantik offen

## Intent

Seit Issue 0085 bekommt ein Wurzel-`entryLink` mit eigener `min`-Grenze ein
Pflicht-Phantom (§9.9, `ownLimitsOnly`). Wie bei Entry-Phantomen dokumentiert
und gewollt, wertet ein ungefiltertes Phantom die MAX-Grenzen seines Rahmens
huckepack mit aus. Für die Link-Form ist das ein **neuer Meldeweg**
(Review-Repro E9, Runde 3 des 0085-Laufs): ein Wurzel-Link mit eigenem
`min=1` **und** `max=2` (`scope="roster"`), dessen Ziel dreimal über den
planen Eintrag (nie über den Link) im Roster steht, meldet auf dem
0085-Stand einen MAX-Verstoß (3 > 2), auf dem Stand davor keinen. Das
Phantom hängt wegen des `min` und zählt den `max` über die Ziel-Id.

Konsistent mit dem Huckepack-Verhalten der Entry-Phantome und der Zählregel
(`constraints.js`, Zählung über die aufgelöste Ziel-Id) — aber ob das
Referenzprogramm die Grenzen eines nicht gewählten Links überhaupt auswertet,
ist unbelegt. In den eingefrorenen Fixture-Katalogen tritt das Muster nicht
auf (latent).

Acceptance criteria:

1. Es ist entschieden und belegt (Referenzverhalten oder Datenlage), ob die
   MAX-Grenze eines nicht gewählten Wurzel-Links gegen die Ziel-Zählung
   ausgewertet werden soll.
2. Je nach Entscheidung: Verhalten festgeschrieben (Test) oder das Phantom
   auf MIN-Grenzen zugeschnitten; die Begründung steht am Code.
3. Die bestehende Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt.

## Plan

## Tasks

## Decisions

## Log

- 2026-08-12 (re-check, independent probe) — **Reproduces unchanged.** Root
  `entryLink` with its own `min 1` and `max 2` (`scope="roster"`, shared,
  `includeChildSelections="true"`), target standing three times as the plain
  entry and never through the link: the report carries `link-max` as an **error,
  actual 3, bound 2**, while `link-min` stays silent. The MAX of a link nobody
  chose fires over the resolved target id; the open question of this file is
  untouched.

- 2026-08-12 — Reproduced on the current tree, exactly as review repro E9
  describes it. Synthetic catalogue: a root `entryLink` carrying its own
  `min 1` **and** `max 2` (both `scope="roster"`, shared,
  `includeChildSelections="true"`) on a target that stands three times in the
  roster, every time through the plain entry and never through the link. The
  report carries `link-max error actual=3 bound=2` — the MAX of a link nobody
  chose fires, counted over the resolved target id — while `link-min` correctly
  stays silent (3 >= 1). `ownLimitsOnly` (`src/evaluator/evalTree.js:243, 316`)
  narrows the phantom to the limits declared **at the link**, but not to its MIN
  limits, so the question of the file stands unchanged: should the limits of an
  unchosen link be evaluated at all?

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
