import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';

import { evaluate as evaluateDataset, prepareDataset } from './evaluator.js';
import { DiagnosticKind } from './model.js';

/**
 * Die **Bindung eines ueber einen Verweis gesetzten Vorkommens** (Main-Issue 76):
 * ein Roster benennt eine Auswahl mit dem Verweis, ueber den sie hereinkam — und
 * fuehrt die Ziel-Id nur als Pruefdatum mit. Geprueft wird, was daraus folgt:
 *
 * - am Verweis deklarierte Grenzen finden ihre eigene Auswahl,
 * - widersprechen sich Verweis und genanntes Ziel, wird das gemeldet statt geraten,
 * - traegt ein Slot dadurch mehrere Grenzen derselben Art, weist sein
 *   Faehigkeitsdatensatz die **bindende** aus.
 *
 * An eigenen, minimalen Katalogen, die je genau eine Regel isolieren (ADR-0030) —
 * die realen Fixture-Kataloge erklaeren Verweis- und Zielgrenze mit demselben Wert
 * und koennten die Bindungsregel deshalb gar nicht unterscheiden.
 */

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit (wie in den uebrigen
// Evaluator-Tests). Der eigene XML-Leser der Engine nutzt genau dieses Primitiv.
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const UNIT_ID = 'entry-unit';
const TROOPER_ID = 'entry-trooper';
const OTHER_TARGET_ID = 'entry-other';
const TROOPER_LINK_ID = 'link-trooper';

const MIN_AT_TARGET_ID = 'min-at-target';
const MAX_AT_TARGET_ID = 'max-at-target';
const MIN_AT_LINK_ID = 'min-at-link';
const MAX_AT_LINK_ID = 'max-at-link';

/**
 * Ein Katalog, in dem dieselbe Auswahl **zweimal** begrenzt ist: einmal am Ziel
 * (`entry-trooper`) und einmal an dem Verweis, der es hereinzieht
 * (`link-trooper`). Die vier Grenzwerte sind bewusst paarweise verschieden, damit
 * an jedem Ergebnis ablesbar ist, **welche** der beiden Grenzen der Bericht fuehrt.
 *
 * Die Reihenfolge ist ebenso Absicht: die Grenzen des Ziels stehen in der
 * Dokumentreihenfolge **vor** denen des Verweises. Waehlte der Bericht wie frueher
 * schlicht die zuletzt gesehene, gewaenne immer der Verweis — jeder Fall unten, in
 * dem das Ziel gewinnt, faellt damit auf.
 */
function catalogueWith({ minAtTarget, maxAtTarget, minAtLink, maxAtLink }) {
  return `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-entry-link-binding" name="Entry Link Binding Catalogue">
      <sharedSelectionEntries>
        <selectionEntry id="${TROOPER_ID}" name="Trooper" type="model">
          <constraints>
            <constraint id="${MIN_AT_TARGET_ID}" type="min" value="${minAtTarget}" field="selections" scope="parent"/>
            <constraint id="${MAX_AT_TARGET_ID}" type="max" value="${maxAtTarget}" field="selections" scope="parent"/>
          </constraints>
        </selectionEntry>
        <selectionEntry id="${OTHER_TARGET_ID}" name="Other" type="model"/>
      </sharedSelectionEntries>
      <selectionEntries>
        <selectionEntry id="${UNIT_ID}" name="Unit" type="unit">
          <entryLinks>
            <entryLink id="${TROOPER_LINK_ID}" name="Trooper" targetId="${TROOPER_ID}" type="selectionEntry">
              <constraints>
                <constraint id="${MIN_AT_LINK_ID}" type="min" value="${minAtLink}" field="selections" scope="parent"/>
                <constraint id="${MAX_AT_LINK_ID}" type="max" value="${maxAtLink}" field="selections" scope="parent"/>
              </constraints>
            </entryLink>
          </entryLinks>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;
}

/** Die Einheit mit `count` ueber den Verweis gesetzten Truppen darunter. */
function rosterWithLinkedTroopers(count, { expectedTargetDefId } = {}) {
  const trooper = { defId: TROOPER_LINK_ID, count, children: [] };
  if (expectedTargetDefId !== undefined) trooper.expectedTargetDefId = expectedTargetDefId;
  return { forces: [{ defId: UNIT_ID, count: 1, children: [trooper] }] };
}

/** Wertet den Katalog gegen das Roster aus (zweistufige Fassade, ADR-0032). */
function evaluate(catalogueXml, roster) {
  return evaluateDataset(prepareDataset({ catalogues: [catalogueXml] }), roster);
}

/** Der Faehigkeitsdatensatz des belegten Verweis-Slots. */
function linkedTrooperSlot(report) {
  return [...report.capabilities.values()].find(capability => capability.defId === TROOPER_LINK_ID);
}

/** Die Grenz-Ids, die im Bericht als Verletzung gemeldet sind. */
function firingLimitIds(report) {
  return report.violations.map(violation => violation.limitId);
}

describe('Roster-Bindung: eine per Verweis gesetzte Auswahl zaehlt fuer die Grenzen des Verweises', () => {
  // Der Verweis fordert mindestens zwei Truppen; das Roster setzt genau zwei.
  const MIN_AT_LINK = 2;
  const CATALOGUE_XML = catalogueWith({ minAtTarget: 1, maxAtTarget: 9, minAtLink: MIN_AT_LINK, maxAtLink: 9 });

  it('erfuellt eine am Verweis deklarierte Pflichtgrenze, statt sie als unerfuellt zu melden', () => {
    const report = evaluate(CATALOGUE_XML, rosterWithLinkedTroopers(MIN_AT_LINK));

    expect(firingLimitIds(report)).not.toContain(MIN_AT_LINK_ID);
    expect(linkedTrooperSlot(report)).toMatchObject({ current: MIN_AT_LINK, isMandatoryUnmet: false });
  });

  it('meldet dieselbe Grenze weiterhin, wenn die Auswahl sie wirklich verfehlt', () => {
    const report = evaluate(CATALOGUE_XML, rosterWithLinkedTroopers(MIN_AT_LINK - 1));

    expect(firingLimitIds(report)).toContain(MIN_AT_LINK_ID);
    expect(linkedTrooperSlot(report)).toMatchObject({ isMandatoryUnmet: true });
  });

  it('weist den Verweis als Slot und sein Ziel als Thema aus', () => {
    const report = evaluate(CATALOGUE_XML, rosterWithLinkedTroopers(MIN_AT_LINK));

    expect(linkedTrooperSlot(report)).toMatchObject({ defId: TROOPER_LINK_ID, targetDefId: TROOPER_ID });
  });
});

describe('Kohaerenz von Verweis und genanntem Ziel', () => {
  const CATALOGUE_XML = catalogueWith({ minAtTarget: 1, maxAtTarget: 9, minAtLink: 1, maxAtLink: 9 });

  /** Die Kohaerenz-Diagnosen des Berichts. */
  function mismatches(report) {
    return report.diagnostics.filter(entry => entry.kind === DiagnosticKind.ENTRY_LINK_TARGET_MISMATCH);
  }

  it('schweigt, wenn das genannte Ziel das des Verweises ist', () => {
    const report = evaluate(CATALOGUE_XML, rosterWithLinkedTroopers(1, { expectedTargetDefId: TROOPER_ID }));

    expect(mismatches(report)).toEqual([]);
  });

  it('meldet eine Abweichung mit Verweis, genanntem und aufgeloestem Ziel', () => {
    const report = evaluate(CATALOGUE_XML, rosterWithLinkedTroopers(1, { expectedTargetDefId: OTHER_TARGET_ID }));

    expect(mismatches(report)).toEqual([
      expect.objectContaining({
        defId: TROOPER_LINK_ID,
        expectedTargetDefId: OTHER_TARGET_ID,
        targetId: TROOPER_ID,
      }),
    ]);
  });

  it('folgt bei einer Abweichung dem Verweis und wertet weiter aus', () => {
    const report = evaluate(CATALOGUE_XML, rosterWithLinkedTroopers(1, { expectedTargetDefId: OTHER_TARGET_ID }));

    expect(linkedTrooperSlot(report)).toMatchObject({ defId: TROOPER_LINK_ID, targetDefId: TROOPER_ID, current: 1 });
  });
});

describe('Mehrere Grenzen derselben Art an einem Slot: der Bericht fuehrt die bindende', () => {
  it('waehlt bei Untergrenzen die mit dem groessten Fehlbetrag — auch wenn sie am Ziel haengt', () => {
    // Ziel fordert 5, Verweis nur 2; gesetzt sind 3. Fehlbetrag 2 gegen -1.
    const MIN_AT_TARGET = 5;
    const report = evaluate(
      catalogueWith({ minAtTarget: MIN_AT_TARGET, maxAtTarget: 9, minAtLink: 2, maxAtLink: 9 }),
      rosterWithLinkedTroopers(3),
    );

    expect(linkedTrooperSlot(report)).toMatchObject({
      effectiveMin: MIN_AT_TARGET,
      current: 3,
      isMandatoryUnmet: true,
    });
  });

  it('waehlt bei Obergrenzen die mit dem geringsten Spielraum — auch wenn sie am Ziel haengt', () => {
    // Ziel erlaubt 4, Verweis 9; gesetzt sind 3. Spielraum 1 gegen 6.
    const MAX_AT_TARGET = 4;
    const report = evaluate(
      catalogueWith({ minAtTarget: 1, maxAtTarget: MAX_AT_TARGET, minAtLink: 1, maxAtLink: 9 }),
      rosterWithLinkedTroopers(3),
    );

    expect(linkedTrooperSlot(report)).toMatchObject({
      effectiveMax: MAX_AT_TARGET,
      current: 3,
      headroom: MAX_AT_TARGET - 3,
      isBlocked: false,
    });
  });

  it('liest Stand, Spielraum und Gesperrt-Merkmal aus derselben gewaehlten Grenze', () => {
    // Ziel erlaubt 4, Verweis 9; gesetzt sind 6 — nur die bindende Grenze ist
    // ausgeschoepft. Zoege der Bericht seine Zahlen aus verschiedenen Grenzen,
    // stuenden hier ein Hoechstmass von 4 und ein Spielraum von 3 nebeneinander.
    const MAX_AT_TARGET = 4;
    const report = evaluate(
      catalogueWith({ minAtTarget: 1, maxAtTarget: MAX_AT_TARGET, minAtLink: 1, maxAtLink: 9 }),
      rosterWithLinkedTroopers(6),
    );

    expect(linkedTrooperSlot(report)).toMatchObject({
      effectiveMax: MAX_AT_TARGET,
      current: 6,
      headroom: 0,
      isBlocked: true,
    });
  });

  it('waehlt die Grenze des Verweises, wenn sie die bindende ist', () => {
    // Verweis erlaubt 2, Ziel 9; gesetzt sind 2 — der Verweis sperrt.
    const MAX_AT_LINK = 2;
    const report = evaluate(
      catalogueWith({ minAtTarget: 1, maxAtTarget: 9, minAtLink: 1, maxAtLink: MAX_AT_LINK }),
      rosterWithLinkedTroopers(MAX_AT_LINK),
    );

    expect(linkedTrooperSlot(report)).toMatchObject({
      effectiveMax: MAX_AT_LINK,
      headroom: 0,
      isBlocked: true,
    });
  });

  it('laesst die Meldungsliste unberuehrt: jede verletzte Grenze bleibt ihre eigene Meldung', () => {
    // Beide Obergrenzen sind ueberschritten (Ziel 4, Verweis 9, gesetzt 12).
    const report = evaluate(
      catalogueWith({ minAtTarget: 1, maxAtTarget: 4, minAtLink: 1, maxAtLink: 9 }),
      rosterWithLinkedTroopers(12),
    );

    expect(firingLimitIds(report)).toEqual(expect.arrayContaining([MAX_AT_TARGET_ID, MAX_AT_LINK_ID]));
  });
});
