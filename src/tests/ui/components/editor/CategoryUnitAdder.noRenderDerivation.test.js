import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

/**
 * Issue 0164, Kriterium 2 — `CategoryUnitAdder.jsx` enthält keine Ableitung
 * mehr: kein Filtern, kein Sortieren, kein Auflösen eines Katalog-Eintrags im
 * Render. Die fertige Liste kommt aus `useRecruitOffer`.
 *
 * Das ist eine Aussage über die Quelle, nicht über den Bildschirm: eine wieder
 * eingebaute Render-Ableitung liefert dasselbe DOM wie das ViewModel und geht
 * durch jeden Verhaltenstest hindurch. Deshalb liest dieser Test die Datei.
 */

const FILE = 'CategoryUnitAdder.jsx';
// Quelldatei bleibt in src/ui/components/editor/, dieser Test liegt unter src/tests/.
const SOURCE_DIR = path.join(__dirname, '../../../../ui/components/editor');
const source = fs.readFileSync(path.join(SOURCE_DIR, FILE), 'utf8');

/** Der Rumpf der Default-Export-Komponente, ohne Signatur. */
function componentBody() {
  const start = source.indexOf('export default function CategoryUnitAdder');
  expect(start, `${FILE}: Default-Export-Komponente gefunden`).toBeGreaterThanOrEqual(0);
  return source.slice(start);
}

describe('CategoryUnitAdder rechnet nicht im Render (Issue 0164)', () => {
  it('kein Filtern, Sortieren oder Zusammenrechnen in der Datei', () => {
    const derivations = /\.(filter|sort|reduce|reduceRight|flatMap|slice|concat|find|findLast|some|every|sortBy)\s*\(|useMemo\s*\(/g;
    const offenders = [...source.matchAll(derivations)].map(match => {
      const line = source.slice(0, match.index).split('\n').length;
      return `${FILE}:${line}: ${match[0]}`;
    });

    expect(offenders, 'Die Kandidatenliste kommt fertig aus useRecruitOffer').toEqual([]);
  });

  it('zwischen ViewModel und JSX steht keine lokale Ableitung', () => {
    const body = componentBody();
    const hookEnd = body.indexOf('useRecruitOffer(');
    const jsxStart = body.indexOf('\n  return (');
    expect(hookEnd, `${FILE}: Aufruf von useRecruitOffer gefunden`).toBeGreaterThanOrEqual(0);
    expect(jsxStart, `${FILE}: JSX-Return gefunden`).toBeGreaterThan(hookEnd);

    const between = body.slice(body.indexOf('\n', hookEnd), jsxStart);
    const bindings = [...between.matchAll(/^\s*(?:const|let|var)\s+([^=\n]+)=/gm)].map(m => m[1].trim());

    expect(bindings, `${FILE} bindet zwischen Hook und JSX: ${bindings.join(', ')}`).toEqual([]);
  });

  it('löst keinen Katalog-Eintrag auf und greift an keiner Fachlogik vorbei', () => {
    const allowed = [
      'react', 'lucide-react',
      '../../viewmodels/editor/useRecruitOffer',
      '../../i18n/useTranslation',
      './BottomSheet',
    ];
    const imports = [...source.matchAll(/from '([^']+)'/g)].map(m => m[1]);
    const foreign = imports.filter(specifier => !allowed.includes(specifier));

    expect(foreign, `${FILE} importiert ausserhalb des ViewModels: ${foreign.join(', ')}`).toEqual([]);
  });

  it('reicht `entries` nur an das ViewModel weiter, statt es selbst zu lesen', () => {
    const uses = componentBody().split('\n')
      .map(line => line.trim())
      .filter(line => /\bentries\b/.test(line));

    const beyondHandover = uses.filter(line =>
      !line.startsWith('entries') && !line.includes('useRecruitOffer('));

    expect(beyondHandover, `${FILE} liest entries selbst: ${beyondHandover.join(' | ')}`).toEqual([]);
  });
});
