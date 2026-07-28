---
status: backlog
branch:
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

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
