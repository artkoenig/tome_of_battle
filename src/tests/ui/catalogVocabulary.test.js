import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

/**
 * Issue 0191 — das Vokabular des Fremdformats endet an der Übersetzungsschicht
 * des Listen-Kontexts (`src/contexts/armylist/acl/`).
 *
 * Kein Modul unter `src/ui/` nennt die Worte des BattleScribe-Katalogs, und
 * keines importiert den geteilten Schema-Kern. Die Modulkante hält die
 * cast-Regel `ui-kein-fremdformat`; das **Vokabular** kann cast nicht sehen —
 * es steht in Bezeichnern, nicht in Kanten —, deshalb liest dieser Test die
 * Quelle. Ein neuer Katalog-Zugriff in der UI fällt hier auf, mit Datei und
 * Zeile.
 */

const UI_DIR = path.join(__dirname, '../../ui');

/** Die Worte, die der Katalog spricht und die UI nicht (Issue 0191). */
const FOREIGN_VOCABULARY = [
  'selectionEntries',
  'entryLinks',
  'categoryLinks',
  'sharedSelectionEntries',
  'infoLinks',
  'targetId',
];

/** Jede `.js`/`.jsx`-Quelle unterhalb eines Verzeichnisses. */
function sourceFilesOf(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFilesOf(full);
    return /\.jsx?$/.test(entry.name) ? [full] : [];
  });
}

const SOURCES = sourceFilesOf(UI_DIR).map(file => ({
  file: path.relative(path.join(__dirname, '../..'), file),
  lines: fs.readFileSync(file, 'utf8').split('\n'),
}));

describe('Die UI spricht unser Vokabular, nie das des Katalogs (Issue 0191)', () => {
  it('liest überhaupt Quellen ein', () => {
    expect(SOURCES.length).toBeGreaterThan(50);
  });

  for (const word of FOREIGN_VOCABULARY) {
    it(`kein Modul unter src/ui/ nennt \`${word}\``, () => {
      const pattern = new RegExp(`\\b${word}\\b`);
      const hits = SOURCES.flatMap(({ file, lines }) => lines
        .map((line, index) => (pattern.test(line) ? `${file}:${index + 1}: ${line.trim()}` : null))
        .filter(Boolean));
      expect(hits, hits.join('\n')).toEqual([]);
    });
  }

  it('kein Modul unter src/ui/ importiert den BattleScribe-Schema-Kern', () => {
    const pattern = /from\s+['"][^'"]*shared\/battlescribe\//;
    const hits = SOURCES.flatMap(({ file, lines }) => lines
      .map((line, index) => (pattern.test(line) ? `${file}:${index + 1}` : null))
      .filter(Boolean));
    expect(hits, hits.join('\n')).toEqual([]);
  });
});
