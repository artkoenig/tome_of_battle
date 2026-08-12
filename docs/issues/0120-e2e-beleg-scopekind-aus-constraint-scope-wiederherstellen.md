---
status: done
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

- **Closed 2026-08-12 as low value, not as impossible.** The E2E proof is
  buildable from real data (candidate anchors in the Log). It duplicates an
  existing unit-level pin and closes no user-visible gap.

- **Herkunft:** Review-Befund aus dem Lauf zu Issue 0088 (2026-07-29):
  Beweiskraft-Verlust an VCC-R10 war nur im README notiert, nicht gefiled.

## Log

- 2026-08-12 (real-data sweep) — **Buildable after all, and closed as low
  value.** The scenario this file asks for is no longer impossible: across
  both complete upstream corpora —
  `artkoenig/Warhammer-Fantasy-Battles-6th-Definitive-edition` (19 files) and
  `artkoenig/Warhammer-Fantasy-6th-edition` (17 files), 36 catalogue documents
  in total, cloned at their current heads,
  **11 anchors carry two `min` limits with different `scope` values**, among
  them `<entryLink>` "General" (`2b37-955c-579e-8b40`, High Elves definitive),
  `<selectionEntry>` "Paymaster" (`bb61-113e-cd28-26f7`, Dogs of War
  definitive), "Errantry War" (`b460-3ebf-cb3a-b3da`, Bretonnia), and two in the
  definitive `.gst` itself ("Allow experimental rules?"
  `8b76-92c4-23f9-54b1`, "Allow special characters?" `8923-5946-7b10-8957`) —
  all `force`+`parent` pairs. What the file asks for is nevertheless a **second**
  proof of a statement the unit level already pins
  (`src/evaluator/phantom.test.js`), and it buys no user-visible safety. Closed
  with the candidates recorded, so it can be revived in one sitting if the
  scopeKind projection is ever touched.

- 2026-08-12 (re-check, independent scan) — **Still missing.** Of 123 scenarios
  under `docs/testing/`, exactly two manifests mention `scopeKind` at all
  (`violation-classification`, `set-cost-value-force-gate`). Walking every
  expectation of `violation-classification`: six messages, each with a single
  `scopeKind` (`force`, `force`, `roster`, `parent`, `roster`, `roster`), each in
  a different roster, and no anchor carrying two of them — let alone two MIN
  limits with different scopes. The E2E proof this file asks for does not
  exist.

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
