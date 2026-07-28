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

- **Default (unanswered, human asleep) — file-name contract:** no caller-side
  file identity exists today (`parseCatalogue(xml)`, `prepareDataset` gets raw
  XML strings). Smallest contract pinned by the tests: optional
  `parseCatalogue(xml, { sourceName })`; the supplied value must appear in
  the diagnostic payload (field name free). At facade level only diagnostic
  *presence* in the report is required. Growing the dataset contract to
  named entries (`{ name, xml }`) would be a public-contract decision —
  belongs to the human / issue 084's roster-contract territory, not this
  run.

- **Herkunft:** Intensiv-Audit der Reinraum-Engine gegen die BSData-Doku im
  Repo (2026-07-28); Codepfad verifiziert.

## Log

- 2026-07-28 test-author: `src/evaluator/catalogReader.malformedXml.test.js`,
  14 tests (11 failing — parse silently yields empty diagnostics today; 3
  KONTROLLE passing). jsdom parsererror behaviour probed for unclosed tag,
  truncation, empty and whitespace input; `<roster>` root parses cleanly but
  is a wrong root tag. No `DiagnosticKind` value pinned (criteria name
  none); only truthy `kind` asserted. Broken-`.gst` test built so
  `GAMESYSTEM_MISMATCH` cannot mask the new diagnostic.
- 2026-07-28 implementer: `DiagnosticKind.UNREADABLE_CATALOGUE` +
  `CatalogueUnreadableReason` (MALFORMED_XML/UNEXPECTED_ROOT) in `model.js`,
  following the one-kind-with-reasons precedent; `parseCatalogue(xml,
  { sourceName })` detects parsererror document and wrong root, returns the
  full catalogue shape with one diagnostic `{ reason, sourceName, rootTag }`;
  facade passes role-derived names (`gameSystem`, `catalogue[<i>]`) — which
  also fixed the latent `catalogues.map(parseCatalogue)` index-as-options
  hazard. Criterion 3 came free: mergeCatalogues → prepareDataset →
  evaluate/buildDatasetDescription already propagate diagnostics.
  §3.6 diagnostic list updated. 14/14 target tests green; `npx vitest run`
  211 files / 2157 tests exit 0; puppeteer E2E exit 0; lint/typecheck 0.
- 2026-07-28 review round 1 (fresh context): 0 in-scope findings, all four
  criteria met; reviewer re-established every exit-code fact, verified the
  test file untouched since authoring, probed the facade independently, and
  proved detection robustness in real Chrome via puppeteer (parsererror
  embedded under the original root there, root in jsdom — both caught).
  One low-severity blast-radius finding OUTSIDE the intent (false positive
  for a literal `parsererror` element in a well-formed catalog) — filed as
  issue 0105 per the rulebook instead of fixed here. No repeat round needed:
  no in-scope fix was applied.

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

- Does this match what was asked? Yes — both silent failure modes are loud,
  the file is named where the caller names it, the diagnostic reaches
  `evaluate` and `describeDataset`, and the whole suite (2157 unit tests,
  puppeteer E2E) is green by exit code. Review round 1: zero in-scope
  findings.
- What surprised me? Chrome and jsdom disagree on where the parsererror
  element lands (embedded vs. root) — the reviewer proved via puppeteer
  that the whole-document scan catches both.
- What am I assuming without having verified it? That no real catalog ever
  contains an element literally named `parsererror` (schema has none) — the
  false-positive edge this leaves is filed as issue 0105 instead of being
  fixed here (outside the intent).

## Retro
