/**
 * Issue 0092 — „Kategorie nur mit Max-Grenze wird nie ausgewertet".
 *
 * `docs/battlescribe-data-format.md` §5.5/§5.6: Grenzen koennen direkt an der
 * `categoryEntry`-Definition haengen und gelten dann, **ohne** dass irgendein
 * `categoryLink` sie wiederholt. Eine `categoryEntry`, die ausschliesslich
 * MAX-Grenzen traegt und von keinem Kontingent per `categoryLink` gefuehrt wird,
 * muss trotzdem ausgewertet werden — heute bekommt sie keinerlei Anker und ihre
 * Grenze bleibt still unausgewertet. Die klassische „0–1"-Kodierung (max ohne
 * min) ist genau dieses Muster.
 *
 * Beobachtet wird ausschliesslich der Bericht der echten Fassade
 * (`evaluate`/`prepareDataset`), nie die Baumstruktur selbst.
 *
 * **Aequivalenz-Wahl fuer Kriterium 2** („dieselben Ergebnisse, ob verlinkt oder
 * nicht"): verglichen werden die **deduplizierten** Tupel
 * `(limitId, actual, bound)` der Verletzungen — nicht die vollen Meldungslisten.
 * Begruendung: (a) eine verlinkte Kategorie ankert legitim an einem anderen Slot
 * (Kategorie-Anker am Kontingent) als eine unverlinkte, Slot-Identitaet ist also
 * nicht Teil des Kriteriums; (b) Issue 0093 dokumentiert eine **vorbestehende**
 * Doppelmeldung armeeweiter Kategorie-MIN-Grenzen (Wurzel-Phantom + verlinkendes
 * Kontingent) — die Multiplizitaet im verlinkten Fall wird hier bewusst nicht in
 * beide Richtungen festgeschrieben. `satisfied` ist implizit: die
 * `violations`-Liste fuehrt nur unerfuellte Grenzen.
 *
 * Die Multiplizitaet des **unverlinkten** Max-only-Falls dagegen ist Kriterium 3
 * und wird hart gepinnt: genau EINE Verletzung, keine Duplikate.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate as evaluateDataset, prepareDataset } from './evaluator.js';
import { MessageOrigin } from './model.js';

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

/**
 * Die deduplizierten Verletzungs-Tupel `(limitId, actual, bound)` zu den
 * genannten Grenz-Ids, sortiert — die Vergleichsgroesse fuer Kriterium 2
 * (siehe Kopfkommentar zur Aequivalenz-Wahl).
 */
function violationTuplesOf(report, limitIds) {
  const tuples = new Set();
  for (const message of report.violations) {
    if (!limitIds.includes(message.limitId)) continue;
    tuples.add(`${message.limitId}|actual=${message.actual}|bound=${message.bound}`);
  }
  return [...tuples].sort();
}

const RARE_CATEGORY_ID = 'cat-rare';
const FORCE_DEF_ID = 'force-army';
const SECOND_FORCE_DEF_ID = 'force-allies';
const GIANT_DEF_ID = 'entry-giant';
const MAX_RARE_LIMIT_ID = 'max-rare';
const MIN_RARE_LIMIT_ID = 'min-rare';

/**
 * Baut den Katalog des Repro-Falls: eine Kategorie „Rare" mit den uebergebenen
 * Grenzen direkt an der `categoryEntry`, zwei Kontingent-Definitionen und ein
 * Eintrag „Giant", der der Kategorie ueber seinen eigenen `categoryLink`
 * angehoert (so wird Mitgliedschaft im Datenformat modelliert, §5.5).
 *
 * `withCategoryLink` entscheidet, ob das erste Kontingent die Kategorie
 * zusaetzlich per `categoryLink` fuehrt — der Vergleichshebel fuer Kriterium 2.
 * Der Link traegt bewusst keine eigenen Grenzen: er erbt die der Kategorie.
 */
function catalogXml({ categoryConstraintsXml, withCategoryLink }) {
  const forceCategoryLinks = withCategoryLink
    ? `<categoryLinks>
         <categoryLink id="clink-force-rare" name="Rare" targetId="${RARE_CATEGORY_ID}"/>
       </categoryLinks>`
    : '';
  return `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-0092" name="Unlinked Category Max Catalogue">
      <categoryEntries>
        <categoryEntry id="${RARE_CATEGORY_ID}" name="Rare">
          <constraints>
            ${categoryConstraintsXml}
          </constraints>
        </categoryEntry>
      </categoryEntries>
      <forceEntries>
        <forceEntry id="${FORCE_DEF_ID}" name="Army">
          ${forceCategoryLinks}
        </forceEntry>
        <forceEntry id="${SECOND_FORCE_DEF_ID}" name="Allies"/>
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

/** Ein Roster: ein Kontingent „Army" mit `count` Giants (Kategorie-Mitgliedern). */
function rosterWithGiants(count) {
  return {
    forces: [{
      defId: FORCE_DEF_ID,
      count: 1,
      children: count === 0 ? [] : [{ defId: GIANT_DEF_ID, count, children: [] }],
    }],
  };
}

const MAX_ONLY_ROSTER_SCOPE = `<constraint id="${MAX_RARE_LIMIT_ID}" type="max" value="1" field="selections" scope="roster" includeChildSelections="true"/>`;
const MAX_ONLY_FORCE_SCOPE = `<constraint id="${MAX_RARE_LIMIT_ID}" type="max" value="1" field="selections" scope="force" includeChildSelections="true"/>`;
const MIN_ONLY_ROSTER_SCOPE = `<constraint id="${MIN_RARE_LIMIT_ID}" type="min" value="1" field="selections" scope="roster" includeChildSelections="true"/>`;
const MIN_AND_MAX_ROSTER_SCOPE = `
  <constraint id="${MIN_RARE_LIMIT_ID}" type="min" value="3" field="selections" scope="roster" includeChildSelections="true"/>
  <constraint id="${MAX_RARE_LIMIT_ID}" type="max" value="1" field="selections" scope="roster" includeChildSelections="true"/>`;

// ── Kriterium 1: Max-only-Kategorie ohne categoryLink, armeeweiter Rahmen ────

describe('Kriterium 1: unverlinkte Kategorie mit ausschliesslich MAX-Grenze (scope="roster")', () => {
  const CATALOGUE = catalogXml({ categoryConstraintsXml: MAX_ONLY_ROSTER_SCOPE, withCategoryLink: false });

  it('wertet die Grenze aus: zwei Mitglieder gegen max=1 ergeben genau eine Verletzung mit Ist 2 und Grenzwert 1', () => {
    // Der Repro-Fall des Issues: heute 0 Verletzungen, weil die Kategorie ohne
    // MIN-Grenze und ohne verlinkendes Kontingent keinerlei Anker bekommt.
    const report = evaluate(CATALOGUE, rosterWithGiants(2));

    const messages = messagesOf(report, MAX_RARE_LIMIT_ID);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      origin: MessageOrigin.DERIVED_LIMIT,
      actual: 2,
      bound: 1,
    });
  });

  it('KONTROLLE (0–1-Kodierung, eingehaltene Grenze): genau ein Mitglied gegen max=1 meldet nichts', () => {
    // Heute trivialerweise gruen (die Grenze wird gar nicht ausgewertet); gepinnt,
    // damit die Korrektur nicht ueber das Ziel hinaus meldet.
    const report = evaluate(CATALOGUE, rosterWithGiants(1));

    expect(messagesOf(report, MAX_RARE_LIMIT_ID)).toHaveLength(0);
  });
});

// ── Kriterium 1: Max-only-Kategorie ohne categoryLink, Kontingent-Rahmen ─────

describe('Kriterium 1: unverlinkte Kategorie mit ausschliesslich MAX-Grenze (scope="force")', () => {
  const CATALOGUE = catalogXml({ categoryConstraintsXml: MAX_ONLY_FORCE_SCOPE, withCategoryLink: false });

  it('wertet die Grenze im Kontingent aus: zwei Mitglieder in einem Kontingent gegen max=1', () => {
    const report = evaluate(CATALOGUE, rosterWithGiants(2));

    const messages = messagesOf(report, MAX_RARE_LIMIT_ID);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ actual: 2, bound: 1 });
  });

  it('ein leeres zweites Kontingent erzeugt keine zusaetzliche Verletzung derselben Grenze', () => {
    // Welcher Rahmen eine unverlinkte Kategorie ankert, laesst der Test offen
    // (Slot-Identitaet ist nicht gepinnt) — beobachtet wird nur: ein leeres
    // Kontingent haelt max=1 ein (0 <= 1) und darf nichts melden, das volle
    // meldet genau einmal.
    const report = evaluate(CATALOGUE, {
      forces: [
        { defId: FORCE_DEF_ID, count: 1, children: [{ defId: GIANT_DEF_ID, count: 2, children: [] }] },
        { defId: SECOND_FORCE_DEF_ID, count: 1, children: [] },
      ],
    });

    const messages = messagesOf(report, MAX_RARE_LIMIT_ID);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ actual: 2, bound: 1 });
  });
});

// ── Kriterium 2: verlinkt und unverlinkt liefern dieselben Ergebnisse ────────

describe('Kriterium 2: dieselben Ergebnisse mit und ohne zusaetzlichen categoryLink', () => {
  it('MAX-only: die Verletzungs-Tupel (limitId, actual, bound) sind in beiden Varianten gleich', () => {
    // Heute rot: die verlinkte Variante meldet (Kategorie-Anker am Kontingent),
    // die unverlinkte meldet nichts.
    const linked = evaluate(
      catalogXml({ categoryConstraintsXml: MAX_ONLY_ROSTER_SCOPE, withCategoryLink: true }),
      rosterWithGiants(2),
    );
    const unlinked = evaluate(
      catalogXml({ categoryConstraintsXml: MAX_ONLY_ROSTER_SCOPE, withCategoryLink: false }),
      rosterWithGiants(2),
    );

    const linkedTuples = violationTuplesOf(linked, [MAX_RARE_LIMIT_ID]);
    expect(linkedTuples).toHaveLength(1); // die verlinkte Variante meldet die Grenze
    expect(violationTuplesOf(unlinked, [MAX_RARE_LIMIT_ID])).toEqual(linkedTuples);
  });

  it('KONTROLLE MIN+MAX: die Verletzungs-Tupel beider Grenzen sind in beiden Varianten gleich', () => {
    // Der Gegen-Repro des Issues: mit zusaetzlicher MIN-Grenze reitet die
    // MAX-Auswertung heute auf dem Pflicht-Phantom mit — dieser Gleichstand darf
    // durch die Korrektur nicht kippen. Verglichen werden deduplizierte Tupel
    // (Aequivalenz-Wahl im Kopfkommentar; Multiplizitaet ist Issue 0093).
    const linked = evaluate(
      catalogXml({ categoryConstraintsXml: MIN_AND_MAX_ROSTER_SCOPE, withCategoryLink: true }),
      rosterWithGiants(2),
    );
    const unlinked = evaluate(
      catalogXml({ categoryConstraintsXml: MIN_AND_MAX_ROSTER_SCOPE, withCategoryLink: false }),
      rosterWithGiants(2),
    );

    const linkedTuples = violationTuplesOf(linked, [MIN_RARE_LIMIT_ID, MAX_RARE_LIMIT_ID]);
    // Beide Grenzen sind verletzt (2 < min 3, 2 > max 1) und muessen als Tupel da sein.
    expect(linkedTuples).toEqual([
      `${MAX_RARE_LIMIT_ID}|actual=2|bound=1`,
      `${MIN_RARE_LIMIT_ID}|actual=2|bound=3`,
    ]);
    expect(violationTuplesOf(unlinked, [MIN_RARE_LIMIT_ID, MAX_RARE_LIMIT_ID])).toEqual(linkedTuples);
  });
});

// ── Kriterium 3: keine Doppelmeldungen im Max-only-Fall ──────────────────────

describe('Kriterium 3: der unverlinkte Max-only-Fall meldet genau einmal', () => {
  it('genau EINE Verletzung ueber den gesamten Bericht — kein zweiter Anker meldet dieselbe Grenze', () => {
    const report = evaluate(
      catalogXml({ categoryConstraintsXml: MAX_ONLY_ROSTER_SCOPE, withCategoryLink: false }),
      rosterWithGiants(2),
    );

    // Nicht nur je Grenz-Id einmal: der ganze Bericht traegt genau diese eine
    // Meldung (der Katalog enthaelt keine andere Grenze).
    expect(report.violations).toHaveLength(1);
    expect(report.violations[0]).toMatchObject({ limitId: MAX_RARE_LIMIT_ID, actual: 2, bound: 1 });
  });

  it('KONTROLLE: die verlinkte Max-only-Kategorie behaelt ihre genau eine Meldung', () => {
    // Heute gruen (genau ein Kategorie-Anker am verlinkenden Kontingent, kein
    // Wurzel-Phantom fuer eine Grenze ohne MIN): gepinnt, damit die Korrektur
    // dem verlinkten Fall keinen zweiten Anker unterschiebt.
    const report = evaluate(
      catalogXml({ categoryConstraintsXml: MAX_ONLY_ROSTER_SCOPE, withCategoryLink: true }),
      rosterWithGiants(2),
    );

    expect(messagesOf(report, MAX_RARE_LIMIT_ID)).toHaveLength(1);
  });
});

// ── Kontrollen: die bestehenden Kategorie-Pfade bleiben unveraendert ─────────

describe('KONTROLLE: bestehende Anker-Pfade fuer Kategorie-Grenzen', () => {
  it('MIN-only unverlinkt: das Pflicht-Phantom meldet die fehlende Pflicht weiterhin (Ist 0, Grenzwert 1)', () => {
    const report = evaluate(
      catalogXml({ categoryConstraintsXml: MIN_ONLY_ROSTER_SCOPE, withCategoryLink: false }),
      rosterWithGiants(0),
    );

    const messages = messagesOf(report, MIN_RARE_LIMIT_ID);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ actual: 0, bound: 1 });
  });

  it('MIN+MAX unverlinkt: beide Grenzen melden weiterhin (der heutige Huckepack-Pfad)', () => {
    const report = evaluate(
      catalogXml({ categoryConstraintsXml: MIN_AND_MAX_ROSTER_SCOPE, withCategoryLink: false }),
      rosterWithGiants(2),
    );

    expect(violationTuplesOf(report, [MIN_RARE_LIMIT_ID, MAX_RARE_LIMIT_ID])).toEqual([
      `${MAX_RARE_LIMIT_ID}|actual=2|bound=1`,
      `${MIN_RARE_LIMIT_ID}|actual=2|bound=3`,
    ]);
  });
});
