import '../types.js';

// Constraint-Typ, dessen positiver Wert ein Kind zur Pflichtauswahl macht (min > 0).
const MIN_CONSTRAINT_TYPE = 'min';

/** Wert des `min`-Constraints einer Definition (0, falls keiner vorhanden). */
function getMinConstraintValue(def) {
  return def.constraints?.find(constraint => constraint.type === MIN_CONSTRAINT_TYPE)?.value || 0;
}

/**
 * Fügt ein Pflicht-Kind (aufgelöst über dieselbe Fabrik) mit der geforderten Mindestanzahl
 * unter die Elternselektion. Ein nicht auflösbares Kind wird übersprungen.
 */
function addMandatoryChild({ system, resolveEntry, parentSelection, childDef, count }) {
  const childSelection = createSelectionFromDef({ system, resolveEntry, entry: childDef });
  if (childSelection) {
    childSelection.number = count;
    parentSelection.selections.push(childSelection);
  }
}

/**
 * Bevölkert die Pflicht-Kinder (`min > 0`) einer aufgelösten Definition rekursiv:
 * direkte Pflicht-Einträge/-Links sowie die Default- bzw. Erst-Wahl jeder Pflicht-Gruppe.
 * Optionale (min = 0) Kinder bleiben ungewählt — genau das Verhalten des echten Aushebens.
 */
function populateChildren({ system, resolveEntry, def, parentSelection }) {
  [...(def.selectionEntries || []), ...(def.entryLinks || [])].forEach(child => {
    const minValue = getMinConstraintValue(child);
    if (minValue > 0) {
      addMandatoryChild({ system, resolveEntry, parentSelection, childDef: child, count: minValue });
    }
  });

  def.selectionEntryGroups?.forEach(group => {
    const minValue = getMinConstraintValue(group);
    if (minValue > 0 && (group.selectionEntries?.length > 0 || group.entryLinks?.length > 0)) {
      let chosenOption = null;
      if (group.defaultSelectionEntryId) {
        chosenOption = group.selectionEntries?.find(entry => entry.id === group.defaultSelectionEntryId) ||
                       group.entryLinks?.find(link => link.id === group.defaultSelectionEntryId);
      }
      if (!chosenOption) {
        chosenOption = group.selectionEntries?.[0] || group.entryLinks?.[0];
      }
      addMandatoryChild({ system, resolveEntry, parentSelection, childDef: chosenOption, count: minValue });
    }
  });
}

/**
 * Reine, geteilte Selektions-Fabrik (SSOT, ADR-0022): erzeugt aus einem Katalog-Eintrag/-Link
 * einen vollständigen Selektions-Knoten und bevölkert **alle** Pflicht-Kinder (`min > 0`,
 * inkl. Default-Gruppenwahl) rekursiv — identisch zum echten Ausheben. Sowohl
 * `useRoster.addUnit` als auch die hypothetische Aushebe-Verfügbarkeit (`entryAvailability`)
 * nutzen sie, damit „im Dialog wählbar" und „nach dem Ausheben legal" dieselbe Struktur sehen.
 *
 * Abhängigkeiten werden injiziert (Dependency Injection, kein Closure über Hook-State):
 * @param {Object} args
 * @param {Object} args.system                     das Spielsystem.
 * @param {(system: Object, entry: Object) => Object} args.resolveEntry Auflöser für Links/Einträge.
 * @param {Object} args.entry                       der (unaufgelöste) Katalog-Eintrag/Link.
 * @param {string|null} [args.categoryId]           Kategorie der Top-Selektion (Kinder erben keine).
 * @returns {import('../types.js').Selection|null}  der Knoten, oder null bei unauflösbarem Eintrag.
 */
export function createSelectionFromDef({ system, resolveEntry, entry, categoryId = null }) {
  const resolved = resolveEntry(system, entry);
  if (!resolved) return null;

  const selection = {
    id: crypto.randomUUID(),
    entryLinkId: entry.targetId ? entry.id : null,
    selectionEntryId: entry.targetId ? null : entry.id,
    name: resolved.name,
    number: 1,
    category: categoryId,
    collective: resolved.collective || entry.collective || false,
    selections: []
  };

  populateChildren({ system, resolveEntry, def: resolved, parentSelection: selection });
  return selection;
}
