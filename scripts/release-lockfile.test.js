/**
 * Failing tests für das Issue "Das Release-Skript lässt das Lockfile zurück".
 *
 * Intent: `node scripts/release.js <patch|minor|X.Y.Z>` muss die neue Version
 * nicht nur in package.json schreiben, sondern auch in BEIDE Versionsstellen
 * von package-lock.json (`.version` und `.packages[""].version`), damit ein
 * `npm install` direkt nach dem Release den Arbeitsbaum sauber lässt.
 *
 * Die Tests laufen als Black-Box gegen den echten CLI-Einstieg: release.js und
 * versioning.js werden in ein Temp-Verzeichnis kopiert (das Skript löst
 * package.json relativ zu seinem eigenen Speicherort auf, nicht über cwd) und
 * dort per Kindprozess ausgeführt.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Vitest läuft mit cwd = Repo-Wurzel; import.meta.url ist in der
// jsdom-Umgebung keine file://-URL und daher hier nicht nutzbar.
const REPO_ROOT = process.cwd();

/** Minimales Lockfile im v3-Format mit einer echten Abhängigkeit als Kontrollwert. */
function makeLockfile(version) {
  return {
    name: 'army_builder',
    version,
    lockfileVersion: 3,
    requires: true,
    packages: {
      '': {
        name: 'army_builder',
        version,
        dependencies: { react: '^19.0.0' },
      },
      'node_modules/react': {
        version: '19.0.0',
        resolved: 'https://registry.npmjs.org/react/-/react-19.0.0.tgz',
      },
    },
  };
}

/**
 * Baut ein Temp-Projekt: scripts/release.js + scripts/versioning.js (Kopien),
 * daneben package.json und package-lock.json mit der Startversion.
 * @returns {{ dir: string, scriptPath: string }}
 */
function setupTempProject(startVersion, { lockfileTrailingNewline = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'release-lockfile-'));
  mkdirSync(join(dir, 'scripts'));
  copyFileSync(join(REPO_ROOT, 'scripts', 'release.js'), join(dir, 'scripts', 'release.js'));
  copyFileSync(join(REPO_ROOT, 'scripts', 'versioning.js'), join(dir, 'scripts', 'versioning.js'));

  const pkg = { name: 'army_builder', private: true, version: startVersion, type: 'module' };
  writeFileSync(join(dir, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);

  const lockRaw = JSON.stringify(makeLockfile(startVersion), null, 2);
  writeFileSync(join(dir, 'package-lock.json'), lockfileTrailingNewline ? `${lockRaw}\n` : lockRaw);

  return { dir, scriptPath: join(dir, 'scripts', 'release.js') };
}

function runRelease(scriptPath, arg) {
  execFileSync(process.execPath, [scriptPath, arg], { encoding: 'utf8' });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

describe('release.js aktualisiert package-lock.json', () => {
  /** @type {string[]} */
  let tempDirs;

  beforeEach(() => {
    tempDirs = [];
  });

  afterEach(() => {
    for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  });

  function project(startVersion, opts) {
    const p = setupTempProject(startVersion, opts);
    tempDirs.push(p.dir);
    return p;
  }

  // Kriterium 1: Nach dem Release nennen package.json und BEIDE
  // Lockfile-Stellen dieselbe Version.
  it('explizite Version X.Y.Z: package.json und beide Lockfile-Stellen tragen die neue Version', () => {
    const { dir, scriptPath } = project('1.4.2');
    runRelease(scriptPath, '2.0.0');

    expect(readJson(join(dir, 'package.json')).version).toBe('2.0.0');
    const lock = readJson(join(dir, 'package-lock.json'));
    expect(lock.version).toBe('2.0.0');
    expect(lock.packages[''].version).toBe('2.0.0');
  });

  it('patch-Bump: Lockfile folgt auf die nächste Patch-Version', () => {
    const { dir, scriptPath } = project('1.4.2');
    runRelease(scriptPath, 'patch');

    expect(readJson(join(dir, 'package.json')).version).toBe('1.4.3');
    const lock = readJson(join(dir, 'package-lock.json'));
    expect(lock.version).toBe('1.4.3');
    expect(lock.packages[''].version).toBe('1.4.3');
  });

  it('minor-Bump: Lockfile folgt auf die nächste Minor-Version (Patch auf 0)', () => {
    const { dir, scriptPath } = project('1.4.2');
    runRelease(scriptPath, 'minor');

    expect(readJson(join(dir, 'package.json')).version).toBe('1.5.0');
    const lock = readJson(join(dir, 'package-lock.json'));
    expect(lock.version).toBe('1.5.0');
    expect(lock.packages[''].version).toBe('1.5.0');
  });

  // Kriterium 2 (Mechanik): Das Lockfile bleibt npm-konsistent — nur die
  // Versionsstellen ändern sich, Format und übrige Einträge bleiben erhalten,
  // sodass ein anschließendes `npm install` nichts umschreiben würde.
  it('ändert genau die beiden Versionsstellen und lässt die übrigen Lockfile-Einträge unangetastet', () => {
    const { dir, scriptPath } = project('1.4.2');
    const before = readJson(join(dir, 'package-lock.json'));
    runRelease(scriptPath, '2.0.0');
    const after = readJson(join(dir, 'package-lock.json'));

    // Die Versionsstellen müssen sich geändert haben …
    expect(after.version).toBe('2.0.0');
    expect(after.packages[''].version).toBe('2.0.0');
    // … alles andere bleibt, wie es war.
    expect(after.lockfileVersion).toBe(before.lockfileVersion);
    expect(after.requires).toBe(before.requires);
    expect(after.name).toBe(before.name);
    expect(after.packages[''].name).toBe(before.packages[''].name);
    expect(after.packages[''].dependencies).toEqual(before.packages[''].dependencies);
    expect(after.packages['node_modules/react']).toEqual(before.packages['node_modules/react']);
  });

  it('erhält den abschließenden Zeilenumbruch und die 2-Space-Einrückung des Lockfiles', () => {
    const { dir, scriptPath } = project('1.4.2', { lockfileTrailingNewline: true });
    runRelease(scriptPath, '2.0.0');

    const raw = readFileSync(join(dir, 'package-lock.json'), 'utf8');
    expect(raw.endsWith('\n')).toBe(true);
    // 2-Space-Einrückung wie von npm geschrieben (Konvention wie in
    // writePackageVersion für package.json).
    const expected = `${JSON.stringify(makeLockfile('2.0.0'), null, 2)}\n`;
    expect(raw).toBe(expected);
  });

  it('fügt keinen Zeilenumbruch an, wenn das Lockfile ohne einen endet', () => {
    const { dir, scriptPath } = project('1.4.2', { lockfileTrailingNewline: false });
    runRelease(scriptPath, '2.0.0');

    const raw = readFileSync(join(dir, 'package-lock.json'), 'utf8');
    // Version muss trotzdem nachgezogen sein …
    expect(JSON.parse(raw).version).toBe('2.0.0');
    // … aber die Newline-Konvention der Datei bleibt erhalten.
    expect(raw.endsWith('\n')).toBe(false);
  });
});

// Kriterium 3: Der bestehende Rückstand im echten Repo (package.json 1.9.0,
// Lockfile 1.8.2) wird aufgeholt. Repo-Zustands-Fakt, als Test gepinnt.
describe('echtes Repo: package.json und package-lock.json sind versionsgleich', () => {
  it('beide Lockfile-Stellen nennen die package.json-Version', () => {
    const pkg = readJson(join(REPO_ROOT, 'package.json'));
    const lock = readJson(join(REPO_ROOT, 'package-lock.json'));

    expect(lock.version).toBe(pkg.version);
    expect(lock.packages[''].version).toBe(pkg.version);
  });
});
