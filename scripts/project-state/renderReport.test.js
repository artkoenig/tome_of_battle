import { describe, it, expect } from 'vitest';
import { renderReport } from './renderReport.js';
import { buildGateStates } from './gates.js';

/**
 * `renderReport` ist rein: alle Tests speisen ein fertiges Datenmodell ein und
 * pruefen den HTML-Text. Kein Test beruehrt Dateisystem, Git oder Netz.
 *
 * Die Gate-Zustaende entstehen ueber `buildGateStates` -- ebenfalls eine reine
 * Funktion -- damit der Test genau die Form prueft, die spaeter der Generator
 * liefert. Das Gesamturteil ist ein reines, aus Messwerten abgeleitetes Objekt
 * ({ headline, facts }); es wird hier als fertige Eingabe gestellt.
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
    moduleMetrics: [
      { module: 'src/solver', fileCount: 6, lines: 900, functionCount: 40, totalComplexity: 136, averageComplexity: 3.4, maxComplexity: 21 },
      { module: 'src/parser', fileCount: 3, lines: 300, functionCount: 12, totalComplexity: 25, averageComplexity: 2.1, maxComplexity: 7 },
    ],
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
      expect(html).toContain('<html lang="en">');
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

  describe('zwei Bereiche als echte Tabs ohne JavaScript', () => {
    it('traegt Healthcheck und Issues als umschaltbare Tab-Panels', () => {
      const html = renderReport(makeModel());
      expect(html).toContain('id="healthcheck"');
      expect(html).toContain('id="issues"');
      // Umschalter: versteckte Radios mit Labels statt Anker-Navigation.
      expect(html).toContain('id="tab-healthcheck"');
      expect(html).toContain('id="tab-issues"');
      expect(html).toContain('for="tab-healthcheck"');
      expect(html).toContain('for="tab-issues"');
      expect(html).toContain('panel panel-healthcheck');
      expect(html).toContain('panel panel-issues');
      // Kein Anker-Menue mehr, keine Sprungmarken.
      expect(html).not.toContain('href="#healthcheck"');
      expect(html).not.toContain('href="#issues"');
    });

    it('zeigt beim Laden nur einen Tab: Healthcheck ist der angehakte Standard', () => {
      const html = renderReport(makeModel());
      // Der Healthcheck-Tab traegt `checked`, der Issues-Tab nicht.
      expect(html).toMatch(/id="tab-healthcheck"[^>]*\bchecked\b/);
      expect(html).not.toMatch(/id="tab-issues"[^>]*\bchecked\b/);
      // Panels sind per Default unsichtbar; der Geschwister-Selektor blendet je
      // nach angehaktem Radio genau eines ein -- ganz ohne Skript.
      expect(html).toMatch(/\.panel\s*\{\s*display:\s*none/);
      expect(html).toContain('#tab-healthcheck:checked ~ .panel-healthcheck');
      expect(html).toContain('#tab-issues:checked ~ .panel-issues');
      expect(html).not.toMatch(/<script/i);
    });
  });

  describe('App-Design (Epic Battlefield Dark Fantasy Palette)', () => {
    it('traegt die App-Palette und Cinzel/Outfit/Inter Schriften self-contained', () => {
      const html = renderReport(makeModel());
      // Gold-Akzent und Dark Slate aus der Epic Battlefield Palette
      expect(html).toContain('--accent');
      expect(html).toContain('#F5D061'); // Gold
      expect(html).toContain('#07090E'); // Dark Slate
      expect(html).toContain('--font-heading');
      expect(html).toMatch(/--font-body:[^;]*sans-serif/);
      expect(html).not.toMatch(/fonts\.googleapis|fonts\.gstatic/i);
    });
  });

  describe('Header und Metadaten', () => {
    it('setzt den Erhebungszeitpunkt aus dem Modell ein', () => {
      const html = renderReport(makeModel({ generatedAt: '2099-01-01 00:00 UTC' }));
      expect(html).toContain('2099-01-01 00:00 UTC');
    });
  });

  describe('Quality Gates als leuchtende Runen', () => {
    it('stellt Gates als verschiedene leuchtende Runen mit englischen Tooltip-Details dar', () => {
      const html = renderReport(makeModel());
      expect(html).toContain('Quality Gates');
      expect(html).toContain('rune-grid');
      expect(html).toContain('rune-card');
      expect(html).toContain('rune-stone');
      expect(html).toContain('gate-tooltip');
      expect(html).toContain('Command:');
      expect(html).toContain('Status:');
      expect(html).toContain('Enforcement:');
      expect(html).toContain('blocking');
      expect(html).toContain('warning only');
    });

    it('stellt ein nicht angelaufenes Gate als solches dar und nie als bestanden', () => {
      const html = renderReport(makeModel());
      expect(html).toContain('not run');
      expect(html).toContain('unsupported Node version');
      expect((html.match(/rune-stone rune-ok/g) ?? []).length).toBe(1);
    });

    it('macht den Zustand ohne Farbe erkennbar: Symbol und Wort', () => {
      const html = renderReport(makeModel());
      expect(html).toContain('rune-inert');
      expect(html).toMatch(/ᛉ[\s\S]*?not run/);
    });

    it('benennt eine unbekannte Wirksamkeit und einen fehlenden Lauf im Tooltip', () => {
      const html = renderReport(makeModel());
      expect(html).toContain('enforcement unknown');
      expect(html).toContain('no run recorded');
    });
  });

  describe('Modul-Kacheln mit Reagenzglaesern', () => {
    it('rendert Kacheln pro Modul mit je zwei Reagenzglaesern fuer Komplexitaet und Testabdeckung und Tooltips bei Hover', () => {
      const html = renderReport(makeModel());
      expect(html).toContain('Module health &amp; metrics');
      expect(html).toContain('module-grid');
      expect(html).toContain('module-card');
      expect(html).toContain('vial-liquid');
      expect(html).toContain('vial-bubbles');
      expect(html).toContain('vial-tooltip');
      expect(html).toContain('src/solver');
      expect(html).toContain('136'); // total complexity badge
      // Sortierung: src/solver (hohe Komplexitaet) vor src/parser
      expect(html.indexOf('src/solver')).toBeLessThan(html.indexOf('src/parser'));
    });

    it('meldet fehlende Moduldaten ausdruecklich statt leerer Kacheln', () => {
      const html = renderReport(makeModel({ moduleMetrics: [], coverage: [] }));
      expect(html).toContain('No module data captured.');
    });
  });

  describe('mobil-tauglich', () => {
    it('setzt das Viewport-Meta und eine Media Query fuer schmale Viewports', () => {
      const html = renderReport(makeModel());
      expect(html).toContain('width=device-width, initial-scale=1');
      expect(html).toMatch(/@media \(max-width:/);
    });
  });

  describe('Issues kompakt und ausklappbar', () => {
    it('stellt jeden Vorgang als natives <details> mit kompakter Zusammenfassung dar', () => {
      const html = renderReport(makeModel());
      expect(html).toContain('<details class="issue issue-card"');
      // Kompakte Zeile: Titel und Status stehen in der Zusammenfassung.
      expect(html).toMatch(/<summary class="issue-summary issue-card-summary">[\s\S]*?berichtsseite rendern[\s\S]*?claimed[\s\S]*?<\/summary>/);
    });

    it('klappt Beschreibung und Akzeptanzkriterien im Detailteil auf, aus Markdown gerendert', () => {
      const html = renderReport(makeModel());
      const bodyStart = html.indexOf('<div class="issue-body issue-card-body">');
      expect(bodyStart).toBeGreaterThan(-1);
      expect(html).toContain('54-bericht/02-render');
      expect(html).toContain('<strong>wichtiger</strong>'); // Markdown -> HTML
      expect(html).toContain('<li>Punkt eins</li>');
      expect(html).toContain('<h4>Acceptance Criteria</h4>');
      expect(html).toContain('Erste Bedingung');
    });

    it('kommt ohne JavaScript aus -- das Aufklappen ist rein nativ', () => {
      const html = renderReport(makeModel());
      expect(html).not.toMatch(/<script/i);
      expect(html).toContain('<summary');
    });

    it('meldet leere Issue-Liste ausdruecklich', () => {
      const html = renderReport(makeModel({ openIssues: [] }));
      expect(html).toContain('No open issues.');
    });

    it('weist nicht lesbare Vorgaenge aus, statt sie zu verschlucken', () => {
      const unreadable = [{ id: '99-kaputt', ref: 'origin/x', reason: 'missing-status-header' }];
      const html = renderReport(makeModel({ unreadableIssues: unreadable }));
      expect(html).toContain('99-kaputt');
      expect(html).toContain('missing-status-header');
    });
  });

  describe('vollstaendig dynamisch -- kein hand-gepflegter Text', () => {
    it('enthaelt keinen der frueheren hand-gepflegten Einordnungs-Texte mehr', () => {
      const html = renderReport(makeModel());
      // Der alte "Eingeordnete Befunde"-Block und seine Deutungen sind restlos weg.
      expect(html).not.toMatch(/assessment/i);
      expect(html).not.toContain('Eingeordnete Befunde');
      expect(html).not.toContain('von Hand gepflegten');
      expect(html).not.toContain('Absicht');
      expect(html).not.toContain('bricht ab');
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
