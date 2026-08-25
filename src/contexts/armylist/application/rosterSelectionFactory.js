/**
 * Die Selektions-Fabrik der Schreib-Anwendungsfälle (Issue 0188, aus
 * `src/ui/viewmodels/rosterSelectionFactory.js` hierher gezogen).
 *
 * Shared selection factory (SSOT, ADR-0022): `system`/`resolveEntry` are
 * injected. **Which** mandatory members come along has been the report's answer
 * since Issue 0157 (`capability.raiseMembers`, ADR-0034) — the same answer the
 * pre-raise price (`raiseCosts`) comes from, so the displayed price and the
 * created tree come out of one pass. The catalogue is only resolved here, never
 * evaluated.
 */

import {
  resolveEntry,
  findForceContainingSelection,
  createSelectionFromDef as buildSelectionFromDef,
} from '../model/index.js';
import '../../../shared/rostermodel/types.js';

/**
 * Der Katalog, gegen den die Verweise eines Kontingents auflösen: seiner, ersatzweise
 * der der Liste. Bei mehreren gleichzeitig geladenen Katalogen (ADR-0018) ist eine
 * Eintrags-Id nur innerhalb ihres Katalogs eindeutig, deshalb wird er mitgegeben.
 * @param {import('../../../shared/rostermodel/types.js').Roster|null|undefined} roster
 * @param {import('../../../shared/rostermodel/types.js').Force|null|undefined} force
 * @returns {string|null}
 */
export function catalogueIdOfForce(roster, force) {
  return force?.catalogueId || roster?.catalogueId || null;
}

/**
 * Der Katalog des Kontingents, das die Selektion `selectionId` enthält.
 * @param {import('../../../shared/rostermodel/types.js').Roster|null|undefined} roster
 * @param {string} selectionId
 * @returns {string|null}
 */
export function catalogueIdContaining(roster, selectionId) {
  return catalogueIdOfForce(roster, findForceContainingSelection(roster, selectionId));
}

/**
 * Binds the selection factory to one catalogue system.
 * @param {Object} system
 * @returns {(entry: Object, categoryId: string|null, catalogueId: string|null,
 *   mandatoryMembers?: ReadonlyArray<any>) => (import('../../../shared/rostermodel/types.js').Selection|null)}
 */
export function createSelectionFactory(system) {
  return (entry, categoryId, catalogueId, mandatoryMembers = []) =>
    buildSelectionFromDef({
      system, resolveEntry, catalogueId, entry, categoryId, mandatoryMembers
    });
}
