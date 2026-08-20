import React from 'react';
import {
  resolveEntry,
  findEntryInSystem,
  groupProfilesByType,
  UPGRADE_DETAILS_KEYWORDS
} from '../../roster';
import { isIndependentSubUnitSlot, slotOfSelection } from '../../evaluation/slotLookups';
import { useRuleUrl } from '../../hooks/useRuleUrl';
import { renderUpgradeDetails } from './upgradeDetails';
import RuleChipIcon from './RuleChipIcon';

/**
 * Die gewählten Unter-Auswahlen einer Einheit, die als Chip erscheinen: der
 * Teilbaum ohne die **eigenständigen Untereinheiten** — die tragen ihre eigene
 * Karte und ihre eigenen Chips. Ob eine Unter-Auswahl eine solche Untereinheit
 * ist, sagt der Bericht (`capability.isIndependentSubUnit`, Issue 0156); die
 * Katalog-Auflösung daneben bleibt reines Beiwerk für Detail-/Regeltexte.
 */
const getSelectedUpgrades = (sel, system, activeCatalogueId, slots) => {
  const list = [];
  const collect = (node) => {
    if (!node.selections) return;
    node.selections.forEach(subSel => {
      const entryId = subSel.entryLinkId || subSel.selectionEntryId;
      const entry = findEntryInSystem(system, entryId, activeCatalogueId);
      const resolved = resolveEntry(system, entry, activeCatalogueId);
      
      const isIndependent = isIndependentSubUnitSlot(slots?.capabilities, slots?.pathBySelectionId, subSel);
      
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

/** Die Profil-Einträge der Info-Projektion eines Slots (`kind: 'profile'`). */
const profileElementsOf = (slot) =>
  (slot?.infoElements ?? []).filter(element => element.kind === 'profile');

/**
 * Die Aufwertungen, die als Chip erscheinen: die gewählten Unter-Auswahlen ohne
 * die, die bereits in einer Profil-Tabelle der Karte stehen — es sei denn, sie
 * tragen einen eigenen Regeltext.
 *
 * Welche Profile die Karte tabelliert, sagt der **Bericht**
 * (`capability.infoElements`, Issue 0156): dieselbe Info-Projektion, aus der die
 * Karte ihre Tabellen zeichnet, statt eines zweiten Katalog-Durchlaufs. Ob eine
 * Aufwertung darin steht, entscheidet die Id ihres Profil-Eintrags — ersatzweise
 * (für Profile, die unter einem anderen Namen tabelliert sind) der Name.
 */
const getVisibleUpgrades = (sel, system, activeCatalogueId, slots) => {
  const slotOf = (selectionId) =>
    slotOfSelection(slots?.capabilities, slots?.pathBySelectionId, { id: selectionId });
  // Der Slot dieser Einheit: direkt gereicht (`capability`) oder über das
  // Lookup-Paar aufgelöst — dieselbe Doppelung, die auch die Karte kennt.
  const unitSlot = slots?.capability ?? slotOf(sel?.id);
  const tableProfiles = groupProfilesByType(profileElementsOf(unitSlot))
    .filter(g => !g.isModel).flatMap(g => g.profiles);
  const tableProfileIds = new Set(tableProfiles.map(p => p.id).filter(Boolean));

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

  return getSelectedUpgrades(sel, system, activeCatalogueId, slots).filter(upgrade => {
    const res = upgrade.resolved;
    if (isEmptyWrapper(res)) return false;
    const name = upgrade.name || res?.name;
    const inTable = profileElementsOf(slotOf(upgrade.id)).some(p => tableProfileIds.has(p.id)) ||
                    (name && tableProfiles.some(p => isNameMatch(name, p.name)));
    if (!inTable) return true;
    return hasLore(res);
  });
};

const getUpgradeDescription = (res, system) => {
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
  capability = null,
  capabilities = null,
  pathBySelectionId = null,
  handleMouseEnter,
  handleMouseMove,
  handleMouseLeave,
  onClickDetails,
  onShowRule
}) {
  const resolveRuleUrl = useRuleUrl();
  const selectedUpgrades = getVisibleUpgrades(selection, system, activeCatalogueId,
    { capability, capabilities, pathBySelectionId });
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

/**
 * Regel-Chips einer Einheit (Issue 0121, Task 7): die Regeln kommen aus der
 * Info-Projektion des Fähigkeitsdatensatzes ihres Slots
 * (`capability.infoElements`, Einträge `{ kind: 'rule', name, text }`) — samt
 * der von belegten Unter-Auswahlen geerbten. Den Datensatz liefert entweder
 * `capability` direkt oder das Lookup-Paar `capabilities` +
 * `pathBySelectionId`, das die umgebenden Editor-Komponenten führen.
 *
 * Die Entdopplung gegen die Upgrade-Chips läuft über die **gewählten**
 * Unter-Auswahlen (Strukturhilfe `getSelectedUpgrades`) — eine Regel, die als
 * Upgrade-Chip erscheint, wird nicht doppelt gezeigt.
 */
export function UnitRulesChips({
  selection,
  system,
  activeCatalogueId,
  capability = null,
  capabilities = null,
  pathBySelectionId = null,
  handleMouseEnter,
  handleMouseMove,
  handleMouseLeave,
  onClickDetails,
  onShowRule
}) {
  const resolveRuleUrl = useRuleUrl();
  const slotCapability = capability
    ?? capabilities?.get(pathBySelectionId?.get(selection?.id));
  const rules = (slotCapability?.infoElements ?? []).filter(element => element.kind === 'rule');
  if (rules.length === 0) return null;

  const normalizeChipName = (n) => (n || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const upgradeChipNames = new Set(
    getSelectedUpgrades(selection, system, activeCatalogueId, { capabilities, pathBySelectionId })
      .map(u => normalizeChipName(u.name || u.resolved?.name))
      .filter(Boolean)
  );

  const visibleRules = rules.filter(rule => !upgradeChipNames.has(normalizeChipName(rule.name)));
  if (visibleRules.length === 0) return null;

  return (
    <div className="unit-header-rules">
      {visibleRules.map((rule, rIdx) => {
        const descText = rule.text || '';
        const details = (
          <div className="upgrade-details">
            <div>{rule.text}</div>
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
