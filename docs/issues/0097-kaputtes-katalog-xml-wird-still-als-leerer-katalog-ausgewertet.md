---
status: active
branch: claude/new-session-jnwa1m-0097
pr:
---

# Kaputtes Katalog-XML wird still als leerer Katalog ausgewertet

## Intent

`parseCatalogue` (`src/evaluator/catalogReader.js:880`) prüft weder auf das
`<parsererror>`-Dokument, das `DOMParser` bei nicht wohlgeformtem XML
liefert, noch auf den erwarteten Wurzel-Tag (`catalogue`/`gameSystem`). Eine
abgeschnittene oder kaputte `.cat` (oder eine versehentlich übergebene
`.ros`) wird still zu einem leeren, id-losen Katalog: alle Sammlungen leer,
`diagnostics: []`.

Das widerspricht dem Grundsatz „Fehlerpfade sind explizit; nichts wird still
verschluckt" (`docs/evaluator-architecture.md` §4). Folgeschaden: mit
`gameSystemId = null` entfällt sogar die Kohärenzprüfung der Fassade
(`datasetPreparation.js:48`), der Datensatz wirkt gültig und wertet gegen
nichts aus.

Acceptance criteria:

1. Nicht wohlgeformtes XML führt zu einer Diagnose, die die betroffene Datei
   benennt — nie zu einem stillen leeren Katalog.
2. Ein unerwarteter Wurzel-Tag (weder `catalogue` noch `gameSystem`) führt
   ebenso zu einer Diagnose.
3. Ein Datensatz mit einer so diagnostizierten Datei wertet nicht still
   „teilleer" aus; die Diagnose erreicht den Bericht.
4. Die bestehende Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt.

## Plan

## Tasks

## Decisions

- **Herkunft:** Intensiv-Audit der Reinraum-Engine gegen die BSData-Doku im
  Repo (2026-07-28); Codepfad verifiziert.

## Log

## Checkpoints

### Before implementation

- Does this match what was asked? Yes — make the two silent failure modes
  (parsererror document, wrong root tag) loud via the existing diagnostics
  channel, and ensure the facade surfaces them instead of evaluating a
  part-empty dataset.
- What surprised me? Nothing yet; the engine already has a diagnostics
  convention (`diagnostics: []` on the catalog, coherence checks in
  `datasetPreparation.js`) to slot into.
- What am I assuming without having verified it? That `DOMParser` in both
  jsdom (tests) and real browsers signals malformed XML via a
  `<parsererror>` document, and that "die Diagnose erreicht den Bericht"
  can reuse the existing diagnostic propagation path without a new report
  field. Criterion 3 leaves open whether evaluation proceeds partially or
  not at all — the test-author should flag this edge if the criteria do not
  decide it; default: evaluation may proceed, but the diagnostic must be
  present in the report output.

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
