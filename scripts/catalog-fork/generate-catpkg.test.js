import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const GENERATE_CATPKG_SCRIPT = join(SCRIPT_DIR, 'generate-catpkg.js');

/**
 * Just past Node's 1 MiB (1024 * 1024) execFileSync default `maxBuffer`, so
 * `git show` streaming the previous version reproduces the ENOBUFS that a real
 * multi-megabyte Lexicanum catalog (e.g. "Forces of Chaos") triggers.
 */
const OVER_ONE_MEBIBYTE = 1024 * 1024 + 64 * 1024;

function largeCatalogue(revision, fillerByteCount) {
  const header =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    `<catalogue id="aaaa-bbbb-cccc-dddd" name="Large Catalog" revision="${revision}"` +
    ' battleScribeVersion="2.03" xmlns="http://www.battlescribe.net/schema/catalogueSchema">\n';
  const filler = `  <!-- ${'x'.repeat(fillerByteCount)} -->\n`;
  return header + filler + '</catalogue>\n';
}

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

describe('generate-catpkg CLI on catalogs larger than the execFileSync default buffer', () => {
  let repoDir;

  beforeEach(() => {
    repoDir = mkdtempSync(join(tmpdir(), 'catpkg-fork-'));
    git(repoDir, 'init', '--quiet');
    git(repoDir, 'config', 'user.email', 'test@example.com');
    git(repoDir, 'config', 'user.name', 'Catalog Fork Test');
  });

  afterEach(() => {
    rmSync(repoDir, { recursive: true, force: true });
  });

  it('reads the >1 MiB previous version via git show and bumps the changed file', () => {
    const catalogPath = join(repoDir, 'Large Catalog.cat');

    // Commit a >1 MiB v1, so `git show HEAD` must stream more than the 1 MiB default.
    writeFileSync(catalogPath, largeCatalogue(1, OVER_ONE_MEBIBYTE), 'utf8');
    git(repoDir, 'add', '.');
    git(repoDir, 'commit', '--quiet', '-m', 'add large catalog');

    // Change the content (still >1 MiB) without committing: the just-synced state.
    writeFileSync(catalogPath, largeCatalogue(1, OVER_ONE_MEBIBYTE + 1), 'utf8');

    // Threw ENOBUFS before the maxBuffer fix; must now complete and bump to revision 2.
    execFileSync('node', [GENERATE_CATPKG_SCRIPT, '--dir', repoDir, '--base', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const catpkg = JSON.parse(readFileSync(join(repoDir, 'catpkg.json'), 'utf8'));
    expect(catpkg.repositoryFiles).toHaveLength(1);
    expect(catpkg.repositoryFiles[0].revision).toBe(2);
    expect(readFileSync(catalogPath, 'utf8')).toContain('revision="2"');
  });
});
