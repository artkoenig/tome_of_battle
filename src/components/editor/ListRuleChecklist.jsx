import React, { useState } from 'react';
import { collectListRuleStates } from '../../solver/validator';
import SelectionConfigurator from './SelectionConfigurator';
import CategoryUnitAdder from './CategoryUnitAdder';
import BottomSheet from './BottomSheet';
import GothicTooltip from '../GothicTooltip';

/**
 * Ankreuzliste der „Special list rules" einer Kategorie. Ersetzt die frühere
 * Auto-Materialisierung samt Einheiten-Karten: jede Katalog-Listenregel wird
 * datengetrieben aufgezählt (ob im Roster präsent oder nicht) und als Ankreuzfeld
 * dargestellt — angehakt ⇔ präsent. Anhaken fügt die Regel-Selektion hinzu,
 * Abhaken entfernt sie. Behälter-Regeln zeigen ihre Unteroptionen direkt und
 * eingerückt unter ihrer Zeile (ohne Karte, ohne Überschrift, ohne Ausklapp-Knopf).
 * Eine nicht-binäre Regel (`max > 1`) fällt datengetrieben auf den Mengen-Adder
 * zurück (ADR 0003 — keine hartkodierten Regelnamen).
 */
export default function ListRuleChecklist({
  system,
  activeCatalogue,
  categoryId,
  roster,
  force,
  addUnit,
  removeUnit,
  updateSubSelection,
  costTypeLabel,
  costLimitType,
  selectionCounts,
  onShowRule,
}) {
  const [activeInfo, setActiveInfo] = useState(null);
  const [hoveredInfo, setHoveredInfo] = useState(null);

  const handleMouseEnter = (title, text, e) => {
    if (window.innerWidth <= 900) return;
    setHoveredInfo({ title, text, x: e.clientX + 15, y: e.clientY + 15 });
  };
  const handleMouseMove = (e) => {
    if (window.innerWidth <= 900) return;
    setHoveredInfo((prev) => (prev ? { ...prev, x: e.clientX + 15, y: e.clientY + 15 } : null));
  };
  const handleMouseLeave = () => setHoveredInfo(null);

  const states = collectListRuleStates(system, activeCatalogue, categoryId, { roster, force });
  if (states.length === 0) return null;

  const toggleRule = (state, nextChecked) => {
    if (nextChecked) {
      addUnit(state.entry, categoryId);
    } else if (state.selection) {
      removeUnit(state.selection.id);
    }
  };

  return (
    <div className="list-rule-checklist" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {states.map((state) => {
        // Datengetriebener Rückfall: eine nicht-binäre Regel (echte Mengen-Beschränkung)
        // wird über den Mengen-Adder statt ein Ankreuzfeld bedient.
        if (!state.isBinary) {
          return (
            <div key={state.resolvedId} className="list-rule-row list-rule-row-quantity">
              <span className="list-rule-name text-body" style={{ fontWeight: 600 }}>{state.name}</span>
              <CategoryUnitAdder
                categoryId={categoryId}
                categoryName={state.name}
                entries={[state.entry]}
                system={system}
                activeCatalogue={activeCatalogue}
                costTypeLabel={costTypeLabel}
                costLimitType={costLimitType}
                addUnit={addUnit}
                roster={roster}
                selectionCounts={selectionCounts}
              />
            </div>
          );
        }

        const showSubOptions = state.checked && state.isContainer && state.selection;

        return (
          <div key={state.resolvedId} className="list-rule-item">
            <label
              className="list-rule-row"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
            >
              <input
                type="checkbox"
                checked={state.checked}
                onChange={(e) => toggleRule(state, e.target.checked)}
              />
              <span className="list-rule-name text-body" style={{ fontWeight: 600 }}>{state.name}</span>
            </label>

            {showSubOptions && (
              <div
                className="list-rule-suboptions"
                style={{ paddingLeft: '28px', borderLeft: '2px solid rgba(226, 183, 66, 0.2)', marginLeft: '8px' }}
              >
                <SelectionConfigurator
                  selection={state.selection}
                  system={system}
                  roster={roster}
                  updateSubSelection={updateSubSelection}
                  costTypeLabel={costTypeLabel}
                  activeCatalogue={activeCatalogue}
                  handleMouseEnter={handleMouseEnter}
                  handleMouseMove={handleMouseMove}
                  handleMouseLeave={handleMouseLeave}
                  setActiveInfo={setActiveInfo}
                  onShowRule={onShowRule}
                  isListRule
                />
              </div>
            )}
          </div>
        );
      })}

      {hoveredInfo && (
        <GothicTooltip title={hoveredInfo.title} x={hoveredInfo.x} y={hoveredInfo.y}>
          {hoveredInfo.text}
        </GothicTooltip>
      )}

      <BottomSheet
        isOpen={!!activeInfo}
        onClose={() => setActiveInfo(null)}
        title={activeInfo?.title || ''}
        desktopMode="modal"
      >
        <div className="info-popup-body">{activeInfo?.text}</div>
      </BottomSheet>
    </div>
  );
}
