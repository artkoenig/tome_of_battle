/**
 * Issue 0085 an den **echten** Katalogdaten des Repos
 * (`src/evaluator/__fixtures__/whfb6-definitive/`) — die Ogerbullen-Pflicht der
 * „Definitive Edition", der Fall, aus dem §9.9 die zweite Wurzelform ueberhaupt
 * ableitet.
 *
 * Die Kodierung im Katalog (Recherche im Issue-Log, 2026-07-29):
 * `Ogre Kingdoms (…).cat` fuehrt auf **Katalog-Wurzelebene**
 * `<entryLink id="d82e-111e-89b9-2be1" targetId="7754-8b3d-df99-d2d5">` („Ogre
 * Bulls"); der Link traegt die Grenze `32ed-26da-3f27-5c04`
 * (`min=0 scope="force"`), die eine Modifikatorgruppe „Standard" per
 * `set 1` anhebt — gegatet auf `notInstanceOf` des `forceEntry`
 * „Ironskin Tribe" (`8711-ed16-2a44-7251`). Das Ziel liegt in
 * `Mercenaries (…).cat` unter `sharedSelectionEntries`.
 *
 * Damit belegt dieser Datensatz an echten Daten:
 * - Kriterium 1 im Rahmen `force` (D1: der belegte Rahmen),
 * - Kriterium 2, beide Haelften: die bedingte Anhebung greift im
 *   „Standard"-Kontingent und greift im „Ironskin Tribe"-Kontingent nicht,
 * - D5: die vorhandene Einheit unterdrueckt den Verstoss.
 *
 * Gepinnt wird die Meldung zu **dieser einen Grenz-Id**; die uebrigen Regeln des
 * Katalogs sind nicht Gegenstand dieses Issues. Die einzige Ausnahme ist der
 * ausdrueckliche Zaehl-Pin aus der Recherche („leeres Standard-Kontingent
 * 4 → 5 Verstoesse") — er haelt fest, dass genau EINE Meldung hinzukommt.
 *
 * Muster: `evaluator.primaryCatalogueFixture.test.js` (echte Daten, eine
 * Aufbereitung fuer alle Faelle).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate, prepareDataset } from './evaluator.js';
import { MessageSeverity } from './model.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const FIXTURE_DIR = join(process.cwd(), 'src/evaluator/__fixtures__/whfb6-definitive');

/** Liest eine Fixture-Katalogdatei als XML-Text. */
function fixture(fileName) {
  return readFileSync(join(FIXTURE_DIR, fileName), 'utf8');
}

// Ogre Kingdoms braucht die Mercenaries-`.cat` (deklarierter `catalogueLink`) —
// dort liegt das Ziel des Wurzel-Links.
const PREPARED = prepareDataset({
  gameSystem: fixture('Warhammer Fantasy Battles (6th definitive edition).gst'),
  catalogues: [
    fixture('Ogre Kingdoms (6th definitive edition).cat'),
    fixture('Mercenaries (6th definitive edition).cat'),
  ],
});

const STANDARD_FORCE_ID = '729f-9246-5cd3-5044'; // forceEntry „Standard (OK-AB)"
const IRONSKIN_FORCE_ID = '8711-ed16-2a44-7251'; // forceEntry „Ironskin Tribe"
const BULLS_LINK_ID = 'd82e-111e-89b9-2be1';     // Wurzel-`entryLink` „Ogre Bulls"
const BULLS_TARGET_ID = '7754-8b3d-df99-d2d5';   // sein Ziel in der Mercenaries-`.cat`
const BULLS_MIN_LIMIT_ID = '32ed-26da-3f27-5c04'; // die Grenze AM LINK

/** Ein Roster mit genau einem Kontingent des gegebenen Typs. */
function rosterWithForce(forceDefId, children = []) {
  return { forces: [{ defId: forceDefId, count: 1, children }] };
}

/** Die Meldungen zur Ogerbullen-Pflicht. */
function bullsMessagesOf(report) {
  return report.violations.filter(message => message.limitId === BULLS_MIN_LIMIT_ID);
}

describe('Kriterium 1 an echten Katalogdaten: die Ogerbullen-Pflicht am Wurzel-entryLink', () => {
  it('leeres „Standard"-Kontingent: die Pflicht meldet genau einmal (Ist 0 gegen 1)', () => {
    // Heute rot: der Bericht traegt 4 Verstoesse, keiner davon diese Grenz-Id —
    // die Liste ohne Ogerbullen ist stumm gruen (Issue-Repro).
    const report = evaluate(PREPARED, rosterWithForce(STANDARD_FORCE_ID));

    const messages = bullsMessagesOf(report);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      actual: 0,
      bound: 1,
      severity: MessageSeverity.ERROR, // „blockierender Verstoss"
    });
  });

  it('leeres „Standard"-Kontingent: es kommt GENAU EINE Meldung hinzu (4 → 5)', () => {
    // Der Zaehl-Pin aus der Recherche: die uebrigen vier Meldungen des
    // Kontingents bleiben, und die neue Pflicht meldet nicht doppelt.
    const report = evaluate(PREPARED, rosterWithForce(STANDARD_FORCE_ID));

    expect(report.violations).toHaveLength(5);
  });
});

describe('Kriterium 2 an echten Katalogdaten: die bedingte Anhebung des Links', () => {
  it('„Ironskin Tribe"-Kontingent: die Bedingung greift nicht, also KEIN Verstoss (4 Meldungen) — im „Standard" sehr wohl', () => {
    // Die Modifikatorgruppe „Standard" (`set 1`) ist auf `notInstanceOf` des
    // Ironskin-`forceEntry` gegatet: in diesem Kontingent bleibt die Grenze bei
    // ihrer Basis `min=0`, die Meldungszahl also bei 4 — die Gegenprobe zum
    // 4 → 5 des „Standard"-Kontingents. Die letzte Haelfte ist die positive
    // Kontrolle: heute rot, weil die Pflicht nirgends meldet.
    const ironskinReport = evaluate(PREPARED, rosterWithForce(IRONSKIN_FORCE_ID));
    expect(bullsMessagesOf(ironskinReport)).toHaveLength(0);
    expect(ironskinReport.violations).toHaveLength(4);

    const standardReport = evaluate(PREPARED, rosterWithForce(STANDARD_FORCE_ID));
    expect(bullsMessagesOf(standardReport)).toHaveLength(1);
  });
});

describe('D5 an echten Katalogdaten: die vorhandenen Ogerbullen unterdruecken den Verstoss', () => {
  it('„Standard"-Kontingent mit der Einheit unter der LINK-Id: keine Pflichtmeldung — leer: eine', () => {
    // Die Roster-Identitaetsregel der Fassade: eine ueber einen `entryLink`
    // gesetzte Auswahl traegt die LINK-Id (`.ros`-Beleg im Issue, D5).
    const withBulls = evaluate(PREPARED, rosterWithForce(STANDARD_FORCE_ID, [
      { defId: BULLS_LINK_ID, count: 1, children: [] },
    ]));
    expect(bullsMessagesOf(withBulls)).toHaveLength(0);

    // Positive Kontrolle im selben Test: ohne die Einheit meldet dieselbe
    // Grenze (heute rot).
    const withoutBulls = evaluate(PREPARED, rosterWithForce(STANDARD_FORCE_ID));
    expect(bullsMessagesOf(withoutBulls)).toHaveLength(1);
  });

  it('„Standard"-Kontingent mit der Einheit unter der ZIEL-Id: ebenfalls keine Pflichtmeldung (D5)', () => {
    // D5: „Abwesenheit zaehlt ueber Link-Id UND aufgeloeste Ziel-Id".
    const withTargetId = evaluate(PREPARED, rosterWithForce(STANDARD_FORCE_ID, [
      { defId: BULLS_TARGET_ID, count: 1, children: [] },
    ]));
    expect(bullsMessagesOf(withTargetId)).toHaveLength(0);

    const withoutBulls = evaluate(PREPARED, rosterWithForce(STANDARD_FORCE_ID));
    expect(bullsMessagesOf(withoutBulls)).toHaveLength(1);
  });
});
