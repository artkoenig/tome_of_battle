import { findEntryInSystem, resolveEntry } from './catalogResolver.js';
import { isIndependentSubUnit } from './subUnit.js';
import { EntryLinkKind } from '../../../shared/battlescribe/battlescribeSchema.generated.js';
import { selectionIdentityId } from '../../../shared/rostermodel/selectionIds.js';

/**
 * Die Modifikatoren einer Definition **flach**: die eigenen plus die aus jeder
 * `modifierGroup`, in jeder Tiefe. Rein strukturell — hier wird nichts
 * ausgewertet, sondern nur eingesammelt, was der Katalog an dieser Stelle
 * deklariert; ob ein Modifikator greift, entscheidet allein der Bericht
 * (ADR-0034). Die Struktur-Sammlung, die die Oberflaeche als `groupModifiers`
 * weiterreicht, bleibt damit ohne Auswertungsschicht.
 */
const modifiersOfGroup = (group, inheritedConditions, inheritedConditionGroups) => {
  const conditions = [...inheritedConditions, ...(group.conditions || [])];
  const conditionGroups = [...inheritedConditionGroups, ...(group.conditionGroups || [])];

  const own = (group.modifiers || []).map(mod => ({
    ...mod,
    conditions: [...conditions, ...(mod.conditions || [])],
    conditionGroups: [...conditionGroups, ...(mod.conditionGroups || [])],
    repeat: group.repeat && !mod.repeat ? group.repeat : mod.repeat,
  }));
  const nested = (group.modifierGroups || [])
    .flatMap(inner => modifiersOfGroup(inner, conditions, conditionGroups));
  return [...own, ...nested];
};

const flattenedModifiers = (source) => {
  if (!source) return [];
  const fromGroups = (source.modifierGroups || []).flatMap(group => modifiersOfGroup(group, [], []));
  return [...(source.modifiers || []), ...fromGroups];
};

/**
 * Collects the options a unit exposes in the editor.
 *
 * @param {Object} system
 * @param {string} activeCatalogueId
 * @param {Object} unitSelection - the roster selection whose options to collect.
 * @returns {Array<Object>} one item per offered option, carrying the option itself plus
 *   its group membership (`groupId`/`groupName`, that group's `groupConstraints`/
 *   `groupModifiers`), the chain of enclosing groups (`groupAncestors`, outermost first,
 *   each `{ id, name }` — the catalogue's group hierarchy) and the owning selection
 *   (`ownerSelectionId`).
 */
export const getUnitOptions = (system, activeCatalogueId, unitSelection) => {
  if (!activeCatalogueId) return [];
  const entryId = selectionIdentityId(unitSelection);
  const rawEntry = findEntryInSystem(system, entryId, activeCatalogueId);
  const resolved = resolveEntry(system, rawEntry, activeCatalogueId);

  if (!resolved) return [];

  // Recursive helper to find all nested entry IDs for a group
  const collectGroupItemIds = (gDef, groupItemIds = new Set(), visited = new Set()) => {
    if (!gDef || visited.has(gDef.id)) return groupItemIds;
    if (gDef.id) visited.add(gDef.id);

    gDef.selectionEntries?.forEach(item => {
      groupItemIds.add(item.id);
      const res = resolveEntry(system, item, activeCatalogueId);
      if (res) groupItemIds.add(res.id);
    });
    gDef.entryLinks?.forEach(link => {
      groupItemIds.add(link.id);
      groupItemIds.add(link.targetId);
      const res = resolveEntry(system, link, activeCatalogueId);
      if (res) {
        groupItemIds.add(res.id);
        // Only a linked *group* contributes further members to this group. A linked
        // option/upgrade (e.g. an upgrade-type mount) is itself a single member; its own
        // children are sub-options configured *under* it, not sibling choices of this
        // group — recursing into them would wrongly count them against the group's max.
        if (link.type === EntryLinkKind.SELECTION_ENTRY_GROUP) {
          collectGroupItemIds(res, groupItemIds, visited);
        }
      }
    });
    gDef.selectionEntryGroups?.forEach(subG => {
      collectGroupItemIds(subG, groupItemIds, visited);
    });
    return groupItemIds;
  };

  // Helper to prepare constraints with groupItemIds attached
  const prepareConstraints = (gDef) => {
    if (!gDef || !gDef.constraints) return [];
    const itemIds = collectGroupItemIds(gDef);
    return gDef.constraints.map(con => ({
      ...con,
      groupItemIds: itemIds
    }));
  };

  const optionsList = [];

  // Recursive options collector.
  //
  // The recursion carries a group context rather than loose positional arguments:
  //
  // - `groupName`/`groupId` name the group an option belongs to (its membership),
  //   `groupConstraints`/`groupModifiers` are that group's limits.
  // - `groupAncestors` is the chain of ENCLOSING groups, outermost first, each as
  //   `{ id, name }` — the catalogue's group hierarchy. A `selectionEntryGroup` whose
  //   children are only links to other groups collects no item of its own, so neither
  //   its id nor its name would otherwise ever reach a consumer; the chain is the one
  //   place that hierarchy — and the catalogue's name for it — survives.
  // - `ownerSelectionId` names the roster selection under which a chosen option must
  //   nest. It is null for options that belong directly to the unit, and the id of an
  //   active sub-selection for the options that selection re-emits (see
  //   collectFromActiveSelections) — e.g. the Barding of a chosen upgrade-type mount,
  //   which must attach under the mount's selection rather than as a sibling of it on
  //   the unit. It is threaded unchanged through the group/link recursion, since a
  //   display group inside an option is still nested under that same owning selection.
  /**
   * @type {{ groupName: string|null, groupId: string|null, groupConstraints: object[]|null,
   *   groupModifiers: object[]|null, groupAncestors: Array<{ id: string|null, name: string|null }>,
   *   ownerSelectionId: string|null }}
   */
  const ROOT_GROUP_CONTEXT = {
    groupName: null,
    groupId: null,
    groupConstraints: null,
    groupModifiers: null,
    groupAncestors: [],
    ownerSelectionId: null,
  };

  // The ancestor chain a group nested inside `context` inherits: the enclosing chain
  // plus the enclosing group itself. A group without an own id keeps the enclosing
  // group's key (see below) and therefore also its chain — nesting it under itself
  // would be a cycle.
  const nestedAncestors = (context, nestedGroupId) =>
    context.groupId && nestedGroupId !== context.groupId
      ? [...context.groupAncestors, { id: context.groupId, name: context.groupName }]
      : context.groupAncestors;

  const itemOf = (option, def, context) => ({
    option,
    parentDefId: def.id,
    groupName: context.groupName,
    groupId: context.groupId,
    groupConstraints: context.groupConstraints,
    groupModifiers: context.groupModifiers,
    groupAncestors: context.groupAncestors,
    ownerSelectionId: context.ownerSelectionId,
  });

  const collectOptions = (def, context = ROOT_GROUP_CONTEXT) => {
    // 1. Process selection entries
    def.selectionEntries?.forEach(child => {
      // A selectionEntry is always an option itself. We don't recurse into its children
      // until the user actually selects it (handled by collectFromActiveSelections).
      optionsList.push(itemOf(child, def, context));
    });

    // 2. Process entry links
    def.entryLinks?.forEach(child => {
      const resolvedChild = resolveEntry(system, child, activeCatalogueId);
      if (!resolvedChild) return;

      // If the entry link points to a group, we recurse into it to extract its items
      if (child.type === EntryLinkKind.SELECTION_ENTRY_GROUP) {
        const combinedConstraints = prepareConstraints(resolvedChild);
        // Resolve the link's own modifiers through the same seam so its
        // modifierGroup-gated modifiers are kept rather than silently dropped.
        const combinedModifiers = flattenedModifiers(resolvedChild).concat(flattenedModifiers(child));
        const nestedGroupId = resolvedChild.id || child.id;
        collectOptions(resolvedChild, {
          groupName: resolvedChild.name || child.name,
          groupId: nestedGroupId,
          groupConstraints: combinedConstraints,
          groupModifiers: combinedModifiers,
          groupAncestors: nestedAncestors(context, nestedGroupId),
          ownerSelectionId: context.ownerSelectionId,
        });
      } else {
        // Otherwise it points to an option (upgrade, profile, etc.), so it's a selectable item
        optionsList.push(itemOf(child, def, context));
      }
    });

    // 3. Process selection entry groups
    def.selectionEntryGroups?.forEach(group => {
      const combinedGroupConstraints = prepareConstraints(group);
      const nestedGroupId = group.id || context.groupId;
      collectOptions(group, {
        groupName: group.name || context.groupName,
        groupId: nestedGroupId,
        groupConstraints: combinedGroupConstraints,
        groupModifiers: flattenedModifiers(group),
        groupAncestors: nestedAncestors(context, nestedGroupId),
        ownerSelectionId: context.ownerSelectionId,
      });
    });
  };

  collectOptions(resolved);

  resolved.selectionEntries?.forEach(sub => {
    const subResolved = resolveEntry(system, sub, activeCatalogueId);
    if (subResolved && subResolved.type === 'model') {
      if (!isIndependentSubUnit(subResolved)) {
        collectOptions(subResolved, {
          ...ROOT_GROUP_CONTEXT,
          groupName: subResolved.name,
          groupId: subResolved.id,
        });
      }
    }
  });

  const collectFromActiveSelections = (currentSel) => {
    currentSel.selections?.forEach(subSel => {
      const subEntryId = selectionIdentityId(subSel);
      const subRawEntry = findEntryInSystem(system, subEntryId, activeCatalogueId);
      const subResolved = resolveEntry(system, subRawEntry, activeCatalogueId);
      if (subResolved) {
        if (!isIndependentSubUnit(subResolved)) {
          if (subResolved.selectionEntries?.length > 0 || subResolved.entryLinks?.length > 0 || subResolved.selectionEntryGroups?.length > 0) {
            // Tag the re-emitted options with this active selection as their owner, so the
            // editor nests a chosen sub-option under it rather than as a sibling on the unit.
            collectOptions(subResolved, {
              ...ROOT_GROUP_CONTEXT,
              groupName: subResolved.name,
              groupId: subResolved.id,
              ownerSelectionId: subSel.id,
            });
          }
          collectFromActiveSelections(subSel);
        }
      }
    });
  };
  collectFromActiveSelections(unitSelection);

  const seenOptionIds = new Set();
  const uniqueOptionsList = [];
  optionsList.forEach(item => {
    const res = resolveEntry(system, item.option, activeCatalogueId);
    if (res) {
      const canonicalId = res.targetId || res.id;
      if (seenOptionIds.has(canonicalId)) {
        return;
      }
      seenOptionIds.add(canonicalId);
    }
    uniqueOptionsList.push(item);
  });

  return uniqueOptionsList;
};
