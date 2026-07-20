import { validateRoster } from './rosterValidator.js';
import { resolveEntry } from './catalogResolver.js';
import { ValidationSeverity } from './modifierEvaluator.js';
import '../types.js';

// Synthetische Selektions-ID des hypothetisch hinzugefügten Kandidaten. Bewusst eine
// Konstante: pro Aufruf wird auf einer frischen Roster-Kopie einmal validiert, sodass
// nie zwei Kandidaten dieselbe Liste teilen; eine stabile ID hält den Diff-Schlüssel
// (siehe violationKey) deterministisch und garantiert distinkt von echten Selektionen.
const HYPOTHETICAL_SELECTION_ID = 'hypothetical-add-candidate';

// Sperr-Klassifikation (ADR-0022): Ein eingeführter Verstoß macht den Eintrag nur dann
// „nicht verfügbar", wenn er eine „zu-viel/nicht-erlaubt"-Klasse ist — jede `*-max`-
// Constraint (entry/category/group/percent) oder ein Autoren-`error`-Modifier. Budget-/
// „zu-wenig"-Zustände (roster-limit, alle `*-min`, force-selector-min) gehören zum
// normalen, unfertigen Bauzustand und sperren die Wählbarkeit nicht.
const BLOCKING_MAX_TYPE_SUFFIX = '-max';
const MODIFIER_ERROR_TYPE = 'modifier-error';

/**
 * Wahr, wenn ein Validierungseintrag die Wählbarkeit im Aushebe-Dialog sperrt:
 * Schweregrad `error` (deckungsgleich mit `hasBlockingViolations`) UND eine
 * „zu-viel/nicht-erlaubt"-Klasse (`type` endet auf `-max` oder ist `modifier-error`).
 * @param {import('../types.js').ValidationError} error
 * @returns {boolean}
 */
export function isBlockingAvailabilityViolation(error) {
  if (!error || error.severity !== ValidationSeverity.ERROR) return false;
  return error.type === MODIFIER_ERROR_TYPE || error.type.endsWith(BLOCKING_MAX_TYPE_SUFFIX);
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
 * Baut die synthetische Selektion des hypothetisch hinzugefügten Kandidaten. Spiegelt
 * exakt das Selektions-Shape, das `useRoster.addUnit` erzeugt (entryLinkId vs.
 * selectionEntryId je nach `targetId`, `number: 1`, Kategorie-Zuordnung), damit
 * Modifier korrekt auswerten, deren Bedingung die Präsenz des Eintrags voraussetzt.
 */
function buildHypotheticalSelection(entry, resolved, categoryId) {
  return {
    id: HYPOTHETICAL_SELECTION_ID,
    entryLinkId: entry.targetId ? entry.id : null,
    selectionEntryId: entry.targetId ? null : entry.id,
    name: resolved.name,
    number: 1,
    category: categoryId,
    collective: resolved.collective || entry.collective || false,
    selections: []
  };
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
 * Reines Verfügbarkeits-Prädikat des Aushebe-Dialogs (SSOT, ADR-0022): bestimmt, ob ein
 * Katalog-Eintrag legal gewählt werden kann, indem es ihn hypothetisch in die Ziel-Force
 * hinzudenkt, `validateRoster` ausführt und das Ergebnis gegen die Baseline (Validierung
 * ohne den Kandidaten) diff't. Nur eingeführte, sperrende Verstöße (siehe
 * `isBlockingAvailabilityViolation`) machen den Eintrag „nicht verfügbar".
 *
 * @param {Object} args
 * @param {Object} args.entry   der (unaufgelöste) Katalog-Eintrag/Link des Kandidaten.
 * @param {string} [args.categoryId] die Kategorie, unter der der Kandidat ausgehoben würde.
 * @param {Object} [args.force] die Ziel-Force; Fallback: die erste Force der Liste.
 * @param {import('../types.js').Roster} args.roster
 * @param {Object} args.system
 * @param {import('../types.js').ValidationError[]} [args.baselineErrors] einmal pro Dialog
 *   vorberechnete Baseline (`validateRoster(roster, system)`); wird sonst hier berechnet.
 * @returns {{ available: boolean, reasons: string[] }}
 */
export function getEntryAddAvailability({ entry, categoryId, force, roster, system, baselineErrors }) {
  if (!entry || !roster || !system) return { available: true, reasons: [] };

  const resolved = resolveEntry(system, entry);
  if (!resolved) return { available: true, reasons: [] };

  const baseline = baselineErrors ?? validateRoster(roster, system);
  const baselineKeys = new Set(baseline.map(violationKey));

  const hypotheticalSelection = buildHypotheticalSelection(entry, resolved, categoryId);
  const hypotheticalRoster = withHypotheticalSelection(roster, force, hypotheticalSelection);
  const hypotheticalErrors = validateRoster(hypotheticalRoster, system);

  const introducedBlocking = hypotheticalErrors.filter(
    error => isBlockingAvailabilityViolation(error) && !baselineKeys.has(violationKey(error))
  );

  const reasons = [...new Set(introducedBlocking.map(error => error.message))];
  return { available: introducedBlocking.length === 0, reasons };
}
