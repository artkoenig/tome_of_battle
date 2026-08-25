import { resolveEntry } from '../../../contexts/armylist/model';
import { classifyStandaloneOption } from './selectionBehavior.js';
import { upgradeDetailElementsOf } from './upgradeDetailElements.js';
import { costBudgetTextsOf } from './costBudgets.js';
import { optionDescriptionOf, resolveRowSelectionId, subSelectionCountOf } from './optionRowDerivations.js';

/**
 * Das Zeilenmodell einer **gruppenlosen** Options-Zeile des Konfigurators — der
 * Abschnitt der Art `standalone`.
 *
 * Zustand, Grenzen, Kosten und Namen liest die Zeile am Slot des Berichts ab
 * (ADR-0035); die Auflösung des Katalog-Eintrags ist nur noch Beiwerk für die
 * Detailtexte. Die Handler schreiben über die Kommandos des Rosters, nie an der
 * Selektion vorbei.
 *
 * @param {Object} args
 * @param {Object} args.frameSelection der Rahmen, unter dem die Zeile hängt
 * @param {string} args.path Slot-Pfad der Zeile (zugleich ihr Schlüssel)
 * @param {Object} args.capability der Slot des Berichts
 * @param {Object} args.option die Options-Definition der Zeile
 * @param {Object} args.context `{ system, activeCatalogueId, costTypeId, costTypeLabel, subSelectionOperations }`
 * @returns {Object} der Abschnitt der Art `standalone`
 */
export function buildStandaloneSection({ frameSelection, path, capability, option, context }) {
  const { system, activeCatalogueId, costTypeId, costTypeLabel, subSelectionOperations } = context;

  const count = (() => {
    const byOptionId = subSelectionCountOf(frameSelection, option.id);
    if (byOptionId > 0) return byOptionId;
    return capability.targetDefId ? subSelectionCountOf(frameSelection, capability.targetDefId) : byOptionId;
  })();

  const minLimit = capability.effectiveMin ?? 0;
  const maxLimit = capability.effectiveMax ?? Infinity;
  const { isMandatory, isMandatoryMet, isBinary } = classifyStandaloneOption({
    minLimit, maxLimit, isMandatoryUnmet: capability.isMandatoryUnmet === true,
  });

  // Auflösung nur noch als Beiwerk (Detail-/Regeltexte) — Zustand, Grenzen,
  // Namen und Beschreibung kommen aus dem Bericht.
  const resolved = resolveEntry(system, option, activeCatalogueId);
  // Ob die Zeile eine eigenständige Untereinheit trägt, sagt der Bericht.
  const isSubUnitWithOwnOptions = capability.isIndependentSubUnit === true;
  const isSelectDisabled = capability.isBlocked === true;
  const editTargetId = frameSelection.id;
  const rowSelectionId = isSubUnitWithOwnOptions ? null : resolveRowSelectionId(
    frameSelection, null, option, { id: capability.defId, targetId: capability.targetDefId }
  );

  const isUnavailable = count === 0 && isSelectDisabled;
  // Nur eine EINGELÖSTE Pflicht ist genommen und gesperrt (Issue 0145).
  const isObligationHeld = isMandatory && isMandatoryMet;
  const isClickable = !isObligationHeld && !isUnavailable;
  // Was das effektive Minimum verlangt, kann nicht zurückgegeben werden.
  const canRemove = count > minLimit && !isObligationHeld;

  const increase = () => subSelectionOperations.increaseCount(editTargetId, option);
  const decrease = () => subSelectionOperations.decreaseCount(editTargetId, option);
  const add = () => subSelectionOperations.addInstance(editTargetId, option);

  return {
    kind: 'standalone',
    key: path,
    frameSelection,
    framePath: path,
    option,
    capability,
    sortIndex: capability.sortIndex,
    name: capability.name,
    count,
    points: capability.costs?.[costTypeId] ?? 0,
    costTypeLabel,
    costBudgets: costBudgetTextsOf(capability, system),
    descText: optionDescriptionOf(capability),
    detailElements: upgradeDetailElementsOf(capability),
    resolved,
    isSubUnitWithOwnOptions,
    isBinary,
    isObligationHeld,
    isClickable,
    isUnavailable,
    isSelectDisabled,
    canRemove,
    isAddDisabled: isSelectDisabled || count >= maxLimit,
    rowSelectionId,
    onRowClick: () => {
      if (!isClickable) return;
      if (isSubUnitWithOwnOptions) {
        if (count < maxLimit && !isSelectDisabled) add();
      } else if (isBinary) {
        if (count > 0) {
          if (canRemove) decrease();
        } else if (!isSelectDisabled) increase();
      } else if (count < maxLimit && !isSelectDisabled) {
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
    onAdd: add,
  };
}
