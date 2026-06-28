import React, { useEffect, useState } from 'react';
import { Save, Play, Trash2, BookOpen } from 'lucide-react';
import { useRoster } from '../hooks/useRoster';
import { calculateRosterCosts } from '../solver/validator';

import CatalogBrowser from './editor/CatalogBrowser';
import RosterSidebar from './editor/RosterSidebar';
import SelectionConfigurator from './editor/SelectionConfigurator';

export default function RosterEditor({ system, roster: initialRoster, onBack, onPlay }) {
  const {
    roster,
    costs,
    validationErrors,
    selectedRosterSelection,
    setSelectedRosterSelection,
    selectedCatalogEntry,
    setSelectedCatalogEntry,
    addUnit,
    removeUnit,
    updateSubSelection,
    save
  } = useRoster(initialRoster, system);

  const [activeCatalogue, setActiveCatalogue] = useState(null);

  const costType = system?.costTypes?.find(ct => ct.id === roster?.costLimitType);
  const costTypeLabel = costType 
    ? (costType.name.toLowerCase() === 'pts' ? 'Pkt.' : costType.name)
    : 'Pkt.';

  // Resolve active catalogue definition
  useEffect(() => {
    if (system && roster) {
      const cat = system.catalogues.find(c => c.id === roster.catalogueId);
      setActiveCatalogue(cat);
    }
  }, [system, roster]);

  return (
    <div className="builder-layout">
      {/* 1. Sidebar - Catalog Browser (Left Column) */}
      <CatalogBrowser
        system={system}
        roster={roster}
        activeCatalogue={activeCatalogue}
        costTypeLabel={costTypeLabel}
        setSelectedCatalogEntry={setSelectedCatalogEntry}
        addUnit={addUnit}
        onBack={onBack}
      />

      {/* 2. Main Editing Roster Pane (Center Column) */}
      <div className="builder-main">
        <div className="roster-header-editor">
          <div>
            <h2 style={{ margin: 0, border: 'none', padding: 0 }}>{roster.name}</h2>
            <span className="text-dim" style={{ fontSize: '0.9rem' }}>
              Punktegrenze: {roster.costLimit} {costTypeLabel === 'Pkt.' ? 'Punkte' : costTypeLabel}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={save}>
              <Save size={18} /> Speichern
            </button>
            <button className="btn-primary" onClick={() => onPlay(roster)}>
              <Play size={18} /> In Spielmodus
            </button>
          </div>
        </div>

        {/* Selected Catalog Entry Stat Details */}
        {selectedCatalogEntry && (
          <div className="gothic-panel" style={{ borderStyle: 'solid', borderWidth: '1px', padding: '16px', marginBottom: '24px' }}>
            <div className="flex-between">
              <h3>{selectedCatalogEntry.name} - Statblock</h3>
              <button className="btn-sm" onClick={() => setSelectedCatalogEntry(null)}>Schließen</button>
            </div>
            
            {/* Render profiles parsed from BSData */}
            {selectedCatalogEntry.profiles?.map(prof => (
              <div key={prof.id} style={{ marginTop: '12px' }}>
                <span className="font-serif text-gold" style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                  {prof.name} ({prof.profileTypeName})
                </span>
                <div className="profile-table-container">
                  <table className="profile-table">
                    <thead>
                      <tr>
                        {prof.characteristics.map(c => (
                          <th key={c.name}>{c.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {prof.characteristics.map(c => (
                          <td key={c.name} className="font-sans">{c.value}</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {selectedCatalogEntry.rules?.map(rule => (
              <div key={rule.id} style={{ marginTop: '8px' }}>
                <strong className="text-gold">{rule.name}:</strong> <span style={{ fontSize: '0.9rem', color: 'var(--text-parchment)' }}>{rule.description}</span>
              </div>
            ))}
          </div>
        )}

        {/* Selected Selections on Roster */}
        {roster.forces.map(force => (
          <div key={force.id}>
            {force.selections?.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', border: '1px dashed var(--border-dark)', borderRadius: '4px' }}>
                <BookOpen size={40} className="text-dim" style={{ marginBottom: '12px' }} />
                <h3>Deine Armeeliste ist leer</h3>
                <p className="text-dim">Wähle Einheiten aus der linken Bibliothek aus, um sie deiner Streitmacht hinzuzufügen.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {force.selections?.map(selection => {
                  const isUnitEditing = selectedRosterSelection?.id === selection.id;
                  const unitCosts = calculateRosterCosts({ forces: [{ selections: [selection] }] }, system);
                  const displayPoints = unitCosts[roster.costLimitType] || 0;
                  const categoryName = system.categoryEntries?.find(c => c.id === selection.category)?.name || 'Einheit';
                  
                  const hasSelectionError = validationErrors.some(e => e.selectionId === selection.id);

                  return (
                    <div 
                      key={selection.id} 
                      className={`selection-node ${hasSelectionError ? 'has-error' : ''}`}
                    >
                      <div 
                        className="selection-node-header"
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedRosterSelection(isUnitEditing ? null : selection)}
                      >
                        <div className="selection-node-title">
                          <span className="selection-node-category">{categoryName}</span>
                          <span className="selection-node-name">{selection.name}</span>
                        </div>
                        <div className="selection-node-right">
                          <span className="selection-node-cost font-sans">
                            {displayPoints} {costTypeLabel}
                          </span>
                          <button 
                            className="btn-danger btn-sm" 
                            style={{ padding: '4px' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              removeUnit(selection.id);
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

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
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 3. Validation Summary Sidebar (Right Column) */}
      <RosterSidebar
        roster={roster}
        system={system}
        costs={costs}
        validationErrors={validationErrors}
        costTypeLabel={costTypeLabel}
      />
    </div>
  );
}
