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

/** Alle Mitglieder (Einträge und Links) einer Definition oder Gruppe in einer Liste. */
function memberDefs(defOrGroup) {
  return [...(defOrGroup.selectionEntries || []), ...(defOrGroup.entryLinks || [])];
}

/**
 * Bevölkert jedes Mitglied, das ein eigenes `min > 0` trägt, mit genau seinem `min`.
 * Gibt die Anzahl so bevölkerter Mitglieder zurück (0, falls keines pflichtig ist).
 */
function populateMandatoryMembers({ system, resolveEntry, parentSelection, members }) {
  let populatedCount = 0;
  members.forEach(member => {
    const minValue = getMinConstraintValue(member);
    if (minValue > 0) {
      addMandatoryChild({ system, resolveEntry, parentSelection, childDef: member, count: minValue });
      populatedCount += 1;
    }
  });
  return populatedCount;
}

/** Die konfigurierte Default-Option einer Gruppe (oder null, wenn keine gesetzt/auffindbar ist). */
function findGroupDefaultOption(group) {
  if (!group.defaultSelectionEntryId) return null;
  return memberDefs(group).find(member => member.id === group.defaultSelectionEntryId) || null;
}

/**
 * Bevölkert die Pflicht-Kinder (`min > 0`) einer aufgelösten Definition rekursiv.
 * Direkte Pflicht-Einträge/-Links werden je mit ihrem eigenen `min` angelegt.
 *
 * Für eine Pflichtgruppe (`min > 0`) gibt es zwei Muster:
 * - **Itemisiert („nimm all diese")**: die Mitglieder tragen eigene `min`-Constraints;
 *   dann wird jedes solche Mitglied mit seinem eigenen `min` bevölkert — das Gruppen-`min`
 *   ergibt sich aus ihrer Summe, nicht aus dem Vervielfachen einer einzelnen Option.
 * - **Wähle-eine („aus einem Topf")**: kein Mitglied ist selbst pflichtig; dann wird das
 *   Gruppen-`min` aus der Default- bzw. Erst-Option gefüllt.
 *
 * Optionale (min = 0) Kinder bleiben ungewählt — genau das Verhalten des echten Aushebens.
 */
function populateChildren({ system, resolveEntry, def, parentSelection }) {
  populateMandatoryMembers({ system, resolveEntry, parentSelection, members: memberDefs(def) });

  def.selectionEntryGroups?.forEach(group => {
    const minValue = getMinConstraintValue(group);
    const members = memberDefs(group);
    if (minValue <= 0 || members.length === 0) return;

    const itemizedCount = populateMandatoryMembers({ system, resolveEntry, parentSelection, members });
    if (itemizedCount > 0) return;

    const chosenOption = findGroupDefaultOption(group) || members[0];
    addMandatoryChild({ system, resolveEntry, parentSelection, childDef: chosenOption, count: minValue });
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
