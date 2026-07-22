/**
 * Handgepflegte Einordnung der automatisch erhobenen Befunde -- die *Urteils*-Seite
 * der bewussten Trennung von Messung und Urteil (PRD 54).
 *
 * Der Generator liest diese Datei nur, er schreibt sie nie. Dadurch ueberlebt die
 * Einordnung jeden Neulauf unveraendert: ein Werkzeug meldet Zahlen ("26 Befunde"),
 * die *Deutung* dieser Zahlen ("19 davon sind Fassaden-Re-Exporte nach ADR 0023 und
 * damit Absicht") steht hier daneben und wird beim Rendern dazugemischt. Ohne diese
 * Trennung muesste die Sortierarbeit nach jedem Lauf neu geleistet werden.
 *
 * Wer einen neuen Befund einordnet, ergaenzt hier einen Eintrag -- kein Code aendert
 * sich dafuer.
 */

/**
 * Wie ein Befund einzuordnen ist. Eine fachliche Kategorie, kein Farbwert: die
 * Darstellung leitet Symbol und Text daraus ab, damit die Einordnung auch ohne
 * Farbe erkennbar bleibt.
 */
export const AssessmentVerdict = Object.freeze({
  /** So gewollt, z. B. durch eine ADR gedeckt -- kein Handlungsbedarf. */
  Intentional: 'intentional',
  /** Bekannt und hingenommen, aber kein Fehler. */
  Accepted: 'accepted',
  /** Das Gate lief nicht an -- die Zahl ist kein gruenes Ergebnis. */
  NotRun: 'not-run',
  /** Offener Handlungsbedarf; eigene Arbeit, hier nur eingeordnet. */
  NeedsWork: 'needs-work',
});

/** Alle gueltigen Werte aus {@link AssessmentVerdict} als Menge fuer Pruefungen. */
export const ASSESSMENT_VERDICT_VALUES = Object.freeze(Object.values(AssessmentVerdict));

/**
 * @typedef {object} OverallAssessment  Das Gesamturteil, der Seite vorangestellt.
 * @property {string} headline  Eine Zeile, die den Zustand auf einen Blick nennt.
 * @property {string} summary   Begruendung im Klartext (Markdown erlaubt).
 */

/**
 * @typedef {object} FindingAssessment  Die Einordnung eines einzelnen Rohbefunds.
 * @property {string} source     Woher der Rohbefund stammt (Werkzeug oder Gate).
 * @property {string} title      Kurze Ueberschrift der Einordnung.
 * @property {string} verdict    Wert aus {@link AssessmentVerdict}.
 * @property {string} detail     Begruendung im Klartext (Markdown erlaubt).
 * @property {string} [reference]  Belegende ADR oder Issue, falls vorhanden.
 */

/** @type {OverallAssessment} */
export const OVERALL_ASSESSMENT = Object.freeze({
  headline: 'Blockierende Gates tragen; zwei Waechter sind benannt, nicht blind',
  summary: [
    'Die Kernlogik ist durch die blockierenden Gates (oxlint, Typecheck, Unit-Tests) abgesichert.',
    'Die Statik-Werkzeuge laufen nach ADR 0024 bewusst *warnend* statt blockierend, solange die',
    'Bestandsbefunde noch aufgeraeumt werden -- ihre Zahlen sind daher kein Freibrief, sondern',
    'ein Arbeitsvorrat.',
    '',
    'Zwei dieser Zahlen wuerden ohne Einordnung in die Irre fuehren: Knips grosse Befundzahl',
    'ist ueberwiegend Absicht, und dependency-cruiser meldet gar kein Ergebnis, sondern bricht',
    'vor der Pruefung ab. Beide sind unten eingeordnet.',
  ].join('\n'),
});

/**
 * Die bereits bekannten Einordnungen. Jede uebersetzt eine automatisch erhobene
 * Zahl in ein Urteil, das ihr Kontext gibt.
 *
 * @type {ReadonlyArray<FindingAssessment>}
 */
export const FINDING_ASSESSMENTS = Object.freeze([
  {
    source: 'Knip (toter Code)',
    title: 'Von den Knip-Befunden sind 19 Fassaden-Re-Exporte nach ADR 0023',
    verdict: AssessmentVerdict.Intentional,
    detail: [
      '19 der von Knip als ungenutzt gemeldeten Exporte sind Re-Exporte der Solver-Fassade',
      '`src/solver/validator.js`. **ADR 0023** macht diese Fassade zur einzigen erlaubten',
      'Schnittstelle des Solvers; die scheinbar ungenutzten Re-Exporte sind ihr Zweck, keine',
      'Schuld. Sie sind daher aus der Befundzahl herauszurechnen, bevor man den Rest beurteilt.',
    ].join('\n'),
    reference: 'ADR 0023',
  },
  {
    source: 'dependency-cruiser (Struktur)',
    title: 'dependency-cruiser laeuft auf Node 25 nicht an -- nicht gruen, sondern nicht angelaufen',
    verdict: AssessmentVerdict.NotRun,
    detail: [
      'Das Werkzeug bricht mit einer Versionsmeldung ab, bevor es eine einzige Regel prueft.',
      'Ein solcher Lauf ist **nicht gruen**, sondern *nicht angelaufen*: die Struktur-Regeln',
      '(Schichtung parser -> solver -> components, Solver-Fassade, Import-Zyklen) sind derzeit',
      'ungeprueft. Die Behebung ist eigene Arbeit (Issue 53, Node-Umstellung).',
    ].join('\n'),
    reference: 'Issue 53',
  },
]);
