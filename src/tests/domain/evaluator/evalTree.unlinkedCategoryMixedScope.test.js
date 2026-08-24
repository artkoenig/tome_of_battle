/**
 * Issue 0092, Kriterium 3 — Nachschärfung aus der Review-Runde:
 * gemischte Bezugsrahmen an EINER unverlinkten `categoryEntry`.
 *
 * `docs/battlescribe-data-format.md` §5.5/§5.6: Grenzen hängen direkt an der
 * Kategorie-Definition; kein Kontingent führt sie per `categoryLink`. Traegt
 * dieselbe Definition Grenzen mit verschiedenen `scope`s (roster UND force),
 * darf die Verankerung trotzdem **jede Grenze genau einmal** melden
 * (Kriterium 3: „keine zusätzlichen Doppelmeldungen") — und der Bericht darf
 * keine `unresolvedScope`-Diagnose dafür tragen, dass ein Anker eine Grenze
 * eines fremden Rahmens gar nicht erst auswerten kann.
 *
 * Semantik-Pin fuer den Kontingent-Rahmen: `scope="force"` zaehlt ein
 * **Kategorie**-Ziel **armeeweit** (§7.6, Ziel-Typ-Regel / §7.7, ADR 0029).
 * Bei genau einem Kontingent mit 2 Mitgliedern ist das Ist damit 2 — dieselbe
 * Annahme trifft der Schwester-Test
 * `evalTree.unlinkedCategoryMax.test.js` („scope=force": 2 Mitglieder → Ist 2).
 *
 * Beobachtet wird ausschliesslich der Bericht der echten Fassade
 * (`evaluate`/`prepareDataset`): `report.violations` gefiltert nach `limitId`
 * sowie `report.diagnostics`. Slot-Identitaet der Anker ist bewusst nicht Teil
 * der Pins.
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

/** Die `unresolvedScope`-Diagnosen des Berichts. */
function unresolvedScopeDiagnosticsOf(report) {
  return (report.diagnostics ?? []).filter(diagnostic => diagnostic.kind === 'unresolvedScope');
}

const RARE_CATEGORY_ID = 'cat-rare';
const FORCE_DEF_ID = 'force-army';
const GIANT_DEF_ID = 'entry-giant';
const MAX_ROSTER_LIMIT_ID = 'max-rare-roster';
const MAX_FORCE_LIMIT_ID = 'max-rare-force';
const MIN_ROSTER_LIMIT_ID = 'min-rare-roster';

/**
 * Baut den Katalog: eine Kategorie „Rare" mit den uebergebenen Grenzen direkt
 * an der `categoryEntry` (unverlinkt — kein Kontingent fuehrt sie per
 * `categoryLink`), eine Kontingent-Definition und ein Eintrag „Giant", der der
 * Kategorie ueber seinen eigenen `categoryLink` angehoert (§5.5).
 */
function catalogXml(categoryConstraintsXml) {
  return `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-0092-mixed" name="Unlinked Category Mixed Scope Catalogue">
      <categoryEntries>
        <categoryEntry id="${RARE_CATEGORY_ID}" name="Rare">
          <constraints>
            ${categoryConstraintsXml}
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
}

/** Ein Roster: genau ein Kontingent „Army" mit `count` Giants. */
function rosterWithGiants(count) {
  return {
    forces: [{
      defId: FORCE_DEF_ID,
      count: 1,
      children: count === 0 ? [] : [{ defId: GIANT_DEF_ID, count, children: [] }],
    }],
  };
}

// Repro A: MAX armeeweit UND MAX je Kontingent-Rahmen an derselben Definition.
const MAX_ROSTER_AND_MAX_FORCE = `
  <constraint id="${MAX_ROSTER_LIMIT_ID}" type="max" value="1" field="selections" scope="roster" includeChildSelections="true"/>
  <constraint id="${MAX_FORCE_LIMIT_ID}" type="max" value="1" field="selections" scope="force" includeChildSelections="true"/>`;

// Repro B: MIN armeeweit UND MAX im Kontingent-Rahmen an derselben Definition.
const MIN_ROSTER_AND_MAX_FORCE = `
  <constraint id="${MIN_ROSTER_LIMIT_ID}" type="min" value="3" field="selections" scope="roster" includeChildSelections="true"/>
  <constraint id="${MAX_FORCE_LIMIT_ID}" type="max" value="1" field="selections" scope="force" includeChildSelections="true"/>`;

// ── Repro A: max(roster) + max(force) an einer unverlinkten Kategorie ────────

describe('Kriterium 3: unverlinkte Kategorie mit max=1 (roster) UND max=1 (force), ein Kontingent, 2 Mitglieder', () => {
  const CATALOGUE = catalogXml(MAX_ROSTER_AND_MAX_FORCE);

  it('A1: die armeeweite MAX-Grenze meldet genau EINMAL (Ist 2, Grenzwert 1) — kein zweiter Anker wiederholt sie', () => {
    // Heute rot: Wurzel-Anker UND Kontingent-Anker werten beide ALLE Grenzen
    // der Definition aus — die roster-Grenze erscheint doppelt.
    const report = evaluate(CATALOGUE, rosterWithGiants(2));

    const messages = messagesOf(report, MAX_ROSTER_LIMIT_ID);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ actual: 2, bound: 1 });
  });

  it('A2 (KONTROLLE/PIN): die Kontingent-MAX-Grenze meldet genau EINMAL (Ist 2, Grenzwert 1)', () => {
    // Vermutlich schon heute gruen (nur der Kontingent-Anker kann den
    // force-Rahmen aufloesen); gepinnt, damit die Korrektur der Doppelmeldung
    // diese Grenze weder verdoppelt noch verschluckt. Ist 2: `scope="force"`
    // zaehlt ein Kategorie-Ziel armeeweit (§7.6/§7.7, ADR 0029; derselbe Pin
    // wie im Schwester-Test `evalTree.unlinkedCategoryMax.test.js`).
    const report = evaluate(CATALOGUE, rosterWithGiants(2));

    const messages = messagesOf(report, MAX_FORCE_LIMIT_ID);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ actual: 2, bound: 1 });
  });

  it('A3: der Bericht traegt KEINE `unresolvedScope`-Diagnose — der Rahmen-Zuschnitt eines Ankers ist kein Datenfehler', () => {
    // Heute rot: der Wurzel-Anker versucht die force-Grenze auszuwerten, kann
    // den Rahmen dort nicht aufloesen und hinterlaesst
    // `{kind:"unresolvedScope", scope:"force"}` als unechte Diagnose.
    const report = evaluate(CATALOGUE, rosterWithGiants(2));

    expect(unresolvedScopeDiagnosticsOf(report)).toEqual([]);
  });

  it('A4 (KONTROLLE): der gesamte Bericht traegt genau ZWEI Verletzungen — eine je Grenze', () => {
    // Heute rot (drei Meldungen: roster-max doppelt + force-max einmal).
    // Der Katalog enthaelt keine anderen Grenzen; jede weitere Meldung waere
    // eine Doppelmeldung und verletzt Kriterium 3.
    const report = evaluate(CATALOGUE, rosterWithGiants(2));

    expect(report.violations).toHaveLength(2);
    const limitIds = report.violations.map(message => message.limitId).sort();
    expect(limitIds).toEqual([MAX_FORCE_LIMIT_ID, MAX_ROSTER_LIMIT_ID].sort());
  });
});

// ── Repro B: min(roster) + max(force) an einer unverlinkten Kategorie ────────

describe('Kriterium 3: unverlinkte Kategorie mit min=3 (roster) UND max=1 (force), ein Kontingent, 2 Mitglieder', () => {
  const CATALOGUE = catalogXml(MIN_ROSTER_AND_MAX_FORCE);

  it('B1: die armeeweite MIN-Grenze meldet genau EINMAL (Ist 2, Grenzwert 3)', () => {
    // Heute rot: das Wurzel-Pflicht-Phantom meldet die MIN-Grenze, und der
    // synthetisierte Kontingent-Anker wertet dieselbe roster-Grenze noch
    // einmal aus — Doppelmeldung.
    const report = evaluate(CATALOGUE, rosterWithGiants(2));

    const messages = messagesOf(report, MIN_ROSTER_LIMIT_ID);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ actual: 2, bound: 3 });
  });

  it('B2 (KONTROLLE/PIN): die Kontingent-MAX-Grenze meldet genau EINMAL (Ist 2, Grenzwert 1)', () => {
    // Vermutlich schon heute gruen; gepinnt gegen Ueber-Korrektur: die
    // force-Grenze muss in ihrem Rahmen ausgewertet bleiben. Ist 2 nach der
    // Ziel-Typ-Regel (§7.6/§7.7: Kategorie-Ziel armeeweit) — bei genau einem
    // Kontingent ohnehin deckungsgleich mit der Zaehlung je Kontingent.
    const report = evaluate(CATALOGUE, rosterWithGiants(2));

    const messages = messagesOf(report, MAX_FORCE_LIMIT_ID);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ actual: 2, bound: 1 });
  });

  it('B3 (KONTROLLE): der gesamte Bericht traegt genau ZWEI Verletzungen — eine je Grenze', () => {
    // Heute rot (drei Meldungen: roster-min doppelt + force-max einmal).
    const report = evaluate(CATALOGUE, rosterWithGiants(2));

    expect(report.violations).toHaveLength(2);
    const limitIds = report.violations.map(message => message.limitId).sort();
    expect(limitIds).toEqual([MAX_FORCE_LIMIT_ID, MIN_ROSTER_LIMIT_ID].sort());
  });
});
