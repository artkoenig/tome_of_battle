import { describe, it, expect } from 'vitest';

import { buildReportModel, DEFAULT_MAX_LONG_FUNCTIONS } from './buildReportModel.js';
import { GateStatus, GateEnforcement, GateAbortReason } from './gates.js';
import { OVERALL_ASSESSMENT, FINDING_ASSESSMENTS, AssessmentVerdict } from './assessment.js';

const GENERATED_AT = '22. Juli 2026, 06:30 Uhr (Europe/Berlin)';

/** Minimal gueltige Eingabe; einzelne Tests ueberschreiben nur, was sie brauchen. */
function baseInput(overrides = {}) {
  return { generatedAt: GENERATED_AT, ...overrides };
}

/** Ein Funktionskoerper mit einer bestimmten Zeilenzahl, damit die Laenge deterministisch ist. */
function functionWithLines(name, bodyLines) {
  const body = Array.from({ length: bodyLines }, (_, i) => `  const v${i} = ${i};`).join('\n');
  return `function ${name}() {\n${body}\n  return 0;\n}\n`;
}

describe('project-state/buildReportModel', () => {
  it('classifies gates from runs and CI enforcement, never showing an aborted gate as passed', () => {
    const model = buildReportModel(
      baseInput({
        gateRuns: {
          lint: { exitCode: 0, output: 'ok' },
          depcruise: { exitCode: 1, output: 'ERROR: Your node version (25.0.0) is not supported.' },
        },
        workflowJob: {
          steps: [{ run: 'npm run lint' }, { run: 'npm run depcruise', 'continue-on-error': true }],
        },
      }),
    );

    const byId = Object.fromEntries(model.gates.map((gate) => [gate.id, gate]));
    expect(byId.lint.status).toBe(GateStatus.Passed);
    expect(byId.lint.enforcement).toBe(GateEnforcement.Blocking);
    expect(byId.depcruise.status).toBe(GateStatus.NotRun);
    expect(byId.depcruise.abortReason).toBe(GateAbortReason.UnsupportedNodeVersion);
    expect(byId.depcruise.enforcement).toBe(GateEnforcement.Warning);
    // Ein Gate ohne Lauf bleibt "nicht angelaufen" statt still zu verschwinden.
    expect(byId.typecheck.status).toBe(GateStatus.NotRun);
    expect(byId.typecheck.abortReason).toBe(GateAbortReason.NoRunRecorded);
  });

  it('aggregates injected coverage per module, stripping the root path', () => {
    const model = buildReportModel(
      baseInput({
        rootPath: '/repo',
        coverageFinal: {
          '/repo/src/foo/a.js': { s: { 0: 1, 1: 0 }, b: {}, f: { 0: 1 } },
          '/repo/src/foo/b.js': { s: { 0: 1 }, b: {}, f: { 0: 0 } },
        },
      }),
    );

    expect(model.coverage).toHaveLength(1);
    expect(model.coverage[0].module).toBe('src/foo');
    expect(model.coverage[0].fileCount).toBe(2);
    expect(model.coverage[0].statements).toEqual({ covered: 2, total: 3, percent: 66.7 });
  });

  it('collects long functions across all sources, sorted by length and capped', () => {
    const model = buildReportModel(
      baseInput({
        sources: [
          { path: 'src/a.js', source: functionWithLines('small', 3) },
          { path: 'src/b.js', source: functionWithLines('big', 9) },
        ],
        longFunctionLimit: 3,
        maxLongFunctions: 1,
      }),
    );

    expect(model.longFunctions).toHaveLength(1);
    expect(model.longFunctions[0].name).toBe('big');
    expect(model.longFunctions[0].path).toBe('src/b.js');
  });

  it('derives structure facts (modules, dependencies, cycles, layer violations) from the cruiser graph', () => {
    const model = buildReportModel(
      baseInput({
        cruiserModules: [
          { source: 'src/a.js', dependencies: [{ resolved: 'src/b.js' }] },
          { source: 'src/b.js', dependencies: [{ resolved: 'src/a.js' }] },
          { source: 'src/parser/p.js', dependencies: [{ resolved: 'src/solver/s.js' }] },
          { source: 'src/solver/s.js', dependencies: [] },
        ],
      }),
    );

    expect(model.structure.moduleCount).toBe(4);
    expect(model.structure.dependencyCount).toBe(3);
    expect(model.structure.cycles).toEqual([['src/a.js', 'src/b.js']]);
    expect(model.structure.layerViolations).toEqual([
      { from: 'src/parser/p.js', to: 'src/solver/s.js', fromLayer: 'parser', toLayer: 'solver' },
    ]);
  });

  it('collects open issues over the injected refs and exposes the scanned refs as the blind spot', () => {
    const files = {
      'origin/main': {
        'docs/issues/01-foo/issue.md': 'Status: resolved\nType: chore\n\n## Description\nDone.\n',
        'docs/issues/03-baz/issue.md': 'Status: resolved\n\n## Description\nClosed on main.\n',
      },
      'origin/issue/bar': {
        'docs/issues/02-bar/issue.md':
          'Status: ready-for-agent\nType: feature\n\n## Description\nOpen work.\n\n## Acceptance Criteria\n- [ ] It works\n',
        'docs/issues/03-baz/issue.md': 'Status: ready-for-agent\n\n## Description\nStill open on an old branch.\n',
      },
    };
    const model = buildReportModel(
      baseInput({
        issueRefs: [
          {
            name: 'origin/main',
            issuePaths: ['docs/issues/01-foo/issue.md', 'docs/issues/03-baz/issue.md'],
            isDefaultBranch: true,
          },
          {
            name: 'origin/issue/bar',
            issuePaths: ['docs/issues/02-bar/issue.md', 'docs/issues/03-baz/issue.md'],
          },
        ],
        showFile: (ref, path) => files[ref]?.[path] ?? null,
      }),
    );

    // 01-foo ist auf main geschlossen; 03-baz ist auf main geschlossen und zaehlt
    // trotz des offenen aelteren Branches nicht mehr als offen. Bleibt nur 02-bar.
    expect(model.openIssues.map((issue) => issue.id)).toEqual(['02-bar']);
    expect(model.openIssues[0].sections['Acceptance Criteria']).toContain('It works');
    expect(model.branchScope.scannedRefs).toEqual(['origin/main', 'origin/issue/bar']);
  });

  it('builds metrics that summarize open issues, gate enforcement and structure at a glance', () => {
    const model = buildReportModel(
      baseInput({
        gateRuns: {
          lint: { exitCode: 0, output: 'ok' },
          depcruise: { exitCode: 1, output: 'ERROR: Your node version (25.0.0) is not supported.' },
        },
        workflowJob: { steps: [{ run: 'npm run lint' }] },
        cruiserModules: [
          { source: 'src/a.js', dependencies: [{ resolved: 'src/b.js' }] },
          { source: 'src/b.js', dependencies: [{ resolved: 'src/a.js' }] },
        ],
        sources: [{ path: 'src/b.js', source: functionWithLines('big', 9) }],
        longFunctionLimit: 3,
      }),
    );

    const byLabel = Object.fromEntries(model.metrics.map((metric) => [metric.label, metric]));
    expect(byLabel['Offene Vorgaenge'].value).toBe(0);
    expect(byLabel['Blockierende Gates'].value).toBe('1/5');
    expect(byLabel['Nicht angelaufene Gates'].value).toBe(4);
    expect(byLabel['Nicht angelaufene Gates'].hint).toMatch(/kein gruenes Ergebnis/);
    expect(byLabel['Ueberlange Funktionen'].value).toBe(1);
    expect(byLabel['Import-Zyklen'].value).toBe(1);
  });

  it('drops the not-run hint when every gate actually ran', () => {
    const model = buildReportModel(
      baseInput({
        gateRuns: {
          lint: { exitCode: 0, output: 'ok' },
          knip: { exitCode: 0, output: 'ok' },
          depcruise: { exitCode: 0, output: '{}' },
          typecheck: { exitCode: 0, output: 'ok' },
          'unit-tests': { exitCode: 0, output: 'ok' },
        },
      }),
    );

    const notRun = model.metrics.find((metric) => metric.label === 'Nicht angelaufene Gates');
    expect(notRun.value).toBe(0);
    expect(notRun.hint).toBeUndefined();
  });

  it('uses the hand-maintained assessment by default and honors an override', () => {
    const byDefault = buildReportModel(baseInput());
    expect(byDefault.assessment).toBe(OVERALL_ASSESSMENT);
    expect(byDefault.findingAssessments).toBe(FINDING_ASSESSMENTS);

    const custom = {
      overallAssessment: { headline: 'Eigenes Urteil', summary: 'Begruendung.' },
      findingAssessments: [
        { source: 'Test', title: 'Eingeordnet', verdict: AssessmentVerdict.Accepted, detail: 'Detail.' },
      ],
    };
    const overridden = buildReportModel(baseInput(custom));
    expect(overridden.assessment).toBe(custom.overallAssessment);
    expect(overridden.findingAssessments).toBe(custom.findingAssessments);
  });

  it('caps long functions at the documented default when no override is given', () => {
    const sources = Array.from({ length: DEFAULT_MAX_LONG_FUNCTIONS + 5 }, (_, i) => ({
      path: `src/f${i}.js`,
      source: functionWithLines(`fn${i}`, 60),
    }));
    const model = buildReportModel(baseInput({ sources }));
    expect(model.longFunctions).toHaveLength(DEFAULT_MAX_LONG_FUNCTIONS);
  });
});
