---
status: backlog
branch:
pr:
---

# Testkatalog beschreibt zwei Szenarien nicht

## Intent

`docs/testkatalog-evaluator-e2e.md` beansprucht in seinem Kopf, **jeden**
End-to-End-Test der Reinraum-Engine „in nicht-technischer Sprache" zu
beschreiben, „damit ein fachlicher Leser jeden geprüften Fall nachvollziehen
kann — ohne den Testcode zu lesen". Seine eigene Pflege-Regel verlangt
zusätzlich Deckungsgleichheit mit dem Bestand unter `docs/testing/`.

Zwei Szenarien stehen aber nur als Tabellenzeile da, ohne den beschreibenden
`##`-Abschnitt, den alle übrigen haben:

- `violation-classification` (7 Roster)
- `author-message-tokens` (3 Roster)

Damit ist für zehn Roster-Fälle genau das nicht eingelöst, was das Dokument
verspricht: ein fachlicher Leser erfährt, *dass* sie existieren, aber nicht,
*was* sie prüfen.

Vorbestehend, nicht durch einen laufenden Lauf entstanden — auf `main` mit
`git show origin/main:docs/testkatalog-evaluator-e2e.md | grep '^## '`
nachweisbar dieselbe Lücke.

Acceptance criteria:

1. `violation-classification` und `author-message-tokens` haben je einen
   `##`-Abschnitt im Muster der übrigen Szenarien: was geprüft wird, und je
   Roster eine Zeile in nicht-technischer Sprache.
2. Die Abschnitte sind aus dem jeweiligen `scenario.json` und der
   Szenario-`README.md` abgeleitet und stimmen mit ihnen überein (Roster-Zahl,
   Datengrundlage, geprüfte Aussage).
3. Es gibt danach keine Tabellenzeile mehr ohne zugehörigen Abschnitt — geprüft
   über alle Szenarien, nicht nur über diese zwei.

## Plan

## Tasks

## Decisions

- **Herkunft:** Nebenbefund der Review-Runde 2 von Issue 077 (2026-07-29). Dort
  außerhalb der Absicht und deshalb nicht mitbehoben; derselbe Lauf hat nur das
  korrigiert, was er selbst schrieb (die Summe und das ganz fehlende Szenario
  `unlimited-modifier-toggle`).
- **Erwägenswert für diesen Lauf:** Das Dokument sagt selbst, die Pflege
  erfolge „von Hand — es gibt bewusst **keinen** Generator und **kein**
  CI-Gate". Genau deshalb driftet es. Ob ein billiger Test „jede Tabellenzeile
  hat einen Abschnitt, jedes `scenario.json` hat eine Zeile" die bewusste
  Entscheidung gegen ein Gate verletzt oder sie nur absichert, ist im Lauf zu
  entscheiden.

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
