/**
 * Der Anwendungsfall "eine eindeutige Pflicht-Listenregel wird automatisch
 * ergaenzt" (Issue 0138, §9.9; Issue 0189 holt ihn aus dem React-Effekt heraus).
 *
 * Bis Issue 0189 war diese Zusage ein `useEffect` in
 * `src/ui/viewmodels/useMandatoryListRuleAutoAdd.js` — sie galt also nur,
 * solange die Editor-Komponente montiert war. Sie ist aber eine Regel des
 * Modells: **jeder** Schreibweg, der ein Roster anlegt oder ersetzt, laeuft
 * durch diese Funktion (Neuanlage, `.ros`-Import, Katalog-Abgleich im Editor).
 * Roster hinein, Roster heraus; Bericht und Katalog sind Argumente (ADR-0039).
 *
 * **Welche** Regeln fehlen, sagt der Bericht (`findMissingMandatoryListRules`,
 * ADR-0034) — eine Projektion des Lesemodells, die dort bleibt; hier wohnt nur
 * die Entscheidung "und also wird sie ergaenzt". Der Katalog wird allein fuer
 * den **Eintrag** gelesen, aus dem die Selektion gebaut wird. Kein
 * Endlosschleifen-Risiko: eine einmal ergaenzte Regel steht im naechsten
 * Bericht als `occupied` und fehlt damit nicht mehr.
 *
 * Das `isFreshRoster`-Tor ist Verhalten, kein Geruest (AC4 von Issue 0138): ein
 * bestehendes Roster wird nie nachtraeglich geaendert. Es ist deshalb ein
 * ausdrückliches Argument und keine Hook-Bedingung mehr.
 */

import { unitsOfForce } from '../model/rosterTree.js';
import { findEntryInSystem } from '../model/catalogResolver.js';
import { catalogueIdOfForce, createSelectionFactory } from './rosterSelectionFactory.js';
import { withRaisedUnits } from './raiseUnit.js';
import { findMissingMandatoryListRules } from '../../ruleengine/readmodel/index.js';
import '../../../shared/rostermodel/types.js';
import { selectionIdentityId } from '../../../shared/rostermodel/selectionIds.js';

/**
 * Ergaenzt jede eindeutige, fehlende Pflicht-Listenregel je Kontingent.
 *
 * @param {import('../../../shared/rostermodel/types.js').Roster|null|undefined} roster
 * @param {Object} context
 * @param {Object|null|undefined} context.system  das App-System (Katalogseite).
 * @param {import('../../ruleengine/readmodel/index.js').SlotIndex|null|undefined} context.slots
 *   die Slot-Seite des Berichts zu genau diesem Roster.
 * @param {boolean} [context.isFreshRoster]  nur ein in dieser Sitzung neu
 *   entstandenes Roster wird ergaenzt; sonst bleibt es unveraendert.
 * @returns {import('../../../shared/rostermodel/types.js').Roster|null|undefined}
 *   dasselbe Roster, wenn nichts zu ergaenzen war — sonst das ergaenzte.
 */
export function applyMandatoryListRules(roster, { system, slots, isFreshRoster = false }) {
  if (!roster || !system || !slots || !isFreshRoster) return roster;

  const createSelectionFromDef = createSelectionFactory(system);
  // Eine armeeweite Pflicht wird genau einmal gesetzt: was ein frueheres
  // Kontingent dieses Durchlaufs uebernommen hat, faellt fuer die spaeteren
  // heraus (der Bericht des naechsten Durchlaufs meldet sie dann als belegt).
  const claimedResolvedIds = new Set();
  let nextRoster = roster;

  for (const force of roster.forces || []) {
    const catalogueId = catalogueIdOfForce(roster, force);
    const carriedEntryIds = new Set(
      unitsOfForce(force).map(selectionIdentityId)
    );
    const missing = findMissingMandatoryListRules(slots, slots.pathOfForce(force.id), {
      entryOf: (capability) => entryOfCapability(system, capability, catalogueId),
      skipResolvedIds: claimedResolvedIds,
    }).filter(({ entry, defId }) => entry && !carriedEntryIds.has(defId));
    if (missing.length === 0) continue;

    missing.forEach(({ resolvedId }) => claimedResolvedIds.add(resolvedId));
    const newSelections = missing.flatMap(({ entry, categoryId, mandatoryMembers }) => {
      const created = createSelectionFromDef(entry, categoryId, catalogueId, mandatoryMembers);
      return created ? [created] : [];
    });

    nextRoster = withRaisedUnits(nextRoster, force.id, newSelections);
  }

  return nextRoster;
}

/**
 * Der Katalogeintrag hinter einem Slot, oder `null`, wenn der Katalog ihn nicht
 * mehr kennt (stiller Katalogwechsel, ADR-0018).
 *
 * @param {Object} system
 * @param {{ defId?: string }|null|undefined} capability
 * @param {string|null|undefined} catalogueId
 * @returns {Object|null}
 */
function entryOfCapability(system, capability, catalogueId) {
  if (!capability?.defId) return null;
  return findEntryInSystem(system, capability.defId, catalogueId) ?? null;
}
