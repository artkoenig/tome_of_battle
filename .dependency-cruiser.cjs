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
 * ihr Schreibmodell lebt als src/domain/roster/ weiter (ADR-0023 damit erledigt).
 */

// Testdateien duerfen Schichtgrenzen und Fassaden bewusst umgehen:
// sie verdrahten mehrere Schichten und mocken einzelne Fachmodule direkt
// (ADR 0023, ADR 0006). Gespiegelt aus der oxlint-Ausnahme in .oxlintrc.json.
const TEST_FILE = '\\.test\\.(js|jsx)$';

// Schicht-Praefixe. Die Reihenfolge parser -> components bezeichnet die
// erlaubte Abhaengigkeitsrichtung: eine hoehere Schicht darf auf tiefere
// zugreifen, ein Rueckgriff von tief nach hoch ist verboten.
const PARSER_LAYER = '^src/data/parser/';
const COMPONENTS_LAYER = '^src/ui/components/';

// Die Reinraum-Auswertungs-Engine (ADR-0030), von aussen nur ueber ihre eigene
// Fassade erreichbar und vom App-Schreibmodell in beide Richtungen getrennt.
// Anders als der warn-only Alt-Bestand sind diese Regeln blockierend ("error"):
// die Engine traegt keinen Ballast, darum kann die Trennung sofort maschinell
// greifen statt nur zu warnen.
const EVALUATOR_LAYER = '^src/domain/evaluator/';
const EVALUATOR_FACADE = '^src/domain/evaluator/evaluator\\.js$';

// Das Schreibmodell des App-Rosters (Issue 0121, Task 8). Der Evaluator bleibt
// in beide Richtungen davon isoliert
// (Reinraum, ADR-0030/0034), und die Auswertungs-Bruecke src/domain/evaluation/
// braucht es nicht -- sie uebersetzt nur die Eingaberichtung.
const ROSTER_LAYER = '^src/domain/roster/';
const EVALUATION_LAYER = '^src/domain/evaluation/';

// Die drei Schichten aus ADR-0037: UI -> Fachlogik -> Daten. Der Pfeil ist die
// erlaubte Richtung; jeder Rueckgriff von tief nach hoch ist verboten. Die
// Regeln entstehen als "warn" und werden auf "error" gezogen, sobald die Phase
// gemergt ist, die ihre Verstoesse abbaut (Issues 0161-0171). Seit Issue 0169
// blockieren "fachlogik-kein-rueckgriff" und "keine-i18n-unter-ui": unterhalb
// der Oberflaeche wird nicht mehr uebersetzt und nicht zurueckgegriffen.

// Darstellung und Interaktion. Seit Issue 0178 traegt die Oberflaeche nur noch
// die Verzeichnisse aus der ADR-Tabelle: die Ableitungs- und Zustandshaken
// liegen samt useAppData und useRosterList unter src/ui/viewmodels/.
const VIEWMODEL_LAYER = '^src/ui/viewmodels/';

// Seit Issue 0171 heisst das Verzeichnis wie die Schicht: alles unter src/ui/
// ist Oberflaeche, einschliesslich src/ui/App.jsx. src/ui/i18n/ ist
// ausgenommen, weil es als eigener Praefix eine eigene Regel traegt (siehe
// I18N_LAYER) -- ohne die Ausnahme meldete jeder Griff danach zwei Regeln.
const UI_LAYER = ['^src/ui/(?!i18n/)'];

// Uebersetzte Texte. Teil der UI-Schicht, aber eigener Praefix: nur so laesst
// sich der Griff einer tieferen Schicht danach als eigene Regel melden.
const I18N_LAYER = '^src/ui/i18n/';

// Auswertung, Schreibmodell und die Bruecke zwischen beiden. Die
// Reinraum-Regeln oben gelten unveraendert innerhalb dieser Schicht.
const DOMAIN_LAYER = [EVALUATOR_LAYER, EVALUATION_LAYER, ROSTER_LAYER];

// Persistenz, Import und Katalog-Zerlegung. src/domain/services/ ist die einzige
// Adresse, ueber die die UI Daten erreichen darf, und deshalb aus
// "ui-nicht-auf-daten" ausgenommen.
const DB_LAYER = '^src/data/db/';
const SERVICES_LAYER = '^src/domain/services/';
// Seit Issue 0171 ist die ganze Schicht ein Verzeichnis; src/data/rules/ (der
// Regeltext-Index samt Namensabgleich) gehoert dazu.
const DATA_LAYER = ['^src/data/'];

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
        'src/ui/viewmodels/editor/ gelesen, nie von einer Komponente. Eine ' +
        'Komponente, die sie selbst aufruft, rechnet wieder im Render und ist ' +
        'nur noch ueber das DOM pruefbar.',
      severity: 'error',
      from: { path: COMPONENTS_LAYER, pathNot: TEST_FILE },
      to: {
        path: [
          '^src/domain/evaluation/listRuleGroups\\.js$',
          '^src/domain/evaluation/armyWideSelectorSlots\\.js$',
          '^src/domain/evaluation/violationStats\\.js$',
        ],
      },
    },
    {
      name: 'viewmodel-keine-komponente',
      comment:
        'ADR-0038: src/ui/viewmodels/ liegt in der UI-Schicht ueber ' +
        'src/ui/components/. Ein ViewModel gibt Anzeigewerte heraus und kennt ' +
        'kein Markup -- importiert es eine Komponente, ist die Richtung ' +
        'gedreht und das Modell nur noch ueber das DOM pruefbar. Geprueft wird ' +
        'die Importkante, nicht die Dateiendung: ein ViewModel darf .jsx ' +
        'heissen, solange es keine Komponente importiert.',
      severity: 'error',
      from: { path: VIEWMODEL_LAYER, pathNot: TEST_FILE },
      to: { path: COMPONENTS_LAYER },
    },
    {
      name: 'komponente-kein-bericht',
      comment:
        'ADR-0038: eine Komponente ist JSX. Den Auswertungsbericht liest ihr ' +
        'ViewModel unter src/ui/viewmodels/ und reicht fertige Anzeigewerte als ' +
        'Props herein. Wer src/domain/evaluation/ oder src/domain/evaluator/ in der ' +
        'Komponente anfasst, rechnet wieder im Render.',
      severity: 'error',
      from: { path: COMPONENTS_LAYER, pathNot: TEST_FILE },
      to: { path: [EVALUATION_LAYER, EVALUATOR_LAYER] },
    },
    {
      name: 'viewmodel-keine-datenschicht',
      comment:
        'ADR-0037/0038: ein ViewModel erreicht Daten ueber src/domain/services/, nie ' +
        'direkt ueber src/data/db/ oder src/data/parser/. Seit Issue 0167 ohne ' +
        'Ausnahme: die Direktkanten der drei Huellen-ViewModels laufen ueber ' +
        'die Fassade.',
      severity: 'error',
      from: { path: VIEWMODEL_LAYER, pathNot: TEST_FILE },
      to: { path: [DB_LAYER, PARSER_LAYER] },
    },
    {
      name: 'ui-nicht-auf-daten',
      comment:
        'ADR-0037: die Oberflaeche erreicht Daten ausschliesslich ueber ' +
        'src/domain/services/. Ein direkter Griff nach src/data/db/ oder src/data/parser/ laesst ' +
        'sich weder austauschen noch instrumentieren. Bestand beim Aufstellen ' +
        'der Regel: 14 Kanten (ADR-0037, Befund 1). Issue 0167 hat sie auf ' +
        'src/domain/services/ umgelenkt; die Regel steht seitdem auf error und ' +
        'friert den Zustand ein.',
      severity: 'error',
      from: { path: [...UI_LAYER, I18N_LAYER], pathNot: TEST_FILE },
      to: { path: [DB_LAYER, PARSER_LAYER] },
    },
    {
      name: 'daten-kein-rueckgriff',
      comment:
        'ADR-0037: die Datenschicht ist die unterste. Sie kennt weder die ' +
        'Oberflaeche noch die Fachlogik -- ein Rueckgriff dorthin dreht die ' +
        'erlaubte Richtung um.',
      severity: 'error',
      from: { path: DATA_LAYER, pathNot: TEST_FILE },
      to: { path: [...UI_LAYER, I18N_LAYER, ...DOMAIN_LAYER] },
    },
    {
      name: 'fachlogik-kein-rueckgriff',
      comment:
        'ADR-0037: die Fachlogik traegt keine Darstellung. Sie darf die ' +
        'Datenschicht nutzen, aber nie zurueck in die Oberflaeche greifen.',
      severity: 'error',
      from: { path: DOMAIN_LAYER, pathNot: TEST_FILE },
      to: { path: UI_LAYER },
    },
    {
      name: 'keine-i18n-unter-ui',
      comment:
        'ADR-0037: uebersetzte Texte entstehen in der Oberflaeche. Wer in ' +
        'Fachlogik oder Datenschicht src/ui/i18n/ importiert, formuliert dort eine ' +
        'Anzeige und bindet die Schicht an eine Sprache.',
      severity: 'error',
      from: { path: [...DOMAIN_LAYER, ...DATA_LAYER], pathNot: TEST_FILE },
      to: { path: I18N_LAYER },
    },
    {
      name: 'evaluator-keine-roster-abhaengigkeit',
      comment:
        'Reinraum-Schutz (ADR-0030/0034): src/domain/evaluator/ darf das App-Schreibmodell ' +
        'src/domain/roster/ nie importieren -- es traegt Ableitungslogik der Alt-Engine.',
      severity: 'error',
      from: { path: EVALUATOR_LAYER, pathNot: TEST_FILE },
      to: { path: ROSTER_LAYER },
    },
    {
      name: 'roster-keine-evaluator-abhaengigkeit',
      comment:
        'Das Schreibmodell src/domain/roster/ bleibt rein strukturell (Issue 0121, Task 8): ' +
        'es importiert den Evaluator nie -- auch nicht ueber dessen Fassade.',
      severity: 'error',
      from: { path: ROSTER_LAYER, pathNot: TEST_FILE },
      to: { path: EVALUATOR_LAYER },
    },
    {
      name: 'roster-keine-evaluation-abhaengigkeit',
      comment:
        'Das Schreibmodell src/domain/roster/ erreicht den Evaluator auch nicht mittelbar ' +
        'ueber die Auswertungs-Bruecke src/domain/evaluation/ (Issue 0174, ADR-0039): ' +
        'wer den Bericht braucht -- der .ros-Export --, bekommt ihn hereingereicht. ' +
        'Testdateien sind ausgenommen wie bei roster-keine-evaluator-abhaengigkeit: ' +
        'ein Fall, der eine Kostensumme braucht, ruft evaluateAppRoster selbst.',
      severity: 'error',
      from: { path: ROSTER_LAYER, pathNot: TEST_FILE },
      to: { path: EVALUATION_LAYER },
    },
    {
      name: 'evaluation-keine-roster-abhaengigkeit',
      comment:
        'Die Auswertungs-Bruecke src/domain/evaluation/ uebersetzt nur App-Roster -> ' +
        'Evaluator-Vertrag und reicht den Bericht durch; das Schreibmodell ' +
        'src/domain/roster/ braucht sie nicht (Issue 0121, Task 8).',
      severity: 'error',
      from: { path: EVALUATION_LAYER, pathNot: TEST_FILE },
      to: { path: ROSTER_LAYER },
    },
    {
      name: 'evaluator-nur-ueber-fassade',
      comment:
        'Der Evaluator wird von aussen ausschliesslich ueber die Fassade ' +
        'src/domain/evaluator/evaluator.js angesprochen (ADR-0030, gespiegelt aus der ' +
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
          '^src/tests/test-utils/', // Test-Setup-Helfer
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
    // Falschmeldungen aus .worktrees/, .claude/, Fixtures und src/data/parser/schema/.
    exclude: {
      path:
        '(^|/)(dist|coverage|\\.git|\\.worktrees|\\.claude)/' +
        '|(^|/)__fixtures__/' +
        '|^src/data/parser/schema/',
    },

    enhancedResolveOptions: {
      extensions: ['.js', '.jsx', '.json'],
    },

    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
