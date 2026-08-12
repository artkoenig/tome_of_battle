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

- 2026-08-12 (re-check, independent measurement) — **Reproduces; criterion 1 is
  demonstrably broken on this machine (4 cores).** Same file, same command,
  `npx vitest run src/evaluator/e2e.testcatalog.test.js`:
  - quiet: **538 passed**, exit code **0**, 1 test file passed;
  - with 16 CPU burners running: **6 failed | 532 passed**, exit code non-zero
    (plus an unhandled `Timeout calling "onTaskUpdate"` from the worker RPC),
    duration 112 s.
  Criterion 3 is unmet too: `vitest.config.js` still sets no `testTimeout`, so
  the limit is vitest's implicit 5000 ms and stands written nowhere. Side note
  from the same session: a throwaway probe of mine over the fixture catalogues
  ran into exactly that implicit limit.

- 2026-08-12 — Reproduced on the current tree, on 4 cores with 16 CPU burners.
  `npx vitest run src/evaluator/e2e.testcatalog.test.js` → **4 failed | 534
  passed**, every failure `Test timed out in 5000ms`, in
  `ancestor-scope-instance-of/01`, `modifier-effective-name/01`,
  `numeric-conditions/equal-to-true.ros` (the case named in this file) and
  `primary-catalogue-scope/01`. Unloaded, the same file is green and those are
  the four slowest cases: 2031, 1928, 1569 and 1429 ms.
  Criterion 2 is met on this machine — 2031 of 5000 ms is under half — but
  criterion 3 is not: `vitest.config.js` still sets no `testTimeout`, so the
  limit these cases are judged against is vitest's implicit default and nothing
  in the repository states it.

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
