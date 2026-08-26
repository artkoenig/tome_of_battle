import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

/** Verzeichnis der Quelldateien, die dieser Test einliest (nicht mit den Tests verschoben). */
const SOURCE_DIR = path.join(__dirname, '../../../../ui/components/editor');

/**
 * Issue 0164, Kriterium 3 — die Sektionsebene trägt keinen Prop-Satz mehr, der
 * ein halbes Datenmodell durchreicht.
 *
 * Bericht, Roster, Datensatz und Kommandos kommen aus den beiden
 * Roster-Kontexten, die Ableitungen aus dem ViewModel der Komponente; als Prop
 * bleibt allein, was der **Aufrufer** weiß und das ViewModel nicht selbst lesen
 * kann: welches Kontingent, welche Kategorie, welcher Anzeige-Zustand.
 *
 * Der Test liest die Prop-Liste aus der Quelle, weil React sie zur Laufzeit
 * nicht preisgibt — eine Komponente kennt ihre Stützen erst, wenn sie gerendert
 * wird, und dann nur die, die ein Aufrufer gerade setzt.
 */

/** Die Namen der destrukturierten Props der Default-Export-Komponente einer Datei. */
function propsOf(fileName) {
  const source = fs.readFileSync(path.join(SOURCE_DIR, fileName), 'utf8');
  const signature = source.match(/export default function \w+\(\{([\s\S]*?)\n\}\)/);
  expect(signature, `${fileName}: destrukturierte Prop-Liste gefunden`).not.toBeNull();
  return signature[1]
    .replace(/\/\/[^\n]*/g, '')
    .split(',')
    .map(part => part.trim().split('=')[0].trim())
    .filter(Boolean);
}

// Der Bestand vor Issue 0164, zum Vergleich in der Fehlermeldung.
const CEILINGS = [
  { file: 'ForceEditorSection.jsx', max: 6, before: 20 },
  { file: 'RosterCategorySection.jsx', max: 6, before: 18 },
  { file: 'ListRuleChecklist.jsx', max: 5, before: 15 },
];

describe('Die Sektionsebene reicht kein Datenmodell mehr durch (Issue 0164)', () => {
  for (const { file, max, before } of CEILINGS) {
    it(`${file}: höchstens ${max} Props (vor Issue 0164: ${before})`, () => {
      const props = propsOf(file);
      expect(props.length, `${file} führt ${props.join(', ')}`).toBeLessThanOrEqual(max);
    });
  }

  it('keine Sektion nimmt Bericht, Roster, Datensatz oder Kommandos noch als Prop', () => {
    const forbidden = new Set([
      'capabilities', 'pathBySelectionId', 'violations', 'unresolvedSelections',
      'roster', 'system', 'activeCatalogue', 'costTotals', 'costTypes',
      'raiseUnit', 'removeUnit', 'copyUnit', 'subSelectionOperations',
      'costTypeLabel', 'costLimitType', 'extraResources', 'remainingPoints', 'states',
    ]);
    const offenders = CEILINGS.flatMap(({ file }) =>
      propsOf(file).filter(prop => forbidden.has(prop)).map(prop => `${file}: ${prop}`));

    expect(offenders).toEqual([]);
  });
});
