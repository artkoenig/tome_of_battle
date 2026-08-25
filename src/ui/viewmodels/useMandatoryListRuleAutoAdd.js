/**
 * Die Verdrahtung der automatischen Ergaenzung eindeutiger Pflicht-Listenregeln
 * (Issue 0138, §9.9; Issue 0176 schnitt sie aus `useRosterState.js`).
 *
 * Seit Issue 0189 ist die **Regel** kein Effekt mehr, sondern der
 * Anwendungsfall `applyMandatoryListRules` des Listen-Kontexts. Hier bleibt nur,
 * was React beitraegt: den aktuellen Bericht hineinreichen und ein veraendertes
 * Roster durch `replaceRoster` uebernehmen — also ohne eigenen Undo-Schritt,
 * denn der Nutzer hat diesen Eintrag nie angeklickt. Der Effekt laeuft bei jeder
 * Roster-Aenderung derselben Sitzung erneut, sodass eine erst durch eine andere
 * Wahl sichtbar gewordene Pflichtregel im selben Zug ergaenzt wird.
 */

import { useEffect } from 'react';

import { applyMandatoryListRules } from '../../contexts/armylist/application/mandatoryListRules.js';
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
    const nextRoster = applyMandatoryListRules(roster, { system, slots, isFreshRoster });
    if (nextRoster && nextRoster !== roster) {
      replaceRoster(nextRoster);
    }
  }, [roster, system, isFreshRoster, replaceRoster, slots]);
}
