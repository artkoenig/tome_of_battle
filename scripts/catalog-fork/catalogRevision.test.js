import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  CATPKG_TYPE,
  readRootRevision,
  withRootRevision,
  contentDiffersIgnoringRevision,
  resolveRevision,
  catpkgTypeForFileName,
  isCatalogFileName,
  buildCatpkgEntry,
  buildCatpkgIndex,
  applyCatalogSync,
} from './catalogRevision.js';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__');

function readFixture(fileName) {
  return readFileSync(join(FIXTURES_DIR, fileName), 'utf8');
}

const CATALOGUE_HEADER =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<catalogue id="b126-4acf-f567-bea6" name="Orcs and Goblins" revision="12"' +
  ' battleScribeVersion="2.03" authorName="Ergo Fargo" gameSystemId="6d8e-38d9-3c69-febf"' +
  ' gameSystemRevision="8" xmlns="http://www.battlescribe.net/schema/catalogueSchema">';

function catalogue(revision, body = '') {
  return `${CATALOGUE_HEADER.replace('revision="12"', `revision="${revision}"`)}\n  ${body}\n</catalogue>`;
}

const GAME_SYSTEM =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<gameSystem id="6d8e-38d9-3c69-febf" name="WHFB 6th" revision="8"' +
  ' battleScribeVersion="2.03" xmlns="http://www.battlescribe.net/schema/gameSystemSchema">\n' +
  '</gameSystem>';

describe('readRootRevision', () => {
  it('reads the numeric root revision', () => {
    expect(readRootRevision(catalogue(12))).toBe(12);
  });

  it('reads the root revision, not the sibling gameSystemRevision', () => {
    // The header carries gameSystemRevision="8"; the root revision is 12.
    expect(readRootRevision(catalogue(12))).toBe(12);
  });

  it('reads a game system root revision', () => {
    expect(readRootRevision(GAME_SYSTEM)).toBe(8);
  });

  it('throws when the content is not a catalog file', () => {
    expect(() => readRootRevision('<notACatalog revision="1"/>')).toThrow(/not a catalog/i);
  });

  it('throws when the root element has no revision attribute', () => {
    const withoutRevision = catalogue(3).replace(' revision="3"', '');
    expect(() => readRootRevision(withoutRevision)).toThrow(/revision/i);
  });
});

describe('withRootRevision', () => {
  it('sets the root revision and leaves the rest byte-identical', () => {
    const updated = withRootRevision(catalogue(12), 13);
    expect(readRootRevision(updated)).toBe(13);
    expect(updated).toBe(catalogue(13));
  });

  it('does not touch the gameSystemRevision attribute', () => {
    const updated = withRootRevision(catalogue(12), 99);
    expect(updated).toContain('gameSystemRevision="8"');
  });

  it('throws when the root element has no revision attribute to set', () => {
    const withoutRevision = catalogue(3).replace(' revision="3"', '');
    expect(() => withRootRevision(withoutRevision, 4)).toThrow(/revision/i);
  });
});

describe('contentDiffersIgnoringRevision', () => {
  it('is false when only the revision attribute differs', () => {
    expect(contentDiffersIgnoringRevision(catalogue(1), catalogue(2))).toBe(false);
  });

  it('is true when any non-revision content differs', () => {
    const withEntry = catalogue(1, '<entryLink id="x" name="Ice Trolls"/>');
    expect(contentDiffersIgnoringRevision(catalogue(1), withEntry)).toBe(true);
  });

  it('is true even when the differing versions share the same revision', () => {
    const withEntry = catalogue(1, '<entryLink id="x" name="Ice Trolls"/>');
    expect(contentDiffersIgnoringRevision(catalogue(1), withEntry)).toBe(true);
  });
});

describe('resolveRevision', () => {
  it('passes a brand-new file through untouched', () => {
    const incoming = catalogue(1, '<entryLink id="x"/>');
    const result = resolveRevision({ previousContent: null, incomingContent: incoming });
    expect(result).toEqual({ content: incoming, changed: false, revision: 1 });
  });

  it('keeps the fork revision when content is unchanged', () => {
    const result = resolveRevision({ previousContent: catalogue(5), incomingContent: catalogue(5) });
    expect(result.changed).toBe(false);
    expect(result.revision).toBe(5);
  });

  it('preserves the higher fork revision against an upstream reset of an unchanged file', () => {
    // Fork already at 5, upstream reset its own revision to 1 but content is the same.
    const result = resolveRevision({ previousContent: catalogue(5), incomingContent: catalogue(1) });
    expect(result.changed).toBe(false);
    expect(result.revision).toBe(5);
    expect(readRootRevision(result.content)).toBe(5);
  });

  it('is idempotent when re-run against a stale base holding a lower revision', () => {
    // A CI re-run: the already-bumped file (revision 2) is compared against the older
    // base (revision 1). Content is unchanged, so the revision must not drop back to 1.
    const result = resolveRevision({ previousContent: catalogue(1), incomingContent: catalogue(2) });
    expect(result.changed).toBe(false);
    expect(result.revision).toBe(2);
    expect(result.content).toBe(catalogue(2));
  });

  it('bumps to one above the previous revision on a content change', () => {
    const previous = catalogue(1);
    const incoming = catalogue(1, '<entryLink id="x" name="Ice Trolls"/>');
    const result = resolveRevision({ previousContent: previous, incomingContent: incoming });
    expect(result.changed).toBe(true);
    expect(result.revision).toBe(2);
    expect(readRootRevision(result.content)).toBe(2);
  });

  it('bumps above both the previous and the incoming revision', () => {
    const previous = catalogue(4);
    const incoming = catalogue(2, '<entryLink id="x" name="Ice Trolls"/>');
    const result = resolveRevision({ previousContent: previous, incomingContent: incoming });
    expect(result.revision).toBe(5);
  });
});

describe('catpkgTypeForFileName / isCatalogFileName', () => {
  it('maps a .cat file to the catalogue type', () => {
    expect(catpkgTypeForFileName('Skaven.cat')).toBe(CATPKG_TYPE.CATALOGUE);
  });

  it('maps a .gst file to the game system type', () => {
    expect(catpkgTypeForFileName('WHFB.gst')).toBe(CATPKG_TYPE.GAME_SYSTEM);
  });

  it('rejects an unsupported file extension', () => {
    expect(() => catpkgTypeForFileName('catpkg.json')).toThrow(/unsupported/i);
  });

  it('recognises catalog file names', () => {
    expect(isCatalogFileName('Skaven.cat')).toBe(true);
    expect(isCatalogFileName('WHFB.gst')).toBe(true);
    expect(isCatalogFileName('catpkg.json')).toBe(false);
    expect(isCatalogFileName('README.md')).toBe(false);
  });
});

describe('buildCatpkgEntry', () => {
  it('emits id, name, path, type, numeric revision and a sourceSha256', () => {
    const entry = buildCatpkgEntry({ fileName: 'Orcs and Goblins.cat', content: catalogue(12) });
    expect(entry).toEqual({
      id: 'b126-4acf-f567-bea6',
      name: 'Orcs and Goblins',
      path: 'Orcs and Goblins.cat',
      type: CATPKG_TYPE.CATALOGUE,
      revision: 12,
      sourceSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  });

  it('carries the real file name in path, even when it differs from the catalogue name', () => {
    // Upstream names files independently of the catalogue name (e.g. name "Chaos Dwarfs"
    // vs file "Chaos Dwarves (6th definitive edition).cat"); path must be the file name.
    const entry = buildCatpkgEntry({
      fileName: 'Chaos Dwarves (6th definitive edition).cat',
      content: catalogue(1),
    });
    expect(entry.name).toBe('Orcs and Goblins');
    expect(entry.path).toBe('Chaos Dwarves (6th definitive edition).cat');
  });

  it('hashes the final content, so a revision change changes the sourceSha256', () => {
    const before = buildCatpkgEntry({ fileName: 'x.cat', content: catalogue(1) });
    const after = buildCatpkgEntry({ fileName: 'x.cat', content: catalogue(2) });
    expect(after.sourceSha256).not.toBe(before.sourceSha256);
  });
});

describe('buildCatpkgIndex', () => {
  it('builds a repositoryFiles array sorted by name', () => {
    const index = buildCatpkgIndex([
      { fileName: 'Skaven.cat', content: catalogue(1) },
      { fileName: 'WHFB.gst', content: GAME_SYSTEM },
    ]);
    expect(index.repositoryFiles.map((entry) => entry.name)).toEqual(['Orcs and Goblins', 'WHFB 6th']);
  });
});

describe('applyCatalogSync', () => {
  it('bumps changed files, leaves unchanged ones, and reflects both in the index', () => {
    const previousByName = {
      'Skaven.cat': catalogue(1),
      'WHFB.gst': GAME_SYSTEM,
    };
    const files = [
      { fileName: 'Skaven.cat', content: catalogue(1, '<entryLink id="x" name="Ice Trolls"/>') },
      { fileName: 'WHFB.gst', content: GAME_SYSTEM },
    ];
    const { results, catpkgIndex } = applyCatalogSync({
      files,
      resolvePreviousContent: (fileName) => previousByName[fileName] ?? null,
    });

    const skaven = results.find((result) => result.fileName === 'Skaven.cat');
    const gameSystem = results.find((result) => result.fileName === 'WHFB.gst');
    expect(skaven.changed).toBe(true);
    expect(skaven.revision).toBe(2);
    expect(gameSystem.changed).toBe(false);
    expect(gameSystem.revision).toBe(8);

    const skavenEntry = catpkgIndex.repositoryFiles.find((entry) => entry.name === 'Orcs and Goblins');
    expect(skavenEntry.revision).toBe(2);
  });
});

describe('regression: real Skaven diff (release 0.0.6 → 0.0.6.20260711)', () => {
  const previous = readFixture('Skaven.release-0.0.6.cat');
  const incoming = readFixture('Skaven.release-0.0.6.20260711.cat');

  it('the fixtures reproduce the verified upstream state: a new entryLink, revision still "1"', () => {
    expect(readRootRevision(previous)).toBe(1);
    expect(readRootRevision(incoming)).toBe(1);
    expect(previous).not.toContain('Ice Trolls');
    expect(incoming).toContain('name="Ice Trolls"');
  });

  it('bumps revision to 2 for the real content change', () => {
    const result = resolveRevision({ previousContent: previous, incomingContent: incoming });
    expect(result.changed).toBe(true);
    expect(result.revision).toBe(2);
    expect(readRootRevision(result.content)).toBe(2);
    // The bump must be the only change beyond the upstream diff itself.
    expect(result.content).toContain('name="Ice Trolls"');
  });

  it('records revision 2 in the regenerated catpkg entry', () => {
    const { catpkgIndex } = applyCatalogSync({
      files: [{ fileName: 'Skaven.cat', content: incoming }],
      resolvePreviousContent: () => previous,
    });
    expect(catpkgIndex.repositoryFiles).toEqual([
      {
        id: 'cac6-5f02-f95d-a403',
        name: 'Skaven',
        path: 'Skaven.cat',
        type: CATPKG_TYPE.CATALOGUE,
        revision: 2,
        sourceSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      },
    ]);
  });
});
