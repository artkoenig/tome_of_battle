import React from 'react';
import { useRuleUrl } from '../../viewmodels/useRuleUrl';
import { renderUpgradeDetails } from './upgradeDetails';
import RuleChipIcon from './RuleChipIcon';
import { useUnitChips } from '../../viewmodels/editor/useUnitChips';

/**
 * Die Chip-Reihen einer Einheit — nur noch JSX (ADR-0038).
 *
 * Welche Aufwertungen und welche Regeln erscheinen, entscheidet
 * `useUnitChips` am Bericht; die Komponenten hier kennen weder `capabilities`
 * noch `pathBySelectionId`.
 */
export function UnitUpgradesChips({
  selection,
  handleMouseEnter,
  handleMouseMove,
  handleMouseLeave,
  onClickDetails,
  onShowRule
}) {
  const resolveRuleUrl = useRuleUrl();
  const { upgrades } = useUnitChips({ selection });
  if (upgrades.length === 0) return null;

  return (
    <div className="unit-header-upgrades">
      {upgrades.map(upgrade => {
        const descText = upgrade.descText;
        const details = renderUpgradeDetails(upgrade.detailElements);

        return (
          <span
            key={upgrade.id}
            className={`text-micro upgrade-badge ${descText ? 'has-desc' : 'no-desc'}`}
            onClick={(e) => {
              e.stopPropagation();
              if (onShowRule && resolveRuleUrl(upgrade.chipName)) {
                onShowRule(upgrade.chipName);
              } else if (descText && onClickDetails) {
                onClickDetails(upgrade.chipName, details);
              }
            }}
          >
            {upgrade.number > 1 ? `${upgrade.number}x ` : ''}{upgrade.name}
            <RuleChipIcon
              name={upgrade.chipName}
              hasInfo={!!descText}
              onShowRule={onShowRule}
              onInfoEnter={(e) => handleMouseEnter(upgrade.chipName, details, e)}
              onInfoMove={handleMouseMove}
              onInfoLeave={handleMouseLeave}
            />
          </span>
        );
      })}
    </div>
  );
}

/**
 * Regel-Chips einer Einheit: die Regeln kommen aus der Info-Projektion des
 * Fähigkeitsdatensatzes ihres Slots (`capability.infoElements`, Einträge
 * `{ kind: 'rule', name, text }`) — samt der von belegten Unter-Auswahlen
 * geerbten. Eine Regel, die schon als Aufwertungs-Chip erscheint, wird nicht
 * doppelt gezeigt.
 */
export function UnitRulesChips({
  selection,
  handleMouseEnter,
  handleMouseMove,
  handleMouseLeave,
  onClickDetails,
  onShowRule
}) {
  const resolveRuleUrl = useRuleUrl();
  const { rules } = useUnitChips({ selection });
  if (rules.length === 0) return null;

  return (
    <div className="unit-header-rules">
      {rules.map(rule => {
        const descText = rule.text;
        const details = (
          <div className="upgrade-details">
            <div>{rule.text}</div>
          </div>
        );

        return (
          <span
            key={rule.key}
            className={`text-micro rule-badge ${descText ? 'has-desc' : 'no-desc'}`}
            onClick={(e) => {
              e.stopPropagation();
              if (onShowRule && resolveRuleUrl(rule.name)) {
                onShowRule(rule.name);
              } else if (descText && onClickDetails) {
                onClickDetails(rule.name, details);
              }
            }}
          >
            {rule.name}
            <RuleChipIcon
              name={rule.name}
              hasInfo={!!descText}
              onShowRule={onShowRule}
              onInfoEnter={(e) => handleMouseEnter(rule.name, details, e)}
              onInfoMove={handleMouseMove}
              onInfoLeave={handleMouseLeave}
            />
          </span>
        );
      })}
    </div>
  );
}
