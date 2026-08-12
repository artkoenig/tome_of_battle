/**
 * Issue 0150, increment 1 — the corpus invariant for children an `entryLink`
 * declares itself.
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
 * This file is the corpus-wide check the campaign never had: it derives,
 * from the Empire (definitive) catalogue XML alone — never from any engine
 * module other than the facade (`prepareDataset` + `evaluate`, ADR 0030,
 * ADR 0033) — every `entryLink` that declares its own children, and asserts
 * that a roster holding that link gets a report slot for each of those
 * children under the link's own slot. Existence is the whole claim
 * (criterion 3 of the issue): `isHidden` is never asserted.
 *
 * Scope of this increment: the Empire (definitive) catalogue only (31
 * occurrences). The other 14 catalogue files and the campaign's bookkeeping
 * are later increments (issue criteria 2, 6, 7).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, it, expect, beforeAll } from 'vitest';

import { evaluate as evaluateDataset, prepareDataset, DiagnosticKind } from './evaluator.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const FIXTURE_DIR = join(process.cwd(), 'src/evaluator/__fixtures__/whfb6-definitive');

/** Liest eine Fixture-Katalogdatei als XML-Text. */
function fixture(fileName) {
  return readFileSync(join(FIXTURE_DIR, fileName), 'utf8');
}

const GST_XML = fixture('Warhammer Fantasy Battles (6th definitive edition).gst');
const EMPIRE_XML = fixture('The Empire (6th definitive edition).cat');

// `<forceEntry name="Standard (EM-AB)">` — das Standard-Kontingent des Empire-
// Katalogs, im Katalog selbst deklariert.
const FORCE_ID = 'e821-88b8-2071-6b6a';

// ─────────────────────────────────────────────────────────────────────────────
// DIE HERLEITUNG — ausschliesslich ueber das rohe XML der beiden Dokumente.
// ─────────────────────────────────────────────────────────────────────────────

/** Alle direkten Kind-Elemente eines Elements (keine Textknoten). */
function directChildElements(element) {
  return [...element.children];
}

/** Die direkten Kinder EINES benannten Containers (z. B. `entryLinks`) unter `element`. */
function directContainerChildren(element, containerLocalName) {
  const container = directChildElements(element).find(child => child.localName === containerLocalName);
  return container ? directChildElements(container) : [];
}

/**
 * Die direkt am Element deklarierten Kinder ueber alle drei Container von
 * `SelectionEntryBase` hinweg (`Catalogue.xsd` Zeilen 274-287): eigene
 * `selectionEntries`, `selectionEntryGroups` und `entryLinks`. Gilt fuer
 * `selectionEntry`, `selectionEntryGroup` UND `entryLink` gleichermassen, weil
 * `EntryLink` (Zeilen 396-406) genau dieselbe Basis erweitert.
 */
function directLocalChildren(element) {
  return [
    ...directContainerChildren(element, 'selectionEntries'),
    ...directContainerChildren(element, 'selectionEntryGroups'),
    ...directContainerChildren(element, 'entryLinks'),
  ];
}

/** Ein Element traegt eigene, lokal deklarierte Kinder. */
function hasOwnLocalChildren(element) {
  return directLocalChildren(element).length > 0;
}

/**
 * Der Entry-Abschluss (`entry closure`) der uebergebenen Kind-Elemente: die Ids
 * der `selectionEntry`s, die letztlich an dieser Stelle waehlbar sind.
 *
 * - `selectionEntry` traegt die eigene Id bei.
 * - `entryLink type="selectionEntry"` traegt die Id des VERWEISES bei, nie die
 *   seines Ziels (derselbe Link-vor-Ziel-Grundsatz, den auch der Bericht fuer
 *   `sourceId` befolgt — `evaluator.js`, Pfad-Schema-Absatz).
 * - `selectionEntryGroup` traegt den Abschluss ihrer eigenen direkten Kinder bei.
 * - `entryLink type="selectionEntryGroup"` traegt den Abschluss der direkten
 *   Kinder ihres AUFGELOESTEN Ziels bei, PLUS den Abschluss ihrer eigenen lokal
 *   deklarierten Kinder (dieselbe Vereinigung wie bei einem `selectionEntry`-
 *   Verweis, nur eine Ebene tiefer). Ein Ziel, das in keinem geladenen Dokument
 *   steht (Katalog-Abhaengigkeit ausserhalb des Datensatzes, z. B. Mercenaries),
 *   traegt nichts bei.
 *
 * `visited` schuetzt vor Zyklen; da Verweis und Ziel unterschiedliche
 * DOM-Elemente sind, haelt ein Set von Element-Referenzen die beiden
 * automatisch auseinander.
 */
function entryClosureOf(children, idIndex, visited = new Set(), ids = new Set()) {
  for (const child of children) {
    if (visited.has(child)) continue;
    visited.add(child);

    if (child.localName === 'selectionEntry') {
      ids.add(child.getAttribute('id'));
    } else if (child.localName === 'selectionEntryGroup') {
      entryClosureOf(directLocalChildren(child), idIndex, visited, ids);
    } else if (child.localName === 'entryLink') {
      const type = child.getAttribute('type');
      if (type === 'selectionEntry') {
        ids.add(child.getAttribute('id'));
      } else if (type === 'selectionEntryGroup') {
        const target = idIndex.get(child.getAttribute('targetId'));
        if (target) entryClosureOf(directLocalChildren(target), idIndex, visited, ids);
        entryClosureOf(directLocalChildren(child), idIndex, visited, ids);
      }
    }
  }
  return ids;
}

/**
 * Der RAHMEN eines Vorkommens: der Verweis selbst, falls `type="selectionEntry"`;
 * sonst (`type="selectionEntryGroup"`) der naechste Vorfahr, der ein
 * `selectionEntry` oder ein `entryLink type="selectionEntry"` ist — die
 * naechste Stelle, an der ein Roster ueberhaupt einen Slot besetzen kann.
 */
function frameOf(link) {
  if (link.getAttribute('type') === 'selectionEntry') return link;
  let ancestor = link.parentElement;
  while (ancestor) {
    if (ancestor.localName === 'selectionEntry') return ancestor;
    if (ancestor.localName === 'entryLink' && ancestor.getAttribute('type') === 'selectionEntry') return ancestor;
    ancestor = ancestor.parentElement;
  }
  throw new Error(`Kein Rahmen fuer Verweis ${link.getAttribute('id')} gefunden.`);
}

/**
 * Der ROSTER-ZWEIG des Rahmens: von den Vorfahren des Rahmens bis zur
 * Katalogwurzel, dabei nur `selectionEntry`- und `entryLink`-Vorfahren
 * behalten (eine `selectionEntryGroup` hat im Roster keinen eigenen Knoten),
 * anschliessend den Rahmen selbst anhaengen — Wurzel zuerst.
 */
function rosterBranchOf(frame) {
  const ancestors = [];
  let ancestor = frame.parentElement;
  while (ancestor && ancestor.localName !== 'catalogue') {
    if (ancestor.localName === 'selectionEntry' || ancestor.localName === 'entryLink') {
      ancestors.push(ancestor);
    }
    ancestor = ancestor.parentElement;
  }
  ancestors.reverse();
  ancestors.push(frame);
  return ancestors;
}

/** Indexiert jedes Element mit `id`-Attribut aus beiden Dokumenten in eine Map. */
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
 * Alle 31 Vorkommen der Empire-Kataloges: jeder `entryLink`, der eigene
 * `selectionEntries`, `selectionEntryGroups` oder `entryLinks` deklariert, mit
 * seinem Rahmen, seinem Roster-Zweig und dem Entry-Abschluss seiner eigenen
 * lokalen Kinder.
 */
function deriveOccurrences(catalogueDocument, idIndex) {
  const links = [...catalogueDocument.getElementsByTagNameNS('*', 'entryLink')];
  const occurrences = [];
  for (const link of links) {
    if (!hasOwnLocalChildren(link)) continue;
    const frame = frameOf(link);
    occurrences.push({
      id: link.getAttribute('id'),
      name: link.getAttribute('name'),
      link,
      frame,
      branch: rosterBranchOf(frame),
      expectedIds: [...entryClosureOf(directLocalChildren(link), idIndex)],
    });
  }
  return occurrences;
}

// ─────────────────────────────────────────────────────────────────────────────
// DAS ROSTER — ein Zweig je Vorkommen, in Herleitungsreihenfolge.
// ─────────────────────────────────────────────────────────────────────────────

/** Baut aus einem Roster-Zweig (Wurzel zuerst) die verschachtelte Roster-Struktur. */
function branchToRosterChild(branchElements) {
  let node = { defId: branchElements[branchElements.length - 1].getAttribute('id'), count: 1, children: [] };
  for (let i = branchElements.length - 2; i >= 0; i -= 1) {
    node = { defId: branchElements[i].getAttribute('id'), count: 1, children: [node] };
  }
  return node;
}

/**
 * Der Rahmen-Pfad eines Vorkommens nach dem Pfad-Schema der Fassade
 * (`evaluate` JSDoc, `evaluator.js`): das Kontingent liegt unter `"0"`, Zweig
 * `i` beginnt unter `"0/i"`, und jede weitere Ebene des Zweigs haengt `"/0"` an
 * — belegte Slots folgen der Roster-Eingabereihenfolge, und jeder Zweig ist
 * an jeder Ebene das einzige, also erste, Kind.
 */
function framePathOf(occurrenceIndex, branchLength) {
  let path = `0/${occurrenceIndex}`;
  for (let level = 1; level < branchLength; level += 1) path += '/0';
  return path;
}

/** Ob `report.capabilities` genau eine Ebene unter `framePath` einen Slot mit `defId` traegt. */
function hasChildSlotWithDefId(report, framePath, defId) {
  const frameDepth = framePath.split('/').length;
  for (const [key, capability] of report.capabilities) {
    if (!key.startsWith(`${framePath}/`)) continue;
    if (key.split('/').length !== frameDepth + 1) continue;
    if (capability.defId === defId) return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// DIE HERLEITUNG LAEUFT EINMAL BEIM LADEN DES MODULS — sie braucht nur den
// XML-Text der beiden Dokumente, keinen Engine-Durchlauf, und `it.each` mit
// sprechenden Titeln braucht die Liste bereits zur Sammel-Zeit.
// ─────────────────────────────────────────────────────────────────────────────

const PARSER = new DOMParser();
const GST_DOCUMENT = PARSER.parseFromString(GST_XML, 'text/xml');
const CATALOGUE_DOCUMENT = PARSER.parseFromString(EMPIRE_XML, 'text/xml');
const ID_INDEX = buildIdIndex(GST_DOCUMENT, CATALOGUE_DOCUMENT);
const OCCURRENCES = deriveOccurrences(CATALOGUE_DOCUMENT, ID_INDEX);
const OCCURRENCE_ROSTER_CHILDREN = OCCURRENCES.map(occurrence => branchToRosterChild(occurrence.branch));

/** Der Roster: ein Kontingent, ein Zweig je Vorkommen, in Herleitungsreihenfolge. */
const ROSTER = {
  forces: [{ defId: FORCE_ID, count: 1, children: OCCURRENCE_ROSTER_CHILDREN }],
};

// ─────────────────────────────────────────────────────────────────────────────
// EINMALIGER ENGINE-AUFBAU — der Fixture-Parse der Engine selbst dominiert die
// Laufzeit; `prepareDataset` + `evaluate` laufen deshalb genau einmal
// (`src/evaluator/CLAUDE.md`, Memoisierungs-Muster).
// ─────────────────────────────────────────────────────────────────────────────

let report;

beforeAll(() => {
  const prepared = prepareDataset({ gameSystem: GST_XML, catalogues: [EMPIRE_XML] });
  report = evaluateDataset(prepared, ROSTER);
}, 30_000);

// ─────────────────────────────────────────────────────────────────────────────
// A — KONTROLLE: die Herleitung selbst.
// ─────────────────────────────────────────────────────────────────────────────

describe('Empire-Katalog: Verweise mit eigenen lokalen Kindern (Issue 0150, Kriterium 1)', () => {
  it('KONTROLLE: der Katalog haelt genau 31 Verweise mit eigenen lokalen Kindern', () => {
    expect(OCCURRENCES.map(occurrence => occurrence.id)).toHaveLength(31);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // B — ein Fall je Vorkommen: der Rahmen-Selbstcheck, dann jedes erwartete Kind.
  // ───────────────────────────────────────────────────────────────────────────

  it.each(OCCURRENCES.map((occurrence, index) => ({ ...occurrence, index })))(
    'Verweis $id ($name) bekommt einen Slot fuer jedes eigene lokal deklarierte Kind',
    occurrence => {
      const framePath = framePathOf(occurrence.index, occurrence.branch.length);

      // Selbstcheck: die Pfad-Arithmetik hat tatsaechlich den Rahmen dieses
      // Vorkommens getroffen — sonst waeren die folgenden Kind-Pruefungen wertlos.
      expect(
        report.capabilities.get(framePath)?.defId,
        `Rahmen ${occurrence.id} (${occurrence.name}) liegt nicht unter dem erwarteten Pfad ${framePath}`,
      ).toBe(occurrence.frame.getAttribute('id'));

      for (const expectedId of occurrence.expectedIds) {
        expect(
          hasChildSlotWithDefId(report, framePath, expectedId),
          `Verweis ${occurrence.id} (${occurrence.name}): kein Slot fuer eigenes Kind ${expectedId} unter ${framePath}`,
        ).toBe(true);
      }
    },
  );

  // ───────────────────────────────────────────────────────────────────────────
  // C — der Barding-Fall (der Defekt, den PR #214 behob).
  // ───────────────────────────────────────────────────────────────────────────

  it('Captain -> Empire Warhorse -> Barding: der Verweis auf das geteilte Ross traegt seine eigene Barding-Option', () => {
    const occurrence = OCCURRENCES.find(candidate => candidate.id === 'f817-432b-7c1a-a8ca');
    expect(occurrence, 'Verweis "Empire Warhorse" fehlt in der Herleitung').toBeDefined();
    expect(occurrence.branch.map(element => element.getAttribute('id'))).toEqual([
      '6686-1f55-dee3-1bcf', // Captain
      'f817-432b-7c1a-a8ca', // Empire Warhorse
    ]);
    expect(occurrence.expectedIds).toEqual(['0535-f68e-b9bc-749b']); // Barding

    const index = OCCURRENCES.indexOf(occurrence);
    const framePath = framePathOf(index, occurrence.branch.length);
    expect(report.capabilities.get(framePath)?.defId).toBe('f817-432b-7c1a-a8ca');
    expect(hasChildSlotWithDefId(report, framePath, '0535-f68e-b9bc-749b')).toBe(true);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // D — der Magic-Banners-Fall (derselbe Defekt, zweites Vorkommen auf derselben
  // Katalogseite; issue Log, dritter Punkt).
  // ───────────────────────────────────────────────────────────────────────────

  it('Captain -> Battle Standard Bearer -> Magic Banners: der Verweis traegt seine beiden lokal deklarierten Banner-Gruppen', () => {
    const occurrence = OCCURRENCES.find(candidate => candidate.id === 'c9fc-265e-8fa8-b814');
    expect(occurrence, 'Verweis "Battle Standard Bearer" fehlt in der Herleitung').toBeDefined();
    expect(occurrence.branch.map(element => element.getAttribute('id'))).toEqual([
      '6686-1f55-dee3-1bcf', // Captain
      'c9fc-265e-8fa8-b814', // Battle Standard Bearer
    ]);
    expect(occurrence.expectedIds).toHaveLength(12);
    // Named literally so the case still says what it is about if the
    // derivation ever changes (Imperial Banner, War Banner, Banner of
    // Middenheim — one from each of the two locally linked banner groups).
    expect(occurrence.expectedIds).toEqual(
      expect.arrayContaining(['14b9-9df2-f13c-f31b', 'fa36-4375-131c-3d91', '7b77-57e3-700b-4bbb']),
    );

    const index = OCCURRENCES.indexOf(occurrence);
    const framePath = framePathOf(index, occurrence.branch.length);
    expect(report.capabilities.get(framePath)?.defId).toBe('c9fc-265e-8fa8-b814');
    for (const expectedId of occurrence.expectedIds) {
      expect(
        hasChildSlotWithDefId(report, framePath, expectedId),
        `Battle Standard Bearer: kein Slot fuer eigenes Kind ${expectedId} unter ${framePath}`,
      ).toBe(true);
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // E — Wache: kein Zweig wurde durch eine unaufloesbare Definition still
  // aus dem Baum genommen. Jede `defId` des Rosters stammt aus den geladenen
  // Dokumenten, daher darf kein Vorkommen dort auftauchen — der Bericht traegt
  // legitim eine andere Diagnose (der `catalogueLink` zu Mercenaries,
  // `fc47-8392-a6c8-452a`, den dieser Datensatz nicht laedt); die wird hier
  // nicht geprueft.
  // ───────────────────────────────────────────────────────────────────────────

  it('KONTROLLE: kein Zweig des Rosters loest eine unaufloesbare Definition aus', () => {
    const unresolved = report.diagnostics.filter(diagnostic => diagnostic.kind === DiagnosticKind.UNRESOLVED_DEFINITION);
    expect(unresolved).toEqual([]);
  });
});
