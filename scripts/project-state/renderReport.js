/**
 * Reine Aufbereitung des Projektzustands zu einer in sich geschlossenen HTML-Seite
 * (ohne Datei- oder Netzzugriff, damit sie testbar bleibt). Eingabe ist ein fertiges
 * Datenmodell, Ausgabe der vollstaendige HTML-Text.
 *
 * "In sich geschlossen" heisst woertlich: die erzeugte Seite laedt keine Schriften,
 * Skripte oder Daten nach. Alles Layout liegt in einem eingebetteten `<style>`, die
 * Navigation sind reine Anker, es gibt kein `<script>`. Damit funktioniert die Seite
 * offline und veraltet nicht durch entfernte Ressourcen.
 *
 * Jeder angezeigte Inhalt leitet sich aus der Live-Messung ab -- es gibt keinen
 * hand-gepflegten Text mehr, der der gemessenen Realitaet widersprechen koennte
 * (ADR 0022: Anzeige leitet sich aus der Quelle ab, schliesst Drift strukturell
 * aus). Das Gesamturteil entsteht aus den gemessenen Gate-Zustaenden
 * ({@link module:project-state/buildReportModel}); hier wird es nur dargestellt.
 *
 * Die Seite ist bewusst mobil-tauglich: relative Einheiten, breite Tabellen liegen
 * je in einem eigenen `overflow-x`-Container, sodass ein schmaler Viewport (~375 px)
 * ohne horizontales Scrollen der Seite lesbar bleibt.
 *
 * Der Zeitpunkt kommt als fertiger Text herein, nicht aus `new Date()` -- so bleibt
 * die Funktion deterministisch und im Test ohne Uhr pruefbar.
 *
 * @module project-state/renderReport
 */
import { marked } from 'marked';

import { GateStatus, GateEnforcement, GateAbortReason } from './gates.js';

const DEFAULT_REPORT_TITLE = 'Projektzustandsbericht';

/** Die beiden Bereiche der Seite -- beide unter einer URL, ueber Anker erreichbar. */
const SECTIONS = Object.freeze({
  healthcheck: { id: 'healthcheck', title: 'Healthcheck' },
  issues: { id: 'issues', title: 'Issues' },
});

/**
 * Darstellung eines Gate-Zustands. `symbol` und `label` tragen die Bedeutung; die
 * Farbe (`tone`) ist nur Zugabe, damit der Zustand auch ohne Farbe erkennbar ist.
 * `not-run` bekommt bewusst ein eigenes Symbol und einen eigenen Ton -- es darf nie
 * wie `passed` aussehen.
 */
const GATE_STATUS_PRESENTATION = Object.freeze({
  [GateStatus.Passed]: { symbol: '✓', label: 'bestanden', tone: 'ok' },
  [GateStatus.Findings]: { symbol: '!', label: 'Befunde', tone: 'warn' },
  [GateStatus.NotRun]: { symbol: '∅', label: 'nicht angelaufen', tone: 'inert' },
});

const GATE_ENFORCEMENT_LABEL = Object.freeze({
  [GateEnforcement.Blocking]: 'blockierend',
  [GateEnforcement.Warning]: 'nur Hinweis',
  [GateEnforcement.Unknown]: 'Wirksamkeit unbekannt',
});

const GATE_ABORT_REASON_LABEL = Object.freeze({
  [GateAbortReason.UnsupportedNodeVersion]: 'nicht unterstuetzte Node-Version',
  [GateAbortReason.ExecutableNotFound]: 'Programm nicht gefunden',
  [GateAbortReason.ModuleNotFound]: 'Modul nicht gefunden',
  [GateAbortReason.NoRunRecorded]: 'kein Lauf erfasst',
});

const UNKNOWN_PRESENTATION = Object.freeze({ symbol: '?', label: 'unbekannt', tone: 'neutral' });

/** Schmales geschuetztes Leerzeichen: haelt Zahl und Prozentzeichen zusammen (Typografie). */
const NON_BREAKING_SPACE = ' ';

/** Die Abschnitte einer `issue.md`, die im Issue-Bereich als Volltext erscheinen. */
const RENDERED_ISSUE_SECTIONS = Object.freeze(['Description', 'Acceptance Criteria']);

/**
 * @typedef {object} Metric  Eine erhobene Kennzahl.
 * @property {string} label
 * @property {string|number} value
 * @property {string} [hint]  Kurze Erlaeuterung, falls die Zahl allein missverstanden wuerde.
 */

/**
 * @typedef {object} StructureFacts  Fakten ueber den Importgraphen.
 * @property {number} moduleCount
 * @property {number} dependencyCount
 * @property {string[][]} cycles          je Zyklus die beteiligten Module
 * @property {ReadonlyArray<import('./graph.js').LayerViolation>} layerViolations
 */

/**
 * @typedef {object} BranchScope  Die ausgewiesene Blindstelle des Issue-Bereichs.
 * @property {string[]} scannedRefs  Refs, die der Bericht sehen konnte.
 */

/**
 * @typedef {object} OverallAssessment  Das Gesamturteil, der Seite vorangestellt.
 *   Vollstaendig aus den gemessenen Gate-Zustaenden abgeleitet, kein Handtext.
 * @property {string} headline  Der schwerwiegendste gemessene Zustand auf einen Blick.
 * @property {ReadonlyArray<string>} facts  Die nackten Zahlen dahinter, je eine Zeile.
 */

/**
 * @typedef {object} ReportModel  Das reine Datenmodell, aus dem die Seite entsteht.
 * @property {string} [title]
 * @property {string} generatedAt  Fertiger Anzeigetext des Erhebungszeitpunkts.
 * @property {OverallAssessment} assessment  Gesamturteil, aus den Messwerten abgeleitet.
 * @property {ReadonlyArray<import('./gates.js').GateState>} gates
 * @property {ReadonlyArray<Metric>} metrics
 * @property {ReadonlyArray<import('./coverage.js').ModuleCoverage>} coverage
 * @property {ReadonlyArray<import('./functions.js').LongFunction>} longFunctions
 * @property {StructureFacts} structure
 * @property {ReadonlyArray<import('./issues.js').OpenIssue>} openIssues
 * @property {ReadonlyArray<import('./issues.js').UnreadableIssue>} [unreadableIssues]
 * @property {BranchScope} branchScope
 */

/**
 * Erzeugt die vollstaendige, in sich geschlossene HTML-Seite aus dem Datenmodell.
 *
 * @param {ReportModel} model
 * @returns {string}  vollstaendiges HTML-Dokument
 */
export function renderReport(model) {
  const title = model.title ?? DEFAULT_REPORT_TITLE;
  const body = [
    renderHeader(title, model.generatedAt),
    renderOverallAssessment(model.assessment),
    renderHealthcheckSection(model),
    renderIssuesSection(model),
  ].join('\n');

  return [
    '<!DOCTYPE html>',
    '<html lang="de">',
    renderDocumentHead(title),
    `<body>\n<main class="page">\n${body}\n</main>\n</body>`,
    '</html>',
    '',
  ].join('\n');
}

function renderDocumentHead(title) {
  return [
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    `<style>${REPORT_STYLES}</style>`,
    '</head>',
  ].join('\n');
}

function renderHeader(title, generatedAt) {
  const nav = Object.values(SECTIONS)
    .map((section) => `<a href="#${section.id}">${escapeHtml(section.title)}</a>`)
    .join('\n');
  return [
    '<header class="page-header">',
    `<h1>${escapeHtml(title)}</h1>`,
    `<p class="generated-at">Erhoben: ${escapeHtml(generatedAt)}</p>`,
    `<nav class="section-nav">\n${nav}\n</nav>`,
    '</header>',
  ].join('\n');
}

/** @param {OverallAssessment} assessment */
function renderOverallAssessment(assessment) {
  const facts = assessment.facts
    .map((fact) => `<li>${escapeHtml(fact)}</li>`)
    .join('');
  return [
    '<section class="verdict" aria-label="Gesamturteil">',
    '<h2>Gesamturteil</h2>',
    `<p class="verdict-headline">${escapeHtml(assessment.headline)}</p>`,
    `<ul class="verdict-facts">${facts}</ul>`,
    '</section>',
  ].join('\n');
}

/** @param {ReportModel} model */
function renderHealthcheckSection(model) {
  const { id, title } = SECTIONS.healthcheck;
  return [
    `<section id="${id}" class="section">`,
    `<h2>${escapeHtml(title)}</h2>`,
    renderGates(model.gates),
    renderMetrics(model.metrics),
    renderCoverage(model.coverage),
    renderLongFunctions(model.longFunctions),
    renderStructure(model.structure),
    '</section>',
  ].join('\n');
}

/** @param {ReadonlyArray<import('./gates.js').GateState>} gates */
function renderGates(gates) {
  const rows = gates
    .map((gate) => {
      const status = GATE_STATUS_PRESENTATION[gate.status] ?? UNKNOWN_PRESENTATION;
      const enforcement = GATE_ENFORCEMENT_LABEL[gate.enforcement] ?? GATE_ENFORCEMENT_LABEL[GateEnforcement.Unknown];
      return [
        '<tr>',
        `<td>${escapeHtml(gate.label)}<br><code>${escapeHtml(gate.command)}</code></td>`,
        `<td>${renderBadge(status)}${renderAbortReason(gate)}</td>`,
        `<td>${escapeHtml(enforcement)}</td>`,
        '</tr>',
      ].join('');
    })
    .join('\n');

  return renderSubsection(
    'Qualitaets-Gates',
    wrapScrollable(
      `<table class="grid"><thead><tr><th>Gate</th><th>Zustand</th><th>Wirksamkeit</th></tr></thead><tbody>${rows}</tbody></table>`,
    ),
  );
}

/** @param {import('./gates.js').GateState} gate */
function renderAbortReason(gate) {
  if (gate.status !== GateStatus.NotRun || !gate.abortReason) return '';
  const reason = GATE_ABORT_REASON_LABEL[gate.abortReason] ?? gate.abortReason;
  return ` <span class="reason">(${escapeHtml(reason)})</span>`;
}

/** @param {ReadonlyArray<Metric>} metrics */
function renderMetrics(metrics) {
  if (metrics.length === 0) return renderSubsection('Kennzahlen', renderEmpty('Keine Kennzahlen erhoben.'));
  const cards = metrics
    .map((metric) => {
      const hint = metric.hint ? `<span class="metric-hint">${escapeHtml(metric.hint)}</span>` : '';
      return [
        '<li class="metric">',
        `<span class="metric-value">${escapeHtml(String(metric.value))}</span>`,
        `<span class="metric-label">${escapeHtml(metric.label)}</span>`,
        hint,
        '</li>',
      ].join('');
    })
    .join('\n');
  return renderSubsection('Kennzahlen', `<ul class="metric-grid">${cards}</ul>`);
}

/** @param {ReadonlyArray<import('./coverage.js').ModuleCoverage>} coverage */
function renderCoverage(coverage) {
  if (coverage.length === 0) return renderSubsection('Testabdeckung je Modul', renderEmpty('Keine Abdeckungsdaten.'));
  const rows = coverage
    .map((entry) =>
      [
        '<tr>',
        `<td><code>${escapeHtml(entry.module)}</code></td>`,
        `<td class="num">${entry.fileCount}</td>`,
        renderMetricCell(entry.statements),
        renderMetricCell(entry.branches),
        renderMetricCell(entry.functions),
        '</tr>',
      ].join(''),
    )
    .join('\n');
  return renderSubsection(
    'Testabdeckung je Modul',
    wrapScrollable(
      `<table class="grid"><thead><tr><th>Modul</th><th>Dateien</th><th>Anweisungen</th><th>Branches</th><th>Funktionen</th></tr></thead><tbody>${rows}</tbody></table>`,
    ),
  );
}

/** @param {import('./coverage.js').CoverageMetric} metric */
function renderMetricCell(metric) {
  return `<td class="num">${formatPercent(metric.percent)}<span class="fraction">${metric.covered}/${metric.total}</span></td>`;
}

/** @param {ReadonlyArray<import('./functions.js').LongFunction>} longFunctions */
function renderLongFunctions(longFunctions) {
  if (longFunctions.length === 0) {
    return renderSubsection('Laengste Funktionen', renderEmpty('Keine Funktion ueber dem Grenzwert.'));
  }
  const rows = longFunctions
    .map((fn) =>
      [
        '<tr>',
        `<td><code>${escapeHtml(fn.name)}</code></td>`,
        `<td><code>${escapeHtml(fn.path)}</code></td>`,
        `<td class="num">${fn.lineCount}</td>`,
        `<td class="num">${fn.startLine}–${fn.endLine}</td>`,
        '</tr>',
      ].join(''),
    )
    .join('\n');
  return renderSubsection(
    'Laengste Funktionen',
    wrapScrollable(
      `<table class="grid"><thead><tr><th>Funktion</th><th>Datei</th><th>Zeilen</th><th>Bereich</th></tr></thead><tbody>${rows}</tbody></table>`,
    ),
  );
}

/** @param {StructureFacts} structure */
function renderStructure(structure) {
  const facts = [
    `<li class="metric"><span class="metric-value">${structure.moduleCount}</span><span class="metric-label">Module</span></li>`,
    `<li class="metric"><span class="metric-value">${structure.dependencyCount}</span><span class="metric-label">Abhaengigkeiten</span></li>`,
  ].join('\n');
  return renderSubsection(
    'Strukturfakten',
    [
      `<ul class="metric-grid">${facts}</ul>`,
      renderStructureFinding('Import-Zyklen', structure.cycles.map((cycle) => cycle.join(' → ')), 'Keine Zyklen.'),
      renderStructureFinding(
        'Schichtverstoesse',
        structure.layerViolations.map((v) => `${v.from} → ${v.to} (${v.fromLayer} darf nicht auf ${v.toLayer})`),
        'Keine Schichtverstoesse.',
      ),
    ].join('\n'),
  );
}

/** @param {string} label @param {string[]} items @param {string} emptyText */
function renderStructureFinding(label, items, emptyText) {
  const body =
    items.length === 0
      ? renderEmpty(emptyText)
      : `<ul class="finding-list">${items.map((item) => `<li><code>${escapeHtml(item)}</code></li>`).join('')}</ul>`;
  return `<h4>${escapeHtml(label)}</h4>${body}`;
}

/** @param {ReportModel} model */
function renderIssuesSection(model) {
  const { id, title } = SECTIONS.issues;
  return [
    `<section id="${id}" class="section">`,
    `<h2>${escapeHtml(title)}</h2>`,
    renderBranchScope(model.branchScope),
    renderOpenIssues(model.openIssues),
    renderUnreadableIssues(model.unreadableIssues ?? []),
    '</section>',
  ].join('\n');
}

/** @param {BranchScope} branchScope */
function renderBranchScope(branchScope) {
  const refs = branchScope.scannedRefs;
  const refList =
    refs.length === 0
      ? 'keine Refs erfasst'
      : refs.map((ref) => `<code>${escapeHtml(ref)}</code>`).join(', ');
  return [
    '<aside class="blind-spot" role="note">',
    '<strong>Blindstelle:</strong> Nur gepushte Branches sind erfasst. Ein CI-Laeufer sieht keine rein lokalen ',
    'Branches; Vorgaenge, die nur lokal existieren, fehlen hier.',
    `<br>Erfasst: ${refList}.`,
    '</aside>',
  ].join('');
}

/** @param {ReadonlyArray<import('./issues.js').OpenIssue>} openIssues */
function renderOpenIssues(openIssues) {
  if (openIssues.length === 0) return renderEmpty('Keine offenen Vorgaenge.');
  return openIssues.map(renderOpenIssue).join('\n');
}

/**
 * Ein offener Vorgang als natives, ausklappbares `<details>` -- ohne JavaScript.
 * Sichtbar bleibt nur die kompakte Zusammenfassungszeile (Titel, Status); die
 * Beschreibung und die Akzeptanzkriterien klappen erst auf Wunsch darunter auf,
 * damit der Bereich auch bei vielen Vorgaengen kurz bleibt.
 *
 * @param {import('./issues.js').OpenIssue} issue
 */
function renderOpenIssue(issue) {
  return [
    `<details class="issue" id="issue-${escapeHtml(anchorId(issue.id))}">`,
    renderIssueSummary(issue),
    '<div class="issue-body">',
    renderIssueMeta(issue),
    renderIssueSections(issue.sections),
    renderIssueRefs(issue.refs),
    '</div>',
    '</details>',
  ].join('\n');
}

/** Die stets sichtbare, kompakte Zeile eines Vorgangs: Titel und Status. */
function renderIssueSummary(issue) {
  return [
    '<summary class="issue-summary">',
    `<span class="issue-title">${escapeHtml(issue.title)}</span>`,
    `<span class="issue-status">${escapeHtml(issue.status)}</span>`,
    '</summary>',
  ].join('');
}

/** Die Kopfdaten im aufgeklappten Teil: Id, Typ und -- falls vorhanden -- Blocker. */
function renderIssueMeta(issue) {
  const meta = [
    `<span class="issue-id"><code>${escapeHtml(issue.id)}</code></span>`,
    issue.type ? `<span class="issue-type">${escapeHtml(issue.type)}</span>` : '',
    issue.blockedBy.length ? `<span class="issue-blocked">blockiert von ${escapeHtml(issue.blockedBy.join(', '))}</span>` : '',
  ]
    .filter(Boolean)
    .join('\n');
  return `<div class="issue-meta">${meta}</div>`;
}

/** @param {Record<string, string>} sections */
function renderIssueSections(sections) {
  return RENDERED_ISSUE_SECTIONS.map((name) => {
    const content = sections[name];
    if (!content) return '';
    return `<h4>${escapeHtml(name)}</h4><div class="prose">${renderMarkdown(content)}</div>`;
  })
    .filter(Boolean)
    .join('\n');
}

/** @param {string[]} refs */
function renderIssueRefs(refs) {
  if (refs.length === 0) return '';
  const list = refs.map((ref) => `<code>${escapeHtml(ref)}</code>`).join(', ');
  return `<p class="issue-refs">Gesehen auf: ${list}</p>`;
}

/** @param {ReadonlyArray<import('./issues.js').UnreadableIssue>} unreadable */
function renderUnreadableIssues(unreadable) {
  if (unreadable.length === 0) return '';
  const items = unreadable
    .map((entry) => `<li><code>${escapeHtml(entry.id)}</code> auf <code>${escapeHtml(entry.ref)}</code>: ${escapeHtml(entry.reason)}</li>`)
    .join('');
  return [
    '<aside class="blind-spot" role="note">',
    '<strong>Nicht lesbar:</strong> Diese Vorgaenge liessen sich nicht auswerten und fehlen oben.',
    `<ul class="finding-list">${items}</ul>`,
    '</aside>',
  ].join('');
}

/** Eine benannte Untergruppe innerhalb eines Bereichs. */
function renderSubsection(title, innerHtml) {
  return `<div class="subsection"><h3>${escapeHtml(title)}</h3>${innerHtml}</div>`;
}

/**
 * Legt breite Inhalte (Tabellen) in einen eigenen horizontal scrollbaren Container.
 * So laeuft eine breite Tabelle auf einem schmalen Viewport innerhalb ihres Rahmens
 * ueber, statt die ganze Seite horizontal scrollen zu lassen.
 */
function wrapScrollable(innerHtml) {
  return `<div class="table-scroll">${innerHtml}</div>`;
}

/** @param {{ symbol: string, label: string, tone: string }} presentation */
function renderBadge(presentation) {
  return `<span class="badge badge-${presentation.tone}"><span class="badge-symbol" aria-hidden="true">${escapeHtml(presentation.symbol)}</span>${escapeHtml(presentation.label)}</span>`;
}

function renderEmpty(text) {
  return `<p class="empty">${escapeHtml(text)}</p>`;
}

/**
 * Rendert Markdown zur Bauzeit zu HTML. Die Eingabe stammt aus den eigenen
 * `issue.md`-Dateien (vertrauenswuerdig), daher wird das Ergebnis unveraendert
 * eingebettet.
 *
 * @param {string|null|undefined} text
 * @returns {string}
 */
function renderMarkdown(text) {
  const source = (text ?? '').trim();
  if (source === '') return '';
  // Ohne `async`-Option ist `marked.parse` synchron und liefert einen String;
  // die Typdeklaration nennt dennoch die Promise-Ueberladung mit.
  return /** @type {string} */ (marked.parse(source));
}

function formatPercent(percent) {
  return `${percent}${NON_BREAKING_SPACE}%`;
}

/** Ein Anker-taugliches Fragment aus einer Issue-Id (`54-b/01-c` -> `54-b-01-c`). */
function anchorId(issueId) {
  return issueId.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');
}

/** HTML-Maskierung fuer alle Klartext-Werte, die in die Seite eingesetzt werden. */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Das eingebettete Stylesheet. Bewusst systemeigene Schriftarten (kein Nachladen),
 * helles und dunkles Erscheinungsbild ueber `prefers-color-scheme`. Die Zustaende
 * tragen ihre Bedeutung ueber Symbol und Text; die Farben hier sind nur Zugabe.
 *
 * Das Layout ist durchgehend in relativen Einheiten gehalten und mobil-tauglich:
 * breite Tabellen liegen je in einem eigenen `overflow-x`-Container (`.table-scroll`),
 * lange Zeichenketten brechen um (`overflow-wrap`), und eine Media Query fuer schmale
 * Viewports strafft die Abstaende -- so bleibt die Seite bei ~375 px ohne
 * horizontales Scrollen lesbar.
 */
const REPORT_STYLES = `
:root {
  color-scheme: light dark;
  --bg: #f7f7f5;
  --surface: #ffffff;
  --text: #1c1c1e;
  --muted: #5c5c66;
  --border: #d8d8d2;
  --accent: #5b3a29;
  --ok-bg: #d8ecd6; --ok-fg: #1d4620;
  --warn-bg: #f6e6c4; --warn-fg: #6b4a11;
  --inert-bg: #e4e4e4; --inert-fg: #3a3a3a;
  --neutral-bg: #e2e6ee; --neutral-fg: #2a3a52;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #17171a;
    --surface: #202024;
    --text: #ececf0;
    --muted: #a1a1ab;
    --border: #35353c;
    --accent: #c99b7a;
    --ok-bg: #1f3a22; --ok-fg: #b7e6b3;
    --warn-bg: #443413; --warn-fg: #f0d79a;
    --inert-bg: #33333a; --inert-fg: #d0d0d6;
    --neutral-bg: #26303f; --neutral-fg: #b9cbe6;
  }
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  overflow-wrap: break-word;
}
.page { max-width: 60rem; margin: 0 auto; padding: 1.5rem 1.25rem 4rem; }
.page-header { border-bottom: 2px solid var(--border); padding-bottom: 1rem; margin-bottom: 1.5rem; }
h1 { font-size: 1.9rem; margin: 0 0 .25rem; }
h2 { font-size: 1.4rem; margin: 0 0 .75rem; border-bottom: 1px solid var(--border); padding-bottom: .3rem; }
h3 { font-size: 1.1rem; margin: 1.25rem 0 .5rem; }
h4 { font-size: .95rem; margin: 1rem 0 .35rem; color: var(--muted); }
.generated-at { color: var(--muted); margin: 0 0 .75rem; font-size: .9rem; }
.section-nav a { display: inline-block; margin-right: 1rem; color: var(--accent); text-decoration: none; font-weight: 600; }
.section-nav a:hover { text-decoration: underline; }
.section { margin-bottom: 2.5rem; }
.subsection { margin-bottom: 1.5rem; }
.empty { color: var(--muted); font-size: .9rem; }
.verdict { background: var(--surface); border: 1px solid var(--border); border-left: 4px solid var(--accent); border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 2rem; }
.verdict-headline { font-size: 1.15rem; font-weight: 600; margin: .25rem 0 .5rem; }
.verdict-facts { list-style: none; padding: 0; margin: .5rem 0 0; display: flex; flex-direction: column; gap: .25rem; }
.verdict-facts li { color: var(--muted); font-size: .9rem; }
.prose :first-child { margin-top: 0; }
.prose :last-child { margin-bottom: 0; }
code { font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace; font-size: .85em; overflow-wrap: anywhere; }
.table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; margin-top: .5rem; }
table.grid { width: 100%; border-collapse: collapse; font-size: .9rem; }
table.grid th, table.grid td { text-align: left; padding: .45rem .6rem; border-bottom: 1px solid var(--border); vertical-align: top; }
table.grid th { color: var(--muted); font-weight: 600; }
td.num { text-align: right; white-space: nowrap; }
.fraction { display: block; color: var(--muted); font-size: .8em; }
.badge { display: inline-flex; align-items: center; gap: .35em; padding: .15em .55em; border-radius: 999px; font-size: .82rem; font-weight: 600; }
.badge-symbol { font-weight: 700; }
.badge-ok { background: var(--ok-bg); color: var(--ok-fg); }
.badge-warn { background: var(--warn-bg); color: var(--warn-fg); }
.badge-inert { background: var(--inert-bg); color: var(--inert-fg); border: 1px dashed currentColor; }
.badge-neutral { background: var(--neutral-bg); color: var(--neutral-fg); }
.reason { color: var(--muted); font-size: .85rem; }
.metric-grid { list-style: none; display: flex; flex-wrap: wrap; gap: .75rem; padding: 0; margin: .5rem 0; }
.metric { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: .6rem .9rem; min-width: 7rem; flex: 1 1 7rem; display: flex; flex-direction: column; }
.metric-value { font-size: 1.5rem; font-weight: 700; }
.metric-label { color: var(--muted); font-size: .82rem; }
.metric-hint { color: var(--muted); font-size: .75rem; margin-top: .2rem; }
.finding-list { margin: .35rem 0; padding-left: 1.2rem; }
.blind-spot { background: var(--warn-bg); color: var(--warn-fg); border-radius: 8px; padding: .75rem 1rem; margin-bottom: 1.25rem; font-size: .9rem; }
.issue { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; margin-bottom: .75rem; }
.issue-summary { cursor: pointer; padding: .65rem 1rem; }
.issue-summary::marker { color: var(--muted); }
.issue-title { font-weight: 600; }
.issue-status { display: inline-block; margin-left: .5rem; font-size: .78rem; padding: .1em .5em; border-radius: 4px; background: var(--neutral-bg); color: var(--neutral-fg); vertical-align: middle; }
.issue[open] .issue-summary { border-bottom: 1px solid var(--border); }
.issue-body { padding: .25rem 1rem 1rem; }
.issue-id { font-weight: 400; color: var(--muted); }
.issue-meta { display: flex; gap: .5rem; flex-wrap: wrap; margin: .5rem 0; }
.issue-meta span { font-size: .78rem; padding: .1em .5em; border-radius: 4px; background: var(--neutral-bg); color: var(--neutral-fg); }
.issue-refs { color: var(--muted); font-size: .82rem; }
@media (max-width: 30rem) {
  .page { padding: 1rem .85rem 3rem; }
  h1 { font-size: 1.5rem; }
  h2 { font-size: 1.2rem; }
  .verdict { padding: .85rem 1rem; }
  .section-nav a { margin-right: .75rem; }
  .metric { min-width: 6rem; flex-basis: 6rem; }
}
`.trim();
