import { findEntryInSystem, resolveEntry } from './catalogResolver.js';
import { getUnitOptions } from './optionsCollector.js';
import { childSelectionsOf, mapSelectionTree } from './rosterTree.js';
import '../types.js';

/** Leere Force-Liste für Roster ohne `forces` — vermeidet Sonderfälle im Ablauf. */
const NO_FORCES = Object.freeze([]);

function hasEntryChildren(res) {
  if (!res) return false;
  return (res.selectionEntries && res.selectionEntries.length > 0) ||
         (res.entryLinks && res.entryLinks.length > 0) ||
         (res.selectionEntryGroups && res.selectionEntryGroups.length > 0);
}

function isIndependentSubUnit(res) {
  return res && (res.type === 'unit' || res.type === 'model') &&
         (res.collective === false || res.collective === 'false') &&
         hasEntryChildren(res);
}

/**
 * Rewrites imported option selections so they reference catalogue entries the same
 * way natively created ones do.
 *
 * BattleScribe/New Recruit files identify a chosen option by its target entry id,
 * whereas the rest of the app matches options by the catalogue's link id
 * (see `resolveEntry`, which keeps the link id). Without this alignment the editor
 * cannot recognise imported options as selected. We map each option the unit exposes
 * (via `getUnitOptions`, the same collector the editor uses) from its canonical
 * target id to its link/entry id, then adopt that id on the matching selection.
 * Idempotent: natively created rosters already use the link id and are left untouched.
 *
 * @returns {boolean} true, wenn das Roster verändert wurde
 */
export function reconcileImportedSelectionIds(roster, system) {
  if (!roster || !system) return false;
  let rosterModified = false;

  const reconcileUnit = (unitSelection, catalogueId) => {
    const canonicalToOption = new Map();
    getUnitOptions(system, catalogueId, unitSelection).forEach(({ option }) => {
      const resolved = resolveEntry(system, option, catalogueId);
      if (!resolved) return;
      const canonicalId = resolved.targetId || resolved.id;
      if (!canonicalToOption.has(canonicalId)) canonicalToOption.set(canonicalId, option);
    });

    const reassign = (selection) => {
      selection.selections?.forEach(child => {
        const currentId = child.selectionEntryId || child.entryLinkId;
        const option = canonicalToOption.get(currentId);
        if (option) {
          const newEntryLinkId = option.targetId ? option.id : null;
          const newSelectionEntryId = option.targetId ? null : option.id;
          if (child.entryLinkId !== newEntryLinkId || child.selectionEntryId !== newSelectionEntryId) {
            child.entryLinkId = newEntryLinkId;
            child.selectionEntryId = newSelectionEntryId;
            rosterModified = true;
          }
        }

        const childDef = resolveEntry(system, findEntryInSystem(system, child.selectionEntryId || child.entryLinkId, catalogueId), catalogueId);
        if (isIndependentSubUnit(childDef)) {
          reconcileUnit(child, catalogueId);
        } else {
          reassign(child);
        }
      });
    };

    reassign(unitSelection);
  };

  roster.forces?.forEach(force => {
    const catalogueId = force.catalogueId || roster.catalogueId;
    force.selections?.forEach(unitSelection => reconcileUnit(unitSelection, catalogueId));
  });

  return rosterModified;
}

/**
 * True, sobald mindestens ein Element durch ein neues Objekt ersetzt wurde.
 * Unveränderte Teilbäume behalten beim Abgleich ihre Referenz, sodass der
 * Identitätsvergleich genügt, um „hier hat sich etwas getan" zu erkennen.
 */
function anyReplaced(originals, candidates) {
  return candidates.some((candidate, index) => candidate !== originals[index]);
}

/**
 * Kopie einer Selection ohne das veraltete `costs`-Feld. Kosten werden zur
 * Lesezeit aus dem Katalog abgeleitet (ADR-0011) und nicht mehr gespeichert;
 * Alt-Roster konvergieren so beiläufig auf das aktuelle Datenmodell.
 */
function withoutLegacyCosts(selection) {
  const stripped = { ...selection };
  delete stripped.costs;
  return stripped;
}

/** Die Id, unter der eine Selection ihren Katalogeintrag referenziert. */
function catalogueEntryIdOf(selection) {
  return selection.selectionEntryId || selection.entryLinkId;
}

/**
 * Die Selection mit den aus dem Katalog nachgezogenen Feldern — oder die
 * Eingabe selbst, wenn sie dem Katalog bereits entspricht.
 */
function withCatalogueFieldsSynced(selection, system, catalogueId) {
  const entryId = catalogueEntryIdOf(selection);
  if (!entryId) return selection;

  const entryDef = findEntryInSystem(system, entryId, catalogueId);
  const resolved = entryDef && resolveEntry(system, entryDef, catalogueId);
  if (!resolved) return selection;

  const nameIsStale = selection.name !== resolved.name;
  const carriesLegacyCosts = selection.costs !== undefined;
  if (!nameIsStale && !carriesLegacyCosts) return selection;

  const synced = carriesLegacyCosts ? withoutLegacyCosts(selection) : { ...selection };
  synced.name = resolved.name;
  return synced;
}

/**
 * Gleicht einen Selection-Teilbaum mit dem Katalog ab. Der Eingabebaum bleibt
 * unberührt; unveränderte Knoten werden geteilt statt kopiert.
 */
function syncSelectionTree(selection, system, catalogueId) {
  return mapSelectionTree(selection, (node, syncedChildren) => {
    const synced = withCatalogueFieldsSynced(node, system, catalogueId);
    if (!anyReplaced(childSelectionsOf(node), syncedChildren)) return synced;
    return { ...synced, selections: syncedChildren };
  });
}

/** Gleicht die Selections einer Force ab und gibt sie unverändert zurück, wenn nichts anfiel. */
function syncForceWithSystem(force, system, fallbackCatalogueId) {
  const catalogueId = force.catalogueId || fallbackCatalogueId;
  const currentSelections = childSelectionsOf(force);
  const syncedSelections = currentSelections.map(
    selection => syncSelectionTree(selection, system, catalogueId)
  );
  if (!anyReplaced(currentSelections, syncedSelections)) return force;
  return { ...force, selections: syncedSelections };
}

/**
 * Gleicht gespeicherte Roster-Selections mit dem (ggf. aktualisierten) System
 * ab: Namen werden aus den Katalogdefinitionen nachgezogen, gespeicherte
 * Alt-Kosten entfallen.
 *
 * Rein: das übergebene Roster wird nicht verändert. Zurück kommt ein neues
 * Roster, oder — wenn nichts abzugleichen war — exakt das übergebene, sodass
 * Aufrufer „unverändert" am Identitätsvergleich erkennen.
 *
 * @param {import('../types.js').Roster} roster
 * @param {Object} system
 * @returns {import('../types.js').Roster} das abgeglichene Roster
 */
export function syncRosterSelectionsWithSystem(roster, system) {
  if (!roster || !system) return roster;

  const currentForces = roster.forces ?? NO_FORCES;
  const syncedForces = currentForces.map(
    force => syncForceWithSystem(force, system, roster.catalogueId)
  );
  if (!anyReplaced(currentForces, syncedForces)) return roster;

  return { ...roster, forces: syncedForces };
}
