/**
 * dependency-cruiser-Konfiguration.
 *
 * Macht die in ADR 0023 fixierte Solver-Fassade und die Schichtung
 * parser -> solver -> components zu maschinell gepruefen Regeln und ergaenzt
 * die Zyklus- und Waisen-Erkennung, die oxlint pro Datei nicht leisten kann.
 *
 * Die Alt-Regeln (Schichtung parser->solver->components, Solver-Fassade, Zyklen,
 * Waisen) sind vorerst warn-only, damit bestehende Befunde sichtbar sind, ohne
 * `npm run depcruise` zu blockieren, solange sie noch nicht aufgeraeumt sind.
 * **Ausnahme:** die drei Engine-Trennungsregeln aus ADR 0030
 * (`evaluator-keine-solver-abhaengigkeit`, `solver-keine-evaluator-abhaengigkeit`,
 * `evaluator-nur-ueber-fassade`) haben severity "error" — die neue Engine hat
 * null Verstoesse, also kostet harte Durchsetzung nichts und ein Verstoss laesst
 * `npm run depcruise` lokal mit Exitcode != 0 fehlschlagen. Die CI bleibt durch
 * `continue-on-error` unberuehrt.
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

// Die zweite, raeumlich getrennte Auswertungs-Engine (ADR-0030). Sie ist hart
// von src/solver/ getrennt (in beide Richtungen) und von aussen nur ueber ihre
// eigene Fassade erreichbar. Anders als der warn-only Alt-Bestand sind diese
// Regeln blockierend ("error"): die Engine ist neu und traegt keinen Ballast,
// darum kann die Trennung sofort maschinell greifen statt nur zu warnen.
const EVALUATOR_LAYER = '^src/evaluator/';
const EVALUATOR_FACADE = '^src/evaluator/evaluator\\.js$';

// Die **einzige** deklarierte Ausnahme von der Fassaden-Regel: das Messwerkzeug.
// Es ist ausdruecklich kein Produktivcode (kein src/-Modul importiert scripts/),
// und seine Aufgabe ist gerade, die einzelnen Stufen der Auswertung getrennt zu
// stoppen — das geht nur von innen. Die Ausnahme steht hier benannt, statt sich
// aus einem zu engen Pruefumfang zu ergeben: `npm run depcruise` cruist src UND
// scripts, damit jeder andere Zugriff aus scripts/ auffaellt.
const EVALUATOR_MEASUREMENT = '^scripts/(lib/evaluator-measurement|measure-evaluator)';

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
      name: 'evaluator-keine-solver-abhaengigkeit',
      comment:
        'Harte Trennung der beiden Engines (ADR-0030): src/evaluator/ darf nie ' +
        'aus src/solver/ importieren -- auch nicht aus dessen Fassade. Blockierend, ' +
        'weil die Engine neu ist und keinen Alt-Bestand traegt.',
      severity: 'error',
      from: { path: EVALUATOR_LAYER, pathNot: TEST_FILE },
      to: { path: SOLVER_LAYER },
    },
    {
      name: 'solver-keine-evaluator-abhaengigkeit',
      comment:
        'Harte Trennung der beiden Engines (ADR-0030): src/solver/ darf nie aus ' +
        'src/evaluator/ importieren -- auch nicht aus dessen Fassade. Blockierend, ' +
        'weil die Engine neu ist und keinen Alt-Bestand traegt.',
      severity: 'error',
      from: { path: SOLVER_LAYER, pathNot: TEST_FILE },
      to: { path: EVALUATOR_LAYER },
    },
    {
      name: 'evaluator-nur-ueber-fassade',
      comment:
        'Der Evaluator wird von aussen ausschliesslich ueber die Fassade ' +
        'src/evaluator/evaluator.js angesprochen (ADR-0030, gespiegelt aus der ' +
        'Solver-Fassade ADR-0023). Ausgenommen sind evaluator-interne Module, ' +
        'Testdateien -- dieselben Ausnahmen wie die oxlint-Regel ' +
        'no-restricted-imports -- und das Messwerkzeug, das die Stufen der ' +
        'Auswertung getrennt stoppt und dafuer von innen greifen muss.',
      severity: 'error',
      from: { pathNot: [EVALUATOR_LAYER, TEST_FILE, EVALUATOR_MEASUREMENT] },
      to: { path: EVALUATOR_LAYER, pathNot: EVALUATOR_FACADE },
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
