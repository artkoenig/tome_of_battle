import { describe, it, expect } from 'vitest';
import { parseVersion, formatVersion, latestVersion, nextVersion } from './versioning.js';

describe('versioning', () => {
  describe('parseVersion', () => {
    it('parses a well-formed tag', () => {
      expect(parseVersion('v1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
    });
    it('rejects non-version tags', () => {
      expect(parseVersion('release-2026')).toBeNull();
      expect(parseVersion('v1.2')).toBeNull();
      expect(parseVersion('1.2.3')).toBeNull();
    });
  });

  describe('formatVersion', () => {
    it('round-trips with parseVersion', () => {
      expect(formatVersion({ major: 3, minor: 0, patch: 7 })).toBe('v3.0.7');
    });
  });

  describe('latestVersion', () => {
    it('returns the highest version, comparing numerically (not lexically)', () => {
      const tags = ['v1.2.0', 'v1.10.0', 'v1.9.0'];
      expect(latestVersion(tags)).toEqual({ major: 1, minor: 10, patch: 0 });
    });
    it('ignores tags that are not versions', () => {
      const tags = ['nightly', 'v0.4.1', 'foo'];
      expect(latestVersion(tags)).toEqual({ major: 0, minor: 4, patch: 1 });
    });
    it('defaults to 0.0.0 when there are no version tags', () => {
      expect(latestVersion([])).toEqual({ major: 0, minor: 0, patch: 0 });
      expect(latestVersion([''])).toEqual({ major: 0, minor: 0, patch: 0 });
    });
    it('keeps a manually set major as the highest', () => {
      const tags = ['v1.9.0', 'v2.0.0'];
      expect(latestVersion(tags)).toEqual({ major: 2, minor: 0, patch: 0 });
    });
  });

  describe('nextVersion', () => {
    it('bumps the minor (and resets patch) on main', () => {
      expect(nextVersion({ major: 1, minor: 4, patch: 7 }, true)).toEqual({ major: 1, minor: 5, patch: 0 });
    });
    it('bumps the patch on a non-main branch', () => {
      expect(nextVersion({ major: 1, minor: 4, patch: 7 }, false)).toEqual({ major: 1, minor: 4, patch: 8 });
    });
    it('never changes the major (that stays manual)', () => {
      expect(nextVersion({ major: 2, minor: 0, patch: 0 }, true).major).toBe(2);
      expect(nextVersion({ major: 2, minor: 0, patch: 0 }, false).major).toBe(2);
    });
    it('increments the patch across repeated builds on the same branch', () => {
      let v = { major: 1, minor: 4, patch: 0 };
      v = nextVersion(v, false); // build 1 → v1.4.1
      v = nextVersion(v, false); // build 2 → v1.4.2
      v = nextVersion(v, false); // build 3 → v1.4.3
      expect(formatVersion(v)).toBe('v1.4.3');
    });
  });
});
