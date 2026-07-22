import { describe, it, expect } from 'vitest';
import { renderReport } from './renderReport.js';
import { buildGateStates } from './gates.js';
import { OVERALL_ASSESSMENT, FINDING_ASSESSMENTS } from './assessment.js';

/**
 * `renderReport` ist rein: alle Tests speisen ein fertiges Datenmodell ein und
 * pruefen den HTML-Text. Kein Test beruehrt Dateisystem, Git oder Netz.
 *
 * Die Gate-Zustaende entstehen ueber `buildGateStates` aus Schnitt 01 -- ebenfalls
 * eine reine Funktion -- damit der Test genau die Form prueft, die spaeter der
 * Generator liefert.
 */
function makeGates() {
  return buildGateStates({
    workflowJob: {
      steps: [
        { run: 'npm run lint' },
        { run: 'npm run knip', 'continue-on-error': true },
        { run: 'npm run depcruise', 'continue-on-error': true },
      ],
    },
    runs: {
      lint: { exitCode: 0, output: 'ok' },
      knip: { exitCode: 1, output: '26 problems' },
      depcruise: { exitCode: 1, output: 'ERROR: Your node version (25.0.0) is not supported.' },
    },
  });
}

function makeOpenIssue(overrides = {}) {
  return {
    id: '54-bericht/02-render',
    title: 'berichtsseite rendern',
    path: 'docs/issues/54-bericht/02-render/issue.md',
    status: 'claimed',
    type: 'chore',
    blockedBy: ['01'],
    sections: {
      Description: 'Ein **wichtiger** Vorgang.\n\n- Punkt eins\n- Punkt zwei',
      'Acceptance Criteria': '- [ ] Erste Bedingung\n- [x] Zweite Bedingung',
    },
    refs: ['origin/issue/foo'],
    ...overrides,
  };
}

function makeModel(overrides = {}) {
  return {
    generatedAt: '2026-07-22 10:00 UTC',
    assessment: OVERALL_ASSESSMENT,
    findingAssessments: FINDING_ASSESSMENTS,
    gates: makeGates(),
    metrics: [{ label: 'Offene Issues', value: 3 }],
    coverage: [
      {
        module: 'scripts/project-state',
        fileCount: 5,
        statements: { covered: 80, total: 100, percent: 80 },
        branches: { covered: 8, total: 10, percent: 80 },
        functions: { covered: 9, total: 10, percent: 90 },
      },
    ],
    longFunctions: [
      { name: 'renderReport', path: 'scripts/project-state/renderReport.js', startLine: 60, endLine: 130, lineCount: 71 },
    ],
    structure: {
      moduleCount: 42,
      dependencyCount: 120,
      cycles: [['src/a.js', 'src/b.js']],
      layerViolations: [{ from: 'src/parser/x.js', to: 'src/solver/y.js', fromLayer: 'parser', toLayer: 'solver' }],
    },
    openIssues: [makeOpenIssue()],
    unreadableIssues: [],
    branchScope: { scannedRefs: ['origin/main', 'origin/issue/foo'] },
    ...overrides,
  };
}

describe('project-state/renderReport', () => {
  describe('eigenstaendiges Dokument', () => {
    it('erzeugt ein vollstaendiges HTML-Dokument mit eingebettetem Stylesheet', () => {
      const html = renderReport(makeModel());
      expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
      expect(html).toContain('<html lang="de">');
      expect(html).toContain('<style>');
      expect(html).toContain('</html>');
    });

    it('laedt keine externen Ressourcen und fuehrt kein Skript', () => {
      const html = renderReport(makeModel());
      expect(html).not.toMatch(/<script/i);
      expect(html).not.toMatch(/<link\b/i);
      expect(html).not.toMatch(/https?:\/\//i);
      expect(html).not.toMatch(/@import/i);
    });
  });

  describe('zwei Bereiche unter einer URL', () => {
    it('traegt Healthcheck und Issues als Anker-Bereiche mit Navigation', () => {
      const html = renderReport(makeModel());
      expect(html).toContain('id="healthcheck"');
      expect(html).toContain('id="issues"');
      expect(html).toContain('href="#healthcheck"');
      expect(html).toContain('href="#issues"');
    });
  });

  describe('Gesamturteil vorangestellt', () => {
    it('zeigt das Gesamturteil vor den beiden Bereichen', () => {
      const html = renderReport(makeModel());
      const verdictIndex = html.indexOf('Gesamturteil');
      const healthcheckIndex = html.indexOf('id="healthcheck"');
      expect(verdictIndex).toBeGreaterThan(-1);
      expect(verdictIndex).toBeLessThan(healthcheckIndex);
      expect(html).toContain(OVERALL_ASSESSMENT.headline);
    });

    it('setzt den Erhebungszeitpunkt aus dem Modell ein', () => {
      const html = renderReport(makeModel({ generatedAt: '2099-01-01 00:00 UTC' }));
      expect(html).toContain('2099-01-01 00:00 UTC');
    });
  });

  describe('Gates mit Wirksamkeit und drittem Zustand', () => {
    it('weist je Gate aus, ob es blockiert oder nur warnt', () => {
      const html = renderReport(makeModel());
      expect(html).toContain('blockierend');
      expect(html).toContain('nur Hinweis');
    });

    it('stellt ein nicht angelaufenes Gate als solches dar und nie als bestanden', () => {
      const html = renderReport(makeModel());
      expect(html).toContain('nicht angelaufen');
      expect(html).toContain('nicht unterstuetzte Node-Version');
      // Nur ein Gate (lint) ist bestanden; die nicht angelaufenen Gates duerfen
      // das gruene "bestanden" nicht tragen.
      expect((html.match(/bestanden/g) ?? []).length).toBe(1);
    });

    it('macht den Zustand ohne Farbe erkennbar: Symbol und Wort, nicht nur eine Klasse', () => {
      const html = renderReport(makeModel());
      expect(html).toContain('badge-inert'); // eigener Ton fuer not-run, nie badge-ok
      expect(html).toMatch(/∅[\s\S]*?nicht angelaufen/); // Symbol + Wort tragen die Bedeutung
    });

    it('benennt eine unbekannte Wirksamkeit und einen fehlenden Lauf', () => {
      const html = renderReport(makeModel());
      expect(html).toContain('Wirksamkeit unbekannt'); // typecheck steht in keinem Workflow-Step
      expect(html).toContain('kein Lauf erfasst'); // fuer Gates ohne Laufergebnis
    });
  });

  describe('Kennzahlen, Abdeckung, Funktionen, Struktur', () => {
    it('zeigt Abdeckung je Modul und die laengsten Funktionen', () => {
      const html = renderReport(makeModel());
      expect(html).toContain('scripts/project-state');
      expect(html).toMatch(/90\s*%/); // schmales geschuetztes Leerzeichen zwischen Zahl und Zeichen
      expect(html).toContain('renderReport');
    });

    it('zeigt Strukturfakten inklusive Zyklen und Schichtverstoessen', () => {
      const html = renderReport(makeModel());
      expect(html).toContain('src/a.js → src/b.js');
      expect(html).toContain('parser darf nicht auf solver');
    });

    it('meldet leere Struktur ausdruecklich statt sie zu verschweigen', () => {
      const html = renderReport(makeModel({ structure: { moduleCount: 1, dependencyCount: 0, cycles: [], layerViolations: [] } }));
      expect(html).toContain('Keine Zyklen.');
      expect(html).toContain('Keine Schichtverstoesse.');
    });
  });

  describe('Issues als Volltext, aus Markdown gerendert', () => {
    it('rendert Beschreibung und Akzeptanzkriterien zur Bauzeit zu HTML', () => {
      const html = renderReport(makeModel());
      expect(html).toContain('berichtsseite rendern');
      expect(html).toContain('54-bericht/02-render');
      expect(html).toContain('<strong>wichtiger</strong>'); // Markdown -> HTML
      expect(html).toContain('<li>Punkt eins</li>');
      expect(html).toContain('<h4>Acceptance Criteria</h4>');
      expect(html).toContain('Erste Bedingung');
    });

    it('weist sichtbar aus, dass nur gepushte Branches erfasst sind', () => {
      const html = renderReport(makeModel());
      expect(html).toContain('Nur gepushte Branches');
      expect(html).toContain('origin/main');
    });

    it('meldet leere Issue-Liste ausdruecklich', () => {
      const html = renderReport(makeModel({ openIssues: [] }));
      expect(html).toContain('Keine offenen Vorgaenge.');
    });

    it('weist nicht lesbare Vorgaenge aus, statt sie zu verschlucken', () => {
      const unreadable = [{ id: '99-kaputt', ref: 'origin/x', reason: 'missing-status-header' }];
      const html = renderReport(makeModel({ unreadableIssues: unreadable }));
      expect(html).toContain('99-kaputt');
      expect(html).toContain('missing-status-header');
    });
  });

  describe('Trennung von Messung und Urteil', () => {
    it('mischt die Einordnung aus der versionierten Datei dazu', () => {
      const html = renderReport(makeModel());
      expect(html).toContain('ADR 0023');
      expect(html).toContain('von Hand gepflegten, versionierten Datei');
    });

    it('erzeugt fuer dasselbe Modell denselben HTML-Text (ueberlebt einen Neulauf unveraendert)', () => {
      const model = makeModel();
      expect(renderReport(model)).toBe(renderReport(model));
    });
  });

  describe('Robustheit', () => {
    it('maskiert Klartext, sodass Inhalte kein Markup einschleusen', () => {
      const html = renderReport(makeModel({ openIssues: [makeOpenIssue({ title: '<script>alert(1)</script>' })] }));
      expect(html).not.toContain('<script>alert(1)</script>');
      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    });
  });
});
