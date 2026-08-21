import { useMemo } from 'react';

import { resolveCostLimitLabel } from '../../roster';
import { hasBlockingViolations, countBlockingViolations } from '../../evaluation/violationStats';
import { EMPTY_SLOT_INDEX } from '../../evaluation/slotIndex';
import { extraResourceTotalsOf } from '../../evaluation/costDisplays';
import { useRosterReport } from '../rosterContexts';

/**
 * Die **Seitenleiste** des Editors (Issue 0164): Punktsumme gegen Punktgrenze,
 * Gesamtstatus, Extra-Ressourcen, die Armeeanforderungen und die Liste aller
 * Verletzungen.
 *
 * Die Armeeanforderungen gelten dem **ersten** Kontingent und kommen aus seinen
 * Kategorie-Anker-Slots (Issue 0121, Task 7): je sichtbarem Anker eine Zeile mit
 * aktuellem Stand (`current`) und den wirksamen Grenzen (`effectiveMin`/
 * `effectiveMax`; `null` = unbegrenzt).
 *
 * Der Slot-Pfad dieses Kontingents kommt aus `pathOfForce` des Berichts-Index, nie
 * aus dem Eingabe-Index des Rosters (Issue 0121, Task 21). Der Index stimmt
 * nämlich nur, solange jede Kontingent-Definition auflöst: fällt die erste weg,
 * führt der Bericht unter `"0"` das **zweite** Kontingent, und ein festes
 * Literal zeigte still dessen Kategorien und Grenzen. Fehlt der Pfad, erscheint
 * **keine** Anforderung statt der eines fremden Kontingents.
 *
 * Nur blockierende Verletzungen machen das Roster ungültig; `warning`/`info`
 * zählen nicht mit (`violationStats.js`).
 *
 * @returns {{ totalCosts: number, costLimit: number, costTypeLabel: string,
 *   isValid: boolean, blockingErrorCount: number, extraResources: Array<Object>,
 *   requirements: Array<{ key: string, name: string, count: number,
 *     min: number|null, max: number|null, hasErrors: boolean }>,
 *   violations: Array<Object> }}
 */
export function useRosterSidebar() {
  const { report, roster, system } = useRosterReport();

  return useMemo(() => {
    const slots = report?.slots ?? EMPTY_SLOT_INDEX;
    const violations = report?.violations ?? [];
    const costTotals = report?.costTotals ?? {};
    const costLimitType = roster?.costLimitType;
    const forcePath = roster?.forces?.[0]
      ? slots.pathOfForce(roster.forces[0].id)
      : null;

    const requirements = forcePath === null || forcePath === undefined
      ? []
      : slots.categoryAnchorSlotsOf(forcePath)
        .filter(({ capability }) => capability.isHidden !== true)
        .map(({ path, capability }) => ({
          key: path,
          name: capability.name,
          count: capability.current,
          min: capability.effectiveMin,
          max: capability.effectiveMax,
          hasErrors: capability.isMandatoryUnmet === true
            || (capability.effectiveMax !== null && capability.current > capability.effectiveMax),
        }));

    return {
      totalCosts: costTotals[costLimitType] || 0,
      costLimit: roster?.costLimit,
      costTypeLabel: resolveCostLimitLabel(roster, system),
      isValid: !hasBlockingViolations(violations),
      blockingErrorCount: countBlockingViolations(violations),
      extraResources: extraResourceTotalsOf(costTotals, report?.description?.costTypes, costLimitType),
      requirements,
      violations,
    };
  }, [report, roster, system]);
}
