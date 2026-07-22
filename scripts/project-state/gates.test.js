import { describe, it, expect } from 'vitest';
import {
  GateStatus,
  GateEnforcement,
  GateAbortReason,
  GATE_DEFINITIONS,
  classifyGate,
  findGateEnforcement,
  buildGateStates,
} from './gates.js';

describe('project-state/gates', () => {
  describe('classifyGate', () => {
    it('classifies a clean run as passed', () => {
      expect(classifyGate({ exitCode: 0, output: 'All good.' })).toEqual({
        status: GateStatus.Passed,
        abortReason: null,
      });
    });

    it('classifies a non-zero exit without an abort signature as findings', () => {
      expect(classifyGate({ exitCode: 1, output: '3 problems found' })).toEqual({
        status: GateStatus.Findings,
        abortReason: null,
      });
    });

    it('classifies a dependency-cruiser node-version abort as not-run, never as green', () => {
      const run = { exitCode: 1, output: 'ERROR: Your node version (25.0.0) is not supported.' };
      expect(classifyGate(run)).toEqual({
        status: GateStatus.NotRun,
        abortReason: GateAbortReason.UnsupportedNodeVersion,
      });
    });

    it('treats an environment abort as not-run even when the tool exits with code 0', () => {
      const run = { exitCode: 0, output: 'npm warn EBADENGINE Unsupported engine' };
      const result = classifyGate(run);
      expect(result.status).toBe(GateStatus.NotRun);
      expect(result.abortReason).toBe(GateAbortReason.UnsupportedNodeVersion);
    });

    it('recognizes a missing executable and a missing module as not-run', () => {
      expect(classifyGate({ exitCode: 127, output: 'depcruise: command not found' }).abortReason).toBe(
        GateAbortReason.ExecutableNotFound,
      );
      expect(classifyGate({ exitCode: 1, output: 'Error: Cannot find module "typescript"' }).abortReason).toBe(
        GateAbortReason.ModuleNotFound,
      );
    });

    it('classifies a completely missing run as not-run with a dedicated reason', () => {
      expect(classifyGate(undefined)).toEqual({
        status: GateStatus.NotRun,
        abortReason: GateAbortReason.NoRunRecorded,
      });
      expect(classifyGate(null)).toEqual({
        status: GateStatus.NotRun,
        abortReason: GateAbortReason.NoRunRecorded,
      });
    });
  });

  describe('findGateEnforcement', () => {
    const workflowJob = {
      steps: [
        { run: 'npm run lint' },
        { run: 'npm run knip', 'continue-on-error': true },
      ],
    };

    it('reads a step without continue-on-error as blocking', () => {
      expect(findGateEnforcement(workflowJob, 'npm run lint')).toBe(GateEnforcement.Blocking);
    });

    it('reads a step with continue-on-error: true as a warning', () => {
      expect(findGateEnforcement(workflowJob, 'npm run knip')).toBe(GateEnforcement.Warning);
    });

    it('reports unknown enforcement when no step runs the command', () => {
      expect(findGateEnforcement(workflowJob, 'npm run typecheck')).toBe(GateEnforcement.Unknown);
      expect(findGateEnforcement(null, 'npm run lint')).toBe(GateEnforcement.Unknown);
    });

    it('matches the command regardless of surrounding whitespace', () => {
      const job = { steps: [{ run: '  npm   run   lint  ' }] };
      expect(findGateEnforcement(job, 'npm run lint')).toBe(GateEnforcement.Blocking);
    });
  });

  describe('buildGateStates', () => {
    it('joins each gate definition with its run result and workflow enforcement', () => {
      const workflowJob = {
        steps: [
          { run: 'npm run lint' },
          { run: 'npm run depcruise', 'continue-on-error': true },
        ],
      };
      const runs = {
        lint: { exitCode: 0, output: 'ok' },
        depcruise: { exitCode: 1, output: 'ERROR: Your node version (25.0.0) is not supported.' },
      };

      const states = buildGateStates({ workflowJob, runs });
      const byId = Object.fromEntries(states.map((state) => [state.id, state]));

      expect(states).toHaveLength(GATE_DEFINITIONS.length);

      expect(byId.lint.status).toBe(GateStatus.Passed);
      expect(byId.lint.enforcement).toBe(GateEnforcement.Blocking);
      expect(byId.lint.exitCode).toBe(0);
      expect(byId.lint.abortReason).toBeNull();

      expect(byId.depcruise.status).toBe(GateStatus.NotRun);
      expect(byId.depcruise.enforcement).toBe(GateEnforcement.Warning);
      expect(byId.depcruise.abortReason).toBe(GateAbortReason.UnsupportedNodeVersion);

      expect(byId.typecheck.status).toBe(GateStatus.NotRun);
      expect(byId.typecheck.abortReason).toBe(GateAbortReason.NoRunRecorded);
      expect(byId.typecheck.exitCode).toBeNull();
    });

    it('carries the gate label and command through from the definitions', () => {
      const states = buildGateStates({ runs: {} });
      const lint = states.find((state) => state.id === 'lint');
      expect(lint.label).toBe('oxlint');
      expect(lint.command).toBe('npm run lint');
    });
  });
});
