import { findEntryInSystem, resolveEntry } from './catalogResolver.js';
import { getUnitOptions } from './optionsCollector.js';
import { childSelectionsOf, mapSelectionTree, traverseSelectionTree } from './rosterTree.js';
import { isIndependentSubUnit } from './subUnit.js';
import '../types.js';

/** Leere Force-Liste für Roster ohne `forces` — vermeidet Sonderfälle im Ablauf. */
const NO_FORCES = Object.freeze([]);

/**
 * True, sobald mindestens ein Element durch ein neues Objekt ersetzt wurde.
 * Unveränderte Teilbäume behalten beim Abgleich ihre Referenz, sodass der
 * Identitätsvergleich genügt, um „hier hat sich etwas getan" zu erkennen.
 */
function anyReplaced(originals, candidates) {
  return candidates.some((candidate, index) => candidate !== originals[index]);
}

/** Der Katalog einer Force — ersatzweise der des Rosters. */
function catalogueIdOf(force, roster) {
  return force.catalogueId || roster.catalogueId;
}

/**
 * Bildet die Selections einer Force ab und gibt die Force unverändert zurück,
 * wenn kein Teilbaum ersetzt wurde.
 */
function withSelectionsMapped(force, mapSelection) {
  const currentSelections = childSelectionsOf(force);
  const mappedSelections = currentSelections.map(mapSelection);
  if (!anyReplaced(currentSelections, mappedSelections)) return force;
  return { ...force, selections: mappedSelections };
}

/**
 * Bildet die Forces eines Rosters ab und gibt das Roster unverändert zurück,
 * wenn keine Force ersetzt wurde.
 */
function withForcesMapped(roster, mapForce) {
  const currentForces = roster.forces ?? NO_FORCES;
  const mappedForces = currentForces.map(mapForce);
  if (!anyReplaced(currentForces, mappedForces)) return roster;
  return { ...roster, forces: mappedForces };
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
 * Die aufgelöste Katalogdefinition hinter einer Selection — oder `null`, wenn
 * die Selection auf keinen (mehr) auffindbaren Eintrag verweist.
 */
function catalogueEntryOf(selection, system, catalogueId) {
  const entryId = catalogueEntryIdOf(selection);
  if (!entryId) return null;

  const entryDef = findEntryInSystem(system, entryId, catalogueId);
  return entryDef ? resolveEntry(system, entryDef, catalogueId) : null;
}

/**
 * Die Selection mit den aus dem Katalog nachgezogenen Feldern — oder die
 * Eingabe selbst, wenn sie dem Katalog bereits entspricht.
 */
function withCatalogueFieldsSynced(selection, system, catalogueId) {
  const resolved = catalogueEntryOf(selection, system, catalogueId);
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

  return withForcesMapped(roster, force =>
    withSelectionsMapped(force, selection =>
      syncSelectionTree(selection, system, catalogueIdOf(force, roster))
    )
  );
}

/**
 * Die Optionen, die eine Einheit laut Katalog anbietet, abgelegt unter ihrer
 * kanonischen Ziel-Id — genau der Id, mit der importierte Dateien sie
 * referenzieren. Die erste Option je Id gewinnt.
 */
function optionsByCanonicalIdOf(unitSelection, system, catalogueId) {
  const optionsByCanonicalId = new Map();
  getUnitOptions(system, catalogueId, unitSelection).forEach(({ option }) => {
    const resolved = resolveEntry(system, option, catalogueId);
    if (!resolved) return;
    const canonicalId = resolved.targetId || resolved.id;
    if (!optionsByCanonicalId.has(canonicalId)) optionsByCanonicalId.set(canonicalId, option);
  });
  return optionsByCanonicalId;
}

/**
 * Die Selection mit den Ids der Katalogoption, auf die sie verweist — oder die
 * Eingabe selbst, wenn sie diese Ids bereits trägt.
 */
function withOptionIdsAligned(selection, optionsByCanonicalId) {
  const option = optionsByCanonicalId.get(catalogueEntryIdOf(selection));
  if (!option) return selection;

  const entryLinkId = option.targetId ? option.id : null;
  const selectionEntryId = option.targetId ? null : option.id;
  if (selection.entryLinkId === entryLinkId && selection.selectionEntryId === selectionEntryId) {
    return selection;
  }
  return { ...selection, entryLinkId, selectionEntryId };
}

/**
 * Ordnet jeder Selection im Teilbaum einer Einheit ihre angeglichene Fassung zu.
 *
 * Der Abgleich läuft von oben nach unten, weil erst die angeglichene Selection
 * erkennen lässt, ob sie eine eigenständige Untereinheit ist — und damit ihren
 * eigenen Kindern einen eigenen Optionsvorrat vorgibt.
 */
function alignedSelectionsOfUnit(unitSelection, system, catalogueId) {
  const alignedBySelection = new Map();

  const alignAndDescend = (selection, optionsByCanonicalId) => {
    const aligned = withOptionIdsAligned(selection, optionsByCanonicalId);
    alignedBySelection.set(selection, aligned);
    return isIndependentSubUnit(catalogueEntryOf(aligned, system, catalogueId))
      ? optionsByCanonicalIdOf(aligned, system, catalogueId)
      : optionsByCanonicalId;
  };

  traverseSelectionTree(
    childSelectionsOf(unitSelection),
    alignAndDescend,
    optionsByCanonicalIdOf(unitSelection, system, catalogueId)
  );
  return alignedBySelection;
}

/**
 * Gleicht die Options-Ids im Teilbaum einer Einheit an den Katalog an. Der
 * Eingabebaum bleibt unberührt; unveränderte Knoten werden geteilt statt kopiert.
 */
function reconcileUnitTree(unitSelection, system, catalogueId) {
  const alignedBySelection = alignedSelectionsOfUnit(unitSelection, system, catalogueId);

  return mapSelectionTree(unitSelection, (selection, reconciledChildren) => {
    const aligned = alignedBySelection.get(selection) ?? selection;
    if (!anyReplaced(childSelectionsOf(selection), reconciledChildren)) return aligned;
    return { ...aligned, selections: reconciledChildren };
  });
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
 *
 * Rein: das übergebene Roster wird nicht verändert. Zurück kommt ein neues
 * Roster, oder — wenn nichts anzugleichen war — exakt das übergebene, sodass
 * Aufrufer „unverändert" am Identitätsvergleich erkennen. Natively erzeugte und
 * bereits angeglichene Roster kommen daher unverändert zurück (idempotent).
 *
 * @param {import('../types.js').Roster} roster
 * @param {Object} system
 * @returns {import('../types.js').Roster} das angeglichene Roster
 */
export function reconcileImportedSelectionIds(roster, system) {
  if (!roster || !system) return roster;

  return withForcesMapped(roster, force =>
    withSelectionsMapped(force, unitSelection =>
      reconcileUnitTree(unitSelection, system, catalogueIdOf(force, roster))
    )
  );
}
