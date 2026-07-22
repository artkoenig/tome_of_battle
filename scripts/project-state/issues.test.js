import { describe, it, expect } from 'vitest';
import {
  IssueStatus,
  isClosedIssueStatus,
  parseIssueMarkdown,
  issueIdFromPath,
  issueTitleFromId,
  collectOpenIssues,
} from './issues.js';

describe('project-state/issues', () => {
  describe('parseIssueMarkdown', () => {
    it('reads the header fields status, type and blocked-by', () => {
      const parsed = parseIssueMarkdown('Status: ready-for-agent\nType: feature\nBlocked by: [01, 03]\n');
      expect(parsed.status).toBe('ready-for-agent');
      expect(parsed.type).toBe('feature');
      expect(parsed.blockedBy).toEqual(['01', '03']);
    });

    it('treats "None" and an empty blocked-by as no blockers', () => {
      expect(parseIssueMarkdown('Status: claimed\nBlocked by: None\n').blockedBy).toEqual([]);
      expect(parseIssueMarkdown('Status: claimed\nBlocked by:\n').blockedBy).toEqual([]);
    });

    it('captures each section body under its "##" heading, trimmed', () => {
      const text = [
        'Status: resolved',
        'Type: chore',
        '',
        '## Description',
        '',
        'Ein kurzer Text.',
        '',
        '## Acceptance Criteria',
        '- [ ] Erste Bedingung',
        '- [ ] Zweite Bedingung',
      ].join('\n');

      const { sections } = parseIssueMarkdown(text);
      expect(sections.Description).toBe('Ein kurzer Text.');
      expect(sections['Acceptance Criteria']).toBe('- [ ] Erste Bedingung\n- [ ] Zweite Bedingung');
    });

    it('reports a missing status header as null instead of guessing', () => {
      const parsed = parseIssueMarkdown('Type: fix\n\n## Description\nText.\n');
      expect(parsed.status).toBeNull();
      expect(parsed.type).toBe('fix');
    });

    it('does not mistake a header-like line inside a section for a header field', () => {
      const text = 'Status: claimed\n\n## Notes\nBlocked by: nichts (nur Prosa)\n';
      const parsed = parseIssueMarkdown(text);
      expect(parsed.blockedBy).toEqual([]);
      expect(parsed.sections.Notes).toBe('Blocked by: nichts (nur Prosa)');
    });

    it('tolerates empty input', () => {
      const parsed = parseIssueMarkdown('');
      expect(parsed).toEqual({ status: null, type: null, blockedBy: [], sections: {} });
    });
  });

  describe('isClosedIssueStatus', () => {
    it('counts resolved and superseded as closed, everything else as open', () => {
      expect(isClosedIssueStatus(IssueStatus.Resolved)).toBe(true);
      expect(isClosedIssueStatus(IssueStatus.Superseded)).toBe(true);
      expect(isClosedIssueStatus(IssueStatus.ReadyForAgent)).toBe(false);
      expect(isClosedIssueStatus(IssueStatus.Claimed)).toBe(false);
      expect(isClosedIssueStatus(null)).toBe(false);
    });
  });

  describe('issueIdFromPath', () => {
    it('strips the tracker root and the issue.md file name', () => {
      expect(issueIdFromPath('docs/issues/54-bericht/01-erhebung/issue.md')).toBe('54-bericht/01-erhebung');
    });

    it('handles a top-level main-issue', () => {
      expect(issueIdFromPath('docs/issues/54-bericht/issue.md')).toBe('54-bericht');
    });

    it('normalizes backslash separators', () => {
      expect(issueIdFromPath('docs\\issues\\54-bericht\\issue.md')).toBe('54-bericht');
    });
  });

  describe('issueTitleFromId', () => {
    it('turns the leaf slug into a readable title', () => {
      expect(issueTitleFromId('54-bericht/01-erhebung-des-zustands')).toBe('erhebung des zustands');
    });
  });

  describe('collectOpenIssues', () => {
    const trackerFile = (id) => `docs/issues/${id}/issue.md`;

    /**
     * Baut einen injizierten Lesezugriff aus einer Tabelle
     * `ref -> { issueId -> text }`. Fehlt ein Eintrag, liefert er null --
     * genau wie ein `git show` fuer eine auf diesem Ref nicht vorhandene Datei.
     */
    const showFileFrom = (contentByRef) => (refName, filePath) => {
      const forRef = contentByRef[refName] ?? {};
      const id = issueIdFromPath(filePath);
      return forRef[id] ?? null;
    };

    it('collects an issue that lives only on a work branch, not on the default branch', () => {
      const refs = [
        { name: 'origin/main', issuePaths: [], isDefaultBranch: true },
        { name: 'origin/feature', issuePaths: [trackerFile('10-neu')] },
      ];
      const content = {
        'origin/main': {},
        'origin/feature': { '10-neu': 'Status: ready-for-agent\nType: feature\n' },
      };

      const { issues } = collectOpenIssues(refs, showFileFrom(content));
      expect(issues).toHaveLength(1);
      expect(issues[0].id).toBe('10-neu');
      expect(issues[0].status).toBe('ready-for-agent');
      expect(issues[0].refs).toEqual(['origin/feature']);
    });

    it('excludes an issue that the default branch already closed, even if an older branch still shows it open', () => {
      const refs = [
        { name: 'origin/main', issuePaths: [trackerFile('05-alt')], isDefaultBranch: true },
        { name: 'origin/veraltet', issuePaths: [trackerFile('05-alt')] },
      ];
      const content = {
        'origin/main': { '05-alt': 'Status: resolved\nType: fix\n' },
        'origin/veraltet': { '05-alt': 'Status: claimed\nType: fix\n' },
      };

      const { issues } = collectOpenIssues(refs, showFileFrom(content));
      expect(issues).toEqual([]);
    });

    it('treats superseded on the default branch as closed as well', () => {
      const refs = [
        { name: 'origin/main', issuePaths: [trackerFile('06-ersetzt')], isDefaultBranch: true },
        { name: 'origin/veraltet', issuePaths: [trackerFile('06-ersetzt')] },
      ];
      const content = {
        'origin/main': { '06-ersetzt': 'Status: superseded\nType: chore\n' },
        'origin/veraltet': { '06-ersetzt': 'Status: ready-for-agent\nType: chore\n' },
      };

      expect(collectOpenIssues(refs, showFileFrom(content)).issues).toEqual([]);
    });

    it('merges the same open issue seen on several refs into one entry that lists every ref', () => {
      const refs = [
        { name: 'origin/main', issuePaths: [], isDefaultBranch: true },
        { name: 'origin/branch-a', issuePaths: [trackerFile('20-parallel')] },
        { name: 'origin/branch-b', issuePaths: [trackerFile('20-parallel')] },
      ];
      const open = 'Status: claimed\nType: feature\n';
      const content = {
        'origin/main': {},
        'origin/branch-a': { '20-parallel': open },
        'origin/branch-b': { '20-parallel': open },
      };

      const { issues } = collectOpenIssues(refs, showFileFrom(content));
      expect(issues).toHaveLength(1);
      expect(issues[0].refs).toEqual(['origin/branch-a', 'origin/branch-b']);
    });

    it('drops a resolved issue on its own ref via the closed-status rule', () => {
      const refs = [
        { name: 'origin/main', issuePaths: [], isDefaultBranch: true },
        { name: 'origin/feature', issuePaths: [trackerFile('30-fertig'), trackerFile('31-offen')] },
      ];
      const content = {
        'origin/main': {},
        'origin/feature': {
          '30-fertig': 'Status: resolved\nType: chore\n',
          '31-offen': 'Status: ready-for-agent\nType: chore\n',
        },
      };

      const { issues } = collectOpenIssues(refs, showFileFrom(content));
      expect(issues.map((issue) => issue.id)).toEqual(['31-offen']);
    });

    it('records an issue with no status header as unreadable instead of losing it silently', () => {
      const refs = [
        { name: 'origin/main', issuePaths: [], isDefaultBranch: true },
        { name: 'origin/feature', issuePaths: [trackerFile('40-kaputt')] },
      ];
      const content = {
        'origin/main': {},
        'origin/feature': { '40-kaputt': '## Description\nKopfzeile fehlt.\n' },
      };

      const { issues, unreadable } = collectOpenIssues(refs, showFileFrom(content));
      expect(issues).toEqual([]);
      expect(unreadable).toEqual([{ id: '40-kaputt', ref: 'origin/feature', reason: 'missing-status-header' }]);
    });

    it('sorts the open issues by id', () => {
      const refs = [
        { name: 'origin/main', issuePaths: [], isDefaultBranch: true },
        { name: 'origin/feature', issuePaths: [trackerFile('02-b'), trackerFile('01-a')] },
      ];
      const content = {
        'origin/main': {},
        'origin/feature': {
          '02-b': 'Status: claimed\nType: chore\n',
          '01-a': 'Status: claimed\nType: chore\n',
        },
      };

      const { issues } = collectOpenIssues(refs, showFileFrom(content));
      expect(issues.map((issue) => issue.id)).toEqual(['01-a', '02-b']);
    });

    it('does not close anything when no ref is marked as the default branch', () => {
      const refs = [{ name: 'origin/feature', issuePaths: [trackerFile('50-solo')] }];
      const content = { 'origin/feature': { '50-solo': 'Status: claimed\nType: chore\n' } };

      const { issues } = collectOpenIssues(refs, showFileFrom(content));
      expect(issues.map((issue) => issue.id)).toEqual(['50-solo']);
    });
  });
});
