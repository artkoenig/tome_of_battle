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

import { unitsOfForce } from '../../contexts/armylist/model';
import {
  catalogueIdOfForce, createSelectionFactory
} from '../../contexts/armylist/application/rosterSelectionFactory.js';
import { withRaisedUnits } from '../../contexts/armylist/application/raiseUnit.js';
import { findMissingMandatoryListRules } from '../../contexts/ruleengine/readmodel/index.js';
import { findCapabilityEntry } from './capabilityEntries';
import '../../shared/rostermodel/types.js';

/**
 * @param {Object} args
 * @param {import('../../shared/rostermodel/types.js').Roster} args.roster
 * @param {Object} args.system
 * @param {import('../../contexts/ruleengine/readmodel/index.js').SlotIndex} args.slots
 * @param {boolean} [args.isFreshRoster] true when the roster was created in this session
 * @param {(roster: import('../../shared/rostermodel/types.js').Roster) => void} args.replaceRoster
 */
export function useMandatoryListRuleAutoAdd({ roster, system, slots, isFreshRoster, replaceRoster }) {
  useEffect(() => {
    if (!roster || !system || !isFreshRoster) return;

    const createSelectionFromDef = createSelectionFactory(system);
    // Eine armeeweite Pflicht wird genau einmal gesetzt: was ein frueheres
    // Kontingent dieses Durchlaufs uebernommen hat, faellt fuer die spaeteren
    // heraus (der Bericht des naechsten Durchlaufs meldet sie dann als belegt).
    const claimedResolvedIds = new Set();
    let nextRoster = roster;
    for (const force of roster.forces || []) {
      const catalogueId = catalogueIdOfForce(roster, force);
      const carriedEntryIds = new Set(
        unitsOfForce(force).map(selection => selection.entryLinkId || selection.selectionEntryId)
      );
      const missing = findMissingMandatoryListRules(slots, slots.pathOfForce(force.id), {
        entryOf: (capability) => findCapabilityEntry(system, capability, catalogueId),
        skipResolvedIds: claimedResolvedIds,
      }).filter(({ entry, defId }) => entry && !carriedEntryIds.has(defId));
      if (missing.length === 0) continue;

      missing.forEach(({ resolvedId }) => claimedResolvedIds.add(resolvedId));
      const newSelections = missing
        .flatMap(({ entry, categoryId, mandatoryMembers }) => {
          const created = createSelectionFromDef(entry, categoryId, catalogueId, mandatoryMembers);
          return created ? [created] : [];
        });

      // Das Anhängen an das Kontingent ist Sache des Anwendungsfalls (Issue 0188).
      nextRoster = withRaisedUnits(nextRoster, force.id, newSelections);
    }

    if (nextRoster !== roster) {
      replaceRoster(nextRoster);
    }
  }, [roster, system, isFreshRoster, replaceRoster, slots]);
}
