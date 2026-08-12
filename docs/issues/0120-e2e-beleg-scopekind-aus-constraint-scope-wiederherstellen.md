---
status: backlog
branch:
pr:
---

# E2E-Beleg „scopeKind stammt aus constraint/@scope" wiederherstellen

## Intent

Bis Issue 0088 pinnte das Szenario `docs/testing/violation-classification/`
(Roster VCC-R10) per E2E, dass der `scopeKind` einer Meldung aus dem
`scope`-Attribut des Constraints stammt — belegt durch zwei Min-Grenzen mit
verschiedenen Scopes (`force` vs. `parent`) am selben Pflicht-Phantom-Anker
aus echten Katalogdaten. Der dortige Träger (Army of Sylvania) ist effektiv
versteckt; seit der Min-Unterdrückung aus Issue 0088 ist der Beleg aus
diesem Roster nicht mehr zu gewinnen (im Szenario-README vermerkt). Auf
Unit-Ebene bleibt die Aussage gepinnt (`src/evaluator/phantom.test.js`),
der E2E-Beleg aus Katalogdaten fehlt aber.

Die Wiederherstellung braucht ein Szenario mit einem **sichtbaren**
Pflicht-Phantom, das zwei Min-Grenzen mit verschiedenen Scopes trägt —
Autorenschaft laut ADR 0033 beim `e2e-testcase-author` (Black-Box, nur aus
Katalogdaten).

Acceptance criteria:

1. Unter `docs/testing/` existiert ein Szenario (neu oder erweitert), in dem
   ein sichtbarer Träger zwei Min-Grenzen mit verschiedenen `scope`-Werten
   am selben Anker hat und die Manifest-Erwartungen die beiden Meldungen mit
   ihren unterschiedlichen `scopeKind`-Werten pinnen.
2. Die Erwartungen sind im Szenario-README allein aus den Katalogdaten
   begründet.
3. Der manifest-getriebene Runner führt das Szenario grün aus — mit
   Kommando, Umfang und Exit-Code belegt.

## Plan

## Tasks

## Decisions

- **Herkunft:** Review-Befund aus dem Lauf zu Issue 0088 (2026-07-29):
  Beweiskraft-Verlust an VCC-R10 war nur im README notiert, nicht gefiled.

## Log

- 2026-08-12 — Still missing. Scanned every `docs/testing/*/scenario.json`
  (127 scenarios) for expectations that name an anchor and a `scopeKind`
  together: only two manifests mention `scopeKind` at all
  (`violation-classification`, `set-cost-value-force-gate`), and no anchor in
  any scenario carries two different `scopeKind` values, let alone two MIN
  limits with different scopes. The unit-level pin is intact
  (`src/evaluator/phantom.test.js:41-59`, `phantomMinViolation(scopeKind, path)`),
  so the gap is exactly the one the file names: the proof from catalogue data.

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
