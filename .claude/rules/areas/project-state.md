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
  `ENVIRONMENT_ABORT_SIGNATURES` erkannt) steht **vor** der Exit-Code-Prüfung. `npm run <gate>`
  führt über `sh` aus: ein fehlendes Werkzeug meldet sich dort als `sh: 1: <name>: not found`,
  nicht als `command not found` — beide Wortlaute müssen in der Signatur stehen, sonst gilt ein
  nie gelaufenes Gate als "hat Befunde". Der Berichts-Workflow klont cast seit Issue 0181 flach
  auf den PATH, die Signatur bleibt aber die Absicherung fuer jedes Werkzeug, das fehlt.
  Ein Werkzeug, das nichts geprüft hat, darf weder grün noch "hat Befunde" sein.
- Diese Signaturen sind **zeilengebunden** (`/^…$/im`), und die `sh`-Form verlangt das
  Shell-Präfix. Ein ungebundenes `: not found` fängt jeden normalen Befund mit ab, der einen
  nicht gefundenen Pfad nennt, und zeigt ein rotes Gate als abwesendes (Issue 0182) — der
  schlimmste Fehler dieser Seite. Wer eine Signatur ergänzt, prüft beide Richtungen: Abbruch
  erkannt **und** Befund nicht verschluckt.
- Die Gate-Id ist ein Schlüssel, der an vier Stellen zusammenpassen muss: `GATE_DEFINITIONS`
  (`gates.js`), `GATE_EXECUTION_OVERRIDES` (`generate.js`), `GATE_RUNE_EMBLEMS`
  (`renderReport.js`) und die Fixtures in `gates.test.js`/`buildReportModel.test.js`/
  `renderReport.test.js`. Wer eine Id umbenennt, zieht alle vier nach — eine vergessene Rune
  fällt in keinem Test auf.
- Das **angezeigte** `command` eines Gates ist zugleich der Schlüssel, über den
  `findGateEnforcement` den Step in `.github/workflows/ci.yml` nachschlägt. Weicht der Befehl
  im Workflow ab, steht das Gate auf `enforcement: unknown` — kein Fehler, aber eine stumme
  Aussage. Gates ohne CI-Step sind dauerhaft `unknown`; `cast` gehoert seit Issue 0181 nicht
  mehr dazu — `.github/workflows/ci.yml` fuehrt `npm run cast` unter genau diesem Befehl aus,
  also loest das Gate eine echte Wirksamkeit auf.
- `graph.js` (Zyklen nach Tarjan, Schichtverstöße; `parseCastGraphPath` für die Berichtszeile
  von `cast scan`, die **nicht** der blanke Pfad ist — ADR 0041, Issue 0180) hat **keinen**
  Abnehmer mehr: `buildReportModel` kennt keinen Graph-Eingang, und `generate.js` scannt seit
  Issue 0182 nicht mehr — ein Scan je Berichtslauf für einen Wert, den niemand nimmt. Wer die
  Zyklen anzeigen will, erweitert Modell **und** Renderer und holt den Scan in `generate.js`
  zurück; knip meldet das Modul solange als ungenutzt (warn-only).
- `generate.js` schreibt Fortschritt nach **stderr**, nie nach stdout: stdout gehört den
  maschinenlesbaren Ausgaben der Gates.
- Coverage kommt aus `coverage/coverage-final.json`, deshalb läuft das Test-Gate mit
  `--coverage.reportOnFailure` — sonst löscht ein einzelner roter Test die gesamte
  Abdeckungsanzeige.
- Erklärende Kommentare sind hier durchgehend deutsch; Testtitel sind gemischt (englisch in
  `gates.test.js`, deutsch in `renderReport.test.js`) — neue Titel folgen der Datei, in der sie
  stehen.
- Der Bericht wird bei jedem Push frisch erzeugt und direkt ins Pages-Deployment gelegt, nie
  committet: `docs/status/` ist gitignoriert (Issue 0182). Eine eingecheckte Kopie liefert
  Jekyll an dem Tag als aktuell aus, an dem der Erzeugungsschritt scheitert.
- Das gesamte Stylesheet der Seite ist **ein** Template-Literal (`REPORT_STYLES` in
  `renderReport.js`) — es gibt keine `.css`-Datei. Wer den Look aendert, aendert diese Konstante,
  und `renderReport.test.js` prueft CSS per `toContain`/`toMatch` auf dem HTML-Text.
- Kein `<script>` und kein `<link>` im Ergebnis (Test pinnt beides). Jede Interaktion ist reines
  CSS: Tabs ueber versteckte Radios, Tooltips ueber `:hover` **und** `:focus-within` auf
  `.gate-card`/`.vial-container` (die tragen dafuer `tabindex="0"` — ohne Fokus gaebe es sie auf
  dem Telefon nicht). Die einzige entfernte Ressource ist der Google-Fonts-`@import`.
- Mobil gilt hier: `touch-action: pan-x pan-y` auf `html, body`, Bedienflaechen >= 44px auch **in**
  `@media (max-width: 30rem)` (dort schrumpft nur die Polsterung), Tooltips brechen unter 30rem
  um, und ein `prefers-reduced-motion`-Block nimmt Runenpuls und Blaeschen zurueck. Kein
  Das Viewport-Meta traegt `maximum-scale=1, user-scalable=no`: die Pinch-Geste ist gesperrt
  (0184), WCAG 1.4.4 dafuer bewusst aufgegeben. `touch-action` ist noetig, weil iOS Safari
  `user-scalable=no` ignoriert.
- Die Seite erzeugt **keine** Tabelle; Regeln fuer `table.grid`/`.table-scroll` waren tot und
  sind weg. Wer eine Tabelle einfuehrt, bringt ihre Regeln selbst mit.
