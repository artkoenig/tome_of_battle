import React, { useMemo, useState } from 'react';
import { Sparkles, Plus, Wand2 } from 'lucide-react';
import { resolveEntry, getOptionDisplayCost, computeRosterCounts, findEntryInSystem, isEntryScope, getUnitOptions, isUniqueOptionTakenElsewhere, isOptionRosterUnique, getEffectiveModifiers, getEffectiveConstraintLimit } from '../../solver/validator';
import { ConstraintKind } from '../../parser/schema/battlescribeSchema.generated.js';

const getSubSelectionCount = (selection, optionEntryId) => {
  const findCount = (list) => {
    let count = 0;
    for (const item of list) {
      if ((item.entryLinkId || item.selectionEntryId) === optionEntryId) {
        count += item.number || 1;
      }
      if (item.selections) {
        count += findCount(item.selections);
      }
    }
    return count;
  };
  return findCount(selection.selections || []);
};

export default function AutoFillSuggestions({
  roster,
  system,
  activeCatalogue,
  remainingPoints,
  subSelectionOperations,
  costTypeLabel
}) {
  const [showAll, setShowAll] = useState(false);

  // 1. Gather all possible single upgrades
  const availableActions = useMemo(() => {
    if (!roster || !system || !activeCatalogue || remainingPoints <= 0) return [];
    
    const actions = [];
    const { selectionCounts, categoryCounts } = computeRosterCounts(roster, system);
    
    const processSelection = (selection, forceId) => {
      const forceCategoryCounts = categoryCounts[forceId] || {};
      const displayCtx = {
        roster,
        system,
        selectionCounts,
        forceCategoryCounts,
        selection: null,
        parentSelection: selection,
        parentCatalogueId: activeCatalogue.id
      };

      const unitEntryId = selection.entryLinkId || selection.selectionEntryId;
      const unitRawEntry = findEntryInSystem(system, unitEntryId, activeCatalogue.id);
      const unitResolved = resolveEntry(system, unitRawEntry, activeCatalogue.id);

      const options = getUnitOptions(system, activeCatalogue.id, selection);
      
      options.forEach(item => {
        const { option, parentDefId, groupConstraints, groupModifiers } = item;
        const res = resolveEntry(system, option, activeCatalogue.id);
        if (!res) return;

        const count = getSubSelectionCount(selection, res.id);
        const basePoints = getOptionDisplayCost(system, option, roster.costLimitType, displayCtx);
        
        let parentCount = 1;
        if (parentDefId === unitResolved?.id || parentDefId === unitResolved?.targetId || parentDefId === unitEntryId) {
          parentCount = selection.number || 1;
        } else {
          const pSel = selection.selections?.find(s => (s.entryLinkId || s.selectionEntryId) === parentDefId);
          if (pSel) parentCount = pSel.number || 1;
        }

        const isCollective = res.collective || option.collective || false;
        const points = isCollective ? basePoints * parentCount : basePoints;

        if (points <= 0 || points > remainingPoints) return;

        // Check uniqueness limits
        const isRosterUnique = isOptionRosterUnique(res, system);
        const isTakenElsewhere = isRosterUnique && isUniqueOptionTakenElsewhere(res, system, activeCatalogue.id, selection, roster);
        if (isTakenElsewhere) return;

        let maxLimit = Infinity;
        const filteredOptionConstraints = res.constraints?.filter(con => {
          if (!con.scope || !isEntryScope(con.scope)) return true;
          return (unitResolved?.id === con.scope || unitResolved?.targetId === con.scope) ||
                 (unitResolved?.categoryLinks?.some(cl => cl.targetId === con.scope));
        }) || [];

        // Effektive (modifier-angepasste) Grenzen: Auto-Select darf nicht mehr Kopien
        // vorschlagen, als das effektive Options- bzw. Gruppen-Max zulässt.
        const maxConstraint = filteredOptionConstraints.find(c => c.type === ConstraintKind.MAX);
        maxLimit = getEffectiveConstraintLimit(maxConstraint, getEffectiveModifiers(res), displayCtx, Infinity);

        if (groupConstraints) {
           const maxGroup = groupConstraints.find(c => c.type === ConstraintKind.MAX);
           if (maxGroup) {
             const groupMaxLimit = getEffectiveConstraintLimit(maxGroup, groupModifiers || [], displayCtx, Infinity);
             if (groupMaxLimit < maxLimit) maxLimit = groupMaxLimit;
           }
        }

        if (isRosterUnique && maxLimit > 1) maxLimit = 1;

        const availableQuantity = maxLimit - count;
        
        if (availableQuantity > 0) {
          for (let i = 0; i < Math.min(availableQuantity, Math.floor(remainingPoints / points)); i++) {
            actions.push({
              id: `${selection.id}-${res.id}-${i}`,
              selectionId: selection.id,
              selectionName: selection.name,
              option: option,
              optionName: res.name,
              cost: points
            });
          }
        }
      });
    };

    roster.forces.forEach(force => {
      force.selections?.forEach(sel => {
        processSelection(sel, force.id);
      });
    });

    return actions;
  }, [roster, system, activeCatalogue, remainingPoints]);

  // 2. Find exact or near-exact combinations using DFS (0/1 Knapsack)
  const combinations = useMemo(() => {
    if (availableActions.length === 0) return [];

    const results = [];
    const target = remainingPoints;
    
    const sortedActions = [...availableActions].sort((a, b) => b.cost - a.cost);
    let countExact = 0;
    
    const dfs = (index, currentSum, currentCombo) => {
      if (countExact >= 5) return;
      
      if (currentSum === target) {
        results.push({
          sum: currentSum,
          actions: [...currentCombo]
        });
        countExact++;
        return;
      }
      
      if (currentSum > target || index >= sortedActions.length) {
        return;
      }

      const action = sortedActions[index];
      
      currentCombo.push(action);
      dfs(index + 1, currentSum + action.cost, currentCombo);
      currentCombo.pop();

      dfs(index + 1, currentSum, currentCombo);
    };

    dfs(0, 0, []);

    const uniqueCombos = [];
    const seenSigs = new Set();
    for (const combo of results) {
      const sig = combo.actions.map(a => `${a.selectionName}:${a.optionName}`).sort().join('|');
      if (!seenSigs.has(sig)) {
        seenSigs.add(sig);
        uniqueCombos.push(combo);
      }
    }

    return uniqueCombos.slice(0, 5);
  }, [availableActions, remainingPoints]);

  // 3. Deduplicate single actions for the generic list
  const uniqueSingleActions = useMemo(() => {
    const map = new Map();
    availableActions.forEach(a => {
      const key = `${a.selectionId}-${a.option.id}`;
      if (!map.has(key)) {
        map.set(key, a);
      }
    });
    return Array.from(map.values()).sort((a, b) => b.cost - a.cost);
  }, [availableActions]);


  // Ein Vorschlag ist stets „eine Option mehr" — die Punkte werden aufgefüllt,
  // nie abgebaut.
  const applySuggestedAction = (action) => {
    subSelectionOperations.increaseCount(action.selectionId, action.option);
  };

  const handleApplyCombo = (combo) => {
    combo.actions.forEach(applySuggestedAction);
  };

  if (availableActions.length === 0) return null;

  return (
    <div className="gothic-panel autofill-panel">
      <div className="autofill-header">
        <Wand2 className="text-gold" size={20} />
        <h3 className="font-serif text-gold no-margin">Auffüllen</h3>
        <span className="badge badge-muted push-end">{remainingPoints} {costTypeLabel} übrig</span>
      </div>

      <p className="text-body text-dim autofill-intro">
        Du hast noch <strong>{remainingPoints} {costTypeLabel}</strong> zur Verfügung. Hier sind einige Vorschläge:
      </p>

      {combinations.length > 0 && (
        <div className="autofill-section">
          <h4 className="text-subheading autofill-section-title">Perfekte Kombinationen</h4>
          <div className="autofill-combo-list">
            {combinations.map((combo, idx) => {
               const grouped = {};
               combo.actions.forEach(a => {
                 const k = `${a.selectionName}: ${a.optionName}`;
                 if (!grouped[k]) grouped[k] = { ...a, displayCount: 0 };
                 grouped[k].displayCount++;
               });

               return (
                 <div key={idx} className="sub-selection-row autofill-combo-row">
                   <div>
                     <div className="autofill-combo-sum">
                       Exakt {combo.sum} {costTypeLabel}
                     </div>
                     <ul className="autofill-combo-items">
                       {Object.values(grouped).map((g, i) => (
                         <li key={i}>
                           {g.displayCount > 1 ? `${g.displayCount}x ` : ''}
                           <strong>{g.optionName}</strong> <span className="text-dim">({g.selectionName})</span>
                         </li>
                       ))}
                     </ul>
                   </div>
                   <button
                     className="btn-primary autofill-apply-btn"
                     onClick={() => handleApplyCombo(combo)}
                   >
                     <Sparkles size={14} />
                     <span className="hide-on-mobile">Anwenden</span>
                   </button>
                 </div>
               );
            })}
          </div>
        </div>
      )}

      <div>
        <div className="autofill-upgrades-header">
          <h4 className="text-subheading no-margin">Mögliche Upgrades</h4>
          {uniqueSingleActions.length > 3 && (
            <button
              className="btn-secondary text-micro autofill-toggle-btn"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? 'Weniger anzeigen' : 'Alle anzeigen'}
            </button>
          )}
        </div>
        
        <div className="autofill-upgrade-list">
          {(showAll ? uniqueSingleActions : uniqueSingleActions.slice(0, 3)).map((action) => (
            <div key={`${action.selectionId}-${action.option.id}`} className="sub-selection-row autofill-upgrade-row">
              <div className="flex-col">
                <span className="text-strong">{action.optionName}</span>
                <span className="text-micro text-dim">für {action.selectionName}</span>
              </div>
              <div className="sub-selection-controls autofill-upgrade-controls">
                <span className="text-gold text-label">+{action.cost} {costTypeLabel}</span>
                <button 
                  className="btn-secondary square-btn"
                  onClick={() => applySuggestedAction(action)}
                  title="Hinzufügen"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
