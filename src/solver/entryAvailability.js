import { validateRoster } from './rosterValidator.js';
import { resolveEntry } from './catalogResolver.js';
import { createSelectionFromDef } from './selectionFactory.js';
import { ValidationSeverity } from './modifierEvaluator.js';
import '../types.js';

// Synthetische Selektions-ID des hypothetisch hinzugefügten Kandidaten. Bewusst eine
// Konstante: pro Aufruf wird auf einer frischen Roster-Kopie einmal validiert, sodass
// nie zwei Kandidaten dieselbe Liste teilen; eine stabile ID hält den Diff-Schlüssel
// (siehe violationKey) deterministisch und garantiert distinkt von echten Selektionen.
const HYPOTHETICAL_SELECTION_ID = 'hypothetical-add-candidate';

// Verstoßtyp der Autoren-Fehlermeldung (`rosterValidator` erzeugt ihn als
// `modifier-${severity}`). Aus `ValidationSeverity` abgeleitet statt als Magic String,
// damit er mit der Schweregrad-Definition kongruent bleibt.
const AUTHOR_ERROR_VIOLATION_TYPE = `modifier-${ValidationSeverity.ERROR}`;

/**
 * Wahr, wenn ein Validierungseintrag die Wählbarkeit im Aushebe-Dialog sperrt: Schweregrad
 * `error` (deckungsgleich mit `hasBlockingViolations`) UND vom Validator als sperrend
 * gestempelt (`blocksAddAvailability`, ADR-0022). Die Sperr-Klassifikation ist Sache des
 * Validators (autoritative Tabelle in `rosterValidator.js`) — hier wird nur das Flag gelesen,
 * nie mehr die Typ-Namenskonvention (`-max`-Suffix) interpretiert.
 * @param {import('../types.js').ValidationError} error
 * @returns {boolean}
 */
export function isBlockingAvailabilityViolation(error) {
  if (!error || error.severity !== ValidationSeverity.ERROR) return false;
  return error.blocksAddAvailability === true;
}

/**
 * Stabile Verstoß-Identität für den Baseline-Diff: `type` plus die tragenden Ziel-IDs
 * (`selectionId`/`categoryId`/`forceId`) — bewusst **ohne** die count-behaftete
 * `message`, damit eine bloße Zähler-Änderung an einem schon vorhandenen Verstoß nicht
 * fälschlich als „neu eingeführt" gilt (ADR-0022).
 * @param {import('../types.js').ValidationError} error
 * @returns {string}
 */
function violationKey(error) {
  return [error.type, error.selectionId ?? '', error.categoryId ?? '', error.forceId ?? ''].join('::');
}

/**
 * Immutable Kopie der Liste, in deren Ziel-Force (per `force.id`, sonst die erste Force)
 * die synthetische Selektion angehängt ist. Andere Forces bleiben unberührt.
 */
function withHypotheticalSelection(roster, force, hypotheticalSelection) {
  const targetForceId = force?.id ?? roster.forces?.[0]?.id;
  return {
    ...roster,
    forces: (roster.forces || []).map(f =>
      f.id === targetForceId
        ? { ...f, selections: [...(f.selections || []), hypotheticalSelection] }
        : f
    )
  };
}

/**
 * Priorisiert die Grund-Anzeige: trägt ein gesperrter Eintrag mindestens einen
 * Autoren-`error`-Verstoß (Typ `modifier-error`), so bilden **nur** dessen Meldungen den
 * Grund — die redundante mechanische `-max`-Meldung mit hypothetischem Zählstand
 * („aktuell: N") wird unterdrückt, weil der verständliche Autoren-Text sie ersetzt.
 * Fehlt ein solcher Autoren-`error`, zählen unverändert alle sperrenden Verstöße (ADR-0022).
 * @param {import('../types.js').ValidationError[]} blockingViolations
 * @returns {import('../types.js').ValidationError[]}
 */
function selectReasonViolations(blockingViolations) {
  const authorErrors = blockingViolations.filter(error => error.type === AUTHOR_ERROR_VIOLATION_TYPE);
  return authorErrors.length > 0 ? authorErrors : blockingViolations;
}

/**
 * Reines Verfügbarkeits-Prädikat des Aushebe-Dialogs (SSOT, ADR-0022): bestimmt, ob ein
 * Katalog-Eintrag legal gewählt werden kann, indem es ihn hypothetisch in die Ziel-Force
 * hinzudenkt, `validateRoster` ausführt und das Ergebnis gegen die Baseline (Validierung
 * ohne den Kandidaten) diff't. Nur eingeführte, sperrende Verstöße (siehe
 * `isBlockingAvailabilityViolation`) machen den Eintrag „nicht verfügbar".
 *
 * Die hypothetische Selektion wird über dieselbe geteilte Fabrik gebaut wie das echte
 * `useRoster.addUnit` (`createSelectionFromDef`), sodass **alle Pflicht-Kinder** (`min > 0`,
 * inkl. Default-Gruppenwahl) identisch bevölkert werden. So schlägt limit-sprengende
 * Pflicht-Ausrüstung schon in der Verfügbarkeit an, statt erst nach dem Ausheben.
 *
 * @param {Object} args
 * @param {Object} args.entry   der (unaufgelöste) Katalog-Eintrag/Link des Kandidaten.
 * @param {string} [args.categoryId] die Kategorie, unter der der Kandidat ausgehoben würde.
 * @param {Object} [args.force] die Ziel-Force; Fallback: die erste Force der Liste.
 * @param {import('../types.js').Roster} args.roster
 * @param {Object} args.system
 * @param {string} [args.catalogueId] der Katalog, aus dem `entry` stammt; ohne Angabe der
 *   der Ziel-Force bzw. der Liste. Bei mehreren geladenen Katalogen (ADR-0018) ist eine
 *   Eintrags-Id nur innerhalb ihres Katalogs eindeutig.
 * @param {import('../types.js').ValidationError[]} [args.baselineErrors] einmal pro Dialog
 *   vorberechnete Baseline (`validateRoster(roster, system)`); wird sonst hier berechnet.
 * @returns {{ available: boolean, reasons: import('../types.js').ValidationError[] }}
 *   `reasons` bleiben strukturierte Verstöße (Schlüssel + Parameter, ADR 0026); die
 *   Oberfläche übersetzt sie über `formatValidationError` und kappt dort den
 *   „(aktuell: …)"-Zählstand (Aushebe-Dialog, ADR-0022) — der Solver bleibt sprachfrei.
 */
export function getEntryAddAvailability({ entry, categoryId, force, roster, system, catalogueId, baselineErrors }) {
  if (!entry || !roster || !system) return { available: true, reasons: [] };

  // Derselbe Ziel-Force-Fallback wie in withHypotheticalSelection: der Kandidat wird gegen
  // den Katalog aufgelöst, in dem er auch ausgehoben würde.
  const targetForce = force ?? roster.forces?.[0];
  const candidateCatalogueId = catalogueId ?? targetForce?.catalogueId ?? roster.catalogueId ?? null;
  // Kontext für die effektive `min`-Seite der Fabrik: ein bedingt erhöhtes Pflicht-`min`
  // wird so auch in der hypothetischen Selektion bevölkert und schlägt limit-sprengend an,
  // konsistent mit dem echten Ausheben.
  const factoryContext = { roster, system, parentCatalogueId: candidateCatalogueId };
  const candidate = createSelectionFromDef({
    system, resolveEntry, catalogueId: candidateCatalogueId, entry, categoryId,
    evaluationContext: factoryContext
  });
  if (!candidate) return { available: true, reasons: [] };

  // Stabile Top-ID erst nach dem Fabrik-Aufruf vergeben: die Fabrik verteilt frische UUIDs
  // (nie in der Baseline), die synthetische Top-ID hält den Diff-Schlüssel deterministisch.
  const hypotheticalSelection = { ...candidate, id: HYPOTHETICAL_SELECTION_ID };

  const baseline = baselineErrors ?? validateRoster(roster, system);
  const baselineKeys = new Set(baseline.map(violationKey));

  const hypotheticalRoster = withHypotheticalSelection(roster, force, hypotheticalSelection);
  const hypotheticalErrors = validateRoster(hypotheticalRoster, system);

  const introducedBlocking = hypotheticalErrors.filter(
    error => isBlockingAvailabilityViolation(error) && !baselineKeys.has(violationKey(error))
  );

  // Nach Verstoß-Identität dedupliziert (mehrere Instanzen desselben Verstoßes ergeben
  // einen Grund), Reihenfolge bleibt erhalten. Die Übersetzung folgt an der Oberfläche.
  const reasons = [...new Map(
    selectReasonViolations(introducedBlocking).map(error => [violationKey(error), error])
  ).values()];
  return { available: introducedBlocking.length === 0, reasons };
}
