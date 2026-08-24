/**
 * Issue 0085, increment 1 — the raise cost (`raiseCosts`) over REAL catalogue
 * data (the definitive-edition Vampire Counts fixture), not only synthetic
 * XML. The reported case: an empty `Standard (VC-AB)` force whose Grave Guard
 * offer carries no visible price today, because its points hang on its
 * mandatory model child.
 *
 * Expected numbers come from the catalogue values quoted in the issue and
 * verified against the raw fixture XML (`Vampire Counts (6th definitive
 * edition).cat`), never from the engine's own computation.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate as evaluateDataset, prepareDataset } from '../../../domain/evaluator/evaluator.js';
import { AnchorKind } from '../../../domain/evaluator/model.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const FIXTURE_DIR = join(process.cwd(), 'src/domain/evaluator/__fixtures__/whfb6-definitive');

/** Liest eine Fixture-Katalogdatei als XML-Text. */
function fixture(fileName) {
  return readFileSync(join(FIXTURE_DIR, fileName), 'utf8');
}

const VC_STANDARD_FORCE_ID = 'e989-15b8-7eb6-9668';
const VC_NECROMANCER_FORCE_ID = 'd3af-1add-4e99-b977';
const GRAVE_GUARD_ID = '92ee-2ebf-c6c0-71ff';
const POINTS_ID = 'ecfa-8486-4f6c-c249';

/** Der aufbereitete DE-Datensatz (gst + Vampire Counts) — einmal je Testlauf. */
let cachedVampireCounts = null;
function preparedVampireCounts() {
  cachedVampireCounts ??= prepareDataset({
    gameSystem: fixture('Warhammer Fantasy Battles (6th definitive edition).gst'),
    catalogues: [fixture('Vampire Counts (6th definitive edition).cat')],
  });
  return cachedVampireCounts;
}

/** Wertet ein leeres Kontingent der gegebenen forceEntry-Definition aus. */
function evaluateEmptyForce(forceDefId) {
  return evaluateDataset(preparedVampireCounts(), {
    forces: [{ defId: forceDefId, count: 1, children: [] }],
  });
}

/** Der Angebots-Anker EINER Definitions-Id, unmittelbar unter dem Kontingent. */
function offerAnchorOf(report, defId) {
  return [...report.capabilities.values()].find(
    capability => capability.defId === defId
      && capability.anchorKind === AnchorKind.OFFER_ANCHOR
      && capability.frame?.path === '0',
  );
}

// Der Bericht des LEEREN Standard-Kontingents — Grundlage der Kriterien 3, 5.
let cachedStandardForceReport = null;
function standardForceReport() {
  cachedStandardForceReport ??= evaluateEmptyForce(VC_STANDARD_FORCE_ID);
  return cachedStandardForceReport;
}

describe('Kriterium 3: Grave Guard im leeren Standard-Kontingent (der gemeldete Fall)', () => {
  it('traegt 120 Punkte Aushebe-Preis, waehrend costs bei 0 bleibt — der Zustand, den die Meldung beschreibt', () => {
    const report = standardForceReport();
    const anchor = offerAnchorOf(report, GRAVE_GUARD_ID);

    expect(anchor).toBeTruthy();
    expect(anchor.costs?.[POINTS_ID] ?? 0).toBe(0);
    expect(anchor.raiseCosts[POINTS_ID]).toBe(120);
  });
});

describe('Kriterium 3: ein Kosten-Modifikator des Kontingents schlaegt im Aushebe-Preis durch', () => {
  it('unter der Necromancer\'s-Army (setzt das Modell auf 10 Punkte): 100 statt 120', () => {
    const report = evaluateEmptyForce(VC_NECROMANCER_FORCE_ID);
    const anchor = offerAnchorOf(report, GRAVE_GUARD_ID);

    expect(anchor).toBeTruthy();
    expect(anchor.raiseCosts[POINTS_ID]).toBe(100);
  });
});

describe('Kriterium 5: ueber den gesamten Standard-Bericht ist der Aushebe-Preis nie kleiner als der Eigenpreis', () => {
  it('kein Faehigkeitsdatensatz unterschreitet seinen eigenen Preis', () => {
    const report = standardForceReport();
    const offenders = [];

    for (const [path, capability] of report.capabilities) {
      const raise = capability.raiseCosts?.[POINTS_ID] ?? 0;
      const own = capability.costs?.[POINTS_ID] ?? 0;
      if (raise < own) offenders.push(`${path} / ${capability.name}`);
    }

    expect(offenders, offenders.join(', ')).toEqual([]);
  });
});

describe('Kriterium 5: Deckungsgleichheit fuer Definitionen ohne eigene Kinder-Container', () => {
  /**
   * Ids aller `selectionEntry`-Elemente, die selbst KEINE `selectionEntries`,
   * `selectionEntryGroups` oder `entryLinks` deklarieren — abgeleitet aus der
   * rohen Fixture-XML, nie aus einem Engine-Modul jenseits der Fassade
   * (`evaluator.corpusLinkLocalChildren.test.js` ist das Muster). Baut den
   * DOM innerhalb dieser Funktion auf und laesst ihn beim Rueckgabewert aus
   * dem Scope fallen — nur die reine Id-Liste ueberlebt.
   */
  function deriveIdsWithoutOwnChildren(xmlTexts) {
    const parser = new DOMParser();
    const ids = [];
    for (const xmlText of xmlTexts) {
      const doc = parser.parseFromString(xmlText, 'text/xml');
      for (const element of doc.querySelectorAll('selectionEntry[id]')) {
        const hasOwnChildren = ['selectionEntries', 'selectionEntryGroups', 'entryLinks'].some(
          tag => [...element.children].some(child => child.localName === tag && child.children.length > 0),
        );
        if (!hasOwnChildren) ids.push(element.getAttribute('id'));
      }
    }
    return ids;
  }

  it('jede Definition ohne eigene Kinder-Container zeigt raiseCosts === costs, an jedem Slot, den der Bericht dafuer fuehrt', () => {
    const candidateIds = new Set(deriveIdsWithoutOwnChildren([
      fixture('Warhammer Fantasy Battles (6th definitive edition).gst'),
      fixture('Vampire Counts (6th definitive edition).cat'),
    ]));
    const report = standardForceReport();
    let checked = 0;

    for (const capability of report.capabilities.values()) {
      if (!candidateIds.has(capability.defId)) continue;
      checked += 1;
      expect(capability.raiseCosts, `${capability.name} (${capability.defId})`).toEqual(capability.costs);
    }

    expect(checked).toBeGreaterThan(0);
  });
});

describe('Die Praemisse der Meldung, als Positivkontrolle', () => {
  it('mehr Angebots-Anker unter dem Kontingent zeigen einen Preis ueber raiseCosts als ueber costs (gemessen: 17 von 71 heute)', () => {
    const report = standardForceReport();
    let withRaise = 0;
    let withOwn = 0;

    for (const capability of report.capabilities.values()) {
      if (capability.anchorKind !== AnchorKind.OFFER_ANCHOR || capability.frame?.path !== '0') continue;
      if ((capability.raiseCosts?.[POINTS_ID] ?? 0) > 0) withRaise += 1;
      if ((capability.costs?.[POINTS_ID] ?? 0) > 0) withOwn += 1;
    }

    expect(withRaise).toBeGreaterThan(withOwn);
  });
});
