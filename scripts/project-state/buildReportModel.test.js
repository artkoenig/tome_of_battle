import { describe, it, expect } from 'vitest';

import { buildReportModel } from './buildReportModel.js';
import { GateStatus, GateEnforcement, GateAbortReason } from './gates.js';

const GENERATED_AT = '22. Juli 2026, 06:30 Uhr (Europe/Berlin)';

/** Minimal gueltige Eingabe; einzelne Tests ueberschreiben nur, was sie brauchen. */
function baseInput(overrides = {}) {
  return { generatedAt: GENERATED_AT, ...overrides };
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

  it('aggregates LOC and cyclomatic complexity per module and total lines', () => {
    const model = buildReportModel(
      baseInput({
        sources: [
          { path: 'src/solver/engine.js', source: 'function solve(a, b) {\n  if (a) return 1;\n  return a && b;\n}\n' },
          { path: 'src/parser/roster.js', source: 'function parse() {\n  return 1;\n}\n' },
        ],
      }),
    );

    const solver = model.moduleMetrics.find((entry) => entry.module === 'src/solver');
    // solve: 1 + if + && = 3; engine.js hat 4 nicht-leere Zeilen.
    expect(solver).toMatchObject({ module: 'src/solver', fileCount: 1, functionCount: 1, totalComplexity: 3, maxComplexity: 3 });
    expect(solver.lines).toBe(4);

    const totalLines = model.metrics.find((metric) => metric.label === 'Total lines of code');
    expect(totalLines.value).toBe(7); // 4 (engine) + 3 (roster)
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

  it('builds metrics that summarize open issues and gate enforcement at a glance', () => {
    const model = buildReportModel(
      baseInput({
        gateRuns: {
          lint: { exitCode: 0, output: 'ok' },
          depcruise: { exitCode: 1, output: 'ERROR: Your node version (25.0.0) is not supported.' },
        },
        workflowJob: { steps: [{ run: 'npm run lint' }] },
      }),
    );

    const byLabel = Object.fromEntries(model.metrics.map((metric) => [metric.label, metric]));
    expect(byLabel['Open issues'].value).toBe(0);
    expect(byLabel['Blocking gates'].value).toBe('1/5');
    expect(byLabel['Gates not run'].value).toBe(4);
    expect(byLabel['Gates not run'].hint).toMatch(/no green result/);
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

    const notRun = model.metrics.find((metric) => metric.label === 'Gates not run');
    expect(notRun.value).toBe(0);
    expect(notRun.hint).toBeUndefined();
  });
});
