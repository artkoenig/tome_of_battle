---
status: backlog
branch:
pr:
---

# Evaluator-E2E-Fälle reißen unter Last die 5-Sekunden-Grenze

## Intent

`vitest.config.js` setzt kein `testTimeout`, es gilt also die Vorgabe von
5000 ms. Mehrere Fälle des manifest-getriebenen Evaluator-E2E-Runners
(`src/evaluator/e2e.testcatalog.test.js`) liegen im ruhigen Lauf bei
2552 ms, 2933 ms und 3035 ms — mehr als die Hälfte der Grenze. Läuft
irgendetwas parallel, das CPU zieht, kippt ein solcher Fall über 5000 ms
und die ganze Suite wird rot, ohne dass sich an der Sache etwas geändert
hat.

Beobachtet am 2026-07-31 (Arbeit an Issue 0135): `npm test` schlug in
`numeric-conditions / equal-to-true.ros` fehl, während ein zweiter
vitest-Lauf lief; isoliert und im ruhigen Wiederholungslauf grün.

Das Ärgerliche daran ist nicht die Laufzeit, sondern die Aussage: ein
Exitcode, der von der Nebenlast abhängt, ist als Fakt wertlos — und genau
darauf stützt sich die Freigabe jeder Änderung.

Acceptance criteria:

1. Ein voller `npm test`-Lauf liefert denselben Exitcode, ob nebenher ein
   zweiter vitest-Lauf CPU zieht oder nicht.
2. Kein Fall des Evaluator-E2E-Runners liegt im ruhigen Lauf über der
   Hälfte seiner geltenden Zeitgrenze — entweder weil die Grenze für diese
   Datei angehoben ist, oder weil der Fall schneller geworden ist.
3. Die geltende Grenze steht geschrieben, statt sich aus der
   vitest-Vorgabe zu ergeben.

## Plan

## Tasks

## Decisions

## Log

- 2026-07-31: Von der Prüfung zu Issue 0135 gefunden, samt Messwerten aus
  einem ruhigen Lauf. Betrifft keine Datei jenes Diffs und wandert deshalb
  hierher.

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
