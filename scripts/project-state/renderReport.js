/**
 * Reine Aufbereitung des Projektzustands zu einer in sich geschlossenen HTML-Seite
 * (ohne Datei- oder Netzzugriff, damit sie testbar bleibt). Eingabe ist ein fertiges
 * Datenmodell, Ausgabe der vollstaendige HTML-Text.
 *
 * "In sich geschlossen" heisst woertlich: die erzeugte Seite laedt keine Schriften,
 * Skripte oder Daten nach. Alles Layout liegt in einem eingebetteten `<style>`, die
 * Umschaltung der Bereiche ist reines CSS (versteckte Radio-Inputs mit Labels), es
 * gibt kein `<script>`. Damit funktioniert die Seite offline und veraltet nicht
 * durch entfernte Ressourcen.
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

const DEFAULT_REPORT_TITLE = 'Project Status Report';

/** Die beiden Bereiche der Seite -- als CSS-only-Tabs umschaltbar (siehe {@link renderTabs}). */
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
  [GateStatus.Passed]: { symbol: '✓', label: 'passed', tone: 'ok' },
  [GateStatus.Findings]: { symbol: '!', label: 'findings', tone: 'warn' },
  [GateStatus.NotRun]: { symbol: '∅', label: 'not run', tone: 'inert' },
});

const GATE_ENFORCEMENT_LABEL = Object.freeze({
  [GateEnforcement.Blocking]: 'blocking',
  [GateEnforcement.Warning]: 'warning only',
  [GateEnforcement.Unknown]: 'enforcement unknown',
});

const GATE_ABORT_REASON_LABEL = Object.freeze({
  [GateAbortReason.UnsupportedNodeVersion]: 'unsupported Node version',
  [GateAbortReason.ExecutableNotFound]: 'executable not found',
  [GateAbortReason.ModuleNotFound]: 'module not found',
  [GateAbortReason.NoRunRecorded]: 'no run recorded',
});

const UNKNOWN_PRESENTATION = Object.freeze({ symbol: '?', label: 'unknown', tone: 'neutral' });

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
 * @typedef {object} ModuleMetric  Codeumfang und Komplexitaet eines Moduls.
 * @property {string} module
 * @property {number} fileCount
 * @property {number} lines             Codezeilen (ohne Leerzeilen).
 * @property {number} functionCount
 * @property {number} totalComplexity   Summe der zyklomatischen Komplexitaet aller Funktionen.
 * @property {number} averageComplexity durchschnittliche zyklomatische Komplexitaet je Funktion.
 * @property {number} maxComplexity     hoechste zyklomatische Komplexitaet im Modul.
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
 * @property {ReadonlyArray<ModuleMetric>} [moduleMetrics]
 * @property {ReadonlyArray<import('./complexity.js').FunctionComplexity>} [complexFunctions]
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
    renderTabs(model),
  ].join('\n');

  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    renderDocumentHead(title),
    `<body>\n<main class="page">\n${body}\n</main>\n</body>`,
    '</html>',
    '',
  ].join('\n');
}

/**
 * Die beiden Bereiche als echte Tabs -- nur einer ist sichtbar, umgeschaltet wird
 * ohne JavaScript. Zwei versteckte Radio-Inputs tragen den Zustand; die Labels
 * daneben schalten sie um, und das Stylesheet blendet je nach angehaktem Radio
 * genau ein Panel ein (Geschwister-Selektor). Der Healthcheck ist der
 * Standard-Tab (`checked`). Die Radios stehen vor Umschalter und Panels, damit der
 * `~`-Selektor beide erreicht.
 *
 * @param {ReportModel} model
 */
function renderTabs(model) {
  const [healthcheck, issues] = [SECTIONS.healthcheck, SECTIONS.issues];
  return [
    '<div class="tabs">',
    `<input type="radio" name="report-tab" id="tab-${healthcheck.id}" class="tab-radio" checked>`,
    `<input type="radio" name="report-tab" id="tab-${issues.id}" class="tab-radio">`,
    '<nav class="tablist" role="tablist" aria-label="Sections">',
    renderTabLabel(healthcheck),
    renderTabLabel(issues),
    '</nav>',
    renderHealthcheckSection(model),
    renderIssuesSection(model),
    '</div>',
  ].join('\n');
}

/** @param {{ id: string, title: string }} section */
function renderTabLabel(section) {
  return `<label class="tab" for="tab-${section.id}" role="tab">${escapeHtml(section.title)}</label>`;
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
  return [
    '<header class="page-header">',
    '<div class="header-nav"><a href="../" class="back-link">← Back to landing page</a></div>',
    `<h1>${escapeHtml(title)}</h1>`,
    `<p class="generated-at">Captured: ${escapeHtml(generatedAt)}</p>`,
    '</header>',
  ].join('\n');
}

/** @param {OverallAssessment} assessment */
function renderOverallAssessment(assessment) {
  const facts = assessment.facts
    .map((fact) => `<li>${escapeHtml(fact)}</li>`)
    .join('');
  return [
    '<section class="verdict" aria-label="Overall verdict">',
    '<h2>Overall verdict</h2>',
    `<p class="verdict-headline">${escapeHtml(assessment.headline)}</p>`,
    `<ul class="verdict-facts">${facts}</ul>`,
    '</section>',
  ].join('\n');
}

/** @param {ReportModel} model */
function renderHealthcheckSection(model) {
  const { id } = SECTIONS.healthcheck;
  return [
    `<section id="${id}" class="section panel panel-${id}" role="tabpanel" aria-labelledby="tab-${id}">`,
    renderGates(model.gates),
    renderMetrics(model.metrics),
    renderModuleMetrics(model.moduleMetrics ?? []),
    renderCoverage(model.coverage),
    renderComplexFunctions(model.complexFunctions ?? []),
    renderLongFunctions(model.longFunctions),
    renderStructure(model.structure),
    '</section>',
  ].join('\n');
}

/** @param {ReadonlyArray<ModuleMetric>} moduleMetrics */
function renderModuleMetrics(moduleMetrics) {
  if (moduleMetrics.length === 0) {
    return renderSubsection('Size and complexity per module', renderEmpty('No production code captured.'));
  }
  const rows = moduleMetrics
    .map((entry) =>
      [
        '<tr>',
        `<td><code>${escapeHtml(entry.module)}</code></td>`,
        `<td class="num">${entry.fileCount}</td>`,
        `<td class="num">${entry.lines}</td>`,
        `<td class="num">${entry.functionCount}</td>`,
        `<td class="num">${entry.totalComplexity}</td>`,
        `<td class="num">${entry.averageComplexity}</td>`,
        `<td class="num">${entry.maxComplexity}</td>`,
        '</tr>',
      ].join(''),
    )
    .join('\n');
  return renderGridTable(
    'Size and complexity per module',
    '<th>Module</th><th>Files</th><th>Lines</th><th>Functions</th><th>&#931;&nbsp;complexity</th><th>&#216;&nbsp;complexity</th><th>max.&nbsp;complexity</th>',
    rows,
  );
}

/** @param {ReadonlyArray<import('./complexity.js').FunctionComplexity>} complexFunctions */
function renderComplexFunctions(complexFunctions) {
  if (complexFunctions.length === 0) {
    return renderSubsection('Most complex functions', renderEmpty('No functions captured.'));
  }
  const rows = complexFunctions
    .map((fn) =>
      [
        '<tr>',
        `<td><code>${escapeHtml(fn.name)}</code></td>`,
        `<td><code>${escapeHtml(fn.path)}</code></td>`,
        `<td class="num">${fn.complexity}</td>`,
        `<td class="num">${fn.startLine}</td>`,
        '</tr>',
      ].join(''),
    )
    .join('\n');
  return renderGridTable(
    'Most complex functions',
    '<th>Function</th><th>File</th><th>Complexity</th><th>Line</th>',
    rows,
  );
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

  return renderGridTable('Quality gates', '<th>Gate</th><th>State</th><th>Enforcement</th>', rows);
}

/** @param {import('./gates.js').GateState} gate */
function renderAbortReason(gate) {
  if (gate.status !== GateStatus.NotRun || !gate.abortReason) return '';
  const reason = GATE_ABORT_REASON_LABEL[gate.abortReason] ?? gate.abortReason;
  return ` <span class="reason">(${escapeHtml(reason)})</span>`;
}

/** @param {ReadonlyArray<Metric>} metrics */
function renderMetrics(metrics) {
  if (metrics.length === 0) return renderSubsection('Metrics', renderEmpty('No metrics captured.'));
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
  return renderSubsection('Metrics', `<ul class="metric-grid">${cards}</ul>`);
}

/** @param {ReadonlyArray<import('./coverage.js').ModuleCoverage>} coverage */
function renderCoverage(coverage) {
  if (coverage.length === 0) return renderSubsection('Test coverage per module', renderEmpty('No coverage data.'));
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
  return renderGridTable(
    'Test coverage per module',
    '<th>Module</th><th>Files</th><th>Statements</th><th>Branches</th><th>Functions</th>',
    rows,
  );
}

/** @param {import('./coverage.js').CoverageMetric} metric */
function renderMetricCell(metric) {
  return `<td class="num">${formatPercent(metric.percent)}<span class="fraction">${metric.covered}/${metric.total}</span></td>`;
}

/** @param {ReadonlyArray<import('./functions.js').LongFunction>} longFunctions */
function renderLongFunctions(longFunctions) {
  if (longFunctions.length === 0) {
    return renderSubsection('Longest functions', renderEmpty('No function over the threshold.'));
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
  return renderGridTable(
    'Longest functions',
    '<th>Function</th><th>File</th><th>Lines</th><th>Range</th>',
    rows,
  );
}

/** @param {StructureFacts} structure */
function renderStructure(structure) {
  const facts = [
    `<li class="metric"><span class="metric-value">${structure.moduleCount}</span><span class="metric-label">Modules</span></li>`,
    `<li class="metric"><span class="metric-value">${structure.dependencyCount}</span><span class="metric-label">Dependencies</span></li>`,
  ].join('\n');
  return renderSubsection(
    'Structure facts',
    [
      `<ul class="metric-grid">${facts}</ul>`,
      renderStructureFinding('Import cycles', structure.cycles.map((cycle) => cycle.join(' → ')), 'No cycles.'),
      renderStructureFinding(
        'Layer violations',
        structure.layerViolations.map((v) => `${v.from} → ${v.to} (${v.fromLayer} must not depend on ${v.toLayer})`),
        'No layer violations.',
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
  const { id } = SECTIONS.issues;
  return [
    `<section id="${id}" class="section panel panel-${id}" role="tabpanel" aria-labelledby="tab-${id}">`,
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
      ? 'no refs captured'
      : refs.map((ref) => `<code>${escapeHtml(ref)}</code>`).join(', ');
  return [
    '<aside class="blind-spot" role="note">',
    '<strong>Blind spot:</strong> Only pushed branches are captured. A CI runner cannot see purely local ',
    'branches; issues that exist only locally are missing here.',
    `<br>Captured: ${refList}.`,
    '</aside>',
  ].join('');
}

/** @param {ReadonlyArray<import('./issues.js').OpenIssue>} openIssues */
function renderOpenIssues(openIssues) {
  if (openIssues.length === 0) return renderEmpty('No open issues.');
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
    issue.blockedBy.length ? `<span class="issue-blocked">blocked by ${escapeHtml(issue.blockedBy.join(', '))}</span>` : '',
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
  return `<p class="issue-refs">Seen on: ${list}</p>`;
}

/** @param {ReadonlyArray<import('./issues.js').UnreadableIssue>} unreadable */
function renderUnreadableIssues(unreadable) {
  if (unreadable.length === 0) return '';
  const items = unreadable
    .map((entry) => `<li><code>${escapeHtml(entry.id)}</code> auf <code>${escapeHtml(entry.ref)}</code>: ${escapeHtml(entry.reason)}</li>`)
    .join('');
  return [
    '<aside class="blind-spot" role="note">',
    '<strong>Unreadable:</strong> These issues could not be parsed and are missing above.',
    `<ul class="finding-list">${items}</ul>`,
    '</aside>',
  ].join('');
}

/** Eine benannte Untergruppe innerhalb eines Bereichs. */
function renderSubsection(title, innerHtml) {
  return `<div class="subsection"><h3>${escapeHtml(title)}</h3>${innerHtml}</div>`;
}

/**
 * Eine benannte, breiten-scrollbare Tabelle im Gitter-Stil. Alle Tabellen des
 * Berichts teilen sich dieselbe Huelle (Untergruppe + `overflow-x`-Container +
 * `table.grid`); nur Kopf und Zeilen unterscheiden sich.
 *
 * @param {string} title
 * @param {string} headerCells  die fertigen `<th>`-Zellen der Kopfzeile
 * @param {string} rows         die fertigen `<tr>`-Zeilen
 */
function renderGridTable(title, headerCells, rows) {
  return renderSubsection(
    title,
    wrapScrollable(`<table class="grid"><thead><tr>${headerCells}</tr></thead><tbody>${rows}</tbody></table>`),
  );
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
 * Das eingebettete Stylesheet. Es nimmt den Look der Anwendung auf (ADR 0004,
 * Gothic-/Tabletop-Thema): Pergament, Gold und Obsidian-Dunkel. Die Farbwerte sind
 * aus `src/styles/01-tokens.css` uebernommen (kopiert, nicht importiert -- die Seite
 * bleibt eigenstaendig). Schriften sind bewusst self-contained: kein Nachladen von
 * Google Fonts, sondern der Fallback-Serifen-Stack der App; der App-Look wird ueber
 * Palette, Gold und Layout getragen, nicht ueber Cinzel/Lora selbst. Helles und
 * dunkles Erscheinungsbild ueber `prefers-color-scheme`, beide in der App-Palette.
 * Die Zustaende tragen ihre Bedeutung ueber Symbol und Text; die Farben sind Zugabe.
 *
 * Die beiden Bereiche sind echte Tabs, ganz ohne JavaScript: versteckte
 * Radio-Inputs tragen den Zustand, Labels schalten sie um, und der
 * Geschwister-Selektor blendet je genau ein Panel ein.
 *
 * Das Layout ist durchgehend in relativen Einheiten gehalten und mobil-tauglich:
 * breite Tabellen liegen je in einem eigenen `overflow-x`-Container (`.table-scroll`),
 * lange Zeichenketten brechen um (`overflow-wrap`), und eine Media Query fuer schmale
 * Viewports strafft die Abstaende -- so bleibt die Seite bei ~375 px ohne
 * horizontales Scrollen lesbar.
 */
const REPORT_STYLES = `
:root {
  color-scheme: dark;
  --font-heading: "Cinzel", Georgia, serif;
  --font-subheading: "Outfit", sans-serif;
  --font-body: "Inter", system-ui, sans-serif;
  --font-mono: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
  
  --bg: #07090E;
  --surface: rgba(21, 26, 38, 0.85);
  --surface-2: #151A26;
  --text: #F1F5F9;
  --muted: #94A3B8;
  --border: rgba(212, 175, 55, 0.25);
  --border-strong: #D4AF37;
  --accent: #F5D061;
  --accent-strong: #F5D061;
  
  --ok-bg: rgba(16, 185, 129, 0.2); --ok-fg: #34D399;
  --warn-bg: rgba(217, 119, 6, 0.25); --warn-fg: #FBBF24;
  --inert-bg: rgba(255, 255, 255, 0.05); --inert-fg: #94A3B8;
  --neutral-bg: rgba(59, 130, 246, 0.2); --neutral-fg: #60A5FA;
  --shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.8);
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; color-scheme: dark; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-body);
  line-height: 1.6;
  overflow-wrap: break-word;
}
.page { max-width: 65rem; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
.page-header { border-bottom: 2px solid var(--border); padding-bottom: 1.25rem; margin-bottom: 2rem; }
.header-nav { margin-bottom: 0.75rem; }
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.85rem;
  border-radius: 6px;
  background: rgba(212, 175, 55, 0.1);
  border: 1px solid var(--border);
  color: var(--accent);
  font-family: var(--font-subheading);
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s ease;
}
.back-link:hover {
  background: rgba(212, 175, 55, 0.25);
  color: #FFF;
  border-color: var(--border-strong);
  box-shadow: 0 0 12px rgba(212, 175, 55, 0.2);
}
h1 { font-family: var(--font-heading); font-size: 2.2rem; font-weight: 700; letter-spacing: .02em; color: var(--accent-strong); margin: 0 0 .35rem; }
h2 { font-family: var(--font-heading); font-size: 1.5rem; font-weight: 700; letter-spacing: .02em; color: var(--accent-strong); margin: 0 0 .75rem; border-bottom: 1px solid var(--border); padding-bottom: .4rem; }
h3 { font-family: var(--font-subheading); font-size: 1.2rem; font-weight: 600; color: var(--accent); margin: 1.5rem 0 .5rem; }
h4 { font-size: .95rem; margin: 1rem 0 .35rem; color: var(--muted); }
.generated-at { color: var(--muted); margin: 0 0 .25rem; font-size: .9rem; font-family: var(--font-subheading); }
.section { margin-bottom: 1.5rem; }
.subsection { margin-bottom: 1.75rem; }
.empty { color: var(--muted); font-size: .9rem; }
.tabs { position: relative; }
.tab-radio { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; border: 0; opacity: 0; pointer-events: none; }
.tablist { display: flex; flex-wrap: wrap; gap: .5rem; border-bottom: 2px solid var(--border); margin: 0 0 1.75rem; }
.tab { cursor: pointer; user-select: none; padding: .6rem 1.25rem; font-family: var(--font-heading); font-weight: 700; letter-spacing: .05em; text-transform: uppercase; font-size: .9rem; color: var(--muted); border: 1px solid transparent; border-bottom: none; border-radius: 8px 8px 0 0; transition: all 0.2s ease; }
.tab:hover { color: var(--accent); background: rgba(255, 255, 255, 0.03); }
.panel { display: none; }
#tab-healthcheck:checked ~ .panel-healthcheck,
#tab-issues:checked ~ .panel-issues { display: block; }
#tab-healthcheck:checked ~ .tablist label[for="tab-healthcheck"],
#tab-issues:checked ~ .tablist label[for="tab-issues"] {
  color: var(--accent-strong);
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-bottom: 2px solid var(--bg);
  margin-bottom: -2px;
}
.verdict { background: var(--surface); border: 1px solid var(--border); border-left: 4px solid var(--border-strong); border-radius: 12px; padding: 1.25rem 1.5rem; margin-bottom: 2rem; box-shadow: var(--shadow); backdrop-filter: blur(8px); }
.verdict h2 { border-bottom: none; margin-bottom: .25rem; }
.verdict-headline { font-size: 1.2rem; font-weight: 600; margin: .25rem 0 .5rem; color: var(--text); }
.verdict-facts { list-style: none; padding: 0; margin: .5rem 0 0; display: flex; flex-direction: column; gap: .35rem; }
.verdict-facts li { color: var(--muted); font-size: .92rem; }
.prose :first-child { margin-top: 0; }
.prose :last-child { margin-bottom: 0; }
code { font-family: var(--font-mono); font-size: .85em; color: var(--accent); background: rgba(255, 255, 255, 0.05); padding: 0.15em 0.4em; border-radius: 4px; border: 1px solid rgba(255, 255, 255, 0.08); }
.table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; margin-top: .75rem; border-radius: 8px; border: 1px solid var(--border); }
table.grid { width: 100%; border-collapse: collapse; font-size: .9rem; background: var(--surface); }
table.grid th, table.grid td { text-align: left; padding: .65rem .85rem; border-bottom: 1px solid rgba(255, 255, 255, 0.06); vertical-align: middle; }
table.grid th { color: var(--accent); font-family: var(--font-subheading); font-weight: 600; background: rgba(0, 0, 0, 0.3); border-bottom: 1px solid var(--border); }
td.num { text-align: right; white-space: nowrap; }
.fraction { display: block; color: var(--muted); font-size: .8em; }
.badge { display: inline-flex; align-items: center; gap: .35em; padding: .25em .65em; border-radius: 999px; font-size: .82rem; font-weight: 600; font-family: var(--font-subheading); }
.badge-symbol { font-weight: 700; }
.badge-ok { background: var(--ok-bg); color: var(--ok-fg); border: 1px solid rgba(16, 185, 129, 0.3); }
.badge-warn { background: var(--warn-bg); color: var(--warn-fg); border: 1px solid rgba(217, 119, 6, 0.3); }
.badge-inert { background: var(--inert-bg); color: var(--inert-fg); border: 1px dashed var(--border); }
.badge-neutral { background: var(--neutral-bg); color: var(--neutral-fg); border: 1px solid rgba(59, 130, 246, 0.3); }
.reason { color: var(--muted); font-size: .88rem; }
.metric-grid { list-style: none; display: flex; flex-wrap: wrap; gap: 1rem; padding: 0; margin: .75rem 0; }
.metric { background: var(--surface); border: 1px solid var(--border); border-top: 3px solid var(--border-strong); border-radius: 12px; padding: .85rem 1.1rem; min-width: 8rem; flex: 1 1 8rem; display: flex; flex-direction: column; box-shadow: var(--shadow); }
.metric-value { font-family: var(--font-heading); font-size: 1.75rem; font-weight: 700; color: var(--accent-strong); }
.metric-label { color: var(--muted); font-size: .85rem; font-family: var(--font-subheading); }
.metric-hint { color: var(--muted); font-size: .78rem; margin-top: .25rem; }
.finding-list { margin: .35rem 0; padding-left: 1.2rem; }
.blind-spot { background: var(--warn-bg); color: var(--warn-fg); border-radius: 8px; padding: .75rem 1rem; margin-bottom: 1.25rem; font-size: .9rem; border: 1px solid rgba(217, 119, 6, 0.3); }
.issue { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; margin-bottom: 1rem; box-shadow: var(--shadow); overflow: hidden; }
.issue-summary { cursor: pointer; padding: .85rem 1.1rem; font-family: var(--font-subheading); }
.issue-summary::marker { color: var(--accent); }
.issue-title { font-weight: 600; font-size: 1.05rem; }
.issue-status { display: inline-block; margin-left: .5rem; font-size: .78rem; padding: .15em .6em; border-radius: 6px; background: var(--neutral-bg); color: var(--neutral-fg); border: 1px solid rgba(59, 130, 246, 0.3); vertical-align: middle; }
.issue[open] .issue-summary { border-bottom: 1px solid var(--border); background: rgba(0, 0, 0, 0.2); }
.issue-body { padding: .75rem 1.25rem 1.25rem; }
.issue-id { font-weight: 400; color: var(--muted); }
.issue-meta { display: flex; gap: .5rem; flex-wrap: wrap; margin: .5rem 0 1rem; }
.issue-meta span { font-size: .78rem; padding: .15em .6em; border-radius: 6px; background: var(--neutral-bg); color: var(--neutral-fg); border: 1px solid rgba(59, 130, 246, 0.3); }
.issue-refs { color: var(--muted); font-size: .82rem; margin-top: 0.75rem; }
@media (max-width: 30rem) {
  .page { padding: 1rem .85rem 3rem; }
  h1 { font-size: 1.75rem; }
  h2 { font-size: 1.25rem; }
  .verdict { padding: 1rem; }
  .tab { padding: .5rem .9rem; font-size: .82rem; }
  .metric { min-width: 7rem; flex-basis: 7rem; }
}
`.trim();
