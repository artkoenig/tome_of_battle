/**
 * Static coverage inventory of the BattleScribe rule constructs — **not
 * production code**.
 *
 * Every `constraint`, `condition`, `conditionGroup`, `modifier`,
 * `modifierGroup`, `repeat` and `repeats` element of a catalogue corpus is
 * classified into a *cell*: a pipe-delimited key over the axes that actually
 * separate code paths in an evaluator (field class, scope class, boolean
 * flags, nesting), with raw catalogue GUIDs collapsed into classes so the
 * result is a list of constructs rather than a list of catalogue rows.
 *
 * The module is data-first and deliberately independent of the engine: it
 * never imports anything under `src/domain/evaluator/` (ADR 0030 forbids it from
 * outside the facade, and ADR 0033's black-box principle wants the inventory
 * to challenge the engine rather than mirror it). Its vocabulary comes from
 * `docs/battlescribe-data-format.md` §7.6, §7.7, §13.1 and §13.2 and from the
 * vendored `src/data/parser/schema/Catalogue.xsd`.
 *
 * Everything here is pure: the entry points take already-parsed documents, so
 * the corpus walk, the file system and `DOMParser` live in
 * `scripts/lib/evaluator-coverage-corpus.js` and
 * `scripts/evaluator-coverage-inventory.js`.
 */

/**
 * @typedef {{ doc: Document, file: string }} CellSource
 *   One parsed catalogue document together with its repo-relative path.
 * @typedef {{ file: string, message: string }} CellFailure
 *   A document that could not be inventoried, reported instead of counted.
 * @typedef {{ file: string, id: (string|null), ancestor: ({ tag: string, id: string, name: string }|null),
 *             path: string[], raw: Record<string, (string|number|null)> }} CellExample
 *   Where one occurrence sits: jsdom exposes no line numbers, so the location
 *   is the file plus the nearest named ancestor the construct hangs on.
 * @typedef {{ key: string, kind: string, axes: Record<string, (string|boolean)>,
 *             occurrences: number, files: Record<string, number>, examples: CellExample[] }} Cell
 * @typedef {Map<string, Map<string, string>>} ConstraintIndex
 *   Constraint ids per file: the outer key is the repo-relative path, the inner
 *   map takes a constraint id to its cell key. The nesting is what keeps one id
 *   that occurs in two fixture sets with different attributes distinguishable —
 *   `id` is unique within a dataset, not across the corpus.
 * @typedef {{ cells: Cell[], failures: CellFailure[], index: ConstraintIndex }} Inventory
 * @typedef {{ gameSystem?: (string|null), catalogues?: (string[]|null) }} Dataset
 *   The files one scenario manifest — or one roster of it — loads, as
 *   `docs/testing/<scenario>/scenario.json` declares them: repo-relative,
 *   POSIX-separated paths.
 */

/**
 * Why a manifest id resolved to no cell — bookkeeping drift (`UNKNOWN_ID`)
 * against a scenario whose dataset and expectations disagree (`OUTSIDE_DATASET`).
 */
export const UnmatchedReason = Object.freeze({
  UNKNOWN_ID: 'unknown-id',
  OUTSIDE_DATASET: 'outside-dataset',
});

/** The seven construct families the inventory distinguishes. */
export const CellKind = Object.freeze({
  CONSTRAINT: 'constraint',
  CONDITION: 'condition',
  CONDITION_GROUP: 'conditionGroup',
  MODIFIER: 'modifier',
  MODIFIER_GROUP: 'modifierGroup',
  REPEAT: 'repeat',
  REPEAT_LIST: 'repeatList',
});

/**
 * Scope keywords that stay themselves in a key (`docs/battlescribe-data-format.md`
 * §13.1, plus the `scope="unit"` / `scope="ancestor"` box in §7.7). Anything
 * else non-empty is a catalogue id and collapses to the class `id`.
 */
export const SCOPE_KEYWORDS = Object.freeze([
  'roster',
  'force',
  'parent',
  'self',
  'unit',
  'ancestor',
  'primary-catalogue',
  'category',
]);

/** `childId` keywords that stay themselves in a key (§13.2); anything else is `id`. */
export const CHILD_ID_KEYWORDS = Object.freeze(['model', 'unit', 'upgrade', 'any']);

/**
 * Modifier target fields that name a construct rather than a catalogue entity
 * (§7.7). Any other value is resolved against the corpus symbol tables.
 */
export const MODIFIER_LITERAL_FIELDS = Object.freeze([
  'hidden',
  'name',
  'category',
  'error',
  'warning',
  'info',
  'sortIndex',
  'page',
]);

/** The class used when an attribute is missing altogether. */
const ABSENT = 'absent';

/** Prefix of a `field` that names a constraint's own limit value (§13.2). */
const LIMIT_PREFIX = 'limit::';

/** At most this many locations are recorded per cell — enough to act on, not a dump. */
export const MAX_EXAMPLES = 3;

/** Element tag names, spelled once so a typo cannot silently drop a family. */
const Tag = Object.freeze({
  CONSTRAINT: 'constraint',
  CONDITION: 'condition',
  CONDITION_GROUP: 'conditionGroup',
  CONDITION_GROUPS: 'conditionGroups',
  CONDITIONS: 'conditions',
  MODIFIER: 'modifier',
  MODIFIER_GROUP: 'modifierGroup',
  REPEAT: 'repeat',
  REPEATS: 'repeats',
  COST_TYPE: 'costType',
  CHARACTERISTIC_TYPE: 'characteristicType',
  PARSER_ERROR: 'parsererror',
});

/**
 * Reads a boolean attribute. An omitted flag reads `false`, so two spellings
 * of the same construct land in one cell instead of two.
 * @param {Element} element
 * @param {string} name
 * @returns {boolean}
 */
function flag(element, name) {
  return element.getAttribute(name) === 'true';
}

/**
 * Reads an attribute, mapping an absent or empty one to `null`.
 * @param {Element} element
 * @param {string} name
 * @returns {string|null}
 */
function attribute(element, name) {
  const value = element.getAttribute(name);
  return value === null || value === '' ? null : value;
}

/**
 * Classifies a `scope` attribute into its scope class.
 * @param {string|null} value
 * @returns {string}
 */
export function classifyScope(value) {
  if (value === null) return ABSENT;
  return SCOPE_KEYWORDS.includes(value) ? value : 'id';
}

/**
 * Classifies a `childId` attribute into its child class.
 * @param {string|null} value
 * @returns {string}
 */
export function classifyChildId(value) {
  if (value === null) return ABSENT;
  return CHILD_ID_KEYWORDS.includes(value) ? value : 'id';
}

/**
 * Classifies the counted `field` of a constraint, condition or repeat (§13.2).
 * @param {string|null} value
 * @param {Set<string>} costTypeIds
 * @returns {string}
 */
export function classifyCountedField(value, costTypeIds) {
  if (value === null) return ABSENT;
  if (value === 'selections') return 'selectionCount';
  if (value === 'forces') return 'forceCount';
  if (value.startsWith(LIMIT_PREFIX)) return 'limitValue';
  if (costTypeIds.has(value)) return 'costSum';
  return 'unresolvedField';
}

/**
 * Classifies the target `field` of a modifier (§7.7, §13.2). Ids that resolve
 * nowhere in the corpus collapse into one `unresolvedTarget` bucket; the raw
 * id survives in the cell's examples, which is what makes such a dangling
 * reference actionable.
 * @param {string|null} value
 * @param {{ costTypeIds: Set<string>, characteristicTypeIds: Set<string>, constraintIds: Set<string> }} symbols
 * @returns {string}
 */
export function classifyModifierField(value, symbols) {
  if (value === null) return ABSENT;
  if (MODIFIER_LITERAL_FIELDS.includes(value)) return value;
  if (value.startsWith(LIMIT_PREFIX)) return 'limitValue';
  if (symbols.costTypeIds.has(value)) return 'costValue';
  if (symbols.characteristicTypeIds.has(value)) return 'characteristic';
  if (symbols.constraintIds.has(value)) return 'constraintValue';
  return 'unresolvedTarget';
}

/**
 * Buckets a repetition count: one repetition is a different path from several.
 * @param {string|null} value
 * @returns {string}
 */
function classifyRepeats(value) {
  if (value === null) return ABSENT;
  const count = Number(value);
  if (!Number.isFinite(count)) return ABSENT;
  return count > 1 ? 'gt1' : '1';
}

/**
 * True when a group sits inside another group of the same family — the
 * grandparent rule, since the list element (`conditionGroups` /
 * `modifierGroups`) always sits between the two groups.
 * @param {Element} element
 * @param {string} groupTag
 * @returns {boolean}
 */
function isNestedGroup(element, groupTag) {
  const grandparent = element.parentElement?.parentElement ?? null;
  return grandparent !== null && grandparent.tagName === groupTag;
}

/**
 * True when the element has a direct child with the given tag.
 * @param {Element} element
 * @param {string} tag
 * @returns {boolean}
 */
function hasChildTag(element, tag) {
  for (const child of element.children) {
    if (child.tagName === tag) return true;
  }
  return false;
}

/**
 * Counts direct children with the given tag.
 * @param {Element} element
 * @param {string} tag
 * @returns {number}
 */
function countChildTag(element, tag) {
  let count = 0;
  for (const child of element.children) {
    if (child.tagName === tag) count += 1;
  }
  return count;
}

/**
 * The tag chain from the document root down to the element, inclusive.
 * @param {Element} element
 * @returns {string[]}
 */
function tagPath(element) {
  /** @type {string[]} */
  const path = [];
  /** @type {Element|null} */
  let current = element;
  while (current !== null) {
    path.unshift(current.tagName);
    current = current.parentElement;
  }
  return path;
}

/**
 * The nearest ancestor carrying both `id` and `name` — the `selectionEntry`,
 * `entryLink`, `categoryEntry` or `forceEntry` a construct hangs on, which is
 * how a scenario author finds it again in the catalogue.
 * @param {Element} element
 * @returns {{ tag: string, id: string, name: string }|null}
 */
function namedAncestor(element) {
  /** @type {Element|null} */
  let current = element.parentElement;
  while (current !== null) {
    const id = attribute(current, 'id');
    const name = attribute(current, 'name');
    if (id !== null && name !== null) return { tag: current.tagName, id, name };
    current = current.parentElement;
  }
  return null;
}

/**
 * The message of a document's `parsererror`, or `null` when it parsed cleanly.
 * @param {Document} doc
 * @returns {string|null}
 */
export function parserErrorMessage(doc) {
  const errors = doc.getElementsByTagName(Tag.PARSER_ERROR);
  if (errors.length === 0) return null;
  const text = errors[0].textContent ?? '';
  return text.trim() === '' ? 'XML parsererror' : text.trim().split('\n')[0];
}

/**
 * Collects the corpus-wide symbol tables that turn a raw GUID in a `field`
 * attribute into a class. They are corpus-wide rather than per file because
 * cost types live in the `.gst` while the constraints that reference them
 * live in the `.cat`s.
 * @param {CellSource[]} sources
 * @returns {{ costTypeIds: Set<string>, characteristicTypeIds: Set<string>, constraintIds: Set<string> }}
 */
export function collectSymbols(sources) {
  const costTypeIds = new Set();
  const characteristicTypeIds = new Set();
  const constraintIds = new Set();
  const tables = [
    [Tag.COST_TYPE, costTypeIds],
    [Tag.CHARACTERISTIC_TYPE, characteristicTypeIds],
    [Tag.CONSTRAINT, constraintIds],
  ];
  for (const { doc } of sources) {
    for (const [tag, table] of tables) {
      const elements = doc.getElementsByTagName(/** @type {string} */ (tag));
      for (const element of elements) {
        const id = attribute(element, 'id');
        if (id !== null) /** @type {Set<string>} */ (table).add(id);
      }
    }
  }
  return { costTypeIds, characteristicTypeIds, constraintIds };
}

/**
 * Builds the cell key of a constraint and the structured axes behind it.
 * @param {Element} element
 * @param {{ costTypeIds: Set<string> }} symbols
 */
function constraintCell(element, symbols) {
  const type = attribute(element, 'type') ?? ABSENT;
  const rawField = attribute(element, 'field');
  const rawScope = attribute(element, 'scope');
  const axes = {
    type,
    field: classifyCountedField(rawField, symbols.costTypeIds),
    scope: classifyScope(rawScope),
    shared: flag(element, 'shared'),
    includeChildSelections: flag(element, 'includeChildSelections'),
    includeChildForces: flag(element, 'includeChildForces'),
    percentValue: flag(element, 'percentValue'),
  };
  const key = [
    CellKind.CONSTRAINT,
    axes.type,
    axes.field,
    axes.scope,
    `s=${axes.shared}`,
    `ics=${axes.includeChildSelections}`,
    `icf=${axes.includeChildForces}`,
    `pct=${axes.percentValue}`,
  ].join('|');
  return { key, kind: CellKind.CONSTRAINT, axes, raw: { type, field: rawField, scope: rawScope } };
}

/**
 * Builds the cell key of a condition.
 * @param {Element} element
 * @param {{ costTypeIds: Set<string> }} symbols
 */
function conditionCell(element, symbols) {
  const type = attribute(element, 'type') ?? ABSENT;
  const rawField = attribute(element, 'field');
  const rawScope = attribute(element, 'scope');
  const rawChildId = attribute(element, 'childId');
  const axes = {
    type,
    scope: classifyScope(rawScope),
    field: classifyCountedField(rawField, symbols.costTypeIds),
    childId: classifyChildId(rawChildId),
  };
  const key = [CellKind.CONDITION, axes.type, axes.scope, axes.field, `child=${axes.childId}`].join('|');
  return {
    key,
    kind: CellKind.CONDITION,
    axes,
    raw: { type, field: rawField, scope: rawScope, childId: rawChildId },
  };
}

/**
 * Builds the cell key of a repeat.
 * @param {Element} element
 * @param {{ costTypeIds: Set<string> }} symbols
 */
function repeatCell(element, symbols) {
  const rawField = attribute(element, 'field');
  const rawScope = attribute(element, 'scope');
  const rawChildId = attribute(element, 'childId');
  const rawRepeats = attribute(element, 'repeats');
  const axes = {
    field: classifyCountedField(rawField, symbols.costTypeIds),
    scope: classifyScope(rawScope),
    childId: classifyChildId(rawChildId),
    repeats: classifyRepeats(rawRepeats),
    shared: flag(element, 'shared'),
    includeChildSelections: flag(element, 'includeChildSelections'),
    includeChildForces: flag(element, 'includeChildForces'),
    roundUp: flag(element, 'roundUp'),
    percentValue: flag(element, 'percentValue'),
  };
  const key = [
    CellKind.REPEAT,
    axes.field,
    axes.scope,
    `child=${axes.childId}`,
    `repeats=${axes.repeats}`,
    `s=${axes.shared}`,
    `ics=${axes.includeChildSelections}`,
    `icf=${axes.includeChildForces}`,
    `roundUp=${axes.roundUp}`,
    `pct=${axes.percentValue}`,
  ].join('|');
  return {
    key,
    kind: CellKind.REPEAT,
    axes,
    raw: { field: rawField, scope: rawScope, childId: rawChildId, repeats: rawRepeats },
  };
}

/**
 * Builds the cell key of a modifier.
 * @param {Element} element
 * @param {{ costTypeIds: Set<string>, characteristicTypeIds: Set<string>, constraintIds: Set<string> }} symbols
 */
function modifierCell(element, symbols) {
  const type = attribute(element, 'type') ?? ABSENT;
  const rawField = attribute(element, 'field');
  const axes = { type, targetField: classifyModifierField(rawField, symbols) };
  const key = [CellKind.MODIFIER, axes.type, axes.targetField].join('|');
  return { key, kind: CellKind.MODIFIER, axes, raw: { type, field: rawField } };
}

/**
 * Builds the cell key of a conditionGroup.
 * @param {Element} element
 */
function conditionGroupCell(element) {
  const type = attribute(element, 'type') ?? ABSENT;
  const nested = isNestedGroup(element, Tag.CONDITION_GROUP);
  const axes = { type, nesting: nested ? 'nested' : 'top' };
  const key = [CellKind.CONDITION_GROUP, axes.type, axes.nesting].join('|');
  return { key, kind: CellKind.CONDITION_GROUP, axes, raw: { type } };
}

/**
 * Builds the cell key of a modifierGroup.
 * @param {Element} element
 */
function modifierGroupCell(element) {
  const axes = {
    conditional: hasChildTag(element, Tag.CONDITIONS) || hasChildTag(element, Tag.CONDITION_GROUPS),
    repeats: hasChildTag(element, Tag.REPEATS),
    nested: isNestedGroup(element, Tag.MODIFIER_GROUP),
  };
  const key = [
    CellKind.MODIFIER_GROUP,
    `cond=${axes.conditional}`,
    `repeats=${axes.repeats}`,
    `nested=${axes.nested}`,
  ].join('|');
  return { key, kind: CellKind.MODIFIER_GROUP, axes, raw: {} };
}

/**
 * Builds the cell key of a `<repeats>` list — the axis that tells one repeat
 * apart from several in the same list.
 * @param {Element} element
 */
function repeatListCell(element) {
  const count = countChildTag(element, Tag.REPEAT);
  const on = element.parentElement === null ? ABSENT : element.parentElement.tagName;
  const axes = { count: count > 1 ? 'gt1' : '1', on };
  const key = [CellKind.REPEAT_LIST, `n=${axes.count}`, `on=${axes.on}`].join('|');
  return { key, kind: CellKind.REPEAT_LIST, axes, raw: { count, on } };
}

/**
 * Which builder handles which tag, in the order the inventory walks them.
 * @type {ReadonlyArray<[string, (element: Element, symbols: any) => { key: string, kind: string, axes: any, raw: any }]>}
 */
const CELL_BUILDERS = Object.freeze([
  [Tag.CONSTRAINT, constraintCell],
  [Tag.CONDITION, conditionCell],
  [Tag.CONDITION_GROUP, conditionGroupCell],
  [Tag.MODIFIER, modifierCell],
  [Tag.MODIFIER_GROUP, modifierGroupCell],
  [Tag.REPEAT, repeatCell],
  [Tag.REPEATS, repeatListCell],
]);

/**
 * Classifies every rule construct of every document into cells.
 *
 * A document whose parse produced a `parsererror` is reported in `failures`
 * and contributes nothing — reporting zero cells for it silently would turn a
 * broken file into an apparently clean one.
 *
 * @param {CellSource[]} sources
 * @returns {Inventory} the cells in first-encounter order, the failures, and a
 *   file-keyed id→key index of every constraint, which is what lets a scenario
 *   manifest's `limitId` be resolved to the cell it exercises in the very files
 *   that scenario loads. A repeated id inside one file is last-wins; a dataset
 *   guarantees id uniqueness, and the frozen corpus holds no such case.
 */
export function extractCells(sources) {
  /** @type {CellFailure[]} */
  const failures = [];
  /** @type {CellSource[]} */
  const usable = [];
  for (const source of sources) {
    const message = parserErrorMessage(source.doc);
    if (message === null) usable.push(source);
    else failures.push({ file: source.file, message });
  }

  const symbols = collectSymbols(usable);
  /** @type {Map<string, Cell>} */
  const cells = new Map();
  /** @type {ConstraintIndex} */
  const index = new Map();

  for (const { doc, file } of usable) {
    for (const [tag, build] of CELL_BUILDERS) {
      for (const element of doc.getElementsByTagName(tag)) {
        const built = build(element, symbols);
        const elementId = attribute(element, 'id');
        if (tag === Tag.CONSTRAINT && elementId !== null) {
          let fileIndex = index.get(file);
          if (fileIndex === undefined) {
            fileIndex = new Map();
            index.set(file, fileIndex);
          }
          fileIndex.set(elementId, built.key);
        }

        let cell = cells.get(built.key);
        if (cell === undefined) {
          cell = { key: built.key, kind: built.kind, axes: built.axes, occurrences: 0, files: {}, examples: [] };
          cells.set(built.key, cell);
        }
        cell.occurrences += 1;
        cell.files[file] = (cell.files[file] ?? 0) + 1;
        if (cell.examples.length < MAX_EXAMPLES) {
          cell.examples.push({
            file,
            id: elementId,
            ancestor: namedAncestor(element),
            path: tagPath(element),
            raw: built.raw,
          });
        }
      }
    }
  }

  for (const cell of cells.values()) cell.files = sortObjectKeys(cell.files);
  return { cells: [...cells.values()], failures, index };
}

/**
 * Rebuilds an object with its keys in ascending order, so the generated JSON
 * does not depend on the order the corpus happened to be walked in.
 * @param {Record<string, number>} source
 * @returns {Record<string, number>}
 */
function sortObjectKeys(source) {
  /** @type {Record<string, number>} */
  const sorted = {};
  for (const key of Object.keys(source).sort()) sorted[key] = source[key];
  return sorted;
}

/**
 * Derives covered cells from the existing E2E scenario manifests. Every
 * `rosters[].expect.firing[].limitId` and every `rosters[].expect.absent[]`
 * entry names a constraint the scenario pins; the constraint's cell is
 * therefore exercised. This is recomputed on every run rather than
 * transcribed, so it can never go stale.
 *
 * Every roster resolves its own ids against its own dataset —
 * `roster.dataset ?? manifest.dataset`, the override (never merge) rule the
 * manifest runner itself applies — so a scenario running against one fixture
 * set can never credit the other set's cell of the same constraint id.
 *
 * An id that resolves to no cell is reported as unmatched evidence, never
 * thrown: deadlocking the loop on bookkeeping is worse than a warning line.
 * Its `reason` tells the two failure modes apart. `unknown-id` names an id
 * that is no constraint anywhere in the corpus; `outside-dataset` names one
 * that is a corpus constraint no file of the roster's dataset holds, the alarm
 * that a scenario's dataset declaration and its expectations have drifted
 * apart.
 *
 * @param {Array<{ dir: string, dataset?: (Dataset|null), rosters?: Array<{ dataset?: (Dataset|null),
 *          expect?: { firing?: Array<{ limitId?: string }>, absent?: Array<string|{ limitId?: string, id?: string }> } }> }>} manifests
 * @param {ConstraintIndex} index
 * @returns {{ matched: Array<{ key: string, id: string, evidence: string }>,
 *   unmatched: Array<{ id: string, evidence: string, reason: string }> }}
 */
export function coveredKeysFromManifests(manifests, index) {
  /** @type {Map<string, { key: string, id: string, evidence: string }>} */
  const matched = new Map();
  /** @type {Map<string, { id: string, evidence: string, reason: string }>} */
  const unmatched = new Map();

  // Every constraint id the corpus holds in any file: what tells `unknown-id`
  // from `outside-dataset`.
  /** @type {Set<string>} */
  const corpusIds = new Set();
  for (const fileIndex of index.values()) for (const id of fileIndex.keys()) corpusIds.add(id);

  for (const manifest of manifests) {
    const evidence = manifest.dir;
    for (const roster of manifest.rosters ?? []) {
      const files = datasetFiles(roster?.dataset ?? manifest.dataset ?? null);
      const ids = [
        ...(roster.expect?.firing ?? []).map(entry => entry?.limitId),
        ...(roster.expect?.absent ?? []).map(entry =>
          typeof entry === 'string' ? entry : (entry?.limitId ?? entry?.id),
        ),
      ];
      for (const id of ids) {
        if (typeof id !== 'string' || id === '') continue;
        /** @type {Set<string>} */
        const keys = new Set();
        for (const file of files) {
          const key = index.get(file)?.get(id);
          if (key !== undefined) keys.add(key);
        }
        if (keys.size === 0) {
          unmatched.set(`${id} ${evidence}`, {
            id,
            evidence,
            reason: corpusIds.has(id)
              ? UnmatchedReason.OUTSIDE_DATASET
              : UnmatchedReason.UNKNOWN_ID,
          });
          continue;
        }
        for (const key of keys) matched.set(`${key} ${evidence}`, { key, id, evidence });
      }
    }
  }

  return { matched: [...matched.values()], unmatched: [...unmatched.values()] };
}

/**
 * Type guard for the string filters below: a plain arrow predicate does not
 * narrow the element type of the array it filters.
 *
 * @param {unknown} value
 * @returns {value is string}
 */
function isNonEmptyString(value) {
  return typeof value === 'string' && value !== '';
}

/**
 * Flattens one dataset declaration to the repo-relative files it names. The
 * paths a manifest carries are byte-identical to the ones the index is keyed
 * by, so a plain string match resolves them and no normalization is needed.
 * @param {Dataset|null} dataset
 * @returns {string[]}
 */
function datasetFiles(dataset) {
  if (dataset === null || typeof dataset !== 'object') return [];
  const files = [dataset.gameSystem, ...(dataset.catalogues ?? [])];
  return files.filter(isNonEmptyString);
}

/**
 * Reads the manual covered-cells record (`docs/testing/covered-cells.json`),
 * the second source of coverage next to the manifest-derived one, for cells
 * no manifest id can attest and for waived cells.
 *
 * An entry may carry `key: null` instead of a cell key: it records a
 * structural axis the cell space has none for (issue 0150) and credits no
 * cell, so only entries with a non-empty string key are returned.
 * @param {{ cells?: Array<{ key?: string|null }> }|null|undefined} record
 * @returns {string[]}
 */
export function keysFromCoveredRecord(record) {
  const entries = record?.cells ?? [];
  return entries.map(entry => entry?.key).filter(isNonEmptyString);
}

/**
 * Splits the inventory along a set of covered keys.
 *
 * A covered key that occurs nowhere in the inventory comes back as `stale`
 * rather than failing: the corpus may have changed under a record entry, and
 * that is a warning, not a reason to stop the loop.
 *
 * @param {Cell[]} cells
 * @param {string[]} coveredKeys
 * @returns {{ covered: Cell[], uncovered: Cell[], stale: string[] }}
 */
export function diffCells(cells, coveredKeys) {
  const covered = new Set(coveredKeys);
  const present = new Set(cells.map(cell => cell.key));
  return {
    covered: cells.filter(cell => covered.has(cell.key)),
    uncovered: cells.filter(cell => !covered.has(cell.key)),
    stale: [...covered].filter(key => !present.has(key)).sort(),
  };
}

/**
 * Orders cells by weight: the most frequent construct first, ties broken by
 * key so the generated worklist is byte-stable across runs and machines.
 * @param {Cell[]} cells
 * @returns {Cell[]}
 */
export function sortCells(cells) {
  return [...cells].sort((a, b) =>
    b.occurrences - a.occurrences || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  );
}

/**
 * The exit code of a coverage run: a non-empty worklist is the open work of
 * the campaign and therefore a non-zero exit.
 * @param {unknown[]} worklist
 * @returns {number}
 */
export function exitCodeFor(worklist) {
  return worklist.length > 0 ? 1 : 0;
}
