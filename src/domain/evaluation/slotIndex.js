/**
 * `SlotIndex` — the report's slot side as one value object (Issue 0170).
 *
 * The report hands the UI three structures that never travel alone: the
 * capability record per slot path (`capabilities`, `src/domain/evaluator/evaluator.js`)
 * and the two path assignments that lead into it (`pathBySelectionId`,
 * `pathByForceId`, `rosterAdapter.js`). Every reader needs at least two of the
 * three, so they are one value with one name, and the pure lookups that used to
 * live in `slotLookups.js` are its methods. Nothing here recomputes anything —
 * the index only reads what the report already decided (Leitprinzip 3).
 *
 * Two ways in:
 * - {@link SlotIndex.fromReport} — the production path, from a report the
 *   engine produced. Its records are complete by construction, so nothing is
 *   checked.
 * - {@link SlotIndex.fromMaps} — the test path, from hand-built maps. Here the
 *   display fields **are** checked: a hand-built record that omits `isHidden`,
 *   `primaryCategoryId` or `isIndependentSubUnit` used to make the UI answer
 *   "not hidden", "no section" or "not a sub-unit" silently, and the test still
 *   passed. Such a fixture now fails where it is built instead.
 */

/** The anchor kind of the report's category slots (`report.js` anchor contract). */
const CATEGORY_ANCHOR_KIND = 'categoryAnchor';

/**
 * The anchor kinds whose slots name a **deployable unit** of a contingent:
 * occupied, offered or demanded as a mandatory phantom. Group and category
 * anchors are frames and do not count.
 */
const UNIT_SLOT_ANCHOR_KINDS = new Set(['occupied', 'offerAnchor', 'mandatoryPhantom']);

/**
 * The slot fields the display reads off a capability record and whose absence
 * cannot be told apart from a legitimate answer: a missing `isHidden` reads as
 * "shown", a missing `primaryCategoryId` as "carries no category", a missing
 * `isIndependentSubUnit` as "not a sub-unit". Each is checked by
 * {@link SlotIndex.fromMaps} against the type the report gives it.
 *
 * @type {ReadonlyArray<{ field: string, isValid: (value: unknown) => boolean, expected: string }>}
 */
const REQUIRED_DISPLAY_FIELDS = Object.freeze([
  { field: 'isHidden', isValid: v => typeof v === 'boolean', expected: 'boolean' },
  { field: 'isIndependentSubUnit', isValid: v => typeof v === 'boolean', expected: 'boolean' },
  {
    field: 'primaryCategoryId',
    isValid: v => v === null || typeof v === 'string',
    expected: 'string or null',
  },
]);

/**
 * True when `path` names a **direct** child of `parentPath` (exactly one more
 * path segment).
 *
 * @param {string} path
 * @param {string} parentPath
 * @returns {boolean}
 */
function isDirectChildPath(path, parentPath) {
  if (!path.startsWith(`${parentPath}/`)) return false;
  return !path.slice(parentPath.length + 1).includes('/');
}

/**
 * True when this capability record carries the definition `defId` — through its
 * own id (the link id for a reference) or its resolved target id.
 *
 * @param {object} capability
 * @param {string} defId
 * @returns {boolean}
 */
function carriesDefId(capability, defId) {
  return capability.defId === defId || capability.targetDefId === defId;
}

/**
 * The slot side of one report: the capability records and the two path
 * assignments that lead into them.
 */
export class SlotIndex {
  /**
   * @param {Map<string, object>} capabilities  capability record per slot path.
   * @param {Map<string, string>} pathBySelectionId  app selection UUID → slot path.
   * @param {Map<string, string>} pathByForceId  app force UUID → slot path.
   */
  constructor(capabilities, pathBySelectionId, pathByForceId) {
    /** @type {Map<string, object>} */
    this.capabilities = capabilities;
    /** @type {Map<string, string>} */
    this.pathBySelectionId = pathBySelectionId;
    /** @type {Map<string, string>} */
    this.pathByForceId = pathByForceId;
    Object.freeze(this);
  }

  /**
   * The index of a report, together with the slot paths corrected for the
   * definitions the dataset does not know (`evaluationCache.js`).
   *
   * @param {{ capabilities?: Map<string, object>|null }} report
   * @param {{ pathBySelectionId: Map<string, string>, pathByForceId: Map<string, string> }} paths
   * @returns {SlotIndex}
   */
  static fromReport(report, paths) {
    return new SlotIndex(
      report?.capabilities ?? new Map(),
      paths.pathBySelectionId,
      paths.pathByForceId
    );
  }

  /**
   * An index over hand-built maps — the seam a test uses instead of writing its
   * own lookup. Every capability record is checked against the display fields
   * of {@link REQUIRED_DISPLAY_FIELDS}; a record missing one throws here rather
   * than answering `false` in the UI three layers away.
   *
   * @param {{ capabilities?: Map<string, object>|Iterable<[string, object]>|null,
   *   pathBySelectionId?: Map<string, string>|Iterable<[string, string]>|null,
   *   pathByForceId?: Map<string, string>|Iterable<[string, string]>|null }} [maps]
   * @returns {SlotIndex}
   * @throws {TypeError} when a capability record omits a display field or gives
   *   it the wrong type.
   */
  static fromMaps(maps = {}) {
    const capabilities = new Map(maps.capabilities ?? []);
    for (const [path, capability] of capabilities) {
      if (capability === null || typeof capability !== 'object') {
        throw new TypeError(`SlotIndex.fromMaps: slot "${path}" carries no capability record`);
      }
      for (const { field, isValid, expected } of REQUIRED_DISPLAY_FIELDS) {
        if (isValid(capability[field])) continue;
        throw new TypeError(
          `SlotIndex.fromMaps: slot "${path}" is missing the display field `
          + `"${field}" (expected ${expected}, got ${JSON.stringify(capability[field]) ?? 'undefined'})`
        );
      }
    }
    return new SlotIndex(
      capabilities,
      new Map(maps.pathBySelectionId ?? []),
      new Map(maps.pathByForceId ?? [])
    );
  }

  /**
   * The capability record at a slot path. `undefined` for an unknown or absent
   * path.
   *
   * @param {string|null|undefined} path
   * @returns {object|undefined}
   */
  slotAt(path) {
    return path === null || path === undefined ? undefined : this.capabilities.get(path);
  }

  /**
   * The slot path of an app selection, `undefined` while the report carries no
   * slot for it.
   *
   * @param {string|null|undefined} selectionId
   * @returns {string|undefined}
   */
  pathOfSelection(selectionId) {
    return selectionId === null || selectionId === undefined
      ? undefined
      : this.pathBySelectionId.get(selectionId);
  }

  /**
   * The slot path of an app force, `null` while the report carries no slot for
   * it — the shape the editor passes around as `forcePath`.
   *
   * @param {string|null|undefined} forceId
   * @returns {string|null}
   */
  pathOfForce(forceId) {
    if (forceId === null || forceId === undefined) return null;
    return this.pathByForceId.get(forceId) ?? null;
  }

  /**
   * The direct child slots of a frame (contingent or occupied selection), in
   * the report's slot order. The report's map insertion order is the tree
   * order and is taken over unchanged.
   *
   * @param {string|null|undefined} parentPath  slot path of the frame (e.g. `"0"`).
   * @returns {Array<{ path: string, capability: object }>}
   */
  childSlotsOf(parentPath) {
    if (parentPath === null || parentPath === undefined) return [];
    const slots = [];
    for (const [path, capability] of this.capabilities) {
      if (isDirectChildPath(path, parentPath)) slots.push({ path, capability });
    }
    return slots;
  }

  /**
   * The direct child slot of a frame that carries the definition `defId` —
   * through its own id (the link id for a reference) or its resolved target id.
   * `undefined` when the frame carries no such slot.
   *
   * @param {string|null|undefined} parentPath
   * @param {string|null|undefined} defId
   * @returns {object|undefined}
   */
  findChildSlot(parentPath, defId) {
    if (defId === null || defId === undefined) return undefined;
    for (const { capability } of this.childSlotsOf(parentPath)) {
      if (carriesDefId(capability, defId)) return capability;
    }
    return undefined;
  }

  /**
   * The slot **anywhere below** a frame that carries the definition `defId`.
   *
   * Unlike {@link SlotIndex#findChildSlot} this search descends to any depth: an
   * option inside a group hangs under the **group anchor** in the report, not
   * directly under the unit. Whoever looks for an option's slot from its unit
   * asks here. Found is the first in the report's slot order — the same one the
   * display draws at that place.
   *
   * @param {string|null|undefined} parentPath
   * @param {string|null|undefined} defId
   * @returns {object|undefined}
   */
  findDescendantSlot(parentPath, defId) {
    if (!parentPath || defId === null || defId === undefined) return undefined;
    const prefix = `${parentPath}/`;
    for (const [path, capability] of this.capabilities) {
      if (!path.startsWith(prefix)) continue;
      if (carriesDefId(capability, defId)) return capability;
    }
    return undefined;
  }

  /**
   * The capability record of an app selection: its slot path is in
   * `pathBySelectionId`, the record below it in the report. `undefined` while
   * the report carries no slot for this selection.
   *
   * @param {{ id?: string }|null|undefined} selection
   * @returns {object|undefined}
   */
  slotOfSelection(selection) {
    return this.slotAt(this.pathOfSelection(selection?.id));
  }

  /**
   * True when this selection is an **independent sub-unit** — the report's
   * answer (`capability.isIndependentSubUnit`, Issue 0156), not a second
   * catalogue pass in the UI. Without a slot in the report it stays `false`:
   * then there is nothing drawn that the question would apply to.
   *
   * @param {{ id?: string }|null|undefined} selection
   * @returns {boolean}
   */
  isIndependentSubUnitSlot(selection) {
    return this.slotOfSelection(selection)?.isIndependentSubUnit === true;
  }

  /**
   * The category anchor slots of a contingent, in the report's slot order. Each
   * carries one category of the contingent: its `defId` is the `categoryLink`
   * (linked case) or the category itself (unlinked case); `targetDefId` points
   * at the category in the linked case.
   *
   * @param {string|null|undefined} forcePath  slot path of the contingent (e.g. `"0"`).
   * @returns {Array<{ path: string, capability: object }>}
   */
  categoryAnchorSlotsOf(forcePath) {
    return this.childSlotsOf(forcePath)
      .filter(({ capability }) => capability.anchorKind === CATEGORY_ANCHOR_KIND);
  }

  /**
   * True when the contingent carries any slot whose **effective primary
   * category** (`capability.primaryCategoryId`, from the report — never from raw
   * catalogue links) is this category.
   *
   * That is the question "is this category an operable slot or merely a rule
   * keyword?" — the same set the category adder offers (ADR 0003 §4), only
   * without its visibility and origin filters.
   *
   * @param {string|null|undefined} forcePath
   * @param {string|null|undefined} categoryId
   * @returns {boolean}
   */
  hasUnitSlotsInCategory(forcePath, categoryId) {
    if (categoryId === null || categoryId === undefined) return false;
    return this.childSlotsOf(forcePath).some(({ capability }) =>
      UNIT_SLOT_ANCHOR_KINDS.has(capability.anchorKind)
      && capability.primaryCategoryId === categoryId);
  }

  /**
   * The category anchor slot of a category under a contingent — found through
   * the category id (the anchor's own or resolved target id). `undefined` when
   * the contingent carries no such anchor.
   *
   * @param {string|null|undefined} forcePath
   * @param {string|null|undefined} categoryId
   * @returns {object|undefined}
   */
  findCategoryAnchorSlot(forcePath, categoryId) {
    if (categoryId === null || categoryId === undefined) return undefined;
    for (const { capability } of this.categoryAnchorSlotsOf(forcePath)) {
      if (carriesDefId(capability, categoryId)) return capability;
    }
    return undefined;
  }
}

/**
 * The one empty index — reference-stable, so the empty evaluation result stays
 * reference-stable with it (`evaluationCache.js`).
 *
 * @type {SlotIndex}
 */
export const EMPTY_SLOT_INDEX = new SlotIndex(new Map(), new Map(), new Map());

/**
 * The **resolved** definition id of a slot: the target id of a reference, else
 * the slot's own id. This is the id under which the catalogue knows the entry,
 * and the id a rule is deduplicated and recognised by.
 *
 * @param {{ defId?: string, targetDefId?: string|null }} capability
 * @returns {string|undefined}
 */
export function resolvedDefIdOf(capability) {
  return capability.targetDefId ?? capability.defId;
}
