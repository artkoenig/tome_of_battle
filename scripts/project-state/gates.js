/**
 * Reine Auswertung der Qualitaets-Gates (ohne Prozess-, Datei- oder Netzzugriff,
 * damit sie testbar bleibt). Rohdaten kommen injiziert herein: das Ergebnis eines
 * Gate-Laufs und der bereits geparste CI-Job.
 *
 * Der Kern dieses Moduls ist die Unterscheidung dreier Zustaende statt zweier.
 * Ein Werkzeug, das mit einem Umgebungsfehler abbricht, hat *nichts geprueft* --
 * es darf weder als bestanden noch als "hat Befunde" gelten. Der Anlass ist
 * konkret: dependency-cruiser bricht auf einer nicht unterstuetzten Node-Version
 * mit einer Versionsmeldung ab, bevor es eine einzige Regel auswertet. Steht der
 * Step zudem auf `continue-on-error`, meldet die CI-Oberflaeche ihn gruen. Genau
 * deshalb urteilt dieses Modul ueber Exit-Code und Ausgabe des Werkzeugs selbst
 * und nicht ueber das Ergebnis des Workflow-Steps.
 */

/** Der Zustand eines Gates. `NotRun` ist der Grund fuer dieses Modul. */
export const GateStatus = Object.freeze({
  /** Das Werkzeug lief durch und meldete nichts. */
  Passed: 'passed',
  /** Das Werkzeug lief durch und meldete Befunde. */
  Findings: 'findings',
  /** Das Werkzeug kam nie zur Auswertung -- kein Urteil ueber den Code moeglich. */
  NotRun: 'not-run',
});

/** Die tatsaechliche Wirksamkeit eines Gates, abgeleitet aus `continue-on-error`. */
export const GateEnforcement = Object.freeze({
  /** Ein Befund laesst die CI scheitern. */
  Blocking: 'blocking',
  /** Ein Befund erscheint nur im Log (`continue-on-error: true`). */
  Warning: 'warning',
  /** Im Workflow kein passender Step gefunden -- die Wirksamkeit ist unbekannt. */
  Unknown: 'unknown',
});

/** Warum ein Gate als `NotRun` gilt. */
export const GateAbortReason = Object.freeze({
  UnsupportedNodeVersion: 'unsupported-node-version',
  ExecutableNotFound: 'executable-not-found',
  ModuleNotFound: 'module-not-found',
  /** Fuer dieses Gate liegt ueberhaupt kein Laufergebnis vor. */
  NoRunRecorded: 'no-run-recorded',
});

const EXIT_CODE_SUCCESS = 0;

/**
 * Signaturen eines Abbruchs *vor* der eigentlichen Analyse. Bewusst generische
 * Umgebungsfehler statt werkzeugspezifischer Meldungen -- ein neues Gate braucht
 * hier keinen Eintrag.
 *
 * Die erste Signatur ist woertlich der Meldung von dependency-cruiser
 * nachgebildet ("ERROR: Your node version (25.0.0) is not supported."), dem
 * Anlassfall dieses Vorhabens.
 */
const ENVIRONMENT_ABORT_SIGNATURES = Object.freeze([
  { reason: GateAbortReason.UnsupportedNodeVersion, pattern: /your node version \([^)]*\) is not supported/i },
  { reason: GateAbortReason.UnsupportedNodeVersion, pattern: /unsupported engine|EBADENGINE/i },
  { reason: GateAbortReason.ExecutableNotFound, pattern: /command not found|\bENOENT\b/i },
  { reason: GateAbortReason.ModuleNotFound, pattern: /cannot find module|ERR_MODULE_NOT_FOUND/i },
]);

/**
 * Die Qualitaets-Gates des Projekts, jeweils ueber das Kommando identifiziert,
 * mit dem der Workflow sie ausfuehrt. Das Kommando ist der Schluessel, ueber den
 * die Wirksamkeit im CI-Workflow nachgeschlagen wird.
 */
export const GATE_DEFINITIONS = Object.freeze([
  { id: 'lint', label: 'oxlint', command: 'npm run lint' },
  { id: 'knip', label: 'Knip (dead code)', command: 'npm run knip' },
  { id: 'depcruise', label: 'dependency-cruiser (structure)', command: 'npm run depcruise' },
  { id: 'typecheck', label: 'Typecheck (tsc --noEmit)', command: 'npm run typecheck' },
  { id: 'unit-tests', label: 'Unit/component tests', command: 'npx vitest run' },
]);

/**
 * @typedef {object} GateRun  Rohergebnis eines Gate-Laufs, von aussen injiziert.
 * @property {number} exitCode  Exit-Code des Werkzeugs selbst (nicht des CI-Steps).
 * @property {string} [output]  Zusammengefasste stdout/stderr-Ausgabe.
 */

/**
 * @typedef {object} GateClassification
 * @property {string} status       Wert aus {@link GateStatus}.
 * @property {string|null} abortReason  Wert aus {@link GateAbortReason}, sonst null.
 */

/** Erste passende Abbruch-Signatur in der Werkzeug-Ausgabe, sonst null. */
function findEnvironmentAbort(output) {
  if (!output) return null;
  const signature = ENVIRONMENT_ABORT_SIGNATURES.find(({ pattern }) => pattern.test(output));
  return signature ? signature.reason : null;
}

/**
 * Ordnet einen Gate-Lauf einem der drei Zustaende zu.
 *
 * Die Signatur-Pruefung steht bewusst *vor* der Exit-Code-Pruefung: ein
 * Umgebungsabbruch ist weder ein Bestehen noch ein Befund, unabhaengig davon,
 * mit welchem Code das Werkzeug endet.
 *
 * @param {GateRun|null|undefined} run
 * @returns {GateClassification}
 */
export function classifyGate(run) {
  if (!run) {
    return { status: GateStatus.NotRun, abortReason: GateAbortReason.NoRunRecorded };
  }

  const abortReason = findEnvironmentAbort(run.output);
  if (abortReason) {
    return { status: GateStatus.NotRun, abortReason };
  }

  const status = run.exitCode === EXIT_CODE_SUCCESS ? GateStatus.Passed : GateStatus.Findings;
  return { status, abortReason: null };
}

/**
 * Wirksamkeit eines Kommandos laut CI-Workflow. `continue-on-error: true` heisst,
 * dass ein Befund die CI nicht scheitern laesst -- das Gate warnt dann nur.
 *
 * @param {{ steps?: Array<{ run?: string, 'continue-on-error'?: boolean }> }|null|undefined} workflowJob
 *   Der bereits geparste CI-Job. Das Parsen der YAML-Datei ist I/O und liegt aussen.
 * @param {string} command
 * @returns {string} Wert aus {@link GateEnforcement}
 */
export function findGateEnforcement(workflowJob, command) {
  const steps = workflowJob?.steps ?? [];
  const step = steps.find((candidate) => normalizeCommand(candidate.run) === normalizeCommand(command));
  if (!step) return GateEnforcement.Unknown;
  return step['continue-on-error'] === true ? GateEnforcement.Warning : GateEnforcement.Blocking;
}

/** Vergleichsform eines Kommandos: getrimmt und ohne mehrfache Leerzeichen. */
function normalizeCommand(command) {
  return (command ?? '').trim().replace(/\s+/g, ' ');
}

/**
 * @typedef {object} GateState  Ein Gate im Datenmodell des Projektzustands.
 * @property {string} id
 * @property {string} label
 * @property {string} command
 * @property {string} status       Wert aus {@link GateStatus}.
 * @property {string} enforcement  Wert aus {@link GateEnforcement}.
 * @property {string|null} abortReason
 * @property {number|null} exitCode
 */

/**
 * Verbindet die Gate-Definitionen mit ihren Laufergebnissen und ihrer im
 * Workflow hinterlegten Wirksamkeit.
 *
 * @param {object} input
 * @param {ReadonlyArray<{ id: string, label: string, command: string }>} [input.definitions]
 * @param {object|null} [input.workflowJob]  geparster CI-Job
 * @param {Record<string, GateRun>} [input.runs]  Laufergebnisse je Gate-Id
 * @returns {GateState[]}
 */
export function buildGateStates({ definitions = GATE_DEFINITIONS, workflowJob = null, runs = {} } = {}) {
  return definitions.map((definition) => {
    const run = runs[definition.id];
    const { status, abortReason } = classifyGate(run);
    return {
      id: definition.id,
      label: definition.label,
      command: definition.command,
      status,
      enforcement: findGateEnforcement(workflowJob, definition.command),
      abortReason,
      exitCode: run ? run.exitCode : null,
    };
  });
}
