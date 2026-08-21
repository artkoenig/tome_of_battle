import { useMemo, useState } from 'react';
import {
  resolveEntry,
  resolveCostLimitTypeId, resolveCostLimitLabel,
} from '../../../domain/roster';
import { classifyGroupItem } from './selectionBehavior.js';
import { upgradeDetailElementsOf } from './upgradeDetailElements.js';
import { useRosterCommands, useRosterReport } from '../rosterContexts';
import {
  optionDescriptionOf,
  resolveRowSelectionId,
  subSelectionCountOf,
} from './optionRowDerivations.js';
import { costBudgetTextsOf, hasExceededCostBudget } from './costBudgets.js';

/**
 * ViewModel einer Options-Gruppe (ADR-0038; ADR-0035/0036).
 *
 * `group` bleibt die reine **Struktur** der Gruppe (`{ id, name, items }` — die
 * Mitgliedschaft Option→Gruppe kommt aus dem geparsten System). Zustand,
 * Grenzen, Kosten, Namen und Beschreibung der Optionen kommen dagegen aus den
 * **Fähigkeitsdatensätzen** des Evaluator-Berichts, abgelesen an den Slots
 * direkt unter der Träger-Auswahl (`selectionPath`).
 *
 * Auch das **Wahlverhalten** kommt aus dem Bericht (Issue 0156): echte
 * Einzelwahl (`isSingleChoice`), Max-Hebbarkeit (`isMaxRaisable`, ADR-0029) und
 * Wiederholbarkeit innerhalb der Gruppe (`isRepeatableWithinGroup`). Die
 * Auflösung (`resolveEntry`) bleibt allein Beiwerk für Detailtexte.
 */

/**
 * @param {{ group: Object, selection: Object, selectionPath: string|null,
 *   hasSelectedDescendant?: boolean }} args
 * @returns {Object} Zeilen, Kopfzeilen-Texte und Aufklapp-Zustand der Gruppe
 */
export function useOptionGroup({ group, selection, selectionPath = null, hasSelectedDescendant = false }) {
  const { report, roster, system, activeCatalogue } = useRosterReport();
  const { subSelectionOperations } = useRosterCommands();
  const { slots } = report;
  const activeCatalogueId = activeCatalogue?.id ?? null;

  const model = useMemo(() => {
    const costTypeId = resolveCostLimitTypeId(roster, system);
    const costTypeLabel = resolveCostLimitLabel(roster, system);

    const countOf = (option, capability) => {
      const byOptionId = subSelectionCountOf(selection, option.id);
      if (byOptionId > 0) return byOptionId;
      return capability?.targetDefId ? subSelectionCountOf(selection, capability.targetDefId) : byOptionId;
    };

    // Zeilenmodell: je Struktur-Item der zugehörige Slot unter der Träger-Auswahl.
    // Ein Item ohne Slot oder mit verstecktem Slot erscheint nicht (ADR-0035).
    const found = (group.items || [])
      .map(item => {
        const capability = slots.findChildSlot(selectionPath, item.option.id);
        if (!capability || capability.isHidden) return null;
        return { item, capability, count: countOf(item.option, capability) };
      })
      .filter(Boolean);

    // Gruppen-Grenze **und** Wahlverhalten aus dem Gruppen-Anker des Berichts.
    const groupCapability = slots.findChildSlot(selectionPath, group.id);
    const effectiveGroupMax = groupCapability?.effectiveMax ?? Infinity;
    const isGroupMaxRaisable = groupCapability?.isMaxRaisable === true;
    const groupSingleChoice = groupCapability?.isSingleChoice === true;
    const isGroupCapReached = groupCapability?.isBlocked === true;

    const pointsOf = (capability) => capability.costs?.[costTypeId] ?? 0;
    const currentPoints = found.reduce((sum, row) => sum + pointsOf(row.capability) * row.count, 0);

    const selectedItemsSummary = found
      .filter(row => row.count > 0)
      .map(row => (row.count > 1 ? `${row.count}x ${row.capability.name}` : row.capability.name))
      .join(', ');

    // Gruppen-Fehler direkt aus dem Anker abgelesen: unerfüllte Pflicht,
    // überschrittene Stückzahl oder gerissenes Kosten-Budget.
    const hasGroupError = groupCapability !== undefined
      && (groupCapability.isMandatoryUnmet
        || (groupCapability.effectiveMax !== null && groupCapability.current > groupCapability.effectiveMax)
        || hasExceededCostBudget(groupCapability));

    // Die Kosten-Budgets der Gruppe kommen aus dem Bericht (`costLimits`) — „12 / 50
    // pts" statt der blossen Summe.
    const costBudgets = costBudgetTextsOf(groupCapability, system);
    const limitParts = [];
    if (costBudgets.length > 0) {
      limitParts.push(...costBudgets);
    } else if (currentPoints > 0) {
      limitParts.push(`${currentPoints} ${costTypeLabel}`);
    }
    if (effectiveGroupMax !== Infinity && effectiveGroupMax !== null) {
      // Mehrfachauswahl-Gruppen zeigen einen Live-Zähler „N / M"; eine echte
      // Einzelwahl (Radio) behält die schlichte „Max: N"-Anzeige.
      limitParts.push(
        groupSingleChoice
          ? `Max: ${effectiveGroupMax}`
          : `${groupCapability.current} / ${effectiveGroupMax}`
      );
    }
    const limitText = limitParts.length > 0 ? `(${limitParts.join(' | ')})` : '';

    const decreaseSelectedSiblings = (option) => {
      found.forEach(other => {
        if (other.item.option.id === option.id) return;
        if (other.capability.isRepeatableWithinGroup === true) return;
        if (other.count > 0) {
          subSelectionOperations.decreaseCount(other.item.ownerSelectionId || selection.id, other.item.option);
        }
      });
    };

    const rows = found
      .slice()
      // sortIndex stellt getaggte Optionen aufsteigend voran (Issue 0133); der
      // ungetaggte Rest bleibt in Katalogreihenfolge — ein stabiler Sortierlauf
      // ueber die schon so aufgebaute Liste erhaelt sie unveraendert.
      .sort((a, b) => {
        const aIdx = a.capability.sortIndex;
        const bIdx = b.capability.sortIndex;
        if (aIdx !== null && bIdx !== null) return aIdx - bIdx;
        if (aIdx !== null) return -1;
        if (bIdx !== null) return 1;
        return 0;
      })
      .map(({ item, capability, count }) => {
        const { option, ownerSelectionId } = item;
        // Where a chosen option nests: under its owning sub-selection when the collector
        // re-emitted it from an active selection, otherwise directly under the unit.
        const editTargetId = ownerSelectionId || selection.id;
        const rowSelectionId = resolveRowSelectionId(selection, ownerSelectionId, option, {
          id: capability.defId,
          targetId: capability.targetDefId,
        });

        const minLimit = capability.effectiveMin ?? 0;
        const hasMaxConstraint = capability.effectiveMax !== null && capability.effectiveMax !== undefined;
        const maxLimit = hasMaxConstraint ? capability.effectiveMax : Infinity;

        const resolved = resolveEntry(system, option, activeCatalogueId);
        const isCollective = resolved?.collective || option.collective || false;
        const isRepeatableByGroupModifier = capability.isRepeatableWithinGroup === true;
        const { isMandatory, isMandatoryMet, isRadio, isBinary } = classifyGroupItem({
          minLimit,
          maxLimit,
          hasMaxConstraint,
          isCollective,
          isRepeatableByGroupModifier,
          groupSingleChoice,
          isMandatoryUnmet: capability.isMandatoryUnmet === true,
        });

        // Gruppen-Klammer beim Hinzufügen: ein ausgeschöpfter Gruppen-Anker
        // sperrt weitere, noch nicht gewählte Optionen — außer beim
        // Radio-Tausch (Netto 0) und bei max-hebbaren Gruppen (ADR-0029).
        const wouldExceedGroupMax = !isGroupMaxRaisable
          && (effectiveGroupMax === 0 || (!isRadio && count === 0 && isGroupCapReached));
        const isSelectDisabled = capability.isBlocked === true || wouldExceedGroupMax;

        const isUnavailable = count === 0 && isSelectDisabled;
        const isObligationHeld = isMandatory && isMandatoryMet;
        const isClickable = !isObligationHeld && !isUnavailable;
        const canRemove = count > minLimit && !isObligationHeld;

        const increase = () => subSelectionOperations.increaseCount(editTargetId, option);
        const decrease = () => subSelectionOperations.decreaseCount(editTargetId, option);

        return {
          key: capability.defId,
          capability,
          resolved,
          name: capability.name,
          count,
          points: capability.costs?.[costTypeId] ?? 0,
          costTypeLabel,
          descText: optionDescriptionOf(capability),
          detailElements: upgradeDetailElementsOf(capability),
          isBinary,
          isRadio,
          radioName: `${selection.id}-${group.name}`,
          isClickable,
          isUnavailable,
          isObligationHeld,
          isSelectDisabled,
          canRemove,
          rowSelectionId,
          onRowClick: () => {
            if (!isClickable) return;
            if (isBinary) {
              if (count > 0) {
                if (canRemove) decrease();
              } else if (!isSelectDisabled) {
                if (isRadio) decreaseSelectedSiblings(option);
                increase();
              }
            } else if (!isSelectDisabled) {
              increase();
            }
          },
          onRadioClick: () => {
            if (count > 0) {
              if (canRemove) decrease();
            } else if (!isSelectDisabled) {
              decreaseSelectedSiblings(option);
              increase();
            }
          },
          onToggle: (checked) => {
            if (checked) {
              if (!isSelectDisabled) increase();
            } else if (canRemove) {
              decrease();
            }
          },
          onIncrease: increase,
          onDecrease: decrease,
        };
      });

    return {
      rows,
      system,
      limitText,
      selectedItemsSummary,
      hasGroupError,
      holdsSelection: found.some(row => row.count > 0),
    };
  }, [
    group, selection, selectionPath, roster, system, activeCatalogueId,
    slots, subSelectionOperations,
  ]);

  // Start expanded when the group already holds a selection, so choices made
  // aren't hidden behind a collapsed header — a selection inside a group this one
  // holds counts just the same.
  const [isExpanded, setIsExpanded] = useState(() => hasSelectedDescendant || model.holdsSelection);

  return {
    ...model,
    isExpanded,
    toggleExpanded: () => setIsExpanded(prev => !prev),
  };
}
