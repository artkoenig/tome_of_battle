/**
 * The one place that resolves a capability record back to its catalogue entry
 * (Issue 0170).
 *
 * A slot of the report names its definition by id (`defId`, and for a reference
 * the resolved `targetDefId`). Everything the report already answers is read off
 * the slot; what the **write** path still needs from the catalogue — the entry
 * the selection factory builds from — is looked up here. Six call sites wrote
 * the same two lines, including the same fallback stub for an entry the
 * catalogue no longer knows; they now share these two helpers.
 *
 * It lives here and not in `src/contexts/ruleengine/readmodel/`: that folder may not import the
 * write model `src/contexts/armylist/model/` (`.oxlintrc.json`, blocking), and `findEntryInSystem`
 * is exactly that.
 */

import { findEntryInSystem } from '../../contexts/armylist/model';

/**
 * The catalogue entry behind a slot, or `null` when the catalogue does not know
 * it any more (silent catalogue update, ADR-0018).
 *
 * @param {object|null|undefined} system  the app system object.
 * @param {{ defId?: string }|null|undefined} capability
 * @param {string|null|undefined} catalogueId  the catalogue the lookup starts in.
 * @returns {object|null}
 */
export function findCapabilityEntry(system, capability, catalogueId) {
  if (!capability?.defId) return null;
  return findEntryInSystem(system, capability.defId, catalogueId) ?? null;
}

/**
 * The catalogue entry behind a slot, or the **name stub** the display falls back
 * to: the report knows the slot's name even where the catalogue lookup fails, so
 * the user sees a named row instead of an empty one.
 *
 * @param {object|null|undefined} system
 * @param {{ defId?: string, name?: string }} capability
 * @param {string|null|undefined} catalogueId
 * @returns {object} the catalogue entry, else `{ id, name }` from the slot.
 */
export function capabilityEntryOf(system, capability, catalogueId) {
  return findCapabilityEntry(system, capability, catalogueId)
    ?? { id: capability.defId, name: capability.name };
}
