import { describe, it, expect } from 'vitest';
import {
  parseVersion,
  formatVersion,
  parseSemver,
  formatSemver,
  latestVersion,
  nextMinorVersion,
  nextPatchVersion,
  resolveVersion,
} from './versioning.js';

describe('versioning', () => {
  describe('parseVersion', () => {
    it('parses a well-formed tag', () => {
      expect(parseVersion('v1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
    });
    it('rejects non-version tags', () => {
      expect(parseVersion('release-2026')).toBeNull();
      expect(parseVersion('v1.2')).toBeNull();
      expect(parseVersion('1.2.3')).toBeNull();
      expect(parseVersion('v1.4.0+a1b2c3d')).toBeNull(); // build-metadata is not a bare version tag
    });
  });

  describe('formatVersion', () => {
    it('round-trips with parseVersion', () => {
      expect(formatVersion({ major: 3, minor: 0, patch: 7 })).toBe('v3.0.7');
    });
  });

  describe('parseSemver', () => {
    it('parses a package.json-style version without the "v" prefix', () => {
      expect(parseSemver('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
    });
    it('rejects a "v"-prefixed tag', () => {
      expect(parseSemver('v1.2.3')).toBeNull();
    });
  });

  describe('formatSemver', () => {
    it('round-trips with parseSemver', () => {
      expect(formatSemver({ major: 3, minor: 0, patch: 7 })).toBe('3.0.7');
    });
  });

  describe('latestVersion', () => {
    it('returns the highest version, comparing numerically (not lexically)', () => {
      expect(latestVersion(['v1.2.0', 'v1.10.0', 'v1.9.0'])).toEqual({ major: 1, minor: 10, patch: 0 });
    });
    it('ignores tags that are not versions', () => {
      expect(latestVersion(['nightly', 'v0.4.1', 'foo'])).toEqual({ major: 0, minor: 4, patch: 1 });
    });
    it('defaults to 0.0.0 when there are no version tags', () => {
      expect(latestVersion([])).toEqual({ major: 0, minor: 0, patch: 0 });
      expect(latestVersion([''])).toEqual({ major: 0, minor: 0, patch: 0 });
    });
    it('keeps a manually set major as the highest', () => {
      expect(latestVersion(['v1.9.0', 'v2.0.0'])).toEqual({ major: 2, minor: 0, patch: 0 });
    });
  });

  describe('nextMinorVersion', () => {
    it('bumps the minor and resets the patch', () => {
      expect(nextMinorVersion({ major: 1, minor: 4, patch: 7 })).toEqual({ major: 1, minor: 5, patch: 0 });
    });
    it('never changes the major (that stays manual)', () => {
      expect(nextMinorVersion({ major: 2, minor: 0, patch: 0 }).major).toBe(2);
    });
  });

  describe('nextPatchVersion', () => {
    it('bumps the patch only', () => {
      expect(nextPatchVersion({ major: 1, minor: 4, patch: 7 })).toEqual({ major: 1, minor: 4, patch: 8 });
    });
    it('never changes the major (that stays manual)', () => {
      expect(nextPatchVersion({ major: 2, minor: 0, patch: 0 }).major).toBe(2);
    });
  });

  describe('resolveVersion', () => {
    it('shows the package.json version unchanged on main', () => {
      const r = resolveVersion({ tags: ['v1.4.0', 'v1.3.0'], packageVersion: '1.5.0', isMain: true, commitHash: 'abc1234' });
      expect(r).toEqual({ version: 'v1.5.0', base: 'v1.4.0' });
    });

    it('appends the commit hash as build metadata on a non-main branch', () => {
      const r = resolveVersion({ tags: ['v1.4.0'], packageVersion: '1.4.0', isMain: false, commitHash: 'abc1234' });
      expect(r).toEqual({ version: 'v1.4.0+abc1234', base: 'v1.4.0' });
    });

    it('falls back to whole history (empty base) before any release tag exists', () => {
      const r = resolveVersion({ tags: [], packageVersion: '0.1.0', isMain: true, commitHash: 'abc1234' });
      expect(r).toEqual({ version: 'v0.1.0', base: '' });
    });

    it('is independent of whether HEAD already carries the release tag', () => {
      // Anders als die frühere Tag-Prognose gibt es hier keinen Unterschied
      // mehr zwischen "Tag existiert noch nicht" und "Tag existiert bereits" -
      // package.json ist in beiden Fällen dieselbe Quelle.
      const beforeTagPush = resolveVersion({ tags: ['v1.4.0'], packageVersion: '1.5.0', isMain: true, commitHash: 'abc1234' });
      const afterTagPush = resolveVersion({ tags: ['v1.5.0', 'v1.4.0'], packageVersion: '1.5.0', isMain: true, commitHash: 'abc1234' });
      expect(beforeTagPush.version).toBe('v1.5.0');
      expect(afterTagPush.version).toBe('v1.5.0');
    });
  });
});
