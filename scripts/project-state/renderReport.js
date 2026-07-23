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
import { issueTitleFromId } from './issues.js';

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
 * @typedef {object} ReportModel  Das reine Datenmodell, aus dem die Seite entsteht.
 * @property {string} [title]
 * @property {string} generatedAt  Fertiger Anzeigetext des Erhebungszeitpunkts.
 * @property {ReadonlyArray<import('./gates.js').GateState>} gates
 * @property {ReadonlyArray<Metric>} metrics
 * @property {ReadonlyArray<import('./coverage.js').ModuleCoverage>} coverage
 * @property {ReadonlyArray<ModuleMetric>} [moduleMetrics]
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


/** @param {ReportModel} model */
function renderHealthcheckSection(model) {
  const { id } = SECTIONS.healthcheck;
  return [
    `<section id="${id}" class="section panel panel-${id}" role="tabpanel" aria-labelledby="tab-${id}">`,
    renderGates(model.gates),
    renderModuleTiles(model.moduleMetrics ?? [], model.coverage ?? []),
    '</section>',
  ].join('\n');
}

/**
 * Baut Kacheln pro Modul mit je zwei Reagenzgläsern (Komplexität & Testabdeckung).
 *
 * @param {ReadonlyArray<ModuleMetric>} moduleMetrics
 * @param {ReadonlyArray<import('./coverage.js').ModuleCoverage>} coverage
 */
function renderModuleTiles(moduleMetrics, coverage) {
  if (moduleMetrics.length === 0 && coverage.length === 0) {
    return renderSubsection('Module health & metrics', renderEmpty('No module data captured.'));
  }

  const coverageByModule = new Map(coverage.map((c) => [c.module, c]));
  const allModules = new Map();

  for (const m of moduleMetrics) {
    allModules.set(m.module, {
      module: m.module,
      fileCount: m.fileCount,
      lines: m.lines,
      functionCount: m.functionCount,
      totalComplexity: m.totalComplexity,
      averageComplexity: m.averageComplexity,
      maxComplexity: m.maxComplexity,
      coverage: coverageByModule.get(m.module) ?? null,
    });
  }

  for (const c of coverage) {
    if (!allModules.has(c.module)) {
      allModules.set(c.module, {
        module: c.module,
        fileCount: c.fileCount,
        lines: 0,
        functionCount: 0,
        totalComplexity: 0,
        averageComplexity: 0,
        maxComplexity: 0,
        coverage: c,
      });
    }
  }

  const modules = Array.from(allModules.values());

  // Sortierung: Von schlecht (hohe Komplexitaet / niedrige Abdeckung) nach gut
  modules.sort((a, b) => {
    const covA = a.coverage?.statements.percent ?? 0;
    const covB = b.coverage?.statements.percent ?? 0;
    return b.totalComplexity - a.totalComplexity || covA - covB || b.lines - a.lines;
  });

  const maxTotalComplexity = Math.max(...modules.map((m) => m.totalComplexity), 1);

  const cards = modules.map((item) => renderModuleCard(item, maxTotalComplexity)).join('\n');

  return renderSubsection(
    'Module health & metrics',
    `<div class="module-grid">${cards}</div>`,
  );
}

function renderModuleCard(item, maxTotalComplexity) {
  const cov = item.coverage;

  // Komplexitaets-Reagenzglas
  const complexityPct = Math.min(100, Math.max(10, Math.round((item.totalComplexity / maxTotalComplexity) * 100)));
  const complexityTone =
    item.totalComplexity >= 100 || item.averageComplexity >= 5
      ? 'bad'
      : item.totalComplexity >= 30 || item.averageComplexity >= 3
        ? 'warn'
        : 'good';

  const complexityTooltip = [
    `<div class="tooltip-header">Complexity: <code>${escapeHtml(item.module)}</code></div>`,
    '<div class="tooltip-grid">',
    `<div><span>Files:</span> <strong>${item.fileCount}</strong></div>`,
    `<div><span>Lines:</span> <strong>${item.lines}</strong></div>`,
    `<div><span>Functions:</span> <strong>${item.functionCount}</strong></div>`,
    `<div><span>&#931; complexity:</span> <strong>${item.totalComplexity}</strong></div>`,
    `<div><span>&#216; complexity:</span> <strong>${item.averageComplexity}</strong></div>`,
    `<div><span>max complexity:</span> <strong>${item.maxComplexity}</strong></div>`,
    '</div>',
  ].join('');

  // Coverage-Reagenzglas
  const covPct = cov ? Math.min(100, Math.max(10, Math.round(cov.statements.percent))) : 0;
  const covTone = !cov
    ? 'bad'
    : cov.statements.percent < 60
      ? 'bad'
      : cov.statements.percent < 80
        ? 'warn'
        : 'good';

  const covTooltip = cov
    ? [
        `<div class="tooltip-header">Coverage: <code>${escapeHtml(item.module)}</code></div>`,
        '<div class="tooltip-grid">',
        `<div><span>Statements:</span> <strong>${formatPercent(cov.statements.percent)} (${cov.statements.covered}/${cov.statements.total})</strong></div>`,
        `<div><span>Branches:</span> <strong>${formatPercent(cov.branches.percent)} (${cov.branches.covered}/${cov.branches.total})</strong></div>`,
        `<div><span>Functions:</span> <strong>${formatPercent(cov.functions.percent)} (${cov.functions.covered}/${cov.functions.total})</strong></div>`,
        '</div>',
      ].join('')
    : `<div class="tooltip-header">No test coverage data</div>`;

  return [
    '<div class="module-card">',
    '<div class="module-card-header">',
    `<div class="module-card-title"><code>${escapeHtml(item.module)}</code></div>`,
    `<div class="module-card-meta"><span>${item.fileCount} files</span> &bull; <span>${item.lines} lines</span></div>`,
    '</div>',
    '<div class="module-vials-row">',
    // Complexity Vial
    '<div class="vial-container">',
    '<span class="vial-label">Complexity</span>',
    '<div class="vial">',
    `<div class="vial-liquid vial-liquid-${complexityTone}" style="height: ${complexityPct}%">`,
    '<div class="vial-bubbles"></div>',
    '</div>',
    '</div>',
    `<span class="vial-value-badge">&Sigma;&nbsp;${item.totalComplexity}</span>`,
    `<div class="vial-tooltip" role="tooltip">${complexityTooltip}</div>`,
    '</div>',
    // Coverage Vial
    '<div class="vial-container">',
    '<span class="vial-label">Coverage</span>',
    '<div class="vial">',
    `<div class="vial-liquid vial-liquid-${covTone}" style="height: ${covPct}%">`,
    '<div class="vial-bubbles"></div>',
    '</div>',
    '</div>',
    `<span class="vial-value-badge">${cov ? formatPercent(cov.statements.percent) : 'N/A'}</span>`,
    `<div class="vial-tooltip" role="tooltip">${covTooltip}</div>`,
    '</div>',
    '</div>',
    '</div>',
  ].join('');
}

const GATE_RUNE_EMBLEMS = Object.freeze({
  lint: 'ᛏ',        // Tiwaz (Order, Precision)
  knip: 'ᚦ',        // Thurisaz (Cleansing, Pruning)
  depcruise: 'ᚱ',   // Raido (Structure, Pathways)
  typecheck: 'ᚨ',   // Ansuz (Wisdom, Truth)
  'unit-tests': 'ᛉ', // Algiz (Protection, Verification)
});

/** @param {import('./gates.js').GateState} gate */
function getGateRune(gate) {
  return GATE_RUNE_EMBLEMS[gate.id] ?? 'ᛟ';
}

/** @param {ReadonlyArray<import('./gates.js').GateState>} gates */
function renderGates(gates) {
  if (gates.length === 0) {
    return renderSubsection('Quality Gates', renderEmpty('No quality gates recorded.'));
  }

  const items = gates
    .map((gate) => {
      const status = GATE_STATUS_PRESENTATION[gate.status] ?? UNKNOWN_PRESENTATION;
      const enforcement = GATE_ENFORCEMENT_LABEL[gate.enforcement] ?? GATE_ENFORCEMENT_LABEL[GateEnforcement.Unknown];
      const abortReasonText = gate.status === GateStatus.NotRun && gate.abortReason
        ? (GATE_ABORT_REASON_LABEL[gate.abortReason] ?? gate.abortReason)
        : null;

      const runeGlyph = getGateRune(gate);

      const tooltipContent = [
        `<div class="tooltip-header">Gate: <strong>${escapeHtml(gate.label)}</strong></div>`,
        '<div class="tooltip-grid">',
        `<div><span>Command:</span> <code>${escapeHtml(gate.command)}</code></div>`,
        `<div><span>Status:</span> <strong>${escapeHtml(status.label)}</strong></div>`,
        `<div><span>Enforcement:</span> <strong>${escapeHtml(enforcement)}</strong></div>`,
        abortReasonText ? `<div><span>Reason:</span> <strong>${escapeHtml(abortReasonText)}</strong></div>` : '',
        '</div>',
      ].join('');

      return [
        '<div class="gate-card rune-card">',
        '<div class="rune-wrapper">',
        `<div class="rune-stone rune-${status.tone}">`,
        `<span class="rune-glyph" title="Rune ${escapeHtml(runeGlyph)}">${escapeHtml(runeGlyph)}</span>`,
        '</div>',
        '</div>',
        `<span class="gate-card-label">${escapeHtml(gate.label)}</span>`,
        `<span class="gate-card-status gate-card-status-${status.tone}">${escapeHtml(status.label)}</span>`,
        `<div class="gate-tooltip" role="tooltip">${tooltipContent}</div>`,
        '</div>',
      ].join('');
    })
    .join('\n');

  return renderSubsection(
    'Quality Gates',
    `<div class="rune-grid">${items}</div>`,
  );
}


/** @param {ReportModel} model */
function renderIssuesSection(model) {
  const { id } = SECTIONS.issues;
  return [
    `<section id="${id}" class="section panel panel-${id}" role="tabpanel" aria-labelledby="tab-${id}">`,
    renderOpenIssues(model.openIssues),
    renderUnreadableIssues(model.unreadableIssues ?? []),
    '</section>',
  ].join('\n');
}

/** @param {ReadonlyArray<import('./issues.js').OpenIssue>} openIssues */
/** @param {ReadonlyArray<import('./issues.js').OpenIssue>} openIssues */
function renderOpenIssues(openIssues) {
  if (openIssues.length === 0) return renderEmpty('No open issues.');

  /** @type {Map<string, { parentId: string, mainIssue: import('./issues.js').OpenIssue|null, children: import('./issues.js').OpenIssue[] }>} */
  const groupMap = new Map();

  for (const issue of openIssues) {
    const parts = issue.id.split('/');
    const parentId = parts[0];

    if (!groupMap.has(parentId)) {
      groupMap.set(parentId, { parentId, mainIssue: null, children: [] });
    }
    const group = groupMap.get(parentId);
    if (parts.length === 1) {
      group.mainIssue = issue;
    } else {
      group.children.push(issue);
    }
  }

  const renderedGroups = [];

  for (const group of groupMap.values()) {
    if (group.mainIssue && group.children.length === 0) {
      renderedGroups.push(renderOpenIssue(group.mainIssue));
    } else if (!group.mainIssue && group.children.length === 1) {
      renderedGroups.push(renderOpenIssue(group.children[0]));
    } else {
      renderedGroups.push(renderHierarchicalIssueGroup(group));
    }
  }

  return renderedGroups.join('\n');
}

/**
 * Rendert eine Haupt-Issue mit ihren untergeordneten Child-Issues hierarchisch.
 * @param {{ parentId: string, mainIssue: import('./issues.js').OpenIssue|null, children: import('./issues.js').OpenIssue[] }} group
 */
function renderHierarchicalIssueGroup(group) {
  if (group.mainIssue) {
    const badgeTone = group.mainIssue.status.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    const renderedChildren = group.children.map((child) => renderOpenIssue(child, true)).join('\n');
    return [
      `<details class="issue issue-card issue-card-parent" id="issue-${escapeHtml(anchorId(group.mainIssue.id))}">`,
      renderIssueSummary(group.mainIssue, badgeTone),
      '<div class="issue-body issue-card-body">',
      renderIssueMeta(group.mainIssue),
      renderIssueSections(group.mainIssue.sections),
      renderIssueRefs(group.mainIssue.refs),
      renderedChildren ? `<h4>Child Issues</h4><div class="issue-children-list">${renderedChildren}</div>` : '',
      '</div>',
      '</details>',
    ].join('\n');
  }

  const parentTitle = issueTitleFromId(group.parentId);
  const renderedChildren = group.children.map((child) => renderOpenIssue(child, true)).join('\n');
  return [
    `<details class="issue issue-card issue-card-parent" id="issue-${escapeHtml(anchorId(group.parentId))}" open>`,
    '<summary class="issue-summary issue-card-summary">',
    '<div class="issue-card-header-main">',
    `<span class="issue-title issue-card-title">${escapeHtml(parentTitle)}</span>`,
    '</div>',
    `<span class="issue-status-badge badge-neutral">${group.children.length} active</span>`,
    '</summary>',
    '<div class="issue-body issue-card-body">',
    `<div class="issue-children-list">${renderedChildren}</div>`,
    '</div>',
    '</details>',
  ].join('\n');
}

/**
 * Ein offener Vorgang als natives, ausklappbares `<details>` -- ohne JavaScript.
 * Im zusammengeklappten Zustand wird exklusiv das Wesentliche (Titel und Status-Badge) dargestellt.
 *
 * @param {import('./issues.js').OpenIssue} issue
 * @param {boolean} [isSubIssue=false]
 */
function renderOpenIssue(issue, isSubIssue = false) {
  const badgeTone = issue.status.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  const cardClass = isSubIssue ? 'issue issue-card issue-card-sub' : 'issue issue-card';
  return [
    `<details class="${cardClass}" id="issue-${escapeHtml(anchorId(issue.id))}">`,
    renderIssueSummary(issue, badgeTone),
    '<div class="issue-body issue-card-body">',
    renderIssueMeta(issue),
    renderIssueSections(issue.sections),
    renderIssueRefs(issue.refs),
    '</div>',
    '</details>',
  ].join('\n');
}

/** Die stets sichtbare, kompakte Zeile eines Vorgangs: Nur das Wesentliche (Titel & Status). */
function renderIssueSummary(issue, badgeTone) {
  return [
    '<summary class="issue-summary issue-card-summary">',
    '<div class="issue-card-header-main">',
    `<span class="issue-title issue-card-title">${escapeHtml(issue.title)}</span>`,
    '</div>',
    `<span class="issue-status-badge badge-${badgeTone}">${escapeHtml(issue.status)}</span>`,
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

/** @param {string} text */
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
  background-color: var(--bg);
  background-image: linear-gradient(180deg, rgba(7, 9, 14, 0.72) 0%, rgba(7, 9, 14, 0.88) 100%), url('../assets/status_bg.jpg');
  background-attachment: fixed;
  background-position: center center;
  background-repeat: no-repeat;
  background-size: cover;
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
.badge { display: inline-flex; align-items: center; gap: .35em; padding: .2em .6em; border-radius: 4px; font-size: .75rem; font-weight: 700; font-family: var(--font-subheading); text-transform: uppercase; letter-spacing: 0.04em; }
.badge-symbol { font-weight: 700; }
.badge-ok { background: var(--ok-bg); color: var(--ok-fg); border: 1px solid rgba(16, 185, 129, 0.3); }
.badge-warn { background: var(--warn-bg); color: var(--warn-fg); border: 1px solid rgba(217, 119, 6, 0.3); }
.badge-inert { background: var(--inert-bg); color: var(--inert-fg); border: 1px dashed var(--border); }
.badge-neutral { background: var(--neutral-bg); color: var(--neutral-fg); border: 1px solid rgba(59, 130, 246, 0.3); }
.reason { color: var(--muted); font-size: .88rem; }
@keyframes runePulse {
  0%, 100% { transform: scale(1); filter: drop-shadow(0 0 6px currentColor); }
  50% { transform: scale(1.05); filter: drop-shadow(0 0 16px currentColor); }
}
.rune-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr)); gap: 1.1rem; margin-top: 1rem; }
.rune-card { position: relative; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.25rem 0.85rem 1rem; box-shadow: var(--shadow); display: flex; flex-direction: column; align-items: center; gap: 0.65rem; cursor: help; transition: all 0.25s ease; }
.rune-card:hover { transform: translateY(-4px); border-color: var(--border-strong); box-shadow: 0 12px 28px -5px rgba(212, 175, 55, 0.25); }
.rune-wrapper { position: relative; width: 4rem; height: 4rem; display: flex; align-items: center; justify-content: center; margin: 0.2rem 0; }
.rune-stone { width: 3.6rem; height: 3.6rem; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #1e2638 0%, #0d121c 100%); border: 2px solid rgba(212, 175, 55, 0.4); box-shadow: inset 0 2px 6px rgba(255, 255, 255, 0.1), inset 0 -4px 8px rgba(0, 0, 0, 0.8), 0 4px 12px rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; }
.rune-ok { border-color: rgba(52, 211, 153, 0.6); color: #34d399; }
.rune-ok .rune-glyph { color: #34d399; text-shadow: 0 0 10px #10b981, 0 0 20px rgba(16, 185, 129, 0.7); animation: runePulse 3.5s infinite ease-in-out; }
.rune-warn { border-color: rgba(248, 113, 113, 0.6); color: #f87171; }
.rune-warn .rune-glyph { color: #f87171; text-shadow: 0 0 10px #ef4444, 0 0 20px rgba(239, 68, 68, 0.7); animation: runePulse 2.5s infinite ease-in-out; }
.rune-inert { border-color: rgba(107, 114, 128, 0.3); color: #4b5563; }
.rune-inert .rune-glyph { color: #4b5563; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9); }
.rune-glyph { font-family: serif; font-size: 1.8rem; font-weight: 900; line-height: 1; user-select: none; }
.gate-card-label { font-family: var(--font-subheading); font-size: 0.86rem; font-weight: 700; color: var(--accent-strong); text-align: center; }
.gate-card-status { font-size: 0.72rem; font-family: var(--font-subheading); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
.gate-card-status-ok { color: var(--ok-fg); }
.gate-card-status-warn { color: var(--warn-fg); }
.gate-card-status-inert { color: var(--muted); }
.gate-card .gate-tooltip { position: absolute; bottom: 110%; left: 50%; transform: translateX(-50%); opacity: 0; pointer-events: none; background: #111622; border: 1px solid var(--border-strong); border-radius: 8px; padding: 0.65rem 0.85rem; box-shadow: var(--shadow); z-index: 100; width: 14.5rem; transition: opacity 0.2s ease, transform 0.2s ease; }
.gate-card:hover .gate-tooltip { opacity: 1; pointer-events: auto; transform: translateX(-50%) translateY(-4px); }
@keyframes bubbleRise1 {
  0% { transform: translateY(0) scale(0.6); opacity: 0; }
  30% { opacity: 0.8; }
  85% { opacity: 0.8; }
  100% { transform: translateY(-4.5rem) scale(1.1); opacity: 0; }
}
@keyframes bubbleRise2 {
  0% { transform: translateY(0) scale(0.5); opacity: 0; }
  40% { opacity: 0.9; }
  90% { opacity: 0.9; }
  100% { transform: translateY(-5rem) scale(1); opacity: 0; }
}
.module-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr)); gap: 1.25rem; margin-top: 1rem; }
.module-card { position: relative; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1rem 1.1rem; box-shadow: var(--shadow); display: flex; flex-direction: column; justify-content: space-between; gap: 0.85rem; transition: all 0.25s ease; }
.module-card:hover { transform: translateY(-4px); border-color: var(--border-strong); box-shadow: 0 12px 28px -5px rgba(212, 175, 55, 0.25); }
.module-card-header { border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 0.45rem; }
.module-card-title { font-family: var(--font-subheading); font-size: 0.92rem; font-weight: 700; color: var(--accent-strong); word-break: break-all; }
.module-card-meta { font-size: 0.76rem; color: var(--muted); margin-top: 0.25rem; display: flex; gap: 0.5rem; }
.module-vials-row { display: flex; justify-content: space-around; align-items: flex-end; padding: 0.4rem 0.5rem; gap: 1rem; }
.vial-container { position: relative; display: flex; flex-direction: column; align-items: center; gap: 0.35rem; flex: 1; cursor: help; }
.vial-label { font-family: var(--font-subheading); font-size: 0.72rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
.vial { position: relative; width: 2.2rem; height: 6.5rem; background: rgba(8, 12, 20, 0.75); border: 2px solid rgba(212, 175, 55, 0.45); border-radius: 4px 4px 16px 16px; box-shadow: inset 2px 0 4px rgba(255, 255, 255, 0.2), inset -2px 0 5px rgba(0, 0, 0, 0.7), 0 4px 12px rgba(0, 0, 0, 0.6); overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end; }
.vial::before { content: ""; position: absolute; top: 0; left: -2px; right: -2px; height: 5px; background: rgba(212, 175, 55, 0.7); border-radius: 3px 3px 0 0; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.8); z-index: 5; }
.vial::after { content: ""; position: absolute; top: 5px; left: 3px; width: 3px; bottom: 8px; background: linear-gradient(180deg, rgba(255, 255, 255, 0.45), rgba(255, 255, 255, 0.05)); border-radius: 2px; z-index: 6; pointer-events: none; }
.vial-liquid { position: relative; width: 100%; border-radius: 0 0 14px 14px; transition: height 0.6s cubic-bezier(0.4, 0, 0.2, 1); overflow: hidden; }
.vial-bubbles { position: absolute; inset: 0; pointer-events: none; }
.vial-bubbles::before, .vial-bubbles::after { content: ""; position: absolute; bottom: -4px; background: rgba(255, 255, 255, 0.7); border-radius: 50%; box-shadow: 0 0 3px rgba(255, 255, 255, 0.9); }
.vial-bubbles::before { left: 25%; width: 4px; height: 4px; animation: bubbleRise1 2.2s infinite linear; }
.vial-bubbles::after { left: 60%; width: 3px; height: 3px; animation: bubbleRise2 2.8s infinite linear 0.9s; }
.vial-liquid-bad { background: linear-gradient(180deg, #F87171 0%, #DC2626 100%); box-shadow: 0 0 10px rgba(239, 68, 68, 0.5); }
.vial-liquid-warn { background: linear-gradient(180deg, #FBBF24 0%, #D97706 100%); box-shadow: 0 0 10px rgba(245, 208, 97, 0.4); }
.vial-liquid-good { background: linear-gradient(180deg, #34D399 0%, #059669 100%); box-shadow: 0 0 10px rgba(52, 211, 153, 0.4); }
.vial-value-badge { font-family: var(--font-mono); font-size: 0.78rem; font-weight: 700; color: var(--accent); }
.vial-container .vial-tooltip { position: absolute; bottom: 110%; left: 50%; transform: translateX(-50%); opacity: 0; pointer-events: none; background: #111622; border: 1px solid var(--border-strong); border-radius: 8px; padding: 0.65rem 0.85rem; box-shadow: var(--shadow); z-index: 100; width: 14rem; transition: opacity 0.2s ease, transform 0.2s ease; }
.vial-container:hover .vial-tooltip { opacity: 1; pointer-events: auto; transform: translateX(-50%) translateY(-4px); }
.tooltip-header { border-bottom: 1px solid var(--border); padding-bottom: 0.35rem; margin-bottom: 0.5rem; font-weight: 600; font-size: 0.85rem; }
.tooltip-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.35rem 0.75rem; font-size: 0.8rem; color: var(--muted); }
.tooltip-grid strong { color: var(--text); font-family: var(--font-mono); }
.issue-card { position: relative; background-color: var(--surface); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 0.85rem; overflow: hidden; box-shadow: var(--shadow); transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease; }
.issue-card:hover { transform: translateY(-2px); border-color: var(--border-strong); box-shadow: 0 8px 20px -4px rgba(212, 175, 55, 0.2); }
.issue-card[open] { border-color: var(--border-strong); box-shadow: 0 10px 24px -4px rgba(212, 175, 55, 0.25); }
.issue-card-summary { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; cursor: pointer; user-select: none; list-style: none; background-color: rgba(255, 255, 255, 0.03); transition: background-color 0.2s ease; }
.issue-card-summary::-webkit-details-marker { display: none; }
.issue-card-summary:hover { background-color: rgba(212, 175, 55, 0.06); }
.issue-card-header-main { display: flex; align-items: center; gap: 0.75rem; flex: 1; min-width: 0; }
.issue-card-title { font-family: var(--font-subheading); font-size: 0.94rem; font-weight: 700; color: var(--accent-strong); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.issue-status-badge { display: inline-flex; align-items: center; justify-content: center; padding: 0.25rem 0.6rem; font-family: var(--font-subheading); font-size: 0.72rem; font-weight: 700; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.05em; line-height: 1; flex-shrink: 0; }
.badge-claimed { background-color: rgba(166, 28, 28, 0.2); border: 1px solid rgba(239, 68, 68, 0.45); color: #f87171; }
.badge-ready-for-agent, .badge-ready { background-color: rgba(217, 119, 6, 0.18); border: 1px solid rgba(245, 208, 97, 0.45); color: #fbbf24; }
.badge-resolved { background-color: rgba(16, 185, 129, 0.18); border: 1px solid rgba(52, 211, 153, 0.45); color: #34d399; }
.badge-needs-triage, .badge-needs-info { background-color: rgba(124, 58, 237, 0.18); border: 1px solid rgba(167, 139, 250, 0.45); color: #c4b5fd; }
.badge-superseded { background-color: rgba(107, 114, 128, 0.12); border: 1px solid rgba(156, 163, 175, 0.3); color: #9ca3af; }
.issue-card-body { border-top: 1px solid var(--border); background-color: var(--surface); padding: 1rem 1.15rem; }
.issue-card-body .prose { font-size: 0.84rem; line-height: 1.5; color: var(--text); }
.issue-card-body .prose p, .issue-card-body .prose li { font-size: 0.84rem; line-height: 1.5; }
.issue-card-body .prose h1 { font-size: 1.05rem; margin: 0.6rem 0 0.3rem; color: var(--accent-strong); border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 0.2rem; }
.issue-card-body .prose h2 { font-size: 0.98rem; margin: 0.5rem 0 0.25rem; color: var(--accent); border-bottom: none; }
.issue-card-body .prose h3 { font-size: 0.92rem; margin: 0.4rem 0 0.2rem; color: var(--accent); }
.issue-card-body .prose h4, .issue-card-body .prose h5, .issue-card-body .prose h6 { font-size: 0.86rem; margin: 0.35rem 0 0.15rem; color: var(--muted); }
.issue-card-body h4 { font-size: 0.88rem; font-family: var(--font-subheading); color: var(--accent); margin-top: 0.85rem; margin-bottom: 0.35rem; border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 0.25rem; }
.issue-children-list { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.4rem; }
.issue-card-sub { margin-top: 0.5rem; margin-bottom: 0.25rem; border: 1px solid rgba(212, 175, 55, 0.2); background-color: rgba(0, 0, 0, 0.25); border-radius: 6px; }
.issue-card-sub .issue-card-summary { padding: 0.6rem 0.85rem; background-color: rgba(255, 255, 255, 0.02); }
.issue-card-sub .issue-card-title { font-size: 0.88rem; color: var(--text); }
@media (max-width: 30rem) {
  .page { padding: 1rem .85rem 3rem; }
  h1 { font-size: 1.75rem; }
  h2 { font-size: 1.25rem; }
  .verdict { padding: 1rem; }
  .tab { padding: .5rem .9rem; font-size: .82rem; }
}
`.trim();
