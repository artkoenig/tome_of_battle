import { describe, it, expect } from 'vitest';
import { buildRevisionDisplay, revisionLabelClassName, REVISION_TONE } from './importerRevisionDisplay';

/**
 * Issue 0176 — the revision display of ADR 0014, cut out of `useImporter.js`.
 */
describe('importerRevisionDisplay', () => {
  it('builds the revision display of ADR 0014 for every state', () => {
    expect(buildRevisionDisplay(undefined, null)).toBeNull();
    expect(buildRevisionDisplay(5, null).text).toContain('Rev 5');
    expect(buildRevisionDisplay(5, null).tone).toBe(REVISION_TONE.SUBTLE);
    expect(buildRevisionDisplay(5, { revision: 5 }).tone).toBe(REVISION_TONE.SUBTLE);
    expect(buildRevisionDisplay(5, { revision: 4 }).tone).toBe(REVISION_TONE.ACCENT);
    expect(buildRevisionDisplay(5, { revision: 6 }).tone).toBe(REVISION_TONE.NEUTRAL);
    expect(revisionLabelClassName(REVISION_TONE.ACCENT)).toBe('bundle-revision-label text-gold');
    expect(revisionLabelClassName(REVISION_TONE.NEUTRAL)).toBe('bundle-revision-label');
  });

  it('names the local revision of an outdated file next to the available one', () => {
    expect(buildRevisionDisplay(5, { revision: 4 }).text).toContain('4');
  });
});
