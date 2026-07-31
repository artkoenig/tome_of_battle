/**
 * dependency-cruiser-Konfiguration.
 *
 * Macht die Schichtung der App zu maschinell gepruefen Regeln und ergaenzt die
 * Zyklus- und Waisen-Erkennung, die oxlint pro Datei nicht leisten kann.
 *
 * Die Alt-Regeln (Schichtung parser -> components, Zyklen, Waisen) sind
 * warn-only, damit bestehende Befunde sichtbar sind, ohne `npm run depcruise`
 * zu blockieren, solange sie noch nicht aufgeraeumt sind. **Ausnahme:** die
 * Trennungsregeln um die Reinraum-Engine (ADR-0030) haben severity "error" —
 * die Engine traegt keinen Alt-Bestand, also kostet harte Durchsetzung nichts
 * und ein Verstoss laesst `npm run depcruise` lokal mit Exitcode != 0
 * fehlschlagen. Die CI bleibt durch `continue-on-error` unberuehrt.
 *
 * Seit Issue 0121 gibt es kein src/solver/ mehr: die Alt-Engine ist abgerissen,
 * ihr Schreibmodell lebt als src/roster/ weiter (ADR-0023 damit erledigt).
 */

// Testdateien duerfen Schichtgrenzen und Fassaden bewusst umgehen:
// sie verdrahten mehrere Schichten und mocken einzelne Fachmodule direkt
// (ADR 0023, ADR 0006). Gespiegelt aus der oxlint-Ausnahme in .oxlintrc.json.
const TEST_FILE = '\\.test\\.(js|jsx)$';

// Schicht-Praefixe. Die Reihenfolge parser -> components bezeichnet die
// erlaubte Abhaengigkeitsrichtung: eine hoehere Schicht darf auf tiefere
// zugreifen, ein Rueckgriff von tief nach hoch ist verboten.
const PARSER_LAYER = '^src/parser/';
const COMPONENTS_LAYER = '^src/components/';

// Die Reinraum-Auswertungs-Engine (ADR-0030), von aussen nur ueber ihre eigene
// Fassade erreichbar und vom App-Schreibmodell in beide Richtungen getrennt.
// Anders als der warn-only Alt-Bestand sind diese Regeln blockierend ("error"):
// die Engine traegt keinen Ballast, darum kann die Trennung sofort maschinell
// greifen statt nur zu warnen.
const EVALUATOR_LAYER = '^src/evaluator/';
const EVALUATOR_FACADE = '^src/evaluator/evaluator\\.js$';

// Die Fixture-Kataloge und ihre Lesehilfen sind **Testmaterial**, kein Teil der
// Engine: sie werten nichts aus und tragen keine Regel. Wer sie liest, umgeht
// die Fassade nicht — genau wie die TEST_FILE-Ausnahme auf der from-Seite.
const EVALUATOR_FIXTURES = '^src/evaluator/__fixtures__/';

// Das Schreibmodell des App-Rosters (Issue 0121, Task 8): App-Schicht wie
// src/utils/. Der Evaluator bleibt in beide Richtungen davon isoliert
// (Reinraum, ADR-0030/0034), und die Auswertungs-Bruecke src/evaluation/
// braucht es nicht -- sie uebersetzt nur die Eingaberichtung.
const ROSTER_LAYER = '^src/roster/';
const EVALUATION_LAYER = '^src/evaluation/';

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
        'parser ist die unterste Schicht (parser -> components) und darf nicht ' +
        'auf components zugreifen.',
      severity: 'warn',
      from: { path: PARSER_LAYER, pathNot: TEST_FILE },
      to: { path: COMPONENTS_LAYER },
    },
    {
      name: 'evaluator-keine-roster-abhaengigkeit',
      comment:
        'Reinraum-Schutz (ADR-0030/0034): src/evaluator/ darf das App-Schreibmodell ' +
        'src/roster/ nie importieren -- es traegt Ableitungslogik der Alt-Engine.',
      severity: 'error',
      from: { path: EVALUATOR_LAYER, pathNot: TEST_FILE },
      to: { path: ROSTER_LAYER },
    },
    {
      name: 'roster-keine-evaluator-abhaengigkeit',
      comment:
        'Das Schreibmodell src/roster/ bleibt rein strukturell (Issue 0121, Task 8): ' +
        'es importiert den Evaluator nie -- auch nicht ueber dessen Fassade.',
      severity: 'error',
      from: { path: ROSTER_LAYER, pathNot: TEST_FILE },
      to: { path: EVALUATOR_LAYER },
    },
    {
      name: 'evaluation-keine-roster-abhaengigkeit',
      comment:
        'Die Auswertungs-Bruecke src/evaluation/ uebersetzt nur App-Roster -> ' +
        'Evaluator-Vertrag und reicht den Bericht durch; das Schreibmodell ' +
        'src/roster/ braucht sie nicht (Issue 0121, Task 8).',
      severity: 'error',
      from: { path: EVALUATION_LAYER, pathNot: TEST_FILE },
      to: { path: ROSTER_LAYER },
    },
    {
      name: 'evaluator-nur-ueber-fassade',
      comment:
        'Der Evaluator wird von aussen ausschliesslich ueber die Fassade ' +
        'src/evaluator/evaluator.js angesprochen (ADR-0030, gespiegelt aus der ' +
        'Solver-Fassade ADR-0023). Ausgenommen sind evaluator-interne Module und ' +
        'Testdateien -- dieselben Ausnahmen wie die oxlint-Regel ' +
        'no-restricted-imports -- sowie die Fixtures als Testmaterial. Fuer das ' +
        'Messwerkzeug gab es bis Issue 0138 eine benannte Ausnahme: es baute die ' +
        'Pipeline nach, um ihre Stufen getrennt zu stoppen. Seit die Engine sich ' +
        'selbst misst und das Ergebnis als Metadata ueber die Fassade ausliefert, ' +
        'ist der Grund entfallen und die Ausnahme ersatzlos gestrichen.',
      severity: 'error',
      from: { pathNot: [EVALUATOR_LAYER, TEST_FILE] },
      to: { path: EVALUATOR_LAYER, pathNot: [EVALUATOR_FACADE, EVALUATOR_FIXTURES] },
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
