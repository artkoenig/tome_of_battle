import { describe, it, expect } from 'vitest';
import { resolveDeployEnv } from './deployEnv.js';

describe('deployEnv', () => {
  describe('resolveDeployEnv', () => {
    it('treats the dev server as development regardless of branch', () => {
      expect(resolveDeployEnv({ command: 'serve', branch: 'main' })).toBe('development');
      expect(resolveDeployEnv({ command: 'serve', branch: 'feature/foo' })).toBe('development');
    });
    it('maps the main branch build to production', () => {
      expect(resolveDeployEnv({ command: 'build', branch: 'main' })).toBe('production');
    });
    it('maps any other branch build to preview', () => {
      expect(resolveDeployEnv({ command: 'build', branch: 'feature/foo' })).toBe('preview');
      expect(resolveDeployEnv({ command: 'build', branch: '' })).toBe('preview');
    });
    it('prefers VERCEL_TARGET_ENV over the branch name (except for main)', () => {
      expect(resolveDeployEnv({ command: 'build', branch: 'anything', targetEnv: 'production' })).toBe('production');
      expect(resolveDeployEnv({ command: 'build', branch: 'main', targetEnv: 'preview' })).toBe('production');
    });
    it('treats a standard preview target env as preview', () => {
      expect(resolveDeployEnv({ command: 'build', branch: 'feature/foo', targetEnv: 'preview' })).toBe('preview');
    });
    it('treats an unknown custom target env as preview (still flagged)', () => {
      expect(resolveDeployEnv({ command: 'build', branch: 'qa', targetEnv: 'qa' })).toBe('preview');
    });
  });
});
