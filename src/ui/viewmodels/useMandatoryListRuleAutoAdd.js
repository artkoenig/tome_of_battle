/**
 * Automatic addition of unambiguous mandatory list rules (Issue 0138, §9.9;
 * Issue 0176 cut it out of `useRosterState.js`).
 *
 * Gated on `isFreshRoster`, so an already existing roster is never changed
 * retroactively (AC4). Runs — like the catalogue sync effect — through
 * `replaceRoster`, hence without an undo step of its own: the user never
 * clicked this entry.
 *
 * **Welche** Regeln das sind, sagt seit Issue 0157 der Bericht
 * (`findMissingMandatoryListRules`, ADR-0034): er zählt das Angebot des
 * Kontingents auf und markiert je Slot Listenregel, armeeweite Pflicht,
 * Sichtbarkeit und Belegung. Der Katalog wird nur noch für den **Eintrag**
 * gelesen, aus dem die Selektion gebaut wird. Kein Endlosschleifen-Risiko:
 * eine einmal hinzugefügte Regel steht im nächsten Bericht als `occupied`
 * und fehlt damit nicht mehr. Läuft je Force erneut bei jeder
 * Roster-Änderung in derselben Sitzung, sodass eine erst durch eine andere
 * Wahl sichtbar gewordene Pflichtregel im selben Zug ergänzt wird.
 */

import { useEffect } from 'react';

import { childSelectionsOf } from '../../domain/roster';
import { findMissingMandatoryListRules } from '../../domain/evaluation/mandatoryListRules';
import { findCapabilityEntry } from './capabilityEntries';
import { catalogueIdOfForce, createSelectionFactory } from './rosterSelectionFactory';
import '../../shared/rostermodel/types.js';

/**
 * @param {Object} args
 * @param {import('../../shared/rostermodel/types.js').Roster} args.roster
 * @param {Object} args.system
 * @param {import('../../domain/evaluation/slotIndex.js').SlotIndex} args.slots
 * @param {boolean} [args.isFreshRoster] true when the roster was created in this session
 * @param {(roster: import('../../shared/rostermodel/types.js').Roster) => void} args.replaceRoster
 */
export function useMandatoryListRuleAutoAdd({ roster, system, slots, isFreshRoster, replaceRoster }) {
  useEffect(() => {
    if (!roster || !system || !isFreshRoster) return;

    const createSelectionFromDef = createSelectionFactory(system);
    let anyAdded = false;
    // Eine armeeweite Pflicht wird genau einmal gesetzt: was ein frueheres
    // Kontingent dieses Durchlaufs uebernommen hat, faellt fuer die spaeteren
    // heraus (der Bericht des naechsten Durchlaufs meldet sie dann als belegt).
    const claimedResolvedIds = new Set();
    const updatedForces = (roster.forces || []).map(force => {
      const catalogueId = catalogueIdOfForce(roster, force);
      const carriedEntryIds = new Set(
        childSelectionsOf(force).map(selection => selection.entryLinkId || selection.selectionEntryId)
      );
      const missing = findMissingMandatoryListRules(slots, slots.pathOfForce(force.id), {
        entryOf: (capability) => findCapabilityEntry(system, capability, catalogueId),
        skipResolvedIds: claimedResolvedIds,
      }).filter(({ entry, defId }) => entry && !carriedEntryIds.has(defId));
      if (missing.length === 0) return force;

      missing.forEach(({ resolvedId }) => claimedResolvedIds.add(resolvedId));
      const newSelections = missing
        .flatMap(({ entry, categoryId, mandatoryMembers }) => {
          const created = createSelectionFromDef(entry, categoryId, catalogueId, mandatoryMembers);
          return created ? [created] : [];
        });
      if (newSelections.length === 0) return force;

      anyAdded = true;
      return { ...force, selections: [...childSelectionsOf(force), ...newSelections] };
    });

    if (anyAdded) {
      replaceRoster({ ...roster, forces: updatedForces });
    }
  }, [roster, system, isFreshRoster, replaceRoster, slots]);
}
