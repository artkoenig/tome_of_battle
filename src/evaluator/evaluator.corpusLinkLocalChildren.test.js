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
 * from the raw XML of BOTH corpora — `src/evaluator/__fixtures__/whfb6-definitive`
 * (11 catalogues) and `src/__fixtures__/whfb6` (4 catalogues) — never from any
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
  { name: 'whfb6-definitive', dir: join(process.cwd(), 'src/evaluator/__fixtures__/whfb6-definitive') },
  { name: 'whfb6', dir: join(process.cwd(), 'src/__fixtures__/whfb6') },
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

/** Whether one of `slots` matches the expected child, by `defId` or (if set) by `targetDefId`. */
function hasMatchingSlot(slots, expectedChild) {
  return slots.some(
    slot => slot.defId === expectedChild.id || (expectedChild.targetId !== null && slot.targetDefId === expectedChild.targetId),
  );
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
  const occurrences = [];
  const occurrencesByFile = new Map();
  const recorded = [];
  const forceByFile = new Map();

  for (const { file, document } of catDocuments) {
    const { forceId, catalogueId } = resolveForce(document, gstForceEntries, firstAnyForceId);
    forceByFile.set(file, { forceId, catalogueId });
    occurrencesByFile.set(file, []);

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

      const occurrence = {
        corpus: corpusName,
        file,
        id,
        name,
        frameId: frame.getAttribute('id'),
        branch: rosterBranchOf(frame),
        expected,
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
    occurrences,
    occurrencesByFile,
    recorded,
    forceByFile,
    gstEntryLinksWithOwnChildren,
  };
}

const DERIVED = CORPORA.map(corpus => deriveCorpus(corpus.name, corpus.dir));

const ALL_OCCURRENCES = DERIVED.flatMap(d => d.occurrences);
const ALL_RECORDED = DERIVED.flatMap(d => d.recorded);
const DERIVED_TOTAL = ALL_OCCURRENCES.length + ALL_RECORDED.length;

const PER_FILE_COUNTS = {};
for (const d of DERIVED) Object.assign(PER_FILE_COUNTS, d.perFileCounts);

const CONTRIBUTING_FILES = Object.keys(PER_FILE_COUNTS);

// The frozen table from Issue 0150's intent section, re-derived above rather
// than assumed — a drift here names its file via a deep-equal failure.
const EXPECTED_PER_FILE_COUNTS = {
  'Bretonnia (6th definitive edition).cat': 13,
  'Dark Elves (6th definitive edition).cat': 1,
  'Dwarfs (2005) (6th definitive edition).cat': 5,
  'Forces of Chaos (6th definitive edition).cat': 29,
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
    'KONTROLLE: die pro Datei hergeleitete Anzahl entspricht der eingefrorenen Tabelle aus Issue 0150 (149 insgesamt, aus dem Korpus selbst hergeleitet)',
    () => {
      expect(
        PER_FILE_COUNTS,
        `Die Zahlen sind aus dem Korpus hergeleitet, nicht aus der Issue-Tabelle uebernommen; die Issue-Tabelle nannte 149 insgesamt.`,
      ).toEqual(EXPECTED_PER_FILE_COUNTS);
    },
  );

  it('KONTROLLE: die hergeleitete Gesamtzahl ist 149, aus 15 beitragenden Dateien', () => {
    expect(DERIVED_TOTAL).toBe(149);
    expect(CONTRIBUTING_FILES).toHaveLength(15);
  });

  it('KONTROLLE: keine der beiden .gst-Dateien haelt einen Verweis mit eigenen lokalen Kindern', () => {
    for (const d of DERIVED) {
      expect(d.gstEntryLinksWithOwnChildren, `${d.corpus}: .gst-Datei traegt eigene lokale Kinder`).toBe(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B — das Invariante, ein Fall je Vorkommen (Issue-Kriterien 1, 3 und 5).
// ─────────────────────────────────────────────────────────────────────────────

describe('Das Invariante: jedes Vorkommen bekommt einen Slot fuer jedes eigene lokal deklarierte Kind', () => {
  it.each(ALL_OCCURRENCES)('$corpus :: $file :: Verweis $id ($name) bekommt einen Slot fuer jedes eigene lokal deklarierte Kind', occurrence => {
    const reduced = REDUCED_BY_KEY.get(`${occurrence.file}::${occurrence.id}`);
    expect(reduced, `Kein reduziertes Ergebnis fuer ${occurrence.file}::${occurrence.id}`).toBeDefined();

    // Selbstcheck: die Pfad-Arithmetik hat tatsaechlich den Rahmen dieses
    // Vorkommens getroffen — sonst waeren die folgenden Kind-Pruefungen wertlos.
    expect(
      reduced.frameDefId,
      `Rahmen ${occurrence.id} (${occurrence.name}) in ${occurrence.file} liegt nicht am erwarteten Pfad`,
    ).toBe(occurrence.frameId);

    for (const expectedChild of occurrence.expected) {
      expect(
        hasMatchingSlot(reduced.childSlots, expectedChild),
        `Verweis ${occurrence.id} (${occurrence.name}) in ${occurrence.file}: kein Slot fuer eigenes Kind ${expectedChild.id}`,
      ).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C — die beiden benannten Faelle aus Inkrement 1, gegen den definitiven
// Empire-Katalog (issue Log, dritter Punkt).
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
    expect(hasMatchingSlot(reduced.childSlots, occurrence.expected[0])).toBe(true);
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
        hasMatchingSlot(reduced.childSlots, expectedChild),
        `Battle Standard Bearer: kein Slot fuer eigenes Kind ${expectedChild.id}`,
      ).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// D — die Buecher (Issue-Kriterium 2 des Inkrements).
// ─────────────────────────────────────────────────────────────────────────────

describe('Die Buecher schliessen: erfasst + geprueft = hergeleitete Gesamtzahl', () => {
  it('erfasste Vorkommen plus geprueftes Invariant ergeben die hergeleitete Gesamtzahl, und diese ist 149', () => {
    expect(DERIVED_TOTAL).toBe(149);
    expect(ALL_RECORDED.length + ALL_OCCURRENCES.length).toBe(DERIVED_TOTAL);
  });

  it('jeder erfasste (nicht pruefbare) Eintrag traegt einen nicht-leeren Grund, eine Datei und eine Id', () => {
    for (const entry of ALL_RECORDED) {
      expect(entry.file, 'erfasster Eintrag ohne Datei').toBeTruthy();
      expect(entry.id, 'erfasster Eintrag ohne Id').toBeTruthy();
      expect(entry.reason, `erfasster Eintrag ${entry.id} ohne Grund`).toBeTruthy();
    }
  });

  // Heute ist diese Liste leer: das ist der Zustand, den das gemeinsame Laden
  // aller Kataloge einer Korpus-Abhaengigkeit erkauft (siehe Dateikopf), keine
  // Behauptung, dass ein nicht pruefbares Vorkommen ein Fehlschlag waere —
  // ein kuenftiger Eintrag wird hier mit seinem Grund vollstaendig ausgegeben.
  it('KONTROLLE: die Liste der nicht pruefbaren Vorkommen ist heute leer', () => {
    expect(ALL_RECORDED).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// E — Wache: kein Zweig eines der 15 Rosters wurde durch eine unaufloesbare
// Definition still aus dem Baum genommen (das wuerde die Pfade seiner
// Geschwister verschieben). Andere Diagnose-Arten (z. B. danglingModifierTarget,
// unresolvedBudgetLimit) sind im Korpus erwartet und haben mit diesem
// Invariant nichts zu tun — sie werden hier nicht geprueft.
// ─────────────────────────────────────────────────────────────────────────────

describe('Wache: keine unaufloesbare Definition in einem der 15 Rosters', () => {
  it('KONTROLLE: kein Bericht traegt eine UNRESOLVED_DEFINITION-Diagnose', () => {
    const counts = Object.fromEntries(DIAGNOSTIC_COUNTS);
    expect(Object.keys(counts)).toHaveLength(15);
    const zeros = Object.fromEntries(Object.keys(counts).map(file => [file, 0]));
    expect(counts).toEqual(zeros);
  });
});
