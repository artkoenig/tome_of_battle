/**
 * Issue 0139 — „Eine Autor-Meldung am Pflicht-Phantom meldet eine gar nicht
 * gewaehlte Einheit".
 *
 * Ein Pflicht-Phantom ist der Anker fuer eine **abwesende** Definition. Es
 * entsteht schon dann, wenn eine Definition ueberhaupt eine `min`-Grenze im
 * Rahmen traegt — auch mit Wert 0, denn ein Modifier kann den Wert erst in der
 * Fixpunktschleife anheben (genau das Idiom der Definitive Edition: eine
 * Sonderfigur mit `min value="0" scope="force"`, angehoben nur unter einem
 * bestimmten Sonderheer). Haengt am selben Eintrag ein `modifier type="add"
 * field="error"`, dessen Bedingung in der leeren Liste haelt, meldet der Bericht
 * heute einen blockierenden Fehler ueber eine Einheit, die niemand gewaehlt hat.
 *
 * Dieselbe Begruendung, die den Angebots-Anker schon aus der Meldungsliste haelt
 * („eine Meldung an einer nicht gewaehlten Option spraeche ueber etwas, das gar
 * nicht in der Liste steht"), gilt fuer das Pflicht-Phantom. Die unerfuellte
 * Pflicht selbst bleibt als abgeleitete Meldung erhalten.
 *
 * Beobachtet wird ausschliesslich die oeffentliche Fassade (`prepareDataset` +
 * `evaluate`): die Meldungsliste (`violations`) und die
 * Faehigkeitsdatensaetze (`capabilities`).
 */

import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate as evaluateDataset, prepareDataset } from '../../../domain/evaluator/evaluator.js';
import { rosterFromRos } from '../../test-utils/rosParser.js';
import { AnchorKind, MessageOrigin, MessageSeverity } from '../../../domain/evaluator/model.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

/** Wertet einen einzelnen synthetischen Katalog aus (ADR-0032: Datensatz-Form). */
function evaluate(catalogXml, roster) {
  return evaluateDataset(prepareDataset({ catalogues: [catalogXml] }), roster);
}

/** Die Autor-Meldungen des Berichts (Herkunft `authorMessage`). */
function authorMessagesOf(report) {
  return report.violations.filter(message => message.origin === MessageOrigin.AUTHOR_MESSAGE);
}

/** Der Faehigkeitsdatensatz des Slots, dessen Anker diese Definition traegt. */
function capabilityOfDef(report, defId) {
  return [...report.capabilities.values()].find(capability => capability.defId === defId) ?? null;
}

const FORCE_DEF_ID = 'force-army';
const GATE_DEF_ID = 'entry-gate';
const SPECIAL_DEF_ID = 'entry-special';
const PLAIN_DEF_ID = 'entry-plain';
const SPECIAL_MIN_LIMIT_ID = 'min-special-force';

const SPECIAL_MESSAGE = 'Please enable the gate';
const PLAIN_MESSAGE = 'A message at a chosen unit';

/**
 * Der Repro-Katalog des Issues, dem Definitive-Edition-Idiom nachgebaut:
 *
 * - `entry-gate` ist der Schalter, den die Bedingung zaehlt (in der Liste
 *   abwesend, also haelt „weniger als eine Auswahl davon").
 * - `entry-special` traegt eine `min`-Grenze im Kontingent-Rahmen (Wert per
 *   Parameter) — sie loest das Pflicht-Phantom aus — und die Autor-Meldung.
 * - `entry-plain` traegt dieselbe Autor-Meldung ohne jede Grenze; sie steht in
 *   der Liste und ist damit die Kontrolle fuer den belegten Slot.
 */
function catalogXml({ specialMinValue = 0, severityField = 'error' } = {}) {
  return `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-0139" name="Author Message Anchor Catalogue">
      <forceEntries>
        <forceEntry id="${FORCE_DEF_ID}" name="Army"/>
      </forceEntries>
      <selectionEntries>
        <selectionEntry id="${GATE_DEF_ID}" name="Gate" type="upgrade"/>
        <selectionEntry id="${SPECIAL_DEF_ID}" name="Special Character" type="unit">
          <constraints>
            <constraint id="${SPECIAL_MIN_LIMIT_ID}" type="min" value="${specialMinValue}" field="selections" scope="force" shared="true" includeChildSelections="false"/>
          </constraints>
          <modifiers>
            <modifier type="add" value="${SPECIAL_MESSAGE}" field="${severityField}">
              <conditions>
                <condition type="lessThan" value="1" field="selections" scope="force" childId="${GATE_DEF_ID}" shared="true" includeChildSelections="true"/>
              </conditions>
            </modifier>
          </modifiers>
        </selectionEntry>
        <selectionEntry id="${PLAIN_DEF_ID}" name="Plain Unit" type="unit">
          <modifiers>
            <modifier type="add" value="${PLAIN_MESSAGE}" field="error">
              <conditions>
                <condition type="lessThan" value="1" field="selections" scope="force" childId="${GATE_DEF_ID}" shared="true" includeChildSelections="true"/>
              </conditions>
            </modifier>
          </modifiers>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;
}

/** Ein Roster aus einem Kontingent mit den angegebenen Kindern. */
function rosterWith(childDefIds = []) {
  return {
    forces: [{
      defId: FORCE_DEF_ID,
      count: 1,
      children: childDefIds.map(defId => ({ defId, count: 1, children: [] })),
    }],
  };
}

// ── Kriterium 1: keine Autor-Meldung am Pflicht-Phantom ──────────────────────

describe('Kriterium 1: eine Autor-Meldung am Pflicht-Phantom erscheint nicht in der Meldungsliste', () => {
  it('min-Grenze mit Wert 0 (Phantom ohne unerfuellte Pflicht): keine Autor-Meldung', () => {
    const report = evaluate(catalogXml({ specialMinValue: 0 }), rosterWith([]));

    // Das Phantom existiert — die Meldung haette also einen Anker.
    expect(capabilityOfDef(report, SPECIAL_DEF_ID)?.anchorKind).toBe(AnchorKind.MANDATORY_PHANTOM);
    expect(authorMessagesOf(report)).toHaveLength(0);
  });

  it('min-Grenze mit Wert 1 (Phantom MIT unerfuellter Pflicht): keine Autor-Meldung', () => {
    const report = evaluate(catalogXml({ specialMinValue: 1 }), rosterWith([]));

    const messages = authorMessagesOf(report);
    expect(messages.map(message => message.text)).not.toContain(SPECIAL_MESSAGE);
    expect(messages).toHaveLength(0);
  });

  it('auch eine Warnung und ein Hinweis am Phantom bleiben aus der Meldungsliste', () => {
    for (const severityField of ['warning', 'info']) {
      const report = evaluate(catalogXml({ severityField }), rosterWith([]));

      expect(authorMessagesOf(report)).toHaveLength(0);
    }
  });
});

// ── Kriterium 2: der Faehigkeitsdatensatz des Phantoms fuehrt sie weiterhin ──

describe('Kriterium 2: der Faehigkeitsdatensatz des Phantoms fuehrt die Meldung unveraendert', () => {
  it('das Phantom traegt die Autor-Meldung in `authorMessages`', () => {
    const report = evaluate(catalogXml(), rosterWith([]));

    const capability = capabilityOfDef(report, SPECIAL_DEF_ID);
    expect(capability.anchorKind).toBe(AnchorKind.MANDATORY_PHANTOM);
    expect(capability.authorMessages).toEqual([
      { severity: MessageSeverity.ERROR, text: SPECIAL_MESSAGE },
    ]);
  });
});

// ── Kriterium 3: andere Ankerarten melden unveraendert ───────────────────────

describe('Kriterium 3: eine Autor-Meldung am belegten Slot erscheint unveraendert', () => {
  it('die gewaehlte Einheit meldet, das Phantom daneben nicht', () => {
    const report = evaluate(catalogXml(), rosterWith([PLAIN_DEF_ID]));

    const messages = authorMessagesOf(report);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      severity: MessageSeverity.ERROR,
      text: PLAIN_MESSAGE,
    });
    expect(messages[0].anchor.anchorKind).toBe(AnchorKind.OCCUPIED);
  });

  it('KONTROLLE: dieselbe Definition gewaehlt meldet — dann ist sie kein Phantom mehr', () => {
    const report = evaluate(catalogXml(), rosterWith([SPECIAL_DEF_ID]));

    const messages = authorMessagesOf(report);
    expect(messages).toHaveLength(1);
    expect(messages[0].text).toBe(SPECIAL_MESSAGE);
    expect(messages[0].anchor.anchorKind).toBe(AnchorKind.OCCUPIED);
  });
});

// ── Kriterium 4: die abgeleitete Pflicht-Meldung bleibt ──────────────────────

describe('Kriterium 4: die unerfuellte Pflicht am Phantom wird weiterhin gemeldet', () => {
  it('min 1, leere Liste: die abgeleitete Meldung feuert am Phantom', () => {
    const report = evaluate(catalogXml({ specialMinValue: 1 }), rosterWith([]));

    const derived = report.violations.filter(message => message.limitId === SPECIAL_MIN_LIMIT_ID);
    expect(derived).toHaveLength(1);
    expect(derived[0]).toMatchObject({ origin: MessageOrigin.DERIVED_LIMIT, actual: 0, bound: 1 });
    expect(derived[0].anchor.anchorKind).toBe(AnchorKind.MANDATORY_PHANTOM);
  });
});

// ── Kriterium 5: der gemeldete Fall an echten Katalogdaten ───────────────────

describe('Kriterium 5: die leere Vampire-Counts-Liste (echte Definitive-Edition-Fixtures)', () => {
  const FIXTURES = 'src/domain/evaluator/__fixtures__/whfb6-definitive';
  const EMPTY_VAMPIRE_ROSTER = 'docs/testing/vampire-counts/rosters/01-empty-force.ros';
  const SPECIAL_CHARACTERS_MESSAGE = 'Please enable "Allow special characters?"';

  /** Die vier Pflichten, die an der leeren VC-Liste feuern muessen. */
  const MANDATORY_LIMIT_IDS = [
    '4a0a-b107-e726-da32', // Bloodlines
    '6e19-e6be-295d-4b82', // The Laws of Undeath
    '1077-7379-f142-f382', // General
    '35c2-d478-392a-aeb1', // Core
  ];

  const report = evaluateDataset(
    prepareDataset({
      gameSystem: readFileSync(`${FIXTURES}/Warhammer Fantasy Battles (6th definitive edition).gst`, 'utf8'),
      catalogues: [
        readFileSync(`${FIXTURES}/Vampire Counts (6th definitive edition).cat`, 'utf8'),
        readFileSync(`${FIXTURES}/Mercenaries (6th definitive edition).cat`, 'utf8'),
      ],
    }),
    rosterFromRos(EMPTY_VAMPIRE_ROSTER),
  );

  it('traegt keine Meldung „Please enable ‚Allow special characters?‘" mehr', () => {
    expect(report.violations.map(message => message.text)).not.toContain(SPECIAL_CHARACTERS_MESSAGE);
    expect(authorMessagesOf(report)).toHaveLength(0);
  });

  it('behaelt ihre vier Pflicht-Verstoesse', () => {
    const firingLimitIds = report.violations.map(message => message.limitId);
    for (const limitId of MANDATORY_LIMIT_IDS) {
      expect(firingLimitIds, `Pflicht ${limitId} muss weiterhin feuern`).toContain(limitId);
    }
    expect(report.violations).toHaveLength(MANDATORY_LIMIT_IDS.length);
  });
});
