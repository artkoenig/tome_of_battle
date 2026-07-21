/**
 * dependency-cruiser-Konfiguration.
 *
 * Macht die in ADR 0023 fixierte Solver-Fassade und die Schichtung
 * parser -> solver -> components zu maschinell gepruefen Regeln und ergaenzt
 * die Zyklus- und Waisen-Erkennung, die oxlint pro Datei nicht leisten kann.
 *
 * Vorerst warn-only: alle Regeln haben severity "warn", damit bestehende
 * Befunde sichtbar sind, aber weder `npm run depcruise` noch die CI blockieren,
 * solange sie noch nicht in Folge-Issues aufgeraeumt sind.
 */

// Testdateien duerfen Schichtgrenzen und die Solver-Fassade bewusst umgehen:
// sie verdrahten mehrere Schichten und mocken einzelne Fachmodule direkt
// (ADR 0023, ADR 0006). Gespiegelt aus der oxlint-Ausnahme in .oxlintrc.json.
const TEST_FILE = '\\.test\\.(js|jsx)$';

// Schicht-Praefixe. Die Reihenfolge parser -> solver -> components bezeichnet
// die erlaubte Abhaengigkeitsrichtung: eine hoehere Schicht darf auf tiefere
// zugreifen, ein Rueckgriff von tief nach hoch ist verboten.
const PARSER_LAYER = '^src/parser/';
const SOLVER_LAYER = '^src/solver/';
const COMPONENTS_LAYER = '^src/components/';
const SOLVER_FACADE = '^src/solver/validator\\.js$';

module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      comment:
        'Import-Zyklen verkoppeln Module unaufloesbar und verhindern isoliertes ' +
        'Testen und Umbauen. Kein gerichteter Zyklus erlaubt.',
      severity: 'warn',
      from: {},
      to: { circular: true },
    },
    {
      name: 'schichtung-parser-kein-rueckgriff',
      comment:
        'parser ist die unterste Schicht (parser -> solver -> components) und ' +
        'darf nicht auf solver oder components zugreifen.',
      severity: 'warn',
      from: { path: PARSER_LAYER, pathNot: TEST_FILE },
      to: { path: `${SOLVER_LAYER}|${COMPONENTS_LAYER}` },
    },
    {
      name: 'schichtung-solver-kein-rueckgriff',
      comment:
        'solver ist die mittlere Schicht (parser -> solver -> components) und ' +
        'darf nicht auf components zugreifen.',
      severity: 'warn',
      from: { path: SOLVER_LAYER, pathNot: TEST_FILE },
      to: { path: COMPONENTS_LAYER },
    },
    {
      name: 'solver-nur-ueber-fassade',
      comment:
        'Der Solver wird von aussen ausschliesslich ueber die Fassade ' +
        'src/solver/validator.js angesprochen (ADR 0023). Ausgenommen sind ' +
        'solver-interne Module und Testdateien -- dieselben Ausnahmen wie die ' +
        'oxlint-Regel no-restricted-imports in .oxlintrc.json.',
      severity: 'warn',
      from: { pathNot: [SOLVER_LAYER, TEST_FILE] },
      to: { path: SOLVER_LAYER, pathNot: SOLVER_FACADE },
    },
    {
      name: 'no-orphans',
      comment:
        'Verwaiste Module (von nichts importiert und selbst nichts importierend) ' +
        'deuten auf toten Code. Ausgenommen sind Konfig-, Setup- und ' +
        'Einstiegsdateien sowie Tests und Standalone-Skripte, die naturgemaess ' +
        'keine Importeure haben.',
      severity: 'warn',
      from: {
        orphan: true,
        pathNot: [
          '(^|/)\\.[^/]+\\.(js|cjs|mjs|jsx)$', // Dotfiles (z. B. .dependency-cruiser.cjs)
          '\\.d\\.ts$',
          TEST_FILE, // Tests haben konstruktionsbedingt keine Importeure
          '\\.config\\.(js|cjs|mjs)$', // vite/vitest-Konfiguration
          '^src/main\\.jsx$', // App-Einstieg
          '^src/test-utils/', // Test-Setup-Helfer
          '(^|/)node_modules/',
        ],
      },
      to: {},
    },
  ],
  options: {
    // node_modules als Blaetter behalten (nicht hineinlaufen), damit Module,
    // die nur externe Pakete importieren, nicht faelschlich als Waisen gelten.
    doNotFollow: { path: '(^|/)node_modules/' },

    // Vollstaendig aus dem Graphen ausschliessen: Build-Ausgaben, VCS,
    // verschachtelte Arbeitskopien, Fixtures und generierte Dateien. Verhindert
    // Falschmeldungen aus .worktrees/, .claude/, Fixtures und src/parser/schema/.
    exclude: {
      path:
        '(^|/)(dist|coverage|\\.git|\\.worktrees|\\.claude)/' +
        '|(^|/)__fixtures__/' +
        '|^src/parser/schema/',
    },

    enhancedResolveOptions: {
      extensions: ['.js', '.jsx', '.json'],
    },

    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
