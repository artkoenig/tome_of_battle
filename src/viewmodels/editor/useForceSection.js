import { useMemo } from 'react';

import { findForceEntryById, childSelectionsOf } from '../../roster';
import { armyWideSelectorSlotsOf } from '../../evaluation/armyWideSelectorSlots';
import { capabilityEntryOf } from '../capabilityEntries';
import { EMPTY_SLOT_INDEX } from '../../evaluation/slotIndex';
import { useRosterReport } from '../rosterContexts';

/**
 * Ein **Kontingent** der Liste (Issue 0164): seine Kategorie-Verweise, die
 * armeeweiten Selektoren ohne eigene Kategorie und die Auffangsektion für
 * Auswahlen, die keine Kategorie des Kontingents trifft.
 *
 * Armeeweite Pflicht-Selektoren, die keine Kontingent-Kategorie anbietet (etwa
 * ein kontingent-gebundener Wurzeleintrag ohne passenden `categoryLink`),
 * bekommen einen eigenen Hinzufüger; alles, was eine Kategorie bereits
 * anbietet, wird dort erledigt. Welche das sind, sagt der **Bericht** (Issue
 * 0156): sichtbare Slots dieses Kontingents mit wirksamem Minimum, deren
 * effektive Kategorien keine Kategorie des Kontingents treffen. Der
 * Katalog-Eintrag daneben ist Schreibmodell — der Aushebe-Dialog reicht ihn an
 * `addUnit` weiter.
 *
 * Das Armeebuch **dieses** Kontingents (ein `.ros`-Import bringt verbündete
 * Kontingente mit eigenem Katalog mit) ist `force.catalogueId`, ersatzweise das
 * der Liste — dieselbe Regel wie `useRoster.catalogueIdOfForce`.
 *
 * @param {{ force: Object, forcePath: string|null }} params
 * @returns {{ categoryLinks: Array<Object>, armyWideEntries: Array<Object>,
 *   armyWideSelections: Array<Object>, uncategorizedSelections: Array<Object> }}
 */
export function useForceSection({ force, forcePath = null }) {
  const { report, roster, system } = useRosterReport();
  const slots = report?.slots ?? EMPTY_SLOT_INDEX;

  return useMemo(() => {
    const forceDefinition = findForceEntryById(system, force?.forceEntryId);
    const categoryLinks = forceDefinition?.categoryLinks || [];
    const forceCatalogueId = force?.catalogueId || roster?.catalogueId || null;

    const armyWideSelectorSlots = armyWideSelectorSlotsOf(
      slots, forcePath, categoryLinks.map(link => link.targetId));
    const armyWideEntries = armyWideSelectorSlots.map(capability =>
      capabilityEntryOf(system, capability, forceCatalogueId));
    const armyWideSelectorIds = new Set(armyWideSelectorSlots.flatMap(capability =>
      [capability.defId, capability.targetDefId].filter(Boolean)));
    const belongsToArmyWideSelector = s => armyWideSelectorIds.has(s.selectionEntryId || s.entryLinkId);
    const armyWideSelections = childSelectionsOf(force).filter(belongsToArmyWideSelector);

    const matchedCategoryIds = new Set(categoryLinks.map(l => l.targetId));
    const uncategorizedSelections = childSelectionsOf(force).filter(s =>
      !matchedCategoryIds.has(s.category) && !belongsToArmyWideSelector(s));

    return { categoryLinks, armyWideEntries, armyWideSelections, uncategorizedSelections };
  }, [system, roster, slots, force, forcePath]);
}
