import { describe, it, expect } from 'vitest';
import { BUMP_TYPES, computeSuggestedVersion } from './release.js';

describe('release', () => {
  describe('computeSuggestedVersion', () => {
    it('suggests the next patch version for a fix', () => {
      expect(computeSuggestedVersion({ major: 1, minor: 4, patch: 2 }, BUMP_TYPES.PATCH))
        .toEqual({ major: 1, minor: 4, patch: 3 });
    });

    it('suggests the next minor version (patch reset) for a feature', () => {
      expect(computeSuggestedVersion({ major: 1, minor: 4, patch: 2 }, BUMP_TYPES.MINOR))
        .toEqual({ major: 1, minor: 5, patch: 0 });
    });

    it('rejects an unknown bump type', () => {
      expect(() => computeSuggestedVersion({ major: 1, minor: 0, patch: 0 }, 'major'))
        .toThrow(/Unbekannter Bump-Typ/);
    });
  });
});
