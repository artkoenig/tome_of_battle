import { describe, it, expect } from 'vitest';
import { getDiffChanges, MAX_DIFF_ENTRIES, TRUNCATION_NOTICE_KEY } from './releaseDiff';
import { t } from '../i18n/i18nStore';

const TRUNCATION_NOTICE = t(TRUNCATION_NOTICE_KEY);

const makeCommits = (count) =>
  Array.from({ length: count }, (_, i) => ({
    hash: i.toString(16).padStart(7, 'a'),
    subject: `feat: Commit ${i}`,
  }));

describe('getDiffChanges', () => {
  it('returns nothing without a release', () => {
    expect(getDiffChanges('v1.0.0', null)).toEqual([]);
  });

  it('returns legacy changes if commits or tags are missing', () => {
    const release = { changes: ['Commit A', 'Commit B'] };
    expect(getDiffChanges('v1.0.0', release)).toEqual(['Commit A', 'Commit B']);
  });

  it('filters commits based on installed tag version', () => {
    const release = {
      commits: [
        { hash: 'aaaaaaa', subject: 'feat: Commit 3' },
        { hash: 'bbbbbbb', subject: 'feat: Commit 2' },
        { hash: 'ccccccc', subject: 'feat: Commit 1' },
      ],
      tags: [
        { name: 'v1.1.0', hash: 'aaaaaaa' },
        { name: 'v1.0.0', hash: 'bbbbbbb' },
      ],
    };
    expect(getDiffChanges('v1.0.0', release)).toEqual(['feat: Commit 3']);
  });

  it('filters commits based on installed hash version (+hash)', () => {
    const release = {
      commits: [
        { hash: 'aaaaaaa', subject: 'feat: Commit 3' },
        { hash: 'bbbbbbb', subject: 'feat: Commit 2' },
        { hash: 'ccccccc', subject: 'feat: Commit 1' },
      ],
      tags: [],
    };
    expect(getDiffChanges('v1.0.0+bbbbbbb', release)).toEqual(['feat: Commit 3']);
  });

  it('matches an abbreviated hash against the full commit hash', () => {
    const release = {
      commits: [
        { hash: 'aaaaaaa1111', subject: 'feat: Commit 2' },
        { hash: 'bbbbbbb2222', subject: 'feat: Commit 1' },
      ],
      tags: [],
    };
    expect(getDiffChanges('v1.0.0+bbbbbbb', release)).toEqual(['feat: Commit 2']);
  });

  it('falls back to the latest commits if the installed version is unknown', () => {
    const release = { commits: makeCommits(MAX_DIFF_ENTRIES + 10), tags: [] };
    const diff = getDiffChanges('v1.0.0', release);
    expect(diff.length).toBe(MAX_DIFF_ENTRIES + 1);
    expect(diff[MAX_DIFF_ENTRIES]).toBe(TRUNCATION_NOTICE);
  });

  it('caps the diff at MAX_DIFF_ENTRIES plus the truncation notice', () => {
    const commits = makeCommits(MAX_DIFF_ENTRIES + 10);
    const release = {
      commits,
      tags: [{ name: 'v1.0.0', hash: commits[MAX_DIFF_ENTRIES + 5].hash }],
    };
    const diff = getDiffChanges('v1.0.0', release);
    expect(diff.length).toBe(MAX_DIFF_ENTRIES + 1);
    expect(diff[MAX_DIFF_ENTRIES]).toBe(TRUNCATION_NOTICE);
  });

  it('does not append the truncation notice at exactly MAX_DIFF_ENTRIES entries', () => {
    const commits = makeCommits(MAX_DIFF_ENTRIES + 1);
    const release = {
      commits,
      tags: [{ name: 'v1.0.0', hash: commits[MAX_DIFF_ENTRIES].hash }],
    };
    const diff = getDiffChanges('v1.0.0', release);
    expect(diff.length).toBe(MAX_DIFF_ENTRIES);
    expect(diff).not.toContain(TRUNCATION_NOTICE);
  });

  it('falls back to legacy changes when the commit list is empty', () => {
    const release = { commits: [], tags: [], changes: ['Nur Legacy'] };
    expect(getDiffChanges('v1.0.0', release)).toEqual(['Nur Legacy']);
  });
});
