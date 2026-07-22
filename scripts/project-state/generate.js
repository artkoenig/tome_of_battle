/**
 * Orchestrator des Projektzustandsberichts -- die I/O-Seite des Vorhabens.
 *
 * Die reine Auswertungs- und Aufbereitungslogik liegt in den Modulen daneben
 * ({@link module:project-state/buildReportModel}, `gates.js`, `coverage.js`,
 * `functions.js`, `graph.js`, `issues.js`, `renderReport.js`). Dieses Skript
 * beschafft die Rohdaten an den Raendern -- es fuehrt die Qualitaets-Gates aus,
 * liest `coverage-final.json`, parst den CI-Workflow, liest den Produktivcode und
 * den Import-Graphen, befragt den Git-Tracker ueber die erreichbaren Refs -- und
 * reicht sie als reine Daten an {@link buildReportModel}. Aus dem Modell erzeugt
 * {@link renderReport} die HTML-Seite, die dieses Skript schreibt.
 *
 * Es folgt damit demselben Muster wie `scripts/release.js`: die reine Logik ist
 * ausgelagert und getestet, hier liegen nur die duennen Raender und ein
 * CLI-Guard am Ende.
 *
 * **Ein abbrechendes oder findendes Gate laesst diesen Lauf nicht scheitern.**
 * Gate-Ergebnisse sind erhobene Daten, kein Steuerfluss: ein Werkzeug, das gar
 * nicht anlaeuft, erscheint im Bericht als "nicht angelaufen", statt den Job rot
 * zu machen. Nur ein echter Fehler des Orchestrators selbst beendet ihn mit
 * Fehlercode.
 *
 * @module project-state/generate
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';

import { parse as parseYaml } from 'yaml';

import { GATE_DEFINITIONS } from './gates.js';
import { buildReportModel } from './buildReportModel.js';
import { renderReport } from './renderReport.js';

const DEFAULT_OUTPUT_PATH = '.report/index.html';
const SOURCE_ROOT = 'src';
const COVERAGE_FILE = join('coverage', 'coverage-final.json');
const CI_WORKFLOW_FILE = join('.github', 'workflows', 'ci.yml');
const CI_JOB_NAME = 'lint-and-test';
const DEFAULT_BRANCH_NAME = 'main';

const SOURCE_EXTENSIONS = Object.freeze(['.js', '.jsx', '.ts', '.tsx']);
const TEST_FILE_PATTERN = /\.test\.[jt]sx?$/;

const GATE_OUTPUT_MAX_BUFFER_BYTES = 64 * 1024 * 1024;
const GATE_TIMEOUT_MS = 15 * 60 * 1000;
const FAILED_EXIT_CODE = 1;

/**
 * Was der Generator je Gate tatsaechlich ausfuehrt, wo das vom angezeigten
 * Kommando abweicht. Das angezeigte `command` aus {@link GATE_DEFINITIONS} bleibt
 * unveraendert -- es ist der Schluessel, ueber den die Wirksamkeit im CI-Workflow
 * nachgeschlagen wird. Die Abweichungen erzeugen nebenbei die Artefakte, die der
 * Bericht braucht: dependency-cruiser als JSON fuer den Graphen, vitest mit
 * Abdeckung fuer `coverage-final.json`.
 */
const GATE_EXECUTION_OVERRIDES = Object.freeze({
  depcruise: 'npx depcruise src --output-type json',
  'unit-tests': 'npx vitest run --coverage --coverage.provider=v8 --coverage.reporter=json',
});

/** Aus welcher Gate-Ausgabe der Importgraph gelesen wird. */
const GRAPH_SOURCE_GATE_ID = 'depcruise';

/**
 * @typedef {object} CommandResult
 * @property {number} exitCode
 * @property {string} output  stdout und stderr zusammen -- fuer die Klassifikation.
 * @property {string} stdout  nur stdout -- fuer maschinenlesbare Ausgaben (JSON).
 */

/**
 * Fuehrt ein Kommando ueber die Shell aus und sammelt sein Rohergebnis ein. Ein
 * Fehlschlag ist hier ein normales Ergebnis, keine Ausnahme: Exit-Code und
 * Ausgabe werden zurueckgegeben, nie geworfen.
 *
 * @param {string} command
 * @returns {CommandResult}
 */
function runCommand(command) {
  const result = spawnSync(command, {
    shell: true,
    encoding: 'utf8',
    maxBuffer: GATE_OUTPUT_MAX_BUFFER_BYTES,
    timeout: GATE_TIMEOUT_MS,
  });
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  const spawnError = result.error ? `${result.error.message}\n` : '';
  return {
    exitCode: result.status ?? FAILED_EXIT_CODE,
    output: `${stdout}${stderr}${spawnError}`.trim(),
    stdout,
  };
}

/**
 * Fuehrt alle Gates aus und liefert je Gate sein Rohergebnis. Das JSON der
 * dependency-cruiser-Ausgabe wird gesondert zurueckgegeben, damit der Graph nicht
 * einen zweiten Lauf desselben Werkzeugs braucht.
 *
 * @returns {{ gateRuns: Record<string, import('./gates.js').GateRun>, graphStdout: string }}
 */
function executeGates() {
  /** @type {Record<string, import('./gates.js').GateRun>} */
  const gateRuns = {};
  let graphStdout = '';

  for (const gate of GATE_DEFINITIONS) {
    const command = GATE_EXECUTION_OVERRIDES[gate.id] ?? gate.command;
    process.stderr.write(`  Gate ${gate.id}: ${command}\n`);
    const result = runCommand(command);
    gateRuns[gate.id] = { exitCode: result.exitCode, output: result.output };
    if (gate.id === GRAPH_SOURCE_GATE_ID) graphStdout = result.stdout;
  }

  return { gateRuns, graphStdout };
}

/** Liest eine JSON-Datei; bei fehlender oder ungueltiger Datei den Ersatzwert. */
function readJsonFile(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

/** Modulbericht von dependency-cruiser aus dessen JSON-Ausgabe; bei Abbruch leer. */
function parseCruiserModules(graphStdout) {
  try {
    return JSON.parse(graphStdout).modules ?? [];
  } catch {
    return [];
  }
}

/**
 * Der CI-Job, der die Gates ausfuehrt -- Grundlage der Wirksamkeits-Angabe. Fehlt
 * die Datei oder laesst sie sich nicht parsen, ist die Wirksamkeit eben unbekannt.
 *
 * @returns {object|null}
 */
function readWorkflowJob() {
  try {
    const workflow = parseYaml(readFileSync(CI_WORKFLOW_FILE, 'utf8'));
    return workflow?.jobs?.[CI_JOB_NAME] ?? null;
  } catch {
    return null;
  }
}

/**
 * Liest den Produktivcode unter `src/` ein (ohne Testdateien) fuer die
 * Funktionslaengen. Pfade sind relativ zur Projektwurzel und in Vorwaerts-Schraegen.
 *
 * @param {string} rootDir  Projektwurzel.
 * @returns {import('./buildReportModel.js').SourceFile[]}
 */
function readSourceFiles(rootDir) {
  const sourceDir = join(rootDir, SOURCE_ROOT);
  return walkFiles(sourceDir)
    .filter((absolutePath) => isSourceFile(absolutePath))
    .map((absolutePath) => ({
      path: toPosix(relative(rootDir, absolutePath)),
      source: readFileSync(absolutePath, 'utf8'),
    }));
}

/** Alle Dateien unterhalb eines Verzeichnisses, rekursiv. */
function walkFiles(dir) {
  /** @type {string[]} */
  const files = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(fullPath));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

function isSourceFile(path) {
  return SOURCE_EXTENSIONS.some((extension) => path.endsWith(extension)) && !TEST_FILE_PATTERN.test(path);
}

function toPosix(path) {
  return path.split(sep).join('/');
}

// --- Git-Zugriff fuer den Issue-Teil ------------------------------------------

const ISSUE_TRACKER_PREFIX = 'docs/issues/';
const ISSUE_FILE_SUFFIX = 'issue.md';
const REMOTE_PREFIX = 'origin/';

/** Ruft `git` auf und liefert dessen Ergebnis; nie werfend. */
function runGit(args) {
  return spawnSync('git', args, { encoding: 'utf8', maxBuffer: GATE_OUTPUT_MAX_BUFFER_BYTES });
}

/** Nicht-leere Ausgabezeilen eines erfolgreichen `git`-Aufrufs. */
function gitLines(args) {
  const result = runGit(args);
  if (result.status !== 0 || !result.stdout) return [];
  return result.stdout.split('\n').filter((line) => line.trim() !== '');
}

/**
 * Beschafft die Refs, die der Issue-Teil auswertet. Nur gepushte Branches gelten:
 * sind `origin/*`-Refs vorhanden (der Regelfall in CI nach vollem Fetch), werden
 * diese genommen; nur wenn keine vorhanden sind (rein lokale Arbeitskopie), dienen
 * die lokalen Branches als Rueckfall, damit ein lokaler Lauf ueberhaupt etwas zeigt.
 *
 * @returns {import('./issues.js').IssueRef[]}
 */
function collectIssueRefs() {
  const remoteRefs = listBranchRefs('refs/remotes/origin');
  const useRemote = remoteRefs.length > 0;
  const refNames = useRemote ? remoteRefs : listBranchRefs('refs/heads');
  const defaultRefName = useRemote ? `${REMOTE_PREFIX}${DEFAULT_BRANCH_NAME}` : DEFAULT_BRANCH_NAME;

  return refNames.map((name) => ({
    name,
    issuePaths: listIssuePaths(name),
    isDefaultBranch: name === defaultRefName,
  }));
}

/** Kurznamen der Branch-Refs unter einem Namespace, ohne den `HEAD`-Zeiger. */
function listBranchRefs(namespace) {
  return gitLines(['for-each-ref', '--format=%(refname:short)', namespace]).filter(
    (name) => !name.endsWith('/HEAD'),
  );
}

/** Pfade aller `issue.md` auf einem Ref. */
function listIssuePaths(refName) {
  return gitLines(['ls-tree', '-r', '--name-only', refName]).filter(
    (path) => path.startsWith(ISSUE_TRACKER_PREFIX) && path.endsWith(ISSUE_FILE_SUFFIX),
  );
}

/** Injizierter Lesezugriff fuer {@link collectOpenIssues}: Dateiinhalt auf einem Ref, sonst null. */
function showFileAtRef(refName, filePath) {
  const result = runGit(['show', `${refName}:${filePath}`]);
  return result.status === 0 ? result.stdout : null;
}

// --- Zusammenbau und Ausgabe --------------------------------------------------

/** Anzeigetext des Erhebungszeitpunkts, an eine feste Zeitzone gebunden. */
function formatTimestamp(date) {
  const formatted = date.toLocaleString('de-DE', {
    timeZone: 'Europe/Berlin',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  return `${formatted} Uhr (Europe/Berlin)`;
}

/**
 * Erhebt alle Rohdaten und baut daraus das HTML des Berichts.
 *
 * @param {{ rootDir: string, now?: Date }} options
 * @returns {string}  vollstaendiges HTML-Dokument
 */
export function generateReportHtml({ rootDir, now = new Date() }) {
  process.stderr.write('Gates ausfuehren ...\n');
  const { gateRuns, graphStdout } = executeGates();

  process.stderr.write('Rohdaten einlesen ...\n');
  const model = buildReportModel({
    generatedAt: formatTimestamp(now),
    gateRuns,
    workflowJob: readWorkflowJob(),
    coverageFinal: readJsonFile(join(rootDir, COVERAGE_FILE), {}),
    rootPath: rootDir,
    sources: readSourceFiles(rootDir),
    cruiserModules: parseCruiserModules(graphStdout),
    issueRefs: collectIssueRefs(),
    showFile: showFileAtRef,
  });

  return renderReport(model);
}

function writeReport(html, outputPath) {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, html);
}

function main() {
  const outputPath = process.argv[2] ?? DEFAULT_OUTPUT_PATH;
  try {
    const html = generateReportHtml({ rootDir: process.cwd() });
    writeReport(html, outputPath);
    process.stderr.write(`Bericht geschrieben: ${outputPath}\n`);
  } catch (error) {
    process.stderr.write(`Bericht konnte nicht erzeugt werden: ${error instanceof Error ? error.stack : error}\n`);
    process.exitCode = FAILED_EXIT_CODE;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
