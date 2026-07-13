import { describe, it, expect } from 'vitest';
import { resolveDeployEnv, isFlaggedEnv } from './deployEnv.js';

describe('deployEnv', () => {
  describe('resolveDeployEnv', () => {
    it('treats the dev server as development regardless of branch', () => {
      expect(resolveDeployEnv({ command: 'serve', branch: 'main' })).toBe('development');
      expect(resolveDeployEnv({ command: 'serve', branch: 'staging' })).toBe('development');
    });
    it('maps any branch to preview by default', () => {
      expect(resolveDeployEnv({ command: 'build', branch: 'main' })).toBe('preview');
      expect(resolveDeployEnv({ command: 'build', branch: 'staging' })).toBe('preview');
    });
    it('maps any other branch build to preview', () => {
      expect(resolveDeployEnv({ command: 'build', branch: 'feature/foo' })).toBe('preview');
      expect(resolveDeployEnv({ command: 'build', branch: '' })).toBe('preview');
    });
    it('prefers VERCEL_TARGET_ENV over everything else', () => {
      expect(resolveDeployEnv({ command: 'build', branch: 'anything', targetEnv: 'production' })).toBe('production');
      expect(resolveDeployEnv({ command: 'build', branch: 'main', targetEnv: 'preview' })).toBe('preview');
    });
    it('treats a standard preview target env as preview', () => {
      expect(resolveDeployEnv({ command: 'build', branch: 'feature/foo', targetEnv: 'preview' })).toBe('preview');
    });
    it('treats an unknown custom target env as preview (still flagged)', () => {
      expect(resolveDeployEnv({ command: 'build', branch: 'qa', targetEnv: 'qa' })).toBe('preview');
    });
  });

  describe('isFlaggedEnv', () => {
    it('flags preview, but not production or development', () => {
      expect(isFlaggedEnv('preview')).toBe(true);
      expect(isFlaggedEnv('production')).toBe(false);
      expect(isFlaggedEnv('development')).toBe(false);
    });
  });
});
