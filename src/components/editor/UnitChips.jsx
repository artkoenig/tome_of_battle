import React from 'react';
import { Sparkles, Info, BookOpen } from 'lucide-react';
import { 
  resolveEntry, 
  findEntryInSystem, 
  collectUnitProfilesAndRules 
} from '../../solver/validator';
import { UPGRADE_DETAILS_KEYWORDS } from '../../solver/constants';
import { groupProfilesByType } from '../../solver/rulesEvaluator';
import { getRuleUrl } from '../../data/rulesLookup';

export const getSelectedUpgrades = (sel, system, activeCatalogueId) => {
  const list = [];
  const collect = (node) => {
    if (!node.selections) return;
    node.selections.forEach(subSel => {
      const entryId = subSel.entryLinkId || subSel.selectionEntryId;
      const entry = findEntryInSystem(system, entryId, activeCatalogueId);
      const resolved = resolveEntry(system, entry, activeCatalogueId);
      
      const hasEntryChildren = (entryNode) => {
        if (!entryNode) return false;
        return (entryNode.selectionEntries && entryNode.selectionEntries.length > 0) ||
               (entryNode.entryLinks && entryNode.entryLinks.length > 0) ||
               (entryNode.selectionEntryGroups && entryNode.selectionEntryGroups.length > 0);
      };
      const isIndependent = resolved && (resolved.type === 'unit' || resolved.type === 'model') && (resolved.collective === false || resolved.collective === 'false') && hasEntryChildren(resolved);
      
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

export const renderUpgradeDetails = (res, system) => {
  if (!res) return null;
  const elements = [];

  const isNameSimilar = (nameA, nameB) => {
    if (!nameA || !nameB) return false;
    const cleanA = nameA.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanB = nameB.toLowerCase().replace(/[^a-z0-9]/g, '');
    return cleanA === cleanB || 
           cleanA.includes(cleanB) || 
           cleanB.includes(cleanA) ||
           (cleanA.includes('waaagh') && cleanB.includes('waaagh')) ||
           cleanA.slice(-10) === cleanB.slice(-10);
  };

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

  // 1. Beschreibung (Rules / Lore)
  if (rules.length > 0) {
    rules.forEach((r, idx) => {
      if (r.description) {
        const label = isNameSimilar(r.name, res.name)
          ? 'Beschreibung'
          : `Beschreibung (${r.name})`;

        elements.push(
          <div key={`rule-${idx}`} style={{ marginTop: '4px' }}>
            <span className="text-gold" style={{ fontWeight: 600 }}>{label}: </span>
            {r.description}
            {r.publicationRef && (
              <span className="publication-ref">
                {r.publicationRef}
              </span>
            )}
          </div>
        );
      }
    });
  }

  // 2. Sonderregeln & Profilwerte (from Profiles)
  if (res.profiles && res.profiles.length > 0) {
    const profileElements = [];
    res.profiles.forEach((p, idx) => {
      const typeLower = p.profileTypeName?.toLowerCase() || '';
      if (UPGRADE_DETAILS_KEYWORDS.some(k => typeLower.includes(k))) {
        // Find "Special Rules" or "Sonderregeln" characteristic
        const specialRulesChar = p.characteristics?.find(c => {
          const nameLower = (c.name || '').toLowerCase().trim();
          return nameLower === 'special rules' || nameLower === 'special-rules' || nameLower === 'sonderregeln';
        });

        const otherChars = p.characteristics?.filter(c => {
          const nameLower = (c.name || '').toLowerCase().trim();
          return nameLower !== 'special rules' && nameLower !== 'special-rules' && nameLower !== 'sonderregeln';
        }) || [];

        // If there is special rules text, show it under "Sonderregeln:" label
        if (specialRulesChar && specialRulesChar.value && specialRulesChar.value.trim()) {
          profileElements.push(
            <div key={`special-rules-${idx}`} style={{ marginTop: '4px' }}>
              <span className="text-gold" style={{ fontWeight: 600 }}>Sonderregeln: </span>
              {specialRulesChar.value.trim()}
              {p.publicationRef && !res.rules?.some(r => r.publicationRef === p.publicationRef) && (
                <span className="publication-ref">
                  {p.publicationRef}
                </span>
              )}
            </div>
          );
        }

        // If there are other non-empty characteristics, show them under "Profil:" label
        const nonBigEmptyChars = otherChars.filter(c => c.value && c.value.trim() && c.value.trim() !== '-');
        if (nonBigEmptyChars.length > 0) {
          const stats = nonBigEmptyChars.map(c => `${c.name}: ${c.value}`).join(', ');
          const label = isNameSimilar(p.name, res.name)
            ? 'Profil'
            : `Profil (${p.name})`;

          profileElements.push(
            <div key={`profile-${idx}`} style={{ marginTop: '4px' }}>
              <span className="text-gold" style={{ fontWeight: 600 }}>{label}: </span>
              {stats}
              {p.publicationRef && !res.rules?.some(r => r.publicationRef === p.publicationRef) && (
                <span className="publication-ref">
                  {p.publicationRef}
                </span>
              )}
            </div>
          );
        }
      }
    });
    elements.push(...profileElements);
  }

  // 3. Quelle
  if (res.publicationRef) {
    const hasRuleOrProfileRefs = (res.rules && res.rules.some(r => r.publicationRef)) || (res.profiles && res.profiles.some(p => p.publicationRef));
    if (!hasRuleOrProfileRefs) {
      elements.push(
        <div key="source" style={{ marginTop: '6px' }}>
          <span className="text-gold" style={{ fontWeight: 600 }}>Quelle: </span>
          <span className="publication-ref">
            {res.publicationRef}
          </span>
        </div>
      );
    }
  }

  return (
    <div style={{ textAlign: 'left', lineHeight: '1.4' }}>
      {elements.length > 0 ? elements : <span className="text-dim">Keine Beschreibung vorhanden.</span>}
    </div>
  );
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
  onShowRule,
  showDebugIds = false
}) {
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
            onMouseEnter={(e) => descText && handleMouseEnter(upgrade.resolved?.name || upgrade.name, details, e)}
            onMouseMove={descText && handleMouseMove ? handleMouseMove : null}
            onMouseLeave={descText ? handleMouseLeave : null}
            onClick={(e) => {
              e.stopPropagation();
              const chipName = upgrade.resolved?.name || upgrade.name;
              if (onShowRule && getRuleUrl(chipName)) {
                onShowRule(chipName);
              } else if (descText && onClickDetails) {
                onClickDetails(chipName, details);
              }
            }}
          >
            {upgrade.number > 1 ? `${upgrade.number}x ` : ''}{upgrade.name}
            {getRuleUrl(upgrade.resolved?.name || upgrade.name) && (
              <BookOpen size={10} className="rule-link-icon" />
            )}
            {descText && (
              <Info size={10} className="upgrade-info-icon" />
            )}
            {showDebugIds && upgrade.resolved?.id && (
              <span className="debug-id-badge clickable" style={{ marginLeft: '4px' }}>def:{upgrade.resolved.id}</span>
            )}
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
  onShowRule,
  showDebugIds = false
}) {
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
            onMouseEnter={(e) => descText && handleMouseEnter(rule.name, details, e)}
            onMouseMove={descText && handleMouseMove ? handleMouseMove : null}
            onMouseLeave={descText ? handleMouseLeave : null}
            onClick={(e) => {
              e.stopPropagation();
              if (onShowRule && getRuleUrl(rule.name)) {
                onShowRule(rule.name);
              } else if (descText && onClickDetails) {
                onClickDetails(rule.name, details);
              }
            }}
          >
            {rule.name}
            {getRuleUrl(rule.name) && (
              <BookOpen size={10} className="rule-link-icon" />
            )}
            {descText && (
              <Sparkles size={10} className="rule-info-icon" />
            )}
            {showDebugIds && rule.id && (
              <span className="debug-id-badge clickable" style={{ marginLeft: '4px' }}>{rule.id}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}
