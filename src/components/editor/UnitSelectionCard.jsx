import React from 'react';
import { Trash2, Copy, AlertTriangle } from 'lucide-react';
import { useDebugMode } from '../../hooks/DebugContext';
import SelectionConfigurator from './SelectionConfigurator';
import { 
  resolveEntry, 
  findEntryInSystem, 
  getSelectionTotalCost, 
  calculateRosterCosts,
  collectUnitProfilesAndRules
} from '../../solver/validator';
import { UPGRADE_DETAILS_KEYWORDS } from '../../solver/constants';

export default function UnitSelectionCard({
  selection,
  selectedRosterSelection,
  setSelectedRosterSelection,
  roster,
  system,
  validationErrors,
  costTypeLabel,
  removeUnit,
  copyUnit,
  updateSubSelection,
  activeCatalogue,
  setSelectedCatalogEntry
}) {
  const { showDebugIds } = useDebugMode();

  const renderMiniProfile = (sel) => {
    const { profiles } = collectUnitProfilesAndRules(system, sel, activeCatalogue?.id);
    if (!profiles || profiles.length === 0) return null;

    const unitProf = profiles.find(p => p.profileTypeName === 'Unit' || p.profileTypeName === 'Model');
    if (!unitProf) return null;

    return (
      <div 
        className="mini-profile clickable"
        onClick={(e) => {
          e.stopPropagation();
          const rawEntry = findEntryInSystem(system, sel.entryLinkId || sel.selectionEntryId, activeCatalogue?.id);
          const resolved = resolveEntry(system, rawEntry, activeCatalogue?.id);
          if (resolved) {
            setSelectedCatalogEntry(resolved);
          }
        }}
        title="Statblock anzeigen"
      >
        <table className="mini-profile-table">
          <thead>
            <tr>
              {unitProf.characteristics.map(c => (
                <th key={c.name}>{c.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {unitProf.characteristics.map(c => (
                <td key={c.name} className="font-body">{c.value}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  const renderUnitUpgrades = (sel) => {
    const collectUpgrades = (node) => {
      let upgrades = [];
      if (node.selections && node.selections.length > 0) {
        node.selections.forEach(sub => {
          const raw = findEntryInSystem(system, sub.entryLinkId || sub.selectionEntryId, activeCatalogue?.id);
          const res = resolveEntry(system, raw, activeCatalogue?.id);
          
          if (res) {
            const hasModelProfile = res.profiles?.some(p => p.profileTypeName === 'Model' || p.profileTypeName === 'Unit');
            if (!hasModelProfile) {
              const upgradePts = getSelectionTotalCost(sub, roster.costLimitType);
              const isDetailUpgrade = res.profiles?.some(p => 
                p.profileTypeName && UPGRADE_DETAILS_KEYWORDS.some(k => p.profileTypeName.toLowerCase().includes(k))
              );
              
              let ptsText = '';
              if (upgradePts > 0) {
                ptsText = ` (+${upgradePts} Pkt.)`;
              }

              let detailsText = '';
              if (isDetailUpgrade) {
                res.profiles.forEach(p => {
                  if (UPGRADE_DETAILS_KEYWORDS.some(k => p.profileTypeName.toLowerCase().includes(k))) {
                    const stats = p.characteristics.map(c => `${c.name}: ${c.value}`).join(', ');
                    detailsText = ` [${stats}]`;
                  }
                });
              }

              upgrades.push(`${sub.number > 1 ? sub.number + 'x ' : ''}${res.name}${detailsText}${ptsText}`);
            }
          }
          upgrades = upgrades.concat(collectUpgrades(sub));
        });
      }
      return upgrades;
    };

    const upgList = collectUpgrades(sel);
    if (upgList.length === 0) return null;

    return (
      <div className="unit-upgrades-summary font-body">
        <span style={{ fontWeight: 600, color: 'var(--text-gold)', marginRight: '4px' }}>Optionen:</span>
        {upgList.join(', ')}
      </div>
    );
  };

  const isUnitEditing = selectedRosterSelection?.id === selection.id;
  const unitCosts = calculateRosterCosts({ forces: [{ selections: [selection] }] }, system);
  const displayPoints = unitCosts[roster.costLimitType] || 0;
  const hasSelectionError = validationErrors.some(e => e.selectionId === selection.id);
  const selectionErrors = validationErrors.filter(e => e.selectionId === selection.id);

  return (
    <div className={`selection-node ${hasSelectionError ? 'has-error' : ''}`}>
      <div 
        className="selection-node-header"
        style={{ cursor: 'pointer', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' }}
        onClick={() => setSelectedRosterSelection(isUnitEditing ? null : selection)}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div className="selection-node-title">
            <span className="selection-node-name" style={{ fontSize: '1.05rem', fontWeight: 600 }}>
              {selection.name}
              {showDebugIds && (
                <span className="debug-id-badge clickable" title="Definition-ID">def:{selection.entryLinkId || selection.selectionEntryId}</span>
              )}
            </span>
          </div>
          <div className="selection-node-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="selection-node-cost font-body">
              {displayPoints} {costTypeLabel}
            </span>
            <button 
              type="button"
              className="btn-danger btn-sm" 
              style={{ padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm('Möchten Sie diese Einheit wirklich löschen?')) {
                  removeUnit(selection.id);
                }
              }}
              title="Löschen"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        {renderMiniProfile(selection)}
        {renderUnitUpgrades(selection)}
        <button 
          type="button"
          className="btn-primary btn-sm" 
          style={{
            position: 'absolute',
            bottom: '12px',
            right: '14px',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10
          }}
          onClick={(e) => {
            e.stopPropagation();
            copyUnit(selection.id);
          }}
          title="Kopieren"
        >
          <Copy size={14} />
        </button>
      </div>

      {selectionErrors.map((err, idx) => (
        <div key={idx} className="unit-error-alert text-danger font-body" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '6px 12px', background: 'rgba(166,28,28,0.04)', borderBottom: '1px solid rgba(166,28,28,0.2)' }}>
          <AlertTriangle size={14} />
          <span>{err.message}</span>
        </div>
      ))}

      {isUnitEditing && (
        <SelectionConfigurator
          selection={selection}
          system={system}
          roster={roster}
          updateSubSelection={updateSubSelection}
          costTypeLabel={costTypeLabel}
          activeCatalogue={activeCatalogue}
        />
      )}
    </div>
  );
}
