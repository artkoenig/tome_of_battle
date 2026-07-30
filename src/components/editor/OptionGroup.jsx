import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Minus } from 'lucide-react';
import {
  resolveEntry, getEffectiveModifiers, canGroupMaxBeRaisedAboveSingleChoice,
  isItemRepeatableWithinGroup, isGroupSingleChoice, classifyGroupItem,
  resolveCostLimitTypeId, resolveCostLimitLabel
} from '../../roster';
import { findChildSlot } from '../../evaluation/slotLookups';
import { renderUpgradeDetails } from './upgradeDetails';
import RuleChipIcon from './RuleChipIcon';
import { resolveRowSelectionId } from './optionNesting';
import { useTranslation } from '../../i18n/useTranslation';

/**
 * Options-Gruppe einer Auswahl (Issue 0121, Task 6; ADR-0035/0036).
 *
 * `group` bleibt die reine **Struktur** der Gruppe (`{ id, name, items }` —
 * die Mitgliedschaft Option→Gruppe kommt aus dem geparsten System). Zustand,
 * Grenzen, Kosten und Namen der Optionen kommen dagegen aus den
 * **Fähigkeitsdatensätzen** des Evaluator-Berichts (`capabilities`), abgelesen
 * an den Slots direkt unter der Träger-Auswahl (`selectionPath`):
 *
 * - Options-Slots per `defId`/`targetDefId`; versteckte Slots (`isHidden`)
 *   erscheinen nicht, gesperrte (`isBlocked`) sind nicht erhöhbar,
 * - eine offene Pflicht (`mandatoryPhantom`/`isMandatoryUnmet`) rendert als
 *   angehakte, gesperrte Checkbox,
 * - die Gruppen-Grenze liest der Gruppen-Anker (`defId === group.id`).
 *
 * Übergangsweise bleibt die statische „Gruppen-Max über 1 hebbar"-Erkennung
 * (ADR-0029, Rüstung+Schild-Fall) beim Helfer des Schreibmodells — sie liest
 * reine Katalogstruktur und zieht mit dem Schreibmodell in Task 8 um.
 */
export default function OptionGroupComponent({
  group,
  selection,
  selectionPath = null,
  capabilities,
  system,
  roster,
  getSubSelectionCount,
  subSelectionOperations,
  getOptionDescription,
  activeCatalogue,
  setActiveInfo,
  onHoverEnter,
  onHoverMove,
  onHoverLeave,
  onShowRule,
  // Renders any sub-options re-emitted by a selected row, indented beneath it. Returns
  // null when the row has no such children. Defaults to a no-op so a group without
  // nesting (or a test stub) renders unchanged.
  renderRowChildren = (_rowSelectionId) => null
}) {
  const { t } = useTranslation();

  const costTypeId = resolveCostLimitTypeId(roster, system);
  const costTypeLabel = resolveCostLimitLabel(roster, system);

  const countOf = (option, capability) => {
    const byOptionId = getSubSelectionCount(selection, option.id);
    if (byOptionId > 0) return byOptionId;
    return capability?.targetDefId ? getSubSelectionCount(selection, capability.targetDefId) : byOptionId;
  };

  // Zeilenmodell: je Struktur-Item der zugehörige Slot unter der Träger-Auswahl.
  // Ein Item ohne Slot oder mit verstecktem Slot erscheint nicht (ADR-0035:
  // Verstecktes wird im Bericht materialisiert und hier abgelesen).
  const rows = (group.items || [])
    .map(item => {
      const capability = findChildSlot(capabilities, selectionPath, item.option.id);
      if (!capability || capability.isHidden) return null;
      return { item, capability, count: countOf(item.option, capability) };
    })
    .filter(Boolean);

  // Start expanded when the group already holds a selection, so choices made
  // aren't hidden behind a collapsed header.
  const [isExpanded, setIsExpanded] = useState(() => rows.some(row => row.count > 0));

  // Gruppen-Grenze aus dem Gruppen-Anker des Berichts; die statische
  // „Max-hebbar"-Erkennung bleibt beim Helfer des Schreibmodells (siehe Kopfkommentar).
  const groupCapability = findChildSlot(capabilities, selectionPath, group.id);
  const effectiveGroupMax = groupCapability?.effectiveMax ?? Infinity;
  const isGroupMaxRaisable = canGroupMaxBeRaisedAboveSingleChoice(group);
  const groupSingleChoice = isGroupSingleChoice(
    effectiveGroupMax === null ? Infinity : effectiveGroupMax,
    isGroupMaxRaisable
  );
  const isGroupCapReached = groupCapability?.isBlocked === true;
  const groupModifiers = getEffectiveModifiers(group);

  const pointsOf = (capability) => capability.costs?.[costTypeId] ?? 0;
  const currentPoints = rows.reduce((sum, row) => sum + pointsOf(row.capability) * row.count, 0);

  const selectedItemsSummary = rows
    .filter(row => row.count > 0)
    .map(row => (row.count > 1 ? `${row.count}x ${row.capability.name}` : row.capability.name))
    .join(', ');

  // Gruppen-Fehler direkt aus dem Anker abgelesen: unerfüllte Pflicht oder
  // überschrittenes Höchstmaß.
  const hasGroupError = groupCapability !== undefined
    && (groupCapability.isMandatoryUnmet
      || (groupCapability.effectiveMax !== null && groupCapability.current > groupCapability.effectiveMax));

  const limitParts = [];
  if (currentPoints > 0) {
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

  return (
    <div className="option-group">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className={`option-group-header${hasGroupError ? ' option-group-header--error' : ''}`}
      >
        <div className="option-group-titles">
          <span className={hasGroupError ? "text-ui-title text-danger" : "text-ui-title text-gold"}>
            <span>{group.name}</span>
            {limitText && <span className="text-micro option-group-limit"> {limitText}</span>}
          </span>
          {selectedItemsSummary && (
            <span className="text-micro option-group-summary">
              {t('editor.optionGroup.selection', { summary: selectedItemsSummary })}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronDown size={16} className={hasGroupError ? "text-danger" : "text-gold"} />
        ) : (
          <ChevronRight size={16} className={hasGroupError ? "text-danger" : "text-gold"} />
        )}
      </div>

      {isExpanded && (
        <div className="option-group-items">
          {rows
            .slice()
            .sort((a, b) => pointsOf(b.capability) - pointsOf(a.capability)) // Descending
            .map(({ item, capability, count }) => {
            const { option, ownerSelectionId } = item;
            // Where a chosen option nests: under its owning sub-selection when the collector
            // re-emitted it from an active selection, otherwise directly under the unit.
            const editTargetId = ownerSelectionId || selection.id;
            // The roster selection this row stands for, so its own re-emitted sub-options can
            // nest beneath it (null while unselected).
            const rowSelectionId = resolveRowSelectionId(selection, ownerSelectionId, option, {
              id: capability.defId,
              targetId: capability.targetDefId,
            });

            const minLimit = capability.effectiveMin ?? 0;
            const hasMaxConstraint = capability.effectiveMax !== null && capability.effectiveMax !== undefined;
            const maxLimit = hasMaxConstraint ? capability.effectiveMax : Infinity;
            const points = pointsOf(capability);
            const optionName = capability.name;

            // Auflösung nur noch als Beiwerk für Detail-/Regeltexte — Zustand,
            // Grenzen und Namen kommen aus dem Bericht.
            const res = resolveEntry(system, option, activeCatalogue?.id);
            const isCollective = res?.collective || option.collective || false;
            const isRepeatableByGroupModifier = isItemRepeatableWithinGroup(option, res, group, groupModifiers);
            const { isMandatory, isRadio, isBinary } = classifyGroupItem({
              minLimit,
              maxLimit,
              hasMaxConstraint,
              isCollective,
              isRepeatableByGroupModifier,
              groupSingleChoice
            });
            const descText = getOptionDescription(res);

            // Gruppen-Klammer beim Hinzufügen: ein ausgeschöpfter Gruppen-Anker
            // sperrt weitere, noch nicht gewählte Optionen — außer beim
            // Radio-Tausch (Netto 0) und bei max-hebbaren Gruppen (ADR-0029).
            const wouldExceedGroupMax = !isGroupMaxRaisable
              && (effectiveGroupMax === 0 || (!isRadio && count === 0 && isGroupCapReached));
            const isSelectDisabled = capability.isBlocked === true || wouldExceedGroupMax;

            // Nicht wählbar, weil noch nicht ausgewählt und aktuell gesperrt.
            const isUnavailable = count === 0 && isSelectDisabled;
            const isClickable = !isMandatory && !isUnavailable;

            const decreaseSelectedSiblings = () => {
              rows.forEach(other => {
                if (other.item.option.id === option.id) return;
                if (isItemRepeatableWithinGroup(other.item.option, resolveEntry(system, other.item.option, activeCatalogue?.id), group, groupModifiers)) return;
                if (other.count > 0) {
                  subSelectionOperations.decreaseCount(other.item.ownerSelectionId || selection.id, other.item.option);
                }
              });
            };

            const handleRowClick = (e) => {
              if (e.target.closest('button') || e.target.closest('input')) {
                return;
              }
              if (isClickable) {
                if (isBinary) {
                  if (isRadio) {
                    if (count > 0) {
                      subSelectionOperations.decreaseCount(editTargetId, option);
                    } else {
                      decreaseSelectedSiblings();
                      subSelectionOperations.increaseCount(editTargetId, option);
                    }
                  } else {
                    if (count > 0) {
                      subSelectionOperations.decreaseCount(editTargetId, option);
                    } else {
                      subSelectionOperations.increaseCount(editTargetId, option);
                    }
                  }
                } else if (!isSelectDisabled) {
                  subSelectionOperations.increaseCount(editTargetId, option);
                }
              }
            };

            return (
              <React.Fragment key={capability.defId}>
              <div
                className={`sub-selection-row ${isClickable ? 'clickable' : 'disabled'}${isUnavailable ? ' sub-selection-row--unavailable' : ''}`}
                onClick={handleRowClick}
              >
                <div className="sub-selection-label sub-selection-label--indented">
                  <span className={`sub-selection-option-name${isUnavailable ? ' sub-selection-option-name--unavailable' : ''}`}>
                    {optionName}
                    <RuleChipIcon
                      name={optionName}
                      hasInfo={!!descText}
                      onShowRule={onShowRule}
                      onInfoClick={() => {
                        if (res && window.innerWidth <= 900) {
                          setActiveInfo({ title: optionName, text: renderUpgradeDetails(res, system) });
                        }
                      }}
                      onInfoEnter={(e) => { if (res) onHoverEnter(optionName, renderUpgradeDetails(res, system), e); }}
                      onInfoMove={onHoverMove}
                      onInfoLeave={onHoverLeave}
                    />
                  </span>
                </div>
                <div className="sub-selection-controls">
                  {points > 0 && <span className="text-gold text-label sub-selection-cost">+{points} {costTypeLabel}</span>}
                  {isBinary ? (
                    isRadio ? (
                      <input
                        type="radio"
                        name={`${selection.id}-${group.name}`}
                        checked={count > 0}
                        disabled={count === 0 && isSelectDisabled}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (count > 0) {
                            subSelectionOperations.decreaseCount(editTargetId, option);
                          } else if (!isSelectDisabled) {
                            decreaseSelectedSiblings();
                            subSelectionOperations.increaseCount(editTargetId, option);
                          }
                        }}
                        onChange={() => {}}
                      />
                    ) : (
                      <input
                        type="checkbox"
                        checked={count > 0 || isMandatory}
                        disabled={isMandatory || (count === 0 && isSelectDisabled)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          if (!isMandatory) {
                            if (e.target.checked) {
                              subSelectionOperations.increaseCount(editTargetId, option);
                            } else {
                              subSelectionOperations.decreaseCount(editTargetId, option);
                            }
                          }
                        }}
                      />
                    )
                  ) : (
                    <div className="quantity-control">
                      <button
                        className="qty-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          subSelectionOperations.decreaseCount(editTargetId, option);
                        }}
                        disabled={count === 0}
                      >
                        <Minus size={12} />
                      </button>
                      <span className="quantity-value font-body">{count}</span>
                      <button
                        className="qty-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          subSelectionOperations.increaseCount(editTargetId, option);
                        }}
                        disabled={isSelectDisabled}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {renderRowChildren(rowSelectionId)}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
