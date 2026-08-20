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

// Das Schreibmodell des App-Rosters (Issue 0121, Task 8): App-Schicht wie
// src/utils/. Der Evaluator bleibt in beide Richtungen davon isoliert
// (Reinraum, ADR-0030/0034), und die Auswertungs-Bruecke src/evaluation/
// braucht es nicht -- sie uebersetzt nur die Eingaberichtung.
const ROSTER_LAYER = '^src/roster/';
const EVALUATION_LAYER = '^src/evaluation/';

// Die drei Schichten aus ADR-0037: UI -> Fachlogik -> Daten. Der Pfeil ist die
// erlaubte Richtung; jeder Rueckgriff von tief nach hoch ist verboten. Die
// Regeln entstehen als "warn" und werden auf "error" gezogen, sobald die Phase
// gemergt ist, die ihre Verstoesse abbaut (Issues 0161-0171).

// Darstellung und Interaktion. src/hooks/ steht in der ADR-Tabelle nicht
// eigens, gehoert aber zur UI: die dort gemessenen Direktkanten nach src/db/
// laufen ueber useAppData und useRosterList.
const VIEWMODEL_LAYER = '^src/viewmodels/';

// Die drei ViewModels der Huellen, die heute noch selbst nach src/db/ und
// src/parser/ greifen (Bestand aus Issue 0165). Sie sind die benannte und
// abschliessende Ausnahme von "viewmodel-keine-datenschicht": jedes weitere
// ViewModel, das die Datenschicht direkt anspricht, laesst forge-lint
// fehlschlagen. Issue 0167 lenkt diese drei auf src/services/ um und streicht
// die Ausnahme dann ersatzlos.
const VIEWMODEL_DATA_LEGACY = [
  '^src/viewmodels/useRosterEditor\\.js$',
  '^src/viewmodels/usePlayRoster\\.js$',
  '^src/viewmodels/useImporter\\.js$',
];

const UI_LAYER = [
  COMPONENTS_LAYER,
  VIEWMODEL_LAYER,
  '^src/contexts/',
  '^src/hooks/',
  '^src/styles/',
];

// Uebersetzte Texte. Teil der UI-Schicht, aber eigener Praefix: nur so laesst
// sich der Griff einer tieferen Schicht danach als eigene Regel melden.
const I18N_LAYER = '^src/i18n/';

// Auswertung, Schreibmodell und die Bruecke zwischen beiden. Die
// Reinraum-Regeln oben gelten unveraendert innerhalb dieser Schicht.
const DOMAIN_LAYER = [EVALUATOR_LAYER, EVALUATION_LAYER, ROSTER_LAYER];

// Persistenz, Import und Katalog-Zerlegung. src/services/ ist die einzige
// Adresse, ueber die die UI Daten erreichen darf, und deshalb aus
// "ui-nicht-auf-daten" ausgenommen.
const DB_LAYER = '^src/db/';
const SERVICES_LAYER = '^src/services/';
const DATA_LAYER = [SERVICES_LAYER, DB_LAYER, PARSER_LAYER];

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
      name: 'ableitungen-nur-in-viewmodels',
      comment:
        'ADR-0038 (Issue 0164): die Anzeige-Ableitungen aus dem Bericht -- die ' +
        'Listenregel-Ankreuzliste, die armeeweiten Selektoren und die ' +
        'Verletzungs-Statistik -- werden von den ViewModels in ' +
        'src/viewmodels/editor/ gelesen, nie von einer Komponente. Eine ' +
        'Komponente, die sie selbst aufruft, rechnet wieder im Render und ist ' +
        'nur noch ueber das DOM pruefbar.',
      severity: 'error',
      from: { path: COMPONENTS_LAYER, pathNot: TEST_FILE },
      to: {
        path: [
          '^src/evaluation/listRuleGroups\\.js$',
          '^src/evaluation/armyWideSelectorSlots\\.js$',
          '^src/evaluation/violationStats\\.js$',
        ],
      },
    },
    {
      name: 'viewmodel-kein-jsx',
      comment:
        'ADR-0038: src/viewmodels/ liegt in der UI-Schicht ueber ' +
        'src/components/. Ein ViewModel gibt Anzeigewerte heraus und kennt ' +
        'kein Markup -- importiert es eine Komponente, ist die Richtung ' +
        'gedreht und das Modell nur noch ueber das DOM pruefbar.',
      severity: 'error',
      from: { path: VIEWMODEL_LAYER, pathNot: TEST_FILE },
      to: { path: COMPONENTS_LAYER },
    },
    {
      name: 'komponente-kein-bericht',
      comment:
        'ADR-0038: eine Komponente ist JSX. Den Auswertungsbericht liest ihr ' +
        'ViewModel unter src/viewmodels/ und reicht fertige Anzeigewerte als ' +
        'Props herein. Wer src/evaluation/ oder src/evaluator/ in der ' +
        'Komponente anfasst, rechnet wieder im Render.',
      severity: 'error',
      from: { path: COMPONENTS_LAYER, pathNot: TEST_FILE },
      to: { path: [EVALUATION_LAYER, EVALUATOR_LAYER] },
    },
    {
      name: 'viewmodel-keine-datenschicht',
      comment:
        'ADR-0037/0038: ein ViewModel erreicht Daten ueber src/services/, nie ' +
        'direkt ueber src/db/ oder src/parser/. Ausgenommen sind die drei ' +
        'Huellen-ViewModels aus Issue 0165, deren Direktkanten Issue 0167 auf ' +
        'die Fassade umlenkt.',
      severity: 'error',
      from: { path: VIEWMODEL_LAYER, pathNot: [TEST_FILE, ...VIEWMODEL_DATA_LEGACY] },
      to: { path: [DB_LAYER, PARSER_LAYER] },
    },
    {
      name: 'ui-nicht-auf-daten',
      comment:
        'ADR-0037: die Oberflaeche erreicht Daten ausschliesslich ueber ' +
        'src/services/. Ein direkter Griff nach src/db/ oder src/parser/ laesst ' +
        'sich weder austauschen noch instrumentieren. Bestand beim Aufstellen ' +
        'der Regel: 14 Kanten (ADR-0037, Befund 1). Jede Zahl darueber ist neu ' +
        'und gehoert nicht dazu.',
      severity: 'warn',
      from: { path: [...UI_LAYER, I18N_LAYER], pathNot: TEST_FILE },
      to: { path: [DB_LAYER, PARSER_LAYER] },
    },
    {
      name: 'daten-kein-rueckgriff',
      comment:
        'ADR-0037: die Datenschicht ist die unterste. Sie kennt weder die ' +
        'Oberflaeche noch die Fachlogik -- ein Rueckgriff dorthin dreht die ' +
        'erlaubte Richtung um.',
      severity: 'warn',
      from: { path: DATA_LAYER, pathNot: TEST_FILE },
      to: { path: [...UI_LAYER, I18N_LAYER, ...DOMAIN_LAYER] },
    },
    {
      name: 'fachlogik-kein-rueckgriff',
      comment:
        'ADR-0037: die Fachlogik traegt keine Darstellung. Sie darf die ' +
        'Datenschicht nutzen, aber nie zurueck in die Oberflaeche greifen.',
      severity: 'warn',
      from: { path: DOMAIN_LAYER, pathNot: TEST_FILE },
      to: { path: UI_LAYER },
    },
    {
      name: 'keine-i18n-unter-ui',
      comment:
        'ADR-0037: uebersetzte Texte entstehen in der Oberflaeche. Wer in ' +
        'Fachlogik oder Datenschicht src/i18n/ importiert, formuliert dort eine ' +
        'Anzeige und bindet die Schicht an eine Sprache.',
      severity: 'warn',
      from: { path: [...DOMAIN_LAYER, ...DATA_LAYER], pathNot: TEST_FILE },
      to: { path: I18N_LAYER },
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
        'no-restricted-imports. Fuer das Messwerkzeug gab es bis Issue 0138 eine ' +
        'benannte Ausnahme: es baute die Pipeline nach, um ihre Stufen getrennt ' +
        'zu stoppen. Seit die Engine sich selbst misst und das Ergebnis als ' +
        'Metadata ueber die Fassade ausliefert, ist der Grund entfallen und die ' +
        'Ausnahme ersatzlos gestrichen.',
      severity: 'error',
      from: { pathNot: [EVALUATOR_LAYER, TEST_FILE] },
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
