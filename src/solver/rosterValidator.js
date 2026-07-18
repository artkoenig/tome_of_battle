import { findEntryInSystem, resolveEntry } from './catalogResolver.js';
import { getModifiedConstraintValue, getEffectiveModifiers } from './modifierEvaluator.js';
import { calculateRosterCosts, computeRosterCounts, getSelectionTotalCost, TOP_LEVEL_PARENT_COUNT } from './rosterCounter.js';
import { isPercentConstraint, isCostField, countSelections, resolveConstraintThreshold } from './constraintScope.js';
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

// Constraint-Scope, unter dem eine Kategoriegrenze für das gesamte Kontingent gilt.
const FORCE_SCOPE = 'force';
// Synthetische ID des per System-Quirk von einer anderen Kategorie geerbten max-Constraints.
const QUIRK_INHERITED_MAX_ID = 'quirk-inherited-max';

/** Min/Max-Limits einer Force-Kategorie prüfen (pro Force, nicht armeeweit). */
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
    const ctx = { roster, selectionCounts, forceCategoryCounts, force, system };

    // 1. Constraints am categoryLink (samt Quirk-geerbtem max), Modifier vom Link.
    collectCategoryLinkConstraints({ catLink, forceDef, system, targetCatId }).forEach(con =>
      evaluateForceCategoryConstraint({
        con,
        modifiers: con.isFallback ? con.modifiers : getEffectiveModifiers(catLink),
        count, catName, forceDef, force, targetCatId, ctx, errors
      })
    );

    // 2. Force-weite Constraints direkt an der categoryEntry-Definition (neuer
    //    Lexicanum-Datensatz), Modifier von der categoryEntry. Der alte Datensatz
    //    deklariert hier nichts mit force-Scope, bleibt also unberührt.
    collectCategoryEntryForceConstraints(catDef).forEach(con =>
      evaluateForceCategoryConstraint({
        con,
        modifiers: getEffectiveModifiers(catDef),
        count, catName, forceDef, force, targetCatId, ctx, errors
      })
    );
  });
}

/** Constraints am categoryLink, ergänzt um den per System-Quirk geerbten max-Constraint. */
function collectCategoryLinkConstraints({ catLink, forceDef, system, targetCatId }) {
  const constraints = [...(catLink.constraints || [])];

  // System-Quirk: Kategorie erbt einen fehlenden max-Constraint von einer anderen Kategorie.
  const inheritFromCatId = getInheritedCategoryMaxSource(system, targetCatId);
  if (inheritFromCatId && !constraints.some(c => c.type === 'max')) {
    const sourceCatLink = forceDef.categoryLinks?.find(cl => cl.targetId === inheritFromCatId);
    const sourceMaxCon = sourceCatLink?.constraints?.find(c => c.type === 'max');
    if (sourceMaxCon) {
      constraints.push({
        ...sourceMaxCon,
        id: QUIRK_INHERITED_MAX_ID,
        type: 'max',
        isFallback: true,
        modifiers: getEffectiveModifiers(sourceCatLink)
      });
    }
  }
  return constraints;
}

/**
 * Force-weite Constraints, die direkt an der categoryEntry-Definition hängen.
 * Diese modellieren native Kategoriegrenzen des neuen Datensatzes und wurden von
 * der reinen categoryLink-Auswertung bisher übersehen.
 */
function collectCategoryEntryForceConstraints(catDef) {
  return (catDef?.constraints || []).filter(con => con.scope === FORCE_SCOPE);
}

/** Einen einzelnen Kategorie-Constraint gegen den aktuellen Kategorie-Count prüfen. */
function evaluateForceCategoryConstraint({ con, modifiers, count, catName, forceDef, force, targetCatId, ctx, errors }) {
  const finalValue = getModifiedConstraintValue(con, modifiers, ctx);
  if (finalValue < 0) return; // z. B. max="-1": die Kategorie ist unbegrenzt.

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
}

/** Eine Selection samt Kindern rekursiv gegen ihre Entry- und Gruppen-Constraints prüfen. */
function checkSelectionTree(args) {
  const { selection, roster, system, force, errors } = args;

  const entryId = selection.entryLinkId || selection.selectionEntryId;
  const forceCatalogueId = force?.catalogueId || roster.catalogueId;
  const rawEntry = findEntryInSystem(system, entryId, forceCatalogueId);
  const entry = resolveEntry(system, rawEntry, forceCatalogueId);

  if (!entry) {
    // ADR-0011-Resilienz: die Auswahl bleibt unter ihrem gespeicherten Namen sichtbar
    // (nicht entfernt/umgebogen) — nur als Validierungsfehler gemeldet.
    errors.push({
      type: 'unresolved-entry',
      selectionId: selection.id,
      message: `Auswahl "${selection.name}" verweist auf einen im Katalog nicht mehr vorhandenen Eintrag.`,
      severity: 'error'
    });
  } else {
    checkEntryConstraints({ ...args, entry, entryId, forceCatalogueId });
    checkGroupConstraints({ ...args, entry, forceCatalogueId });
  }

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
    const finalValue = getModifiedConstraintValue(con, getEffectiveModifiers(entry), ctx);
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

      const scopeCatalogueId = force ? force.catalogueId : null;
      const predicate = s => matchesEntryTarget(s, scopeCatalogueId);
      const includeChildSelections = con.includeChildSelections;
      if (parentSelection) {
        count = countSelections(parentSelection.selections, { includeChildSelections, predicate });
      } else if (force) {
        count = countSelections(force.selections, { includeChildSelections, predicate });
      }
    } else if (con.scope === 'roster') {
      count = Math.max(selectionCounts[entryId] || 0, (entry.targetId ? selectionCounts[entry.targetId] || 0 : 0));
    } else if (con.scope === 'force') {
      // includeChildForces widens a force-scoped count to the whole roster
      // (child forces are flattened as roster siblings in the roster model).
      const scopeCounts = con.includeChildForces
        ? selectionCounts
        : (force ? forceSelectionCounts[force.id] || {} : {});
      count = Math.max(scopeCounts[entryId] || 0, (entry.targetId ? scopeCounts[entry.targetId] || 0 : 0));
    }

    if (isPercentConstraint(con)) {
      checkEntryPercentConstraint({ con, finalValue, count, selection, parentSelection, roster, system, force, forceCatalogueId, counts, errors });
      return;
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
  });
}

/**
 * Prüft eine Prozent-Constraint (percentValue) eines Eintrags: die Bezugsgröße
 * ist die Summe des Feldes im Scope, der Grenzwert `value%` davon. Punkte-Felder
 * werden gegen die Kosten des Eintrags, `selections` gegen dessen Anzahl geprüft.
 */
function checkEntryPercentConstraint({ con, finalValue, count, selection, parentSelection, roster, system, force, forceCatalogueId, counts, errors }) {
  const measuresCost = isCostField(con.field, system, roster);
  const subject = measuresCost
    ? getSelectionTotalCost(selection, con.field, TOP_LEVEL_PARENT_COUNT, {
        system, roster, currentCatalogueId: forceCatalogueId, parentSelection, counts
      })
    : count;
  const threshold = resolveConstraintThreshold({ constraint: con, value: finalValue, roster, system, force, parentSelection, forceCatalogueId, counts });
  const unit = measuresCost ? 'Punkte' : 'Auswahlen';

  if (con.type === 'min' && subject < threshold) {
    errors.push({
      type: 'entry-percent-min',
      selectionId: selection.id,
      message: `Option "${selection.name}" muss mindestens ${finalValue}% der ${unit} ausmachen (${threshold}), ist aber ${subject}.`,
      severity: 'error'
    });
  }
  if ((con.type === 'max' || con.type === 'percent') && subject > threshold) {
    errors.push({
      type: 'entry-percent-max',
      selectionId: selection.id,
      message: `Option "${selection.name}" darf maximal ${finalValue}% der ${unit} ausmachen (${threshold}), ist aber ${subject}.`,
      severity: 'error'
    });
  }
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

    // Selections belonging to the group. `includeChildSelections` widens the match
    // to nested selections; without it only the group owner's direct children count.
    const collectGroupMatches = (list, includeChildSelections) => {
      if (!list) return [];
      return list.flatMap(s => {
        const sId = s.entryLinkId || s.selectionEntryId;
        const self = groupItemIds.has(sId) ? [s] : [];
        const nested = includeChildSelections ? collectGroupMatches(s.selections, includeChildSelections) : [];
        return [...self, ...nested];
      });
    };

    group.constraints?.forEach(con => {
      const ctx = { roster, selectionCounts, forceCategoryCounts, selection, parentSelection, force, system, parentCatalogueId: forceCatalogueId };
      const finalValue = getModifiedConstraintValue(con, getEffectiveModifiers(group), ctx);
      if (finalValue < 0) return;

      // Check scope applicability for specific category/entry scoped constraints
      if (con.scope !== 'parent' && con.scope !== 'force' && con.scope !== 'roster') {
        const belongsToScope = (selection.selectionEntryId === con.scope || selection.entryLinkId === con.scope) ||
                              (entry.categoryLinks?.some(cl => cl.targetId === con.scope));
        if (!belongsToScope) return;
      }

      const matchingSelections = collectGroupMatches(selection.selections, con.includeChildSelections);
      const totalCount = matchingSelections.reduce((sum, s) => sum + (s.number || 1), 0);
      const totalPoints = matchingSelections.reduce((sum, s) => {
        const pts = getSelectionTotalCost(s, roster.costLimitType, TOP_LEVEL_PARENT_COUNT, {
          system, roster, currentCatalogueId: forceCatalogueId, parentSelection: selection, counts
        });
        return sum + pts;
      }, 0);

      const measuresCost = isCostField(con.field, system, roster);

      if (isPercentConstraint(con)) {
        checkGroupPercentConstraint({ con, finalValue, totalCount, totalPoints, measuresCost, group, selection, roster, system, force, forceCatalogueId, counts, errors });
        return;
      }

      if (measuresCost) {
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
    });
  });
}

/**
 * Prüft eine Prozent-Constraint (percentValue) einer SelectionEntryGroup: die
 * Gruppensumme (Punkte oder Anzahl) gegen `value%` der Bezugsgröße im Scope.
 */
function checkGroupPercentConstraint({ con, finalValue, totalCount, totalPoints, measuresCost, group, selection, roster, system, force, forceCatalogueId, counts, errors }) {
  const subject = measuresCost ? totalPoints : totalCount;
  const threshold = resolveConstraintThreshold({ constraint: con, value: finalValue, roster, system, force, parentSelection: selection, forceCatalogueId, counts });
  const unit = measuresCost ? 'Punkte' : 'Auswahlen';

  if (con.type === 'min' && subject < threshold) {
    errors.push({
      type: 'group-percent-min',
      selectionId: selection.id,
      message: `Kategorie "${group.name}" muss mindestens ${finalValue}% der ${unit} ausmachen (${threshold}), ist aber ${subject}.`,
      severity: 'error'
    });
  }
  if ((con.type === 'max' || con.type === 'percent') && subject > threshold) {
    errors.push({
      type: 'group-percent-max',
      selectionId: selection.id,
      message: `Kategorie "${group.name}" darf maximal ${finalValue}% der ${unit} ausmachen (${threshold}), ist aber ${subject}.`,
      severity: 'error'
    });
  }
}
