import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { collectCatalogFileNames, LAYOUTS, REPO_ROOT } from './e2e-harness.js';

describe('collectCatalogFileNames', () => {
  let workDir;

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-test-'));
  });

  afterEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  const writeFiles = (...fileNames) => {
    for (const fileName of fileNames) {
      fs.writeFileSync(path.join(workDir, fileName), '<xml/>');
    }
  };

  it('liefert nur Katalogdateien und ignoriert alles andere', () => {
    writeFiles('Ogres.cat', 'System.gst', 'README.md', 'notes.txt');

    expect(collectCatalogFileNames(workDir)).toEqual(['Ogres.cat', 'System.gst']);
  });

  it('sortiert alphabetisch, damit das erzeugte Archiv reproduzierbar ist', () => {
    writeFiles('Zzz.cat', 'Aaa.cat', 'Mmm.gst');

    expect(collectCatalogFileNames(workDir)).toEqual(['Aaa.cat', 'Mmm.gst', 'Zzz.cat']);
  });

  it('meldet ein fehlendes Verzeichnis, statt still ein leeres Archiv zu bauen', () => {
    expect(() => collectCatalogFileNames(path.join(workDir, 'gibt-es-nicht')))
      .toThrow(/nicht gefunden/);
  });

  it('meldet ein Verzeichnis ohne Katalogdateien', () => {
    writeFiles('README.md');

    expect(() => collectCatalogFileNames(workDir)).toThrow(/Keine/);
  });

  it('findet die eingefrorene Fixture des Repositories', () => {
    const fixtureDir = path.join(REPO_ROOT, 'src', 'solver', '__fixtures__', 'whfb6');

    const fileNames = collectCatalogFileNames(fixtureDir);

    expect(fileNames).toContain('Warhammer Fantasy Battle 6th edition.gst');
    expect(fileNames.every((name) => /\.(cat|gst)$/.test(name))).toBe(true);
  });
});

describe('LAYOUTS', () => {
  it('beschreibt für jede Ansicht Größe und Bereitschafts-Selektor', () => {
    for (const layout of Object.values(LAYOUTS)) {
      expect(layout.viewport.width).toBeGreaterThan(0);
      expect(layout.viewport.height).toBeGreaterThan(0);
      expect(layout.navReadySelector).toMatch(/^\./);
    }
  });
});
