import React from 'react';
import {
  resolveEntry,
  findEntryInSystem,
  collectUnitProfilesAndRules,
  isIndependentSubUnit
} from '../../solver/validator';
import { UPGRADE_DETAILS_KEYWORDS } from '../../solver/constants';
import { groupProfilesByType } from '../../solver/rulesEvaluator';
import { useRuleUrl } from '../../hooks/useRuleUrl';
import { renderUpgradeDetails } from './upgradeDetails';
import RuleChipIcon from './RuleChipIcon';

export const getSelectedUpgrades = (sel, system, activeCatalogueId) => {
  const list = [];
  const collect = (node) => {
    if (!node.selections) return;
    node.selections.forEach(subSel => {
      const entryId = subSel.entryLinkId || subSel.selectionEntryId;
      const entry = findEntryInSystem(system, entryId, activeCatalogueId);
      const resolved = resolveEntry(system, entry, activeCatalogueId);
      
      const isIndependent = isIndependentSubUnit(resolved);
      
      if (resolved && !isIndependent) {
        list.push({
          id: subSel.id,
          name: subSel.name,
          number: subSel.number || 1,
          resolved: resolved
        });
        collect(subSel);
      }
    });
  };
  collect(sel);
  return list;
};

export const getVisibleUpgrades = (sel, system, activeCatalogueId, roster) => {
  const { profiles } = collectUnitProfilesAndRules(system, sel, activeCatalogueId, roster);
  const tableProfiles = groupProfilesByType(profiles).filter(g => !g.isModel).flatMap(g => g.profiles);
  const tableSelectionIds = new Set(
    tableProfiles.map(p => p._sourceSelection?.id).filter(Boolean)
  );

  const isNameMatch = (selN, profN) => {
    if (!selN || !profN) return false;
    const s = selN.toLowerCase().trim();
    const p = profN.toLowerCase().trim();
    return s === p ||
           (s.endsWith('s') && s.slice(0, -1) === p) ||
           (p.endsWith('s') && p.slice(0, -1) === s) ||
           s.includes(p) ||
           p.includes(s);
  };

  const hasLore = (res) => {
    if (!res) return false;
    let rules = res.rules || [];
    if (rules.length === 0 && res.name) {
      const lowerName = res.name.toLowerCase().trim();
      let foundRule = system.sharedRules?.find(r => r.name?.toLowerCase().trim() === lowerName);
      if (!foundRule) {
        for (const cat of system.catalogues || []) {
          foundRule = cat.sharedRules?.find(r => r.name?.toLowerCase().trim() === lowerName);
          if (foundRule) break;
        }
      }
      if (foundRule) rules = [foundRule];
    }
    return rules.some(r => r.description && r.description.trim());
  };

  const hasOwnValue = (res) => {
    if (!res) return false;
    const hasCost = (res.costs || []).some(c => Math.abs(parseFloat(c.value) || 0) > 0);
    const hasProfile = (res.profiles || []).length > 0;
    return hasCost || hasProfile || hasLore(res);
  };

  const isEmptyWrapper = (res) => {
    if (!res || hasOwnValue(res)) return false;
    const childCount = (res.selectionEntries?.length || 0) +
                       (res.entryLinks?.length || 0) +
                       (res.selectionEntryGroups?.length || 0);
    return childCount > 0;
  };

  return getSelectedUpgrades(sel, system, activeCatalogueId).filter(upgrade => {
    const res = upgrade.resolved;
    if (isEmptyWrapper(res)) return false;
    const name = upgrade.name || res?.name;
    const inTable = tableSelectionIds.has(upgrade.id) ||
                    (name && tableProfiles.some(p => isNameMatch(name, p.name)));
    if (!inTable) return true;
    return hasLore(res);
  });
};

export const getUpgradeDescription = (res, system) => {
  if (!res) return '';
  const descriptions = [];

  let rules = res.rules || [];
  if (rules.length === 0 && res.name) {
    const lowerName = res.name.toLowerCase().trim();
    let foundRule = system.sharedRules?.find(r => r.name?.toLowerCase().trim() === lowerName);
    if (!foundRule) {
      for (const cat of system.catalogues || []) {
        foundRule = cat.sharedRules?.find(r => r.name?.toLowerCase().trim() === lowerName);
        if (foundRule) break;
      }
    }
    if (foundRule) {
      rules = [foundRule];
    }
  }

  if (rules.length > 0) {
    rules.forEach(r => {
      if (r.description) {
        const ref = r.publicationRef ? ` ${r.publicationRef}` : '';
        descriptions.push(`${r.description}${ref}`);
      }
    });
  }
  if (res.profiles && res.profiles.length > 0) {
    const upgradeProfiles = res.profiles.filter(p => {
      const typeLower = p.profileTypeName?.toLowerCase() || '';
      return UPGRADE_DETAILS_KEYWORDS.some(k => typeLower.includes(k));
    });
    upgradeProfiles.forEach(p => {
      p.characteristics?.forEach(c => {
        if (c.value) {
          const ref = p.publicationRef ? ` ${p.publicationRef}` : '';
          descriptions.push(`${c.name}: ${c.value}${ref}`);
        }
      });
    });
  }
  if (descriptions.length === 0 && res.publicationRef) {
    descriptions.push(res.publicationRef);
  }
  return descriptions.join(' | ');
};

export function UnitUpgradesChips({
  selection,
  system,
  activeCatalogueId,
  roster,
  handleMouseEnter,
  handleMouseMove,
  handleMouseLeave,
  onClickDetails,
  onShowRule
}) {
  const resolveRuleUrl = useRuleUrl();
  const selectedUpgrades = getVisibleUpgrades(selection, system, activeCatalogueId, roster);
  if (selectedUpgrades.length === 0) return null;

  return (
    <div className="unit-header-upgrades">
      {selectedUpgrades.map(upgrade => {
        const descText = getUpgradeDescription(upgrade.resolved, system);
        const details = renderUpgradeDetails(upgrade.resolved, system);
        
        return (
          <span 
            key={upgrade.id}
            className={`text-micro upgrade-badge ${descText ? 'has-desc' : 'no-desc'}`}
            onClick={(e) => {
              e.stopPropagation();
              const chipName = upgrade.resolved?.name || upgrade.name;
              if (onShowRule && resolveRuleUrl(chipName)) {
                onShowRule(chipName);
              } else if (descText && onClickDetails) {
                onClickDetails(chipName, details);
              }
            }}
          >
            {upgrade.number > 1 ? `${upgrade.number}x ` : ''}{upgrade.name}
            <RuleChipIcon
              name={upgrade.resolved?.name || upgrade.name}
              hasInfo={!!descText}
              onShowRule={onShowRule}
              onInfoEnter={(e) => handleMouseEnter(upgrade.resolved?.name || upgrade.name, details, e)}
              onInfoMove={handleMouseMove}
              onInfoLeave={handleMouseLeave}
            />
          </span>
        );
      })}
    </div>
  );
}

export function UnitRulesChips({
  selection,
  system,
  activeCatalogueId,
  roster,
  handleMouseEnter,
  handleMouseMove,
  handleMouseLeave,
  onClickDetails,
  onShowRule
}) {
  const resolveRuleUrl = useRuleUrl();
  const { rules } = collectUnitProfilesAndRules(system, selection, activeCatalogueId, roster);
  if (!rules || rules.length === 0) return null;

  const normalizeChipName = (n) => (n || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const upgradeChipNames = new Set(
    getVisibleUpgrades(selection, system, activeCatalogueId, roster)
      .map(u => normalizeChipName(u.name || u.resolved?.name))
      .filter(Boolean)
  );

  const visibleRules = rules.filter(rule => !upgradeChipNames.has(normalizeChipName(rule.name)));
  if (visibleRules.length === 0) return null;

  return (
    <div className="unit-header-rules">
      {visibleRules.map((rule, rIdx) => {
        const descText = rule.description || '';
        const details = (
          <div style={{ textAlign: 'left', lineHeight: '1.4' }}>
            <div>{rule.description}</div>
            {rule.publicationRef && (
              <div className="publication-ref" style={{ marginTop: '4px' }}>
                {rule.publicationRef}
              </div>
            )}
          </div>
        );

        return (
          <span 
            key={rule.id || rIdx}
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
