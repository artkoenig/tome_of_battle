/**
 * Issue 0194, AC6 — die zweite Sperre gegen React in der Fachlichkeit.
 *
 * `.oxlintrc.json` verbietet den Import per `no-restricted-imports`; dieser Test
 * liest den Quelltext und ist damit die Gürtel-und-Hosenträger-Probe, die das
 * Repository für jede Grenze führt, die ein Werkzeug nur zur Hälfte sieht (Muster:
 * `src/tests/ui/catalogVocabulary.test.js`). Er hält, wenn jemand die
 * Lint-Konfiguration umbaut und dabei genau den Override erwischt, der die Regel
 * trug — oxlint **ersetzt** bei gleichem Treffer die frühere
 * `no-restricted-imports`-Konfiguration, statt sie zu mischen, also ist das ein
 * realistischer Unfall und kein hypothetischer.
 *
 * Gegenstand: `src/contexts/`, `src/platform/` und `src/shared/` kennen die
 * UI-Bibliothek nicht. Memoisierung leistet dort ein WeakMap-Cache über
 * Objektidentität (`acl/evaluationCache.js`, `readmodel/rosterReport.js`) — er
 * überlebt einen Ansichtswechsel, den ein `useMemo` wegwirft. Hooks gehören nach
 * `src/ui/viewmodels/`.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/** Die Ordner, die ohne die UI-Bibliothek auskommen. */
const FRAMEWORK_FREE_DIRS = ['src/contexts', 'src/platform', 'src/shared'];

/** Ein Import aus `react` oder `react-dom`, in beiden Anführungsformen. */
const REACT_IMPORT = /(?:^|\n)\s*(?:import[^;\n]*from\s*|import\s*|export[^;\n]*from\s*)['"]react(?:-dom)?(?:\/[^'"]*)?['"]/;

/** Alle Quelldateien unterhalb von `dir`, ohne Fixtures und ohne Tests. */
function sourceFilesOf(dir) {
  /** @type {string[]} */
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__fixtures__' || entry.name === 'node_modules') continue;
      found.push(...sourceFilesOf(full));
      continue;
    }
    if (!/\.jsx?$/.test(entry.name)) continue;
    if (/\.test\.jsx?$/.test(entry.name)) continue;
    found.push(full);
  }
  return found;
}

describe('Issue 0194: die Fachlichkeit kennt React nicht', () => {
  it.each(FRAMEWORK_FREE_DIRS)('%s enthält Quelldateien (der Test hat einen Gegenstand)', (dir) => {
    expect(sourceFilesOf(dir).length).toBeGreaterThan(0);
  });

  it.each(FRAMEWORK_FREE_DIRS)('kein Modul unter %s importiert react', (dir) => {
    const offenders = sourceFilesOf(dir).filter((file) =>
      REACT_IMPORT.test(fs.readFileSync(file, 'utf8'))
    );

    expect(
      offenders,
      'React gehört in src/ui/. Memoisierung leistet hier eine WeakMap über Objektidentität.'
    ).toEqual([]);
  });

  it('das Lesemodell des Regelwerks veröffentlicht keinen Hook mehr', () => {
    const door = fs.readFileSync('src/contexts/ruleengine/readmodel/index.js', 'utf8');

    expect(door).toContain('rosterReportOf');
    expect(door).not.toMatch(/export\s*\{\s*use[A-Z]/);
    expect(fs.existsSync('src/contexts/ruleengine/readmodel/useEvaluation.js')).toBe(false);
  });
});
