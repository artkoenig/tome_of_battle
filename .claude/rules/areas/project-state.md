---
paths:
  - "scripts/project-state/**"
---

# project-state — der Zustandsbericht

Erzeugt `.report/index.html` (`npm run status-report`, im CI der Zustandsbericht-Workflow).
`generate.js` ist der einzige Rand mit I/O; alles andere ist rein und getestet. Tests:
`forge-test --run scripts/project-state`.

- Ein Gate ist **erhobene Datenlage, kein Steuerfluss**: ein abbrechendes oder findendes Gate
  macht den Lauf nie rot. Nur ein Fehler des Orchestrators selbst beendet ihn mit Fehlercode.
- Die drei Zustände in `gates.js` sind der Kern: `not-run` (Umgebungsabbruch, per Signatur in
  `ENVIRONMENT_ABORT_SIGNATURES` erkannt) steht **vor** der Exit-Code-Prüfung. Ein Werkzeug, das
  nichts geprüft hat, darf weder grün noch "hat Befunde" sein.
- Die Gate-Id ist ein Schlüssel, der an vier Stellen zusammenpassen muss: `GATE_DEFINITIONS`
  (`gates.js`), `GATE_EXECUTION_OVERRIDES` (`generate.js`), `GATE_RUNE_EMBLEMS`
  (`renderReport.js`) und die Fixtures in `gates.test.js`/`buildReportModel.test.js`/
  `renderReport.test.js`. Wer eine Id umbenennt, zieht alle vier nach — eine vergessene Rune
  fällt in keinem Test auf.
- Das **angezeigte** `command` eines Gates ist zugleich der Schlüssel, über den
  `findGateEnforcement` den Step in `.github/workflows/ci.yml` nachschlägt. Weicht der Befehl
  im Workflow ab, steht das Gate auf `enforcement: unknown` — kein Fehler, aber eine stumme
  Aussage. Gates ohne CI-Step (z. B. `cast`, das als Plugin nicht installierbar ist) sind
  dauerhaft `unknown`.
- Der Modulgraph kommt aus cast (ADR 0041): `cast scan` schreibt ihn **außerhalb** der
  Arbeitskopie und meldet auf stdout nur den Pfad. `generate.js` liest die Datei von dort,
  `graph.js` normalisiert `modules[].edges` (nur `resolution === 'module'` ist eine Kante) zur
  Adjazenzliste. Der Graph ist absichtlich die Eingabe, nicht das Regelurteil des Prüfers.
- `graph.js` (Zyklen nach Tarjan, Schichtverstöße) hat im Berichtsmodell derzeit keinen
  Abnehmer — `buildReportModel` kennt keinen Graph-Eingang. Wer die Zyklen anzeigen will,
  erweitert Modell **und** Renderer; knip meldet das Modul solange als ungenutzt (warn-only).
- `generate.js` schreibt Fortschritt nach **stderr**, nie nach stdout: stdout gehört den
  maschinenlesbaren Ausgaben der Gates.
- Coverage kommt aus `coverage/coverage-final.json`, deshalb läuft das Test-Gate mit
  `--coverage.reportOnFailure` — sonst löscht ein einzelner roter Test die gesamte
  Abdeckungsanzeige.
- Erklärende Kommentare sind hier durchgehend deutsch; Testtitel sind gemischt (englisch in
  `gates.test.js`, deutsch in `renderReport.test.js`) — neue Titel folgen der Datei, in der sie
  stehen.
