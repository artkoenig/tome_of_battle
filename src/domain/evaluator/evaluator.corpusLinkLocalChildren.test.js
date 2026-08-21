/**
 * Issue 0150, increment 2 — the corpus-wide invariant for children an
 * `entryLink` declares itself.
 *
 * Per `Catalogue.xsd` an `EntryLink` (lines 396-406) extends
 * `SelectionEntryBase` (lines 274-287): both a plain `selectionEntry` and a
 * link carry their own `selectionEntries` / `selectionEntryGroups` /
 * `entryLinks` containers. `docs/battlescribe-data-format.md` §7.1/§7.2
 * describe the same shape in prose. Those locally declared children stand at
 * the usage site of the link itself, alongside whatever its resolved target
 * carries — real case: the Empire Captain's "Mounts" group links the shared
 * "Empire Warhorse" entry (`f817-432b-7c1a-a8ca`), and hangs "Barding"
 * (`0535-f68e-b9bc-749b`) on the LINK, not on the shared target. PR #214
 * fixed `ownerDefinitionOf` (`evalTree.js`) to union the two; before that fix
 * every one of these locally declared children was invisible to every
 * traversal that goes through it, so no report slot existed for it.
 *
 * Increment 1 checked this for one catalogue (The Empire, definitive) only.
 * This file is the corpus-wide check the issue actually asks for: it derives,
 * from the raw XML of BOTH corpora — `src/domain/evaluator/__fixtures__/whfb6-definitive`
 * (11 catalogues) and `src/shared/__fixtures__/whfb6` (4 catalogues) — never from any
 * engine module other than the facade (`prepareDataset` + `evaluate`, ADR
 * 0030, ADR 0033), every `entryLink` that declares its own children across
 * all 15 catalogue files, and asserts that a roster holding that link gets a
 * report slot for each of those children under the link's own slot.
 * Existence is the whole claim (criterion 3 of the issue): `isHidden` is
 * never asserted.
 *
 * Every catalogue of a corpus is loaded together in ONE `prepareDataset`
 * call per corpus, so a link whose own children resolve only through another
 * catalogue of the same corpus (e.g. the Empire's "Battle Standard Bearer"
 * pulling banners out of the Mercenaries library) is addressable — increment
 * 1 loaded the Empire catalogue alone and left that `catalogueLink`
 * unresolved.
 *
 * Occurrences this check cannot address are RECORDED with a reason instead
 * of being silently skipped (issue criterion 2); today's corpus has none, but
 * the detectors exist and run unconditionally. Not addressed here: the
 * pre-PR-#214 red demonstration (issue criterion 4 — increment 1 did it and
 * it is not repeated), and the campaign's own bookkeeping and documentation
 * (issue criteria 6 and 7 — increment 3).
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, it, expect, beforeAll } from 'vitest';

import { evaluate as evaluateDataset, prepareDataset, DiagnosticKind } from './evaluator.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;
const PARSER = new DOMParser();

const CORPORA = [
  { name: 'whfb6-definitive', dir: join(process.cwd(), 'src/domain/evaluator/__fixtures__/whfb6-definitive') },
  { name: 'whfb6', dir: join(process.cwd(), 'src/shared/__fixtures__/whfb6') },
];

// ─────────────────────────────────────────────────────────────────────────────
// XML-only helpers — no engine module beyond the facade is ever imported.
// ─────────────────────────────────────────────────────────────────────────────

/** All direct child elements of an element (no text nodes). */
function directChildElements(element) {
  return [...element.children];
}

/** The direct children of ONE named container (e.g. `entryLinks`) under `element`. */
function directContainerChildren(element, containerLocalName) {
  const container = directChildElements(element).find(child => child.localName === containerLocalName);
  return container ? directChildElements(container) : [];
}

/**
 * The children declared directly on an element across all three containers of
 * `SelectionEntryBase` (`Catalogue.xsd` lines 274-287): its own
 * `selectionEntries`, `selectionEntryGroups` and `entryLinks`. Holds for
 * `selectionEntry`, `selectionEntryGroup` AND `entryLink` alike, because
 * `EntryLink` (lines 396-406) extends exactly the same base.
 */
function directLocalChildren(element) {
  return [
    ...directContainerChildren(element, 'selectionEntries'),
    ...directContainerChildren(element, 'selectionEntryGroups'),
    ...directContainerChildren(element, 'entryLinks'),
  ];
}

/** An element carries own, locally declared children. */
function hasOwnLocalChildren(element) {
  return directLocalChildren(element).length > 0;
}

/**
 * The entry closure of the given child elements: the selectable entries that
 * are ultimately choosable at this location, as `{ id, targetId, name }`
 * records (`targetId` is `null` for a plain `selectionEntry`).
 *
 * - `selectionEntry` contributes its own id, `targetId: null`.
 * - `entryLink type="selectionEntry"` contributes the id of the LINK itself,
 *   never its target's (the same link-before-target principle the report
 *   follows for `sourceId` — `evaluator.js`, path-schema paragraph), with
 *   `targetId` set to the link's own `targetId` attribute.
 * - `selectionEntryGroup` contributes the closure of its own direct children.
 * - `entryLink type="selectionEntryGroup"` contributes the closure of its
 *   RESOLVED target's direct children, PLUS the closure of its own locally
 *   declared children (the same union as a `selectionEntry` link, one level
 *   deeper). A target that resolves in no loaded document is recorded in
 *   `missingTargets` instead of silently contributing nothing.
 *
 * `visited` guards against cycles; link and target are different DOM
 * elements, so a `Set` of element references keeps the two apart automatically.
 */
function entryClosureOf(children, idIndex) {
  const records = [];
  const missingTargets = new Set();
  const visited = new Set();

  function walk(nodes) {
    for (const child of nodes) {
      if (visited.has(child)) continue;
      visited.add(child);

      if (child.localName === 'selectionEntry') {
        records.push({ id: child.getAttribute('id'), targetId: null, name: child.getAttribute('name') });
      } else if (child.localName === 'selectionEntryGroup') {
        walk(directLocalChildren(child));
      } else if (child.localName === 'entryLink') {
        const type = child.getAttribute('type');
        if (type === 'selectionEntry') {
          records.push({ id: child.getAttribute('id'), targetId: child.getAttribute('targetId'), name: child.getAttribute('name') });
        } else if (type === 'selectionEntryGroup') {
          const targetId = child.getAttribute('targetId');
          const target = idIndex.get(targetId);
          if (target) {
            walk(directLocalChildren(target));
          } else {
            missingTargets.add(targetId);
          }
          walk(directLocalChildren(child));
        }
      }
    }
  }

  walk(children);
  return { records, missingTargets: [...missingTargets] };
}

/**
 * The FRAME of an occurrence: the link itself, if `type="selectionEntry"`;
 * otherwise (`type="selectionEntryGroup"`) the nearest ancestor that is a
 * `selectionEntry` or an `entryLink type="selectionEntry"` — the nearest
 * location a roster can actually occupy a slot at. `null` when no such
 * ancestor exists (no roster can legally hold the link).
 */
function frameOf(link) {
  if (link.getAttribute('type') === 'selectionEntry') return link;
  let ancestor = link.parentElement;
  while (ancestor) {
    if (ancestor.localName === 'selectionEntry') return ancestor;
    if (ancestor.localName === 'entryLink' && ancestor.getAttribute('type') === 'selectionEntry') return ancestor;
    ancestor = ancestor.parentElement;
  }
  return null;
}

/**
 * The ROSTER BRANCH of a frame, as plain ids (root-first): the frame's
 * `selectionEntry`/`entryLink` ancestors up to the catalogue root, plus the
 * frame itself last. A `selectionEntryGroup` ancestor has no roster node of
 * its own and is skipped.
 */
function rosterBranchOf(frame) {
  const ancestorIds = [];
  let ancestor = frame.parentElement;
  while (ancestor && ancestor.localName !== 'catalogue') {
    if (ancestor.localName === 'selectionEntry' || ancestor.localName === 'entryLink') {
      ancestorIds.push(ancestor.getAttribute('id'));
    }
    ancestor = ancestor.parentElement;
  }
  ancestorIds.reverse();
  ancestorIds.push(frame.getAttribute('id'));
  return ancestorIds;
}

/** Indexes every element with an `id` attribute across the given documents into a Map. */
function buildIdIndex(...documents) {
  const index = new Map();
  for (const document of documents) {
    for (const element of document.documentElement.querySelectorAll('[id]')) {
      index.set(element.getAttribute('id'), element);
    }
  }
  return index;
}

/**
 * The force this catalogue's roster is carried by: its own top-level
 * `forceEntry` if it declares one; else the corpus `.gst`'s `forceEntry`,
 * disambiguated with `catalogueId` set to this catalogue's own root id
 * (roster force nodes carry an optional `catalogueId`, see
 * `crossCatalog.rosterDeclaredCatalogue.test.js`); else the first force any
 * catalogue of the corpus declares, same disambiguation — the only file that
 * reaches this third branch today is Mercenaries (definitive), which gets
 * Bretonnia's `3a8b-8c11-beff-0534`. `forceId` is `undefined` when none of
 * the three applies anywhere in the corpus (today: never).
 */
function resolveForce(catalogueDocument, gstForceEntries, firstAnyForceId) {
  const rootId = catalogueDocument.documentElement.getAttribute('id');
  const ownForce = catalogueDocument.getElementsByTagNameNS('*', 'forceEntry')[0];
  if (ownForce) return { forceId: ownForce.getAttribute('id'), catalogueId: undefined };
  if (gstForceEntries.length > 0) return { forceId: gstForceEntries[0].getAttribute('id'), catalogueId: rootId };
  if (firstAnyForceId) return { forceId: firstAnyForceId, catalogueId: rootId };
  return { forceId: undefined, catalogueId: undefined };
}

/** Builds the nested roster structure (a single chain of count-1 nodes) from a root-first id branch. */
function branchToRosterChild(branchIds) {
  let node = { defId: branchIds[branchIds.length - 1], count: 1, children: [] };
  for (let i = branchIds.length - 2; i >= 0; i -= 1) {
    node = { defId: branchIds[i], count: 1, children: [node] };
  }
  return node;
}

/**
 * The frame path of an occurrence, per the facade's own path schema
 * (`evaluate` JSDoc, `evaluator.js`): the force sits at `"0"`, branch `i`
 * starts under `"0/i"`, and every further level of the branch appends `"/0"`
 * — occupied slots follow the roster's input order, and every branch is the
 * only, hence first, child at every level.
 */
function framePathOf(occurrenceIndex, branchLength) {
  let path = `0/${occurrenceIndex}`;
  for (let level = 1; level < branchLength; level += 1) path += '/0';
  return path;
}

/** The `{ defId, targetDefId }` of every slot exactly one level below `framePath`. */
function childSlotsAt(report, framePath) {
  const frameDepth = framePath.split('/').length;
  const slots = [];
  for (const [key, capability] of report.capabilities) {
    if (!key.startsWith(`${framePath}/`)) continue;
    if (key.split('/').length !== frameDepth + 1) continue;
    slots.push({ defId: capability.defId, targetDefId: capability.targetDefId });
  }
  return slots;
}

/**
 * Whether one of `slots` carries one of `ids` as its OWN `defId` — never by
 * `targetDefId`, which is shared across every link that resolves to the same
 * target and would let a slot belonging to a different link satisfy the
 * claim. `ids` holds more than one id only for a group of children of one
 * occurrence's closure that resolve to the same shared target (see
 * `groupByTargetIdentity`); for a normal, ungrouped child it is a
 * single-element array.
 */
function hasSlotForOneOf(slots, ids) {
  return slots.some(slot => ids.includes(slot.defId));
}

/**
 * Groups an occurrence's `expected` children by target identity: children
 * that share a non-null `targetId` land in the same group. Such children need
 * not be siblings and need not be declared on the link itself: the corpus has
 * exactly this for three Forces of Chaos occurrences, where two children
 * reached through the shared 'Magic Banners' group a979-ec7a-7a45-f11b — from
 * two different groups within its closure — resolve to the same target. A child
 * with no `targetId` (a plain `selectionEntry`) is always alone in its own
 * group, keyed by its own id. A group of size 1 is asserted by its single id;
 * a group of size > 1 is asserted as "one of these ids has a slot" (the
 * engine gives such a pair a single report slot, and which member's id it
 * carries is its own internal choice, not this check's to pin) and every one
 * of its members is recorded as shadowed instead of individually asserted.
 */
function groupByTargetIdentity(expected) {
  const groups = new Map();
  for (const child of expected) {
    const key = child.targetId !== null ? `target:${child.targetId}` : `id:${child.id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(child);
  }
  return [...groups.values()].map(members => ({
    ids: members.map(member => member.id),
    members,
    sharedTargetId: members[0].targetId,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// DERIVATION — module top level, from the raw XML of both corpora only. Not
// cheap for 17 documents (measured ~6 s), unlike the two-document case
// increment 1 built this pattern from; still runs outside `beforeAll` because
// it needs no engine pass. Every DOM document, element and index reference is
// local to `deriveCorpus` and is dropped once it returns — only plain data
// (strings, arrays, plain objects) survives into `DERIVED`.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derives one corpus: reads every `.cat`/`.gst` in `dir`, builds one id index
 * over the `.gst` plus all `.cat`s (first document wins), then classifies
 * every `entryLink` with own local children as either a checkable occurrence
 * or a RECORDED, unaddressable one (issue criterion 2):
 *
 * - no frame (`frameOf` returns `null`) — no roster can legally hold the link;
 * - no force resolves for its catalogue (`resolveForce` returns `undefined`)
 *   — the carrier is not reachable from a force;
 * - its own closure hits a `targetId` that resolves in no loaded document —
 *   the target needs a catalogue this dataset does not load.
 *
 * All three are empty on today's corpus; they run unconditionally regardless.
 */
function deriveCorpus(corpusName, dir) {
  const entryNames = readdirSync(dir)
    .filter(name => name.endsWith('.cat') || name.endsWith('.gst'))
    .sort();
  const gstName = entryNames.find(name => name.endsWith('.gst'));
  const catNames = entryNames.filter(name => name.endsWith('.cat'));

  const gstXml = readFileSync(join(dir, gstName), 'utf8');
  const gstDocument = PARSER.parseFromString(gstXml, 'text/xml');

  const catTexts = catNames.map(file => ({ file, xml: readFileSync(join(dir, file), 'utf8') }));
  const catDocuments = catTexts.map(({ file, xml }) => ({ file, document: PARSER.parseFromString(xml, 'text/xml') }));

  const idIndex = buildIdIndex(gstDocument, ...catDocuments.map(c => c.document));

  const gstForceEntries = [...gstDocument.getElementsByTagNameNS('*', 'forceEntry')];
  let firstAnyForceId;
  for (const { document } of catDocuments) {
    const force = document.getElementsByTagNameNS('*', 'forceEntry')[0];
    if (force) {
      firstAnyForceId = force.getAttribute('id');
      break;
    }
  }

  const gstEntryLinksWithOwnChildren = [...gstDocument.getElementsByTagNameNS('*', 'entryLink')].filter(
    hasOwnLocalChildren,
  ).length;

  const perFileCounts = {};
  // A second, independent tally of the same population as perFileCounts,
  // reached by a CSS selector over the raw document instead of the
  // getElementsByTagNameNS + directLocalChildren walk below: an entryLink
  // that owns at least one non-empty selectionEntries/selectionEntryGroups/
  // entryLinks container, counted once per entryLink id. Shares no code path
  // with hasOwnLocalChildren/directLocalChildren.
  const perFileSelectorCounts = {};
  const occurrences = [];
  const occurrencesByFile = new Map();
  const recorded = [];
  const shadowed = [];
  const forceByFile = new Map();

  for (const { file, document } of catDocuments) {
    const { forceId, catalogueId } = resolveForce(document, gstForceEntries, firstAnyForceId);
    forceByFile.set(file, { forceId, catalogueId });
    occurrencesByFile.set(file, []);

    const selectorCountedIds = new Set(
      [...document.querySelectorAll('entryLink > selectionEntries, entryLink > selectionEntryGroups, entryLink > entryLinks')]
        .filter(container => container.children.length > 0)
        .map(container => container.parentElement.getAttribute('id')),
    );
    if (selectorCountedIds.size > 0) perFileSelectorCounts[file] = selectorCountedIds.size;

    const links = [...document.getElementsByTagNameNS('*', 'entryLink')];
    for (const link of links) {
      if (!hasOwnLocalChildren(link)) continue;
      const id = link.getAttribute('id');
      const name = link.getAttribute('name');
      perFileCounts[file] = (perFileCounts[file] ?? 0) + 1;

      const frame = frameOf(link);
      if (!frame) {
        recorded.push({ corpus: corpusName, file, id, name, reason: 'no roster can legally hold this link — it has no selectable frame in its ancestor chain' });
        continue;
      }

      if (!forceId) {
        recorded.push({ corpus: corpusName, file, id, name, reason: 'the carrier is not reachable from a force — no forceEntry resolves for this catalogue' });
        continue;
      }

      const { records: expected, missingTargets } = entryClosureOf(directLocalChildren(link), idIndex);
      if (missingTargets.length > 0) {
        recorded.push({
          corpus: corpusName,
          file,
          id,
          name,
          reason: `the target needs a catalogue this dataset does not load (target ${missingTargets[0]})`,
        });
        continue;
      }

      const expectedGroups = groupByTargetIdentity(expected);
      for (const group of expectedGroups) {
        if (group.members.length <= 1) continue;
        for (const member of group.members) {
          shadowed.push({
            file,
            linkId: id,
            childId: member.id,
            target: group.sharedTargetId,
            reason: 'two children in this occurrence\'s closure resolve to the same shared target — only the group as a whole is asserted, not this id individually',
          });
        }
      }

      const occurrence = {
        corpus: corpusName,
        file,
        id,
        name,
        frameId: frame.getAttribute('id'),
        branch: rosterBranchOf(frame),
        expected,
        expectedGroups,
      };
      occurrences.push(occurrence);
      occurrencesByFile.get(file).push(occurrence);
    }
  }

  return {
    corpus: corpusName,
    gstXml,
    catTexts,
    perFileCounts,
    perFileSelectorCounts,
    occurrences,
    occurrencesByFile,
    recorded,
    shadowed,
    forceByFile,
    gstEntryLinksWithOwnChildren,
  };
}

const DERIVED = CORPORA.map(corpus => deriveCorpus(corpus.name, corpus.dir));

const ALL_OCCURRENCES = DERIVED.flatMap(d => d.occurrences);
const ALL_RECORDED = DERIVED.flatMap(d => d.recorded);

// The list of children a link declares locally, one level below its own
// count (issue Log, third point): most children sit alone in their target
// identity group and are asserted individually; a handful share a target
// identity with a child reached from a DIFFERENT group within the same
// occurrence's closure — neither siblings nor both declared on the link
// itself (see `groupByTargetIdentity`; the corpus case is three Forces of
// Chaos occurrences sharing the "Magic Banners" closure) — and are asserted
// as a group instead: those are recorded in ALL_SHADOWED rather than counted
// individually, so this book closes too, separately from the occurrence book.
const DERIVED_CHILD_TOTAL = ALL_OCCURRENCES.reduce((sum, occurrence) => sum + occurrence.expected.length, 0);
const ALL_SHADOWED = DERIVED.flatMap(d => d.shadowed).sort(
  (a, b) => a.file.localeCompare(b.file) || a.linkId.localeCompare(b.linkId) || a.childId.localeCompare(b.childId),
);
// A child is counted here only when it is alone in its occurrence's target
// identity group (`groupByTargetIdentity`); a member of a group of size > 1
// is booked in ALL_SHADOWED instead (see above), never both.
const INDIVIDUALLY_ASSERTED_CHILDREN = ALL_OCCURRENCES.reduce(
  (sum, occurrence) => sum + occurrence.expectedGroups.filter(group => group.members.length === 1).length,
  0,
);

const PER_FILE_COUNTS = {};
for (const d of DERIVED) Object.assign(PER_FILE_COUNTS, d.perFileCounts);

const PER_FILE_SELECTOR_COUNTS = {};
for (const d of DERIVED) Object.assign(PER_FILE_SELECTOR_COUNTS, d.perFileSelectorCounts);

// Taken BEFORE classification into checkable occurrence vs. recorded
// (unaddressable) entry — deriveCorpus increments perFileCounts for every
// entryLink with own local children, ahead of the frame/force/target checks
// that sort it into one book or the other — so this total is pinned against
// the pre-classification source, never against the sum of the two books
// themselves, which would close by construction and prove nothing.
const DERIVED_TOTAL = Object.values(PER_FILE_COUNTS).reduce((sum, count) => sum + count, 0);

const CONTRIBUTING_FILES = Object.keys(PER_FILE_COUNTS);

// The frozen table from Issue 0150's intent section, re-derived above rather
// than assumed — a drift here names its file via a deep-equal failure.
const EXPECTED_PER_FILE_COUNTS = {
  'Bretonnia (6th definitive edition).cat': 13,
  'Dark Elves (6th definitive edition).cat': 1,
  'Dwarfs (2005) (6th definitive edition).cat': 5,
  'Forces of Chaos (6th definitive edition).cat': 29,
  // Issue 0153: das Hoch-Elfen-Buch kam fuer das Szenario
  // docs/testing/shared-entry-roster-min-hero-option in den Korpus; seine vier
  // Vorkommen sind wie alle anderen hier aus dem Korpus hergeleitet, nicht aus
  // der Issue-0150-Tabelle uebernommen (die 149 nannte, ohne dieses Buch).
  'High Elves (6th definitive edition).cat': 4,
  'Lizardmen (6th definitive edition).cat': 7,
  'Mercenaries (6th definitive edition).cat': 2,
  'Ogre Kingdoms (6th definitive edition).cat': 3,
  'Orcs and goblins (6th definitive edition).cat': 9,
  'Skaven (6th definitive edition).cat': 12,
  'The Empire (6th definitive edition).cat': 31,
  'Vampire Counts (6th definitive edition).cat': 16,
  'Dogs of War.cat': 5,
  'Ogre Kingdoms.cat': 1,
  'Orcs and Goblins.cat': 5,
  'Vampire Counts.cat': 10,
};

// ─────────────────────────────────────────────────────────────────────────────
// ENGINE — one `prepareDataset` per corpus, in ONE `beforeAll`; every
// catalogue of a corpus is loaded together, so cross-catalogue targets (e.g.
// Mercenaries banners pulled into the Empire's Battle Standard Bearer)
// resolve. Each occurrence is reduced, before the loop moves on, to only the
// two things a case needs — the frame's `defId` at its report path, and the
// `{ defId, targetDefId }` list of slots one level below it — plus the
// per-file `UNRESOLVED_DEFINITION` diagnostic count; `prepared` and `report`
// are local to this function and go out of scope once it returns.
// ─────────────────────────────────────────────────────────────────────────────

const REDUCED_BY_KEY = new Map();
const DIAGNOSTIC_COUNTS = new Map();

beforeAll(() => {
  for (const corpus of DERIVED) {
    const prepared = prepareDataset({
      gameSystem: corpus.gstXml,
      catalogues: corpus.catTexts.map(c => c.xml),
    });

    for (const { file } of corpus.catTexts) {
      const occurrencesForFile = corpus.occurrencesByFile.get(file) ?? [];
      const { forceId, catalogueId } = corpus.forceByFile.get(file);

      const force = {
        defId: forceId,
        count: 1,
        children: occurrencesForFile.map(occurrence => branchToRosterChild(occurrence.branch)),
      };
      if (catalogueId) force.catalogueId = catalogueId;

      const report = evaluateDataset(prepared, { forces: [force] });

      occurrencesForFile.forEach((occurrence, index) => {
        const path = framePathOf(index, occurrence.branch.length);
        const frameCapability = report.capabilities.get(path);
        REDUCED_BY_KEY.set(`${file}::${occurrence.id}`, {
          frameDefId: frameCapability?.defId,
          childSlots: childSlotsAt(report, path),
        });
      });

      const unresolved = report.diagnostics.filter(diagnostic => diagnostic.kind === DiagnosticKind.UNRESOLVED_DEFINITION).length;
      DIAGNOSTIC_COUNTS.set(file, unresolved);
    }
  }
}, 120_000);

// ─────────────────────────────────────────────────────────────────────────────
// A — KONTROLLE: coverage of all 15 files, total re-derived from the corpus.
// ─────────────────────────────────────────────────────────────────────────────

describe('Beide Korpora: Verweise mit eigenen lokalen Kindern (Issue 0150, Kriterium 1 des Inkrements)', () => {
  it(
    'KONTROLLE: die pro Datei hergeleitete Anzahl entspricht der eingefrorenen Tabelle (153 insgesamt, aus dem Korpus selbst hergeleitet)',
    () => {
      expect(
        PER_FILE_COUNTS,
        `Die Zahlen sind aus dem Korpus hergeleitet, nicht aus der Issue-Tabelle uebernommen; die Issue-0150-Tabelle nannte 149 insgesamt, vor dem Hoch-Elfen-Buch (Issue 0153).`,
      ).toEqual(EXPECTED_PER_FILE_COUNTS);
    },
  );

  it('KONTROLLE: die hergeleitete Gesamtzahl ist 153, aus 16 beitragenden Dateien', () => {
    expect(DERIVED_TOTAL).toBe(153);
    expect(CONTRIBUTING_FILES).toHaveLength(16);
  });

  it('KONTROLLE: eine zweite, unabhaengige Herleitung ueber CSS-Selektoren stimmt mit der Baum-Traversierung ueberein (ebenfalls 153)', () => {
    expect(PER_FILE_SELECTOR_COUNTS).toEqual(PER_FILE_COUNTS);
    expect(Object.values(PER_FILE_SELECTOR_COUNTS).reduce((sum, count) => sum + count, 0)).toBe(153);
  });

  it('KONTROLLE: keine der beiden .gst-Dateien haelt einen Verweis mit eigenen lokalen Kindern', () => {
    for (const d of DERIVED) {
      expect(d.gstEntryLinksWithOwnChildren, `${d.corpus}: .gst-Datei traegt eigene lokale Kinder`).toBe(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B — the invariant, one case per occurrence (issue criteria 1, 3 and 5).
// ─────────────────────────────────────────────────────────────────────────────

describe('Das Invariante: jedes Vorkommen bekommt einen Slot fuer jedes eigene lokal deklarierte Kind', () => {
  it.each(ALL_OCCURRENCES)('$corpus :: $file :: Verweis $id ($name) bekommt einen Slot fuer jedes eigene lokal deklarierte Kind', occurrence => {
    const reduced = REDUCED_BY_KEY.get(`${occurrence.file}::${occurrence.id}`);
    expect(reduced, `Kein reduziertes Ergebnis fuer ${occurrence.file}::${occurrence.id}`).toBeDefined();

    // Self-check: the path arithmetic actually hit this occurrence's frame —
    // otherwise the child checks below would be worthless.
    expect(
      reduced.frameDefId,
      `Rahmen ${occurrence.id} (${occurrence.name}) in ${occurrence.file} liegt nicht am erwarteten Pfad`,
    ).toBe(occurrence.frameId);

    for (const group of occurrence.expectedGroups) {
      expect(
        hasSlotForOneOf(reduced.childSlots, group.ids),
        `Verweis ${occurrence.id} (${occurrence.name}) in ${occurrence.file}: kein Slot fuer eines von [${group.ids.join(', ')}]`,
      ).toBe(true);
    }
  });

  it('KONTROLLE: ein Slot zaehlt nur ueber seine eigene defId, nicht ueber ein geteiltes Ziel', () => {
    expect(hasSlotForOneOf([{ defId: 'x', targetDefId: 't' }], ['y'])).toBe(false);
    expect(hasSlotForOneOf([{ defId: 'y', targetDefId: 't' }], ['y'])).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C — the two named cases from increment 1, against the definitive Empire
// catalogue (issue Log, third point).
// ─────────────────────────────────────────────────────────────────────────────

describe('Die beiden benannten Faelle (der Defekt, den PR #214 behob)', () => {
  const EMPIRE_FILE = 'The Empire (6th definitive edition).cat';

  it('Captain -> Empire Warhorse -> Barding: der Verweis auf das geteilte Ross traegt seine eigene Barding-Option', () => {
    const occurrence = ALL_OCCURRENCES.find(candidate => candidate.file === EMPIRE_FILE && candidate.id === 'f817-432b-7c1a-a8ca');
    expect(occurrence, 'Verweis "Empire Warhorse" fehlt in der Herleitung').toBeDefined();
    expect(occurrence.branch).toEqual([
      '6686-1f55-dee3-1bcf', // Captain
      'f817-432b-7c1a-a8ca', // Empire Warhorse
    ]);
    expect(occurrence.expected.map(child => child.id)).toEqual(['0535-f68e-b9bc-749b']); // Barding

    const reduced = REDUCED_BY_KEY.get(`${EMPIRE_FILE}::f817-432b-7c1a-a8ca`);
    expect(reduced.frameDefId).toBe('f817-432b-7c1a-a8ca');
    expect(hasSlotForOneOf(reduced.childSlots, [occurrence.expected[0].id])).toBe(true);
  });

  it('Captain -> Battle Standard Bearer -> Magic Banners: der Verweis traegt alle 16 lokal deklarierten Banner (nicht 12 — Mercenaries ist jetzt geladen)', () => {
    const occurrence = ALL_OCCURRENCES.find(candidate => candidate.file === EMPIRE_FILE && candidate.id === 'c9fc-265e-8fa8-b814');
    expect(occurrence, 'Verweis "Battle Standard Bearer" fehlt in der Herleitung').toBeDefined();
    expect(occurrence.branch).toEqual([
      '6686-1f55-dee3-1bcf', // Captain
      'c9fc-265e-8fa8-b814', // Battle Standard Bearer
    ]);
    expect(occurrence.expected).toHaveLength(16);
    const expectedIds = occurrence.expected.map(child => child.id);
    expect(expectedIds).toEqual(
      expect.arrayContaining([
        '14b9-9df2-f13c-f31b', // Imperial Banner
        'fa36-4375-131c-3d91', // War Banner
        '7b77-57e3-700b-4bbb', // Banner of Middenheim
        '02c7-11f9-735b-833a', // Totem of Prophecy (Relics of Lustria)
        '1521-23cc-50b1-92ef', // Jaguar Standard (Relics of Lustria)
        'c21f-f4f9-f1cf-22cd', // Huanchi's Blessed Totem (Relics of Lustria)
        '5746-a208-618b-71f6', // Sun Standard of Chotec (Relics of Lustria)
      ]),
    );

    const reduced = REDUCED_BY_KEY.get(`${EMPIRE_FILE}::c9fc-265e-8fa8-b814`);
    expect(reduced.frameDefId).toBe('c9fc-265e-8fa8-b814');
    for (const expectedChild of occurrence.expected) {
      expect(
        hasSlotForOneOf(reduced.childSlots, [expectedChild.id]),
        `Battle Standard Bearer: kein Slot fuer eigenes Kind ${expectedChild.id}`,
      ).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// D — the books (issue criterion 2 of the increment).
// ─────────────────────────────────────────────────────────────────────────────

describe('Die Buecher schliessen: erfasst + geprueft = hergeleitete Gesamtzahl', () => {
  it('erfasste Vorkommen plus geprueftes Invariant ergeben die hergeleitete Gesamtzahl, und diese ist 153', () => {
    // DERIVED_TOTAL: the pre-classification tally (PER_FILE_COUNTS, itself
    // corpus-derived, and cross-checked above against the independent
    // selector-based tally). ALL_RECORDED.length + ALL_OCCURRENCES.length: the
    // sum of the two books that classification produces from that tally.
    // EXPECTED_PER_FILE_COUNTS: the frozen table from the issue, independent
    // of both.
    expect(DERIVED_TOTAL).toBe(153);
    expect(ALL_RECORDED.length + ALL_OCCURRENCES.length).toBe(DERIVED_TOTAL);
    expect(DERIVED_TOTAL).toBe(Object.values(EXPECTED_PER_FILE_COUNTS).reduce((sum, count) => sum + count, 0));
  });

  it('jeder erfasste (nicht pruefbare) Eintrag traegt einen nicht-leeren Grund, eine Datei und eine Id', () => {
    for (const entry of ALL_RECORDED) {
      expect(entry.file, 'erfasster Eintrag ohne Datei').toBeTruthy();
      expect(entry.id, 'erfasster Eintrag ohne Id').toBeTruthy();
      expect(entry.reason, `erfasster Eintrag ${entry.id} ohne Grund`).toBeTruthy();
    }
  });

  // Today this OCCURRENCE level is empty: that is the state loading every
  // catalogue of a corpus together (see the file header) buys, not a claim
  // that an unaddressable occurrence would be a failure — a future entry
  // prints here in full, with its reason. The CHILD book — the shadowed
  // children of individually addressable occurrences — closes separately
  // below.
  it('KONTROLLE: die Liste der nicht pruefbaren Vorkommen (Ebene der Vorkommen selbst) ist heute leer', () => {
    expect(ALL_RECORDED).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// D2 — the child book: the derived child count closes separately from the
// occurrence level above, because an occurrence can itself be addressable
// while INDIVIDUAL children of its closure — because they share a target
// identity with a child reached from a different group of the same closure,
// neither siblings nor both declared on the link itself — are not addressed
// individually, only as a group (see `groupByTargetIdentity`).
// ─────────────────────────────────────────────────────────────────────────────

describe('Die Kind-Buecher schliessen: einzeln geprueft plus verschattet = hergeleitete Kinderzahl', () => {
  it('KONTROLLE: die hergeleitete Gesamtzahl der lokal deklarierten Kinder ist 776', () => {
    expect(DERIVED_CHILD_TOTAL).toBe(776);
  });

  it('die Kind-Buecher schliessen: einzeln geprueft plus verschattet ergibt die hergeleitete Kinderzahl', () => {
    // INDIVIDUALLY_ASSERTED_CHILDREN is counted from the group structure
    // itself (a size-1 target-identity group), not from a subtraction of the
    // shadowed count against the derived total.
    expect(INDIVIDUALLY_ASSERTED_CHILDREN).toBe(770);
    expect(ALL_SHADOWED).toHaveLength(6);
    expect(INDIVIDUALLY_ASSERTED_CHILDREN + ALL_SHADOWED.length).toBe(DERIVED_CHILD_TOTAL);
  });

  it('KONTROLLE: bei genau drei Vorkommen loesen zwei Kinder der Huelle auf dasselbe geteilte Ziel auf — die verschatteten Kinder sind namentlich erfasst', () => {
    const FILE = 'Forces of Chaos (6th definitive edition).cat';
    const TARGET = 'f327-567f-ef99-0403';
    expect(ALL_SHADOWED).toEqual([
      { file: FILE, linkId: '0c1c-b835-63a1-14fc', childId: '781f-9b7a-2f8a-b7c6', target: TARGET, reason: expect.any(String) },
      { file: FILE, linkId: '0c1c-b835-63a1-14fc', childId: 'b510-4632-d172-0c50', target: TARGET, reason: expect.any(String) },
      { file: FILE, linkId: '1d8b-61be-1c53-db8d', childId: '781f-9b7a-2f8a-b7c6', target: TARGET, reason: expect.any(String) },
      { file: FILE, linkId: '1d8b-61be-1c53-db8d', childId: 'b510-4632-d172-0c50', target: TARGET, reason: expect.any(String) },
      { file: FILE, linkId: '22c8-1475-0ffd-8768', childId: '781f-9b7a-2f8a-b7c6', target: TARGET, reason: expect.any(String) },
      { file: FILE, linkId: '22c8-1475-0ffd-8768', childId: 'b510-4632-d172-0c50', target: TARGET, reason: expect.any(String) },
    ]);
  });

  it('jeder verschattete Eintrag traegt Datei, Verweis-Id, Kind-Id, Ziel und einen nicht-leeren Grund', () => {
    for (const entry of ALL_SHADOWED) {
      expect(entry.file, 'verschatteter Eintrag ohne Datei').toBeTruthy();
      expect(entry.linkId, 'verschatteter Eintrag ohne Verweis-Id').toBeTruthy();
      expect(entry.childId, 'verschatteter Eintrag ohne Kind-Id').toBeTruthy();
      expect(entry.target, 'verschatteter Eintrag ohne Ziel').toBeTruthy();
      expect(entry.reason, `verschatteter Eintrag ${entry.linkId}/${entry.childId} ohne Grund`).toBeTruthy();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// E — guard: no branch of any of the 16 rosters was silently dropped from the
// tree by an unresolvable definition (that would shift its siblings' paths).
// Other diagnostic kinds (e.g. danglingModifierTarget, unresolvedBudgetLimit)
// are expected in the corpus and have nothing to do with this invariant —
// they are not checked here.
// ─────────────────────────────────────────────────────────────────────────────

describe('Wache: keine unaufloesbare Definition in einem der 16 Rosters', () => {
  it('KONTROLLE: kein Bericht traegt eine UNRESOLVED_DEFINITION-Diagnose', () => {
    const counts = Object.fromEntries(DIAGNOSTIC_COUNTS);
    expect(Object.keys(counts)).toHaveLength(16);
    const zeros = Object.fromEntries(Object.keys(counts).map(file => [file, 0]));
    expect(counts).toEqual(zeros);
  });
});
