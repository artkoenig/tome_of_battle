/**
 * Issue 0092, Kriterium 3 — weitere Nachschärfung: die **gespiegelte**
 * Rahmen-Topologie zu `evalTree.unlinkedCategoryMixedScope.test.js` (Repro B).
 * Dort: min(roster) + max(force). Hier: **min(force) + max(roster)** an EINER
 * unverlinkten `categoryEntry`, genau ein Kontingent, 2 Mitglieder.
 *
 * Warum diese Topologie eigen ist: die MIN-Grenze im Kontingent-Rahmen erzeugt
 * das Pflicht-Phantom **unter dem Kontingent** (nicht unter der Wurzel). Dieses
 * Phantom wertet — wie schon vor Issue 0092 — ALLE Grenzen der Definition aus,
 * also auch die armeeweite MAX-Grenze (Huckepack, genau einmal: Ist 2 > 1).
 * Der neue Wurzel-Anker fuer armeeweite Grenzen wird aber ZUSAETZLICH
 * synthetisiert, weil der Wurzel-Ausschluss nur direkte Wurzel-Kinder sieht,
 * nicht das Phantom unter dem Kontingent — die roster-MAX-Grenze meldet damit
 * doppelt. Kriterium 3 („keine zusätzlichen Doppelmeldungen") verlangt: jede
 * Grenze genau einmal.
 *
 * Semantik-Pin fuer den Kontingent-Rahmen: `scope="force"` zaehlt ein
 * **Kategorie**-Ziel **armeeweit** (§7.6 Ziel-Typ-Regel / §7.7, ADR 0029) —
 * bei genau einem Kontingent mit 2 Mitgliedern ist das Ist 2, deckungsgleich
 * mit der Zaehlung je Kontingent. Mit genau EINEM Kontingent beruehrt dieser
 * Test die bewusst ungepinnte Mehr-Kontingent-Doppelmeldungs-Familie aus
 * Issue 0093 nicht.
 *
 * Beobachtet wird ausschliesslich der Bericht der echten Fassade
 * (`evaluate`/`prepareDataset`): `report.violations` gefiltert nach `limitId`.
 * Slot-Identitaet der Anker ist bewusst nicht Teil der Pins.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate as evaluateDataset, prepareDataset } from '../../../domain/evaluator/evaluator.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

/** Wertet einen einzelnen synthetischen Katalog aus (ADR-0032: Datensatz-Form). */
function evaluate(catalogXml, roster) {
  return evaluateDataset(prepareDataset({ catalogues: [catalogXml] }), roster);
}

/** Die Meldungen des Berichts zu einer Grenz-Id. */
function messagesOf(report, limitId) {
  return report.violations.filter(message => message.limitId === limitId);
}

const RARE_CATEGORY_ID = 'cat-rare';
const FORCE_DEF_ID = 'force-army';
const GIANT_DEF_ID = 'entry-giant';
const MIN_FORCE_LIMIT_ID = 'min-rare-force';
const MAX_ROSTER_LIMIT_ID = 'max-rare-roster';

/**
 * Der Katalog: eine Kategorie „Rare" mit min=3 (Kontingent-Rahmen) UND max=1
 * (armeeweit) direkt an der `categoryEntry` (unverlinkt — kein Kontingent
 * fuehrt sie per `categoryLink`), eine Kontingent-Definition und ein Eintrag
 * „Giant", der der Kategorie ueber seinen eigenen `categoryLink` angehoert
 * (§5.5).
 */
const CATALOGUE = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-0092-minforce-maxroster" name="Unlinked Category Min Force Max Roster Catalogue">
    <categoryEntries>
      <categoryEntry id="${RARE_CATEGORY_ID}" name="Rare">
        <constraints>
          <constraint id="${MIN_FORCE_LIMIT_ID}" type="min" value="3" field="selections" scope="force" includeChildSelections="true"/>
          <constraint id="${MAX_ROSTER_LIMIT_ID}" type="max" value="1" field="selections" scope="roster" includeChildSelections="true"/>
        </constraints>
      </categoryEntry>
    </categoryEntries>
    <forceEntries>
      <forceEntry id="${FORCE_DEF_ID}" name="Army"/>
    </forceEntries>
    <selectionEntries>
      <selectionEntry id="${GIANT_DEF_ID}" name="Giant" type="unit">
        <categoryLinks>
          <categoryLink id="clink-giant-rare" name="Rare" targetId="${RARE_CATEGORY_ID}" primary="true"/>
        </categoryLinks>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

/** Das Roster: genau ein Kontingent „Army" mit 2 Giants (Kategorie-Mitgliedern). */
const ROSTER = {
  forces: [{
    defId: FORCE_DEF_ID,
    count: 1,
    children: [{ defId: GIANT_DEF_ID, count: 2, children: [] }],
  }],
};

describe('Kriterium 3: unverlinkte Kategorie mit min=3 (force) UND max=1 (roster), ein Kontingent, 2 Mitglieder', () => {
  it('C1: die armeeweite MAX-Grenze meldet genau EINMAL (Ist 2, Grenzwert 1) — Kontingent-Phantom und Wurzel-Anker duerfen sie nicht beide melden', () => {
    // Heute rot: das Pflicht-Phantom der min(force)-Grenze sitzt UNTER dem
    // Kontingent und wertet die roster-MAX-Grenze huckepack aus; der neue
    // Wurzel-Anker fuer armeeweite Grenzen wird trotzdem zusaetzlich
    // synthetisiert (der Wurzel-Ausschluss sieht nur direkte Wurzel-Kinder)
    // und meldet dieselbe Grenze ein zweites Mal.
    const report = evaluate(CATALOGUE, ROSTER);

    const messages = messagesOf(report, MAX_ROSTER_LIMIT_ID);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ actual: 2, bound: 1 });
  });

  it('C2 (KONTROLLE/PIN): die Kontingent-MIN-Grenze meldet genau EINMAL (Ist 2, Grenzwert 3)', () => {
    // Vermutlich schon heute gruen (das Pflicht-Phantom unter dem Kontingent
    // ist der einzige Anker, der den force-Rahmen aufloest); gepinnt, damit
    // die Korrektur der Doppelmeldung diese Grenze weder verdoppelt noch
    // verschluckt. Ist 2: `scope="force"` zaehlt ein Kategorie-Ziel armeeweit
    // (§7.6/§7.7, ADR 0029) — bei einem Kontingent deckungsgleich mit der
    // Zaehlung je Kontingent.
    const report = evaluate(CATALOGUE, ROSTER);

    const messages = messagesOf(report, MIN_FORCE_LIMIT_ID);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ actual: 2, bound: 3 });
  });

  it('C3 (KONTROLLE): der gesamte Bericht traegt genau ZWEI Verletzungen — eine je Grenze', () => {
    // Heute rot (drei Meldungen: roster-max doppelt + force-min einmal).
    // Der Katalog enthaelt keine anderen Grenzen; jede weitere Meldung waere
    // eine Doppelmeldung und verletzt Kriterium 3.
    const report = evaluate(CATALOGUE, ROSTER);

    expect(report.violations).toHaveLength(2);
    const limitIds = report.violations.map(message => message.limitId).sort();
    expect(limitIds).toEqual([MAX_ROSTER_LIMIT_ID, MIN_FORCE_LIMIT_ID].sort());
  });
});
