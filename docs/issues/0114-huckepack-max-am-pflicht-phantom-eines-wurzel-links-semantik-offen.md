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
