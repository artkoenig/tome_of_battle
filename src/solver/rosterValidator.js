import { findEntryInSystem, resolveEntry } from './catalogResolver.js';
import { getModifiedConstraintValue } from './modifierEvaluator.js';
import { calculateRosterCosts, computeRosterCounts, getSelectionTotalCost } from './rosterCounter.js';
import { findForceEntryById } from './forceEntries.js';
import { isCategoryLinkHidden } from './entryVisibility.js';
import { getInheritedCategoryMaxSource } from './systemQuirks.js';
import '../types.js';

/**
 * Validates a roster against a game system's rules and constraints.
 * @param {import('../types.js').Roster} roster
 * @param {Object} system
 * @returns {import('../types.js').ValidationError[]}
 */
export function validateRoster(roster, system) {
  const errors = [];
  if (!roster || !system) return errors;

  const counts = computeRosterCounts(roster, system);

  checkRosterCostLimit(roster, system, errors);

  roster.forces.forEach(force => {
    const forceDef = findForceEntryById(system, force.forceEntryId);
    if (!forceDef) return;

    checkForceCategoryLimits({ roster, system, force, forceDef, counts, errors });

    force.selections?.forEach(sel =>
      checkSelectionTree({ selection: sel, parentSelection: null, roster, system, force, counts, errors })
    );
  });

  return errors;
}

/** Punkte des Rosters gegen das eingestellte Limit prüfen. */
function checkRosterCostLimit(roster, system, errors) {
  const costs = calculateRosterCosts(roster, system);
  if (!roster.costLimit || !roster.costLimitType) return;

  const limit = roster.costLimit;
  const current = costs[roster.costLimitType] || 0;
  if (current > limit) {
    errors.push({
      type: 'roster-limit',
      message: `Punkteüberschreitung: Du hast ${current} von maximal ${limit} Punkten verwendet.`,
      severity: 'error'
    });
  }
}

/** Min/Max-Limits der Kategorie-Links eines Kontingents prüfen (pro Force, nicht armeeweit). */
function checkForceCategoryLimits({ roster, system, force, forceDef, counts, errors }) {
  const { selectionCounts, categoryCounts } = counts;

  forceDef.categoryLinks?.forEach(catLink => {
    const targetCatId = catLink.targetId;
    const forceCategoryCounts = categoryCounts[force.id] || {};

    if (isCategoryLinkHidden(catLink, system, roster, selectionCounts, forceCategoryCounts)) {
      return;
    }

    const catDef = system.categoryEntries?.find(ce => ce.id === targetCatId);
    const catName = catDef ? catDef.name : catLink.name;
    const count = forceCategoryCounts[targetCatId] || 0;

    const constraintsToValidate = [...(catLink.constraints || [])];

    // System-Quirk: Kategorie erbt einen fehlenden max-Constraint von einer anderen Kategorie
    const inheritFromCatId = getInheritedCategoryMaxSource(system, targetCatId);
    if (inheritFromCatId && !constraintsToValidate.some(c => c.type === 'max')) {
      const sourceCatLink = forceDef.categoryLinks?.find(cl => cl.targetId === inheritFromCatId);
      const sourceMaxCon = sourceCatLink?.constraints?.find(c => c.type === 'max');
      if (sourceMaxCon) {
        constraintsToValidate.push({
          ...sourceMaxCon,
          id: 'quirk-inherited-max',
          type: 'max',
          isFallback: true,
          modifiers: sourceCatLink.modifiers
        });
      }
    }

    constraintsToValidate.forEach(con => {
      const ctx = { roster, selectionCounts, forceCategoryCounts, force, system };
      const finalValue = getModifiedConstraintValue(con, con.isFallback ? con.modifiers : catLink.modifiers, ctx);
      if (finalValue < 0) return;

      if (con.type === 'min' && count < finalValue) {
        errors.push({
          type: 'category-min',
          forceId: force.id,
          categoryId: targetCatId,
          message: `Mindestens ${finalValue} Auswahlen für "${catName}" in ${forceDef.name} benötigt (aktuell: ${count}).`,
          severity: 'error'
        });
      }
      if (con.type === 'max' && count > finalValue) {
        errors.push({
          type: 'category-max',
          forceId: force.id,
          categoryId: targetCatId,
          message: `Maximal ${finalValue} Auswahlen für "${catName}" in ${forceDef.name} erlaubt (aktuell: ${count}).`,
          severity: 'error'
        });
      }
    });
  });
}

/** Eine Selection samt Kindern rekursiv gegen ihre Entry- und Gruppen-Constraints prüfen. */
function checkSelectionTree(args) {
  const { selection, roster, system, force } = args;

  const entryId = selection.entryLinkId || selection.selectionEntryId;
  const forceCatalogueId = force?.catalogueId || roster.catalogueId;
  const rawEntry = findEntryInSystem(system, entryId, forceCatalogueId);
  const entry = resolveEntry(system, rawEntry, forceCatalogueId);
  if (!entry) return;

  checkEntryConstraints({ ...args, entry, entryId, forceCatalogueId });
  checkGroupConstraints({ ...args, entry, forceCatalogueId });

  selection.selections?.forEach(child =>
    checkSelectionTree({ ...args, selection: child, parentSelection: selection })
  );
}

/** Individuelle Constraints des aufgelösten Eintrags prüfen (min/max/percent je Scope). */
function checkEntryConstraints({ selection, parentSelection, roster, system, force, counts, errors, entry, entryId, forceCatalogueId }) {
  if (!entry.constraints) return;

  const { selectionCounts, forceSelectionCounts, categoryCounts } = counts;
  const forceCategoryCounts = force ? (categoryCounts[force.id] || {}) : {};

  entry.constraints.forEach(con => {
    const ctx = {
      roster,
      selectionCounts,
      forceCategoryCounts: Object.values(categoryCounts).reduce((acc, c) => ({ ...acc, ...c }), {}),
      selection,
      parentSelection,
      force,
      system,
      parentCatalogueId: forceCatalogueId
    };
    const finalValue = getModifiedConstraintValue(con, entry.modifiers, ctx);
    if (finalValue < 0) return;

    // Check scope applicability for specific category/entry scoped constraints
    if (con.scope !== 'parent' && con.scope !== 'force' && con.scope !== 'roster') {
      const belongsToScope = (selection.selectionEntryId === con.scope || selection.entryLinkId === con.scope) ||
                            (entry.categoryLinks?.some(cl => cl.targetId === con.scope)) ||
                            (parentSelection && (parentSelection.selectionEntryId === con.scope || parentSelection.entryLinkId === con.scope));
      if (!belongsToScope) return;
    }

    // Determine current count in scope
    let count = selection.number || 1;

    if (con.scope !== 'parent' && con.scope !== 'force' && con.scope !== 'roster') {
      count = selectionCounts[con.scope] || (forceCategoryCounts ? forceCategoryCounts[con.scope] : 0) || count;
    } else if (con.scope === 'parent') {
      // Immer über aufgelöste Target-IDs vergleichen, nicht über entryLinkIds —
      // verschiedene Links können auf dasselbe Target zeigen.
      const matchesEntryTarget = (s, catalogueId) => {
        const subId = s.entryLinkId || s.selectionEntryId;
        if (subId === entryId) return true;
        if (entry.targetId) {
          const sDef = findEntryInSystem(system, subId, catalogueId);
          const sRes = resolveEntry(system, sDef, catalogueId);
          return subId === entry.targetId || (sRes && sRes.targetId === entry.targetId);
        }
        return false;
      };

      if (parentSelection) {
        const childMatch = parentSelection.selections?.filter(s => matchesEntryTarget(s, force ? force.catalogueId : null)) || [];
        count = childMatch.reduce((sum, s) => sum + (s.number || 1), 0);
      } else if (force) {
        const forceMatch = force.selections?.filter(s => matchesEntryTarget(s, force.catalogueId)) || [];
        count = forceMatch.reduce((sum, s) => sum + (s.number || 1), 0);
      }
    } else if (con.scope === 'roster') {
      count = Math.max(selectionCounts[entryId] || 0, (entry.targetId ? selectionCounts[entry.targetId] || 0 : 0));
    } else if (con.scope === 'force') {
      const fCounts = force ? forceSelectionCounts[force.id] || {} : {};
      count = Math.max(fCounts[entryId] || 0, (entry.targetId ? fCounts[entry.targetId] || 0 : 0));
    }

    if (con.type === 'min' && count < finalValue) {
      errors.push({
        type: 'entry-min',
        selectionId: selection.id,
        message: `Option "${selection.name}" erfordert mindestens ${finalValue} Auswahlen (aktuell: ${count}).`,
        severity: 'error'
      });
    }
    if (con.type === 'max' && count > finalValue) {
      errors.push({
        type: 'entry-max',
        selectionId: selection.id,
        message: `Option "${selection.name}" erlaubt maximal ${finalValue} Auswahlen (aktuell: ${count}).`,
        severity: 'error'
      });
    }
    if (con.type === 'percent' && roster.costLimit) {
      const finalValuePoints = (finalValue / 100) * roster.costLimit;
      const pts = getSelectionTotalCost(selection, roster.costLimitType, 1, system, roster, forceCatalogueId, parentSelection, counts);
      if (pts > finalValuePoints) {
        errors.push({
          type: 'entry-percent-max',
          selectionId: selection.id,
          message: `Option "${selection.name}" darf maximal ${finalValue}% der Punkte kosten (${finalValuePoints} Pkt.), kostet aber ${pts} Pkt.`,
          severity: 'error'
        });
      }
    }
  });
}

/** Constraints aller SelectionEntryGroups des Eintrags prüfen (Anzahl- und Punkte-Limits). */
function checkGroupConstraints({ selection, parentSelection, roster, system, force, counts, errors, entry, forceCatalogueId }) {
  const { selectionCounts, categoryCounts } = counts;
  const forceCategoryCounts = force ? (categoryCounts[force.id] || {}) : {};

  const groups = [];
  const collectGroups = (def) => {
    if (!def) return;
    def.selectionEntryGroups?.forEach(g => {
      groups.push(g);
      collectGroups(g);
    });
    def.entryLinks?.forEach(el => {
      if (el.type === 'selectionEntryGroup') {
        const resolvedGroup = resolveEntry(system, el, forceCatalogueId);
        if (resolvedGroup) {
          groups.push(resolvedGroup);
          collectGroups(resolvedGroup);
        }
      }
    });
    def.selectionEntries?.forEach(se => {
      const resolvedSE = resolveEntry(system, se, forceCatalogueId);
      if (resolvedSE && resolvedSE.type !== 'model') {
        collectGroups(resolvedSE);
      }
    });
  };

  collectGroups(entry);

  groups.forEach(group => {
    const groupItemIds = new Set();
    const visitedDefs = new Set();
    const collectGroupItemIds = (gDef) => {
      if (!gDef || visitedDefs.has(gDef.id)) return;
      if (gDef.id) visitedDefs.add(gDef.id);

      gDef.selectionEntries?.forEach(item => {
        groupItemIds.add(item.id);
        const res = resolveEntry(system, item, forceCatalogueId);
        if (res) groupItemIds.add(res.id);
      });
      gDef.entryLinks?.forEach(link => {
        groupItemIds.add(link.id);
        groupItemIds.add(link.targetId);
        const res = resolveEntry(system, link, forceCatalogueId);
        if (res) {
          groupItemIds.add(res.id);
          collectGroupItemIds(res);
        }
      });
      gDef.selectionEntryGroups?.forEach(subG => {
        collectGroupItemIds(subG);
      });
    };

    collectGroupItemIds(group);

    const matchingSelections = selection.selections?.filter(s => {
      const sId = s.entryLinkId || s.selectionEntryId;
      return groupItemIds.has(sId);
    }) || [];

    const totalCount = matchingSelections.reduce((sum, s) => sum + (s.number || 1), 0);
    const totalPoints = matchingSelections.reduce((sum, s) => {
      const pts = getSelectionTotalCost(s, roster.costLimitType, 1, system, roster, forceCatalogueId, selection, counts);
      return sum + pts;
    }, 0);

    group.constraints?.forEach(con => {
      const ctx = { roster, selectionCounts, forceCategoryCounts, selection, parentSelection, force, system, parentCatalogueId: forceCatalogueId };
      const finalValue = getModifiedConstraintValue(con, group.modifiers, ctx);
      if (finalValue < 0) return;

      // Check scope applicability for specific category/entry scoped constraints
      if (con.scope !== 'parent' && con.scope !== 'force' && con.scope !== 'roster') {
        const belongsToScope = (selection.selectionEntryId === con.scope || selection.entryLinkId === con.scope) ||
                              (entry.categoryLinks?.some(cl => cl.targetId === con.scope));
        if (!belongsToScope) return;
      }
      const isCostField = con.field === 'pts' || con.field === 'ecfa-8486-4f6c-c249' || con.field === roster.costLimitType || system.costTypes?.some(ct => ct.id === con.field);
      if (isCostField) {
        if (con.type === 'max' && totalPoints > finalValue) {
          errors.push({
            type: 'group-points-max',
            selectionId: selection.id,
            message: `Kategorie "${group.name}" erlaubt maximal ${finalValue} Punkte (aktuell: ${totalPoints} Pkt. für ${selection.name}).`,
            severity: 'error'
          });
        }
        if (con.type === 'min' && totalPoints < finalValue && totalPoints > 0) {
          errors.push({
            type: 'group-points-min',
            selectionId: selection.id,
            message: `Kategorie "${group.name}" erfordert mindestens ${finalValue} Punkte (aktuell: ${totalPoints} Pkt. für ${selection.name}).`,
            severity: 'error'
          });
        }
      } else {
        if (con.type === 'max' && totalCount > finalValue) {
          errors.push({
            type: 'group-count-max',
            selectionId: selection.id,
            message: `Kategorie "${group.name}" erlaubt maximal ${finalValue} Auswahlen (aktuell: ${totalCount} für ${selection.name}).`,
            severity: 'error'
          });
        }
        if (con.type === 'min' && totalCount < finalValue && totalCount > 0) {
          errors.push({
            type: 'group-count-min',
            selectionId: selection.id,
            message: `Kategorie "${group.name}" erfordert mindestens ${finalValue} Auswahlen (aktuell: ${totalCount} für ${selection.name}).`,
            severity: 'error'
          });
        }
      }
      if (con.type === 'percent' && roster.costLimit) {
        const finalValuePoints = (finalValue / 100) * roster.costLimit;
        if (totalPoints > finalValuePoints) {
          errors.push({
            type: 'group-percent-max',
            selectionId: selection.id,
            message: `Kategorie "${group.name}" darf maximal ${finalValue}% der Punkte kosten (${finalValuePoints} Pkt.), kostet aber ${totalPoints} Pkt.`,
            severity: 'error'
          });
        }
      }
    });
  });
}
