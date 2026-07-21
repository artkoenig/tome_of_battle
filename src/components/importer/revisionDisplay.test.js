import { describe, it, expect } from 'vitest';
import { buildRevisionDisplay, revisionLabelClassName, REVISION_TONE } from './revisionDisplay';

describe('buildRevisionDisplay', () => {
  it('renders nothing when no available revision is known', () => {
    expect(buildRevisionDisplay(undefined, null)).toBeNull();
    expect(buildRevisionDisplay('7', null)).toBeNull();
  });

  it('marks a file that is not stored locally as new', () => {
    expect(buildRevisionDisplay(5, null)).toEqual({ text: 'Rev 5 · neu', tone: REVISION_TONE.SUBTLE });
  });

  it('marks an equal local revision as current', () => {
    expect(buildRevisionDisplay(8, { revision: 8 })).toEqual({
      text: 'Rev 8 · aktuell',
      tone: REVISION_TONE.SUBTLE,
    });
  });

  it('accents a behind local revision as an available update', () => {
    expect(buildRevisionDisplay(12, { revision: 10 })).toEqual({
      text: 'Rev 12 · lokal 10 · Update verfügbar',
      tone: REVISION_TONE.ACCENT,
    });
  });

  it('treats legacy data without a stored revision as an available update', () => {
    expect(buildRevisionDisplay(6, {})).toEqual({
      text: 'Rev 6 · lokal unbekannt · Update verfügbar',
      tone: REVISION_TONE.ACCENT,
    });
  });

  it('shows a higher local revision neutrally, without an update hint', () => {
    expect(buildRevisionDisplay(4, { revision: 9 })).toEqual({
      text: 'Rev 4 · lokal 9',
      tone: REVISION_TONE.NEUTRAL,
    });
  });
});

describe('revisionLabelClassName', () => {
  it('combines the base class with the tone class', () => {
    expect(revisionLabelClassName(REVISION_TONE.ACCENT)).toBe('bundle-revision-label text-gold');
  });

  it('omits an empty tone rather than emitting a trailing space', () => {
    expect(revisionLabelClassName(REVISION_TONE.NEUTRAL)).toBe('bundle-revision-label');
  });
});
