import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
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
 * eingerückt unter ihrer Zeile (ohne Karte, ohne Überschrift). Ein eigener
 * Pfeil-Umschalter klappt diese Unteroptionen ein bzw. aus — unabhängig vom
 * Ankreuzzustand (angehakt bleibt angehakt), anfänglich ausgeklappt.
 * Eine nicht-binäre Regel (`max > 1`) fällt datengetrieben auf den Mengen-Adder
 * zurück (ADR 0003 — keine hartkodierten Regelnamen).
 */
export default function ListRuleChecklist({
  system,
  activeCatalogue,
  categoryId,
  roster,
  states,
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
  // Eingeklappte Behälter, nach `resolvedId`. Fehlt ein Eintrag, gilt die Zeile
  // als ausgeklappt (Standard nach dem Anhaken), sodass Unteroptionen sofort
  // konfigurierbar sind, aber jederzeit ohne Abwählen einklappbar bleiben.
  const [collapsed, setCollapsed] = useState({});
  const toggleCollapsed = (resolvedId) =>
    setCollapsed((prev) => ({ ...prev, [resolvedId]: !prev[resolvedId] }));

  const handleMouseEnter = (title, text, e) => {
    if (window.innerWidth <= 900) return;
    setHoveredInfo({ title, text, x: e.clientX + 15, y: e.clientY + 15 });
  };
  const handleMouseMove = (e) => {
    if (window.innerWidth <= 900) return;
    setHoveredInfo((prev) => (prev ? { ...prev, x: e.clientX + 15, y: e.clientY + 15 } : null));
  };
  const handleMouseLeave = () => setHoveredInfo(null);

  if (!states || states.length === 0) return null;

  const toggleRule = (state, nextChecked) => {
    if (nextChecked) {
      addUnit(state.entry, categoryId);
    } else if (state.selection) {
      removeUnit(state.selection.id);
    }
  };

  return (
    <div className="list-rule-checklist">
      {states.map((state) => {
        // Datengetriebener Rückfall: eine nicht-binäre Regel (echte Mengen-Beschränkung)
        // wird über den Mengen-Adder statt ein Ankreuzfeld bedient.
        if (!state.isBinary) {
          return (
            <div key={state.resolvedId} className="list-rule-row">
              <span className="list-rule-chevron-slot" />
              <span className="list-rule-name text-body">{state.name}</span>
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

        const hasSubOptions = state.checked && state.isContainer && !!state.selection;
        const isExpanded = !collapsed[state.resolvedId];

        return (
          <div key={state.resolvedId} className="list-rule-item">
            <div className="list-rule-row">
              <span className="list-rule-chevron-slot">
                {hasSubOptions && (
                  <button
                    type="button"
                    className="list-rule-collapse"
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? 'Unteroptionen einklappen' : 'Unteroptionen ausklappen'}
                    onClick={() => toggleCollapsed(state.resolvedId)}
                  >
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </button>
                )}
              </span>
              <label className="list-rule-toggle">
                <span className="list-rule-name text-body">{state.name}</span>
                <input
                  type="checkbox"
                  checked={state.checked}
                  onChange={(e) => toggleRule(state, e.target.checked)}
                />
              </label>
            </div>

            {hasSubOptions && isExpanded && (
              <div className="list-rule-suboptions">
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
