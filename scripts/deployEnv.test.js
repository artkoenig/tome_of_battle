import { describe, it, expect } from 'vitest';
import { resolveDeployEnv, isFlaggedEnv } from './deployEnv.js';

describe('deployEnv', () => {
  describe('resolveDeployEnv', () => {
    it('treats the dev server as development regardless of branch', () => {
      expect(resolveDeployEnv({ command: 'serve', branch: 'main' })).toBe('development');
      expect(resolveDeployEnv({ command: 'serve', branch: 'staging' })).toBe('development');
    });
    it('maps the main branch build to production', () => {
      expect(resolveDeployEnv({ command: 'build', branch: 'main' })).toBe('production');
    });
    it('maps the staging branch build to staging', () => {
      expect(resolveDeployEnv({ command: 'build', branch: 'staging' })).toBe('staging');
    });
    it('maps any other branch build to preview', () => {
      expect(resolveDeployEnv({ command: 'build', branch: 'feature/foo' })).toBe('preview');
      expect(resolveDeployEnv({ command: 'build', branch: '' })).toBe('preview');
    });
  });

  describe('isFlaggedEnv', () => {
    it('flags staging and preview, but not production or development', () => {
      expect(isFlaggedEnv('staging')).toBe(true);
      expect(isFlaggedEnv('preview')).toBe(true);
      expect(isFlaggedEnv('production')).toBe(false);
      expect(isFlaggedEnv('development')).toBe(false);
    });
  });
});
