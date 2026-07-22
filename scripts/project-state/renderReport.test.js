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

/** Ein abgeleitetes Gesamturteil in der Form, die `buildReportModel` erzeugt. */
function makeAssessment(overrides = {}) {
  return {
    headline: 'Alle 3 blockierenden Gates bestehen',
    facts: [
      'Bestandene blockierende Gates: 3 von 3',
      'Nur-Hinweis-Gates mit Befunden: 1',
      'Nicht angelaufene Gates: 1',
    ],
    ...overrides,
  };
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
    assessment: makeAssessment(),
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
    complexFunctions: [
      { name: 'solve', path: 'src/solver/engine.js', startLine: 42, complexity: 21 },
      { name: 'parseRoster', path: 'src/parser/roster.js', startLine: 10, complexity: 7 },
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

  describe('Gesamturteil aus Messwerten abgeleitet', () => {
    it('zeigt das Gesamturteil mit Kopfzeile und gemessenen Fakten vor den Bereichen', () => {
      const model = makeModel();
      const html = renderReport(model);
      const verdictIndex = html.indexOf('Gesamturteil');
      const healthcheckIndex = html.indexOf('id="healthcheck"');
      expect(verdictIndex).toBeGreaterThan(-1);
      expect(verdictIndex).toBeLessThan(healthcheckIndex);
      expect(html).toContain(model.assessment.headline);
      for (const fact of model.assessment.facts) {
        expect(html).toContain(fact);
      }
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

  describe('LOC und Komplexitaet', () => {
    it('zeigt Umfang und Komplexitaet je Modul (Zeilen, Funktionen, Summe/Durchschnitt/Max)', () => {
      const html = renderReport(makeModel());
      expect(html).toContain('Umfang und Komplexitaet je Modul');
      expect(html).toContain('src/solver');
      expect(html).toContain('900'); // Zeilen je Modul
      expect(html).toContain('136'); // Summe der Komplexitaet je Modul
      expect(html).toContain('3.4'); // durchschnittliche Komplexitaet
      expect(html).toContain('21'); // hoechste Komplexitaet
    });

    it('fuehrt die komplexesten Funktionen auf, parallel zu den laengsten', () => {
      const html = renderReport(makeModel());
      expect(html).toContain('Komplexeste Funktionen');
      expect(html).toContain('solve');
      expect(html).toContain('src/solver/engine.js');
    });

    it('nennt die Gesamt-Codezeilen als Kennzahl', () => {
      const html = renderReport(makeModel({ metrics: [{ label: 'Codezeilen gesamt', value: 1200 }] }));
      expect(html).toContain('Codezeilen gesamt');
      expect(html).toContain('1200');
    });

    it('meldet fehlenden Produktivcode ausdruecklich statt leerer Tabellen', () => {
      const html = renderReport(makeModel({ moduleMetrics: [], complexFunctions: [] }));
      expect(html).toContain('Kein Produktivcode erfasst.');
      expect(html).toContain('Keine Funktionen erfasst.');
    });
  });

  describe('mobil-tauglich', () => {
    it('legt jede breite Tabelle in einen eigenen horizontal scrollbaren Container', () => {
      const html = renderReport(makeModel());
      // Fuenf Tabellen (Gates, Umfang/Komplexitaet je Modul, Abdeckung,
      // komplexeste Funktionen, laengste Funktionen), jede in ihrem Container.
      expect((html.match(/class="table-scroll"/g) ?? []).length).toBe(5);
      expect(html).toContain('overflow-x: auto');
    });

    it('setzt das Viewport-Meta und eine Media Query fuer schmale Viewports', () => {
      const html = renderReport(makeModel());
      expect(html).toContain('width=device-width, initial-scale=1');
      expect(html).toMatch(/@media \(max-width:/);
    });
  });

  describe('Issues kompakt und ausklappbar', () => {
    it('stellt jeden Vorgang als natives <details> mit kompakter Zusammenfassung dar', () => {
      const html = renderReport(makeModel());
      expect(html).toContain('<details class="issue"');
      // Kompakte Zeile: Titel und Status stehen in der Zusammenfassung.
      expect(html).toMatch(/<summary class="issue-summary">[\s\S]*?berichtsseite rendern[\s\S]*?claimed[\s\S]*?<\/summary>/);
    });

    it('klappt Beschreibung und Akzeptanzkriterien im Detailteil auf, aus Markdown gerendert', () => {
      const html = renderReport(makeModel());
      const bodyStart = html.indexOf('<div class="issue-body">');
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
