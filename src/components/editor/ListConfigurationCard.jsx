import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { buildConfigurationRadioGroups } from '../../solver/listConfigurationView';

// Rendered as its own radio choice per main entry: the roster carries no
// sub-selection for it, so it exists only in the UI as "clear this switch".
const NONE_OPTION_LABEL = 'Keine';

function ConfigurationOptionRow({ label, selected, onSelect }) {
  return (
    <div
      className={`sub-selection-row list-config-option-row clickable ${selected ? 'is-selected' : ''}`}
      onClick={onSelect}
    >
      <div>
        <span style={{ fontWeight: selected ? 600 : 400 }}>{label}</span>
      </div>
      <div className="sub-selection-controls">
        <input
          type="radio"
          aria-label={label}
          checked={selected}
          readOnly
          tabIndex={-1}
          style={{ pointerEvents: 'none' }}
        />
      </div>
    </div>
  );
}

/**
 * Renders a whole category of list configurations as a single collapsible card
 * (see Child-Issue 02, main-issue 35). Collapsed, it shows the currently chosen
 * option of each main entry as an info-accented badge; expanded, it lists every
 * option of every main entry as a flat set of radio rows (each group led by a
 * „Keine" row), without repeating the main entries' names as sub-headings.
 * Selecting a row writes straight to the roster — no cost slot, no copy/delete,
 * no configurator dialog. When `catalogueEntries` is supplied, main entries the
 * roster has no selection for yet render in a virtual „Keine" state built from
 * the catalogue definition, and picking one of their options creates the
 * roster selection on the spot (main-issue 35) — this is how the card can
 * appear before the player has chosen anything in the category at all.
 */
export default function ListConfigurationCard({
  categoryName,
  categoryId,
  selections,
  catalogueEntries = null,
  system,
  roster,
  force,
  activeCatalogue,
  updateSubSelection,
  addUnitWithSubSelection
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const catalogueId = force?.catalogueId || roster?.catalogueId || activeCatalogue?.id || null;
  const radioGroups = buildConfigurationRadioGroups({ system, selections, catalogueEntries, catalogueId });

  const selectedBadges = radioGroups
    .filter(group => group.selectedOption)
    .map(group => ({ id: group.mainEntrySelectionId, name: group.selectedOption.name }));

  // Radio semantics per main entry: picking an option clears whichever option
  // was active before (unless it is the very same one) and then sets the new one.
  // A virtual group (no roster selection for this main entry yet) has no node
  // updateSubSelection could target, so its first pick creates the main entry's
  // selection and the chosen option together in one step.
  const selectOption = (group, option) => {
    if (option.selected) return;
    if (group.isVirtual) {
      addUnitWithSubSelection(group.entryDef, categoryId, option.def);
      return;
    }
    if (group.selectedOption) {
      updateSubSelection(group.mainEntrySelectionId, group.selectedOption.def, 'decrement');
    }
    updateSubSelection(group.mainEntrySelectionId, option.def, 'increment');
  };

  const clearSelection = (group) => {
    if (!group.selectedOption) return;
    updateSubSelection(group.mainEntrySelectionId, group.selectedOption.def, 'decrement');
  };

  return (
    <div className="selection-node list-config-card">
      <div
        className="selection-node-header list-config-card-header"
        style={{ cursor: 'pointer' }}
        role="button"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded(prev => !prev)}
      >
        <div className="selection-node-title">
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span className="selection-node-name text-ui-title">{categoryName}</span>
        </div>
        {!isExpanded && selectedBadges.length > 0 && (
          <div className="list-config-badges">
            {selectedBadges.map(badge => (
              <span key={badge.id} className="text-micro list-config-badge">
                {badge.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="selection-node-body">
          <div className="sub-selection-group" style={{ borderLeft: 'none', paddingLeft: 0 }}>
            {radioGroups.map(group => (
              <React.Fragment key={group.mainEntrySelectionId}>
                <ConfigurationOptionRow
                  label={NONE_OPTION_LABEL}
                  selected={!group.selectedOption}
                  onSelect={() => clearSelection(group)}
                />
                {group.options.map(option => (
                  <ConfigurationOptionRow
                    key={option.optionId}
                    label={option.name}
                    selected={option.selected}
                    onSelect={() => selectOption(group, option)}
                  />
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
