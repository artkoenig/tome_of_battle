/**
 * Anwendungsfall „Einheit ausheben" (Issue 0188).
 *
 * Bis dahin baute `src/ui/viewmodels/rosterCommands.js` den Selektionsbaum von
 * Hand in einem `setRoster`-Updater um. Jetzt ist das Ausheben eine benannte,
 * reine Funktion über dem Roster: React braucht sie nicht, ein Test rendert
 * nichts.
 *
 * Die Slot-Seite des Berichts wird **hereingereicht** (ADR-0039) — das
 * Schreibmodell greift nie selbst nach dem Lesemodell.
 */

import { childSelectionsOf } from '../model/rosterTree.js';
import { catalogueIdOfForce, createSelectionFactory } from './rosterSelectionFactory.js';
import '../../../shared/rostermodel/types.js';

/** Ohne benanntes Ziel-Kontingent hebt die App in das erste des Rosters aus. */
const FALLBACK_FORCE_INDEX = 0;

/** Kein Kontingent nimmt die Einheit auf. */
/** @type {import('../../../shared/rostermodel/types.js').Force|null} */
const NO_FORCE = null;

/** Es entstand keine Selektion (der Katalog gab den Eintrag nicht her). */
/** @type {import('../../../shared/rostermodel/types.js').Selection|null} */
const NO_UNIT = null;

/**
 * Das eine Kontingent, in das eine ausgehobene Einheit gehört: das der aktiven
 * Ansicht, ersatzweise das erste des Rosters. Ein `.ros`-Import bringt beliebig
 * viele Kontingente mit, deshalb muss das Ziel eindeutig bestimmt sein.
 * @param {import('../../../shared/rostermodel/types.js').Force[]|null|undefined} forces
 * @param {string|null} targetForceId
 * @returns {import('../../../shared/rostermodel/types.js').Force|null}
 */
export function findTargetForce(forces, targetForceId) {
  if (!forces?.length) return NO_FORCE;
  return forces.find(force => force.id === targetForceId) ?? forces[FALLBACK_FORCE_INDEX];
}

/**
 * Hängt fertige Selektionen unten an ein Kontingent an. Kennt das Roster das
 * Kontingent nicht (mehr), bleibt es unverändert — daran erkennt der Aufrufer
 * an der Identität, dass nichts geschah.
 * @param {import('../../../shared/rostermodel/types.js').Roster} roster
 * @param {string|null|undefined} forceId
 * @param {ReadonlyArray<import('../../../shared/rostermodel/types.js').Selection>} units
 * @returns {import('../../../shared/rostermodel/types.js').Roster}
 */
export function withRaisedUnits(roster, forceId, units) {
  if (!units.length) return roster;
  const forces = roster?.forces ?? [];
  if (!forces.some(force => force.id === forceId)) return roster;
  return {
    ...roster,
    forces: forces.map(force => (
      force.id === forceId
        ? { ...force, selections: [...childSelectionsOf(force), ...units] }
        : force
    ))
  };
}

/**
 * Die Pflicht-Mitglieder, die der Bericht dem Angebot `defId` unter `forceId` gibt.
 * @param {Object} slots Slot-Seite des Berichts (`report.slots`)
 * @param {string|null|undefined} forceId
 * @param {string} defId
 */
function raiseMembersInForce(slots, forceId, defId) {
  return slots.findChildSlot(slots.pathOfForce(forceId), defId)?.raiseMembers ?? [];
}

/**
 * Hebt `entry` in genau ein Kontingent aus und gibt das neue Roster samt der
 * entstandenen Einheit zurück. Entsteht keine Einheit — oder hat das Roster
 * kein Kontingent —, kommt das Roster unverändert und `unit: null` zurück.
 *
 * @param {import('../../../shared/rostermodel/types.js').Roster} roster
 * @param {Object} command
 * @param {Object} command.entry Katalogeintrag, aus dem die Selektion gebaut wird
 * @param {string|null} command.categoryId Kategorie, unter der die Einheit geführt wird
 * @param {string|null} [command.targetForceId] Kontingent der aktiven Ansicht; ohne
 *   Angabe das erste Kontingent des Rosters
 * @param {Object} command.system Katalogsystem, gegen das aufgelöst wird
 * @param {Object} command.slots Slot-Seite des Berichts (`report.slots`)
 * @returns {{roster: import('../../../shared/rostermodel/types.js').Roster,
 *   unit: import('../../../shared/rostermodel/types.js').Selection|null}}
 */
export function raiseUnit(roster, { entry, categoryId, targetForceId = null, system, slots }) {
  const force = findTargetForce(roster?.forces, targetForceId);
  if (!force) return { roster, unit: NO_UNIT };

  const unit = createSelectionFactory(system)(
    entry, categoryId, catalogueIdOfForce(roster, force),
    raiseMembersInForce(slots, force.id, entry.id)
  );
  if (!unit) return { roster, unit: NO_UNIT };

  return { roster: withRaisedUnits(roster, force.id, [unit]), unit };
}
