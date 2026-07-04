import { describe, it, expect } from 'vitest';
import { parseVersion, formatVersion, latestVersion, nextReleaseVersion, buildVersionString, resolveVersion } from './versioning.js';

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

  describe('nextReleaseVersion', () => {
    it('bumps the minor and resets the patch', () => {
      expect(nextReleaseVersion({ major: 1, minor: 4, patch: 7 })).toEqual({ major: 1, minor: 5, patch: 0 });
    });
    it('never changes the major (that stays manual)', () => {
      expect(nextReleaseVersion({ major: 2, minor: 0, patch: 0 }).major).toBe(2);
    });
  });

  describe('buildVersionString', () => {
    it('produces the next minor release on main', () => {
      expect(buildVersionString({ latest: { major: 1, minor: 4, patch: 0 }, isMain: true, commitHash: 'abc1234' }))
        .toBe('v1.5.0');
    });
    it('skips an already-existing tag on main (collision guard)', () => {
      const v = buildVersionString({
        latest: { major: 1, minor: 4, patch: 0 },
        isMain: true,
        commitHash: 'abc1234',
        existingTags: ['v1.5.0'],
      });
      expect(v).toBe('v1.6.0');
    });
    it('appends the commit hash on a feature branch (no bump)', () => {
      expect(buildVersionString({ latest: { major: 1, minor: 4, patch: 0 }, isMain: false, commitHash: 'abc1234' }))
        .toBe('v1.4.0+abc1234');
    });
    it('starts at v0.1.0 on main when there are no tags yet', () => {
      expect(buildVersionString({ latest: { major: 0, minor: 0, patch: 0 }, isMain: true, commitHash: 'abc1234' }))
        .toBe('v0.1.0');
    });
  });

  describe('resolveVersion', () => {
    it('cuts the next minor release and requests a tag on an untagged main build', () => {
      const r = resolveVersion({ tags: ['v1.4.0', 'v1.3.0'], headTags: [], isMain: true, commitHash: 'abc1234' });
      expect(r).toEqual({ version: 'v1.5.0', base: 'v1.4.0', tag: 'v1.5.0' });
    });

    it('reuses the tag already on HEAD without bumping (Vercel rebuild after tag)', () => {
      // Vercel builds the same commit the CI workflow just tagged v1.5.0 → must not become v1.6.0.
      const r = resolveVersion({ tags: ['v1.5.0', 'v1.4.0'], headTags: ['v1.5.0'], isMain: true, commitHash: 'abc1234' });
      expect(r).toEqual({ version: 'v1.5.0', base: 'v1.4.0', tag: null });
    });

    it('appends the commit hash and never tags on a feature branch', () => {
      const r = resolveVersion({ tags: ['v1.4.0'], headTags: [], isMain: false, commitHash: 'abc1234' });
      expect(r).toEqual({ version: 'v1.4.0+abc1234', base: 'v1.4.0', tag: null });
    });

    it('agrees on the version whether the tag exists yet or not', () => {
      // Race: Vercel building before vs after the CI tag push must yield the same version.
      const before = resolveVersion({ tags: ['v1.4.0'], headTags: [], isMain: true, commitHash: 'abc1234' });
      const after = resolveVersion({ tags: ['v1.5.0', 'v1.4.0'], headTags: ['v1.5.0'], isMain: true, commitHash: 'abc1234' });
      expect(before.version).toBe(after.version);
      expect(before.version).toBe('v1.5.0');
    });

    it('falls back to whole history (empty base) before any release exists', () => {
      const r = resolveVersion({ tags: [], headTags: [], isMain: true, commitHash: 'abc1234' });
      expect(r).toEqual({ version: 'v0.1.0', base: '', tag: 'v0.1.0' });
    });
  });
});
